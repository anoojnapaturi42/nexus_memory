import { cosineSimilarity, jaccardSimilarity } from "@/lib/memory-retrieval/math-utils";
import { buildMemorySignature, tokenize } from "@/lib/memory-retrieval/text-utils";
import type { Memory } from "@/types/domain";

export type MemoryDeduplicationDecision = {
  canonicalMemory: Memory;
  duplicateMemoryIds: string[];
  similarity: number;
};

export class MemoryDeduplicationService {
  dedupe(memories: Array<Memory & { embedding?: number[] | null }>) {
    const canonical: Array<Memory & { embedding?: number[] | null }> = [];
    const duplicates = new Map<string, string[]>();

    for (const memory of memories) {
      const signature = buildMemorySignature(memory);
      const tokens = tokenize(memory.content);
      const embedding = memory.embedding ?? [];

      const match = canonical.find((candidate) => {
        const candidateTokens = tokenize(candidate.content);
        const candidateEmbedding = candidate.embedding ?? [];
        const textOverlap = jaccardSimilarity(tokens, candidateTokens);
        const vectorOverlap = cosineSimilarity(embedding, candidateEmbedding);
        return signature === buildMemorySignature(candidate) || (textOverlap >= 0.72 && vectorOverlap >= 0.88);
      });

      if (match) {
        const duplicateIds = duplicates.get(match.id) ?? [];
        duplicateIds.push(memory.id);
        duplicates.set(match.id, duplicateIds);
        continue;
      }

      canonical.push(memory);
    }

    return {
      items: canonical,
      duplicates,
    };
  }

  getDedupPenalty(memoryId: string, duplicates: Map<string, string[]>) {
    for (const duplicateIds of duplicates.values()) {
      if (duplicateIds.includes(memoryId)) return 0.18;
    }
    return 0;
  }
}

export const memoryDeduplicationService = new MemoryDeduplicationService();
