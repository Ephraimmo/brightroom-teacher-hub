import { expect, test, type Page } from "@playwright/test";

/**
 * Demo mode (docs/demo.md): sample data in the browser tab, no account, no
 * database. Safe to run anywhere.
 */

// Each test opens several pages, and the dev server compiles each on first use.
test.slow();

async function exploreAs(page: Page, title: string) {
  await page.goto("/demo");
  await page.getByRole("link", { name: `Explore as ${title}` }).click();
  // The dev server can take a while to load the page's scripts the first time.
  await expect(page.getByRole("region", { name: "Demo mode" })).toContainText(
    `exploring as ${title}`,
    { timeout: 60_000 },
  );
}

test("the sign-in page links to the demo", async ({ page }) => {
  await page.goto("/auth");
  await page.getByRole("link", { name: "Explore the demo" }).click();
  await expect(page).toHaveURL(/\/demo$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Explore LearnBridge with sample data",
  );
});

test("a school admin manages sample parents, and changes last for the tab", async ({ page }) => {
  await exploreAs(page, "School admin");
  await expect(page).toHaveURL(/\/school$/);

  await page.goto("/school/parents");
  await expect(page.getByRole("listitem", { name: "Mpho Khumalo" })).toBeVisible();

  await page.getByRole("button", { name: "Add a parent or guardian" }).click();
  await page.getByLabel(/First name/).fill("Lindiwe");
  await page.getByLabel(/Surname/).fill("Mabaso");
  await page.getByLabel(/Relationship to the learner/).selectOption("guardian");
  await page.getByLabel(/Email address/).fill("lindiwe.mabaso@demo.learnbridge.test");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText(/Lindiwe Mabaso added/)).toBeVisible();

  await page.reload();
  await expect(page.getByRole("listitem", { name: "Lindiwe Mabaso" })).toBeVisible();

  await page
    .getByRole("region", { name: "Demo mode" })
    .getByRole("button", { name: "Reset data" })
    .click();
  await expect(page.getByRole("listitem", { name: "Lindiwe Mabaso" })).toHaveCount(0);
});

test("a platform admin sees the sample schools", async ({ page }) => {
  await exploreAs(page, "Platform admin");
  await page.goto("/admin/institutions");
  await expect(page.getByText("Bright Futures Tutoring")).toBeVisible();
  await expect(page.getByText("Greenridge Learning Centre")).toBeVisible();
});

test("switching role and leaving the demo", async ({ page }) => {
  await exploreAs(page, "Teacher");
  await expect(page).toHaveURL(/\/teach$/);
  await page
    .getByRole("region", { name: "Demo mode" })
    .getByRole("link", { name: "Switch role" })
    .click();
  await page.getByRole("link", { name: "Explore as Parent" }).click();
  await expect(page).toHaveURL(/\/family$/);
  await page
    .getByRole("region", { name: "Demo mode" })
    .getByRole("button", { name: "Leave demo" })
    .click();
  await expect(page).toHaveURL(/\/auth$/);
  await expect(page.getByRole("region", { name: "Demo mode" })).toHaveCount(0);
});
