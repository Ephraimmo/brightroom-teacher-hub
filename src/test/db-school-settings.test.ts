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

/** Security and rule tests for db/pending/P3-02-school-settings.sql. */

const PLATFORM = "00000000-0000-4000-8000-000000000001";
const ADMIN_A = "00000000-0000-4000-8000-0000000000a1";
const ADMIN_B = "00000000-0000-4000-8000-0000000000b1";
const TEACHER_A = "00000000-0000-4000-8000-0000000000a2";

let db: TestDb;
let schoolA: string;
let schoolB: string;

beforeEach(async () => {
  db = await createTestDatabase(pendingThrough("db/pending/P3-02-school-settings.sql"));
  await addUser(db, PLATFORM, "platform@example.test");
  await addUser(db, ADMIN_A, "head@school-a.test");
  await addUser(db, ADMIN_B, "head@school-b.test");
  await addUser(db, TEACHER_A, "teacher@school-a.test");
  await seedRole(db, PLATFORM, "platform_admin");
  schoolA = await registerSchool(db, PLATFORM, "Sunrise Primary", "head@school-a.test");
  schoolB = await registerSchool(db, PLATFORM, "Riverside High", "head@school-b.test");
  await acceptInvitations(db, ADMIN_A);
  await acceptInvitations(db, ADMIN_B);
  await addMember(db, ADMIN_A, schoolA, "teacher@school-a.test", TEACHER_A);
}, 60_000);

const saveYear = (
  school: string,
  label: string,
  start: string,
  end: string,
  current = false,
  id: string | null = null,
) =>
  db.query<{ id: string }>(`SELECT public.save_academic_year($1, $2, $3, $4, $5, $6) AS id`, [
    school,
    id,
    label,
    start,
    end,
    current,
  ]);
const saveTerm = (year: string, n: number, start: string, end: string) =>
  db.query<{ id: string }>(`SELECT public.save_term($1, $2::smallint, $3, $4) AS id`, [
    year,
    n,
    start,
    end,
  ]);
const periods = (school: string, today = "2027-04-20") =>
  db.query<Record<string, unknown>>(`SELECT * FROM public.academic_periods($1, $2)`, [
    school,
    today,
  ]);

async function year2027(): Promise<string> {
  const { rows } = await as(db, ADMIN_A, () =>
    saveYear(schoolA, "2027", "2027-01-13", "2027-12-08", true),
  );
  const id = rows[0]!.id;
  await as(db, ADMIN_A, async () => {
    await saveTerm(id, 1, "2027-01-13", "2027-03-27");
    await saveTerm(id, 2, "2027-04-07", "2027-06-26");
  });
  return id;
}

describe("academic years and terms", () => {
  it("a school admin sets up a year with terms", async () => {
    await year2027();
    const { rows } = await as(db, TEACHER_A, () => periods(schoolA));
    expect(rows.map((r) => [r["year_label"], r["term_number"]])).toEqual([
      ["2027", 1],
      ["2027", 2],
    ]);
  });

  it("marks the current year and the term that contains today", async () => {
    await year2027();
    const { rows } = await as(db, ADMIN_A, () => periods(schoolA, "2027-05-02"));
    expect(rows.find((r) => r["term_is_current"])?.["term_number"]).toBe(2);
    expect(rows.every((r) => r["year_is_current"])).toBe(true);
  });

  it("between terms, the next term counts as current", async () => {
    await year2027();
    const { rows } = await as(db, ADMIN_A, () => periods(schoolA, "2027-04-01"));
    expect(rows.find((r) => r["term_is_current"])?.["term_number"]).toBe(2);
  });

  it("only one year is current at a time", async () => {
    await year2027();
    await as(db, ADMIN_A, () => saveYear(schoolA, "2028", "2028-01-12", "2028-12-06", true));
    const { rows } = await db.query<{ label: string }>(
      `SELECT label FROM public.academic_years WHERE institution_id = $1 AND is_current`,
      [schoolA],
    );
    expect(rows).toEqual([{ label: "2028" }]);
  });

  it("refuses overlapping years and terms, and terms outside their year", async () => {
    const year = await year2027();
    expect(
      await errorCode(
        as(db, ADMIN_A, () => saveYear(schoolA, "2027b", "2027-06-01", "2028-02-01")),
      ),
    ).toBe("LBR41");
    expect(
      await errorCode(as(db, ADMIN_A, () => saveTerm(year, 3, "2027-06-20", "2027-09-20"))),
    ).toBe("LBR41");
    expect(
      await errorCode(as(db, ADMIN_A, () => saveTerm(year, 4, "2027-10-01", "2028-01-20"))),
    ).toBe("LBR42");
    expect(
      await errorCode(
        as(db, ADMIN_A, () => saveYear(schoolA, "2027", "2027-02-01", "2027-12-08", true, year)),
      ),
    ).toBe("LBR42");
  });

  it("checks dates and labels", async () => {
    expect(
      await errorCode(as(db, ADMIN_A, () => saveYear(schoolA, "2027", "2027-12-01", "2027-01-01"))),
    ).toBe("LBR40");
    expect(
      await errorCode(as(db, ADMIN_A, () => saveYear(schoolA, "2027", "2027-01-01", "2029-01-01"))),
    ).toBe("LBR40");
    expect(
      await errorCode(as(db, ADMIN_A, () => saveYear(schoolA, "x", "2027-01-01", "2027-12-01"))),
    ).toBe("LBR40");
  });

  it("another school can't see or change these years", async () => {
    const year = await year2027();
    expect(await errorCode(as(db, ADMIN_B, () => periods(schoolA)))).toBe("42501");
    const seen = await as(db, ADMIN_B, () => db.query(`SELECT * FROM public.academic_years`));
    expect(seen.rows).toHaveLength(0);
    expect(
      await errorCode(as(db, ADMIN_B, () => saveTerm(year, 3, "2027-07-10", "2027-09-20"))),
    ).toBe("42501");
    expect(
      await errorCode(as(db, ADMIN_B, () => saveYear(schoolA, "2029", "2029-01-10", "2029-12-01"))),
    ).toBe("42501");
  });

  it("teachers can read the calendar but not change it", async () => {
    const year = await year2027();
    expect(
      await errorCode(as(db, TEACHER_A, () => saveTerm(year, 3, "2027-07-10", "2027-09-20"))),
    ).toBe("42501");
  });

  it("every change is audited against the school", async () => {
    await year2027();
    const { rows } = await db.query<{ action: string; institution_id: string }>(
      `SELECT action, institution_id FROM public.audit_log WHERE action LIKE 'school.%' ORDER BY id`,
    );
    expect(rows.map((r) => r.action)).toEqual([
      "school.year_create",
      "school.term_save",
      "school.term_save",
    ]);
    expect(rows.every((r) => r.institution_id === schoolA)).toBe(true);
  });
});

