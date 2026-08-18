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
      // Every derivation is EITHER a query or a projection of a computation
      // this app already has — never neither, which would silently return [].
      expect(Boolean(der.sql?.trim()) || Boolean(der.compute), der.table).toBe(true);
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
      try {
        if (der.compute) der.compute(db, { idwell, idjob, idreport });
        else db.prepare(`${der.sql} LIMIT 5`).all(args);
      } catch (e) { failures.push(`${der.table}: ${(e as Error).message}`); }
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
    // What remains is genuinely not an aggregation: drilling hydraulics and the
    // annular velocities that depend on it.
    expect(UNDERIVED.map((u) => u.table)).toEqual(["wvJDSDPHydCalc", "wvJDSDPAVCalc"]);
  });

  it("projects the survey table from the tested engine, not a second one", () => {
    // The rejected SQL for this table dropped inclination-only stations. The
    // projection must keep them, so a well whose survey has NO azimuth at all
    // still plots.
    const der = calcDerivation("wvWDSVSDataCalc")!;
    expect(der.compute, "must be a projection, not SQL").toBeTruthy();
    expect(der.sql).toBeUndefined();

    const incOnly = (db.prepare(`
      SELECT d.idwell, COUNT(*) n FROM wvWellboreDirSurveyData d
       WHERE COALESCE(d.DontUse,0) <> 1 AND d.MD IS NOT NULL
         AND d.Inclination IS NOT NULL AND d.Azimuth IS NULL
       GROUP BY d.idwell ORDER BY n DESC LIMIT 1`).get() as { idwell: string; n: number });
    expect(incOnly.n).toBeGreaterThan(0);

    const r = computeCalc(db, "wvWDSVSDataCalc", { idwell: incOnly.idwell });
    expect(r, "an inclination-only well must still produce rows").not.toBeNull();
    expect(r!.rowCount).toBeGreaterThan(0);
    // TVD must be present on every row — it does not need a bearing.
    expect(r!.rows.every((x) => Number.isFinite(Number(x.TVD)))).toBe(true);
  });

  it("wellbore summary never emits another well's wellbore", () => {
    // The defect that got the SQL version rejected: ten wvJobDrillStringDrillParam
    // rows name a wellbore owned by a DIFFERENT well, and a guard that asked
    // "does the queried well have size rows for this wellbore" let all ten
    // through. Ownership is now resolved via wvWellbore, so they cannot appear.
    const leak = db.prepare(`
      SELECT dp.idwell AS querying, wb.idwell AS owner, COUNT(*) AS n
        FROM wvJobDrillStringDrillParam dp
        JOIN wvWellbore wb ON wb.IDRec = dp.IDRecWellbore
       WHERE wb.idwell <> dp.idwell
       GROUP BY dp.idwell, wb.idwell LIMIT 1`).get() as
      { querying: string; owner: string; n: number } | undefined;
    expect(leak, "the sample database should still contain the foreign-wellbore rows").toBeTruthy();

    const r = computeCalc(db, "wvWellboreSummaryCalc", { idwell: leak!.querying });
    // Whatever it returns, none of it may come from the foreign wellbore's
    // drill params — those rows carry an IDRecJobDrillString.
    const fromParams = (r?.rows ?? []).filter((x) => x.IDRecJobDrillString != null);
    expect(fromParams).toEqual([]);
  });

  it("wellbore summary reproduces its source rows exactly, and does not invent TVD", () => {
    let rows = 0;
    let tvdTop = 0;
    for (const w of db.prepare("SELECT DISTINCT idwell FROM wvWellbore").all() as { idwell: string }[]) {
      const r = computeCalc(db, "wvWellboreSummaryCalc", { idwell: w.idwell });
      rows += r?.rowCount ?? 0;
      tvdTop += (r?.rows ?? []).filter((x) => x.DepthTVDTopActual != null).length;
    }
    const src = (db.prepare("SELECT COUNT(*) n FROM wvWellboreSize").get() as { n: number }).n;
    expect(rows).toBe(src);
    // Sections outside the surveyed interval keep a null TVD rather than a
    // fabricated one, so this must be strictly fewer than the row count.
    expect(tvdTop).toBeGreaterThan(0);
    expect(tvdTop).toBeLessThan(rows);
  });

  it("allocates a phase cost WHOLE, never apportioned across two phases", () => {
    // The first derivation split a cost pro-rata by how much of the daily
    // report's window overlapped each phase. Nothing in the model or the guide
    // describes that, and 11.4% of all cost sits in reports that straddle a
    // boundary. The rule is: explicit IDRecPhaseCustom wins, else the phase the
    // report STARTS in, whole.
    for (const t of ["wvJPPCostCalc", "wvJPPVendorCalc"]) {
      const sql = calcDerivation(t)!.sql!;
      expect(sql, `${t} must not apportion`).not.toMatch(/jdRE\s*-\s*r\.jdRS/);
      expect(sql, `${t} must not apportion`).not.toMatch(/MIN\s*\(\s*r\.jdRE/);
    }

    // It is only safe because nothing overlaps: prove that here rather than
    // trusting it, since an overlapping phase would silently double-count.
    const jd = (c: string) => `julianday(replace(replace(${c},'T',' '),'Z',''))`;
    const overlaps = (db.prepare(`
      SELECT COUNT(*) n FROM wvJobProgramPhase a JOIN wvJobProgramPhase b
        ON a.IDRecParent = b.IDRecParent AND a.IDRec <> b.IDRec
       WHERE a.DtTmStartActual IS NOT NULL AND a.DtTmEndActual IS NOT NULL
         AND b.DtTmStartActual IS NOT NULL AND b.DtTmEndActual IS NOT NULL
         AND ${jd("a.DtTmStartActual")} < ${jd("b.DtTmEndActual")}
         AND ${jd("a.DtTmEndActual")}   > ${jd("b.DtTmStartActual")}`).get() as { n: number }).n;
    expect(overlaps).toBe(0);
  });

  it("phase cost reconciles to a total accumulated without SQL", () => {
    const num = (v: unknown) => (v == null || v === "" ? 0 : Number(v) || 0);
    const jdOf = (s: string | null) => (s ? Date.parse(s) / 86_400_000 : null);

    let viaDerivation = 0;
    for (const w of db.prepare("SELECT DISTINCT idwell FROM wvJobProgramPhase").all() as { idwell: string }[]) {
      const r = computeCalc(db, "wvJPPCostCalc", { idwell: w.idwell });
      for (const x of r?.rows ?? []) viaDerivation += num(x.CostFieldEstPhase);
    }

    // Independent: map each report to its phase in JS, then sum the raw rows.
    const phases = (db.prepare("SELECT IDRec, IDRecParent, DtTmStartActual, DtTmEndActual FROM wvJobProgramPhase").all() as
      { IDRec: string; IDRecParent: string; DtTmStartActual: string | null; DtTmEndActual: string | null }[])
      .filter((p) => p.DtTmStartActual && p.DtTmEndActual);
    const phaseIds = new Set(phases.map((p) => p.IDRec));
    const phaseOf = new Map<string, string>();
    for (const r of db.prepare("SELECT IDRec, IDRecParent, DtTmStart FROM wvJobReport").all() as
      { IDRec: string; IDRecParent: string; DtTmStart: string | null }[]) {
      const rs = jdOf(r.DtTmStart); if (rs == null) continue;
      const p = phases.find((p) => p.IDRecParent === r.IDRecParent
        && rs >= jdOf(p.DtTmStartActual)! && rs < jdOf(p.DtTmEndActual)!);
      if (p) phaseOf.set(r.IDRec, p.IDRec);
    }
    let manual = 0;
    for (const g of db.prepare("SELECT IDRecParent, Cost, IDRecPhaseCustom FROM wvJobReportCostGen").all() as
      { IDRecParent: string; Cost: number | null; IDRecPhaseCustom: string | null }[]) {
      const explicit = g.IDRecPhaseCustom && phaseIds.has(g.IDRecPhaseCustom);
      if (explicit || phaseOf.has(g.IDRecParent)) manual += num(g.Cost);
    }
    const items = new Map((db.prepare("SELECT IDRec, RateDay, RateStandby, RateDepth, RateHour, RateOther FROM wvJobRentalItem").all() as
      Record<string, unknown>[]).map((i) => [String(i.IDRec), i]));
    for (const c of db.prepare(`SELECT IDRecParent, IDRecJobRentalItem, IDRecPhaseCustom, UseDay, UseStandby,
                                       UseDepth, UseHour, UseOther, CostOneTime, Qty
                                  FROM wvJobReportCostRental`).all() as Record<string, unknown>[]) {
      const i = items.get(String(c.IDRecJobRentalItem)); if (!i) continue;
      const explicit = c.IDRecPhaseCustom && phaseIds.has(String(c.IDRecPhaseCustom));
      if (!explicit && !phaseOf.has(String(c.IDRecParent))) continue;
      manual += ((c.UseDay === 1 ? num(i.RateDay) : 0) + (c.UseStandby === 1 ? num(i.RateStandby) : 0)
        + num(i.RateDepth) * num(c.UseDepth) + num(i.RateHour) * num(c.UseHour)
        + num(i.RateOther) * num(c.UseOther) + num(c.CostOneTime)) * (c.Qty == null ? 1 : num(c.Qty));
    }

    expect(manual).toBeGreaterThan(0);
    expect(viaDerivation).toBeCloseTo(manual, 2);
  });
});
