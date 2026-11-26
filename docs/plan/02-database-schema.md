# 2. Database schema

PostgreSQL, hosted by Lovable Cloud. The Phase 1 tables are specified in full. Tables for later phases are listed with their key columns and are finalised in their own phase.

## Conventions

- Every primary key is a `uuid`, except the `bigint` primary key of the audit log.
- Every table has `created_at timestamptz not null default now()`. Tables that can be edited also have `updated_at`, kept current by a trigger.
- Every school-owned table has `institution_id uuid not null references institutions`, and its indexes start with that column.
- Row-level security is **enabled on every table**. Browsers get `select` through policies. Most writes go through `security definer` procedures that check permission and write the audit record. Direct `insert`/`update` is allowed only where the policy is simple, for example a user editing their own profile.
- Nothing is deleted outright. Learners, enrolments, results and payments are _archived_ or _ended_, so history survives suspensions, transfers and expiries.
- Money is stored in cents (`integer`), with `currency text default 'ZAR'`.
- Times are stored in UTC and shown in `Africa/Johannesburg`, or the institution's time zone.

Already in the database (kept as is): `profiles`, `user_roles`, `app_role` enum, `has_role()`, and the new-user profile trigger.

---

## Phase 1: Foundation

### Enums

```sql
institution_type    : school | tutoring_centre | independent_teacher | online_academy
institution_status  : pending | active | suspended | closed
membership_role     : school_admin | teacher
membership_status   : invited | active | suspended | removed
learner_category    : school_learner | matric_rewrite | matric_upgrade | exam_prep | independent
learning_mode       : in_person | online | hybrid
guardian_relation   : mother | father | guardian | grandparent | foster_parent | other
link_status         : pending | active | revoked
enrolment_status    : active | transferred | withdrawn | promoted | completed
suspension_source   : guardian | institution | platform
consent_type        : data_processing | lesson_recording | ai_assistance | messaging | photo_media
billing_interval    : monthly | quarterly | term | annual | custom
subscription_status : pending_payment | active | expired | suspended | cancelled   -- matches src/domain
payment_status      : pending | succeeded | failed | cancelled | refunded
payment_method      : card | instant_eft | manual_eft | cash | debit_order | other
```

### Identity (existing tables, small additions)

```sql
profiles (existing)
  + phone              text
  + locale             text default 'en-ZA'
  + is_shared_device_default boolean default false

user_roles (existing)
  -- From Phase 1 this holds GLOBAL roles only (platform_admin).
  -- School-level roles live in institution_memberships.
  -- Parent and learner roles are derived from links, so nothing is stored twice.
```

### Tenancy

```sql
institutions
  id                uuid pk
  name              text not null
  type              institution_type not null
  status            institution_status not null default 'pending'
  emis_number       text unique            -- SA Dept of Education school number, optional
  province          text
  district          text
  address           jsonb
  contact_email     text
  contact_phone     text
  timezone          text not null default 'Africa/Johannesburg'
  settings          jsonb not null default '{}'   -- expiry policy, recording policy, AI policy, messaging policy
  created_by        uuid references auth.users
  index (status), index (type)

institution_memberships
  id                uuid pk
  institution_id    uuid not null
  user_id           uuid not null references auth.users
  role              membership_role not null
  status            membership_status not null default 'invited'
  title             text                    -- "HOD Mathematics"
  invited_by        uuid
  unique (institution_id, user_id, role)
  index (user_id, status)

invitations
  id                uuid pk
  institution_id    uuid not null
  email             citext not null
  role              membership_role not null
  token_hash        text not null unique    -- only the hash is stored; the token travels in the email link
  expires_at        timestamptz not null
  accepted_at       timestamptz
  accepted_by       uuid
  revoked_at        timestamptz
  invited_by        uuid not null
  index (institution_id, email)

academic_years
  id                uuid pk
  institution_id    uuid not null
  label             text not null           -- "2027"
  starts_on, ends_on date not null
  is_current        boolean not null default false
  unique (institution_id, label)
  unique (institution_id) where is_current  -- only one current year

terms
  id                uuid pk
  institution_id    uuid not null
  academic_year_id  uuid not null
  number            smallint check (number between 1 and 4)
  starts_on, ends_on date not null
  unique (academic_year_id, number)
```

### Learners, guardians and consent

