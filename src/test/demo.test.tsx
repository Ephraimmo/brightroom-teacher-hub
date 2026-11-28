import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
  useSearch,
} from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "@/components/auth/auth-provider";
import { EMPTY_GUARDIAN } from "@/domain/guardians";
import { DEMO_PERSONAS, GREENRIDGE, RIVERSIDE } from "@/demo/demo-data";
import { DemoBanner } from "@/demo/demo-banner";
import { DemoPicker } from "@/demo/demo-picker";
import { demoRole, endDemo, isDemo, isDemoRole, startDemo } from "@/demo/demo-session";
import * as store from "@/demo/demo-store";

// Demo mode must never reach the database: every client call fails loudly.
const supabaseCalls = vi.hoisted(() => ({ count: 0 }));
vi.mock("@/integrations/supabase/client", () => {
  const boom = () => {
    supabaseCalls.count += 1;
    throw new Error("demo mode called the database");
  };
  return {
    supabase: {
      rpc: boom,
      from: boom,
      storage: { from: boom },
      auth: {
        getUser: () => Promise.resolve({ data: { user: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
        signOut: () => Promise.resolve({ error: null }),
      },
    },
  };
});

const code = async (p: Promise<unknown>) => {
  try {
    await p;
    return "no error";
  } catch (e) {
    return (e as { code?: string }).code;
  }
};

beforeEach(() => {
  endDemo();
  store.clearDemoData();
  supabaseCalls.count = 0;
});

describe("demo session", () => {
  it("is off until a role is chosen, and lasts for the tab", () => {
    expect(isDemo()).toBe(false);
    startDemo("teacher");
    expect(demoRole()).toBe("teacher");
    expect(window.sessionStorage.getItem("learnbridge.demo.role")).toBe("teacher");
    endDemo();
    expect(isDemo()).toBe(false);
  });

  it("ignores a tampered role", () => {
    window.sessionStorage.setItem("learnbridge.demo.role", "superuser");
    expect(isDemo()).toBe(false);
  });

  it("does nothing without a demo session", async () => {
    expect(await code(store.listGuardians(GREENRIDGE))).toBe("42501");
  });
});

describe("demo people", () => {
  it.each(DEMO_PERSONAS.map((p) => [p.role] as const))("%s has that role", async (role) => {
    startDemo(role);
    expect(await store.myRoles()).toContain(role);
    expect(store.demoUser()?.email).toMatch(/@demo\.learnbridge\.test$/);
  });
});

describe("demo data follows the real rules", () => {
  it("a school admin sees their parents, and duplicates are refused", async () => {
    startDemo("school_admin");
    const parents = await store.listGuardians(GREENRIDGE);
    expect(parents.map((g) => g.firstName)).toContain("Mpho");
    expect(parents.find((g) => g.firstName === "Mpho")?.hasAccount).toBe(true);
    const form = {
      ...EMPTY_GUARDIAN,
      firstName: "Copy",
      lastName: "Khumalo",
      relationship: "mother" as const,
      email: "mpho.khumalo@demo.learnbridge.test",
    };
    expect(await code(store.addGuardian(GREENRIDGE, form))).toBe("LBR61");
    expect(await code(store.addGuardian(RIVERSIDE, form))).toBe("42501");
  });

  it("a teacher can't manage parents or staff", async () => {
    startDemo("teacher");
    expect(await code(store.listGuardians(GREENRIDGE))).toBe("42501");
    expect(await code(store.listStaff(GREENRIDGE))).toBe("42501");
  });

  it("staff rules: not your own access, and keep one admin", async () => {
    startDemo("school_admin");
    const staff = await store.listStaff(GREENRIDGE);
    const own = staff.find((s) => s.fullName === "Lerato Mokoena")!;
    const deputy = staff.find((s) => s.fullName === "Johan van Wyk")!;
    expect(await code(store.setStaffStatus(own.membershipId, "suspended", "x"))).toBe("LBR50");
    expect(await code(store.setStaffStatus(deputy.membershipId, "suspended", ""))).toBe("LBR02");
    expect(await store.setStaffStatus(deputy.membershipId, "suspended", "On leave")).toBe(true);
    // Lerato is now the only active admin; the platform admin can't remove her either.
    startDemo("platform_admin");
    expect(await code(store.setStaffStatus(own.membershipId, "removed", "Left"))).toBe("LBR51");
  });

  it("a suspended account loses its roles, and the change is audited", async () => {
    startDemo("platform_admin");
    const amina = await store.findUserByEmail("Amina.Dlamini@demo.learnbridge.test");
    expect(amina?.fullName).toBe("Amina Dlamini");
    expect(await store.setAccountStatus(amina!.userId, "suspended", "Testing")).toBe(true);
    const [latest] = await store.loadAuditPage({ group: "", userId: null, beforeId: null });
    expect(latest).toMatchObject({ action: "account.suspend", reason: "Testing" });
    startDemo("teacher");
    expect(await store.myRoles()).toEqual([]);
  });

  it("a parent confirms the record waiting at a second school", async () => {
    startDemo("parent");
    const offers = await store.myGuardianInvitations();
    expect(offers).toEqual([expect.objectContaining({ institutionName: "Riverside High School" })]);
    await store.claimGuardianRecord(offers[0]!.id);
    expect(await store.myGuardianInvitations()).toEqual([]);
    expect(await store.myRoles()).toEqual(["parent"]);
  });

  it("the teacher has an invitation to accept, which adds the school", async () => {
    startDemo("teacher");
    const [invite] = await store.myInvitations();
    expect(invite?.institutionName).toBe("Riverside High School");
    await store.acceptInvitation(invite!.id);
    expect((await store.myInstitutions()).map((s) => s.name)).toEqual([
      "Greenridge Learning Centre",
      "Riverside High School",
    ]);
  });

  it("knows the current term", async () => {
    startDemo("school_admin");
    const [current] = await store.getAcademicPeriods(GREENRIDGE);
    expect(current?.label).toBe("2027");
    const year2026 = (await store.getAcademicPeriods(GREENRIDGE)).find((y) => y.isCurrent);
    expect(year2026?.terms).toHaveLength(4);
  });
});

describe("demo data is kept for the tab and can be reset", () => {
  it("survives a reload and resets", async () => {
    startDemo("school_admin");
    await store.setGuardianStatus("demo-guardian-zanele", "archived", "Moved away");
    store.reloadDemoData();
    const after = await store.listGuardians(GREENRIDGE);
    expect(after.find((g) => g.firstName === "Zanele")?.status).toBe("archived");
    store.resetDemoData();
    const reset = await store.listGuardians(GREENRIDGE);
    expect(reset.find((g) => g.firstName === "Zanele")?.status).toBe("active");
  });
});

describe("the service modules switch to demo data", () => {
  it("answers from the demo store and never calls the database", async () => {
    const guardians = await import("@/lib/guardians");
    const schools = await import("@/lib/schools");
    const settings = await import("@/lib/school-settings");
    const people = await import("@/lib/admin-people");
    const profile = await import("@/lib/profile-service");
    startDemo("school_admin");
    expect((await guardians.listGuardians(GREENRIDGE)).length).toBeGreaterThan(3);
    expect((await schools.myInstitutions())[0]?.name).toBe("Greenridge Learning Centre");
    expect((await settings.listGradeLevels()).length).toBe(16);
    expect((await profile.loadMyProfile("ignored")).fullName).toBe("Lerato Mokoena");
    expect(await code(people.findUserByEmail("x@y.test"))).toBe("42501");
    expect(supabaseCalls.count).toBe(0);
  });
});

/** The /demo route's search handling, as in src/routes/demo.tsx. */
function PickerPage() {
  const search: { as?: unknown } = useSearch({ strict: false });
  return <DemoPicker startAs={isDemoRole(search.as) ? search.as : null} />;
}

function renderAt(path: string, component: () => React.ReactNode) {
  const rootRoute = createRootRoute({
    component: () => (
      <AuthProvider>
        <DemoBanner />
        <Outlet />
      </AuthProvider>
    ),
  });
  const routes = ["/demo", "/auth", "/admin", "/school", "/teach", "/family", "/learn"].map((p) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path: p,
      component: p === path ? component : () => <p>Page {p}</p>,
    }),
  );
  const router = createRouter({
    routeTree: rootRoute.addChildren(routes),
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

describe("demo screens", () => {
  it("choosing a role starts the demo and opens that area", async () => {
    const router = renderAt("/demo", PickerPage);
    fireEvent.click(await screen.findByRole("link", { name: "Explore as School admin" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/school"));
    expect(demoRole()).toBe("school_admin");
    expect(await screen.findByRole("region", { name: "Demo mode" })).toHaveTextContent(
      "exploring as School admin",
    );
  });

  it("the banner leaves the demo", async () => {
    startDemo("parent");
    const router = renderAt("/family", () => <p>Family</p>);
    fireEvent.click(await screen.findByRole("button", { name: "Leave demo" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/auth"));
    expect(isDemo()).toBe(false);
    expect(screen.queryByRole("region", { name: "Demo mode" })).not.toBeInTheDocument();
  });
});
