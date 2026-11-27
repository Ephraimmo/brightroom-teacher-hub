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
import { acceptInvitations, registerSchool as register } from "./db/schools";

/** Security tests for db/pending/P3-01-schools-and-tenancy.sql. */

const PLATFORM = "00000000-0000-4000-8000-000000000001";
const ADMIN_A = "00000000-0000-4000-8000-0000000000a1";
const ADMIN_B = "00000000-0000-4000-8000-0000000000b1";
const TEACHER_A = "00000000-0000-4000-8000-0000000000a2";
const STRANGER = "00000000-0000-4000-8000-0000000000c1";

let db: TestDb;
let schoolA: string;
let schoolB: string;

const registerSchool = (db: TestDb, name: string, email: string, emis: string | null = null) =>
  register(db, PLATFORM, name, email, emis);

beforeEach(async () => {
  db = await createTestDatabase(pendingThrough("db/pending/P3-01-schools-and-tenancy.sql"));
  await addUser(db, PLATFORM, "platform@example.test", "Pat Platform");
  await addUser(db, ADMIN_A, "head@school-a.test", "Ayanda Admin");
  await addUser(db, ADMIN_B, "head@school-b.test", "Bongi Admin");
  await addUser(db, TEACHER_A, "teacher@school-a.test", "Thabo Teacher");
  await addUser(db, STRANGER, "someone@example.test", "Sam Stranger");
  await seedRole(db, PLATFORM, "platform_admin");
  schoolA = await registerSchool(db, "Sunrise Primary", "Head@School-A.test", "700400111");
  schoolB = await registerSchool(db, "Riverside High", "head@school-b.test");
  await acceptInvitations(db, ADMIN_A);
  await acceptInvitations(db, ADMIN_B);
}, 60_000);

const myRoles = () =>
  db
    .query<{ r: string }>(`SELECT r FROM public.my_roles() r ORDER BY 1`)
    .then((x) => x.rows.map((row) => row.r));

describe("registering a school", () => {
  it("creates an active school, an invitation for its first admin, and an audit entry", async () => {
    const { rows } = await db.query<{ status: string; name: string }>(
      `SELECT status, name FROM public.institutions WHERE id = $1`,
      [schoolA],
    );
    expect(rows[0]).toEqual({ status: "active", name: "Sunrise Primary" });
    const audit = await db.query(
      `SELECT 1 FROM public.audit_log WHERE action = 'institution.register'`,
    );
    expect(audit.rows).toHaveLength(2);
  });

  it("is for platform admins only", async () => {
    const register = () =>
      db.query(
        `SELECT public.admin_register_institution('X School', 'school', 'GP', null, null, null, 'x@example.test', 'reason')`,
      );
    expect(await errorCode(as(db, ADMIN_A, register))).toBe("42501");
    expect(await errorCode(as(db, STRANGER, register))).toBe("42501");
  });

  it("rejects bad details, naming the field", async () => {
    const bad = (province: string, email: string) =>
      as(db, PLATFORM, () =>
        db.query(
          `SELECT public.admin_register_institution('Valid School', 'school', $1, null, null, null, $2, 'reason')`,
          [province, email],
        ),
      );
    expect(await errorCode(bad("XX", "x@example.test"))).toBe("LBR30");
    expect(await errorCode(bad("GP", "not-an-email"))).toBe("LBR30");
  });

  it("won't register the same EMIS number twice", async () => {
    expect(await errorCode(registerSchool(db, "Copy School", "c@example.test", "700400111"))).toBe(
      "23505",
    );
  });
});

