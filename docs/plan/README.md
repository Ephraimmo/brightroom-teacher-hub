# LearnBridge platform plan

**Status:** Approved · 26 November 2026 (open items listed at the end)
**Working name:** LearnBridge (confirmed earlier in `roadmap.md`)

This folder is the technical plan for the hybrid learning platform. It answers section 29 of the master brief ("First action required") and sets out how Phase 1 will be built. Nothing described here is built yet, except what is listed under _Where we are starting from_.

| #   | Document                                         | What it answers                                                                                                 |
| --- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| 1   | [System architecture](01-architecture.md)        | How the pieces fit together, including the live lesson, the hybrid room, the whiteboard, documents and payments |
| 2   | [Database schema](02-database-schema.md)         | Every table, what it stores, and how one school's data is kept away from another's                              |
| 3   | [Roles and permissions](03-permissions.md)       | Who can see and do what                                                                                         |
| 4   | [Pages and navigation](04-pages-navigation.md)   | The screens for each role and their web addresses                                                               |
| 5   | [Module dependencies](05-module-dependencies.md) | What has to exist before each feature can be built                                                              |
| 6   | [Technology stack](06-technology-stack.md)       | What we use for each job, why, and which parts are paid external services                                       |
| 7   | [Roadmap](07-roadmap.md)                         | The seven phases and Phase 1 split into 15 small tasks                                                          |
| 8   | [Testing](08-testing.md)                         | How each part is checked, including the 28 acceptance tests                                                     |
| 9   | [Deployment](09-deployment.md)                   | Environments, releases, monitoring and backups                                                                  |
| 10  | [Costs](10-costs.md)                             | Monthly running costs at 300, 5,000 and 50,000 learners                                                         |

---

## Where we are starting from

The existing project is a working foundation. The plan builds on it rather than replacing it.

- **App:** TanStack Start (React 19, TypeScript). It is built and hosted through Lovable and runs on Cloudflare's edge network.
- **Backend:** Lovable Cloud, which is a managed Supabase. It provides the Postgres database, sign-in and file storage.
- **Working today:**
  - email and password sign-up and sign-in, password reset, and Google and Lovable sign-in
  - a profile page
  - `profiles` and `user_roles` tables protected by row-level security, plus a five-role list (platform admin, school admin, teacher, learner, parent)
- **Teacher workspace UI:** overview, classes, timetable, resources and homework. All of it runs on clearly labelled sample data.
- **Unused sample data:** content for school, learner, parent and platform screens exists in `src/domain/workspace-sample-data.ts`, but no page uses it yet.
- **A tested business rule:** one learner's active subscription never grants access to another learner (`src/domain/learner-subscriptions.ts`).
- **Tests:** two automated tests (routing and subscriptions).

**A Lovable plan is in progress** (`.lovable/plan/remaining-learning-platform-ui-2026-11-26.md`). It would build the remaining role screens on sample data. I recommend pausing it, because Phase 1 builds those screens on real data and anything built on sample data now would be thrown away.

## The key decisions in plain language

