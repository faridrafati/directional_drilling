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
/**
 * The second well the seed drills, so the multi-well reports have something to
 * compare against — deliberately faster and shallower than the demo well.
 */
const OFFSET_WELL = "Sample 12 - Offset";

/** The reports with an assembler today; the rest still carry a "soon" badge. */
const BUILT = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11",
  "12", "13", "14", "15", "16", "17", "18", "19", "20", "21",
  "22", "23", "24", "25", "26", "27", "28", "29", "30"] as const;

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
    // The schematic is DRAWN now, not apologised for.
    await expect(page.locator("#wellview-schematic-02 svg").first()).toBeVisible();
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
    // The schematic is DRAWN now, not apologised for.
    await expect(page.locator("#wellview-schematic-04 svg").first()).toBeVisible();
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

  // ── Tier 5: the completion reports ────────────────────────────────────────
  // Nine reports over the completion tables. Five of them draw the SHARED
  // schematic, so the loop below asserts the picture is drawn on each rather
  // than trusting that fixing it once fixed it everywhere.
  for (const [type, needsDay] of [
    ["22", false], ["23", true], ["24", false], ["26", false],
    ["27", false], ["28", false], ["29", false], ["30", false],
  ] as const) {
    test(`report ${type} assembles from the completion tables`, async ({ page }) => {
      test.setTimeout(60_000);
      await page.getByTestId(`report-${type}`).click();
      await page.getByLabel("Well", { exact: true }).selectOption({ label: DEMO_WELL });
      if (needsDay) await page.getByLabel("Date", { exact: true }).selectOption(DEMO_DAY);
      // Every one of them names the well and reaches its footer, which only
      // renders once the whole payload has been laid out.
      //
      // The identity LABEL, not the well name: the first match for the name is
      // the hidden <option> inside the well picker, and asserting that would
      // pass whether or not the report rendered at all.
      await expect(page.getByText("Report Printed:").first()).toBeVisible({ timeout: 25_000 });
      await expect(page.getByText("Well Name:", { exact: true }).first()).toBeVisible();
    });
  }

  // The two "everything about the well" reports carried a smoke check and no
  // assertion on a single printed value, which is how they sat at a third of
  // their samples without anything going red. These name the SECTIONS the
  // samples print — a section that silently stops being assembled now fails.
  test("report 22 prints every section its sample prints", async ({ page }) => {
    test.setTimeout(90_000);
    await page.getByTestId("report-22").click();
    await page.getByLabel("Well", { exact: true }).selectOption({ label: DEMO_WELL });
    await expect(page.getByText("Report Printed:").first()).toBeVisible({ timeout: 30_000 });
    for (const section of [
      "Hole Sections", "Plug Back Total Depths", "Formations", "Deviation Surveys",
      "Reservoirs", "Casing Strings", "Cement", "Other In Hole", "Wellhead",
      "General Notes", "Logs", "Bottom Hole Cores",
      "Leak Off and Formation Integrity Tests", "Schematic Annotations",
      "Production Failures", "Tubing Strings", "Perforations",
    ]) {
      await expect(
        page.getByText(section, { exact: true }).first(),
        `report 22 is missing the "${section}" section`,
      ).toBeVisible();
    }
    // A job block and a BHA block, each with the sub-tables the sample prints.
    await expect(page.getByText("Phase Type 1", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("String Components:", { exact: false }).first()).toBeVisible();
    // The casing TALLY, not just the string header — the column that proves the
    // block is a block and not a one-line summary.
    await expect(page.getByText("Top Thread", { exact: true }).first()).toBeVisible();
    // And a value only the cement fluids table carries.
    await expect(page.getByText("Yield (L/sack)", { exact: true }).first()).toBeVisible();
  });

  test("report 30 prints every section its sample prints", async ({ page }) => {
    test.setTimeout(90_000);
    await page.getByTestId("report-30").click();
    await page.getByLabel("Well", { exact: true }).selectOption({ label: DEMO_WELL });
    await expect(page.getByText("Report Printed:").first()).toBeVisible({ timeout: 30_000 });
    for (const section of [
      "Wellheads", "Wellbores", "Casing Strings", "Cement", "Other In Hole",
      "Zones", "Perforations", "Logs", "Tubing Strings", "Rod Strings",
      "Rod Pumps", "Swabs", "Jobs", "Attachments",
    ]) {
      await expect(
        page.getByText(section, { exact: true }).first(),
        `report 30 is missing the "${section}" section`,
      ).toBeVisible();
    }
    // Columns that exist only in the sections added last, so a regression that
    // drops a table's body rather than its heading is still caught.
    await expect(page.getByText("Cur Stat Date", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Clean Volume Pumped (m³)", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Cased?", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Total BSW (bbl)", { exact: true }).first()).toBeVisible();
  });

  for (const type of ["22", "23", "24", "26", "28", "29"] as const) {
    test(`report ${type} draws the schematic with the completion string`, async ({ page }) => {
      test.setTimeout(60_000);
      await page.getByTestId(`report-${type}`).click();
      await page.getByLabel("Well", { exact: true }).selectOption({ label: DEMO_WELL });
      if (type === "23") await page.getByLabel("Date", { exact: true }).selectOption(DEMO_DAY);
      const svg = page.locator(`#wellview-schematic-${type} svg`).first();
      await expect(svg).toBeVisible({ timeout: 25_000 });
      expect(await svg.locator("rect").count()).toBeGreaterThan(4);
    });
  }

  test("report 26 reads a perforation's state off the END of its history", async ({ page }) => {
    test.setTimeout(60_000);
    await page.getByTestId("report-26").click();
    await page.getByLabel("Well", { exact: true }).selectOption({ label: DEMO_WELL });
    await expect(page.getByText("Perforation Statuses").first()).toBeVisible({ timeout: 25_000 });

    // Three perforations; the third was squeezed, so only two are open now —
    // and the squeeze is still printed, because it is why that zone is dead.
    await expect(page.getByText("Currently Open", { exact: true })).toBeVisible();
    await expect(page.getByText("Squeezed").first()).toBeVisible();
    await expect(page.getByText(/Water cut rose/)).toBeVisible();
  });

  test("report 27 prints the newest period first and plots the decline", async ({ page }) => {
    test.setTimeout(60_000);
    await page.getByTestId("report-27").click();
    await page.getByLabel("Well", { exact: true }).selectOption({ label: DEMO_WELL });
    await expect(page.getByText(/Most Recent at Top/)).toBeVisible({ timeout: 25_000 });
    await expect(page.locator("#wellview-production-curve svg").first()).toBeVisible();
    // 12 periods; the gas rate has its OWN axis because MCF/day is an order of
    // magnitude from the liquid rates.
    await expect(page.getByText("Rate reservoir gas").first()).toBeVisible();
    await expect(page.getByText("Cum Oil (bbl)", { exact: true })).toBeVisible();
  });

  test("report 25 stacks failure cost and keeps the unclassified separate", async ({ page }) => {
    test.setTimeout(60_000);
    await page.getByTestId("report-25").click();
    await expect(page.getByText("Cost of Failure by Type").first()).toBeVisible({ timeout: 25_000 });
    await expect(page.locator("#wellview-failure-cost svg").first()).toBeVisible();
    // 186,000 + 94,500 + 240,000 + 38,000 + 42,000.
    await expect(page.getByText("600,500.00", { exact: true }).first()).toBeVisible();
    // The unclassified failure is its own bar, not folded into "Other".
    await expect(page.getByText("(blank)").first()).toBeVisible();
    await expect(page.getByText("Unclassified", { exact: true })).toBeVisible();
  });

  test("report 29 draws the prognosis beside what was built", async ({ page }) => {
    test.setTimeout(60_000);
    await page.getByTestId("report-29").click();
    await page.getByLabel("Well", { exact: true }).selectOption({ label: DEMO_WELL });
    await expect(page.getByText("Proposed", { exact: true })).toBeVisible({ timeout: 25_000 });
    await expect(page.getByText("Actual", { exact: true })).toBeVisible();
    // TWO pictures, not one overlaid.
    await expect(page.locator("#wellview-schematic-29-proposed svg").first()).toBeVisible();
    await expect(page.locator("#wellview-schematic-29 svg").first()).toBeVisible();
    // Planned TD 2,760 against an actual 2,752 — a 8 m difference.
    await expect(page.getByText("2,760.00", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Difference (m)", { exact: true })).toBeVisible();
  });

  for (const [type, needsDay] of [
    ["22", false], ["23", true], ["24", false], ["25", false], ["26", false],
    ["27", false], ["28", false], ["29", false], ["30", false],
  ] as const) {
    test(`report ${type} exports a PDF`, async ({ page }, testInfo) => {
      test.setTimeout(120_000);
      await page.getByTestId(`report-${type}`).click();
      if (type !== "25") {
        await page.getByLabel("Well", { exact: true }).selectOption({ label: DEMO_WELL });
      }
      if (needsDay) await page.getByLabel("Date", { exact: true }).selectOption(DEMO_DAY);
      await expect(page.getByRole("button", { name: "PDF" })).toBeVisible({ timeout: 25_000 });
      // Let every SVG on the page finish drawing — the export captures them.
      await page.waitForTimeout(1_200);
      const dir = mkdtempSync(join(tmpdir(), "wellview-"));
      const [download] = await Promise.all([
        page.waitForEvent("download", { timeout: 90_000 }),
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

  // The shared wellbore schematic. It is ONE component over ONE server payload,
  // drawn by report 21 and by 02, 04 and 09 — which printed an apology in its
  // place until it existed. These specs check each of the four draws it, so a
  // change that breaks the picture cannot pass by breaking only three of them.
  for (const [type, setup] of [
    ["02", "bhaRun"], ["04", "casingString"], ["09", "job"], ["21", "well"],
  ] as const) {
    test(`report ${type} draws the shared wellbore schematic`, async ({ page }) => {
      test.setTimeout(60_000);
      await page.getByTestId(`report-${type}`).click();
      await page.getByLabel("Well", { exact: true }).selectOption({ label: DEMO_WELL });
      void setup;
      const svg = page.locator(`#wellview-schematic-${type} svg`).first();
      await expect(svg).toBeVisible({ timeout: 25_000 });
      // Not just present — DRAWN. The picture is a stack of <rect> bands, and an
      // empty frame is exactly what this component is written to never render.
      expect(await svg.locator("rect").count()).toBeGreaterThan(4);
      // The shoes are marks, not bands, and carry the string's size.
      await expect(page.getByText(/13 3\/8" shoe/).first()).toBeVisible();
    });
  }

  test("report 21 composites the schematic with its depth tracks", async ({ page }) => {
    test.setTimeout(60_000);
    await page.getByTestId("report-21").click();
    await page.getByLabel("Well", { exact: true }).selectOption({ label: DEMO_WELL });
    await expect(page.getByText("Vertical schematic (actual)").first())
      .toBeVisible({ timeout: 25_000 });

    // Every track reads down ONE depth scale — that is the only thing a
    // composite log is for.
    await expect(page.getByText("Eval — Litho")).toBeVisible();
    await expect(page.getByText("Mud", { exact: true })).toBeVisible();
    await expect(page.locator("#wellview-21-params svg").first()).toBeVisible();
    // The formation bands come from the register, the litho from the mud
    // logger's own log — different tables, same axis.
    await expect(page.getByText("Blue Heron Shale").first()).toBeVisible();
    await expect(page.getByText("KCl-Polymer").first()).toBeVisible();
    // 3 holes, 2 strings, 6 formations, deepest 2,752.
    await expect(page.getByText("2,752.00", { exact: true }).first()).toBeVisible();
  });

  test("report 21 exports a PDF with its composite", async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    await page.getByTestId("report-21").click();
    await page.getByLabel("Well", { exact: true }).selectOption({ label: DEMO_WELL });
    await expect(page.locator("#wellview-21-params svg").first()).toBeVisible({ timeout: 25_000 });
    await page.waitForTimeout(900);
    const dir = mkdtempSync(join(tmpdir(), "wellview-"));
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 90_000 }),
      page.getByRole("button", { name: "PDF" }).click(),
    ]);
    const path = join(dir, download.suggestedFilename());
    await download.saveAs(path);
    await testInfo.attach("report-21.pdf", { path, contentType: "application/pdf" });
    const { statSync, readFileSync } = await import("node:fs");
    // Two rasters make it substantially bigger than a table-only report.
    expect(statSync(path).size).toBeGreaterThan(20_000);
    expect(readFileSync(path).subarray(0, 5).toString()).toBe("%PDF-");
  });

  // Tier 4's geology reads one register — `WellFormation` — from three sides:
  // 20 prints what was PREDICTED, 18 the register as it stands on a day, and 19
  // predicted against DRILLED. That is why prognosis and actual are separate
  // columns, and these specs check each side sees its own.
  test("report 18 prints the geologist's day beside the driller's", async ({ page }) => {
    // Longer than the 30 s default: report 18 renders ten tables, and each
    // text assertion below rescans all of them. It is slow, not flaky — the
    // same run passes comfortably at 90 s.
    test.setTimeout(90_000);
    await page.getByTestId("report-18").click();
    await page.getByLabel("Well", { exact: true }).selectOption({ label: DEMO_WELL });
    await page.getByLabel("Date", { exact: true }).selectOption(DEMO_DAY);
    await expect(page.getByText("Daily Summary", { exact: true })).toBeVisible({ timeout: 20_000 });

    // Four kinds of gas, each with an average and a maximum.
    for (const label of ["Avg Background Gas (%)", "Max Connection Gas (%)", "Max Trip Gas (%)"]) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }
    await expect(page.getByText("31.50", { exact: true }).first()).toBeVisible();
    // The geologist's narrative, not the driller's.
    await expect(page.getByText(/Mishan limestone/)).toBeVisible();
    // Its cost band agrees with report 01's variance, reached a third way.
    await expect(page.getByText("215,708.53", { exact: true }).first()).toBeVisible();
    // Cuttings, lithology and both kinds of show.
    await expect(page.getByText(/sucrosic/)).toBeVisible();
    await expect(page.getByText("Fluorescence").first()).toBeVisible();
    await expect(page.getByText("Triple Combo").first()).toBeVisible();
    // A day holds one mud check; the page says so rather than implying one ran.
    await expect(page.getByText(/holds one mud check/)).toBeVisible();
  });

  test("report 19 prints predicted against drilled, and the ROP profile", async ({ page }) => {
    await page.getByTestId("report-19").click();
    await page.getByLabel("Well", { exact: true }).selectOption({ label: DEMO_WELL });
    await expect(page.getByText("Formations", { exact: true }).first()).toBeVisible({ timeout: 20_000 });

    // The register's as-drilled side: a top the driller called and the log-tied
    // one beside it, which is the comparison the report exists for.
    await expect(page.getByText("Drill Top MD (mKB)", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Final Top MD (mKB)", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Gachsaran").first()).toBeVisible();
    // 12 intervals, 2,557 m in 205 hr — the same figures report 13 computes.
    await expect(page.getByText("2,557.00", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("12.47", { exact: true }).first()).toBeVisible();
    await expect(page.locator("#wellview-formation-profile svg").first()).toBeVisible();
  });

  test("report 20 prints the programme, not the outturn", async ({ page }) => {
    await page.getByTestId("report-20").click();
    await page.getByLabel("Well", { exact: true }).selectOption({ label: DEMO_WELL });
    await expect(page.getByText("Geological Objective", { exact: true })).toBeVisible({ timeout: 20_000 });

    // The prognosis columns — and NOT the as-drilled ones, which are empty by
    // definition before spud and would read as lost data.
    await expect(page.getByText("Prog Depth Top SS (m)", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("H2S Conc (%)", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Final Top MD (mKB)", { exact: true })).toHaveCount(0);

    await expect(page.getByText(/Akuinu structure/)).toBeVisible();
    await expect(page.getByText("Open Hole Logs").first()).toBeVisible();
    await expect(page.getByText("Bill Frost").first()).toBeVisible();
  });

  for (const type of ["18", "19", "20"] as const) {
    test(`report ${type} exports a PDF`, async ({ page }, testInfo) => {
      test.setTimeout(90_000);
      await page.getByTestId(`report-${type}`).click();
      await page.getByLabel("Well", { exact: true }).selectOption({ label: DEMO_WELL });
      if (type === "18") await page.getByLabel("Date", { exact: true }).selectOption(DEMO_DAY);
      await expect(page.getByRole("button", { name: "PDF" })).toBeVisible({ timeout: 20_000 });
      if (type === "19") {
        await expect(page.locator("#wellview-formation-profile svg").first()).toBeVisible({ timeout: 20_000 });
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

  // Reports 12 and 14 close Tier 3. Both compare wells against each other, so
  // the seed carries a second, faster, shallower offset well — an offset curve
  // against nothing is not a comparison.

  test("report 12 gives every well its own block, on its own latest day", async ({ page }) => {
    await page.getByTestId("report-12").click();
    await expect(page.getByText("Daily Drilling Summary 2").first()).toBeVisible({ timeout: 20_000 });

    // Both drilled wells get a block, each showing ITS last day — the demo well
    // reached 2,752 mKB and the offset 2,112, on their own final reports.
    await expect(page.getByText(DEMO_WELL).first()).toBeVisible();
    await expect(page.getByText(OFFSET_WELL).first()).toBeVisible();
    await expect(page.getByText("2,752.00", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("2,112.00", { exact: true }).first()).toBeVisible();

    // The block carries the day's crew and narrative, not just its figures.
    await expect(page.getByText("Daily Contacts", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/Drilled ahead to/).first()).toBeVisible();
  });

  test("report 12's As-of cap re-reads an older meeting", async ({ page }) => {
    await page.getByTestId("report-12").click();
    await expect(page.getByText("2,752.00", { exact: true }).first()).toBeVisible({ timeout: 20_000 });

    // Cap at 1405/02/13. The demo well's block must fall back to that day's
    // depth (748, not its final 2,752), and the offset well — which had not
    // spudded — must SAY so rather than vanishing: an absent well reads as
    // nothing, a present one as "not drilling yet".
    await page.getByLabel("As of", { exact: true }).fill("1405/02/13");
    await expect(page.getByText("748.00", { exact: true }).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("2,752.00", { exact: true })).toHaveCount(0);
    await expect(page.getByText(/No daily report filed on or before 1405\/02\/13/).first()).toBeVisible();
  });

  test("report 14 draws five offset plots, one series per well", async ({ page }) => {
    await page.getByTestId("report-14").click();
    await expect(page.getByText("Actual Days Vs Depth").first()).toBeVisible({ timeout: 20_000 });

    for (const key of ["daysDepth", "spudDepth", "daysCost", "depthCost", "mudDepth"]) {
      await expect(page.locator(`#wellview-offset-${key} svg`).first()).toBeVisible();
    }
    // The two day axes are DIFFERENT measurements — the second exists because
    // the first flatters a well that was late to spud.
    await expect(page.getByText("Days from Spud Vs Depth").first()).toBeVisible();
    await expect(page.getByText("Mud WT. Vs Check Depth").first()).toBeVisible();
    // Two wells have days; 24 day-points and 13 mud checks between them.
    await expect(page.getByText("Wells With Days", { exact: true })).toBeVisible();
    await expect(page.getByText("24", { exact: true }).first()).toBeVisible();
  });

  for (const type of ["12", "14"] as const) {
    test(`report ${type} exports a PDF`, async ({ page }, testInfo) => {
      test.setTimeout(120_000);
      await page.getByTestId(`report-${type}`).click();
      await expect(page.getByRole("button", { name: "PDF" })).toBeVisible({ timeout: 20_000 });
      if (type === "14") {
        // Five rasters: let every plot finish drawing before the capture.
        await expect(page.locator("#wellview-offset-mudDepth svg").first()).toBeVisible({ timeout: 20_000 });
        await page.waitForTimeout(900);
      }
      const dir = mkdtempSync(join(tmpdir(), "wellview-"));
      const [download] = await Promise.all([
        page.waitForEvent("download", { timeout: 90_000 }),
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
    // 14 days × 24 hr — 12 drilling, 2 completion — of which 8 were trouble.
    await expect(page.getByText("336.00", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("2.38", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Grand Total", { exact: true })).toBeVisible();
  });

  test("report 16 pivots the phase spine across the set", async ({ page }) => {
    await page.getByTestId("report-16").click();
    await expect(page.getByText("Phase Summary Pivot").first()).toBeVisible({ timeout: 20_000 });

    // Narrowed to the two SEEDED wells before the exact total is asserted. The
    // pivot counts every phase of every job on every well in the set, so any
    // other job on the account — a half-finished one, another test's leftover —
    // moves the figure, and the spec would be testing the database rather than
    // the report.
    await page.getByTestId("well-set-picker").click();
    await page.locator("label", { hasText: "Dehloran-099" }).locator("input[type=checkbox]").click();
    await page.getByTestId("well-set-picker").click();

    // Two wells drilled the same phase kinds, so those groups have a spread —
    // which is the whole point of a pivot with Min, Max and StdDev in it.
    await expect(page.getByText("Drill-Deviation Control").first()).toBeVisible();
    await expect(page.getByText("Run and Cement Casing").first()).toBeVisible();
    await expect(page.getByText("Grand Total", { exact: true })).toBeVisible();
    // 13 measured phases across the two wells, 39.58 days between them.
    await expect(page.getByText("39.58", { exact: true }).first()).toBeVisible({ timeout: 20_000 });
  });

  test("report 16 narrowed to one well matches report 10's cumulative", async ({ page }) => {
    await page.getByTestId("report-16").click();
    await expect(page.getByText("Grand Total", { exact: true })).toBeVisible({ timeout: 20_000 });

    // Narrow to the demo well alone. Its eight phases sum to 25.46 days — the
    // very figure report 10's last cumulative cell prints, reached by a wholly
    // different route. Cross-checking the two is why this test exists.
    await page.getByTestId("well-set-picker").click();
    for (const other of ["Dehloran-099", OFFSET_WELL]) {
      await page.locator("label", { hasText: other }).locator("input[type=checkbox]").click();
    }
    await page.getByTestId("well-set-picker").click();

    await expect(page.getByText("25.46", { exact: true }).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("39.58", { exact: true })).toHaveCount(0);
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
    // 14 days × 24 h — the 12 drilling days plus the two completion days the
    // fixture carries for report 23. Both percentage panels are shares of THIS
    // number, which is what stops NPT reading as a share of itself.
    await expect(page.getByText("336.00", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("14", { exact: true }).first()).toBeVisible();
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
