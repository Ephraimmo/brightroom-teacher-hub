import { createFileRoute } from "@tanstack/react-router";

import { SchoolsPage } from "@/components/admin/schools-page";

export const Route = createFileRoute("/admin/institutions")({
  head: () => ({ meta: [{ title: "Schools | LearnBridge" }] }),
  component: SchoolsPage,
});