1. **Keep the existing stack; don't rebuild.** It already provides sign-in, a secure database, file storage, real-time updates and hosting. Rebuilding would cost months and buy nothing. Before the platform grows past a few thousand learners, we review whether to move from Lovable Cloud to a Supabase account we manage directly, for predictable pricing and more control over backups and region ([Costs](10-costs.md)).
2. **Every school is its own sealed space, and so is every independent teacher.** Each record carries the school it belongs to. The _database itself_ refuses to return another school's rows, so a bug in a screen cannot leak data across schools.
3. **A learner is a record first and a login second.** A Grade 1 learner can exist, be enrolled and have a subscription without an email address. A login can be added later, using the learner number and a password set by the school or parent.
4. **Subscriptions belong to a learner, never to a parent.** The parent is only the payer. Three children means three separate subscriptions, three payment histories and three on/off switches. A payment carries the ID of exactly one subscription, so it can only ever activate that one child.
5. **Live video uses LiveKit Cloud.** We don't build our own video system. At list prices LiveKit is roughly 8–10 times cheaper per minute than Agora. Its documentation lists an Africa (Johannesburg) region, which the Phase 2 trial will confirm in practice. Because it is open source, we can host it ourselves later if the economics change.
6. **Hybrid rooms use one microphone and speaker set for the whole room.** Learners who are physically present can use a device for the whiteboard, quizzes or raising a hand, but the platform keeps their microphone and speaker off. That rule, plus a proper conference speakerphone, is what prevents the howling feedback loop; software echo cancellation alone cannot handle ten laptops in one room.
7. **Whiteboard pen strokes travel over the same LiveKit connection as the lesson.** This means no extra real-time service, and the board stays live even when a learner's video is switched off to save data. The board is saved to the database every few seconds.
8. **An uploaded question paper becomes pages you can write on straight away.** Reading the paper with OCR to pull out questions, tables and equations is a useful extra, not a requirement. A teacher can always teach from the original as it was printed, and any extracted version is shown side by side for checking.
9. **Payments go through PayFast first, behind a common interface so Peach Payments can be added later.** From Phase 1, admins can also record EFT payments by hand from an uploaded proof of payment, because many South African parents pay that way. We never see or store card numbers.
10. **AI requests go through Lovable's AI gateway**, which is a project rule. They use grade-appropriate instructions and a monthly allowance per learner tied to the plan, and teachers have switches that turn AI off during homework and assessments.

## How the work will flow

- **Database changes go through Lovable.** Each database task produces a reviewed SQL migration that you send to Lovable to apply, after which the generated types are refreshed. I cannot apply migrations from this machine. That is by design: there are no database credentials here.
- **Use a git checkout, not this downloaded copy.** This folder is a downloaded copy, not a git checkout, so changes made here won't reach Lovable. I recommend cloning the connected GitHub repository and working on a branch, so every task becomes a reviewable change.
- **After each task** I report what was built, how it works, the files changed and the test results, plus anything incomplete. Then I wait for your approval before starting the next task.

## Features that need external, paid services

| Feature                                          | Service (recommended → alternative)                                 | When                              |
| ------------------------------------------------ | ------------------------------------------------------------------- | --------------------------------- |
| Live video, audio, screen share, whiteboard sync | LiveKit Cloud → Agora                                               | Phase 2                           |
| Lesson recording storage                         | Cloudflare R2 (or Supabase Storage)                                 | Phase 2                           |
| Card and Instant EFT payments, recurring billing | PayFast → Peach Payments                                            | Phase 5 (manual EFT from Phase 1) |
| Transactional email                              | Resend, or Lovable's email connector if enabled                     | Phase 1 (invitations)             |
| SMS                                              | Clickatell / BulkSMS / SMSPortal                                    | Phase 5 (optional)                |
| WhatsApp                                         | Meta WhatsApp Cloud API via a business solution provider            | Phase 5 (optional)                |
| AI tutor and teacher tools                       | Lovable AI gateway                                                  | Phase 6                           |
| OCR and maths extraction                         | Google Document AI or Mathpix, or a vision model via the AI gateway | Phase 3                           |
| Word and PowerPoint to PDF conversion            | CloudConvert, or a hosted Gotenberg container                       | Phase 3                           |
| Live captions (accessibility)                    | Speech-to-text provider through LiveKit, e.g. Deepgram              | Phase 6                           |
| Error monitoring                                 | Sentry                                                              | Phase 1                           |
| Whiteboard engine licence (if tldraw is chosen)  | tldraw commercial licence → Excalidraw (free, MIT)                  | Phase 2                           |

## Decisions

Agreed on 26 November 2026:

1. **Plan approved** as written.
2. **Billing:** parents pay per child. The tables are shaped so a school licence covering its learners can be added in Phase 5 without rework.
3. **Learner logins:** learners without an email address sign in with their learner number and a password set by the school or parent.

Still open:

4. **Working copy.** This folder is a downloaded copy, not a git checkout. Changes here reach Lovable only once they are pushed to the connected GitHub repository.
5. **The in-progress Lovable plan** (`remaining-learning-platform-ui`). Pausing it is recommended.
6. **Data location and POPIA.** Confirm which region Lovable Cloud stores data in, and get legal sign-off before real learner data is loaded.
