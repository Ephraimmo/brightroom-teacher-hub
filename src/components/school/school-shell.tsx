import { School } from "lucide-react";
import type { ReactNode } from "react";

import { AppShell } from "@/components/app-shell/app-shell";
import { EmptyState, ErrorState, LoadingState } from "@/components/design/states";
import type { MySchool } from "@/lib/schools";

import { SchoolSwitcher } from "./school-switcher";
import { useCurrentSchool } from "./use-current-school";

/**
 * Frame for every school-admin page: the app shell plus the school being
 * worked on. `children` gets the current school.
 */
export function SchoolShell({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
  children: (school: MySchool) => ReactNode;
}) {
  const { schools, current, choose, isLoading, isError, refetch } = useCurrentSchool();

  return (
    <AppShell
      role="school_admin"
      eyebrow={current ? current.name.toUpperCase() : "SCHOOL ADMINISTRATION"}
      title={title}
      description={description}
      {...(actions && current ? { actions } : {})}
      topbarExtras={<SchoolSwitcher schools={schools} current={current} onChoose={choose} />}
    >
      {isLoading ? (
        <LoadingState label="Loading your school…" rows={3} />
      ) : isError ? (
        <ErrorState title="Your school didn't load" onRetry={() => void refetch()} />
      ) : !current ? (
        <EmptyState
          icon={School}
          title="No school linked to your account yet"
          description="A platform administrator registers your school and invites you. Accept the invitation from My profile, or once the latest database updates are applied."
        />
      ) : (
        children(current)
      )}
    </AppShell>
  );
}
