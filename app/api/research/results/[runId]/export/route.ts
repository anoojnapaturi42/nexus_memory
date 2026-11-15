import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { getMemoryEvaluationRun } from "@/services/evaluation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const formats = {
  json: "application/json",
  csv: "text/csv",
} as const;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;
  const format = new URL(request.url).searchParams.get("format") === "csv" ? "csv" : "json";
  const run = await getMemoryEvaluationRun(runId);

  if (!run) {
    return NextResponse.json(
      { status: "error", message: "evaluation run not found" },
      { status: 404 },
    );
  }

  try {
    const content = await readFile(join(process.cwd(), "evaluation-results", `${run.entry.runId}.${format}`));
    return new Response(content, {
      headers: {
        "Content-Type": `${formats[format]}; charset=utf-8`,
        "Content-Disposition": `attachment; filename="${run.entry.runId}.${format}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json(
      { status: "error", message: "evaluation export not found" },
      { status: 404 },
    );
  }
}
