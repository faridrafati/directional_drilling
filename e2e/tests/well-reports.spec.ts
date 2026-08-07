/**
 * Well Reports E2E — the WellView report suite, end to end in a real browser.
 *
 * Sign in → the catalog renders → pick report 01 → the preview shows the
 * assembled numbers → click PDF → a real file lands on disk.
 *
 * The numbers asserted here are the ones `Wellview/01_AFEvsFieldEstvsFinalInvoice.pdf`
 * prints, and `scripts/seed-wellview-demo.mts` seeds the cost lines they are
 * computed from. So this is not "the page rendered something" — it is "the page
 * rendered the report the sample would have".
 *
 * Assumes the API (:4000) and web (:5173) are running and the demo seed has been
 * applied (`npm run db:seed:wellview`). Credentials come from the environment so
 * the test never carries a password:
 *
 *   ENTRY_USER=admin ENTRY_PASSWORD=… npx playwright test well-reports
 */
import { test, expect } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const USER = process.env.ENTRY_USER ?? "admin";
const PASSWORD = process.env.ENTRY_PASSWORD ?? "admin";

/** The well `scripts/seed-wellview-demo.mts` creates. */
const DEMO_WELL = "Sample 11 - Full Data";

/** The four totals report 01 computes, exactly as the sample prints them. */
const EXPECTED_TOTALS = [
  "10,218,000.00",   // Total AFE Amount
  "125,000.00",      // Total AFE Supplemental Amount
  "10,127,291.47",   // Total Field Estimate
  "215,708.53",      // AFE-Field Estimate
];

