import type {
  MemoryAnswerCriterion,
  MemoryAnswerCriterionResult,
  MemoryBenchmarkCase,
  MemoryEvaluationObservation,
} from "@/types/memory-evaluation";

const defaultContextWindow = 8;

/**
 * Cues that invert or downgrade a prohibited statement. They are matched as
 * phrases, not loose substrings, so "not" cannot be found inside another word.
 */
export const defaultNegationCues = [
  "not",
  "never",
  "avoid",
  "avoids",
  "avoiding",
  "instead",
  "rather",
  "without",
  "over",
  "less",
  "do not",
  "does not",
  "did not",
  "is not",
  "are not",
  "was not",
  "were not",
  "will not",
  "cannot",
  "can not",
  "no longer",
  "stop",
  "stopped",
];

/**
 * Cues that make an old fact reference acceptable. Temporal answers often say
 * "moved from August 18 to August 25" or "August 18 was the original date".
 */
export const defaultHistoricalCues = [
  ...defaultNegationCues,
  "was",
  "were",
  "previously",
  "originally",
  "planned",
  "moved",
  "rescheduled",
  "changed",
  "from",
  "earlier",
  "old",
  "previous",
  "former",
  "used to",
  "no longer",
];

export type CriteriaEvaluation = Pick<
  MemoryEvaluationObservation,
  "answerCorrect" | "taskSucceeded" | "evaluator" | "evaluatorNotes" | "criteriaScore" | "criterionResults"
>;

type AliasOccurrence = {
  alias: string;
  index: number;
  length: number;
};

