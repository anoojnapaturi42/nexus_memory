"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { createMockId, createMockTimestamp } from "@/mock/generators";
import { runMockChatOrchestration } from "@/mock/chat-orchestration";
import { getMockGoogleContextItems, getMockMemories } from "@/mock/runtime";
import { queryKeys } from "@/lib/query-keys";
import { useChatStore } from "@/store/chat-store";
import type { ApiResponse } from "@/types/api";
import type { AgentThoughtStep, ChatConversation, ChatMessage } from "@/types/chat";

function normalizeConversation(conversation: ChatConversation): ChatConversation {
  return {
    ...conversation,
    title: conversation.title.toLowerCase(),
    messages: conversation.messages.map((message) => ({
      ...message,
      status: message.status ?? "complete",
    })),
  };
}

function conversationTitleFromPrompt(prompt: string) {
  return prompt.trim().slice(0, 54).toLowerCase() || "new conversation";
}

async function fetchConversations(): Promise<ChatConversation[]> {
  const response = await fetch("/api/conversations", {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });

  const payload = (await response.json()) as ApiResponse<ChatConversation[]>;
  if (!response.ok || payload.status !== "success") {
    throw new Error("failed to load conversations");
  }

  return payload.data.map(normalizeConversation);
}

async function fetchConversationAgentLogs(conversationId: string): Promise<AgentThoughtStep[]> {
  const response = await fetch(`/api/agent-logs?conversationId=${encodeURIComponent(conversationId)}`, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });

  const payload = (await response.json()) as ApiResponse<AgentThoughtStep[]>;
  if (!response.ok || payload.status !== "success") {
    throw new Error("failed to load agent logs");
  }

  return payload.data;
}

async function saveConversation(conversation: ChatConversation): Promise<ChatConversation> {
  const response = await fetch("/api/conversations", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ conversation }),
  });

  const payload = (await response.json()) as ApiResponse<ChatConversation>;
  if (!response.ok || payload.status !== "success") {
    throw new Error("failed to persist conversation");
  }

  return normalizeConversation(payload.data);
}

async function saveAgentLogs(conversationId: string, steps: AgentThoughtStep[]): Promise<AgentThoughtStep[]> {
  const response = await fetch("/api/agent-logs", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ conversationId, steps }),
  });

  const payload = (await response.json()) as ApiResponse<AgentThoughtStep[]>;
  if (!response.ok || payload.status !== "success") {
    throw new Error("failed to persist agent logs");
  }

  return payload.data;
}

