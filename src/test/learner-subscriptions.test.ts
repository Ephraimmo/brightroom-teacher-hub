import { describe, expect, it } from "vitest";

import {
  hasActiveLearnerSubscription,
  type LearnerSubscription,
} from "@/domain/learner-subscriptions";

const now = new Date("2026-11-23T05:06:00.000Z");

describe("learner subscription access", () => {
  it("does not let one learner's active subscription activate another learner", () => {
    const subscriptions: LearnerSubscription[] = [
      {
        learnerId: "learner-001",
        status: "active",
        startsAt: "2026-01-01T00:00:00.000Z",
        endsAt: "2027-01-01T00:00:00.000Z",
      },
    ];

    expect(hasActiveLearnerSubscription("learner-001", subscriptions, now)).toBe(true);
    expect(hasActiveLearnerSubscription("learner-002", subscriptions, now)).toBe(false);
  });

  it("allows access only for subscriptions in active status", () => {
    const statuses: LearnerSubscription["status"][] = [
      "pending_payment",
      "expired",
      "suspended",
      "cancelled",
    ];

    for (const status of statuses) {
      expect(
        hasActiveLearnerSubscription(
          "learner-001",
          [
            {
              learnerId: "learner-001",
              status,
              startsAt: "2026-01-01T00:00:00.000Z",
              endsAt: "2027-01-01T00:00:00.000Z",
            },
          ],
          now,
        ),
      ).toBe(false);
    }
  });

  it("blocks access before a subscription starts or when it expires", () => {
    const startsLater: LearnerSubscription = {
      learnerId: "learner-001",
      status: "active",
      startsAt: "2026-12-01T00:00:00.000Z",
      endsAt: "2027-01-01T00:00:00.000Z",
    };
    const expiresNow: LearnerSubscription = {
      learnerId: "learner-001",
      status: "active",
      startsAt: "2026-01-01T00:00:00.000Z",
      endsAt: now.toISOString(),
    };

    expect(hasActiveLearnerSubscription("learner-001", [startsLater], now)).toBe(false);
    expect(hasActiveLearnerSubscription("learner-001", [expiresNow], now)).toBe(false);
  });
});