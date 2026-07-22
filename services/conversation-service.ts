import { BaseService } from "@/services/base-service";
import { conversationDatabaseRepository } from "@/repositories/database";
import type { ChatConversation, ChatMessage } from "@/types/chat";
import type { Conversation } from "@/types/domain";

function toDomain(record: Awaited<ReturnType<typeof conversationDatabaseRepository.getById>>["item"]): Conversation | null {
  return record ? conversationDatabaseRepository.toDomain(record) : null;
}

function toChatDomain(record: Awaited<ReturnType<typeof conversationDatabaseRepository.getById>>["item"]): ChatConversation | null {
  return record ? conversationDatabaseRepository.toChatConversation(record) : null;
}

export class ConversationService extends BaseService {
  constructor(private readonly repository = conversationDatabaseRepository) {
    super("/api/conversations");
  }

  async list(limit = 50, offset = 0): Promise<Conversation[]> {
    const result = await this.repository.list(limit, offset);
    return result.items.map((item) => this.repository.toDomain(item));
  }

  async getById(id: string): Promise<Conversation | null> {
    const result = await this.repository.getById(id);
    return toDomain(result.item);
  }

  async listChatConversations(limit = 50, offset = 0): Promise<ChatConversation[]> {
    const result = await this.repository.listChatConversations(limit, offset);
    return result.items;
  }

  async getChatConversationById(id: string): Promise<ChatConversation | null> {
    const result = await this.repository.getById(id);
    return toChatDomain(result.item);
  }

  async saveChatConversation(conversation: ChatConversation) {
    const result = await this.repository.saveConversation(conversation);
    return this.repository.toChatConversation(result.item);
  }

  async appendMessage(conversationId: string, message: ChatMessage) {
    const result = await this.repository.appendMessage(conversationId, message);
    return result?.item ? this.repository.toChatConversation(result.item) : null;
  }

  async updateTitle(conversationId: string, title: string) {
    const current = await this.repository.getById(conversationId);
    if (!current.item) return null;

    const result = await this.repository.update(conversationId, {
      title,
      messages: current.item.messages,
      metadata: current.item.metadata,
    });

    return result?.item ? this.repository.toChatConversation(result.item) : null;
  }
}

export const conversationService = new ConversationService();
