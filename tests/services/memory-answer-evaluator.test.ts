import assert from "node:assert/strict";
import test from "node:test";
import { memoryBenchmarkDataset } from "../../mock/evaluation/memory-benchmark-dataset.ts";
import { CriteriaMemoryAnswerEvaluator } from "../../services/evaluation/memory-answer-evaluator.ts";

const evaluator = new CriteriaMemoryAnswerEvaluator();

function benchmark(id: string) {
  const found = memoryBenchmarkDataset.find((candidate) => candidate.id === id);
  assert.ok(found, `missing benchmark case ${id}`);
  return found;
}

test("every benchmark expected answer satisfies criteria-v2", () => {
  for (const current of memoryBenchmarkDataset) {
    const result = evaluator.evaluate({ benchmark: current, answer: current.expectedAnswer });
    assert.equal(result.answerCorrect, true, `${current.id}: ${result.evaluatorNotes}`);
    assert.equal(result.evaluator, "criteria-v2");
  }
});

test("prohibited criteria reject a stale recommendation but allow a negated mention", () => {
  const temporal = benchmark("temporal-update-01");

  const stale = evaluator.evaluate({
    benchmark: temporal,
    answer: "Focus on frontend engineering roles next.",
  });
  assert.equal(stale.answerCorrect, false);
  assert.ok(stale.criterionResults?.some((result) => result.id === "not-frontend" && !result.passed));

  const negated = evaluator.evaluate({
    benchmark: temporal,
    answer: "Focus on backend and AI engineering roles, not frontend roles.",
  });
  assert.equal(negated.answerCorrect, true, negated.evaluatorNotes);
});

test("non-memory cases reject fabricated transient details", () => {
  const transient = benchmark("non-memory-01");

  const fabricated = evaluator.evaluate({
    benchmark: transient,
    answer: "You drank an espresso during the late-night study session.",
  });
  assert.equal(fabricated.answerCorrect, false);

  const refusal = evaluator.evaluate({
    benchmark: transient,
    answer: "I do not have a durable memory of that transient detail.",
  });
  assert.equal(refusal.answerCorrect, true, refusal.evaluatorNotes);
});

test("short tokens and optional criteria are handled", () => {
  const multiSession = benchmark("multi-session-02");

  const withShortToken = evaluator.evaluate({
    benchmark: multiSession,
    answer: "Study from 7:30 to 9:30 each morning before the August 25 interview.",
  });
  assert.equal(withShortToken.answerCorrect, true, withShortToken.evaluatorNotes);

  const withoutOptionalCadence = evaluator.evaluate({
    benchmark: multiSession,
    answer: "Use the 7:30 to 9:30 morning block before the August 25 interview.",
  });
  assert.equal(withoutOptionalCadence.answerCorrect, true);
  assert.ok((withoutOptionalCadence.criteriaScore ?? 0) < 1);
});

test("answers that echo the prompt without the goal memory do not pass multi-session-03", () => {
  const multiSession = benchmark("multi-session-03");

  const echo = evaluator.evaluate({
    benchmark: multiSession,
    answer: "Run your prototype review process through short weekly feedback sessions.",
  });
  assert.equal(echo.answerCorrect, false);
  assert.ok(echo.criterionResults?.some((result) => result.id === "prototype-goal" && !result.passed));
});
