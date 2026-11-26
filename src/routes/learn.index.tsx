import { createFileRoute } from "@tanstack/react-router";

import { AreaHome } from "@/components/app-shell/area-home";

export const Route = createFileRoute("/learn/")({
  head: () => ({ meta: [{ title: "My learning | LearnBridge" }] }),
  component: () => <AreaHome role="learner" />,
});
