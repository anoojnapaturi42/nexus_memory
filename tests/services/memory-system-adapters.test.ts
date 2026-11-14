import assert from "node:assert/strict";
import test from "node:test";
import { memoryBenchmarkDataset } from "@/mock/evaluation/memory-benchmark-dataset";
import { createMemorySystemAdapters } from "@/services/evaluation";

function getCase(id: string) {
  const benchmark = memoryBenchmarkDataset.find((candidate) => candidate.id === id);
  assert.ok(benchmark, `missing benchmark: ${id}`);
  return benchmark;
}

test("all four memory system adapters expose the same execution contract", async () => {
  const adapters = createMemorySystemAdapters();
  const benchmark = getCase("stable-fact-01");
  const executions = await Promise.all(
    Object.values(adapters).map((adapter) => adapter.execute(benchmark)),
  );

  assert.equal(executions.length, 4);
  assert.ok(executions.every((execution) => execution.prompt === benchmark.prompt));
  assert.ok(executions.every((execution) => execution.retrievalLatencyMs >= 0));
});

test("structured memory excludes superseded preferences", async () => {
  const benchmark = getCase("temporal-update-01");
  const adapters = createMemorySystemAdapters();
  const execution = await adapters["nexus-structured-memory"].execute(benchmark);

  assert.ok(execution.retrievedMemoryIds.includes("raj-backend-ai-current"));
  assert.ok(!execution.retrievedMemoryIds.includes("raj-frontend-old"));
  assert.ok(
    execution.retrievalReasons.every((reason) =>
      reason.signals.some((signal) => signal.startsWith("validity:")),
    ),
  );
});

test("stateless and conversation-history baselines do not claim memory retrieval", async () => {
  const benchmark = getCase("multi-session-01");
  const adapters = createMemorySystemAdapters();
  const stateless = await adapters.stateless.execute(benchmark);
  const history = await adapters["conversation-history"].execute(benchmark);

  assert.deepEqual(stateless.retrievedMemoryIds, []);
  assert.deepEqual(history.retrievedMemoryIds, []);
  assert.ok(history.context.includes("persistent-memory assistant"));
});
