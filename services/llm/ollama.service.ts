import type { OllamaEnvConfig } from "./ollama.env";
import type {
  LLMBatchEmbeddingResult,
  LLMGenerateRequest,
  LLMGenerationResult,
  LLMProvider,
  LLMStreamChunk,
  LLMUsage,
} from "./provider";

type OllamaChatResponse = {
  message?: { content?: string };
  prompt_eval_count?: number;
  eval_count?: number;
};

function buildMessages(request: LLMGenerateRequest) {
  const context =
    request.context && Object.keys(request.context).length > 0
      ? `\n\ncontext:\n${JSON.stringify(request.context, null, 2)}`
      : "";
  return [
    ...(request.systemPrompt ? [{ role: "system", content: request.systemPrompt }] : []),
    { role: "user", content: `${request.prompt}${context}` },
  ];
}

function usageFrom(response: OllamaChatResponse, text: string): LLMUsage {
  const inputTokens = response.prompt_eval_count ?? Math.max(1, Math.ceil(text.length / 4));
  const outputTokens = response.eval_count ?? Math.max(1, Math.ceil(text.length / 4));
  return { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens };
}

function structuredLog(event: string, data: Record<string, unknown>) {
  console.info(
    JSON.stringify({
      scope: "llm",
      provider: "ollama",
      event,
      timestamp: new Date().toISOString(),
      ...data,
    }),
  );
}

export class OllamaLLMService implements LLMProvider {
  provider = "ollama";

  constructor(private readonly config: OllamaEnvConfig) {}

  async generate(request: LLMGenerateRequest): Promise<LLMGenerationResult> {
    const startedAt = Date.now();
    const response = await this.requestWithRetry(request);
    const text = response.message?.content?.trim() ?? "";
    const usage = usageFrom(response, text);

    structuredLog("generate.completed", {
      model: request.model ?? this.config.model,
      taskType: request.taskType ?? "unknown",
      durationMs: Date.now() - startedAt,
      usage,
    });

    return {
      provider: this.provider,
      model: request.model ?? this.config.model,
      text,
      usage,
      raw: response,
    };
  }

  async *stream(
    request: LLMGenerateRequest,
  ): AsyncGenerator<LLMStreamChunk, LLMGenerationResult, void> {
    const generated = await this.generate(request);
    yield { text: generated.text, usage: generated.usage, done: true };
    return generated;
  }

  async embeddings(texts: string[]): Promise<LLMBatchEmbeddingResult> {
    throw new Error(`Ollama embeddings are not configured for ${texts.length} input(s).`);
  }

  private async requestWithRetry(
    request: LLMGenerateRequest,
    maxAttempts = 3,
  ): Promise<OllamaChatResponse> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const response = await fetch(`${this.config.baseUrl}/api/chat`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: request.model ?? this.config.model,
            messages: buildMessages(request),
            stream: false,
            options: {
              temperature: request.temperature ?? 0,
              num_predict: request.maxOutputTokens ?? 256,
            },
          }),
          signal: AbortSignal.timeout(60_000),
        });

        if (response.ok) return (await response.json()) as OllamaChatResponse;

        const retryable = response.status === 429 || response.status >= 500;
        const message = `ollama request failed with status ${response.status}`;
        if (!retryable || attempt === maxAttempts) throw new Error(message);
        lastError = new Error(message);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("ollama request failed");
        if (attempt === maxAttempts) break;
      }

      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** (attempt - 1)));
    }

    throw lastError ?? new Error("ollama request failed");
  }
}
