# Hybrid Learning Platform

## Outcome
Build a secure, multi-role learning platform for schools, independent teachers, learners, and families, combining in-person and remote instruction. Deliver it in tested phases rather than presenting non-working controls as finished features.

## Architecture and data boundaries
- Keep the existing TanStack Start application structure.
- Use Lovable Cloud for managed sign-in, persistent PostgreSQL data, and file storage once the backend phase is approved and enabled. Keep authorization checks server-side and apply tenant and role boundaries to every private record.
- Separate user roles from profile records. Model institutions and memberships, teacher/class/subject assignments, independent learner records and subscriptions, guardian-to-learner links, lessons/attendance, materials, assignments/submissions, assessments/results, notifications, and audit events.
- Use an established real-time classroom provider rather than building video infrastructure from scratch; evaluate availability, recording, capacity, accessibility, and data-protection fit before integration.
- Treat payments, video, messaging, and AI as integrations with explicit permission and privacy boundaries, not as simulated production services.

## Modules and role access
- Platform owner: schools, platform configuration, subscriptions, revenue, support, audit, and cross-platform reports.
- School administrator: own institution's people, classes, subjects, timetables, attendance, results, subscriptions, and reports.
- Teacher: assigned classes, lessons, attendance, resources, homework, assessments, and learner progress.
- Learner: own enrolled subjects, timetable, live lessons, materials, submissions, assessments, and results.
- Parent/guardian: only linked children's attendance, learning progress, homework, schedules, results, notifications, and each child's independent subscription.
- Shared capabilities: communication, accessibility, secure file access, and auditable access changes. No role may view another institution's private records or an unrelated learner's data.

## Page and navigation map
- Shared entry and account pages, followed by role-specific home pages.
- Platform owner: overview, institutions, people, plans/payments, support, audit, reports, settings.
- School administrator: overview, learners, staff, classes, subjects, timetable, attendance, assessments, billing, reports.
- Teacher: overview, classes, classroom, timetable, resources, homework, assessments, progress.
- Learner: overview, timetable, classroom, subjects/resources, homework, assessments, results.
- Parent/guardian: child switcher, overview, attendance, homework, timetable, results, subscriptions, notifications.
- A dedicated live-classroom workspace will be introduced with its own controls and participation states.

## Delivery phases
1. Establish the branded, responsive application shell and the first role-focused dashboard, with working navigation, meaningful sample content clearly identified as sample data, and functional local interactions.
2. Enable Lovable Cloud and build secure account/profile, institution, membership, learner, guardian-link, and role foundations; verify tenant and child-level isolation.
3. Deliver school and teacher workflows for class setup, timetables, attendance, learning resources, homework, and assessments.
4. Add parent and learner workspaces, notifications, progress reporting, and independently managed learner subscriptions.
5. Integrate live/hybrid classrooms, whiteboard/document annotation, and approved payment, messaging, recording, or AI services after evaluating requirements and providers.
6. Complete operational reporting, accessibility, security review, and end-to-end acceptance checks.

## Testing strategy
- Add focused tests for important permission, data-isolation, and independent-subscription rules alongside each phase.
- Verify navigation and responsive behavior; test form validation, empty/loading/error/success states, and role-specific workflows.
- Before each phase is complete, exercise its central workflow with real persisted state where that phase uses Lovable Cloud; do not count a signed-out or sample-only check as backend verification.
- Keep live video, payment, email/SMS, and AI claims limited to integrations actually configured and tested.

## First milestone
Build the first role-focused workspace after the requested role, name, and visual direction are confirmed. Until then, keep branding and visual design decisions open.