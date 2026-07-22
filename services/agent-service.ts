//reads agent state for the ui 
import { BaseService } from "@/services/base-service";
import { agentRepository, type AgentRepository } from "@/mock/repositories";
import type { AgentState } from "@/types/domain";

export class AgentService extends BaseService {
  constructor(private readonly repository: AgentRepository = agentRepository) {
    super("/api/agents");
  }

  async list(): Promise<AgentState[]> {
    return this.repository.list();
  }
}

export const agentService = new AgentService();
