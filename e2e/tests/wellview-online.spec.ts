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
import { test, expect, type Page, type Locator } from "@playwright/test";

const USER = process.env.ENTRY_USER ?? "admin";
const PASSWORD = process.env.ENTRY_PASSWORD ?? "";

/**
 * Open a folder in the Edit Data tree.
 *
 * The tree groups folders into the guide's subject areas and opens closed
 * (§3.9: "Click to expand a subject area or folder to see its subfolders"), so
 * a folder several levels down is not on screen until its ancestors are. This
 * expands whatever is still shut and then clicks — which is what a person does,
 * and keeps these specs about the folder rather than about the tree.
 */
async function openFolder(page: Page, target: Locator): Promise<void> {
  /*
   * One shut node per round, re-resolved each time. Opening a node flips its
   * own glyph and adds rows, so a list captured up front goes stale after the
   * first click and every remaining click waits out its own timeout instead.
   */
  for (let round = 0; round < 60; round++) {
    if (await target.first().isVisible().catch(() => false)) {
      await target.first().click();
      return;
    }
    /*
     * Subject areas before folders. There are eleven areas and hundreds of
     * folders, and always taking the topmost shut node means expanding the
     * whole of Operations before ever reaching Other — where wvNote lives.
     */
    const area = page.locator('aside [data-testid="wv-subject"]')
      .filter({ hasText: "▸" }).first();
    const shut = (await area.count())
      ? area
      : page.locator('aside [data-testid="wv-folder-toggle"]').filter({ hasText: "▸" }).first();
    // Nothing shut can also mean nothing drawn yet: "Show System Fields" is in
    // the title bar and appears before the tree query returns. Waiting rather
    // than giving up is the difference between a race and a failure.
    if (await shut.count()) await shut.click({ timeout: 2000 }).catch(() => {});
    else await page.waitForTimeout(200);
  }
  // Let the click fail with Playwright's own message if it is still not there.
  await target.first().click();
}

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

    await openFolder(page, page.locator('button[title="wvJob"]'));
    await openFolder(page, page.locator('button[title="wvJobReport"]'));
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

/**
 * The Wellhead tab (§3.8 subject area "Wellhead"), which the desktop app draws
 * with Peloton.Visualizer.WellView.Wellhead.dll.
 *
 * "Sample 40 - Complex Gravel Pack Assembly" is the sample's richest wellhead:
 * one assembly, four components, thirteen outlets. The assertions check the
 * things a user would notice were wrong — that the recorded assembly picture
 * actually loads rather than showing a broken image, that pressures arrive in
 * the unit set's own unit, and that the components and their outlets are there
 * once expanded.
 */
test.describe("WellView Online — wellhead", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/wellview");
    await page.getByRole("heading", { name: "WellView" }).waitFor();
    const signIn = page.getByRole("button", { name: "Sign in" });
    if (await signIn.isVisible().catch(() => false)) {
      await page.getByLabel("User name").fill(USER);
      await page.getByLabel("Password").fill(PASSWORD);
      await signIn.click();
    }
    await page.getByTestId("wv-db-wv9.0_Sample").click();
    await expect(page.getByTestId("wv-well-row").first()).toBeVisible({ timeout: 15_000 });
  });

  test("shows the assembly picture, its rating, and its components", async ({ page }) => {
    await page.getByTestId("wv-well-row")
      .filter({ hasText: "Complex Gravel Pack Assembly" }).first().dblclick();
    await expect(page.getByText("Select a report")).toBeVisible({ timeout: 15_000 });

    await page.getByTestId("wv-tab-wellhead").click();
    await expect(page.getByTestId("wv-wh-head")).toHaveCount(1, { timeout: 15_000 });
    await expect(page.getByTestId("wv-wh-count")).toContainText("1 assembly");

    // The picture WellView recorded must actually render — a broken image on a
    // wellhead reads to the user as "there is no data here".
    const icon = page.getByTestId("wv-wh-icon").first();
    await expect(icon).toBeVisible();
    // POLLED, not read once: toBeVisible passes as soon as the <img> has layout,
    // which is before the browser has decoded it, so a single read of
    // naturalWidth races the decode and reports 0 on a perfectly good image.
    // That raced twice in full-suite runs while passing in isolation.
    await expect.poll(async () => icon.evaluate((el) => (el as HTMLImageElement).naturalWidth),
      { timeout: 10_000 }).toBeGreaterThan(0);

    // The rating, in the unit set's own unit rather than the stored kPa.
    await expect(page.getByTestId("wv-wh-head")).toContainText("Working Pressure");
    await expect(page.getByTestId("wv-wh-head")).toContainText(/psi|bars|kPa/);

    // The components and their outlets, once expanded.
    await page.getByTestId("wv-wh-toggle").first().click();
    await expect(page.getByTestId("wv-wh-comp")).toHaveCount(4);
    expect(await page.getByTestId("wv-wh-outlet").count()).toBe(13);
    await expect(page.getByTestId("wv-wh-comp").first()).toContainText("Xmas Tree");
  });

  test("shows the diagrams attached to the assembly, and opens one full size", async ({ page }) => {
    // "Sample 16" carries three ABB wellhead drawings in wvAttachment. They were
    // always reachable through Edit Data > Attachments and never appeared here,
    // which is the screen you are on when you want to look at one.
    await page.getByTestId("wv-well-row")
      .filter({ hasText: "Sample 16 - Phase and Prod" }).first().dblclick();
    await expect(page.getByText("Select a report")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("wv-tab-wellhead").click();
    await expect(page.getByTestId("wv-wh-head")).toHaveCount(1, { timeout: 15_000 });

    const shots = page.getByTestId("wv-wh-image");
    await expect(shots).toHaveCount(3, { timeout: 15_000 });
    await expect(page.getByTestId("wv-wh-images")).toContainText("Attached images");

    // Each must DECODE. A listed-but-broken image is worse than not listing it:
    // it claims a picture exists and then fails to show it. Polled for the same
    // reason as the clip-art above — visibility precedes decode.
    for (let i = 0; i < 3; i++) {
      const img = shots.nth(i).locator("img");
      await expect(img).toBeVisible({ timeout: 15_000 });
      await expect.poll(async () => img.evaluate((el) => (el as HTMLImageElement).naturalWidth),
        { timeout: 15_000 }).toBeGreaterThan(0);
    }
    await expect(shots.first()).toContainText("wh3");

    // Clicking one opens it full size, and clicking away closes it.
    await shots.first().locator("img").click();
    const zoom = page.getByTestId("wv-wh-zoom");
    await expect(zoom).toBeVisible({ timeout: 10_000 });
    await expect.poll(async () => zoom.locator("img").evaluate((el) => (el as HTMLImageElement).naturalWidth),
      { timeout: 10_000 }).toBeGreaterThan(0);
    await zoom.click({ position: { x: 5, y: 5 } });
    await expect(zoom).toBeHidden({ timeout: 10_000 });
  });

  test("shows no image strip on a wellhead that has none", async ({ page }) => {
    // The clip-art stays — that is recorded on the head itself, not attached.
    await page.getByTestId("wv-well-row")
      .filter({ hasText: "Complex Gravel Pack Assembly" }).first().dblclick();
    await expect(page.getByText("Select a report")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("wv-tab-wellhead").click();
    await expect(page.getByTestId("wv-wh-head")).toHaveCount(1, { timeout: 15_000 });
    await expect(page.getByTestId("wv-wh-icon").first()).toBeVisible();
    await expect(page.getByTestId("wv-wh-images")).toHaveCount(0);
  });

  test("says so plainly when a well has no wellhead", async ({ page }) => {
    // "Sample 04 - Offshore" has no wvWellhead row at all.
    await page.getByTestId("wv-well-row").filter({ hasText: "Sample 04 - Offshore" }).first().dblclick();
    await expect(page.getByText("Select a report")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("wv-tab-wellhead").click();
    await expect(page.getByTestId("wv-wh-empty")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("wv-wh-head")).toHaveCount(0);
  });
});

/**
 * The Days vs Depth tab (Peloton.DaysVsDepth.dll, and the .dvdc templates).
 *
 * "Sample 11 - Full Data" has two jobs; only the drilling one carries a curve,
 * so the tab opening on a plotted chart rather than an empty axis is itself one
 * of the assertions. The rest are what a driller would check: that the depth
 * axis runs downward, that plan and actual are told apart, and that the
 * template picker actually changes the plot.
 */
/**
 * A column a report drops says so.
 *
 * The API always knew which columns it could not fill and always returned the
 * list; no report screen ever printed it, so a sheet came out one column
 * narrower than the desktop's with nothing to say a column had been there. 116
 * of the 182 shipped templates print at least one; "Daily Drilling" drops 29.
 */
test.describe("WellView Online — a dropped column is visible", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/wellview");
    await page.getByRole("heading", { name: "WellView" }).waitFor();
    const signIn = page.getByRole("button", { name: "Sign in" });
    if (await signIn.isVisible().catch(() => false)) {
      await page.getByLabel("User name").fill(USER);
      await page.getByLabel("Password").fill(PASSWORD);
      await signIn.click();
    }
    await page.getByTestId("wv-db-wv9.0_Sample").click();
    await expect(page.getByTestId("wv-well-row").first()).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("wv-well-row").filter({ hasText: "Sample 12" }).first().dblclick();
    await expect(page.getByText("Select a report")).toBeVisible({ timeout: 15_000 });
    const search = page.getByPlaceholder(/search|filter/i).first();
    if (await search.isVisible().catch(() => false)) await search.fill("Daily Drilling");
    await page.getByText("Daily Drilling", { exact: true }).first().click();
  });

  test("names the columns WellView calculates at print time", async ({ page }) => {
    const notes = page.getByTestId("wv-report-omitted");
    await expect(notes.first()).toBeVisible({ timeout: 20_000 });
    expect(await notes.count()).toBeGreaterThan(1);

    // Named by their CAPTION — "AFE Number" is the heading a reader recognises,
    // "afenumbercalc" tells them nothing about which column went blank.
    const first = notes.first();
    await expect(first).toContainText("WellView calculates when the report prints");
    await expect(first).toContainText("AFE Number");

    // The old label claimed the opposite of the truth and must not come back:
    // not one dropped column is a stored column this database lacks.
    for (const t of await notes.allTextContents()) {
      expect(t.toLowerCase()).not.toContain("not in this database");
    }
  });

  test('only says "blank below" where a table is actually drawn', async ({ page }) => {
    await expect(page.getByTestId("wv-report-omitted").first()).toBeVisible({ timeout: 20_000 });
    const notes = page.getByTestId("wv-report-omitted");
    for (let i = 0; i < await notes.count(); i++) {
      const n = notes.nth(i);
      const saysBelow = (await n.textContent())!.includes("blank below");
      // The note sits inside the block; the block draws a table or it does not.
      const hasTable = await n.locator("xpath=..").locator("table").count() > 0;
      expect(saysBelow, `note ${i}: points below ${hasTable ? "a table" : "nothing"}`).toBe(hasTable);
    }
  });

  test("the printed sheet carries the note too", async ({ page }) => {
    // The printed page is the copy that gets handed to someone, so it is the
    // one that must not overstate what the app filled in.
    await page.getByRole("button", { name: "Print" }).first().click();
    await expect(page.getByTestId("wv-print-build")).toBeVisible({ timeout: 20_000 });
    const picks = page.getByTestId("wv-print-pick");
    if (await picks.count()) await picks.first().check();
    await page.getByTestId("wv-print-build").click();
    await expect(page.getByTestId("wv-print-sheet").first()).toBeVisible({ timeout: 25_000 });

    const printed = page.getByTestId("wv-print-omitted");
    await expect(printed.first()).toBeVisible({ timeout: 20_000 });
    await expect(printed.first()).toContainText(/WellView calculates|not a field of this table/);
  });
});

