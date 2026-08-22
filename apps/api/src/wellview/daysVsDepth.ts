/**
 * The Days vs Depth / Cost chart — the drilling curve WellView draws with
 * Peloton.DaysVsDepth.dll, and the three .dvdc templates it ships.
 *
 * Every series the templates name is a CALCULATED field, so none of this is
 * stored: it is computed here from the base tables, following the EQN the data
 * model states for each field. Those EQNs are quoted at the function that
 * implements them, because they are the specification and they are specific —
 * "exclude any time log entries that have the word 'inactive' in Code1" is not
 * a detail anyone would guess.
 *
 * The chart is per JOB, not per well: phases and daily reports both hang off
 * wvJob, and day 0 is the start of the job. A well with three jobs has three
 * curves and they do not concatenate.
 *
 * Two things are deliberately NOT invented. There is no actual-depth field on
 * a phase (the model's DepthEndActualCalc exists but the templates do not use
 * it), so the plan line is plan depth and is labelled as such. And where a
 * report has no drill parameter at all, the depth carries forward from the
 * previous report exactly as the EQN says — it does not interpolate.
 */
import type { DatabaseSync } from "node:sqlite";

/** One point on one series. */
export interface DvdPoint {
  x: number;
  y: number;
  /** What the point is: a phase name or a report date, for the tooltip. */
  label?: string;
}

/** A phase row with the cumulative fields the plan series read. */
export interface DvdPhaseRow {
  idrec: string;
  seq: number;
  name: string | null;
  depthendplan: number | null;
  dayjobmlplancalc: number | null;
  dayjobminplancalc: number | null;
  dayjobmaxplancalc: number | null;
  costmlcumcalc: number | null;
  costmincumcalc: number | null;
  costmaxcumcalc: number | null;
}

/** A daily-report row with the cumulative fields the actual series read. */
export interface DvdReportRow {
  idrec: string;
  date: string | null;
  depthenddpcalc: number | null;
  durationtimelogtotalcalc: number;
  durationtimelogtotcumcalc: number;
  durationproblemtimecalc: number;
  durationnoprobtimecalc: number;
  durnoprobtimecumdayscalc: number;
  costtotalcalc: number;
  costtodatecalc: number;
}

export interface DvdJob {
  idrec: string;
  label: string;
  phases: DvdPhaseRow[];
  reports: DvdReportRow[];
}

/** Sum that stays null until something real is added, so an absent plan is not 0. */
function cum(): (v: unknown) => number | null {
  let total: number | null = null;
  return (v) => {
    const n = Number(v);
    if (v != null && Number.isFinite(n)) total = (total ?? 0) + n;
    return total;
  };
}

const num = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Milliseconds in a day — the model's duration unit is `days`. */
const DAY_MS = 86_400_000;
const ms = (v: unknown): number | null => {
  if (!v) return null;
  const t = Date.parse(String(v));
  return Number.isFinite(t) ? t : null;
};

/**
 * The plan curve: cumulative planned duration against planned end depth.
 *
 *   DayJobMLPlanCalc  — "EQN: Cum of <wvjobprogramphase.durationml>."
 *   DayJobMinPlanCalc — ... durationmin.   DayJobMaxPlanCalc — ... durationmax.
 *   CostMLCumCalc     — "EQN: Cum of <wvjobprogramphase.costml>."  (min/max alike)
 *
 * Accumulated in sysSeq order, which is the order the phases are planned to
 * happen in; WellView sequences this table (`sequenced="True"`) and the row
 * order is therefore data, not presentation.
 */
function phaseRows(db: DatabaseSync, idwell: string, idjob: string): DvdPhaseRow[] {
  const rows = db.prepare(`
    SELECT IDRec, sysSeq, PlanPhase, Code1, DepthEndPlan,
           DurationML, DurationMin, DurationMax, CostML, CostMin, CostMax
    FROM wvJobProgramPhase
    WHERE idwell = ? AND IDRecParent = ?
    ORDER BY COALESCE(sysSeq, 999999), IDRec
  `).all(idwell, idjob) as Record<string, unknown>[];

  const dML = cum(), dMin = cum(), dMax = cum();
  const cML = cum(), cMin = cum(), cMax = cum();
  return rows.map((r, i) => ({
    idrec: String(r.IDRec),
    seq: num(r.sysSeq) ?? i + 1,
    name: (r.PlanPhase as string) ?? (r.Code1 as string) ?? null,
    depthendplan: num(r.DepthEndPlan),
    dayjobmlplancalc: dML(r.DurationML),
    dayjobminplancalc: dMin(r.DurationMin),
    dayjobmaxplancalc: dMax(r.DurationMax),
    costmlcumcalc: cML(r.CostML),
    costmincumcalc: cMin(r.CostMin),
    costmaxcumcalc: cMax(r.CostMax),
  }));
}

