import { createHash, randomUUID } from "node:crypto";
import { buildMemoryText, buildQueryText, tokenize, uniqueTokens } from "@/lib/memory-retrieval/text-utils";
import type { Memory } from "@/types/domain";

export const EMBEDDING_DIMENSIONS = 1536;

export interface EmbeddingGenerator {
  readonly provider: "mock" | "gemini";
  embedText(text: string): Promise<number[]>;
  embedTexts(texts: string[]): Promise<number[][]>;
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest();
}

function deterministicEmbedding(text: string) {
  const tokens = uniqueTokens(tokenize(text));
  const vector = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);

  if (tokens.length === 0) {
    return vector;
  }

  for (const token of tokens) {
    const digest = hashToken(token);
    for (let index = 0; index < digest.length; index += 1) {
      const slot = (digest[index] + index * 17) % EMBEDDING_DIMENSIONS;
      const direction = digest[(index + 7) % digest.length] / 255 - 0.5;
      vector[slot] += direction;
    }
  }

  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (magnitude === 0) return vector;
  return vector.map((value) => value / magnitude);
}

export class MockEmbeddingGenerator implements EmbeddingGenerator {
  readonly provider = "mock" as const;

  async embedText(text: string): Promise<number[]> {
    return deterministicEmbedding(text);
  }

  async embedTexts(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((text) => this.embedText(text)));
  }
}

export class GeminiEmbeddingGenerator implements EmbeddingGenerator {
  readonly provider = "gemini" as const;

  async embedText(text: string): Promise<number[]> {
    void text;
    throw new Error("gemini embeddings are not wired yet");
  }

  async embedTexts(texts: string[]): Promise<number[][]> {
    void texts;
    throw new Error("gemini embeddings are not wired yet");
  }
}

export function createEmbeddingGenerator(): EmbeddingGenerator {
  return new MockEmbeddingGenerator();
}

export const memoryEmbeddingService = createEmbeddingGenerator();

export function buildMemoryEmbeddingInput(memory: Memory) {
  return buildMemoryText(memory);
}

export function buildQueryEmbeddingInput(query: string) {
  return buildQueryText(query);
}

export function createEmbeddingId() {
  return randomUUID();
}
