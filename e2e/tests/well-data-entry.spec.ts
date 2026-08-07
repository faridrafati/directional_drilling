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
