// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";

import { addUser, as, createTestDatabase, errorCode, seedRole, type TestDb } from "./db/harness";

/**
 * Security tests for db/pending/P2-03-role-assignment.sql, run as real
 * database users against Postgres (PGlite). These check what the DATABASE
 * allows, whatever the screens do.
 */

const ADMIN = "00000000-0000-4000-8000-000000000001";
const TEACHER = "00000000-0000-4000-8000-000000000002";
const PARENT = "00000000-0000-4000-8000-000000000003";
const NEWBIE = "00000000-0000-4000-8000-000000000004";

let db: TestDb;

beforeEach(async () => {
  db = await createTestDatabase(["db/pending/P2-03-role-assignment.sql"]);
  await addUser(db, ADMIN, "admin@example.test", "Pat Admin");
  await addUser(db, TEACHER, "teacher@example.test", "Tumi Teacher");
  await addUser(db, PARENT, "parent@example.test", "Pam Parent");
  await addUser(db, NEWBIE, "New.User@Example.test", "Nia New");
  await seedRole(db, ADMIN, "platform_admin");
  await seedRole(db, TEACHER, "teacher");
  await seedRole(db, PARENT, "parent");
  // Starting Postgres in memory can take a while when every test file runs at once.
}, 60_000);

const find = (email: string) =>
  db.query<{ user_id: string; email: string; full_name: string; roles: string }>(
    `SELECT * FROM public.admin_find_user($1)`,
    [email],
  );
const grant = (userId: string, role: string, reason: string | null = "Pilot teacher at school A") =>
  db.query<{ admin_grant_role: boolean }>(`SELECT public.admin_grant_role($1, $2, $3)`, [
    userId,
    role,
    reason,
  ]);
const revoke = (userId: string, role: string, reason: string | null = "Left the pilot") =>
  db.query<{ admin_revoke_role: boolean }>(`SELECT public.admin_revoke_role($1, $2, $3)`, [
    userId,
    role,
    reason,
  ]);
const rolesOf = async (userId: string) =>
  (
    await db.query<{ role: string }>(
      `SELECT role FROM public.user_roles WHERE user_id = $1 ORDER BY role`,
      [userId],
    )
  ).rows.map((r) => r.role);
const auditRows = () =>
  db
    .query<Record<string, unknown>>(`SELECT * FROM public.audit_log ORDER BY id`)
    .then((r) => r.rows);

describe("is_platform_admin()", () => {
  it("is true only for platform admins", async () => {
    const check = () => db.query<{ ok: boolean }>(`SELECT public.is_platform_admin() AS ok`);
    expect((await as(db, ADMIN, check)).rows[0]?.ok).toBe(true);
    expect((await as(db, TEACHER, check)).rows[0]?.ok).toBe(false);
    expect(await errorCode(as(db, null, check))).toBe("42501");
  });
});

describe("platform admin", () => {
  it("finds one user by exact email, ignoring case and spaces", async () => {
    const { rows } = await as(db, ADMIN, () => find("  new.user@EXAMPLE.test "));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ user_id: NEWBIE, full_name: "Nia New" });

    const teacher = await as(db, ADMIN, () => find("teacher@example.test"));
    expect(String(teacher.rows[0]?.roles)).toContain("teacher");
  });

  it("can't browse: a partial email finds nobody", async () => {
    expect((await as(db, ADMIN, () => find("example.test"))).rows).toHaveLength(0);
    expect((await as(db, ADMIN, () => find("%"))).rows).toHaveLength(0);
  });

  it("grants a role and records who, what, when and why", async () => {
    const result = await as(db, ADMIN, () => grant(NEWBIE, "teacher"));
    expect(result.rows[0]?.admin_grant_role).toBe(true);
    expect(await rolesOf(NEWBIE)).toEqual(["teacher"]);

    const [entry] = await auditRows();
    expect(entry).toMatchObject({
      actor_user_id: ADMIN,
      actor_role: "platform_admin",
      action: "role.grant",
      entity_type: "user",
      entity_id: NEWBIE,
      after: { role: "teacher" },
      reason: "Pilot teacher at school A",
    });
    expect(entry?.["occurred_at"]).toBeInstanceOf(Date);
  });

  it("does nothing and logs nothing when the user already has the role", async () => {
    const result = await as(db, ADMIN, () => grant(TEACHER, "teacher"));
    expect(result.rows[0]?.admin_grant_role).toBe(false);
    expect(await auditRows()).toHaveLength(0);
  });

  it("revokes a role and records it", async () => {
    const result = await as(db, ADMIN, () => revoke(TEACHER, "teacher"));
    expect(result.rows[0]?.admin_revoke_role).toBe(true);
    expect(await rolesOf(TEACHER)).toEqual([]);
    expect(await auditRows()).toMatchObject([
      { action: "role.revoke", entity_id: TEACHER, before: { role: "teacher" } },
    ]);
  });

  it("can't remove their own platform admin role", async () => {
    expect(await errorCode(as(db, ADMIN, () => revoke(ADMIN, "platform_admin")))).toBe("LBR01");
    expect(await rolesOf(ADMIN)).toEqual(["platform_admin"]);
  });

  it("must give a reason", async () => {
    expect(await errorCode(as(db, ADMIN, () => grant(NEWBIE, "teacher", null)))).toBe("LBR02");
    expect(await errorCode(as(db, ADMIN, () => grant(NEWBIE, "teacher", "  ")))).toBe("LBR02");
    expect(await errorCode(as(db, ADMIN, () => revoke(TEACHER, "teacher", "")))).toBe("LBR02");
    expect(await rolesOf(NEWBIE)).toEqual([]);
  });

  it("gets a clear error for an unknown user", async () => {
    const ghost = "00000000-0000-4000-8000-0000000000ff";
    expect(await errorCode(as(db, ADMIN, () => grant(ghost, "teacher")))).toBe("LBR03");
  });

  it("can read the audit log", async () => {
    await as(db, ADMIN, () => grant(NEWBIE, "parent"));
    const rows = await as(db, ADMIN, () => db.query(`SELECT * FROM public.audit_log`));
    expect(rows.rows).toHaveLength(1);
  });
});

