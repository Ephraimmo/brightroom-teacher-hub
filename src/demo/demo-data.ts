/**
 * The sample dataset behind demo mode (see docs/demo.md). Everything here is
 * invented: names, emails (@demo.learnbridge.test can't receive mail), EMIS
 * numbers and phone numbers. Replace or extend it freely; nothing in the real
 * database depends on it.
 *
 * Greenridge Learning Centre matches the teacher screens' sample data
 * (src/domain/teacher-sample-data.ts), so the whole demo tells one story.
 */
import type { AccountStatus } from "@/domain/account-status";
import type { AuditEntry } from "@/domain/audit";
import type { Relationship } from "@/domain/guardians";
import type { PlatformRole } from "@/domain/permissions";
import type { LanguageCode } from "@/domain/profile";
import type { InstitutionStatus, InstitutionType, MembershipRole } from "@/domain/schools";
import type { StaffStatus } from "@/domain/staff";

export type DemoRole = Extract<
  PlatformRole,
  "platform_admin" | "school_admin" | "teacher" | "parent" | "learner"
>;

export interface DemoUser {
  id: string;
  email: string;
  fullName: string;
  displayName: string;
  phone: string | null;
  language: LanguageCode;
  contactEmail: boolean;
  contactSms: boolean;
  contactWhatsapp: boolean;
  avatarPath: string | null;
  /** Roles held directly (user_roles), not through a school. */
  globalRoles: PlatformRole[];
  accountStatus: AccountStatus;
  mfaFactors: number;
}

export interface DemoSchool {
  id: string;
  name: string;
  type: InstitutionType;
  status: InstitutionStatus;
  emisNumber: string | null;
  province: string | null;
  district: string | null;
  address: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  createdAt: string;
  policies: Record<string, boolean>;
  grades: string[];
}

export interface DemoMembership {
  id: string;
  institutionId: string;
  userId: string;
  role: MembershipRole;
  status: StaffStatus;
  title: string | null;
  grades: string[];
}

export interface DemoInvitation {
  id: string;
  institutionId: string;
  email: string;
  role: MembershipRole;
  title: string | null;
  expiresAt: string;
  status: "open" | "accepted" | "revoked";
}

export interface DemoYear {
  id: string;
  institutionId: string;
  label: string;
  startsOn: string;
  endsOn: string;
  isCurrent: boolean;
}

export interface DemoTerm {
  id: string;
  yearId: string;
  number: number;
  startsOn: string;
  endsOn: string;
}

export interface DemoGuardian {
  id: string;
  institutionId: string;
  firstName: string;
  lastName: string;
  relationship: Relationship;
  email: string | null;
  phone: string | null;
  language: LanguageCode;
  contactEmail: boolean;
  contactSms: boolean;
  contactWhatsapp: boolean;
  status: "active" | "archived";
  /** The account that claimed this record, if any. */
  userId: string | null;
}

export interface DemoAuditEntry extends AuditEntry {
  /** The school the change belongs to, if any. */
  institutionId: string | null;
}

export interface DemoState {
  version: 1;
  users: DemoUser[];
  schools: DemoSchool[];
  memberships: DemoMembership[];
  invitations: DemoInvitation[];
  years: DemoYear[];
  terms: DemoTerm[];
  guardians: DemoGuardian[];
  audit: DemoAuditEntry[];
  nextId: number;
}

export interface DemoPersona {
  role: DemoRole;
  userId: string;
  title: string;
  summary: string;
}

const PLATFORM = "demo-user-platform";
const HEAD = "demo-user-head";
const DEPUTY = "demo-user-deputy";
const TEACHER = "demo-user-teacher";
const TEACHER_2 = "demo-user-teacher-2";
const TEACHER_3 = "demo-user-teacher-3";
const PARENT = "demo-user-parent";
const LEARNER = "demo-user-learner";
const RIVERSIDE_HEAD = "demo-user-riverside";
const NEW_USER = "demo-user-new";

export const GREENRIDGE = "demo-school-greenridge";
export const RIVERSIDE = "demo-school-riverside";
const BRIGHT = "demo-school-bright";

/** The people you can explore the demo as, in the order the picker shows them. */
export const DEMO_PERSONAS: readonly DemoPersona[] = [
  {
    role: "platform_admin",
    userId: PLATFORM,
    title: "Platform admin",
    summary: "Register and approve schools, give people roles, and read the audit log.",
  },
  {
    role: "school_admin",
    userId: HEAD,
    title: "School admin",
    summary: "Run Greenridge Learning Centre: staff, parents, terms, grades and policies.",
  },
  {
    role: "teacher",
    userId: TEACHER,
    title: "Teacher",
    summary: "Amina's classes, timetable, homework and resources at Greenridge.",
  },
  {
    role: "parent",
    userId: PARENT,
    title: "Parent",
    summary: "Mpho's family account, profile, and a second school's parent record to confirm.",
  },
  {
    role: "learner",
    userId: LEARNER,
    title: "Learner",
    summary: "Ayanda's learner account. The learner dashboard is still being built.",
  },
];

