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
    email_confirmed_at timestamptz DEFAULT now(),
    raw_user_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb
  );
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
    SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  -- The session's JWT claims, e.g. {"aal": "aal2"} once MFA is verified.
  CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
    SELECT coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
  $$;
  CREATE TABLE auth.mfa_factors (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    factor_type text NOT NULL DEFAULT 'totp',
    status text NOT NULL DEFAULT 'verified'
  );
  GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
  GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
  GRANT EXECUTE ON FUNCTION auth.jwt() TO anon, authenticated, service_role;
  GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

  -- Supabase Storage: just the parts policies and functions refer to.
  CREATE SCHEMA storage;
  CREATE TABLE storage.buckets (
    id text PRIMARY KEY,
    name text NOT NULL,
    public boolean DEFAULT false,
    file_size_limit bigint,
    allowed_mime_types text[]
  );
  CREATE TABLE storage.objects (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    bucket_id text REFERENCES storage.buckets(id),
    name text NOT NULL,
    owner uuid,
    UNIQUE (bucket_id, name)
  );
  ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
  CREATE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
    SELECT (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
  $$;
  GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;
  GRANT SELECT ON storage.buckets TO anon, authenticated, service_role;
  GRANT ALL ON storage.objects TO anon, authenticated, service_role;
  GRANT EXECUTE ON FUNCTION storage.foldername(text) TO anon, authenticated, service_role;
`;

const root = process.cwd();
const sql = (path: string) => readFileSync(join(root, path), "utf8");

/** Migrations already applied in Lovable Cloud, then the ones waiting to be applied. */
export const MIGRATIONS = {
  applied: ["drizzle/migrations/0000_create_profile_and_role_foundation.sql"],
};

/** Database changes waiting for Lovable, in the order they must be applied. */
export const PENDING_IN_ORDER = [
  "db/pending/P2-03-role-assignment.sql",
  "db/pending/P2-04-profile-management.sql",
  "db/pending/P2-05-account-lifecycle.sql",
  "db/pending/P2-06-mfa.sql",
  "db/pending/P3-01-schools-and-tenancy.sql",
  "db/pending/P3-02-school-settings.sql",
];

/** Every pending file up to and including `file`. */
export function pendingThrough(file: string): string[] {
  const end = PENDING_IN_ORDER.indexOf(file);
  if (end < 0) throw new Error(`${file} is not in PENDING_IN_ORDER`);
  return PENDING_IN_ORDER.slice(0, end + 1);
}

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
 *
 * `aal` is the session's assurance level: "aal2" means the person passed the
 * authenticator-app (MFA) check this session. Defaults to "aal2" so tests that
 * aren't about MFA behave like a fully verified session.
 */
export async function as<T>(
  db: TestDb,
  userId: string | null,
  fn: () => Promise<T>,
  { aal = "aal2" }: { aal?: "aal1" | "aal2" } = {},
): Promise<T> {
  await db.exec(userId ? "SET ROLE authenticated" : "SET ROLE anon");
  await db.query(`SELECT set_config('request.jwt.claim.sub', $1, false)`, [userId ?? ""]);
  await db.query(`SELECT set_config('request.jwt.claims', $1, false)`, [
    userId ? JSON.stringify({ sub: userId, aal }) : "",
  ]);
  try {
    return await fn();
  } finally {
    await db.exec("RESET ROLE");
    await db.query(`SELECT set_config('request.jwt.claim.sub', '', false)`);
    await db.query(`SELECT set_config('request.jwt.claims', '', false)`);
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
