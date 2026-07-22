"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Loader2, LogIn, LogOut, RefreshCw, ShieldCheck, Sparkles, Wifi } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useGoogleAuthStatus } from "@/hooks/use-google-auth-status";
import { IntegrationCard } from "@/components/integrations/integration-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { layoutContainer } from "@/lib/layout";
import { useNavigationStore } from "@/store/navigation-store";
import type { GoogleIntegrationStatus } from "@/types/auth";
import type { IntegrationConnection } from "@/types/integration";
import { cn } from "@/lib/utils";

function formatTimestamp(timestamp: string | null) {
  if (!timestamp) return "never";
  return new Date(timestamp).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function toIntegrationConnection(integration: GoogleIntegrationStatus): IntegrationConnection {
  return {
    provider: integration.provider,
    label: integration.label,
    description: integration.description,
    optional: integration.optional,
    status: integration.status,
    lastSyncedAt: integration.lastSyncedAt,
    permissions: integration.permissions,
    syncEvents: integration.syncEvents,
    activityScore: integration.activityScore,
    oauthProgress: integration.oauthProgress,
    isBusy: integration.isBusy,
  };
}

export function ConnectedAppsSettings() {
  const setActivePath = useNavigationStore((state) => state.setActivePath);
  const { data, isLoading, isFetching, refetch, error } = useGoogleAuthStatus();
  const [pendingAction, setPendingAction] = useState<"connect" | "disconnect" | "refresh" | null>(null);
  const [pendingProvider, setPendingProvider] = useState<string | null>(null);

  useEffect(() => {
    setActivePath("/connected-apps");
  }, [setActivePath]);

  const integrations = useMemo(
    () => data?.integrations.map(toIntegrationConnection) ?? [],
    [data?.integrations],
  );

  const connectedCount = useMemo(
    () => integrations.filter((integration) => integration.status === "connected").length,
    [integrations],
  );
  const disconnectedCount = integrations.length - connectedCount;
  const lastSyncedAt = data?.lastSyncedAt ?? null;
  const hasConnectedAccount = Boolean(data?.connected);

  const handleConnect = (provider: string) => {
    setPendingAction("connect");
    setPendingProvider(provider);
    window.location.assign(`/api/auth/google/login?next=/connected-apps`);
  };

  const handleDisconnect = (provider: string) => {
    setPendingAction("disconnect");
    setPendingProvider(provider);
    window.location.assign(`/api/auth/google/logout?next=/connected-apps`);
  };

  const handleRefresh = async (provider: string) => {
    setPendingAction("refresh");
    setPendingProvider(provider);
    await refetch();
    setPendingProvider(null);
    setPendingAction(null);
  };

  const loadingCards = (
    <div className="grid gap-4 xl:grid-cols-2">
      {Array.from({ length: 4 }).map((_, index) => (
        <Card key={index} className="border-border/70 bg-card/80 shadow-soft backdrop-blur">
          <CardHeader className="space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-56" />
              </div>
              <Skeleton className="h-11 w-11 rounded-2xl" />
            </div>
            <Skeleton className="h-6 w-24 rounded-full" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Skeleton className="h-24 rounded-2xl" />
              <Skeleton className="h-24 rounded-2xl" />
            </div>
            <Skeleton className="h-40 rounded-2xl" />
            <div className="flex gap-2">
              <Skeleton className="h-10 w-24 rounded-xl" />
              <Skeleton className="h-10 w-24 rounded-xl" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.12),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(168,85,247,0.09),_transparent_24%)]" />
      <div className="absolute inset-0 bg-grid-fade bg-[length:30px_30px] opacity-[0.05]" />

      <div className={layoutContainer("relative z-10 min-h-screen py-4 lg:py-6")}>
        <div className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="rounded-[1.75rem] border border-border/70 bg-card/80 p-6 shadow-soft backdrop-blur"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
                  connected apps
                </p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
                  enterprise integration settings
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                  connect your google account, monitor auth health, and keep workspace integrations in sync with a
                  production-ready session store.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="outline"
                  className="border-border/60 bg-background/60"
                  onClick={() => void refetch()}
                  disabled={isFetching}
                >
                  <RefreshCw className={cn("mr-2 h-4 w-4", isFetching && "animate-spin")} />
                  refresh status
                </Button>
                {!hasConnectedAccount ? (
                  <Button onClick={() => handleConnect("gmail")} disabled={pendingAction !== null}>
                    {pendingAction === "connect" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <LogIn className="mr-2 h-4 w-4" />
                    )}
                    connect google
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="border-border/60 bg-background/60"
                    onClick={() => handleDisconnect("gmail")}
                    disabled={pendingAction !== null}
                  >
                    {pendingAction === "disconnect" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <LogOut className="mr-2 h-4 w-4" />
                    )}
                    disconnect
                  </Button>
                )}
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">connected</p>
                <p className="mt-2 text-2xl font-semibold">{connectedCount}</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">disconnected</p>
                <p className="mt-2 text-2xl font-semibold">{disconnectedCount}</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">last synced</p>
                <p className="mt-2 text-sm font-semibold">{formatTimestamp(lastSyncedAt)}</p>
              </div>
            </div>
          </motion.div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <section>
              {isLoading ? (
                loadingCards
              ) : error ? (
                <Card className="border-rose-500/30 bg-rose-500/5">
                  <CardContent className="flex items-start gap-3 p-6">
                    <AlertTriangle className="mt-0.5 h-5 w-5 text-rose-400" />
                    <div>
                      <p className="font-medium">unable to load google auth state</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        the status endpoint is currently unavailable. check your google oauth and database environment
                        variables, then try again.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 xl:grid-cols-2">
                  <AnimatePresence mode="popLayout">
                    {integrations.map((integration) => (
                      <IntegrationCard
                        key={integration.provider}
                        integration={integration}
                        onConnect={(provider) => handleConnect(provider)}
                        onDisconnect={(provider) => handleDisconnect(provider)}
                        onRefresh={(provider) => void handleRefresh(provider)}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </section>

            <aside className="space-y-4 xl:sticky xl:top-6 xl:h-fit">
              <Card className="border-border/70 bg-card/80 shadow-soft backdrop-blur">
                <CardHeader className="space-y-2">
                  <CardTitle className="text-base">auth flow</CardTitle>
                  <CardDescription>real oauth state is sourced from next server routes and supabase.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start gap-3 rounded-2xl border border-border/60 bg-background/60 p-4">
                    <ShieldCheck className="mt-0.5 h-4 w-4 text-emerald-400" />
                    <div>
                      <p className="text-sm font-medium">secure session cookie</p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        the browser only receives an http-only session cookie. refresh tokens stay server-side in
                        supabase.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-2xl border border-border/60 bg-background/60 p-4">
                    <Wifi className="mt-0.5 h-4 w-4 text-sky-400" />
                    <div>
                      <p className="text-sm font-medium">live connection summary</p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        connected, disconnected, and last synced values are pulled from the production-style auth
                        status endpoint.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-2xl border border-border/60 bg-background/60 p-4">
                    <Sparkles className="mt-0.5 h-4 w-4 text-violet-400" />
                    <div>
                      <p className="text-sm font-medium">loading states</p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        the page shows skeletons while auth state loads and a graceful error panel if the backend is
                        unavailable.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              {pendingProvider ? (
                <Card className="border-border/70 bg-card/80 shadow-soft backdrop-blur">
                  <CardContent className="flex items-center gap-3 p-4">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      updating <span className="font-medium text-foreground">{pendingProvider}</span>
                      {pendingAction ? ` ${pendingAction}...` : "..."}
                    </p>
                  </CardContent>
                </Card>
              ) : null}
            </aside>
          </div>
        </div>
      </div>
    </main>
  );
}
