import { memoryService } from "@/services/memory-service";
import { googleContextService } from "@/services/google-context-service";
import { memoryIngestionService } from "@/services/memory-ingestion-service";
import { memoryDeduplicationService } from "@/services/memory-deduplication-service";
import { memoryVectorSearchService } from "@/services/memory-vector-search-service";
import { memoryRankingService } from "@/services/memory-ranking-service";
import { buildQueryEmbeddingInput } from "@/services/memory-embedding-service";
import { clamp } from "@/lib/memory-retrieval/math-utils";
import { tokenize, uniqueTokens } from "@/lib/memory-retrieval/text-utils";
import type { MemorySearchQuery, MemorySearchResponse } from "@/types/memory-retrieval";

function normalizeLimit(limit?: number) {
  if (!Number.isFinite(limit ?? NaN)) return 10;
  return clamp(limit as number, 1, 20);
}

function normalizeImportance(value?: number) {
  if (!Number.isFinite(value ?? NaN)) return undefined;
  return clamp(value as number, 0, 1);
}

function parseQuery(text: string) {
  return uniqueTokens(tokenize(text));
}

export class MemoryRetrievalService {
  async search(query: MemorySearchQuery): Promise<MemorySearchResponse> {
    const limit = normalizeLimit(query.limit);
    const [memories, googleContextItems] = await Promise.all([memoryService.list(), googleContextService.list()]);
    const ingested = await memoryIngestionService.ingestMany(memories);
    const queryEmbeddingInput = buildQueryEmbeddingInput(query.query);
    const queryEmbedding = await memoryIngestionService.embedText(queryEmbeddingInput);

    const deduped = memoryDeduplicationService.dedupe(ingested);
    const ranked = memoryRankingService.rank({
      queryTokens: parseQuery(query.query),
      candidates: memoryVectorSearchService.search(queryEmbedding, deduped.items, 50),
      allMemories: memories,
      googleContextItems,
      duplicates: deduped.duplicates,
      minImportance: normalizeImportance(query.minImportance),
      temporalFilter: query.temporalFilter,
    });

    return {
      status: "success",
      data: {
        query: query.query,
        source: "mock",
        temporalFilter: query.temporalFilter ?? {},
        total: ranked.length,
        items: ranked.slice(0, limit),
      },
    };
  }
}

export const memoryRetrievalService = new MemoryRetrievalService();
