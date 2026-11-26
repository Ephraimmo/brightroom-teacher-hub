# 4. Pages and navigation

Each role has its own area with its own web address prefix, so links are direct and bookmarkable. All five areas share one design system and the same workspace frame, generalised from today's `TeacherWorkspace`.

## Shared pages

| Address              | Page                                                                            | Who                    |
| -------------------- | ------------------------------------------------------------------------------- | ---------------------- |
| `/`                  | Landing page when signed out; when signed in, redirects to the user's role home | Everyone               |
| `/auth`              | Sign in, create account, forgot password _(exists)_                             | Everyone               |
| `/auth/learner`      | Learner sign-in with learner number + password                                  | Learners               |
| `/reset-password`    | Set a new password _(exists)_                                                   | Everyone               |
| `/invite/$token`     | Accept a school or teacher invitation                                           | Invitees               |
| `/register/parent`   | Parent sign-up, then link or add children                                       | Parents                |
| `/register/school`   | Apply to register a school or tutoring centre                                   | Prospective schools    |
| `/account`           | Profile _(exists)_                                                              | Signed in              |
| `/account/security`  | Password, MFA set-up, signed-in devices                                         | Signed in              |
| `/notifications`     | All notifications                                                               | Signed in              |
| `/messages`          | Conversations, within the communication rules                                   | Signed in              |
| `/help`              | Help and support requests                                                       | Signed in              |
| `/privacy`, `/terms` | Legal pages                                                                     | Everyone               |
| `/access-pending`    | "Your account is waiting for a role"                                            | Signed in, no role yet |
| `/suspended`         | "Your account is temporarily suspended by …" with explanation                   | Suspended learners     |

## Platform admin: `/admin`

| Address                                    | Page                                                                                                    |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `/admin`                                   | Overview: learners (total/active/inactive), teachers, schools, subscriptions, revenue, live lessons now |
| `/admin/institutions` · `/$id`             | Register, approve, suspend; institution detail with its admins, usage and billing                       |
| `/admin/people`                            | Search any user; roles; suspend or reactivate                                                           |
| `/admin/plans`                             | Pricing plans and packages                                                                              |
| `/admin/subscriptions` · `/admin/payments` | All subscriptions and payments; manual verification queue; refunds                                      |
| `/admin/classrooms`                        | Live lessons now: participants, duration, connection quality                                            |
| `/admin/announcements`                     | Platform announcements                                                                                  |
| `/admin/support`                           | Support requests                                                                                        |
| `/admin/audit`                             | Audit log, filterable                                                                                   |
| `/admin/reports`                           | Financial and academic reports; PDF and Excel export                                                    |
| `/admin/settings`                          | System settings, feature switches, AI defaults, retention                                               |

## School admin: `/school`

| Address                                          | Page                                                                                                                        |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `/school`                                        | Overview: enrolment, attendance today, homework and assessment status, billing alerts                                       |
| `/school/learners` · `/new` · `/import` · `/$id` | Learner list, register, bulk import, profile (details, enrolment history, guardians, link codes, suspensions, subscription) |
| `/school/staff` · `/$id`                         | Teachers and admins; invite; assignments                                                                                    |
| `/school/classes` · `/$id`                       | Classes; subjects per class; teachers; learners                                                                             |
| `/school/subjects`                               | Subjects offered (from the CAPS catalogue or custom)                                                                        |
| `/school/timetable`                              | Weekly timetable builder with clash warnings                                                                                |
| `/school/attendance`                             | Attendance by class, day and learner; physical vs online                                                                    |
| `/school/assessments`                            | Exam schedule; moderation queue; results publishing                                                                         |
| `/school/billing`                                | Learner subscriptions the school manages; manual payments; licence                                                          |
| `/school/reports`                                | Academic, attendance and billing reports; export                                                                            |
| `/school/announcements` · `/school/settings`     | Notices; school policies (recording, AI, messaging, expiry)                                                                 |

## Teacher: `/teach`

