/**
 * Reading and saving your own profile (tracker P2-04).
 *
 * Once db/pending/P2-04-profile-management.sql is applied, every save goes
 * through update_my_profile() / set_my_avatar(), which validate and audit.
 * Until then the database only has name and display name, so this falls back
 * to the old direct update and reports `extended: false`, and the screen hides
 * the new fields instead of failing.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { isLanguageCode, normalizeSaMobile, type ProfileForm } from "@/domain/profile";
import { supabase } from "@/integrations/supabase/client";

// The generated types don't know the new columns and functions until Lovable
// applies the SQL and regenerates src/integrations/supabase/types.ts.
// TODO(P2-04): use `supabase` directly once the types include them.
const db = supabase as unknown as SupabaseClient;

export const AVATAR_BUCKET = "avatars";

export interface MyProfile extends ProfileForm {
  avatarPath: string | null;
  /** False until the P2-04 database update is applied. */
  extended: boolean;
}

interface ProfileRow {
  full_name: string;
  display_name: string | null;
  phone?: string | null;
  preferred_language?: string;
  contact_email?: boolean;
  contact_sms?: boolean;
  contact_whatsapp?: boolean;
  avatar_url: string | null;
}

const FULL_COLUMNS =
  "full_name, display_name, phone, preferred_language, contact_email, contact_sms, contact_whatsapp, avatar_url";
const BASIC_COLUMNS = "full_name, display_name, avatar_url";

/** Postgres "undefined column": the database update isn't applied yet. */
const isMissingColumn = (error: { code?: string } | null) => error?.code === "42703";

function toProfile(row: ProfileRow, extended: boolean): MyProfile {
  const language = row.preferred_language ?? "en";
  return {
    fullName: row.full_name,
    displayName: row.display_name ?? "",
    phone: row.phone ?? "",
    language: isLanguageCode(language) ? language : "en",
    contactEmail: row.contact_email ?? true,
    contactSms: row.contact_sms ?? false,
    contactWhatsapp: row.contact_whatsapp ?? false,
    // Before the update, avatar_url isn't a path in our bucket, so ignore it.
    avatarPath: extended ? row.avatar_url : null,
    extended,
  };
}

export async function loadMyProfile(userId: string): Promise<MyProfile> {
  const full = await db.from("profiles").select(FULL_COLUMNS).eq("id", userId).maybeSingle();
  if (!full.error) {
    if (!full.data) throw new Error("Your profile is not available yet.");
    return toProfile(full.data as ProfileRow, true);
  }
  if (!isMissingColumn(full.error)) throw full.error;

  const basic = await db.from("profiles").select(BASIC_COLUMNS).eq("id", userId).maybeSingle();
  if (basic.error) throw basic.error;
  if (!basic.data) throw new Error("Your profile is not available yet.");
  return toProfile(basic.data as ProfileRow, false);
}

/** Save the form. Returns true if anything changed. */
export async function saveMyProfile(
  userId: string,
  form: ProfileForm,
  extended: boolean,
): Promise<boolean> {
  if (!extended) {
    const { error } = await db
      .from("profiles")
      .update({ full_name: form.fullName.trim(), display_name: form.displayName.trim() })
      .eq("id", userId);
    if (error) throw error;
    return true;
  }

  const phone = form.phone.trim() ? normalizeSaMobile(form.phone) : null;
  const { data, error } = await db.rpc("update_my_profile", {
    p_full_name: form.fullName.trim(),
    p_display_name: form.displayName.trim(),
    // An invalid number is sent as typed so the database rejects it (LBR12).
    p_phone: phone ?? (form.phone.trim() || null),
    p_preferred_language: form.language,
    p_contact_email: form.contactEmail,
    p_contact_sms: form.contactSms,
    p_contact_whatsapp: form.contactWhatsapp,
  });
  if (error) throw error;
  return data === true;
}

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Upload a new photo, point the profile at it, then delete the old one. */
export async function replaceMyAvatar(
  userId: string,
  file: File,
  oldPath: string | null,
): Promise<string> {
  const path = `${userId}/${Date.now()}.${EXTENSIONS[file.type] ?? "img"}`;
  const bucket = db.storage.from(AVATAR_BUCKET);

  const uploaded = await bucket.upload(path, file, { contentType: file.type, upsert: false });
  if (uploaded.error) throw uploaded.error;

  const { error } = await db.rpc("set_my_avatar", { p_path: path });
  if (error) {
    await bucket.remove([path]);
    throw error;
  }
  if (oldPath) await bucket.remove([oldPath]);
  return path;
}

export async function removeMyAvatar(oldPath: string): Promise<void> {
  const { error } = await db.rpc("set_my_avatar", { p_path: null });
  if (error) throw error;
  await db.storage.from(AVATAR_BUCKET).remove([oldPath]);
}

/** A link to your photo that stops working after an hour (the bucket is private). */
export async function avatarLink(path: string): Promise<string> {
  const { data, error } = await db.storage.from(AVATAR_BUCKET).createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}
