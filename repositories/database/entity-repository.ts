import { randomUUID } from "node:crypto";
import { BaseDatabaseRepository } from "@/repositories/database/base-repository";
import { mockDatabaseEntities } from "@/mock/database";
import type { DatabaseEntityRecord, DatabaseJson } from "@/types/database";

type EntityInsert = Omit<DatabaseEntityRecord, "created_at" | "updated_at"> & {
  created_at?: string;
  updated_at?: string;
};

export class EntityDatabaseRepository extends BaseDatabaseRepository<DatabaseEntityRecord, EntityInsert, Partial<EntityInsert>> {
  protected fallbackRows = mockDatabaseEntities;

  constructor() {
    super("entities");
  }

  protected fromRow(row: Record<string, unknown>): DatabaseEntityRecord {
    return {
      id: String(row.id ?? randomUUID()),
      entity_type: String(row.entity_type ?? "unknown"),
      name: String(row.name ?? ""),
      metadata: (row.metadata as Record<string, DatabaseJson>) ?? {},
      created_at: String(row.created_at ?? new Date().toISOString()),
      updated_at: String(row.updated_at ?? new Date().toISOString()),
    };
  }

  protected toInsertPayload(input: EntityInsert): Record<string, unknown> {
    return {
      ...input,
      created_at: input.created_at ?? new Date().toISOString(),
      updated_at: input.updated_at ?? new Date().toISOString(),
    };
  }

  protected toUpdatePayload(input: Partial<EntityInsert>): Record<string, unknown> {
    return {
      ...input,
      updated_at: new Date().toISOString(),
    };
  }

  protected createFallbackRecord(input: EntityInsert): DatabaseEntityRecord {
    const now = new Date().toISOString();
    return {
      id: input.id ?? randomUUID(),
      entity_type: input.entity_type,
      name: input.name,
      metadata: (input.metadata ?? {}) as Record<string, DatabaseJson>,
      created_at: input.created_at ?? now,
      updated_at: input.updated_at ?? now,
    };
  }

  protected applyFallbackUpdate(record: DatabaseEntityRecord, input: Partial<EntityInsert>): DatabaseEntityRecord {
    return {
      ...record,
      ...input,
      updated_at: new Date().toISOString(),
    };
  }
}

export const entityDatabaseRepository = new EntityDatabaseRepository();
