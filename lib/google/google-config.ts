import type { NextRequest } from "next/server";
import { getGoogleTokenSession } from "@/lib/auth/google-oauth";

export type GoogleWorkspaceClientConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  hasOAuthSession: boolean;
};

export type GoogleWorkspaceConfigResult =
  | { ok: true; config: GoogleWorkspaceClientConfig; sessionId: string | null }
  | { ok: false; reason: "missing_env" | "missing_session" };

export function getGoogleWorkspaceClientConfig(request?: NextRequest): GoogleWorkspaceConfigResult {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI?.trim() ?? "http://localhost:3000/api/auth/google/callback";

  if (!clientId || !clientSecret) {
    return { ok: false, reason: "missing_env" };
  }

  const sessionId = request?.cookies.get("gnm_google_session")?.value ?? null;
  if (!sessionId) {
    return {
      ok: false,
      reason: "missing_session",
    };
  }

  const hasOAuthSession = Boolean(getGoogleTokenSession(sessionId));
  if (!hasOAuthSession) {
    return { ok: false, reason: "missing_session" };
  }

  return {
    ok: true,
    sessionId,
    config: {
      clientId,
      clientSecret,
      redirectUri,
      hasOAuthSession,
    },
  };
}
