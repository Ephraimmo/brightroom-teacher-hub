// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";

import {
  addUser,
  as,
  createTestDatabase,
  errorCode,
  pendingThrough,
  seedRole,
  type TestDb,
} from "./db/harness";
import { acceptInvitations, addMember, registerSchool } from "./db/schools";

/** Security tests for db/pending/P3-03-staff-management.sql. */

const PLATFORM = "00000000-0000-4000-8000-000000000001";
const ADMIN_A = "00000000-0000-4000-8000-0000000000a1";
const ADMIN_A2 = "00000000-0000-4000-8000-0000000000a3";
const TEACHER_A = "00000000-0000-4000-8000-0000000000a2";
const ADMIN_B = "00000000-0000-4000-8000-0000000000b1";

let db: TestDb;
let schoolA: string;
let schoolB: string;

beforeEach(async () => {
  db = await createTestDatabase(pendingThrough("db/pending/P3-03-staff-management.sql"));
  await addUser(db, PLATFORM, "platform@example.test");
  await addUser(db, ADMIN_A, "head@school-a.test", "Ayanda Admin");
  await addUser(db, ADMIN_A2, "deputy@school-a.test", "Dineo Deputy");
  await addUser(db, TEACHER_A, "teacher@school-a.test", "Thabo Teacher");
  await addUser(db, ADMIN_B, "head@school-b.test", "Bongi Admin");
  await seedRole(db, PLATFORM, "platform_admin");
  schoolA = await registerSchool(db, PLATFORM, "Sunrise Primary", "head@school-a.test");
  schoolB = await registerSchool(db, PLATFORM, "Riverside High", "head@school-b.test");
  await acceptInvitations(db, ADMIN_A);
  await acceptInvitations(db, ADMIN_B);
  await addMember(db, ADMIN_A, schoolA, "teacher@school-a.test", TEACHER_A);
  await as(db, ADMIN_A, () =>
    db.query(`SELECT public.set_institution_grades($1, ARRAY['G04','G05'])`, [schoolA]),
  );
}, 60_000);

interface StaffRow {
  membership_id: string;
  user_id: string;
  email: string;
  full_name: string;
  role: string;
  status: string;
  title: string | null;
  grades: string[];
}
const staff = (school = schoolA, who = ADMIN_A) =>
  as(db, who, () => db.query<StaffRow>(`SELECT * FROM public.school_staff($1)`, [school])).then(
    (r) => r.rows,
  );
const membershipOf = async (userId: string) =>
  (await staff()).find((s) => s.user_id === userId)!.membership_id;
const setStatus = (membership: string, status: string, reason: string | null = "Left the school") =>
  db.query<{ ok: boolean }>(`SELECT public.set_staff_status($1, $2, $3) AS ok`, [
    membership,
    status,
    reason,
  ]);
const myRoles = () =>
  db.query<{ r: string }>(`SELECT r FROM public.my_roles() r`).then((x) => x.rows.map((r) => r.r));

describe("the staff list", () => {
  it("shows a school admin their school's staff with names and emails", async () => {
    const rows = await staff();
    expect(rows.map((r) => [r.email, r.role, r.status])).toEqual([
      ["head@school-a.test", "school_admin", "active"],
      ["teacher@school-a.test", "teacher", "active"],
    ]);
  });

  it("is refused to another school's admin and to teachers", async () => {
    expect(await errorCode(staff(schoolA, ADMIN_B))).toBe("42501");
    expect(await errorCode(staff(schoolA, TEACHER_A))).toBe("42501");
  });

  it("lists open invitations, and lets an admin cancel one", async () => {
    await as(db, ADMIN_A, () =>
      db.query(`SELECT public.create_invitation($1, 'new@example.test', 'teacher')`, [schoolA]),
    );
    const open = await as(db, ADMIN_A, () =>
      db.query<{ id: string; email: string }>(`SELECT * FROM public.school_open_invitations($1)`, [
        schoolA,
      ]),
    );
    expect(open.rows.map((r) => r.email)).toEqual(["new@example.test"]);
    expect(
      await errorCode(
        as(db, ADMIN_B, () => db.query(`SELECT public.revoke_invitation($1)`, [open.rows[0]!.id])),
      ),
    ).toBe("42501");
    await as(db, ADMIN_A, () =>
      db.query(`SELECT public.revoke_invitation($1)`, [open.rows[0]!.id]),
    );
    const after = await as(db, ADMIN_A, () =>
      db.query(`SELECT * FROM public.school_open_invitations($1)`, [schoolA]),
    );
    expect(after.rows).toHaveLength(0);
  });
});

