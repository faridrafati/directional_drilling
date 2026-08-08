/**
 * Well Data entry E2E — a job built entirely by hand, then printed.
 *
 * This is the test that says "a user can enter this data themselves": nothing
 * is seeded for it. It types a cost code, a job, a phase with its plan, an AFE
 * with a supplement and an authorized line, and two cost lines — then opens
 * Well Reports and checks report 01 prints exactly the numbers that were typed,
 * including the ones the assembler computes.
 *
 * It cleans up after itself: the job is deleted and the cost code removed, so
 * the run leaves no residue in the database.
 *
 * Assumes the API (:4000) and web (:5173) are running. Credentials come from
 * the environment:
 *
 *   ENTRY_USER=admin ENTRY_PASSWORD=… npx playwright test well-data-entry
 */
import { test, expect, type Page } from "@playwright/test";

const USER = process.env.ENTRY_USER ?? "admin";
const PASSWORD = process.env.ENTRY_PASSWORD ?? "admin";

/** Unique per run, so a leftover from a failed run can never collide. */
const STAMP = String(Date.now()).slice(-6);
const JOB_NAME = `E2E job ${STAMP}`;
const CODE1 = "9" + STAMP.slice(0, 3);
const CODE2 = "9" + STAMP.slice(3, 6);
const CODE_DES = `E2E test account ${STAMP}`;

/**
 * The two cost lines this test types, and what report 01 must therefore print.
 *
 *   variance = afe + supp − fld
 *     line 1:  400,000 + 25,000 − 380,500 =  44,500
 *     line 2:  120,000 +      0 − 131,250 = -11,250
 *   totals:  AFE 520,000 · Supp 25,000 · Fld 511,750 · AFE−Fld 33,250
 */
const LINE_1 = { afe: "400000", supp: "25000", fld: "380500", inv: "395000", variance: "44,500.00" };
const LINE_2 = { afe: "120000", supp: "", fld: "131250", inv: "", variance: "-11,250.00" };
const TOTALS = ["520,000.00", "25,000.00", "511,750.00", "33,250.00"];

async function signIn(page: Page, path: string) {
  await page.goto(path);
  const signInBtn = page.getByRole("button", { name: "Sign in" });
  const signedIn = page.getByRole("button", { name: "Sign out" });
  // Wait for the app to settle into ONE of the two states first. `isVisible()`
  // does not retry, so asking it straight after `goto` answers "no" while the
  // bundle is still loading and the sign-in step gets silently skipped.
  await expect(signInBtn.or(signedIn).first()).toBeVisible({ timeout: 30_000 });
  if (await signInBtn.isVisible()) {
    await page.getByLabel("User name").fill(USER);
    await page.getByLabel("Password").fill(PASSWORD);
    await signInBtn.click();
    await expect(signedIn.first()).toBeVisible({ timeout: 20_000 });
  }
}

/** Select the job whose option text contains `name`, in the first <select> that has it. */
async function pickJob(page: Page, name: string) {
  const select = page.locator("select").filter({ has: page.locator("option", { hasText: name }) }).first();
  const label = (await select.locator("option", { hasText: name }).first().textContent())!.trim();
  await select.selectOption({ label });
}

/** Save and wait for the editor to confirm, so the next step reads fresh data. */
async function saveSheet(page: Page) {
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText(/^Saved /)).toBeVisible({ timeout: 15_000 });
}

test("enter a job, its phase, its AFE and its costs by hand, then print report 01", async ({ page }) => {
  test.setTimeout(120_000);
  try {
    await runEntryFlow(page);
  } finally {
    // Always: a failed run that leaves its job behind poisons the next one.
    await cleanUp(page);
  }
});