export const personaFor = (role: DemoRole): DemoPersona =>
  DEMO_PERSONAS.find((p) => p.role === role) ?? DEMO_PERSONAS[0]!;

const email = (name: string) => `${name}@demo.learnbridge.test`;

function user(
  id: string,
  name: string,
  mail: string,
  globalRoles: PlatformRole[] = [],
  extra: Partial<DemoUser> = {},
): DemoUser {
  return {
    id,
    email: email(mail),
    fullName: name,
    displayName: name.split(" ")[0] ?? name,
    phone: null,
    language: "en",
    contactEmail: true,
    contactSms: false,
    contactWhatsapp: false,
    avatarPath: null,
    globalRoles,
    accountStatus: "active",
    mfaFactors: 0,
    ...extra,
  };
}

const ALL_POLICIES_ON = {
  lesson_recording: true,
  ai_assistance: true,
  parent_messaging: true,
  learner_messaging: false,
};

function guardian(
  id: string,
  institutionId: string,
  firstName: string,
  lastName: string,
  relationship: Relationship,
  details: Partial<DemoGuardian>,
): DemoGuardian {
  return {
    id,
    institutionId,
    firstName,
    lastName,
    relationship,
    email: null,
    phone: null,
    language: "en",
    contactEmail: false,
    contactSms: false,
    contactWhatsapp: false,
    status: "active",
    userId: null,
    ...details,
  };
}

let auditId = 0;
function audit(
  occurredAt: string,
  action: string,
  actor: string | null,
  target: string | null,
  entity: [type: string, id: string],
  institutionId: string | null,
  change: { before?: Record<string, unknown>; after?: Record<string, unknown>; reason?: string },
): DemoAuditEntry {
  auditId += 1;
  return {
    id: auditId,
    occurredAt,
    action,
    actorEmail: actor ? email(actor) : null,
    actorRole: actor ? "platform_admin" : null,
    entityType: entity[0],
    entityId: entity[1],
    targetEmail: target ? email(target) : null,
    before: change.before ?? null,
    after: change.after ?? null,
    reason: change.reason ?? null,
    institutionId,
  };
}

/** Invitations stay open whenever the demo is started. */
const daysFromNow = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

