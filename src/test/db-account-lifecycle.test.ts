// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";

import { addUser, as, createTestDatabase, errorCode, seedRole, type TestDb } from "./db/harness";

/**
 * Security tests for db/pending/P2-05-account-lifecycle.sql, run as real
 * database users against Postgres (PGlite).
 */

const ADMIN = "00000000-0000-4000-8000-000000000001";
const ADMIN2 = "00000000-0000-4000-8000-000000000005";
const TEACHER = "00000000-0000-4000-8000-000000000002";
const PARENT = "00000000-0000-4000-8000-000000000003";

let db: TestDb;

beforeEach(async () => {
  db = await createTestDatabase([
    "db/pending/P2-03-role-assignment.sql",
    "db/pending/P2-04-profile-management.sql",
    "db/pending/P2-05-account-lifecycle.sql",
  ]);
  await addUser(db, ADMIN, "admin@example.test", "Pat Admin");
  await addUser(db, ADMIN2, "admin2@example.test", "Sam Admin");
  await addUser(db, TEACHER, "teacher@example.test", "Tumi Teacher");
  await addUser(db, PARENT, "parent@example.test", "Pam Parent");
  await seedRole(db, ADMIN, "platform_admin");
  await seedRole(db, ADMIN2, "platform_admin");
  await seedRole(db, TEACHER, "teacher");
  await seedRole(db, PARENT, "parent");
}, 60_000);

const setStatus = (userId: string, status: string, reason: string | null = "Policy breach") =>
  db.query<{ admin_set_account_status: boolean }>(
    `SELECT public.admin_set_account_status($1, $2, $3)`,
    [userId, status, reason],
  );
const statusOf = async (userId: string) =>
  (
    await db.query<{ status: string }>(
      `SELECT status FROM public.account_states WHERE user_id = $1`,
      [userId],
    )
  ).rows[0]?.status ?? "active";
const hasRole = (userId: string, role: string) =>
  db.query<{ ok: boolean }>(`SELECT public.has_role($1, $2) AS ok`, [userId, role]);
const auditLog = (
  prefix: string | null = null,
  userId: string | null = null,
  before: number | null = null,
) =>
  db.query<Record<string, unknown>>(`SELECT * FROM public.admin_audit_log($1, $2, $3, $4)`, [
    prefix,
    userId,
    before,
    50,
  ]);

