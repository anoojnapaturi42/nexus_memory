import { NextRequest, NextResponse } from "next/server";
import { agentLogService } from "@/services/agent-log-service";
import type { ApiErrorResponse, ApiResponse } from "@/types/api";
import type { AgentThoughtStep } from "@/types/chat";

export const runtime = "nodejs";

function error(message: string, code: string, details?: Record<string, unknown>): ApiErrorResponse {
  return { status: "error", message, code, details };
}

function getConversationId(request: NextRequest) {
  return new URL(request.url).searchParams.get("conversationId");
}

async function handleGet(request: NextRequest) {
  const conversationId = getConversationId(request);
  if (!conversationId) {
    return NextResponse.json(error("missing conversation id", "MISSING_CONVERSATION_ID"), { status: 400 });
  }

  const steps = await agentLogService.listByConversationId(conversationId);
  const payload: ApiResponse<AgentThoughtStep[]> = {
    status: "success",
    data: steps,
  };

  return NextResponse.json(payload, { status: 200, headers: { "Cache-Control": "no-store" } });
}

async function handlePost(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as
    | { conversationId?: string; steps?: AgentThoughtStep[] }
    | null;

  if (!body?.conversationId || !Array.isArray(body.steps)) {
    return NextResponse.json(error("missing agent log payload", "MISSING_AGENT_LOGS"), { status: 400 });
  }

  const steps = await agentLogService.saveThoughtSteps(body.conversationId, body.steps);
  const payload: ApiResponse<AgentThoughtStep[]> = {
    status: "success",
    data: steps,
  };

  return NextResponse.json(payload, { status: 200, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: NextRequest) {
  try {
    return await handleGet(request);
  } catch (cause) {
    return NextResponse.json(
      error("failed to load agent logs", "AGENT_LOG_LOAD_FAILED", {
        reason: cause instanceof Error ? cause.message : "unknown",
      }),
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    return await handlePost(request);
  } catch (cause) {
    return NextResponse.json(
      error("failed to save agent logs", "AGENT_LOG_SAVE_FAILED", {
        reason: cause instanceof Error ? cause.message : "unknown",
      }),
      { status: 500 },
    );
  }
}
