"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Filter, Search, XCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { memoryBenchmarkDataset } from "@/mock/evaluation/memory-benchmark-dataset";
import { cn } from "@/lib/utils";
import {
  benchmarkCategoryLabels,
  memorySystemLabels,
  observationKey,
} from "@/lib/evaluation/research-view";
import type {
  MemoryEvaluationError,
  MemoryEvaluationErrorType,
  MemoryEvaluationRunArtifact,
  MemorySystemId,
} from "@/types/memory-evaluation";

const errorTypeLabels: Record<MemoryEvaluationErrorType, string> = {
  "missed-relevant-memory": "missed relevant memory",
  "stale-memory-used": "stale memory used",
  "entity-confusion": "entity confusion",
  "retrieval-contamination": "retrieval contamination",
  "correct-retrieval-wrong-answer": "correct retrieval, wrong answer",
  "execution-failed": "execution failed",
  "incorrect-evaluation": "incorrect evaluation",
};

const errorTypeTones: Record<MemoryEvaluationErrorType, string> = {
  "missed-relevant-memory": "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  "stale-memory-used": "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300",
  "entity-confusion": "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  "retrieval-contamination": "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  "correct-retrieval-wrong-answer": "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  "execution-failed": "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  "incorrect-evaluation": "border-border/60 bg-muted/50 text-muted-foreground",
};

const PAGE_SIZE = 16;

