import assert from "node:assert/strict";
import test from "node:test";
import { MemoryDatabaseRepository } from "@/repositories/database/memory-repository";

const mockRuntime = {
  mode: "mock" as const,
  pool: null,
  supabase: null,
  available: {
    postgres: false,
    supabase: false,
  },
  missingEnv: [],
};

test("MemoryDatabaseRepository lists seeded fallback memories", async () => {
  const repository = new MemoryDatabaseRepository(mockRuntime);
  const result = await repository.list();

  assert.equal(result.source, "mock");
  assert.ok(result.items.length > 0);
  assert.equal(typeof result.items[0].content, "string");
  assert.equal(typeof result.items[0].source_app, "string");
});

test("MemoryDatabaseRepository gets a fallback memory by id", async () => {
  const repository = new MemoryDatabaseRepository(mockRuntime);
  const list = await repository.list();
  const first = list.items[0];

  const result = await repository.getById(first.id);

  assert.ok(result.item);
  assert.equal(result.item.id, first.id);
  assert.equal(result.item.content, first.content);
});
