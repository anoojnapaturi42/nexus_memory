import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { tokenize, uniqueTokens } from "@/lib/memory-retrieval/text-utils";
import { memoryBenchmarkDataset } from "@/mock/evaluation/memory-benchmark-dataset";
import { GeminiLLMService } from "@/services/llm/gemini.service";
import { getGeminiEnv } from "@/services/llm/env";
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

export type MemoryAnswerGenerationRequest = {
  benchmark: MemoryBenchmarkCase;
  execution: MemorySystemExecution;
};

export type MemoryAnswerGenerationResult = {
  answer: string;
  usage: MemoryEvaluationObservation["usage"];
};

export interface MemoryAnswerGenerator {
  generate(request: MemoryAnswerGenerationRequest): Promise<MemoryAnswerGenerationResult>;
}

export interface MemoryAnswerEvaluator {
  evaluate(input: {
    benchmark: MemoryBenchmarkCase;
    answer: string;
  }): Pick<
    MemoryEvaluationObservation,
    "answerCorrect" | "taskSucceeded" | "evaluator" | "evaluatorNotes"
  >;
}

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
  constructor(private readonly provider: LLMProvider) {}

  static fromEnvironment() {
    const env = getGeminiEnv();
    if (!env.ok) throw new Error(env.error.message);
    return new GeminiMemoryAnswerGenerator(new GeminiLLMService(env.env));
  }

  async generate({
    benchmark,
    execution,
  }: MemoryAnswerGenerationRequest): Promise<MemoryAnswerGenerationResult> {
    const generated = await this.provider.generate({
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

export class RuleBasedMemoryAnswerEvaluator implements MemoryAnswerEvaluator {
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

function deriveErrors(
  observation: MemoryEvaluationObservation,
  benchmark: MemoryBenchmarkCase,
): MemoryEvaluationError[] {
  const errors: MemoryEvaluationError[] = [];
  const goldIds = new Set(benchmark.goldMemoryIds);
  const retrievedGold = observation.retrievedMemoryIds.filter((id) => goldIds.has(id));
  const irrelevant = observation.retrievedMemoryIds.filter((id) => !goldIds.has(id));
  const now = observation.evaluatedAt;

  if (goldIds.size > 0 && retrievedGold.length === 0) {
    errors.push({
      id: `${observation.runId}-${observation.caseId}-${observation.systemId}-missed`,
      runId: observation.runId,
      caseId: observation.caseId,
      systemId: observation.systemId,
      type: "missed-relevant-memory",
      description: "No gold memory was retrieved for this benchmark case.",
      createdAt: now,
    });
  }
  if (irrelevant.length > 0) {
    errors.push({
      id: `${observation.runId}-${observation.caseId}-${observation.systemId}-pollution`,
      runId: observation.runId,
      caseId: observation.caseId,
      systemId: observation.systemId,
      type: "retrieval-contamination",
      description: `Retrieved irrelevant memories: ${irrelevant.join(", ")}.`,
      createdAt: now,
    });
  }
  if (retrievedGold.length > 0 && !observation.answerCorrect) {
    errors.push({
      id: `${observation.runId}-${observation.caseId}-${observation.systemId}-answer`,
      runId: observation.runId,
      caseId: observation.caseId,
      systemId: observation.systemId,
      type: "correct-retrieval-wrong-answer",
      description:
        "Relevant memory was retrieved, but the answer did not meet the benchmark rubric.",
      createdAt: now,
    });
  }

  return errors;
}

export class MemoryEvaluationRunner {
  constructor(
    private readonly answerGenerator: MemoryAnswerGenerator,
    private readonly answerEvaluator: MemoryAnswerEvaluator = new RuleBasedMemoryAnswerEvaluator(),
    private readonly adapters: Record<
      MemorySystemId,
      MemorySystemAdapter
    > = createMemorySystemAdapters(),
  ) {}

  async run(
    benchmarks: MemoryBenchmarkCase[] = memoryBenchmarkDataset,
  ): Promise<MemoryEvaluationRunArtifact> {
    const runId = randomUUID();
    const observations: MemoryEvaluationObservation[] = [];
    const errors: MemoryEvaluationError[] = [];

    for (const benchmark of benchmarks) {
      for (const systemId of Object.keys(this.adapters) as MemorySystemId[]) {
        const startedAt = Date.now();
        const execution = await this.adapters[systemId].execute(benchmark);
        const answer = await this.answerGenerator.generate({ benchmark, execution });
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
        errors.push(...deriveErrors(observation, benchmark));
      }
    }

    const benchmarkMap = new Map(benchmarks.map((benchmark) => [benchmark.id, benchmark]));
    const summaries = (Object.keys(this.adapters) as MemorySystemId[]).map((systemId) => {
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
      systemIds: Object.keys(this.adapters) as MemorySystemId[],
      observations,
      summaries,
      errors,
      generatedAt: new Date().toISOString(),
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
