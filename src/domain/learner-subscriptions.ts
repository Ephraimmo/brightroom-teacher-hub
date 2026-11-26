export type LearnerSubscriptionStatus =
  "active" | "pending_payment" | "expired" | "suspended" | "cancelled";

export interface LearnerSubscription {
  learnerId: string;
  status: LearnerSubscriptionStatus;
  startsAt: string;
  endsAt: string | null;
}

export function hasActiveLearnerSubscription(
  learnerId: string,
  subscriptions: readonly LearnerSubscription[],
  now: Date = new Date(),
): boolean {
  const currentTime = now.getTime();

  return subscriptions.some((subscription) => {
    if (subscription.learnerId !== learnerId || subscription.status !== "active") {
      return false;
    }

    const startTime = Date.parse(subscription.startsAt);
    if (!Number.isFinite(startTime) || startTime > currentTime) return false;
    if (subscription.endsAt === null) return true;

    const endTime = Date.parse(subscription.endsAt);
    return Number.isFinite(endTime) && endTime > currentTime;
  });
}
