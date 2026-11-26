import { createFileRoute, Navigate } from "@tanstack/react-router";

import { useAuth } from "@/components/auth/auth-provider";
import { StatusPage } from "@/components/design/status-page";
import { LandingPage } from "@/components/landing/landing-page";
import { Button } from "@/components/ui/button";
import { homePathFor } from "@/domain/navigation";
import { useUserRoles } from "@/hooks/use-user-roles";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LearnBridge | Hybrid learning for South African schools and families" },
      {
        name: "description",
        content:
          "Live lessons in the classroom and online, homework, tests and results, with a separate subscription for every child.",
      },
      { property: "og:title", content: "LearnBridge | Hybrid learning" },
      {
        property: "og:description",
        content:
          "One lesson, in the classroom and online. For schools, teachers, learners and parents.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomePage,
});

/**
 * Signed-out visitors see the public landing page. Signed-in people go
 * straight to their own area (/teach, /school, ...), or to /access-pending
 * if no role is assigned yet.
 *
 * While the browser is still checking for a session (and on the server, which
 * can't see it), the landing page is shown, so search engines and first-time
 * visitors get real content instead of a loading screen.
 */
function HomePage() {
  const { user, isLoading } = useAuth();
  const rolesQuery = useUserRoles();

  if (isLoading || !user) return <LandingPage />;
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
