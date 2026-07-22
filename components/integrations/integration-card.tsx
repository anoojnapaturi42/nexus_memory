"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Clock3, Loader2, RefreshCw, Shield, ShieldAlert, PlugZap, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { IntegrationConnection, IntegrationStatus } from "@/types/integration";

const statusMeta: Record<
  IntegrationStatus,
  { label: string; tone: string; icon: typeof CheckCircle2; pulse: string }
> = {
  connected: {
    label: "connected",
    tone: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    icon: CheckCircle2,
    pulse: "bg-emerald-400",
  },
  connecting: {
    label: "connecting",
    tone: "border-sky-500/30 bg-sky-500/10 text-sky-300",
    icon: Loader2,
    pulse: "bg-sky-400",
  },
  syncing: {
    label: "syncing",
    tone: "border-violet-500/30 bg-violet-500/10 text-violet-300",
    icon: RefreshCw,
    pulse: "bg-violet-400",
  },
  disconnected: {
    label: "disconnected",
    tone: "border-border/60 bg-background/60 text-muted-foreground",
    icon: Unplug,
    pulse: "bg-muted-foreground",
  },
  error: {
    label: "needs attention",
    tone: "border-rose-500/30 bg-rose-500/10 text-rose-300",
    icon: ShieldAlert,
    pulse: "bg-rose-400",
  },
};

function formatTimestamp(timestamp: string | null) {
  if (!timestamp) return "never";
  return new Date(timestamp).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function IntegrationCard({
  integration,
  onConnect,
  onDisconnect,
  onRefresh,
}: {
  integration: IntegrationConnection;
  onConnect: (provider: IntegrationConnection["provider"]) => void;
  onDisconnect: (provider: IntegrationConnection["provider"]) => void;
  onRefresh: (provider: IntegrationConnection["provider"]) => void;
}) {
  const meta = statusMeta[integration.status];
  const StatusIcon = meta.icon;
  const activePermissions = integration.permissions.filter((permission) => permission.granted);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.24 }}
      className="h-full"
    >
      <Card className="group h-full overflow-hidden border-border/70 bg-card/85 shadow-soft backdrop-blur">
        <div className="h-1 w-full bg-gradient-to-r from-primary/70 via-cyan-500/70 to-indigo-500/70" />
        <CardHeader className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2 text-base capitalize">
                {integration.label}
                {integration.optional ? (
                  <span className="rounded-full border border-border/60 bg-background/60 px-2 py-0.5 text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                    optional
                  </span>
                ) : null}
              </CardTitle>
              <CardDescription className="mt-1">{integration.description}</CardDescription>
            </div>

            <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border", meta.tone)}>
              <StatusIcon className={cn("h-4 w-4", integration.status === "connecting" && "animate-spin")} />
            </div>
          </div>

          <div className={cn("inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium", meta.tone)}>
            <span className={cn("h-2 w-2 rounded-full", meta.pulse, integration.isBusy && "animate-pulse")} />
            {meta.label}
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">last synced</p>
              <p className="mt-2 flex items-center gap-2 text-sm font-medium">
                <Clock3 className="h-4 w-4 text-muted-foreground" />
                {formatTimestamp(integration.lastSyncedAt)}
              </p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">sync activity</p>
              <div className="mt-2 flex items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(8, integration.activityScore * 100)}%` }}
                    transition={{ duration: 0.5 }}
                    className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-sky-500 to-indigo-500"
                  />
                </div>
                <span className="text-sm font-medium text-muted-foreground">
                  {Math.round(integration.activityScore * 100)}%
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">permissions</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {activePermissions.length} granted of {integration.permissions.length}
                </p>
              </div>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </div>

            <div className="space-y-2">
              {integration.permissions.map((permission) => (
                <div
                  key={permission.key}
                  className="flex items-center justify-between rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-sm"
                >
                  <span className="leading-5 text-foreground">{permission.label}</span>
                  <span className={cn("text-xs font-medium", permission.granted ? "text-emerald-400" : "text-muted-foreground")}>
                    {permission.granted ? "allowed" : "blocked"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <Separator className="bg-border/60" />

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">recent activity</p>
              {integration.isBusy ? (
                <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  updating
                </span>
              ) : null}
            </div>

            <div className="space-y-2">
              <AnimatePresence mode="popLayout">
                {integration.syncEvents.slice(0, 3).map((event) => (
                  <motion.div
                    key={event.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="rounded-xl border border-border/60 bg-background/60 px-3 py-2"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-foreground">{event.label}</p>
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(event.timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          event.state === "complete"
                            ? "bg-emerald-400"
                            : event.state === "running"
                              ? "bg-sky-400"
                              : event.state === "queued"
                                ? "bg-amber-400"
                                : "bg-rose-400",
                        )}
                      />
                      <p className="text-xs text-muted-foreground capitalize">{event.state}</p>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {integration.status === "connected" || integration.status === "syncing" ? (
              <Button
                variant="outline"
                className="border-border/60 bg-background/60"
                onClick={() => onRefresh(integration.provider)}
                disabled={integration.isBusy}
              >
                <RefreshCw className={cn("mr-2 h-4 w-4", integration.status === "syncing" && "animate-spin")} />
                sync now
              </Button>
            ) : (
              <Button onClick={() => onConnect(integration.provider)} disabled={integration.isBusy}>
                <PlugZap className="mr-2 h-4 w-4" />
                connect
              </Button>
            )}

            {integration.status !== "disconnected" ? (
              <Button
                variant="outline"
                className="border-border/60 bg-background/60 text-muted-foreground hover:text-foreground"
                onClick={() => onDisconnect(integration.provider)}
                disabled={integration.isBusy}
              >
                <Unplug className="mr-2 h-4 w-4" />
                disconnect
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
