# Demo mode

Anyone can explore LearnBridge without an account at **`/demo`**. There's also a link on the sign-in page and the landing page. You pick a role and the app fills with sample data.

## What it is

- **No accounts, no passwords, no database.** Demo mode never contacts Lovable Cloud:
  - each service module in `src/lib` checks `isDemo()` first and answers from `src/demo/demo-store.ts`;
  - the sign-in provider, role, account-status and MFA hooks do the same.
- **Changes stay in one browser tab.** Edits are kept in that tab's `sessionStorage`. They last through page reloads and role switches, and are gone when the tab closes.
  - "Reset data" in the demo banner puts the sample data back.
  - "Leave demo" ends demo mode.
- **The same rules as the real app.** The demo store copies the main rules of the `db/pending` SQL, so the screens show the same messages:
  - who may do what;
  - required reasons;
  - duplicate checks (for example, one active email per school);
  - "you can't change your own access" and "keep at least one school admin";
  - the error codes (LBRxx).

  The real rules still live in the database. The demo store is only a stand-in.

- **No two-step sign-in.** Demo accounts count as already verified. Adding or removing authenticator apps is switched off in the demo.
- **Starting the demo signs out any real account in that tab**, so demo and real data never mix. A real sign-in ends demo mode.

## Who you can be

| Role           | Person                    | What to try                                                                                                                                                           |
| -------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Platform admin | Thandi Nkosi              | Admin → Schools (approve _Bright Futures Tutoring_, which is pending), People (find `kagiso.molefe@demo.learnbridge.test`, change roles or account status), Audit log |
| School admin   | Lerato Mokoena, Principal | School → Staff (suspend or reinstate staff, invite people), Parents (add, edit, archive), Settings (details, years and terms, grades, policies)                       |
| Teacher        | Amina Dlamini             | Teaching workspace (sample classes, timetable, homework, resources); My profile shows an invitation from Riverside High to accept                                     |
| Parent         | Mpho Khumalo              | My profile shows a parent record at Riverside High to confirm                                                                                                         |
| Learner        | Ayanda Khumalo            | The learner area (its dashboard is still being built, task P4-04)                                                                                                     |

Each role has its own link: `/demo?as=platform_admin`, `/demo?as=school_admin`, `/demo?as=teacher`, `/demo?as=parent` and `/demo?as=learner`.

## The sample data

The data is in `src/demo/demo-data.ts`:

- **Schools:** Greenridge Learning Centre (Gauteng, Grades 8 to 12), Riverside High School (KwaZulu-Natal) and Bright Futures Tutoring (pending approval).
- **Greenridge's people:** 5 staff, one of them suspended, and an open invitation.
- **Greenridge's parents:** 6 parent and guardian records, one of them archived.
- **Calendar:** the 2026 school year with four terms, plus 2027.
- **Audit history:** a short one.

The emails end in `@demo.learnbridge.test`, which can't receive mail. Every name, EMIS number and phone number is made up. The dataset is meant to be replaced or extended: as new features arrive (learners in P3-05, classes, homework), add their sample records and demo store functions in the same way.

## Adding a feature to the demo

1. Add sample records to `DemoState` and `createDemoSeed()` in `src/demo/demo-data.ts`.
2. Add a function to `src/demo/demo-store.ts` with the same arguments and result as the real service function. Apply the same permission checks and error codes as the SQL.
3. In the service module, make the first line of the function `if (isDemo()) return demo.<name>(...)`.
4. Add a case to `src/test/demo.test.tsx`.

Changing the shape of `DemoState`? Bump `version` in three places: the `DemoState` type, `createDemoSeed()`, and the check in `state()` in the demo store. Tabs holding old saved data then start afresh.
