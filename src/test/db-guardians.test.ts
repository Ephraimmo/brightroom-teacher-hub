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

/** Security tests for db/pending/P3-04-guardians.sql. */

const PLATFORM = "00000000-0000-4000-8000-000000000001";
const ADMIN_A = "00000000-0000-4000-8000-0000000000a1";
const TEACHER_A = "00000000-0000-4000-8000-0000000000a2";
const ADMIN_B = "00000000-0000-4000-8000-0000000000b1";
const PARENT = "00000000-0000-4000-8000-0000000000d1";
const OTHER = "00000000-0000-4000-8000-0000000000d2";

let db: TestDb;
let schoolA: string;
let schoolB: string;

beforeEach(async () => {
  db = await createTestDatabase(pendingThrough("db/pending/P3-04-guardians.sql"));
  await addUser(db, PLATFORM, "platform@example.test");
  await addUser(db, ADMIN_A, "head@school-a.test");
  await addUser(db, TEACHER_A, "teacher@school-a.test");
  await addUser(db, ADMIN_B, "head@school-b.test");
  await addUser(db, PARENT, "mpho@example.test", "Mpho Parent");
  await addUser(db, OTHER, "other@example.test");
  await seedRole(db, PLATFORM, "platform_admin");
  schoolA = await registerSchool(db, PLATFORM, "Sunrise Primary", "head@school-a.test");
  schoolB = await registerSchool(db, PLATFORM, "Riverside High", "head@school-b.test");
  await acceptInvitations(db, ADMIN_A);
  await acceptInvitations(db, ADMIN_B);
  await addMember(db, ADMIN_A, schoolA, "teacher@school-a.test", TEACHER_A);
}, 60_000);

interface Details {
  first?: string;
  last?: string;
  relationship?: string | null;
  email?: string | null;
  phone?: string | null;
  language?: string;
  cEmail?: boolean;
  cSms?: boolean;
  cWhatsapp?: boolean;
}
const args = (d: Details) => [
  d.first ?? "Mpho",
  d.last ?? "Dlamini",
  d.relationship === undefined ? "mother" : d.relationship,
  d.email === undefined ? "Mpho@Example.test" : d.email,
  d.phone === undefined ? "+27821234567" : d.phone,
  d.language ?? "zu",
  d.cEmail ?? true,
  d.cSms ?? false,
  d.cWhatsapp ?? true,
];
const add = (school: string, d: Details = {}) =>
  db.query<{ id: string }>(
    `SELECT public.add_guardian($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) AS id`,
    [school, ...args(d)],
  );
const update = (id: string, d: Details = {}) =>
  db.query(`SELECT public.update_guardian($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`, [
    id,
    ...args(d),
  ]);
const list = (school: string) =>
  db.query<Record<string, unknown>>(`SELECT * FROM public.school_guardians($1)`, [school]);
const myRoles = () =>
  db.query<{ r: string }>(`SELECT r FROM public.my_roles() r`).then((x) => x.rows.map((r) => r.r));

async function addMpho(): Promise<string> {
  const { rows } = await as(db, ADMIN_A, () => add(schoolA));
  return rows[0]!.id;
}

describe("adding parents and guardians", () => {
  it("a school admin adds a parent with relationship and contact choices", async () => {
    await addMpho();
    const { rows } = await as(db, ADMIN_A, () => list(schoolA));
    expect(rows[0]).toMatchObject({
      first_name: "Mpho",
      relationship: "mother",
      email: "mpho@example.test",
      phone: "+27821234567",
      contact_whatsapp: true,
      has_account: false,
      status: "active",
    });
  });

  it.each([
    ["no name", { first: " " }, "LBR60"],
    ["a bad email", { email: "nope" }, "LBR60"],
    ["a landline as mobile", { phone: "+27111234567" }, "LBR60"],
    [
      "no email and no mobile",
      { email: null, phone: null, cEmail: false, cWhatsapp: false },
      "LBR60",
    ],
    ["WhatsApp without a mobile", { phone: null }, "LBR60"],
    ["email contact without an email", { email: null }, "LBR60"],
    ["no relationship", { relationship: null }, "LBR60"],
    ["an unknown language", { language: "fr" }, "LBR60"],
  ])("refuses %s", async (_label, details, code) => {
    expect(await errorCode(as(db, ADMIN_A, () => add(schoolA, details)))).toBe(code);
  });

  it("won't put the same email on two active records at one school", async () => {
    await addMpho();
    expect(await errorCode(as(db, ADMIN_A, () => add(schoolA, { first: "Other" })))).toBe("LBR61");
    // A different school may have the same parent.
    await as(db, ADMIN_B, () => add(schoolB));
  });

  it("teachers and other schools can't add or read parents", async () => {
    await addMpho();
    expect(await errorCode(as(db, TEACHER_A, () => add(schoolA)))).toBe("42501");
    expect(await errorCode(as(db, ADMIN_B, () => add(schoolA)))).toBe("42501");
    expect(await errorCode(as(db, TEACHER_A, () => list(schoolA)))).toBe("42501");
    expect(await errorCode(as(db, ADMIN_B, () => list(schoolA)))).toBe("42501");
    const direct = await as(db, TEACHER_A, () => db.query(`SELECT * FROM public.guardians`));
    expect(direct.rows).toHaveLength(0);
    const other = await as(db, ADMIN_B, () => db.query(`SELECT * FROM public.guardians`));
    expect(other.rows).toHaveLength(0);
  });

  it("the audit log never holds contact details", async () => {
    const id = await addMpho();
    await as(db, ADMIN_A, () => update(id, { phone: "+27831234567" }));
    const { rows } = await db.query(
      `SELECT * FROM public.audit_log WHERE entity_type = 'guardian'`,
    );
    const text = JSON.stringify(rows);
    expect(text).not.toContain("mpho@example.test");
    expect(text).not.toContain("821234567");
    expect(text).not.toContain("831234567");
    expect(text).toContain("phone");
  });
});

