import type {
  MemoryBenchmarkCase,
  MemoryEvaluationMetrics,
  MemoryEvaluationObservation,
} from "@/types/memory-evaluation";

function round(value: number) {
  return Number(value.toFixed(4));
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function percentile(values: number[], ratio: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * ratio) - 1)] ?? 0;
}

export function calculateMemoryEvaluationMetrics(
  observations: MemoryEvaluationObservation[],
  benchmarks: Map<string, MemoryBenchmarkCase>,
): MemoryEvaluationMetrics {
  const positiveRetrievals = observations.filter((observation) => {
    const benchmark = benchmarks.get(observation.caseId);
    return (benchmark?.goldMemoryIds.length ?? 0) > 0;
  });
  const recall = positiveRetrievals.map((observation) => {
    const goldIds = new Set(benchmarks.get(observation.caseId)?.goldMemoryIds ?? []);
    return observation.retrievedMemoryIds.filter((id) => goldIds.has(id)).length / goldIds.size;
  });
  const precision = positiveRetrievals.map((observation) => {
    const goldIds = new Set(benchmarks.get(observation.caseId)?.goldMemoryIds ?? []);
    if (observation.retrievedMemoryIds.length === 0) return 0;
    return (
      observation.retrievedMemoryIds.filter((id) => goldIds.has(id)).length /
      observation.retrievedMemoryIds.length
    );
  });
  const reciprocalRanks = positiveRetrievals.map((observation) => {
    const goldIds = new Set(benchmarks.get(observation.caseId)?.goldMemoryIds ?? []);
    const rank = observation.retrievedMemoryIds.findIndex((id) => goldIds.has(id));
    return rank < 0 ? 0 : 1 / (rank + 1);
  });
  const allRetrieved = observations.flatMap((observation) =>
    observation.retrievedMemoryIds.map((id) => ({ observation, id })),
  );
  const irrelevantRetrieved = allRetrieved.filter(({ observation, id }) => {
    const goldIds = new Set(benchmarks.get(observation.caseId)?.goldMemoryIds ?? []);
    return !goldIds.has(id);
  });
  const temporalObservations = observations.filter(
    (observation) => benchmarks.get(observation.caseId)?.category === "temporal-update",
  );
  const conflictObservations = observations.filter(
    (observation) => benchmarks.get(observation.caseId)?.category === "conflicting-information",
  );
  const taskObservations = observations.filter((observation) => observation.taskSucceeded !== null);

  return {
    recallAtK: round(average(recall)),
    precisionAtK: round(average(precision)),
    meanReciprocalRank: round(average(reciprocalRanks)),
    temporalAccuracy: temporalObservations.length
      ? round(average(temporalObservations.map((observation) => Number(observation.answerCorrect))))
      : null,
    contradictionResolutionAccuracy: conflictObservations.length
      ? round(average(conflictObservations.map((observation) => Number(observation.answerCorrect))))
      : null,
    memoryPollutionRate: round(irrelevantRetrieved.length / Math.max(1, allRetrieved.length)),
    answerAccuracy: round(
      average(observations.map((observation) => Number(observation.answerCorrect))),
    ),
    taskSuccessRate: taskObservations.length
      ? round(average(taskObservations.map((observation) => Number(observation.taskSucceeded))))
      : null,
    meanLatencyMs: round(average(observations.map((observation) => observation.latencyMs))),
    p50LatencyMs: round(
      percentile(
        observations.map((observation) => observation.latencyMs),
        0.5,
      ),
    ),
    p95LatencyMs: round(
      percentile(
        observations.map((observation) => observation.latencyMs),
        0.95,
      ),
    ),
    meanInputTokens: round(
      average(observations.map((observation) => observation.usage.inputTokens)),
    ),
    meanOutputTokens: round(
      average(observations.map((observation) => observation.usage.outputTokens)),
    ),
    meanTotalTokens: round(
      average(observations.map((observation) => observation.usage.totalTokens)),
    ),
  };
}
