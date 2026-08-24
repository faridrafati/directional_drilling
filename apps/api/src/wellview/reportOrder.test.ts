/**
 * A report lists a folder's rows in the folder's own order.
 *
 * There were two ordering rules. Edit Data consulted the model — a SEQUENCED
 * folder by its stored sequence, otherwise the model's own `sqlOrderBy`, then a
 * date. The report path kept a shorter list of likely column names and
 * consulted nothing at all.
 *
 * So the same rows could come out in two different orders depending on which
 * screen you were on, and 89 of the sample's populated tables were affected —
 * 80 of them ordered by NOTHING on a report, which means whatever order the
 * scan happened to return. The daily Time Log is the one that shows: 6,942
 * entries across 736 reports, printed in storage order on all eight templates
 * that carry it, on a folder whose whole point is that someone arranged it.
 *
 * A survey is the other way round and just as wrong: it was ordered by DATE
 * where the model says `md`. A directional survey read by date rather than by
 * measured depth is not a survey.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { orderByFor, modelTable } from "./model.js";
import { resolveTemplateData } from "../routes/wellviewSample.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const SAMPLE = join(HERE, "..", "..", "..", "..", "sqlite_DB", "wellview", "wv9.0_Sample.sqlite");
const d = describe.skipIf(!existsSync(SAMPLE));

let db: DatabaseSync;
beforeAll(() => { db = new DatabaseSync(SAMPLE, { readOnly: true }); });
afterAll(() => { db?.close(); });

const colsOf = (t: string) => new Map(
  (db.prepare(`SELECT * FROM "${t}" LIMIT 1`) as unknown as { columns(): { name: string }[] })
    .columns().map((c) => [c.name.toLowerCase(), c.name] as [string, string]));

d("a report reads a folder in the folder's own order", () => {
  it("puts the user's arrangement first, for a sequenced folder", () => {
    // wvJobReportTimeLog is sequenced and has no date column of its own, so the
    // old rule found nothing and emitted no ORDER BY at all.
    expect(modelTable("wvJobReportTimeLog")?.sequenced).toBe(true);
    expect(orderByFor("wvJobReportTimeLog", colsOf("wvJobReportTimeLog"))).toBe('"sysSeq"');
    // …and it qualifies when the query joins.
    expect(orderByFor("wvJobReportTimeLog", colsOf("wvJobReportTimeLog"), "t0")).toBe('t0."sysSeq"');
  });

  it("uses the model's own ORDER BY where it states one", () => {
    // A survey is ordered by measured depth. It was ordered by date.
    expect(modelTable("wvWellboreDirSurveyData")?.sqlOrderBy?.toLowerCase()).toContain("md");
    expect(orderByFor("wvWellboreDirSurveyData", colsOf("wvWellboreDirSurveyData"))).toBe('"MD"');

    // …including a multi-column form with a direction.
    const prod = modelTable("wvProductionLiquid")?.sqlOrderBy;
    expect(prod).toBeTruthy();
    expect(orderByFor("wvProductionLiquid", colsOf("wvProductionLiquid")))
      .toBe('"ProductTyp", "Volume" DESC');
  });

  it("says nothing rather than inventing an order", () => {
    // A table with no sequence, no declared order and no date gives no basis
    // for one, and the query must not pretend otherwise.
    expect(orderByFor("wvJobReportTimeLog", new Map())).toBeNull();
  });

  it("prints the time log the way the folder holds it", () => {
    // The proof that this was a live defect: the stored order and the sequence
    // order differ on most reports, so before this the two screens disagreed.
    const differing = db.prepare(`
      WITH t AS (
        SELECT IDRecParent, sysSeq, ROW_NUMBER() OVER (PARTITION BY IDRecParent ORDER BY rowid) AS stored,
               ROW_NUMBER() OVER (PARTITION BY IDRecParent ORDER BY sysSeq)  AS bySeq
        FROM wvJobReportTimeLog)
      SELECT COUNT(DISTINCT IDRecParent) c FROM t WHERE stored <> bySeq`).get() as { c: number };
    expect(differing.c, "reports whose stored order is not their sequence order").toBeGreaterThan(400);

    const w = db.prepare(`SELECT idwell, IDRecParent FROM wvJobReportTimeLog
      GROUP BY IDRecParent ORDER BY COUNT(*) DESC LIMIT 1`).get() as { idwell: string; IDRecParent: string };
    const r = resolveTemplateData(db, "Drilling/Daily Input/Daily Drilling.html", w.idwell,
      { table: "wvJobReport", idrec: w.IDRecParent })!;
    const block = (r.blocks as { table: string | null; columns?: { column: string }[];
      rows?: (string | number | null)[][] }[])
      .find((b) => (b.table ?? "").toLowerCase() === "wvjobreporttimelog");
    expect(block, "the time log block").toBeTruthy();
    expect((block!.rows ?? []).length).toBeGreaterThan(1);

    // Whatever it prints, it prints in sysSeq order. Compare against the same
    // question asked directly.
    const expected = (db.prepare(`SELECT Duration FROM wvJobReportTimeLog
      WHERE IDRecParent = ? ORDER BY sysSeq`).all(w.IDRecParent) as { Duration: number }[])
      .map((x) => x.Duration);
    const di = (block!.columns ?? []).findIndex((c) => c.column.toLowerCase() === "duration");
    expect(di, "the block prints Duration").toBeGreaterThanOrEqual(0);
    const got = block!.rows!.map((row) => Number(row[di]));
    expect(got.length).toBe(expected.length);

    // THE ASSERTION THAT MATTERS: the printed sequence IS the sequence order,
    // element for element. Comparing lengths would pass under either rule.
    for (let i = 0; i < expected.length; i++) {
      expect(got[i], `row ${i} of ${w.IDRecParent}`).toBeCloseTo(expected[i], 9);
    }
    // …and this report is one where the two orders genuinely differ, so the
    // check has something to catch.
    const stored = (db.prepare(`SELECT Duration FROM wvJobReportTimeLog
      WHERE IDRecParent = ? ORDER BY rowid`).all(w.IDRecParent) as { Duration: number }[])
      .map((x) => x.Duration);
    expect(stored, "stored order differs from sequence order here").not.toEqual(expected);
  }, 60_000);

  it("changes the order of a lot of folders, which is the point", () => {
    // Measured across the whole sample: how many populated tables the report
    // path used to order by nothing at all.
    const OLD = ["dttm", "dttmstart", "dttmspud", "seqno", "depthtop", "md", "depth"];
    let orderedByNothing = 0, nowOrdered = 0;
    for (const row of db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'wv%'").all() as { name: string }[]) {
      let n = 0;
      try { n = (db.prepare(`SELECT COUNT(*) c FROM "${row.name}"`).get() as { c: number }).c; } catch { continue; }
      if (!n) continue;
      let cols: Map<string, string>;
      try { cols = colsOf(row.name); } catch { continue; }
      const old = OLD.map((k) => cols.get(k)).find(Boolean) ?? null;
      if (old) continue;
      orderedByNothing++;
      if (orderByFor(row.name, cols)) nowOrdered++;
    }
    expect(orderedByNothing, "populated tables the old rule could not order").toBeGreaterThan(70);
    expect(nowOrdered, "…that the model can order").toBeGreaterThan(60);
  }, 120_000);
});
