/**
 * Parent and guardian records (tracker P3-04). The database enforces the same
 * rules (db/pending/P3-04-guardians.sql).
 */
import { isLanguageCode, normalizeSaMobile, type LanguageCode } from "./profile";
import { isEmail } from "./schools";

export const RELATIONSHIPS = [
  { value: "mother", label: "Mother" },
  { value: "father", label: "Father" },
  { value: "guardian", label: "Legal guardian" },
  { value: "grandparent", label: "Grandparent" },
  { value: "foster_parent", label: "Foster parent" },
  { value: "other", label: "Other caregiver" },
] as const;
export type Relationship = (typeof RELATIONSHIPS)[number]["value"];

export const relationshipLabel = (value: string) =>
  RELATIONSHIPS.find((r) => r.value === value)?.label ?? value;

export interface GuardianForm {
  firstName: string;
  lastName: string;
  relationship: Relationship | "";
  email: string;
  phone: string;
  language: LanguageCode;
  contactEmail: boolean;
  contactSms: boolean;
  contactWhatsapp: boolean;
}

export const EMPTY_GUARDIAN: GuardianForm = {
  firstName: "",
  lastName: "",
  relationship: "",
  email: "",
  phone: "",
  language: "en",
  contactEmail: true,
  contactSms: false,
  contactWhatsapp: false,
};

export type GuardianField =
  "firstName" | "lastName" | "relationship" | "email" | "phone" | "language" | "contact";
export type GuardianErrors = Partial<Record<GuardianField, string>>;

export const GUARDIAN_MESSAGES: Record<GuardianField, string> = {
  firstName: "Enter their first name.",
  lastName: "Enter their surname.",
  relationship: "Choose how they're related to the learner.",
  email: "Enter a valid email address, or a mobile number instead.",
  phone: "Enter a South African mobile number, for example 082 123 4567.",
  language: "Choose a language from the list.",
  contact:
    "Each way of contacting them needs its detail: email needs an email, SMS and WhatsApp need a mobile.",
};

export function validateGuardian(form: GuardianForm): GuardianErrors {
  const errors: GuardianErrors = {};
  const first = form.firstName.trim();
  const last = form.lastName.trim();
  if (!first || first.length > 80) errors.firstName = GUARDIAN_MESSAGES.firstName;
  if (!last || last.length > 80) errors.lastName = GUARDIAN_MESSAGES.lastName;
  if (!form.relationship) errors.relationship = GUARDIAN_MESSAGES.relationship;
  const email = form.email.trim();
  const phone = form.phone.trim();
  if (email && !isEmail(email)) errors.email = GUARDIAN_MESSAGES.email;
  if (phone && !normalizeSaMobile(phone)) errors.phone = GUARDIAN_MESSAGES.phone;
  if (!email && !phone) {
    errors.email = "Add an email address or a mobile number so the school can reach them.";
  }
  if (!isLanguageCode(form.language)) errors.language = GUARDIAN_MESSAGES.language;
  if ((form.contactEmail && !email) || ((form.contactSms || form.contactWhatsapp) && !phone)) {
    errors.contact = GUARDIAN_MESSAGES.contact;
  }
  return errors;
}

const HINTS: Record<string, GuardianField> = {
  first_name: "firstName",
  last_name: "lastName",
  relationship: "relationship",
  email: "email",
  phone: "phone",
  language: "language",
  contact: "contact",
};

const SETUP_MISSING =
  "This isn't switched on in the database yet. The pending database updates (db/pending) need to be applied in Lovable.";

/** Where a database refusal belongs, and what to say. */
export function guardianError(error: unknown): { field: GuardianField | null; message: string } {
  const e = error && typeof error === "object" ? (error as Record<string, unknown>) : {};
  const code = String(e["code"] ?? "");
  switch (code) {
    case "LBR61":
      return {
        field: "email",
        message: "This email is already on another parent record at your school.",
      };
    case "LBR60": {
      const field = HINTS[String(e["hint"] ?? "")] ?? null;
      if (field === "email" && String(e["message"] ?? "").includes("fixed")) {
        return {
          field,
          message: "The email can't change once the parent has created their account.",
        };
      }
      return {
        field,
        message: field ? GUARDIAN_MESSAGES[field] : "Check the details and try again.",
      };
    }
    case "LBR03":
      return { field: null, message: "That parent record couldn't be found. Refresh the page." };
    case "LBR02":
      return {
        field: null,
        message: "Say why you're making this change. It's saved in the audit log.",
      };
    case "42501":
      return {
        field: null,
        message: "Only this school's administrators can manage parent records.",
      };
    case "PGRST202":
      return { field: null, message: SETUP_MISSING };
    default:
      return { field: null, message: "That didn't save. Please try again." };
  }
}

/** Case-insensitive search over name, email and mobile number. */
export function matchesSearch(
  g: { firstName: string; lastName: string; email: string | null; phone: string | null },
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (`${g.firstName} ${g.lastName}`.toLowerCase().includes(q)) return true;
  if ((g.email ?? "").includes(q)) return true;
  // "082 123" matches +2782123...
  const digits = q.replace(/\D/g, "").replace(/^0/, "");
  return digits.length >= 3 && (g.phone ?? "").replace(/\D/g, "").includes(digits);
}