async function runEntryFlow(page: Page) {
  await signIn(page, "/ddr-entry");

  // ── Well data tab ────────────────────────────────────────────────────────
  await page.getByRole("button", { name: "Well data" }).click();
  await expect(page.getByRole("button", { name: "+ New job" })).toBeVisible({ timeout: 15_000 });
  const wellName = await page.locator("select").first().locator("option:checked").textContent();

  // ── a company-wide cost code, typed by hand ──────────────────────────────
  // Needed first: the cost sheet picks codes from a list, it never invents one.
  await page.getByRole("button", { name: "Cost codes", exact: true }).click();
  // Wait for the grid before counting. `count()` does NOT auto-wait, so asking
  // it while the panel still says "Loading…" answers 0 — and the test then
  // fills row 0, overwriting a real cost code instead of adding one.
  await expect(page.getByTestId("code-r0-code1")).toBeVisible({ timeout: 15_000 });
  const codeRows = page.locator('[data-testid^="code-r"][data-testid$="-code1"]');
  const newCodeRow = await codeRows.count();
  await page.getByTestId("code-add").click();
  await expect(page.getByTestId(`code-r${newCodeRow}-code1`)).toBeVisible();
  await page.getByTestId(`code-r${newCodeRow}-code1`).fill(CODE1);
  await page.getByTestId(`code-r${newCodeRow}-code2`).fill(CODE2);
  await page.getByTestId(`code-r${newCodeRow}-description`).fill(CODE_DES);
  await page.getByRole("button", { name: "Save cost codes" }).click();
  await expect(page.getByText(/^Saved /)).toBeVisible({ timeout: 15_000 });

  // ── the job ──────────────────────────────────────────────────────────────
  await page.getByRole("button", { name: "Cost codes", exact: true }).click();      // fold it away
  await page.getByRole("button", { name: "+ New job" }).click();
  await page.getByRole("button", { name: /^Job/ }).first().click();
  await page.getByLabel("Name", { exact: true }).fill(JOB_NAME);
  await page.getByLabel("Job category").fill("Drilling");
  await page.getByLabel("Primary job type").fill("Drilling - original");
  await page.getByLabel("Status 1").fill("In Progress");
  await page.getByLabel("Actual start").fill("1405/02/10");
  await page.getByLabel("Actual end").fill("1405/03/05");
  await page.getByLabel("Job summary").fill(`Entered by hand in the well-data editor (${STAMP}).`);

  // ── a phase, with its plan ───────────────────────────────────────────────
  await page.getByRole("button", { name: /^Phases/ }).click();
  await page.getByTestId("phase-r0-phaseType1").fill("Surface");
  await page.getByTestId("phase-r0-phaseType2").fill("Drill-Vertical");
  await page.getByTestId("phase-r0-actualStartDate").fill("1405/02/10 09:00");
  await page.getByTestId("phase-r0-actualEndDate").fill("1405/02/11 21:45");
  await page.getByTestId("phase-r0-actualStartDepth").fill("0");
  await page.getByTestId("phase-r0-actualEndDepth").fill("980");
  await page.getByTestId("phase-r0-workingPhaseCode").selectOption({ label: "DRILLING" });
  await page.getByTestId("plan-r0-durMostLikelyDays").fill("1.34");
  await page.getByTestId("plan-r0-costMostLikely").fill("88000");

  // ── the AFE, a supplement and an authorized line ─────────────────────────
  await page.getByRole("button", { name: /^AFE & supplements/ }).click();
  await page.getByRole("button", { name: "+ Add AFE" }).click();
  await page.getByLabel("AFE number").fill(`AFE-${STAMP}`);
  await page.getByLabel("AFE amount (control total)").fill("520000");
  await page.getByTestId("afe0-supp-r0-number").fill(`S1-${STAMP}`);
  await page.getByTestId("afe0-supp-r0-amount").fill("25000");
  await page.getByTestId("afe0-line-r0-costCodeId").selectOption({ label: `${CODE1}/${CODE2} — ${CODE_DES}` });
  await page.getByTestId("afe0-line-r0-amount").fill("520000");

  // ── the cost sheet ───────────────────────────────────────────────────────
  await page.getByRole("button", { name: /^Cost sheet/ }).click();
  for (const [row, line] of [[0, LINE_1], [1, LINE_2]] as const) {
    await page.getByTestId(`cost-r${row}-costCodeId`).selectOption({ label: `${CODE1}/${CODE2} — ${CODE_DES}` });
    await page.getByTestId(`cost-r${row}-description`).fill(`E2E line ${row + 1}`);
    await page.getByTestId(`cost-r${row}-afeAmount`).fill(line.afe);
    if (line.supp) await page.getByTestId(`cost-r${row}-suppAmount`).fill(line.supp);
    await page.getByTestId(`cost-r${row}-fieldEstimate`).fill(line.fld);
    if (line.inv) await page.getByTestId(`cost-r${row}-finalInvoice`).fill(line.inv);
  }
  // The phase typed a moment ago is selectable already — its id was minted on
  // the client, so no save-and-reload round trip is needed.
  await page.getByTestId("cost-r0-phaseId").selectOption({ label: "Surface · Drill-Vertical" });
  await page.getByTestId("cost-r0-supplementId").selectOption({ label: `AFE-${STAMP} · S1-${STAMP}` });

  // The live totals must already agree with what the report will print.
  for (const t of TOTALS) {
    await expect(page.getByText(t, { exact: true }).first()).toBeVisible();
  }

  await saveSheet(page);

  // ── everything survives a reload, in the right shape ─────────────────────
  await page.reload();
  await page.getByRole("button", { name: "Well data" }).click();
  await expect(page.getByRole("button", { name: "+ New job" })).toBeVisible({ timeout: 15_000 });
  await pickJob(page, JOB_NAME);
  await page.getByRole("button", { name: /^Cost sheet/ }).click();
  await expect(page.getByTestId("cost-r0-afeAmount")).toHaveValue("400000");
  await expect(page.getByTestId("cost-r1-fieldEstimate")).toHaveValue("131250");
  // Blank stayed blank rather than being saved as 0.
  await expect(page.getByTestId("cost-r1-suppAmount")).toHaveValue("");
  await page.getByRole("button", { name: /^Phases/ }).click();
  await expect(page.getByTestId("phase-r0-actualStartDate")).toHaveValue("1405/02/10 09:00");
  await expect(page.getByTestId("plan-r0-durMostLikelyDays")).toHaveValue("1.34");
  // The spare blank rows the grid keeps on screen were pruned, not persisted:
  // three phase rows are shown, only the typed one came back with data.
  await expect(page.getByTestId("phase-r1-phaseType1")).toHaveValue("");

  // ── the report prints what was typed ─────────────────────────────────────
  await signIn(page, "/well-reports");
  await page.getByRole("button", { name: /AFE vs Field Est/ }).click();
  await page.getByLabel("Well", { exact: true }).selectOption({ label: wellName!.trim().split(" — ")[0] });
  await page.getByLabel("Job", { exact: true }).selectOption({ label: `${JOB_NAME} · AFE AFE-${STAMP}` });

  for (const t of TOTALS) {
    await expect(page.getByText(t, { exact: true }).first()).toBeVisible({ timeout: 15_000 });
  }
  // The per-row variance the assembler computed, not anything typed.
  await expect(page.getByText(LINE_1.variance, { exact: true })).toBeVisible();
  await expect(page.getByText(LINE_2.variance, { exact: true })).toBeVisible();
  await expect(page.getByText(CODE1, { exact: true }).first()).toBeVisible();
  await expect(page.getByText(`Entered by hand in the well-data editor (${STAMP}).`)).toBeVisible();

}

