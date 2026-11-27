import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MfaGate } from "@/components/app-shell/mfa-gate";
import { cleanTotpCode, mfaErrorMessage, mfaStep, MFA_MESSAGES } from "@/domain/mfa";
import { safeRedirect } from "@/lib/safe-redirect";
import { validateResetMfaInput } from "@/lib/mfa-admin.functions";
import { toPublicError } from "@/lib/safe-error";

const mfa = vi.hoisted(() => ({
  value: { currentLevel: "aal1", nextLevel: "aal1", verifiedFactors: 0, factors: [] as unknown[] },
}));
vi.mock("@/hooks/use-mfa", () => ({
  useMfa: () => ({ isLoading: false, isError: false, data: mfa.value, refetch: () => {} }),
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const chain = {
      middleware: () => chain,
      inputValidator: () => chain,
      handler: () => () => Promise.resolve({ removed: 0 }),
    };
    return chain;
  },
}));

describe("mfaStep", () => {
  const none = { currentLevel: "aal1", nextLevel: "aal1", verifiedFactors: 0 } as const;
  const enrolled = { currentLevel: "aal1", nextLevel: "aal2", verifiedFactors: 1 } as const;
  const verified = { currentLevel: "aal2", nextLevel: "aal2", verifiedFactors: 1 } as const;

  it("asks admins to set up an app, then to enter a code each session", () => {
    expect(mfaStep("platform_admin", none)).toBe("enrol");
    expect(mfaStep("school_admin", enrolled)).toBe("verify");
    expect(mfaStep("platform_admin", verified)).toBe("ok");
  });

  it("doesn't require it for teachers, learners or parents", () => {
    for (const role of ["teacher", "learner", "parent"] as const) {
      expect(mfaStep(role, none)).toBe("ok");
    }
  });
});

describe("codes and messages", () => {
  it("accepts 6 digits, with or without a space", () => {
    expect(cleanTotpCode("123 456")).toBe("123456");
    expect(cleanTotpCode("12345")).toBeNull();
    expect(cleanTotpCode("abcdef")).toBeNull();
  });

  it("explains wrong codes and rate limits", () => {
    expect(mfaErrorMessage({ code: "mfa_verification_failed" })).toBe(MFA_MESSAGES.badCode);
    expect(mfaErrorMessage({ status: 429 })).toBe(MFA_MESSAGES.tooMany);
    expect(mfaErrorMessage(new Error("x"))).toBe(MFA_MESSAGES.failed);
  });
});

describe("safeRedirect", () => {
  it("keeps paths inside LearnBridge only", () => {
    expect(safeRedirect("/admin/people")).toBe("/admin/people");
    expect(safeRedirect("https://evil.example")).toBe("/");
    expect(safeRedirect("//evil.example")).toBe("/");
    expect(safeRedirect("/\\evil.example")).toBe("/");
    expect(safeRedirect(undefined, "/teach")).toBe("/teach");
  });
});

describe("MFA reset input", () => {
  it("needs a real user id and a reason", () => {
    const id = "00000000-0000-4000-8000-000000000002";
    expect(validateResetMfaInput({ userId: id, reason: "  Lost phone " })).toEqual({
      userId: id,
      reason: "Lost phone",
    });
    expect(() => validateResetMfaInput({ userId: "nope", reason: "Lost phone" })).toThrow();
    expect(() => validateResetMfaInput({ userId: id, reason: " " })).toThrow();
  });

  it("app refusal codes survive error cleaning; other details don't", () => {
    const cleaned = toPublicError(Object.assign(new Error("secret detail"), { code: "LBR21" }));
    expect((cleaned as Error & { code?: string }).code).toBe("LBR21");
    expect(cleaned.message).not.toContain("secret");
    const other = toPublicError(Object.assign(new Error("x"), { code: "XX000" }));
    expect((other as Error & { code?: string }).code).toBeUndefined();
  });
});

async function renderAdminArea() {
  const rootRoute = createRootRoute({ component: () => <Outlet /> });
  const page = (path: string, text: string) =>
    createRoute({ getParentRoute: () => rootRoute, path, component: () => <p>{text}</p> });
  const admin = createRoute({
    getParentRoute: () => rootRoute,
    path: "/admin",
    component: () => (
      <MfaGate role="platform_admin">
        <p>Admin content</p>
      </MfaGate>
    ),
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([
      admin,
      page("/account/security", "Security page"),
      page("/auth/mfa", "Code page"),
    ]),
    history: createMemoryHistory({ initialEntries: ["/admin"] }),
  });
  render(<RouterProvider router={router} />);
  return router;
}

describe("MfaGate", () => {
  beforeEach(() => {
    mfa.value = { currentLevel: "aal1", nextLevel: "aal1", verifiedFactors: 0, factors: [] };
  });

  it("sends an admin without an authenticator to set one up", async () => {
    const router = await renderAdminArea();
    expect(await screen.findByText("Security page")).toBeInTheDocument();
    expect(router.state.location.search).toMatchObject({ required: true });
  });

  it("asks for a code when this session hasn't used it", async () => {
    mfa.value = { ...mfa.value, nextLevel: "aal2", verifiedFactors: 1 };
    const router = await renderAdminArea();
    expect(await screen.findByText("Code page")).toBeInTheDocument();
    expect(router.state.location.search).toMatchObject({ redirect: "/admin" });
  });

  it("lets a verified session in", async () => {
    mfa.value = { ...mfa.value, currentLevel: "aal2", nextLevel: "aal2", verifiedFactors: 1 };
    await renderAdminArea();
    expect(await screen.findByText("Admin content")).toBeInTheDocument();
  });
});
