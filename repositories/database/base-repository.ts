import type { SupabaseClient } from "@supabase/supabase-js";
import type { Pool } from "pg";
import { getDatabaseRuntime, type DatabaseRuntime } from "@/lib/database/client";
import {
  buildDeleteQuery,
  buildInsertQuery,
  buildListQuery,
  buildSelectByIdQuery,
  buildUpdateQuery,
} from "@/lib/database/query-utils";
import type {
  DatabaseDeleteResult,
  DatabaseItemResult,
  DatabaseListResult,
  DatabaseMutationResult,
  DatabaseSchema,
  DatabaseTableName,
} from "@/types/database";

export interface DatabaseRepository<TRecord, TInsert = Record<string, unknown>, TUpdate = Record<string, unknown>> {
  list(limit?: number, offset?: number): Promise<DatabaseListResult<TRecord>>;
  getById(id: string): Promise<DatabaseItemResult<TRecord>>;
  insert(input: TInsert): Promise<DatabaseMutationResult<TRecord>>;
  update(id: string, input: TUpdate): Promise<DatabaseMutationResult<TRecord> | null>;
  delete(id: string): Promise<DatabaseDeleteResult>;
}

export abstract class BaseDatabaseRepository<
  TRecord extends { id: string },
  TInsert = Record<string, unknown>,
  TUpdate = Record<string, unknown>,
> implements DatabaseRepository<TRecord, TInsert, TUpdate>
{
  protected readonly runtime: DatabaseRuntime;

  protected constructor(
    protected readonly tableName: DatabaseTableName,
    runtime: DatabaseRuntime = getDatabaseRuntime(),
  ) {
    this.runtime = runtime;
  }

  protected abstract fallbackRows: TRecord[];

  protected abstract fromRow(row: Record<string, unknown>): TRecord;

  protected abstract toInsertPayload(input: TInsert): Record<string, unknown>;

  protected abstract toUpdatePayload(input: TUpdate): Record<string, unknown>;

  protected abstract createFallbackRecord(input: TInsert): TRecord;

  protected abstract applyFallbackUpdate(record: TRecord, input: TUpdate): TRecord;

  protected cloneFallbackRows() {
    return structuredClone(this.fallbackRows);
  }

  protected get pool(): Pool | null {
    return this.runtime.pool;
  }

  protected get supabase(): SupabaseClient<DatabaseSchema> | null {
    return this.runtime.supabase;
  }

  async list(limit = 50, offset = 0): Promise<DatabaseListResult<TRecord>> {
    if (this.pool) {
      try {
        const { text, values } = buildListQuery(String(this.tableName), { limit, offset });
        const result = await this.pool.query(text, values);
        return {
          source: "postgres",
          items: result.rows.map((row) => this.fromRow(row as Record<string, unknown>)),
        };
      } catch {
        // fall through to the next available source
      }
    }

    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from(String(this.tableName))
          .select("*")
          .order("created_at", { ascending: false })
          .range(offset, offset + limit - 1);

        if (!error) {
          return {
            source: "supabase",
            items: (data ?? []).map((row) => this.fromRow(row as Record<string, unknown>)),
          };
        }
      } catch {
        // fall through to the mock repository snapshot
      }
    }

    return {
      source: "mock",
      items: this.cloneFallbackRows().slice(offset, offset + limit),
    };
  }

  async getById(id: string): Promise<DatabaseItemResult<TRecord>> {
    if (this.pool) {
      try {
        const { text, values } = buildSelectByIdQuery(String(this.tableName), id);
        const result = await this.pool.query(text, values);
        return {
          source: "postgres",
          item: result.rows[0] ? this.fromRow(result.rows[0] as Record<string, unknown>) : null,
        };
      } catch {
        // fall through to the next available source
      }
    }

    if (this.supabase) {
      try {
        const { data, error } = await this.supabase.from(String(this.tableName)).select("*").eq("id", id).maybeSingle();
        if (!error) {
          return {
            source: "supabase",
            item: data ? this.fromRow(data as Record<string, unknown>) : null,
          };
        }
      } catch {
        // fall through to the mock repository snapshot
      }
    }

    return {
      source: "mock",
      item: this.cloneFallbackRows().find((row) => row.id === id) ?? null,
    };
  }

  async insert(input: TInsert): Promise<DatabaseMutationResult<TRecord>> {
    const fallbackRecord = this.createFallbackRecord(input);

    if (this.pool) {
      try {
        const { text, values } = buildInsertQuery(String(this.tableName), this.toInsertPayload(input));
        const result = await this.pool.query(text, values);
        return {
          source: "postgres",
          item: this.fromRow(result.rows[0] as Record<string, unknown>),
        };
      } catch {
        // fall through to the next available source
      }
    }

    if (this.supabase) {
      try {
        const payload = this.toInsertPayload(input);
        const { data, error } = await this.supabase.from(String(this.tableName)).insert(payload).select("*").single();
        if (!error && data) {
          return {
            source: "supabase",
            item: this.fromRow(data as Record<string, unknown>),
          };
        }
      } catch {
        // fall through to the mock repository snapshot
      }
    }

    this.fallbackRows = [...this.cloneFallbackRows(), fallbackRecord];
    return {
      source: "mock",
      item: fallbackRecord,
    };
  }

  async update(id: string, input: TUpdate): Promise<DatabaseMutationResult<TRecord> | null> {
    if (this.pool) {
      try {
        const { text, values } = buildUpdateQuery(String(this.tableName), id, this.toUpdatePayload(input));
        const result = await this.pool.query(text, values);
        const row = result.rows[0] as Record<string, unknown> | undefined;
        if (!row) return null;
        return {
          source: "postgres",
          item: this.fromRow(row),
        };
      } catch {
        // fall through to the next available source
      }
    }

    if (this.supabase) {
      try {
        const payload = this.toUpdatePayload(input);
        const { data, error } = await this.supabase.from(String(this.tableName)).update(payload).eq("id", id).select("*").single();
        if (!error && data) {
          return {
            source: "supabase",
            item: this.fromRow(data as Record<string, unknown>),
          };
        }
      } catch {
        // fall through to the mock repository snapshot
      }
    }

    const current = this.cloneFallbackRows();
    const index = current.findIndex((row) => row.id === id);
    if (index < 0) return null;

    const updated = this.applyFallbackUpdate(current[index], input);
    this.fallbackRows = current.map((row) => (row.id === id ? updated : row));
    return {
      source: "mock",
      item: updated,
    };
  }

  async delete(id: string): Promise<DatabaseDeleteResult> {
    if (this.pool) {
      try {
        const { text, values } = buildDeleteQuery(String(this.tableName), id);
        const result = await this.pool.query(text, values);
        return {
          source: "postgres",
          deleted: result.rowCount > 0,
        };
      } catch {
        // fall through to the next available source
      }
    }

    if (this.supabase) {
      try {
        const { error } = await this.supabase.from(String(this.tableName)).delete().eq("id", id);
        if (!error) {
          return {
            source: "supabase",
            deleted: true,
          };
        }
      } catch {
        // fall through to the mock repository snapshot
      }
    }

    this.fallbackRows = this.cloneFallbackRows().filter((row) => row.id !== id);
    return {
      source: "mock",
      deleted: true,
    };
  }
}
