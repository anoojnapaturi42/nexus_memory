import { cosineSimilarity } from "@/lib/memory-retrieval/math-utils";
import type { Memory } from "@/types/domain";

export type VectorSearchCandidate = Memory & {
  embedding: number[];
  vectorSimilarity: number;
};

export class MemoryVectorSearchService {
  search(
    queryEmbedding: number[],
    memories: Array<Memory & { embedding?: number[] | null }>,
    limit = 25,
  ): VectorSearchCandidate[] {
    return memories
      .map((memory) => ({
        ...memory,
        embedding: memory.embedding ?? [],
        vectorSimilarity: cosineSimilarity(queryEmbedding, memory.embedding ?? []),
      }))
      .sort((left, right) => right.vectorSimilarity - left.vectorSimilarity)
      .slice(0, limit);
  }
}

export const memoryVectorSearchService = new MemoryVectorSearchService();

