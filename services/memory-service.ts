import { BaseService } from "@/services/base-service";
import { memoryDatabaseRepository } from "@/repositories/database";
import type { Memory } from "@/types/domain";

function toMemory(record: {
  id: string;
  content: string;
  source_app: string;
  importance_score: number;
  tags?: string[];
  metadata?: Record<string, unknown>;
  created_at: string;
}): Memory {
  const metadataTags = Array.isArray(record.metadata?.tags) ? record.metadata.tags.map(String) : [];

  return {
    id: record.id,
    content: record.content,
    sourceApp: record.source_app,
    timestamp: record.created_at,
    importanceScore: record.importance_score,
    embeddingId: `${record.id}-embedding`,
    relatedEntityIds: [],
    tags: record.tags?.length ? record.tags : metadataTags.length ? metadataTags : [record.source_app],
  };
}

export class MemoryService extends BaseService {
  constructor(private readonly repository = memoryDatabaseRepository) {
    super("/api/memories");
  }

  async list(): Promise<Memory[]> {
    const result = await this.repository.list();
    return result.items.map(toMemory);
  }

  async getById(id: string): Promise<Memory | null> {
    const result = await this.repository.getById(id);
    return result.item ? toMemory(result.item) : null;
  }
}

export const memoryService = new MemoryService();
