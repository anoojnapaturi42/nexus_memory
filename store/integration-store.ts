import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { mockIntegrationSeeds } from "@/mock/integrations";
import type { IntegrationConnection, IntegrationProvider, IntegrationSyncEvent, IntegrationStatus } from "@/types/integration";

type IntegrationState = {
  integrations: IntegrationConnection[];
  activeProvider: IntegrationProvider | null;
  connectIntegration: (provider: IntegrationProvider) => Promise<void>;
  disconnectIntegration: (provider: IntegrationProvider) => Promise<void>;
  refreshIntegration: (provider: IntegrationProvider) => Promise<void>;
  resetIntegrations: () => void;
};

function cloneSeed(seed: IntegrationConnection): IntegrationConnection {
  return {
    ...seed,
    permissions: seed.permissions.map((permission) => ({ ...permission })),
    syncEvents: seed.syncEvents.map((event) => ({ ...event })),
  };
}

function createSyncEvent(label: string, state: IntegrationSyncEvent["state"]): IntegrationSyncEvent {
  return {
    id: `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    label,
    timestamp: new Date().toISOString(),
    state,
  };
}

function updateIntegration(
  integrations: IntegrationConnection[],
  provider: IntegrationProvider,
  updater: (integration: IntegrationConnection) => IntegrationConnection,
) {
  return integrations.map((integration) => (integration.provider === provider ? updater(integration) : integration));
}

async function simulateOauthFlow(
  provider: IntegrationProvider,
  set: (updater: (state: IntegrationState) => Partial<IntegrationState>) => void,
  get: () => IntegrationState,
) {
  const stages = [
    { progress: 20, label: "authorizing workspace access", state: "queued" as const },
    { progress: 52, label: "verifying permissions", state: "running" as const },
    { progress: 78, label: "syncing live connection", state: "running" as const },
    { progress: 100, label: "connection established", state: "complete" as const },
  ];

  for (const stage of stages) {
    set((state) => ({
      integrations: updateIntegration(state.integrations, provider, (integration) => ({
        ...integration,
        status: stage.progress < 100 ? "connecting" : "connected",
        oauthProgress: stage.progress,
        isBusy: stage.progress < 100,
        lastSyncedAt: stage.progress < 100 ? integration.lastSyncedAt : new Date().toISOString(),
        syncEvents: [
          createSyncEvent(`${integration.label} - ${stage.label}`, stage.state),
          ...integration.syncEvents,
        ].slice(0, 5),
      })),
      activeProvider: provider,
    }));

    // small delay to make the mock oauth experience feel animated
    await new Promise((resolve) => window.setTimeout(resolve, stage.progress === 100 ? 350 : 650));
  }

  set((state) => ({
    integrations: updateIntegration(state.integrations, provider, (integration) => ({
      ...integration,
      status: "connected",
      oauthProgress: 100,
      isBusy: false,
      lastSyncedAt: new Date().toISOString(),
      syncEvents: [
        createSyncEvent(`${integration.label} - sync complete`, "complete"),
        ...integration.syncEvents,
      ].slice(0, 5),
    })),
    activeProvider: get().activeProvider === provider ? null : get().activeProvider,
  }));
}

export const useIntegrationStore = create<IntegrationState>()(
  persist(
    (set, get) => ({
      integrations: mockIntegrationSeeds.map((seed) =>
        cloneSeed({
          provider: seed.provider,
          label: seed.label,
          description: seed.description,
          optional: seed.optional,
          status: seed.status ?? "disconnected",
          lastSyncedAt: seed.lastSyncedAt ?? null,
          permissions: seed.permissions,
          syncEvents: seed.syncEvents ?? [],
          activityScore: seed.activityScore ?? 0.5,
          oauthProgress: seed.oauthProgress ?? 0,
          isBusy: seed.isBusy ?? false,
        }),
      ),
      activeProvider: null,
      connectIntegration: async (provider) => {
        const current = get().integrations.find((integration) => integration.provider === provider);
        if (!current || current.isBusy) return;
        if (current.status === "connected") return;
        void simulateOauthFlow(provider, set, get);
      },
      disconnectIntegration: async (provider) => {
        set((state) => ({
          integrations: updateIntegration(state.integrations, provider, (integration) => ({
            ...integration,
            status: "disconnected",
            oauthProgress: 0,
            isBusy: true,
            syncEvents: [
              createSyncEvent(`${integration.label} - disconnected`, "warning"),
              ...integration.syncEvents,
            ].slice(0, 5),
          })),
          activeProvider: provider,
        }));

        await new Promise((resolve) => window.setTimeout(resolve, 700));

        set((state) => ({
          integrations: updateIntegration(state.integrations, provider, (integration) => ({
            ...integration,
            status: "disconnected",
            isBusy: false,
            lastSyncedAt: integration.lastSyncedAt,
          })),
          activeProvider: get().activeProvider === provider ? null : get().activeProvider,
        }));
      },
      refreshIntegration: async (provider) => {
        const current = get().integrations.find((integration) => integration.provider === provider);
        if (!current || current.isBusy || current.status === "disconnected") return;

        set((state) => ({
          integrations: updateIntegration(state.integrations, provider, (integration) => ({
            ...integration,
            status: "syncing",
            oauthProgress: 68,
            isBusy: true,
            syncEvents: [
              createSyncEvent(`${integration.label} - syncing now`, "running"),
              ...integration.syncEvents,
            ].slice(0, 5),
          })),
          activeProvider: provider,
        }));

        await new Promise((resolve) => window.setTimeout(resolve, 900));

        set((state) => ({
          integrations: updateIntegration(state.integrations, provider, (integration) => ({
            ...integration,
            status: "connected",
            oauthProgress: 100,
            isBusy: false,
            lastSyncedAt: new Date().toISOString(),
            activityScore: Math.min(1, integration.activityScore + 0.03),
            syncEvents: [
              createSyncEvent(`${integration.label} - sync complete`, "complete"),
              ...integration.syncEvents,
            ].slice(0, 5),
          })),
          activeProvider: get().activeProvider === provider ? null : get().activeProvider,
        }));
      },
      resetIntegrations: () =>
        set({
          integrations: mockIntegrationSeeds.map((seed) =>
            cloneSeed({
              provider: seed.provider,
              label: seed.label,
              description: seed.description,
              optional: seed.optional,
              status: seed.status ?? "disconnected",
              lastSyncedAt: seed.lastSyncedAt ?? null,
              permissions: seed.permissions,
              syncEvents: seed.syncEvents ?? [],
              activityScore: seed.activityScore ?? 0.5,
              oauthProgress: seed.oauthProgress ?? 0,
              isBusy: seed.isBusy ?? false,
            }),
          ),
          activeProvider: null,
        }),
    }),
    {
      name: "google-nexus-memory-integrations",
      storage: createJSONStorage(() => (typeof window !== "undefined" ? localStorage : undefined)),
      partialize: (state) => ({
        integrations: state.integrations,
        activeProvider: state.activeProvider,
      }),
    },
  ),
);