```sql
grade_levels                                   -- global reference data, seeded
  code              text pk                  -- 'G01'..'G12', 'MATRIC_REWRITE', 'MATRIC_UPGRADE', 'EXAM_PREP'
  label             text not null            -- 'Grade 1'
  phase             text                     -- foundation | intermediate | senior | fet | adult
  sort_order        smallint not null

learners
  id                uuid pk
  learner_number    text not null unique     -- e.g. LB26-004211-7 (year, sequence, check digit)
  first_name        text not null
  last_name         text not null
  preferred_name    text
  date_of_birth     date not null
  grade_code        text not null references grade_levels
  category          learner_category not null default 'school_learner'
  learning_mode     learning_mode not null default 'in_person'
  home_language     text
  user_id           uuid unique references auth.users   -- null until a login is issued
  created_by        uuid not null
  archived_at       timestamptz
  index (last_name, first_name), index (grade_code)

learner_guardians
  learner_id        uuid not null references learners
  guardian_user_id  uuid not null references auth.users
  relationship      guardian_relation not null
  status            link_status not null default 'pending'
  is_primary        boolean not null default false
  can_manage_billing boolean not null default true
  can_suspend       boolean not null default true
  verified_by       uuid                     -- school admin who confirmed, or null if linked by code
  primary key (learner_id, guardian_user_id)
  index (guardian_user_id, status)

learner_link_codes                              -- how a parent proves they may link to a child
  id                uuid pk
  learner_id        uuid not null
  institution_id    uuid                     -- school that issued it (null if platform)
  code_hash         text not null unique
  expires_at        timestamptz not null
  used_at           timestamptz
  used_by           uuid
  created_by        uuid not null

enrolments                                      -- learner <-> institution, with history
  id                uuid pk
  learner_id        uuid not null
  institution_id    uuid not null
  academic_year_id  uuid not null
  class_id          uuid references classes
  status            enrolment_status not null default 'active'
  enrolled_on       date not null default current_date
  ended_on          date
  ended_reason      text
  index (institution_id, status), index (learner_id, status), index (class_id)
  unique (learner_id, institution_id, academic_year_id) where status = 'active'

consents                                        -- POPIA: who agreed to what, and when
  id                uuid pk
  learner_id        uuid not null
  given_by          uuid not null            -- guardian user (or learner, if an adult)
  type              consent_type not null
  granted           boolean not null
  policy_version    text not null
  granted_at        timestamptz not null default now()
  revoked_at        timestamptz
  index (learner_id, type)

learner_suspensions                             -- several can apply at once; each is lifted only by its own source
  id                uuid pk
  learner_id        uuid not null
  source            suspension_source not null
  institution_id    uuid                     -- set when source = institution
  imposed_by        uuid not null
  reason            text not null
  starts_at         timestamptz not null default now()
  lifted_at         timestamptz
  lifted_by         uuid
  index (learner_id) where lifted_at is null
```

`learner_suspensions` is a separate table, not a status column, because a parent and a school can suspend the same learner independently. A parent reactivating must not undo a school's suspension. When a learner is suspended, everything stays in place: the account, results, submissions, attendance and history are all kept.

### Subjects and classes

```sql
subject_catalogue                               -- global, seeded with CAPS subjects
  code              text pk                  -- 'MATH', 'MLIT', 'PHSC', 'ENG_HL', ...
  name              text not null
  grade_codes       text[] not null

subjects                                        -- what an institution actually offers
  id                uuid pk
  institution_id    uuid not null
  catalogue_code    text references subject_catalogue
  name              text not null
  is_active         boolean not null default true
  unique (institution_id, name)

classes                                         -- a register class / group, e.g. "10A"
  id                uuid pk
  institution_id    uuid not null
  academic_year_id  uuid not null
  grade_code        text not null
  name              text not null
  learning_mode     learning_mode not null default 'hybrid'
  capacity          smallint
  archived_at       timestamptz
  unique (institution_id, academic_year_id, name)

class_subjects                                  -- "10A Mathematics", the unit teachers teach
  id                uuid pk
  institution_id    uuid not null
  class_id          uuid not null
  subject_id        uuid not null
  unique (class_id, subject_id)

teaching_assignments
  id                uuid pk
  institution_id    uuid not null
  class_subject_id  uuid not null
  teacher_user_id   uuid not null
  is_lead           boolean not null default true
  starts_on, ends_on date
  index (teacher_user_id), index (class_subject_id)

subject_enrolments                              -- which subjects a learner takes in that class
  enrolment_id      uuid not null references enrolments
  class_subject_id  uuid not null
  learner_id        uuid not null            -- copied from the enrolment so permission checks are fast
  institution_id    uuid not null
  primary key (enrolment_id, class_subject_id)
  index (learner_id), index (class_subject_id)
```

