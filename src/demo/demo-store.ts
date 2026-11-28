/**
 * Demo mode's stand-in for the database. Each function mirrors one in
 * src/lib, with the same arguments and results, and applies the main rules of
 * the db/pending SQL (who may do what, required reasons, duplicates, error
 * codes) so the screens behave as they will for real.
 *
 * Changes are kept in this tab's sessionStorage until "Reset demo data" or
 * the tab closes. Nothing is ever sent to the server.
 */
import type { AccountStatus } from "@/domain/account-status";
import type { AuditEntry } from "@/domain/audit";
import { validateGuardian, type GuardianField, type GuardianForm } from "@/domain/guardians";
import type { MfaInfo } from "@/hooks/use-mfa";
import type { PlatformRole } from "@/domain/permissions";
import { normalizeSaMobile, validateProfile, type ProfileForm } from "@/domain/profile";
import {
  groupPeriods,
  validateTerm,
  validateYear,
  type AcademicYear,
  type PeriodRow,
  type Policies,
  type TermForm,
  type YearForm,
} from "@/domain/school-settings";
import {
  isEmail,
  normalizeSaPhone,
  validateSchool,
  type InstitutionStatus,
  type MembershipRole,
  type SchoolForm,
} from "@/domain/schools";
import type { FoundUser, RoleChange } from "@/lib/admin-people";
import type { AuditQuery } from "@/lib/admin-audit";
import type { Guardian, GuardianInvitation } from "@/lib/guardians";
import type { MyProfile } from "@/lib/profile-service";
import type { SchoolDetailsForm, SchoolSettings, GradeLevel } from "@/lib/school-settings";
import type { Institution, MyInvitation, MySchool } from "@/lib/schools";
import type { OpenInvitation, StaffMember } from "@/lib/staff";

import {
  createDemoSeed,
  DEMO_GRADE_LEVELS,
  type DemoAuditEntry,
  type DemoGuardian,
  type DemoState,
  type DemoUser,
} from "./demo-data";
import { demoUserId } from "./demo-session";

const DATA_KEY = "learnbridge.demo.data";
const AUDIT_PAGE_SIZE = 50;

// ---------------------------------------------------------------------------
// State

let cache: DemoState | null = null;

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

function state(): DemoState {
  if (cache) return cache;
  const raw = storage()?.getItem(DATA_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as DemoState;
      if (parsed.version === 1) return (cache = parsed);
    } catch {
      // Unreadable: start again from the sample data.
    }
  }
  cache = createDemoSeed();
  return cache;
}

function save() {
  try {
    storage()?.setItem(DATA_KEY, JSON.stringify(state()));
  } catch {
    // Storage full or blocked: changes last until the page reloads.
  }
}

/** Put the sample data back as it started. */
export function resetDemoData(): void {
  cache = createDemoSeed();
  avatarUrls.clear();
  save();
}

/** Drop the in-memory copy, so the next read comes from sessionStorage (as after a reload). */
export function reloadDemoData(): void {
  cache = null;
}

/** Forget demo changes (when leaving demo mode). */
export function clearDemoData(): void {
  cache = null;
  avatarUrls.clear();
  storage()?.removeItem(DATA_KEY);
}

/** Run a change and save it. */
function change<T>(fn: (s: DemoState) => T): T {
  const result = fn(state());
  save();
  return result;
}

const read = <T>(fn: (s: DemoState) => T): T => fn(state());

// ---------------------------------------------------------------------------
// Errors shaped like the database's (code, message, hint)

function fail(code: string, message: string, hint?: string): never {
  throw Object.assign(new Error(message), { code, ...(hint ? { hint } : {}) });
}
const notAllowed = () => fail("42501", "permission denied");
const notFound = () => fail("LBR03", "Not found");
function needReason(reason: string) {
  if (!reason.trim()) fail("LBR02", "A reason is required");
}

// ---------------------------------------------------------------------------
// Who is acting

function me(s: DemoState): DemoUser {
  const id = demoUserId();
  return s.users.find((u) => u.id === id) ?? notAllowed();
}

const isActive = (u: DemoUser) => u.accountStatus === "active";
const isPlatformAdmin = (u: DemoUser) => isActive(u) && u.globalRoles.includes("platform_admin");

function requirePlatform(s: DemoState): DemoUser {
  const u = me(s);
  return isPlatformAdmin(u) ? u : notAllowed();
}

function schoolRoleOf(s: DemoState, u: DemoUser, institutionId: string): MembershipRole | null {
  if (!isActive(u)) return null;
  const school = s.schools.find((x) => x.id === institutionId);
  if (school?.status !== "active") return null;
  const membership = s.memberships.find(
    (m) => m.institutionId === institutionId && m.userId === u.id && m.status === "active",
  );
  return membership?.role ?? null;
}

/** A platform admin or this school's admin; returns how they're acting. */
function requireSchoolAdmin(s: DemoState, institutionId: string) {
  const u = me(s);
  if (isPlatformAdmin(u)) return { u, actorRole: "platform_admin" };
  if (schoolRoleOf(s, u, institutionId) === "school_admin") return { u, actorRole: "school_admin" };
  return notAllowed();
}

function requireMember(s: DemoState, institutionId: string): DemoUser {
  const u = me(s);
  if (isPlatformAdmin(u) || schoolRoleOf(s, u, institutionId)) return u;
  return notAllowed();
}

