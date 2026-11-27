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
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PeoplePage } from "@/components/admin/people-page";
import type { FoundUser } from "@/lib/admin-people";

const ME = "admin-1";

const service = vi.hoisted(() => ({
  findUserByEmail: vi.fn(),
  grantRole: vi.fn(),
  revokeRole: vi.fn(),
  getAccountStatus: vi.fn(),
  setAccountStatus: vi.fn(),
  getMfaFactorCount: vi.fn(),
  resetMfa: vi.fn(),
}));
vi.mock("@/lib/admin-people", () => service);
vi.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ user: { id: "admin-1", email: "admin@example.test" }, isLoading: false }),
}));
vi.mock("@/hooks/use-user-roles", () => ({
  useUserRoles: () => ({ isLoading: false, isError: false, data: [{ role: "platform_admin" }] }),
}));
vi.mock("@/hooks/use-sign-out", () => ({ useSignOut: () => ({ signOut: vi.fn(), error: null }) }));

const tumi: FoundUser = {
  userId: "user-2",
  email: "tumi@example.test",
  fullName: "Tumi Teacher",
  roles: ["teacher"],
};

async function renderPage() {
  const rootRoute = createRootRoute({ component: () => <Outlet /> });
  const people = createRoute({
    getParentRoute: () => rootRoute,
    path: "/admin/people",
    component: PeoplePage,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([people]),
    history: createMemoryHistory({ initialEntries: ["/admin/people"] }),
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  await screen.findByRole("heading", { name: "People", level: 1 });
}

// Small stand-ins for user actions.
const user = {
  type: (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } }),
  selectOptions: (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } }),
  click: (el: HTMLElement) => fireEvent.click(el),
};

async function findPerson(email: string) {
  user.type(screen.getByLabelText(/Email address/), email);
  user.click(screen.getByRole("button", { name: "Find account" }));
  return user;
}

beforeEach(() => {
  vi.clearAllMocks();
  service.getAccountStatus.mockResolvedValue("active");
  service.getMfaFactorCount.mockResolvedValue(0);
});