describe("editing and archiving", () => {
  it("updates details, and another school gets 'not found'", async () => {
    const id = await addMpho();
    await as(db, ADMIN_A, () => update(id, { relationship: "grandparent" }));
    const { rows } = await as(db, ADMIN_A, () => list(schoolA));
    expect(rows[0]?.["relationship"]).toBe("grandparent");
    expect(await errorCode(as(db, ADMIN_B, () => update(id)))).toBe("LBR03");
  });

  it("archives with a reason and restores, keeping the record", async () => {
    const id = await addMpho();
    const status =
      (s: string, reason = "Family moved") =>
      () =>
        db.query(`SELECT public.set_guardian_status($1, $2, $3)`, [id, s, reason]);
    expect(await errorCode(as(db, ADMIN_A, status("archived", "")))).toBe("LBR02");
    await as(db, ADMIN_A, status("archived"));
    expect((await as(db, ADMIN_A, () => list(schoolA))).rows[0]?.["status"]).toBe("archived");
    // An archived record frees the email for a new record...
    await as(db, ADMIN_A, () => add(schoolA, { first: "New" }));
    // ...so restoring the old one would clash.
    expect(await errorCode(as(db, ADMIN_A, status("active", "Back")))).toBe("LBR61");
  });
});

describe("parents claiming their record", () => {
  it("a parent signs in with the same email, claims it, and becomes a parent", async () => {
    const id = await addMpho();
    const offers = await as(db, PARENT, () =>
      db.query<{ id: string; institution_name: string }>(
        `SELECT * FROM public.my_guardian_invitations()`,
      ),
    );
    expect(offers.rows).toEqual([
      expect.objectContaining({ id, institution_name: "Sunrise Primary" }),
    ]);
    await as(db, PARENT, () => db.query(`SELECT public.claim_guardian_record($1)`, [id]));
    expect(await as(db, PARENT, myRoles)).toEqual(["parent"]);
    const own = await as(db, PARENT, () => db.query(`SELECT first_name FROM public.guardians`));
    expect(own.rows).toEqual([{ first_name: "Mpho" }]);
  });

  it("someone with a different email can't claim it", async () => {
    const id = await addMpho();
    expect(
      await errorCode(
        as(db, OTHER, () => db.query(`SELECT public.claim_guardian_record($1)`, [id])),
      ),
    ).toBe("LBR62");
  });

  it("an unconfirmed email can't claim it", async () => {
    const id = await addMpho();
    await db.query(`UPDATE auth.users SET email_confirmed_at = NULL WHERE id = $1`, [PARENT]);
    expect(
      await errorCode(
        as(db, PARENT, () => db.query(`SELECT public.claim_guardian_record($1)`, [id])),
      ),
    ).toBe("LBR62");
  });

  it("archiving the record removes the parent role; the email can't be changed after claiming", async () => {
    const id = await addMpho();
    await as(db, PARENT, () => db.query(`SELECT public.claim_guardian_record($1)`, [id]));
    expect(await errorCode(as(db, ADMIN_A, () => update(id, { email: "new@example.test" })))).toBe(
      "LBR60",
    );
    await as(db, ADMIN_A, () =>
      db.query(`SELECT public.set_guardian_status($1, 'archived', 'Duplicate record')`, [id]),
    );
    expect(await as(db, PARENT, myRoles)).toEqual([]);
  });

  it("parents can't edit records directly", async () => {
    const id = await addMpho();
    await as(db, PARENT, () => db.query(`SELECT public.claim_guardian_record($1)`, [id]));
    expect(
      await errorCode(
        as(db, PARENT, () =>
          db.query(`UPDATE public.guardians SET status = 'active' WHERE id = $1`, [id]),
        ),
      ),
    ).toBe("42501");
  });
});
