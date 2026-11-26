import { notFound, redirect } from "@tanstack/react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { toPublicError, withSafeErrors } from "@/lib/safe-error";
import { classifyError } from "@/lib/user-messages";

afterEach(() => vi.restoreAllMocks());

describe("withSafeErrors", () => {
  it("returns the result when nothing fails", async () => {
    await expect(withSafeErrors("x.load", () => 42)).resolves.toBe(42);
  });

  it("logs the real error, scrubbed, and throws a safe one", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const original = Object.assign(new Error("No learner for mom@example.co.za"), {
      code: "42501",
    });

    const thrown = await withSafeErrors("learners.load", () => {
      throw original;
    }).catch((e: unknown) => e as Error);

    expect(thrown).not.toBe(original);
    expect(thrown.message).not.toContain("mom@example.co.za");
    expect(thrown.stack).toBeUndefined();
    expect(classifyError(thrown)).toBe("forbidden");

    const entry = JSON.parse(log.mock.calls[0]?.[0] as string);
    expect(entry.event).toBe("learners.load");
    expect(entry.error.message).toBe("No learner for [email]");
    expect(entry.error.code).toBe("42501");
  });

  it("lets redirects and not-found through untouched", async () => {
    const r = redirect({ to: "/auth" });
    await expect(withSafeErrors("x", () => Promise.reject(r))).rejects.toBe(r);
    const n = notFound();
    await expect(withSafeErrors("x", () => Promise.reject(n))).rejects.toBe(n);
  });
});

describe("toPublicError", () => {
  it.each([
    [new TypeError("Failed to fetch"), "offline"],
    [{ message: "JWT expired" }, "session"],
    [{ code: "42501" }, "forbidden"],
    [{ code: "PGRST116" }, "not-found"],
    [new Error('column "id_number" of learner 0001015009087'), "unknown"],
  ])("keeps the kind of %o (%s) without the details", (error, kind) => {
    const safe = toPublicError(error);
    expect(classifyError(safe)).toBe(kind);
    expect(JSON.stringify({ m: safe.message, ...safe })).not.toMatch(/id_number|0001015009087/);
  });
});
