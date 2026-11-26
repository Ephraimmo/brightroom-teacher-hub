# Running the tests

What tests exist today, how to run them, and where to add new ones. The full strategy (database security tests, load, payments, accessibility, pilot) is in [plan/08-testing.md](plan/08-testing.md).

## Commands

| Command                    | What it runs                                                                                        | Time     |
| -------------------------- | --------------------------------------------------------------------------------------------------- | -------- |
| `npm run test`             | Unit and component tests (Vitest, in a simulated browser)                                           | ~20 s    |
| `npm run test:watch`       | The same, re-running as you edit                                                                    | —        |
| `npm run test:e2e:install` | Downloads the Chromium browser Playwright uses. **Once per machine**, and after Playwright upgrades | ~1 min   |
| `npm run test:e2e`         | End-to-end tests in a real browser, on desktop and phone sizes. Starts the dev server itself        | ~1–2 min |
| `npm run typecheck`        | TypeScript                                                                                          | ~15 s    |
| `npm run lint`             | Code rules                                                                                          | ~15 s    |
| `npm run format:check`     | Formatting (`npm run format` fixes it)                                                              | ~5 s     |
| `npm run check:secrets`    | No secrets in committed files                                                                       | ~2 s     |
| `npm run check`            | Typecheck + lint + unit tests + secret check                                                        | ~1 min   |

**CI** (GitHub Actions, `.github/workflows/ci.yml`) runs all of these on every push to `main` and every pull request, in two jobs: `checks` and `e2e`. When `e2e` fails, its report (screenshots and a trace of each failed test) is attached to the run for 7 days.

## Where tests live

| Kind           | Folder                | Tool                     | Use it for                                                                         |
| -------------- | --------------------- | ------------------------ | ---------------------------------------------------------------------------------- |
| Business rules | `src/test/*.test.ts`  | Vitest                   | Pure functions in `src/domain` and `src/lib` (access rules, navigation, redaction) |
| Components     | `src/test/*.test.tsx` | Vitest + Testing Library | A component's states, labels and buttons; mock data hooks with `vi.mock`           |
| End-to-end     | `e2e/*.spec.ts`       | Playwright               | Whole journeys through the real app in a real browser                              |

## End-to-end tests

- `playwright.config.ts` runs every test twice: **desktop** (Chrome) and **phone** (Pixel 7 size).
- Locally it starts `npm run dev` on port 4173, or reuses one already running there. `e2e/warm-up.ts` opens the main pages first, because the dev server compiles each part of the app on first use.
- To test a deployed preview instead: set `E2E_BASE_URL=https://…` and run `npm run test:e2e`.
- After a failure: `npx playwright show-report` opens screenshots and a step-by-step trace.

**Today they cover signed-out journeys only:** the landing page and its buttons, sign-in and sign-up entry, redirects from old addresses, role areas asking for sign-in, the 404 page, no sideways scrolling on phones, and request IDs.

**Signed-in journeys need a test database.** Tests must never sign in to the live Lovable Cloud project, because it holds real accounts ([environments.md](environments.md)). Once the separate staging/test project exists, add seeded test users and sign-in helpers, then cover each role's journey ([plan/11-user-journeys.md](plan/11-user-journeys.md)).

## Rules for new work

- Every task adds tests for its new behaviour and its permissions (who can and can't do it).
- Every new page gets at least one end-to-end test that opens it and checks its main action.
- Never use real names, emails or ID numbers in tests. Build secret-looking strings at runtime (see `src/test/secret-scan.test.ts`) so the secret check doesn't flag the test file.