/** A fresh copy of the sample data. */
export function createDemoSeed(): DemoState {
  auditId = 0;
  return {
    version: 1,
    users: [
      user(PLATFORM, "Thandi Nkosi", "thandi.nkosi", ["platform_admin"], { mfaFactors: 1 }),
      user(HEAD, "Lerato Mokoena", "lerato.mokoena", [], {
        phone: "+27821230001",
        contactSms: true,
        mfaFactors: 1,
      }),
      user(DEPUTY, "Johan van Wyk", "johan.vanwyk", [], { language: "af", mfaFactors: 1 }),
      user(TEACHER, "Amina Dlamini", "amina.dlamini", [], {
        phone: "+27831230002",
        language: "zu",
        contactWhatsapp: true,
      }),
      user(TEACHER_2, "Sibusiso Ndlovu", "sibusiso.ndlovu"),
      user(TEACHER_3, "Priya Naidoo", "priya.naidoo"),
      user(PARENT, "Mpho Khumalo", "mpho.khumalo", [], {
        phone: "+27841230003",
        language: "zu",
        contactWhatsapp: true,
      }),
      user(LEARNER, "Ayanda Khumalo", "ayanda.khumalo", ["learner"]),
      user(RIVERSIDE_HEAD, "Nomsa Zulu", "nomsa.zulu", [], { mfaFactors: 1 }),
      user(NEW_USER, "Kagiso Molefe", "kagiso.molefe"),
    ],
    schools: [
      {
        id: GREENRIDGE,
        name: "Greenridge Learning Centre",
        type: "school",
        status: "active",
        emisNumber: "700400123",
        province: "GP",
        district: "Johannesburg East",
        address: "14 Acacia Road, Bedfordview, 2008",
        contactEmail: email("office.greenridge"),
        contactPhone: "+27115550101",
        createdAt: "2026-01-08T08:00:00Z",
        policies: ALL_POLICIES_ON,
        grades: ["G08", "G09", "G10", "G11", "G12"],
      },
      {
        id: RIVERSIDE,
        name: "Riverside High School",
        type: "school",
        status: "active",
        emisNumber: "500200456",
        province: "KZN",
        district: "uMgungundlovu",
        address: "2 River Drive, Pietermaritzburg, 3201",
        contactEmail: email("office.riverside"),
        contactPhone: "+27335550202",
        createdAt: "2026-02-02T08:00:00Z",
        policies: { ...ALL_POLICIES_ON, ai_assistance: false },
        grades: ["G08", "G09", "G10", "G11", "G12"],
      },
      {
        id: BRIGHT,
        name: "Bright Futures Tutoring",
        type: "tutoring_centre",
        status: "pending",
        emisNumber: null,
        province: "WC",
        district: null,
        address: null,
        contactEmail: email("hello.brightfutures"),
        contactPhone: null,
        createdAt: "2026-11-20T10:30:00Z",
        policies: {},
        grades: ["G10", "G11", "G12", "MATRIC_REWRITE"],
      },
    ],
    memberships: [
      m("demo-member-head", GREENRIDGE, HEAD, "school_admin", "active", "Principal"),
      m("demo-member-deputy", GREENRIDGE, DEPUTY, "school_admin", "active", "Deputy principal"),
      m("demo-member-amina", GREENRIDGE, TEACHER, "teacher", "active", "Mathematics teacher", [
        "G08",
        "G09",
      ]),
      m(
        "demo-member-sibusiso",
        GREENRIDGE,
        TEACHER_2,
        "teacher",
        "active",
        "Natural Sciences teacher",
        ["G10", "G11"],
      ),
      m("demo-member-priya", GREENRIDGE, TEACHER_3, "teacher", "suspended", "English teacher", [
        "G12",
      ]),
      m("demo-member-nomsa", RIVERSIDE, RIVERSIDE_HEAD, "school_admin", "active", "Principal"),
    ],
    invitations: [
      {
        id: "demo-invite-thabo",
        institutionId: GREENRIDGE,
        email: email("thabo.mthembu"),
        role: "teacher",
        title: "History teacher",
        expiresAt: daysFromNow(10),
        status: "open",
      },
      {
        id: "demo-invite-amina-riverside",
        institutionId: RIVERSIDE,
        email: email("amina.dlamini"),
        role: "teacher",
        title: "Extra maths classes",
        expiresAt: daysFromNow(12),
        status: "open",
      },
    ],
    years: [
      year("demo-year-g-2026", GREENRIDGE, "2026", "2026-01-14", "2026-12-09", true),
      year("demo-year-g-2027", GREENRIDGE, "2027", "2027-01-13", "2027-12-08", false),
      year("demo-year-r-2026", RIVERSIDE, "2026", "2026-01-14", "2026-12-09", true),
    ],
    terms: [...termsFor("demo-year-g-2026"), ...termsFor("demo-year-r-2026")],
    guardians: [
      guardian("demo-guardian-mpho", GREENRIDGE, "Mpho", "Khumalo", "mother", {
        email: email("mpho.khumalo"),
        phone: "+27841230003",
        language: "zu",
        contactEmail: true,
        contactWhatsapp: true,
        userId: PARENT,
      }),
      guardian("demo-guardian-bongani", GREENRIDGE, "Bongani", "Khumalo", "father", {
        phone: "+27721230004",
        language: "zu",
        contactSms: true,
      }),
      guardian("demo-guardian-zanele", GREENRIDGE, "Zanele", "Mahlangu", "guardian", {
        email: email("zanele.mahlangu"),
        contactEmail: true,
      }),
      guardian("demo-guardian-pieter", GREENRIDGE, "Pieter", "Botha", "father", {
        email: email("pieter.botha"),
        phone: "+27611230005",
        language: "af",
        contactEmail: true,
        contactWhatsapp: true,
      }),
      guardian("demo-guardian-nomvula", GREENRIDGE, "Nomvula", "Sithole", "grandparent", {
        phone: "+27791230006",
        language: "xh",
        contactWhatsapp: true,
      }),
      guardian("demo-guardian-kevin", GREENRIDGE, "Kevin", "Adams", "foster_parent", {
        email: email("kevin.adams"),
        contactEmail: true,
        status: "archived",
      }),
      // An unclaimed record at a second school, so the parent can try "confirm".
      guardian("demo-guardian-mpho-riverside", RIVERSIDE, "Mpho", "Khumalo", "mother", {
        email: email("mpho.khumalo"),
        contactEmail: true,
      }),
    ],
    audit: [
      audit(
        "2026-01-08T08:00:00Z",
        "institution.register",
        "thandi.nkosi",
        "lerato.mokoena",
        ["institution", GREENRIDGE],
        GREENRIDGE,
        {
          after: { name: "Greenridge Learning Centre" },
          reason: "Signed school agreement",
        },
      ),
      audit(
        "2026-01-09T07:30:00Z",
        "role.grant",
        "thandi.nkosi",
        "ayanda.khumalo",
        ["user", LEARNER],
        null,
        {
          after: { role: "learner" },
          reason: "Enrolled at Greenridge",
        },
      ),
      audit(
        "2026-02-02T08:00:00Z",
        "institution.register",
        "thandi.nkosi",
        "nomsa.zulu",
        ["institution", RIVERSIDE],
        RIVERSIDE,
        {
          after: { name: "Riverside High School" },
          reason: "Pilot school for KwaZulu-Natal",
        },
      ),
      audit(
        "2026-06-12T11:15:00Z",
        "account.suspend",
        "thandi.nkosi",
        "kagiso.molefe",
        ["user", NEW_USER],
        null,
        {
          before: { status: "active" },
          after: { status: "suspended" },
          reason: "Reported shared password",
        },
      ),
      audit(
        "2026-06-13T09:00:00Z",
        "account.reactivate",
        "thandi.nkosi",
        "kagiso.molefe",
        ["user", NEW_USER],
        null,
        {
          before: { status: "suspended" },
          after: { status: "active" },
          reason: "Password changed, confirmed by phone",
        },
      ),
      audit("2026-10-20T13:40:00Z", "profile.update", null, null, ["profile", TEACHER], null, {
        after: { fields: ["phone", "contact_whatsapp"] },
      }),
      audit(
        "2026-11-02T10:05:00Z",
        "staff.suspend",
        "lerato.mokoena",
        "priya.naidoo",
        ["membership", "demo-member-priya"],
        GREENRIDGE,
        {
          before: { status: "active" },
          after: { status: "suspended" },
          reason: "On extended leave until January",
        },
      ),
      audit(
        "2026-11-24T08:20:00Z",
        "invitation.create",
        "lerato.mokoena",
        "thabo.mthembu",
        ["invitation", "demo-invite-thabo"],
        GREENRIDGE,
        {
          after: { role: "teacher" },
        },
      ),
    ].map((e) =>
      // The person's own profile edits are recorded as "self".
      e.action === "profile.update"
        ? { ...e, actorRole: "self", actorEmail: email("amina.dlamini") }
        : e.actorEmail === email("lerato.mokoena")
          ? { ...e, actorRole: "school_admin" }
          : e,
    ),
    nextId: 1,
  };
}

