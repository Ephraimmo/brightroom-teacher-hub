# Design system

The rules every LearnBridge screen follows. To see all of it working, open **`/design-system`** in the running app (for example `http://localhost:…/design-system` after `npm run dev`). That page is not linked from the menus and is hidden from search engines.

## Where things live

| What                        | Where                                                                                                             |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Colour, font, radius tokens | `src/styles.css` (`:root` for light, `.dark` for dark, `@theme inline` maps them to Tailwind)                     |
| Base components (shadcn/ui) | `src/components/ui/` — Button, Input, Select, Dialog, Table, Card, …                                              |
| LearnBridge building blocks | `src/components/design/` — PageHeader, SectionHeader, StatusPill, FormField, LoadingState, EmptyState, ErrorState |
| Live examples               | `src/routes/design-system.tsx` → `/design-system`                                                                 |

**Rule of thumb for new screens:** build with the components in `src/components/design` and `src/components/ui`, and Tailwind classes that use tokens. Only add CSS to `styles.css` for something genuinely new, and use tokens in it.

## Colour

- **Use tokens, never raw colours.** In Tailwind: `bg-primary`, `text-muted-foreground`, `border-border`. In CSS: `var(--success)`. All values are oklch.
- Every token has a light and a dark value. Dark mode is ready in the tokens but there is no switch in the app yet; the `/design-system` page has a preview toggle.

| Group             | Tokens                                                                    | Use for                                        |
| ----------------- | ------------------------------------------------------------------------- | ---------------------------------------------- |
| Surfaces and text | `background`, `foreground`, `card`, `muted`, `muted-foreground`, `border` | Page, panels, main and secondary text, lines   |
| Brand and actions | `primary`, `secondary`, `accent`, `ring`, `sidebar*`                      | Buttons, links, hover, keyboard focus, sidebar |
| Status            | `success`, `warning`, `info`, `destructive`, plus `*-soft` backgrounds    | Record states, messages, errors                |
| Charts            | `chart-1` … `chart-5`                                                     | Data series                                    |

To add a colour: add it to `:root` and `.dark`, then register `--color-<name>: var(--<name>)` in `@theme inline` (instructions at the top of `styles.css`).

## Typography

One typeface: **DM Sans**.

| Role          | Size and weight | How                                  |
| ------------- | --------------- | ------------------------------------ |
| Page title    | 29px bold       | `PageHeader` (renders the only `h1`) |
| Section title | 16px semibold   | `SectionHeader` (`h2`)               |
| Card title    | 14px semibold   | `h3`                                 |
| Body          | 14px            | `text-sm`                            |
| Supporting    | 13px, muted     | `text-[13px] text-muted-foreground`  |
| Smallest      | 12px            | `text-xs`                            |

**New text is never smaller than 12px.** Headings go in order (h1 → h2 → h3) without skipping levels.

## Spacing and corners

Tailwind's 4px scale: `1` = 4px, `2` = 8px, `3` = 12px, `4` = 16px, `6` = 24px, `8` = 32px. Use `gap-*` and `space-y-*` rather than margins on individual items. Corners: `rounded-md` (6px) for controls, `rounded-lg` (8px) for cards and panels.

## Components and when to use them

| Need                      | Use                                                              | Rules                                                                                                                                      |
| ------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Page title and actions    | `PageHeader`                                                     | One per page                                                                                                                               |
| Panel title               | `SectionHeader`                                                  | Optional eyebrow and one action                                                                                                            |
| Main action               | `Button` (default)                                               | One primary button per area                                                                                                                |
| Other actions             | `Button` `secondary` / `outline` / `ghost`                       | Icon-only buttons need an `aria-label`                                                                                                     |
| Delete, remove, suspend   | `Button` `destructive` + `AlertDialog`                           | Always confirm; the button text says what happens ("Suspend access"), never just "OK"                                                      |
| Any form control          | `FormField` around `Input`, `Textarea`, `Checkbox`, …            | Gives the label, hint, error and `required` to screen readers; for a `Select`, pass a function child (see the comment in `form-field.tsx`) |
| A record's state          | `StatusPill` (`success`, `warning`, `info`, `danger`, `neutral`) | The words carry the meaning; colour only backs it up                                                                                       |
| Counts and tags           | `Badge`                                                          |                                                                                                                                            |
| Grouped content           | `Card`                                                           |                                                                                                                                            |
| Lists of records          | `Table`                                                          | On phones, hide secondary columns rather than scrolling sideways                                                                           |
| Short task without a page | `Dialog`                                                         |                                                                                                                                            |
| Data is loading           | `LoadingState`                                                   | Announced to screen readers                                                                                                                |
| Nothing to show           | `EmptyState`                                                     | Say why, and offer the next step                                                                                                           |
| Something failed          | `ErrorState`                                                     | Plain words, no raw error text or codes; offer a retry when it can help                                                                    |

