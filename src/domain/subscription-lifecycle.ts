import type { LearnerSubscription, LearnerSubscriptionStatus } from "./learner-subscriptions";

/**
 * A subscription always belongs to exactly one learner. The parent is only the payer.
 * `startsAt` / `endsAt` hold the current paid period.
 */
export interface SubscriptionRecord extends LearnerSubscription {
  id: string;
  planId: string;
  payerUserId: string;
}

export type SubscriptionEvent =
  | { type: "payment_verified"; periodStart: string; periodEnd: string }
  | { type: "period_ended" }
  | { type: "suspend" }
  | { type: "resume" }
  | { type: "cancel" };

export type TransitionResult =
  { ok: true; subscription: SubscriptionRecord } | { ok: false; error: string };

const allowedEvents: Record<LearnerSubscriptionStatus, readonly SubscriptionEvent["type"][]> = {
  pending_payment: ["payment_verified", "cancel"],
  active: ["payment_verified", "period_ended", "suspend", "cancel"],
  expired: ["payment_verified", "cancel"],
  suspended: ["resume", "cancel"],
  cancelled: [],
};

export function canApplyEvent(
  status: LearnerSubscriptionStatus,
  event: SubscriptionEvent["type"],
): boolean {
  return allowedEvents[status].includes(event);
}

function periodHasEnded(subscription: SubscriptionRecord, now: Date): boolean {
  if (subscription.endsAt === null) return false;
  const end = Date.parse(subscription.endsAt);
  return Number.isFinite(end) && end <= now.getTime();
}

export function transitionSubscription(
  subscription: SubscriptionRecord,
  event: SubscriptionEvent,
  now: Date = new Date(),
): TransitionResult {
  if (!canApplyEvent(subscription.status, event.type)) {
    return {
      ok: false,
      error: `A ${subscription.status} subscription cannot accept "${event.type}".`,
    };
  }

  switch (event.type) {
    case "payment_verified": {
      const start = Date.parse(event.periodStart);
      const end = Date.parse(event.periodEnd);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
        return { ok: false, error: "The paid period is invalid." };
      }
      return {
        ok: true,
        subscription: {
          ...subscription,
          status: "active",
          startsAt: event.periodStart,
          endsAt: event.periodEnd,
        },
      };
    }
    case "period_ended":
      if (!periodHasEnded(subscription, now)) {
        return { ok: false, error: "The current period has not ended yet." };
      }
      return { ok: true, subscription: { ...subscription, status: "expired" } };
    case "suspend":
      return { ok: true, subscription: { ...subscription, status: "suspended" } };
    case "resume":
      return {
        ok: true,
        subscription: {
          ...subscription,
          status: periodHasEnded(subscription, now) ? "expired" : "active",
        },
      };
    case "cancel":
      return { ok: true, subscription: { ...subscription, status: "cancelled" } };
  }
}

export interface VerifiedPayment {
  subscriptionId: string;
  learnerId: string;
  periodStart: string;
  periodEnd: string;
}

/**
 * Applies a verified payment to the one subscription it names. Every other
 * subscription, including the same parent's other children, is returned unchanged.
 * A payment whose learner does not match its subscription is rejected outright.
 */
export function applyVerifiedPayment(
  subscriptions: readonly SubscriptionRecord[],
  payment: VerifiedPayment,
  now: Date = new Date(),
): { ok: true; subscriptions: SubscriptionRecord[] } | { ok: false; error: string } {
  const target = subscriptions.find((subscription) => subscription.id === payment.subscriptionId);
  if (!target) return { ok: false, error: "The payment's subscription was not found." };
  if (target.learnerId !== payment.learnerId) {
    return { ok: false, error: "The payment's learner does not match its subscription." };
  }

  const result = transitionSubscription(
    target,
    { type: "payment_verified", periodStart: payment.periodStart, periodEnd: payment.periodEnd },
    now,
  );
  if (!result.ok) return result;

  return {
    ok: true,
    subscriptions: subscriptions.map((subscription) =>
      subscription.id === target.id ? result.subscription : subscription,
    ),
  };
}

/** For the daily job: moves active subscriptions whose period has ended to "expired". */
export function expireLapsedSubscriptions(
  subscriptions: readonly SubscriptionRecord[],
  now: Date = new Date(),
): SubscriptionRecord[] {
  return subscriptions.map((subscription) => {
    if (subscription.status !== "active" || !periodHasEnded(subscription, now)) {
      return subscription;
    }
    return { ...subscription, status: "expired" };
  });
}
