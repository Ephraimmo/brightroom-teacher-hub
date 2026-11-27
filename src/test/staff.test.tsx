import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { StaffPage } from "@/components/school/staff-page";
import { staffActions, staffErrorMessage } from "@/domain/staff";
import type { StaffMember } from "@/lib/staff";

const staffApi = vi.hoisted(() => ({
  listStaff: vi.fn(),
  listOpenInvitations: vi.fn(),
  revokeInvitation: vi.fn(),
  updateStaffMember: vi.fn(),
  setStaffStatus: vi.fn(),
}));
const schoolsApi = vi.hoisted(() => ({
  myInstitutions: vi.fn(),
  createInvitation: vi.fn(),
}));
vi.mock("@/lib/staff", () => staffApi);
vi.mock("@/lib/schools", () => schoolsApi);
vi.mock("@/lib/school-settings", () => ({
  getSchoolSettings: () => Promise.resolve({ grades: ["G04", "G05"] }),
  listGradeLevels: () =>
    Promise.resolve([
      { code: "G04", label: "Grade 4", phase: "intermediate" },
      { code: "G05", label: "Grade 5", phase: "intermediate" },
      { code: "G06", label: "Grade 6", phase: "intermediate" },
    ]),
}));
vi.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ user: { id: "admin-1", email: "head@sunrise.test" }, isLoading: false }),
}));
vi.mock("@/hooks/use-user-roles", () => ({
  useUserRoles: () => ({ isLoading: false, isError: false, data: [{ role: "school_admin" }] }),
}));
vi.mock("@/hooks/use-sign-out", () => ({ useSignOut: () => ({ signOut: vi.fn(), error: null }) }));

const head: StaffMember = {
  membershipId: "m1",
  userId: "admin-1",
  email: "head@sunrise.test",
  fullName: "Ayanda Admin",
  role: "school_admin",
  status: "active",
  title: "Principal",
  grades: [],
};
const thabo: StaffMember = {
  membershipId: "m2",
  userId: "t1",
  email: "thabo@sunrise.test",
  fullName: "Thabo Teacher",
  role: "teacher",
  status: "active",
  title: null,
  grades: ["G04"],
};

function renderPage() {
  const rootRoute = createRootRoute({ component: () => <Outlet /> });
  const page = createRoute({
    getParentRoute: () => rootRoute,
    path: "/school/staff",
    component: StaffPage,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([page]),
    history: createMemoryHistory({ initialEntries: ["/school/staff"] }),
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  schoolsApi.myInstitutions.mockResolvedValue([
    { institutionId: "s1", name: "Sunrise Primary", role: "school_admin", title: null },
  ]);
  staffApi.listStaff.mockResolvedValue([head, thabo]);
  staffApi.listOpenInvitations.mockResolvedValue([]);
});

describe("staff rules", () => {
  it("offers the right actions per status", () => {
    expect(staffActions("active").map((a) => a.to)).toEqual(["suspended", "removed"]);
    expect(staffActions("removed").map((a) => a.to)).toEqual(["active"]);
  });

  it("explains database refusals", () => {
    expect(staffErrorMessage({ code: "LBR51" })).toMatch(/at least one active administrator/);
    expect(staffErrorMessage({ code: "LBR52" })).toMatch(/grades your school offers/);
  });
});

describe("School → Staff", () => {
  it("lists staff, and doesn't offer actions on your own row", async () => {
    renderPage();
    const me = await screen.findByRole("listitem", { name: "Ayanda Admin" });
    expect(within(me).getByText("This is you.")).toBeInTheDocument();
    expect(within(me).queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();
    const t = screen.getByRole("listitem", { name: "Thabo Teacher" });
    expect(within(t).getByText(/Grade 4/)).toBeInTheDocument();
  });

  it("invites a teacher and explains how they join", async () => {
    schoolsApi.createInvitation.mockResolvedValue("inv1");
    renderPage();
    fireEvent.change(await screen.findByLabelText(/Email address/), {
      target: { value: "New.Teacher@Sunrise.test" },
    });
    fireEvent.change(screen.getByLabelText(/^Title/), { target: { value: "HOD Maths" } });
    fireEvent.click(screen.getByRole("button", { name: "Invite" }));
    expect(await screen.findByText(/sign in\) with new.teacher@sunrise.test/)).toBeInTheDocument();
    expect(schoolsApi.createInvitation).toHaveBeenCalledWith(
      "s1",
      "New.Teacher@Sunrise.test",
      "teacher",
      "HOD Maths",
    );
  });

  it("edits a teacher's title and grades", async () => {
    staffApi.updateStaffMember.mockResolvedValue(undefined);
    renderPage();
    const t = await screen.findByRole("listitem", { name: "Thabo Teacher" });
    fireEvent.click(within(t).getByRole("button", { name: "Edit" }));
    fireEvent.change(within(t).getByLabelText("Title"), { target: { value: "Grade 5 lead" } });
    fireEvent.click(await within(t).findByRole("checkbox", { name: "Grade 5" }));
    fireEvent.click(within(t).getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(staffApi.updateStaffMember).toHaveBeenCalledWith("m2", "Grade 5 lead", ["G04", "G05"]),
    );
  });

  it("removes a teacher only with a reason", async () => {
    staffApi.setStaffStatus.mockResolvedValue(true);
    renderPage();
    const t = await screen.findByRole("listitem", { name: "Thabo Teacher" });
    fireEvent.click(within(t).getByRole("button", { name: "Remove" }));
    fireEvent.click(within(t).getByRole("button", { name: "Confirm: remove" }));
    expect(await within(t).findByText(/Say why/)).toBeInTheDocument();
    expect(staffApi.setStaffStatus).not.toHaveBeenCalled();
    fireEvent.change(within(t).getByLabelText(/^Reason/), { target: { value: "Resigned" } });
    fireEvent.click(within(t).getByRole("button", { name: "Confirm: remove" }));
    await waitFor(() =>
      expect(staffApi.setStaffStatus).toHaveBeenCalledWith("m2", "removed", "Resigned"),
    );
  });

  it("shows and cancels open invitations", async () => {
    staffApi.listOpenInvitations.mockResolvedValue([
      {
        id: "inv9",
        email: "wait@sunrise.test",
        role: "teacher",
        title: null,
        expiresAt: "2026-12-10T00:00:00Z",
      },
    ]);
    staffApi.revokeInvitation.mockResolvedValue(true);
    renderPage();
    fireEvent.click(
      await screen.findByRole("button", { name: "Cancel invitation for wait@sunrise.test" }),
    );
    await waitFor(() => expect(staffApi.revokeInvitation).toHaveBeenCalledWith("inv9"));
  });
});