export function normalizeAnswerText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/can['’]t/g, "cannot")
    .replace(/won['’]t/g, "will not")
    .replace(/n['’]t/g, " not")
    .replace(/['’]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function tokenizeAnswerText(value: string) {
  const normalized = normalizeAnswerText(value);
  return normalized ? normalized.split(" ") : [];
}

function findSequenceOccurrences(tokens: string[], phrase: string[]) {
  if (phrase.length === 0 || phrase.length > tokens.length) return [];
  const indices: number[] = [];
  for (let index = 0; index <= tokens.length - phrase.length; index += 1) {
    if (phrase.every((token, offset) => tokens[index + offset] === token)) {
      indices.push(index);
    }
  }
  return indices;
}

function findAliasOccurrences(tokens: string[], aliases: string[]): AliasOccurrence[] {
  const occurrences: AliasOccurrence[] = [];

  for (const alias of aliases) {
    const aliasTokens = tokenizeAnswerText(alias);
    for (const index of findSequenceOccurrences(tokens, aliasTokens)) {
      occurrences.push({ alias, index, length: aliasTokens.length });
    }
  }

  return occurrences;
}

function hasAllowedContext(
  tokens: string[],
  occurrence: AliasOccurrence,
  allowedContext: string[],
  window: number,
) {
  const start = Math.max(0, occurrence.index - window);
  const end = Math.min(tokens.length, occurrence.index + occurrence.length + window);
  const windowTokens = tokens.slice(start, end);

  return allowedContext.some((cue) => {
    const cueTokens = tokenizeAnswerText(cue);
    return findSequenceOccurrences(windowTokens, cueTokens).length > 0;
  });
}

function evaluateCriterion(
  criterion: MemoryAnswerCriterion,
  tokens: string[],
): MemoryAnswerCriterionResult {
  const required = criterion.required ?? true;
  const prohibited = criterion.prohibited ?? false;
  const weight = criterion.weight ?? 1;
  const occurrences = criterion.groups.flatMap((aliases) => findAliasOccurrences(tokens, aliases));

  let passed = false;
  let matched: string[] = [];

  if (prohibited) {
    const allowedContext = criterion.allowedContext ?? defaultNegationCues;
    const window = criterion.contextWindow ?? defaultContextWindow;
    const violations = occurrences.filter(
      (occurrence) => !hasAllowedContext(tokens, occurrence, allowedContext, window),
    );
    passed = violations.length === 0;
    matched = violations.map((occurrence) => occurrence.alias);
  } else {
    const groupMatches = criterion.groups.map((aliases) =>
      findAliasOccurrences(tokens, aliases),
    );
    passed = groupMatches.every((matches) => matches.length > 0);
    if (passed && criterion.atStart) {
      passed = groupMatches[0].some((occurrence) => occurrence.index === 0);
    }
    matched = groupMatches.map((matches) => matches[0]?.alias).filter(Boolean) as string[];
  }

  return {
    id: criterion.id,
    label: criterion.label,
    required,
    prohibited,
    weight,
    passed,
    matched,
  };
}

function legacyTokenCoverage(expected: string, answer: string) {
  const ignored = new Set([
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
  ]);
  const meaningful = (text: string) =>
    [...new Set(tokenizeAnswerText(text))].filter(
      (token) => token.length > 2 && !ignored.has(token),
    );
  const expectedTokens = meaningful(expected);
  if (expectedTokens.length === 0) return 1;
  const answerTokens = new Set(meaningful(answer));
  return expectedTokens.filter((token) => answerTokens.has(token)).length / expectedTokens.length;
}

/**
 * Evaluator v2.
 *
 * Correctness is driven by structured criteria instead of raw token coverage.
 * A criterion passes when every group finds at least one alias. Prohibited
 * criteria pass when the alias is absent, or when every occurrence sits next to
 * a negation/historical cue. Optional criteria contribute to the score but not
 * to correctness.
 */
export class CriteriaMemoryAnswerEvaluator {
  readonly id = "criteria-v2" as const;

  evaluate({ benchmark, answer }: { benchmark: MemoryBenchmarkCase; answer: string }): CriteriaEvaluation {
    const criteria = benchmark.answerCriteria ?? [];

    if (criteria.length === 0) {
      const expectedCoverage = legacyTokenCoverage(benchmark.expectedAnswer, answer);
      const rubricCoverage = benchmark.answerRubric.length
        ? benchmark.answerRubric.reduce(
            (total, rubric) => total + legacyTokenCoverage(rubric, answer),
            0,
          ) / benchmark.answerRubric.length
        : 1;
      const answerCorrect = expectedCoverage >= 0.5 && rubricCoverage >= 0.35;

      return {
        answerCorrect,
        taskSucceeded: benchmark.taskSuccessCriteria?.length ? answerCorrect : null,
        evaluator: "criteria-v2",
        evaluatorNotes:
          `criteria-v2: no answerCriteria; legacy fallback ` +
          `expected-token-coverage=${expectedCoverage.toFixed(2)}; rubric-coverage=${rubricCoverage.toFixed(2)}`,
        criteriaScore: (expectedCoverage + rubricCoverage) / 2,
        criterionResults: [],
      };
    }

    const tokens = tokenizeAnswerText(answer);
    const criterionResults = criteria.map((criterion) => evaluateCriterion(criterion, tokens));
    const requiredResults = criterionResults.filter((result) => result.required);
    const failed = requiredResults.filter((result) => !result.passed);
    const answerCorrect = failed.length === 0;

    const totalWeight = criterionResults.reduce((total, result) => total + result.weight, 0);
    const earnedWeight = criterionResults.reduce(
      (total, result) => total + (result.passed ? result.weight : 0),
      0,
    );
    const criteriaScore = totalWeight === 0 ? 1 : earnedWeight / totalWeight;

    const notes = [
      `criteria-v2: ${requiredResults.length - failed.length}/${requiredResults.length} required passed`,
      `score=${criteriaScore.toFixed(2)}`,
      failed.length > 0 ? `failed=${failed.map((result) => result.id).join(",")}` : null,
      requiredResults.length - failed.length < requiredResults.length
        ? `details=${criterionResults
            .filter((result) => !result.passed)
            .map((result) => `${result.id}${result.prohibited ? "(prohibited)" : ""}`)
            .join(",")}`
        : null,
    ]
      .filter(Boolean)
      .join("; ");

    return {
      answerCorrect,
      taskSucceeded: benchmark.taskSuccessCriteria?.length ? answerCorrect : null,
      evaluator: "criteria-v2",
      evaluatorNotes: notes,
      criteriaScore,
      criterionResults,
    };
  }
}
