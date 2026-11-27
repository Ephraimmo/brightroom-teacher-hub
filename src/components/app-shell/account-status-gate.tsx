import { Navigate } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { StatusPage } from "@/components/design/status-page";
import { Button } from "@/components/ui/button";
import { useAccountStatus } from "@/hooks/use-account-status";

/**
 * Sends a signed-in person whose account is suspended or deactivated to the
 * notice page. Use inside pages that already know someone is signed in.
 *
 * This is the screen side only: the database also stops their roles from
 * counting, so they can't reach data another way.
 */
export function AccountStatusGate({ children }: { children: ReactNode }) {
  const status = useAccountStatus();

  if (status.isLoading) return <StatusPage kind="loading" title="Checking your account…" />;
  if (status.isError) {
    return (
      <StatusPage
        kind="error"
        title="We couldn't check your account"
        description="Check your connection and try again."
        actions={<Button onClick={() => void status.refetch()}>Try again</Button>}
      />
    );
  }
  if (status.data && status.data !== "active") return <Navigate to="/account-suspended" replace />;
  return <>{children}</>;
}
