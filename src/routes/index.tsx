import { createFileRoute, Navigate } from "@tanstack/react-router";

import { useAuth } from "@/components/auth/auth-provider";
import { StatusPage } from "@/components/design/status-page";
import { Button } from "@/components/ui/button";
import { homePathFor } from "@/domain/navigation";
import { useUserRoles } from "@/hooks/use-user-roles";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LearnBridge | Hybrid Learning" },
      {
        name: "description",
        content: "A connected workspace for teachers, learners, schools, and families.",
      },
    ],
  }),
  component: HomeRedirect,
});

/**
 * Sends each signed-in person to their own area (/teach, /school, ...), or to
 * /access-pending if no role is assigned yet. Signed-out visitors go to sign-in
 * until the public landing page arrives (tracker task P1-04).
 */
function HomeRedirect() {
  const { user, isLoading } = useAuth();
  const rolesQuery = useUserRoles();

  if (isLoading) return <StatusPage kind="loading" title="Opening LearnBridge…" />;
  if (!user) return <Navigate to="/auth" replace />;
  if (rolesQuery.isLoading) return <StatusPage kind="loading" title="Opening your workspace…" />;
  if (rolesQuery.isError || !rolesQuery.data) {
    return (
      <StatusPage
        kind="error"
        title="We couldn't open your workspace"
        description="Check your connection and try again."
        actions={<Button onClick={() => void rolesQuery.refetch()}>Try again</Button>}
      />
    );
  }

  return <Navigate to={homePathFor(rolesQuery.data.map((r) => r.role))} replace />;
}
