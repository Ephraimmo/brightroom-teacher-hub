/**
 * School settings calls (P3-02, db/pending/P3-02-school-settings.sql).
 * All permission checks happen in the database.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  groupPeriods,
  type AcademicYear,
  type PeriodRow,
  type Policies,
  type TermForm,
  type YearForm,
} from "@/domain/school-settings";
import { normalizeSaPhone, type InstitutionType } from "@/domain/schools";
import * as demo from "@/demo/demo-store";
import { isDemo } from "@/demo/demo-session";
import { supabase } from "@/integrations/supabase/client";

// Not in the generated types until Lovable applies the SQL.
// TODO(P3-02): use `supabase` directly once the types include these.
const db = supabase as unknown as SupabaseClient;

export interface SchoolSettings {
  id: string;
  name: string;
  type: InstitutionType;
  emisNumber: string;
  province: string;
  district: string;
  address: string;
  contactEmail: string;
  contactPhone: string;
  policies: Record<string, unknown>;
  grades: string[];
}

export async function getSchoolSettings(institutionId: string): Promise<SchoolSettings> {
  if (isDemo()) return demo.getSchoolSettings(institutionId);
  const { data, error } = await db.rpc("institution_settings", { p_institution_id: institutionId });
  if (error) throw error;
  const row = (data as Record<string, unknown>[] | null)?.[0];
  if (!row) throw Object.assign(new Error("School not found"), { status: 404 });
  return {
    id: String(row["id"]),
    name: String(row["name"] ?? ""),
    type: row["type"] as InstitutionType,
    emisNumber: String(row["emis_number"] ?? ""),
    province: String(row["province"] ?? ""),
    district: String(row["district"] ?? ""),
    address: String(row["address"] ?? ""),
    contactEmail: String(row["contact_email"] ?? ""),
    contactPhone: String(row["contact_phone"] ?? ""),
    policies: (row["policies"] as Record<string, unknown>) ?? {},
    grades: (row["grades"] as string[]) ?? [],
  };
}

export interface SchoolDetailsForm {
  name: string;
  emisNumber: string;
  province: string;
  district: string;
  address: string;
  contactEmail: string;
  contactPhone: string;
}

export async function updateSchoolDetails(
  institutionId: string,
  form: SchoolDetailsForm,
): Promise<boolean> {
  if (isDemo()) return demo.updateSchoolDetails(institutionId, form);
  const phone = form.contactPhone.trim();
  const { data, error } = await db.rpc("update_institution_profile", {
    p_institution_id: institutionId,
    p_name: form.name.trim(),
    p_emis_number: form.emisNumber.trim() || null,
    p_province: form.province,
    p_district: form.district.trim() || null,
    p_address: form.address.trim() || null,
    p_contact_email: form.contactEmail.trim().toLowerCase() || null,
    p_contact_phone: phone ? (normalizeSaPhone(phone) ?? phone) : null,
  });
  if (error) throw error;
  return data === true;
}

export async function updatePolicies(institutionId: string, policies: Policies): Promise<void> {
  if (isDemo()) return demo.updatePolicies(institutionId, policies);
  const { error } = await db.rpc("update_institution_policies", {
    p_institution_id: institutionId,
    p_policies: policies,
  });
  if (error) throw error;
}

export interface GradeLevel {
  code: string;
  label: string;
  phase: string;
}

export async function listGradeLevels(): Promise<GradeLevel[]> {
  if (isDemo()) return demo.listGradeLevels();
  const { data, error } = await db
    .from("grade_levels")
    .select("code, label, phase")
    .order("sort_order");
  if (error) throw error;
  return (data as GradeLevel[] | null) ?? [];
}

export async function setGrades(institutionId: string, codes: string[]): Promise<void> {
  if (isDemo()) return demo.setGrades(institutionId, codes);
  const { error } = await db.rpc("set_institution_grades", {
    p_institution_id: institutionId,
    p_codes: codes,
  });
  if (error) throw error;
}

export async function getAcademicPeriods(institutionId: string): Promise<AcademicYear[]> {
  if (isDemo()) return demo.getAcademicPeriods(institutionId);
  const { data, error } = await db.rpc("academic_periods", { p_institution_id: institutionId });
  if (error) throw error;
  return groupPeriods((data as PeriodRow[] | null) ?? []);
}

export async function saveAcademicYear(
  institutionId: string,
  yearId: string | null,
  form: YearForm,
): Promise<string> {
  if (isDemo()) return demo.saveAcademicYear(institutionId, yearId, form);
  const { data, error } = await db.rpc("save_academic_year", {
    p_institution_id: institutionId,
    p_year_id: yearId,
    p_label: form.label.trim(),
    p_starts_on: form.startsOn,
    p_ends_on: form.endsOn,
    p_make_current: form.makeCurrent,
  });
  if (error) throw error;
  return String(data);
}

export async function saveTerm(yearId: string, form: TermForm): Promise<string> {
  if (isDemo()) return demo.saveTerm(yearId, form);
  const { data, error } = await db.rpc("save_term", {
    p_academic_year_id: yearId,
    p_number: form.number,
    p_starts_on: form.startsOn,
    p_ends_on: form.endsOn,
  });
  if (error) throw error;
  return String(data);
}
