import assert from "node:assert/strict";
import test from "node:test";
import { ConversationDatabaseRepository } from "@/repositories/database/conversation-repository";

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

test("ConversationDatabaseRepository persists messages in fallback mode", async () => {
  const repository = new ConversationDatabaseRepository(mockRuntime);
  const saved = await repository.saveConversation({
    id: "conversation-test-1",
    title: "durable thread",
    messages: [
      {
        id: "message-test-1",
        role: "user",
        content: "hello",
        timestamp: "2026-07-20T10:00:00.000Z",
        status: "complete",
      },
    ],
    createdAt: "2026-07-20T10:00:00.000Z",
    updatedAt: "2026-07-20T10:00:00.000Z",
  });

  assert.ok(saved.item);
  assert.equal(saved.item.id, "conversation-test-1");
  assert.equal(saved.item.title, "durable thread");
  assert.equal(saved.item.messages.length, 1);
  assert.equal(saved.item.messages[0].id, "message-test-1");
  assert.equal(saved.item.messages[0].role, "user");
  assert.equal(saved.item.messages[0].content, "hello");

  const loaded = await repository.getById("conversation-test-1");
  assert.ok(loaded.item);
  assert.equal(loaded.item.messages.length, 1);
});
