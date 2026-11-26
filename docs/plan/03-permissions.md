# 3. Roles and permissions

## The five roles

| Role                                     | Scope                                          | How someone gets it                                                                                                     |
| ---------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Platform admin** (super administrator) | Whole platform                                 | Granted by another platform admin. MFA required.                                                                        |
| **School admin**                         | One institution, or several if invited to each | Platform admin registers the institution and invites the first admin, who invites the others. MFA required.             |
| **Teacher**                              | Classes assigned to them within an institution | Invited by a school admin. An independent teacher gets their own one-person institution.                                |
| **Learner**                              | Themselves                                     | The school or parent creates the learner record. A login is issued separately.                                          |
| **Parent / guardian**                    | Their linked children only                     | Signs up, then links each child with a single-use code from the school, or registers a child as an independent learner. |

One person can hold several roles. For example, a teacher who is also a parent switches between them in the header, and each role sees only its own scope.

## Permission matrix

**Key**

- **All:** everything on the platform
- **School:** own institution only
- **Classes:** classes the teacher is assigned to
- **Self:** own records
- **Children:** actively linked children only
- **—:** no access

### Platform and institutions

| Capability                              | Platform admin      | School admin              | Teacher     | Learner     | Parent      |
| --------------------------------------- | ------------------- | ------------------------- | ----------- | ----------- | ----------- |
| Register, approve, suspend institutions | All                 | —                         | —           | —           | —           |
| Edit institution profile and policies   | All                 | School                    | —           | —           | —           |
| Configure pricing plans                 | All                 | School (custom packages)  | —           | —           | —           |
| View revenue and platform analytics     | All                 | School (own billing only) | —           | —           | —           |
| Announcements                           | All                 | School                    | Classes     | —           | —           |
| View audit log                          | All                 | School                    | —           | —           | —           |
| Monitor live classrooms                 | All (metadata only) | School                    | Classes     | —           | —           |
| Support requests                        | All                 | Raise / own               | Raise / own | Raise / own | Raise / own |

### People

| Capability                                  | Platform admin       | School admin          | Teacher                                        | Learner                       | Parent                                      |
| ------------------------------------------- | -------------------- | --------------------- | ---------------------------------------------- | ----------------------------- | ------------------------------------------- |
| Invite, suspend, remove teachers            | All                  | School                | —                                              | —                             | —                                           |
| Register learners (single / bulk)           | All                  | School                | —                                              | —                             | Children (independent learners)             |
| View learner profile                        | All (audited)        | School                | Classes (name, grade, class, guardian contact) | Self                          | Children                                    |
| Edit learner details                        | All                  | School                | —                                              | Self (display name, password) | Children (contact details)                  |
| Move class / promote grade                  | All                  | School                | —                                              | —                             | —                                           |
| Issue guardian link codes; verify guardians | All                  | School                | —                                              | —                             | —                                           |
| Link to a child                             | —                    | —                     | —                                              | —                             | With a valid code                           |
| Suspend / reactivate a learner              | All (platform-level) | School (school-level) | —                                              | —                             | Children (guardian-level, if `can_suspend`) |
| Issue or reset a learner's login            | All                  | School                | —                                              | —                             | Children                                    |

### Teaching and learning

| Capability                                 | Platform admin  | School admin                | Teacher                                  | Learner                        | Parent                              |
| ------------------------------------------ | --------------- | --------------------------- | ---------------------------------------- | ------------------------------ | ----------------------------------- |
| Subjects, classes, teacher assignments     | All             | School                      | Independent teacher: own                 | —                              | —                                   |
| Timetable                                  | View            | School                      | Classes (create lessons)                 | View own                       | View children's                     |
| Start / run a live lesson                  | —               | —                           | Classes                                  | —                              | —                                   |
| Join a live lesson                         | —               | Observe (audited)           | Classes                                  | Own (if access rule passes)    | —                                   |
| Mute, remove, approve speakers, end lesson | —               | —                           | Own lessons                              | —                              | —                                   |
| Record a lesson                            | —               | Sets policy                 | Own lessons, if policy and consent allow | Watch own classes' recordings  | —                                   |
| Mark / view attendance                     | View            | School                      | Classes (mark)                           | Self                           | Children                            |
| Upload resources and papers                | —               | School                      | Classes                                  | —                              | —                                   |
| Access resources                           | —               | School                      | Classes                                  | Assigned to their classes      | —                                   |
| Homework: create, mark, return             | —               | View school                 | Classes                                  | Submit own                     | View children's status and feedback |
| Tests / exams: create, mark                | —               | Moderate school             | Classes                                  | Write own (in the open window) | —                                   |
| Results                                    | View aggregates | School (approve publishing) | Classes (publish)                        | Self (once published)          | Children (once published)           |
| Question bank                              | —               | School shared bank          | Own + school shared                      | —                              | —                                   |
| Reports and analytics                      | All             | School                      | Classes                                  | Self                           | Children                            |

