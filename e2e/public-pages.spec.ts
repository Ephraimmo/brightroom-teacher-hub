import { expect, test } from "@playwright/test";

/**
 * Journeys a signed-out visitor can take. These need no test accounts, so they
 * run anywhere. Signed-in journeys arrive with a seeded test database
 * (docs/plan/08-testing.md).
 */

test.describe("landing page", () => {
  test("shows the overview and the main sections", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "One lesson, in the classroom and online.",
    );
    for (const name of ["What LearnBridge is built to do", "How it works", "Plans"]) {
      await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
    }
    await expect(page.getByText("Pricing coming soon")).toHaveCount(4);
  });

  test("Create account opens the sign-up form", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Create a family account" }).click();
    await expect(page).toHaveURL(/\/auth\?mode=sign-up$/);
    const tabs = page.getByRole("group", { name: "Account action" });
    await expect(tabs.getByRole("button", { name: "Create account" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("Sign in opens the sign-in form", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("banner").getByRole("link", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/auth$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Welcome back");
  });

  test("fits the screen without sideways scrolling", async ({ page }) => {
    await page.goto("/");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});

test.describe("navigation for signed-out visitors", () => {
  test("old teacher addresses redirect, then ask for sign-in", async ({ page }) => {
    await page.goto("/classes");
    await expect(page).toHaveURL(/\/auth$/);
  });

  test("role areas ask for sign-in", async ({ page }) => {
    for (const area of ["/teach", "/school", "/admin", "/learn", "/family"]) {
      await page.goto(area);
      await expect(page, `${area} should send visitors to sign-in`).toHaveURL(/\/auth$/);
    }
  });

  test("unknown addresses show the 404 page with a way home", async ({ page }) => {
    const response = await page.goto("/this-page-does-not-exist");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    await page.getByRole("link", { name: "Go to my home page" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "One lesson, in the classroom and online.",
    );
  });
});

test("every response carries a request ID", async ({ request }) => {
  const response = await request.get("/");
  expect(response.headers()["x-request-id"]).toMatch(/^[A-Za-z0-9._-]{8,64}$/);
});
