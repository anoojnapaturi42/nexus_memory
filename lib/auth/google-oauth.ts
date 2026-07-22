import { google } from "googleapis";
import { randomBytes, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import type {
  GoogleOAuthCallbackSuccess,
  GoogleOAuthErrorCode,
  GoogleIntegrationProvider,
  GoogleOAuthLoginSuccess,
  GoogleOAuthLogoutSuccess,
  GoogleOAuthProvider,
  GoogleOAuthScope,
} from "@/types/auth";
import type { ApiErrorResponse, ApiResponse } from "@/types/api";
import { memoryGoogleTokenVault, type StoredGoogleTokenRecord } from "@/lib/auth/google-token-vault";

type GoogleOAuthEnv = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  appUrl: string;
};

type GoogleOAuthEnvResult =
  | { ok: true; env: GoogleOAuthEnv }
  | { ok: false; error: ApiErrorResponse };

export const GOOGLE_OAUTH_PROVIDER: GoogleOAuthProvider = "google";
export const GOOGLE_OAUTH_COOKIE_NAMES = {
  session: "gnm_google_session",
  state: "gnm_google_oauth_state",
} as const;

export const GOOGLE_OAUTH_SCOPES: GoogleOAuthScope[] = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/drive.metadata.readonly",
  "https://www.googleapis.com/auth/documents.readonly",
];

function getAppUrl(request: NextRequest) {
  return process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin ?? "http://localhost:3000";
}

export function getGoogleOAuthEnv(request: NextRequest): GoogleOAuthEnvResult {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri = process.env.GOOGLE_REDIRECT_URI?.trim() ?? new URL("/api/auth/google/callback", getAppUrl(request)).toString();
  const appUrl = getAppUrl(request);

  const missingEnv = [
    clientId ? null : "GOOGLE_CLIENT_ID",
    clientSecret ? null : "GOOGLE_CLIENT_SECRET",
  ].filter(Boolean) as string[];

  if (missingEnv.length > 0) {
    return {
      ok: false,
      error: {
        status: "error",
        message: "google oauth is not configured",
        code: "MISSING_ENV",
        details: { missingEnv },
      },
    };
  }

  return {
    ok: true,
    env: {
      clientId: clientId as string,
      clientSecret: clientSecret as string,
      redirectUri,
      appUrl,
    },
  };
}

export function createGoogleOAuthClient(env: GoogleOAuthEnv) {
  return new google.auth.OAuth2(env.clientId, env.clientSecret, env.redirectUri);
}

export function createGoogleOAuthState() {
  return randomBytes(24).toString("hex");
}

export function createGoogleOAuthSessionId() {
  return randomBytes(32).toString("hex");
}

export function createGoogleAuthorizationUrl(options: {
  env: GoogleOAuthEnv;
  state: string;
}) {
  const client = createGoogleOAuthClient(options.env);
  const authorizationUrl = client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: true,
    scope: GOOGLE_OAUTH_SCOPES,
    state: options.state,
  });

  return authorizationUrl;
}

export function isValidOAuthState(expected: string | undefined, actual: string | null) {
  if (!expected || !actual) return false;
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  if (expectedBuffer.length !== actualBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, actualBuffer);
}

export function buildOAuthErrorResponse({
  message,
  code,
  details,
}: {
  message: string;
  code: GoogleOAuthErrorCode;
  details?: Record<string, unknown>;
}): ApiErrorResponse {
  return {
    status: "error",
    message,
    code,
    details,
  };
}

export function buildOAuthSuccessResponse<T>(data: T, message?: string): ApiResponse<T> {
  return {
    status: "success",
    data,
    message,
  };
}

export function getSecureCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };
}

export function getStateCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/api/auth/google",
    maxAge: 10 * 60,
  };
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  };
}

export function persistGoogleToken(sessionId: string, tokens: {
  access_token?: string | null;
  refresh_token?: string | null;
  token_type?: string | null;
  expiry_date?: number | null;
  scope?: string | null;
}) {
  const scopes = (tokens.scope ?? "")
    .split(" ")
    .map((scope) => scope.trim())
    .filter(Boolean) as GoogleOAuthScope[];

  const record: StoredGoogleTokenRecord = {
    provider: GOOGLE_OAUTH_PROVIDER,
    accessToken: tokens.access_token ?? null,
    refreshToken: tokens.refresh_token ?? null,
    tokenType: tokens.token_type ?? null,
    expiryDate: tokens.expiry_date ?? null,
    scopes,
    connectedAt: new Date().toISOString(),
  };

  memoryGoogleTokenVault.save(sessionId, record);

  return record;
}

export function getGoogleTokenSession(sessionId: string) {
  return memoryGoogleTokenVault.get(sessionId);
}

export function clearGoogleTokenSession(sessionId: string) {
  memoryGoogleTokenVault.delete(sessionId);
}

export function buildGoogleLoginPayload(env: GoogleOAuthEnv, state: string): GoogleOAuthLoginSuccess {
  return {
    provider: GOOGLE_OAUTH_PROVIDER,
    authorizationUrl: createGoogleAuthorizationUrl({ env, state }),
    scopes: GOOGLE_OAUTH_SCOPES,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  };
}

export function buildGoogleCallbackPayload(
  record: StoredGoogleTokenRecord,
  options?: {
    userId?: string;
    accountEmail?: string;
    connectedProviders?: GoogleIntegrationProvider[];
  },
): GoogleOAuthCallbackSuccess {
  return {
    provider: GOOGLE_OAUTH_PROVIDER,
    connected: true,
    userId: options?.userId ?? "google-account",
    accountEmail: options?.accountEmail ?? "google-account@example.com",
    connectedProviders: options?.connectedProviders ?? (["gmail", "calendar", "drive", "docs"] as GoogleIntegrationProvider[]),
    connectedAt: record.connectedAt,
    scopes: record.scopes,
    sessionActive: true,
  };
}

export function buildGoogleLogoutPayload(): GoogleOAuthLogoutSuccess {
  return {
    provider: GOOGLE_OAUTH_PROVIDER,
    signedOut: true,
  };
}