| Address                                        | Page                                                                                                 |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `/teach`                                       | Today: next lessons with **Start lesson**, marking queue, attendance alerts _(replaces today's `/`)_ |
| `/teach/classes` · `/$id`                      | My classes; class roster, attendance, progress _(replaces `/classes`)_                               |
| `/teach/timetable`                             | My timetable; schedule or reschedule lessons _(replaces `/timetable`)_                               |
| `/teach/lessons/$id/live`                      | **Live classroom**: board, video, participants, chat, controls                                       |
| `/teach/lessons/$id/room`                      | **Room display** for the projector                                                                   |
| `/teach/boards` · `/$id`                       | Saved whiteboards                                                                                    |
| `/teach/resources`                             | Library: upload, organise, schedule _(replaces `/resources`)_                                        |
| `/teach/documents/$id`                         | Question-paper workspace: original, annotations, extracted view                                      |
| `/teach/homework` · `/$id` · `/$id/marking`    | Homework: create, track, mark, return _(replaces `/homework`)_                                       |
| `/teach/assessments` · `/$id` · `/$id/marking` | Tests and exams: build, schedule, mark, moderate                                                     |
| `/teach/question-bank`                         | Reusable questions                                                                                   |
| `/teach/progress`                              | Class and learner analytics; learners needing help                                                   |
| `/teach/ai`                                    | Lesson plans, quiz generation, study guides (Phase 6)                                                |

## Learner: `/learn`

| Address                               | Page                                                                |
| ------------------------------------- | ------------------------------------------------------------------- |
| `/learn`                              | Today: next lesson (**Join**), homework due, upcoming tests, streak |
| `/learn/timetable`                    | My timetable                                                        |
| `/learn/lessons/$id/live`             | Live classroom (learner view; data-saver switch)                    |
| `/learn/subjects` · `/$id`            | My subjects; notes and resources for each                           |
| `/learn/homework` · `/$id`            | Homework list; complete and submit (text, photo, PDF)               |
| `/learn/assessments` · `/$id/attempt` | Tests; the exam screen (timer, autosave, question navigator)        |
| `/learn/results` · `/learn/progress`  | Results and feedback; progress over time                            |
| `/learn/recordings`                   | Recorded lessons I may watch                                        |
| `/learn/tutor`                        | AI tutor (Phase 6)                                                  |

## Parent: `/family`

| Address                                                                                    | Page                                                                                                     |
| ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `/family`                                                                                  | All my children at a glance: one card each with attendance, homework, next test, **subscription status** |
| `/family/add-child`                                                                        | Link with a school code, or register an independent learner                                              |
| `/family/$learnerId`                                                                       | Child overview                                                                                           |
| `/family/$learnerId/attendance` · `/homework` · `/assessments` · `/results` · `/timetable` | Monitoring views                                                                                         |
| `/family/$learnerId/subscription`                                                          | This child's plan, status, renewal, payment history, pay now, upload proof of EFT                        |
| `/family/$learnerId/access`                                                                | Suspend or reactivate this child; activity log                                                           |
| `/family/payments`                                                                         | All payments and receipts, listed per child                                                              |
| `/family/meetings`                                                                         | Parent-teacher meetings                                                                                  |

## Navigation pattern

- **Desktop and tablet:** a left sidebar with the role's sections. The top bar holds the institution switcher (for teachers in several schools), the child switcher (for parents), the role switcher (for people with more than one role), notifications and the account menu.
- **Phone:** a bottom bar with at most five tabs. Everything else is under **More**. The live classroom uses the whole screen.
- **Every list page** has search, filters and paging, plus clear loading, empty and error states.
- **Accessibility:** WCAG 2.2 AA as the target. That means keyboard navigation everywhere, visible focus, screen-reader labels, text size controls, captions in Phase 6, and no information carried by colour alone.
- **Languages:** English first, with interface text kept in translation files so isiZulu, isiXhosa, Afrikaans, Sesotho and others can be added without code changes.

## What happens to today's pages

| Today                                               | After Phase 1                                             |
| --------------------------------------------------- | --------------------------------------------------------- |
| `/` (teacher overview, sample data)                 | `/` redirects by role; the teacher page moves to `/teach` |
| `/classes`, `/timetable`, `/resources`, `/homework` | Become redirects to `/teach/...`, so nothing breaks       |
| `/auth`, `/account`, `/reset-password`              | Kept as they are                                          |

Sample-data panels stay visible, clearly labelled "Sample", until their phase replaces them with real data.
