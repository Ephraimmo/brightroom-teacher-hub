import { createFileRoute, Outlet } from "@tanstack/react-router";

import { RoleAreaGuard } from "@/components/app-shell/role-area-guard";

export const Route = createFileRoute("/teach")({
  component: () => (
    <RoleAreaGuard role="teacher">
      <Outlet />
    </RoleAreaGuard>
  ),
});
