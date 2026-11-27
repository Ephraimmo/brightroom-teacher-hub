import { createFileRoute } from "@tanstack/react-router";

import { StaffPage } from "@/components/school/staff-page";

export const Route = createFileRoute("/school/staff")({
  head: () => ({ meta: [{ title: "Staff | LearnBridge" }] }),
  component: StaffPage,
});
