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

/** Security tests for db/pending/P2-06-mfa.sql. */

const ADMIN = "00000000-0000-4000-8000-000000000001";
const TEACHER = "00000000-0000-4000-8000-000000000002";

let db: TestDb;

beforeEach(async () => {
  db = await createTestDatabase(pendingThrough("db/pending/P2-06-mfa.sql"));
  await addUser(db, ADMIN, "admin@example.test", "Pat Admin");
  await addUser(db, TEACHER, "teacher@example.test", "Tumi Teacher");
  await seedRole(db, ADMIN, "platform_admin");
  await seedRole(db, TEACHER, "teacher");
}, 60_000);

const isAdmin = () => db.query<{ ok: boolean }>(`SELECT public.is_platform_admin() AS ok`);
const grant = () =>
  db.query(`SELECT public.admin_grant_role($1, 'parent', 'Also a parent')`, [TEACHER]);

describe("platform admin powers need MFA", () => {
  it("count only in an MFA-verified session", async () => {
    expect((await as(db, ADMIN, isAdmin, { aal: "aal2" })).rows[0]?.ok).toBe(true);
    expect((await as(db, ADMIN, isAdmin, { aal: "aal1" })).rows[0]?.ok).toBe(false);
  });

  it("without MFA, admin actions and the audit log are refused", async () => {
    expect(await errorCode(as(db, ADMIN, grant, { aal: "aal1" }))).toBe("42501");
    const audit = await as(db, ADMIN, () => db.query(`SELECT * FROM public.audit_log`), {
      aal: "aal1",
    });
    expect(audit.rows).toHaveLength(0);
    // With MFA the same action works.
    await as(db, ADMIN, grant, { aal: "aal2" });
    const after = await as(db, ADMIN, () => db.query(`SELECT * FROM public.audit_log`));
    expect(after.rows).toHaveLength(1);
  });

  it("ordinary roles don't need MFA", async () => {
    const check = () =>
      db.query<{ ok: boolean }>(`SELECT public.has_role($1, 'teacher') AS ok`, [TEACHER]);
    expect((await as(db, TEACHER, check, { aal: "aal1" })).rows[0]?.ok).toBe(true);
  });

  it("MFA doesn't make anyone an admin", async () => {
    expect((await as(db, TEACHER, isAdmin, { aal: "aal2" })).rows[0]?.ok).toBe(false);
  });
});

describe("admin_mfa_factor_count()", () => {
  it("tells a verified admin how many authenticators a person has", async () => {
    await db.query(`INSERT INTO auth.mfa_factors (user_id) VALUES ($1), ($1)`, [TEACHER]);
    await db.query(`INSERT INTO auth.mfa_factors (user_id, status) VALUES ($1, 'unverified')`, [
      TEACHER,
    ]);
    const count = () =>
      db.query<{ n: number }>(`SELECT public.admin_mfa_factor_count($1) AS n`, [TEACHER]);
    expect((await as(db, ADMIN, count)).rows[0]?.n).toBe(2);
    expect(await errorCode(as(db, ADMIN, count, { aal: "aal1" }))).toBe("42501");
    expect(await errorCode(as(db, TEACHER, count))).toBe("42501");
  });
});