test.describe("Well Reports", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/well-reports");
    await page.getByRole("heading", { name: "Well Reports" }).waitFor();
    // A stored token from an earlier run skips the form entirely.
    const signIn = page.getByRole("button", { name: "Sign in" });
    if (await signIn.isVisible().catch(() => false)) {
      await page.getByLabel("User name").fill(USER);
      await page.getByLabel("Password").fill(PASSWORD);
      await signIn.click();
    }
    await expect(page.getByTestId("report-01")).toBeVisible({ timeout: 15_000 });
  });

  test("the catalog lists every report, grouped, with the unbuilt ones marked", async ({ page }) => {
    for (const category of ["Daily", "Engineering", "Cost & Multi-well", "Geology", "Completion"]) {
      await expect(page.getByText(category, { exact: true })).toBeVisible();
    }
    // 30 samples, 30 cards.
    await expect(page.locator("aside button")).toHaveCount(30);
    // Anything without an assembler says so rather than pretending to work.
    await expect(page.locator("aside button", { hasText: "BHA Detail" })).toContainText("soon");
  });

  test("a well with no job says so instead of asking for a job that isn't there", async ({ page }) => {
    await page.getByTestId("report-01").click();
    const wells = await page.getByLabel("Well", { exact: true }).locator("option").allTextContents();

    // Find a well that genuinely has no job, rather than assuming one exists —
    // which well is empty depends on the database this runs against.
    const noJob = page.getByText(/has no\s+drilling job recorded yet/);
    const sheet = page.getByText("Job Cost Summary");
    let found = false;
    for (const w of wells) {
      await page.getByLabel("Well", { exact: true }).selectOption({ label: w });
      // The panel settles into exactly one of two states; wait for either
      // rather than for a fixed delay.
      await expect(noJob.or(sheet).first()).toBeVisible({ timeout: 10_000 });
      if (await noJob.isVisible()) { found = true; break; }
    }
    test.skip(!found, "every well on this account has a job");
    await expect(page.getByText(/has no\s+drilling job recorded yet/)).toBeVisible();
    await expect(page.getByLabel("Job", { exact: true })).toBeDisabled();
  });

  test("report 01 previews the totals the sample prints", async ({ page }) => {
    await page.getByTestId("report-01").click();
    await page.getByLabel("Well", { exact: true }).selectOption({ label: DEMO_WELL });

    // The pickers are populated, not empty dropdowns.
    await expect(page.getByLabel("Well", { exact: true })).not.toHaveValue("");
    await expect(page.getByLabel("Job", { exact: true })).not.toHaveValue("");

    // The header block prints its labels even where the well has no value.
    for (const label of ["API/UWI", "Surface Legal Location", "Field Name", "License #",
      "State/Province", "Well Configuration Type", "KB-Ground Distance (m)", "Spud Date"]) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }

    for (const total of EXPECTED_TOTALS) {
      await expect(page.getByText(total, { exact: true }).first()).toBeVisible();
    }

    // Per-row variance, spot-checked against the sample's own arithmetic:
    // 5,000,000 + 0 − 4,617,116 = 382,884.
    await expect(page.getByText("382,884.00", { exact: true })).toBeVisible();
    // The same code pair appears twice — once AFE+supplement, once field-estimate
    // only with a negative variance. This is why CostItem has no unique on it.
    await expect(page.getByText("Electric logging").first()).toBeVisible();
    await expect(page.getByText("-50,000.00", { exact: true })).toBeVisible();

    // Blank is blank: an unknown amount must not print as 0.00. The sample's
    // Supp Amt column is empty on all but two of its 29 rows, so if a missing
    // value were being read as zero this count would be 27, not 2.
    //
    // Scoped to the cost table on purpose — an ENTERED zero must still print as
    // 0.00, and the well header's Casing Flange Elevation is one (the sample
    // prints 0.00 there too).
    const costTable = page.locator("table").last();
    const suppCells = costTable.locator("tbody tr td:nth-child(5)");
    await expect(suppCells.filter({ hasText: /\S/ })).toHaveCount(2);
    await expect(costTable.getByText("0.00", { exact: true })).toHaveCount(0);
  });

  // Reports 06 and 07 are the same well-day: 07 is 06 plus the detail sections.
  for (const [type, expected] of [
    ["06", ["24.00", "104.00", "52.00"]],
    ["07", ["24.00", "0.50", "2.08"]],
  ] as const) {
    test(`report ${type} previews the day's computed figures`, async ({ page }) => {
      await page.getByTestId(`report-${type}`).click();
      await page.getByLabel("Well", { exact: true }).selectOption({ label: DEMO_WELL });
      const dates = await page.getByLabel("Date", { exact: true }).locator("option").allTextContents();
      test.skip(dates.length === 0, "no day filed on the demo well");

      // The time log must account for the whole 24 hours — that is what the
      // sample's "Cum Dur" column reaching 24.00 asserts.
      await expect(page.getByText("hr of 24")).toBeVisible({ timeout: 15_000 });
      for (const value of expected) {
        await expect(page.getByText(value, { exact: true }).first()).toBeVisible();
      }
      // Depth Progress = End − Start = 299 − 195.
      await expect(page.getByText("Depth Progress (m)", { exact: true })).toBeVisible();
    });

    test(`report ${type} exports a PDF`, async ({ page }, testInfo) => {
      await page.getByTestId(`report-${type}`).click();
      await page.getByLabel("Well", { exact: true }).selectOption({ label: DEMO_WELL });
      await expect(page.getByText("hr of 24")).toBeVisible({ timeout: 15_000 });

      const dir = mkdtempSync(join(tmpdir(), "wellview-"));
      const [download] = await Promise.all([
        page.waitForEvent("download", { timeout: 30_000 }),
        page.getByRole("button", { name: "PDF" }).click(),
      ]);
      const path = join(dir, download.suggestedFilename());
      await download.saveAs(path);
      await testInfo.attach(`report-${type}.pdf`, { path, contentType: "application/pdf" });
      const { statSync, readFileSync } = await import("node:fs");
      expect(statSync(path).size).toBeGreaterThan(5_000);
      expect(readFileSync(path).subarray(0, 5).toString()).toBe("%PDF-");
    });
  }

  test("the PDF button produces a file", async ({ page }, testInfo) => {
    await page.getByTestId("report-01").click();
    await page.getByLabel("Well", { exact: true }).selectOption({ label: DEMO_WELL });
    await expect(page.getByText("10,218,000.00").first()).toBeVisible();

    const downloadDir = mkdtempSync(join(tmpdir(), "wellview-"));
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 30_000 }),
      page.getByRole("button", { name: "PDF" }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.pdf$/);
    const path = join(downloadDir, download.suggestedFilename());
    await download.saveAs(path);
    await testInfo.attach("report-01.pdf", { path, contentType: "application/pdf" });

    // A pdfmake failure downloads a 0-byte file rather than throwing, so size is
    // the assertion that actually catches a broken document definition.
    const { statSync, readFileSync } = await import("node:fs");
    expect(statSync(path).size).toBeGreaterThan(5_000);
    expect(readFileSync(path).subarray(0, 5).toString()).toBe("%PDF-");
  });
});
