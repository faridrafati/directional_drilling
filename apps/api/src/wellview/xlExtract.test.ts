/**
 * The .afmxl Excel-report data extracts.
 *
 * Two things carry risk here. The row FILTER, because a criterion decides which
 * rows appear and a mis-read one silently changes the answer — two templates
 * carry a filter this reader cannot decode, and those must say so rather than
 * quietly return everything as if unfiltered were correct. And the extracts
 * rooted on wv*Calc tables, which exist only because the app computes them.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { resolveXlExtract, type XlTemplate } from "./xlExtract.js";
import "./calcDerivations.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..", "..", "..");
const SAMPLE = join(REPO, "sqlite_DB", "wellview", "wv9.0_Sample.sqlite");
const JSON_PATH = join(REPO, "apps", "web", "public", "wellview-templates", "reports-xl.json");
const d = describe.skipIf(!existsSync(SAMPLE) || !existsSync(JSON_PATH));

d("Excel-report extracts", () => {
  let db: DatabaseSync;
  let templates: XlTemplate[];
  let wells: string[];

  beforeAll(() => {
    db = new DatabaseSync(SAMPLE, { readOnly: true });
    templates = JSON.parse(readFileSync(JSON_PATH, "utf-8")).reports as XlTemplate[];
    wells = (db.prepare("SELECT idwell FROM wvWellHeader LIMIT 8").all() as { idwell: string }[])
      .map((r) => r.idwell);
  });

  it("read all 25 shipped .afmxl files", () => {
    expect(templates.length).toBe(25);
    // One is an unconfigured starter template; the rest name a root and columns.
    const real = templates.filter((t) => !t.empty);
    expect(real.length).toBe(24);
    expect(real.every((t) => t.table && t.fields.length > 0)).toBe(true);
  });

  it("every extract runs without throwing", () => {
    const failures: string[] = [];
    for (const t of templates) {
      try { resolveXlExtract(db, t, wells); }
      catch (e) { failures.push(`${t.name}: ${(e as Error).message}`); }
    }
    expect(failures).toEqual([]);
  });

  it("always says the Excel workbook is not reproduced", () => {
    // The whole risk of shipping half of a report is implying it is all of it.
    for (const t of templates.filter((x) => x.hasWorkbook)) {
      const r = resolveXlExtract(db, t, wells);
      expect(r.notes.some((n) => /not reproduced/i.test(n)), t.name).toBe(true);
    }
  });

  it("applies a decoded filter, and matches the way WellView writes it", () => {
    // "Drilling KPIs" filters wvjob.wvtyp on the abbreviation "drill", which
    // must select "Drilling" — a prefix match, not equality, or it returns
    // nothing at all and looks like an asset with no drilling jobs.
    const tpl = templates.find((t) => t.name === "Drilling KPIs")!;
    expect(tpl.criteria).toHaveLength(1);
    const r = resolveXlExtract(db, tpl, wells);
    expect(r.applied).toHaveLength(1);
    expect(r.rowCount).toBeGreaterThan(0);

    const all = (db.prepare(
      `SELECT COUNT(*) c FROM wvJob WHERE idwell IN (${wells.map(() => "?").join(",")})`,
    ).get(...wells) as { c: number }).c;
    const drilling = (db.prepare(
      `SELECT COUNT(*) c FROM wvJob WHERE idwell IN (${wells.map(() => "?").join(",")})
         AND lower(WVTyp) LIKE 'drill%'`,
    ).get(...wells) as { c: number }).c;
    expect(r.rowCount).toBe(drilling);
    // …and the filter must actually be removing something.
    expect(drilling).toBeLessThan(all);
  });

  it("REFUSES to pretend an undecodable filter was applied", () => {
    // Two templates carry a filter this reader cannot read. Returning their
    // rows unfiltered is defensible; doing it silently is not.
    const unread = templates.filter((t) => t.filterUnread);
    expect(unread.length).toBeGreaterThan(0);
    for (const t of unread) {
      const r = resolveXlExtract(db, t, wells);
      expect(r.applied).toEqual([]);
      expect(r.notes.some((n) => /could not decode|NOT been applied/i.test(n)), t.name).toBe(true);
    }
  });

  it("runs the extracts whose root is a table WellView never stores", () => {
    // Eight extracts read from wv*Calc tables. They work only because the app
    // computes those; before that they could not have produced a single row.
    const calcRooted = templates.filter((t) => /calc$/i.test(t.table));
    expect(calcRooted.length).toBeGreaterThanOrEqual(8);
    const withRows = calcRooted.filter((t) => resolveXlExtract(db, t, wells).rowCount > 0);
    expect(withRows.length, "at least one calc-rooted extract should produce rows").toBeGreaterThan(0);
  });

  it("an empty well selection returns nothing", () => {
    const tpl = templates.find((t) => t.name === "Drilling KPIs")!;
    const r = resolveXlExtract(db, tpl, []);
    expect(r.wells).toBe(0);
    expect(r.rowCount).toBe(0);
    expect(r.rows).toEqual([]);
  });
});
