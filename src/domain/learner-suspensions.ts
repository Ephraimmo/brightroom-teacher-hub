/**
 * Several parties can suspend a learner independently (a guardian, a school, the platform).
 * Each suspension is a separate record and can be lifted only by its own kind of party,
 * so a parent reactivating never cancels a school's suspension, and vice versa.
 * Suspending never deletes anything: it only restricts access.
 */
export type SuspensionSource = "guardian" | "institution" | "platform";

export interface LearnerSuspension {
  id: string;
  learnerId: string;
  source: SuspensionSource;
  /** Set when source is "institution": the school that imposed it. */
  institutionId: string | null;
  imposedBy: string;
  reason: string;
  startsAt: string;
  liftedAt: string | null;
}

/**
 * Who is acting. The caller must already have established the relationship
 * (e.g. that this guardian is actively linked with suspend rights); the database
 * procedures enforce that again.
 */
export type SuspensionActor =
  | { kind: "guardian"; userId: string }
  | { kind: "institution_admin"; userId: string; institutionId: string }
  | { kind: "platform_admin"; userId: string };

export function suspensionSourceFor(actor: SuspensionActor): SuspensionSource {
  switch (actor.kind) {
    case "guardian":
      return "guardian";
    case "institution_admin":
      return "institution";
    case "platform_admin":
      return "platform";
  }
}

export function isSuspensionOpen(suspension: LearnerSuspension, now: Date = new Date()): boolean {
  if (suspension.liftedAt !== null) return false;
  const start = Date.parse(suspension.startsAt);
  return Number.isFinite(start) && start <= now.getTime();
}

export function openSuspensionsFor(
  learnerId: string,
  suspensions: readonly LearnerSuspension[],
  now: Date = new Date(),
): LearnerSuspension[] {
  return suspensions.filter(
    (suspension) => suspension.learnerId === learnerId && isSuspensionOpen(suspension, now),
  );
}

export function canLiftSuspension(actor: SuspensionActor, suspension: LearnerSuspension): boolean {
  if (suspension.liftedAt !== null) return false;
  if (suspensionSourceFor(actor) !== suspension.source) return false;
  if (actor.kind === "institution_admin") return actor.institutionId === suspension.institutionId;
  return true;
}

export interface SuspendRequest {
  id: string;
  learnerId: string;
  actor: SuspensionActor;
  reason: string;
  now?: Date;
}

/** Builds a new suspension. Refuses a blank reason and a duplicate open suspension from the same party. */
export function createSuspension(
  request: SuspendRequest,
  existing: readonly LearnerSuspension[],
): { ok: true; suspension: LearnerSuspension } | { ok: false; error: string } {
  const reason = request.reason.trim();
  if (reason.length === 0) return { ok: false, error: "A reason is required." };

  const now = request.now ?? new Date();
  const source = suspensionSourceFor(request.actor);
  const institutionId =
    request.actor.kind === "institution_admin" ? request.actor.institutionId : null;

  const duplicate = openSuspensionsFor(request.learnerId, existing, now).some(
    (suspension) => suspension.source === source && suspension.institutionId === institutionId,
  );
  if (duplicate) return { ok: false, error: "This learner is already suspended by you." };

  return {
    ok: true,
    suspension: {
      id: request.id,
      learnerId: request.learnerId,
      source,
      institutionId,
      imposedBy: request.actor.userId,
      reason,
      startsAt: now.toISOString(),
      liftedAt: null,
    },
  };
}