export function useChatAssistant() {
  const conversationsQuery = useQuery({
    queryKey: queryKeys.conversations,
    queryFn: fetchConversations,
    staleTime: 10_000,
    refetchOnWindowFocus: false,
  });

  const conversations = useChatStore((state) => state.conversations);
  const activeConversationId = useChatStore((state) => state.activeConversationId);
  const draft = useChatStore((state) => state.draft);
  const agentThoughts = useChatStore((state) => state.agentThoughts);
  const isHydrated = useChatStore((state) => state.isHydrated);
  const setHydrated = useChatStore((state) => state.setHydrated);
  const setDraft = useChatStore((state) => state.setDraft);
  const setConversations = useChatStore((state) => state.setConversations);
  const setActiveConversationId = useChatStore((state) => state.setActiveConversationId);
  const addConversation = useChatStore((state) => state.addConversation);
  const appendMessage = useChatStore((state) => state.appendMessage);
  const updateMessage = useChatStore((state) => state.updateMessage);
  const updateConversationTitle = useChatStore((state) => state.updateConversationTitle);
  const setAgentThoughts = useChatStore((state) => state.setAgentThoughts);
  const resetAgentThoughts = useChatStore((state) => state.resetAgentThoughts);

  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const abortRef = useRef(false);
  const assistantMessageIdRef = useRef<string | null>(null);
  const conversationSaveTimerRef = useRef<number | null>(null);
  const agentLogSaveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!conversationsQuery.data || conversations.length > 0) {
      if (conversationsQuery.data) {
        setHydrated(true);
      }
      return;
    }

    setConversations(conversationsQuery.data);
    setActiveConversationId(conversationsQuery.data[0]?.id ?? null);
    setHydrated(true);
  }, [conversations.length, conversationsQuery.data, setActiveConversationId, setConversations, setHydrated]);

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeConversationId) ?? conversations[0] ?? null,
    [activeConversationId, conversations],
  );

  const agentLogsQuery = useQuery({
    queryKey: ["agent-logs", activeConversationId ?? "none"],
    queryFn: async () => {
      if (!activeConversationId) return [] as AgentThoughtStep[];
      return fetchConversationAgentLogs(activeConversationId);
    },
    enabled: Boolean(activeConversationId),
    staleTime: 5_000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!agentLogsQuery.data) return;
    setAgentThoughts(agentLogsQuery.data);
  }, [agentLogsQuery.data, setAgentThoughts]);

  const persistConversationMutation = useMutation({
    mutationFn: saveConversation,
  });

  const persistAgentLogsMutation = useMutation({
    mutationFn: async (input: { conversationId: string; steps: AgentThoughtStep[] }) =>
      saveAgentLogs(input.conversationId, input.steps),
  });

  useEffect(() => {
    if (!isHydrated || !activeConversation) return;

    if (conversationSaveTimerRef.current) {
      window.clearTimeout(conversationSaveTimerRef.current);
    }

    conversationSaveTimerRef.current = window.setTimeout(() => {
      void persistConversationMutation.mutateAsync(activeConversation);
    }, 400);

    return () => {
      if (conversationSaveTimerRef.current) {
        window.clearTimeout(conversationSaveTimerRef.current);
      }
    };
  }, [activeConversation, isHydrated, persistConversationMutation]);

  useEffect(() => {
    if (!isHydrated || !activeConversationId || agentThoughts.length === 0) return;

    if (agentLogSaveTimerRef.current) {
      window.clearTimeout(agentLogSaveTimerRef.current);
    }

    agentLogSaveTimerRef.current = window.setTimeout(() => {
      void persistAgentLogsMutation.mutateAsync({
        conversationId: activeConversationId,
        steps: agentThoughts,
      });
    }, 400);

    return () => {
      if (agentLogSaveTimerRef.current) {
        window.clearTimeout(agentLogSaveTimerRef.current);
      }
    };
  }, [activeConversationId, agentThoughts, isHydrated, persistAgentLogsMutation]);

  const memoriesQuery = useQuery({
    queryKey: queryKeys.memories,
    queryFn: async () => getMockMemories(),
    staleTime: 15_000,
  });

  const contextQuery = useQuery({
    queryKey: queryKeys.googleContextItems,
    queryFn: async () => getMockGoogleContextItems(),
    staleTime: 15_000,
  });

  const sendMessage = useMutation({
    mutationFn: async (prompt: string) => {
      const trimmed = prompt.trim();
      if (!trimmed) throw new Error("empty prompt");

      abortRef.current = false;
      setIsStreaming(true);
      setStreamingText("");
      setAgentThoughts([]);

      const conversationId = activeConversation?.id ?? createMockId("conversation");
      const now = createMockTimestamp();
      const userMessage: ChatMessage = {
        id: createMockId("message"),
        role: "user",
        content: trimmed,
        timestamp: now,
        status: "complete",
      };

      const assistantMessageId = createMockId("message");
      assistantMessageIdRef.current = assistantMessageId;

      const assistantPlaceholder: ChatMessage = {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        timestamp: now,
        status: "streaming",
      };

      if (!activeConversation) {
        addConversation({
          id: conversationId,
          title: conversationTitleFromPrompt(trimmed),
          messages: [userMessage, assistantPlaceholder],
          createdAt: now,
          updatedAt: now,
        });
      } else {
        appendMessage(conversationId, userMessage);
        appendMessage(conversationId, assistantPlaceholder);
      }

      try {
        const orchestration = runMockChatOrchestration({
          prompt: trimmed,
          memories: memoriesQuery.data ?? getMockMemories(),
          contextItems: contextQuery.data ?? getMockGoogleContextItems(),
          agents: [],
        });

        for await (const event of orchestration) {
          if (abortRef.current) break;

          if (event.type === "step") {
            setAgentThoughts((prev) => [...prev.filter((step) => step.id !== event.step.id), event.step]);
          }

          if (event.type === "chunk") {
            setStreamingText((current) => {
              const next = `${current}${event.chunk}`;
              updateMessage(conversationId, assistantMessageId, { content: next });
              return next;
            });
          }

          if (event.type === "complete") {
            updateMessage(conversationId, assistantMessageId, {
              content: event.finalMessage,
              status: "complete",
              timestamp: createMockTimestamp(),
            });
            setStreamingText(event.finalMessage);
          }
        }
      } finally {
        setIsStreaming(false);
        setDraft("");
        updateConversationTitle(conversationId, conversationTitleFromPrompt(trimmed));
      }

      return conversationId;
    },
  });

  function stopStreaming() {
    abortRef.current = true;
    setIsStreaming(false);

    const conversationId = activeConversation?.id;
    const assistantMessageId = assistantMessageIdRef.current;

    if (conversationId && assistantMessageId) {
      updateMessage(conversationId, assistantMessageId, { status: "complete" });
    }
  }

  function startNewConversation() {
    const now = createMockTimestamp();
    const conversationId = createMockId("conversation");

    addConversation({
      id: conversationId,
      title: "new conversation",
      messages: [],
      createdAt: now,
      updatedAt: now,
    });

    setActiveConversationId(conversationId);
    resetAgentThoughts();
    setStreamingText("");
    setDraft("");
  }

  return {
    conversations,
    activeConversation,
    activeConversationId,
    agentThoughts,
    draft,
    setDraft,
    setActiveConversationId,
    isStreaming,
    streamingText,
    sendMessage,
    stopStreaming,
    startNewConversation,
    isHydrated,
    isLoading: memoriesQuery.isLoading || contextQuery.isLoading || conversationsQuery.isLoading || agentLogsQuery.isLoading,
  };
}
