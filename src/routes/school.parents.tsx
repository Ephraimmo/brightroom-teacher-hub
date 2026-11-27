import { createFileRoute } from "@tanstack/react-router";

import { ParentsPage } from "@/components/school/parents-page";

export const Route = createFileRoute("/school/parents")({
  head: () => ({ meta: [{ title: "Parents and guardians | LearnBridge" }] }),
  component: ParentsPage,
});
