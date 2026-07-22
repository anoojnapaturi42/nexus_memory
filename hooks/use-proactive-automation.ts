"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { useProactiveStore } from "@/store/proactive-store";
import type { ApiResponse } from "@/types/api";
import type {
  ProactiveExecutionRun,
  ProactiveNotification,
  ProactiveRecommendation,
  ProactiveSnapshotData,
  ProactiveSnapshotResponse,
} from "@/types/proactive";

async function fetchProactiveSnapshot(): Promise<ProactiveSnapshotData> {
  const response = await fetch("/api/automation/proactive", {
    method: "GET",
    cache: "no-store",
  });
  const payload = (await response.json()) as ProactiveSnapshotResponse | { status: "error"; message: string };

  if (!response.ok || payload.status === "error") {
    throw new Error("failed to load proactive automation snapshot");
  }

  return payload.data;
}

async function runProactiveAction(action: "run" | "start" | "stop", intervalMinutes?: number) {
  const response = await fetch("/api/automation/proactive", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action, intervalMinutes }),
  });
  const payload = (await response.json()) as ApiResponse<{ snapshot: ProactiveSnapshotData } | { snapshot: ProactiveSnapshotData; run: ProactiveExecutionRun; scheduler: unknown }> | { status: "error"; message: string };

  if (!response.ok || payload.status === "error") {
    throw new Error("proactive automation action failed");
  }

  return payload.data;
}

async function decideRecommendation(recommendationId: string, decision: "approve" | "reject" | "dismiss") {
  const response = await fetch(`/api/automation/proactive/recommendations/${recommendationId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ decision }),
  });
  const payload = (await response.json()) as ApiResponse<{ recommendation: ProactiveRecommendation; snapshot: ProactiveSnapshotData }> | { status: "error"; message: string };

  if (!response.ok || payload.status === "error") {
    throw new Error("proactive decision failed");
  }

  return payload.data;
}

export function useProactiveAutomation() {
  const queryClient = useQueryClient();
  const selectedRecommendationId = useProactiveStore((state) => state.selectedRecommendationId);
  const autoRefreshEnabled = useProactiveStore((state) => state.autoRefreshEnabled);
  const setSelectedRecommendationId = useProactiveStore((state) => state.setSelectedRecommendationId);
  const setAutoRefreshEnabled = useProactiveStore((state) => state.setAutoRefreshEnabled);

  const snapshotQuery = useQuery({
    queryKey: queryKeys.proactive,
    queryFn: fetchProactiveSnapshot,
    staleTime: 5_000,
    refetchInterval: autoRefreshEnabled ? 12_000 : false,
  });

  const runScan = useMutation({
    mutationFn: async () => runProactiveAction("run"),
    onSuccess: async (data) => {
      queryClient.setQueryData<ProactiveSnapshotData>(queryKeys.proactive, data.snapshot);
      await queryClient.invalidateQueries({ queryKey: queryKeys.proactive });
    },
  });

  const startScheduler = useMutation({
    mutationFn: async (intervalMinutes?: number) => runProactiveAction("start", intervalMinutes),
    onSuccess: async (data) => {
      queryClient.setQueryData<ProactiveSnapshotData>(queryKeys.proactive, data.snapshot);
      await queryClient.invalidateQueries({ queryKey: queryKeys.proactive });
    },
  });

  const stopScheduler = useMutation({
    mutationFn: async () => runProactiveAction("stop"),
    onSuccess: async (data) => {
      queryClient.setQueryData<ProactiveSnapshotData>(queryKeys.proactive, data.snapshot);
      await queryClient.invalidateQueries({ queryKey: queryKeys.proactive });
    },
  });

  const approveRecommendation = useMutation({
    mutationFn: async (recommendationId: string) => decideRecommendation(recommendationId, "approve"),
    onSuccess: async (data) => {
      queryClient.setQueryData<ProactiveSnapshotData>(queryKeys.proactive, data.snapshot);
      await queryClient.invalidateQueries({ queryKey: queryKeys.proactive });
    },
  });

  const rejectRecommendation = useMutation({
    mutationFn: async (recommendationId: string) => decideRecommendation(recommendationId, "reject"),
    onSuccess: async (data) => {
      queryClient.setQueryData<ProactiveSnapshotData>(queryKeys.proactive, data.snapshot);
      await queryClient.invalidateQueries({ queryKey: queryKeys.proactive });
    },
  });

  const snapshot = snapshotQuery.data ?? {
    scheduler: {
      enabled: false,
      intervalMinutes: 15,
      lastRunAt: null,
      nextRunAt: null,
      status: "stopped" as const,
    },
    activeRun: null,
    latestRun: null,
    runs: [],
    recommendations: [],
    approvals: [],
    notifications: [],
    logs: [],
  };

  const selectedRecommendation =
    snapshot.recommendations.find((item) => item.id === selectedRecommendationId) ?? snapshot.recommendations[0] ?? null;

  const approvals = snapshot.approvals;
  const notifications = snapshot.notifications;
  const logs = snapshot.logs;
  const latestRun = snapshot.latestRun;

  return {
    snapshotQuery,
    snapshot,
    latestRun,
    approvals,
    notifications,
    logs,
    selectedRecommendation,
    selectedRecommendationId,
    autoRefreshEnabled,
    setSelectedRecommendationId,
    setAutoRefreshEnabled,
    runScan,
    startScheduler,
    stopScheduler,
    approveRecommendation,
    rejectRecommendation,
    isLoading: snapshotQuery.isLoading,
    isError: snapshotQuery.isError,
    error: snapshotQuery.error,
  };
}
