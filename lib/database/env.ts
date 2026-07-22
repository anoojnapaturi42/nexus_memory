export type DatabaseEnv = {
  supabaseUrl: string | null;
  supabaseServiceRoleKey: string | null;
  databaseUrl: string | null;
};

export type DatabaseEnvStatus = DatabaseEnv & {
  missing: string[];
  available: boolean;
};

export function getDatabaseEnv(): DatabaseEnvStatus {
  const supabaseUrl = process.env.SUPABASE_URL?.trim() || null;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || null;
  const databaseUrl = process.env.DATABASE_URL?.trim() || null;

  const missing = [
    supabaseUrl ? null : "SUPABASE_URL",
    supabaseServiceRoleKey ? null : "SUPABASE_SERVICE_ROLE_KEY",
    databaseUrl ? null : "DATABASE_URL",
  ].filter(Boolean) as string[];

  return {
    supabaseUrl,
    supabaseServiceRoleKey,
    databaseUrl,
    missing,
    available: Boolean(supabaseUrl || supabaseServiceRoleKey || databaseUrl),
  };
}

