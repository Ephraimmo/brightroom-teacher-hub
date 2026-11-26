# 7. Development roadmap

Seven phases, each ending with acceptance tests from the brief (§28) passing on real data. The effort figures are rough ranges for **one experienced full-time developer working with AI assistance**. They will firm up after Phase 1 shows the real pace.

| Phase                          | Goal                                                      | Main deliverables                                                                                                                                                                      | Acceptance tests that must pass                                                                                                                                                                                            | Rough effort |
| ------------------------------ | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| **1 Foundation**               | Real people, schools, classes and per-child subscriptions | Institutions, memberships, invitations, learners, guardians, consent, subjects, classes, plans, subscriptions, manual payments, role-based screens, MFA for admins                     | Admin registers a school · school registers teachers and learners · parent links several children · each child gets their own subscription · a payment activates only the correct learner · unauthorised users are blocked | 4–6 weeks    |
| **2 Live classroom**           | Teach live to online and in-room learners at once         | Lessons and timetable, LiveKit integration, teacher controls, hand-raising, chat, screen share, whiteboard, hybrid room mode, room display, attendance (physical vs online), recording | Teacher schedules and starts a lesson · physical and online learners join the same lesson · each side hears the other · teacher shares a screen · learner sees board writing in real time · teacher monitors attendance    | 7–10 weeks   |
| **3 Learning management**      | Materials and homework                                    | Resources library with scheduling, document import, page rendering, annotation workspace, optional extraction, homework with submissions and marking                                   | Teacher uploads an exam paper · it appears correctly in the workspace · teacher annotates it · teacher uploads notes · learners access them · teacher creates homework · learners submit · parents monitor homework        | 6–8 weeks    |
| **4 Assessments**              | Online tests and exams                                    | Question bank, assessment builder, scheduled windows, timer, autosave, automatic marking, manual marking, moderation, results publishing, academic reports                             | Teacher creates an exam · learners complete it · teacher marks written answers · parents view results                                                                                                                      | 5–7 weeks    |
| **5 Parents and payments**     | Families self-serve                                       | Parent dashboard, PayFast checkout and recurring billing, reminders, expiry policy, notifications (in-app, email, optional SMS/WhatsApp), parent suspend/reactivate, messaging         | Payment activates the right child (via the gateway) · parents suspend and reactivate individual learners · admin views financial reports                                                                                   | 4–6 weeks    |
| **6 AI and advanced learning** | Personal support                                          | AI tutor with grade-appropriate answers, practice questions, lesson plan and quiz generation, marking help, insights, captions, handwriting recognition                                | Teacher can disable AI for an assessment · AI respects grade level · usage stays within plan allowance                                                                                                                     | 4–6 weeks    |
| **7 Production readiness**     | Safe to launch at scale                                   | Penetration test, load tests, backup restore drill, payment reconciliation test, user acceptance testing with a pilot school, monitoring and runbooks                                  | All 28 acceptance tests re-run end to end · security findings closed · restore drill passed                                                                                                                                | 3–4 weeks    |