function log(
  s: DemoState,
  actor: { u: DemoUser; actorRole: string },
  entry: Omit<DemoAuditEntry, "id" | "occurredAt" | "actorEmail" | "actorRole">,
) {
  const id = s.audit.reduce((max, e) => Math.max(max, e.id), 0) + 1;
  s.audit.push({
    ...entry,
    id,
    occurredAt: new Date().toISOString(),
    actorEmail: actor.u.email,
    actorRole: actor.actorRole,
  });
}

function newId(s: DemoState, kind: string): string {
  s.nextId += 1;
  return `demo-${kind}-${s.nextId}`;
}

const emailOf = (s: DemoState, userId: string | null) =>
  s.users.find((u) => u.id === userId)?.email ?? null;

// ---------------------------------------------------------------------------
// The signed-in demo person

export const demoUser = () =>
  read((s) => {
    const u = s.users.find((x) => x.id === demoUserId());
    return u ? { id: u.id, email: u.email } : null;
  });

/** my_roles(): direct roles, school roles and claimed parent records. */
export const myRoles = async (): Promise<PlatformRole[]> =>
  read((s) => {
    const u = me(s);
    if (!isActive(u)) return [];
    const roles = new Set<PlatformRole>(u.globalRoles);
    for (const m of s.memberships) {
      if (m.userId === u.id && schoolRoleOf(s, u, m.institutionId) === m.role) roles.add(m.role);
    }
    const parent = s.guardians.some(
      (g) =>
        g.userId === u.id &&
        g.status === "active" &&
        s.schools.find((x) => x.id === g.institutionId)?.status === "active",
    );
    if (parent) roles.add("parent");
    return [...roles];
  });

export const myAccountStatus = async (): Promise<AccountStatus> => read((s) => me(s).accountStatus);

/** Demo accounts count as already past two-step sign-in. */
export const myMfa = async (): Promise<MfaInfo> =>
  read((s) => {
    const count = Math.max(me(s).mfaFactors, 1);
    return {
      currentLevel: "aal2",
      nextLevel: "aal2",
      verifiedFactors: count,
      factors: Array.from({ length: count }, (_, i) => ({
        id: `demo-factor-${i + 1}`,
        friendlyName: i === 0 ? "Authenticator app (demo)" : "Backup authenticator (demo)",
        createdAt: "2026-01-10T08:00:00Z",
      })),
    };
  });

// ---------------------------------------------------------------------------
// Admin → People (P2-03, P2-05, P2-06)

export const findUserByEmail = async (email: string): Promise<FoundUser | null> =>
  read((s) => {
    requirePlatform(s);
    const target = s.users.find((u) => u.email === email.trim().toLowerCase());
    return target
      ? {
          userId: target.id,
          email: target.email,
          fullName: target.fullName,
          roles: [...target.globalRoles],
        }
      : null;
  });

export const grantRole = async ({ userId, role, reason }: RoleChange): Promise<boolean> =>
  change((s) => {
    const u = requirePlatform(s);
    needReason(reason);
    const target = s.users.find((x) => x.id === userId) ?? notFound();
    if (target.globalRoles.includes(role)) return false;
    target.globalRoles.push(role);
    log(
      s,
      { u, actorRole: "platform_admin" },
      {
        action: "role.grant",
        entityType: "user",
        entityId: userId,
        targetEmail: target.email,
        before: null,
        after: { role },
        reason: reason.trim(),
        institutionId: null,
      },
    );
    return true;
  });

export const revokeRole = async ({ userId, role, reason }: RoleChange): Promise<boolean> =>
  change((s) => {
    const u = requirePlatform(s);
    needReason(reason);
    if (userId === u.id && role === "platform_admin") {
      fail("LBR01", "You can't remove your own platform administrator role");
    }
    const target = s.users.find((x) => x.id === userId) ?? notFound();
    if (!target.globalRoles.includes(role)) return false;
    target.globalRoles = target.globalRoles.filter((r) => r !== role);
    log(
      s,
      { u, actorRole: "platform_admin" },
      {
        action: "role.revoke",
        entityType: "user",
        entityId: userId,
        targetEmail: target.email,
        before: { role },
        after: null,
        reason: reason.trim(),
        institutionId: null,
      },
    );
    return true;
  });

export const getAccountStatus = async (userId: string): Promise<AccountStatus> =>
  read((s) => {
    requirePlatform(s);
    return s.users.find((x) => x.id === userId)?.accountStatus ?? "active";
  });

const STATUS_ACTIONS: Record<AccountStatus, string> = {
  active: "account.reactivate",
  suspended: "account.suspend",
  deactivated: "account.deactivate",
};

export const setAccountStatus = async (
  userId: string,
  status: AccountStatus,
  reason: string,
): Promise<boolean> =>
  change((s) => {
    const u = requirePlatform(s);
    needReason(reason);
    if (userId === u.id) fail("LBR20", "You can't change your own account");
    const target = s.users.find((x) => x.id === userId) ?? notFound();
    if (target.accountStatus === status) return false;
    const before = target.accountStatus;
    target.accountStatus = status;
    log(
      s,
      { u, actorRole: "platform_admin" },
      {
        action: STATUS_ACTIONS[status],
        entityType: "user",
        entityId: userId,
        targetEmail: target.email,
        before: { status: before },
        after: { status },
        reason: reason.trim(),
        institutionId: null,
      },
    );
    return true;
  });

