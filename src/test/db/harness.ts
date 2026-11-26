import { readFileSync } from "node:fs";
import { join } from "node:path";

import { PGlite } from "@electric-sql/pglite";

/**
 * A throw-away Postgres (PGlite, in memory) set up like Lovable Cloud / Supabase:
 * the anon, authenticated and service_role roles, an `auth.users` table and
 * `auth.uid()`. Migrations run as the owner; tests then act as a signed-in
 * user, so row-level security applies exactly as it does for real users.
 */
const SUPABASE_STUBS = `
  CREATE ROLE anon NOLOGIN;
  CREATE ROLE authenticated NOLOGIN;
  CREATE ROLE service_role NOLOGIN BYPASSRLS;
  CREATE SCHEMA auth;
  CREATE TABLE auth.users (
    id uuid PRIMARY KEY,
    email text,
    raw_user_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb
  );
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
    SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
  GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
  GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
`;

const root = process.cwd();
const sql = (path: string) => readFileSync(join(root, path), "utf8");

/** Migrations already applied in Lovable Cloud, then the ones waiting to be applied. */
export const MIGRATIONS = {
  applied: ["drizzle/migrations/0000_create_profile_and_role_foundation.sql"],
};

export async function createTestDatabase(pending: string[] = []) {
  const db = new PGlite();
  await db.exec(SUPABASE_STUBS);
  for (const file of [...MIGRATIONS.applied, ...pending]) await db.exec(sql(file));
  return db;
}

export type TestDb = Awaited<ReturnType<typeof createTestDatabase>>;

/** Create an account (the sign-up trigger makes its profile). */
export async function addUser(db: TestDb, id: string, email: string, fullName = "Test User") {
  await db.query(`INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ($1, $2, $3)`, [
    id,
    email,
    JSON.stringify({ full_name: fullName }),
  ]);
}

/** Give a role directly, as the database owner would during setup. */
export async function seedRole(db: TestDb, userId: string, role: string) {
  await db.query(`INSERT INTO public.user_roles (user_id, role) VALUES ($1, $2)`, [userId, role]);
}

/**
 * Run `fn` as a signed-in user (role `authenticated`, auth.uid() = userId),
 * or as a signed-out visitor (`anon`) when userId is null.
 */
export async function as<T>(db: TestDb, userId: string | null, fn: () => Promise<T>): Promise<T> {
  await db.exec(userId ? "SET ROLE authenticated" : "SET ROLE anon");
  await db.query(`SELECT set_config('request.jwt.claim.sub', $1, false)`, [userId ?? ""]);
  try {
    return await fn();
  } finally {
    await db.exec("RESET ROLE");
    await db.query(`SELECT set_config('request.jwt.claim.sub', '', false)`);
  }
}

/** The SQLSTATE of a failed query, e.g. "42501" for permission denied. */
export async function errorCode(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
    return undefined;
  } catch (error) {
    return (error as { code?: string }).code ?? "unknown";
  }
}
