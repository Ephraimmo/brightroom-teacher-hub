import { Link } from "@tanstack/react-router";
import { Construction } from "lucide-react";

import { AppShell } from "@/components/app-shell/app-shell";
import { EmptyState } from "@/components/design/states";
import { Button } from "@/components/ui/button";
import { ROLE_AREAS } from "@/domain/navigation";
import type { PlatformRole } from "@/domain/permissions";

type AreaWithoutPages = Exclude<PlatformRole, "teacher">;

const COMING: Record<AreaWithoutPages, { eyebrow: string; contents: string; task: string }> = {
  platform_admin: {
    eyebrow: "PLATFORM ADMINISTRATION",
    contents: "Schools, users, subscriptions and platform health",
    task: "P4-01",
  },
  school_admin: {
    eyebrow: "SCHOOL ADMINISTRATION",
    contents: "Learners, teachers, classes, attendance and academic summaries for your school",
    task: "P4-02",
  },
  learner: {
    eyebrow: "MY LEARNING",
    contents: "Your timetable, subjects, upcoming lessons, homework and notices",
    task: "P4-04",
  },
  parent: {
    eyebrow: "MY FAMILY",
    contents: "Each linked child's attendance, homework, timetable, results and subscription",
    task: "P4-05",
  },
};

/**
 * Home page for a role whose dashboard isn't built yet. Says so plainly
 * instead of showing invented numbers.
 */
export function AreaHome({ role }: { role: AreaWithoutPages }) {
  const area = ROLE_AREAS[role];
  const coming = COMING[role];

  return (
    <AppShell
      role={role}
      eyebrow={coming.eyebrow}
      title={area.workspaceName}
      description="Your account and role are set up correctly."
    >
      <EmptyState
        icon={Construction}
        title="Your dashboard is on its way"
        description={`${coming.contents} will appear here. This part of LearnBridge is still being built (tracker task ${coming.task}).`}
        action={
          <Button variant="outline" size="sm" asChild>
            <Link to="/account">View my profile</Link>
          </Button>
        }
      />
    </AppShell>
  );
}