**Every list or data panel shows exactly one of: loading, empty, error, or the data.** Never a blank area.

## App shell and navigation

Every signed-in page sits in **`AppShell`** (`src/components/app-shell/app-shell.tsx`): sidebar on desktop and tablet, top bar with the role switcher (for people with more than one role) and account menu, and a bottom tab bar on phones.

| Role           | Area      | Menu today                                                      |
| -------------- | --------- | --------------------------------------------------------------- |
| Teacher        | `/teach`  | Overview, classes, timetable, resources, homework (sample data) |
| School admin   | `/school` | Home ("being built" until P4-02)                                |
| Platform admin | `/admin`  | Home (until P4-01)                                              |
| Learner        | `/learn`  | Home (until P4-04)                                              |
| Parent         | `/family` | Home (until P4-05)                                              |

- `/` sends each signed-in person to their area; with several roles, the most senior one (platform admin → school admin → teacher → parent → learner). No role yet → `/access-pending`. Signed out → `/auth`.
- Each area's layout route wraps its pages in `RoleAreaGuard`, which shows a "no access" page to anyone without that role. This is a convenience, not security: the database and, from P2-03, server-side checks are what protect data.
- Old teacher addresses (`/classes`, `/timetable`, `/resources`, `/homework`) redirect to `/teach/...`.

**To add a page to a role's menu:** create the route file inside the area (e.g. `src/routes/school.learners.tsx`), render it in `AppShell` with that role, and add an item to `NAVIGATION` in `src/domain/navigation.ts`. A test fails if a menu item points to a page that doesn't exist, or if a phone menu has more than five tabs.

Full-page messages (checking the account, 404, error, no access, waiting for a role) use **`StatusPage`**.

## Responsive rules

Design for a phone first: many families use a phone on mobile data.

| Screen width    | Typical device                 | What changes                                                                |
| --------------- | ------------------------------ | --------------------------------------------------------------------------- |
| Over 1100px     | Desktop                        | Sidebar; four metric cards per row                                          |
| 881–1100px      | Small laptop, landscape tablet | Tighter spacing                                                             |
| 701–880px       | Portrait tablet                | Narrow sidebar; two metric cards per row; panels stack                      |
| 700px and under | Phone                          | Sidebar hidden; bottom navigation (max five tabs); secondary columns hidden |

These are the breakpoints in `styles.css` today. In Tailwind classes, use `sm:` (640px), `md:` (768px) and `lg:` (1024px). Buttons are 36px high by default, which keeps them easy to tap.

## Accessibility basics

Target: WCAG 2.2 AA.

- Everything works with the keyboard, and focus is always visible (the `ring` token).
- Every control has a label; icons next to text are `aria-hidden`.
- Colour is never the only signal.
- Motion is reduced when the user asks for it (`prefers-reduced-motion` is already handled in `styles.css`).

## Known gaps

- **Some existing text is smaller than 12px.** Eyebrows (9–10px), status pills (9px) and a few labels in the teacher workspace and sign-in pages predate this rule. They were left unchanged so this task doesn't alter working screens. They should be raised when those screens are rebuilt on real data, or in the accessibility task (P10-08).
- **No dark-mode switch in the app yet.** The tokens are ready.
- **Pages use hand-written CSS classes** (`auth-*`, `workspace-*`, …). New screens should use the components above instead; old ones move over as they are rebuilt.
