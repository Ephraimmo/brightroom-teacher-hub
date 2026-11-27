import { Link, Navigate } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { AccountStatusGate } from "@/components/app-shell/account-status-gate";
import { useAuth } from "@/components/auth/auth-provider";
import { StatusPage } from "@/components/design/status-page";
import { Button } from "@/components/ui/button";
import { areaAccess, homePathFor, ROLE_AREAS } from "@/domain/navigation";
import type { PlatformRole } from "@/domain/permissions";
import { useUserRoles } from "@/hooks/use-user-roles";

/**
 * Lets only users who hold `role` into that role's area (/teach, /school, ...).
 *
 * This keeps people out of screens that aren't theirs. It is not the security
 * boundary: the database's row-level security decides what data anyone can read.
 * Suspended and deactivated accounts are sent to their notice first.
 */
export function RoleAreaGuard({ role, children }: { role: PlatformRole; children: ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) return <StatusPage kind="loading" title="Checking your account…" />;
  if (!user) return <Navigate to="/auth" replace />;
  return (
    <AccountStatusGate>
      <RoleCheck role={role}>{children}</RoleCheck>
    </AccountStatusGate>
  );
}

function RoleCheck({ role, children }: { role: PlatformRole; children: ReactNode }) {
  const rolesQuery = useUserRoles();

  if (rolesQuery.isLoading) return <StatusPage kind="loading" title="Checking your access…" />;
  if (rolesQuery.isError || !rolesQuery.data) {
    return (
      <StatusPage
        kind="error"
        title="We couldn't check your access"
        description="Check your connection and try again."
        actions={<Button onClick={() => void rolesQuery.refetch()}>Try again</Button>}
      />
    );
  }

  const roles = rolesQuery.data.map((r) => r.role);
  const access = areaAccess(roles, role);

  if (access === "no-role") return <Navigate to="/access-pending" replace />;
  if (access === "wrong-role") {
    return (
      <StatusPage
        kind="forbidden"
        code="No access"
        title={`This area is for ${ROLE_AREAS[role].roleLabel.toLowerCase()}s`}
        description="Your account doesn't have this role. If you think it should, ask your school administrator."
        actions={
          <Button asChild>
            <Link to={homePathFor(roles)}>Go to my area</Link>
          </Button>
        }
      />
    );
  }

  return <>{children}</>;
}
