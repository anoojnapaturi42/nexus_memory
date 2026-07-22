import type { Conversation, Message, AgentStatus } from "@/types/domain";

export type ChatMessageStatus = "streaming" | "complete";

export type ChatMessage = Message & {
  status: ChatMessageStatus;
  references?: string[];
};

export type ChatConversation = Omit<Conversation, "messages"> & {
  title: string;
  messages: ChatMessage[];
};

export type AgentLogLevel = "info" | "success" | "warning";

export type AgentLogEntry = {
  id: string;
  agentName: string;
  timestamp: string;
  message: string;
  level: AgentLogLevel;
};

export type AgentThoughtStep = {
  id: string;
  agentName: string;
  status: AgentStatus;
  progressPercentage: number;
  currentTask: string;
  timestamp: string;
  logs: AgentLogEntry[];
};

export type ChatOrchestrationEvent =
  | { type: "step"; step: AgentThoughtStep }
  | { type: "chunk"; chunk: string }
  | { type: "complete"; finalMessage: string };
