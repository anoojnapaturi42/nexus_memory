import {
  buildMemoryEmbeddingInput,
  buildQueryEmbeddingInput,
  createEmbeddingGenerator,
} from "@/services/memory-embedding-service";
import { memoryVectorSearchService } from "@/services/memory-vector-search-service";
import type { Memory } from "@/types/domain";
import type {
  BenchmarkMemory,
  MemoryBenchmarkCase,
  MemorySystemConfiguration,
  MemorySystemExecution,
  MemorySystemId,
} from "@/types/memory-evaluation";

export interface MemorySystemAdapter {
  readonly configuration: MemorySystemConfiguration;
  execute(benchmark: MemoryBenchmarkCase): Promise<MemorySystemExecution>;
}

const maxRetrievedMemories = 3;

function toMemory(memory: BenchmarkMemory): Memory {
  return {
    id: memory.id,
    content: memory.content,
    sourceApp: "benchmark",
    timestamp: memory.createdAt,
    importanceScore: memory.importanceScore,
    embeddingId: `${memory.id}-embedding`,
    relatedEntityIds: memory.entityIds ?? [],
    tags: [memory.category, memory.validity, memory.explicit ? "explicit" : "inferred"],
  };
}

function formatMemories(memories: BenchmarkMemory[]) {
  if (memories.length === 0) return "No long-term memories were supplied.";
  return memories.map((memory) => `- [${memory.id}] ${memory.content}`).join("\n");
}

function formatConversation(benchmark: MemoryBenchmarkCase) {
  return benchmark.conversations.map((turn) => `${turn.role}: ${turn.content}`).join("\n");
}

function createExecution(
  benchmark: MemoryBenchmarkCase,
  systemId: MemorySystemId,
  context: string,
  retrieved: Array<{ memory: BenchmarkMemory; score: number; signals: string[] }>,
  startedAt: number,
): MemorySystemExecution {
  return {
    systemId,
    prompt: benchmark.prompt,
    context,
    retrievedMemoryIds: retrieved.map((item) => item.memory.id),
    retrievalReasons: retrieved.map((item) => ({
      memoryId: item.memory.id,
      score: Number(item.score.toFixed(4)),
      signals: item.signals,
    })),
    retrievalLatencyMs: Date.now() - startedAt,
  };
}

export const memorySystemConfigurations: Record<MemorySystemId, MemorySystemConfiguration> = {
  stateless: {
    id: "stateless",
    label: "stateless llm",
    description: "Answers from the current prompt without durable context.",
    usesConversationHistory: false,
    usesSemanticRetrieval: false,
    usesStructuredMemory: false,
    usesConsolidation: false,
    usesTemporalValidity: false,
    usesRelationshipContext: false,
    usesImportanceWeighting: false,
  },
  "conversation-history": {
    id: "conversation-history",
    label: "full conversation history",
    description: "Answers with every prior turn supplied as context.",
    usesConversationHistory: true,
    usesSemanticRetrieval: false,
    usesStructuredMemory: false,
    usesConsolidation: false,
    usesTemporalValidity: false,
    usesRelationshipContext: false,
    usesImportanceWeighting: false,
  },
  "semantic-rag": {
    id: "semantic-rag",
    label: "basic semantic retrieval",
    description: "Uses deterministic vector similarity over all candidate memories.",
    usesConversationHistory: false,
    usesSemanticRetrieval: true,
    usesStructuredMemory: false,
    usesConsolidation: false,
    usesTemporalValidity: false,
    usesRelationshipContext: false,
    usesImportanceWeighting: false,
  },
  "nexus-structured-memory": {
    id: "nexus-structured-memory",
    label: "nexus structured memory",
    description:
      "Uses semantic relevance with temporal validity, explicitness, importance, and entity context.",
    usesConversationHistory: false,
    usesSemanticRetrieval: true,
    usesStructuredMemory: true,
    usesConsolidation: true,
    usesTemporalValidity: true,
    usesRelationshipContext: true,
    usesImportanceWeighting: true,
  },
};

export class StatelessMemorySystemAdapter implements MemorySystemAdapter {
  readonly configuration = memorySystemConfigurations.stateless;

  async execute(benchmark: MemoryBenchmarkCase) {
    const startedAt = Date.now();
    return createExecution(
      benchmark,
      this.configuration.id,
      "Answer using only the current user prompt. Do not assume prior personal information.",
      [],
      startedAt,
    );
  }
}

export class ConversationHistoryMemorySystemAdapter implements MemorySystemAdapter {
  readonly configuration = memorySystemConfigurations["conversation-history"];

