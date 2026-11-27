/**
 * School staff calls (P3-03, db/pending/P3-03-staff-management.sql).
 * The database checks the caller manages this school.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { MembershipRole } from "@/domain/schools";
import type { StaffStatus } from "@/domain/staff";
import { supabase } from "@/integrations/supabase/client";

// Not in the generated types until Lovable applies the SQL.
// TODO(P3-03): use `supabase` directly once the types include these.
const db = supabase as unknown as SupabaseClient;

export interface StaffMember {
  membershipId: string;
  userId: string;
  email: string;
  fullName: string;
  role: MembershipRole;
  status: StaffStatus;
  title: string | null;
  grades: string[];
}

export async function listStaff(institutionId: string): Promise<StaffMember[]> {
  const { data, error } = await db.rpc("school_staff", { p_institution_id: institutionId });
  if (error) throw error;
  return ((data as Record<string, unknown>[] | null) ?? []).map((r) => ({
    membershipId: String(r["membership_id"]),
    userId: String(r["user_id"]),
    email: String(r["email"] ?? ""),
    fullName: String(r["full_name"] ?? ""),
    role: r["role"] as MembershipRole,
    status: r["status"] as StaffStatus,
    title: (r["title"] as string | null) ?? null,
    grades: (r["grades"] as string[] | null) ?? [],
  }));
}

export interface OpenInvitation {
  id: string;
  email: string;
  role: MembershipRole;
  title: string | null;
  expiresAt: string;
}

export async function listOpenInvitations(institutionId: string): Promise<OpenInvitation[]> {
  const { data, error } = await db.rpc("school_open_invitations", {
    p_institution_id: institutionId,
  });
  if (error) throw error;
  return ((data as Record<string, unknown>[] | null) ?? []).map((r) => ({
    id: String(r["id"]),
    email: String(r["email"]),
    role: r["role"] as MembershipRole,
    title: (r["title"] as string | null) ?? null,
    expiresAt: String(r["expires_at"]),
  }));
}

export async function revokeInvitation(id: string): Promise<boolean> {
  const { data, error } = await db.rpc("revoke_invitation", { p_invitation_id: id });
  if (error) throw error;
  return data === true;
}

export async function updateStaffMember(
  membershipId: string,
  title: string,
  grades: string[],
): Promise<void> {
  const { error } = await db.rpc("update_staff_member", {
    p_membership_id: membershipId,
    p_title: title.trim() || null,
    p_grades: grades,
  });
  if (error) throw error;
}

export async function setStaffStatus(
  membershipId: string,
  status: "active" | "suspended" | "removed",
  reason: string,
): Promise<boolean> {
  const { data, error } = await db.rpc("set_staff_status", {
    p_membership_id: membershipId,
    p_status: status,
    p_reason: reason.trim(),
  });
  if (error) throw error;
  return data === true;
}
