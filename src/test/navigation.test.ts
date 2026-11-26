import { QueryClient } from "@tanstack/react-query";
import { createMemoryHistory, createRouter } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import {
  activeNavId,
  areaAccess,
  areaRoleForPath,
  homePathFor,
  navigationFor,
  orderedRoles,
  ROLE_AREAS,
} from "@/domain/navigation";
import type { PlatformRole } from "@/domain/permissions";
import { routeTree } from "@/routeTree.gen";

const ALL_ROLES: PlatformRole[] = [
  "platform_admin",
  "school_admin",
  "teacher",
  "learner",
  "parent",
];

describe("navigation for each role", () => {
  it("only links inside the role's own area", () => {
    for (const role of ALL_ROLES) {
      const base = ROLE_AREAS[role].base;
      for (const item of navigationFor(role)) {
        expect(item.to === base || item.to.startsWith(`${base}/`)).toBe(true);
      }
    }
  });

  it("never shows a teacher page to another role", () => {
    for (const role of ALL_ROLES.filter((r) => r !== "teacher")) {
      expect(navigationFor(role).some((i) => i.to.startsWith("/teach"))).toBe(false);
    }
  });

  it("keeps phone navigation to five tabs or fewer", () => {
    for (const role of ALL_ROLES) expect(navigationFor(role).length).toBeLessThanOrEqual(5);
  });

  it("only links to pages that exist", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    for (const role of ALL_ROLES) {
      for (const item of navigationFor(role)) {
        const leaf = router.matchRoutes(item.to).at(-1);
        expect(leaf?.routeId, `${role} → ${item.to}`).not.toBe("__root__");
        expect(leaf?.pathname.replace(/\/$/, ""), `${role} → ${item.to}`).toBe(item.to);
      }
    }
  });
});

describe("where people land", () => {
  it("sends a user with no role to the waiting page", () => {
    expect(homePathFor([])).toBe("/access-pending");
  });

  it("sends each single role to its own area", () => {
    expect(homePathFor(["teacher"])).toBe("/teach");
    expect(homePathFor(["learner"])).toBe("/learn");
    expect(homePathFor(["parent"])).toBe("/family");
    expect(homePathFor(["school_admin"])).toBe("/school");
    expect(homePathFor(["platform_admin"])).toBe("/admin");
  });

  it("prefers the more senior role when someone has several", () => {
    expect(homePathFor(["parent", "teacher"])).toBe("/teach");
    expect(homePathFor(["teacher", "school_admin"])).toBe("/school");
    expect(orderedRoles(["learner", "parent", "learner"])).toEqual(["parent", "learner"]);
  });
});

describe("area access", () => {
  it("allows only users who hold the area's role", () => {
    expect(areaAccess(["teacher"], "teacher")).toBe("allowed");
    expect(areaAccess(["parent", "teacher"], "teacher")).toBe("allowed");
    expect(areaAccess(["learner"], "teacher")).toBe("wrong-role");
    expect(areaAccess(["teacher"], "platform_admin")).toBe("wrong-role");
    expect(areaAccess([], "learner")).toBe("no-role");
  });

  it("works out the area from an address", () => {
    expect(areaRoleForPath("/teach/classes")).toBe("teacher");
    expect(areaRoleForPath("/family")).toBe("parent");
    expect(areaRoleForPath("/teacher-tips")).toBeNull();
    expect(areaRoleForPath("/account")).toBeNull();
  });
});

describe("active menu item", () => {
  const items = navigationFor("teacher");

  it("highlights the most specific match", () => {
    expect(activeNavId(items, "/teach")).toBe("overview");
    expect(activeNavId(items, "/teach/classes")).toBe("classes");
    expect(activeNavId(items, "/teach/homework/123")).toBe("homework");
  });

  it("highlights nothing outside the menu", () => {
    expect(activeNavId(items, "/account")).toBeUndefined();
  });
});

describe("old teacher addresses", () => {
  it.each([
    ["/classes", "/teach/classes"],
    ["/timetable", "/teach/timetable"],
    ["/resources", "/teach/resources"],
    ["/homework", "/teach/homework"],
  ])("%s redirects to %s", async (from, to) => {
    const router = createRouter({
      routeTree,
      context: { queryClient: new QueryClient() },
      history: createMemoryHistory({ initialEntries: [from] }),
    });
    await router.load();
    expect(router.state.location.pathname).toBe(to);
  });
});