export const getMfaFactorCount = async (userId: string): Promise<number> =>
  read((s) => {
    requirePlatform(s);
    return s.users.find((x) => x.id === userId)?.mfaFactors ?? 0;
  });

export const resetMfa = async (userId: string, reason: string): Promise<number> =>
  change((s) => {
    const u = requirePlatform(s);
    needReason(reason);
    if (userId === u.id) fail("LBR20", "You can't reset your own two-step sign-in");
    const target = s.users.find((x) => x.id === userId) ?? notFound();
    const removed = target.mfaFactors;
    target.mfaFactors = 0;
    log(
      s,
      { u, actorRole: "platform_admin" },
      {
        action: "mfa.reset",
        entityType: "user",
        entityId: userId,
        targetEmail: target.email,
        before: { factors: removed },
        after: { factors: 0 },
        reason: reason.trim(),
        institutionId: null,
      },
    );
    return removed;
  });

// ---------------------------------------------------------------------------
// Admin → Audit log (P2-05)

export const loadAuditPage = async ({
  group,
  userId,
  beforeId,
}: AuditQuery): Promise<AuditEntry[]> =>
  read((s) => {
    requirePlatform(s);
    const email = emailOf(s, userId);
    return s.audit
      .filter((e) => !group || e.action.startsWith(group))
      .filter(
        (e) =>
          !userId || e.entityId === userId || e.actorEmail === email || e.targetEmail === email,
      )
      .filter((e) => beforeId === null || e.id < beforeId)
      .sort((a, b) => b.id - a.id)
      .slice(0, AUDIT_PAGE_SIZE)
      .map(({ institutionId: _school, ...entry }) => entry);
  });

// ---------------------------------------------------------------------------
// My profile (P2-04)

/** Photos chosen in the demo live only in this page's memory. */
const avatarUrls = new Map<string, string>();

export const loadMyProfile = async (): Promise<MyProfile> =>
  read((s) => {
    const u = me(s);
    return {
      fullName: u.fullName,
      displayName: u.displayName,
      phone: u.phone ?? "",
      language: u.language,
      contactEmail: u.contactEmail,
      contactSms: u.contactSms,
      contactWhatsapp: u.contactWhatsapp,
      avatarPath: u.avatarPath,
      extended: true,
    };
  });

const PROFILE_HINTS: Record<string, [code: string, column: string]> = {
  fullName: ["LBR10", "full_name"],
  displayName: ["LBR11", "display_name"],
  phone: ["LBR12", "phone"],
  language: ["LBR13", "preferred_language"],
  contact: ["LBR14", "contact"],
};

export const saveMyProfile = async (form: ProfileForm): Promise<boolean> =>
  change((s) => {
    const u = me(s);
    const problem = Object.keys(validateProfile(form))[0];
    if (problem) {
      const [code, hint] = PROFILE_HINTS[problem] ?? ["LBR10", problem];
      fail(code, "Invalid profile", hint);
    }
    const next = {
      full_name: form.fullName.trim(),
      display_name: form.displayName.trim(),
      phone: form.phone.trim() ? normalizeSaMobile(form.phone) : null,
      preferred_language: form.language,
      contact_email: form.contactEmail,
      contact_sms: form.contactSms,
      contact_whatsapp: form.contactWhatsapp,
    };
    const now = {
      full_name: u.fullName,
      display_name: u.displayName,
      phone: u.phone,
      preferred_language: u.language,
      contact_email: u.contactEmail,
      contact_sms: u.contactSms,
      contact_whatsapp: u.contactWhatsapp,
    };
    const fields = (Object.keys(next) as (keyof typeof next)[]).filter((k) => next[k] !== now[k]);
    if (fields.length === 0) return false;
    Object.assign(u, {
      fullName: next.full_name,
      displayName: next.display_name,
      phone: next.phone,
      language: next.preferred_language,
      contactEmail: next.contact_email,
      contactSms: next.contact_sms,
      contactWhatsapp: next.contact_whatsapp,
    });
    log(
      s,
      { u, actorRole: "self" },
      {
        action: "profile.update",
        entityType: "profile",
        entityId: u.id,
        targetEmail: u.email,
        before: null,
        after: { fields },
        reason: null,
        institutionId: null,
      },
    );
    return true;
  });

export const replaceMyAvatar = async (file: File): Promise<string> =>
  change((s) => {
    const u = me(s);
    const path = `${u.id}/${Date.now()}`;
    if (typeof URL.createObjectURL === "function") {
      avatarUrls.set(path, URL.createObjectURL(file));
    }
    u.avatarPath = path;
    log(
      s,
      { u, actorRole: "self" },
      {
        action: "profile.photo_set",
        entityType: "profile",
        entityId: u.id,
        targetEmail: u.email,
        before: null,
        after: null,
        reason: null,
        institutionId: null,
      },
    );
    return path;
  });

export const removeMyAvatar = async (): Promise<void> =>
  change((s) => {
    const u = me(s);
    u.avatarPath = null;
    log(
      s,
      { u, actorRole: "self" },
      {
        action: "profile.photo_remove",
        entityType: "profile",
        entityId: u.id,
        targetEmail: u.email,
        before: null,
        after: null,
        reason: null,
        institutionId: null,
      },
    );
  });

