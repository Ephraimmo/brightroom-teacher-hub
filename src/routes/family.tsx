import { createFileRoute, Outlet } from "@tanstack/react-router";

import { RoleAreaGuard } from "@/components/app-shell/role-area-guard";

export const Route = createFileRoute("/family")({
  component: () => (
    <RoleAreaGuard role="parent">
      <Outlet />
    </RoleAreaGuard>
  ),
});
