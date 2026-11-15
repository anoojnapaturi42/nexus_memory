import type { ApiErrorResponse } from "@/types/api";

export type OllamaEnvConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

export type OllamaEnvResult =
  | { ok: true; env: OllamaEnvConfig }
  | { ok: false; error: ApiErrorResponse };

export function getOllamaEnv(): OllamaEnvResult {
  const apiKey = process.env.OLLAMA_API_KEY?.trim() ?? "";
  if (!apiKey) {
    return {
      ok: false,
      error: {
        status: "error",
        code: "MISSING_ENV",
        message: "ollama env vars are missing",
        details: { missingEnv: ["OLLAMA_API_KEY"] },
      },
    };
  }

  return {
    ok: true,
    env: {
      apiKey,
      baseUrl: (process.env.OLLAMA_BASE_URL?.trim() || "https://api.ollama.com").replace(/\/$/, ""),
      model: process.env.OLLAMA_MODEL?.trim() || "gpt-oss:20b-cloud",
    },
  };
}
