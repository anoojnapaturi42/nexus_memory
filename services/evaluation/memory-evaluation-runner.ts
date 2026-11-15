import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { tokenize, uniqueTokens } from "@/lib/memory-retrieval/text-utils";
import { memoryBenchmarkDataset } from "@/mock/evaluation/memory-benchmark-dataset";
import { GeminiLLMService } from "@/services/llm/gemini.service";
import { getGeminiEnv } from "@/services/llm/env";
import { getOllamaEnv } from "@/services/llm/ollama.env";
import { OllamaLLMService } from "@/services/llm/ollama.service";
import type { LLMProvider } from "@/services/llm/provider";
import type {
  MemoryBenchmarkCase,
  MemoryEvaluationError,
  MemoryEvaluationObservation,
  MemoryEvaluationRunArtifact,
  MemorySystemExecution,
  MemorySystemId,
} from "@/types/memory-evaluation";
import { createMemorySystemAdapters, type MemorySystemAdapter } from "./memory-system-adapters";
import { calculateMemoryEvaluationMetrics } from "./memory-evaluation-metrics";
import { CriteriaMemoryAnswerEvaluator } from "./memory-answer-evaluator";
import { deriveMemoryEvaluationErrors } from "./memory-evaluation-errors";

export type MemoryAnswerGenerationRequest = {
  benchmark: MemoryBenchmarkCase;
  execution: MemorySystemExecution;
};

export type MemoryAnswerGenerationResult = {
  answer: string;
  usage: MemoryEvaluationObservation["usage"];
};

export interface MemoryAnswerGenerator {
  readonly provider?: string;
  readonly model?: string;
  generate(request: MemoryAnswerGenerationRequest): Promise<MemoryAnswerGenerationResult>;
}

export interface MemoryAnswerEvaluator {
  readonly id?: MemoryEvaluationObservation["evaluator"];
  evaluate(input: {
    benchmark: MemoryBenchmarkCase;
    answer: string;
  }): Pick<
    MemoryEvaluationObservation,
    "answerCorrect" | "taskSucceeded" | "evaluator" | "evaluatorNotes"
  >;
}

export type MemoryEvaluationRunnerOptions = {
  minIntervalBetweenGenerationsMs?: number;
  maxGenerationAttempts?: number;
  retryBaseDelayMs?: number;
};

const evaluationSystemPrompt = [
  "You are answering a personalized assistant request for a controlled memory evaluation.",
  "Use only the supplied context. If the context is insufficient, say that you do not know.",
  "Do not mention the benchmark, system name, gold answer, or evaluation setup.",
  "Answer concisely and directly.",
].join(" ");

const ignoredRubricTokens = new Set([
  "the",
  "and",
  "or",
  "with",
  "that",
  "this",
  "does",
  "not",
  "mention",
  "says",
  "current",
  "with",
]);

function meaningfulTokens(text: string) {
  return uniqueTokens(tokenize(text)).filter(
    (token) => token.length > 2 && !ignoredRubricTokens.has(token),
  );
}

function calculateCoverage(expected: string, answer: string) {
  const expectedTokens = meaningfulTokens(expected);
  if (expectedTokens.length === 0) return 1;
  const answerTokens = new Set(meaningfulTokens(answer));
  return expectedTokens.filter((token) => answerTokens.has(token)).length / expectedTokens.length;
}

export class GeminiMemoryAnswerGenerator implements MemoryAnswerGenerator {
  readonly provider: string;
  readonly model: string;

  constructor(
    private readonly llm: LLMProvider,
    model = "unknown",
  ) {
    this.provider = llm.provider;
    this.model = model;
  }

  static fromEnvironment() {
    const env = getGeminiEnv();
    if (!env.ok) throw new Error(env.error.message);
    return new GeminiMemoryAnswerGenerator(new GeminiLLMService(env.env), env.env.model);
  }

  async generate({
    benchmark,
    execution,
  }: MemoryAnswerGenerationRequest): Promise<MemoryAnswerGenerationResult> {
    const generated = await this.llm.generate({
      systemPrompt: evaluationSystemPrompt,
      prompt: benchmark.prompt,
      context: {
        memorySystem: execution.systemId,
        suppliedContext: execution.context,
      },
      agentName: "memory-evaluation",
      taskType: "benchmark-answer",
    });

    return {
      answer: generated.text,
      usage: generated.usage,
    };
  }
}

export class OllamaMemoryAnswerGenerator extends GeminiMemoryAnswerGenerator {
  static fromEnvironment() {
    const env = getOllamaEnv();
    if (!env.ok) throw new Error(env.error.message);
    return new OllamaMemoryAnswerGenerator(new OllamaLLMService(env.env), env.env.model);
  }
}

export class RuleBasedMemoryAnswerEvaluator implements MemoryAnswerEvaluator {
  readonly id = "rule-based" as const;

  evaluate({ benchmark, answer }: { benchmark: MemoryBenchmarkCase; answer: string }) {
    const expectedCoverage = calculateCoverage(benchmark.expectedAnswer, answer);
    const rubricCoverage = benchmark.answerRubric.length
      ? average(benchmark.answerRubric.map((rubric) => calculateCoverage(rubric, answer)))
      : 1;
    const answerCorrect = expectedCoverage >= 0.5 && rubricCoverage >= 0.35;

    return {
      answerCorrect,
      taskSucceeded: benchmark.taskSuccessCriteria?.length ? answerCorrect : null,
      evaluator: "rule-based" as const,
      evaluatorNotes: `expected-token-coverage=${expectedCoverage.toFixed(2)}; rubric-coverage=${rubricCoverage.toFixed(2)}`,
    };
  }
}

function average(values: number[]) {
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0;
}

