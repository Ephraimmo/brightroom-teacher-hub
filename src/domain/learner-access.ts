import { hasActiveLearnerSubscription, type LearnerSubscription } from "./learner-subscriptions";
import { openSuspensionsFor, type LearnerSuspension } from "./learner-suspensions";

/**
 * The learning-access rule (docs/plan/01-architecture.md, "The learning-access rule"):
 * a learner may learn when no open suspension applies AND they hold an active
 * subscription for the current period.
 *
 * Exam exception: a suspension imposed, or a subscription that lapses, while an
 * assessment attempt is already in progress does not cut the attempt off. The learner
 * may finish that one attempt (until its deadline); everything else is restricted,
 * and the deferred suspensions are reported so they can be recorded and notified.
 */
export type AccessScope = "full" | "assessment_in_progress_only" | "none";
export type AccessDenialReason = "suspended" | "no_active_subscription";

export interface InProgressAttempt {
  attemptId: string;
  startedAt: string;
  deadlineAt: string;
}

export interface LearnerAccessInput {
  learnerId: string;
  subscriptions: readonly LearnerSubscription[];
  suspensions: readonly LearnerSuspension[];
  inProgressAttempt?: InProgressAttempt | null;
  now?: Date;
}

export interface LearnerAccessDecision {
  scope: AccessScope;
  /** Why full access is not available (empty when scope is "full"). */
  reasons: AccessDenialReason[];
  /** Suspensions held back until the in-progress attempt ends. */
  deferredSuspensionIds: string[];
}

function attemptIsRunning(attempt: InProgressAttempt, now: Date): boolean {
  const start = Date.parse(attempt.startedAt);
  const deadline = Date.parse(attempt.deadlineAt);
  return (
    Number.isFinite(start) &&
    Number.isFinite(deadline) &&
    start <= now.getTime() &&
    now.getTime() < deadline
  );
}

/** True when the subscription was active when the attempt started. */
function hadSubscriptionAt(
  learnerId: string,
  subscriptions: readonly LearnerSubscription[],
  at: Date,
): boolean {
  return hasActiveLearnerSubscription(
    learnerId,
    subscriptions.map((subscription) =>
      // A subscription that has since expired was still active at that moment.
      subscription.status === "expired" ? { ...subscription, status: "active" } : subscription,
    ),
    at,
  );
}

export function evaluateLearnerAccess(input: LearnerAccessInput): LearnerAccessDecision {
  const now = input.now ?? new Date();
  const openSuspensions = openSuspensionsFor(input.learnerId, input.suspensions, now);
  const subscribed = hasActiveLearnerSubscription(input.learnerId, input.subscriptions, now);

  const reasons: AccessDenialReason[] = [];
  if (openSuspensions.length > 0) reasons.push("suspended");
  if (!subscribed) reasons.push("no_active_subscription");

  if (reasons.length === 0) return { scope: "full", reasons, deferredSuspensionIds: [] };

  const attempt = input.inProgressAttempt;
  if (attempt && attemptIsRunning(attempt, now)) {
    const attemptStart = Date.parse(attempt.startedAt);
    const suspensionsAfterStart = openSuspensions.filter(
      (suspension) => Date.parse(suspension.startsAt) >= attemptStart,
    );
    const allSuspensionsAfterStart = suspensionsAfterStart.length === openSuspensions.length;
    const subscriptionOkAtStart =
      subscribed || hadSubscriptionAt(input.learnerId, input.subscriptions, new Date(attemptStart));

    if (allSuspensionsAfterStart && subscriptionOkAtStart) {
      return {
        scope: "assessment_in_progress_only",
        reasons,
        deferredSuspensionIds: suspensionsAfterStart.map((suspension) => suspension.id),
      };
    }
  }

  return { scope: "none", reasons, deferredSuspensionIds: [] };
}