/**
 * Remove everything this run created: the job, then the cost code.
 *
 * With the job gone the code is referenced by nothing, so saving the grid
 * without it DELETES it rather than deactivating it — which is the branch worth
 * exercising. Written defensively: it also runs after a failure, where the job
 * or the code may not exist at all.
 */
async function cleanUp(page: Page) {
  await signIn(page, "/ddr-entry");
  await page.getByRole("button", { name: "Well data" }).click();
  await expect(page.getByRole("button", { name: "+ New job" })).toBeVisible({ timeout: 15_000 });

  // Wait for the job list to ARRIVE before concluding there is nothing to
  // delete: `count()` does not auto-wait, and a premature 0 leaves the job (and
  // therefore its cost code) behind — which then fails the assertion below in a
  // way that looks like an application bug.
  await jobsSettled(page);

  for (const name of [JOB_NAME, "New job"]) {
    while (await page.locator("option", { hasText: name }).count()) {
      await pickJob(page, name);
      page.once("dialog", (d) => void d.accept());
      await page.getByRole("button", { name: "Delete job" }).click();
      await expect(page.locator("option", { hasText: name })).toHaveCount(0, { timeout: 15_000 });
      await jobsSettled(page);
    }
  }

  await page.getByRole("button", { name: "Cost codes", exact: true }).click();
  // The grid loads asynchronously — scanning before it arrives finds nothing
  // and would silently skip the delete.
  await expect(page.getByTestId("code-r0-code1")).toBeVisible({ timeout: 15_000 });
  const idx = await indexOfCode(page, CODE1);
  if (idx < 0) return;
  await page.locator("tr").filter({ has: page.getByTestId(`code-r${idx}-code1`) })
    .getByRole("button", { name: /Remove/ }).click();
  await page.getByRole("button", { name: "Save cost codes" }).click();
  await expect(page.getByText(/^Saved /)).toBeVisible({ timeout: 15_000 });
  expect(await indexOfCode(page, CODE1), "the cost code should be gone").toBe(-1);
}