describe("suspending and reactivating", () => {
  it("accounts are active until someone changes them", async () => {
    expect(await statusOf(TEACHER)).toBe("active");
    const ok = await as(db, TEACHER, () => hasRole(TEACHER, "teacher"));
    expect(ok.rows[0]?.ok).toBe(true);
  });

  it("a platform admin suspends an account, and its roles stop counting", async () => {
    const result = await as(db, ADMIN, () => setStatus(TEACHER, "suspended"));
    expect(result.rows[0]?.admin_set_account_status).toBe(true);
    expect(await statusOf(TEACHER)).toBe("suspended");
    expect((await as(db, TEACHER, () => hasRole(TEACHER, "teacher"))).rows[0]?.ok).toBe(false);
  });

  it("the roles themselves are kept, and come back on reactivation", async () => {
    await as(db, ADMIN, () => setStatus(TEACHER, "deactivated"));
    await as(db, ADMIN, () => setStatus(TEACHER, "active", "Back from leave"));
    expect(await statusOf(TEACHER)).toBe("active");
    expect((await as(db, TEACHER, () => hasRole(TEACHER, "teacher"))).rows[0]?.ok).toBe(true);
  });

  it("records who, what, when and why, with the before and after status", async () => {
    await as(db, ADMIN, () => setStatus(TEACHER, "suspended"));
    const { rows } = await db.query<Record<string, unknown>>(`SELECT * FROM public.audit_log`);
    expect(rows).toMatchObject([
      {
        actor_user_id: ADMIN,
        action: "account.suspend",
        entity_id: TEACHER,
        before: { status: "active" },
        after: { status: "suspended" },
        reason: "Policy breach",
      },
    ]);
  });

  it("does nothing and logs nothing when the status is the same", async () => {
    const result = await as(db, ADMIN, () => setStatus(TEACHER, "active"));
    expect(result.rows[0]?.admin_set_account_status).toBe(false);
    expect((await db.query(`SELECT 1 FROM public.audit_log`)).rows).toHaveLength(0);
  });

  it("needs a reason, a real user, and someone else's account", async () => {
    expect(await errorCode(as(db, ADMIN, () => setStatus(TEACHER, "suspended", " ")))).toBe(
      "LBR02",
    );
    const ghost = "00000000-0000-4000-8000-0000000000ff";
    expect(await errorCode(as(db, ADMIN, () => setStatus(ghost, "suspended")))).toBe("LBR03");
    expect(await errorCode(as(db, ADMIN, () => setStatus(ADMIN, "suspended")))).toBe("LBR20");
  });

  it("a suspended platform admin loses admin powers", async () => {
    await as(db, ADMIN2, () => setStatus(ADMIN, "suspended"));
    expect(await errorCode(as(db, ADMIN, () => setStatus(TEACHER, "suspended")))).toBe("42501");
    expect(
      await errorCode(
        as(db, ADMIN, () => db.query(`SELECT * FROM public.admin_find_user('x@y.z')`)),
      ),
    ).toBe("42501");
    const audit = await as(db, ADMIN, () => db.query(`SELECT * FROM public.audit_log`));
    expect(audit.rows).toHaveLength(0);
  });

  it("only platform admins can change a status", async () => {
    for (const id of [TEACHER, PARENT]) {
      expect(await errorCode(as(db, id, () => setStatus(PARENT, "suspended")))).toBe("42501");
    }
    expect(await errorCode(as(db, null, () => setStatus(PARENT, "suspended")))).toBe("42501");
  });

  it("nobody can write statuses directly", async () => {
    const insert = () =>
      db.query(`INSERT INTO public.account_states (user_id, status) VALUES ($1, 'active')`, [
        TEACHER,
      ]);
    expect(await errorCode(as(db, TEACHER, insert))).toBe("42501");
    await as(db, ADMIN, () => setStatus(TEACHER, "suspended"));
    const lift = () =>
      db.query(`UPDATE public.account_states SET status = 'active' WHERE user_id = $1`, [TEACHER]);
    expect(await errorCode(as(db, TEACHER, lift))).toBe("42501");
    expect(await errorCode(as(db, ADMIN, lift))).toBe("42501");
    expect(await statusOf(TEACHER)).toBe("suspended");
  });

  it("people see their own status, and admins see everyone's", async () => {
    await as(db, ADMIN, () => setStatus(TEACHER, "suspended"));
    await as(db, ADMIN, () => setStatus(PARENT, "suspended"));
    const own = await as(db, TEACHER, () =>
      db.query(`SELECT user_id, status FROM public.account_states`),
    );
    expect(own.rows).toEqual([{ user_id: TEACHER, status: "suspended" }]);
    const all = await as(db, ADMIN, () => db.query(`SELECT user_id FROM public.account_states`));
    expect(all.rows).toHaveLength(2);
  });
});

describe("privacy", () => {
  it("the person can't read the admin's internal reason", async () => {
    await as(db, ADMIN, () => setStatus(TEACHER, "suspended"));
    const read = () => db.query(`SELECT reason FROM public.account_states`);
    expect(await errorCode(as(db, TEACHER, read))).toBe("42501");
  });
});

describe("admin_audit_log()", () => {
  beforeEach(async () => {
    await as(db, ADMIN, () =>
      db.query(`SELECT public.admin_grant_role($1, 'parent', 'Also a parent')`, [TEACHER]),
    );
    await as(db, ADMIN, () => setStatus(PARENT, "suspended"));
    await as(db, ADMIN, () => setStatus(PARENT, "active", "Resolved"));
  });

  it("lists entries newest first, with emails instead of ids", async () => {
    const { rows } = await as(db, ADMIN, () => auditLog());
    expect(rows.map((r) => r["action"])).toEqual([
      "account.reactivate",
      "account.suspend",
      "role.grant",
    ]);
    expect(rows[0]).toMatchObject({
      actor_email: "admin@example.test",
      target_email: "parent@example.test",
      reason: "Resolved",
    });
  });

  it("filters by action group and by person", async () => {
    const roles = await as(db, ADMIN, () => auditLog("role."));
    expect(roles.rows.map((r) => r["action"])).toEqual(["role.grant"]);
    const parent = await as(db, ADMIN, () => auditLog(null, PARENT));
    expect(parent.rows).toHaveLength(2);
    const actedByAdmin = await as(db, ADMIN, () => auditLog(null, ADMIN));
    expect(actedByAdmin.rows).toHaveLength(3);
  });

  it("pages with the last id shown", async () => {
    const first = await as(db, ADMIN, () => auditLog());
    const oldestShown = Number(first.rows[1]?.["id"]);
    const older = await as(db, ADMIN, () => auditLog(null, null, oldestShown));
    expect(older.rows.map((r) => r["action"])).toEqual(["role.grant"]);
  });

  it("is for platform admins only", async () => {
    expect(await errorCode(as(db, TEACHER, () => auditLog()))).toBe("42501");
    expect(await errorCode(as(db, null, () => auditLog()))).toBe("42501");
  });
});
