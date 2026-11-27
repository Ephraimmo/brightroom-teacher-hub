# Database changes waiting for Lovable

Lovable owns the database schema (`drizzle/` and `supabase/migrations/`; see `AGENTS.md`). Each database change is written and tested here first, then applied **through Lovable**.

| File                            | Task  | Status                                                                                                                                                        |
| ------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `P2-03-role-assignment.sql`     | P2-03 | Waiting to be applied (screen built: Admin → People)                                                                                                          |
| `P2-04-profile-management.sql`  | P2-04 | Waiting to be applied, **after P2-03** (screen: My profile)                                                                                                   |
| `P2-05-account-lifecycle.sql`   | P2-05 | Waiting to be applied, **after P2-04** (screens: People status, Audit log, suspended notice)                                                                  |
| `P2-06-mfa.sql`                 | P2-06 | Waiting to be applied, **after P2-05**. Afterwards platform admins must set up an authenticator app (My profile → Sign-in security) before admin screens work |
| `P3-01-schools-and-tenancy.sql` | P3-01 | Waiting to be applied, **after P2-06** (screens: Admin → Schools, invitations, school home)                                                                   |
| `P3-02-school-settings.sql`     | P3-02 | Waiting to be applied, **after P3-01** (screen: School → Settings)                                                                                            |
| `P3-03-staff-management.sql`    | P3-03 | Waiting to be applied, **after P3-02** (screen: School → Staff)                                                                                               |

Apply them **in this order**: each file builds on the one before.

## How a change is tested

`src/test/db/harness.ts` starts a throw-away Postgres in memory (PGlite), sets it up like Lovable Cloud (the `anon`, `authenticated` and `service_role` roles, `auth.users`, `auth.uid()`), runs the migrations already applied, then the pending file. The tests sign in as different users and check what the **database** allows. Run them with `npm run test`.

## How to apply one

1. In Lovable, open the chat and paste:

   > Please apply this SQL as a new database migration exactly as written, without changes, then regenerate the Supabase types. It adds an audit log and secure functions for platform admins to assign roles.
   >
   > _(then paste the whole contents of the `.sql` file)_

2. Lovable will ask you to approve the migration. Approve it.
3. Check that Lovable pushed to GitHub: `drizzle/migrations/` (or `supabase/migrations/`) has the new file, and `src/integrations/supabase/types.ts` mentions `admin_grant_role`.
4. Tell Claude it's applied. The file is then marked as applied here.

The Admin → People screen is already built. Until the SQL is applied it shows "Role management isn't switched on in the database yet" instead of failing.

## After P2-03 is applied: make yourself the first platform admin

Only a platform admin can give out roles, so the first one has to be set by hand, once. In **Lovable → Cloud → Database → SQL editor**, run this with your own email:

```sql
insert into public.user_roles (user_id, role)
select id, 'platform_admin' from auth.users where email = 'YOUR-EMAIL-HERE'
on conflict do nothing;
```

From then on, give and remove roles in the app (**Admin → People**). Every change is written to the audit log with your reason.
