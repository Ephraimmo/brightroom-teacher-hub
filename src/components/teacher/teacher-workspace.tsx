import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  BookOpen,
  CalendarDays,
  CheckCheck,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth-provider";
import { supabase } from "@/integrations/supabase/client";
import { teacherSampleProfile } from "@/domain/teacher-sample-data";

type WorkspaceDestination = "/" | "/classes" | "/timetable" | "/resources" | "/homework";
export type WorkspaceSection = "overview" | "classes" | "timetable" | "resources" | "homework";

const navigationItems: {
  id: WorkspaceSection;
  label: string;
  to: WorkspaceDestination;
  icon: LucideIcon;
  count?: string;
}[] = [
  { id: "overview", label: "Overview", to: "/", icon: LayoutDashboard },
  { id: "classes", label: "My classes", to: "/classes", icon: Users, count: "4" },
  { id: "timetable", label: "Timetable", to: "/timetable", icon: CalendarDays },
  { id: "resources", label: "Resources", to: "/resources", icon: BookOpen },
  { id: "homework", label: "Homework & tests", to: "/homework", icon: ClipboardList, count: "12" },
];

interface TeacherWorkspaceProps {
  active: WorkspaceSection;
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function TeacherWorkspace({
  active,
  title,
  description,
  actions,
  children,
}: TeacherWorkspaceProps) {
  const { user, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [signOutMessage, setSignOutMessage] = useState("");
  const initials = user?.email?.slice(0, 1).toUpperCase() ?? teacherSampleProfile.name.slice(0, 1);

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    const { error } = await supabase.auth.signOut();
    if (error) {
      setSignOutMessage("You could not be signed out. Please try again.");
      return;
    }
    await navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="app-shell">
      <aside className="workspace-sidebar" aria-label="Teacher workspace">
        <Link to="/" className="workspace-brand" aria-label="LearnBridge overview">
          <span className="workspace-brand-mark">
            <GraduationCap aria-hidden="true" />
          </span>
          <span className="workspace-brand-copy">
            <strong>LearnBridge</strong>
            <small>Teaching workspace</small>
          </span>
        </Link>

        <div className="school-switcher" aria-label="Current school">
          <span className="school-avatar">G</span>
          <span className="school-details">
            <strong>{teacherSampleProfile.school}</strong>
            <small>{teacherSampleProfile.term}</small>
          </span>
        </div>

        <p className="sidebar-label">TEACHING</p>
        <nav className="workspace-nav" aria-label="Main navigation">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.id}
                to={item.to}
                className={`workspace-nav-link${active === item.id ? " is-active" : ""}`}
                aria-current={active === item.id ? "page" : undefined}
              >
                <Icon aria-hidden="true" />
                <span>{item.label}</span>
                {item.count ? <span className="nav-count">{item.count}</span> : null}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-help-mark">
            <CheckCheck aria-hidden="true" />
          </div>
          <p>Learning, connected.</p>
          <span>Sample workspace · 2026</span>
        </div>
      </aside>

      <div className="workspace-main">
        <header className="workspace-topbar">
          <Link to="/" className="mobile-brand" aria-label="LearnBridge overview">
            <span className="workspace-brand-mark">
              <GraduationCap aria-hidden="true" />
            </span>
            <strong>LearnBridge</strong>
          </Link>
          <div className="sample-status">
            <span className="sample-status-dot" />
            Sample data
          </div>
          <div className="topbar-actions">
            <div className="popover-anchor">
              <Button
                variant="ghost"
                size="icon"
                type="button"
                aria-label="Notifications"
                aria-expanded={notificationsOpen}
                aria-controls="teacher-notifications"
                onClick={() => setNotificationsOpen((open) => !open)}
              >
                <Bell aria-hidden="true" />
                <span className="notification-indicator" />
              </Button>
              {notificationsOpen ? (
                <section
                  className="topbar-popover"
                  id="teacher-notifications"
                  aria-label="Recent notifications"
                >
                  <div className="popover-heading">
                    <strong>Recent updates</strong>
                    <span>2 new</span>
                  </div>
                  <Link
                    to="/homework"
                    className="notification-row"
                    onClick={() => setNotificationsOpen(false)}
                  >
                    <span className="notification-symbol notification-symbol--amber">
                      <ClipboardList aria-hidden="true" />
                    </span>
                    <span>
                      <strong>Work to review</strong>
                      <small>12 submissions need marking</small>
                    </span>
                  </Link>
                  <Link
                    to="/timetable"
                    className="notification-row"
                    onClick={() => setNotificationsOpen(false)}
                  >
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
            {user ? (
              <div className="popover-anchor">
                <Button
                  variant="ghost"
                  className="account-trigger"
                  type="button"
                  aria-label="Account menu"
                  aria-expanded={accountOpen}
                  onClick={() => setAccountOpen((open) => !open)}
                >
                  <span className="account-avatar">{initials}</span>
                  <span className="account-email">{user.email ?? "Your account"}</span>
                </Button>
                {accountOpen ? (
                  <div
                    className="topbar-popover account-popover"
                    role="menu"
                    aria-label="Account options"
                  >
                    <Link to="/account" role="menuitem" onClick={() => setAccountOpen(false)}>
                      My profile
                    </Link>
                    <Button variant="ghost" type="button" role="menuitem" onClick={handleSignOut}>
                      <LogOut aria-hidden="true" /> Sign out
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : isLoading ? (
              <span className="auth-checking" role="status">
                Checking account…
              </span>
            ) : (
              <Button variant="outline" size="sm" asChild>
                <Link to="/auth">Sign in</Link>
              </Button>
            )}
          </div>
        </header>

        <main className="workspace-content">
          <div className="page-heading">
            <div>
              <p className="page-eyebrow">TEACHER DASHBOARD</p>
              <h1>{title}</h1>
              <p className="page-description">{description}</p>
            </div>
            {actions ? <div className="page-actions">{actions}</div> : null}
          </div>
          <div className="sample-notice">
            Sample workspace. Names, schedules, and progress are example data, not school records.
          </div>
          {signOutMessage ? (
            <p className="inline-error" role="alert">
              {signOutMessage}
            </p>
          ) : null}
          {children}
        </main>
      </div>

      <nav className="mobile-nav" aria-label="Main navigation">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.id}
              to={item.to}
              className={`mobile-nav-link${active === item.id ? " is-active" : ""}`}
              aria-current={active === item.id ? "page" : undefined}
            >
              <Icon aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
