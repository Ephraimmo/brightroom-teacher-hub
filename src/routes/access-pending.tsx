import { createFileRoute, Link, Navigate } from "@tanstack/react-router";

import { useAuth } from "@/components/auth/auth-provider";
import { StatusPage } from "@/components/design/status-page";
import { Button } from "@/components/ui/button";
import { homePathFor } from "@/domain/navigation";
import { useSignOut } from "@/hooks/use-sign-out";
import { useUserRoles } from "@/hooks/use-user-roles";

export const Route = createFileRoute("/access-pending")({
  head: () => ({ meta: [{ title: "Waiting for access | LearnBridge" }] }),
  component: AccessPendingPage,
});

/** Signed in, but no school or platform role has been assigned yet. */
function AccessPendingPage() {
  const { user, isLoading } = useAuth();
  const rolesQuery = useUserRoles();
  const { signOut, error } = useSignOut();

  if (isLoading || (user && rolesQuery.isLoading)) {
    return <StatusPage kind="loading" title="Checking your access…" />;
  }
  if (!user) return <Navigate to="/auth" replace />;

  const roles = (rolesQuery.data ?? []).map((r) => r.role);
  // A role was assigned since the user got here: take them to their area.
  if (roles.length > 0) return <Navigate to={homePathFor(roles)} replace />;

  return (
    <StatusPage
      kind="pending"
      title="Your account is waiting for access"
      description={
        <>
          You're signed in as <strong>{user.email ?? "your account"}</strong>. A school or platform
          administrator needs to give your account a role (teacher, learner, parent, school admin)
          before you can see school records. You can't assign a role to yourself.
          {error ? (
            <span className="mt-3 block text-destructive" role="alert">
              {error}
            </span>
          ) : null}
        </>
      }
      actions={
        <>
          <Button variant="outline" onClick={() => void rolesQuery.refetch()}>
            Check again
          </Button>
          <Button variant="outline" asChild>
            <Link to="/account">View my profile</Link>
          </Button>
          <Button variant="ghost" onClick={() => void signOut()}>
            Sign out
          </Button>
        </>
      }
    />
  );
}