/**
 * The actual curve, one point per daily operations report.
 *
 * DepthEndDPCalc — "Depth from the last drill param that ends before the end of
 *   the report period. EQN: <depthstart> or <depthend>. If there is no valid
 *   drill param for the day, then use the last valid end depth in the job. The
 *   calculation excludes drilling parameters that have ExcludeFromNewHole
 *   flagged."
 *
 * DurationTimeLogTotalCalc — "Cum of <wvjobreporttimelog.duration> for this
 *   report period. Exclude any time log entries that have the word 'inactive'
 *   in <wvjobreporttimelog.code1>." The `Inactive` flag column carries the same
 *   meaning ("exclude from duration calculations") and is honoured too.
 *
 * DurationProblemTimeCalc — the model defines this per time-log entry, from
 *   <wvjobintervalproblem>, "if there are multiple overlapping problems, only
 *   count the hours once", and an open-ended problem "lasts to the end of the
 *   reporting period". The time log has no timestamps of its own — its
 *   DtTmStartCalc is itself derived by cumulating durations through the report
 *   — and the entries tile the report period, so the report-level total is the
 *   same quantity computed once: merge the problem intervals, clip them to the
 *   report period, and sum. Computing it at the report level is what the chart
 *   needs and avoids inventing per-entry boundaries the data does not carry.
 *
 * CostTotalCalc — "Sum of <wvjobreportcostgen.cost> +
 *   <wvjobreportcostrental.costrentalcalc> for this report period", the rental
 *   term expanded from its own EQN exactly as wvJVendorCalc already does.
 */
