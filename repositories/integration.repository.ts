import type { SupabaseClient } from "@supabase/supabase-js";
import type { Pool } from "pg";
import { getDatabaseRuntime, type DatabaseRuntime } from "@/lib/database/client";
import { quoteIdentifier } from "@/lib/database/query-utils";
import type { DatabaseIntegrationRecord, DatabaseSchema, DatabaseSource } from "@/types/database";

export type IntegrationProvider = string;

export type IntegrationUpsertInput = {
  userId: string;
  provider: IntegrationProvider;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
};

export type IntegrationRepositoryListResult = {
  source: DatabaseSource;
  items: DatabaseIntegrationRecord[];
};

export type IntegrationRepositoryItemResult = {
  source: DatabaseSource;
  item: DatabaseIntegrationRecord | null;
};

export type IntegrationRepositoryMutationResult = {
  source: DatabaseSource;
  item: DatabaseIntegrationRecord;
};

type QueryResult = {
  rows: Record<string, unknown>[];
};

export class IntegrationRepository {
  constructor(private readonly runtime: DatabaseRuntime = getDatabaseRuntime()) {}

  private get pool(): Pool | null {
    return this.runtime.pool;
  }

  private get supabase(): SupabaseClient<DatabaseSchema> | null {
    return this.runtime.supabase;
  }

  private toRecord(row: Record<string, unknown>): DatabaseIntegrationRecord {
    return {
      id: String(row.id),
      user_id: String(row.user_id),
      provider: String(row.provider),
      access_token: String(row.access_token),
      refresh_token: String(row.refresh_token),
      expires_at: String(row.expires_at),
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
    };
  }

  private isWritable() {
    return Boolean(this.pool || this.supabase);
  }

  async listByUserId(userId: string): Promise<IntegrationRepositoryListResult> {
    if (this.pool) {
      try {
        const result = await this.pool.query<QueryResult>(
          `select * from ${quoteIdentifier("user_integrations")} where user_id = $1 order by updated_at desc`,
          [userId],
        );
        return {
          source: "postgres",
          items: result.rows.map((row) => this.toRecord(row)),
        };
      } catch {
        // fall through to supabase or empty snapshot
      }
    }

    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from("user_integrations")
          .select("*")
          .eq("user_id", userId)
          .order("updated_at", { ascending: false });

        if (!error) {
          return {
            source: "supabase",
            items: (data ?? []).map((row) => this.toRecord(row as Record<string, unknown>)),
          };
        }
      } catch {
        // fall through to empty snapshot
      }
    }

    return {
      source: "mock",
      items: [],
    };
  }

  async getByUserIdAndProvider(userId: string, provider: IntegrationProvider): Promise<IntegrationRepositoryItemResult> {
    if (this.pool) {
      try {
        const result = await this.pool.query<QueryResult>(
          `select * from ${quoteIdentifier("user_integrations")} where user_id = $1 and provider = $2 limit 1`,
          [userId, provider],
        );
        return {
          source: "postgres",
          item: result.rows[0] ? this.toRecord(result.rows[0]) : null,
        };
      } catch {
        // fall through to supabase or empty snapshot
      }
    }

    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from("user_integrations")
          .select("*")
          .eq("user_id", userId)
          .eq("provider", provider)
          .maybeSingle();

        if (!error) {
          return {
            source: "supabase",
            item: data ? this.toRecord(data as Record<string, unknown>) : null,
          };
        }
      } catch {
        // fall through to empty snapshot
      }
    }

    return {
      source: "mock",
      item: null,
    };
  }

  async upsert(input: IntegrationUpsertInput): Promise<IntegrationRepositoryMutationResult> {
    if (!this.isWritable()) {
      throw new Error("database unavailable");
    }

    if (this.pool) {
      const query = [
        `insert into ${quoteIdentifier("user_integrations")} (user_id, provider, access_token, refresh_token, expires_at)`,
        "values ($1, $2, $3, $4, $5)",
        "on conflict (user_id, provider) do update set",
        "access_token = excluded.access_token,",
        "refresh_token = excluded.refresh_token,",
        "expires_at = excluded.expires_at,",
        "updated_at = now()",
        "returning *",
      ].join(" ");

      const result = await this.pool.query<QueryResult>(query, [
        input.userId,
        input.provider,
        input.accessToken,
        input.refreshToken,
        input.expiresAt,
      ]);

      return {
        source: "postgres",
        item: this.toRecord(result.rows[0]),
      };
    }

    if (this.supabase) {
      const { data, error } = await this.supabase
        .from("user_integrations")
        .upsert(
          {
            user_id: input.userId,
            provider: input.provider,
            access_token: input.accessToken,
            refresh_token: input.refreshToken,
            expires_at: input.expiresAt,
          },
          { onConflict: "user_id,provider" },
        )
        .select("*")
        .single();

      if (error || !data) {
        throw error ?? new Error("failed to persist integration");
      }

      return {
        source: "supabase",
        item: this.toRecord(data as Record<string, unknown>),
      };
    }

    throw new Error("database unavailable");
  }

  async upsertMany(inputs: IntegrationUpsertInput[]) {
    const results: IntegrationRepositoryMutationResult[] = [];
    for (const input of inputs) {
      results.push(await this.upsert(input));
    }
    return results;
  }

  async deleteByUserId(userId: string) {
    if (this.pool) {
      await this.pool.query(`delete from ${quoteIdentifier("user_integrations")} where user_id = $1`, [userId]);
      return {
        source: "postgres" as const,
        deleted: true,
      };
    }

    if (this.supabase) {
      const { error } = await this.supabase.from("user_integrations").delete().eq("user_id", userId);
      if (error) {
        throw error;
      }

      return {
        source: "supabase" as const,
        deleted: true,
      };
    }

    return {
      source: "mock" as const,
      deleted: true,
    };
  }

  async deleteByUserIdAndProvider(userId: string, provider: IntegrationProvider) {
    if (this.pool) {
      await this.pool.query(`delete from ${quoteIdentifier("user_integrations")} where user_id = $1 and provider = $2`, [
        userId,
        provider,
      ]);
      return {
        source: "postgres" as const,
        deleted: true,
      };
    }

    if (this.supabase) {
      const { error } = await this.supabase
        .from("user_integrations")
        .delete()
        .eq("user_id", userId)
        .eq("provider", provider);
      if (error) {
        throw error;
      }

      return {
        source: "supabase" as const,
        deleted: true,
      };
    }

    return {
      source: "mock" as const,
      deleted: true,
    };
  }
}

export const integrationRepository = new IntegrationRepository();
