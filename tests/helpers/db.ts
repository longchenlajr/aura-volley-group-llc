import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const DB_NAME = "aura_volley_dev";

// Locate psql: prefer the scoop install the dev scripts use, fall back to PATH.
function resolvePsql(): string {
  const scoop = path.join(
    os.homedir(),
    "scoop",
    "apps",
    "postgresql",
    "current",
    "bin",
    "psql.exe",
  );
  return existsSync(scoop) ? scoop : "psql";
}

const PSQL = resolvePsql();

/** Run raw SQL against the local dev database as the postgres superuser. */
export function psqlExec(sql: string): string {
  return execFileSync(
    PSQL,
    ["-h", "127.0.0.1", "-U", "postgres", "-d", DB_NAME, "-v", "ON_ERROR_STOP=1", "-q", "-c", sql],
    { encoding: "utf8" },
  );
}

const ALL_TABLES = [
  "teams",
  "players",
  "pools",
  "pool_teams",
  "matches",
  "match_sets",
  "match_tokens",
  "brackets",
  "bracket_slots",
  "bracket_matches",
  "bracket_match_sets",
  "bracket_match_tokens",
];

/** Wipe every domain table to a clean slate. Call in beforeEach for isolation. */
export function resetDb(): void {
  psqlExec(`truncate ${ALL_TABLES.join(", ")} restart identity cascade;`);
}

/** Service-role client (bypasses RLS) — what the API routes use. */
export function adminClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

/** Anon client (subject to RLS) — what an untrusted browser would use. */
export function anonClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
}
