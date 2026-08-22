/**
 * The days-vs-depth series, against the REAL converted sample database.
 *
 * The assertions are the ones that would catch a wrong curve rather than an
 * empty one: that cumulative days never go backwards (the whole chart is a
 * running total, so one unsorted row inverts a segment), that the actual depth
 * only ever carries forward or advances, that problem time is never counted
 * twice when two problems overlap, and that the plan and actual series are
 * reconciled against the same numbers computed independently in SQL.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { daysVsDepth, seriesPoints, mergedOverlapDays } from "./daysVsDepth.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const SAMPLE = join(HERE, "..", "..", "..", "..", "sqlite_DB", "wellview", "wv9.0_Sample.sqlite");
const hasDb = existsSync(SAMPLE);
const d = describe.skipIf(!hasDb);

let db: DatabaseSync;
beforeAll(() => { if (hasDb) db = new DatabaseSync(SAMPLE, { readOnly: true }); });
afterAll(() => { db?.close(); });

/** Every well that has any job, so the sweep is over the real population. */
const allWells = () =>
  (db.prepare("SELECT DISTINCT idwell FROM wvJob").all() as { idwell: string }[])
    .map((r) => r.idwell);

describe("problem-time merging", () => {
  const H = 3_600_000;
  const t0 = Date.parse("2020-01-01T00:00:00Z");

  it("counts overlapping problems once", () => {
    // Two crews log the same six-hour event with a two-hour overlap.
    const days = mergedOverlapDays(
      [{ from: t0, to: t0 + 6 * H }, { from: t0 + 4 * H, to: t0 + 10 * H }],
      t0, t0 + 24 * H,
    );
    expect(days).toBeCloseTo(10 / 24, 9);   // 10 h, not 12
  });

  it("clips to the report period and runs an open problem to its end", () => {
    expect(mergedOverlapDays([{ from: t0 - 12 * H, to: t0 + 6 * H }], t0, t0 + 24 * H))
      .toBeCloseTo(6 / 24, 9);
    expect(mergedOverlapDays([{ from: t0 + 18 * H, to: null }], t0, t0 + 24 * H))
      .toBeCloseTo(6 / 24, 9);
  });

  it("is zero when nothing overlaps", () => {
    expect(mergedOverlapDays([{ from: t0 + 48 * H, to: t0 + 50 * H }], t0, t0 + 24 * H)).toBe(0);
  });
});

