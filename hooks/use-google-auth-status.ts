"use client";

import { useQuery } from "@tanstack/react-query";
import type { GoogleOAuthStatusSuccess } from "@/types/auth";
import type { ApiResponse } from "@/types/api";

async function fetchGoogleAuthStatus(): Promise<GoogleOAuthStatusSuccess> {
  const response = await fetch("/api/auth/google/status", {
    method: "GET",
    cache: "no-store",
    credentials: "include",
  });

  const payload = (await response.json()) as ApiResponse<GoogleOAuthStatusSuccess> | GoogleOAuthStatusSuccess;
  if (!response.ok) {
    throw new Error("failed to load google auth status");
  }

  if ("status" in payload && payload.status === "success") {
    return payload.data;
  }

  return payload as GoogleOAuthStatusSuccess;
}

export function useGoogleAuthStatus() {
  return useQuery({
    queryKey: ["google-auth-status"],
    queryFn: fetchGoogleAuthStatus,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });
}
