import { describe, expect, it } from "vitest";

import { can, hasCapability, scopeFor } from "@/domain/permissions";

describe("permissions", () => {
  it("only lets a parent view learners they are actively linked to", () => {
    expect(can(["parent"], "learner.view", { isActiveGuardian: true })).toBe(true);
    expect(can(["parent"], "learner.view", {})).toBe(false);
    expect(can(["parent"], "results.view", { isActiveGuardian: false })).toBe(false);
  });

  it("only lets a teacher view learners in their assigned classes", () => {
    expect(can(["teacher"], "learner.view", { teachesLearner: true })).toBe(true);
    // Same school is not enough: the teacher must teach the learner.
    expect(can(["teacher"], "learner.view", { sameInstitution: true })).toBe(false);
  });

  it("confines school admins to their own institution", () => {
    expect(can(["school_admin"], "learner.register", { sameInstitution: true })).toBe(true);
    expect(can(["school_admin"], "learner.register", { sameInstitution: false })).toBe(false);
    expect(can(["school_admin"], "institution.register", { sameInstitution: true })).toBe(false);
  });

  it("never lets a learner see another learner", () => {
    expect(can(["learner"], "learner.view", { isSelf: true })).toBe(true);
    expect(can(["learner"], "learner.view", { sameInstitution: true })).toBe(false);
    expect(can(["learner"], "results.view", {})).toBe(false);
  });

  it("keeps money actions with the right roles", () => {
    expect(can(["parent"], "payment.verify", { isActiveGuardian: true })).toBe(false);
    expect(can(["parent"], "payment.upload_proof", { isActiveGuardian: true })).toBe(true);
    expect(can(["school_admin"], "payment.refund", { sameInstitution: true })).toBe(false);
    expect(can(["platform_admin"], "payment.refund")).toBe(true);
  });

  it("lets only teachers run lessons", () => {
    expect(scopeFor("teacher", "lesson.run")).toBe("assigned_classes");
    expect(scopeFor("platform_admin", "lesson.run")).toBeNull();
    expect(scopeFor("learner", "lesson.run")).toBeNull();
  });

  it("combines roles for people who hold more than one", () => {
    // A teacher who is also a parent can see their own child's results.
    expect(can(["teacher", "parent"], "results.view", { isActiveGuardian: true })).toBe(true);
    expect(can(["teacher", "parent"], "results.view", {})).toBe(false);
  });

  it("reports whether a role has a capability at all, for menus", () => {
    expect(hasCapability(["parent"], "guardian.link_child")).toBe(true);
    expect(hasCapability(["teacher"], "guardian.link_child")).toBe(false);
    expect(hasCapability([], "learner.view")).toBe(false);
  });
});
