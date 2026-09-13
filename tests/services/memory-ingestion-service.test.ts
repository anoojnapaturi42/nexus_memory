import assert from "node:assert/strict";
import test from "node:test";
import { DurableMemoryIngestionService } from "@/services/memory/memory-ingestion.service";
import { MemoryDatabaseRepository } from "@/repositories/database/memory-repository";
import type { LLMGenerateRequest, LLMGenerationResult, LLMProvider, LLMStreamChunk } from "@/services/llm/provider";

const mockRuntime = {
  mode: "mock" as const,
  pool: null,
  supabase: null,
  available: {
    postgres: false,
    supabase: false,
  },
  missingEnv: [],
};

class FakeMemoryLLMProvider implements LLMProvider {
  provider = "fake-memory-llm";

  async generate(request: LLMGenerateRequest): Promise<LLMGenerationResult> {
    return {
      provider: this.provider,
      model: "fake",
      text: JSON.stringify({
        memories: [
          {
            content: `prepare for ${request.context?.sourceApp} interview follow-up`,
            importanceScore: 0.91,
            tags: ["Interview", " Follow-Up ", "calendar"],
            entities: [
              { name: "Raj", type: "person", confidence: 0.88 },
              { name: "Google ML Interview", type: "project", confidence: 0.94 },
            ],
            rationale: "contains a specific person, project, and follow-up action",
          },
        ],
      }),
      usage: {
        inputTokens: 42,
        outputTokens: 24,
        totalTokens: 66,
      },
    };
  }

  async *stream(request: LLMGenerateRequest): AsyncGenerator<LLMStreamChunk, LLMGenerationResult, void> {
    const generated = await this.generate(request);
    yield { text: generated.text };
    return generated;
  }

  async embeddings(texts: string[]) {
    return {
      provider: this.provider,
      model: "fake",
      embeddings: texts.map(() => []),
    };
  }
}

test("DurableMemoryIngestionService extracts and persists gmail memories", async () => {
  const repository = new MemoryDatabaseRepository(mockRuntime);
  const service = new DurableMemoryIngestionService(repository, new FakeMemoryLLMProvider());

  const result = await service.ingest({
    id: "gmail-message-1",
    sourceApp: "gmail",
    title: "google interview follow-up",
    content: "Raj asked for a Google ML Interview preparation follow-up before Friday.",
    timestamp: "2026-09-13T10:00:00.000Z",
    participants: ["Raj"],
  });

  assert.equal(result.sourceApp, "gmail");
  assert.equal(result.candidates.length, 1);
  assert.equal(result.storedMemories.length, 1);
  assert.equal(result.storedMemories[0].source_app, "gmail");
  assert.equal(result.storedMemories[0].importance_score, 0.91);
  assert.deepEqual(result.storedMemories[0].tags, ["gmail", "interview", "follow-up", "calendar"]);
  assert.equal(result.storedMemories[0].metadata.sourceInputId, "gmail-message-1");
  assert.equal(result.usage?.totalTokens, 66);
});

test("DurableMemoryIngestionService supports calendar and chat sources", async () => {
  const repository = new MemoryDatabaseRepository(mockRuntime);
  const service = new DurableMemoryIngestionService(repository, new FakeMemoryLLMProvider());

  const [calendarResult, chatResult] = await service.ingestMany([
    {
      sourceApp: "calendar",
      content: "Calendar event: google interview prep review with Raj tomorrow.",
    },
    {
      sourceApp: "chat",
      content: "User asked the assistant to create a study plan for google interviews.",
    },
  ]);

  assert.equal(calendarResult.storedMemories[0].source_app, "calendar");
  assert.equal(chatResult.storedMemories[0].source_app, "chat");
  assert.ok(calendarResult.storedMemories[0].tags.includes("calendar"));
  assert.ok(chatResult.storedMemories[0].tags.includes("chat"));
});
