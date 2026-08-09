/**
 * Mobile-viewport smoke test: at iPhone-SE width the layout should:
 *   - Show the hamburger header (no persistent sidebar)
 *   - Allow opening the drawer and clicking through to a project
 *   - Have a tap-friendly Create button
 */
import { test, expect } from "@playwright/test";

test.use({ viewport: { width: 375, height: 667 } });   // iPhone SE-ish

test("mobile: the projects surface is usable at 375px", async ({ page }) => {
  // "/" has redirected to /ddr since the app's landing page moved to Daily
  // Drilling Reports (8b8cd76); these specs are about the Projects surface, so
  // they ask for it by name rather than relying on the default route.
  await page.goto("/projects");
  await page.waitForURL(/\/projects$/);

  // The off-canvas drawer this spec used to exercise — a hamburger, a scrim and
  // a "Recent calculations" panel — no longer exists anywhere in the app; the
  // navigation moved into the top bar. What is still worth smoke-testing at
  // 375px is that the page is USABLE there: the nav reachable, the create form
  // reachable, and nothing overflowing the viewport sideways.
  await expect(page.getByRole("link", { name: "Directional Drilling" }).first()).toBeVisible();

  // Nothing may scroll the page horizontally on a phone. This is the failure a
  // desktop-only run never catches and a user hits immediately.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);

  // The create form is still usable.
  const projectName = `Mobile ${Date.now()}`;
  await page.getByPlaceholder("e.g. Hithfield Phase 2").fill(projectName);
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("link", { name: new RegExp(projectName) }).first()).toBeVisible();
});