/**
 * A zone's Current Status, which WellView works out from its status history.
 *
 * "Most recent status by date. EQN: <wvzonestatus.status>." — a pick, not a
 * total and not arithmetic, so neither of the two calculated shapes this app
 * had could produce it and the column printed blank on every row.
 *
 * "Zone History" is the ideal check because it prints the ANSWER and the
 * EVIDENCE on one page: the Zone block's computed columns above, the whole
 * wvZoneStatus history below. The two have to agree by eye.
 */
test.describe("WellView Online — a zone's current status", () => {
  test("computes it from the history printed underneath it", async ({ page }) => {
    await page.goto("/wellview");
    await page.getByRole("heading", { name: "WellView" }).waitFor();
    const signIn = page.getByRole("button", { name: "Sign in" });
    if (await signIn.isVisible().catch(() => false)) {
      await page.getByLabel("User name").fill(USER);
      await page.getByLabel("Password").fill(PASSWORD);
      await signIn.click();
    }
    await page.getByTestId("wv-db-wv9.0_Sample").click();
    await expect(page.getByTestId("wv-well-row").first()).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("wv-well-row")
      .filter({ hasText: "Sample 18 - Phase and Prod" }).first().dblclick();
    await expect(page.getByText("Select a report")).toBeVisible({ timeout: 15_000 });

    const search = page.getByPlaceholder(/search|filter/i).first();
    if (await search.isVisible().catch(() => false)) await search.fill("Zone History");
    await page.getByText("Zone History", { exact: true }).first().click();

    // Both columns arrive, and are marked as computed — green is WellView's own
    // convention for a value it worked out rather than one somebody entered.
    const derived = page.getByTestId("wv-derived-col");
    await expect(derived.filter({ hasText: "Current Status" }).first())
      .toBeVisible({ timeout: 20_000 });
    const labels = await derived.allTextContents();
    expect(labels).toContain("Current Status");
    expect(labels).toContain("Current Status Date");

    // The four zones on this well, each against the LAST status in its history.
    const zoneBlock = page.locator("table").first();
    const row = (name: string) => zoneBlock.locator("tbody tr").filter({ hasText: name });
    await expect(row("Lower Mannville")).toContainText("Abandoned");
    await expect(row("Lower Mannville")).toContainText("1993-11-15");
    await expect(row("Livingstone A")).toContainText("Pumping - Rod");
    await expect(row("Livingstone A")).toContainText("2003-11-01");

    // Lower Mannville's history also holds a 1993-09-01 "Flowing". Picking that
    // would mean the ordering is wrong, so the older one must NOT be the answer.
    await expect(row("Lower Mannville")).not.toContainText("Flowing");

    // …and the evidence is on the page: the status history block below.
    const statusBlock = page.locator("table").nth(1);
    await expect(statusBlock).toContainText("1993-09-01");
    await expect(statusBlock).toContainText("1993-11-15");
    await expect(statusBlock).toContainText("2003-11-01");
  });
});

/**
 * The calculated fields a folder carries, in Edit Data.
 *
 * The server had always sent them — `computedColumns`, the model-calculated
 * fields whose values it works out because WellView computes them at print time
 * and stores them nowhere. Nothing on this side ever read that list, so a
 * folder's green cells were invisible however many of them the app learned to
 * compute.
 *
 * A service contract is the clearest case: 29 of them in the sample, every one
 * with evaluation children carrying real Score and ScoreMax, and three blank
 * columns where WellView shows a rating.
 */
