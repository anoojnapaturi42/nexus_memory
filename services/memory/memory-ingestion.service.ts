import { randomUUID } from "node:crypto";
import { GeminiLLMService } from "@/services/llm/gemini.service";
import { getGeminiEnv } from "@/services/llm/env";
import { memoryDatabaseRepository, type MemoryDatabaseRepository } from "@/repositories/database/memory-repository";
import type { DatabaseJson, DatabaseMemoryRecord, DatabaseMutationResult } from "@/types/database";
import type { Message } from "@/types/domain";
import type { GoogleWorkspaceCalendarDTO, GoogleWorkspaceEmailDTO } from "@/types/google-workspace-sync";
import type { LLMGenerateRequest, LLMGenerationResult, LLMProvider, LLMUsage } from "@/services/llm/provider";

export type MemoryIngestionSourceApp = "gmail" | "calendar" | "chat";

export type RawMemoryIngestionInput = {
  id?: string;
  sourceApp: MemoryIngestionSourceApp;
  content: string;
  title?: string;
  timestamp?: string;
  participants?: string[];
  metadata?: Record<string, DatabaseJson>;
};

export type ExtractedMemoryEntity = {
  name: string;
  type: "person" | "project" | "document" | "event" | "task" | "topic" | "unknown";
  confidence: number;
};

export type ExtractedMemoryCandidate = {
  content: string;
  importanceScore: number;
  tags: string[];
  entities: ExtractedMemoryEntity[];
  rationale?: string;
};

export type MemoryIngestionResult = {
  sourceApp: MemoryIngestionSourceApp;
  inputId: string | null;
  candidates: ExtractedMemoryCandidate[];
  storedMemories: DatabaseMemoryRecord[];
  storageSource: DatabaseMutationResult<DatabaseMemoryRecord>["source"] | null;
  usage?: LLMUsage;
};

type MemoryExtractionPayload = {
  memories?: ExtractedMemoryCandidate[];
};

function clampImportance(value: unknown) {
  const score = Number(value);
  if (!Number.isFinite(score)) return 0.5;
  return Math.min(1, Math.max(0, score));
}

function normalizeTags(tags: unknown, sourceApp: MemoryIngestionSourceApp) {
  const rawTags = Array.isArray(tags) ? tags : [];
  const normalized = rawTags
    .map((tag) => String(tag).trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 8);

  return Array.from(new Set([sourceApp, ...normalized]));
}

function normalizeEntities(entities: unknown): ExtractedMemoryEntity[] {
  if (!Array.isArray(entities)) return [];

  return entities
    .map((entity) => {
      const value = entity as Partial<ExtractedMemoryEntity>;
      return {
        name: String(value.name ?? "").trim(),
        type: value.type ?? "unknown",
        confidence: clampImportance(value.confidence),
      };
    })
    .filter((entity) => entity.name)
    .slice(0, 12);
}

function extractJsonPayload(text: string): MemoryExtractionPayload | null {
  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fencedMatch?.[1] ?? text;
  const match = candidate.match(/\{[\s\S]*\}/);
  if (!match) return null;

  try {
    return JSON.parse(match[0]) as MemoryExtractionPayload;
  } catch {
    return null;
  }
}

function estimateUsage(text: string): LLMUsage {
  const tokens = Math.max(1, Math.ceil(text.length / 4));
  return {
    inputTokens: tokens,
    outputTokens: tokens,
    totalTokens: tokens * 2,
  };
}

class DevelopmentMemoryExtractionProvider implements LLMProvider {
  provider = "memory-ingestion-dev";

  async generate(request: LLMGenerateRequest): Promise<LLMGenerationResult> {
    const content = request.prompt
      .split("raw content:")[1]
      ?.split("return json")[0]
      ?.trim()
      .replace(/\s+/g, " ")
      .slice(0, 320) || "workspace activity was captured.";
    const text = JSON.stringify({
      memories: [
        {
          content,
          importanceScore: /deadline|interview|meeting|follow up|urgent|due/i.test(content) ? 0.82 : 0.56,
          tags: Array.from(new Set(content.toLowerCase().match(/[a-z][a-z0-9-]{3,}/g)?.slice(0, 5) ?? ["workspace"])),
          entities: Array.from(new Set(content.match(/\b[A-Z][a-zA-Z0-9.-]{2,}\b/g) ?? [])).slice(0, 5).map((name) => ({
            name,
            type: "unknown",
            confidence: 0.62,
          })),
          rationale: "development fallback extraction",
        },
      ],
    });

    return {
      provider: this.provider,
      model: "development-memory-extractor",
      text,
      usage: estimateUsage(text),
    };
  }

  async *stream(request: LLMGenerateRequest) {
    const generated = await this.generate(request);
    yield { text: generated.text };
    return generated;
  }

  async embeddings(texts: string[]) {
    return {
      provider: this.provider,
      model: "not-used",
      embeddings: texts.map(() => []),
      usage: {
        inputTokens: texts.length,
        outputTokens: 0,
        totalTokens: texts.length,
      },
    };
  }
}

