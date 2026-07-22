import { google } from "googleapis";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getGoogleAuthConfig } from "@/lib/google/env";
import { integrationRepository, type IntegrationRepository } from "@/repositories/integration.repository";
import { getDatabaseRuntime } from "@/lib/database/client";
import type { DatabaseIntegrationRecord } from "@/types/database";
import type {
  GoogleIntegrationPermission,
  GoogleIntegrationProvider,
  GoogleIntegrationStatus,
  GoogleOAuthCallbackSuccess,
  GoogleOAuthErrorCode,
  GoogleOAuthLoginSuccess,
  GoogleOAuthLogoutSuccess,
  GoogleOAuthProvider,
  GoogleOAuthScope,
  GoogleOAuthStatusSuccess,
} from "@/types/auth";
import type { ApiErrorResponse, ApiResponse } from "@/types/api";

type GoogleAuthSessionPayload = {
  provider: GoogleOAuthProvider;
  userId: string;
  accountEmail: string;
  issuedAt: string;
  expiresAt: string;
};

type GoogleAuthState = {
  state: string;
  authorizationUrl: string;
  expiresAt: string;
};

type GoogleAuthIdentity = {
  userId: string;
  accountEmail: string;
};

type GoogleWorkspaceProviderDefinition = {
  provider: GoogleIntegrationProvider;
  label: string;
  description: string;
  permissionLabel: string;
  optional?: boolean;
};

const GOOGLE_PROVIDER: GoogleOAuthProvider = "google";
const GOOGLE_AUTH_STATE_COOKIE = "gnm_google_oauth_state";
const GOOGLE_AUTH_NEXT_COOKIE = "gnm_google_oauth_next";
const GOOGLE_AUTH_SESSION_COOKIE = "gnm_google_session";

const GOOGLE_WORKSPACE_PROVIDER_DEFINITIONS: GoogleWorkspaceProviderDefinition[] = [
  {
    provider: "gmail",
    label: "gmail",
    description: "readonly inbox access for surfaced email context",
    permissionLabel: "gmail readonly",
  },
  {
    provider: "calendar",
    label: "calendar",
    description: "readonly calendar access for event awareness",
    permissionLabel: "calendar readonly",
  },
  {
    provider: "drive",
    label: "drive",
    description: "readonly file metadata access for surfaced drive context",
    permissionLabel: "drive metadata readonly",
  },
  {
    provider: "docs",
    label: "docs",
    description: "readonly document access for surfaced doc metadata",
    permissionLabel: "docs readonly",
  },
  {
    provider: "meet",
    label: "google meet",
    description: "optional future scope for meeting intelligence",
    permissionLabel: "not requested yet",
    optional: true,
  },
];

const GOOGLE_WORKSPACE_SCOPES: GoogleOAuthScope[] = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/drive.metadata.readonly",
  "https://www.googleapis.com/auth/documents.readonly",
];

function buildError(
  code: GoogleOAuthErrorCode,
  message: string,
  details?: Record<string, unknown>,
): ApiErrorResponse {
  return {
    status: "error",
    message,
    code,
    details,
  };
}

function toBase64Url(input: string) {
  return Buffer.from(input).toString("base64url");
}

function fromBase64Url(input: string) {
  return Buffer.from(input, "base64url").toString("utf8");
}

function normalizePath(pathname: string | null | undefined) {
  if (!pathname) return "/connected-apps";
  if (!pathname.startsWith("/")) return "/connected-apps";
  return pathname;
}

