import { getMockAgentStates } from "@/mock/runtime";
import type { AgentState } from "@/types/domain";
import type { ReadOnlyRepository } from "./base-repository";

export class AgentRepository implements ReadOnlyRepository<AgentState> {
  async list(): Promise<AgentState[]> {
    return getMockAgentStates();
  }

  async getById(id: string): Promise<AgentState | null> {
    const item = getMockAgentStates().find((agent) => agent.agentName === id);
    return item ? structuredClone(item) : null;
  }
}

export const agentRepository = new AgentRepository();
