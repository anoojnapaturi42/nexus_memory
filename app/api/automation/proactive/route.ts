import { NextRequest, NextResponse } from "next/server";
import { proactiveAutomationService } from "@/services/proactive-automation-service";
import type { ApiErrorResponse, ApiResponse } from "@/types/api";
import type { ProactiveSnapshotData } from "@/types/proactive";

export const runtime = "nodejs";

type ProactiveRouteBody = {
  action?: "run" | "start" | "stop";
  intervalMinutes?: number;
  reason?: string;
};

function buildError(message: string, code: string, details?: Record<string, unknown>): ApiErrorResponse {
  return {
    status: "error",
    message,
    code,
    details,
  };
}

function snapshotResponse(): ApiResponse<ProactiveSnapshotData> {
  return {
    status: "success",
    data: proactiveAutomationService.getSnapshot(),
  };
}

export async function GET() {
  return NextResponse.json(snapshotResponse(), {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as ProactiveRouteBody | null;
  const action = body?.action ?? "run";

  try {
    if (action === "start") {
      const scheduler = proactiveAutomationService.startScheduler(Number.isFinite(body?.intervalMinutes ?? NaN) ? (body?.intervalMinutes ?? 15) : 15);
      return NextResponse.json(
        {
          status: "success",
          data: {
            snapshot: proactiveAutomationService.getSnapshot(),
            scheduler,
          },
        } satisfies ApiResponse<{ snapshot: ProactiveSnapshotData; scheduler: ReturnType<typeof proactiveAutomationService.startScheduler> }>,
        {
          status: 200,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    if (action === "stop") {
      const scheduler = proactiveAutomationService.stopScheduler();
      return NextResponse.json(
        {
          status: "success",
          data: {
            snapshot: proactiveAutomationService.getSnapshot(),
            scheduler,
          },
        } satisfies ApiResponse<{ snapshot: ProactiveSnapshotData; scheduler: ReturnType<typeof proactiveAutomationService.stopScheduler> }>,
        {
          status: 200,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    const run = await proactiveAutomationService.runScan({
      source: "manual",
      reason: body?.reason ?? "manual run request",
    });

    return NextResponse.json(
      {
        status: "success",
        data: {
          snapshot: proactiveAutomationService.getSnapshot(),
          run,
        },
      } satisfies ApiResponse<{ snapshot: ProactiveSnapshotData; run: typeof run }>,
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      buildError("proactive automation run failed", "PROACTIVE_RUN_FAILED", {
        reason: error instanceof Error ? error.message : "unknown",
      }),
      { status: 500 },
    );
  }
}
