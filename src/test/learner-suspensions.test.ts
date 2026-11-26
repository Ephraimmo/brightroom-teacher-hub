import { describe, expect, it } from "vitest";

import {
  canLiftSuspension,
  createSuspension,
  openSuspensionsFor,
  type LearnerSuspension,
  type SuspensionActor,
} from "@/domain/learner-suspensions";

const now = new Date("2026-11-26T09:00:00.000Z");
const parent: SuspensionActor = { kind: "guardian", userId: "parent-1" };
const schoolA: SuspensionActor = {
  kind: "institution_admin",
  userId: "admin-a",
  institutionId: "school-a",
};
const schoolB: SuspensionActor = {
  kind: "institution_admin",
  userId: "admin-b",
  institutionId: "school-b",
};
const platform: SuspensionActor = { kind: "platform_admin", userId: "owner" };

function suspend(actor: SuspensionActor, existing: LearnerSuspension[] = [], id = "s1") {
  const result = createSuspension(
    { id, learnerId: "learner-1", actor, reason: "Holiday break", now },
    existing,
  );
  if (!result.ok) throw new Error(result.error);
  return result.suspension;
}

describe("learner suspensions", () => {
  it("records who suspended the learner and why", () => {
    const suspension = suspend(parent);
    expect(suspension).toMatchObject({
      source: "guardian",
      institutionId: null,
      imposedBy: "parent-1",
      reason: "Holiday break",
      liftedAt: null,
    });
  });

  it("requires a reason", () => {
    const result = createSuspension(
      { id: "s1", learnerId: "learner-1", actor: parent, reason: "   ", now },
      [],
    );
    expect(result.ok).toBe(false);
  });

  it("lets each party lift only its own suspension", () => {
    const byParent = suspend(parent);
    const bySchoolA = suspend(schoolA, [byParent], "s2");

    expect(canLiftSuspension(parent, byParent)).toBe(true);
    expect(canLiftSuspension(parent, bySchoolA)).toBe(false);
    expect(canLiftSuspension(schoolA, bySchoolA)).toBe(true);
    expect(canLiftSuspension(schoolA, byParent)).toBe(false);
    expect(canLiftSuspension(schoolB, bySchoolA)).toBe(false);
    expect(canLiftSuspension(platform, bySchoolA)).toBe(false);
  });

  it("keeps the learner suspended while any other party's suspension is open", () => {
    const byParent = suspend(parent);
    const bySchool = suspend(schoolA, [byParent], "s2");
    const liftedByParent = { ...byParent, liftedAt: now.toISOString() };

    expect(openSuspensionsFor("learner-1", [liftedByParent, bySchool], now)).toEqual([bySchool]);
  });

  it("refuses a duplicate open suspension from the same party but allows another party", () => {
    const byParent = suspend(parent);
    const again = createSuspension(
      { id: "s2", learnerId: "learner-1", actor: parent, reason: "Again", now },
      [byParent],
    );
    expect(again.ok).toBe(false);
    expect(() => suspend(schoolA, [byParent], "s3")).not.toThrow();
  });

  it("does not let a lifted suspension be lifted again", () => {
    const lifted = { ...suspend(parent), liftedAt: now.toISOString() };
    expect(canLiftSuspension(parent, lifted)).toBe(false);
  });

  it("ignores other learners' suspensions", () => {
    const other = { ...suspend(parent), learnerId: "learner-2" };
    expect(openSuspensionsFor("learner-1", [other], now)).toEqual([]);
  });
});
