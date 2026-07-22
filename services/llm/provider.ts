export type LLMUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export type LLMGenerateRequest = {
  prompt: string;
  systemPrompt?: string;
  context?: Record<string, unknown>;
  temperature?: number;
  maxOutputTokens?: number;
  model?: string;
  traceId?: string;
  runId?: string;
  agentName?: string;
  taskType?: string;
};

export type LLMGenerationResult = {
  provider: string;
  model: string;
  text: string;
  usage: LLMUsage;
  raw?: unknown;
};

export type LLMStreamChunk = {
  text: string;
  usage?: LLMUsage;
  done?: boolean;
};

export type LLMBatchEmbeddingResult = {
  provider: string;
  model: string;
  embeddings: number[][];
  usage?: LLMUsage;
  raw?: unknown;
};

export interface LLMProvider {
  provider: string;
  generate(request: LLMGenerateRequest): Promise<LLMGenerationResult>;
  stream(request: LLMGenerateRequest): AsyncGenerator<LLMStreamChunk, LLMGenerationResult, void>;
  embeddings(texts: string[], options?: { model?: string }): Promise<LLMBatchEmbeddingResult>;
}
