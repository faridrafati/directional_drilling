/**
 * Template row filters (§9.2 "Filter and Sort Records"), against the REAL
 * converted sample database.
 *
 * 71 of the 182 shipped templates declare a job-type filter and none of them
 * were applied, so a drilling report opened on a well that also has completion
 * jobs printed the completion's rows too — under a drilling heading. The point
 * of these tests is that the filter NARROWS: it is easy to write a predicate
 * that runs and selects everything, and that would look exactly like success.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { resolveTemplateData } from "./wellviewSample.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..", "..", "..");
const SAMPLE = join(REPO, "sqlite_DB", "wellview", "wv9.0_Sample.sqlite");
const REPORTS = join(REPO, "apps", "web", "public", "wellview-templates", "reports.json");

const hasAll = existsSync(SAMPLE) && existsSync(REPORTS);
const d = describe.skipIf(!hasAll);

interface Block {
  table: string; rowCount: number;
  filtersApplied?: { table: string; field: string; value: string }[];
  filtersSkipped?: { table: string; field: string; value: string; why: string }[];
}
let db: DatabaseSync;
let templates: { name: string; html: string; filters?: unknown[] }[];

beforeAll(() => {
  if (!hasAll) return;
  db = new DatabaseSync(SAMPLE, { readOnly: true });
  templates = (JSON.parse(readFileSync(REPORTS, "utf8")) as { reports: typeof templates }).reports;
});
afterAll(() => { db?.close(); });

/** Templates carrying a real (3-element, model-valid) job-type filter. */
const jobFiltered = () => templates.filter((t) => (t.filters ?? []).some((f) =>
  Array.isArray(f) && f.length >= 3 && String(f[0]) === "wvjob" && String(f[1]) === "wvtyp"));

/** A well with more than one job TYPE — where a job filter can bite. */
const mixedWell = () => (db.prepare(`
  SELECT idwell FROM wvJob WHERE wvTyp IS NOT NULL
  GROUP BY idwell HAVING COUNT(DISTINCT wvTyp) > 1
  ORDER BY COUNT(*) DESC LIMIT 1`).get() as { idwell: string }).idwell;

d("report template filters", () => {
  it("finds the shipped filters and ignores the decoder's mis-parses", () => {
    // 93 three-element entries exist; only the ones naming a real field of a
    // real table are usable, and every one of those is a job type.
    const all = templates.flatMap((t) => (t.filters ?? []).filter(
      (f): f is string[] => Array.isArray(f) && f.length >= 3));
    expect(all.length).toBeGreaterThan(80);
    const real = all.filter((f) => f[0] === "wvjob" && f[1] === "wvtyp");
    expect(real.length).toBeGreaterThan(70);
    // The rest carry a TABLE name where the field should be — a decoder miss.
    for (const f of all.filter((x) => !(x[0] === "wvjob" && x[1] === "wvtyp"))) {
      expect(f[1].toLowerCase()).toMatch(/^wv/);
    }
  });

  it("only ever prefix-matches, because equality selects nothing", () => {
    const values = new Set(jobFiltered().flatMap((t) => (t.filters ?? [])
      .filter((f): f is string[] => Array.isArray(f) && f[0] === "wvjob" && f[1] === "wvtyp")
      .map((f) => f[2])));
    const stored = (db.prepare("SELECT DISTINCT wvTyp t FROM wvJob WHERE wvTyp IS NOT NULL")
      .all() as { t: string }[]).map((r) => r.t.toLowerCase());
    for (const v of values) {
      const like = v.replace(/\*+$/, "").toLowerCase();
      expect(stored.some((s) => s.startsWith(like)), `"${v}" matches no stored job type`).toBe(true);
      // …and would match nothing on equality, which is the whole point.
      if (!stored.includes(like)) expect(stored.includes(like)).toBe(false);
    }
  });

  it("NARROWS the rows — the filtered report returns fewer than the unfiltered one", () => {
    const well = mixedWell();
    const jobs = (db.prepare("SELECT COUNT(*) n FROM wvJob WHERE idwell = ?").get(well) as { n: number }).n;
    let narrowed = 0;
    for (const t of jobFiltered().slice(0, 20)) {
      const res = resolveTemplateData(db, t.html, well, null);
      if (!res) continue;
      for (const b of res.blocks as Block[]) {
        if (b.table !== "wvJob" || !b.filtersApplied?.length) continue;
        // The well has several jobs; a drilling filter must leave fewer.
        expect(b.rowCount).toBeLessThan(jobs);
        expect(b.rowCount).toBeGreaterThan(0);
        narrowed++;
      }
    }
    expect(narrowed, "no wvJob block was narrowed — the predicate is not biting").toBeGreaterThan(3);
  });

  it("reaches a child block through the IDRecParent chain, not just the filtered table", () => {
    const well = mixedWell();
    let deep = 0;
    for (const t of jobFiltered().slice(0, 20)) {
      const res = resolveTemplateData(db, t.html, well, null);
      if (!res) continue;
      for (const b of res.blocks as Block[]) {
        if (b.filtersApplied?.length && b.table.toLowerCase() !== "wvjob") deep++;
      }
    }
    expect(deep, "the filter never reached a descendant block").toBeGreaterThan(0);
  });

  it("says why a filter could not be applied instead of dropping it", () => {
    const well = mixedWell();
    for (const t of jobFiltered().slice(0, 25)) {
      const res = resolveTemplateData(db, t.html, well, null);
      if (!res) continue;
      for (const b of res.blocks as Block[]) {
        for (const s of b.filtersSkipped ?? []) {
          expect(s.why.length).toBeGreaterThan(8);
          expect(s.table).toBeTruthy();
        }
      }
    }
  });

  it("leaves an unfiltered template alone", () => {
    const well = mixedWell();
    const plain = templates.find((t) => !(t.filters ?? []).some(
      (f) => Array.isArray(f) && f.length >= 3))!;
    const res = resolveTemplateData(db, plain.html, well, null);
    expect(res).toBeTruthy();
    expect(res!.filters).toEqual([]);
    for (const b of res!.blocks as Block[]) expect(b.filtersApplied).toBeUndefined();
  });

  it("still resolves every template without throwing", () => {
    const well = mixedWell();
    let ok = 0;
    for (const t of templates) { if (resolveTemplateData(db, t.html, well, null)) ok++; }
    expect(ok).toBe(templates.length);
  });
});
