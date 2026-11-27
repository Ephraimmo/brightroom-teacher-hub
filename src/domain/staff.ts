/**
 * School staff management rules (tracker P3-03). The database enforces them
 * (db/pending/P3-03-staff-management.sql); these drive the screen.
 */
import type { StatusTone } from "@/components/design/status-pill";

export type StaffStatus = "invited" | "active" | "suspended" | "removed";

export const STAFF_STATUS_LABELS: Record<StaffStatus, string> = {
  invited: "Invited",
  active: "Active",
  suspended: "Suspended",
  removed: "Removed",
};

export const STAFF_STATUS_TONES: Record<StaffStatus, StatusTone> = {
  invited: "info",
  active: "success",
  suspended: "warning",
  removed: "neutral",
};

export interface StaffAction {
  to: "active" | "suspended" | "removed";
  label: string;
  explanation: string;
}

const SUSPEND: StaffAction = {
  to: "suspended",
  label: "Suspend",
  explanation: "They lose access to this school until reactivated. Nothing is deleted.",
};
const REMOVE: StaffAction = {
  to: "removed",
  label: "Remove",
  explanation:
    "They no longer work at this school and lose access. Their history is kept, and they can be reactivated later.",
};
const REACTIVATE: StaffAction = {
  to: "active",
  label: "Reactivate",
  explanation: "Restores their access to this school.",
};

export function staffActions(status: StaffStatus): StaffAction[] {
  switch (status) {
    case "active":
      return [SUSPEND, REMOVE];
    case "suspended":
      return [REACTIVATE, REMOVE];
    case "removed":
      return [REACTIVATE];
    case "invited":
      return [];
  }
}

const MESSAGES: Record<string, string> = {
  LBR02: "Say why you're making this change. It's saved in the audit log.",
  LBR03: "That staff member couldn't be found in your school. Refresh the page.",
  LBR30: "One of the values isn't valid. Check it and try again.",
  LBR36: "That person already works here with this role.",
  LBR50: "You can't change your own membership. Ask another administrator.",
  LBR51: "The school needs at least one active administrator. Invite another admin first.",
  LBR52: "Choose only grades your school offers (set them in Settings).",
  "42501": "Only this school's administrators can do this, after signing in with their code.",
  PGRST202:
    "This isn't switched on in the database yet. The pending database updates (db/pending) need to be applied in Lovable.",
};

export function staffErrorMessage(error: unknown): string {
  const code =
    error && typeof error === "object" ? String((error as { code?: unknown }).code ?? "") : "";
  return MESSAGES[code] ?? "That didn't work. Please try again.";
}
