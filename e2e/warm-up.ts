import { chromium, type FullConfig } from "@playwright/test";

/**
 * The dev server compiles each part of the app the first time it is opened.
 * Open the main pages once before the tests start, so a test doesn't fail just
 * because it was first to trigger a slow compile. (A production build can't be
 * served locally: it is a Cloudflare Worker.)
 */
export default async function warmUp(config: FullConfig) {
  const baseURL = config.projects[0]?.use.baseURL;
  if (!baseURL) return;

  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const path of ["/", "/auth", "/teach", "/school", "/design-system", "/access-pending"]) {
    await page.goto(new URL(path, baseURL).toString(), { timeout: 120_000 });
    await page.waitForLoadState("networkidle", { timeout: 120_000 }).catch(() => {});
  }
  await browser.close();
}
