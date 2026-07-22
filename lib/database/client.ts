import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Pool } from "pg";
import { getDatabaseEnv } from "@/lib/database/env";
import type { DatabaseSchema } from "@/types/database";

export type DatabaseRuntime = {
  mode: "live" | "mock";
  pool: Pool | null;
  supabase: SupabaseClient<DatabaseSchema> | null;
  available: {
    postgres: boolean;
    supabase: boolean;
  };
  missingEnv: string[];
};

declare global {
  // eslint-disable-next-line no-var
  var __googleNexusMemoryPgPool: Pool | undefined;
  // eslint-disable-next-line no-var
  var __googleNexusMemorySupabaseClient: SupabaseClient<DatabaseSchema> | undefined;
}

function createPostgresPool(databaseUrl: string | null) {
  if (!databaseUrl) return null;
  const existing = globalThis.__googleNexusMemoryPgPool;
  if (existing) return existing;

  const pool = new Pool({
    connectionString: databaseUrl,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

  globalThis.__googleNexusMemoryPgPool = pool;
  return pool;
}

function createSupabaseAdminClient() {
  const existing = globalThis.__googleNexusMemorySupabaseClient;
  if (existing) return existing;

  const env = getDatabaseEnv();
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return null;

  const client = createClient<DatabaseSchema>(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  globalThis.__googleNexusMemorySupabaseClient = client;
  return client;
}

export function getDatabaseRuntime(): DatabaseRuntime {
  const env = getDatabaseEnv();
  const pool = createPostgresPool(env.databaseUrl);
  const supabase = createSupabaseAdminClient();

  return {
    mode: pool || supabase ? "live" : "mock",
    pool,
    supabase,
    available: {
      postgres: Boolean(pool),
      supabase: Boolean(supabase),
    },
    missingEnv: env.missing,
  };
}

