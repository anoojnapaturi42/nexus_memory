import { NextResponse } from "next/server";
import {
  exportMemoryEvaluationArtifact,
  GeminiMemoryAnswerGenerator,
  MemoryEvaluationRunner,
  OllamaMemoryAnswerGenerator,
} from "@/services/evaluation";
import { memoryBenchmarkDataset } from "@/mock/evaluation/memory-benchmark-dataset";
import { memorySystemIds, type MemorySystemId } from "@/types/memory-evaluation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 1800;

type EvaluationRequest = {
  limit?: number;
  provider?: "ollama" | "gemini";
  systems?: MemorySystemId[];
};

function isAuthorized(request: Request) {
  if (process.env.NODE_ENV !== "production") return true;

  const secret = process.env.RESEARCH_EVALUATION_SECRET?.trim();
  if (!secret) return false;

  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { status: "error", message: "research evaluation is disabled for public requests" },
      { status: 403 },
    );
  }

  try {
    const body = (await request.json().catch(() => ({}))) as EvaluationRequest;
    const limit = Math.min(
      Math.max(Number(body.limit ?? memoryBenchmarkDataset.length), 1),
      memoryBenchmarkDataset.length,
    );
    const systemIds = (body.systems ?? memorySystemIds).filter((systemId) =>
      memorySystemIds.includes(systemId),
    );
    if (systemIds.length === 0) {
      return NextResponse.json(
        { status: "error", message: "at least one valid memory system is required" },
        { status: 400 },
      );
    }
    const answerGenerator =
      body.provider === "gemini"
        ? GeminiMemoryAnswerGenerator.fromEnvironment()
        : OllamaMemoryAnswerGenerator.fromEnvironment();
    const runner = new MemoryEvaluationRunner(
      answerGenerator,
      undefined,
      undefined,
      body.provider === "gemini"
        ? {
            minIntervalBetweenGenerationsMs: 4_500,
            maxGenerationAttempts: 6,
            retryBaseDelayMs: 2_000,
          }
        : undefined,
    );
    const artifact = await runner.run(memoryBenchmarkDataset.slice(0, limit), systemIds);
    const paths = await exportMemoryEvaluationArtifact(artifact);

    return NextResponse.json({
      status: "success",
      data: {
        runId: artifact.runId,
        benchmarkCaseCount: artifact.benchmarkCaseCount,
        provider: artifact.provider ?? body.provider ?? "ollama",
        model: artifact.model ?? null,
        summaries: artifact.summaries,
        errorCount: artifact.errors.length,
        completedCaseCount: artifact.observations.length,
        artifacts: paths,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        message: error instanceof Error ? error.message : "memory evaluation failed",
      },
      { status: 500 },
    );
  }
}
