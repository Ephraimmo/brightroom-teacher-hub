// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";

import { addUser, as, createTestDatabase, errorCode, type TestDb } from "./db/harness";

/**
 * Security tests for db/pending/P2-04-profile-management.sql, run as real
 * database users against Postgres (PGlite).
 */

const AMY = "00000000-0000-4000-8000-0000000000a1";
const BEN = "00000000-0000-4000-8000-0000000000b2";

let db: TestDb;

beforeEach(async () => {
  db = await createTestDatabase([
    "db/pending/P2-03-role-assignment.sql",
    "db/pending/P2-04-profile-management.sql",
  ]);
  await addUser(db, AMY, "amy@example.test", "Amy Learner");
  await addUser(db, BEN, "ben@example.test", "Ben Parent");
}, 60_000);

interface Update {
  fullName?: string | null;
  displayName?: string | null;
  phone?: string | null;
  language?: string | null;
  email?: boolean;
  sms?: boolean;
  whatsapp?: boolean;
}

const update = (u: Update = {}) =>
  db.query<{ update_my_profile: boolean }>(
    `SELECT public.update_my_profile($1, $2, $3, $4, $5, $6, $7)`,
    [
      u.fullName === undefined ? "Amy Learner" : u.fullName,
      u.displayName === undefined ? "Amy" : u.displayName,
      u.phone === undefined ? "+27821234567" : u.phone,
      u.language === undefined ? "zu" : u.language,
      u.email ?? true,
      u.sms ?? true,
      u.whatsapp ?? false,
    ],
  );

const profileOf = async (id: string) =>
  (await db.query<Record<string, unknown>>(`SELECT * FROM public.profiles WHERE id = $1`, [id]))
    .rows[0];
const auditRows = () =>
  db
    .query<Record<string, unknown>>(`SELECT * FROM public.audit_log ORDER BY id`)
    .then((r) => r.rows);
const upload = (owner: string, name: string) =>
  db.query(`INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('avatars', $1, $2)`, [
    name,
    owner,
  ]);
const setAvatar = (path: string | null) =>
  db.query<{ set_my_avatar: boolean }>(`SELECT public.set_my_avatar($1)`, [path]);

describe("update_my_profile()", () => {
  it("saves the new fields for the signed-in user only", async () => {
    const result = await as(db, AMY, () => update());
    expect(result.rows[0]?.update_my_profile).toBe(true);
    expect(await profileOf(AMY)).toMatchObject({
      full_name: "Amy Learner",
      display_name: "Amy",
      phone: "+27821234567",
      preferred_language: "zu",
      contact_email: true,
      contact_sms: true,
      contact_whatsapp: false,
    });
    expect(await profileOf(BEN)).toMatchObject({ phone: null, preferred_language: "en" });
  });

  it("records which fields changed, but not their values", async () => {
    await as(db, AMY, () => update());
    const [entry] = await auditRows();
    expect(entry).toMatchObject({
      actor_user_id: AMY,
      actor_role: "self",
      action: "profile.update",
      entity_id: AMY,
    });
    expect((entry?.["after"] as { fields: string[] }).fields).toEqual(
      expect.arrayContaining(["display_name", "phone", "preferred_language", "contact_sms"]),
    );
    expect(JSON.stringify(entry)).not.toContain("821234567");
  });

  it("does nothing and logs nothing when nothing changed", async () => {
    await as(db, AMY, () => update());
    const again = await as(db, AMY, () => update());
    expect(again.rows[0]?.update_my_profile).toBe(false);
    expect(await auditRows()).toHaveLength(1);
  });

  it("clears the display name and phone when they're left empty", async () => {
    await as(db, AMY, () => update());
    await as(db, AMY, () => update({ displayName: "  ", phone: "", sms: false }));
    expect(await profileOf(AMY)).toMatchObject({ display_name: null, phone: null });
  });

  it.each([
    ["an empty name", { fullName: "   " }, "LBR10"],
    ["a name over 100 characters", { fullName: "x".repeat(101) }, "LBR10"],
    ["a display name over 60 characters", { displayName: "x".repeat(61) }, "LBR11"],
    ["a landline", { phone: "+27111234567" }, "LBR12"],
    ["a local-format number", { phone: "0821234567" }, "LBR12"],
    ["an unknown language", { language: "fr" }, "LBR13"],
    ["SMS without a phone", { phone: null, sms: true }, "LBR14"],
    ["WhatsApp without a phone", { phone: null, sms: false, whatsapp: true }, "LBR14"],
  ])("rejects %s", async (_label, values, code) => {
    expect(await errorCode(as(db, AMY, () => update(values)))).toBe(code);
    expect(await profileOf(AMY)).toMatchObject({ phone: null, preferred_language: "en" });
  });

  it("can't be called signed out", async () => {
    expect(await errorCode(as(db, null, () => update()))).toBe("42501");
  });

  it("direct edits to the profile table are no longer allowed", async () => {
    const direct = () =>
      db.query(`UPDATE public.profiles SET full_name = 'Hacked' WHERE id = $1`, [AMY]);
    expect(await errorCode(as(db, AMY, direct))).toBe("42501");
    expect(await profileOf(AMY)).toMatchObject({ full_name: "Amy Learner" });
  });

  it("users still read only their own profile", async () => {
    const { rows } = await as(db, AMY, () => db.query(`SELECT id FROM public.profiles`));
    expect(rows).toEqual([{ id: AMY }]);
  });

  it("the table itself refuses bad values, even for the owner", async () => {
    expect(
      await errorCode(db.query(`UPDATE public.profiles SET phone = '123' WHERE id = $1`, [AMY])),
    ).toBe("23514");
    expect(
      await errorCode(
        db.query(`UPDATE public.profiles SET contact_whatsapp = true WHERE id = $1`, [AMY]),
      ),
    ).toBe("23514");
  });
});

