import { describe, expect, it } from "vitest";

import { evaluateLearnerAccess } from "@/domain/learner-access";
import type { LearnerSubscription } from "@/domain/learner-subscriptions";
import type { LearnerSuspension } from "@/domain/learner-suspensions";

const now = new Date("2026-11-26T09:30:00.000Z");

const active: LearnerSubscription = {
  learnerId: "learner-1",
  status: "active",
  startsAt: "2026-11-01T00:00:00.000Z",
  endsAt: "2026-12-01T00:00:00.000Z",
};

function suspension(startsAt: string, id = "s1"): LearnerSuspension {
  return {
    id,
    learnerId: "learner-1",
    source: "guardian",
    institutionId: null,
    imposedBy: "parent-1",
    reason: "Exam week break",
    startsAt,
    liftedAt: null,
  };
}

const attempt = {
  attemptId: "attempt-1",
  startedAt: "2026-11-26T09:00:00.000Z",
  deadlineAt: "2026-11-26T10:00:00.000Z",
};

describe("learning-access rule", () => {
  it("gives full access with an active subscription and no suspension", () => {
    expect(
      evaluateLearnerAccess({
        learnerId: "learner-1",
        subscriptions: [active],
        suspensions: [],
        now,
      }),
    ).toEqual({ scope: "full", reasons: [], deferredSuspensionIds: [] });
  });

  it("denies access without a subscription for that learner", () => {
    const siblingSubscription = { ...active, learnerId: "learner-2" };
    const decision = evaluateLearnerAccess({
      learnerId: "learner-1",
      subscriptions: [siblingSubscription],
      suspensions: [],
      now,
    });
    expect(decision.scope).toBe("none");
    expect(decision.reasons).toEqual(["no_active_subscription"]);
  });

  it("denies access while suspended, even with an active subscription", () => {
    const decision = evaluateLearnerAccess({
      learnerId: "learner-1",
      subscriptions: [active],
      suspensions: [suspension("2026-11-25T08:00:00.000Z")],
      now,
    });
    expect(decision.scope).toBe("none");
    expect(decision.reasons).toEqual(["suspended"]);
  });

  it("reports both reasons when both apply", () => {
    const decision = evaluateLearnerAccess({
      learnerId: "learner-1",
      subscriptions: [],
      suspensions: [suspension("2026-11-25T08:00:00.000Z")],
      now,
    });
    expect(decision.reasons).toEqual(["suspended", "no_active_subscription"]);
  });

  it("does not cut off an exam when a parent suspends during the attempt", () => {
    const duringExam = suspension("2026-11-26T09:15:00.000Z", "mid-exam");
    const decision = evaluateLearnerAccess({
      learnerId: "learner-1",
      subscriptions: [active],
      suspensions: [duringExam],
      inProgressAttempt: attempt,
      now,
    });
    expect(decision).toEqual({
      scope: "assessment_in_progress_only",
      reasons: ["suspended"],
      deferredSuspensionIds: ["mid-exam"],
    });
  });

  it("applies the suspension once the attempt deadline has passed", () => {
    const decision = evaluateLearnerAccess({
      learnerId: "learner-1",
      subscriptions: [active],
      suspensions: [suspension("2026-11-26T09:15:00.000Z")],
      inProgressAttempt: attempt,
      now: new Date("2026-11-26T10:00:00.000Z"),
    });
    expect(decision.scope).toBe("none");
  });

  it("gives no exam exception for a suspension that existed before the attempt started", () => {
    const decision = evaluateLearnerAccess({
      learnerId: "learner-1",
      subscriptions: [active],
      suspensions: [suspension("2026-11-26T08:00:00.000Z")],
      inProgressAttempt: attempt,
      now,
    });
    expect(decision.scope).toBe("none");
    expect(decision.deferredSuspensionIds).toEqual([]);
  });

  it("lets an attempt finish when the subscription lapses mid-exam", () => {
    const endsMidExam: LearnerSubscription = {
      ...active,
      status: "expired",
      endsAt: "2026-11-26T09:20:00.000Z",
    };
    const decision = evaluateLearnerAccess({
      learnerId: "learner-1",
      subscriptions: [endsMidExam],
      suspensions: [],
      inProgressAttempt: attempt,
      now,
    });
    expect(decision.scope).toBe("assessment_in_progress_only");
    expect(decision.reasons).toEqual(["no_active_subscription"]);
  });

  it("gives no exam exception when the learner had no subscription when the attempt started", () => {
    const decision = evaluateLearnerAccess({
      learnerId: "learner-1",
      subscriptions: [],
      suspensions: [],
      inProgressAttempt: attempt,
      now,
    });
    expect(decision.scope).toBe("none");
  });
});
