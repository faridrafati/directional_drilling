/**
 * A multi-well report's rows, in an order a reader can follow.
 *
 * There was no ORDER BY anywhere in the multi-well path, so rows arrived in
 * whatever order the scan produced. The audit describes the symptom as wells
 * interleaving, which happens — but the larger, unmentioned half is inside each
 * well: measured over the sample, most tables came back in an order that
 * matches neither the folder the rows live in nor anything else.
 *
 * The fix is TWO keys and the well has to come first. `orderByFor` is the app's
 * one ordering rule and applies directly, but alone it would make this worse:
 * most tables resolve to a date, and a date across forty-two wells interleaves
 * them — the very complaint being fixed.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { orderByFor } from "./model.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const SAMPLE = join(HERE, "..", "..", "..", "..", "sqlite_DB", "wellview", "wv9.0_Sample.sqlite");
const d = describe.skipIf(!existsSync(SAMPLE));

let db: DatabaseSync;
beforeAll(() => { db = new DatabaseSync(SAMPLE, { readOnly: true }); });
afterAll(() => { db?.close(); });

const colsOf = (t: string) => new Map(
  (db.prepare(`SELECT * FROM "${t}" LIMIT 1`) as unknown as { columns(): { name: string }[] })
    .columns().map((c) => [c.name.toLowerCase(), c.name] as [string, string]));

d("multi-well rows are ordered", () => {
  it("groups by well before ordering within it", () => {
    /*
     * The decisive property. Take a table whose own rule is a DATE, span
     * several wells, and check that the wells come out in blocks rather than
     * interleaved — which is what ordering by the date alone would produce.
     */
    const table = "wvJobReport";
    const cols = colsOf(table);
    const within = orderByFor(table, cols, "t0");
    expect(within, "the folder's own rule").toBeTruthy();
    expect(within!.toLowerCase(), "…and it is a date, which is the trap").toContain("dttm");

    const wells = (db.prepare(`SELECT DISTINCT idwell FROM "${table}" LIMIT 6`).all() as
      { idwell: string }[]).map((w) => w.idwell);
    expect(wells.length).toBeGreaterThan(3);
    const holes = wells.map(() => "?").join(", ");

    const run = (orderBy: string) => (db.prepare(
      `SELECT w."WellName" AS wn FROM "${table}" t0
         LEFT JOIN wvWellHeader w ON w.idwell = t0.idwell
        WHERE t0.idwell IN (${holes}) ${orderBy} LIMIT 400`).all(...wells) as { wn: string }[])
      .map((r) => r.wn);

    /** How many times the well changes as you read down the list. */
    const runs = (names: string[]) =>
      names.reduce((n, v, i) => (i && v !== names[i - 1] ? n + 1 : n), 1);

    const dateOnly = run(`ORDER BY ${within}`);
    const wellThenDate = run(`ORDER BY w."WellName", ${within}`);
    const stored = run("");

    // One block per well is the floor; the date-only ordering shreds them.
    expect(runs(wellThenDate), "one block per well").toBe(new Set(wellThenDate).size);
    expect(runs(dateOnly), "ordering by the date alone interleaves the wells")
      .toBeGreaterThan(runs(wellThenDate));
    expect(runs(stored), "storage order is not grouped either")
      .toBeGreaterThan(runs(wellThenDate));
  });

  it("orders within a well the way the folder does", () => {
    // 30 of the sample's 36 multi-well tables came back in an order that
    // differs from the folder's, most with every row displaced. This pins the
    // property rather than the count: within one well, the rows follow
    // orderByFor exactly.
    const table = "wvJobReport";
    const cols = colsOf(table);
    const within = orderByFor(table, cols, "t0")!;
    const w = db.prepare(`SELECT idwell, COUNT(*) n FROM "${table}"
      GROUP BY idwell ORDER BY n DESC LIMIT 1`).get() as { idwell: string; n: number };
    expect(w.n).toBeGreaterThan(5);

    const got = (db.prepare(
      `SELECT t0."DtTmStart" AS v FROM "${table}" t0
         LEFT JOIN wvWellHeader w ON w.idwell = t0.idwell
        WHERE t0.idwell = ? ORDER BY w."WellName", ${within}`).all(w.idwell) as { v: string }[])
      .map((r) => r.v);
    const want = (db.prepare(
      `SELECT "DtTmStart" AS v FROM "${table}" WHERE idwell = ? ORDER BY "DtTmStart"`)
      .all(w.idwell) as { v: string }[]).map((r) => r.v);
    expect(got).toEqual(want);
  });

  it("still orders a table whose folder rule is a stored sequence", () => {
    // A sequenced folder is arranged by hand, and that arrangement is the
    // point — the well key must not displace it.
    const cols = colsOf("wvJobReportTimeLog");
    expect(orderByFor("wvJobReportTimeLog", cols, "t0")).toBe('t0."sysSeq"');
  });

  it("says nothing when the table gives no basis for an order", () => {
    expect(orderByFor("wvJobReport", new Map(), "t0")).toBeNull();
  });
});
