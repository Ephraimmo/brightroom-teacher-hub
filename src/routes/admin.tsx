import { createFileRoute, Outlet } from "@tanstack/react-router";

import { RoleAreaGuard } from "@/components/app-shell/role-area-guard";

export const Route = createFileRoute("/admin")({
  component: () => (
    <RoleAreaGuard role="platform_admin">
      <Outlet />
    </RoleAreaGuard>
  ),
});
