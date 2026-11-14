import assert from "node:assert/strict";
import test from "node:test";
import {
  memoryBenchmarkCategoryCounts,
  memoryBenchmarkDataset,
} from "@/mock/evaluation/memory-benchmark-dataset";

test("memory benchmark contains 30 reproducible evaluation cases", () => {
  assert.equal(memoryBenchmarkDataset.length, 30);
  assert.equal(new Set(memoryBenchmarkDataset.map((benchmark) => benchmark.id)).size, 30);
});

test("memory benchmark covers all intended research categories", () => {
  assert.deepEqual(memoryBenchmarkCategoryCounts, {
    "stable-fact": 5,
    preference: 5,
    "temporal-update": 4,
    "conflicting-information": 4,
    "multi-session": 4,
    "multi-hop": 4,
    "non-memory": 4,
  });
});

test("every positive retrieval case references valid gold memories", () => {
  for (const benchmark of memoryBenchmarkDataset) {
    const memoryIds = new Set(benchmark.candidateMemories.map((memory) => memory.id));
    assert.ok(benchmark.goldMemoryIds.every((id) => memoryIds.has(id)));
  }
});