function createDefaultProvider() {
  const env = getGeminiEnv();
  if (env.ok) return new GeminiLLMService(env.env);
  if (process.env.NODE_ENV === "production") {
    throw new Error(env.error.message);
  }
  return new DevelopmentMemoryExtractionProvider();
}

export class DurableMemoryIngestionService {
  private resolvedProvider: LLMProvider | null = null;

  constructor(
    private readonly repository: MemoryDatabaseRepository = memoryDatabaseRepository,
    private readonly llm?: LLMProvider,
  ) {}

  async ingest(input: RawMemoryIngestionInput): Promise<MemoryIngestionResult> {
    const extraction = await this.extractCandidates(input);
    const candidates = extraction.candidates;
    const storedResults = await Promise.all(candidates.map((candidate) => this.persistCandidate(input, candidate)));

    return {
      sourceApp: input.sourceApp,
      inputId: input.id ?? null,
      candidates,
      storedMemories: storedResults.map((result) => result.item),
      storageSource: storedResults[0]?.source ?? null,
      usage: extraction.usage,
    };
  }

  async ingestMany(inputs: RawMemoryIngestionInput[]) {
    return Promise.all(inputs.map((input) => this.ingest(input)));
  }

  ingestGmailEmail(email: GoogleWorkspaceEmailDTO) {
    return this.ingest({
      id: email.id,
      sourceApp: "gmail",
      title: email.subject,
      content: [email.subject, email.snippet, `sender: ${email.sender}`].filter(Boolean).join("\n"),
      timestamp: email.timestamp,
      participants: [email.sender],
      metadata: {
        sender: email.sender,
        subject: email.subject,
      },
    });
  }

  ingestCalendarEvent(event: GoogleWorkspaceCalendarDTO) {
    return this.ingest({
      id: event.id,
      sourceApp: "calendar",
      title: event.title,
      content: [event.title, event.description, event.location ? `location: ${event.location}` : ""].filter(Boolean).join("\n"),
      timestamp: event.startTime,
      participants: event.attendees,
      metadata: {
        startTime: event.startTime,
        endTime: event.endTime,
        location: event.location ?? null,
      },
    });
  }

  ingestChatMessage(message: Message, conversationId?: string) {
    return this.ingest({
      id: message.id,
      sourceApp: "chat",
      title: `${message.role} message`,
      content: message.content,
      timestamp: message.timestamp,
      metadata: {
        role: message.role,
        conversationId: conversationId ?? null,
      },
    });
  }

  private async extractCandidates(input: RawMemoryIngestionInput): Promise<{ candidates: ExtractedMemoryCandidate[]; usage: LLMUsage }> {
    const generated = await this.getLLMProvider().generate({
      agentName: "memory-ingestion",
      taskType: "memory.extract",
      systemPrompt:
        "you extract durable memories from workspace content. return json only. do not include markdown. create only memories worth storing long term.",
      prompt: [
        `source app: ${input.sourceApp}`,
        `title: ${input.title ?? "untitled"}`,
        `timestamp: ${input.timestamp ?? new Date().toISOString()}`,
        `participants: ${(input.participants ?? []).join(", ") || "none"}`,
        `raw content: ${input.content}`,
        "return json with a memories array. each memory needs content, importanceScore from 0 to 1, tags, entities, and rationale.",
      ].join("\n"),
      context: {
        sourceApp: input.sourceApp,
        inputId: input.id ?? null,
        metadata: input.metadata ?? {},
      },
    });

    const payload = extractJsonPayload(generated.text);
    return {
      candidates: (payload?.memories ?? [])
        .map((candidate) => ({
          content: String(candidate.content ?? "").trim(),
          importanceScore: clampImportance(candidate.importanceScore),
          tags: normalizeTags(candidate.tags, input.sourceApp),
          entities: normalizeEntities(candidate.entities),
          rationale: candidate.rationale ? String(candidate.rationale) : undefined,
        }))
        .filter((candidate) => candidate.content.length > 0)
        .slice(0, 6),
      usage: generated.usage,
    };
  }

  private persistCandidate(input: RawMemoryIngestionInput, candidate: ExtractedMemoryCandidate) {
    const now = input.timestamp ?? new Date().toISOString();
    return this.repository.insert({
      id: randomUUID(),
      content: candidate.content,
      source_app: input.sourceApp,
      importance_score: candidate.importanceScore,
      tags: candidate.tags,
      embedding: null,
      metadata: {
        ...(input.metadata ?? {}),
        sourceInputId: input.id ?? null,
        title: input.title ?? null,
        participants: input.participants ?? [],
        entities: candidate.entities as unknown as DatabaseJson,
        rationale: candidate.rationale ?? null,
        ingestionPipeline: "raw-content-extraction-scoring-tagging-persistence",
      },
      created_at: now,
      updated_at: now,
    });
  }

  private getLLMProvider() {
    if (this.llm) return this.llm;
    this.resolvedProvider ??= createDefaultProvider();
    return this.resolvedProvider;
  }
}

export const durableMemoryIngestionService = new DurableMemoryIngestionService();
