import {
  createMockAgentState,
  createMockConversation,
  createMockGoogleContextItem,
  createMockMemory,
  createMockMessage,
  createMockId,
  createMockTimestamp,
} from "@/mock/generators";
import {
  mockAgentStates as seededAgentStates,
  mockConversations as seededConversations,
  mockGoogleContextItems as seededGoogleContextItems,
  mockMemories as seededMemories,
} from "@/mock/datasets";
import type { AgentState, Conversation, GoogleContextItem, Memory, Message } from "@/types/domain";

let memories: Memory[] = structuredClone(seededMemories);
let googleContextItems: GoogleContextItem[] = structuredClone(seededGoogleContextItems);
let agentStates: AgentState[] = structuredClone(seededAgentStates);
let conversations: Conversation[] = structuredClone(seededConversations);
let tickCount = 0;

function nextTick() {
  tickCount += 1;
  return tickCount;
}

function rotateAgentState(agent: AgentState, tick: number): AgentState {
  const cycle = tick % 4;
  if (cycle === 0) return { ...agent, status: "idle", currentTask: "Awaiting workspace signals", progressPercentage: 0 };
  if (cycle === 1)
    return {
      ...agent,
      status: "processing",
      currentTask: "Scanning inbox and calendar updates",
      progressPercentage: 42,
    };
  if (cycle === 2)
    return {
      ...agent,
      status: "processing",
      currentTask: "Linking memories to related entities",
      progressPercentage: 76,
    };
  return {
    ...agent,
    status: "completed",
    currentTask: "Synchronized latest workspace context",
    progressPercentage: 100,
  };
}

function createDeadlineContextItem(tick: number) {
  return createMockGoogleContextItem({
    id: `deadline_${tick}`,
    type: tick % 2 === 0 ? "email" : "meeting",
    title: tick % 2 === 0 ? "Follow-up deadline detected" : "Meeting action item",
    summary:
      tick % 2 === 0
        ? "A deadline was extracted from Gmail and surfaced for review."
        : "A meeting action item was captured and linked to the workspace.",
    createdAt: createMockTimestamp(),
    participants: ["ops@example.com", "alex@example.com"],
    linkedMemoryIds: memories.slice(0, 2).map((memory) => memory.id),
  });
}

export function getMockMemories(): Memory[] {
  return structuredClone(memories);
}

export function getMockGoogleContextItems(): GoogleContextItem[] {
  return structuredClone(googleContextItems);
}

export function getMockAgentStates(): AgentState[] {
  return structuredClone(agentStates);
}

export function getMockConversations(): Conversation[] {
  return structuredClone(conversations);
}

export function getMockMemoryById(id: string): Memory | null {
  return structuredClone(memories.find((memory) => memory.id === id) ?? null);
}

export function getMockGoogleContextItemById(id: string): GoogleContextItem | null {
  return structuredClone(googleContextItems.find((item) => item.id === id) ?? null);
}

export function getMockConversationById(id: string): Conversation | null {
  return structuredClone(conversations.find((conversation) => conversation.id === id) ?? null);
}

export function appendMockMemory(overrides: Partial<Memory> = {}): Memory {
  const memory = createMockMemory({
    id: createMockId("memory"),
    content: "New memory capture appeared from an AI workspace signal.",
    sourceApp: "gmail",
    timestamp: createMockTimestamp(),
    importanceScore: 0.8,
    relatedEntityIds: memories.slice(0, 2).map((item) => item.id),
    tags: ["auto-capture", "new"],
    ...overrides,
  });

  memories = [memory, ...memories].slice(0, 12);
  return structuredClone(memory);
}

export function appendMockDeadlineUpdate(): GoogleContextItem {
  const item = createDeadlineContextItem(nextTick());
  googleContextItems = [item, ...googleContextItems].slice(0, 12);
  return structuredClone(item);
}

export function tickMockWorkspaceActivity() {
  const tick = nextTick();

  agentStates = agentStates.map((agent) => rotateAgentState(agent, tick));

  if (tick % 2 === 0) {
    appendMockMemory({
      sourceApp: tick % 4 === 0 ? "calendar" : "gmail",
      content: `AI captured a new workspace insight at tick ${tick}.`,
      importanceScore: Math.min(0.95, 0.65 + tick * 0.02),
      tags: ["auto-capture", "live"],
    });
  }

  if (tick % 3 === 0) {
    appendMockDeadlineUpdate();
  }

  if (conversations[0]) {
    const assistantMessage: Message = createMockMessage({
      role: "assistant",
      content: `Workspace signal update #${tick}: agents refreshed and new context was linked.`,
      timestamp: createMockTimestamp(),
    });

    conversations = conversations.map((conversation, index) =>
      index === 0
        ? {
            ...conversation,
            messages: [...conversation.messages, assistantMessage].slice(-8),
            updatedAt: assistantMessage.timestamp,
          }
        : conversation,
    );
  } else {
    conversations = [
      createMockConversation({
        messages: [createMockMessage({ role: "assistant", content: "Workspace initialized." })],
      }),
    ];
  }

  return {
    memories: getMockMemories(),
    googleContextItems: getMockGoogleContextItems(),
    agentStates: getMockAgentStates(),
    conversations: getMockConversations(),
  };
}

export function createMockMemoryCapture(overrides: Partial<Memory> = {}) {
  return appendMockMemory(overrides);
}
