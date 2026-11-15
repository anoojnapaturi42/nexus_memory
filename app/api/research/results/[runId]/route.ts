import { NextResponse } from "next/server";
import { getMemoryEvaluationRun } from "@/services/evaluation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;
  const run = await getMemoryEvaluationRun(runId);

  if (!run) {
    return NextResponse.json(
      { status: "error", message: "evaluation run not found" },
      { status: 404 },
    );
  }

  return NextResponse.json({
    status: "success",
    data: run,
  });
}
