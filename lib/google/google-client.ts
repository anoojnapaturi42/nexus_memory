import { google } from "googleapis";
import type { NextRequest } from "next/server";
import { getDatabaseRuntime } from "@/lib/database/client";
import { getGoogleAuthConfig } from "@/lib/google/env";
import { integrationRepository } from "@/repositories/integration.repository";
import { googleAuthService } from "@/services/google/auth.service";
import type { GoogleWorkspaceClientConfig } from "@/lib/google/google-config";
import type { GoogleWorkspaceServiceName } from "@/types/google-workspace";

export type GoogleWorkspaceAuthState =
  | {
      kind: "live";
      config: GoogleWorkspaceClientConfig;
      sessionId: string;
      oauthClient: InstanceType<typeof google.auth.OAuth2>;
    }
  | {
      kind: "mock";
      reason: "missing_env" | "missing_session" | "development_fallback";
    }
  | {
      kind: "unavailable";
      reason: "missing_env" | "missing_session" | "no_integration" | "refresh_failed" | "database_unavailable";
    };

type AuthorizedIntegrationRecord = Awaited<ReturnType<typeof integrationRepository.listByUserId>>["items"][number];

function isDevelopmentFallbackEnabled() {
  return process.env.NODE_ENV !== "production";
}

function createOAuthClient(config: GoogleWorkspaceClientConfig) {
  return new google.auth.OAuth2(config.clientId, config.clientSecret, config.redirectUri);
}

function selectIntegrationRecord(records: AuthorizedIntegrationRecord[]) {
  return records.find((record) => record.provider === "gmail") ?? records[0] ?? null;
}

async function buildLiveAuthState(request?: NextRequest): Promise<GoogleWorkspaceAuthState> {
  const envResult = getGoogleAuthConfig();
  if (!envResult.ok) {
    return isDevelopmentFallbackEnabled()
      ? { kind: "mock", reason: "missing_env" }
      : { kind: "unavailable", reason: "missing_env" };
  }

  const session = googleAuthService.parseSessionCookieValue(request?.cookies.get(googleAuthService.sessionCookieName)?.value ?? null);
  if (!session) {
    return isDevelopmentFallbackEnabled()
      ? { kind: "mock", reason: "missing_session" }
      : { kind: "unavailable", reason: "missing_session" };
  }

  if (!getDatabaseRuntime().available.postgres && !getDatabaseRuntime().available.supabase) {
    return isDevelopmentFallbackEnabled()
      ? { kind: "mock", reason: "development_fallback" }
      : { kind: "unavailable", reason: "database_unavailable" };
  }

  const records = await integrationRepository.listByUserId(session.userId);
  const selected = selectIntegrationRecord(records.items);
  if (!selected) {
    return isDevelopmentFallbackEnabled()
      ? { kind: "mock", reason: "missing_session" }
      : { kind: "unavailable", reason: "no_integration" };
  }

  const oauthClient = createOAuthClient(envResult.env);
  let accessToken = selected.access_token;
  let refreshToken = selected.refresh_token;
  let expiryDate = Date.parse(selected.expires_at);

  if (Number.isFinite(expiryDate) && expiryDate <= Date.now()) {
    try {
      const refreshed = await googleAuthService.refreshAccessToken(refreshToken);
      accessToken = refreshed.accessToken;
      refreshToken = refreshed.refreshToken;
      expiryDate = refreshed.expiryDate ? Date.parse(refreshed.expiryDate) : Date.now() + 60 * 60 * 1000;
      await googleAuthService.persistAuthorizedAccount({
        userId: session.userId,
        accessToken,
        refreshToken,
        expiresAt: new Date(expiryDate).toISOString(),
      });
    } catch {
      return isDevelopmentFallbackEnabled()
        ? { kind: "mock", reason: "development_fallback" }
        : { kind: "unavailable", reason: "refresh_failed" };
    }
  }

  oauthClient.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
    expiry_date: Number.isFinite(expiryDate) ? expiryDate : undefined,
  });

  return {
    kind: "live",
    config: envResult.env,
    sessionId: session.userId,
    oauthClient,
  };
}

export async function createGoogleWorkspaceClients(request?: NextRequest) {
  return buildLiveAuthState(request);
}

export function isRateLimitError(error: unknown) {
  const status = typeof error === "object" && error !== null ? Reflect.get(error, "code") : undefined;
  return status === 429 || status === 403;
}

export async function withGoogleRetry<T>(
  task: () => Promise<T>,
  options: { retries?: number; delayMs?: number } = {},
): Promise<T> {
  const retries = options.retries ?? 2;
  const delayMs = options.delayMs ?? 250;
  let attempt = 0;

  while (true) {
    try {
      return await task();
    } catch (error) {
      attempt += 1;
      const retryable = isRateLimitError(error) || (error instanceof Error && /timeout|unavailable|503/i.test(error.message));
      if (!retryable || attempt > retries) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
    }
  }
}

type QueueMap = Map<string, Promise<unknown>>;

declare global {
  // eslint-disable-next-line no-var
  var __googleWorkspaceRequestQueue: QueueMap | undefined;
}

const requestQueue = globalThis.__googleWorkspaceRequestQueue ?? new Map<string, Promise<unknown>>();
globalThis.__googleWorkspaceRequestQueue = requestQueue;

export async function serializeGoogleRequest<T>(key: GoogleWorkspaceServiceName, task: () => Promise<T>) {
  const previous = requestQueue.get(key) ?? Promise.resolve();
  let resolveCurrent!: () => void;
  const current = new Promise<void>((resolve) => {
    resolveCurrent = resolve;
  });

  requestQueue.set(key, previous.then(() => current));

  try {
    await previous;
    return await task();
  } finally {
    resolveCurrent();
    if (requestQueue.get(key) === current) {
      requestQueue.delete(key);
    }
  }
}
