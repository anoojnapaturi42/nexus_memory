import type {
  MemoryBenchmarkCase,
  MemoryEvaluationError,
  MemoryEvaluationObservation,
} from "@/types/memory-evaluation";

export function deriveMemoryEvaluationErrors(
  observation: MemoryEvaluationObservation,
  benchmark: MemoryBenchmarkCase,
): MemoryEvaluationError[] {
  const errors: MemoryEvaluationError[] = [];
  const goldIds = new Set(benchmark.goldMemoryIds);
  const retrievedGold = observation.retrievedMemoryIds.filter((id) => goldIds.has(id));
  const irrelevant = observation.retrievedMemoryIds.filter((id) => !goldIds.has(id));
  const now = observation.evaluatedAt;

  if (goldIds.size > 0 && retrievedGold.length === 0) {
    errors.push({
      id: `${observation.runId}-${observation.caseId}-${observation.systemId}-missed`,
      runId: observation.runId,
      caseId: observation.caseId,
      systemId: observation.systemId,
      type: "missed-relevant-memory",
      description: "No gold memory was retrieved for this benchmark case.",
      createdAt: now,
    });
  }
  if (irrelevant.length > 0) {
    errors.push({
      id: `${observation.runId}-${observation.caseId}-${observation.systemId}-pollution`,
      runId: observation.runId,
      caseId: observation.caseId,
      systemId: observation.systemId,
      type: "retrieval-contamination",
      description: `Retrieved irrelevant memories: ${irrelevant.join(", ")}.`,
      createdAt: now,
    });
  }
  if (retrievedGold.length > 0 && !observation.answerCorrect) {
    errors.push({
      id: `${observation.runId}-${observation.caseId}-${observation.systemId}-answer`,
      runId: observation.runId,
      caseId: observation.caseId,
      systemId: observation.systemId,
      type: "correct-retrieval-wrong-answer",
      description:
        "Relevant memory was retrieved, but the answer did not meet the benchmark criteria.",
      createdAt: now,
    });
  }

  return errors;
}
