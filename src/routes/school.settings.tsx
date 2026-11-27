import { createFileRoute } from "@tanstack/react-router";

import { SchoolSettingsPage } from "@/components/school/settings-page";

export const Route = createFileRoute("/school/settings")({
  head: () => ({ meta: [{ title: "School settings | LearnBridge" }] }),
  component: SchoolSettingsPage,
});