### Subscriptions and payments (foundation)

```sql
plans
  id                uuid pk
  institution_id    uuid                     -- null = platform plan; set = an institution's custom package
  name              text not null
  interval          billing_interval not null
  interval_count    smallint not null default 1
  price_cents       integer not null check (price_cents >= 0)
  currency          text not null default 'ZAR'
  grade_codes       text[]                   -- null = all grades
  features          jsonb not null default '{}'   -- e.g. live lessons, recordings, AI allowance
  is_active         boolean not null default true

subscriptions                                   -- ALWAYS exactly one learner
  id                uuid pk
  learner_id        uuid not null references learners
  plan_id           uuid not null references plans
  institution_id    uuid                     -- whose content it unlocks (null = platform-wide)
  payer_user_id     uuid not null
  status            subscription_status not null default 'pending_payment'
  current_period_start timestamptz
  current_period_end   timestamptz
  auto_renew        boolean not null default false
  provider          text                     -- payfast | peach | manual
  provider_token    text                     -- recurring-billing token, never card data
  cancelled_at      timestamptz
  index (learner_id, status), index (payer_user_id), index (status, current_period_end)
  unique (learner_id, plan_id) where status in ('pending_payment','active')

invoices
  id                uuid pk
  number            text not null unique     -- INV-2027-000123
  subscription_id   uuid not null
  learner_id        uuid not null
  amount_cents      integer not null
  period_start, period_end timestamptz not null
  due_on            date not null
  status            text not null            -- open | paid | void | overdue
  index (learner_id), index (status, due_on)

payments
  id                uuid pk
  invoice_id        uuid references invoices
  subscription_id   uuid not null
  learner_id        uuid not null
  amount_cents      integer not null
  method            payment_method not null
  status            payment_status not null default 'pending'
  provider          text not null            -- payfast | peach | manual
  provider_payment_id text unique            -- idempotency key from the gateway
  proof_path        text                     -- uploaded proof of EFT (manual)
  verified_by       uuid                     -- admin who verified a manual payment
  paid_at           timestamptz
  index (subscription_id), index (learner_id), index (status)

payment_events                                  -- raw gateway notices, for idempotency and investigations
  id                uuid pk
  provider          text not null
  provider_event_id text not null
  payload           jsonb not null           -- cleaned: never contains card numbers
  received_at       timestamptz not null default now()
  processed_at      timestamptz
  result            text
  unique (provider, provider_event_id)
```

### Audit and imports

```sql
audit_log                                       -- append-only: no update or delete for anyone
  id                bigint generated always as identity pk
  occurred_at       timestamptz not null default now()
  actor_user_id     uuid
  actor_role        text
  institution_id    uuid
  action            text not null            -- 'learner.suspend', 'payment.verify', ...
  entity_type       text not null
  entity_id         text not null
  before            jsonb
  after             jsonb
  ip                inet
  index (institution_id, occurred_at desc), index (entity_type, entity_id)

import_jobs
  id                uuid pk
  institution_id    uuid not null
  kind              text not null            -- 'learners'
  file_path         text not null
  status            text not null            -- validating | ready | importing | done | failed
  total_rows, imported_rows, error_rows integer
  errors            jsonb                    -- per-row messages shown back to the admin
  created_by        uuid not null
```

### Access helper functions

Each of these is `stable security definer` with a fixed `search_path`, so policies can call them without leaking rows.

