export type IntegrationProvider = "gmail" | "calendar" | "drive" | "docs" | "meet";

export type IntegrationStatus = "connected" | "connecting" | "disconnected" | "syncing" | "error";

export type IntegrationPermission = {
  key: string;
  label: string;
  granted: boolean;
};

export type IntegrationSyncEvent = {
  id: string;
  label: string;
  timestamp: string;
  state: "queued" | "running" | "complete" | "warning";
};

export type IntegrationConnection = {
  provider: IntegrationProvider;
  label: string;
  description: string;
  optional?: boolean;
  status: IntegrationStatus;
  lastSyncedAt: string | null;
  permissions: IntegrationPermission[];
  syncEvents: IntegrationSyncEvent[];
  activityScore: number;
  oauthProgress: number;
  isBusy: boolean;
};

export type IntegrationSeed = Omit<
  IntegrationConnection,
  "status" | "lastSyncedAt" | "syncEvents" | "activityScore" | "oauthProgress" | "isBusy"
> & {
  status?: IntegrationStatus;
  lastSyncedAt?: string | null;
  syncEvents?: IntegrationSyncEvent[];
  activityScore?: number;
  oauthProgress?: number;
  isBusy?: boolean;
};
