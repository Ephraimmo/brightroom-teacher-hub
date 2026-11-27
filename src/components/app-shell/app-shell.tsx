import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  BookOpen,
  CalendarDays,
  CheckCheck,
  ClipboardList,
  GraduationCap,
  Home,
  LayoutDashboard,
  LogOut,
  ScrollText,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import {
  activeNavId,
  areaRoleForPath,
  navigationFor,
  orderedRoles,
  ROLE_AREAS,
  type NavIcon,
} from "@/domain/navigation";
import type { PlatformRole } from "@/domain/permissions";
import { useSignOut } from "@/hooks/use-sign-out";
import { useUserRoles } from "@/hooks/use-user-roles";

const NAV_ICONS: Record<NavIcon, LucideIcon> = {
  home: Home,
  overview: LayoutDashboard,
  classes: Users,
  timetable: CalendarDays,
  resources: BookOpen,
  homework: ClipboardList,
  people: UserCog,
  audit: ScrollText,
};

export interface AppShellProps {
  /** Whose menu to show. `null` shows the frame without a menu (no role yet). */
  role: PlatformRole | null;
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
  /** Extra items for the top bar, left of the account menu (e.g. sample notifications). */
  topbarExtras?: ReactNode;
  /** Sidebar block under the brand (e.g. the current school). */
  sidebarContext?: ReactNode;
  /** Marks the page as running on sample data, with a visible notice. */
  sampleNotice?: string;
  children: ReactNode;
}

/**
 * The signed-in workspace frame shared by every role: sidebar on desktop and
 * tablet, top bar, and a bottom tab bar on phones (see docs/design-system.md).
 */
export function AppShell({
  role,
  eyebrow,
  title,
  description,
  actions,
  topbarExtras,
  sidebarContext,
  sampleNotice,
  children,
}: AppShellProps) {
  const { user, isLoading } = useAuth();
  const rolesQuery = useUserRoles();
  const { signOut, error: signOutError } = useSignOut();
  const navigate = useNavigate();
  const pathname = useLocation({ select: (l) => l.pathname });
  const [accountOpen, setAccountOpen] = useState(false);

  const area = role ? ROLE_AREAS[role] : null;
  const items = role ? navigationFor(role) : [];
  const activeId = activeNavId(items, pathname);
  const homeHref = area?.base ?? "/";
  const myRoles = orderedRoles((rolesQuery.data ?? []).map((r) => r.role));
  const switcherValue = areaRoleForPath(pathname) ?? role ?? "";
  const initials = user?.email?.slice(0, 1).toUpperCase() ?? "?";

  return (
    <div className="app-shell">
      <aside className="workspace-sidebar" aria-label={area?.workspaceName ?? "LearnBridge"}>
        <Link to={homeHref} className="workspace-brand" aria-label="LearnBridge home">
          <span className="workspace-brand-mark">
            <GraduationCap aria-hidden="true" />
          </span>
          <span className="workspace-brand-copy">
            <strong>LearnBridge</strong>
            <small>{area?.workspaceName ?? "Your account"}</small>
          </span>
        </Link>

        {sidebarContext}

        {items.length > 0 ? (
          <>
            <p className="sidebar-label">MENU</p>
            <nav className="workspace-nav" aria-label="Main navigation">
              {items.map((item) => {
                const Icon = NAV_ICONS[item.icon];
                const active = item.id === activeId;
                return (
                  <Link
                    key={item.id}
                    to={item.to}
                    className={`workspace-nav-link${active ? " is-active" : ""}`}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon aria-hidden="true" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </>
        ) : null}

        <div className="sidebar-bottom">
          <div className="sidebar-help-mark">
            <CheckCheck aria-hidden="true" />
          </div>
          <p>Learning, connected.</p>
          {sampleNotice ? <span>Sample workspace · 2026</span> : null}
        </div>
      </aside>

      <div className="workspace-main">
        <header className="workspace-topbar">
          <Link to={homeHref} className="mobile-brand" aria-label="LearnBridge home">
            <span className="workspace-brand-mark">
              <GraduationCap aria-hidden="true" />
            </span>
            <strong>LearnBridge</strong>
          </Link>
          {sampleNotice ? (
            <div className="sample-status">
              <span className="sample-status-dot" />
              Sample data
            </div>
          ) : null}
          <div className="topbar-actions">
            {myRoles.length > 1 ? (
              <label className="role-switcher">
                <span className="sr-only">Switch role</span>
                <select
                  value={switcherValue}
                  onChange={(e) => {
                    const next = e.target.value as PlatformRole;
                    void navigate({ to: ROLE_AREAS[next].base });
                  }}
                >
                  {myRoles.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_AREAS[r].roleLabel}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {topbarExtras}
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
                    <Button variant="ghost" type="button" role="menuitem" onClick={signOut}>
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
              {eyebrow ? <p className="page-eyebrow">{eyebrow}</p> : null}
              <h1>{title}</h1>
              <p className="page-description">{description}</p>
            </div>
            {actions ? <div className="page-actions">{actions}</div> : null}
          </div>
          {sampleNotice ? <div className="sample-notice">{sampleNotice}</div> : null}
          {signOutError ? (
            <p className="inline-error" role="alert">
              {signOutError}
            </p>
          ) : null}
          {children}
        </main>
      </div>

      {items.length > 1 ? (
        <nav
          className="mobile-nav"
          aria-label="Main navigation"
          style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
        >
          {items.map((item) => {
            const Icon = NAV_ICONS[item.icon];
            const active = item.id === activeId;
            return (
              <Link
                key={item.id}
                to={item.to}
                className={`mobile-nav-link${active ? " is-active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                <Icon aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      ) : null}
    </div>
  );
}
