/**
 * Calls to the platform-admin functions in db/pending/P2-03-role-assignment.sql
 * and P2-05-account-lifecycle.sql. Every check (are you a platform
 * admin? is there a reason?) happens in the database; this only sends requests.
 */
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

import { isAccountStatus, type AccountStatus } from "@/domain/account-status";
import type { PlatformRole } from "@/domain/permissions";
import { normalizeEmail } from "@/domain/role-assignment";
import { supabase } from "@/integrations/supabase/client";

export interface FoundUser {
  userId: string;
  email: string;
  fullName: string;
  roles: PlatformRole[];
}

// The generated Supabase types don't list these functions until Lovable
// applies the SQL and regenerates src/integrations/supabase/types.ts. Until
// then they're called through this narrow, hand-typed signature.
// TODO(P2-03): switch to plain `supabase.rpc(...)` once the types include them.
type Rpc = <T>(
  fn: "admin_find_user" | "admin_grant_role" | "admin_revoke_role",
  args: Record<string, unknown>,
) => PromiseLike<{ data: T | null; error: PostgrestError | null }>;
const rpc = supabase.rpc.bind(supabase) as unknown as Rpc;

interface FoundUserRow {
  user_id: string;
  email: string;
  full_name: string;
  roles: PlatformRole[] | null;
}

/** The one account with exactly this email, or null. */
export async function findUserByEmail(email: string): Promise<FoundUser | null> {
  const { data, error } = await rpc<FoundUserRow[]>("admin_find_user", {
    p_email: normalizeEmail(email),
  });
  if (error) throw error;
  const row = data?.[0];
  if (!row) return null;
  return {
    userId: row.user_id,
    email: row.email,
    fullName: row.full_name,
    roles: row.roles ?? [],
  };
}

export interface RoleChange {
  userId: string;
  role: PlatformRole;
  reason: string;
}

/** True if the role was added, false if they already had it. */
export async function grantRole({ userId, role, reason }: RoleChange): Promise<boolean> {
  const { data, error } = await rpc<boolean>("admin_grant_role", {
    p_user_id: userId,
    p_role: role,
    p_reason: reason.trim(),
  });
  if (error) throw error;
  return data === true;
}

/** True if the role was removed, false if they didn't have it. */
export async function revokeRole({ userId, role, reason }: RoleChange): Promise<boolean> {
  const { data, error } = await rpc<boolean>("admin_revoke_role", {
    p_user_id: userId,
    p_role: role,
    p_reason: reason.trim(),
  });
  if (error) throw error;
  return data === true;
}

// ---------------------------------------------------------------------------
// Account status (P2-05, db/pending/P2-05-account-lifecycle.sql)

// Not in the generated types until Lovable applies the SQL.
// TODO(P2-05): use `supabase` directly once the types include them.
const untyped = supabase as unknown as SupabaseClient;

/** A person's account status, as a platform admin sees it. No row means active. */
export async function getAccountStatus(userId: string): Promise<AccountStatus> {
  const { data, error } = await untyped
    .from("account_states")
    .select("status")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  const status = (data as { status?: unknown } | null)?.status;
  return isAccountStatus(status) ? status : "active";
}

/** True if the status changed, false if it already had that status. */
export async function setAccountStatus(
  userId: string,
  status: AccountStatus,
  reason: string,
): Promise<boolean> {
  const { data, error } = await untyped.rpc("admin_set_account_status", {
    p_user_id: userId,
    p_status: status,
    p_reason: reason.trim(),
  });
  if (error) throw error;
  return data === true;
}