describe("Admin → People", () => {
  it("rejects something that isn't an email without searching", async () => {
    await renderPage();
    await findPerson("tumi");
    expect(await screen.findByText(/full email address/)).toBeInTheDocument();
    expect(service.findUserByEmail).not.toHaveBeenCalled();
  });

  it("says plainly when nobody has that email", async () => {
    service.findUserByEmail.mockResolvedValue(null);
    await renderPage();
    await findPerson("nobody@example.test");
    expect(await screen.findByText("No account uses that email")).toBeInTheDocument();
  });

  it("shows the person and their roles", async () => {
    service.findUserByEmail.mockResolvedValue(tumi);
    await renderPage();
    await findPerson("Tumi@Example.test");
    expect(await screen.findByRole("heading", { name: "Tumi Teacher" })).toBeInTheDocument();
    expect(service.findUserByEmail).toHaveBeenCalledWith("tumi@example.test");
    expect(screen.getByRole("button", { name: "Remove Teacher role" })).toBeInTheDocument();
  });

  it("won't add a role without a reason", async () => {
    service.findUserByEmail.mockResolvedValue(tumi);
    await renderPage();
    const user = await findPerson("tumi@example.test");
    await screen.findByRole("heading", { name: "Tumi Teacher" });
    user.selectOptions(screen.getByLabelText("Add a role"), "parent");
    user.click(screen.getByRole("button", { name: "Add role" }));
    expect(await screen.findByText(/saved in the audit log\./)).toBeInTheDocument();
    expect(service.grantRole).not.toHaveBeenCalled();
  });

  it("adds a role with the reason and confirms it", async () => {
    service.findUserByEmail.mockResolvedValue(tumi);
    service.grantRole.mockResolvedValue(true);
    await renderPage();
    const user = await findPerson("tumi@example.test");
    await screen.findByRole("heading", { name: "Tumi Teacher" });
    user.type(screen.getByLabelText(/Reason for the change/), "Also a parent at school A");
    user.selectOptions(screen.getByLabelText("Add a role"), "parent");
    user.click(screen.getByRole("button", { name: "Add role" }));
    expect(
      await screen.findByText("Tumi Teacher is now a Parent or guardian."),
    ).toBeInTheDocument();
    expect(service.grantRole).toHaveBeenCalledWith({
      userId: "user-2",
      role: "parent",
      reason: "Also a parent at school A",
    });
  });

  it("asks for confirmation before removing a role", async () => {
    service.findUserByEmail.mockResolvedValue(tumi);
    service.revokeRole.mockResolvedValue(true);
    await renderPage();
    const user = await findPerson("tumi@example.test");
    await screen.findByRole("heading", { name: "Tumi Teacher" });
    user.type(screen.getByLabelText(/Reason for the change/), "Left the school");
    user.click(screen.getByRole("button", { name: "Remove Teacher role" }));
    expect(service.revokeRole).not.toHaveBeenCalled();
    user.click(screen.getByRole("button", { name: "Confirm removal" }));
    await waitFor(() => expect(service.revokeRole).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Tumi Teacher is no longer a Teacher.")).toBeInTheDocument();
  });

  it("doesn't offer to remove your own admin role", async () => {
    service.findUserByEmail.mockResolvedValue({
      userId: ME,
      email: "admin@example.test",
      fullName: "Pat Admin",
      roles: ["platform_admin"],
    });
    await renderPage();
    await findPerson("admin@example.test");
    expect(
      await screen.findByText("You can't remove your own administrator role."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Remove/ })).not.toBeInTheDocument();
  });

  it("explains a database refusal in plain words", async () => {
    service.findUserByEmail.mockResolvedValue(tumi);
    service.grantRole.mockRejectedValue({ code: "42501", message: "permission denied" });
    await renderPage();
    const user = await findPerson("tumi@example.test");
    await screen.findByRole("heading", { name: "Tumi Teacher" });
    user.type(screen.getByLabelText(/Reason for the change/), "Needs access");
    user.selectOptions(screen.getByLabelText("Add a role"), "learner");
    user.click(screen.getByRole("button", { name: "Add role" }));
    expect(await screen.findByText(/Only platform administrators can do this/)).toBeInTheDocument();
    expect(screen.queryByText(/permission denied/)).not.toBeInTheDocument();
  });

  it("says when the database update hasn't been applied yet", async () => {
    service.findUserByEmail.mockRejectedValue({ code: "PGRST202" });
    await renderPage();
    await findPerson("tumi@example.test");
    expect(await screen.findByText(/isn't switched on in the database yet/)).toBeInTheDocument();
  });

  it("shows the account status and suspends after confirmation, with a reason", async () => {
    service.findUserByEmail.mockResolvedValue(tumi);
    service.setAccountStatus.mockResolvedValue(true);
    await renderPage();
    await findPerson("tumi@example.test");
    expect(await screen.findByText("Active")).toBeInTheDocument();
    user.click(screen.getByRole("button", { name: "Suspend" }));
    expect(
      screen.getByText(/They can still sign in but will only see a notice/),
    ).toBeInTheDocument();

    user.click(screen.getByRole("button", { name: "Confirm: suspend" }));
    expect(await screen.findByText(/saved in the audit log\./)).toBeInTheDocument();
    expect(service.setAccountStatus).not.toHaveBeenCalled();

    user.type(screen.getByLabelText(/Reason for the change/), "Misuse reported by school");
    user.click(screen.getByRole("button", { name: "Confirm: suspend" }));
    expect(await screen.findByText("Tumi Teacher's account is now suspended.")).toBeInTheDocument();
    expect(service.setAccountStatus).toHaveBeenCalledWith(
      "user-2",
      "suspended",
      "Misuse reported by school",
    );
  });

  it("offers reactivation for a suspended account", async () => {
    service.findUserByEmail.mockResolvedValue(tumi);
    service.getAccountStatus.mockResolvedValue("suspended");
    await renderPage();
    await findPerson("tumi@example.test");
    expect(await screen.findByText("Suspended")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reactivate" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Suspend" })).not.toBeInTheDocument();
  });

  it("doesn't let admins change their own account's status", async () => {
    service.findUserByEmail.mockResolvedValue({ ...tumi, userId: ME });
    await renderPage();
    await findPerson("admin@example.test");
    expect(
      await screen.findByText("You can't change your own account's status."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Suspend" })).not.toBeInTheDocument();
  });

  it("resets someone's two-step sign-in after confirmation, with a reason", async () => {
    service.findUserByEmail.mockResolvedValue(tumi);
    service.getMfaFactorCount.mockResolvedValue(1);
    service.resetMfa.mockResolvedValue(1);
    await renderPage();
    await findPerson("tumi@example.test");
    expect(await screen.findByText("On (1 app)")).toBeInTheDocument();
    user.click(screen.getByRole("button", { name: "Reset" }));
    user.type(
      screen.getByLabelText(/Reason for the change/),
      "Lost phone, identity checked by call",
    );
    user.click(screen.getByRole("button", { name: "Confirm: reset" }));
    expect(await screen.findByText(/two-step sign-in was reset/)).toBeInTheDocument();
    expect(service.resetMfa).toHaveBeenCalledWith("user-2", "Lost phone, identity checked by call");
  });
});