/** The chosen photo, or the person's initials if the page was reloaded since. */
export const avatarLink = async (path: string): Promise<string> =>
  read((s) => {
    const url = avatarUrls.get(path);
    if (url) return url;
    const initials = me(s)
      .fullName.split(" ")
      .map((w) => w[0] ?? "")
      .join("")
      .slice(0, 2);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" fill="#dbeafe"/><text x="48" y="58" font-family="sans-serif" font-size="36" text-anchor="middle" fill="#1e3a8a">${initials}</text></svg>`;
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
  });

// ---------------------------------------------------------------------------
// Schools and invitations (P3-01)

export const listInstitutions = async (): Promise<Institution[]> =>
  read((s) => {
    const u = me(s);
    return s.schools
      .filter((x) => isPlatformAdmin(u) || schoolRoleOf(s, u, x.id))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((x) => ({
        id: x.id,
        name: x.name,
        type: x.type,
        status: x.status,
        emisNumber: x.emisNumber,
        province: x.province,
        contactEmail: x.contactEmail,
        contactPhone: x.contactPhone,
        createdAt: x.createdAt,
      }));
  });

const SCHOOL_HINTS: Record<string, string> = {
  name: "name",
  type: "type",
  province: "province",
  emisNumber: "emis_number",
  contactEmail: "contact_email",
  contactPhone: "contact_phone",
  firstAdminEmail: "first_admin_email",
};

const inTwoWeeks = () => new Date(Date.now() + 14 * 86_400_000).toISOString();

export const registerInstitution = async (form: SchoolForm, reason: string): Promise<string> =>
  change((s) => {
    const u = requirePlatform(s);
    needReason(reason);
    const problem = Object.keys(validateSchool(form))[0];
    if (problem) fail("LBR30", "Invalid school details", SCHOOL_HINTS[problem] ?? problem);
    const emis = form.emisNumber.trim() || null;
    if (emis && s.schools.some((x) => x.emisNumber === emis)) {
      fail("23505", "duplicate key value violates unique constraint");
    }
    const id = newId(s, "school");
    const phone = form.contactPhone.trim();
    s.schools.push({
      id,
      name: form.name.trim(),
      type: form.type,
      status: "active",
      emisNumber: emis,
      province: form.province || null,
      district: null,
      address: null,
      contactEmail: form.contactEmail.trim().toLowerCase() || null,
      contactPhone: phone ? normalizeSaPhone(phone) : null,
      createdAt: new Date().toISOString(),
      policies: {},
      grades: [],
    });
    const adminEmail = form.firstAdminEmail.trim().toLowerCase();
    s.invitations.push({
      id: newId(s, "invite"),
      institutionId: id,
      email: adminEmail,
      role: "school_admin",
      title: null,
      expiresAt: inTwoWeeks(),
      status: "open",
    });
    log(
      s,
      { u, actorRole: "platform_admin" },
      {
        action: "institution.register",
        entityType: "institution",
        entityId: id,
        targetEmail: adminEmail,
        before: null,
        after: { name: form.name.trim() },
        reason: reason.trim(),
        institutionId: id,
      },
    );
    return id;
  });

export const setInstitutionStatus = async (
  institutionId: string,
  status: InstitutionStatus,
  reason: string,
): Promise<boolean> =>
  change((s) => {
    const u = requirePlatform(s);
    needReason(reason);
    const school = s.schools.find((x) => x.id === institutionId) ?? notFound();
    if (school.status === status) return false;
    const before = school.status;
    school.status = status;
    log(
      s,
      { u, actorRole: "platform_admin" },
      {
        action: "institution.status",
        entityType: "institution",
        entityId: institutionId,
        targetEmail: null,
        before: { status: before },
        after: { status },
        reason: reason.trim(),
        institutionId,
      },
    );
    return true;
  });

