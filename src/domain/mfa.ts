/**
 * Multi-factor authentication rules (tracker P2-06).
 *
 * Platform and school administrators must use an authenticator app. The
 * database refuses their admin powers unless the session passed MFA
 * (db/pending/P2-06-mfa.sql); these rules decide which screen to show so they
 * aren't met with confusing "no access" errors instead.
 */
import type { PlatformRole } from "./permissions";

export const MFA_REQUIRED_ROLES: readonly PlatformRole[] = ["platform_admin", "school_admin"];

export function roleNeedsMfa(role: PlatformRole): boolean {
  return MFA_REQUIRED_ROLES.includes(role);
}

/** Supabase's assurance levels: aal1 = password only, aal2 = password + authenticator code. */
export type AssuranceLevel = "aal1" | "aal2";

export interface MfaState {
  currentLevel: AssuranceLevel | null;
  /** aal2 when the person has a verified authenticator, even if this session hasn't used it yet. */
  nextLevel: AssuranceLevel | null;
  verifiedFactors: number;
}

/**
 * What someone entering an area for `role` must do first:
 * - "ok": nothing
 * - "enrol": set up an authenticator app (required for this role, none set up)
 * - "verify": enter a code from their authenticator app for this session
 */
export function mfaStep(role: PlatformRole, state: MfaState): "ok" | "enrol" | "verify" {
  if (!roleNeedsMfa(role)) return "ok";
  if (state.verifiedFactors === 0) return "enrol";
  if (state.currentLevel !== "aal2") return "verify";
  return "ok";
}

/** A 6-digit authenticator code, ignoring spaces people type between groups. */
export function cleanTotpCode(input: string): string | null {
  const digits = input.replace(/\s+/g, "");
  return /^\d{6}$/.test(digits) ? digits : null;
}

export const MAX_FACTORS = 2;

export const MFA_MESSAGES = {
  badCode:
    "That code didn't work. Check the time on your phone is correct and try the newest code.",
  tooMany: "Too many attempts. Wait a minute, then try again.",
  failed: "That didn't work. Please try again.",
} as const;

/** Map a Supabase Auth MFA error to a message. */
export function mfaErrorMessage(error: unknown): string {
  const code =
    error && typeof error === "object" ? String((error as { code?: unknown }).code ?? "") : "";
  const status =
    error && typeof error === "object" ? Number((error as { status?: unknown }).status) : NaN;
  if (code === "mfa_verification_failed" || code === "mfa_challenge_expired") {
    return MFA_MESSAGES.badCode;
  }
  if (code === "over_request_rate_limit" || status === 429) return MFA_MESSAGES.tooMany;
  return MFA_MESSAGES.failed;
}
