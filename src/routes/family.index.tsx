import { createFileRoute } from "@tanstack/react-router";

import { AreaHome } from "@/components/app-shell/area-home";

export const Route = createFileRoute("/family/")({
  head: () => ({ meta: [{ title: "My family | LearnBridge" }] }),
  component: () => <AreaHome role="parent" />,
});
