"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  Award,
  Download,
  FlaskConical,
  Gauge,
  Layers3,
  Play,
  RefreshCw,
  TrendingUp,
  TriangleAlert,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FailureCaseExplorer } from "@/components/research/failure-case-explorer";
import { MethodologySection } from "@/components/research/methodology-section";
import { TemporalUpdateDemo } from "@/components/research/temporal-update-demo";
import { useResearchEvaluation } from "@/hooks/use-research-evaluation";
import { memoryBenchmarkDataset } from "@/mock/evaluation/memory-benchmark-dataset";
import { layoutContainer } from "@/lib/layout";
import { cn } from "@/lib/utils";
import {
  benchmarkCategoryDescriptions,
  benchmarkCategoryLabels,
  buildCategoryAccuracy,
  formatCount,
  formatDuration,
  formatPercent,
  memorySystemLabels,
  memorySystemShortDescriptions,
  metricValue,
  primaryMetricOrder,
  type MetricKey,
} from "@/lib/evaluation/research-view";
import type { MemoryEvaluationSummary } from "@/types/memory-evaluation";

function bestMetricValue(
  summaries: MemoryEvaluationSummary[],
  key: MetricKey,
  higherIsBetter: boolean,
) {
  const values = summaries
    .map((summary) => metricValue(summary.metrics, key))
    .filter((value): value is number => value !== null && value !== undefined);
  if (values.length === 0) return null;
  return higherIsBetter ? Math.max(...values) : Math.min(...values);
}

function MetricBar({
  label,
  value,
  tone = "bg-sky-500",
}: {
  label: string;
  value: number | null;
  tone?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{formatPercent(value)}</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", tone)}
          style={{ width: `${Math.round((value ?? 0) * 100)}%` }}
        />
      </div>
    </div>
  );
}

function heatTone(value: number | null) {
  if (value === null) return "bg-muted/40 text-muted-foreground";
  if (value >= 0.8) return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
  if (value >= 0.6) return "bg-sky-500/15 text-sky-700 dark:text-sky-300";
  if (value >= 0.4) return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
  return "bg-rose-500/15 text-rose-700 dark:text-rose-300";
}

function EmptyResults({ onRun, isRunning }: { onRun: () => void; isRunning: boolean }) {
  return (
    <Card className="border-dashed border-border/70 bg-card/80">
      <CardContent className="flex flex-col items-center gap-4 px-6 py-16 text-center">
        <div className="rounded-3xl border border-border/60 bg-background p-4 text-muted-foreground">
          <FlaskConical className="h-6 w-6" />
        </div>
        <div>
          <p className="text-lg font-semibold">No evaluation artifacts yet</p>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            Run the 30-case benchmark against Gemini to create a JSON/CSV artifact in{" "}
            <code className="text-xs">evaluation-results/</code>. The dashboard reads the newest
            artifact on refresh.
          </p>
        </div>
        <Button onClick={onRun} disabled={isRunning}>
          {isRunning ? (
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Play className="mr-2 h-4 w-4" />
          )}
          {isRunning ? "running 120 Gemini answers..." : "run gemini benchmark"}
        </Button>
      </CardContent>
    </Card>
  );
}

