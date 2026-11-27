/**
 * Rules for editing your own profile (tracker P2-04).
 *
 * The database enforces the same rules (db/pending/P2-04-profile-management.sql);
 * these let the screen explain a problem next to the right field before saving.
 */

/** South Africa's official languages. The interface is English-only for now. */
export const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "af", name: "Afrikaans" },
  { code: "zu", name: "isiZulu" },
  { code: "xh", name: "isiXhosa" },
  { code: "st", name: "Sesotho" },
  { code: "tn", name: "Setswana" },
  { code: "nso", name: "Sepedi" },
  { code: "ts", name: "Xitsonga" },
  { code: "ss", name: "siSwati" },
  { code: "ve", name: "Tshivenḓa" },
  { code: "nr", name: "isiNdebele" },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]["code"];

export function isLanguageCode(value: string): value is LanguageCode {
  return LANGUAGES.some((l) => l.code === value);
}

export interface ProfileForm {
  fullName: string;
  displayName: string;
  phone: string;
  language: LanguageCode;
  contactEmail: boolean;
  contactSms: boolean;
  contactWhatsapp: boolean;
}

export type ProfileField = "fullName" | "displayName" | "phone" | "language" | "contact";
export type ProfileErrors = Partial<Record<ProfileField, string>>;

/**
 * A South African mobile number in +27 form, or null if it isn't one.
 * Accepts the usual ways people type it: 082 123 4567, 0821234567,
 * +27 82 123 4567, 27821234567, (082) 123-4567.
 */
export function normalizeSaMobile(input: string): string | null {
  const digits = input.replace(/[\s()\-.]/g, "");
  let national: string;
  if (/^\+27\d{9}$/.test(digits)) national = digits.slice(3);
  else if (/^27\d{9}$/.test(digits)) national = digits.slice(2);
  else if (/^0\d{9}$/.test(digits)) national = digits.slice(1);
  else return null;
  return /^[678]\d{8}$/.test(national) ? `+27${national}` : null;
}

/** +27821234567 → 082 123 4567, the way South Africans write it. */
export function formatSaMobile(e164: string | null): string {
  if (!e164 || !/^\+27\d{9}$/.test(e164)) return e164 ?? "";
  const n = `0${e164.slice(3)}`;
  return `${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`;
}

export function validateProfile(form: ProfileForm): ProfileErrors {
  const errors: ProfileErrors = {};
  const name = form.fullName.trim();
  if (name.length === 0) errors.fullName = "Enter your full name.";
  else if (name.length > 100) errors.fullName = "Keep your full name under 100 characters.";

  if (form.displayName.trim().length > 60) {
    errors.displayName = "Keep your display name under 60 characters.";
  }

  const phone = form.phone.trim();
  if (phone && !normalizeSaMobile(phone)) {
    errors.phone = "Enter a South African mobile number, for example 082 123 4567.";
  }

  if (!isLanguageCode(form.language)) errors.language = "Choose a language from the list.";

  if (!phone && (form.contactSms || form.contactWhatsapp)) {
    errors.contact = "Add your mobile number to get SMS or WhatsApp messages.";
  }
  return errors;
}

export const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

/** Why this file can't be a profile photo, or null if it can. */
export function avatarFileProblem(file: { type: string; size: number }): string | null {
  if (!(AVATAR_TYPES as readonly string[]).includes(file.type)) {
    return "Choose a JPG, PNG or WebP picture.";
  }
  if (file.size > AVATAR_MAX_BYTES) return "Choose a picture smaller than 2 MB.";
  return null;
}

const ERROR_FIELDS: Record<string, { field: ProfileField | "photo"; message: string }> = {
  LBR10: { field: "fullName", message: "Enter your full name (up to 100 characters)." },
  LBR11: { field: "displayName", message: "Keep your display name under 60 characters." },
  LBR12: {
    field: "phone",
    message: "Enter a South African mobile number, for example 082 123 4567.",
  },
  LBR13: { field: "language", message: "Choose a language from the list." },
  LBR14: { field: "contact", message: "Add your mobile number to get SMS or WhatsApp messages." },
  LBR15: { field: "photo", message: "That photo couldn't be used. Please upload it again." },
};

/** Map a database refusal to the field it belongs to, when it belongs to one. */
export function profileErrorFor(
  error: unknown,
): { field: ProfileField | "photo"; message: string } | null {
  const code =
    error && typeof error === "object" ? String((error as { code?: unknown }).code ?? "") : "";
  return ERROR_FIELDS[code] ?? null;
}
