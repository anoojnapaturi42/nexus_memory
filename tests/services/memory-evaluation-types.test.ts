import assert from "node:assert/strict";
import test from "node:test";
import {
  ablationIds,
  benchmarkCategories,
  memorySystemIds,
  type MemoryBenchmarkCase,
  type MemoryEvaluationObservation,
} from "@/types/memory-evaluation";

test("memory evaluation contracts expose all benchmark systems and ablations", () => {
  assert.deepEqual(memorySystemIds, [
    "stateless",
    "conversation-history",
    "semantic-rag",
    "nexus-structured-memory",
  ]);
  assert.ok(benchmarkCategories.includes("temporal-update"));
  assert.ok(ablationIds.includes("without-consolidation"));
});

test("memory benchmark and observation contracts support measurable runs", () => {
  const benchmark: MemoryBenchmarkCase = {
    id: "temporal-preference-01",
    title: "uses the current role preference",
    category: "temporal-update",
    profileId: "profile-raj",
    prompt: "what roles should i prioritize?",
    conversations: [],
    candidateMemories: [],
    goldMemoryIds: ["memory-current-role"],
    expectedAnswer: "backend and ai engineering roles",
    answerRubric: ["mentions backend", "mentions ai", "does not recommend frontend"],
  };
  const observation: MemoryEvaluationObservation = {
    runId: "run-1",
    caseId: benchmark.id,
    systemId: "nexus-structured-memory",
    retrievedMemoryIds: ["memory-current-role"],
    generatedAnswer: "focus on backend and ai engineering roles.",
    answerCorrect: true,
    taskSucceeded: true,
    latencyMs: 420,
    usage: { inputTokens: 120, outputTokens: 22, totalTokens: 142 },
    evaluatedAt: "2026-11-14T00:00:00.000Z",
    evaluator: "rule-based",
  };

  assert.equal(observation.caseId, benchmark.id);
  assert.equal(observation.usage.totalTokens, 142);
});
