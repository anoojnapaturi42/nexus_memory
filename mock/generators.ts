import type {
  AgentState,
  AgentStatus,
  Conversation,
  GoogleContextItem,
  GoogleContextItemType,
  IsoDateTimeString,
  Memory,
  Message,
  MessageRole,
} from "@/types/domain";

let counter = 0;

export function createMockId(prefix: string) {
  counter += 1;
  return `${prefix}_${counter.toString().padStart(4, "0")}`;
}

export function createMockTimestamp(offsetMinutes = 0): IsoDateTimeString {
  return new Date(Date.now() + offsetMinutes * 60_000).toISOString();
}

export function createMockMemory(overrides: Partial<Memory> = {}): Memory {
  return {
    id: createMockId("memory"),
    content: "Captured workspace insight",
    sourceApp: "gmail",
    timestamp: createMockTimestamp(),
    importanceScore: 0.72,
    embeddingId: createMockId("embedding"),
    relatedEntityIds: [],
    tags: ["workspace", "insight"],
    ...overrides,
  };
}

export function createMockGoogleContextItem(
  overrides: Partial<GoogleContextItem> = {},
): GoogleContextItem {
  return {
    id: createMockId("context"),
    type: "email",
    title: "Inbox summary",
    summary: "A concise summary of a linked Google context item.",
    createdAt: createMockTimestamp(),
    participants: ["alex@example.com"],
    linkedMemoryIds: [],
    ...overrides,
  };
}

export function createMockAgentState(overrides: Partial<AgentState> = {}): AgentState {
  return {
    agentName: "Memory Synthesizer",
    status: "idle",
    currentTask: "Waiting for new workspace signals",
    startedAt: createMockTimestamp(-15),
    progressPercentage: 0,
    ...overrides,
  };
}

export function createMockMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: createMockId("message"),
    role: "assistant",
    content: "How can I help with the workspace?",
    timestamp: createMockTimestamp(),
    ...overrides,
  };
}

export function createMockConversation(overrides: Partial<Conversation> = {}): Conversation {
  const createdAt = createMockTimestamp(-45);

  return {
    id: createMockId("conversation"),
    messages: [createMockMessage({ role: "system", content: "Workspace assistant ready." })],
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  };
}

export function createMockDataset<T>(
  factory: (index: number) => T,
  count: number,
): T[] {
  return Array.from({ length: count }, (_, index) => factory(index));
}

export function cloneMockDataset<T>(items: T[]): T[] {
  return items.map((item) => structuredClone(item));
}

export const mockRoles: MessageRole[] = ["user", "assistant", "system"];
export const mockAgentStatuses: AgentStatus[] = ["idle", "processing", "completed", "error"];
export const mockContextTypes: GoogleContextItemType[] = ["email", "doc", "calendar", "meeting"];
