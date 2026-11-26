# 8. Testing strategy

**Principle:** a feature isn't "done" until it has been tested in the way that matches its risk (brief rule 20). Money, children's data and school-to-school separation get the strictest tests.

## Test layers

| Layer                 | Tool                                                                                      | What it covers                                                                                                                                                           | When it runs                                                        |
| --------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| **Business rules**    | Vitest                                                                                    | Pure functions in `src/domain`: access rule, subscription transitions, learner number check digit, timetable clash detection, marking and grading, import row validation | Every change (CI)                                                   |
| **Database security** | Vitest + supabase-js against a **local Supabase** started in CI with the same migrations  | Row-level security and procedures. Seeds two schools, admins, teachers, learners and parents, then signs in as each and checks what they can and cannot read or change   | Every change that touches the schema (CI)                           |
| **Components**        | Vitest + Testing Library                                                                  | Forms (validation messages, disabled states), loading, empty and error states, every visible button doing something                                                      | Every change (CI)                                                   |
| **End-to-end**        | Playwright                                                                                | Full user journeys in a real browser against a preview deployment with a seeded test database. Includes phone and tablet screen sizes                                    | Every pull request, plus nightly                                    |
| **Accessibility**     | axe-core inside Playwright, plus manual keyboard and screen-reader checks                 | WCAG 2.2 AA issues on every page                                                                                                                                         | Every pull request; manual pass each phase                          |
| **Slow networks**     | Playwright with network throttling (slow 3G / fast 3G profiles)                           | Page weight, time to usable, data-saver lesson mode                                                                                                                      | Each phase                                                          |
| **Real-time**         | Playwright with two or more browser contexts and fake camera/microphone                   | Board strokes arrive in under 0.5 s, hand-raise, mute, chat, attendance intervals                                                                                        | Phase 2 onward                                                      |
| **Load**              | k6 (pages and server functions), LiveKit load tester (rooms of 35–100)                    | Capacity and cost per lesson                                                                                                                                             | Phase 2 and Phase 7                                                 |
| **Payments**          | PayFast sandbox + replayed notices                                                        | Correct child activated, repeated notices ignored, wrong amount rejected, forged notice rejected                                                                         | Phase 5 and before each billing release                             |
| **Hybrid room**       | **Manual checklist in a real classroom**                                                  | Echo, feedback, who-hears-whom, projector layout, pen tablet                                                                                                             | Phase 2, then for each new school's room set-up                     |
| **Security**          | Supabase security advisor, dependency audit, OWASP ZAP scan, an external penetration test | Misconfigured policies, known vulnerable libraries, common web attacks                                                                                                   | Advisor and audit every change; ZAP each phase; pen test in Phase 7 |
| **User acceptance**   | A pilot school, scripted plus free use                                                    | Real teachers, learners and parents on their own devices and networks                                                                                                    | End of Phases 2, 4 and 5, and Phase 7                               |

### Database security tests in more detail

These are the most important tests in the project. They run against a disposable local copy of the database, never production, and they check the rules from the outside, exactly as a real user would hit them:

- Teacher at School A asks for School B's learners → **0 rows**.
- Parent asks for a learner they are not linked to → **0 rows**, even with the learner's ID.
- Learner tries to read another learner's results → **0 rows**.
- Learner tries to read exam questions before the window opens → **refused**.
- School admin without an MFA-verified session tries an admin action → **refused**.
- Parent verifies their own manual payment → **refused**. Only admins verify.
- Anyone tries to edit or delete the audit log → **refused**.

## The 28 acceptance tests

| #   | Acceptance test (from the brief)                        | Phase                       | How it's tested                              |
| --- | ------------------------------------------------------- | --------------------------- | -------------------------------------------- |
| 1   | Administrator registers a school                        | 1                           | E2E                                          |
| 2   | School registers teachers and learners                  | 1                           | E2E (single + bulk import)                   |
| 3   | Parent registers and links multiple children            | 1                           | E2E                                          |
| 4   | Each child receives an independent subscription         | 1                           | Unit + DB + E2E                              |
| 5   | A successful payment activates only the correct learner | 1 (manual EFT), 5 (PayFast) | Unit + DB + E2E + sandbox                    |
| 6   | Teacher schedules and starts a lesson                   | 2                           | E2E                                          |
| 7   | Physical and online learners join the same classroom    | 2                           | E2E (simulated devices) + room checklist     |
| 8   | Online learners hear physical classroom discussion      | 2                           | Room checklist (real hardware)               |
| 9   | Physical learners hear online learners                  | 2                           | Room checklist (real hardware)               |
| 10  | Teacher shares a screen                                 | 2                           | E2E (fake media) + manual                    |
| 11  | Teacher writes on the whiteboard                        | 2                           | E2E (pen, touch and mouse input simulated)   |
| 12  | Learner sees the writing in real time                   | 2                           | E2E, two browsers, under 0.5 s               |
| 13  | Teacher uploads an exam paper                           | 3                           | E2E (PDF, Word, scanned image)               |
| 14  | The paper appears correctly in the workspace            | 3                           | Visual comparison of rendered pages          |
| 15  | Teacher annotates the paper                             | 3                           | E2E, plus annotations survive reload         |
| 16  | Teacher uploads notes                                   | 3                           | E2E                                          |
| 17  | Learners access their notes                             | 3                           | E2E + DB (other classes can't)               |
| 18  | Teacher creates homework                                | 3                           | E2E                                          |
| 19  | Learners submit homework                                | 3                           | E2E (text, photo, PDF; late flag)            |
| 20  | Parents monitor homework                                | 3                           | E2E                                          |
| 21  | Teacher creates an exam                                 | 4                           | E2E                                          |
| 22  | Learners complete the exam                              | 4                           | E2E (timer, autosave, reconnect)             |
| 23  | Teachers mark written answers                           | 4                           | E2E                                          |
| 24  | Parents view exam results                               | 4                           | E2E (only after publishing)                  |
| 25  | Parents suspend and reactivate individual learners      | 5 (model in 1)              | Unit + DB + E2E, including the mid-exam case |
| 26  | Teachers monitor attendance                             | 2                           | E2E (physical vs online)                     |
| 27  | Administrators view financial and academic reports      | 5 / 7                       | E2E + export file checks                     |
| 28  | Unauthorised users can't reach protected data           | Every phase                 | DB security suite + E2E route guards         |

## Definition of done (every task)

1. Lint, typecheck, unit, component and database tests pass in CI.
2. New screens have loading, empty and error states, and every visible button works.
3. End-to-end tests are added for any new user journey.
4. Accessibility checks show no new serious issues.
5. A short report lists what was built, how it works, the files changed, the test results and anything incomplete.
6. The existing test suite still passes, so nothing that worked before is broken.
