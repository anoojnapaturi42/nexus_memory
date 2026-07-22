"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import type { ApiResponse } from "@/types/api";
import type { GoogleWorkspaceSyncSnapshot } from "@/types/google-workspace-sync";

async function fetchWorkspaceSync(): Promise<GoogleWorkspaceSyncSnapshot> {
  const response = await fetch("/api/google/workspace/sync", {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });

  const payload = (await response.json()) as ApiResponse<GoogleWorkspaceSyncSnapshot>;
  if (!response.ok || payload.status !== "success") {
    throw new Error("failed to load workspace sync data");
  }

  return payload.data;
}

export function useGoogleWorkspaceSyncQuery() {
  return useQuery({
    queryKey: queryKeys.googleWorkspaceSync,
    queryFn: fetchWorkspaceSync,
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 2,
  });
}
