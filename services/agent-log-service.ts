import { BaseService } from "@/services/base-service";
import { agentLogDatabaseRepository } from "@/repositories/database";
import type { AgentThoughtStep } from "@/types/chat";

export class AgentLogService extends BaseService {
  constructor(private readonly repository = agentLogDatabaseRepository) {
    super("/api/agent-logs");
  }

  async listByConversationId(conversationId: string): Promise<AgentThoughtStep[]> {
    return this.repository.getThoughtSteps(conversationId);
  }

  async saveThoughtSteps(conversationId: string, steps: AgentThoughtStep[]): Promise<AgentThoughtStep[]> {
    await this.repository.saveThoughtSteps(conversationId, steps);
    return this.repository.getThoughtSteps(conversationId);
  }
}

export const agentLogService = new AgentLogService();
