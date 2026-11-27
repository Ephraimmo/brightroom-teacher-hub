import { createFileRoute } from "@tanstack/react-router";

import { AuditPage } from "@/components/admin/audit-page";

export const Route = createFileRoute("/admin/audit")({
  head: () => ({ meta: [{ title: "Audit log | LearnBridge" }] }),
  component: AuditPage,
});
