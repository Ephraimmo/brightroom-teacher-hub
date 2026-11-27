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

import { ParentsPage } from "@/components/school/parents-page";
import {
  EMPTY_GUARDIAN,
  guardianError,
  matchesSearch,
  validateGuardian,
  type GuardianForm,
} from "@/domain/guardians";
import type { Guardian } from "@/lib/guardians";

const api = vi.hoisted(() => ({
  listGuardians: vi.fn(),
  addGuardian: vi.fn(),
  updateGuardian: vi.fn(),
  setGuardianStatus: vi.fn(),
}));
vi.mock("@/lib/guardians", () => api);
vi.mock("@/lib/schools", () => ({
  myInstitutions: () =>
    Promise.resolve([
      { institutionId: "s1", name: "Sunrise Primary", role: "school_admin", title: null },
    ]),
}));
vi.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ user: { id: "a1", email: "head@sunrise.test" }, isLoading: false }),
}));
vi.mock("@/hooks/use-user-roles", () => ({
  useUserRoles: () => ({ isLoading: false, isError: false, data: [{ role: "school_admin" }] }),
}));
vi.mock("@/hooks/use-sign-out", () => ({ useSignOut: () => ({ signOut: vi.fn(), error: null }) }));

const mpho: Guardian = {
  id: "g1",
  firstName: "Mpho",
  lastName: "Dlamini",
  relationship: "mother",
  email: "mpho@example.test",
  phone: "+27821234567",
  language: "zu",
  contactEmail: true,
  contactSms: false,
  contactWhatsapp: true,
  status: "active",
  hasAccount: true,
};
const sipho: Guardian = {
  ...mpho,
  id: "g2",
  firstName: "Sipho",
  lastName: "Khumalo",
  relationship: "grandparent",
  email: null,
  phone: "+27831112222",
  contactEmail: false,
  hasAccount: false,
};

const valid: GuardianForm = {
  ...EMPTY_GUARDIAN,
  firstName: "Mpho",
  lastName: "Dlamini",
  relationship: "mother",
  email: "mpho@example.test",
};

describe("guardian rules", () => {
  it("needs a name, relationship and a way to reach them", () => {
    expect(validateGuardian(valid)).toEqual({});
    expect(Object.keys(validateGuardian(EMPTY_GUARDIAN)).sort()).toEqual(
      ["contact", "email", "firstName", "lastName", "relationship"].sort(),
    );
  });

  it("each contact channel needs its detail", () => {
    expect(validateGuardian({ ...valid, contactWhatsapp: true }).contact).toBeDefined();
    expect(validateGuardian({ ...valid, contactWhatsapp: true, phone: "082 123 4567" })).toEqual(
      {},
    );
    expect(validateGuardian({ ...valid, phone: "011 123 4567" }).phone).toBeDefined();
  });

  it("finds people by name, email or mobile", () => {
    expect(matchesSearch(mpho, "dlam")).toBe(true);
    expect(matchesSearch(mpho, "MPHO@")).toBe(true);
    expect(matchesSearch(mpho, "082 123")).toBe(true);
    expect(matchesSearch(mpho, "khumalo")).toBe(false);
  });

  it("maps database refusals to fields", () => {
    expect(guardianError({ code: "LBR61" }).field).toBe("email");
    expect(guardianError({ code: "LBR60", hint: "phone" }).field).toBe("phone");
    expect(guardianError({ code: "42501" }).field).toBeNull();
  });
});

function renderPage() {
  const rootRoute = createRootRoute({ component: () => <Outlet /> });
  const page = createRoute({
    getParentRoute: () => rootRoute,
    path: "/school/parents",
    component: ParentsPage,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([page]),
    history: createMemoryHistory({ initialEntries: ["/school/parents"] }),
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

const change = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } });

beforeEach(() => {
  vi.clearAllMocks();
  api.listGuardians.mockResolvedValue([mpho, sipho]);
});

describe("School → Parents", () => {
  it("lists parents with relationship, contact choices and account state", async () => {
    renderPage();
    const row = await screen.findByRole("listitem", { name: "Mpho Dlamini" });
    expect(within(row).getByText(/Mother/)).toBeInTheDocument();
    expect(within(row).getByText(/082 123 4567/)).toBeInTheDocument();
    expect(within(row).getByText(/Contact by email, WhatsApp/)).toBeInTheDocument();
    expect(within(row).getByText("Has an account")).toBeInTheDocument();
    expect(
      within(screen.getByRole("listitem", { name: "Sipho Khumalo" })).getByText("No account yet"),
    ).toBeInTheDocument();
  });

  it("filters the list as you search", async () => {
    renderPage();
    await screen.findByRole("listitem", { name: "Mpho Dlamini" });
    change(screen.getByLabelText("Search"), "khum");
    expect(screen.queryByRole("listitem", { name: "Mpho Dlamini" })).not.toBeInTheDocument();
    expect(screen.getByRole("listitem", { name: "Sipho Khumalo" })).toBeInTheDocument();
  });

  it("adds a parent after checking the details", async () => {
    api.addGuardian.mockResolvedValue("g3");
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Add a parent or guardian" }));
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(
      await screen.findByText("Choose how they're related to the learner."),
    ).toBeInTheDocument();
    expect(api.addGuardian).not.toHaveBeenCalled();

    change(screen.getByLabelText(/First name/), "Lerato");
    change(screen.getByLabelText(/Surname/), "Mokoena");
    change(screen.getByLabelText(/Relationship to the learner/), "father");
    change(screen.getByLabelText(/Email address/), "lerato@example.test");
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByText(/Lerato Mokoena added/)).toBeInTheDocument();
    expect(api.addGuardian).toHaveBeenCalledWith(
      "s1",
      expect.objectContaining({ firstName: "Lerato", relationship: "father" }),
    );
  });

  it("shows a duplicate email on the email field", async () => {
    api.addGuardian.mockRejectedValue({ code: "LBR61" });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Add a parent or guardian" }));
    change(screen.getByLabelText(/First name/), "Lerato");
    change(screen.getByLabelText(/Surname/), "Mokoena");
    change(screen.getByLabelText(/Relationship to the learner/), "father");
    change(screen.getByLabelText(/Email address/), "mpho@example.test");
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByText(/already on another parent record/)).toBeInTheDocument();
  });

  it("doesn't let the email change once the parent has an account", async () => {
    renderPage();
    const row = await screen.findByRole("listitem", { name: "Mpho Dlamini" });
    fireEvent.click(within(row).getByRole("button", { name: "Edit" }));
    expect(within(row).getByLabelText(/Email address/)).toBeDisabled();
  });

  it("archives only with a reason", async () => {
    api.setGuardianStatus.mockResolvedValue(true);
    renderPage();
    const row = await screen.findByRole("listitem", { name: "Sipho Khumalo" });
    fireEvent.click(within(row).getByRole("button", { name: "Archive" }));
    fireEvent.click(within(row).getByRole("button", { name: "Confirm: archive" }));
    expect(await within(row).findByText(/Say why/)).toBeInTheDocument();
    change(within(row).getByLabelText(/^Reason/), "Learner left the school");
    fireEvent.click(within(row).getByRole("button", { name: "Confirm: archive" }));
    await waitFor(() =>
      expect(api.setGuardianStatus).toHaveBeenCalledWith(
        "g2",
        "archived",
        "Learner left the school",
      ),
    );
  });
});