export function FailureCaseExplorer({ artifact }: { artifact: MemoryEvaluationRunArtifact }) {
  const [systemFilter, setSystemFilter] = useState<MemorySystemId | "all">("all");
  const [errorTypeFilter, setErrorTypeFilter] = useState<MemoryEvaluationErrorType | "all">("all");
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [includePassing, setIncludePassing] = useState(false);

  const caseById = useMemo(
    () => new Map(memoryBenchmarkDataset.map((benchmark) => [benchmark.id, benchmark])),
    [],
  );
  const errorsByObservation = useMemo(() => {
    const grouped = new Map<string, MemoryEvaluationError[]>();
    for (const error of artifact.errors) {
      const key = observationKey(error.caseId, error.systemId);
      grouped.set(key, [...(grouped.get(key) ?? []), error]);
    }
    return grouped;
  }, [artifact.errors]);

  const errorTypes = useMemo(
    () => [...new Set(artifact.errors.map((error) => error.type))].sort(),
    [artifact.errors],
  );

  const issueObservations = useMemo(
    () =>
      artifact.observations.filter((observation) => {
        const errors = errorsByObservation.get(observationKey(observation.caseId, observation.systemId));
        return includePassing || !observation.answerCorrect || Boolean(errors?.length);
      }),
    [artifact.observations, errorsByObservation, includePassing],
  );

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return issueObservations.filter((observation) => {
      if (systemFilter !== "all" && observation.systemId !== systemFilter) return false;
      const errors = errorsByObservation.get(observationKey(observation.caseId, observation.systemId)) ?? [];
      if (errorTypeFilter !== "all" && !errors.some((error) => error.type === errorTypeFilter)) {
        return false;
      }
      if (!normalizedQuery) return true;
      const benchmark = caseById.get(observation.caseId);
      return [
        observation.caseId,
        observation.generatedAnswer,
        benchmark?.title,
        benchmark?.prompt,
        benchmark?.expectedAnswer,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery));
    });
  }, [caseById, errorTypeFilter, errorsByObservation, issueObservations, query, systemFilter]);

  const uniqueFailures = new Set(
    artifact.observations
      .filter((observation) => !observation.answerCorrect)
      .map((observation) => observation.caseId),
  ).size;

  return (
    <Card className="overflow-hidden border-border/70 bg-card/90">
      <CardHeader className="gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              failure-case explorer
            </p>
            <CardTitle className="mt-2 text-xl">Where each memory system breaks</CardTitle>
            <CardDescription className="mt-2 max-w-3xl">
              Failures combine incorrect answers with retrieval diagnostics. Filter by system, error
              class, or free text to inspect the generated answer next to the gold answer.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-rose-700 dark:text-rose-300">
              <AlertTriangle className="h-3 w-3" />
              {uniqueFailures} cases with a wrong answer
            </span>
            <span className="rounded-full border border-border/60 bg-background/60 px-3 py-1.5 text-muted-foreground">
              {artifact.errors.length} logged errors
            </span>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_220px_auto]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setVisibleCount(PAGE_SIZE);
              }}
              placeholder="search case, prompt, or answer..."
              className="h-11 pl-9"
              aria-label="search failure cases"
            />
          </label>
          <select
            value={systemFilter}
            onChange={(event) => {
              setSystemFilter(event.target.value as MemorySystemId | "all");
              setVisibleCount(PAGE_SIZE);
            }}
            className="h-11 rounded-xl border border-border/60 bg-background/70 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="filter by memory system"
          >
            <option value="all">all systems</option>
            {artifact.systemIds.map((systemId) => (
              <option key={systemId} value={systemId}>
                {memorySystemLabels[systemId]}
              </option>
            ))}
          </select>
          <select
            value={errorTypeFilter}
            onChange={(event) => {
              setErrorTypeFilter(event.target.value as MemoryEvaluationErrorType | "all");
              setVisibleCount(PAGE_SIZE);
            }}
            className="h-11 rounded-xl border border-border/60 bg-background/70 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="filter by error type"
          >
            <option value="all">all error types</option>
            {errorTypes.map((type) => (
              <option key={type} value={type}>
                {errorTypeLabels[type]}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant={includePassing ? "default" : "outline"}
            className="h-11 gap-2"
            onClick={() => {
              setIncludePassing((current) => !current);
              setVisibleCount(PAGE_SIZE);
            }}
          >
            <Filter className="h-4 w-4" />
            {includePassing ? "passing included" : "failures only"}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 bg-background/40 p-6 text-sm text-muted-foreground">
            No cases match the current filters. Try clearing the search or including passing cases.
          </div>
        ) : (
          filtered.slice(0, visibleCount).map((observation) => {
            const benchmark = caseById.get(observation.caseId);
            const errors =
              errorsByObservation.get(observationKey(observation.caseId, observation.systemId)) ?? [];
            const goldIds = new Set(benchmark?.goldMemoryIds ?? []);
            const memoryById = new Map(
              (benchmark?.candidateMemories ?? []).map((memory) => [memory.id, memory]),
            );

            return (
              <div
                key={`${observation.caseId}-${observation.systemId}`}
                className={cn(
                  "rounded-2xl border p-4",
                  observation.answerCorrect
                    ? "border-border/60 bg-background/60"
                    : "border-rose-500/25 bg-rose-500/5",
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="rounded-full border border-border/60 bg-card px-2.5 py-1">
                        {memorySystemLabels[observation.systemId]}
                      </span>
                      {benchmark ? (
                        <span className="rounded-full border border-border/60 bg-card px-2.5 py-1">
                          {benchmarkCategoryLabels[benchmark.category]}
                        </span>
                      ) : null}
                      <span>{observation.caseId}</span>
                    </div>
                    <p className="mt-2 text-sm font-semibold">
                      {benchmark?.title ?? observation.caseId}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      prompt: {benchmark?.prompt ?? "unknown"}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium",
                      observation.answerCorrect
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                        : "bg-rose-500/15 text-rose-700 dark:text-rose-300",
                    )}
                  >
                    {observation.answerCorrect ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : (
                      <XCircle className="h-3 w-3" />
                    )}
                    {observation.answerCorrect ? "answer pass" : "answer fail"}
                  </span>
                </div>

                {errors.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {errors.map((error) => (
                      <span
                        key={error.id}
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-[11px]",
                          errorTypeTones[error.type],
                        )}
                        title={error.description}
                      >
                        {errorTypeLabels[error.type]}
                      </span>
                    ))}
                  </div>
                ) : null}

                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  <div className="rounded-xl border border-border/60 bg-card/70 p-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                      generated answer
                    </p>
                    <p className="mt-1 text-sm leading-6">
                      {observation.generatedAnswer || "empty answer"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-card/70 p-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                      expected answer
                    </p>
                    <p className="mt-1 text-sm leading-6">
                      {benchmark?.expectedAnswer ?? "no gold answer"}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    retrieved
                  </span>
                  {observation.retrievedMemoryIds.length ? (
                    observation.retrievedMemoryIds.map((id) => {
                      const memory = memoryById.get(id);
                      return (
                        <span
                          key={id}
                          className={cn(
                            "rounded-full border px-2.5 py-1 text-[11px]",
                            goldIds.has(id)
                              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                              : "border-border/60 bg-background/60 text-muted-foreground",
                          )}
                          title={memory?.content ?? id}
                        >
                          {id}
                          {goldIds.has(id) ? " · gold" : ""}
                          {memory ? ` · ${memory.validity}` : ""}
                        </span>
                      );
                    })
                  ) : (
                    <span className="text-[11px] text-muted-foreground">none</span>
                  )}
                  {observation.evaluatorNotes ? (
                    <span className="ml-auto text-[11px] text-muted-foreground">
                      {observation.evaluatorNotes}
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })
        )}

        {filtered.length > visibleCount ? (
          <div className="flex justify-center pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setVisibleCount((current) => current + PAGE_SIZE)}
            >
              show {Math.min(PAGE_SIZE, filtered.length - visibleCount)} more cases
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
