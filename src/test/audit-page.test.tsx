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

import { AuditPage } from "@/components/admin/audit-page";
import type { AuditEntry } from "@/domain/audit";

const audit = vi.hoisted(() => ({ loadAuditPage: vi.fn(), AUDIT_PAGE_SIZE: 2 }));
const people = vi.hoisted(() => ({ findUserByEmail: vi.fn() }));
vi.mock("@/lib/admin-audit", () => audit);
vi.mock("@/lib/admin-people", () => people);
vi.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ user: { id: "admin-1", email: "admin@example.test" }, isLoading: false }),
}));
vi.mock("@/hooks/use-user-roles", () => ({
  useUserRoles: () => ({ isLoading: false, isError: false, data: [{ role: "platform_admin" }] }),
}));
vi.mock("@/hooks/use-sign-out", () => ({ useSignOut: () => ({ signOut: vi.fn(), error: null }) }));

const entry = (id: number, over: Partial<AuditEntry> = {}): AuditEntry => ({
  id,
  occurredAt: "2026-11-27T12:05:00Z",
  action: "account.suspend",
  actorEmail: "admin@example.test",
  actorRole: "platform_admin",
  entityType: "user",
  entityId: "u2",
  targetEmail: "tumi@example.test",
  before: { status: "active" },
  after: { status: "suspended" },
  reason: "Misuse reported",
  ...over,
});

async function renderPage() {
  const rootRoute = createRootRoute({ component: () => <Outlet /> });
  const page = createRoute({
    getParentRoute: () => rootRoute,
    path: "/admin/audit",
    component: AuditPage,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([page]),
    history: createMemoryHistory({ initialEntries: ["/admin/audit"] }),
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  await screen.findByRole("heading", { name: "Audit log", level: 1 });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Admin → Audit log", () => {
  it("lists changes in plain words: what, who, when and why", async () => {
    audit.loadAuditPage.mockResolvedValue([entry(5)]);
    await renderPage();
    expect(await screen.findByText("Account suspended")).toBeInTheDocument();
    expect(screen.getByText("Active → Suspended")).toBeInTheDocument();
    expect(screen.getByText("tumi@example.test")).toBeInTheDocument();
    expect(screen.getByText("Misuse reported")).toBeInTheDocument();
  });

  it("filters by type of change", async () => {
    audit.loadAuditPage.mockResolvedValue([]);
    await renderPage();
    await screen.findByText("No changes recorded");
    fireEvent.change(screen.getByLabelText("Type of change"), { target: { value: "role." } });
    await waitFor(() =>
      expect(audit.loadAuditPage).toHaveBeenLastCalledWith({
        group: "role.",
        userId: null,
        beforeId: null,
      }),
    );
    expect(await screen.findByText("Nothing matches these filters.")).toBeInTheDocument();
  });

  it("filters by person, looked up by exact email", async () => {
    audit.loadAuditPage.mockResolvedValue([]);
    people.findUserByEmail.mockResolvedValue({ userId: "u2", email: "tumi@example.test" });
    await renderPage();
    fireEvent.change(screen.getByLabelText(/Person/), { target: { value: "tumi@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: "Filter" }));
    await waitFor(() =>
      expect(audit.loadAuditPage).toHaveBeenLastCalledWith({
        group: "",
        userId: "u2",
        beforeId: null,
      }),
    );
  });

  it("says when nobody has that email", async () => {
    audit.loadAuditPage.mockResolvedValue([]);
    people.findUserByEmail.mockResolvedValue(null);
    await renderPage();
    fireEvent.change(screen.getByLabelText(/Person/), { target: { value: "x@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: "Filter" }));
    expect(await screen.findByText("No account uses that email.")).toBeInTheDocument();
  });

  it("loads older changes page by page", async () => {
    audit.loadAuditPage
      .mockResolvedValueOnce([entry(9), entry(8)])
      .mockResolvedValueOnce([entry(7, { action: "role.grant", after: { role: "teacher" } })]);
    await renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Show older changes" }));
    expect(await screen.findByText("Role given")).toBeInTheDocument();
    expect(audit.loadAuditPage).toHaveBeenLastCalledWith({ group: "", userId: null, beforeId: 8 });
    expect(screen.queryByRole("button", { name: "Show older changes" })).not.toBeInTheDocument();
  });

  it("explains when the database update isn't applied yet", async () => {
    audit.loadAuditPage.mockRejectedValue({ code: "PGRST202" });
    await renderPage();
    expect(await screen.findByText(/isn't switched on in the database yet/)).toBeInTheDocument();
  });
});
