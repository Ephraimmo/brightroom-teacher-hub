import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { InvitationsPanel } from "@/components/account/invitations-panel";
import { SchoolsPage } from "@/components/admin/schools-page";
import {
  normalizeSaPhone,
  schoolFieldForError,
  validateSchool,
  type SchoolForm,
} from "@/domain/schools";
import type { Institution } from "@/lib/schools";

const service = vi.hoisted(() => ({
  listInstitutions: vi.fn(),
  registerInstitution: vi.fn(),
  setInstitutionStatus: vi.fn(),
  myInvitations: vi.fn(),
  acceptInvitation: vi.fn(),
  myInstitutions: vi.fn(),
  createInvitation: vi.fn(),
}));
vi.mock("@/lib/schools", () => service);
const parents = vi.hoisted(() => ({
  myGuardianInvitations: vi.fn(),
  claimGuardianRecord: vi.fn(),
}));
vi.mock("@/lib/guardians", () => parents);
vi.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ user: { id: "admin-1", email: "admin@example.test" }, isLoading: false }),
}));
vi.mock("@/hooks/use-user-roles", () => ({
  useUserRoles: () => ({ isLoading: false, isError: false, data: [{ role: "platform_admin" }] }),
}));
vi.mock("@/hooks/use-sign-out", () => ({ useSignOut: () => ({ signOut: vi.fn(), error: null }) }));

const valid: SchoolForm = {
  name: "Sunrise Primary",
  type: "school",
  province: "GP",
  emisNumber: "700400111",
  contactEmail: "office@sunrise.test",
  contactPhone: "011 123 4567",
  firstAdminEmail: "head@sunrise.test",
};

const sunrise: Institution = {
  id: "s1",
  name: "Sunrise Primary",
  type: "school",
  status: "active",
  emisNumber: "700400111",
  province: "GP",
  contactEmail: null,
  contactPhone: null,
  createdAt: "2026-11-27T10:00:00Z",
};

