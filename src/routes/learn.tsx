import { createFileRoute, Outlet } from "@tanstack/react-router";

import { RoleAreaGuard } from "@/components/app-shell/role-area-guard";

export const Route = createFileRoute("/learn")({
  component: () => (
    <RoleAreaGuard role="learner">
      <Outlet />
    </RoleAreaGuard>
  ),
});
