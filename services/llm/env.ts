import type { ApiErrorResponse } from "@/types/api";

export type GeminiEnvConfig = {
  apiKey: string;
  model: string;
  embeddingModel: string;
};

export type GeminiEnvResult =
  | { ok: true; env: GeminiEnvConfig }
  | { ok: false; error: ApiErrorResponse };

function buildError(message: string, details?: Record<string, unknown>): ApiErrorResponse {
  return {
    status: "error",
    message,
    code: "MISSING_ENV",
    details,
  };
}

export function getGeminiEnv(): GeminiEnvResult {
  const apiKey = process.env.GEMINI_API_KEY?.trim() ?? "";
  const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash";
  const embeddingModel = process.env.GEMINI_EMBEDDING_MODEL?.trim() || "text-embedding-004";

  if (!apiKey) {
    return {
      ok: false,
      error: buildError("gemini env vars are missing", { missingEnv: ["GEMINI_API_KEY"] }),
    };
  }

  return {
    ok: true,
    env: { apiKey, model, embeddingModel },
  };
}
