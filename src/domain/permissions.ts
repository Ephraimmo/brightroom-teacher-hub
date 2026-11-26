/**
 * Role → capability map behind docs/plan/03-permissions.md.
 *
 * This decides what the screens offer. The database (row-level security and
 * checked procedures) remains the final gatekeeper and re-checks every rule.
 */
export type PlatformRole = "platform_admin" | "school_admin" | "teacher" | "learner" | "parent";

/**
 * How far a role's permission reaches:
 * - all: anything on the platform
 * - institution: records of an institution the user administers or works in
 * - assigned_classes: learners in class subjects the teacher is assigned to
 * - self: the learner's own records
 * - linked_children: learners the parent is actively linked to
 */
export type PermissionScope =
  "all" | "institution" | "assigned_classes" | "self" | "linked_children";

export type Capability =
  | "institution.register"
  | "institution.suspend"
  | "institution.edit"
  | "plans.configure"
  | "revenue.view"
  | "audit.view"
  | "staff.manage"
  | "learner.register"
  | "learner.view"
  | "learner.edit"
  | "learner.move"
  | "learner.suspend"
  | "learner.issue_login"
  | "guardian.issue_link_code"
  | "guardian.link_child"
  | "classes.manage"
  | "attendance.view"
  | "attendance.mark"
  | "lesson.run"
  | "lesson.join"
  | "subscription.view"
  | "subscription.manage"
  | "payment.upload_proof"
  | "payment.verify"
  | "payment.refund"
  | "results.view";

type CapabilityMap = Record<Capability, Partial<Record<PlatformRole, PermissionScope>>>;

const capabilities: CapabilityMap = {
  "institution.register": { platform_admin: "all" },
  "institution.suspend": { platform_admin: "all" },
  "institution.edit": { platform_admin: "all", school_admin: "institution" },
  "plans.configure": { platform_admin: "all", school_admin: "institution" },
  "revenue.view": { platform_admin: "all", school_admin: "institution" },
  "audit.view": { platform_admin: "all", school_admin: "institution" },
  "staff.manage": { platform_admin: "all", school_admin: "institution" },
  "learner.register": {
    platform_admin: "all",
    school_admin: "institution",
    parent: "linked_children",
  },
  "learner.view": {
    platform_admin: "all",
    school_admin: "institution",
    teacher: "assigned_classes",
    learner: "self",
    parent: "linked_children",
  },
  "learner.edit": {
    platform_admin: "all",
    school_admin: "institution",
    learner: "self",
    parent: "linked_children",
  },
  "learner.move": { platform_admin: "all", school_admin: "institution" },
  "learner.suspend": {
    platform_admin: "all",
    school_admin: "institution",
    parent: "linked_children",
  },
  "learner.issue_login": {
    platform_admin: "all",
    school_admin: "institution",
    parent: "linked_children",
  },
  "guardian.issue_link_code": { platform_admin: "all", school_admin: "institution" },
  // No link exists yet when a parent links a child (or registers an independent learner),
  // so check these two with hasCapability(); the single-use code is verified in the database.
  "guardian.link_child": { parent: "linked_children" },
  "classes.manage": { platform_admin: "all", school_admin: "institution" },
  "attendance.view": {
    platform_admin: "all",
    school_admin: "institution",
    teacher: "assigned_classes",
    learner: "self",
    parent: "linked_children",
  },
  "attendance.mark": { teacher: "assigned_classes" },
  "lesson.run": { teacher: "assigned_classes" },
  "lesson.join": { teacher: "assigned_classes", learner: "self" },
  "subscription.view": {
    platform_admin: "all",
    school_admin: "institution",
    learner: "self",
    parent: "linked_children",
  },
  "subscription.manage": { parent: "linked_children" },
  "payment.upload_proof": { parent: "linked_children" },
  "payment.verify": { platform_admin: "all", school_admin: "institution" },
  "payment.refund": { platform_admin: "all" },
  "results.view": {
    platform_admin: "all",
    school_admin: "institution",
    teacher: "assigned_classes",
    learner: "self",
    parent: "linked_children",
  },
};

export function scopeFor(role: PlatformRole, capability: Capability): PermissionScope | null {
  return capabilities[capability][role] ?? null;
}

/**
 * Facts about how the acting user relates to the record in question.
 * Leave a fact out (or false) when it does not hold.
 */
export interface RelationshipFacts {
  /** The record belongs to an institution where the user holds this role. */
  sameInstitution?: boolean;
  /** The learner is in a class subject the teacher is assigned to. */
  teachesLearner?: boolean;
  /** The learner record is the user's own. */
  isSelf?: boolean;
  /** The user is an active guardian of the learner. */
  isActiveGuardian?: boolean;
}

function scopeIsSatisfied(scope: PermissionScope, facts: RelationshipFacts): boolean {
  switch (scope) {
    case "all":
      return true;
    case "institution":
      return facts.sameInstitution === true;
    case "assigned_classes":
      return facts.teachesLearner === true;
    case "self":
      return facts.isSelf === true;
    case "linked_children":
      return facts.isActiveGuardian === true;
  }
}

/** True when any of the user's roles grants the capability for this record. */
export function can(
  roles: readonly PlatformRole[],
  capability: Capability,
  facts: RelationshipFacts = {},
): boolean {
  return roles.some((role) => {
    const scope = scopeFor(role, capability);
    return scope !== null && scopeIsSatisfied(scope, facts);
  });
}

/** True when any role has the capability at all: used to decide which menus to show. */
export function hasCapability(roles: readonly PlatformRole[], capability: Capability): boolean {
  return roles.some((role) => scopeFor(role, capability) !== null);
}
