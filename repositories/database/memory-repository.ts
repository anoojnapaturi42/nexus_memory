import { randomUUID } from "node:crypto";
import { BaseDatabaseRepository } from "@/repositories/database/base-repository";
import { mockDatabaseMemories } from "@/mock/database";
import type { DatabaseRuntime } from "@/lib/database/client";
import type { DatabaseJson, DatabaseMemoryRecord } from "@/types/database";

type MemoryInsert = Omit<DatabaseMemoryRecord, "created_at" | "updated_at"> & {
  created_at?: string;
  updated_at?: string;
};

export class MemoryDatabaseRepository extends BaseDatabaseRepository<DatabaseMemoryRecord, MemoryInsert, Partial<MemoryInsert>> {
  protected fallbackRows = mockDatabaseMemories;

  constructor(runtime?: DatabaseRuntime) {
    super("memories", runtime);
  }

  protected fromRow(row: Record<string, unknown>): DatabaseMemoryRecord {
    const metadata = (row.metadata as Record<string, DatabaseJson>) ?? {};
    const metadataTags = Array.isArray(metadata.tags) ? metadata.tags.map(String) : [];

    return {
      id: String(row.id ?? randomUUID()),
      content: String(row.content ?? ""),
      source_app: String(row.source_app ?? "unknown"),
      importance_score: Number(row.importance_score ?? 0),
      tags: Array.isArray(row.tags) ? row.tags.map(String) : metadataTags,
      embedding: Array.isArray(row.embedding) ? (row.embedding as number[]) : null,
      metadata,
      created_at: String(row.created_at ?? new Date().toISOString()),
      updated_at: String(row.updated_at ?? new Date().toISOString()),
    };
  }

  protected toInsertPayload(input: MemoryInsert): Record<string, unknown> {
    return {
      ...input,
      created_at: input.created_at ?? new Date().toISOString(),
      updated_at: input.updated_at ?? new Date().toISOString(),
    };
  }

  protected toUpdatePayload(input: Partial<MemoryInsert>): Record<string, unknown> {
    return {
      ...input,
      updated_at: new Date().toISOString(),
    };
  }

  protected createFallbackRecord(input: MemoryInsert): DatabaseMemoryRecord {
    const now = new Date().toISOString();
    return {
      id: input.id ?? randomUUID(),
      content: input.content,
      source_app: input.source_app,
      importance_score: input.importance_score,
      tags: input.tags ?? [],
      embedding: input.embedding ?? null,
      metadata: (input.metadata ?? {}) as Record<string, DatabaseJson>,
      created_at: input.created_at ?? now,
      updated_at: input.updated_at ?? now,
    };
  }

  protected applyFallbackUpdate(record: DatabaseMemoryRecord, input: Partial<MemoryInsert>): DatabaseMemoryRecord {
    return {
      ...record,
      ...input,
      updated_at: new Date().toISOString(),
    };
  }
}

export const memoryDatabaseRepository = new MemoryDatabaseRepository();
