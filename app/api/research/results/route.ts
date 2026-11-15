import { NextResponse } from "next/server";
import { getLatestMemoryEvaluationRun, listMemoryEvaluationRuns } from "@/services/evaluation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const [runs, latest] = await Promise.all([
    listMemoryEvaluationRuns(),
    getLatestMemoryEvaluationRun(),
  ]);

  return NextResponse.json({
    status: "success",
    data: {
      runs,
      latest,
    },
  });
}
