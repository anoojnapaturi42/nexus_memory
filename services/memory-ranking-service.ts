import { clamp, exponentialRecencyWeight, frequencyBoost } from "@/lib/memory-retrieval/math-utils";
import type { GoogleContextItem, Memory } from "@/types/domain";
import type { MemorySearchContext, MemorySearchResult } from "@/types/memory-retrieval";
import { memoryDeduplicationService } from "@/services/memory-deduplication-service";

export type RankedMemoryCandidate = Memory & {
  embedding?: number[] | null;
  vectorSimilarity: number;
};

export type RankingInput = {
  queryTokens: string[];
  candidates: RankedMemoryCandidate[];
  allMemories: Memory[];
  googleContextItems: GoogleContextItem[];
  duplicates: Map<string, string[]>;
  minImportance?: number;
  temporalFilter?: {
    since?: string | null;
    until?: string | null;
  };
};

export class MemoryRankingService {
  rank(input: RankingInput): MemorySearchResult[] {
    const frequencyMap = this.buildFrequencyMap(input.allMemories);
    const now = Date.now();
    const filtered = input.candidates.filter(
      (candidate) =>
        this.matchesTemporalFilter(candidate, input.temporalFilter) &&
        candidate.importanceScore >= (input.minImportance ?? 0),
    );

    return filtered
      .map((candidate) => {
        const ageInDays = Math.max(0, (now - new Date(candidate.timestamp).getTime()) / (1000 * 60 * 60 * 24));
        const recencyWeight = exponentialRecencyWeight(ageInDays, 14);
        const frequencyWeight = frequencyBoost(frequencyMap.get(this.signature(candidate)) ?? 1);
        const importanceWeight = clamp(candidate.importanceScore, 0, 1);
        const dedupePenalty = memoryDeduplicationService.getDedupPenalty(candidate.id, input.duplicates);

        const score = clamp(
          candidate.vectorSimilarity * 0.48 +
            recencyWeight * 0.18 +
            Math.min(1, Math.log1p(frequencyWeight) / 2) * 0.16 +
            importanceWeight * 0.22 -
            dedupePenalty,
          0,
          1,
        );

        const context = this.buildContext(candidate, input.googleContextItems, input.allMemories);
        const matchedTokens = input.queryTokens.filter((token) => this.signature(candidate).includes(token));

        return {
          memory: candidate,
          score,
          rank: 0,
          matchedTokens,
          scoreBreakdown: {
            vectorSimilarity: candidate.vectorSimilarity,
            recencyWeight,
            frequencyWeight,
            importanceWeight,
            dedupePenalty,
          },
          context,
        };
      })
      .sort((left, right) => right.score - left.score)
      .map((result, index) => ({
        ...result,
        rank: index + 1,
      }));
  }

  private buildFrequencyMap(memories: Memory[]) {
    const map = new Map<string, number>();
    for (const memory of memories) {
      const key = this.signature(memory);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }

  private signature(memory: Memory) {
    return [memory.content, memory.sourceApp, memory.tags.join(" ")].join(" ").toLowerCase();
  }

  private matchesTemporalFilter(
    memory: Memory,
    filter?: {
      since?: string | null;
      until?: string | null;
    },
  ) {
    if (!filter) return true;
    const timestamp = new Date(memory.timestamp).getTime();
    if (filter.since && timestamp < new Date(filter.since).getTime()) return false;
    if (filter.until && timestamp > new Date(filter.until).getTime()) return false;
    return true;
  }

  private buildContext(memory: Memory, googleContextItems: GoogleContextItem[], allMemories: Memory[]): MemorySearchContext {
    const linkedGoogleContextItems = googleContextItems.filter(
      (item) =>
        item.linkedMemoryIds.includes(memory.id) ||
        memory.relatedEntityIds.includes(item.id) ||
        item.title.toLowerCase().includes(memory.sourceApp.toLowerCase()),
    );

    const relatedMemoryIds = new Set<string>();
    const relatedEntityIds = new Set<string>(memory.relatedEntityIds);
    const sourceApps = new Set<string>([memory.sourceApp]);

    for (const contextItem of linkedGoogleContextItems) {
      for (const linkedMemoryId of contextItem.linkedMemoryIds) {
        if (linkedMemoryId !== memory.id) {
          relatedMemoryIds.add(linkedMemoryId);
        }
      }
      sourceApps.add(contextItem.type);
    }

    for (const relatedId of memory.relatedEntityIds) {
      const relatedMemory = allMemories.find((item) => item.id === relatedId);
      if (relatedMemory) {
        relatedMemoryIds.add(relatedMemory.id);
        sourceApps.add(relatedMemory.sourceApp);
      }
    }

    return {
      linkedGoogleContextItems,
      relatedMemoryIds: [...relatedMemoryIds],
      relatedEntityIds: [...relatedEntityIds],
      sourceApps: [...sourceApps],
    };
  }
}

export const memoryRankingService = new MemoryRankingService();
