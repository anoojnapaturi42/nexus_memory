import { createMockDataset, createMockAgentState } from "@/mock/generators";
import type { AgentState } from "@/types/domain";

export const mockAgentStates: AgentState[] = createMockDataset(
  (index) =>
    createMockAgentState({
      agentName: `Agent ${index + 1}`,
      status: index === 0 ? "processing" : index === 1 ? "idle" : "completed",
      currentTask: `Task ${index + 1}`,
      progressPercentage: index === 0 ? 68 : index === 1 ? 0 : 100,
    }),
  3,
);
