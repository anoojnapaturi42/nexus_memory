import type { ApiResponse } from "@/types/api";

export function ok<T>(data: T, message = "Success"): ApiResponse<T> {
  return { status: "success", data, message };
}
