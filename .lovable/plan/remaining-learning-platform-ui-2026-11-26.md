# Remaining Learning Platform UI

## Outcome
Complete the role-based screens in the uploaded brief while keeping the teacher dashboard as the current first screen and LearnBridge as the working name.

## Screens
- **Teacher:** add classroom, assessments, and learner progress to the existing overview, classes, timetable, resources, and homework screens.
- **School administrator:** overview, learners, staff, classes, subjects, timetable, attendance, assessments, subscriptions, and reports.
- **Learner:** overview, timetable, classroom, subjects and resources, homework, assessments, results, and progress.
- **Parent or guardian:** child switcher, overview, attendance, homework, timetable, results, subscriptions, and notifications.
- **Platform owner:** overview, institutions, people, plans and payments, support, audit, reports, and settings.

## Interaction and presentation
- Provide a clear way to move between role workspaces and use distinct file-based URLs for named screens.
- Reuse shared workspace navigation and the established modern academic design, with layouts that work on desktop and mobile.
- Include realistic, clearly labeled sample records and functional local interactions such as search, filters, child selection, simple form feedback, and classroom controls.

## Boundaries
- Keep this phase to interface work and local demonstration state; do not change database rules or claim sample actions are saved.
- Do not present live video, collaborative whiteboard, OCR, real payment, outbound notifications, or production reports as connected. Mark provider-dependent areas as previews or unavailable.
- Preserve the existing sign-in, profile, and teacher screens. Update the roadmap and the architecture rule in `AGENTS.md` to reflect the shared role-workspace structure.

## Verification
- Run the existing routing and subscription tests, add focused tests only for new non-visual behavior, and check each role’s main flow plus desktop/mobile layouts in the running app.