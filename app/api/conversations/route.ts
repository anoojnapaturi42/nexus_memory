import { NextRequest, NextResponse } from "next/server";
import { conversationService } from "@/services/conversation-service";
import type { ApiErrorResponse, ApiResponse } from "@/types/api";
import type { ChatConversation } from "@/types/chat";

export const runtime = "nodejs";

function error(message: string, code: string, details?: Record<string, unknown>): ApiErrorResponse {
  return { status: "error", message, code, details };
}

async function handleGet(request: NextRequest) {
  const conversationId = new URL(request.url).searchParams.get("id");

  if (conversationId) {
    const conversation = await conversationService.getChatConversationById(conversationId);
    const payload: ApiResponse<ChatConversation | null> = {
      status: "success",
      data: conversation,
    };

    return NextResponse.json(payload, { status: 200, headers: { "Cache-Control": "no-store" } });
  }

  const conversations = await conversationService.listChatConversations();
  const payload: ApiResponse<ChatConversation[]> = {
    status: "success",
    data: conversations,
  };

  return NextResponse.json(payload, { status: 200, headers: { "Cache-Control": "no-store" } });
}

async function handlePost(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { conversation?: ChatConversation } | null;
  if (!body?.conversation) {
    return NextResponse.json(error("missing conversation payload", "MISSING_CONVERSATION"), { status: 400 });
  }

  const saved = await conversationService.saveChatConversation(body.conversation);
  const payload: ApiResponse<ChatConversation> = {
    status: "success",
    data: saved,
  };

  return NextResponse.json(payload, { status: 200, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: NextRequest) {
  return handleGet(request);
}

export async function POST(request: NextRequest) {
  try {
    return await handlePost(request);
  } catch (cause) {
    return NextResponse.json(
      error("failed to persist conversation", "CONVERSATION_SAVE_FAILED", {
        reason: cause instanceof Error ? cause.message : "unknown",
      }),
      { status: 500 },
    );
  }
}
