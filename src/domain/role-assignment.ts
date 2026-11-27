/**
 * Rules for platform admins giving and removing roles (tracker P2-03).
 *
 * The database is the real gate (db/pending/P2-03-role-assignment.sql): these
 * checks only let the screen explain problems before a request is sent, and
 * turn the database's error codes into plain words.
 */
import type { PlatformRole } from "./permissions";

/** Roles in the order the People screen lists them. */
export const ASSIGNABLE_ROLES: readonly PlatformRole[] = [
  "teacher",
  "school_admin",
  "parent",
  "learner",
  "platform_admin",
];

export const ROLE_NAMES: Record<PlatformRole, string> = {
  platform_admin: "Platform administrator",
  school_admin: "School administrator",
  teacher: "Teacher",
  learner: "Learner",
  parent: "Parent or guardian",
};

/** Same minimum as the database's require_reason(). */
export const MIN_REASON_LENGTH = 3;
export const MAX_REASON_LENGTH = 500;

/** An error message for the reason field, or null when it's acceptable. */
export function reasonProblem(reason: string): string | null {
  const trimmed = reason.trim();
  if (trimmed.length < MIN_REASON_LENGTH) {
    return "Say why you're making this change. It's saved in the audit log.";
  }
  if (trimmed.length > MAX_REASON_LENGTH) {
    return `Keep the reason under ${MAX_REASON_LENGTH} characters.`;
  }
  return null;
}

/** Trim and lower-case an email the way the database compares it. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** A rough shape check so obvious typos don't reach the server. */
export function looksLikeEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

/** Roles the person doesn't have yet, in screen order. */
export function rolesToOffer(current: readonly PlatformRole[]): PlatformRole[] {
  return ASSIGNABLE_ROLES.filter((r) => !current.includes(r));
}

/** Whether `actorId` may press "Remove" on this role for `targetId`. */
export function canRemoveRole(actorId: string, targetId: string, role: PlatformRole): boolean {
  return !(actorId === targetId && role === "platform_admin");
}

export type RoleChangeProblem =
  | "own-admin-role"
  | "reason-required"
  | "user-not-found"
  | "not-allowed"
  | "setup-missing"
  | "unknown";

const PROBLEM_BY_CODE: Record<string, RoleChangeProblem> = {
  LBR01: "own-admin-role",
  LBR02: "reason-required",
  LBR03: "user-not-found",
  "42501": "not-allowed",
  // PostgREST: the function doesn't exist (the database update isn't applied).
  PGRST202: "setup-missing",
};

export function roleChangeProblem(error: unknown): RoleChangeProblem {
  const code =
    error && typeof error === "object" ? String((error as { code?: unknown }).code ?? "") : "";
  return PROBLEM_BY_CODE[code] ?? "unknown";
}

export const ROLE_CHANGE_MESSAGES: Record<RoleChangeProblem, string> = {
  "own-admin-role":
    "You can't remove your own platform administrator role. Ask another platform administrator to do it.",
  "reason-required": "Say why you're making this change. It's saved in the audit log.",
  "user-not-found": "That account no longer exists. Search again.",
  "not-allowed": "Only platform administrators can change roles.",
  "setup-missing":
    "Role management isn't switched on in the database yet. The P2-03 database update needs to be applied in Lovable.",
  unknown: "That didn't work. Please try again.",
};
