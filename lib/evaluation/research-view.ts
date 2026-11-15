import type {
  BenchmarkCategory,
  MemoryBenchmarkCase,
  MemoryEvaluationMetrics,
  MemoryEvaluationRunArtifact,
  MemorySystemId,
} from "@/types/memory-evaluation";

export const memorySystemLabels: Record<MemorySystemId, string> = {
  stateless: "Stateless LLM",
  "conversation-history": "Full conversation history",
  "semantic-rag": "Semantic RAG",
  "nexus-structured-memory": "Nexus structured memory",
};

export const memorySystemShortDescriptions: Record<MemorySystemId, string> = {
  stateless: "Current prompt only",
  "conversation-history": "All prior turns",
  "semantic-rag": "Top-3 vector similarity",
  "nexus-structured-memory": "Similarity + validity, importance, entities",
};

export const benchmarkCategoryLabels: Record<BenchmarkCategory, string> = {
  "stable-fact": "Stable fact",
  preference: "Preference",
  "temporal-update": "Temporal update",
  "conflicting-information": "Conflicting information",
  "multi-session": "Multi-session",
  "multi-hop": "Multi-hop",
  "non-memory": "Non-memory",
};

export const benchmarkCategoryDescriptions: Record<BenchmarkCategory, string> = {
  "stable-fact": "Durable facts that should not change across sessions.",
  preference: "Explicit user preferences used to personalize an answer.",
  "temporal-update": "A newer fact or preference supersedes an older one.",
  "conflicting-information": "Conflicting claims require source and certainty handling.",
  "multi-session": "Evidence is spread across separate conversations.",
  "multi-hop": "Several memories must be combined to answer.",
  "non-memory": "The correct behavior is to avoid remembering or reusing a detail.",
};

export type MetricKey =
  | "answerAccuracy"
  | "recallAtK"
  | "precisionAtK"
  | "meanReciprocalRank"
  | "temporalAccuracy"
  | "contradictionResolutionAccuracy"
  | "memoryPollutionRate";

export const primaryMetricOrder: Array<{
  key: MetricKey;
  label: string;
  higherIsBetter: boolean;
}> = [
  { key: "answerAccuracy", label: "Answer accuracy", higherIsBetter: true },
  { key: "recallAtK", label: "Recall@3", higherIsBetter: true },
  { key: "precisionAtK", label: "Precision@3", higherIsBetter: true },
  { key: "meanReciprocalRank", label: "MRR", higherIsBetter: true },
  { key: "temporalAccuracy", label: "Temporal accuracy", higherIsBetter: true },
  {
    key: "contradictionResolutionAccuracy",
    label: "Conflict resolution",
    higherIsBetter: true,
  },
  { key: "memoryPollutionRate", label: "Memory pollution", higherIsBetter: false },
];

export function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined) return "n/a";
  return `${Math.round(value * 100)}%`;
}

export function formatDuration(value: number | null | undefined) {
  if (value === null || value === undefined) return "n/a";
  if (value >= 1000) return `${(value / 1000).toFixed(2)}s`;
  return `${Math.round(value)}ms`;
}

export function formatCount(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

export function metricValue(metrics: MemoryEvaluationMetrics, key: MetricKey) {
  return metrics[key];
}

export type CategoryAccuracyRow = {
  category: BenchmarkCategory;
  caseCount: number;
  accuracyBySystem: Record<string, number | null>;
};

export function buildCategoryAccuracy(
  artifact: MemoryEvaluationRunArtifact,
  benchmarks: MemoryBenchmarkCase[],
): CategoryAccuracyRow[] {
  const caseById = new Map(benchmarks.map((benchmark) => [benchmark.id, benchmark]));
  const categories = [...new Set(benchmarks.map((benchmark) => benchmark.category))];

  return categories.map((category) => {
    const categoryCases = benchmarks.filter((benchmark) => benchmark.category === category);
    const accuracyBySystem: Record<string, number | null> = {};

    for (const systemId of artifact.systemIds) {
      const observations = artifact.observations.filter(
        (observation) =>
          observation.systemId === systemId &&
          caseById.get(observation.caseId)?.category === category,
      );
      accuracyBySystem[systemId] = observations.length
        ? observations.filter((observation) => observation.answerCorrect).length / observations.length
        : null;
    }

    return {
      category,
      caseCount: categoryCases.length,
      accuracyBySystem,
    };
  });
}

export function observationKey(caseId: string, systemId: MemorySystemId) {
  return `${caseId}:${systemId}`;
}