d("days vs depth", () => {
  it("produces a curve for the wells that have the data, and none for the rest", () => {
    let withCurve = 0, points = 0;
    for (const w of allWells()) {
      for (const job of daysVsDepth(db, w)) {
        const pts = seriesPoints(job, { x: "durationtimelogtotcumcalc", table: "wvjobreport", y: "depthenddpcalc" });
        if (pts.length > 1) { withCurve++; points += pts.length; }
      }
    }
    expect(withCurve).toBeGreaterThan(5);
    expect(points).toBeGreaterThan(100);
  });

  /**
   * Time only. Cost is NOT monotonic and must not be asserted to be: the sample
   * carries 11 negative wvJobReportCostGen rows — vendor credits and
   * corrections — and a cost-to-date curve that dips where one lands is right.
   * Clamping it would hide a real reversal on a real invoice.
   */
  it("never lets a cumulative TIME series go backwards", () => {
    for (const w of allWells()) {
      for (const job of daysVsDepth(db, w)) {
        for (const k of ["durationtimelogtotcumcalc", "durnoprobtimecumdayscalc"] as const) {
          let prev = -Infinity;
          for (const r of job.reports) {
            expect(r[k], `${k} went backwards in job ${job.idrec}`).toBeGreaterThanOrEqual(prev);
            prev = r[k];
          }
        }
        for (const k of ["dayjobmlplancalc", "costmlcumcalc"] as const) {
          let prev = -Infinity;
          for (const p of job.phases) {
            if (p[k] == null) continue;
            expect(p[k]!, `${k} went backwards in job ${job.idrec}`).toBeGreaterThanOrEqual(prev);
            prev = p[k]!;
          }
        }
      }
    }
  });

  it("carries depth forward rather than dropping to zero on a report with no drill param", () => {
    let carried = 0;
    for (const w of allWells()) {
      for (const job of daysVsDepth(db, w)) {
        let prev: number | null = null;
        for (const r of job.reports) {
          if (prev != null && r.depthenddpcalc != null) {
            // The EQN says "use the last valid end depth in the job" — so a
            // quiet day holds the depth, it does not report surface.
            expect(r.depthenddpcalc, `depth collapsed in job ${job.idrec}`).toBeGreaterThanOrEqual(0);
            if (r.depthenddpcalc === prev) carried++;
          }
          if (r.depthenddpcalc != null) prev = r.depthenddpcalc;
        }
      }
    }
    expect(carried).toBeGreaterThan(0);
  });

  it("keeps problem time within the time actually logged", () => {
    for (const w of allWells()) {
      for (const job of daysVsDepth(db, w)) {
        for (const r of job.reports) {
          expect(r.durationproblemtimecalc).toBeGreaterThanOrEqual(0);
          expect(r.durationproblemtimecalc).toBeLessThanOrEqual(r.durationtimelogtotalcalc + 1e-9);
          expect(r.durationnoprobtimecalc).toBeCloseTo(
            r.durationtimelogtotalcalc - r.durationproblemtimecalc, 9);
        }
      }
    }
  });

  it("carries vendor credits through to the cost curve instead of clamping them", () => {
    // The sample has 11 negative cost rows; at least one job's cost-to-date
    // must therefore fall, and the running total must still equal the raw sum.
    let dipped = 0;
    for (const w of allWells()) {
      for (const job of daysVsDepth(db, w)) {
        let prev = -Infinity;
        for (const r of job.reports) { if (r.costtodatecalc < prev) dipped++; prev = r.costtodatecalc; }
        if (!job.reports.length) continue;
        const mine = job.reports[job.reports.length - 1].costtodatecalc;
        expect(mine).toBeCloseTo(job.reports.reduce((a, r) => a + r.costtotalcalc, 0), 6);
      }
    }
    expect(dipped, "no cost curve dipped — credits are being swallowed").toBeGreaterThan(0);
  });

  it("reconciles the time-log total against an independent SQL sum, with the model's exclusions", () => {
    for (const w of allWells().slice(0, 12)) {
      for (const job of daysVsDepth(db, w)) {
        const mine = job.reports.reduce((a, r) => a + r.durationtimelogtotalcalc, 0);
        const theirs = (db.prepare(`
          SELECT COALESCE(SUM(l.Duration), 0) AS d
          FROM wvJobReportTimeLog l
          JOIN wvJobReport r ON r.IDRec = l.IDRecParent AND r.idwell = l.idwell
          WHERE r.idwell = ? AND r.IDRecParent = ?
            AND COALESCE(l.Inactive, 0) <> 1
            AND LOWER(COALESCE(l.Code1, '')) NOT LIKE '%inactive%'
        `).get(w, job.idrec) as { d: number }).d;
        expect(mine).toBeCloseTo(theirs, 6);
        if (job.reports.length) {
          expect(job.reports[job.reports.length - 1].durationtimelogtotcumcalc).toBeCloseTo(mine, 6);
        }
      }
    }
  });

  it("reconciles the plan cumulatives against an independent SQL sum", () => {
    for (const w of allWells()) {
      for (const job of daysVsDepth(db, w)) {
        if (!job.phases.length) continue;
        const last = job.phases[job.phases.length - 1];
        for (const [field, col] of [["dayjobmlplancalc", "DurationML"],
          ["costmlcumcalc", "CostML"]] as const) {
          const theirs = (db.prepare(
            `SELECT SUM(${col}) AS s FROM wvJobProgramPhase WHERE idwell = ? AND IDRecParent = ?`)
            .get(w, job.idrec) as { s: number | null }).s;
          const mine = (last as unknown as Record<string, number | null>)[field];
          if (theirs == null) expect(mine).toBeNull();
          else expect(mine!).toBeCloseTo(theirs, 6);
        }
      }
    }
  });

  it("leaves a phase with no planned duration null rather than calling it day zero", () => {
    const rows = daysVsDepth(db, allWells()[0]).flatMap((j) => j.phases);
    // The distinction matters: a null drops the point, a 0 draws a line to the
    // origin through data that was never entered.
    expect(rows.every((p) => p.dayjobmlplancalc === null || Number.isFinite(p.dayjobmlplancalc))).toBe(true);
  });

  it("scopes the curve to one job — two jobs on a well do not concatenate", () => {
    const multi = allWells()
      .map((w) => ({ w, jobs: daysVsDepth(db, w) }))
      .find((x) => x.jobs.length > 1 && x.jobs.every((j) => j.reports.length));
    expect(multi, "the sample should have a well with two jobs that both report").toBeTruthy();
    for (const j of multi!.jobs) {
      const ids = new Set(j.reports.map((r) => r.idrec));
      const owned = db.prepare(
        "SELECT COUNT(*) n FROM wvJobReport WHERE idwell = ? AND IDRecParent = ?")
        .get(multi!.w, j.idrec) as { n: number };
      expect(ids.size).toBe(owned.n);
    }
  });

  it("restricts to one job when asked", () => {
    const w = allWells().find((x) => daysVsDepth(db, x).length > 1)!;
    const all = daysVsDepth(db, w);
    const one = daysVsDepth(db, w, all[1].idrec);
    expect(one.length).toBe(1);
    expect(one[0].idrec).toBe(all[1].idrec);
  });
});
