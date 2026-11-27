import { Navigate, useLocation } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";

import { StatusPage } from "@/components/design/status-page";
import { Button } from "@/components/ui/button";
import { mfaStep } from "@/domain/mfa";
import type { PlatformRole } from "@/domain/permissions";
import { useMfa } from "@/hooks/use-mfa";

/**
 * For admin areas: makes sure the person has an authenticator app and has
 * used it this session before showing the area. The database enforces the
 * same rule; this just sends people to the right screen.
 */
export function MfaGate({ role, children }: { role: PlatformRole; children: ReactNode }) {
  const mfa = useMfa();
  const pathname = useLocation({ select: (l) => l.pathname });
  // Where to come back to after the code: the page first asked for, not
  // wherever the router is part-way through navigating.
  const [returnTo] = useState(pathname);

  if (mfa.isLoading) return <StatusPage kind="loading" title="Checking your sign-in…" />;
  if (mfa.isError || !mfa.data) {
    return (
      <StatusPage
        kind="error"
        title="We couldn't check your sign-in"
        description="Check your connection and try again."
        actions={<Button onClick={() => void mfa.refetch()}>Try again</Button>}
      />
    );
  }

  const step = mfaStep(role, mfa.data);
  if (step === "enrol")
    return <Navigate to="/account/security" search={{ required: true }} replace />;
  if (step === "verify") return <Navigate to="/auth/mfa" search={{ redirect: returnTo }} replace />;
  return <>{children}</>;
}
