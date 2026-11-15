import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  MemoryEvaluationRunArtifact,
  MemoryEvaluationRunIndexEntry,
} from "@/types/memory-evaluation";

export const memoryEvaluationResultsDirectory = join(process.cwd(), "evaluation-results");

const runIdPattern = /^[a-z0-9-]{8,64}$/i;

function toIndexEntry(artifact: MemoryEvaluationRunArtifact): MemoryEvaluationRunIndexEntry {
  return {
    runId: artifact.runId,
    benchmarkCaseCount: artifact.benchmarkCaseCount,
    completedCaseCount: artifact.observations.length,
    systemIds: artifact.systemIds,
    generatedAt: artifact.generatedAt,
    provider: artifact.provider,
    model: artifact.model,
    datasetLabel: artifact.datasetLabel,
    evaluator: artifact.evaluator,
    sourceRunId: artifact.sourceRunId,
    errorCount: artifact.errors.length,
  };
}

async function readArtifact(runId: string): Promise<MemoryEvaluationRunArtifact | null> {
  if (!runIdPattern.test(runId)) return null;

  try {
    const raw = await readFile(join(memoryEvaluationResultsDirectory, `${runId}.json`), "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (!isRunArtifact(parsed, runId)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function isRunArtifact(value: unknown, runId: string): value is MemoryEvaluationRunArtifact {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<MemoryEvaluationRunArtifact>;
  return (
    candidate.runId === runId &&
    typeof candidate.generatedAt === "string" &&
    typeof candidate.benchmarkCaseCount === "number" &&
    Array.isArray(candidate.systemIds) &&
    Array.isArray(candidate.observations) &&
    Array.isArray(candidate.errors)
  );
}

export async function listMemoryEvaluationRuns(): Promise<MemoryEvaluationRunIndexEntry[]> {
  try {
    const entries = await readdir(memoryEvaluationResultsDirectory);
    const artifacts = await Promise.all(
      entries
        .filter((entry) => entry.endsWith(".json"))
        .map((entry) => readArtifact(entry.replace(/\.json$/, ""))),
    );

    return artifacts
      .filter((artifact): artifact is MemoryEvaluationRunArtifact => artifact !== null)
      .map(toIndexEntry)
      .sort((left, right) => Date.parse(right.generatedAt) - Date.parse(left.generatedAt));
  } catch {
    return [];
  }
}

export async function getLatestMemoryEvaluationRun(): Promise<{
  artifact: MemoryEvaluationRunArtifact;
  entry: MemoryEvaluationRunIndexEntry;
} | null> {
  const runs = await listMemoryEvaluationRuns();
  const latest = runs[0];
  if (!latest) return null;

  const artifact = await readArtifact(latest.runId);
  return artifact ? { artifact, entry: latest } : null;
}

export async function getMemoryEvaluationRun(runId: string): Promise<{
  artifact: MemoryEvaluationRunArtifact;
  entry: MemoryEvaluationRunIndexEntry;
} | null> {
  const artifact = await readArtifact(runId);
  return artifact ? { artifact, entry: toIndexEntry(artifact) } : null;
}
