import type { ApiErrorResponse } from "@/types/api";
import type { GoogleOAuthErrorCode } from "@/types/auth";

export type GoogleAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

export type GoogleAuthEnvResult =
  | { ok: true; env: GoogleAuthConfig }
  | { ok: false; error: ApiErrorResponse };

function buildError(code: GoogleOAuthErrorCode, message: string, details?: Record<string, unknown>): ApiErrorResponse {
  return {
    status: "error",
    message,
    code,
    details,
  };
}

export function getGoogleAuthConfig(): GoogleAuthEnvResult {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim() ?? null;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() ?? null;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI?.trim() ?? null;

  const missing = [
    clientId ? null : "GOOGLE_CLIENT_ID",
    clientSecret ? null : "GOOGLE_CLIENT_SECRET",
    redirectUri ? null : "GOOGLE_REDIRECT_URI",
  ].filter(Boolean) as string[];

  if (missing.length > 0) {
    return {
      ok: false,
      error: buildError("MISSING_ENV", "google oauth env vars are missing", { missingEnv: missing }),
    };
  }

  try {
    new URL(redirectUri as string);
  } catch {
    return {
      ok: false,
      error: buildError("INVALID_ENV", "google oauth redirect uri is invalid", { redirectUri }),
    };
  }

  return {
    ok: true,
    env: {
      clientId: clientId as string,
      clientSecret: clientSecret as string,
      redirectUri: redirectUri as string,
    },
  };
}
