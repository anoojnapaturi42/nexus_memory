import { createEmbeddingId, createEmbeddingGenerator, buildMemoryEmbeddingInput } from "@/services/memory-embedding-service";
import type { Memory } from "@/types/domain";

export type IngestedMemory = Memory & {
  embeddingId: string;
  embedding: number[];
  normalizedText: string;
};

export class MemoryIngestionService {
  constructor(private readonly embeddingGenerator = createEmbeddingGenerator()) {}

  async embedText(text: string) {
    return this.embeddingGenerator.embedText(text);
  }

  async embedTexts(texts: string[]) {
    return this.embeddingGenerator.embedTexts(texts);
  }

  async ingest(memory: Memory): Promise<IngestedMemory> {
    const embeddingId = memory.embeddingId || createEmbeddingId();
    const normalizedText = buildMemoryEmbeddingInput(memory);
    const embedding = await this.embeddingGenerator.embedText(normalizedText);

    return {
      ...memory,
      embeddingId,
      embedding,
      normalizedText,
    };
  }

  async ingestMany(memories: Memory[]): Promise<IngestedMemory[]> {
    const texts = memories.map((memory) => buildMemoryEmbeddingInput(memory));
    const embeddings = await this.embedTexts(texts);

    return memories.map((memory, index) => ({
      ...memory,
      embeddingId: memory.embeddingId || createEmbeddingId(),
      embedding: embeddings[index] ?? [],
      normalizedText: texts[index] ?? "",
    }));
  }
}

export const memoryIngestionService = new MemoryIngestionService();
