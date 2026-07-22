import { getMockConversationById, getMockConversations } from "@/mock/runtime";
import type { Conversation } from "@/types/domain";
import type { ReadOnlyRepository } from "./base-repository";

export class ConversationRepository implements ReadOnlyRepository<Conversation> {
  async list(): Promise<Conversation[]> {
    return getMockConversations();
  }

  async getById(id: string): Promise<Conversation | null> {
    return getMockConversationById(id);
  }
}

export const conversationRepository = new ConversationRepository();