describe("school details, grades and policies", () => {
  const update = (school: string, name = "Sunrise Primary School", phone: string | null = null) =>
    db.query<{ ok: boolean }>(
      `SELECT public.update_institution_profile($1, $2, null, 'GP', 'Johannesburg East', '12 Main Rd', 'office@sunrise.test', $3) AS ok`,
      [school, name, phone],
    );

  it("a school admin updates their school's details", async () => {
    const { rows } = await as(db, ADMIN_A, () => update(schoolA));
    expect(rows[0]?.ok).toBe(true);
    const settings = await as(db, TEACHER_A, () =>
      db.query<{ name: string; district: string }>(
        `SELECT name, district FROM public.institution_settings($1)`,
        [schoolA],
      ),
    );
    expect(settings.rows[0]).toEqual({
      name: "Sunrise Primary School",
      district: "Johannesburg East",
    });
  });

  it("refuses bad details and other schools' admins", async () => {
    expect(await errorCode(as(db, ADMIN_A, () => update(schoolA, "S")))).toBe("LBR40");
    expect(await errorCode(as(db, ADMIN_A, () => update(schoolA, "Valid", "0111234567")))).toBe(
      "LBR40",
    );
    expect(await errorCode(as(db, ADMIN_B, () => update(schoolA)))).toBe("42501");
    expect(await errorCode(as(db, TEACHER_A, () => update(schoolA)))).toBe("42501");
  });

  it("stores the grades the school offers, known grades only", async () => {
    await as(db, ADMIN_A, () =>
      db.query(`SELECT public.set_institution_grades($1, ARRAY['G01','G02','G00'])`, [schoolA]),
    );
    const { rows } = await as(db, ADMIN_A, () =>
      db.query<{ grades: string[] }>(`SELECT grades FROM public.institution_settings($1)`, [
        schoolA,
      ]),
    );
    expect(rows[0]?.grades).toEqual(["G00", "G01", "G02"]);
    expect(
      await errorCode(
        as(db, ADMIN_A, () =>
          db.query(`SELECT public.set_institution_grades($1, ARRAY['G13'])`, [schoolA]),
        ),
      ),
    ).toBe("LBR40");
  });

  it("stores only known on/off policies", async () => {
    const set = (json: string) => () =>
      db.query(`SELECT public.update_institution_policies($1, $2::jsonb)`, [schoolA, json]);
    await as(db, ADMIN_A, set(`{"lesson_recording": false, "ai_assistance": true}`));
    const { rows } = await as(db, TEACHER_A, () =>
      db.query<{ policies: Record<string, boolean> }>(
        `SELECT policies FROM public.institution_settings($1)`,
        [schoolA],
      ),
    );
    expect(rows[0]?.policies).toEqual({ lesson_recording: false, ai_assistance: true });
    expect(await errorCode(as(db, ADMIN_A, set(`{"surveillance": true}`)))).toBe("LBR40");
    expect(await errorCode(as(db, ADMIN_A, set(`{"ai_assistance": "yes"}`)))).toBe("LBR40");
  });

  it("everyone signed in can read the grade list", async () => {
    const { rows } = await as(db, TEACHER_A, () =>
      db.query(`SELECT code FROM public.grade_levels`),
    );
    expect(rows).toHaveLength(16);
  });
});
