import { createFileRoute } from "@tanstack/react-router";

import { AreaHome } from "@/components/app-shell/area-home";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Platform administration | LearnBridge" }] }),
  component: () => <AreaHome role="platform_admin" />,
});
