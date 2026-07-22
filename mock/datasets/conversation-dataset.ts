import { createMockConversation, createMockMessage } from "@/mock/generators";
import type { Conversation } from "@/types/domain";

export const mockConversations: Conversation[] = [
  createMockConversation({
    id: "conversation_1",
    messages: [
      createMockMessage({
        id: "message_1",
        role: "system",
        content: "Conversation initialized.",
      }),
      createMockMessage({
        id: "message_2",
        role: "user",
        content: "Summarize my recent workspace updates.",
      }),
      createMockMessage({
        id: "message_3",
        role: "assistant",
        content: "I found three high-priority updates across Gmail and Calendar.",
      }),
    ],
    updatedAt: new Date().toISOString(),
  }),
];
