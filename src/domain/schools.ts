/**
 * Schools and tenancy rules (tracker P3-01). The database enforces the same
 * checks (db/pending/P3-01-schools-and-tenancy.sql).
 */

export const PROVINCES = [
  { code: "EC", name: "Eastern Cape" },
  { code: "FS", name: "Free State" },
  { code: "GP", name: "Gauteng" },
  { code: "KZN", name: "KwaZulu-Natal" },
  { code: "LP", name: "Limpopo" },
  { code: "MP", name: "Mpumalanga" },
  { code: "NC", name: "Northern Cape" },
  { code: "NW", name: "North West" },
  { code: "WC", name: "Western Cape" },
] as const;
export type ProvinceCode = (typeof PROVINCES)[number]["code"];

export const INSTITUTION_TYPES = [
  { value: "school", label: "School" },
  { value: "tutoring_centre", label: "Tutoring centre" },
  { value: "independent_teacher", label: "Independent teacher" },
  { value: "online_academy", label: "Online academy" },
] as const;
export type InstitutionType = (typeof INSTITUTION_TYPES)[number]["value"];

export type InstitutionStatus = "pending" | "active" | "suspended" | "closed";

export const INSTITUTION_STATUS_LABELS: Record<InstitutionStatus, string> = {
  pending: "Pending",
  active: "Active",
  suspended: "Suspended",
  closed: "Closed",
};

export type MembershipRole = "school_admin" | "teacher";
export const MEMBERSHIP_ROLE_LABELS: Record<MembershipRole, string> = {
  school_admin: "School administrator",
  teacher: "Teacher",
};

export function provinceName(code: string | null): string {
  return PROVINCES.find((p) => p.code === code)?.name ?? "";
}

/** Any South African phone number (landline or mobile) in +27 form, or null. */
export function normalizeSaPhone(input: string): string | null {
  const digits = input.replace(/[\s()\-.]/g, "");
  if (/^\+27\d{9}$/.test(digits)) return digits;
  if (/^27\d{9}$/.test(digits)) return `+${digits}`;
  if (/^0\d{9}$/.test(digits)) return `+27${digits.slice(1)}`;
  return null;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const isEmail = (value: string) => EMAIL.test(value.trim().toLowerCase());

export interface SchoolForm {
  name: string;
  type: InstitutionType;
  province: ProvinceCode | "";
  emisNumber: string;
  contactEmail: string;
  contactPhone: string;
  firstAdminEmail: string;
}

export type SchoolField = keyof SchoolForm;
export type SchoolErrors = Partial<Record<SchoolField, string>>;

export const SCHOOL_FIELD_MESSAGES: Record<SchoolField, string> = {
  name: "Enter the school's name (2 to 150 characters).",
  type: "Choose what kind of institution this is.",
  province: "Choose the province.",
  emisNumber: "The EMIS number is 6 to 12 digits. Leave it empty if you don't have it.",
  contactEmail: "Enter a valid email address, or leave it empty.",
  contactPhone: "Enter a South African phone number, for example 011 123 4567.",
  firstAdminEmail: "Enter the email address of the person who will run this school's account.",
};

export function validateSchool(form: SchoolForm): SchoolErrors {
  const errors: SchoolErrors = {};
  const name = form.name.trim();
  if (name.length < 2 || name.length > 150) errors.name = SCHOOL_FIELD_MESSAGES.name;
  if (!form.province) errors.province = SCHOOL_FIELD_MESSAGES.province;
  const emis = form.emisNumber.trim();
  if (emis && !/^\d{6,12}$/.test(emis)) errors.emisNumber = SCHOOL_FIELD_MESSAGES.emisNumber;
  if (form.contactEmail.trim() && !isEmail(form.contactEmail)) {
    errors.contactEmail = SCHOOL_FIELD_MESSAGES.contactEmail;
  }
  if (form.contactPhone.trim() && !normalizeSaPhone(form.contactPhone)) {
    errors.contactPhone = SCHOOL_FIELD_MESSAGES.contactPhone;
  }
  if (!isEmail(form.firstAdminEmail))
    errors.firstAdminEmail = SCHOOL_FIELD_MESSAGES.firstAdminEmail;
  return errors;
}

const HINT_FIELDS: Record<string, SchoolField> = {
  name: "name",
  province: "province",
  emis_number: "emisNumber",
  contact_email: "contactEmail",
  contact_phone: "contactPhone",
  first_admin_email: "firstAdminEmail",
};

/** The form field a database refusal belongs to, if any. */
export function schoolFieldForError(error: unknown): SchoolField | null {
  const fields = error && typeof error === "object" ? (error as Record<string, unknown>) : {};
  if (fields["code"] === "23505") return "emisNumber";
  if (fields["code"] === "LBR30") return HINT_FIELDS[String(fields["hint"] ?? "")] ?? null;
  return null;
}

export const DUPLICATE_EMIS_MESSAGE = "Another school is already registered with this EMIS number.";
