import { createFileRoute, Link } from "@tanstack/react-router";
import type { Enums } from "@/integrations/supabase/types";

import { useAuth } from "@/components/auth/auth-provider";
import { AccountStatusGate } from "@/components/app-shell/account-status-gate";
import { ProfileEditor } from "@/components/account/profile-editor";
import { AppShell } from "@/components/app-shell/app-shell";
import { Button } from "@/components/ui/button";
import { orderedRoles } from "@/domain/navigation";
import { useUserRoles } from "@/hooks/use-user-roles";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "My Profile | LearnBridge" },
      { name: "description", content: "Review and update your LearnBridge profile details." },
      { property: "og:title", content: "My Profile | LearnBridge" },
      {
        property: "og:description",
        content: "Manage your own account profile and see assigned access.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AccountPage,
});

const roleLabels: Record<Enums<"app_role">, string> = {
  platform_admin: "Platform administrator",
  school_admin: "School administrator",
  teacher: "Teacher",
  learner: "Learner",
  parent: "Parent or guardian",
};

function AccountPage() {
  const { user, isLoading } = useAuth();
  const rolesQuery = useUserRoles();

  if (isLoading) {
    return (
      <main className="auth-page">
        <p role="status">Checking your account…</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="auth-page auth-page--compact">
        <section className="reset-panel">
          <p className="page-eyebrow">MY PROFILE</p>
          <h1>Sign in to continue</h1>
          <p className="page-description">
            Your account details are private and only available after you sign in.
          </p>
          <Button className="auth-submit" asChild>
            <Link to="/auth">Sign in</Link>
          </Button>
        </section>
      </main>
    );
  }

  const roles = rolesQuery.data ?? [];
  // Show the menu of the user's main role, so the profile sits inside their own area.
  const shellRole = orderedRoles(roles.map((r) => r.role))[0] ?? null;

  return (
    <AccountStatusGate>
      <AppShell
        role={shellRole}
        eyebrow="MY ACCOUNT"
        title="My profile"
        description="Update your details and review the access assigned to your account."
      >
        <div className="account-grid">
          <section className="workspace-panel account-panel">
            <div className="section-heading">
              <div>
                <p className="section-eyebrow">YOUR DETAILS</p>
                <h2>Profile information</h2>
              </div>
            </div>
            <ProfileEditor userId={user.id} />
          </section>

          <section className="workspace-panel account-panel">
            <div className="section-heading">
              <div>
                <p className="section-eyebrow">ACCOUNT ACCESS</p>
                <h2>Your role</h2>
              </div>
            </div>
            {rolesQuery.isLoading ? <p role="status">Checking assigned access…</p> : null}
            {rolesQuery.isError ? (
              <p className="form-message form-message--error" role="alert">
                Assigned access could not be loaded.
              </p>
            ) : null}
            {roles.length > 0 ? (
              <ul className="role-list">
                {roles.map(({ role }) => (
                  <li key={role}>{roleLabels[role]}</li>
                ))}
              </ul>
            ) : null}
            {!rolesQuery.isLoading && !rolesQuery.isError && roles.length === 0 ? (
              <div className="role-pending">
                <span className="role-pending-mark" />
                <strong>Access is not assigned yet</strong>
                <p>
                  A school or platform administrator must assign your role. New users cannot grant
                  themselves school access.
                </p>
              </div>
            ) : null}
            <p className="account-email-note">
              Signed in as <strong>{user.email ?? "your account"}</strong>
            </p>
          </section>
        </div>
      </AppShell>
    </AccountStatusGate>
  );
}
