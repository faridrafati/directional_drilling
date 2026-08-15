/**
 * WellView Online E2E — the desktop application's core loop in a real browser:
 * open a database → the Well Explorer lists the wells → quick query narrows
 * them → open a well → a report template fills from the database → the
 * schematic draws → the Edit Data window reads a subfolder under its parent
 * chain → the Data Auditor reports rule findings.
 *
 * Reads the REAL converted sample database through the running API. Assumes
 * api (:4000) and web (:5173) are up. Credentials from the environment, as for
 * every spec here:
 *
 *   ENTRY_USER=admin ENTRY_PASSWORD=… npx playwright test wellview-online
 */
import { test, expect } from "@playwright/test";

const USER = process.env.ENTRY_USER ?? "admin";
const PASSWORD = process.env.ENTRY_PASSWORD ?? "";

test.describe("WellView Online", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/wellview");
    await page.getByRole("heading", { name: "WellView" }).waitFor();
    const signIn = page.getByRole("button", { name: "Sign in" });
    if (await signIn.isVisible().catch(() => false)) {
      await page.getByLabel("User name").fill(USER);
      await page.getByLabel("Password").fill(PASSWORD);
      await signIn.click();
    }
    // ch 1: the Open Database window, then the sample database.
    await page.getByTestId("wv-db-wv9.0_Sample").click();
    await expect(page.getByTestId("wv-well-row").first()).toBeVisible({ timeout: 15_000 });
  });

  test("well explorer lists the wells and quick query narrows them", async ({ page }) => {
    const all = await page.getByTestId("wv-well-row").count();
    expect(all).toBeGreaterThan(10);

    await page.getByText("Quick Query").click();
    await page.getByPlaceholder("full or partial value").fill("Drilling");
    await page.getByRole("button", { name: "Refresh" }).click();
    await expect
      .poll(async () => page.getByTestId("wv-well-row").count(), { timeout: 10_000 })
      .toBeLessThan(all);
    // every remaining row matches the query
    for (const text of await page.getByTestId("wv-well-row").allTextContents()) {
      expect(text.toLowerCase()).toContain("drilling");
    }
  });

  test("an opened well fills a report template and draws the schematic", async ({ page }) => {
    await page.getByTestId("wv-well-row").first().dblclick();
    await expect(page.getByText("Select a report")).toBeVisible({ timeout: 15_000 });

    await page.getByPlaceholder("Search reports…").fill("Daily Drilling");
    await page.getByRole("button", { name: "Daily Drilling", exact: true }).click();
    await expect(page.getByText("blocks have rows")).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "Schematic", exact: true }).click();
    await expect(page.getByText("History player", { exact: false })).toBeVisible();
    await expect(page.getByRole("img", { name: "Wellbore schematic" })).toBeVisible();
  });

  test("edit data walks the subject tree down to Daily Operations", async ({ page }) => {
    await page.getByTestId("wv-well-row").first().dblclick();
    await page.getByRole("button", { name: "Edit Data", exact: true }).click();
    await expect(page.getByText("Show System Fields")).toBeVisible({ timeout: 15_000 });

    await page.locator('button[title="wvJob"]').click();
    await page.locator('button[title="wvJobReport"]').click();
    // records appear under the parent job with Previous/Next in the chain bar
    await expect(page.getByText("Daily Operations").first()).toBeVisible();
    await page.getByTestId("wv-edit-save-exit").click();
  });

  test("the data auditor runs the §10.2 rules and reports findings", async ({ page }) => {
    await page.getByRole("button", { name: "Data Audit" }).click();
    await expect(page.getByText("Data Auditor", { exact: true })).toBeVisible();
    await expect(page.getByText(/rules run/)).toBeVisible({ timeout: 20_000 });
    // the sample database is imperfect on purpose — findings exist, grouped by report
    await expect(page.getByRole("heading", { name: /Well Header Information/ })).toBeVisible();
  });
});
