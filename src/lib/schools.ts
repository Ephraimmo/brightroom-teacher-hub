/**
 * Schools, memberships and invitations (P3-01,
 * db/pending/P3-01-schools-and-tenancy.sql). All checks happen in the database.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  normalizeSaPhone,
  type InstitutionStatus,
  type InstitutionType,
  type MembershipRole,
  type SchoolForm,
} from "@/domain/schools";
import { supabase } from "@/integrations/supabase/client";

// Not in the generated types until Lovable applies the SQL.
// TODO(P3-01): use `supabase` directly once the types include these.
const db = supabase as unknown as SupabaseClient;

export interface Institution {
  id: string;
  name: string;
  type: InstitutionType;
  status: InstitutionStatus;
  emisNumber: string | null;
  province: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  createdAt: string;
}

interface InstitutionRow {
  id: string;
  name: string;
  type: InstitutionType;
  status: InstitutionStatus;
  emis_number: string | null;
  province: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  created_at: string;
}

const toInstitution = (r: InstitutionRow): Institution => ({
  id: r.id,
  name: r.name,
  type: r.type,
  status: r.status,
  emisNumber: r.emis_number,
  province: r.province,
  contactEmail: r.contact_email,
  contactPhone: r.contact_phone,
  createdAt: r.created_at,
});

/** Every school a platform admin may see (RLS limits others to their own). */
export async function listInstitutions(): Promise<Institution[]> {
  const { data, error } = await db
    .from("institutions")
    .select(
      "id, name, type, status, emis_number, province, contact_email, contact_phone, created_at",
    )
    .order("name");
  if (error) throw error;
  return ((data as InstitutionRow[] | null) ?? []).map(toInstitution);
}

export async function registerInstitution(form: SchoolForm, reason: string): Promise<string> {
  const phone = form.contactPhone.trim();
  const { data, error } = await db.rpc("admin_register_institution", {
    p_name: form.name.trim(),
    p_type: form.type,
    p_province: form.province,
    p_emis_number: form.emisNumber.trim() || null,
    p_contact_email: form.contactEmail.trim().toLowerCase() || null,
    p_contact_phone: phone ? (normalizeSaPhone(phone) ?? phone) : null,
    p_first_admin_email: form.firstAdminEmail.trim().toLowerCase(),
    p_reason: reason.trim(),
  });
  if (error) throw error;
  return String(data);
}

export async function setInstitutionStatus(
  institutionId: string,
  status: InstitutionStatus,
  reason: string,
): Promise<boolean> {
  const { data, error } = await db.rpc("admin_set_institution_status", {
    p_institution_id: institutionId,
    p_status: status,
    p_reason: reason.trim(),
  });
  if (error) throw error;
  return data === true;
}

export interface MySchool {
  institutionId: string;
  name: string;
  role: MembershipRole;
  title: string | null;
}

/** Schools the signed-in person works in. Empty before the SQL is applied. */
export async function myInstitutions(): Promise<MySchool[]> {
  const { data, error } = await db.rpc("my_institutions");
  if (error) {
    if (error.code === "PGRST202") return [];
    throw error;
  }
  return (
    (data as
      | { institution_id: string; name: string; role: MembershipRole; title: string | null }[]
      | null) ?? []
  ).map((r) => ({ institutionId: r.institution_id, name: r.name, role: r.role, title: r.title }));
}

export interface MyInvitation {
  id: string;
  institutionName: string;
  role: MembershipRole;
  title: string | null;
  expiresAt: string;
}

/** Open invitations for the signed-in person's email. Empty before the SQL is applied. */
export async function myInvitations(): Promise<MyInvitation[]> {
  const { data, error } = await db.rpc("my_invitations");
  if (error) {
    if (error.code === "PGRST202") return [];
    throw error;
  }
  return (
    (data as
      | {
          id: string;
          institution_name: string;
          role: MembershipRole;
          title: string | null;
          expires_at: string;
        }[]
      | null) ?? []
  ).map((r) => ({
    id: r.id,
    institutionName: r.institution_name,
    role: r.role,
    title: r.title,
    expiresAt: r.expires_at,
  }));
}

export async function acceptInvitation(id: string): Promise<void> {
  const { error } = await db.rpc("accept_invitation", { p_invitation_id: id });
  if (error) throw error;
}

export async function createInvitation(
  institutionId: string,
  email: string,
  role: MembershipRole,
  title: string | null,
): Promise<string> {
  const { data, error } = await db.rpc("create_invitation", {
    p_institution_id: institutionId,
    p_email: email.trim().toLowerCase(),
    p_role: role,
    p_title: title?.trim() || null,
  });
  if (error) throw error;
  return String(data);
}
