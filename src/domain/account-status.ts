/**
 * Account lifecycle (tracker P2-05): an account is active, suspended (a
 * temporary stop) or deactivated (closed). Suspended and deactivated people
 * can still sign in, but only see a notice; the database stops their roles
 * from counting (db/pending/P2-05-account-lifecycle.sql). Nothing is deleted.
 */
import type { StatusTone } from "@/components/design/status-pill";

export type AccountStatus = "active" | "suspended" | "deactivated";

export const ACCOUNT_STATUS_LABELS: Record<AccountStatus, string> = {
  active: "Active",
  suspended: "Suspended",
  deactivated: "Deactivated",
};

export const ACCOUNT_STATUS_TONES: Record<AccountStatus, StatusTone> = {
  active: "success",
  suspended: "warning",
  deactivated: "danger",
};

export interface StatusAction {
  to: AccountStatus;
  label: string;
  /** Shown before confirming, so the admin knows what will happen. */
  explanation: string;
}

const SUSPEND: StatusAction = {
  to: "suspended",
  label: "Suspend",
  explanation:
    "They can still sign in but will only see a notice, until someone reactivates the account. Nothing is deleted.",
};
const DEACTIVATE: StatusAction = {
  to: "deactivated",
  label: "Deactivate",
  explanation:
    "Closes the account: they will only see a notice that it's closed. Their records are kept and it can be reactivated later.",
};
const REACTIVATE: StatusAction = {
  to: "active",
  label: "Reactivate",
  explanation: "Restores their access with the roles they already have.",
};

/** What an admin can do next from each status. */
export function statusActions(current: AccountStatus): StatusAction[] {
  switch (current) {
    case "active":
      return [SUSPEND, DEACTIVATE];
    case "suspended":
      return [REACTIVATE, DEACTIVATE];
    case "deactivated":
      return [REACTIVATE];
  }
}

export function isAccountStatus(value: unknown): value is AccountStatus {
  return value === "active" || value === "suspended" || value === "deactivated";
}

/** The notice a suspended or deactivated person sees after signing in. */
export function blockedNotice(status: Exclude<AccountStatus, "active">): {
  title: string;
  description: string;
} {
  return status === "suspended"
    ? {
        title: "Your account is suspended",
        description:
          "You can't use LearnBridge while your account is suspended. Your work and records are safe. Contact your school or LearnBridge support to find out more.",
      }
    : {
        title: "Your account has been closed",
        description:
          "This account is no longer active. Your records are kept. If you think this is a mistake, contact your school or LearnBridge support.",
      };
}
