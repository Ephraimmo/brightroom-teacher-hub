/**
 * Turning audit log entries into plain sentences for Admin → Audit log (P2-05).
 */
import { ACCOUNT_STATUS_LABELS, isAccountStatus } from "./account-status";
import type { PlatformRole } from "./permissions";
import { ROLE_NAMES } from "./role-assignment";

export interface AuditEntry {
  id: number;
  occurredAt: string;
  action: string;
  actorEmail: string | null;
  actorRole: string | null;
  entityType: string;
  entityId: string;
  targetEmail: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reason: string | null;
}

/** Filter groups shown on the Audit log page; the value is an action prefix. */
export const AUDIT_GROUPS = [
  { value: "", label: "All changes" },
  { value: "role.", label: "Roles" },
  { value: "account.", label: "Account status" },
  { value: "profile.", label: "Profiles" },
] as const;

const ACTION_LABELS: Record<string, string> = {
  "role.grant": "Role given",
  "role.revoke": "Role removed",
  "account.suspend": "Account suspended",
  "account.deactivate": "Account deactivated",
  "account.reactivate": "Account reactivated",
  "profile.update": "Profile updated",
  "profile.photo_set": "Profile photo changed",
  "profile.photo_remove": "Profile photo removed",
};

const FIELD_LABELS: Record<string, string> = {
  full_name: "full name",
  display_name: "display name",
  phone: "mobile number",
  preferred_language: "language",
  contact_email: "email contact",
  contact_sms: "SMS contact",
  contact_whatsapp: "WhatsApp contact",
};

export function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

function roleName(value: unknown): string {
  return typeof value === "string" && value in ROLE_NAMES
    ? ROLE_NAMES[value as PlatformRole]
    : String(value ?? "");
}

function statusName(value: unknown): string {
  return isAccountStatus(value) ? ACCOUNT_STATUS_LABELS[value] : String(value ?? "");
}

/** A short description of what changed, e.g. "Active → Suspended". */
export function auditDetails(entry: AuditEntry): string {
  switch (entry.action) {
    case "role.grant":
      return roleName(entry.after?.["role"]);
    case "role.revoke":
      return roleName(entry.before?.["role"]);
    case "account.suspend":
    case "account.deactivate":
    case "account.reactivate":
      return `${statusName(entry.before?.["status"])} → ${statusName(entry.after?.["status"])}`;
    case "profile.update": {
      const fields = entry.after?.["fields"];
      if (!Array.isArray(fields) || fields.length === 0) return "";
      return `Changed: ${fields.map((f) => FIELD_LABELS[String(f)] ?? String(f)).join(", ")}`;
    }
    default:
      return "";
  }
}

/** Who did it, in words. */
export function auditActor(entry: AuditEntry): string {
  if (entry.actorRole === "self") return "The person themselves";
  return entry.actorEmail ?? "System";
}

const DATE_TIME = new Intl.DateTimeFormat("en-ZA", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Africa/Johannesburg",
});

/** South African date and time, e.g. "27 Nov 2026, 14:05". */
export function auditWhen(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : DATE_TIME.format(date);
}
