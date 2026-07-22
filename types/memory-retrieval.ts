import type { ApiResponse } from "@/types/api";
import type { GoogleContextItem, Memory } from "@/types/domain";

export type MemorySearchTemporalFilter = {
  since?: string | null;
  until?: string | null;
};

export type MemorySearchQuery = {
  query: string;
  limit?: number;
  minImportance?: number;
  temporalFilter?: MemorySearchTemporalFilter;
};

export type MemoryRankBreakdown = {
  vectorSimilarity: number;
  recencyWeight: number;
  frequencyWeight: number;
  importanceWeight: number;
  dedupePenalty: number;
};

export type MemorySearchContext = {
  linkedGoogleContextItems: GoogleContextItem[];
  relatedMemoryIds: string[];
  relatedEntityIds: string[];
  sourceApps: string[];
};

export type MemorySearchResult = {
  memory: Memory;
  score: number;
  rank: number;
  matchedTokens: string[];
  scoreBreakdown: MemoryRankBreakdown;
  context: MemorySearchContext;
};

export type MemorySearchResponseData = {
  query: string;
  source: "mock" | "live";
  temporalFilter: MemorySearchTemporalFilter;
  total: number;
  items: MemorySearchResult[];
};

export type MemorySearchResponse = ApiResponse<MemorySearchResponseData>;

