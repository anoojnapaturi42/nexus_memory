import { randomUUID } from "node:crypto";
import { BaseDatabaseRepository } from "@/repositories/database/base-repository";
import { mockDatabaseConversations } from "@/mock/database";
import type { ChatConversation, ChatMessage } from "@/types/chat";
import type { Conversation } from "@/types/domain";
import type {
  DatabaseJson,
  DatabaseConversationMessageRecord,
  DatabaseConversationRecord,
  DatabaseListResult,
  DatabaseMutationResult,
} from "@/types/database";
import type { DatabaseRuntime } from "@/lib/database/client";

type ConversationInsert = Omit<DatabaseConversationRecord, "created_at" | "updated_at"> & {
  created_at?: string;
  updated_at?: string;
};

function normalizeMessage(message: Partial<DatabaseConversationMessageRecord> & { id?: string }): DatabaseConversationMessageRecord {
  return {
    id: message.id ?? randomUUID(),
    role: String(message.role ?? "assistant"),
    content: String(message.content ?? ""),
    timestamp: String(message.timestamp ?? new Date().toISOString()),
    status: typeof message.status === "string" ? message.status : null,
    references: Array.isArray(message.references) ? message.references.map((reference) => String(reference)) : null,
  };
}

export class ConversationDatabaseRepository extends BaseDatabaseRepository<
  DatabaseConversationRecord,
  ConversationInsert,
  Partial<ConversationInsert>
> {
  protected fallbackRows = mockDatabaseConversations;

  constructor(runtime?: DatabaseRuntime) {
    super("conversations", runtime);
  }

  protected fromRow(row: Record<string, unknown>): DatabaseConversationRecord {
    const messages = Array.isArray(row.messages)
      ? row.messages.map((message) => normalizeMessage(message as Partial<DatabaseConversationMessageRecord>))
      : [];

    return {
      id: String(row.id ?? randomUUID()),
      title: (row.title as string | null) ?? null,
      messages,
      metadata: (row.metadata as Record<string, DatabaseJson>) ?? {},
      created_at: String(row.created_at ?? new Date().toISOString()),
      updated_at: String(row.updated_at ?? new Date().toISOString()),
    };
  }

  protected toInsertPayload(input: ConversationInsert): Record<string, unknown> {
    return {
      ...input,
      title: input.title ?? null,
      messages: (input.messages ?? []).map((message) => normalizeMessage(message)),
      metadata: (input.metadata ?? {}) as Record<string, DatabaseJson>,
      created_at: input.created_at ?? new Date().toISOString(),
      updated_at: input.updated_at ?? new Date().toISOString(),
    };
  }

  protected toUpdatePayload(input: Partial<ConversationInsert>): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      ...input,
      updated_at: new Date().toISOString(),
    };

    if ("messages" in payload) {
      payload.messages = Array.isArray(payload.messages)
        ? payload.messages.map((message) => normalizeMessage(message as Partial<DatabaseConversationMessageRecord>))
        : [];
    }

    if ("metadata" in payload && payload.metadata == null) {
      payload.metadata = {};
    }

    if ("title" in payload && payload.title == null) {
      payload.title = null;
    }

    return payload;
  }

  protected createFallbackRecord(input: ConversationInsert): DatabaseConversationRecord {
    const now = new Date().toISOString();
    return {
      id: input.id ?? randomUUID(),
      title: input.title ?? null,
      messages: (input.messages ?? []).map((message) => normalizeMessage(message)),
      metadata: (input.metadata ?? {}) as Record<string, DatabaseJson>,
      created_at: input.created_at ?? now,
      updated_at: input.updated_at ?? now,
    };
  }

  protected applyFallbackUpdate(record: DatabaseConversationRecord, input: Partial<ConversationInsert>): DatabaseConversationRecord {
    return {
      ...record,
      ...input,
      messages: Object.prototype.hasOwnProperty.call(input, "messages")
        ? (input.messages ?? []).map((message) => normalizeMessage(message))
        : record.messages,
      metadata: (input.metadata ?? record.metadata) as Record<string, DatabaseJson>,
      title: Object.prototype.hasOwnProperty.call(input, "title") ? input.title ?? null : record.title,
      updated_at: new Date().toISOString(),
    };
  }

  toDomain(record: DatabaseConversationRecord): Conversation {
    return {
      id: record.id,
      messages: record.messages.map((message) => ({
        id: message.id,
        role: message.role as ChatMessage["role"],
        content: message.content,
        timestamp: message.timestamp,
      })),
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    };
  }

  toChatConversation(record: DatabaseConversationRecord): ChatConversation {
    const title =
      record.title?.trim() ||
      record.messages.find((message) => message.role === "user")?.content.trim().slice(0, 54).toLowerCase() ||
      "new conversation";

    return {
      id: record.id,
      title,
      messages: record.messages.map((message) => ({
        id: message.id,
        role: message.role as ChatMessage["role"],
        content: message.content,
        timestamp: message.timestamp,
        status: (message.status as ChatMessage["status"]) ?? "complete",
        references: message.references ?? undefined,
      })),
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    };
  }

  async listChatConversations(limit = 50, offset = 0): Promise<DatabaseListResult<ChatConversation>> {
    const result = await this.list(limit, offset);
    return {
      source: result.source,
      items: result.items.map((item) => this.toChatConversation(item)),
    };
  }

  async getChatConversationById(id: string): Promise<DatabaseConversationRecord | null> {
    const result = await this.getById(id);
    return result.item;
  }

  async saveConversation(
    conversation: ChatConversation,
    metadata: Record<string, DatabaseJson> = {},
  ): Promise<DatabaseMutationResult<DatabaseConversationRecord>> {
    const payload: ConversationInsert = {
      id: conversation.id,
      title: conversation.title,
      messages: conversation.messages.map((message) => normalizeMessage(message)),
      metadata,
      created_at: conversation.createdAt,
      updated_at: conversation.updatedAt,
    };

    const existing = await this.getById(conversation.id);
    if (existing.item) {
      const updated = await this.update(conversation.id, payload);
      if (updated) return updated;
    }

    return this.insert(payload);
  }

  async appendMessage(
    conversationId: string,
    message: ChatMessage,
  ): Promise<DatabaseMutationResult<DatabaseConversationRecord> | null> {
    const current = await this.getById(conversationId);
    if (!current.item) return null;

    const nextMessages = [...current.item.messages, normalizeMessage(message)];
    return this.update(conversationId, {
      messages: nextMessages,
      title: current.item.title,
      metadata: current.item.metadata,
      updated_at: new Date().toISOString(),
    });
  }
}

export const conversationDatabaseRepository = new ConversationDatabaseRepository();
