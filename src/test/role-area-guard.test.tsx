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

import { RoleAreaGuard } from "@/components/app-shell/role-area-guard";
import type { PlatformRole } from "@/domain/permissions";

// The guard's two inputs: who is signed in, and which roles they hold.
const auth = vi.hoisted(() => ({
  value: { user: null as { id: string; email: string } | null, isLoading: false },
}));
const roles = vi.hoisted(() => ({
  value: {
    isLoading: false,
    isError: false,
    data: [] as { role: PlatformRole }[] | undefined,
    refetch: () => {},
  },
}));

vi.mock("@/components/auth/auth-provider", () => ({ useAuth: () => auth.value }));
vi.mock("@/hooks/use-user-roles", () => ({ useUserRoles: () => roles.value }));

/** A tiny app: a teacher area guarded by RoleAreaGuard, plus the pages it can send people to. */
async function renderTeacherArea() {
  const rootRoute = createRootRoute({ component: () => <Outlet /> });
  const page = (path: string, text: string) =>
    createRoute({ getParentRoute: () => rootRoute, path, component: () => <p>{text}</p> });
  const teach = createRoute({
    getParentRoute: () => rootRoute,
    path: "/teach",
    component: () => (
      <RoleAreaGuard role="teacher">
        <p>Teacher content</p>
      </RoleAreaGuard>
    ),
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([
      teach,
      page("/auth", "Sign-in page"),
      page("/access-pending", "Waiting page"),
      page("/family", "Family page"),
    ]),
    history: createMemoryHistory({ initialEntries: ["/teach"] }),
  });
  render(<RouterProvider router={router} />);
  return router;
}

beforeEach(() => {
  auth.value = { user: { id: "u1", email: "t@example.com" }, isLoading: false };
  roles.value = { isLoading: false, isError: false, data: [], refetch: () => {} };
});

describe("RoleAreaGuard", () => {
  it("lets a teacher into the teacher area", async () => {
    roles.value.data = [{ role: "teacher" }];
    await renderTeacherArea();
    expect(await screen.findByText("Teacher content")).toBeInTheDocument();
  });

  it("sends signed-out visitors to sign-in", async () => {
    auth.value = { user: null, isLoading: false };
    await renderTeacherArea();
    expect(await screen.findByText("Sign-in page")).toBeInTheDocument();
    expect(screen.queryByText("Teacher content")).not.toBeInTheDocument();
  });

  it("sends a user without any role to the waiting page", async () => {
    await renderTeacherArea();
    expect(await screen.findByText("Waiting page")).toBeInTheDocument();
  });

  it("blocks a parent from the teacher area and offers their own area", async () => {
    roles.value.data = [{ role: "parent" }];
    await renderTeacherArea();
    expect(await screen.findByRole("heading", { name: /for teachers/i })).toBeInTheDocument();
    expect(screen.queryByText("Teacher content")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to my area" })).toHaveAttribute("href", "/family");
  });

  it("shows a loading state while checking", async () => {
    roles.value = { ...roles.value, isLoading: true, data: undefined };
    await renderTeacherArea();
    expect(await screen.findByRole("status")).toHaveTextContent("Checking your access");
    expect(screen.queryByText("Teacher content")).not.toBeInTheDocument();
  });

  it("shows an error with a retry if roles can't be loaded", async () => {
    roles.value = { ...roles.value, isError: true, data: undefined };
    await renderTeacherArea();
    expect(await screen.findByRole("alert")).toHaveTextContent("couldn't check your access");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
