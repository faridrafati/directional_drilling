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
  await page.locator('button[title="wvWellbore"]').click();
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
  await expect(derived).toHaveCount(2);
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
  await expect(derived.first()).toContainText("String Length");
  // The heading carries the equation, so a total is traceable to its source.
  expect(await derived.first().getAttribute("title")).toContain("wvtubcomp.length");

  // And it carries numbers, not a column of blanks — the whole point.
  const table = derived.first().locator("xpath=ancestor::table[1]");
  const idx = await derived.first().evaluate((el) =>
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
  await page.locator('button[title="wvNote"]').click();
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
  await setRow(1, "Perforations", "Top Depth", undefined);
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
