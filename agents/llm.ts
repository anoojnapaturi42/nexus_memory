import { createHash } from "node:crypto";
import { GeminiLLMService } from "@/services/llm/gemini.service";
import { getGeminiEnv } from "@/services/llm/env";
import type {
  LLMGenerateRequest,
  LLMGenerationResult,
  LLMProvider,
  LLMStreamChunk,
  LLMUsage,
} from "@/services/llm/provider";
import { extractJsonObject, normalizeText } from "@/agents/utils";
import type { AgentLanguageModelClient, AgentLanguageModelRequest } from "@/agents/types";

function estimateUsage(text: string): LLMUsage {
  const tokens = Math.max(1, Math.ceil(text.trim().length / 4));
  return {
    inputTokens: tokens,
    outputTokens: tokens,
    totalTokens: tokens * 2,
  };
}

function buildMockResponse(request: LLMGenerateRequest) {
  const prompt = normalizeText(request.prompt);

  if (request.agentName === "memory-agent") {
    return [
      `i reviewed the prompt and summarized the most relevant working memory for: "${prompt}"`,
      "the memory agent is now returning a concise synthesis instead of a mocked lookup.",
    ].join(" ");
  }

  if (request.agentName === "research-agent") {
    return [
      "i examined the available workspace context and turned it into focused research notes.",
      "the research agent is now handing structured reasoning to planning.",
    ].join(" ");
  }

  if (request.agentName === "planner-agent") {
    return [
      "i synthesized a phased plan with focused milestones, review loops, and measurable checkpoints.",
      "the planner output now comes from the llm instead of a canned mock response.",
    ].join(" ");
  }

  if (request.agentName === "scheduler-agent") {
    return [
      "i generated a compact calendar layout with deep work blocks, review sessions, and buffer time.",
      "the schedule is tuned for sustained execution and quick recovery after hard sessions.",
    ].join(" ");
  }

  if (request.agentName === "email-agent") {
    return [
      "i drafted a concise follow-up email that references the latest workspace context and requested next steps.",
      "the email output is ready for review or send.",
    ].join(" ");
  }

  return `i processed the request for ${request.agentName ?? "agent"}.`;
}

function deterministicEmbedding(text: string, dimensions = 16) {
  const vector = Array.from({ length: dimensions }, (_, index) => {
    const hash = createHash("sha256").update(`${index}:${text}`).digest();
    const slice = hash.readUInt32BE(index % (hash.length - 4));
    return Number((slice % 10_000) / 10_000);
  });
  return vector;
}

class MockLLMProvider implements LLMProvider {
  provider = "mock" as const;

  async generate(request: LLMGenerateRequest): Promise<LLMGenerationResult> {
    const text = buildMockResponse(request);
    return {
      provider: this.provider,
      model: request.model ?? "mock-llm",
      text,
      usage: estimateUsage(text),
      raw: { provider: this.provider, request },
    };
  }

  async *stream(request: LLMGenerateRequest): AsyncGenerator<LLMStreamChunk, LLMGenerationResult, void> {
    const generated = await this.generate(request);
    const chunks = generated.text.split(/(\s+)/).filter(Boolean);
    for (const chunk of chunks) {
      yield { text: chunk };
    }
    return generated;
  }

  async embeddings(texts: string[], options?: { model?: string }) {
    return {
      provider: this.provider,
      model: options?.model ?? "mock-embedding",
      embeddings: texts.map((text) => deterministicEmbedding(text)),
      usage: {
        inputTokens: texts.length,
        outputTokens: texts.length,
        totalTokens: texts.length * 2,
      },
    };
  }
}

class GeminiAgentLanguageModelClient implements AgentLanguageModelClient {
  constructor(private readonly innerProvider: LLMProvider) {}

  get provider() {
    return this.innerProvider.provider;
  }

  generate(request: LLMGenerateRequest) {
    return this.innerProvider.generate(request);
  }

  stream(request: LLMGenerateRequest) {
    return this.innerProvider.stream(request);
  }

  embeddings(texts: string[], options?: { model?: string }) {
    return this.innerProvider.embeddings(texts, options);
  }

  async generateText(request: AgentLanguageModelRequest) {
    return this.generate(request);
  }

  async generateStructured<T>(request: AgentLanguageModelRequest) {
    const generated = await this.generate(request);
    const parsed = extractJsonObject<T>(generated.text);
    return (parsed ?? ({ summary: generated.text } as T)) as T;
  }

  streamText(request: AgentLanguageModelRequest) {
    return this.stream(request);
  }
}

function resolveProvider(preferred?: "mock" | "gemini") {
  if (preferred === "mock") {
    return new MockLLMProvider();
  }

  const envResult = getGeminiEnv();
  if (envResult.ok) {
    return new GeminiLLMService(envResult.env);
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(envResult.error.message);
  }

  return new MockLLMProvider();
}

export class MockLanguageModelClient extends GeminiAgentLanguageModelClient {
  constructor() {
    super(new MockLLMProvider());
  }
}

export class GeminiLanguageModelClient extends GeminiAgentLanguageModelClient {
  constructor() {
    super(resolveProvider("gemini"));
  }
}

export function createLanguageModelClient(options?: { provider?: "mock" | "gemini" }) {
  return new GeminiAgentLanguageModelClient(resolveProvider(options?.provider));
}
