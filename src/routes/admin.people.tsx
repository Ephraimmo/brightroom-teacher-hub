import { createFileRoute } from "@tanstack/react-router";

import { PeoplePage } from "@/components/admin/people-page";

export const Route = createFileRoute("/admin/people")({
  head: () => ({ meta: [{ title: "People | LearnBridge" }] }),
  component: PeoplePage,
});
