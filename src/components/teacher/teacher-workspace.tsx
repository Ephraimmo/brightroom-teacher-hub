import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, CalendarDays, ClipboardList } from "lucide-react";

import { AppShell } from "@/components/app-shell/app-shell";
import { Button } from "@/components/ui/button";
import { teacherSampleProfile } from "@/domain/teacher-sample-data";

interface TeacherWorkspaceProps {
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
}

/**
 * The teacher area, still running on sample data. Uses the shared AppShell and
 * adds the sample school and sample notifications until real data replaces them.
 */
export function TeacherWorkspace({ title, description, actions, children }: TeacherWorkspaceProps) {
  return (
    <AppShell
      role="teacher"
      eyebrow="TEACHER DASHBOARD"
      title={title}
      description={description}
      actions={actions}
      sampleNotice="Sample workspace. Names, schedules, and progress are example data, not school records."
      sidebarContext={
        <div className="school-switcher" aria-label="Current school">
          <span className="school-avatar">G</span>
          <span className="school-details">
            <strong>{teacherSampleProfile.school}</strong>
            <small>{teacherSampleProfile.term}</small>
          </span>
        </div>
      }
      topbarExtras={<SampleNotifications />}
    >
      {children}
    </AppShell>
  );
}

function SampleNotifications() {
  const [open, setOpen] = useState(false);

  return (
    <div className="popover-anchor">
      <Button
        variant="ghost"
        size="icon"
        type="button"
        aria-label="Notifications"
        aria-expanded={open}
        aria-controls="teacher-notifications"
        onClick={() => setOpen((o) => !o)}
      >
        <Bell aria-hidden="true" />
        <span className="notification-indicator" />
      </Button>
      {open ? (
        <section
          className="topbar-popover"
          id="teacher-notifications"
          aria-label="Recent notifications"
        >
          <div className="popover-heading">
            <strong>Recent updates</strong>
            <span>2 new</span>
          </div>
          <Link to="/teach/homework" className="notification-row" onClick={() => setOpen(false)}>
            <span className="notification-symbol notification-symbol--amber">
              <ClipboardList aria-hidden="true" />
            </span>
            <span>
              <strong>Work to review</strong>
              <small>12 submissions need marking</small>
            </span>
          </Link>
          <Link to="/teach/timetable" className="notification-row" onClick={() => setOpen(false)}>
            <span className="notification-symbol notification-symbol--blue">
              <CalendarDays aria-hidden="true" />
            </span>
            <span>
              <strong>Next lesson</strong>
              <small>Grade 10 Mathematics · 09:30</small>
            </span>
          </Link>
        </section>
      ) : null}
    </div>
  );
}
