import { createFileRoute } from "@tanstack/react-router";

import type { DemoRole } from "@/demo/demo-data";
import { DemoPicker } from "@/demo/demo-picker";
import { isDemoRole } from "@/demo/demo-session";

export const Route = createFileRoute("/demo")({
  head: () => ({
    meta: [
      { title: "Explore the demo | LearnBridge" },
      {
        name: "description",
        content: "Try LearnBridge as a school admin, teacher, parent or learner, with sample data.",
      },
    ],
  }),
  // `/demo?as=teacher` starts the demo as that role.
  validateSearch: (search: Record<string, unknown>): { as?: DemoRole } =>
    isDemoRole(search["as"]) ? { as: search["as"] } : {},
  component: DemoPage,
});

function DemoPage() {
  const { as } = Route.useSearch();
  return <DemoPicker startAs={as ?? null} />;
}
