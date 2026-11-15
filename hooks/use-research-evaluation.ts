"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import type {
  MemoryEvaluationRunArtifact,
  MemoryEvaluationRunIndexEntry,
} from "@/types/memory-evaluation";

type RunsPayload = {
  runs: MemoryEvaluationRunIndexEntry[];
  latest: {
    artifact: MemoryEvaluationRunArtifact;
    entry: MemoryEvaluationRunIndexEntry;
  } | null;
};

type RunPayload = {
  artifact: MemoryEvaluationRunArtifact;
  entry: MemoryEvaluationRunIndexEntry;
};

async function fetchRuns(): Promise<RunsPayload> {
  const response = await fetch("/api/research/results", { cache: "no-store" });
  const payload = (await response.json()) as
    | { status: "success"; data: RunsPayload }
    | { status: "error"; message: string };

  if (!response.ok || payload.status === "error") {
    throw new Error("failed to load evaluation results");
  }

  return payload.data;
}

async function fetchRun(runId: string): Promise<RunPayload> {
  const response = await fetch(`/api/research/results/${runId}`, { cache: "no-store" });
  const payload = (await response.json()) as
    | { status: "success"; data: RunPayload }
    | { status: "error"; message: string };

  if (!response.ok || payload.status === "error") {
    throw new Error("failed to load evaluation run");
  }

  return payload.data;
}

async function runGeminiBenchmark() {
  const response = await fetch("/api/research/evaluate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider: "gemini" }),
  });
  const payload = (await response.json()) as
    | {
        status: "success";
        data: { runId: string; errorCount: number; completedCaseCount: number };
      }
    | { status: "error"; message: string };

  if (!response.ok || payload.status === "error") {
    throw new Error(payload.status === "error" ? payload.message : "benchmark run failed");
  }

  return payload.data;
}

export function useResearchEvaluation(selectedRunId?: string) {
  const queryClient = useQueryClient();
  const runsQuery = useQuery({
    queryKey: queryKeys.research,
    queryFn: fetchRuns,
    staleTime: 10_000,
  });

  const latestRunId = runsQuery.data?.latest?.entry.runId;
  const detailQuery = useQuery({
    queryKey: [...queryKeys.research, "run", selectedRunId],
    queryFn: () => fetchRun(selectedRunId as string),
    enabled: Boolean(selectedRunId && selectedRunId !== latestRunId),
    staleTime: 60_000,
  });

  const runBenchmark = useMutation({
    mutationFn: runGeminiBenchmark,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.research });
    },
  });

  const artifact =
    selectedRunId && selectedRunId !== latestRunId
      ? (detailQuery.data?.artifact ?? null)
      : (runsQuery.data?.latest?.artifact ?? null);

  return {
    runsQuery,
    detailQuery,
    runs: runsQuery.data?.runs ?? [],
    artifact,
    runBenchmark,
  };
}
