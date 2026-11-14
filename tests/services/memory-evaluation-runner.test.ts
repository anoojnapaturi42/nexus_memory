import assert from "node:assert/strict";
import test from "node:test";
import { memoryBenchmarkDataset } from "@/mock/evaluation/memory-benchmark-dataset";
import {
  MemoryEvaluationRunner,
  type MemoryAnswerGenerationRequest,
  type MemoryAnswerGenerator,
} from "@/services/evaluation";

class ExpectedAnswerGenerator implements MemoryAnswerGenerator {
  async generate({ benchmark }: MemoryAnswerGenerationRequest) {
    return {
      answer: benchmark.expectedAnswer,
      usage: { inputTokens: 100, outputTokens: 20, totalTokens: 120 },
    };
  }
}

test("memory evaluation runner creates comparable observations and summaries", async () => {
  const runner = new MemoryEvaluationRunner(new ExpectedAnswerGenerator());
  const artifact = await runner.run(memoryBenchmarkDataset.slice(0, 2));

  assert.equal(artifact.observations.length, 8);
  assert.equal(artifact.summaries.length, 4);
  assert.ok(artifact.summaries.every((summary) => summary.completedCaseCount === 2));
  assert.ok(artifact.summaries.every((summary) => summary.metrics.answerAccuracy === 1));
});

test("metric calculation penalizes irrelevant retrieval and captures successful retrieval", async () => {
  const runner = new MemoryEvaluationRunner(new ExpectedAnswerGenerator());
  const benchmark = memoryBenchmarkDataset.filter(
    (candidate) => candidate.id === "temporal-update-01",
  );
  const artifact = await runner.run(benchmark);
  const nexusSummary = artifact.summaries.find(
    (summary) => summary.systemId === "nexus-structured-memory",
  );

  assert.ok(nexusSummary);
  assert.equal(nexusSummary.metrics.recallAtK, 1);
  assert.equal(nexusSummary.metrics.temporalAccuracy, 1);
  assert.ok(nexusSummary.metrics.memoryPollutionRate >= 0);
});