export const myInstitutions = async (): Promise<MySchool[]> =>
  read((s) => {
    const u = me(s);
    return s.memberships
      .filter((m) => m.userId === u.id && schoolRoleOf(s, u, m.institutionId) === m.role)
      .map((m) => ({
        institutionId: m.institutionId,
        name: s.schools.find((x) => x.id === m.institutionId)?.name ?? "",
        role: m.role,
        title: m.title,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  });

const isOpen = (i: { status: string; expiresAt: string }) =>
  i.status === "open" && i.expiresAt > new Date().toISOString();

export const myInvitations = async (): Promise<MyInvitation[]> =>
  read((s) => {
    const u = me(s);
    if (!isActive(u)) return [];
    return s.invitations
      .filter(
        (i) =>
          isOpen(i) &&
          i.email === u.email &&
          s.schools.find((x) => x.id === i.institutionId)?.status === "active",
      )
      .map((i) => ({
        id: i.id,
        institutionName: s.schools.find((x) => x.id === i.institutionId)?.name ?? "",
        role: i.role,
        title: i.title,
        expiresAt: i.expiresAt,
      }));
  });

export const acceptInvitation = async (id: string): Promise<void> =>
  change((s) => {
    const u = me(s);
    const invitation = s.invitations.find((i) => i.id === id);
    if (!invitation || !isOpen(invitation) || invitation.email !== u.email || !isActive(u)) {
      fail("LBR35", "This invitation can't be used");
    }
    const existing = s.memberships.find(
      (m) => m.institutionId === invitation.institutionId && m.userId === u.id,
    );
    if (existing?.status === "active" && existing.role === invitation.role) {
      fail("LBR36", "Already a member");
    }
    if (existing) {
      Object.assign(existing, { role: invitation.role, status: "active", title: invitation.title });
    } else {
      s.memberships.push({
        id: newId(s, "member"),
        institutionId: invitation.institutionId,
        userId: u.id,
        role: invitation.role,
        status: "active",
        title: invitation.title,
        grades: [],
      });
    }
    invitation.status = "accepted";
    log(
      s,
      { u, actorRole: "self" },
      {
        action: "invitation.accept",
        entityType: "invitation",
        entityId: id,
        targetEmail: u.email,
        before: null,
        after: { role: invitation.role },
        reason: null,
        institutionId: invitation.institutionId,
      },
    );
  });

export const createInvitation = async (
  institutionId: string,
  email: string,
  role: MembershipRole,
  title: string | null,
): Promise<string> =>
  change((s) => {
    const actor = requireSchoolAdmin(s, institutionId);
    const address = email.trim().toLowerCase();
    if (!isEmail(address)) fail("LBR30", "Invalid email", "email");
    const invitee = s.users.find((x) => x.email === address);
    const member =
      invitee &&
      s.memberships.find(
        (m) =>
          m.institutionId === institutionId &&
          m.userId === invitee.id &&
          m.role === role &&
          m.status === "active",
      );
    if (member) fail("LBR36", "Already a member");
    const open = s.invitations.find(
      (i) =>
        i.institutionId === institutionId && i.email === address && i.role === role && isOpen(i),
    );
    if (open) return open.id;
    const id = newId(s, "invite");
    s.invitations.push({
      id,
      institutionId,
      email: address,
      role,
      title: title?.trim() || null,
      expiresAt: inTwoWeeks(),
      status: "open",
    });
    log(s, actor, {
      action: "invitation.create",
      entityType: "invitation",
      entityId: id,
      targetEmail: address,
      before: null,
      after: { role },
      reason: null,
      institutionId,
    });
    return id;
  });

// ---------------------------------------------------------------------------
// School settings (P3-02)

export const getSchoolSettings = async (institutionId: string): Promise<SchoolSettings> =>
  read((s) => {
    requireMember(s, institutionId);
    const x = s.schools.find((school) => school.id === institutionId) ?? notFound();
    return {
      id: x.id,
      name: x.name,
      type: x.type,
      emisNumber: x.emisNumber ?? "",
      province: x.province ?? "",
      district: x.district ?? "",
      address: x.address ?? "",
      contactEmail: x.contactEmail ?? "",
      contactPhone: x.contactPhone ?? "",
      policies: { ...x.policies },
      grades: [...x.grades],
    };
  });

export const updateSchoolDetails = async (
  institutionId: string,
  form: SchoolDetailsForm,
): Promise<boolean> =>
  change((s) => {
    const actor = requireSchoolAdmin(s, institutionId);
    const x = s.schools.find((school) => school.id === institutionId) ?? notFound();
    if (form.name.trim().length < 2) fail("LBR40", "Invalid name", "name");
    const email = form.contactEmail.trim().toLowerCase();
    if (email && !isEmail(email)) fail("LBR40", "Invalid email", "contact_email");
    const phoneText = form.contactPhone.trim();
    const phone = phoneText ? normalizeSaPhone(phoneText) : null;
    if (phoneText && !phone) fail("LBR40", "Invalid phone", "contact_phone");
    const emis = form.emisNumber.trim() || null;
    if (emis && s.schools.some((o) => o.id !== x.id && o.emisNumber === emis)) {
      fail("23505", "duplicate key value violates unique constraint");
    }
    const next = {
      name: form.name.trim(),
      emisNumber: emis,
      province: form.province || null,
      district: form.district.trim() || null,
      address: form.address.trim() || null,
      contactEmail: email || null,
      contactPhone: phone,
    };
    const fields = (Object.keys(next) as (keyof typeof next)[]).filter((k) => next[k] !== x[k]);
    if (fields.length === 0) return false;
    Object.assign(x, next);
    log(s, actor, {
      action: "school.profile_update",
      entityType: "institution",
      entityId: institutionId,
      targetEmail: null,
      before: null,
      after: { fields },
      reason: null,
      institutionId,
    });
    return true;
  });

export const updatePolicies = async (institutionId: string, policies: Policies): Promise<void> =>
  change((s) => {
    const actor = requireSchoolAdmin(s, institutionId);
    const x = s.schools.find((school) => school.id === institutionId) ?? notFound();
    const before = { ...x.policies };
    x.policies = { ...policies };
    log(s, actor, {
      action: "school.policies_update",
      entityType: "institution",
      entityId: institutionId,
      targetEmail: null,
      before,
      after: { ...policies },
      reason: null,
      institutionId,
    });
  });

export const listGradeLevels = async (): Promise<GradeLevel[]> =>
  DEMO_GRADE_LEVELS.map((g) => ({ ...g }));

export const setGrades = async (institutionId: string, codes: string[]): Promise<void> =>
  change((s) => {
    const actor = requireSchoolAdmin(s, institutionId);
    const x = s.schools.find((school) => school.id === institutionId) ?? notFound();
    const known = DEMO_GRADE_LEVELS.map((g) => g.code as string);
    if (codes.some((c) => !known.includes(c))) fail("LBR40", "Unknown grade", "grades");
    const before = x.grades;
    x.grades = known.filter((c) => codes.includes(c));
    log(s, actor, {
      action: "school.grades_update",
      entityType: "institution",
      entityId: institutionId,
      targetEmail: null,
      before: { grades: before },
      after: { grades: x.grades },
      reason: null,
      institutionId,
    });
  });

const today = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

function yearsOf(s: DemoState, institutionId: string): AcademicYear[] {
  const now = today();
  const years = s.years
    .filter((y) => y.institutionId === institutionId)
    .sort((a, b) => b.startsOn.localeCompare(a.startsOn));
  // The current term: in the current year, the one under way, else the next one.
  const currentYear = years.find((y) => y.isCurrent);
  const currentTerm = currentYear
    ? s.terms
        .filter((t) => t.yearId === currentYear.id && t.endsOn >= now)
        .sort(
          (a, b) =>
            Number(b.startsOn <= now) - Number(a.startsOn <= now) ||
            a.startsOn.localeCompare(b.startsOn),
        )[0]
    : undefined;
  const rows: PeriodRow[] = years.flatMap((y): PeriodRow[] => {
    const terms = s.terms.filter((t) => t.yearId === y.id).sort((a, b) => a.number - b.number);
    const base = {
      year_id: y.id,
      year_label: y.label,
      year_starts_on: y.startsOn,
      year_ends_on: y.endsOn,
      year_is_current: y.isCurrent,
    };
    if (terms.length === 0) {
      return [
        {
          ...base,
          term_id: null,
          term_number: null,
          term_starts_on: null,
          term_ends_on: null,
          term_is_current: false,
        },
      ];
    }
    return terms.map((t) => ({
      ...base,
      term_id: t.id,
      term_number: t.number,
      term_starts_on: t.startsOn,
      term_ends_on: t.endsOn,
      term_is_current: t.id === currentTerm?.id,
    }));
  });
  return groupPeriods(rows);
}

export const getAcademicPeriods = async (institutionId: string): Promise<AcademicYear[]> =>
  read((s) => {
    requireMember(s, institutionId);
    return yearsOf(s, institutionId);
  });

export const saveAcademicYear = async (
  institutionId: string,
  yearId: string | null,
  form: YearForm,
): Promise<string> =>
  change((s) => {
    const actor = requireSchoolAdmin(s, institutionId);
    const others = yearsOf(s, institutionId).filter((y) => y.id !== yearId);
    const errors = validateYear(form, others);
    if (errors.label) fail("LBR40", "Invalid label", "label");
    if (errors.endsOn) fail("LBR40", "Invalid dates", "ends_on");
    if (errors.startsOn) fail("LBR41", "Overlapping years", "starts_on");
    let id = yearId;
    if (id) {
      const y = s.years.find((x) => x.id === id && x.institutionId === institutionId) ?? notFound();
      Object.assign(y, { label: form.label.trim(), startsOn: form.startsOn, endsOn: form.endsOn });
    } else {
      id = newId(s, "year");
      s.years.push({
        id,
        institutionId,
        label: form.label.trim(),
        startsOn: form.startsOn,
        endsOn: form.endsOn,
        isCurrent: false,
      });
    }
    if (form.makeCurrent) {
      for (const y of s.years) {
        if (y.institutionId === institutionId) y.isCurrent = y.id === id;
      }
    }
    log(s, actor, {
      action: yearId ? "school.year_update" : "school.year_create",
      entityType: "academic_year",
      entityId: id,
      targetEmail: null,
      before: null,
      after: { label: form.label.trim(), starts_on: form.startsOn, ends_on: form.endsOn },
      reason: null,
      institutionId,
    });
    return id;
  });

export const saveTerm = async (yearId: string, form: TermForm): Promise<string> =>
  change((s) => {
    const y = s.years.find((x) => x.id === yearId) ?? notFound();
    const actor = requireSchoolAdmin(s, y.institutionId);
    const year = yearsOf(s, y.institutionId).find((x) => x.id === yearId) ?? notFound();
    if (!Number.isInteger(form.number) || form.number < 1 || form.number > 4) {
      fail("LBR40", "Invalid term number", "number");
    }
    const errors = validateTerm(form, year);
    if (errors.endsOn) fail("LBR40", "Invalid dates", "ends_on");
    if (errors.startsOn) {
      const outside = form.startsOn < year.startsOn || form.endsOn > year.endsOn;
      fail(outside ? "LBR42" : "LBR41", "Invalid term dates", "starts_on");
    }
    let term = s.terms.find((t) => t.yearId === yearId && t.number === form.number);
    if (term) {
      Object.assign(term, { startsOn: form.startsOn, endsOn: form.endsOn });
    } else {
      term = {
        id: newId(s, "term"),
        yearId,
        number: form.number,
        startsOn: form.startsOn,
        endsOn: form.endsOn,
      };
      s.terms.push(term);
    }
    log(s, actor, {
      action: "school.term_save",
      entityType: "term",
      entityId: term.id,
      targetEmail: null,
      before: null,
      after: { number: form.number, starts_on: form.startsOn, ends_on: form.endsOn },
      reason: null,
      institutionId: y.institutionId,
    });
    return term.id;
  });

// ---------------------------------------------------------------------------
// Staff (P3-03)

const ROLE_ORDER: Record<MembershipRole, number> = { school_admin: 0, teacher: 1 };

export const listStaff = async (institutionId: string): Promise<StaffMember[]> =>
  read((s) => {
    requireSchoolAdmin(s, institutionId);
    return s.memberships
      .filter((m) => m.institutionId === institutionId)
      .map((m) => {
        const person = s.users.find((x) => x.id === m.userId);
        return {
          membershipId: m.id,
          userId: m.userId,
          email: person?.email ?? "",
          fullName: person?.fullName ?? "",
          role: m.role,
          status: m.status,
          title: m.title,
          grades: [...m.grades],
        };
      })
      .sort(
        (a, b) =>
          Number(a.status === "removed") - Number(b.status === "removed") ||
          ROLE_ORDER[a.role] - ROLE_ORDER[b.role] ||
          (a.fullName || a.email).localeCompare(b.fullName || b.email),
      );
  });

export const listOpenInvitations = async (institutionId: string): Promise<OpenInvitation[]> =>
  read((s) => {
    requireSchoolAdmin(s, institutionId);
    return s.invitations
      .filter((i) => i.institutionId === institutionId && isOpen(i))
      .reverse()
      .map((i) => ({
        id: i.id,
        email: i.email,
        role: i.role,
        title: i.title,
        expiresAt: i.expiresAt,
      }));
  });

export const revokeInvitation = async (id: string): Promise<boolean> =>
  change((s) => {
    const invitation = s.invitations.find((i) => i.id === id) ?? notFound();
    const actor = requireSchoolAdmin(s, invitation.institutionId);
    if (!isOpen(invitation)) return false;
    invitation.status = "revoked";
    log(s, actor, {
      action: "invitation.revoke",
      entityType: "invitation",
      entityId: id,
      targetEmail: invitation.email,
      before: null,
      after: null,
      reason: null,
      institutionId: invitation.institutionId,
    });
    return true;
  });

/** A membership this person may manage; other schools get "not found". */
function managedMembership(s: DemoState, membershipId: string) {
  const membership = s.memberships.find((m) => m.id === membershipId) ?? notFound();
  try {
    return { membership, actor: requireSchoolAdmin(s, membership.institutionId) };
  } catch {
    return notFound();
  }
}

export const updateStaffMember = async (
  membershipId: string,
  title: string,
  grades: string[],
): Promise<void> =>
  change((s) => {
    const { membership, actor } = managedMembership(s, membershipId);
    if (title.trim().length > 80) fail("LBR30", "Title too long", "title");
    const offered = s.schools.find((x) => x.id === membership.institutionId)?.grades ?? [];
    if (grades.some((g) => !offered.includes(g))) fail("LBR52", "Grade not offered", "grades");
    membership.title = title.trim() || null;
    membership.grades = offered.filter((g) => grades.includes(g));
    log(s, actor, {
      action: "staff.update",
      entityType: "membership",
      entityId: membershipId,
      targetEmail: emailOf(s, membership.userId),
      before: null,
      after: { fields: ["title", "grades"] },
      reason: null,
      institutionId: membership.institutionId,
    });
  });

const STAFF_ACTIONS = {
  active: "staff.reactivate",
  suspended: "staff.suspend",
  removed: "staff.remove",
} as const;

export const setStaffStatus = async (
  membershipId: string,
  status: "active" | "suspended" | "removed",
  reason: string,
): Promise<boolean> =>
  change((s) => {
    const { membership, actor } = managedMembership(s, membershipId);
    needReason(reason);
    if (membership.userId === actor.u.id) fail("LBR50", "You can't change your own access");
    if (membership.status === status) return false;
    if (membership.role === "school_admin" && membership.status === "active") {
      const otherAdmins = s.memberships.filter(
        (m) =>
          m.institutionId === membership.institutionId &&
          m.role === "school_admin" &&
          m.status === "active" &&
          m.id !== membership.id,
      );
      if (otherAdmins.length === 0) fail("LBR51", "A school needs at least one administrator");
    }
    const before = membership.status;
    membership.status = status;
    log(s, actor, {
      action: STAFF_ACTIONS[status],
      entityType: "membership",
      entityId: membershipId,
      targetEmail: emailOf(s, membership.userId),
      before: { status: before },
      after: { status },
      reason: reason.trim(),
      institutionId: membership.institutionId,
    });
    return true;
  });

// ---------------------------------------------------------------------------
// Parents and guardians (P3-04)

const toGuardian = (g: DemoGuardian): Guardian => ({
  id: g.id,
  firstName: g.firstName,
  lastName: g.lastName,
  relationship: g.relationship,
  email: g.email,
  phone: g.phone,
  language: g.language,
  contactEmail: g.contactEmail,
  contactSms: g.contactSms,
  contactWhatsapp: g.contactWhatsapp,
  status: g.status,
  hasAccount: g.userId !== null,
});

export const listGuardians = async (institutionId: string): Promise<Guardian[]> =>
  read((s) => {
    requireSchoolAdmin(s, institutionId);
    return s.guardians
      .filter((g) => g.institutionId === institutionId)
      .sort(
        (a, b) =>
          Number(a.status === "archived") - Number(b.status === "archived") ||
          a.lastName.localeCompare(b.lastName) ||
          a.firstName.localeCompare(b.firstName),
      )
      .map(toGuardian);
  });

const GUARDIAN_HINTS: Record<GuardianField, string> = {
  firstName: "first_name",
  lastName: "last_name",
  relationship: "relationship",
  email: "email",
  phone: "phone",
  language: "language",
  contact: "contact",
};

function guardianDetails(form: GuardianForm) {
  const problem = Object.keys(validateGuardian(form))[0] as GuardianField | undefined;
  if (problem) fail("LBR60", "Invalid guardian details", GUARDIAN_HINTS[problem]);
  const phone = form.phone.trim();
  return {
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    relationship: form.relationship as DemoGuardian["relationship"],
    email: form.email.trim().toLowerCase() || null,
    phone: phone ? normalizeSaMobile(phone) : null,
    language: form.language,
    contactEmail: form.contactEmail,
    contactSms: form.contactSms,
    contactWhatsapp: form.contactWhatsapp,
  };
}

function emailTaken(s: DemoState, institutionId: string, email: string | null, except?: string) {
  return (
    email !== null &&
    s.guardians.some(
      (g) =>
        g.institutionId === institutionId &&
        g.status === "active" &&
        g.email === email &&
        g.id !== except,
    )
  );
}

export const addGuardian = async (institutionId: string, form: GuardianForm): Promise<string> =>
  change((s) => {
    const actor = requireSchoolAdmin(s, institutionId);
    const details = guardianDetails(form);
    if (emailTaken(s, institutionId, details.email)) {
      fail("LBR61", "Email already on another record", "email");
    }
    const id = newId(s, "guardian");
    s.guardians.push({ id, institutionId, ...details, status: "active", userId: null });
    log(s, actor, {
      action: "guardian.add",
      entityType: "guardian",
      entityId: id,
      targetEmail: null,
      before: null,
      after: { relationship: details.relationship },
      reason: null,
      institutionId,
    });
    return id;
  });

function managedGuardian(s: DemoState, id: string) {
  const guardian = s.guardians.find((g) => g.id === id) ?? notFound();
  try {
    return { guardian, actor: requireSchoolAdmin(s, guardian.institutionId) };
  } catch {
    return notFound();
  }
}

export const updateGuardian = async (id: string, form: GuardianForm): Promise<boolean> =>
  change((s) => {
    const { guardian, actor } = managedGuardian(s, id);
    const details = guardianDetails(form);
    if (guardian.userId && details.email !== guardian.email) {
      fail("LBR60", "The email is fixed once the parent has an account", "email");
    }
    if (guardian.status === "active" && emailTaken(s, guardian.institutionId, details.email, id)) {
      fail("LBR61", "Email already on another record", "email");
    }
    const COLUMNS: Record<keyof typeof details, string> = {
      firstName: "first_name",
      lastName: "last_name",
      relationship: "relationship",
      email: "email",
      phone: "phone",
      language: "preferred_language",
      contactEmail: "contact_email",
      contactSms: "contact_sms",
      contactWhatsapp: "contact_whatsapp",
    };
    const changed = (Object.keys(details) as (keyof typeof details)[]).filter(
      (k) => details[k] !== guardian[k],
    );
    if (changed.length === 0) return false;
    Object.assign(guardian, details);
    log(s, actor, {
      action: "guardian.update",
      entityType: "guardian",
      entityId: id,
      targetEmail: null,
      before: null,
      // Field names only: the audit log never holds contact details.
      after: { fields: changed.map((k) => COLUMNS[k]) },
      reason: null,
      institutionId: guardian.institutionId,
    });
    return true;
  });

export const setGuardianStatus = async (
  id: string,
  status: "active" | "archived",
  reason: string,
): Promise<boolean> =>
  change((s) => {
    const { guardian, actor } = managedGuardian(s, id);
    needReason(reason);
    if (guardian.status === status) return false;
    if (status === "active" && emailTaken(s, guardian.institutionId, guardian.email, id)) {
      fail("LBR61", "Email already on another record", "email");
    }
    guardian.status = status;
    log(s, actor, {
      action: status === "archived" ? "guardian.archive" : "guardian.restore",
      entityType: "guardian",
      entityId: id,
      targetEmail: null,
      before: null,
      after: { status },
      reason: reason.trim(),
      institutionId: guardian.institutionId,
    });
    return true;
  });

export const myGuardianInvitations = async (): Promise<GuardianInvitation[]> =>
  read((s) => {
    const u = me(s);
    if (!isActive(u)) return [];
    return s.guardians
      .filter(
        (g) =>
          g.status === "active" &&
          g.userId === null &&
          g.email === u.email &&
          s.schools.find((x) => x.id === g.institutionId)?.status === "active",
      )
      .map((g) => ({
        id: g.id,
        institutionName: s.schools.find((x) => x.id === g.institutionId)?.name ?? "",
      }));
  });

export const claimGuardianRecord = async (id: string): Promise<void> =>
  change((s) => {
    const u = me(s);
    const guardian = s.guardians.find((g) => g.id === id);
    if (
      !guardian ||
      guardian.status !== "active" ||
      guardian.userId !== null ||
      guardian.email !== u.email ||
      !isActive(u)
    ) {
      fail("LBR62", "This parent record can't be claimed");
    }
    guardian.userId = u.id;
    log(
      s,
      { u, actorRole: "self" },
      {
        action: "guardian.claim",
        entityType: "guardian",
        entityId: id,
        targetEmail: null,
        before: null,
        after: null,
        reason: null,
        institutionId: guardian.institutionId,
      },
    );
  });
