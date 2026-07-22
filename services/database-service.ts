import { getDatabaseRuntime } from "@/lib/database/client";
import {
  agentLogDatabaseRepository,
  conversationDatabaseRepository,
  entityDatabaseRepository,
  memoryDatabaseRepository,
  relationshipDatabaseRepository,
} from "@/repositories";

export class DatabaseService {
  readonly runtime = getDatabaseRuntime();
  readonly pool = this.runtime.pool;
  readonly supabase = this.runtime.supabase;

  readonly memories = memoryDatabaseRepository;
  readonly conversations = conversationDatabaseRepository;
  readonly entities = entityDatabaseRepository;
  readonly relationships = relationshipDatabaseRepository;
  readonly agentLogs = agentLogDatabaseRepository;

  getStatus() {
    return {
      mode: this.runtime.mode,
      postgres: this.runtime.available.postgres,
      supabase: this.runtime.available.supabase,
      missingEnv: this.runtime.missingEnv,
    };
  }

  listMemories(limit = 50, offset = 0) {
    return this.memories.list(limit, offset);
  }

  getMemory(id: string) {
    return this.memories.getById(id);
  }

  listConversations(limit = 50, offset = 0) {
    return this.conversations.list(limit, offset);
  }

  getConversation(id: string) {
    return this.conversations.getById(id);
  }

  listEntities(limit = 50, offset = 0) {
    return this.entities.list(limit, offset);
  }

  getEntity(id: string) {
    return this.entities.getById(id);
  }

  listRelationships(limit = 50, offset = 0) {
    return this.relationships.list(limit, offset);
  }

  getRelationship(id: string) {
    return this.relationships.getById(id);
  }

  listAgentLogs(limit = 50, offset = 0) {
    return this.agentLogs.list(limit, offset);
  }

  getAgentLog(id: string) {
    return this.agentLogs.getById(id);
  }
}

export const databaseService = new DatabaseService();
