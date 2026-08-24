/**
 * The clock times of a daily Time Log.
 *
 * The entries carry a duration and nothing else; WellView derives the start and
 * end when a report prints, from the report's own start plus the durations
 * before each entry. Eight shipped daily templates print a duration column with
 * no clock beside it.
 *
 * THE HARD QUESTION was whether this is a reconstruction or a fabrication, and
 * the database answers it without being asked: wvJobIntervalProblem carries
 * REAL timestamps that nothing here derives, and they land on the boundaries
 * this computation produces far more often than chance allows. That test is
 * below, with its null model.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { timeLogClock, timeLogReconciles } from "./timeLogClock.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const SAMPLE = join(HERE, "..", "..", "..", "..", "sqlite_DB", "wellview", "wv9.0_Sample.sqlite");
const d = describe.skipIf(!existsSync(SAMPLE));

let db: DatabaseSync;
beforeAll(() => { db = new DatabaseSync(SAMPLE, { readOnly: true }); });
afterAll(() => { db?.close(); });

const reports = () => db.prepare(
  "SELECT DISTINCT t.IDRecParent p, t.idwell FROM wvJobReportTimeLog t").all() as
  { p: string; idwell: string }[];

d("a time log's clock", () => {
  it("walks the durations from the report's own start", () => {
    const r = db.prepare(`SELECT t.IDRecParent p, t.idwell FROM wvJobReportTimeLog t
      GROUP BY t.IDRecParent HAVING COUNT(*) BETWEEN 4 AND 12 LIMIT 1`)
      .get() as { p: string; idwell: string };
    const rep = db.prepare("SELECT DtTmStart s FROM wvJobReport WHERE IDRec = ?")
      .get(r.p) as { s: string };
    const rows = db.prepare(`SELECT IDRec, Duration FROM wvJobReportTimeLog
      WHERE IDRecParent = ? ORDER BY sysSeq, IDRec`).all(r.p) as { IDRec: string; Duration: number }[];

    const got = timeLogClock(db, r.idwell, r.p);
    expect(got.size).toBe(rows.length);

    // The first entry starts when the report does.
    expect(got.get(rows[0].IDRec)!.dttmstartcalc).toBe(rep.s);

    // Each entry starts where the one before it ended — that is what "cum of
    // duration from the previous record" means, and it is what makes the column
    // a log rather than a list.
    for (let i = 1; i < rows.length; i++) {
      const prev = got.get(rows[i - 1].IDRec)!;
      const here = got.get(rows[i].IDRec)!;
      expect(here.dttmstartcalc, `row ${i}`).toBe(prev.dttmendcalc);
    }

    // …and the running total is the durations, in days, as stored.
    let acc = 0;
    for (const row of rows) {
      acc += row.Duration;
      expect(got.get(row.IDRec)!.sumofdurationcalc).toBeCloseTo(acc, 9);
    }
  });

  it("agrees with timestamps nothing here derives", () => {
    /*
     * THE VALIDATION THAT MATTERS. wvJobIntervalProblem records real start
     * times, entered by people, which this computation never sees — they hang
     * off the JOB, not the report, so nothing links them to a time log. If the
     * clock is right, they should fall on its boundaries anyway.
     */
    const problems = db.prepare(`SELECT p.DtTmStart s, p.idwell,
        (SELECT r.IDRec FROM wvJobReport r
          WHERE r.idwell = p.idwell AND p.DtTmStart >= r.DtTmStart AND p.DtTmStart <= r.DtTmEnd
          LIMIT 1) rep
      FROM wvJobIntervalProblem p
      WHERE p.DtTmStart IS NOT NULL AND p.DtTmStart <> ''`)
      .all() as { s: string; idwell: string; rep: string | null }[];
    const usable = problems.filter((p) => p.rep);
    expect(usable.length, "problems that fall inside a report period").toBeGreaterThan(30);

    const near = (t: number, bs: number[]) => bs.some((b) => Math.abs(b - t) <= 60_000);
    const boundariesOf = (idwell: string, rep: string) => {
      const bs: number[] = [];
      for (const [, v] of timeLogClock(db, idwell, rep)) {
        if (v.dttmstartcalc) bs.push(Date.parse(v.dttmstartcalc));
        if (v.dttmendcalc) bs.push(Date.parse(v.dttmendcalc));
      }
      return bs;
    };

    let hits = 0, tried = 0;
    for (const p of usable) {
      const bs = boundariesOf(p.idwell, p.rep!);
      if (!bs.length) continue;
      tried++;
      if (near(Date.parse(p.s), bs)) hits++;
    }
    expect(tried, "problems on a report this can clock").toBeGreaterThan(20);

    /*
     * The null model, because a high hit rate proves nothing on its own: if the
     * boundaries were dense enough, everything would land on one. Reverse each
     * report's durations — the same values, the same anchor, a different order
     * — and the agreement has to collapse. The ORDER is the claim being tested.
     */
    let shuffledHits = 0, shuffledTried = 0;
    for (const p of usable) {
      const rows = db.prepare(`SELECT Duration FROM wvJobReportTimeLog
        WHERE IDRecParent = ? ORDER BY sysSeq, IDRec`).all(p.rep) as { Duration: number | null }[];
      if (rows.length < 3) continue;
      const rep = db.prepare("SELECT DtTmStart s FROM wvJobReport WHERE IDRec = ?")
        .get(p.rep) as { s: string } | undefined;
      if (!rep?.s) continue;
      shuffledTried++;
      const anchor = Date.parse(rep.s);
      const bs: number[] = [];
      let acc = 0;
      for (const row of [...rows].reverse()) {
        bs.push(Math.round((anchor + acc * 86_400_000) / 60_000) * 60_000);
        acc += row.Duration ?? 0;
        bs.push(Math.round((anchor + acc * 86_400_000) / 60_000) * 60_000);
      }
      if (near(Date.parse(p.s), bs)) shuffledHits++;
    }

    // The real order does substantially better than a rearrangement of the very
    // same durations against the very same anchor.
    expect(hits / tried, "agreement with real timestamps").toBeGreaterThan(0.7);
    expect(hits, `${hits} real vs ${shuffledHits} reversed of ${shuffledTried}`)
      .toBeGreaterThan(shuffledHits);
  }, 120_000);

  it("rounds to the minute, because the stored durations do not", () => {
    // Duration is a 32-bit float: fifteen minutes is 0.0104166670 on one row
    // and 0.0104166698 on the next. Accumulated, that drifts by milliseconds,
    // and 3,509 of 4,054 raw boundaries land off a whole minute. Truncated to a
    // second-precision stamp they print one minute low, on a plausible
    // quarter-hour grid, on reports that still reconcile.
    let checked = 0;
    for (const r of reports().slice(0, 60)) {
      for (const [, v] of timeLogClock(db, r.idwell, r.p)) {
        for (const s of [v.dttmstartcalc, v.dttmendcalc]) {
          if (!s) continue;
          expect(s, "a whole minute").toMatch(/:00Z$/);
          expect(Date.parse(s) % 60_000).toBe(0);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(200);
  }, 120_000);

  it("stops at a blank duration instead of skipping it", () => {
    // SQL's SUM would ignore the null and carry on, which is worse than
    // stopping: every later entry would be early by the missing amount and
    // would still look like a time.
    const gap = db.prepare(`SELECT t.IDRecParent p, t.idwell,
        MIN(CASE WHEN t.Duration IS NULL THEN t.sysSeq END) firstNull,
        COUNT(*) n
      FROM wvJobReportTimeLog t GROUP BY t.IDRecParent
      HAVING firstNull IS NOT NULL AND n > firstNull + 1 LIMIT 1`)
      .get() as { p: string; idwell: string; firstNull: number; n: number } | undefined;
    expect(gap, "a report with a blank duration and entries after it").toBeTruthy();

    const rows = db.prepare(`SELECT IDRec, sysSeq, Duration FROM wvJobReportTimeLog
      WHERE IDRecParent = ? ORDER BY sysSeq, IDRec`).all(gap!.p) as
      { IDRec: string; sysSeq: number; Duration: number | null }[];
    const got = timeLogClock(db, gap!.idwell, gap!.p);
    const firstNullIdx = rows.findIndex((r) => r.Duration == null);
    expect(firstNullIdx).toBeGreaterThanOrEqual(0);

    // Everything before the gap is clocked…
    for (let i = 0; i < firstNullIdx; i++) {
      expect(got.has(rows[i].IDRec), `row ${i} before the gap`).toBe(true);
    }
    // …and nothing from the gap onward is.
    for (let i = firstNullIdx; i < rows.length; i++) {
      expect(got.has(rows[i].IDRec), `row ${i} at or after the gap`).toBe(false);
    }
  });

  it("refuses a report whose entries have no order", () => {
    // One report has three entries all at sysSeq 0. There is no first among
    // them, so there is no clock; breaking the tie by row order would invent
    // one and every time on the page would rest on it.
    const tied = db.prepare(`SELECT t.IDRecParent p, t.idwell FROM wvJobReportTimeLog t
      GROUP BY t.IDRecParent, t.sysSeq HAVING COUNT(*) > 1 LIMIT 1`)
      .get() as { p: string; idwell: string } | undefined;
    expect(tied, "the sample has one such report").toBeTruthy();
    expect(timeLogClock(db, tied!.idwell, tied!.p).size).toBe(0);
  });

  it("will not put an entry outside the report it belongs to", () => {
    // Three entries carry durations of 365 and 584 DAYS inside 24-hour reports.
    // Left alone they would date later entries hundreds of days out.
    let clocked = 0, outside = 0;
    for (const r of reports()) {
      const rep = db.prepare("SELECT DtTmStart s, DtTmEnd e FROM wvJobReport WHERE IDRec = ?")
        .get(r.p) as { s: string; e: string | null };
      if (!rep?.s || !rep.e) continue;
      const a = Date.parse(rep.s), b = Date.parse(rep.e);
      for (const [, v] of timeLogClock(db, r.idwell, r.p)) {
        if (!v.dttmstartcalc) continue;
        clocked++;
        const t = Date.parse(v.dttmstartcalc);
        if (t < a - 60_000 || t > b + 60_000) outside++;
      }
    }
    expect(clocked).toBeGreaterThan(5000);
    expect(outside, "entries dated outside their own report").toBe(0);
  }, 180_000);

  it("says whether a report's entries account for its period", () => {
    let ok = 0, total = 0;
    for (const r of reports()) {
      total++;
      if (timeLogReconciles(db, r.idwell, r.p)) ok++;
    }
    expect(total).toBe(736);
    // Not a gate — a log that does not add up is still the log that was kept —
    // but it is the honest measure of how far this can be trusted.
    expect(ok).toBe(621);
  }, 180_000);

  it("includes inactive entries, because this field's help excludes nothing", () => {
    // wvJobReport.DurationTimeLogTotalCalc says to exclude them and daysVsDepth
    // does. SumOfDurationCalc's help says no such thing, and mixing the rules
    // would move every clock after an inactive entry.
    const withInactive = db.prepare(`SELECT t.IDRecParent p, t.idwell FROM wvJobReportTimeLog t
      WHERE COALESCE(t.Inactive,0) = 1
        AND NOT EXISTS (SELECT 1 FROM wvJobReportTimeLog x
                        WHERE x.IDRecParent = t.IDRecParent AND x.Duration IS NULL)
      LIMIT 1`).get() as { p: string; idwell: string } | undefined;
    if (!withInactive) return;                 // nothing to prove on this data

    const all = db.prepare("SELECT SUM(Duration) d FROM wvJobReportTimeLog WHERE IDRecParent = ?")
      .get(withInactive.p) as { d: number };
    const got = timeLogClock(db, withInactive.idwell, withInactive.p);
    const last = [...got.values()].pop();
    if (last?.sumofdurationcalc != null) {
      expect(last.sumofdurationcalc, "the total counts the inactive rows too")
        .toBeCloseTo(all.d, 6);
    }
  });
});
