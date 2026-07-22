import type { ApiResponse } from "@/types/api";

export async function apiGet<T>(path: string): Promise<ApiResponse<T>> {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
    },
  });

  return (await response.json()) as ApiResponse<T>;
}
