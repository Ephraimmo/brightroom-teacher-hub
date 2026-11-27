/**
 * Which area of the app each role works in, and what its menu contains.
 * Follows docs/plan/04-pages-navigation.md.
 *
 * Menus only list pages that exist today; each later tracker task adds its
 * pages here. Hiding a page from the menu is a convenience, not security:
 * the area guard and, finally, the database decide what a user can open.
 */
import type { PlatformRole } from "./permissions";

export type AreaPath = "/admin" | "/school" | "/teach" | "/learn" | "/family";

export interface RoleArea {
  role: PlatformRole;
  base: AreaPath;
  /** Short name used in the role switcher. */
  roleLabel: string;
  /** Shown under the LearnBridge name in the sidebar. */
  workspaceName: string;
}

export type NavIcon =
  | "home"
  | "overview"
  | "classes"
  | "timetable"
  | "resources"
  | "homework"
  | "people"
  | "audit"
  | "schools"
  | "settings";

export interface NavItem {
  id: string;
  label: string;
  to: string;
  icon: NavIcon;
}

export const ROLE_AREAS: Record<PlatformRole, RoleArea> = {
  platform_admin: {
    role: "platform_admin",
    base: "/admin",
    roleLabel: "Platform admin",
    workspaceName: "Platform administration",
  },
  school_admin: {
    role: "school_admin",
    base: "/school",
    roleLabel: "School admin",
    workspaceName: "School administration",
  },
  teacher: {
    role: "teacher",
    base: "/teach",
    roleLabel: "Teacher",
    workspaceName: "Teaching workspace",
  },
  learner: {
    role: "learner",
    base: "/learn",
    roleLabel: "Learner",
    workspaceName: "My learning",
  },
  parent: {
    role: "parent",
    base: "/family",
    roleLabel: "Parent",
    workspaceName: "My family",
  },
};

/** When a user has several roles, `/` opens the first of these they hold. */
export const ROLE_PRIORITY: readonly PlatformRole[] = [
  "platform_admin",
  "school_admin",
  "teacher",
  "parent",
  "learner",
];

const NAVIGATION: Record<PlatformRole, NavItem[]> = {
  teacher: [
    { id: "overview", label: "Overview", to: "/teach", icon: "overview" },
    { id: "classes", label: "My classes", to: "/teach/classes", icon: "classes" },
    { id: "timetable", label: "Timetable", to: "/teach/timetable", icon: "timetable" },
    { id: "resources", label: "Resources", to: "/teach/resources", icon: "resources" },
    { id: "homework", label: "Homework & tests", to: "/teach/homework", icon: "homework" },
  ],
  // The other areas get their pages in P4-01 (admin), P4-02 (school),
  // P4-04 (learner) and P4-05 (parent).
  platform_admin: [
    { id: "home", label: "Home", to: "/admin", icon: "home" },
    { id: "schools", label: "Schools", to: "/admin/institutions", icon: "schools" },
    { id: "people", label: "People", to: "/admin/people", icon: "people" },
    { id: "audit", label: "Audit log", to: "/admin/audit", icon: "audit" },
  ],
  school_admin: [
    { id: "home", label: "Home", to: "/school", icon: "home" },
    { id: "staff", label: "Staff", to: "/school/staff", icon: "people" },
    { id: "parents", label: "Parents", to: "/school/parents", icon: "classes" },
    { id: "settings", label: "Settings", to: "/school/settings", icon: "settings" },
  ],
  learner: [{ id: "home", label: "Home", to: "/learn", icon: "home" }],
  parent: [{ id: "home", label: "Home", to: "/family", icon: "home" }],
};

export function navigationFor(role: PlatformRole): readonly NavItem[] {
  return NAVIGATION[role];
}

/** The role held by the user whose area this path is in, or null if it's not in a role area. */
export function areaRoleForPath(pathname: string): PlatformRole | null {
  for (const area of Object.values(ROLE_AREAS)) {
    if (pathname === area.base || pathname.startsWith(`${area.base}/`)) return area.role;
  }
  return null;
}

/** Sort roles by ROLE_PRIORITY and drop duplicates. */
export function orderedRoles(roles: readonly PlatformRole[]): PlatformRole[] {
  return ROLE_PRIORITY.filter((r) => roles.includes(r));
}

/** Where `/` should send a signed-in user. */
export function homePathFor(roles: readonly PlatformRole[]): AreaPath | "/access-pending" {
  const [primary] = orderedRoles(roles);
  return primary ? ROLE_AREAS[primary].base : "/access-pending";
}

export type AreaAccess = "allowed" | "no-role" | "wrong-role";

/** Whether a signed-in user with these roles may open a role area. */
export function areaAccess(roles: readonly PlatformRole[], areaRole: PlatformRole): AreaAccess {
  if (roles.length === 0) return "no-role";
  return roles.includes(areaRole) ? "allowed" : "wrong-role";
}

/** The menu item to highlight for a path: the longest matching `to`. */
export function activeNavId(items: readonly NavItem[], pathname: string): string | undefined {
  let best: NavItem | undefined;
  for (const item of items) {
    const matches = pathname === item.to || pathname.startsWith(`${item.to}/`);
    if (matches && (!best || item.to.length > best.to.length)) best = item;
  }
  return best?.id;
}