describe("profile photos", () => {
  it("users can upload only into their own folder", async () => {
    await as(db, AMY, () => upload(AMY, `${AMY}/photo.webp`));
    expect(await errorCode(as(db, AMY, () => upload(AMY, `${BEN}/photo.webp`)))).toBe("42501");
  });

  it("users can't see or delete someone else's photo", async () => {
    await as(db, BEN, () => upload(BEN, `${BEN}/photo.webp`));
    const seen = await as(db, AMY, () => db.query(`SELECT name FROM storage.objects`));
    expect(seen.rows).toHaveLength(0);
    await as(db, AMY, () => db.query(`DELETE FROM storage.objects`));
    expect((await db.query(`SELECT name FROM storage.objects`)).rows).toHaveLength(1);
  });

  it("the bucket is private", async () => {
    const { rows } = await db.query<{ public: boolean }>(
      `SELECT public FROM storage.buckets WHERE id = 'avatars'`,
    );
    expect(rows[0]?.public).toBe(false);
  });

  it("sets and removes the photo, with audit entries", async () => {
    await as(db, AMY, () => upload(AMY, `${AMY}/photo.webp`));
    expect((await as(db, AMY, () => setAvatar(`${AMY}/photo.webp`))).rows[0]?.set_my_avatar).toBe(
      true,
    );
    expect(await profileOf(AMY)).toMatchObject({ avatar_url: `${AMY}/photo.webp` });
    await as(db, AMY, () => setAvatar(null));
    expect(await profileOf(AMY)).toMatchObject({ avatar_url: null });
    expect((await auditRows()).map((r) => r["action"])).toEqual([
      "profile.photo_set",
      "profile.photo_remove",
    ]);
  });

  it("can't point at someone else's photo or a file that doesn't exist", async () => {
    await as(db, BEN, () => upload(BEN, `${BEN}/photo.webp`));
    expect(await errorCode(as(db, AMY, () => setAvatar(`${BEN}/photo.webp`)))).toBe("LBR15");
    expect(await errorCode(as(db, AMY, () => setAvatar(`${AMY}/missing.webp`)))).toBe("LBR15");
  });
});

describe("existing behaviour still works", () => {
  it("new accounts get a profile with safe defaults", async () => {
    expect(await profileOf(AMY)).toMatchObject({
      full_name: "Amy Learner",
      preferred_language: "en",
      contact_email: true,
      contact_sms: false,
      contact_whatsapp: false,
    });
  });
});
