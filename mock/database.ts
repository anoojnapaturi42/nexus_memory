import type {
  DatabaseAgentLogRecord,
  DatabaseConversationRecord,
  DatabaseEntityRecord,
  DatabaseMemoryRecord,
  DatabaseRelationshipRecord,
} from "@/types/database";

const now = new Date();

function minutesAgo(minutes: number) {
  return new Date(now.getTime() - minutes * 60_000).toISOString();
}

export const mockDatabaseMemories: DatabaseMemoryRecord[] = [
  {
    id: "memory-db-1",
    content: "rajn and the study plan are aligned around the google interview timeline.",
    source_app: "gmail",
    importance_score: 0.93,
    embedding: null,
    metadata: { tags: ["interview", "study-plan"], source: "gmail" },
    created_at: minutesAgo(18),
    updated_at: minutesAgo(18),
  },
  {
    id: "memory-db-2",
    content: "resume.pdf was updated after the latest systems design revision.",
    source_app: "drive",
    importance_score: 0.88,
    embedding: null,
    metadata: { tags: ["resume", "drive"], source: "drive" },
    created_at: minutesAgo(55),
    updated_at: minutesAgo(55),
  },
];

export const mockDatabaseConversations: DatabaseConversationRecord[] = [
  {
    id: "conversation-db-1",
    title: "study plan for google interviews",
    messages: [
      {
        id: "conversation-db-1-message-1",
        role: "user",
        content: "create my study plan for google interviews.",
        timestamp: minutesAgo(118),
        status: null,
        references: null,
      },
      {
        id: "conversation-db-1-message-2",
        role: "assistant",
        content: "i pulled a study plan together from the workspace signals.",
        timestamp: minutesAgo(116),
        status: null,
        references: ["memory-db-1"],
      },
    ],
    metadata: { topic: "interview prep", participants: ["Raj"] },
    created_at: minutesAgo(120),
    updated_at: minutesAgo(12),
  },
];

export const mockDatabaseEntities: DatabaseEntityRecord[] = [
  {
    id: "entity-raj",
    entity_type: "person",
    name: "Raj",
    metadata: { source: "gmail", role: "primary contact" },
    created_at: minutesAgo(220),
    updated_at: minutesAgo(22),
  },
  {
    id: "entity-interview",
    entity_type: "project",
    name: "Google ML Interview",
    metadata: { source: "workspace" },
    created_at: minutesAgo(220),
    updated_at: minutesAgo(22),
  },
];

export const mockDatabaseRelationships: DatabaseRelationshipRecord[] = [
  {
    id: "relationship-1",
    source_entity_id: "entity-raj",
    target_entity_id: "entity-interview",
    relationship_type: "DISCUSSED_WITH",
    weight: 0.97,
    metadata: { origin: "chat" },
    created_at: minutesAgo(20),
    updated_at: minutesAgo(20),
  },
];

export const mockDatabaseAgentLogs: DatabaseAgentLogRecord[] = [
  {
    id: "agent-log-1",
    conversation_id: "conversation-db-1",
    agent_name: "memory agent",
    status: "processing",
    current_task: "searching long-term vector memory",
    started_at: minutesAgo(14),
    finished_at: null,
    progress_percentage: 72,
    metadata: { traceId: "trace-memory-1" },
    created_at: minutesAgo(14),
    updated_at: minutesAgo(14),
  },
];