test.describe("WellView Online — a folder's calculated fields", () => {
  test("shows a contractor's score, its maximum, and the percentage", async ({ page }) => {
    await page.goto("/wellview");
    await page.getByRole("heading", { name: "WellView" }).waitFor();
    const signIn = page.getByRole("button", { name: "Sign in" });
    if (await signIn.isVisible().catch(() => false)) {
      await page.getByLabel("User name").fill(USER);
      await page.getByLabel("Password").fill(PASSWORD);
      await signIn.click();
    }
    await page.getByTestId("wv-db-wv9.0_Sample").click();
    await expect(page.getByTestId("wv-well-row").first()).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("wv-well-row")
      .filter({ hasText: "Sample 18 - Phase and Prod" }).first().dblclick();
    await expect(page.getByText("Select a report")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Edit Data" }).first().click();
    await openFolder(page, page.getByText(/Service Contractors/i));

    const head = page.locator("thead").last();
    await expect(head).toContainText("Total Score", { timeout: 20_000 });
    await expect(head).toContainText("Max Possible Score");

    // The ratio is stored as a PROPORTION and its unit is Proportion → %, so
    // the heading carries the per-cent sign and the value must be converted to
    // match it. Printing the raw 0.7 under a "(%)" heading says the contractor
    // scored seven tenths of one per cent.
    await expect(head).toContainText("%");

    const row = page.locator("tbody tr").first();
    await expect(row).toContainText("21");
    await expect(row).toContainText("30");
    await expect(row).toContainText("70");
    // 0.7 under a per-cent heading is the failure this is here to catch.
    await expect(row).not.toContainText("0.7");
  });
});

/**
 * The daily Time Log's clock.
 *
 * The entries carry a duration and nothing else. WellView derives the start and
 * end when a report prints — the report's own start, plus the durations before
 * each entry — and eight shipped daily templates printed a duration column with
 * no clock beside it.
 *
 * Every entry must start exactly where the one before it ended. That is the
 * whole claim, and it is visible on the page.
 */
test.describe("WellView Online — the time log's clock", () => {
  test("starts each entry where the previous one ended", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/wellview");
    await page.getByRole("heading", { name: "WellView" }).waitFor();
    const signIn = page.getByRole("button", { name: "Sign in" });
    if (await signIn.isVisible().catch(() => false)) {
      await page.getByLabel("User name").fill(USER);
      await page.getByLabel("Password").fill(PASSWORD);
      await signIn.click();
    }
    await page.getByTestId("wv-db-wv9.0_Sample").click();
    await expect(page.getByTestId("wv-well-row").first()).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("wv-well-row")
      .filter({ hasText: "Sample 16 - Phase and Prod" }).first().dblclick();
    await expect(page.getByText("Select a report")).toBeVisible({ timeout: 15_000 });

    const search = page.getByPlaceholder(/search|filter/i).first();
    if (await search.isVisible().catch(() => false)) await search.fill("Daily Drilling");
    await page.getByText("Daily Drilling", { exact: true }).first().click();

    /*
     * The clock is anchored on a DAY, so a job and then a day have to be
     * chosen — in that order, because the day selector does not exist until a
     * job is picked. With no day the three columns stay honestly blank, which
     * is the feature working and not something to navigate around.
     */
    const selectWith = async (marker: RegExp) => {
      const all = page.locator("select");
      for (let i = 0; i < await all.count(); i++) {
        const opts = await all.nth(i).locator("option").allTextContents();
        if (opts.some((o) => marker.test(o))) return all.nth(i);
      }
      return null;
    };

    // The toolbar arrives with the report, not with the page.
    await expect(page.getByText(/blocks have rows|Select a report/).first())
      .toBeVisible({ timeout: 30_000 });
    await expect.poll(async () => (await selectWith(/all jobs/i)) !== null,
      { timeout: 30_000 }).toBe(true);
    const job = await selectWith(/all jobs/i);
    expect(job, "the job selector").toBeTruthy();
    await job!.selectOption({ index: 1 });
    await page.waitForTimeout(2000);

    // Wait for the report to finish assembling before scanning it: this well's
    // Daily Drilling has sixteen blocks and the anchor change re-fetches them.
    await expect(page.locator("table").first()).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(1500);

    /*
     * Find a DAY whose log actually carries a clock.
     *
     * Not every day has one, and that is the feature working: a report whose
     * entries have no unique sequence, or that hits a blank duration, is
     * refused rather than clocked. Which day the selector lands on first is not
     * something this test should depend on, so it steps through them until it
     * finds one — and fails if none of them has a clock, which would mean the
     * feature is not working at all.
     */
    const dayFor = async () => selectWith(/all days/i);
    const timeLog = async () => {
      const tables = page.locator("table");
      for (let t = 0; t < await tables.count(); t++) {
        const th = (await tables.nth(t).locator("thead th").allTextContents()).filter(Boolean);
        const si = th.findIndex((h) => /^Start Date/.test(h));
        const ei = th.findIndex((h) => /^End Date/.test(h));
        const ci = th.findIndex((h) => /^Cum Duration/.test(h));
        if (si >= 0 && ei >= 0 && ci >= 0) return { table: tables.nth(t), si, ei, ci };
      }
      return null;
    };

    const day = await dayFor();
    let block = await timeLog();
    let clocked = false;
    const tries = day ? Math.min(8, await day.locator("option").count()) : 1;
    for (let attempt = 0; attempt < tries; attempt++) {
      block = await timeLog();
      if (block) {
        const first = (await block.table.locator("tbody tr").first().locator("td")
          .allTextContents()).map((x) => x.trim());
        const start = first[block.si];
        if (start && start !== "—" && await block.table.locator("tbody tr").count() > 3) {
          clocked = true;
          break;
        }
      }
      if (!day || attempt + 1 >= tries) break;
      // Index 0 is "All days"; the real days start at 1.
      await day.selectOption({ index: attempt + 1 }).catch(() => {});
      await page.waitForTimeout(2000);
    }
    expect(clocked, "a day whose time log carries a clock").toBe(true);

    // Find the time-log table by its own columns.
    const tables = page.locator("table");
    let found = false;
    for (let t = 0; t < await tables.count(); t++) {
      const th = (await tables.nth(t).locator("thead th").allTextContents()).filter(Boolean);
      const si = th.findIndex((h) => /^Start Date/.test(h));
      const ei = th.findIndex((h) => /^End Date/.test(h));
      const ci = th.findIndex((h) => /^Cum Duration/.test(h));
      if (si < 0 || ei < 0 || ci < 0) continue;
      found = true;

      const rows = tables.nth(t).locator("tbody tr");
      const rc = await rows.count();
      expect(rc).toBeGreaterThan(3);

      const cells = async (r: number) =>
        (await rows.nth(r).locator("td").allTextContents()).map((x) => x.trim());

      // Every entry begins where the previous ended. A date printed at midnight
      // shows as the date alone, so compare on the leading date-and-time.
      let prevEnd: string | null = null;
      let chained = 0;
      for (let r = 0; r < Math.min(rc, 8); r++) {
        const c = await cells(r);
        const start = c[si], end = c[ei];
        if (!start || start === "—") break;
        if (prevEnd) { expect(start, `row ${r} continues the log`).toBe(prevEnd); chained++; }
        prevEnd = end;
      }
      expect(chained, "entries chained end-to-start").toBeGreaterThan(2);

      // …and the cumulative column really is cumulative.
      const first = await cells(0);
      const second = await cells(1);
      expect(Number(first[ci])).toBeGreaterThan(0);
      expect(Number(second[ci])).toBeGreaterThan(Number(first[ci]));
      break;
    }
    expect(found, "the time-log block prints its clock columns").toBe(true);
  });
});

/**
 * A tab keeps what you chose on it.
 *
 * The five tabs are a conditional render, so leaving one unmounts it and every
 * selection in it resets. The schematic's date is the one the audit singles
 * out — a well can carry fourteen of them and the only way back is stepping the
 * player through the others, on every edit cycle — but the wellbore filter, the
 * layers, the zoom, the survey being viewed, the days-vs-depth job and the
 * SELECTED REPORT all went the same way.
 */
test.describe("WellView Online — a tab keeps its selections", () => {
  test("the schematic is still on the date you left it on", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/wellview");
    await page.getByRole("heading", { name: "WellView" }).waitFor();
    const signIn = page.getByRole("button", { name: "Sign in" });
    if (await signIn.isVisible().catch(() => false)) {
      await page.getByLabel("User name").fill(USER);
      await page.getByLabel("Password").fill(PASSWORD);
      await signIn.click();
    }
    await page.getByTestId("wv-db-wv9.0_Sample").click();
    await expect(page.getByTestId("wv-well-row").first()).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("wv-well-row")
      .filter({ hasText: "Sample 02 - Drilling operations" }).first().dblclick();
    await expect(page.getByText("Select a report")).toBeVisible({ timeout: 15_000 });

    await page.getByTestId("wv-tab-schematic").click();
    await expect(page.locator("svg").first()).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(1500);

    const dateOnPage = async () => {
      const t = (await page.locator("body").textContent()) ?? "";
      return (t.match(/\d{4}-\d{2}-\d{2}/) ?? ["(none)"])[0];
    };
    const arrival = await dateOnPage();

    // Step the date player back until the date changes — otherwise "kept" would
    // be trivially true, because the tab reopens on the latest date anyway.
    const back = page.locator("button").filter({ hasText: /^‹$|^◀$|^<$/ }).first();
    await expect(back).toBeVisible({ timeout: 10_000 });
    let chosen = arrival;
    for (let i = 0; i < 4 && chosen === arrival; i++) {
      await back.click();
      await page.waitForTimeout(700);
      chosen = await dateOnPage();
    }
    expect(chosen, "the player moved off the latest date").not.toBe(arrival);

    // Leave and come back.
    await page.getByTestId("wv-tab-wellhead").click();
    await expect(page.getByTestId("wv-tab-schematic")).toBeVisible();
    await page.waitForTimeout(1000);
    await page.getByTestId("wv-tab-schematic").click();
    await expect(page.locator("svg").first()).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(1500);

    expect(await dateOnPage(), "the date survived the round trip").toBe(chosen);
  });
});

/**
 * §8.3's five numeric tracks, and the scale that has to be right.
 *
 * "Scales: The scales provide the MD, Incl, Azmth, VS, and DLS numeric tracks."
 * Two of the five were offered. The other three came free from a route that had
 * always returned them per station — but adding them exposed a scaling bug that
 * had been harmless while only TVD and inclination existed.
 *
 * The track's ceiling was Math.max(1, …values), a floor of 1 in BASE units. TVD
 * and inclination run to hundreds, so it never bound. Dogleg severity is stored
 * in degrees per METRE and runs about 0.26, so the floor dominated it entirely:
 * the track drew against a scale four times too large and labelled itself
 * "0–30 °/30m" while the Survey tab, computing the same numbers, showed 7.76.
 *
 * The two screens must agree, which is what this checks.
 */
test.describe("WellView Online — schematic numeric tracks", () => {
  test("draws all five scales, and DLS agrees with the Survey tab", async ({ page }) => {
    await page.goto("/wellview");
    await page.getByRole("heading", { name: "WellView" }).waitFor();
    const signIn = page.getByRole("button", { name: "Sign in" });
    if (await signIn.isVisible().catch(() => false)) {
      await page.getByLabel("User name").fill(USER);
      await page.getByLabel("Password").fill(PASSWORD);
      await signIn.click();
    }
    await page.getByTestId("wv-db-wv9.0_Sample").click();
    await expect(page.getByTestId("wv-well-row").first()).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("wv-well-row")
      .filter({ hasText: "Sample 02 - Drilling operations" }).first().dblclick();
    await expect(page.getByText("Select a report")).toBeVisible({ timeout: 15_000 });

    // What the Survey tab makes of the same survey.
    await page.getByTestId("wv-tab-survey").click();
    await expect(page.locator("thead th").first()).toBeVisible({ timeout: 20_000 });
    const heads = (await page.locator("thead th").allTextContents()).map((t) => t.trim());
    const dlsIx = heads.findIndex((h) => /^DLS/.test(h));
    expect(dlsIx, "the survey tab prints a DLS column").toBeGreaterThanOrEqual(0);
    // The heading carries the unit set's own per-length unit, not the base.
    expect(heads[dlsIx]).toContain("/30m");
    const surveyMax = Math.max(...(await page.locator("tbody tr").evaluateAll(
      (rows, ix) => rows.map((r) => Number((r.children[ix]?.textContent ?? "")
        .replace(/[^\d.-]/g, ""))).filter((n) => Number.isFinite(n)), dlsIx)));
    expect(surveyMax).toBeGreaterThan(0);

    // …and what the schematic's track makes of it.
    await page.getByTestId("wv-tab-schematic").click();
    for (const k of ["tvd", "incl", "azimuth", "vs", "dls"]) {
      const cb = page.getByTestId(`wv-sch-track-${k}`);
      await expect(cb).toBeVisible({ timeout: 20_000 });
      await cb.check();
    }
    const svg = page.locator("svg").filter({ has: page.locator("text", { hasText: "DLS" }) }).first();
    for (const label of ["TVD", "Incl°", "Azmth°", "VS", "DLS"]) {
      await expect(svg.locator("text", { hasText: new RegExp(`^${label.replace("°", "°")}$`) }).first())
        .toBeVisible({ timeout: 15_000 });
    }

    // The DLS track's own range footer, read back and compared.
    const footers = await svg.locator("text").allTextContents();
    const ranges = footers.map((t) => t.trim()).filter((t) => /^-?[\d,]+–-?[\d,]+$/.test(t));
    expect(ranges.length, "one range footer per track").toBe(5);
    const dlsHi = Number(ranges[4].split("–")[1].replace(/,/g, ""));
    // Same quantity, same unit, so the ceiling must sit just above the survey's
    // maximum — not four times above it, which is what the base-unit floor did.
    expect(dlsHi).toBeGreaterThanOrEqual(Math.floor(surveyMax));
    expect(dlsHi).toBeLessThan(surveyMax * 2);

    // Nothing may be drawn outside the track: VS goes negative on other wells,
    // and the old zero-based scale put those points over the diagram.
    const outside = await svg.evaluate((el) => {
      const w = (el as SVGSVGElement).viewBox.baseVal.width;
      let bad = 0;
      for (const pl of el.querySelectorAll("polyline")) {
        for (const pt of (pl.getAttribute("points") ?? "").trim().split(/\s+/)) {
          const x = Number(pt.split(",")[0]);
          if (Number.isFinite(x) && (x < 0 || x > w)) bad++;
        }
      }
      return bad;
    });
    expect(outside, "points drawn outside the diagram").toBe(0);
  });
});

