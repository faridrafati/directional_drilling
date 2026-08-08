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
/**
 * The one day the seed writes up IN FULL. The well now carries eleven more,
 * lighter days so report 09's job-wide panels have something to break down, so
 * a day-scoped report must NAME the day it means — the picker defaults to
 * whichever day the list happens to start with.
 *
 * Selected by VALUE, not label: the option reads "1405/02/11 · #2", so matching
 * on the label would also have to track the day's serial number.
 */
const DEMO_DAY = "1405/02/11";

/** The reports with an assembler today; the rest still carry a "soon" badge. */
const BUILT = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "13", "15", "16", "17"] as const;

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
    // A report that IS built carries no "soon" badge, and one that is not does.
    // Asserted structurally rather than by naming a report, so building the next
    // one does not break this test — only the counts move.
    for (const type of BUILT) {
      await expect(page.getByTestId(`report-${type}`)).not.toContainText("soon");
    }
    const pending = await page.locator("aside button", { hasText: "soon" }).count();
    expect(pending).toBe(30 - BUILT.length);
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
      await page.getByLabel("Date", { exact: true }).selectOption(DEMO_DAY);

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
      await page.getByLabel("Date", { exact: true }).selectOption(DEMO_DAY);
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

  // Reports 02 and 03 are run-scoped: 02 is one page per assembly, 03 one row
  // per assembly across the well. Both derive their figures from the day rows
  // that carry the run's id.
  test("report 02 previews the run's derived figures", async ({ page }) => {
    await page.getByTestId("report-02").click();
    await page.getByLabel("Well", { exact: true }).selectOption({ label: DEMO_WELL });
    const runs = await page.getByLabel("BHA run", { exact: true }).locator("option").allTextContents();
    test.skip(runs.length === 0, "no BHA run on the demo well");

    // Depth In comes from the first day's string, Depth Out from the run master,
    // Depth Drilled and the ROP from the days between them.
    for (const label of ["Depth In (mKB)", "Depth Out (mKB)", "Depth Drilled (m)", "BHA ROP (m/hr)"]) {
      await expect(page.getByText(label, { exact: true })).toBeVisible({ timeout: 15_000 });
    }
    await expect(page.getByText("195.00", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("810.00", { exact: true }).first()).toBeVisible();
    // String Length is Σ the make-up's component lengths, not a typed figure.
    await expect(page.getByText("299.03", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Sensors", { exact: true })).toBeVisible();
    // The sample's schematic is not drawn; the page says so rather than leaving
    // a silent gap.
    await expect(page.getByText(/vertical wellbore schematic/)).toBeVisible();
  });

  test("report 03 lists every run on the well", async ({ page }) => {
    await page.getByTestId("report-03").click();
    await page.getByLabel("Well", { exact: true }).selectOption({ label: DEMO_WELL });
    await expect(page.getByText("Bits", { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("1-1-NO-A-2-0-NO-TD", { exact: true })).toBeVisible();
    // Drilled = Σ the days' progress; ROP = that ÷ the run's hours.
    await expect(page.getByText("104.00", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("52.00", { exact: true }).first()).toBeVisible();
  });

  for (const type of ["02", "03"] as const) {
    test(`report ${type} exports a PDF`, async ({ page }, testInfo) => {
      await page.getByTestId(`report-${type}`).click();
      await page.getByLabel("Well", { exact: true }).selectOption({ label: DEMO_WELL });
      await expect(page.getByRole("button", { name: "PDF" })).toBeVisible({ timeout: 15_000 });
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

  // Reports 04 and 05 read the casing spine. The figures asserted here are the
  // ones `scripts/seed-wellview-demo.mts` types into the tally — 298.48 m is the
  // SUM of the four tally lengths, not the string's set depth (298.5), and the
  // two differing by 0.02 m is exactly why the report sums rather than reusing
  // the depth.
  test("report 05 sums each string's tally", async ({ page }) => {
    await page.getByTestId("report-05").click();
    await page.getByLabel("Well", { exact: true }).selectOption({ label: DEMO_WELL });
    await expect(page.getByText("Conductor Pipe, 98.0mKB")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Surface Casing, 298.5mKB")).toBeVisible();
    // Joints: 7 + 1 and 24 + 1 + 2 + 1. Length: the tally's own metres.
    await expect(page.getByText("298.48", { exact: true }).first()).toBeVisible();
    for (const jts of ["8", "28"]) {
      await expect(page.getByText(jts, { exact: true }).first()).toBeVisible();
    }
  });

  test("report 04 prints one string with its hole, its mud and its cement", async ({ page }) => {
    await page.getByTestId("report-04").click();
    await page.getByLabel("Well", { exact: true }).selectOption({ label: DEMO_WELL });
    // The string picker appears and defaults to the first string on the well.
    const picker = page.getByLabel("Casing string", { exact: true });
    await expect(picker).toBeVisible({ timeout: 15_000 });
    await expect(picker).not.toHaveValue("");
    // selectOption matches an option's label EXACTLY, so the visible text is
    // read off the option first rather than guessed from its description.
    const label = (await picker.locator("option", { hasText: "Surface Casing" })
      .first().textContent())!.trim();
    await picker.selectOption({ label });

    await expect(page.getByText("Cement", { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    // Hole sections, the string's own block, and the cement stage's figures.
    await expect(page.getByText("17 1/2", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Class G + 8% bentonite")).toBeVisible();
    // Vol cement is DERIVED — 42.5 + 14.8 pumped, because the stage leaves it blank.
    await expect(page.getByText("57.30", { exact: true }).first()).toBeVisible();
    // The last mud check is the newest one on or before the run date, not the
    // newest on the well.
    await expect(page.getByText("KCl-Polymer", { exact: true }).first()).toBeVisible();
    // The schematic the sample draws beside these blocks is declared missing
    // rather than left as a silent gap.
    await expect(page.getByText(/vertical wellbore schematic/)).toBeVisible();
  });

  for (const type of ["04", "05"] as const) {
    test(`report ${type} exports a PDF`, async ({ page }, testInfo) => {
      await page.getByTestId(`report-${type}`).click();
      await page.getByLabel("Well", { exact: true }).selectOption({ label: DEMO_WELL });
      await expect(page.getByRole("button", { name: "PDF" })).toBeVisible({ timeout: 15_000 });
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

  // Reports 13 and 16 are the two pivots, and the first reports in the suite
  // with a spreadsheet export. Their figures are cross-checked against reports
  // that compute the same quantities a different way — 13's cost totals against
  // report 01's, 16's phase sum against report 10's cumulative column.
  test("report 13's KPI row agrees with report 01's cost totals", async ({ page }) => {
    await page.getByTestId("report-13").click();
    await expect(page.getByText("Drilling KPIs").first()).toBeVisible({ timeout: 20_000 });

    // AFE+Supp = 10,218,000 + 125,000; the variance is report 01's own figure.
    await expect(page.getByText("10,343,000.00", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("10,127,291.47", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("215,708.53", { exact: true }).first()).toBeVisible();
    // 12 days × 24 hr, of which 8 were trouble.
    await expect(page.getByText("288.00", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("2.78", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Grand Total", { exact: true })).toBeVisible();
  });

  test("report 16 pivots the phase spine, and its sum matches report 10", async ({ page }) => {
    await page.getByTestId("report-16").click();
    await expect(page.getByText("Phase Summary Pivot").first()).toBeVisible({ timeout: 20_000 });

    // Eight phases; their durations sum to 25.46 days — the very figure report
    // 10's last cumulative cell prints, reached by a different route.
    await expect(page.getByText("25.46", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("10.23", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Drill-Deviation Control").first()).toBeVisible();
    await expect(page.getByText("Grand Total", { exact: true })).toBeVisible();
  });

  for (const type of ["13", "16"] as const) {
    test(`report ${type} exports a PDF and a spreadsheet`, async ({ page }, testInfo) => {
      test.setTimeout(90_000);
      await page.getByTestId(`report-${type}`).click();
      await expect(page.getByRole("button", { name: "PDF" })).toBeVisible({ timeout: 20_000 });
      const dir = mkdtempSync(join(tmpdir(), "wellview-"));
      const { statSync, readFileSync } = await import("node:fs");

      const [pdf] = await Promise.all([
        page.waitForEvent("download", { timeout: 60_000 }),
        page.getByRole("button", { name: "PDF" }).click(),
      ]);
      const pdfPath = join(dir, pdf.suggestedFilename());
      await pdf.saveAs(pdfPath);
      await testInfo.attach(`report-${type}.pdf`, { path: pdfPath, contentType: "application/pdf" });
      expect(statSync(pdfPath).size).toBeGreaterThan(4_000);
      expect(readFileSync(pdfPath).subarray(0, 5).toString()).toBe("%PDF-");

      // The spreadsheet is the point of these two — a picture of a pivot is
      // not something an engineer can sum, sort or chart.
      const [xlsx] = await Promise.all([
        page.waitForEvent("download", { timeout: 60_000 }),
        page.getByRole("button", { name: "Excel" }).click(),
      ]);
      expect(xlsx.suggestedFilename()).toMatch(/\.xlsx$/);
      const xlsxPath = join(dir, xlsx.suggestedFilename());
      await xlsx.saveAs(xlsxPath);
      await testInfo.attach(`report-${type}.xlsx`, { path: xlsxPath });
      expect(statSync(xlsxPath).size).toBeGreaterThan(2_000);
      // "PK" — a .xlsx is a zip. A file that opens as anything else would still
      // download happily and fail only in Excel.
      expect(readFileSync(xlsxPath).subarray(0, 2).toString()).toBe("PK");
    });
  }

  // Reports 15 and 17 are the first MULTI-well pages: they are scoped to a set
  // of wells rather than one, and default to every well the account may use.
  // Neither takes the Well picker, so neither is selected here.
  test("report 17 lists every incident across the well set", async ({ page }) => {
    await page.getByTestId("report-17").click();
    await expect(page.getByText("Safety Incidents", { exact: true }).first())
      .toBeVisible({ timeout: 20_000 });

    // The set is named, not implied: a reader cannot otherwise tell whether a
    // well is absent because it was clean or because it was never selected.
    await expect(page.getByTestId("well-set-picker")).toContainText("All wells");
    await expect(page.getByText(DEMO_WELL).first()).toBeVisible();

    // Six incidents, oldest first, each with the narrative that IS the report.
    await expect(page.getByText(/rig hand inadvertently released line/)).toBeVisible();
    await expect(page.getByText(/severed part of his fingernail/)).toBeVisible();
    // One is deliberately unanswered — printed as a blank and counted, never
    // folded into "No".
    await expect(page.getByText("Lost Time Unanswered", { exact: true })).toBeVisible();
    await expect(page.getByText("1", { exact: true }).first()).toBeVisible();
  });

  test("report 15 pivots problem cost on the accountable party", async ({ page }) => {
    await page.getByTestId("report-15").click();
    await expect(page.getByText("Problem Cost by Accountable Party").first())
      .toBeVisible({ timeout: 20_000 });
    await expect(page.locator("#wellview-problem-cost svg").first()).toBeVisible();

    // Contractor 2,500 + 16,800; Operator 19,200; 38,500 across three problems.
    for (const value of ["2,500.00", "16,800.00", "19,200.00", "38,500.00"]) {
      await expect(page.getByText(value, { exact: true }).first()).toBeVisible();
    }
    // The sub-type is part of the stack's identity — "Rig Failure" alone and
    // "Rig Failure - Top Drive" are different bars.
    await expect(page.getByText("Rig Failure - Top Drive").first()).toBeVisible();
  });

  test("the well set can be narrowed, and the report follows it", async ({ page }) => {
    await page.getByTestId("report-17").click();
    await expect(page.getByText(/rig hand inadvertently released line/)).toBeVisible({ timeout: 20_000 });

    // Untick the demo well: in "all" mode every box is drawn ticked, so one
    // click means "all except this one" — and its incidents must leave.
    await page.getByTestId("well-set-picker").click();
    await page.locator("label", { hasText: DEMO_WELL }).locator("input[type=checkbox]").click();
    await page.getByTestId("well-set-picker").click();      // fold it away

    await expect(page.getByText(/rig hand inadvertently released line/)).toHaveCount(0, { timeout: 20_000 });
    await expect(page.getByTestId("well-set-picker")).not.toContainText("All wells");
  });

  for (const type of ["15", "17"] as const) {
    test(`report ${type} exports a PDF`, async ({ page }, testInfo) => {
      test.setTimeout(90_000);
      await page.getByTestId(`report-${type}`).click();
      await expect(page.getByRole("button", { name: "PDF" })).toBeVisible({ timeout: 20_000 });
      // 15 rasterizes its chart; let the preview finish drawing first.
      if (type === "15") {
        await expect(page.locator("#wellview-problem-cost svg").first()).toBeVisible({ timeout: 20_000 });
        await page.waitForTimeout(700);
      }
      const dir = mkdtempSync(join(tmpdir(), "wellview-"));
      const [download] = await Promise.all([
        page.waitForEvent("download", { timeout: 60_000 }),
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

  // Reports 08 and 09 are the two chart-only pages. Both rasterize their live
  // Recharts surfaces, so both assert the SVG is mounted before exporting —
  // the export throws rather than printing a blank panel, and a test that did
  // not wait would be testing that error message.
  test("report 08 draws the plan against the actual", async ({ page }) => {
    await page.getByTestId("report-08").click();
    await page.getByLabel("Well", { exact: true }).selectOption({ label: DEMO_WELL });
    await expect(page.getByText("Vertical Section", { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("#wellview-vs-plot svg").first()).toBeVisible();
    await expect(page.locator("#wellview-plan-plot svg").first()).toBeVisible();

    // The extents line states what each curve reached: 9 plan stations to
    // 2,760 mKB, 4 surveys to 299. If the two tables were ever merged these
    // would collapse into one number.
    await expect(page.getByText("2,760.00", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("299.00", { exact: true }).first()).toBeVisible();
    // Both curves are in the station listing, each labelled with its source.
    await expect(page.getByText("TD — Target A")).toBeVisible();
    await expect(page.getByText("KOP", { exact: true })).toBeVisible();
  });

  test("report 09 breaks the job down four ways", async ({ page }) => {
    await page.getByTestId("report-09").click();
    await page.getByLabel("Well", { exact: true }).selectOption({ label: DEMO_WELL });
    await expect(page.getByText(/Time Breakdown by Code 1/)).toBeVisible({ timeout: 20_000 });
    for (const id of [
      "#wellview-summary-time", "#wellview-summary-cost",
      "#wellview-summary-npt", "#wellview-summary-progress",
    ]) {
      await expect(page.locator(`${id} svg`).first()).toBeVisible();
    }
    // 12 days × 24 h. Both percentage panels are shares of THIS number, which
    // is what stops NPT reading as a share of itself.
    await expect(page.getByText("288.00", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("12", { exact: true }).first()).toBeVisible();
    // The header band report 09 adds over the standard one.
    // `.first()`: "Total Depth (mKB)" is in the header band AND the job row —
    // the report states it twice, exactly as the sample does.
    for (const label of ["Area", "Operator", "County", "E/W Ref", "N/S Ref", "Total Depth (mKB)"]) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    }
  });

  for (const [type, chartId] of [
    ["08", "#wellview-vs-plot"],
    ["09", "#wellview-summary-progress"],
  ] as const) {
    test(`report ${type} exports a PDF with its charts`, async ({ page }, testInfo) => {
      // Longer than the 30 s default on purpose: 09 rasterizes FOUR panels and
      // lays them out on a legal-size landscape page with a 28-row table, and
      // the default budget covers the click-to-download round trip alone.
      test.setTimeout(120_000);
      await page.getByTestId(`report-${type}`).click();
      await page.getByLabel("Well", { exact: true }).selectOption({ label: DEMO_WELL });
      await expect(page.locator(`${chartId} svg`).first()).toBeVisible({ timeout: 20_000 });
      await page.waitForTimeout(700);

      const dir = mkdtempSync(join(tmpdir(), "wellview-"));
      const [download] = await Promise.all([
        page.waitForEvent("download", { timeout: 90_000 }),
        page.getByRole("button", { name: "PDF" }).click(),
      ]);
      const path = join(dir, download.suggestedFilename());
      await download.saveAs(path);
      await testInfo.attach(`report-${type}.pdf`, { path, contentType: "application/pdf" });
      const { statSync, readFileSync } = await import("node:fs");
      // Rasterized panels make the file substantially bigger than a table-only
      // report — a thin file here means an image never made it in.
      expect(statSync(path).size).toBeGreaterThan(20_000);
      expect(readFileSync(path).subarray(0, 5).toString()).toBe("%PDF-");
    });
  }

  // Reports 10 and 11 read the phase spine. The durations asserted here are the
  // ones the SAMPLE prints for the same phase boundaries — 09:00 → 21:45 the
  // next day is 1.53 days, and the eight of them cumulate to 25.46 (not 25.47,
  // which is what re-summing the rounded column would give).
  test("report 10 previews the phase arithmetic the sample prints", async ({ page }) => {
    await page.getByTestId("report-10").click();
    await page.getByLabel("Well", { exact: true }).selectOption({ label: DEMO_WELL });
    await expect(page.getByText("Phases", { exact: true })).toBeVisible({ timeout: 15_000 });
    for (const value of ["1.53", "1.38", "2.91", "25.46", "19.20"]) {
      await expect(page.getByText(value, { exact: true }).first()).toBeVisible();
    }
    // The graph is a live chart, not a picture — the export rasterizes this SVG.
    await expect(page.locator("#wellview-phase-chart svg").first()).toBeVisible();
  });

  test("report 11 previews the job header and its bars", async ({ page }) => {
    await page.getByTestId("report-11").click();
    await page.getByLabel("Well", { exact: true }).selectOption({ label: DEMO_WELL });
    await expect(page.getByText("Duration and cost by phase")).toBeVisible({ timeout: 15_000 });
    for (const label of ["Planned Start Date", "Planned Most Likely End Date", "Target Formation"]) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }
    await expect(page.locator("#wellview-phase-bars svg").first()).toBeVisible();
  });

  for (const [type, chartId] of [
    ["10", "#wellview-phase-chart"],
    ["11", "#wellview-phase-bars"],
  ] as const) {
    test(`report ${type} exports a PDF with its chart`, async ({ page }, testInfo) => {
      await page.getByTestId(`report-${type}`).click();
      await page.getByLabel("Well", { exact: true }).selectOption({ label: DEMO_WELL });
      // The chart must have DRAWN before the export runs — it rasterizes the
      // live SVG and throws rather than printing a blank panel.
      await expect(page.locator(`${chartId} svg`).first()).toBeVisible({ timeout: 20_000 });
      await page.waitForTimeout(600);

      const dir = mkdtempSync(join(tmpdir(), "wellview-"));
      const [download] = await Promise.all([
        page.waitForEvent("download", { timeout: 30_000 }),
        page.getByRole("button", { name: "PDF" }).click(),
      ]);
      const path = join(dir, download.suggestedFilename());
      await download.saveAs(path);
      await testInfo.attach(`report-${type}.pdf`, { path, contentType: "application/pdf" });
      const { statSync, readFileSync } = await import("node:fs");
      // A rasterized chart makes the file substantially bigger than a table-only
      // report — a thin file here means the image never made it in.
      expect(statSync(path).size).toBeGreaterThan(20_000);
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
