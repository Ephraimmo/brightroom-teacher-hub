/**
 * Reads the audit log through admin_audit_log() (db/pending/P2-05-account-lifecycle.sql).
 * The database checks the caller is a platform admin.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { AuditEntry } from "@/domain/audit";
import * as demo from "@/demo/demo-store";
import { isDemo } from "@/demo/demo-session";
import { supabase } from "@/integrations/supabase/client";

// Not in the generated types until Lovable applies the SQL.
// TODO(P2-05): use `supabase` directly once the types include it.
const db = supabase as unknown as SupabaseClient;

export const AUDIT_PAGE_SIZE = 50;

interface AuditRow {
  id: number | string;
  occurred_at: string;
  action: string;
  actor_email: string | null;
  actor_role: string | null;
  entity_type: string;
  entity_id: string;
  target_email: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reason: string | null;
}

export interface AuditQuery {
  /** "role.", "account.", "profile." or "" for everything. */
  group: string;
  /** Only entries where this person acted or was affected. */
  userId: string | null;
  /** Only entries older than this id (for "Show older"). */
  beforeId: number | null;
}

export async function loadAuditPage({
  group,
  userId,
  beforeId,
}: AuditQuery): Promise<AuditEntry[]> {
  if (isDemo()) return demo.loadAuditPage({ group, userId, beforeId });
  const { data, error } = await db.rpc("admin_audit_log", {
    p_action_prefix: group || null,
    p_user_id: userId,
    p_before_id: beforeId,
    p_limit: AUDIT_PAGE_SIZE,
  });
  if (error) throw error;
  return ((data as AuditRow[] | null) ?? []).map((row) => ({
    id: Number(row.id),
    occurredAt: row.occurred_at,
    action: row.action,
    actorEmail: row.actor_email,
    actorRole: row.actor_role,
    entityType: row.entity_type,
    entityId: row.entity_id,
    targetEmail: row.target_email,
    before: row.before,
    after: row.after,
    reason: row.reason,
  }));
}