| Function                              | True when the signed-in user…                                                                             |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `is_platform_admin()`                 | has the global `platform_admin` role and an MFA-verified session (`aal2`)                                 |
| `has_institution_role(inst, roles[])` | has an _active_ membership in that institution with one of those roles (`school_admin` also needs `aal2`) |
| `is_learner_self(learner)`            | is that learner's login                                                                                   |
| `is_guardian_of(learner)`             | has an _active_ guardian link to that learner                                                             |
| `teaches_learner(learner)`            | is assigned to a class subject the learner is enrolled in                                                 |
| `can_view_learner(learner)`           | any of the above, or is a school admin where the learner is actively enrolled                             |
| `learner_has_access(learner)`         | the learning-access rule ([Architecture](01-architecture.md#the-learning-access-rule))                    |

### Procedures (the only way to make sensitive changes)

| Procedure                                                                               | Who may call it                               | What it guarantees                                                                             |
| --------------------------------------------------------------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `register_institution(...)`                                                             | platform admin                                | creates the institution, its first academic year, and an invitation for the first school admin |
| `create_invitation(inst, email, role)` / `accept_invitation(token)`                     | school admin / invitee                        | token is single-use and expires; membership becomes active only when accepted                  |
| `create_learner(...)`                                                                   | school admin, or parent (independent learner) | generates the learner number, creates the enrolment, records consent, writes audit             |
| `issue_link_code(learner)` / `link_guardian_with_code(code, relationship)`              | school admin / parent                         | code is single-use and expires after 14 days; repeated wrong guesses are rate-limited          |
| `move_learner(learner, class)` / `promote_learners(class, to_grade)`                    | school admin                                  | ends the old enrolment and opens a new one; history kept                                       |
| `suspend_learner(learner, source, reason)` / `reactivate_learner(...)`                  | guardian / school admin / platform admin      | each source lifts only its own suspension; in-progress exam rule applied; learner notified     |
| `start_subscription(learner, plan)`                                                     | parent with billing rights, or school admin   | one pending subscription per learner per plan                                                  |
| `record_manual_payment(subscription, amount, proof)` / `verify_manual_payment(payment)` | parent uploads / admin verifies               | activates **only** that subscription's learner                                                 |

---

## Later phases (key tables)

| Phase                  | Tables                                                                                                                                                                                                                          | Notes                                                                                                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2 Classroom            | `rooms`, `lessons`, `lesson_series`, `lesson_presenters`, `attendance_records`, `attendance_intervals`, `participation_events`, `lesson_chat_messages`, `whiteboards`, `whiteboard_pages`, `whiteboard_snapshots`, `recordings` | Exclusion constraints stop clashes: no overlapping lessons for the same teacher, room or class (`tstzrange … with &&`). `attendance_records.mode` = physical / online. |
| 3 Learning             | `resources`, `resource_audiences`, `documents`, `document_pages`, `document_extractions`, `annotation_layers`, `assignments`, `assignment_targets`, `submissions`, `submission_files`, `submission_feedback`                    | Resources have `publish_at` / `unpublish_at` and `downloadable`. `submissions.status` follows the brief's six homework statuses.                                       |
| 4 Assessments          | `question_bank_items`, `question_bank_tags`, `assessments`, `assessment_sections`, `assessment_items`, `assessment_attempts`, `attempt_answers`, `attempt_events`, `moderation_reviews`, `results`                              | Answer keys sit in a table learners can never read. Questions become readable only inside an open attempt, after `opens_at`, and this is checked on the server clock.  |
| 5 Parents and payments | `notifications`, `notification_preferences`, `notification_deliveries`, `announcements`, `conversations`, `conversation_members`, `messages`, `meetings`, `institution_licences` (if approved)                                  | Messaging rules are enforced in policies (see [Permissions](03-permissions.md#communication-rules)).                                                                   |
| 6 AI                   | `ai_sessions`, `ai_messages`, `ai_usage`, `ai_policies`, `learning_insights`                                                                                                                                                    | Usage is metered per learner against the plan's monthly allowance.                                                                                                     |
| Extras                 | `certificates`, `portfolio_items`, `badges`, `learner_badges`, `streaks`                                                                                                                                                        | When approved.                                                                                                                                                         |

## Indexing and performance notes

- Every foreign key is indexed. Lists are paged with keyset pagination (`(created_at, id)`), not `offset`.
- Dashboards read from summary views refreshed by scheduled jobs, such as attendance percentage per learner per term, instead of recounting raw rows on every page load.
- Attendance intervals and participation events grow fastest. They are indexed by `(lesson_id)` and `(learner_id, occurred_at)`, and raw events are summarised and pruned after the retention period.