describe("everyone else", () => {
  for (const [who, id] of [
    ["teacher", TEACHER],
    ["parent", PARENT],
    ["user with no role", NEWBIE],
  ] as const) {
    it(`a ${who} can't look up, grant or revoke`, async () => {
      expect(await errorCode(as(db, id, () => find("admin@example.test")))).toBe("42501");
      expect(await errorCode(as(db, id, () => grant(id, "platform_admin")))).toBe("42501");
      expect(await errorCode(as(db, id, () => revoke(ADMIN, "platform_admin")))).toBe("42501");
      expect(await rolesOf(ADMIN)).toEqual(["platform_admin"]);
    });

    it(`a ${who} can't write roles directly or read the audit log`, async () => {
      await as(db, ADMIN, () => grant(NEWBIE, "learner"));
      const insert = () =>
        db.query(`INSERT INTO public.user_roles (user_id, role) VALUES ($1, 'platform_admin')`, [
          id,
        ]);
      expect(await errorCode(as(db, id, insert))).toBe("42501");
      const audit = await as(db, id, () => db.query(`SELECT * FROM public.audit_log`));
      expect(audit.rows).toHaveLength(0);
    });
  }

  it("a user only sees their own roles", async () => {
    const { rows } = await as(db, TEACHER, () => db.query(`SELECT user_id FROM public.user_roles`));
    expect(rows).toEqual([{ user_id: TEACHER }]);
  });

  it("signed-out visitors can't call any of it", async () => {
    expect(await errorCode(as(db, null, () => find("admin@example.test")))).toBe("42501");
    expect(await errorCode(as(db, null, () => grant(NEWBIE, "teacher")))).toBe("42501");
  });
});

describe("audit log is append-only", () => {
  beforeEach(async () => {
    await as(db, ADMIN, () => grant(NEWBIE, "teacher"));
  });

  it("not even a platform admin can change or delete entries", async () => {
    expect(
      await errorCode(as(db, ADMIN, () => db.query(`UPDATE public.audit_log SET reason = 'x'`))),
    ).toBe("42501");
    expect(await errorCode(as(db, ADMIN, () => db.query(`DELETE FROM public.audit_log`)))).toBe(
      "42501",
    );
  });

  it("not even the database owner can change, delete or empty it", async () => {
    expect(await errorCode(db.query(`UPDATE public.audit_log SET reason = 'x'`))).toBe("42501");
    expect(await errorCode(db.query(`DELETE FROM public.audit_log`))).toBe("42501");
    expect(await errorCode(db.query(`TRUNCATE public.audit_log`))).toBe("42501");
    expect(await auditRows()).toHaveLength(1);
  });
});

describe("existing behaviour still works", () => {
  it("new accounts still get a profile", async () => {
    const { rows } = await db.query<{ full_name: string }>(
      `SELECT full_name FROM public.profiles WHERE id = $1`,
      [NEWBIE],
    );
    expect(rows[0]?.full_name).toBe("Nia New");
  });

  it("has_role() still answers for the signed-in user", async () => {
    const check = () =>
      db.query<{ ok: boolean }>(`SELECT public.has_role($1, 'teacher') AS ok`, [TEACHER]);
    expect((await as(db, TEACHER, check)).rows[0]?.ok).toBe(true);
  });
});