function createOAuthClient() {
  const configResult = getGoogleAuthConfig();
  if (!configResult.ok) {
    throw new Error(configResult.error.message);
  }

  const { clientId, clientSecret, redirectUri } = configResult.env;
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

function getSessionSigningKey() {
  const configResult = getGoogleAuthConfig();
  if (!configResult.ok) {
    throw new Error(configResult.error.message);
  }

  return configResult.env.clientSecret;
}

function signPayload(payload: GoogleAuthSessionPayload) {
  const serialized = JSON.stringify(payload);
  const encoded = toBase64Url(serialized);
  const signature = createHmac("sha256", getSessionSigningKey()).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

function verifyPayload(rawValue: string | null | undefined) {
  if (!rawValue) return null;
  const [encoded, signature] = rawValue.split(".");
  if (!encoded || !signature) return null;

  const expectedSignature = createHmac("sha256", getSessionSigningKey()).update(encoded).digest();
  const actualSignature = Buffer.from(signature, "base64url");
  if (expectedSignature.length !== actualSignature.length) return null;
  if (!timingSafeEqual(expectedSignature, actualSignature)) return null;

  try {
    const payload = JSON.parse(fromBase64Url(encoded)) as GoogleAuthSessionPayload;
    if (payload.provider !== GOOGLE_PROVIDER) return null;
    if (Date.parse(payload.expiresAt) < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function toPermissions(provider: GoogleIntegrationProvider, connected: boolean): GoogleIntegrationPermission[] {
  const meta = GOOGLE_WORKSPACE_PROVIDER_DEFINITIONS.find((item) => item.provider === provider);
  if (!meta || provider === "meet") {
    return [];
  }

  return [
    {
      key: `${provider}.readonly`,
      label: meta.permissionLabel,
      granted: connected,
    },
  ];
}

function toIntegrationStatus(
  provider: GoogleIntegrationProvider,
  record: DatabaseIntegrationRecord | null,
): GoogleIntegrationStatus {
  const meta = GOOGLE_WORKSPACE_PROVIDER_DEFINITIONS.find((item) => item.provider === provider)!;
  const connected = Boolean(record);
  const lastSyncedAt = record?.updated_at ?? null;
  const eventTimestamp = lastSyncedAt ?? new Date().toISOString();

  return {
    provider,
    label: meta.label,
    description: meta.description,
    optional: meta.optional,
    status: connected ? "connected" : "disconnected",
    lastSyncedAt,
    permissions: toPermissions(provider, connected),
    syncEvents: connected
      ? [
          {
            id: `${provider}-${record?.id ?? "connection"}`,
            label: `${meta.label} oauth connected`,
            timestamp: eventTimestamp,
            state: "complete",
          },
        ]
      : [],
    activityScore: connected ? 1 : 0,
    oauthProgress: connected ? 100 : 0,
    isBusy: false,
  };
}

function createDisconnectedStatus(): GoogleOAuthStatusSuccess {
  const runtime = getDatabaseRuntime();
  const integrations = GOOGLE_WORKSPACE_PROVIDER_DEFINITIONS.map((definition) =>
    toIntegrationStatus(definition.provider, null),
  );

  return {
    provider: GOOGLE_PROVIDER,
    connected: false,
    userId: null,
    accountEmail: null,
    connectedAt: null,
    lastSyncedAt: null,
    databaseAvailable: runtime.available.postgres || runtime.available.supabase,
    integrations,
  };
}

export class GoogleAuthService {
  constructor(private readonly repository: IntegrationRepository = integrationRepository) {}

  get provider(): GoogleOAuthProvider {
    return GOOGLE_PROVIDER;
  }

  get scopes(): GoogleOAuthScope[] {
    return GOOGLE_WORKSPACE_SCOPES;
  }

  get stateCookieName() {
    return GOOGLE_AUTH_STATE_COOKIE;
  }

  get nextCookieName() {
    return GOOGLE_AUTH_NEXT_COOKIE;
  }

  get sessionCookieName() {
    return GOOGLE_AUTH_SESSION_COOKIE;
  }

  createOAuthState() {
    return randomBytes(24).toString("hex");
  }

  createLoginState(): GoogleAuthState {
    const state = this.createOAuthState();
    const oauthClient = createOAuthClient();
    const authorizationUrl = oauthClient.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: true,
      scope: GOOGLE_WORKSPACE_SCOPES,
      state,
    });

    return {
      state,
      authorizationUrl,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    };
  }

  buildLoginResponse(authorizationUrl: string): ApiResponse<GoogleOAuthLoginSuccess> {
    return {
      status: "success",
      data: {
        provider: GOOGLE_PROVIDER,
        authorizationUrl,
        scopes: GOOGLE_WORKSPACE_SCOPES,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      },
    };
  }

  buildLogoutResponse(): ApiResponse<GoogleOAuthLogoutSuccess> {
    return {
      status: "success",
      data: {
        provider: GOOGLE_PROVIDER,
        signedOut: true,
      },
    };
  }

  buildCallbackResponse(payload: GoogleOAuthCallbackSuccess): ApiResponse<GoogleOAuthCallbackSuccess> {
    return {
      status: "success",
      data: payload,
      message: "google account connected",
    };
  }

  buildStatusResponse(payload: GoogleOAuthStatusSuccess): ApiResponse<GoogleOAuthStatusSuccess> {
    return {
      status: "success",
      data: payload,
    };
  }

  buildError(code: GoogleOAuthErrorCode, message: string, details?: Record<string, unknown>) {
    return buildError(code, message, details);
  }

  signSession(payload: GoogleAuthSessionPayload) {
    return signPayload(payload);
  }

  verifySession(value: string | null | undefined) {
    return verifyPayload(value);
  }

  isValidOAuthState(expected: string | undefined, actual: string | null) {
    if (!expected || !actual) return false;
    const expectedBuffer = Buffer.from(expected);
    const actualBuffer = Buffer.from(actual);
    if (expectedBuffer.length !== actualBuffer.length) return false;
    return timingSafeEqual(expectedBuffer, actualBuffer);
  }

  async exchangeCodeForTokens(code: string) {
    const oauthClient = createOAuthClient();
    const { tokens } = await oauthClient.getToken(code);
    const accessToken = tokens.access_token ?? null;
    const refreshToken = tokens.refresh_token ?? null;
    const expiryDate = tokens.expiry_date ?? null;

    if (!accessToken) {
      throw new Error("missing access token");
    }

    const tokenInfo = await oauthClient.getTokenInfo(accessToken);
    const infoScopes = Array.isArray((tokenInfo as { scopes?: string[] }).scopes)
      ? ((tokenInfo as { scopes?: string[] }).scopes as string[])
      : typeof (tokenInfo as { scope?: string }).scope === "string"
        ? ((tokenInfo as { scope?: string }).scope as string).split(" ")
        : [];

    const missingScopes = GOOGLE_WORKSPACE_SCOPES.filter((scope) => !infoScopes.includes(scope));
    if (missingScopes.length > 0) {
      throw new Error(`missing required scopes: ${missingScopes.join(", ")}`);
    }

    return {
      accessToken,
      refreshToken,
      expiryDate,
      infoScopes,
      tokenInfo,
    };
  }

  async refreshAccessToken(refreshToken: string) {
    const oauthClient = createOAuthClient();
    oauthClient.setCredentials({ refresh_token: refreshToken });
    const { credentials } = await oauthClient.refreshAccessToken();
    const accessToken = credentials.access_token ?? null;
    if (!accessToken) {
      throw new Error("missing refreshed access token");
    }

    return {
      accessToken,
      refreshToken: credentials.refresh_token ?? refreshToken,
      expiryDate: credentials.expiry_date ?? null,
    };
  }

  async validateAccessToken(accessToken: string) {
    const oauthClient = createOAuthClient();
    const tokenInfo = await oauthClient.getTokenInfo(accessToken);
    const infoScopes = Array.isArray((tokenInfo as { scopes?: string[] }).scopes)
      ? ((tokenInfo as { scopes?: string[] }).scopes as string[])
      : typeof (tokenInfo as { scope?: string }).scope === "string"
        ? ((tokenInfo as { scope?: string }).scope as string).split(" ")
        : [];

    const missingScopes = GOOGLE_WORKSPACE_SCOPES.filter((scope) => !infoScopes.includes(scope));
    if (missingScopes.length > 0) {
      throw new Error(`missing required scopes: ${missingScopes.join(", ")}`);
    }

    return tokenInfo;
  }

  async fetchIdentity(accessToken: string): Promise<GoogleAuthIdentity> {
    const oauthClient = createOAuthClient();
    const tokenInfo = await oauthClient.getTokenInfo(accessToken);
    const maybeEmail = (tokenInfo as { email?: string }).email ?? null;
    const maybeUserId = (tokenInfo as { user_id?: string }).user_id ?? null;

    let accountEmail = maybeEmail;
    if (!accountEmail) {
      try {
        const userinfo = google.oauth2({ version: "v2", auth: oauthClient });
        const response = await userinfo.userinfo.get({ access_token: accessToken });
        accountEmail = response.data.email ?? null;
      } catch {
        accountEmail = null;
      }
    }

    const userId = accountEmail ?? maybeUserId;

    if (!userId) {
      throw new Error("unable to resolve google account identity");
    }

    return {
      userId,
      accountEmail: accountEmail ?? userId,
    };
  }

  async persistAuthorizedAccount(input: {
    userId: string;
    accessToken: string;
    refreshToken: string;
    expiresAt: string;
  }) {
    const results = await this.repository.upsertMany(
      GOOGLE_WORKSPACE_PROVIDER_DEFINITIONS.filter((definition) => definition.provider !== "meet").map((definition) => ({
        userId: input.userId,
        provider: definition.provider,
        accessToken: input.accessToken,
        refreshToken: input.refreshToken,
        expiresAt: input.expiresAt,
      })),
    );

    return results.map((result) => result.item);
  }

  async revokeAuthorizedAccount(userId: string) {
    return this.repository.deleteByUserId(userId);
  }

  async getStatusFromSession(sessionValue: string | null | undefined): Promise<GoogleOAuthStatusSuccess> {
    const runtime = getDatabaseRuntime();
    const session = this.verifySession(sessionValue);
    if (!session) {
      return createDisconnectedStatus();
    }

    const records = await this.repository.listByUserId(session.userId);
    const connectedRecords = records.items.filter((record) => record.provider !== "meet");

    const maybeExpired = connectedRecords.find((record) => Date.parse(record.expires_at) <= Date.now());
    if (maybeExpired) {
      const refreshed = await this.refreshAccessToken(maybeExpired.refresh_token);
      await this.persistAuthorizedAccount({
        userId: session.userId,
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken,
        expiresAt: refreshed.expiryDate ? new Date(refreshed.expiryDate).toISOString() : new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      });
    }

    const refreshedRecords = maybeExpired ? (await this.repository.listByUserId(session.userId)).items : records.items;
    const refreshedMap = new Map(refreshedRecords.map((record) => [record.provider, record] as const));

    const integrations = GOOGLE_WORKSPACE_PROVIDER_DEFINITIONS.map((definition) =>
      toIntegrationStatus(definition.provider, refreshedMap.get(definition.provider) ?? null),
    );

    const lastSyncedAt = refreshedRecords.length > 0
      ? refreshedRecords
          .map((record) => record.updated_at)
          .sort((left, right) => Date.parse(right) - Date.parse(left))[0] ?? null
      : null;

    return {
      provider: GOOGLE_PROVIDER,
      connected: refreshedRecords.length > 0,
      userId: session.userId,
      accountEmail: session.accountEmail,
      connectedAt: session.issuedAt,
      lastSyncedAt,
      databaseAvailable: runtime.available.postgres || runtime.available.supabase,
      integrations,
    };
  }

  async getDisconnectedStatus() {
    return createDisconnectedStatus();
  }

  createSessionCookieValue(payload: Omit<GoogleAuthSessionPayload, "provider">) {
    return this.signSession({
      provider: GOOGLE_PROVIDER,
      ...payload,
    });
  }

  parseSessionCookieValue(value: string | null | undefined) {
    return this.verifySession(value);
  }

  buildCallbackPayload(input: {
    userId: string;
    accountEmail: string;
    connectedProviders?: GoogleIntegrationProvider[];
    connectedAt: string;
  }): GoogleOAuthCallbackSuccess {
    return {
      provider: GOOGLE_PROVIDER,
      connected: true,
      userId: input.userId,
      accountEmail: input.accountEmail,
      connectedProviders: input.connectedProviders ?? GOOGLE_WORKSPACE_PROVIDER_DEFINITIONS.filter((definition) => definition.provider !== "meet").map((definition) => definition.provider),
      connectedAt: input.connectedAt,
      scopes: GOOGLE_WORKSPACE_SCOPES,
      sessionActive: true,
    };
  }

  buildRedirectTarget(rawTarget: string | null | undefined) {
    return normalizePath(rawTarget);
  }
}

export const googleAuthService = new GoogleAuthService();
