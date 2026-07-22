import type { AgentState, Conversation, GoogleContextItem, Memory } from "@/types/domain";
import type {
  LLMGenerateRequest,
  LLMGenerationResult,
  LLMProvider,
  LLMStreamChunk,
  LLMUsage,
} from "@/services/llm/provider";

export const agentNames = ["memory-agent", "planner-agent", "email-agent", "research-agent", "scheduler-agent"] as const;
export type AgentName = (typeof agentNames)[number];

export const agentTaskTypes = [
  "workflow.start",
  "memory.scan",
  "research.scan",
  "planning.build",
  "email.compose",
  "schedule.optimize",
] as const;
export type AgentTaskType = (typeof agentTaskTypes)[number];

export type AgentExecutionStatus = "registered" | "idle" | "queued" | "running" | "waiting" | "succeeded" | "failed" | "cancelled";
export type AgentExecutionLogLevel = "debug" | "info" | "success" | "warning" | "error";
export type AgentExecutionEventType =
  | "workflow.started"
  | "workflow.completed"
  | "task.enqueued"
  | "task.started"
  | "task.completed"
  | "task.failed"
  | "task.retried"
  | "agent.log"
  | "agent.delegated"
  | "tool.invoked"
  | "tool.completed"
  | "agent.lifecycle";

export type AgentDefinition = {
  id: AgentName;
  name: string;
  description: string;
  version: string;
  defaultTaskType: AgentTaskType;
  capabilities: string[];
};

export type AgentTask<TPayload = unknown> = {
  id: string;
  type: AgentTaskType;
  targetAgent: AgentName;
  sourceAgent?: AgentName;
  payload: TPayload;
  priority: number;
  attempt: number;
  maxRetries: number;
  createdAt: string;
  dueAt?: string;
  correlationId: string;
};

export type AgentArtifact = {
  id: string;
  kind: string;
  label: string;
  data: unknown;
  createdAt: string;
};

export type AgentSignal = {
  id: string;
  fromAgent: AgentName;
  toAgent?: AgentName;
  type: string;
  payload: Record<string, unknown>;
  timestamp: string;
};

export type AgentToolInvocation<TInput = unknown, TOutput = unknown> = {
  id: string;
  toolName: string;
  input: TInput;
  output?: TOutput;
  success: boolean;
  startedAt: string;
  completedAt?: string;
  error?: string;
};

export type AgentExecutionEvent = {
  id: string;
  runId: string;
  traceId: string;
  type: AgentExecutionEventType;
  agentName?: AgentName;
  taskId?: string;
  timestamp: string;
  level: AgentExecutionLogLevel;
  message: string;
  data?: Record<string, unknown>;
};

export type AgentTraceEntry = {
  id: string;
  runId: string;
  agentName?: AgentName;
  taskId?: string;
  type: AgentExecutionEventType;
  level: AgentExecutionLogLevel;
  message: string;
  timestamp: string;
  data?: Record<string, unknown>;
};

export type AgentSharedState = {
  memories: Memory[];
  contextItems: GoogleContextItem[];
  agentStates: AgentState[];
  conversations: Conversation[];
  signals: AgentSignal[];
  artifacts: AgentArtifact[];
  results: Record<string, unknown>;
};

export type AgentWorkflowInput = {
  prompt: string;
  memories: Memory[];
  contextItems: GoogleContextItem[];
  agentStates: AgentState[];
  conversations?: Conversation[];
  entryAgent?: AgentName;
  conversationId?: string;
};

export type AgentWorkflowResult = {
  runId: string;
  finalMessage: string;
  events: AgentExecutionEvent[];
  trace: AgentTraceEntry[];
  sharedState: AgentSharedState;
};

export type AgentRunResult<TOutput = unknown> = {
  status: AgentExecutionStatus;
  progressPercentage: number;
  summary: string;
  output?: TOutput;
  delegations?: AgentTask[];
  artifacts?: AgentArtifact[];
  agentStatePatch?: Partial<AgentState>;
  toolInvocations?: AgentToolInvocation[];
  llmUsage?: LLMUsage;
};

export type AgentToolContext = {
  runId: string;
  taskId: string;
  agentName: AgentName;
  prompt: string;
  sharedState: AgentSharedState;
};

export type AgentToolDefinition<TInput = unknown, TOutput = unknown> = {
  name: string;
  description: string;
  invoke: (input: TInput, context: AgentToolContext) => Promise<TOutput>;
};

export type AgentLanguageModelRequest = LLMGenerateRequest & {
  agentName: AgentName;
  taskType: AgentTaskType;
};

export type AgentLanguageModelClient = LLMProvider & {
  generateText: (request: AgentLanguageModelRequest) => Promise<LLMGenerationResult>;
  generateStructured: <T>(request: AgentLanguageModelRequest) => Promise<T>;
  streamText: (request: AgentLanguageModelRequest) => AsyncGenerator<LLMStreamChunk, LLMGenerationResult, void>;
};

export type AgentExecutionContext<TPayload = unknown> = {
  runId: string;
  traceId: string;
  rootPrompt: string;
  task: AgentTask<TPayload>;
  sharedState: AgentSharedState;
  llm: AgentLanguageModelClient;
  emit: (event: AgentExecutionEvent) => void;
  enqueue: (task: AgentTask) => void;
  delegate: (targetAgent: AgentName, type: AgentTaskType, payload: unknown, options?: Partial<Pick<AgentTask, "priority" | "maxRetries" | "dueAt">>) => AgentTask;
  invokeTool: <TInput, TOutput>(toolName: string, input: TInput) => Promise<TOutput>;
  log: (level: AgentExecutionLogLevel, message: string, data?: Record<string, unknown>) => void;
  now: () => string;
};

export type AgentModule<TPayload = unknown, TOutput = unknown> = {
  definition: AgentDefinition;
  canHandle: (task: AgentTask<TPayload>) => boolean;
  run: (context: AgentExecutionContext<TPayload>) => Promise<AgentRunResult<TOutput>>;
};
