import { afterEach, describe, expect, it, vi } from "vitest";

import { renderErrorPage } from "@/lib/error-page";
import { buildLogEntry, logger } from "@/lib/logging/logger";
import { redact, redactPath, redactString } from "@/lib/logging/redact";
import { newRequestId, requestIdFrom } from "@/lib/request-id";
import { classifyError, userMessageFor } from "@/lib/user-messages";

// Secret-looking values are assembled at runtime so the secret scanner
// doesn't flag this file.
const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, "");
const jwt = `${b64({ alg: "HS256" })}.${b64({ role: "authenticated" })}.c2lnbmF0dXJlMTIz`;
const secretKey = "sb_" + "secret_" + "abc123def456ghi789";

describe("redactString", () => {
  it.each([
    ["Login failed for thandi.m@example.co.za", "Login failed for [email]"],
    [`Authorization: Bearer ${jwt}`, "Authorization: Bearer [redacted]"],
    [`token ${jwt} rejected`, "token [jwt] rejected"],
    [`key=${secretKey}`, "key=[api-key]"],
    ["GET /reset?token=abc123&lang=en", "GET /reset?token=[redacted]&lang=en"],
    ["#access_token=xyz&type=recovery", "#access_token=[redacted]&type=recovery"],
    ["ID 0001015009087 not valid", "ID [id-number] not valid"],
    ["Call 082 123 4567 or +27 82 123 4567", "Call [phone] or [phone]"],
  ])("%s", (input, expected) => {
    expect(redactString(input)).toBe(expected);
  });

  it("leaves ordinary text and stack line numbers alone", () => {
    const text = "TypeError: x is undefined\n    at load (src/routes/teach.tsx:42:17)";
    expect(redactString(text)).toBe(text);
  });

  it("truncates very long strings", () => {
    expect(redactString("a".repeat(5000))).toMatch(/…\[truncated\]$/);
  });
});

describe("redact", () => {
  it("removes secret and personal fields by name, at any depth", () => {
    const out = redact({
      password: "hunter2",
      headers: { Authorization: "x", cookie: "y" },
      learner: { full_name: "Sipho D", email: "s@x.co", grade: 8, phone_number: "1" },
      apiKey: "k",
      plan: "term",
    });
    expect(out).toEqual({
      password: "[redacted]",
      headers: { Authorization: "[redacted]", cookie: "[redacted]" },
      learner: {
        full_name: "[personal]",
        email: "[personal]",
        grade: 8,
        phone_number: "[personal]",
      },
      apiKey: "[redacted]",
      plan: "term",
    });
  });

  it("serialises errors with their code, status and cause, scrubbed", () => {
    const cause = new Error("db said no for a@b.co");
    const error = Object.assign(new Error("Save failed for a@b.co", { cause }), {
      code: "42501",
      status: 403,
    });
    const out = redact(error) as Record<string, unknown>;
    expect(out["name"]).toBe("Error");
    expect(out["message"]).toBe("Save failed for [email]");
    expect(out["code"]).toBe("42501");
    expect(out["status"]).toBe(403);
    expect((out["cause"] as Record<string, unknown>)["message"]).toBe("db said no for [email]");
    expect(JSON.stringify(out)).not.toContain("a@b.co");
  });

  it("survives circular, deep and large structures", () => {
    const loop: Record<string, unknown> = { a: 1 };
    loop["self"] = loop;
    expect(redact(loop)).toEqual({ a: 1, self: "[circular]" });

    let deep: Record<string, unknown> = { v: 1 };
    for (let i = 0; i < 10; i++) deep = { next: deep };
    expect(JSON.stringify(redact(deep))).toContain("[too deep]");

    const many = redact(Array.from({ length: 60 }, (_, i) => i)) as unknown[];
    expect(many).toHaveLength(51);
    expect(many.at(-1)).toBe("[10 more]");
  });
});

describe("redactPath", () => {
  it("hides tokens and IDs in paths and drops the query", () => {
    expect(redactPath("/invite/Xk29fj3kLs0Qp1Zt8w?x=1")).toBe("/invite/:id");
    expect(redactPath("/teach/classes")).toBe("/teach/classes");
  });
});

describe("logger", () => {
  afterEach(() => vi.restoreAllMocks());

  it("builds a structured, scrubbed entry", () => {
    const entry = buildLogEntry("error", "profile.save_failed", {
      requestId: "abc123def4567890",
      error: new Error("Duplicate email t@x.co"),
      userEmail: "t@x.co",
      attempt: 2,
    });
    expect(entry).toMatchObject({
      level: "error",
      event: "profile.save_failed",
      requestId: "abc123def4567890",
      context: { userEmail: "[personal]", attempt: 2 },
    });
    expect(JSON.stringify(entry)).not.toContain("t@x.co");
    expect(Number.isNaN(Date.parse(entry.time))).toBe(false);
  });

  it("writes one JSON line to the matching console method", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    logger.error("a.failed", { requestId: "r1r2r3r4r5" });
    logger.warn("b.slow");
    expect(JSON.parse(error.mock.calls[0]?.[0] as string)).toMatchObject({ event: "a.failed" });
    expect(JSON.parse(warn.mock.calls[0]?.[0] as string)).toMatchObject({ level: "warn" });
  });
});

describe("request IDs", () => {
  it("makes short unique IDs", () => {
    const a = newRequestId();
    expect(a).toMatch(/^[a-f0-9]{16}$/);
    expect(newRequestId()).not.toBe(a);
  });

  it("reuses a valid incoming ID or Cloudflare's ray ID", () => {
    expect(requestIdFrom(new Headers({ "x-request-id": "edge-1234abcd" }))).toBe("edge-1234abcd");
    expect(requestIdFrom(new Headers({ "cf-ray": "8a1b2c3d4e5f6789-JNB" }))).toBe(
      "8a1b2c3d4e5f6789-JNB",
    );
  });

  it("ignores IDs that could inject text into logs", () => {
    const id = requestIdFrom(new Headers({ "x-request-id": "<script>alert(1)</script> x" }));
    expect(id).toMatch(/^[a-f0-9]{16}$/);
  });
});

describe("user messages", () => {
  it.each([
    [new TypeError("Failed to fetch"), "offline"],
    [{ message: "JWT expired", code: "PGRST301" }, "session"],
    [{ status: 401 }, "session"],
    [{ code: "42501", message: "new row violates row-level security policy" }, "forbidden"],
    [{ code: "PGRST116" }, "not-found"],
    [new Error('relation "x" does not exist'), "unknown"],
  ])("classifies %o as %s", (error, kind) => {
    expect(classifyError(error)).toBe(kind);
  });

  it("treats anything as offline when the browser says so", () => {
    expect(classifyError(new Error("whatever"), false)).toBe("offline");
  });

  it("never shows the raw error text", () => {
    const message = userMessageFor(new Error('relation "learners" does not exist'));
    expect(`${message.title} ${message.description}`).not.toMatch(/relation|learners/);
  });
});

describe("server error page", () => {
  it("shows the reference, escaped", () => {
    expect(renderErrorPage("abc123def4567890")).toContain("<code>abc123def4567890</code>");
    expect(renderErrorPage("<script>")).not.toContain("<script>");
    expect(renderErrorPage()).not.toContain("Reference:");
  });
});
