import { createFileRoute } from "@tanstack/react-router";

import { SchoolHome } from "@/components/school/school-home";

export const Route = createFileRoute("/school/")({
  head: () => ({ meta: [{ title: "School administration | LearnBridge" }] }),
  component: SchoolHome,
});
