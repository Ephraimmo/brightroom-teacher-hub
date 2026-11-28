/**
 * Parent and guardian calls (P3-04, db/pending/P3-04-guardians.sql).
 * The database checks the caller manages the school, or is the parent.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { GuardianForm, Relationship } from "@/domain/guardians";
import { normalizeSaMobile, type LanguageCode } from "@/domain/profile";
import * as demo from "@/demo/demo-store";
import { isDemo } from "@/demo/demo-session";
import { supabase } from "@/integrations/supabase/client";

// Not in the generated types until Lovable applies the SQL.
// TODO(P3-04): use `supabase` directly once the types include these.
const db = supabase as unknown as SupabaseClient;

export interface Guardian {
  id: string;
  firstName: string;
  lastName: string;
  relationship: Relationship;
  email: string | null;
  phone: string | null;
  language: LanguageCode;
  contactEmail: boolean;
  contactSms: boolean;
  contactWhatsapp: boolean;
  status: "active" | "archived";
  hasAccount: boolean;
}

export async function listGuardians(institutionId: string): Promise<Guardian[]> {
  if (isDemo()) return demo.listGuardians(institutionId);
  const { data, error } = await db.rpc("school_guardians", { p_institution_id: institutionId });
  if (error) throw error;
  return ((data as Record<string, unknown>[] | null) ?? []).map((r) => ({
    id: String(r["id"]),
    firstName: String(r["first_name"]),
    lastName: String(r["last_name"]),
    relationship: r["relationship"] as Relationship,
    email: (r["email"] as string | null) ?? null,
    phone: (r["phone"] as string | null) ?? null,
    language: r["preferred_language"] as LanguageCode,
    contactEmail: Boolean(r["contact_email"]),
    contactSms: Boolean(r["contact_sms"]),
    contactWhatsapp: Boolean(r["contact_whatsapp"]),
    status: r["status"] as "active" | "archived",
    hasAccount: Boolean(r["has_account"]),
  }));
}

function detailArgs(form: GuardianForm) {
  const phone = form.phone.trim();
  return {
    p_first_name: form.firstName.trim(),
    p_last_name: form.lastName.trim(),
    p_relationship: form.relationship || null,
    p_email: form.email.trim().toLowerCase() || null,
    // An invalid number is sent as typed so the database names the field.
    p_phone: phone ? (normalizeSaMobile(phone) ?? phone) : null,
    p_language: form.language,
    p_contact_email: form.contactEmail,
    p_contact_sms: form.contactSms,
    p_contact_whatsapp: form.contactWhatsapp,
  };
}

export async function addGuardian(institutionId: string, form: GuardianForm): Promise<string> {
  if (isDemo()) return demo.addGuardian(institutionId, form);
  const { data, error } = await db.rpc("add_guardian", {
    p_institution_id: institutionId,
    ...detailArgs(form),
  });
  if (error) throw error;
  return String(data);
}

export async function updateGuardian(id: string, form: GuardianForm): Promise<boolean> {
  if (isDemo()) return demo.updateGuardian(id, form);
  const { data, error } = await db.rpc("update_guardian", {
    p_guardian_id: id,
    ...detailArgs(form),
  });
  if (error) throw error;
  return data === true;
}

export async function setGuardianStatus(
  id: string,
  status: "active" | "archived",
  reason: string,
): Promise<boolean> {
  if (isDemo()) return demo.setGuardianStatus(id, status, reason);
  const { data, error } = await db.rpc("set_guardian_status", {
    p_guardian_id: id,
    p_status: status,
    p_reason: reason.trim(),
  });
  if (error) throw error;
  return data === true;
}

export interface GuardianInvitation {
  id: string;
  institutionName: string;
}

/** Parent records waiting for this person to claim. Empty before the SQL is applied. */
export async function myGuardianInvitations(): Promise<GuardianInvitation[]> {
  if (isDemo()) return demo.myGuardianInvitations();
  const { data, error } = await db.rpc("my_guardian_invitations");
  if (error) {
    if (error.code === "PGRST202") return [];
    throw error;
  }
  return ((data as Record<string, unknown>[] | null) ?? []).map((r) => ({
    id: String(r["id"]),
    institutionName: String(r["institution_name"]),
  }));
}

export async function claimGuardianRecord(id: string): Promise<void> {
  if (isDemo()) return demo.claimGuardianRecord(id);
  const { error } = await db.rpc("claim_guardian_record", { p_guardian_id: id });
  if (error) throw error;
}
