import type { ProactiveRecommendation } from "@/types/proactive";

export function formatProactiveSummary(recommendation: ProactiveRecommendation) {
  return `${recommendation.title} - ${recommendation.summary}`;
}

export function formatProactiveExplanation(recommendation: ProactiveRecommendation) {
  return [recommendation.explanation, recommendation.whyNow, ...recommendation.evidence.map((item) => `evidence: ${item}`)]
    .filter(Boolean)
    .join(" ");
}
