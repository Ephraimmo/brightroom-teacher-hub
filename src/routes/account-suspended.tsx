import { createFileRoute, Navigate } from "@tanstack/react-router";

import { useAuth } from "@/components/auth/auth-provider";
import { StatusPage } from "@/components/design/status-page";
import { Button } from "@/components/ui/button";
import { blockedNotice } from "@/domain/account-status";
import { useAccountStatus } from "@/hooks/use-account-status";
import { useSignOut } from "@/hooks/use-sign-out";

export const Route = createFileRoute("/account-suspended")({
  head: () => ({
    meta: [{ title: "Account unavailable | LearnBridge" }, { name: "robots", content: "noindex" }],
  }),
  component: AccountSuspendedPage,
});

/** The only page a suspended or deactivated person sees after signing in. */
function AccountSuspendedPage() {
  const { user, isLoading } = useAuth();
  const status = useAccountStatus();
  const { signOut, error } = useSignOut();

  if (isLoading || (user && status.isLoading)) {
    return <StatusPage kind="loading" title="Checking your account…" />;
  }
  if (!user) return <Navigate to="/auth" replace />;
  // Reactivated since they got here (or never blocked): back to the app.
  if (status.data === "active") return <Navigate to="/" replace />;

  const notice = blockedNotice(status.data === "deactivated" ? "deactivated" : "suspended");
  return (
    <StatusPage
      kind="forbidden"
      code={status.data === "deactivated" ? "Account closed" : "Account suspended"}
      title={notice.title}
      description={
        <>
          {notice.description}
          {error ? (
            <span className="mt-3 block text-destructive" role="alert">
              {error}
            </span>
          ) : null}
        </>
      }
      actions={
        <>
          <Button variant="outline" onClick={() => void status.refetch()}>
            Check again
          </Button>
          <Button variant="ghost" onClick={() => void signOut()}>
            Sign out
          </Button>
        </>
      }
    />
  );
}
