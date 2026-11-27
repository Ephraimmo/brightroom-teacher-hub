import { describe, expect, it } from "vitest";

import { blockedNotice, statusActions } from "@/domain/account-status";
import { actionLabel, auditActor, auditDetails, auditWhen, type AuditEntry } from "@/domain/audit";

const entry = (over: Partial<AuditEntry>): AuditEntry => ({
  id: 1,
  occurredAt: "2026-11-27T12:05:00Z",
  action: "role.grant",
  actorEmail: "admin@example.test",
  actorRole: "platform_admin",
  entityType: "user",
  entityId: "u1",
  targetEmail: "t@example.test",
  before: null,
  after: null,
  reason: "Because",
  ...over,
});

describe("account status actions", () => {
  it("offers only the moves that make sense from each status", () => {
    expect(statusActions("active").map((a) => a.to)).toEqual(["suspended", "deactivated"]);
    expect(statusActions("suspended").map((a) => a.to)).toEqual(["active", "deactivated"]);
    expect(statusActions("deactivated").map((a) => a.to)).toEqual(["active"]);
  });

  it("tells blocked people their records are safe, without internal reasons", () => {
    expect(blockedNotice("suspended").title).toBe("Your account is suspended");
    expect(blockedNotice("deactivated").description).toMatch(/records are kept/);
  });
});

describe("audit entries in plain words", () => {
  it("describes role and status changes", () => {
    expect(actionLabel("role.grant")).toBe("Role given");
    expect(auditDetails(entry({ after: { role: "school_admin" } }))).toBe("School administrator");
    expect(
      auditDetails(
        entry({
          action: "account.suspend",
          before: { status: "active" },
          after: { status: "suspended" },
        }),
      ),
    ).toBe("Active → Suspended");
  });

  it("lists changed profile fields by name", () => {
    expect(
      auditDetails(
        entry({ action: "profile.update", after: { fields: ["phone", "contact_whatsapp"] } }),
      ),
    ).toBe("Changed: mobile number, WhatsApp contact");
  });

  it("says when people changed their own details", () => {
    expect(auditActor(entry({ actorRole: "self" }))).toBe("The person themselves");
    expect(auditActor(entry({}))).toBe("admin@example.test");
  });

  it("shows South African time", () => {
    expect(auditWhen("2026-11-27T12:05:00Z")).toMatch(/27.*Nov.*2026.*14:05/);
  });

  it("falls back to the raw action for unknown kinds", () => {
    expect(actionLabel("something.new")).toBe("something.new");
  });
});
