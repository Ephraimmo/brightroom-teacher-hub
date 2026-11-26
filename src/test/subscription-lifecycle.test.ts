import { describe, expect, it } from "vitest";

import { hasActiveLearnerSubscription } from "@/domain/learner-subscriptions";
import {
  applyVerifiedPayment,
  expireLapsedSubscriptions,
  transitionSubscription,
  type SubscriptionRecord,
} from "@/domain/subscription-lifecycle";

const now = new Date("2026-11-26T09:00:00.000Z");
const period = {
  periodStart: "2026-11-26T00:00:00.000Z",
  periodEnd: "2026-12-26T00:00:00.000Z",
};

function pending(id: string, learnerId: string): SubscriptionRecord {
  return {
    id,
    learnerId,
    planId: "monthly",
    payerUserId: "parent-1",
    status: "pending_payment",
    startsAt: "2026-11-26T00:00:00.000Z",
    endsAt: null,
  };
}

describe("subscription lifecycle", () => {
  it("activates only the child whose subscription was paid, among three siblings", () => {
    const family = [
      pending("sub-thandi", "thandi"),
      pending("sub-sipho", "sipho"),
      pending("sub-lerato", "lerato"),
    ];

    const result = applyVerifiedPayment(
      family,
      { subscriptionId: "sub-sipho", learnerId: "sipho", ...period },
      now,
    );
    if (!result.ok) throw new Error(result.error);

    expect(result.subscriptions.map((subscription) => subscription.status)).toEqual([
      "pending_payment",
      "active",
      "pending_payment",
    ]);
    expect(hasActiveLearnerSubscription("sipho", result.subscriptions, now)).toBe(true);
    expect(hasActiveLearnerSubscription("thandi", result.subscriptions, now)).toBe(false);
    expect(hasActiveLearnerSubscription("lerato", result.subscriptions, now)).toBe(false);
  });

  it("rejects a payment whose learner does not match its subscription", () => {
    const result = applyVerifiedPayment(
      [pending("sub-thandi", "thandi")],
      { subscriptionId: "sub-thandi", learnerId: "sipho", ...period },
      now,
    );
    expect(result.ok).toBe(false);
  });

  it("rejects a payment for an unknown subscription", () => {
    const result = applyVerifiedPayment(
      [pending("sub-thandi", "thandi")],
      { subscriptionId: "sub-nobody", learnerId: "thandi", ...period },
      now,
    );
    expect(result.ok).toBe(false);
  });

  it("rejects a payment with an invalid period", () => {
    const result = transitionSubscription(pending("s", "l"), {
      type: "payment_verified",
      periodStart: period.periodEnd,
      periodEnd: period.periodStart,
    });
    expect(result.ok).toBe(false);
  });

  it("renews an expired subscription when payment is verified", () => {
    const expired: SubscriptionRecord = {
      ...pending("s", "l"),
      status: "expired",
      startsAt: "2026-10-01T00:00:00.000Z",
      endsAt: "2026-11-01T00:00:00.000Z",
    };
    const result = transitionSubscription(expired, { type: "payment_verified", ...period }, now);
    expect(result.ok && result.subscription.status).toBe("active");
  });

  it("expires only active subscriptions whose period has ended", () => {
    const lapsed: SubscriptionRecord = {
      ...pending("lapsed", "a"),
      status: "active",
      endsAt: "2026-11-25T00:00:00.000Z",
    };
    const current: SubscriptionRecord = {
      ...pending("current", "b"),
      status: "active",
      endsAt: "2026-12-25T00:00:00.000Z",
    };
    const waiting = pending("waiting", "c");

    expect(expireLapsedSubscriptions([lapsed, current, waiting], now).map((s) => s.status)).toEqual(
      ["expired", "active", "pending_payment"],
    );
  });

  it("will not mark a subscription expired before its period ends", () => {
    const current: SubscriptionRecord = {
      ...pending("s", "l"),
      status: "active",
      endsAt: "2026-12-25T00:00:00.000Z",
    };
    expect(transitionSubscription(current, { type: "period_ended" }, now).ok).toBe(false);
  });

  it("resumes a suspended subscription as active, or expired if its period ran out", () => {
    const suspended: SubscriptionRecord = {
      ...pending("s", "l"),
      status: "suspended",
      endsAt: "2026-12-25T00:00:00.000Z",
    };
    const resumed = transitionSubscription(suspended, { type: "resume" }, now);
    expect(resumed.ok && resumed.subscription.status).toBe("active");

    const ranOut = { ...suspended, endsAt: "2026-11-20T00:00:00.000Z" };
    const resumedLate = transitionSubscription(ranOut, { type: "resume" }, now);
    expect(resumedLate.ok && resumedLate.subscription.status).toBe("expired");
  });

  it("treats cancelled as final", () => {
    const cancelled: SubscriptionRecord = { ...pending("s", "l"), status: "cancelled" };
    for (const event of [
      { type: "payment_verified" as const, ...period },
      { type: "resume" as const },
      { type: "suspend" as const },
    ]) {
      expect(transitionSubscription(cancelled, event, now).ok).toBe(false);
    }
  });

  it("does not let a pending subscription be suspended or expired", () => {
    const waiting = pending("s", "l");
    expect(transitionSubscription(waiting, { type: "suspend" }, now).ok).toBe(false);
    expect(transitionSubscription(waiting, { type: "period_ended" }, now).ok).toBe(false);
  });
});
