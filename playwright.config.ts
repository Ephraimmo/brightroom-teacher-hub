import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests: real browsers against the running app. See docs/testing.md.
 *
 * Locally `npm run test:e2e` starts the dev server itself (or reuses one already
 * running on the port). Set E2E_BASE_URL to test a preview deployment instead.
 */
const PORT = 4173;
const baseURL = process.env["E2E_BASE_URL"] ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/warm-up.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env["CI"]),
  retries: process.env["CI"] ? 1 : 0,
  reporter: process.env["CI"] ? [["list"], ["html", { open: "never" }]] : "list",
  // The first request compiles the app in dev mode, which can take a while.
  timeout: 60_000,
  // Signed-out redirects wait for the browser to check for a session first.
  expect: { timeout: 20_000 },
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    // Phones are the main device for many families (docs/design-system.md).
    { name: "phone", use: { ...devices["Pixel 7"] } },
  ],
  // Start the dev server unless testing a deployed preview.
  ...(process.env["E2E_BASE_URL"]
    ? {}
    : {
        webServer: {
          command: `npm run dev -- --port ${PORT} --strictPort`,
          url: `${baseURL}/auth`,
          reuseExistingServer: !process.env["CI"],
          timeout: 180_000,
        },
      }),
});
