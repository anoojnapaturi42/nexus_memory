"use client";

import { useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, RefreshCw, TriangleAlert, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { memoryBenchmarkDataset } from "@/mock/evaluation/memory-benchmark-dataset";
import { cn } from "@/lib/utils";
import {
  formatDuration,
  formatPercent,
  memorySystemLabels,
} from "@/lib/evaluation/research-view";
import type { BenchmarkMemory, MemoryEvaluationRunArtifact } from "@/types/memory-evaluation";

const temporalCases = memoryBenchmarkDataset.filter(
  (benchmark) => benchmark.category === "temporal-update",
);

function MemoryChip({
  memory,
  gold,
}: {
  memory: BenchmarkMemory;
  gold: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full flex-wrap items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] leading-5",
        gold
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : memory.validity === "superseded"
            ? "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300"
            : memory.validity === "uncertain"
              ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
              : "border-border/60 bg-background/70 text-muted-foreground",
      )}
      title={memory.content}
    >
      <span className="font-medium">{memory.id}</span>
      <span className="opacity-70">
        {memory.validity}
        {gold ? " · gold" : ""}
      </span>
    </span>
  );
}

export function TemporalUpdateDemo({ artifact }: { artifact: MemoryEvaluationRunArtifact }) {
  const [activeCaseId, setActiveCaseId] = useState(temporalCases[0]?.id ?? "");
  const benchmark = temporalCases.find((item) => item.id === activeCaseId) ?? temporalCases[0];

  const observations = useMemo(
    () => artifact.observations.filter((observation) => observation.caseId === benchmark?.id),
    [artifact.observations, benchmark?.id],
  );
  const memoryById = useMemo(
    () => new Map((benchmark?.candidateMemories ?? []).map((memory) => [memory.id, memory])),
    [benchmark],
  );
  const goldIds = useMemo(() => new Set(benchmark?.goldMemoryIds ?? []), [benchmark]);
  const staleRetrievals = observations.reduce(
    (total, observation) =>
      total +
      observation.retrievedMemoryIds.filter(
        (id) => memoryById.get(id)?.validity === "superseded",
      ).length,
    0,
  );

  if (!benchmark) return null;

  return (
    <Card className="overflow-hidden border-border/70 bg-card/90">
      <CardHeader className="gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              temporal update demo
            </p>
            <CardTitle className="mt-2 text-xl">What happens after a user changes their mind?</CardTitle>
            <CardDescription className="mt-2 max-w-3xl">
              Each case stores an older value as <code className="text-xs">superseded</code> and the
              correction as <code className="text-xs">current</code>. Nexus filters superseded memories
              before ranking, while semantic RAG can still retrieve either version.
            </CardDescription>
          </div>
          <div className="rounded-2xl border border-border/60 bg-background/60 px-4 py-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">{staleRetrievals} stale retrievals</p>
            <p className="mt-1">across {observations.length} system runs for this case</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {temporalCases.map((item) => (
            <Button
              key={item.id}
              type="button"
              size="sm"
              variant={item.id === benchmark.id ? "default" : "outline"}
              className={cn(
                "rounded-full",
                item.id !== benchmark.id && "border-border/60 bg-background/60 text-muted-foreground",
              )}
              onClick={() => setActiveCaseId(item.id)}
            >
              {item.title}
            </Button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
          <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              update timeline
            </p>
            <div className="mt-3 space-y-3">
              {benchmark.conversations.map((turn, index) => (
                <div key={turn.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className="mt-1 flex h-6 w-6 items-center justify-center rounded-full border border-border/60 bg-card text-[10px] font-semibold">
                      {index + 1}
                    </span>
                    {index < benchmark.conversations.length - 1 ? (
                      <span className="mt-1 h-full w-px bg-border/60" />
                    ) : null}
                  </div>
                  <div className="min-w-0 pb-2">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                      {turn.role}
                    </p>
                    <p className="mt-1 text-sm leading-6">{turn.content}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-xl border border-border/60 bg-card/70 p-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                follow-up prompt
              </p>
              <p className="mt-1 text-sm font-medium">{benchmark.prompt}</p>
            </div>
            <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">
                expected answer
              </p>
              <p className="mt-1 text-sm leading-6">{benchmark.expectedAnswer}</p>
            </div>
          </div>

          <div className="space-y-3">
            {artifact.systemIds.map((systemId) => {
              const observation = observations.find((item) => item.systemId === systemId);
              const retrieved = (observation?.retrievedMemoryIds ?? [])
                .map((id) => memoryById.get(id))
                .filter((memory): memory is BenchmarkMemory => Boolean(memory));
              const usedStale = retrieved.some((memory) => memory.validity === "superseded");

              return (
                <div
                  key={systemId}
                  className={cn(
                    "rounded-2xl border p-4",
                    observation?.answerCorrect
                      ? "border-emerald-500/30 bg-emerald-500/5"
                      : "border-border/60 bg-background/60",
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{memorySystemLabels[systemId]}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {observation
                          ? `${formatDuration(observation.latencyMs)} · ${formatPercent(
                              Number(observation.answerCorrect),
                            )} answer match`
                          : "no observation"}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {usedStale ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-[11px] text-rose-700 dark:text-rose-300">
                          <TriangleAlert className="h-3 w-3" /> stale retrieved
                        </span>
                      ) : null}
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium",
                          observation?.answerCorrect
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                            : "bg-rose-500/15 text-rose-700 dark:text-rose-300",
                        )}
                      >
                        {observation?.answerCorrect ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <XCircle className="h-3 w-3" />
                        )}
                        {observation?.answerCorrect ? "rubric pass" : "rubric fail"}
                      </span>
                    </div>
                  </div>

                  <p className="mt-3 rounded-xl border border-border/60 bg-card/70 p-3 text-sm leading-6">
                    {observation?.generatedAnswer || "No answer generated for this run."}
                  </p>

                  <div className="mt-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                      retrieved memories
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {retrieved.length ? (
                        retrieved.map((memory) => (
                          <MemoryChip
                            key={memory.id}
                            memory={memory}
                            gold={goldIds.has(memory.id)}
                          />
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          no durable memories supplied to this system
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
                    <RefreshCw className="h-3 w-3" />
                    gold: {benchmark.goldMemoryIds.join(", ") || "none"}
                    <ArrowRight className="h-3 w-3" />
                    answer rubric: {benchmark.answerRubric.join("; ")}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