test.describe("WellView Online — days vs depth", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/wellview");
    await page.getByRole("heading", { name: "WellView" }).waitFor();
    const signIn = page.getByRole("button", { name: "Sign in" });
    if (await signIn.isVisible().catch(() => false)) {
      await page.getByLabel("User name").fill(USER);
      await page.getByLabel("Password").fill(PASSWORD);
      await signIn.click();
    }
    await page.getByTestId("wv-db-wv9.0_Sample").click();
    await page.getByTestId("wv-well-row").filter({ hasText: "Sample 11 - Full Data" })
      .first().dblclick();
    await expect(page.getByText("Select a report")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("wv-tab-dvd").click();
  });

  test("draws the drilling curve with depth running downward", async ({ page }) => {
    await expect(page.getByTestId("wv-dvd-chart").first()).toBeVisible({ timeout: 15_000 });
    // Depth and cost get their own plot: they must not share a scale.
    expect(await page.getByTestId("wv-dvd-chart").count()).toBe(2);

    const depth = page.getByTestId("wv-dvd-chart").first();
    await expect(depth).toContainText("End Depth (m)");
    await expect(depth).toContainText("Days");

    // Both a dashed plan line and a solid actual line, and at least four series.
    const lines = depth.locator("polyline");
    expect(await lines.count()).toBeGreaterThanOrEqual(4);
    const dashes = await lines.evaluateAll((els) =>
      els.map((e) => e.getAttribute("stroke-dasharray")));
    expect(dashes.some((d) => d)).toBe(true);       // a plan
    expect(dashes.some((d) => !d)).toBe(true);      // an actual

    // The depth axis runs DOWN: a deeper point must sit lower on the screen.
    const inverted = await lines.first().evaluate((el) => {
      const pts = (el.getAttribute("points") ?? "").trim().split(/\s+/)
        .map((p) => p.split(",").map(Number));
      return pts.length > 1 && pts[pts.length - 1][1] > pts[0][1];
    });
    expect(inverted, "the depth axis is not running downward").toBe(true);
  });

  test("the template picker changes what is plotted", async ({ page }) => {
    await expect(page.getByTestId("wv-dvd-chart").first()).toBeVisible({ timeout: 15_000 });
    const before = await page.getByTestId("wv-dvd-chart").first().textContent();
    await page.getByTestId("wv-dvd-template")
      .selectOption({ label: "Phases_Problem Time" });
    await expect
      .poll(async () => page.getByTestId("wv-dvd-chart").first().textContent(), { timeout: 10_000 })
      .not.toBe(before);
  });

  test("switching job redraws for that job alone", async ({ page }) => {
    await expect(page.getByTestId("wv-dvd-chart").first()).toBeVisible({ timeout: 15_000 });
    const options = await page.getByTestId("wv-dvd-job").locator("option").allTextContents();
    expect(options.length).toBeGreaterThan(1);
    const other = options.find((o) => !o.includes("Drilling")) ?? options[1];
    await page.getByTestId("wv-dvd-job").selectOption({ label: other });
    // Either a different chart or an honest "no curve" — never a stale one.
    await expect(page.getByTestId("wv-dvd-chart").first()
      .or(page.getByTestId("wv-dvd-empty"))).toBeVisible({ timeout: 10_000 });
  });
});

/**
 * The drilling curve has to move with Tools > Reference Datum like every other
 * depth in the app, or the Days vs Depth tab silently disagrees with the
 * Schematic and the Survey tab by the height of the rig floor.
 *
 * The assertion is on the AXIS LABELS, not on the polyline: shifting every
 * point by a constant shifts the auto-scaled axis with it, so the drawn curve
 * is translation-invariant and identical coordinates prove nothing either way.
 * "Sample 12 - Phase and Prod" has KB 1075.80 m and ground 1072.10 m, so the
 * depth axis must read 3.7 m shallower.
 */
test("the drilling curve follows the reference datum", async ({ page }) => {
  await page.goto("/wellview");
  await page.getByRole("heading", { name: "WellView" }).waitFor();
  const signIn = page.getByRole("button", { name: "Sign in" });
  if (await signIn.isVisible().catch(() => false)) {
    await page.getByLabel("User name").fill(USER);
    await page.getByLabel("Password").fill(PASSWORD);
    await signIn.click();
  }
  await page.getByTestId("wv-db-wv9.0_Sample").click();
  await page.getByTestId("wv-well-row").filter({ hasText: "Sample 12 - Phase and Prod" })
    .first().dblclick();
  await expect(page.getByText("Select a report")).toBeVisible({ timeout: 15_000 });
  await page.getByTestId("wv-tab-dvd").click();
  await expect(page.getByTestId("wv-dvd-chart").first()).toBeVisible({ timeout: 15_000 });

  const ticks = () => page.getByTestId("wv-dvd-chart").first().locator("text").allTextContents();
  const datum = page.locator("select").filter({ hasText: "Original KB" }).first();
  try {
    const fromKB = await ticks();
    await datum.selectOption("Ground");
    await expect.poll(async () => (await ticks()).join("|"), { timeout: 10_000 })
      .not.toBe(fromKB.join("|"));
    const fromGround = await ticks();
    // A depth of zero from the KB is 3.7 m ABOVE ground, so the axis goes negative.
    expect(fromGround.some((t) => t.startsWith("-"))).toBe(true);
    expect(fromKB.some((t) => t.startsWith("-"))).toBe(false);
  } finally {
    // Leave the shared datum where the other specs expect it.
    await datum.selectOption("OrigKB");
  }
});

/**
 * Every reference datum must survive a page reload.
 *
 * The web app kept its own hand-typed whitelist of datum names beside the
 * shared one, and it had fallen an entry behind: Sea level appeared in the
 * picker and persisted, then the next load rejected it and reverted to the
 * original KB — so someone reading depths from sea level silently got KB
 * depths back. The whitelist now comes from the shared DATUMS list; this walks
 * all of them so the two can never drift again.
 */
test("every reference datum survives a reload", async ({ page }) => {
  await page.goto("/wellview");
  await page.getByRole("heading", { name: "WellView" }).waitFor();
  const signIn = page.getByRole("button", { name: "Sign in" });
  if (await signIn.isVisible().catch(() => false)) {
    await page.getByLabel("User name").fill(USER);
    await page.getByLabel("Password").fill(PASSWORD);
    await signIn.click();
  }
  await page.getByTestId("wv-db-wv9.0_Sample").click();
  await expect(page.getByTestId("wv-well-row").first()).toBeVisible({ timeout: 15_000 });

  const picker = () => page.locator("select").filter({ hasText: "Original KB" }).first();
  try {
    for (const d of ["SeaLevel", "MudLine", "TubHead", "CasFlange", "Ground"]) {
      await picker().selectOption(d);
      await page.reload();
      await expect(page.getByTestId("wv-db-wv9.0_Sample")).toBeVisible({ timeout: 15_000 });
      expect(await picker().inputValue(), `${d} did not survive the reload`).toBe(d);
    }
  } finally {
    await picker().selectOption("OrigKB");
  }
});

/**
 * The well list must show measured columns in the user's unit set, name that
 * unit in the heading, and put the SAME numbers on the clipboard.
 *
 * It did none of the three: `String(w[c.column])` printed the stored value, so
 * a US user reading "Original KB Elevation" saw metres, and Copy Well List
 * pasted those metres into Excel under a heading that said feet.
 */