describe("editing a teacher", () => {
  it("sets a title and grades the school offers", async () => {
    const m = await membershipOf(TEACHER_A);
    await as(db, ADMIN_A, () =>
      db.query(`SELECT public.update_staff_member($1, 'HOD Mathematics', ARRAY['G05','G04'])`, [m]),
    );
    const row = (await staff()).find((s) => s.user_id === TEACHER_A);
    expect(row).toMatchObject({ title: "HOD Mathematics", grades: ["G04", "G05"] });
  });

  it("refuses grades the school doesn't offer", async () => {
    const m = await membershipOf(TEACHER_A);
    expect(
      await errorCode(
        as(db, ADMIN_A, () =>
          db.query(`SELECT public.update_staff_member($1, null, ARRAY['G12'])`, [m]),
        ),
      ),
    ).toBe("LBR52");
  });

  it("another school's admin can't touch them, and gets 'not found'", async () => {
    const m = await membershipOf(TEACHER_A);
    expect(
      await errorCode(
        as(db, ADMIN_B, () => db.query(`SELECT public.update_staff_member($1, 'X', null)`, [m])),
      ),
    ).toBe("LBR03");
    expect(await errorCode(as(db, ADMIN_B, () => setStatus(m, "removed")))).toBe("LBR03");
  });
});

describe("suspending, reactivating and removing", () => {
  it("a suspended teacher loses the teacher role until reactivated", async () => {
    const m = await membershipOf(TEACHER_A);
    await as(db, ADMIN_A, () => setStatus(m, "suspended"));
    expect(await as(db, TEACHER_A, myRoles)).toEqual([]);
    await as(db, ADMIN_A, () => setStatus(m, "active", "Back from leave"));
    expect(await as(db, TEACHER_A, myRoles)).toEqual(["teacher"]);
  });

  it("removing keeps the record but ends access, with an audit entry", async () => {
    const m = await membershipOf(TEACHER_A);
    await as(db, ADMIN_A, () => setStatus(m, "removed"));
    expect((await staff()).find((s) => s.user_id === TEACHER_A)?.status).toBe("removed");
    const { rows } = await db.query<Record<string, unknown>>(
      `SELECT * FROM public.audit_log WHERE action = 'staff.remove'`,
    );
    expect(rows[0]).toMatchObject({
      actor_user_id: ADMIN_A,
      institution_id: schoolA,
      entity_id: TEACHER_A,
      reason: "Left the school",
    });
  });

  it("needs a reason", async () => {
    const m = await membershipOf(TEACHER_A);
    expect(await errorCode(as(db, ADMIN_A, () => setStatus(m, "suspended", " ")))).toBe("LBR02");
  });

  it("admins can't change their own membership", async () => {
    const mine = await membershipOf(ADMIN_A);
    expect(await errorCode(as(db, ADMIN_A, () => setStatus(mine, "removed")))).toBe("LBR50");
  });

  it("the school always keeps an active admin", async () => {
    const head = await membershipOf(ADMIN_A);
    // Only a platform admin could try to remove the last admin.
    expect(await errorCode(as(db, PLATFORM, () => setStatus(head, "removed")))).toBe("LBR51");
    await addMember(db, ADMIN_A, schoolA, "deputy@school-a.test", ADMIN_A2, "school_admin");
    await as(db, PLATFORM, () => setStatus(head, "removed"));
    expect(await as(db, ADMIN_A, myRoles)).toEqual([]);
  });

  it("teachers can't manage staff", async () => {
    const head = await membershipOf(ADMIN_A);
    expect(await errorCode(as(db, TEACHER_A, () => setStatus(head, "suspended")))).toBe("LBR03");
  });
});

describe("the school's audit trail", () => {
  it("shows a school admin only their school's entries", async () => {
    const m = await membershipOf(TEACHER_A);
    await as(db, ADMIN_A, () => setStatus(m, "suspended"));
    const { rows } = await as(db, ADMIN_A, () =>
      db.query<{ action: string }>(`SELECT action FROM public.school_audit_log($1)`, [schoolA]),
    );
    expect(rows[0]?.action).toBe("staff.suspend");
    expect(
      await errorCode(
        as(db, ADMIN_B, () => db.query(`SELECT * FROM public.school_audit_log($1)`, [schoolA])),
      ),
    ).toBe("42501");
  });
});
