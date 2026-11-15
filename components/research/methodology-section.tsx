import { BookOpen, FlaskConical, TriangleAlert } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const methodology = [
  {
    title: "Dataset",
    detail:
      "30 synthetic, single-answer cases span seven categories: stable facts, preferences, temporal updates, conflicting information, multi-session recall, multi-hop reasoning, and non-memory behavior.",
  },
  {
    title: "Systems",
    detail:
      "Four adapters share one interface: stateless answering, full conversation history, top-3 semantic RAG, and Nexus structured memory with temporal validity, explicitness, importance, and entity signals.",
  },
  {
    title: "Generation",
    detail:
      "Gemini receives the same system prompt and the intent-specific context prepared by each adapter. Deterministic hash embeddings keep retrieval reproducible and remove embedding-provider variance.",
  },
  {
    title: "Scoring",
    detail:
      "Gold memory labels drive Recall@3, Precision@3, MRR, and pollution. Answers are scored by a deterministic criteria evaluator: each case defines required, optional, and prohibited criteria with alias groups, negation-aware context, and short-token support. Temporal and conflict accuracies are category slices of that score.",
  },
];

const limitations = [
  "Synthetic profiles, memories, and rubrics were authored alongside the benchmark rather than collected from real users, so they may overstate separable, well-labeled context.",
  "Thirty cases support directional comparisons, not statistically significant rankings. Every metric is a single deterministic run over the same fixed dataset.",
  "The criteria evaluator is lexical: it checks phrases and alias groups, not entailment. A paraphrase that omits every listed alias can still be scored as a miss, so failure cases should be read alongside aggregate metrics.",
  "The benchmark reports binary answer correctness; the manual review also recorded partial answers, so adjudicated scores that grant half credit for partials are slightly higher than the dashboard figures.",
  "Retrieval uses deterministic hash embeddings rather than a production embedding model, which changes similarity behavior but keeps comparisons reproducible.",
  "Latency includes local adapter work plus the Gemini API round trip; it is end-to-end but not a controlled provider benchmark.",
  "The non-memory category rewards refusal, and short answers depend on the criteria authored for that case. Read failure cases alongside aggregate metrics.",
];

export function MethodologySection() {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <Card className="border-border/70 bg-card/90">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-border/60 bg-background p-2 text-muted-foreground">
              <BookOpen className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                methodology
              </p>
              <CardTitle className="mt-1 text-xl">How the benchmark is scored</CardTitle>
            </div>
          </div>
          <CardDescription>
            Controlled comparisons over one fixed dataset, prompt template, and answer evaluator.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {methodology.map((item, index) => (
            <div
              key={item.title}
              className="rounded-2xl border border-border/60 bg-background/60 p-4"
            >
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {index + 1}
                </span>
                <p className="text-sm font-semibold">{item.title}</p>
              </div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">{item.detail}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-amber-500/20 bg-amber-500/[0.03]">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-2 text-amber-700 dark:text-amber-300">
              <TriangleAlert className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                limitations
              </p>
              <CardTitle className="mt-1 text-xl">Read these before citing results</CardTitle>
            </div>
          </div>
          <CardDescription>
            The dashboard is an engineering artifact, not a peer-reviewed leaderboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {limitations.map((limitation) => (
            <div key={limitation} className="flex gap-2 text-xs leading-5 text-muted-foreground">
              <FlaskConical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-300" />
              <p>{limitation}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