/**
 * Wait until the well-data editor has finished loading its job list — the
 * picker is enabled, or the "no drilling job yet" panel is up. Either way the
 * DOM now reflects the database and `count()` can be trusted.
 */
async function jobsSettled(page: Page) {
  const picker = page.getByLabel("Job", { exact: true });
  const empty = page.getByText(/has no\s+drilling job yet/);
  await expect(picker.or(empty).first()).toBeVisible({ timeout: 15_000 });
  await expect
    .poll(async () => (await empty.isVisible()) || (await picker.isEnabled()), { timeout: 15_000 })
    .toBe(true);
}

/** Row index of the cost code with this Code 1, or -1. */
async function indexOfCode(page: Page, code1: string): Promise<number> {
  const cells = page.locator('[data-testid^="code-r"][data-testid$="-code1"]');
  const n = await cells.count();
  for (let i = 0; i < n; i++) {
    if ((await cells.nth(i).inputValue()) === code1) {
      const id = await cells.nth(i).getAttribute("data-testid");
      return Number(/code-r(\d+)-/.exec(id ?? "")?.[1] ?? -1);
    }
  }
  return -1;
}

/**
 * The casing spine, typed by hand — the same claim for reports 04 and 05.
 *
 * Adds a string with a two-line tally and a cement job to whichever well the
 * editor opens on, saves it, then checks report 05 prints the sums the tally
 * implies. Removes the string again at the end, always: a leftover string would
 * change every later run of the report tests.
 */
const STRING_DES = `E2E string ${STAMP}`;

test("enter a casing string, its tally and its cement by hand, then print report 05", async ({ page }) => {
  test.setTimeout(120_000);
  try {
    await runCasingFlow(page);
  } finally {
    await removeCasingString(page);
  }
});

async function openCasingPanel(page: Page) {
  await signIn(page, "/ddr-entry");
  await page.getByRole("button", { name: "Well data" }).click();
  await page.getByRole("button", { name: "Casing & cement" }).click();
  // Wait for the panel to have LOADED before touching it — the save posts every
  // string it holds, so acting while it still says "Loading casing…" would post
  // an empty list and delete the well's real strings.
  await expect(page.getByTestId("save-casing")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("holesec-r0-sectionDes")).toBeVisible({ timeout: 15_000 });
}

async function saveCasing(page: Page) {
  await page.getByTestId("save-casing").click();
  await expect(page.getByText(/^Saved /)).toBeVisible({ timeout: 15_000 });
}

