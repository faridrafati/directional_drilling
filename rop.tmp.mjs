import { chromium } from "@playwright/test";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 160)); });
page.on("pageerror", (e) => errors.push("PAGEERROR " + String(e).slice(0, 160)));

await page.goto("http://localhost:5173/ddr");
await page.getByRole("button", { name: "ROP Optimization" }).click();
await page.waitForTimeout(1500);
await page.getByRole("button", { name: /^FIELDS/i }).click();
await page.waitForTimeout(500);
const boxes = page.locator("input[type=checkbox]");
const n = await boxes.count();
for (let i = 0; i < Math.min(n, 4); i += 1) await boxes.nth(i).check().catch(() => {});
await page.getByRole("button", { name: /^FIELDS/i }).click();
await page.getByRole("button", { name: /^Show/ }).click();
await page.waitForTimeout(3500);

const out = {};
for (const view of (process.env.VIEWS || "").split("|").filter(Boolean)) {
  const tab = page.getByRole("button", { name: view, exact: true });
  await tab.waitFor({ timeout: 60000 });
  await tab.click();
  await page.waitForTimeout(2500);
  out[view] = await page.evaluate(() => {
    const t = document.body.innerText;
    return {
      svgs: document.querySelectorAll("svg").length,
      tables: document.querySelectorAll("table").length,
      unreachable: (t.match(/unreachable/g) || []).length,
      beats: (t.match(/already beats it/g) || []).length,
      breakEven: t.includes("Break-even vs best offset"),
      insufficient: (t.match(/insufficient/gi) || []).length,
      chars: t.length,
    };
  });
  if (process.env.OUT) await page.screenshot({ path: `${process.env.OUT}/${view.replace(/\W+/g, "_")}.png` });
}
console.log(JSON.stringify({ ...out, errors: errors.slice(0, 4) }, null, 1));
await browser.close();
