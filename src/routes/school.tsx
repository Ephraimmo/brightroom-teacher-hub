import { createFileRoute, Outlet } from "@tanstack/react-router";

import { RoleAreaGuard } from "@/components/app-shell/role-area-guard";

export const Route = createFileRoute("/school")({
  component: () => (
    <RoleAreaGuard role="school_admin">
      <Outlet />
    </RoleAreaGuard>
  ),
});