function m(
  id: string,
  institutionId: string,
  userId: string,
  role: MembershipRole,
  status: StaffStatus,
  title: string,
  grades: string[] = [],
): DemoMembership {
  return { id, institutionId, userId, role, status, title, grades };
}

function year(
  id: string,
  institutionId: string,
  label: string,
  startsOn: string,
  endsOn: string,
  isCurrent: boolean,
): DemoYear {
  return { id, institutionId, label, startsOn, endsOn, isCurrent };
}

/** The 2026 public-school terms. */
function termsFor(yearId: string): DemoTerm[] {
  const dates: [string, string][] = [
    ["2026-01-14", "2026-03-27"],
    ["2026-04-08", "2026-06-26"],
    ["2026-07-21", "2026-10-02"],
    ["2026-10-13", "2026-12-09"],
  ];
  return dates.map(([startsOn, endsOn], i) => ({
    id: `${yearId}-term-${i + 1}`,
    yearId,
    number: i + 1,
    startsOn,
    endsOn,
  }));
}

/** grade_levels as seeded by db/pending/P3-02-school-settings.sql. */
export const DEMO_GRADE_LEVELS = [
  { code: "G00", label: "Grade R", phase: "foundation" },
  { code: "G01", label: "Grade 1", phase: "foundation" },
  { code: "G02", label: "Grade 2", phase: "foundation" },
  { code: "G03", label: "Grade 3", phase: "foundation" },
  { code: "G04", label: "Grade 4", phase: "intermediate" },
  { code: "G05", label: "Grade 5", phase: "intermediate" },
  { code: "G06", label: "Grade 6", phase: "intermediate" },
  { code: "G07", label: "Grade 7", phase: "senior" },
  { code: "G08", label: "Grade 8", phase: "senior" },
  { code: "G09", label: "Grade 9", phase: "senior" },
  { code: "G10", label: "Grade 10", phase: "fet" },
  { code: "G11", label: "Grade 11", phase: "fet" },
  { code: "G12", label: "Grade 12", phase: "fet" },
  { code: "MATRIC_REWRITE", label: "Matric rewrite", phase: "adult" },
  { code: "MATRIC_UPGRADE", label: "Matric upgrade", phase: "adult" },
  { code: "EXAM_PREP", label: "Exam preparation", phase: "adult" },
] as const;
