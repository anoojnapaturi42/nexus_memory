export type EntityId = string;
export type IsoDateTimeString = string;
export type SourceApp = string;

export type Memory = {
  id: EntityId;
  content: string;
  sourceApp: SourceApp;
  timestamp: IsoDateTimeString;
  importanceScore: number;
  embeddingId: EntityId;
  relatedEntityIds: EntityId[];
  tags: string[];
};

export type GoogleContextItemType = "email" | "doc" | "calendar" | "meeting";

export type GoogleContextItem = {
  id: EntityId;
  type: GoogleContextItemType;
  title: string;
  summary: string;
  createdAt: IsoDateTimeString;
  participants: string[];
  linkedMemoryIds: EntityId[];
};

export type AgentStatus = "idle" | "processing" | "completed" | "error";

export type AgentState = {
  agentName: string;
  status: AgentStatus;
  currentTask: string;
  startedAt: IsoDateTimeString;
  progressPercentage: number;
};

export type MessageRole = "user" | "assistant" | "system";

export type Message = {
  id: EntityId;
  role: MessageRole;
  content: string;
  timestamp: IsoDateTimeString;
};

export type Conversation = {
  id: EntityId;
  messages: Message[];
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
};