export function ResearchDashboard() {
  const [selectedRunId, setSelectedRunId] = useState<string | undefined>();
  const { runsQuery, detailQuery, runs, artifact, runBenchmark } =
    useResearchEvaluation(selectedRunId);

  useEffect(() => {
    if (runBenchmark.isSuccess && runBenchmark.data.runId) {
      setSelectedRunId(runBenchmark.data.runId);
    }
  }, [runBenchmark.isSuccess, runBenchmark.data]);

  const bestAnswerAccuracy = useMemo(() => {
    if (!artifact) return null;
    return Math.max(...artifact.summaries.map((summary) => summary.metrics.answerAccuracy));
  }, [artifact]);

  const leadingSystem = useMemo(() => {
    if (!artifact) return null;
    return [...artifact.summaries].sort(
      (left, right) => right.metrics.answerAccuracy - left.metrics.answerAccuracy,
    )[0];
  }, [artifact]);

  const categoryRows = useMemo(
    () => (artifact ? buildCategoryAccuracy(artifact, memoryBenchmarkDataset) : []),
    [artifact],
  );

  const bestMetrics = useMemo(() => {
    const entries = primaryMetricOrder.map((metric) => [
      metric.key,
      artifact
        ? bestMetricValue(artifact.summaries, metric.key, metric.higherIsBetter)
        : null,
    ]);
    return Object.fromEntries(entries) as Record<MetricKey, number | null>;
  }, [artifact]);

  const runAction = () => runBenchmark.mutate();
  const activeRunId = selectedRunId ?? artifact?.runId ?? "";
  const isLoading = runsQuery.isLoading || (detailQuery.isLoading && Boolean(selectedRunId));

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(34,197,94,0.10),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(56,189,248,0.12),_transparent_28%)]" />
      <div className="pointer-events-none absolute inset-0 bg-grid-fade bg-[length:30px_30px] opacity-[0.04]" />

      <div className={layoutContainer("relative z-10 min-h-screen space-y-6 py-4 lg:py-6")}>
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32 }}
          className="rounded-[1.75rem] border border-border/70 bg-card/80 p-6 shadow-soft backdrop-blur"
        >
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
                research dashboard
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
                memory system benchmark
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                Thirty synthetic cases compare four memory systems on retrieval quality, answer
                accuracy, temporal updates, contradiction handling, token use, and latency. Results
                are generated by a live Gemini run and persisted as JSON and CSV.
              </p>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <label className="space-y-1 text-xs text-muted-foreground">
                <span className="block">evaluation run</span>
                <select
                  value={activeRunId}
                  onChange={(event) => setSelectedRunId(event.target.value || undefined)}
                  className="h-11 min-w-[210px] rounded-xl border border-border/60 bg-background/70 px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="select evaluation run"
                >
                  {runs.length === 0 ? <option value="">no runs</option> : null}
                  {runs.map((run) => (
                    <option key={run.runId} value={run.runId}>
                      {new Date(run.generatedAt).toLocaleString()} · {run.completedCaseCount} obs
                      {run.evaluator ? ` · ${run.evaluator}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                variant="outline"
                className="h-11 border-border/60 bg-background/60"
                onClick={() => void runsQuery.refetch()}
                disabled={runsQuery.isFetching}
              >
                <RefreshCw
                  className={cn("mr-2 h-4 w-4", runsQuery.isFetching && "animate-spin")}
                />
                refresh
              </Button>
              <Button className="h-11" onClick={runAction} disabled={runBenchmark.isPending}>
                {runBenchmark.isPending ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Play className="mr-2 h-4 w-4" />
                )}
                {runBenchmark.isPending ? "running gemini..." : "run gemini benchmark"}
              </Button>
            </div>
          </div>

          {runBenchmark.isPending ? (
            <div className="mt-5 rounded-2xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-800 dark:text-sky-200">
              Generating 120 answers with Gemini (30 cases × 4 systems). This usually takes a few
              minutes; keep this tab open.
            </div>
          ) : null}
          {runBenchmark.isError ? (
            <div className="mt-5 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-800 dark:text-rose-200">
              {runBenchmark.error instanceof Error
                ? runBenchmark.error.message
                : "the benchmark run failed"}
            </div>
          ) : null}
          {runBenchmark.isSuccess && !runBenchmark.isPending ? (
            <div className="mt-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200">
              Run complete: {runBenchmark.data.completedCaseCount} observations generated with{" "}
              {runBenchmark.data.errorCount} logged errors.
            </div>
          ) : null}
        </motion.section>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-28 rounded-2xl" />
            ))}
          </div>
        ) : runsQuery.isError ? (
          <Card className="border-rose-500/30 bg-rose-500/5">
            <CardContent className="p-6 text-sm text-rose-700 dark:text-rose-300">
              Evaluation results could not be loaded. Check that{" "}
              <code className="text-xs">evaluation-results/</code> is readable and reload the page.
            </CardContent>
          </Card>
        ) : !artifact ? (
          <EmptyResults onRun={runAction} isRunning={runBenchmark.isPending} />
        ) : (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  label: "benchmark cases",
                  value: formatCount(artifact.benchmarkCaseCount),
                  detail: `${categoryRows.length} research categories`,
                  icon: Layers3,
                },
                {
                  label: "systems compared",
                  value: formatCount(artifact.systemIds.length),
                  detail: "one shared adapter interface",
                  icon: FlaskConical,
                },
                {
                  label: "observations",
                  value: formatCount(artifact.observations.length),
                  detail: `${artifact.errors.length} logged errors`,
                  icon: Activity,
                },
                {
                  label: "best answer accuracy",
                  value: formatPercent(bestAnswerAccuracy),
                  detail: leadingSystem ? memorySystemLabels[leadingSystem.systemId] : "n/a",
                  icon: Award,
                },
              ].map((item) => (
                <Card key={item.label} className="border-border/70 bg-card/90">
                  <CardContent className="flex items-start justify-between gap-3 p-5">
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                        {item.label}
                      </p>
                      <p className="mt-2 text-2xl font-semibold tracking-tight">{item.value}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-background p-2 text-muted-foreground">
                      <item.icon className="h-4 w-4" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </section>

            <section className="rounded-2xl border border-border/70 bg-card/70 px-4 py-3">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
                <span>
                  run <code className="text-foreground">{artifact.runId}</code>
                </span>
                <span>
                  provider <span className="font-medium text-foreground">{artifact.provider ?? "unknown"}</span>
                </span>
                <span>
                  model <span className="font-medium text-foreground">{artifact.model ?? "unknown"}</span>
                </span>
                <span>
                  dataset <span className="font-medium text-foreground">{artifact.datasetLabel ?? "nexus-memory-benchmark-v1"}</span>
                </span>
                <span>
                  evaluator{" "}
                  <span className="font-medium text-foreground">
                    {artifact.evaluator ?? "rule-based"}
                  </span>
                </span>
                {artifact.sourceRunId ? (
                  <span>
                    rescored from{" "}
                    <code className="text-foreground">{artifact.sourceRunId}</code>
                  </span>
                ) : null}
                <span>
                  generated <span className="font-medium text-foreground">{new Date(artifact.generatedAt).toLocaleString()}</span>
                </span>
                <div className="ml-auto flex items-center gap-2">
                  <a
                    href={`/api/research/results/${artifact.runId}/export?format=json`}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    <Download className="mr-2 h-3.5 w-3.5" /> JSON
                  </a>
                  <a
                    href={`/api/research/results/${artifact.runId}/export?format=csv`}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    <Download className="mr-2 h-3.5 w-3.5" /> CSV
                  </a>
                </div>
              </div>
            </section>

            <section className="grid gap-4 xl:grid-cols-2">
              {artifact.summaries.map((summary) => (
                <Card key={summary.systemId} className="border-border/70 bg-card/90">
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-base">{memorySystemLabels[summary.systemId]}</CardTitle>
                        <CardDescription className="mt-1">
                          {memorySystemShortDescriptions[summary.systemId]}
                        </CardDescription>
                      </div>
                      <div className="rounded-2xl border border-border/60 bg-background px-3 py-2 text-right">
                        <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                          answer accuracy
                        </p>
                        <p className="mt-0.5 text-lg font-semibold">
                          {formatPercent(summary.metrics.answerAccuracy)}
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <MetricBar label="Recall@3" value={summary.metrics.recallAtK} tone="bg-emerald-500" />
                      <MetricBar label="Precision@3" value={summary.metrics.precisionAtK} tone="bg-sky-500" />
                      <MetricBar label="MRR" value={summary.metrics.meanReciprocalRank} tone="bg-violet-500" />
                      <MetricBar
                        label="Temporal accuracy"
                        value={summary.metrics.temporalAccuracy}
                        tone="bg-amber-500"
                      />
                      <MetricBar
                        label="Conflict resolution"
                        value={summary.metrics.contradictionResolutionAccuracy}
                        tone="bg-orange-500"
                      />
                      <MetricBar
                        label="Memory pollution"
                        value={summary.metrics.memoryPollutionRate}
                        tone="bg-rose-500"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="rounded-full border border-border/60 bg-background/60 px-2.5 py-1">
                        mean {formatDuration(summary.metrics.meanLatencyMs)}
                      </span>
                      <span className="rounded-full border border-border/60 bg-background/60 px-2.5 py-1">
                        p95 {formatDuration(summary.metrics.p95LatencyMs)}
                      </span>
                      <span className="rounded-full border border-border/60 bg-background/60 px-2.5 py-1">
                        {formatCount(Math.round(summary.metrics.meanTotalTokens))} tokens / answer
                      </span>
                      <span className="rounded-full border border-border/60 bg-background/60 px-2.5 py-1">
                        {summary.completedCaseCount}/{summary.benchmarkCaseCount} completed
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </section>

            <Card className="overflow-hidden border-border/70 bg-card/90">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl border border-border/60 bg-background p-2 text-muted-foreground">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                      retrieval and answer metrics
                    </p>
                    <CardTitle className="mt-1 text-xl">System leaderboard</CardTitle>
                  </div>
                </div>
                <CardDescription>
                  Best value in each column is highlighted. Memory pollution is better when lower.
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full min-w-[920px] border-separate border-spacing-0 text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      <th className="border-b border-border/60 pb-3 pr-4 font-medium">system</th>
                      {primaryMetricOrder.map((metric) => (
                        <th key={metric.key} className="border-b border-border/60 px-3 pb-3 font-medium">
                          {metric.label}
                        </th>
                      ))}
                      <th className="border-b border-border/60 px-3 pb-3 font-medium">p95 latency</th>
                      <th className="border-b border-border/60 pl-3 pb-3 font-medium">tokens</th>
                    </tr>
                  </thead>
                  <tbody>
                    {artifact.summaries.map((summary) => (
                      <tr key={summary.systemId} className="align-middle">
                        <td className="border-b border-border/50 py-3 pr-4">
                          <p className="font-medium">{memorySystemLabels[summary.systemId]}</p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {memorySystemShortDescriptions[summary.systemId]}
                          </p>
                        </td>
                        {primaryMetricOrder.map((metric) => {
                          const value = metricValue(summary.metrics, metric.key);
                          const best = bestMetrics[metric.key];
                          const isBest = best !== null && value !== null && value === best;
                          return (
                            <td key={metric.key} className="border-b border-border/50 px-3 py-3">
                              <span
                                className={cn(
                                  "inline-flex rounded-full px-2.5 py-1 text-xs font-medium",
                                  isBest
                                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                                    : "text-muted-foreground",
                                )}
                              >
                                {formatPercent(value)}
                              </span>
                            </td>
                          );
                        })}
                        <td className="border-b border-border/50 px-3 py-3 text-xs text-muted-foreground">
                          {formatDuration(summary.metrics.p95LatencyMs)}
                        </td>
                        <td className="border-b border-border/50 py-3 pl-3 text-xs text-muted-foreground">
                          {formatCount(Math.round(summary.metrics.meanTotalTokens))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-border/70 bg-card/90">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl border border-border/60 bg-background p-2 text-muted-foreground">
                    <Gauge className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                      category breakdown
                    </p>
                    <CardTitle className="mt-1 text-xl">Answer accuracy by memory task</CardTitle>
                  </div>
                </div>
                <CardDescription>
                  Each cell is the share of rubric-passing answers for that category and system.
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-separate border-spacing-1 text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      <th className="pb-2 pr-3 font-medium">category</th>
                      <th className="px-2 pb-2 font-medium">cases</th>
                      {artifact.systemIds.map((systemId) => (
                        <th key={systemId} className="px-2 pb-2 font-medium">
                          {memorySystemLabels[systemId]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {categoryRows.map((row) => (
                      <tr key={row.category}>
                        <td className="rounded-xl bg-background/50 px-3 py-3">
                          <p className="font-medium">{benchmarkCategoryLabels[row.category]}</p>
                          <p className="mt-0.5 max-w-[260px] text-[11px] leading-4 text-muted-foreground">
                            {benchmarkCategoryDescriptions[row.category]}
                          </p>
                        </td>
                        <td className="px-3 py-3 text-center text-xs text-muted-foreground">
                          {row.caseCount}
                        </td>
                        {artifact.systemIds.map((systemId) => {
                          const value = row.accuracyBySystem[systemId] ?? null;
                          return (
                            <td key={systemId} className="p-1">
                              <div
                                className={cn(
                                  "flex h-full min-h-[52px] items-center justify-center rounded-xl px-2 text-sm font-semibold",
                                  heatTone(value),
                                )}
                              >
                                {formatPercent(value)}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            {artifact.errors.length ? (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-xs leading-5 text-amber-800 dark:text-amber-200">
                <span className="inline-flex items-center gap-2 font-medium">
                  <TriangleAlert className="h-3.5 w-3.5" />
                  {artifact.errors.length} diagnostic errors logged.
                </span>{" "}
                Errors are derived from retrieval and answer mismatches; the explorer below lets you
                inspect the underlying cases.
              </div>
            ) : null}

            <TemporalUpdateDemo artifact={artifact} />
            <FailureCaseExplorer artifact={artifact} />
          </>
        )}

        <MethodologySection />

        <footer className="flex flex-wrap items-center justify-between gap-3 pb-6 text-[11px] text-muted-foreground">
          <span>
            Nexus Memory research artifact · {memoryBenchmarkDataset.length} synthetic cases ·{" "}
            {Object.keys(memorySystemLabels).length} systems
          </span>
          <span>Results are reproducible from evaluation-results/*.json and *.csv.</span>
        </footer>
      </div>
    </main>
  );
}
