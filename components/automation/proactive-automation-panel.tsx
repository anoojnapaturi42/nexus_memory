"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  BellRing,
  CheckCircle2,
  Clock3,
  FolderKanban,
  Play,
  Pause,
  RefreshCw,
  Send,
  ShieldAlert,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { layoutContainer } from "@/lib/layout";
import { useProactiveAutomation } from "@/hooks/use-proactive-automation";
import { useProactiveStore } from "@/store/proactive-store";
import { formatProactiveExplanation, formatProactiveSummary } from "@/lib/proactive/explain";
import type { ProactiveNotification, ProactiveRecommendation } from "@/types/proactive";

function formatTimestamp(timestamp: string) {
  return new Date(timestamp).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function statusTone(status: ProactiveRecommendation["status"]) {
  if (status === "approved" || status === "executed") return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300";
  if (status === "pending-approval") return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
  if (status === "failed" || status === "dismissed") return "bg-rose-500/15 text-rose-700 dark:text-rose-300";
  return "bg-muted text-muted-foreground";
}

function severityTone(severity: ProactiveNotification["severity"]) {
  if (severity === "critical") return "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300";
  if (severity === "warning") return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  if (severity === "notice") return "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300";
  return "border-border/60 bg-muted/40 text-muted-foreground";
}

function RecommendationCard({
  recommendation,
  active,
  onSelect,
  onApprove,
  onReject,
}: {
  recommendation: ProactiveRecommendation;
  active: boolean;
  onSelect: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <motion.button
      type="button"
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.99 }}
      onClick={onSelect}
      className={cn(
        "w-full rounded-2xl border p-4 text-left transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "border-primary/40 bg-primary/5 shadow-sm"
          : "border-border/60 bg-background/60 hover:bg-accent/60",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{recommendation.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{recommendation.summary}</p>
        </div>
        <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium capitalize", statusTone(recommendation.status))}>
          {recommendation.status.replace(/-/g, " ")}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <span className="rounded-full bg-secondary px-2.5 py-1 capitalize text-secondary-foreground">
          {recommendation.triggerKind.replace(/-/g, " ")}
        </span>
        <span className="rounded-full border border-border/60 px-2.5 py-1">
          confidence {Math.round(recommendation.confidence * 100)}%
        </span>
        {recommendation.approvalRequired ? (
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-amber-700 dark:text-amber-300">
            approval needed
          </span>
        ) : (
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-emerald-700 dark:text-emerald-300">
            auto surfaced
          </span>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          size="sm"
          className="gap-2"
          onClick={(event) => {
            event.stopPropagation();
            onApprove();
          }}
          disabled={!recommendation.approvalRequired || recommendation.status !== "pending-approval"}
        >
          <CheckCircle2 className="h-4 w-4" />
          approve
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="gap-2"
          onClick={(event) => {
            event.stopPropagation();
            onReject();
          }}
        >
          <TriangleAlert className="h-4 w-4" />
          reject
        </Button>
      </div>
    </motion.button>
  );
}

function LogRow({ step, message, timestamp, severity }: { step: string; message: string; timestamp: string; severity: ProactiveNotification["severity"] | "debug" | "error" | "info" | "success" | "warning" }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/60 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium capitalize">{step.replace(/-/g, " ")}</p>
          <p className="mt-1 text-xs text-muted-foreground">{message}</p>
        </div>
        <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium capitalize text-secondary-foreground">
          {severity}
        </span>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">{formatTimestamp(timestamp)}</p>
    </div>
  );
}

function NotificationItem({ notification }: { notification: ProactiveNotification }) {
  return (
    <div className={cn("rounded-2xl border px-4 py-3", severityTone(notification.severity))}>
      <div className="flex items-start gap-3">
        <BellRing className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-medium">{notification.title}</p>
          <p className="mt-1 text-xs leading-5">{notification.message}</p>
          <p className="mt-2 text-[11px] opacity-80">{formatTimestamp(notification.createdAt)}</p>
        </div>
      </div>
    </div>
  );
}

function ApprovalSummary({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/60 px-4 py-3">
      <p className="text-xs text-muted-foreground">{title}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

export function ProactiveAutomationPanel() {
  const {
    snapshot,
    latestRun,
    approvals,
    notifications,
    logs,
    selectedRecommendation,
    selectedRecommendationId,
    setSelectedRecommendationId,
    autoRefreshEnabled,
    setAutoRefreshEnabled,
    runScan,
    startScheduler,
    stopScheduler,
    approveRecommendation,
    rejectRecommendation,
    isLoading,
    isError,
    error,
  } = useProactiveAutomation();

  const scheduler = snapshot.scheduler;
  const manualRunDisabled = runScan.isPending || startScheduler.isPending || stopScheduler.isPending;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.12),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(168,85,247,0.10),_transparent_24%)]" />
      <div className="absolute inset-0 bg-grid-fade bg-[length:30px_30px] opacity-[0.05]" />

      <div className={layoutContainer("relative z-10 py-6 lg:py-8")}>
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
              proactive automation
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              explainable background actions
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              every recommendation is backed by workspace signals, traced through logs, and gated by approval when the action can change your calendar or task flow.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              className="gap-2 border-border/60 bg-background/60"
              onClick={() => void runScan.mutateAsync()}
              disabled={manualRunDisabled}
            >
              <RefreshCw className={cn("h-4 w-4", runScan.isPending && "animate-spin")} />
              run scan
            </Button>
            {scheduler.enabled ? (
              <Button variant="outline" className="gap-2" onClick={() => void stopScheduler.mutateAsync()}>
                <Pause className="h-4 w-4" />
                stop scheduler
              </Button>
            ) : (
              <Button className="gap-2" onClick={() => void startScheduler.mutateAsync(15)}>
                <Play className="h-4 w-4" />
                start scheduler
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.2fr_minmax(0,0.8fr)]">
          <div className="space-y-4">
            <Card className="border-border/70 bg-card/80 shadow-soft backdrop-blur">
              <CardHeader className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-base">scheduler</CardTitle>
                    <CardDescription className="mt-1">
                      background analysis runs every {scheduler.intervalMinutes} minutes when enabled
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-3 py-1.5 text-xs">
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full",
                        scheduler.status === "running" ? "bg-emerald-500" : "bg-muted-foreground",
                      )}
                    />
                    {scheduler.status}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <ApprovalSummary title="last run" value={scheduler.lastRunAt ? formatTimestamp(scheduler.lastRunAt) : "not run yet"} />
                  <ApprovalSummary title="next run" value={scheduler.nextRunAt ? formatTimestamp(scheduler.nextRunAt) : "paused"} />
                  <ApprovalSummary title="pending approvals" value={String(approvals.length)} />
                  <ApprovalSummary title="auto refresh" value={autoRefreshEnabled ? "enabled" : "disabled"} />
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
                  >
                    {autoRefreshEnabled ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    {autoRefreshEnabled ? "pause ui refresh" : "resume ui refresh"}
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => void runScan.mutateAsync()}
                    disabled={runScan.isPending}
                  >
                    <Send className="h-4 w-4" />
                    force recommendation scan
                  </Button>
                </div>
              </CardHeader>
            </Card>

            <Card className="border-border/70 bg-card/80 shadow-soft backdrop-blur">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-base">recommendations</CardTitle>
                    <CardDescription className="mt-1">
                      surfaced workspace actions with explanations and approval state
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-3 py-1 text-xs text-muted-foreground">
                    <Sparkles className="h-4 w-4" />
                    {snapshot.recommendations.length} items
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {isLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-24 rounded-2xl" />
                    <Skeleton className="h-24 rounded-2xl" />
                    <Skeleton className="h-24 rounded-2xl" />
                  </div>
                ) : isError ? (
                  <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
                    <p className="font-medium">the automation engine could not hydrate.</p>
                    <p className="mt-1 text-xs text-muted-foreground">{error?.message ?? "unknown error"}</p>
                  </div>
                ) : snapshot.recommendations.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border/60 bg-background/40 p-5 text-sm text-muted-foreground">
                    no proactive recommendations yet. run a scan to analyze the latest workspace signals.
                  </div>
                ) : (
                  <div className="space-y-3">
                    <AnimatePresence initial={false}>
                      {snapshot.recommendations.map((recommendation) => (
                        <motion.div
                          key={recommendation.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.2 }}
                        >
                          <RecommendationCard
                            recommendation={recommendation}
                            active={selectedRecommendationId === recommendation.id}
                            onSelect={() => setSelectedRecommendationId(recommendation.id)}
                            onApprove={() => void approveRecommendation.mutateAsync(recommendation.id)}
                            onReject={() => void rejectRecommendation.mutateAsync(recommendation.id)}
                          />
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/80 shadow-soft backdrop-blur">
              <CardHeader>
                <CardTitle className="text-base">explanation trace</CardTitle>
                <CardDescription className="mt-1">
                  selected recommendation rationale and source evidence
                </CardDescription>
              </CardHeader>
              <CardContent>
                {selectedRecommendation ? (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-medium capitalize", statusTone(selectedRecommendation.status))}>
                          {selectedRecommendation.status.replace(/-/g, " ")}
                        </span>
                        <span className="rounded-full border border-border/60 px-2.5 py-1 text-[11px] text-muted-foreground">
                          trace {selectedRecommendation.traceId.slice(0, 16)}
                        </span>
                      </div>
                      <p className="mt-3 text-sm font-medium">{formatProactiveSummary(selectedRecommendation)}</p>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        {formatProactiveExplanation(selectedRecommendation)}
                      </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                        <p className="text-xs text-muted-foreground">source signals</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {selectedRecommendation.sourceSignals.map((signal) => (
                            <span
                              key={signal.id}
                              className="rounded-full bg-secondary px-2.5 py-1 text-[11px] text-secondary-foreground"
                            >
                              {signal.label}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                        <p className="text-xs text-muted-foreground">proposed action</p>
                        <pre className="mt-3 overflow-x-auto text-xs leading-5 text-muted-foreground">
                          {JSON.stringify(selectedRecommendation.proposedAction, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-border/60 bg-background/40 p-5 text-sm text-muted-foreground">
                    select a recommendation to inspect its trace.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="border-border/70 bg-card/80 shadow-soft backdrop-blur">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">pending approvals</CardTitle>
                    <CardDescription className="mt-1">
                      actions that require user confirmation before they can execute
                    </CardDescription>
                  </div>
                  <ShieldAlert className="h-5 w-5 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {approvals.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border/60 bg-background/40 p-4 text-sm text-muted-foreground">
                    no approval requests are waiting.
                  </div>
                ) : (
                  approvals.map((approval) => (
                    <div key={approval.recommendationId} className="rounded-2xl border border-border/60 bg-background/60 p-4">
                      <p className="text-sm font-medium">{approval.title}</p>
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">{approval.explanation}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          className="gap-2"
                          onClick={() => void approveRecommendation.mutateAsync(approval.recommendationId)}
                          disabled={approveRecommendation.isPending}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-2"
                          onClick={() => void rejectRecommendation.mutateAsync(approval.recommendationId)}
                          disabled={rejectRecommendation.isPending}
                        >
                          <TriangleAlert className="h-4 w-4" />
                          reject
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/80 shadow-soft backdrop-blur">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">notifications</CardTitle>
                    <CardDescription className="mt-1">
                      surfaced signals and approval notices
                    </CardDescription>
                  </div>
                  <BellRing className="h-5 w-5 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {notifications.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border/60 bg-background/40 p-4 text-sm text-muted-foreground">
                    no notifications yet.
                  </div>
                ) : (
                  notifications.slice(0, 6).map((notification) => <NotificationItem key={notification.id} notification={notification} />)
                )}
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/80 shadow-soft backdrop-blur">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">execution logs</CardTitle>
                    <CardDescription className="mt-1">
                      chronological trace of the latest proactive runs
                    </CardDescription>
                  </div>
                  <Clock3 className="h-5 w-5 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {logs.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border/60 bg-background/40 p-4 text-sm text-muted-foreground">
                    logs will appear here after a scan runs.
                  </div>
                ) : (
                  logs.slice(0, 8).map((log) => (
                    <LogRow
                      key={log.id}
                      step={log.step}
                      message={log.message}
                      timestamp={log.timestamp}
                      severity={log.level}
                    />
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/80 shadow-soft backdrop-blur">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">latest run</CardTitle>
                    <CardDescription className="mt-1">
                      summary of the most recent proactive automation pass
                    </CardDescription>
                  </div>
                  <FolderKanban className="h-5 w-5 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {latestRun ? (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <ApprovalSummary title="status" value={latestRun.status} />
                      <ApprovalSummary title="recommendations" value={String(latestRun.recommendations.length)} />
                      <ApprovalSummary title="notifications" value={String(latestRun.notifications.length)} />
                      <ApprovalSummary title="started" value={formatTimestamp(latestRun.startedAt)} />
                    </div>
                    <Separator className="bg-border/60" />
                    <div className="rounded-2xl border border-border/60 bg-background/60 p-4 text-sm leading-6 text-muted-foreground">
                      {latestRun.recommendations[0]?.explanation ??
                        "no latest recommendation has been generated yet."}
                    </div>
                  </>
                ) : (
                  <div className="rounded-2xl border border-dashed border-border/60 bg-background/40 p-4 text-sm text-muted-foreground">
                    no completed run yet.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}