test("the well list converts measured columns and copies what it shows", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]).catch(() => { /* not chromium */ });
  await page.goto("/wellview");
  await page.getByRole("heading", { name: "WellView" }).waitFor();
  const signIn = page.getByRole("button", { name: "Sign in" });
  if (await signIn.isVisible().catch(() => false)) {
    await page.getByLabel("User name").fill(USER);
    await page.getByLabel("Password").fill(PASSWORD);
    await signIn.click();
  }
  // Wait for the sign-in to LAND before reloading. Clicking "Sign in" starts a
  // request; the token reaches localStorage when it comes back, and a reload in
  // between throws the session away and leaves the page on the sign-in form.
  await page.getByTestId("wv-db-wv9.0_Sample").waitFor({ timeout: 15_000 });
  // Put a measured column on screen; the choice is persisted per database.
  await page.evaluate(() => localStorage.setItem(
    "wv.online.wv9.0_Sample.cols", JSON.stringify(["WellName", "ElvOrigKB"])));
  await page.reload();
  await page.getByTestId("wv-db-wv9.0_Sample").click();
  await expect(page.getByTestId("wv-well-row").first()).toBeVisible({ timeout: 15_000 });

  const head = () => page.locator("thead").first();
  const firstRow = () => page.getByTestId("wv-well-row").first();
  const units = page.locator("select").first();
  try {
    await units.selectOption("Metric");
    await expect(head()).toContainText("(m)");
    const metric = (await firstRow().textContent() ?? "").replace(/\s+/g, " ");

    await units.selectOption("US");
    await expect(head()).toContainText("(ft)");
    const us = (await firstRow().textContent() ?? "").replace(/\s+/g, " ");
    expect(us).not.toBe(metric);

    // 1078.6 m is 3538.7 ft — the conversion, not just a different string.
    const num = (t: string) => Number((t.match(/([\d,]+\.\d+)\s*$/) ?? [])[1]?.replace(/,/g, ""));
    expect(num(us) / num(metric)).toBeCloseTo(3.28084, 3);

    // The clipboard must carry the same unit it is showing.
    await page.getByRole("button", { name: /Copy Well List/ }).first().click();
    const clip = await page.evaluate(() => navigator.clipboard.readText().catch(() => ""));
    if (clip) {
      expect(clip.split("\n")[0]).toContain("(ft)");
      // Compare the NUMBER, not a substring: both sides are thousands-grouped.
      expect(num(clip.split("\n")[1])).toBeCloseTo(num(us), 2);
    }
  } finally {
    await units.selectOption("Metric");
  }
});

/**
 * Copy Data to Clipboard (§3.9) must carry what the grid SHOWS.
 *
 * It read the row straight out of the payload, so the screen displayed a depth
 * in feet while the clipboard pasted the stored metres, and a linked record
 * showed its caption on screen but pasted a 32-hex GUID. The screen and the
 * clipboard disagreeing is worse than either being wrong alone — the number
 * arrives in Excel looking checked.
 */
test("Copy Data puts the displayed values on the clipboard, not the stored ones", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]).catch(() => { /* not chromium */ });
  await page.goto("/wellview");
  await page.getByRole("heading", { name: "WellView" }).waitFor();
  const signIn = page.getByRole("button", { name: "Sign in" });
  if (await signIn.isVisible().catch(() => false)) {
    await page.getByLabel("User name").fill(USER);
    await page.getByLabel("Password").fill(PASSWORD);
    await signIn.click();
  }
  await page.getByTestId("wv-db-wv9.0_Sample").click();
  await page.getByTestId("wv-well-row").filter({ hasText: "Sample 12 - Phase and Prod" })
    .first().dblclick();
  await page.getByRole("button", { name: "Edit Data", exact: true }).click();
  await expect(page.getByText("Show System Fields")).toBeVisible({ timeout: 15_000 });
  await openFolder(page, page.locator('button[title="wvWellbore"]'));
  await expect(page.getByRole("button", { name: /^Copy Data$/ })).toBeEnabled({ timeout: 10_000 });

  const units = page.locator("select").first();
  const copy = async (u: string) => {
    await units.selectOption(u);
    await page.getByRole("button", { name: /^Copy Data$/ }).first().click();
    return await page.evaluate(() => navigator.clipboard.readText().catch(() => ""));
  };
  try {
    const metric = await copy("Metric");
    const us = await copy("US");
    if (!metric) return;                       // clipboard unavailable in this browser
    // The heading names the unit it is in, and that unit follows the set.
    expect(metric.split("\n")[0]).toContain("(m)");
    expect(us.split("\n")[0]).toContain("(ft)");
    // A linked record copies as its caption, never as a bare GUID.
    for (const line of us.split("\n").slice(1)) {
      expect(line, "a 32-hex GUID reached the clipboard").not.toMatch(/\t[0-9A-F]{32}(\t|$)/i);
    }
  } finally {
    await units.selectOption("Metric");
  }
});

/**
 * §9.2 "Filter and Sort Records": a template's own row filter must be applied,
 * and must be stated.
 *
 * 71 of the 182 shipped templates declare one — always a job type — and none
 * were applied, so a drilling report opened on a well that also has completion
 * jobs printed the completion's rows under a drilling heading. Applying it
 * silently is not enough either: a reader who does not know the page is
 * filtered reads "no rows" as "no data".
 */
test("a report states and applies the filter its template declares", async ({ page }) => {
  await page.goto("/wellview");
  await page.getByRole("heading", { name: "WellView" }).waitFor();
  const signIn = page.getByRole("button", { name: "Sign in" });
  if (await signIn.isVisible().catch(() => false)) {
    await page.getByLabel("User name").fill(USER);
    await page.getByLabel("Password").fill(PASSWORD);
    await signIn.click();
  }
  await page.getByTestId("wv-db-wv9.0_Sample").click();
  // A well with both drilling and completion jobs, so the filter can bite.
  await page.getByTestId("wv-well-row").filter({ hasText: "Sample 12 - Phase and Prod" })
    .first().dblclick();
  await expect(page.getByText("Select a report")).toBeVisible({ timeout: 15_000 });

  await page.getByPlaceholder("Search reports…").fill("AFE vs Field Est");
  await page.getByRole("button", { name: "AFE vs Field Est", exact: true }).first().click();

  const banner = page.getByTestId("wv-report-filter");
  await expect(banner).toBeVisible({ timeout: 15_000 });
  // The model's own caption for wvJob.wvTyp, not the raw column name.
  await expect(banner).toContainText("Job Category");
  await expect(banner).toContainText("drill");

  // A template with no filter must not grow a banner.
  await page.getByPlaceholder("Search reports…").fill("Well Summary");
  const plain = page.getByTestId("wv-report-output").first();
  if (await plain.isVisible().catch(() => false)) {
    await plain.click();
    await expect(page.getByTestId("wv-report-filter")).toBeHidden({ timeout: 10_000 });
  }
});

/**
 * Model-calculated fields on stored tables — WellView's green cells.
 *
 * These have no column in a converted database; WellView works them out when a
 * report prints, and until now the app dropped them silently, so 120 of the 182
 * templates printed at least one column of nothing with no note.
 *
 * The pair checked here is the one that proves dependency ordering works:
 * Interval ROP is "<DepthDrilledCalc> / <TmDrill>" and DepthDrilledCalc is
 * ITSELF derived, so evaluating the two independently leaves ROP permanently
 * blank — a column advertising a value it can never produce.
 */
test("a report fills the fields WellView computes at print time", async ({ page }) => {
  await page.goto("/wellview");
  await page.getByRole("heading", { name: "WellView" }).waitFor();
  const signIn = page.getByRole("button", { name: "Sign in" });
  if (await signIn.isVisible().catch(() => false)) {
    await page.getByLabel("User name").fill(USER);
    await page.getByLabel("Password").fill(PASSWORD);
    await signIn.click();
  }
  await page.getByTestId("wv-db-wv9.0_Sample").click();
  await page.getByTestId("wv-well-row").filter({ hasText: "Sample 12 - Phase and Prod" })
    .first().dblclick();
  await expect(page.getByText("Select a report")).toBeVisible({ timeout: 15_000 });

  await page.getByPlaceholder("Search reports…").fill("Hydraulics Summary");
  await page.getByRole("button", { name: "Hydraulics Summary", exact: true }).first().click();

  const derived = page.getByTestId("wv-derived-col");
  await expect(derived.first()).toBeVisible({ timeout: 15_000 });
  // At least two, not exactly two: the count rises every time the calc engine
  // learns another shape, and pinning it exactly makes an unrelated improvement
  // look like a break. What matters is that the named ones are there.
  expect(await derived.count()).toBeGreaterThanOrEqual(2);
  const heads = (await derived.allTextContents()).map((h) => h.replace(/\s+/g, " ").trim());
  expect(heads.join(" ")).toContain("Interval Depth Drilled");
  expect(heads.join(" ")).toContain("Interval ROP");

  // The heading carries the model's own equation, so the number is traceable.
  expect(await derived.first().getAttribute("title")).toContain("computed here:");

  // Both columns must actually carry values — ROP especially, since it reads a
  // field that exists only because this computed it first.
  const table = derived.first().locator("xpath=ancestor::table[1]");
  const idx = await derived.first().evaluate((el) =>
    Array.from(el.parentElement!.children).indexOf(el));
  const cells = await table.locator(`tbody tr td:nth-child(${idx + 1})`).allTextContents();
  expect(cells.filter((c) => c.trim()).length).toBeGreaterThan(10);
});

/**
 * The schematic, after the guide-audit fixes (§7.2 troubleshooting, §8.3 tracks
 * and templates, §3.8 copy/print).
 *
 * Each assertion stands for a thing the diagram used to get wrong rather than
 * merely lack: cement was a fixed 60-pixel strip above every shoe whatever was
 * pumped, the drill string and its bit were not drawn at all, and the deviation
 * survey a wellbore is linked to was never read.
 */
