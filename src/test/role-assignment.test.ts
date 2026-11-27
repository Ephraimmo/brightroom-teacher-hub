import { describe, expect, it } from "vitest";

import {
  canRemoveRole,
  looksLikeEmail,
  normalizeEmail,
  reasonProblem,
  roleChangeProblem,
  rolesToOffer,
} from "@/domain/role-assignment";

describe("role assignment rules", () => {
  it("needs a real reason, like the database does", () => {
    expect(reasonProblem("")).not.toBeNull();
    expect(reasonProblem("   ok ")).not.toBeNull();
    expect(reasonProblem("New teacher at school A")).toBeNull();
    expect(reasonProblem("x".repeat(501))).not.toBeNull();
  });

  it("normalises and checks emails", () => {
    expect(normalizeEmail("  New.User@Example.TEST ")).toBe("new.user@example.test");
    expect(looksLikeEmail("name@school.co.za")).toBe(true);
    expect(looksLikeEmail("example.test")).toBe(false);
    expect(looksLikeEmail("a b@c.d")).toBe(false);
  });

  it("offers only roles the person doesn't have", () => {
    expect(rolesToOffer(["teacher", "parent"])).toEqual([
      "school_admin",
      "learner",
      "platform_admin",
    ]);
  });

  it("never lets admins remove their own admin role", () => {
    expect(canRemoveRole("me", "me", "platform_admin")).toBe(false);
    expect(canRemoveRole("me", "me", "teacher")).toBe(true);
    expect(canRemoveRole("me", "you", "platform_admin")).toBe(true);
  });

  it("maps database error codes to problems", () => {
    expect(roleChangeProblem({ code: "LBR01" })).toBe("own-admin-role");
    expect(roleChangeProblem({ code: "LBR02" })).toBe("reason-required");
    expect(roleChangeProblem({ code: "LBR03" })).toBe("user-not-found");
    expect(roleChangeProblem({ code: "42501" })).toBe("not-allowed");
    expect(roleChangeProblem({ code: "PGRST202" })).toBe("setup-missing");
    expect(roleChangeProblem(new Error("boom"))).toBe("unknown");
    expect(roleChangeProblem(null)).toBe("unknown");
  });
});