describe("invitations", () => {
  it("accepting makes the person a school admin there, and only there", async () => {
    expect(await as(db, ADMIN_A, myRoles)).toEqual(["school_admin"]);
    const mine = await as(db, ADMIN_A, () =>
      db.query<{ institution_id: string }>(`SELECT institution_id FROM public.my_institutions()`),
    );
    expect(mine.rows).toEqual([{ institution_id: schoolA }]);
  });

  it("can only be accepted by the invited email, once", async () => {
    const { rows } = await as(db, ADMIN_A, () =>
      db.query<{ id: string }>(
        `SELECT public.create_invitation($1, 'teacher@school-a.test', 'teacher') AS id`,
        [schoolA],
      ),
    );
    const id = rows[0]!.id;
    expect(
      await as(db, STRANGER, () => db.query(`SELECT * FROM public.my_invitations()`)),
    ).toMatchObject({
      rows: [],
    });
    expect(
      await errorCode(
        as(db, STRANGER, () => db.query(`SELECT public.accept_invitation($1)`, [id])),
      ),
    ).toBe("LBR35");
    await as(db, TEACHER_A, () => db.query(`SELECT public.accept_invitation($1)`, [id]));
    expect(await as(db, TEACHER_A, myRoles)).toEqual(["teacher"]);
    expect(
      await errorCode(
        as(db, TEACHER_A, () => db.query(`SELECT public.accept_invitation($1)`, [id])),
      ),
    ).toBe("LBR35");
  });

  it("expired invitations and unconfirmed emails don't work", async () => {
    const { rows } = await as(db, ADMIN_A, () =>
      db.query<{ id: string }>(
        `SELECT public.create_invitation($1, 'teacher@school-a.test', 'teacher') AS id`,
        [schoolA],
      ),
    );
    await db.query(`UPDATE auth.users SET email_confirmed_at = NULL WHERE id = $1`, [TEACHER_A]);
    const accept = () => db.query(`SELECT public.accept_invitation($1)`, [rows[0]!.id]);
    expect(await errorCode(as(db, TEACHER_A, accept))).toBe("LBR35");
    await db.query(`UPDATE auth.users SET email_confirmed_at = now() WHERE id = $1`, [TEACHER_A]);
    await db.query(`UPDATE public.invitations SET expires_at = now() - interval '1 day'`);
    expect(await errorCode(as(db, TEACHER_A, accept))).toBe("LBR35");
  });

  it("a school admin can invite only to their own school", async () => {
    const invite = (school: string) => () =>
      db.query(`SELECT public.create_invitation($1, 'new@example.test', 'teacher')`, [school]);
    await as(db, ADMIN_A, invite(schoolA));
    expect(await errorCode(as(db, ADMIN_A, invite(schoolB)))).toBe("42501");
    expect(await errorCode(as(db, TEACHER_A, invite(schoolA)))).toBe("42501");
  });

  it("school admin powers need MFA", async () => {
    const invite = () =>
      db.query(`SELECT public.create_invitation($1, 'new@example.test', 'teacher')`, [schoolA]);
    expect(await errorCode(as(db, ADMIN_A, invite, { aal: "aal1" }))).toBe("42501");
  });

  it("re-inviting renews the open invitation instead of duplicating it", async () => {
    const invite = () =>
      db.query(`SELECT public.create_invitation($1, 'New@Example.test', 'teacher')`, [schoolA]);
    await as(db, ADMIN_A, invite);
    await as(db, ADMIN_A, invite);
    const { rows } = await db.query(
      `SELECT 1 FROM public.invitations WHERE email = 'new@example.test' AND accepted_at IS NULL`,
    );
    expect(rows).toHaveLength(1);
  });

  it("won't invite someone who is already an active member with that role", async () => {
    expect(
      await errorCode(
        as(db, ADMIN_A, () =>
          db.query(`SELECT public.create_invitation($1, 'head@school-a.test', 'school_admin')`, [
            schoolA,
          ]),
        ),
      ),
    ).toBe("LBR36");
  });
});

describe("tenancy: schools are isolated", () => {
  it("each school admin sees only their own school", async () => {
    const seen = await as(db, ADMIN_A, () =>
      db.query<{ id: string }>(`SELECT id FROM public.institutions`),
    );
    expect(seen.rows).toEqual([{ id: schoolA }]);
  });

  it("memberships and invitations of another school are invisible", async () => {
    await as(db, ADMIN_B, () =>
      db.query(`SELECT public.create_invitation($1, 'x@example.test', 'teacher')`, [schoolB]),
    );
    const members = await as(db, ADMIN_A, () =>
      db.query<{ institution_id: string }>(
        `SELECT DISTINCT institution_id FROM public.institution_memberships`,
      ),
    );
    expect(members.rows).toEqual([{ institution_id: schoolA }]);
    const invitations = await as(db, ADMIN_A, () =>
      db.query(`SELECT 1 FROM public.invitations WHERE institution_id = $1`, [schoolB]),
    );
    expect(invitations.rows).toHaveLength(0);
  });

  it("a school admin reads only their own school's audit entries", async () => {
    const entries = await as(db, ADMIN_A, () =>
      db.query<{ institution_id: string | null }>(`SELECT institution_id FROM public.audit_log`),
    );
    expect(entries.rows.length).toBeGreaterThan(0);
    expect(entries.rows.every((r) => r.institution_id === schoolA)).toBe(true);
  });

  it("people outside any school see no schools at all", async () => {
    const seen = await as(db, STRANGER, () => db.query(`SELECT id FROM public.institutions`));
    expect(seen.rows).toHaveLength(0);
  });

  it("nobody can write school tables directly", async () => {
    expect(
      await errorCode(
        as(db, ADMIN_A, () =>
          db.query(`UPDATE public.institutions SET name = 'Hacked' WHERE id = $1`, [schoolA]),
        ),
      ),
    ).toBe("42501");
    expect(
      await errorCode(
        as(db, STRANGER, () =>
          db.query(
            `INSERT INTO public.institution_memberships (institution_id, user_id, role, status) VALUES ($1, $2, 'school_admin', 'active')`,
            [schoolA, STRANGER],
          ),
        ),
      ),
    ).toBe("42501");
  });

  it("a platform admin sees every school", async () => {
    const seen = await as(db, PLATFORM, () => db.query(`SELECT id FROM public.institutions`));
    expect(seen.rows).toHaveLength(2);
  });
});

describe("suspending a school", () => {
  it("removes its members' school roles until it's reactivated", async () => {
    const setStatus = (status: string) => () =>
      db.query(`SELECT public.admin_set_institution_status($1, $2, 'Unpaid licence')`, [
        schoolA,
        status,
      ]);
    await as(db, PLATFORM, setStatus("suspended"));
    expect(await as(db, ADMIN_A, myRoles)).toEqual([]);
    const seen = await as(db, ADMIN_A, () => db.query(`SELECT id FROM public.institutions`));
    expect(seen.rows).toHaveLength(0);
    await as(db, PLATFORM, setStatus("active"));
    expect(await as(db, ADMIN_A, myRoles)).toEqual(["school_admin"]);
  });

  it("a suspended account loses its school roles too", async () => {
    await as(db, PLATFORM, () =>
      db.query(`SELECT public.admin_set_account_status($1, 'suspended', 'Investigation')`, [
        ADMIN_A,
      ]),
    );
    expect(await as(db, ADMIN_A, myRoles)).toEqual([]);
  });
});