  async execute(benchmark: MemoryBenchmarkCase) {
    const startedAt = Date.now();
    return createExecution(
      benchmark,
      this.configuration.id,
      `Conversation history:\n${formatConversation(benchmark)}`,
      [],
      startedAt,
    );
  }
}

export class SemanticRagMemorySystemAdapter implements MemorySystemAdapter {
  readonly configuration = memorySystemConfigurations["semantic-rag"];

  constructor(private readonly embeddingGenerator = createEmbeddingGenerator()) {}

  async execute(benchmark: MemoryBenchmarkCase) {
    const startedAt = Date.now();
    const memories = benchmark.candidateMemories.map(toMemory);
    const [queryEmbedding, embeddings] = await Promise.all([
      this.embeddingGenerator.embedText(buildQueryEmbeddingInput(benchmark.prompt)),
      this.embeddingGenerator.embedTexts(memories.map(buildMemoryEmbeddingInput)),
    ]);
    const candidates = memories.map((memory, index) => ({
      ...memory,
      embedding: embeddings[index] ?? [],
    }));
    const byId = new Map(benchmark.candidateMemories.map((memory) => [memory.id, memory]));
    const retrieved = memoryVectorSearchService
      .search(queryEmbedding, candidates, maxRetrievedMemories)
      .map((result) => ({
        memory: byId.get(result.id)!,
        score: result.vectorSimilarity,
        signals: ["semantic-similarity"],
      }));

    return createExecution(
      benchmark,
      this.configuration.id,
      `Retrieved memories:\n${formatMemories(retrieved.map((item) => item.memory))}`,
      retrieved,
      startedAt,
    );
  }
}

export class NexusStructuredMemorySystemAdapter implements MemorySystemAdapter {
  readonly configuration = memorySystemConfigurations["nexus-structured-memory"];

  constructor(private readonly embeddingGenerator = createEmbeddingGenerator()) {}

  async execute(benchmark: MemoryBenchmarkCase) {
    const startedAt = Date.now();
    const currentMemories = benchmark.candidateMemories.filter(
      (memory) => memory.validity !== "superseded",
    );
    const domainMemories = currentMemories.map(toMemory);
    const [queryEmbedding, embeddings] = await Promise.all([
      this.embeddingGenerator.embedText(buildQueryEmbeddingInput(benchmark.prompt)),
      this.embeddingGenerator.embedTexts(domainMemories.map(buildMemoryEmbeddingInput)),
    ]);
    const vectorResults = memoryVectorSearchService.search(
      queryEmbedding,
      domainMemories.map((memory, index) => ({ ...memory, embedding: embeddings[index] ?? [] })),
      currentMemories.length,
    );
    const similarityById = new Map(
      vectorResults.map((result) => [result.id, result.vectorSimilarity]),
    );
    const promptTokens = new Set(benchmark.prompt.toLowerCase().match(/[a-z0-9-]+/g) ?? []);

    const retrieved = currentMemories
      .map((memory) => {
        const semanticSimilarity = similarityById.get(memory.id) ?? 0;
        const entityOverlap = memory.entityIds?.some((entityId) =>
          promptTokens.has(entityId.replace(/^[a-z]+-/, "")),
        )
          ? 1
          : 0;
        const explicitWeight = memory.explicit ? 1 : 0.35;
        const validityWeight = memory.validity === "current" ? 1 : 0.55;
        const score =
          semanticSimilarity * 0.52 +
          memory.importanceScore * 0.22 +
          explicitWeight * 0.14 +
          validityWeight * 0.08 +
          entityOverlap * 0.04;
        const signals = [
          "semantic-similarity",
          "importance",
          memory.explicit ? "explicit-memory" : "inferred-memory",
          `validity:${memory.validity}`,
        ];
        if (entityOverlap) signals.push("entity-context");
        return { memory, score, signals };
      })
      .sort((left, right) => right.score - left.score)
      .slice(0, maxRetrievedMemories);

    return createExecution(
      benchmark,
      this.configuration.id,
      `Structured memory context:\n${formatMemories(retrieved.map((item) => item.memory))}\n\nEach memory is current unless explicitly marked otherwise.`,
      retrieved,
      startedAt,
    );
  }
}

export function createMemorySystemAdapters(): Record<MemorySystemId, MemorySystemAdapter> {
  return {
    stateless: new StatelessMemorySystemAdapter(),
    "conversation-history": new ConversationHistoryMemorySystemAdapter(),
    "semantic-rag": new SemanticRagMemorySystemAdapter(),
    "nexus-structured-memory": new NexusStructuredMemorySystemAdapter(),
  };
}