function reportRows(db: DatabaseSync, idwell: string, idjob: string): DvdReportRow[] {
  const reports = db.prepare(`
    SELECT IDRec, DtTmStart, DtTmEnd
    FROM wvJobReport
    WHERE idwell = ? AND IDRecParent = ?
    ORDER BY COALESCE(DtTmStart, DtTmEnd), IDRec
  `).all(idwell, idjob) as Record<string, unknown>[];
  if (!reports.length) return [];

  // Drill params for the job, oldest first, minus the ones flagged out of the
  // new-hole calculation. Read once: the per-report lookup is a walk, not a
  // query per report.
  const params = db.prepare(`
    SELECT p.DtTmStart, p.DtTmEnd, p.DepthStart, p.DepthEnd
    FROM wvJobDrillStringDrillParam p
    JOIN wvJobDrillString s ON s.IDRec = p.IDRecParent AND s.idwell = p.idwell
    WHERE p.idwell = ? AND s.IDRecParent = ?
      AND COALESCE(p.ExcludeFromNewHole, 0) <> 1
    ORDER BY COALESCE(p.DtTmEnd, p.DtTmStart), p.IDRec
  `).all(idwell, idjob) as Record<string, unknown>[];
  const paramPts = params
    .map((p) => ({
      at: ms(p.DtTmEnd) ?? ms(p.DtTmStart),
      // "<depthstart> or <depthend>" — the end depth is the one that carries the
      // progress; fall back to the start when a param has no end.
      depth: num(p.DepthEnd) ?? num(p.DepthStart),
    }))
    .filter((p) => p.at != null && p.depth != null) as { at: number; depth: number }[];

  // Per-report time-log totals, with the model's two exclusions applied.
  const logs = db.prepare(`
    SELECT IDRecParent AS idrpt, SUM(COALESCE(Duration, 0)) AS dur
    FROM wvJobReportTimeLog
    WHERE idwell = ?
      AND COALESCE(Inactive, 0) <> 1
      AND LOWER(COALESCE(Code1, '')) NOT LIKE '%inactive%'
    GROUP BY IDRecParent
  `).all(idwell) as Record<string, unknown>[];
  const logBy = new Map(logs.map((l) => [String(l.idrpt), num(l.dur) ?? 0]));

  // Per-report cost, both branches, the rental one expanded from its EQN.
  const costs = db.prepare(`
    SELECT idrpt, SUM(cost) AS cost FROM (
      SELECT g.IDRecParent AS idrpt, COALESCE(g.Cost, 0) AS cost
      FROM wvJobReportCostGen g WHERE g.idwell = ?
      UNION ALL
      SELECT cr.IDRecParent AS idrpt,
             ( COALESCE(CASE WHEN cr.UseDay     = 1 THEN ri.RateDay     END, 0)
             + COALESCE(CASE WHEN cr.UseStandby = 1 THEN ri.RateStandby END, 0)
             + COALESCE(ri.RateDepth * cr.UseDepth, 0)
             + COALESCE(ri.RateHour  * cr.UseHour , 0)
             + COALESCE(ri.RateOther * cr.UseOther, 0)
             + COALESCE(cr.CostOneTime, 0)
             ) * COALESCE(cr.Qty, 1) AS cost
      FROM wvJobReportCostRental cr
      LEFT JOIN wvJobRentalItem ri ON ri.IDRec = cr.IDRecJobRentalItem AND ri.idwell = cr.idwell
      WHERE cr.idwell = ?
    ) GROUP BY idrpt
  `).all(idwell, idwell) as Record<string, unknown>[];
  const costBy = new Map(costs.map((c) => [String(c.idrpt), num(c.cost) ?? 0]));

  // Problem intervals for the job. ExcludeFromProblemTime is the model's own
  // opt-out and must be honoured, or a problem deliberately marked as not
  // counting still eats into the no-problem curve.
  const problems = (db.prepare(`
    SELECT p.DtTmStart, p.DtTmEnd
    FROM wvJobIntervalProblem p
    WHERE p.idwell = ? AND p.IDRecParent = ?
      AND COALESCE(p.ExcludeFromProblemTime, 0) <> 1
      AND p.DtTmStart IS NOT NULL
  `).all(idwell, idjob) as Record<string, unknown>[])
    .map((p) => ({ from: ms(p.DtTmStart)!, to: ms(p.DtTmEnd) }))
    .filter((p) => Number.isFinite(p.from));

  const totCum = cum(), noProbCum = cum(), costCum = cum();
  let lastDepth: number | null = null;
  const out: DvdReportRow[] = [];

  for (let i = 0; i < reports.length; i++) {
    const r = reports[i];
    const id = String(r.IDRec);
    const start = ms(r.DtTmStart);
    // A report with no explicit end runs to the next report's start, or a day.
    const end = ms(r.DtTmEnd)
      ?? ms(reports[i + 1]?.DtTmStart)
      ?? (start != null ? start + DAY_MS : null);

    // Depth: the last drill param ending before the end of the report period,
    // else the last valid end depth in the job.
    if (end != null) {
      for (const p of paramPts) {
        if (p.at <= end) lastDepth = p.depth; else break;
      }
    }

    const total = logBy.get(id) ?? 0;
    const problem = end != null && start != null
      ? mergedOverlapDays(problems, start, end)
      : 0;
    // Problem time cannot exceed the time actually logged for the day; the
    // intervals are wall-clock and the log excludes inactive entries.
    const prob = Math.min(problem, total);
    const cost = costBy.get(id) ?? 0;

    out.push({
      idrec: id,
      date: (r.DtTmStart as string) ?? null,
      depthenddpcalc: lastDepth,
      durationtimelogtotalcalc: total,
      durationtimelogtotcumcalc: totCum(total) ?? 0,
      durationproblemtimecalc: prob,
      durationnoprobtimecalc: total - prob,
      durnoprobtimecumdayscalc: noProbCum(total - prob) ?? 0,
      costtotalcalc: cost,
      costtodatecalc: costCum(cost) ?? 0,
    });
  }
  return out;
}

/**
 * Days of problem time inside [from, to], overlapping problems counted once.
 *
 * The "counted once" is the whole reason this merges rather than sums: two
 * crews logging the same stuck-pipe event as two problems is normal, and
 * adding them would report more lost time than the day contains.
 */
export function mergedOverlapDays(
  problems: { from: number; to: number | null }[],
  from: number,
  to: number,
): number {
  const spans = problems
    // An open-ended problem "lasts to the end of the reporting period".
    .map((p) => [Math.max(p.from, from), Math.min(p.to ?? to, to)] as [number, number])
    .filter(([a, b]) => b > a)
    .sort((a, b) => a[0] - b[0]);
  let total = 0;
  let curFrom = 0, curTo = -1;
  for (const [a, b] of spans) {
    if (a > curTo) { if (curTo > curFrom) total += curTo - curFrom; curFrom = a; curTo = b; }
    else if (b > curTo) curTo = b;
  }
  if (curTo > curFrom) total += curTo - curFrom;
  return total / DAY_MS;
}

