export type DatabaseJson = string | number | boolean | null | DatabaseJson[] | { [key: string]: DatabaseJson };

export type DatabaseSource = "postgres" | "supabase" | "mock";

export type DatabaseListResult<T> = {
  source: DatabaseSource;
  items: T[];
};

export type DatabaseItemResult<T> = {
  source: DatabaseSource;
  item: T | null;
};

export type DatabaseMutationResult<T> = {
  source: DatabaseSource;
  item: T;
};

export type DatabaseDeleteResult = {
  source: DatabaseSource;
  deleted: boolean;
};

export type DatabaseMemoryRecord = {
  id: string;
  content: string;
  source_app: string;
  importance_score: number;
  tags: string[];
  embedding: number[] | null;
  metadata: Record<string, DatabaseJson>;
  created_at: string;
  updated_at: string;
};

export type DatabaseConversationMessageRecord = {
  id: string;
  role: string;
  content: string;
  timestamp: string;
  status: string | null;
  references: string[] | null;
};

export type DatabaseConversationRecord = {
  id: string;
  title: string | null;
  messages: DatabaseConversationMessageRecord[];
  metadata: Record<string, DatabaseJson>;
  created_at: string;
  updated_at: string;
};

export type DatabaseEntityRecord = {
  id: string;
  entity_type: string;
  name: string;
  metadata: Record<string, DatabaseJson>;
  created_at: string;
  updated_at: string;
};

export type DatabaseRelationshipRecord = {
  id: string;
  source_entity_id: string;
  target_entity_id: string;
  relationship_type: string;
  weight: number;
  metadata: Record<string, DatabaseJson>;
  created_at: string;
  updated_at: string;
};

export type DatabaseAgentLogRecord = {
  id: string;
  conversation_id: string | null;
  agent_name: string;
  status: string;
  current_task: string;
  started_at: string;
  finished_at: string | null;
  progress_percentage: number;
  metadata: Record<string, DatabaseJson>;
  created_at: string;
  updated_at: string;
};

export type DatabaseIntegrationRecord = {
  id: string;
  user_id: string;
  provider: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
};

export interface DatabaseSchema {
  public: {
    Tables: {
      memories: {
        Row: DatabaseMemoryRecord;
        Insert: Omit<DatabaseMemoryRecord, "created_at" | "updated_at"> & {
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<DatabaseMemoryRecord, "id" | "created_at" | "updated_at">>;
        Relationships: [];
      };
      conversations: {
        Row: DatabaseConversationRecord;
        Insert: Omit<DatabaseConversationRecord, "created_at" | "updated_at"> & {
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<DatabaseConversationRecord, "id" | "created_at" | "updated_at">>;
        Relationships: [];
      };
      entities: {
        Row: DatabaseEntityRecord;
        Insert: Omit<DatabaseEntityRecord, "created_at" | "updated_at"> & {
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<DatabaseEntityRecord, "id" | "created_at" | "updated_at">>;
        Relationships: [];
      };
      relationships: {
        Row: DatabaseRelationshipRecord;
        Insert: Omit<DatabaseRelationshipRecord, "created_at" | "updated_at"> & {
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<DatabaseRelationshipRecord, "id" | "created_at" | "updated_at">>;
        Relationships: [];
      };
      agent_logs: {
        Row: DatabaseAgentLogRecord;
        Insert: Omit<DatabaseAgentLogRecord, "created_at" | "updated_at"> & {
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<DatabaseAgentLogRecord, "id" | "created_at" | "updated_at">>;
        Relationships: [];
      };
      user_integrations: {
        Row: DatabaseIntegrationRecord;
        Insert: Omit<DatabaseIntegrationRecord, "created_at" | "updated_at"> & {
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<DatabaseIntegrationRecord, "id" | "created_at" | "updated_at">>;
        Relationships: [];
      };
    };
  };
}

export type DatabaseTableName = keyof DatabaseSchema["public"]["Tables"];