function withProviders(node: ReactNode, path = "/admin/institutions") {
  const rootRoute = createRootRoute({ component: () => <Outlet /> });
  const page = createRoute({ getParentRoute: () => rootRoute, path, component: () => node });
  const router = createRouter({
    routeTree: rootRoute.addChildren([page]),
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

const type = (label: RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

beforeEach(() => {
  vi.clearAllMocks();
  parents.myGuardianInvitations.mockResolvedValue([]);
});

describe("school rules", () => {
  it("accepts a complete school and checks each field", () => {
    expect(validateSchool(valid)).toEqual({});
    expect(
      Object.keys(
        validateSchool({
          ...valid,
          name: "X",
          province: "",
          emisNumber: "12",
          contactEmail: "nope",
          contactPhone: "123",
          firstAdminEmail: "",
        }),
      ).sort(),
    ).toEqual(
      ["contactEmail", "contactPhone", "emisNumber", "firstAdminEmail", "name", "province"].sort(),
    );
  });

  it("normalises landlines and mobiles", () => {
    expect(normalizeSaPhone("011 123 4567")).toBe("+27111234567");
    expect(normalizeSaPhone("+27 82 123 4567")).toBe("+27821234567");
    expect(normalizeSaPhone("12345")).toBeNull();
  });

  it("maps database refusals to fields", () => {
    expect(schoolFieldForError({ code: "LBR30", hint: "province" })).toBe("province");
    expect(schoolFieldForError({ code: "23505" })).toBe("emisNumber");
    expect(schoolFieldForError({ code: "42501" })).toBeNull();
  });
});

describe("Admin → Schools", () => {
  it("lists schools with their status", async () => {
    service.listInstitutions.mockResolvedValue([sunrise]);
    withProviders(<SchoolsPage />);
    expect(await screen.findByRole("heading", { name: "Sunrise Primary" })).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText(/Gauteng/)).toBeInTheDocument();
  });

  it("registers a school and explains the next step", async () => {
    service.listInstitutions.mockResolvedValue([]);
    service.registerInstitution.mockResolvedValue("s2");
    withProviders(<SchoolsPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Register a school" }));
    type(/School name/, valid.name);
    fireEvent.change(screen.getByLabelText(/Province/), { target: { value: "GP" } });
    type(/First school administrator's email/, valid.firstAdminEmail);
    type(/^Reason/, "Signed pilot agreement");
    fireEvent.click(screen.getByRole("button", { name: "Register school" }));
    expect(await screen.findByText(/head@sunrise.test can now sign up/)).toBeInTheDocument();
    expect(service.registerInstitution).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Sunrise Primary", province: "GP" }),
      "Signed pilot agreement",
    );
  });

  it("won't register without the required details", async () => {
    service.listInstitutions.mockResolvedValue([]);
    withProviders(<SchoolsPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Register a school" }));
    fireEvent.click(screen.getByRole("button", { name: "Register school" }));
    expect(await screen.findByText("Choose the province.")).toBeInTheDocument();
    expect(service.registerInstitution).not.toHaveBeenCalled();
  });

  it("shows a duplicate EMIS number on the right field", async () => {
    service.listInstitutions.mockResolvedValue([]);
    service.registerInstitution.mockRejectedValue({ code: "23505" });
    withProviders(<SchoolsPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Register a school" }));
    type(/School name/, valid.name);
    fireEvent.change(screen.getByLabelText(/Province/), { target: { value: "GP" } });
    type(/First school administrator's email/, valid.firstAdminEmail);
    type(/^Reason/, "Signed pilot agreement");
    fireEvent.click(screen.getByRole("button", { name: "Register school" }));
    expect(await screen.findByText(/already registered with this EMIS/)).toBeInTheDocument();
  });

  it("suspends a school after confirmation with a reason", async () => {
    service.listInstitutions.mockResolvedValue([sunrise]);
    service.setInstitutionStatus.mockResolvedValue(true);
    withProviders(<SchoolsPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Suspend" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm: suspend" }));
    expect(await screen.findByText(/Say why/)).toBeInTheDocument();
    expect(service.setInstitutionStatus).not.toHaveBeenCalled();
    type(/^Reason/, "Licence unpaid");
    fireEvent.click(screen.getByRole("button", { name: "Confirm: suspend" }));
    await waitFor(() =>
      expect(service.setInstitutionStatus).toHaveBeenCalledWith(
        "s1",
        "suspended",
        "Licence unpaid",
      ),
    );
  });
});

describe("Invitations", () => {
  it("shows nothing when there are none", async () => {
    service.myInvitations.mockResolvedValue([]);
    withProviders(<InvitationsPanel />, "/account");
    await waitFor(() => expect(service.myInvitations).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: "Accept" })).not.toBeInTheDocument();
  });

  it("accepts an invitation", async () => {
    service.myInvitations.mockResolvedValue([
      {
        id: "inv1",
        institutionName: "Sunrise Primary",
        role: "teacher",
        title: "HOD Maths",
        expiresAt: "2026-12-11T10:00:00Z",
      },
    ]);
    service.acceptInvitation.mockResolvedValue(undefined);
    withProviders(<InvitationsPanel />, "/account");
    expect(
      await screen.findByText(/invited you to join as teacher \(HOD Maths\)/),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    await waitFor(() => expect(service.acceptInvitation).toHaveBeenCalledWith("inv1"));
  });

  it("lets a parent confirm the school's record of them", async () => {
    service.myInvitations.mockResolvedValue([]);
    parents.myGuardianInvitations.mockResolvedValue([
      { id: "g1", institutionName: "Sunrise Primary" },
    ]);
    parents.claimGuardianRecord.mockResolvedValue(undefined);
    withProviders(<InvitationsPanel />, "/account");
    fireEvent.click(await screen.findByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(parents.claimGuardianRecord).toHaveBeenCalledWith("g1"));
  });
});