/** The jobs on a well that can carry a curve, newest first. */
export function daysVsDepth(db: DatabaseSync, idwell: string, idjob?: string): DvdJob[] {
  const jobs = db.prepare(`
    SELECT IDRec, JobTyp, JobSubTyp, DtTmStart
    FROM wvJob WHERE idwell = ?
    ORDER BY COALESCE(DtTmStart, '') DESC, IDRec
  `).all(idwell) as Record<string, unknown>[];

  return jobs
    .filter((j) => !idjob || String(j.IDRec) === idjob)
    .map((j) => {
      const id = String(j.IDRec);
      const when = String(j.DtTmStart ?? "").slice(0, 10);
      const what = [j.JobTyp, j.JobSubTyp].filter(Boolean).join(" / ");
      return {
        idrec: id,
        label: [what || "Job", when || null].filter(Boolean).join(" — "),
        phases: phaseRows(db, idwell, id),
        reports: reportRows(db, idwell, id),
      };
    })
    // A job with neither a plan nor a report has no curve to draw.
    .filter((j) => j.phases.length > 0 || j.reports.length > 0);
}

/** Build one template series' points from the computed rows. */
export function seriesPoints(
  job: DvdJob,
  s: { x: string; table: string; y: string },
): DvdPoint[] {
  const rows: (DvdPhaseRow | DvdReportRow)[] =
    s.table === "wvjobprogramphase" ? job.phases : job.reports;
  const label = (r: DvdPhaseRow | DvdReportRow) =>
    "name" in r ? (r.name ?? `Phase ${r.seq}`) : (r.date ?? "").slice(0, 10);
  const out: DvdPoint[] = [];
  for (const r of rows) {
    const rec = r as unknown as Record<string, number | null>;
    const x = rec[s.x], y = rec[s.y];
    // A missing value drops the point. It must never become 0: that would draw
    // the curve back through the origin across data nobody entered.
    if (x == null || y == null || !Number.isFinite(x) || !Number.isFinite(y)) continue;
    out.push({ x, y, label: label(r) });
  }
  return out;
}

/** An axis: what to call it, and what unit its numbers are in. */
export interface DvdAxis {
  field: string;
  label: string;
  /** The model's base unit — what the numbers are in. */
  unit?: string;
  /** Per unit set: the unit to show and how to format it. */
  units?: Record<string, unknown>;
  /**
   * Measured from the reference datum (Tools > Reference Datum).
   *
   * Both depth axes of this chart are. Without it the drilling curve would be
   * the one place in the app where switching the datum to Ground leaves the
   * depths where they were — silently disagreeing with the Schematic, the
   * Survey tab and every grid, by the height of the rig floor.
   */
  applyDatum?: boolean;
  datumMode?: string;
}

/** One series of a template, resolved against a job's computed rows. */
export interface DvdSeries {
  caption: string;
  /** The model's caption, base unit and per-set formats for each axis. */
  x: DvdAxis;
  y: DvdAxis;
  /** "plan" comes from the phase program, "actual" from the daily reports. */
  kind: "plan" | "actual";
  points: DvdPoint[];
}

/** A .dvdc template as `build_dvdc.mjs` decoded it. */
export interface DvdTemplate {
  id: string;
  folder: string;
  name: string;
  series: { x: string; table: string; y: string; caption: string }[];
}

/**
 * Resolve a template against a job, dropping series the data cannot fill.
 *
 * A template that asks for six curves on a job with no cost estimate should
 * draw the two it has, not six empty legend entries — but the caller is told
 * which were dropped rather than left to assume the well simply looks like
 * that.
 */
export function resolveTemplate(
  job: DvdJob,
  tpl: DvdTemplate,
  label: (table: string, field: string) => Omit<DvdAxis, "field">,
): { series: DvdSeries[]; empty: string[] } {
  const series: DvdSeries[] = [];
  const empty: string[] = [];
  for (const s of tpl.series) {
    const points = seriesPoints(job, s);
    if (points.length < 2) { empty.push(s.caption); continue; }
    series.push({
      caption: s.caption,
      x: { field: s.x, ...label(s.table, s.x) },
      y: { field: s.y, ...label(s.table, s.y) },
      kind: s.table === "wvjobprogramphase" ? "plan" : "actual",
      points,
    });
  }
  return { series, empty };
}