async function withRetry<T>(operation: () => Promise<T>, attempts = 3, baseDelayMs = 750): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("memory evaluation operation failed");
      if (attempt === attempts) break;
      await new Promise((resolve) => setTimeout(resolve, baseDelayMs * 2 ** (attempt - 1)));
    }
  }

  throw lastError ?? new Error("memory evaluation operation failed");
}

export class MemoryEvaluationRunner {
  constructor(
    private readonly answerGenerator: MemoryAnswerGenerator,
    private readonly answerEvaluator: MemoryAnswerEvaluator = new CriteriaMemoryAnswerEvaluator(),
    private readonly adapters: Record<
      MemorySystemId,
      MemorySystemAdapter
    > = createMemorySystemAdapters(),
    private readonly options: MemoryEvaluationRunnerOptions = {},
  ) {}

  async run(
    benchmarks: MemoryBenchmarkCase[] = memoryBenchmarkDataset,
    systemIds: MemorySystemId[] = Object.keys(this.adapters) as MemorySystemId[],
  ): Promise<MemoryEvaluationRunArtifact> {
    const runId = randomUUID();
    const observations: MemoryEvaluationObservation[] = [];
    const errors: MemoryEvaluationError[] = [];
    const generationIntervalMs = this.options.minIntervalBetweenGenerationsMs ?? 0;
    let lastGenerationAt = 0;

    for (const benchmark of benchmarks) {
      for (const systemId of systemIds) {
        const startedAt = Date.now();
        try {
          const execution = await withRetry(() => this.adapters[systemId].execute(benchmark), 2);
          if (generationIntervalMs > 0) {
            const waitMs = generationIntervalMs - (Date.now() - lastGenerationAt);
            if (waitMs > 0) {
              await new Promise((resolve) => setTimeout(resolve, waitMs));
            }
          }
          lastGenerationAt = Date.now();
          const answer = await withRetry(
            () => this.answerGenerator.generate({ benchmark, execution }),
            this.options.maxGenerationAttempts ?? 3,
            this.options.retryBaseDelayMs ?? 750,
          );
          const evaluation = this.answerEvaluator.evaluate({ benchmark, answer: answer.answer });
          const observation: MemoryEvaluationObservation = {
            runId,
            caseId: benchmark.id,
            systemId,
            retrievedMemoryIds: execution.retrievedMemoryIds,
            generatedAnswer: answer.answer,
            ...evaluation,
            latencyMs: Date.now() - startedAt,
            usage: answer.usage,
            evaluatedAt: new Date().toISOString(),
          };
          observations.push(observation);
          errors.push(...deriveMemoryEvaluationErrors(observation, benchmark));
        } catch (error) {
          errors.push({
            id: `${runId}-${benchmark.id}-${systemId}-failed`,
            runId,
            caseId: benchmark.id,
            systemId,
            type: "execution-failed",
            description:
              error instanceof Error
                ? `Benchmark execution failed after retries: ${error.message}`
                : "Benchmark execution failed after retries.",
            createdAt: new Date().toISOString(),
          });
        }
      }
    }

    const benchmarkMap = new Map(benchmarks.map((benchmark) => [benchmark.id, benchmark]));
    const summaries = systemIds.map((systemId) => {
      const systemObservations = observations.filter(
        (observation) => observation.systemId === systemId,
      );
      return {
        runId,
        systemId,
        benchmarkCaseCount: benchmarks.length,
        completedCaseCount: systemObservations.length,
        metrics: calculateMemoryEvaluationMetrics(systemObservations, benchmarkMap),
        generatedAt: new Date().toISOString(),
      };
    });

    return {
      runId,
      benchmarkCaseCount: benchmarks.length,
      systemIds,
      observations,
      summaries,
      errors,
      generatedAt: new Date().toISOString(),
      provider: this.answerGenerator.provider,
      model: this.answerGenerator.model,
      datasetLabel: "nexus-memory-benchmark-v1",
      evaluator: this.answerEvaluator.id ?? observations[0]?.evaluator,
    };
  }
}

function escapeCsv(value: string | number | boolean | null) {
  const normalized = value === null ? "" : String(value);
  return /[",\n]/.test(normalized) ? `"${normalized.replaceAll('"', '""')}"` : normalized;
}

function toCsv(artifact: MemoryEvaluationRunArtifact) {
  const headers = [
    "run_id",
    "case_id",
    "system_id",
    "retrieved_memory_ids",
    "answer_correct",
    "task_succeeded",
    "latency_ms",
    "input_tokens",
    "output_tokens",
    "total_tokens",
    "evaluator",
    "evaluator_notes",
    "generated_answer",
  ];
  const rows = artifact.observations.map((observation) => [
    observation.runId,
    observation.caseId,
    observation.systemId,
    observation.retrievedMemoryIds.join("|"),
    observation.answerCorrect,
    observation.taskSucceeded,
    observation.latencyMs,
    observation.usage.inputTokens,
    observation.usage.outputTokens,
    observation.usage.totalTokens,
    observation.evaluator,
    observation.evaluatorNotes ?? null,
    observation.generatedAnswer,
  ]);
  return [headers, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n");
}

export async function exportMemoryEvaluationArtifact(
  artifact: MemoryEvaluationRunArtifact,
  outputDirectory = join(process.cwd(), "evaluation-results"),
) {
  await mkdir(outputDirectory, { recursive: true });
  const jsonPath = join(outputDirectory, `${artifact.runId}.json`);
  const csvPath = join(outputDirectory, `${artifact.runId}.csv`);
  await Promise.all([
    writeFile(jsonPath, JSON.stringify(artifact, null, 2), "utf8"),
    writeFile(csvPath, toCsv(artifact), "utf8"),
  ]);
  return { jsonPath, csvPath };
}
