import { randomUUID } from "node:crypto";
import { BaseDatabaseRepository } from "@/repositories/database/base-repository";
import { mockDatabaseRelationships } from "@/mock/database";
import type { DatabaseJson, DatabaseRelationshipRecord } from "@/types/database";

type RelationshipInsert = Omit<DatabaseRelationshipRecord, "created_at" | "updated_at"> & {
  created_at?: string;
  updated_at?: string;
};

export class RelationshipDatabaseRepository extends BaseDatabaseRepository<
  DatabaseRelationshipRecord,
  RelationshipInsert,
  Partial<RelationshipInsert>
> {
  protected fallbackRows = mockDatabaseRelationships;

  constructor() {
    super("relationships");
  }

  protected fromRow(row: Record<string, unknown>): DatabaseRelationshipRecord {
    return {
      id: String(row.id ?? randomUUID()),
      source_entity_id: String(row.source_entity_id ?? ""),
      target_entity_id: String(row.target_entity_id ?? ""),
      relationship_type: String(row.relationship_type ?? "RELATED_TO"),
      weight: Number(row.weight ?? 0.5),
      metadata: (row.metadata as Record<string, DatabaseJson>) ?? {},
      created_at: String(row.created_at ?? new Date().toISOString()),
      updated_at: String(row.updated_at ?? new Date().toISOString()),
    };
  }

  protected toInsertPayload(input: RelationshipInsert): Record<string, unknown> {
    return {
      ...input,
      created_at: input.created_at ?? new Date().toISOString(),
      updated_at: input.updated_at ?? new Date().toISOString(),
    };
  }

  protected toUpdatePayload(input: Partial<RelationshipInsert>): Record<string, unknown> {
    return {
      ...input,
      updated_at: new Date().toISOString(),
    };
  }

  protected createFallbackRecord(input: RelationshipInsert): DatabaseRelationshipRecord {
    const now = new Date().toISOString();
    return {
      id: input.id ?? randomUUID(),
      source_entity_id: input.source_entity_id,
      target_entity_id: input.target_entity_id,
      relationship_type: input.relationship_type,
      weight: input.weight,
      metadata: (input.metadata ?? {}) as Record<string, DatabaseJson>,
      created_at: input.created_at ?? now,
      updated_at: input.updated_at ?? now,
    };
  }

  protected applyFallbackUpdate(record: DatabaseRelationshipRecord, input: Partial<RelationshipInsert>): DatabaseRelationshipRecord {
    return {
      ...record,
      ...input,
      updated_at: new Date().toISOString(),
    };
  }
}

export const relationshipDatabaseRepository = new RelationshipDatabaseRepository();
