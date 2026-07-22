import assert from "node:assert/strict";
import test from "node:test";
import { AgentLogDatabaseRepository } from "@/repositories/database/agent-log-repository";

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

test("AgentLogDatabaseRepository persists thought steps by conversation id", async () => {
  const repository = new AgentLogDatabaseRepository(mockRuntime);
  await repository.saveThoughtSteps("conversation-test-1", [
    {
      id: "step-test-1",
      agentName: "memory agent",
      status: "processing",
      currentTask: "searching workspace memories",
      timestamp: "2026-07-20T10:00:00.000Z",
      progressPercentage: 75,
      logs: [
        {
          id: "log-test-1",
          agentName: "memory agent",
          timestamp: "2026-07-20T10:00:01.000Z",
          message: "searching long-term memory",
          level: "info",
        },
      ],
    },
  ]);

  const steps = await repository.getThoughtSteps("conversation-test-1");
  assert.equal(steps.length, 1);
  assert.equal(steps[0].id, "step-test-1");
  assert.equal(steps[0].agentName, "memory agent");
  assert.equal(steps[0].currentTask, "searching workspace memories");
  assert.equal(steps[0].progressPercentage, 75);
  assert.equal(steps[0].logs.length, 1);
});
