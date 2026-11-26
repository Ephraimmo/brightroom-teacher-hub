import { createFileRoute } from "@tanstack/react-router";

import { AreaHome } from "@/components/app-shell/area-home";

export const Route = createFileRoute("/school/")({
  head: () => ({ meta: [{ title: "School administration | LearnBridge" }] }),
  component: () => <AreaHome role="school_admin" />,
});
