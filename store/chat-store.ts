import { create } from "zustand";
import type { AgentThoughtStep, ChatConversation, ChatMessage } from "@/types/chat";

type ChatState = {
  conversations: ChatConversation[];
  activeConversationId: string | null;
  draft: string;
  agentThoughts: AgentThoughtStep[];
  isHydrated: boolean;
  setHydrated: (value: boolean) => void;
  setDraft: (draft: string) => void;
  setConversations: (conversations: ChatConversation[]) => void;
  setActiveConversationId: (conversationId: string | null) => void;
  ensureConversation: (conversation: ChatConversation) => void;
  addConversation: (conversation: ChatConversation) => void;
  appendMessage: (conversationId: string, message: ChatMessage) => void;
  updateMessage: (conversationId: string, messageId: string, patch: Partial<ChatMessage>) => void;
  updateConversationTitle: (conversationId: string, title: string) => void;
  setAgentThoughts: (steps: AgentThoughtStep[] | ((current: AgentThoughtStep[]) => AgentThoughtStep[])) => void;
  resetAgentThoughts: () => void;
};

export const useChatStore = create<ChatState>()((set, get) => ({
  conversations: [],
  activeConversationId: null,
  draft: "",
  agentThoughts: [],
  isHydrated: false,
  setHydrated: (value) => set({ isHydrated: value }),
  setDraft: (draft) => set({ draft }),
  setConversations: (conversations) => set({ conversations }),
  setActiveConversationId: (activeConversationId) => set({ activeConversationId }),
  ensureConversation: (conversation) =>
    set((state) => {
      const exists = state.conversations.some((item) => item.id === conversation.id);
      return exists
        ? state
        : {
            conversations: [...state.conversations, conversation],
            activeConversationId: conversation.id,
          };
    }),
  addConversation: (conversation) =>
    set((state) => ({
      conversations: [conversation, ...state.conversations],
      activeConversationId: conversation.id,
    })),
  appendMessage: (conversationId, message) =>
    set((state) => ({
      conversations: state.conversations.map((conversation) =>
        conversation.id === conversationId
          ? {
              ...conversation,
              messages: [...conversation.messages, message],
              updatedAt: message.timestamp,
            }
          : conversation,
      ),
    })),
  updateMessage: (conversationId, messageId, patch) =>
    set((state) => ({
      conversations: state.conversations.map((conversation) =>
        conversation.id === conversationId
          ? {
              ...conversation,
              messages: conversation.messages.map((message) =>
                message.id === messageId ? { ...message, ...patch } : message,
              ),
            }
          : conversation,
      ),
    })),
  updateConversationTitle: (conversationId, title) =>
    set((state) => ({
      conversations: state.conversations.map((conversation) =>
        conversation.id === conversationId ? { ...conversation, title } : conversation,
      ),
    })),
  setAgentThoughts: (agentThoughts) =>
    set((state) => ({
      agentThoughts: typeof agentThoughts === "function" ? agentThoughts(state.agentThoughts) : agentThoughts,
    })),
  resetAgentThoughts: () => set({ agentThoughts: [] }),
}));

export function getActiveChatConversation(state: ChatState) {
  return state.conversations.find((conversation) => conversation.id === state.activeConversationId) ?? state.conversations[0] ?? null;
}
