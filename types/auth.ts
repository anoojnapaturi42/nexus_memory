export type GoogleOAuthProvider = "google";

export type GoogleOAuthScope =
  | "https://www.googleapis.com/auth/gmail.readonly"
  | "https://www.googleapis.com/auth/calendar.readonly"
  | "https://www.googleapis.com/auth/drive.metadata.readonly"
  | "https://www.googleapis.com/auth/documents.readonly";

export type GoogleOAuthErrorCode =
  | "MISSING_ENV"
  | "INVALID_ENV"
  | "INVALID_STATE"
  | "MISSING_CODE"
  | "OAUTH_ERROR"
  | "TOKEN_EXCHANGE_FAILED"
  | "TOKEN_REFRESH_FAILED"
  | "TOKEN_VALIDATION_FAILED"
  | "DATABASE_UNAVAILABLE"
  | "SESSION_NOT_FOUND";

export type GoogleIntegrationProvider = "gmail" | "calendar" | "drive" | "docs" | "meet";

export type GoogleIntegrationPermission = {
  key: string;
  label: string;
  granted: boolean;
};

export type GoogleIntegrationSyncEvent = {
  id: string;
  label: string;
  timestamp: string;
  state: "queued" | "running" | "complete" | "warning";
};

export type GoogleIntegrationStatus = {
  provider: GoogleIntegrationProvider;
  label: string;
  description: string;
  optional?: boolean;
  status: "connected" | "disconnected";
  lastSyncedAt: string | null;
  permissions: GoogleIntegrationPermission[];
  syncEvents: GoogleIntegrationSyncEvent[];
  activityScore: number;
  oauthProgress: number;
  isBusy: boolean;
};

export type GoogleOAuthStatusSuccess = {
  provider: GoogleOAuthProvider;
  connected: boolean;
  userId: string | null;
  accountEmail: string | null;
  connectedAt: string | null;
  lastSyncedAt: string | null;
  databaseAvailable: boolean;
  integrations: GoogleIntegrationStatus[];
};

export type GoogleOAuthLoginSuccess = {
  provider: GoogleOAuthProvider;
  authorizationUrl: string;
  scopes: GoogleOAuthScope[];
  expiresAt: string;
};

export type GoogleOAuthCallbackSuccess = {
  provider: GoogleOAuthProvider;
  connected: true;
  userId: string;
  accountEmail: string;
  connectedProviders: GoogleIntegrationProvider[];
  connectedAt: string;
  scopes: GoogleOAuthScope[];
  sessionActive: true;
};

export type GoogleOAuthLogoutSuccess = {
  provider: GoogleOAuthProvider;
  signedOut: true;
};