**Recommended early risk check:** a short, throw-away hybrid-room prototype in a real classroom with real hardware, run during the second half of Phase 1 (see [Module dependencies](05-module-dependencies.md#what-this-means-for-scheduling)).

Optional modules (certificates, portfolios, gamification, exam-prep centre, offline mode, more languages) are slotted in after Phase 5, in the order that best supports sales.

---

## Phase 1 in detail: 15 small tasks

Each task is small enough to review on its own and ends with something that can be tested. After each one I report back and wait for approval.

Tasks marked **🗄 Lovable** include a database migration. I write and test-review the SQL, you send it to Lovable to apply, and I then refresh the generated types and verify.

### 1.1 Baseline and working copy

- **Build:**
  - Move work into a git checkout of the connected repository.
  - Add a `typecheck` script and a CI workflow that runs lint, typecheck, tests and build on every change.
  - Record the baseline results.
- **Test:** CI runs green on the unchanged code.
- **Done when:** every later task shows a clean before-and-after.

### 1.2 Access-rule library (no database yet)

- **Build:** pure TypeScript functions in `src/domain/`:
  - learner-number generator and check-digit validator
  - suspension rules (several sources; each lifts only its own)
  - the learning-access rule, including the exam-in-progress exception
  - subscription state transitions
  - grade catalogue
  - the role-to-capability map behind the [permission matrix](03-permissions.md)
  - It extends `learner-subscriptions.ts` without changing what it already does.
- **Test:** unit tests, including the brief's rules ("payment for one child never activates another", "suspension preserves records").

### 1.3 🗄 Institutions, memberships, invitations, audit

- **Build:**
  - migration for `institutions`, `institution_memberships`, `invitations`, `academic_years`, `terms`, `audit_log`
  - access helper functions
  - row-level security
  - procedures `register_institution`, `create_invitation`, `accept_invitation`
- **Test:** an isolation script with two schools and four users asserts each sees only its own rows.

### 1.4 🗄 Learners, guardians, consent, suspensions

- **Build:**
  - migration for `grade_levels` (seeded), `learners`, `learner_guardians`, `learner_link_codes`, `enrolments`, `consents`, `learner_suspensions`
  - procedures `create_learner`, `issue_link_code`, `link_guardian_with_code`, `suspend_learner`, `reactivate_learner`, `move_learner`, `promote_learners`
- **Test:**
  - a parent sees only linked children
  - a used or expired code fails
  - a school can't read another school's learner

### 1.5 🗄 Subjects and classes

- **Build:**
  - migration for `subject_catalogue` (CAPS seed), `subjects`, `classes`, `class_subjects`, `teaching_assignments`, `subject_enrolments`
  - `teaches_learner()`
- **Test:** a teacher sees only learners in their assigned class subjects.

### 1.6 🗄 Subscription foundation

- **Build:**
  - migration for `plans`, `subscriptions`, `invoices`, `payments`, `payment_events`
  - `learner_has_access()` in SQL, mirroring the TypeScript rule
  - procedures `start_subscription`, `record_manual_payment`, `verify_manual_payment`
- **Test:**
  - the same cases as 1.2 run against the database
  - verifying a payment for child A leaves child B pending

### 1.7 Signed-in app frame and routing

- **Build:**
  - protected layout and role-aware redirect from `/`
  - role and institution switcher
  - shared workspace frame for all five roles (generalising `TeacherWorkspace`)
  - `/access-pending` and `/suspended` pages
  - old teacher addresses redirect to `/teach/...`
- **Test:**
  - routing tests for each role
  - signed-out users are sent to `/auth`
  - existing pages still load

### 1.8 Platform admin: schools

- **Build:** `/admin/institutions` to list, search, register, view, suspend and reactivate a school, and invite its first school admin. Includes validation and loading, empty and error states.
- **Test:**
  - component tests for the form
  - end-to-end: an admin registers a school

### 1.9 Invitations and teacher registration

- **Build:**
  - invitation email via the email service
  - `/invite/$token` accept page, which creates the account if needed
  - `/school/staff` to list, invite, resend, revoke, suspend and remove staff
- **Test:**
  - end-to-end: a school admin invites a teacher, who accepts and lands in `/teach`
  - an expired token is refused

### 1.10 Subjects and classes screens

- **Build:**
  - `/school/subjects` (pick from the CAPS catalogue or add custom)
  - `/school/classes` and `/$id` (create classes, add subjects, assign teachers)
- **Test:**
  - component and end-to-end tests
  - a teacher's `/teach/classes` shows only their assignments

### 1.11 Learner registration (single)

- **Build:**
  - `/school/learners`, `/new` and `/$id`, capturing every field the brief requires; the learner number is generated automatically
  - enrolment in a class and subjects
  - edit, move class, promote, and school-level suspend and reactivate
  - registration and enrolment history
  - printing a guardian link code
- **Test:**
  - validation tests
  - end-to-end: register, move and suspend a learner; history shows each step

### 1.12 Bulk learner import

- **Build:**
  - `/school/learners/import`: download a template, upload CSV or Excel, check every row, preview errors, then import in batches
  - an import report, plus link codes for each learner
- **Test:**
  - parser unit tests (bad dates, duplicates, unknown grades)
  - end-to-end import of 200 rows with 3 deliberate errors

### 1.13 Parent registration, children and per-child subscriptions

- **Build:**
  - `/register/parent` and `/family/add-child` (link by code, or register an independent learner) with consent capture
  - `/family` with one card per child
  - `/family/$learnerId/subscription`: choose a plan and upload proof of EFT
  - admin verification queue at `/admin/payments` and `/school/billing`
- **Test:** end-to-end: a parent links three children, sees three separate subscriptions, pays for one, and only that one becomes active.

### 1.14 Learner sign-in and learner home

- **Build:**
  - the school or parent issues or resets a learner login (learner number + password)
  - `/auth/learner`
  - a minimal `/learn` home with subjects and classes
  - a suspended notice that explains who suspended the account and why
- **Test:**
  - end-to-end: a learner signs in and sees only their own subjects
  - a suspended learner sees the notice, with records kept intact

### 1.15 Security pass and Phase 1 acceptance

- **Build:**
  - MFA enrolment and enforcement for admins (`/account/security`)
  - password policy and leaked-password check
  - shared-device timeout
  - audit log viewer at `/admin/audit`
- **Test:**
  - the full Phase 1 Playwright suite
  - RLS isolation suite
  - accessibility (axe) on every new page
  - mobile layout checks
- **Done when:** the Phase 1 acceptance tests pass on real data, and I hand over a written report.
