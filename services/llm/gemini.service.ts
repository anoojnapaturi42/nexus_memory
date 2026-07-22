import { GoogleGenerativeAI } from "@google/generative-ai";
import type { GeminiEnvConfig } from "./env";
import type { LLMGenerateRequest, LLMGenerationResult, LLMProvider, LLMStreamChunk, LLMUsage } from "./provider";

function structuredLog(event: string, data: Record<string, unknown>) {
  console.info(
    JSON.stringify({
      scope: "llm",
      provider: "gemini",
      event,
      timestamp: new Date().toISOString(),
      ...data,
    }),
  );
}

function serializeContext(context?: Record<string, unknown>) {
  if (!context || Object.keys(context).length === 0) return "";
  return `context:\n${JSON.stringify(context, null, 2)}`;
}

function buildPrompt(request: LLMGenerateRequest) {
  const parts = [request.systemPrompt?.trim(), request.prompt.trim(), serializeContext(request.context)].filter(Boolean);
  return parts.join("\n\n");
}

function toUsage(raw: any, fallbackText: string): LLMUsage {
  const inputTokens = Number(raw?.promptTokenCount ?? raw?.inputTokenCount ?? Math.max(1, Math.ceil(fallbackText.length / 4)));
  const outputTokens = Number(raw?.candidatesTokenCount ?? raw?.outputTokenCount ?? Math.max(1, Math.ceil(fallbackText.length / 4)));
  const totalTokens = Number(raw?.totalTokenCount ?? inputTokens + outputTokens);

  return {
    inputTokens,
    outputTokens,
    totalTokens,
  };
}

function getTextFromResponse(response: any) {
  if (typeof response?.text === "function") return String(response.text());
  if (typeof response?.response?.text === "function") return String(response.response.text());
  if (typeof response?.candidates?.[0]?.content?.parts?.[0]?.text === "string") {
    return String(response.candidates[0].content.parts[0].text);
  }
  return "";
}

export class GeminiLLMService implements LLMProvider {
  provider = "gemini" as const;

  private readonly client: GoogleGenerativeAI;
  private readonly config: GeminiEnvConfig;

  constructor(config: GeminiEnvConfig) {
    this.config = config;
    this.client = new GoogleGenerativeAI(config.apiKey);
  }

  private getTextModel(modelName?: string) {
    return this.client.getGenerativeModel({
      model: modelName ?? this.config.model,
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 2048,
      },
    });
  }

  private getEmbeddingModel(modelName?: string) {
    return this.client.getGenerativeModel({
      model: modelName ?? this.config.embeddingModel,
    });
  }

  async generate(request: LLMGenerateRequest): Promise<LLMGenerationResult> {
    const startedAt = Date.now();
    const model = this.getTextModel(request.model);
    const prompt = buildPrompt(request);
    structuredLog("generate.started", {
      agentName: request.agentName ?? "unknown",
      taskType: request.taskType ?? "unknown",
      model: request.model ?? this.config.model,
    });

    const response: any = await model.generateContent(prompt);
    const text = getTextFromResponse(response);
    const usage = toUsage(response?.response?.usageMetadata ?? response?.usageMetadata, text);

    structuredLog("generate.completed", {
      agentName: request.agentName ?? "unknown",
      taskType: request.taskType ?? "unknown",
      model: request.model ?? this.config.model,
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

  async *stream(request: LLMGenerateRequest): AsyncGenerator<LLMStreamChunk, LLMGenerationResult, void> {
    const startedAt = Date.now();
    const model = this.getTextModel(request.model);
    const prompt = buildPrompt(request);
    structuredLog("stream.started", {
      agentName: request.agentName ?? "unknown",
      taskType: request.taskType ?? "unknown",
      model: request.model ?? this.config.model,
    });

    const streamResult: any = await model.generateContentStream(prompt);
    let fullText = "";

    for await (const chunk of streamResult.stream ?? []) {
      const text = typeof chunk?.text === "function" ? String(chunk.text()) : "";
      if (!text) continue;
      fullText += text;
      yield { text };
    }

    const finalResponse: any = streamResult.response ? await streamResult.response : null;
    const text = getTextFromResponse(finalResponse) || fullText;
    const usage = toUsage(finalResponse?.usageMetadata, text);

    structuredLog("stream.completed", {
      agentName: request.agentName ?? "unknown",
      taskType: request.taskType ?? "unknown",
      model: request.model ?? this.config.model,
      durationMs: Date.now() - startedAt,
      usage,
    });

    return {
      provider: this.provider,
      model: request.model ?? this.config.model,
      text,
      usage,
      raw: finalResponse,
    };
  }

  async embeddings(texts: string[], options?: { model?: string }): Promise<{ provider: string; model: string; embeddings: number[][]; usage?: LLMUsage; raw?: unknown }> {
    const modelName = options?.model ?? this.config.embeddingModel;
    const model = this.getEmbeddingModel(modelName);
    const startedAt = Date.now();
    const embeddings = await Promise.all(
      texts.map(async (text) => {
        const response: any = await model.embedContent(text);
        const values = response?.embedding?.values ?? response?.embedding ?? [];
        return Array.isArray(values) ? values.map((value: unknown) => Number(value)) : [];
      }),
    );

    structuredLog("embeddings.completed", {
      model: modelName,
      count: texts.length,
      durationMs: Date.now() - startedAt,
    });

    return {
      provider: this.provider,
      model: modelName,
      embeddings,
      raw: null,
    };
  }
}
