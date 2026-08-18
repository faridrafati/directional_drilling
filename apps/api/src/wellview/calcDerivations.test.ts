/**
 * The registered wv*Calc derivations, against figures computed a second way.
 *
 * These are the numbers a user reads off a report and acts on, and nobody
 * re-derives a displayed total by hand. So each check here recomputes the
 * aggregate WITHOUT the derivation's SQL — plain accumulation over the raw
 * rows — and compares. A test that merely re-ran the same query would confirm
 * nothing at all.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { computeCalc, calcDerivation, derivableCalcTables } from "./calc.js";
import { CALC_DERIVATIONS, UNDERIVED } from "./calcDerivations.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..", "..", "..");
const SAMPLE = join(REPO, "sqlite_DB", "wellview", "wv9.0_Sample.sqlite");
const d = describe.skipIf(!existsSync(SAMPLE));

d("registered calc derivations", () => {
  let db: DatabaseSync;
  let idwell: string, idjob: string, idreport: string;

  beforeAll(() => {
    db = new DatabaseSync(SAMPLE, { readOnly: true });
    // The job with the most time-log rows — the one the figures below refer to.
    const scope = db.prepare(`
      SELECT j.idwell, j.IDRec AS idjob,
             (SELECT r.IDRec FROM wvJobReport r WHERE r.IDRecParent = j.IDRec LIMIT 1) AS idreport,
             (SELECT COUNT(*) FROM wvJobReportTimeLog t
                JOIN wvJobReport r ON r.IDRec = t.IDRecParent
               WHERE r.IDRecParent = j.IDRec) AS n
        FROM wvJob j ORDER BY n DESC LIMIT 1`).get() as
      { idwell: string; idjob: string; idreport: string };
    idwell = scope.idwell; idjob = scope.idjob; idreport = scope.idreport;
  });

  it("registers every derivation and runs all of them", () => {
    expect(CALC_DERIVATIONS.length).toBeGreaterThanOrEqual(22);
    for (const der of CALC_DERIVATIONS) {
      expect(calcDerivation(der.table), der.table).toBeTruthy();
      expect(der.sql.trim(), der.table).not.toBe("");
      expect(der.params.length, der.table).toBeGreaterThan(0);
    }
    expect(derivableCalcTables()).toContain("wvJCostCumCalc");
  });

  it("every registered query executes against a real database", () => {
    const failures: string[] = [];
    for (const der of CALC_DERIVATIONS) {
      const args: Record<string, string> = {};
      for (const p of der.params) {
        args[p] = p === "idjob" ? idjob : p === "idreport" ? idreport : idwell;
      }
      if (der.params.includes("idphase")) continue;   // needs a phase anchor
      try { db.prepare(`${der.sql} LIMIT 5`).all(args); }
      catch (e) { failures.push(`${der.table}: ${(e as Error).message}`); }
    }
    expect(failures).toEqual([]);
  });

  it("time-log duration matches a total accumulated without SQL grouping", () => {
    const r = computeCalc(db, "wvJTLSumCode1Calc", { idwell, idjob })!;
    expect(r).not.toBeNull();
    const viaSql = r.rows.reduce((a, x) => a + Number(x.Duration ?? 0), 0);

    // Independent route: walk the raw rows in JS. No join, no GROUP BY.
    const reports = (db.prepare("SELECT IDRec FROM wvJobReport WHERE IDRecParent = ?")
      .all(idjob) as { IDRec: string }[]).map((x) => x.IDRec);
    const set = new Set(reports);
    const raw = db.prepare("SELECT IDRecParent, Duration, Inactive FROM wvJobReportTimeLog WHERE idwell = ?")
      .all(idwell) as { IDRecParent: string; Duration: number | null; Inactive: number | null }[];
    // The model's help: "Excludes all <wvJobReportTimeLog.Inactive> records."
    const manual = raw
      .filter((x) => set.has(x.IDRecParent) && !(x.Inactive ?? 0))
      .reduce((a, x) => a + Number(x.Duration ?? 0), 0);

    expect(viaSql).toBeCloseTo(manual, 9);
    expect(manual).toBeGreaterThan(0);
    // The fractions of a whole must be a whole.
    const frac = r.rows.reduce((a, x) => a + Number(x.FractionTotalTime ?? 0), 0);
    expect(frac).toBeCloseTo(1, 6);
  });

  it("scopes to the job, not merely the well", () => {
    // This well owns more than one job; a derivation that lost :idjob would
    // return the well's whole time log and look entirely plausible.
    const job = computeCalc(db, "wvJTLSumCode1Calc", { idwell, idjob })!
      .rows.reduce((a, x) => a + Number(x.Duration ?? 0), 0);
    const wellWide = (db.prepare(
      "SELECT SUM(Duration) d FROM wvJobReportTimeLog WHERE idwell = ? AND COALESCE(Inactive,0) = 0",
    ).get(idwell) as { d: number }).d;
    expect(job).toBeLessThan(wellWide);
  });

  it("cost summary: the variance columns are consistent with their own inputs", () => {
    // wvJCostCumCalc has no running-total column — "Cum" means job-to-date per
    // cost code. Its checkable invariant is the model's own arithmetic:
    // CostVar = CostAFETotal - CostFieldEst, and CostAFETotal = AFE + AFESup.
    const r = computeCalc(db, "wvJCostCumCalc", { idwell, idjob });
    expect(r).not.toBeNull();
    expect(r!.rowCount).toBeGreaterThan(0);
    const num = (v: unknown) => Number(v ?? 0);
    let checked = 0;
    for (const row of r!.rows) {
      expect(num(row.CostAFETotal)).toBeCloseTo(num(row.CostAFE) + num(row.CostAFESup), 6);
      expect(num(row.CostVar)).toBeCloseTo(num(row.CostAFETotal) - num(row.CostFieldEst), 6);
      checked++;
    }
    // Guard against the invariant passing because there was nothing to check.
    expect(checked).toBeGreaterThan(0);
  });

  it("cost summary field estimate ties to the raw cost rows", () => {
    const r = computeCalc(db, "wvJCostCumCalc", { idwell, idjob })!;
    const viaSql = r.rows.reduce((a, x) => a + Number(x.CostFieldEst ?? 0), 0);

    // Independent route: the job's daily reports, then a plain sum of their
    // general cost rows. No UNION, no CTE, no GROUP BY.
    const reports = (db.prepare("SELECT IDRec FROM wvJobReport WHERE IDRecParent = ?")
      .all(idjob) as { IDRec: string }[]).map((x) => x.IDRec);
    const set = new Set(reports);
    const gen = (db.prepare("SELECT IDRecParent, Cost FROM wvJobReportCostGen WHERE idwell = ?")
      .all(idwell) as { IDRecParent: string; Cost: number | null }[])
      .filter((x) => set.has(x.IDRecParent))
      .reduce((a, x) => a + Number(x.Cost ?? 0), 0);

    expect(gen).toBeGreaterThan(0);
    // The derivation also folds in rental cost, so it is >= the general-cost
    // sum; it must not be LESS, which would mean rows were dropped.
    expect(viaSql).toBeGreaterThanOrEqual(gen - 1e-6);
  });

  it("marks every produced column computed, so nothing reads as stored", () => {
    for (const t of ["wvJTLSumCode1Calc", "wvJCostCumCalc", "wvJTLSumCalc"]) {
      const r = computeCalc(db, t, { idwell, idjob });
      if (!r?.rowCount) continue;
      expect(r.columns.every((c) => c.computed === true), t).toBe(true);
    }
  });

  it("keeps the undrivable tables unregistered, with a stated reason", () => {
    // These are the ones verification rejected or could not clear. They must
    // stay unregistered so the block keeps reporting honestly.
    for (const u of UNDERIVED) {
      expect(u.reason.length, u.table).toBeGreaterThan(10);
      expect(calcDerivation(u.table), u.table).toBeUndefined();
      expect(computeCalc(db, u.table, { idwell, idjob, idreport }), u.table).toBeNull();
    }
    expect(UNDERIVED.map((u) => u.table)).toContain("wvWDSVSDataCalc");
    expect(UNDERIVED.map((u) => u.table)).toContain("wvWellboreSummaryCalc");
  });
});
