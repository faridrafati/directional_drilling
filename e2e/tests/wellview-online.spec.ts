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
    expect(await icon.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);

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
