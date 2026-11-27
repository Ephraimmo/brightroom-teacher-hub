import { as, type TestDb } from "./harness";

/** Register a school as `platformAdmin`; returns its id. */
export async function registerSchool(
  db: TestDb,
  platformAdmin: string,
  name: string,
  firstAdminEmail: string,
  emis: string | null = null,
): Promise<string> {
  const { rows } = await as(db, platformAdmin, () =>
    db.query<{ id: string }>(
      `SELECT public.admin_register_institution($1, 'school', 'GP', $2, 'office@example.test', '+27111234567', $3, 'New pilot school') AS id`,
      [name, emis, firstAdminEmail],
    ),
  );
  return rows[0]!.id;
}

/** Accept every open invitation for `userId`'s email. */
export async function acceptInvitations(db: TestDb, userId: string): Promise<void> {
  await as(db, userId, async () => {
    const { rows } = await db.query<{ id: string }>(`SELECT id FROM public.my_invitations()`);
    for (const row of rows) await db.query(`SELECT public.accept_invitation($1)`, [row.id]);
  });
}

/** Invite `email` to `school` as `role` (as `admin`) and accept it as `userId`. */
export async function addMember(
  db: TestDb,
  admin: string,
  school: string,
  email: string,
  userId: string,
  role: "teacher" | "school_admin" = "teacher",
): Promise<void> {
  await as(db, admin, () =>
    db.query(`SELECT public.create_invitation($1, $2, $3)`, [school, email, role]),
  );
  await acceptInvitations(db, userId);
}