test.describe("WellView Online — schematic", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/wellview");
    await page.getByRole("heading", { name: "WellView" }).waitFor();
    const signIn = page.getByRole("button", { name: "Sign in" });
    if (await signIn.isVisible().catch(() => false)) {
      await page.getByLabel("User name").fill(USER);
      await page.getByLabel("Password").fill(PASSWORD);
      await signIn.click();
    }
    await page.getByTestId("wv-db-wv9.0_Sample").click();
    await expect(page.getByTestId("wv-well-row").first()).toBeVisible({ timeout: 15_000 });
  });

  test("draws cement between the depths that were recorded", async ({ page }) => {
    await page.getByTestId("wv-well-row").filter({ hasText: "Sample 12 - Phase and Prod" })
      .first().dblclick();
    await expect(page.getByText("Select a report")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("wv-tab-schematic").click();

    await expect
      .poll(async () => (await page.locator("svg title").allTextContents())
        .filter((t) => /wvCementStage/.test(t)).length, { timeout: 15_000 })
      .toBeGreaterThan(0);
    const titles = (await page.locator("svg title").allTextContents())
      .filter((t) => /wvCementStage/.test(t));
    // A real interval, not a token strip: the tooltip names both depths.
    expect(titles.some((t) => /Cement stage — .+ to .+/.test(t))).toBe(true);
  });

  test("draws the drill string and its bit while they are in the hole", async ({ page }) => {
    await page.getByTestId("wv-well-row").filter({ hasText: "Sample 12 - Phase and Prod" })
      .first().dblclick();
    await expect(page.getByText("Select a report")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("wv-tab-schematic").click();
    await expect(page.getByTestId("wv-sch-layer-drillString")).toBeVisible({ timeout: 15_000 });

    // At the LAST date every string has been pulled, which is correct — step to
    // the first, when one was still on bottom.
    await page.getByTitle("First date").click();
    await expect
      .poll(async () => (await page.locator("svg title").allTextContents())
        .filter((t) => /wvJobDrillString/.test(t)).length, { timeout: 15_000 })
      .toBeGreaterThan(0);
    const ds = (await page.locator("svg title").allTextContents())
      .filter((t) => /wvJobDrillString/.test(t));
    expect(ds.some((t) => /bit /.test(t)), "the bit is not named on the string").toBe(true);
  });

  test("offers TVD and inclination tracks from the linked survey", async ({ page }) => {
    await page.getByTestId("wv-well-row").filter({ hasText: "Sample 11 - Full Data" })
      .first().dblclick();
    await expect(page.getByText("Select a report")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("wv-tab-schematic").click();

    const tvd = page.getByTestId("wv-sch-track-tvd");
    await expect(tvd).toBeVisible({ timeout: 15_000 });
    await expect(tvd).toBeEnabled();                  // this wellbore links a survey
    await tvd.check();
    await page.getByTestId("wv-sch-track-incl").check();

    await expect
      .poll(async () => (await page.locator("svg title").allTextContents())
        .filter((t) => /^TVD from survey|^Incl. from survey/.test(t)).length, { timeout: 15_000 })
      .toBe(2);
    // The track names the survey it came from, so a TVD is never anonymous.
    const t = (await page.locator("svg title").allTextContents())
      .find((x) => /^TVD from survey/.test(x)) ?? "";
    expect(t).toMatch(/stations/);
  });

  test("can copy, save and print the drawing", async ({ page }) => {
    await page.getByTestId("wv-well-row").first().dblclick();
    await expect(page.getByText("Select a report")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("wv-tab-schematic").click();
    for (const id of ["wv-sch-copy", "wv-sch-png", "wv-sch-print"]) {
      await expect(page.getByTestId(id)).toBeVisible({ timeout: 15_000 });
    }
  });

  test("edits, copies, renames and deletes a schematic template (§8.3)", async ({ page }) => {
    // Six round-trips through the app database, each waiting for the list to
    // refetch. Fixed waits rather than polls: the list is re-fetched on a query
    // invalidation, and polling allTextContents across that refetch races the
    // element being replaced.
    test.setTimeout(90_000);
    const stamp = `E2E${Date.now() % 100000}`;
    page.on("dialog", (d) => void d.accept(d.type() === "prompt" ? `${stamp} renamed` : ""));
    await page.getByTestId("wv-well-row").first().dblclick();
    await expect(page.getByText("Select a report")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("wv-tab-schematic").click();
    await expect(page.getByTestId("wv-sch-new")).toBeVisible({ timeout: 15_000 });

    const names = async () =>
      (await page.getByTestId("wv-sch-template").locator("option").allTextContents());
    const made: string[] = [];
    try {
      await page.getByTestId("wv-sch-new").click();
      await page.getByTestId("wv-sch-name").fill(stamp);
      await page.getByTestId("wv-sch-save").click();
      await page.waitForTimeout(1500);
      made.push(stamp);
      // Saving selects what it saved — that is what gives Edit/Copy/Delete a
      // target, and the row offered none of them before.
      await expect(page.getByTestId("wv-sch-update")).toBeVisible({ timeout: 10_000 });

      // Copy a Template: "the copy appears with (copy) beside the name" (§8.3).
      await page.getByTestId("wv-sch-copy-tpl").click();
      await page.waitForTimeout(1500);
      made.push(`${stamp} (copy)`);
      expect(await names()).toEqual(expect.arrayContaining([`${stamp} (copy)`]));

      // Edit a Template, here as a rename — the same update path.
      await page.getByTestId("wv-sch-rename").click();
      await page.waitForTimeout(1500);
      made.push(`${stamp} renamed`);
      expect(await names()).toEqual(expect.arrayContaining([`${stamp} renamed`]));
    } finally {
      // Delete every one this made, so a rerun is not blocked by the API's
      // unique-name constraint.
      // Only select names that are ACTUALLY in the list. selectOption retries
      // until the action timeout when the label is absent, so attempting to
      // delete a name that a rename already consumed costs 30 seconds of doing
      // nothing — which is what made this test look hung rather than slow.
      for (const name of [...new Set(made)].reverse()) {
        if (!(await names()).includes(name)) continue;
        await page.getByTestId("wv-sch-template").selectOption({ label: name });
        if (await page.getByTestId("wv-sch-delete").isVisible().catch(() => false)) {
          await page.getByTestId("wv-sch-delete").click().catch(() => {});
          await page.waitForTimeout(900);
        }
      }
    }
  });
});

/**
 * Totals over child rows — the second half of the calculated-field work.
 *
 * wvTub.LengthCalc is "Cum of <wvTubComp.Length>": a string's length is the sum
 * of its components', and neither the total nor the column exists in the
 * database. The report printed it as a blank column with no note.
 */
test("a report totals child rows for a calculated column", async ({ page }) => {
  await page.goto("/wellview");
  await page.getByRole("heading", { name: "WellView" }).waitFor();
  const signIn = page.getByRole("button", { name: "Sign in" });
  if (await signIn.isVisible().catch(() => false)) {
    await page.getByLabel("User name").fill(USER);
    await page.getByLabel("Password").fill(PASSWORD);
    await signIn.click();
  }
  await page.getByTestId("wv-db-wv9.0_Sample").click();
  await page.getByTestId("wv-well-row").filter({ hasText: "Complex Gravel Pack" })
    .first().dblclick();
  await expect(page.getByText("Select a report")).toBeVisible({ timeout: 15_000 });

  await page.getByPlaceholder("Search reports…").fill("Downhole Well Profile");
  await page.getByRole("button", { name: "Downhole Well Profile", exact: true }).first().click();

  const derived = page.getByTestId("wv-derived-col");
  await expect(derived.first()).toBeVisible({ timeout: 15_000 });
  // Found by NAME, not by position: more columns are computed than when this
  // was written, so "the first derived column" is no longer this one.
  const stringLength = derived.filter({ hasText: "String Length" }).first();
  await expect(stringLength).toBeVisible({ timeout: 15_000 });
  // The heading carries the equation, so a total is traceable to its source.
  // Matched case-insensitively: the tooltip now spells the child table the way
  // the MODEL spells it rather than the way the help text happened to.
  expect((await stringLength.getAttribute("title") ?? "").toLowerCase())
    .toContain("wvtubcomp.length");

  // And it carries numbers, not a column of blanks — the whole point.
  const table = stringLength.locator("xpath=ancestor::table[1]");
  const idx = await stringLength.evaluate((el) =>
    Array.from(el.parentElement!.children).indexOf(el));
  const cells = await table.locator(`tbody tr td:nth-child(${idx + 1})`).allTextContents();
  expect(cells.filter((c) => /\d/.test(c)).length).toBeGreaterThan(3);
});

/**
 * Paste Data from Clipboard (§3.9) — the inbound half of Copy Data.
 *
 * The guide teaches this as how tallies are entered: "Enter the tubing string
 * information by cutting and pasting from the applied Excel spreadsheet" — 147
 * joints in that exercise — and the casing tally and survey loads the same way.
 * Only the outbound half existed, so each was row-by-row typing.
 *
 * The write path is covered thoroughly at the API level (wellviewPaste.test.ts,
 * including a rolled-back bad row); what is checked here is the part that lives
 * only in the UI: parsing the block, guessing the mapping, honouring "Start at
 * row", and refusing to write a column it could not map.
 */
test("pastes a block of spreadsheet rows into a folder", async ({ page }) => {
  await page.goto("/wellview");
  await page.getByRole("heading", { name: "WellView" }).waitFor();
  const signIn = page.getByRole("button", { name: "Sign in" });
  if (await signIn.isVisible().catch(() => false)) {
    await page.getByLabel("User name").fill(USER);
    await page.getByLabel("Password").fill(PASSWORD);
    await signIn.click();
  }
  await page.getByTestId("wv-db-wv9.0_Sample").click();
  await page.getByTestId("wv-well-row").filter({ hasText: "Complex Gravel Pack" })
    .first().dblclick();
  await expect(page.getByText("Select a report")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Edit Data", exact: true }).click();
  await expect(page.getByText("Show System Fields")).toBeVisible({ timeout: 15_000 });
  await openFolder(page, page.locator('button[title="wvNote"]'));
  await expect(page.getByTestId("wv-edit-paste-open")).toBeVisible({ timeout: 15_000 });

  const tag = `E2EPASTE-${Date.now() % 100000}`;
  const created: string[] = [];
  try {
    await page.getByTestId("wv-edit-paste-open").click();
    await expect(page.getByTestId("wv-paste-dialog")).toBeVisible();

    // A heading row, then three rows. "Note" is NOT a column of this folder —
    // its caption is Comment — so the guess must leave that column unmapped
    // rather than put the text somewhere plausible-looking.
    await page.getByTestId("wv-paste-text").fill(
      [`Comment\tDate\tNote`,
        `${tag} one\t2020-01-01\tignored`,
        `${tag} two\t2020-01-02\tignored`,
        `${tag} three\t2020-01-03\tignored`].join("\n"));

    // The heading row was recognised, so the data starts at row 2.
    await expect(page.getByTestId("wv-paste-startrow")).toHaveValue("2");
    await expect(page.getByTestId("wv-paste-map-0")).toHaveValue("Com");
    await expect(page.getByTestId("wv-paste-map-1")).toHaveValue("DtTm");
    await expect(page.getByTestId("wv-paste-map-2"), "an unmatched heading must not be guessed")
      .toHaveValue("");

    await page.getByTestId("wv-paste-ok").click();
    await expect(page.getByTestId("wv-paste-dialog")).toBeHidden({ timeout: 15_000 });
    // The folder re-reads itself: three records where there were none.
    await expect.poll(async () =>
      ((await page.locator("body").textContent()) ?? "").match(/(\d+) records/)?.[1],
    { timeout: 15_000 }).toBe("3");
    await expect(page.locator("body")).toContainText("Pasted 3 records");
  } finally {
    // Written into a REAL well, so this test removes exactly what it added.
    const gone = await page.evaluate(async (t) => {
      const token = localStorage.getItem("dd.entry.token");
      const head = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
      const url = "/api/entry/wellview/dbs/wv9.0_Sample/records/wvNote"
        + "?idwell=462C2607F3BA4FE9846197C58352207B";
      const res = await fetch(url, { headers: head });
      const body = await res.json() as { rows: Record<string, string>[] };
      let n = 0;
      for (const r of body.rows ?? []) {
        if (!String(r.Com ?? "").startsWith(t)) continue;
        await fetch(`/api/entry/wellview/dbs/wv9.0_Sample/records/wvNote/${r.IDRec}`,
          { method: "DELETE", headers: head });
        n++;
      }
      return n;
    }, tag);
    expect(gone, "the test did not clean up after itself").toBe(created.length || 3);
  }
});

/**
 * §8.1 Query Templates: And/Or conditions, Prompt for Value, the Lookup list
 * and Custom SQL.
 *
 * The semantics are asserted at the API (wellviewQueryOr.test.ts), where an Or
 * can be compared against the actual union of its two sides. What is checked
 * here is that the builder can AUTHOR each of them — none of it could be
 * expressed before, whatever the runner supported.
 *
 * Drilling jobs (28 wells) or perforated wells (35) is a real widening to 42;
 * job type Drilling or Completion would not be, because in this database every
 * completion well also has a drilling job.
 */
test("the query builder authors And/Or, prompts, lookups and Custom SQL", async ({ page }) => {
  await page.goto("/wellview");
  await page.getByRole("heading", { name: "WellView" }).waitFor();
  const signIn = page.getByRole("button", { name: "Sign in" });
  if (await signIn.isVisible().catch(() => false)) {
    await page.getByLabel("User name").fill(USER);
    await page.getByLabel("Password").fill(PASSWORD);
    await signIn.click();
  }
  await page.getByTestId("wv-db-wv9.0_Sample").click();
  await expect(page.getByTestId("wv-well-row").first()).toBeVisible({ timeout: 15_000 });
  await page.getByTestId("wv-qb-new").click();
  await expect(page.getByTestId("wv-qb-name")).toBeVisible();

  const setRow = async (i: number, table: string, field: string, value?: string) => {
    await page.getByTestId("wv-qb-table").nth(i).selectOption({ label: table });
    await expect
      .poll(async () => page.getByTestId("wv-qb-field").nth(i).locator("option").count(),
        { timeout: 10_000 }).toBeGreaterThan(1);
    await page.getByTestId("wv-qb-field").nth(i).selectOption({ label: field });
    if (value !== undefined) await page.getByTestId("wv-qb-value").nth(i).fill(value);
  };
  const count = async () => {
    await page.getByTestId("wv-qb-run").click();
    await expect(page.getByTestId("wv-qb-preview")).toBeVisible({ timeout: 15_000 });
    return Number((await page.getByTestId("wv-qb-preview").textContent() ?? "").match(/(\d+)/)?.[1]);
  };

  // The first line has no conjunction — §8.1: "except the first one".
  await expect(page.getByTestId("wv-qb-conj")).toHaveCount(0);
  await setRow(0, "Jobs", "Job Category", "Drilling");
  const drilling = await count();
  expect(drilling).toBe(28);

  await page.getByTestId("wv-qb-add").click();
  await expect(page.getByTestId("wv-qb-conj")).toHaveCount(1);
  // The field label now carries the base unit — the value box is read in that
  // unit and never converted, so the picker says which one before you type.
  await setRow(1, "Perforations", "Top Depth (m)", undefined);
  await page.getByTestId("wv-qb-op").nth(1).selectOption("IS NOT NULL");

  // And narrows, Or widens — the same two lines, one selector apart.
  await page.getByTestId("wv-qb-conj").selectOption("AND");
  const and = await count();
  await page.getByTestId("wv-qb-conj").selectOption("OR");
  const or = await count();
  expect(and).toBeLessThan(drilling);
  expect(or).toBe(42);
  expect(or).toBeGreaterThan(drilling);

  // Prompt for Value: the value box gives way to a note, and the line is still
  // complete — that is what lets one template serve every answer.
  await page.getByTestId("wv-qb-prompts").first().check();
  await expect(page.getByTestId("wv-qb-prompted")).toBeVisible();
  await expect(page.getByTestId("wv-qb-run")).toBeEnabled();
  await page.getByTestId("wv-qb-prompts").first().uncheck();

  // The Lookup list offers values already in the field.
  await expect(page.getByTestId("wv-qb-lookup").first()).toBeEnabled();

  // Custom SQL, written out of the criteria and run.
  await page.getByTestId("wv-qb-sql-panel").locator("summary").click();
  await page.getByTestId("wv-qb-sql-paste").click();
  const sql = await page.getByTestId("wv-qb-sql").inputValue();
  expect(sql).toContain("SELECT h.idwell");
  expect(sql).toContain("wvJob");
  expect(sql).toContain(" OR ");            // the Or above became a real OR
  await page.getByTestId("wv-qb-sql-run").click();
  await expect
    .poll(async () => (await page.getByTestId("wv-qb-preview").textContent() ?? ""),
      { timeout: 15_000 })
    .toMatch(/42 wells/);
});

/**
 * The report editor (§9.2 "Design Single Well Reports" / "My Reports").
 *
 * The design point is that a report the user builds goes through the SAME
 * resolver as Peloton's 182, so it opens in the same viewer and gets the same
 * units, captions, calculated fields and anchor. The API tests assert that
 * equivalence directly; this drives the editor a user would use.
 *
 * Not tested because deliberately not built: page size, margins, fonts,
 * colours, master templates and block positioning. This app renders reports as
 * a page that reflows, so those settings would have nothing to act on.
 */
test("designs, saves, renders and edits a report of one's own", async ({ page }) => {
  test.setTimeout(90_000);
  page.on("dialog", (d) => void d.accept(""));
  await page.goto("/wellview");
  await page.getByRole("heading", { name: "WellView" }).waitFor();
  const signIn = page.getByRole("button", { name: "Sign in" });
  if (await signIn.isVisible().catch(() => false)) {
    await page.getByLabel("User name").fill(USER);
    await page.getByLabel("Password").fill(PASSWORD);
    await signIn.click();
  }
  await page.getByTestId("wv-db-wv9.0_Sample").click();
  await page.getByTestId("wv-well-row").filter({ hasText: "Sample 12 - Phase and Prod" })
    .first().dblclick();
  await expect(page.getByText("Select a report")).toBeVisible({ timeout: 15_000 });

  // §9.2: "You must first select the My Reports folder."
  await expect(page.getByTestId("wv-myreports")).toBeVisible();
  const name = `E2E Report ${Date.now() % 100000}`;
  try {
    await page.getByTestId("wv-report-new").click();
    await expect(page.getByTestId("wv-report-editor")).toBeVisible();
    await page.getByTestId("wv-re-name").fill(name);
    // An anchor makes it one report per day, as §9.2's own example does.
    await page.getByTestId("wv-re-anchor").selectOption("wvJobReport");
    await page.getByTestId("wv-re-table").first().selectOption({ label: "Daily Operations" });
    await expect
      .poll(async () => page.getByTestId("wv-re-field-add").first().locator("option").count(),
        { timeout: 15_000 }).toBeGreaterThan(3);

    // Two fields, in the order they are added — order is the point of the arrows.
    await page.getByTestId("wv-re-field-add").first().selectOption({ index: 1 });
    await page.getByTestId("wv-re-field-add").first().selectOption({ index: 1 });
    await expect(page.getByTestId("wv-re-field")).toHaveCount(2);
    const before = await page.getByTestId("wv-re-field").allTextContents();
    await page.getByTestId("wv-re-field").first().getByTitle("Move down").click();
    const after = await page.getByTestId("wv-re-field").allTextContents();
    expect(after[0]).not.toBe(before[0]);

    await page.getByTestId("wv-re-save").click();
    await expect(page.getByTestId("wv-report-editor")).toBeHidden({ timeout: 15_000 });

    // It lists under My Reports and opens in the ordinary report viewer.
    const saved = page.getByTestId("wv-report-saved").filter({ hasText: name });
    await expect(saved).toHaveCount(1, { timeout: 15_000 });
    await saved.click();
    await expect(page.locator("body")).toContainText(name, { timeout: 15_000 });
    await expect(page.locator("body")).toContainText(/\d+ of \d+ blocks have rows/);

    /*
     * AND IT PRINTS. This step is the whole reason the bug survived: the test
     * designed, saved, viewed and edited a report and never pressed Print, so
     * "print anything you built" failed for every saved report — `html` is
     * `saved:<id>` and the print path looked it up among the shipped templates,
     * got a 404 and showed it as a red error line.
     */
    await page.getByTestId("wv-print-open").click();
    await expect(page.getByTestId("wv-print-build")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("wv-print-build").click();
    await expect(page.getByTestId("wv-print-sheet").first()).toBeVisible({ timeout: 30_000 });
    // A 404 would land in the error line rather than producing a sheet.
    await expect(page.locator("body")).not.toContainText("no template with html=saved:");
    await page.getByTestId("wv-print-close").click();

    // Editing reopens it with what was saved, rather than a blank form.
    await page.getByTestId("wv-report-edit").first().click({ force: true });
    await expect(page.getByTestId("wv-re-name")).toHaveValue(name);
    await expect(page.getByTestId("wv-re-anchor")).toHaveValue("wvJobReport");
    await expect(page.getByTestId("wv-re-field")).toHaveCount(2);
    await page.getByTestId("wv-re-close").click();
  } finally {
    /*
     * Close whatever is open before deleting.
     *
     * When a step above fails, the print or editor overlay is still up and it
     * covers the delete button — so the cleanup silently failed and left the
     * report in the database for the next run to trip over. Found exactly that
     * way while proving the Print step catches its bug.
     */
    for (const id of ["wv-print-close", "wv-re-close"]) {
      const btn = page.getByTestId(id);
      if (await btn.count().catch(() => 0)) await btn.first().click({ force: true }).catch(() => {});
    }
    const row = page.getByTestId("wv-report-saved").filter({ hasText: name });
    if (await row.count()) {
      await page.getByTestId("wv-report-delete").first().click({ force: true });
      await expect(row).toHaveCount(0, { timeout: 10_000 });
    }
  }
});

/**
 * §3.11 Field Information — the database names behind the captions.
 *
 * The guide: "The Field Information command allows you to view the database
 * names and type of data for all the fields in a folder. You can also copy this
 * information to the Clipboard and paste it into a different application."
 *
 * Everywhere else in this app a field is its caption. An administrator writing
 * a query or reading a report definition needs `wvJobDrillString.BitNo`, and
 * this is the only screen that gives it — which is why the test checks the
 * database name and the clipboard, not the layout.
 */
test("lists every field's database name, type and unit, and copies them", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]).catch(() => { /* not chromium */ });
  await page.goto("/wellview");
  await page.getByRole("heading", { name: "WellView" }).waitFor();
  const signIn = page.getByRole("button", { name: "Sign in" });
  if (await signIn.isVisible().catch(() => false)) {
    await page.getByLabel("User name").fill(USER);
    await page.getByLabel("Password").fill(PASSWORD);
    await signIn.click();
  }
  await page.getByTestId("wv-db-wv9.0_Sample").click();
  await expect(page.getByTestId("wv-well-row").first()).toBeVisible({ timeout: 15_000 });
  await page.getByTestId("wv-well-row").filter({ hasText: "Sample 12" }).first().click();
  await page.getByRole("button", { name: /^Edit Data$/ }).first().click();
  await openFolder(page, page.getByText("Drill Strings / BHA", { exact: true }));

  await page.getByTestId("wv-edit-fieldinfo").click();
  await expect(page.getByTestId("wv-fieldinfo-dialog")).toBeVisible({ timeout: 15_000 });
  const rows = page.getByTestId("wv-fieldinfo-row");
  await expect(rows.first()).toBeVisible();
  const total = await rows.count();
  expect(total).toBeGreaterThan(20);

  // The database name is the point of the screen.
  await expect(page.getByTestId("wv-fieldinfo-dialog")).toContainText("wvJobDrillString.BitNo");
  // The identity columns carry no type or unit; they say "key" rather than
  // showing three blank cells that read as missing metadata.
  await expect(rows.filter({ hasText: "wvJobDrillString.IDRec" }).first()).toContainText("key");
  // Calculated fields are listed beside the stored ones and marked.
  await expect(rows.filter({ hasText: "bittfacalc" }).first()).toContainText("calculated");

  // The filter narrows without losing the dialog.
  await page.getByTestId("wv-fieldinfo-filter").fill("wear");
  await expect(rows).not.toHaveCount(total);
  expect(await rows.count()).toBeGreaterThan(0);
  await page.getByTestId("wv-fieldinfo-filter").fill("");
  await expect(rows).toHaveCount(total);

  // …and the guide's second half: it goes to the clipboard with headings.
  await page.getByTestId("wv-fieldinfo-copy").click();
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  const lines = clip.split("\n");
  expect(lines.length).toBe(total + 1);
  expect(lines[0]).toContain("Database name");
  expect(lines[0]).toContain("Type");
  expect(clip).toContain("wvJobDrillString.BitNo");

  await page.getByTestId("wv-fieldinfo-close").click();
  await expect(page.getByTestId("wv-fieldinfo-dialog")).toHaveCount(0);
});

/**
 * §3.11 Selecting Records — the gate for multi-delete, multi-copy and Copy
 * Selected Data.
 *
 * The guide names the gesture precisely: "To select one record, click the
 * record number column in vertical or horizontal view." / "To select multiple
 * records, click the record number column and drag to select." 9.0's own
 * enhancement list adds "To highlight the rows, use the Ctrl and Shift keys",
 * and the shortcut table binds "Select all the records — Ctrl+A".
 *
 * THE HIT TARGET IS THE NUMBER, NOT THE CELL, and this test exists partly to
 * keep it that way. The cell also holds Copy, Duplicate and Delete; while this
 * was being built a click aimed at the cell's centre landed on Duplicate and
 * created 169 records. So the last assertion here is that a full selection
 * workout leaves the row count exactly where it started.
 */
test("selects records by their number, with Shift, Ctrl and Select all", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]).catch(() => { /* not chromium */ });
  await page.goto("/wellview");
  await page.getByRole("heading", { name: "WellView" }).waitFor();
  const signIn = page.getByRole("button", { name: "Sign in" });
  if (await signIn.isVisible().catch(() => false)) {
    await page.getByLabel("User name").fill(USER);
    await page.getByLabel("Password").fill(PASSWORD);
    await signIn.click();
  }
  await page.getByTestId("wv-db-wv9.0_Sample").click();
  await expect(page.getByTestId("wv-well-row").first()).toBeVisible({ timeout: 15_000 });
  await page.getByTestId("wv-well-row").filter({ hasText: "Sample 12" }).first().click();
  await page.getByRole("button", { name: /^Edit Data$/ }).first().click();
  await openFolder(page, page.getByText("Drill Strings / BHA", { exact: true }));

  const nums = page.getByTestId("wv-rownum");
  await expect(nums.first()).toBeVisible({ timeout: 15_000 });
  const startRows = await nums.count();
  expect(startRows).toBeGreaterThan(4);

  const selected = () => nums.evaluateAll(
    (els) => els.filter((e) => e.className.includes("text-blue-900")).length);

  await nums.nth(1).click();
  expect(await selected()).toBe(1);

  // Shift extends from the last click — four rows, 1 through 4.
  await nums.nth(4).click({ modifiers: ["Shift"] });
  expect(await selected()).toBe(4);

  // Ctrl adds one, and adds it again to take it away.
  await nums.nth(7).click({ modifiers: ["Control"] });
  expect(await selected()).toBe(5);
  await nums.nth(7).click({ modifiers: ["Control"] });
  expect(await selected()).toBe(4);

  // The button counts what is selected, and clears it.
  const all = page.getByTestId("wv-edit-selectall");
  await expect(all).toContainText("Deselect (4)");
  await all.click();
  expect(await selected()).toBe(0);
  await all.click();
  expect(await selected()).toBe(startRows);
  await all.click();

  // §3.11 Copy Selected Data: with a selection, Copy Data copies just those.
  await nums.nth(0).click();
  await nums.nth(2).click({ modifiers: ["Shift"] });
  await page.getByRole("button", { name: "Copy Data" }).click();
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  expect(clip.split("\n").length, "one heading row plus the three selected").toBe(4);

  // Nothing was created or destroyed by any of that. The number is the target
  // precisely so that selecting cannot reach Duplicate or Delete.
  expect(await nums.count(), "selecting must not change the folder").toBe(startRows);
});
