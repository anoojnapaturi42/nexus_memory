export const memorySystemIds = [
  "stateless",
  "conversation-history",
  "semantic-rag",
  "nexus-structured-memory",
] as const;

export type MemorySystemId = (typeof memorySystemIds)[number];

export const benchmarkCategories = [
  "stable-fact",
  "preference",
  "temporal-update",
  "conflicting-information",
  "multi-session",
  "multi-hop",
  "non-memory",
] as const;

export type BenchmarkCategory = (typeof benchmarkCategories)[number];

export type BenchmarkMemory = {
  id: string;
  content: string;
  createdAt: string;
  category: "fact" | "preference" | "goal" | "experience" | "relationship";
  importanceScore: number;
  validity: "current" | "superseded" | "uncertain";
  sourceConversationId: string;
  explicit: boolean;
  entityIds?: string[];
};

export type BenchmarkConversationTurn = {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
};

export type MemoryBenchmarkCase = {
  id: string;
  title: string;
  category: BenchmarkCategory;
  profileId: string;
  prompt: string;
  conversations: BenchmarkConversationTurn[];
  candidateMemories: BenchmarkMemory[];
  goldMemoryIds: string[];
  expectedAnswer: string;
  answerRubric: string[];
  taskSuccessCriteria?: string[];
  notes?: string;
};

export type MemorySystemConfiguration = {
  id: MemorySystemId;
  label: string;
  description: string;
  usesConversationHistory: boolean;
  usesSemanticRetrieval: boolean;
  usesStructuredMemory: boolean;
  usesConsolidation: boolean;
  usesTemporalValidity: boolean;
  usesRelationshipContext: boolean;
  usesImportanceWeighting: boolean;
};

export type MemoryRetrievalReason = {
  memoryId: string;
  score: number;
  signals: string[];
};

export type MemorySystemExecution = {
  systemId: MemorySystemId;
  prompt: string;
  context: string;
  retrievedMemoryIds: string[];
  retrievalReasons: MemoryRetrievalReason[];
  retrievalLatencyMs: number;
};

export type MemoryEvaluationUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export type MemoryEvaluationObservation = {
  runId: string;
  caseId: string;
  systemId: MemorySystemId;
  retrievedMemoryIds: string[];
  generatedAnswer: string;
  answerCorrect: boolean;
  taskSucceeded: boolean | null;
  latencyMs: number;
  usage: MemoryEvaluationUsage;
  evaluatedAt: string;
  evaluator: "rule-based" | "llm-judge" | "human";
  evaluatorNotes?: string;
};

export type RetrievalMetrics = {
  recallAtK: number;
  precisionAtK: number;
  meanReciprocalRank: number;
  temporalAccuracy: number | null;
  contradictionResolutionAccuracy: number | null;
  memoryPollutionRate: number;
};

export type AnswerMetrics = {
  answerAccuracy: number;
  taskSuccessRate: number | null;
};

export type PerformanceMetrics = {
  meanLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  meanInputTokens: number;
  meanOutputTokens: number;
  meanTotalTokens: number;
};

export type MemoryEvaluationMetrics = RetrievalMetrics & AnswerMetrics & PerformanceMetrics;

export type MemoryEvaluationSummary = {
  runId: string;
  systemId: MemorySystemId;
  benchmarkCaseCount: number;
  completedCaseCount: number;
  metrics: MemoryEvaluationMetrics;
  generatedAt: string;
};

export type MemoryEvaluationRunArtifact = {
  runId: string;
  benchmarkCaseCount: number;
  systemIds: MemorySystemId[];
  observations: MemoryEvaluationObservation[];
  summaries: MemoryEvaluationSummary[];
  errors: MemoryEvaluationError[];
  generatedAt: string;
};

export const ablationIds = [
  "without-consolidation",
  "without-temporal-validity",
  "without-importance-weighting",
  "without-relationship-context",
] as const;

export type MemoryAblationId = (typeof ablationIds)[number];

export type MemoryAblationDefinition = {
  id: MemoryAblationId;
  label: string;
  disabledCapability: keyof Pick<
    MemorySystemConfiguration,
    | "usesConsolidation"
    | "usesTemporalValidity"
    | "usesImportanceWeighting"
    | "usesRelationshipContext"
  >;
};

export type MemoryEvaluationErrorType =
  | "missed-relevant-memory"
  | "stale-memory-used"
  | "entity-confusion"
  | "retrieval-contamination"
  | "correct-retrieval-wrong-answer"
  | "incorrect-evaluation";

export type MemoryEvaluationError = {
  id: string;
  runId: string;
  caseId: string;
  systemId: MemorySystemId;
  type: MemoryEvaluationErrorType;
  description: string;
  createdAt: string;
};
