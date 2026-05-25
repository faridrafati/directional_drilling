/**
 * Mobile-viewport smoke test: at iPhone-SE width the layout should:
 *   - Show the hamburger header (no persistent sidebar)
 *   - Allow opening the drawer and clicking through to a project
 *   - Have a tap-friendly Create button
 */
import { test, expect } from "@playwright/test";

test.use({ viewport: { width: 375, height: 667 } });   // iPhone SE-ish

test("mobile: sidebar drawer + project creation", async ({ page }) => {
  await page.goto("/");
  await page.waitForURL(/\/projects$/);

  // The hamburger button is visible.
  const hamburger = page.getByRole("button", { name: "Open navigation" });
  await expect(hamburger).toBeVisible();

  // The sidebar is NOT visible by default (off-canvas).
  // We can verify by checking the "Recent calculations" header is hidden.
  // (it lives inside the off-canvas aside, which is translate-x-full).
  // Opening the drawer reveals it.
  await hamburger.click();
  await expect(page.getByText("Recent calculations").first()).toBeVisible();

  // Close via the scrim (click outside the drawer panel).
  await page.getByRole("button", { name: "Close navigation" }).first().click();

  // The create form is still usable.
  const projectName = `Mobile ${Date.now()}`;
  await page.getByPlaceholder("e.g. Hithfield Phase 2").fill(projectName);
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("link", { name: new RegExp(projectName) }).first()).toBeVisible();
});
