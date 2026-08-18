/**
 * The wv*Calc derivation runner.
 *
 * These pin the REFUSALS rather than the arithmetic. A derivation that runs
 * against the wrong database, or without the scope parameter it needs, would
 * still return rows — plausible ones, aggregated across every well — and that
 * is the failure mode worth a test. Each derivation's own figures are checked
 * in `calcDerivations.test.ts` against totals computed a second way.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { registerCalc, calcDerivation, computeCalc } from "./calc.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..", "..", "..");
const SAMPLE = join(REPO, "sqlite_DB", "wellview", "wv9.0_Sample.sqlite");
const d = describe.skipIf(!existsSync(SAMPLE));

d("calc derivation runner", () => {
  let db: DatabaseSync;
  let idwell: string;

  beforeAll(() => {
    db = new DatabaseSync(SAMPLE, { readOnly: true });
    idwell = (db.prepare(
      "SELECT idwell, COUNT(*) n FROM wvJobReportTimeLog GROUP BY idwell ORDER BY n DESC LIMIT 1",
    ).get() as { idwell: string }).idwell;

    registerCalc(
      {
        table: "wvTestSumCalc",
        sources: ["wvJobReportTimeLog"],
        params: ["idwell"],
        sql: `SELECT Code1 AS Code1, SUM(Duration) AS Duration
                FROM wvJobReportTimeLog WHERE idwell = :idwell GROUP BY Code1`,
      },
      {
        table: "wvTestMissingSourceCalc",
        sources: ["wvNotATableAnywhere"],
        params: ["idwell"],
        sql: "SELECT 1 AS x",
      },
      {
        table: "wvTestNeedsJobCalc",
        sources: ["wvJobReportTimeLog"],
        params: ["idwell", "idjob"],
        sql: "SELECT COUNT(*) AS n FROM wvJobReportTimeLog WHERE idwell = :idwell AND IDRecParent = :idjob",
      },
    );
  });

  it("computes a registered derivation and marks every column computed", () => {
    const r = computeCalc(db, "wvTestSumCalc", { idwell });
    expect(r).not.toBeNull();
    expect(r!.rowCount).toBeGreaterThan(0);
    expect(r!.columns.map((c) => c.column)).toEqual(["Code1", "Duration"]);
    // Nothing this app computes may look stored.
    expect(r!.columns.every((c) => c.computed === true)).toBe(true);
  });

  it("returns null for a table with no derivation, so the block stays honest", () => {
    expect(calcDerivation("wvJDSDPHydCalc")).toBeUndefined();
    expect(computeCalc(db, "wvJDSDPHydCalc", { idwell })).toBeNull();
    expect(computeCalc(db, "wvNoSuchCalc", { idwell })).toBeNull();
  });

  it("SKIPS when a source table is absent from this database", () => {
    // The two sample databases do not carry the same tables; a derivation that
    // cannot read its source must fall back, not throw and not return [].
    expect(computeCalc(db, "wvTestMissingSourceCalc", { idwell })).toBeNull();
  });

  it("SKIPS when the anchor lacks a parameter the query needs", () => {
    // Without this, the bind would be short and SQLite would substitute NULL —
    // returning a summary of nothing while looking like a summary of something.
    expect(computeCalc(db, "wvTestNeedsJobCalc", { idwell })).toBeNull();
    expect(computeCalc(db, "wvTestNeedsJobCalc", { idwell, idjob: "" })).toBeNull();
  });

  it("scopes to the well it was asked for, not the whole database", () => {
    const mine = computeCalc(db, "wvTestSumCalc", { idwell })!;
    const total = (db.prepare("SELECT SUM(Duration) d FROM wvJobReportTimeLog").get() as { d: number }).d;
    const summed = mine.rows.reduce((a, r) => a + Number(r.Duration ?? 0), 0);
    expect(summed).toBeGreaterThan(0);
    // The whole database holds more than this one well — if these matched, the
    // idwell predicate was not doing anything.
    expect(summed).toBeLessThan(total);
  });
});
