/**
 * Happy-path E2E: project → country → field → well → calculation →
 * add HC3D segment → calculate → see stations table populated.
 *
 * Assumes the API + web are running (see playwright.config.ts).
 *
 * Selectors use `data-testid` hooks added to the page components so the test
 * doesn't break on cosmetic layout changes.
 */
import { test, expect } from "@playwright/test";

test("create project, add a calculation, run it end-to-end", async ({ page }) => {
  await page.goto("/");
  await page.waitForURL(/\/projects$/);

  const projectName = `E2E ${Date.now()}`;

  // 1. Create the project.
  await page.getByPlaceholder("e.g. Hithfield Phase 2").fill(projectName);
  await page.getByRole("button", { name: "Create" }).click();
  // The project link's accessible name includes the "Created …" timestamp,
  // so we match by substring (the timestamp in projectName keeps it unique).
  await page.getByRole("link", { name: new RegExp(projectName) }).first().click();
  await page.waitForURL(/\/projects\/[^/]+$/);

  // 2. Country
  await page.getByTestId("add-country-input").fill("E2E Country");
  await page.getByTestId("add-country-button").click();

  // 3. Field (scoped to the country's add-field form)
  const fieldInput = page.getByTestId("add-field-E2E_Country-input");
  await expect(fieldInput).toBeVisible({ timeout: 5_000 });
  await fieldInput.fill("E2E Field");
  await page.getByTestId("add-field-E2E_Country-button").click();

  // 4. Well (scoped to the field's add-well form)
  const wellInput = page.getByTestId("add-well-E2E_Field-input");
  await expect(wellInput).toBeVisible({ timeout: 5_000 });
  await wellInput.fill("E2E Well");
  await page.getByTestId("add-well-E2E_Field-button").click();

  // 5. Well Design calc, then open it
  const addWellDesignBtn = page.getByTestId("add-well-design-E2E_Well");
  await expect(addWellDesignBtn).toBeVisible({ timeout: 5_000 });
  await addWellDesignBtn.click();

  // The calc link "Well Design" appears in the well card. Click it.
  const wellCard = page.getByTestId("well-card-E2E_Well");
  await wellCard.getByRole("link", { name: "Well Design" }).first().click();
  await page.waitForURL(/\/calculations\//);

  // 6. "+ Add row" now opens the profile picker first (no row is added until
  //    the user chooses a profile). The picker appears with a "Select a
  //    profile type first" hint banner.
  await page.getByRole("button", { name: "+ Add row" }).click();
  await expect(page.getByText("Select a profile type first")).toBeVisible();
  await page.getByText("Hold-Curve 3D*", { exact: true }).click();
  await page.getByRole("button", { name: "Apply" }).click();

  // 7. HC3D now creates TWO persisted rows: KOP (computed, no inputs) and
  //    EOC/Target (the row with the user inputs). Target the LAST row of the
  //    HC3D group — the one whose deletion button is rendered.
  const allRows = page.locator("tbody tr");
  const targetRow = allRows.last();

  // 8. Fill the editable cells for the Target row of HC3D. Per Unit02.pas:rowcolor
  //    ii+1 = { inc, tvd, ns, ew } are editable on the Target row.
  //    td order: # | Profile | Comment | MD | Inc | Azm | TVD | EW | NS | DLS | DMD | actions
  const cells = targetRow.locator("td");
  await cells.nth(4).locator("input").fill("45");      // Inc deg
  await cells.nth(6).locator("input").fill("6000");    // TVD
  await cells.nth(7).locator("input").fill("2000");    // EW
  await cells.nth(7).locator("input").press("Tab");

  // 9. Calculate
  await page.getByRole("button", { name: /^Calculate/ }).click();
  await expect(page.getByText(/Calculated \d+ stations/)).toBeVisible({
    timeout: 15_000,
  });
});
