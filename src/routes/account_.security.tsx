import { createFileRoute, Link, Navigate } from "@tanstack/react-router";

import { SecurityPanel } from "@/components/account/security-panel";
import { AccountStatusGate } from "@/components/app-shell/account-status-gate";
import { AppShell } from "@/components/app-shell/app-shell";
import { useAuth } from "@/components/auth/auth-provider";
import { StatusPage } from "@/components/design/status-page";
import { Button } from "@/components/ui/button";
import { orderedRoles } from "@/domain/navigation";
import { useUserRoles } from "@/hooks/use-user-roles";

export const Route = createFileRoute("/account_/security")({
  validateSearch: (search: Record<string, unknown>): { required?: boolean } =>
    search["required"] === true || search["required"] === "true" ? { required: true } : {},
  head: () => ({
    meta: [{ title: "Sign-in security | LearnBridge" }, { name: "robots", content: "noindex" }],
  }),
  component: SecurityPage,
});

function SecurityPage() {
  const { user, isLoading } = useAuth();
  const rolesQuery = useUserRoles();
  const { required } = Route.useSearch();

  if (isLoading) return <StatusPage kind="loading" title="Checking your account…" />;
  if (!user) return <Navigate to="/auth" replace />;

  const shellRole = orderedRoles((rolesQuery.data ?? []).map((r) => r.role))[0] ?? null;
  return (
    <AccountStatusGate>
      <AppShell
        role={shellRole}
        eyebrow="MY ACCOUNT"
        title="Sign-in security"
        description="Protect your account with a code from your phone."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link to="/account">Back to my profile</Link>
          </Button>
        }
      >
        <section className="workspace-panel account-panel">
          <SecurityPanel required={required === true} />
        </section>
      </AppShell>
    </AccountStatusGate>
  );
}
