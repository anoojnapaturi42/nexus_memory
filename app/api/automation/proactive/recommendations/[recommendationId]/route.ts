import { NextRequest, NextResponse } from "next/server";
import { proactiveAutomationService } from "@/services/proactive-automation-service";
import type { ApiErrorResponse, ApiResponse } from "@/types/api";
import type { ProactiveRecommendation } from "@/types/proactive";

export const runtime = "nodejs";

type DecisionBody = {
  decision?: "approve" | "reject" | "dismiss";
};

function buildError(message: string, code: string, details?: Record<string, unknown>): ApiErrorResponse {
  return {
    status: "error",
    message,
    code,
    details,
  };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { recommendationId: string } },
) {
  const { recommendationId } = params;
  const body = (await request.json().catch(() => null)) as DecisionBody | null;
  const decision = body?.decision ?? "approve";

  try {
    const recommendation =
      decision === "approve"
        ? await proactiveAutomationService.approveRecommendation(recommendationId)
        : await proactiveAutomationService.rejectRecommendation(recommendationId);

    return NextResponse.json(
      {
        status: "success",
        data: {
          recommendation,
          snapshot: proactiveAutomationService.getSnapshot(),
        },
      } satisfies ApiResponse<{ recommendation: ProactiveRecommendation; snapshot: ReturnType<typeof proactiveAutomationService.getSnapshot> }>,
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      buildError("decision failed", "PROACTIVE_DECISION_FAILED", {
        recommendationId,
        reason: error instanceof Error ? error.message : "unknown",
      }),
      { status: 500 },
    );
  }
}