async function runCasingFlow(page: Page) {
  await openCasingPanel(page);
  // The entry page labels its wells "<name> — <rig>"; the reports page labels
  // them by name alone, so the rig half is dropped before it is used there.
  const wellName = (await page.locator("select").first().locator("option:checked").textContent())!
    .trim().split(" — ")[0];

  // How many strings the well already has — the new one lands after them.
  const existing = await page.locator('[data-testid^="casing-string-"]').count();
  await page.getByTestId("add-casing-string").click();
  const block = page.getByTestId(`casing-string-${existing}`);
  await expect(block).toBeVisible();

  // ── the string's own facts ───────────────────────────────────────────────
  await page.getByLabel("Description", { exact: true }).first().fill(STRING_DES);
  await page.getByLabel("Run date", { exact: true }).fill("1405/02/14");
  await page.getByLabel("Set depth (mKB)", { exact: true }).fill("1200.5");
  await page.getByLabel("Set tension (kN)", { exact: true }).fill("640");
  await page.getByLabel("String nominal OD (in)", { exact: true }).fill("9 5/8");
  await page.getByLabel("String min drift (in)", { exact: true }).fill("8.535");
  await page.getByLabel("Centralizers", { exact: true }).fill("1/joint through the shoe track.");

  // ── two tally lines: 100 joints and a shoe ───────────────────────────────
  const tally = `tally${existing}`;
  await page.getByTestId(`${tally}-r0-jts`).fill("100");
  await page.getByTestId(`${tally}-r0-itemDes`).selectOption({ label: "Casing Joint(s)" });
  await page.getByTestId(`${tally}-r0-odIn`).fill("9 5/8");
  await page.getByTestId(`${tally}-r0-idIn`).fill("8.681");
  await page.getByTestId(`${tally}-r0-massPerLenKgM`).fill("70.2");
  await page.getByTestId(`${tally}-r0-grade`).fill("L-80");
  await page.getByTestId(`${tally}-r0-lenM`).fill("1199.75");
  await page.getByTestId(`${tally}-r1-jts`).fill("1");
  await page.getByTestId(`${tally}-r1-itemDes`).selectOption({ label: "Float Shoe" });
  await page.getByTestId(`${tally}-r1-lenM`).fill("0.5");

  // ── one cement job, one stage, one fluid, one additive ───────────────────
  await page.getByTestId(`add-cement-${existing}`).click();
  await expect(page.getByLabel("Cementing start date")).toBeVisible();
  await page.getByLabel("Cementing start date").fill("1405/02/14");
  await page.getByLabel("Cementing end date").fill("1405/02/14");
  await page.getByLabel("Evaluation method").fill("CBL");
  await page.getByLabel("Top depth (mKB)").fill("400");
  await page.getByLabel("Bottom depth (mKB)").fill("1200");
  await page.getByLabel("Full return?").selectOption("true");
  const fluid = `cement${existing}-0-fluid0`;
  await page.getByTestId(`${fluid}-r0-fluidType`).selectOption({ label: "Tail" });
  await page.getByTestId(`${fluid}-r0-fluidDescription`).fill("Neat class G");
  await page.getByTestId(`${fluid}-r0-amountSacks`).fill("260");
  await page.getByTestId(`${fluid}-r0-volumePumpedM3`).fill("31.5");
  await page.getByTestId(`${fluid}-r0-densityPpg`).fill("15.8");
  const additive = `cement${existing}-0-add0-0`;
  await expect(page.getByTestId(`${additive}-r0-additive`)).toBeVisible();
  await page.getByTestId(`${additive}-r0-additive`).fill("HR-5");
  await page.getByTestId(`${additive}-r0-additiveType`).selectOption({ label: "Retarder" });
  await page.getByTestId(`${additive}-r0-concentration`).fill("0.2 %BWOC");

  await saveCasing(page);

  // ── it comes back from the server, not from the draft ────────────────────
  await page.reload();
  await page.getByRole("button", { name: "Well data" }).click();
  await page.getByRole("button", { name: "Casing & cement" }).click();
  await expect(page.getByText(STRING_DES).first()).toBeVisible({ timeout: 15_000 });

  // ── and report 05 prints what the tally adds up to ───────────────────────
  await signIn(page, "/well-reports");
  await page.getByTestId("report-05").click();
  await page.getByLabel("Well", { exact: true }).selectOption({ label: wellName });
  await expect(page.getByText(`${STRING_DES}, 1200.5mKB`)).toBeVisible({ timeout: 20_000 });
  // 100 + 1 joints; 1199.75 + 0.5 m — summed from the tally, never the set depth.
  await expect(page.getByText("101", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("1,200.25", { exact: true }).first()).toBeVisible();

  // ── report 04 finds the same string in its picker, with its cement ───────
  await page.getByTestId("report-04").click();
  await page.getByLabel("Well", { exact: true }).selectOption({ label: wellName });
  const stringPicker = page.getByLabel("Casing string", { exact: true });
  const stringLabel = (await stringPicker.locator("option", { hasText: STRING_DES })
    .first().textContent())!.trim();
  await stringPicker.selectOption({ label: stringLabel });
  await expect(page.getByText("Neat class G")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("0.2 %BWOC")).toBeVisible();
}

/** Take the string back out — runs even when the flow above failed part-way. */
async function removeCasingString(page: Page) {
  try {
    await openCasingPanel(page);
    const header = page.locator('[data-testid^="casing-string-"]', { hasText: STRING_DES });
    if (!(await header.count())) return;
    // The panel opens its FIRST string by default, so clicking blindly would
    // collapse the very block the Remove button lives in — which is how a
    // failed run once left its string behind.
    if ((await header.first().getAttribute("aria-expanded")) !== "true") {
      await header.first().click();
    }
    await expect(page.getByRole("button", { name: "Remove string" })).toBeVisible();
    page.once("dialog", (d) => void d.accept());
    await page.getByRole("button", { name: "Remove string" }).click();
    await expect(page.getByText(STRING_DES)).toHaveCount(0);
    await saveCasing(page);
  } catch { /* cleanup must never fail the run it is cleaning up after */ }
}