### Billing

| Capability                          | Platform admin | School admin                 | Teacher | Learner            | Parent                             |
| ----------------------------------- | -------------- | ---------------------------- | ------- | ------------------ | ---------------------------------- |
| View subscription status            | All            | School (learners it bills)   | —       | Self (status only) | Children                           |
| Start / pay / cancel a subscription | —              | School licence (if approved) | —       | —                  | Children (if `can_manage_billing`) |
| Upload proof of EFT                 | —              | —                            | —       | —                  | Children                           |
| Verify manual payments              | All            | School (if school collects)  | —       | —                  | —                                  |
| Refunds and adjustments             | All            | —                            | —       | —                  | —                                  |
| Payment history and receipts        | All            | School                       | —       | —                  | Children                           |

### AI

| Capability            | Platform admin    | School admin | Teacher                           | Learner                             | Parent              |
| --------------------- | ----------------- | ------------ | --------------------------------- | ----------------------------------- | ------------------- |
| Set AI policy         | Platform defaults | School       | Per class / homework / assessment | —                                   | Opt their child out |
| Use AI tutor          | —                 | —            | —                                 | When policy, plan and consent allow | —                   |
| Use AI teacher tools  | —                 | —            | Classes                           | —                                   | —                   |
| View AI usage summary | All               | School       | Classes                           | Self                                | Children            |

## Where each permission is enforced

1. **Database (final say).** Row-level security policies and checked procedures (see [Database schema](02-database-schema.md#access-helper-functions)).
2. **Server functions.** Anything that uses a secret: LiveKit tokens, payments, AI, sending email.
3. **Screens.** These hide what a user can't do, so nobody is shown a button that will fail. They are never relied on for security.

## Privileged accounts

- Platform admins and school admins must set up an authenticator-app code (TOTP). The database refuses their admin powers if the session wasn't MFA-verified.
- When a platform admin views a learner's record, the view is written to the audit log.
- Granting a platform-admin role requires an existing platform admin and is always audited.

## Communication rules

- **Learners have no private learner-to-learner messages by default.** Class discussion happens in class channels that teachers can moderate.
- **Teacher ↔ learner** messaging happens only within a class the teacher teaches. It is stored and available to school safeguarding leads, and each school chooses whether teachers may send private 1:1 messages to learners.
- **Teacher ↔ parent** is allowed for parents of learners in the teacher's classes.
- **No personal contact details are shown** to learners or other parents.

## Child safety and POPIA

Under POPIA, every learner under 18 is a child. Processing a child's information needs the consent of a competent person (a parent or guardian) or another lawful basis, such as a school's legal duty. The platform:

- **records consent per learner and per purpose:** general processing, lesson recording, AI assistance, messaging and media. It records who gave it, when, and against which policy version.
- **keeps the minimum data.** We ask for date of birth and grade, but not South African ID numbers unless an institution has a documented need.
- **never shows one learner's information to another learner,** or to a parent who isn't actively linked.
- **requires a school-issued single-use code** (or school admin verification) before a parent is linked to a child. Nobody can claim a child just by typing their name.
- **shows a visible notice to everyone** while a lesson is being recorded, and blocks recording for learners without recording consent (their video and audio are excluded, or the recording is not allowed).
- **supports access, correction and deletion requests.** Deletion is weighed against an institution's legal duty to keep academic records.
- Needs a named Information Officer registered with the Information Regulator, and a privacy notice written for parents. **Legal sign-off is required before live data.**
