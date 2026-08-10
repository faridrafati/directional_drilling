/**
 * Reports 13 (Multi-well Drilling KPIs) and 16 (Multi-well Phase Summary Pivot).
 *
 * Both samples are Excel pivot tables printed to PDF, which is why both offer an
 * XLSX export as well as a page: the shape IS a spreadsheet, and handing a
 * drilling engineer a picture of one to retype is the wrong answer.
 *
 * They share the pivot chrome — the filter block WellView prints above the grid
 * ("Country (All)", "Field Name (All)") — but with one difference that matters.
 * WellView prints "(All)" for a dimension nobody filtered on. We print the
 * DISTINCT VALUES the selected wells actually carry, and "(All)" only when there
 * is genuinely more than one. "State/Province: Bushehr" tells a reader what is in
 * front of them; "(All)" tells them nothing they could not have assumed.
 *
 * EVERY FIGURE IS DERIVED, NOTHING IS A NEW ENTRY FIELD
 * ----------------------------------------------------
 * 13 adds up the job cost sheet, the daily operations log and the daily
 * personnel log; 16 measures the phase spine reports 10 and 11 already print.
 * Where a well has none of a thing, its cell is BLANK rather than zero — a well
 * with no problem hours recorded and a well with genuinely zero problem hours
 * are different statements, and the sample leaves the first one empty too.
 */
import type { PrismaClient } from "@prisma/client";
import { jalaliHoursBetween } from "@dd/shared";
import { printedOn, type HeaderRow } from "./chrome.js";
import type { MultiWellEnvelope, ResolvedWells } from "./multiwell.js";
import { durationHr, problemHoursOf } from "./daily.js";

const round = (v: number, dp = 2) => Number(v.toFixed(dp));

/** Σ over a nullable column; null when nothing contributed. */
function sumOrNull(values: (number | null | undefined)[], dp = 2): number | null {
  let any = false, total = 0;
  for (const v of values) {
    if (v === null || v === undefined || !Number.isFinite(v)) continue;
    any = true; total += v;
  }
  return any ? round(total, dp) : null;
}

/** a ÷ b, or null when either side is missing or b is zero. */
function ratio(a: number | null, b: number | null, dp = 2): number | null {
  if (a === null || b === null || !b) return null;
  return round(a / b, dp);
}

/**
 * One line of the pivot's filter block.
 *
 * `values` is every distinct value across the set. One value is printed; more
 * than one is "(All)", because naming six states in a one-line cell is not a
 * filter statement. None at all prints blank, not "(All)" — nothing recorded is
 * not the same as everything included.
 */
function filterLine(label: string, values: (string | null)[]): { label: string; value: string | null } {
  const distinct = [...new Set(values.filter((v): v is string => !!v && v.trim() !== ""))];
  if (distinct.length === 0) return { label, value: null };
  return { label, value: distinct.length === 1 ? distinct[0] : "(All)" };
}

/* ══ report 13 — Drilling KPIs ═══════════════════════════════════════════════ */

export interface KpiRow {
  wellName: string;
  afeSuppAmt: number | null;
  fieldEst: number | null;
  afeLessFieldEst: number | null;
  costPerDepth: number | null;
  drilledTotalDepth: number | null;
  totalTimeLogHr: number | null;
  totalProblemHr: number | null;
  pctProblemTime: number | null;
  drillingHr: number | null;
  avgRopMHr: number | null;
  personnelHr: number | null;
}

export interface Report13Payload extends MultiWellEnvelope {
  filters: HeaderRow;
  rows: KpiRow[];
  /** The sample's own last line. Computed from the WELLS, never from the column. */
  grandTotal: KpiRow;
}

export async function buildReport13(
  prisma: PrismaClient,
  resolved: ResolvedWells,
): Promise<Report13Payload> {
  const wellIds = resolved.wells.map((w) => w.id);

  const [jobs, reports] = wellIds.length === 0 ? [[], []] : await Promise.all([
    prisma.job.findMany({
      where: { wellId: { in: wellIds } },
      select: {
        wellId: true, category: true, primaryJobType: true, secondaryJobType: true,
        afes: { select: { amount: true, supplements: { select: { amount: true } } } },
        costItems: { select: { fieldEstimate: true } },
      },
    }),
    prisma.entryReport.findMany({
      where: { wellId: { in: wellIds } },
      select: {
        wellId: true, previousDepth: true, midnightDepth: true, drillingTime: true,
        operations: { select: { fromTime: true, toTime: true, isProblem: true, probHr: true } },
        companies: { select: { totWorkTimeHr: true } },
      },
    }),
  ]);

  const rows: KpiRow[] = resolved.wells.map((well) => {
    const wellJobs = jobs.filter((j) => j.wellId === well.id);
    const wellDays = reports.filter((r) => r.wellId === well.id);

    const afeSuppAmt = sumOrNull(wellJobs.flatMap((j) =>
      j.afes.flatMap((a) => [a.amount, ...a.supplements.map((s) => s.amount)])));
    const fieldEst = sumOrNull(wellJobs.flatMap((j) => j.costItems.map((c) => c.fieldEstimate)));

    // Total depth is the deepest midnight the well ever reached — a job that
    // plugged back would otherwise report its LAST depth as its total.
    const drilledTotalDepth = wellDays.reduce<number | null>(
      (deep, r) => (r.midnightDepth !== null && (deep === null || r.midnightDepth > deep) ? r.midnightDepth : deep),
      null,
    );

    let logHr = 0, anyLog = false;
    let problemHr = 0, anyProblem = false;
    for (const r of wellDays) {
      for (const op of r.operations) {
        const dur = durationHr(op.fromTime, op.toTime);
        if (dur !== null) { logHr += dur; anyLog = true; }
        if (!op.isProblem) continue;
        const p = problemHoursOf(op);
        if (p !== null) { problemHr += p; anyProblem = true; }
      }
    }
    const totalTimeLogHr = anyLog ? round(logHr) : null;
    const totalProblemHr = anyProblem ? round(problemHr) : null;

    const drillingHr = sumOrNull(wellDays.map((r) => r.drillingTime));
    // Progress, not depth: a well that spudded at surface and one that resumed
    // at 2,000 m have drilled different amounts to reach the same total.
    const progress = sumOrNull(wellDays.map((r) =>
      r.midnightDepth !== null && r.previousDepth !== null ? r.midnightDepth - r.previousDepth : null));

    return {
      wellName: well.name,
      afeSuppAmt,
      fieldEst,
      afeLessFieldEst: afeSuppAmt === null && fieldEst === null
        ? null : round((afeSuppAmt ?? 0) - (fieldEst ?? 0)),
      costPerDepth: ratio(fieldEst, drilledTotalDepth),
      drilledTotalDepth,
      totalTimeLogHr,
      totalProblemHr,
      pctProblemTime: totalProblemHr === null || totalTimeLogHr === null
        ? null : ratio(totalProblemHr * 100, totalTimeLogHr),
      drillingHr,
      avgRopMHr: ratio(progress, drillingHr),
      personnelHr: sumOrNull(wellDays.flatMap((r) => r.companies.map((c) => c.totWorkTimeHr))),
    };
  });

  // The Grand Total re-derives its ratios from the summed numerator and
  // denominator. Averaging the column would weight a 3-day well the same as a
  // 30-day one, which is how a fleet ROP ends up faster than every rig in it.
  const col = (pick: (r: KpiRow) => number | null) => sumOrNull(rows.map(pick));
  const totalFieldEst = col((r) => r.fieldEst);
  const totalDepth = col((r) => r.drilledTotalDepth);
  const totalLog = col((r) => r.totalTimeLogHr);
  const totalProblem = col((r) => r.totalProblemHr);
  const totalDrilling = col((r) => r.drillingHr);
  const totalAfe = col((r) => r.afeSuppAmt);

  const grandTotal: KpiRow = {
    wellName: "Grand Total",
    afeSuppAmt: totalAfe,
    fieldEst: totalFieldEst,
    afeLessFieldEst: totalAfe === null && totalFieldEst === null
      ? null : round((totalAfe ?? 0) - (totalFieldEst ?? 0)),
    costPerDepth: ratio(totalFieldEst, totalDepth),
    drilledTotalDepth: totalDepth,
    totalTimeLogHr: totalLog,
    totalProblemHr: totalProblem,
    pctProblemTime: totalProblem === null || totalLog === null
      ? null : ratio(totalProblem * 100, totalLog),
    drillingHr: totalDrilling,
    avgRopMHr: ratio(
      sumOrNull(reports.map((r) =>
        r.midnightDepth !== null && r.previousDepth !== null ? r.midnightDepth - r.previousDepth : null)),
      totalDrilling,
    ),
    personnelHr: col((r) => r.personnelHr),
  };

  return {
    type: "13",
    title: "Drilling KPIs",
    wellName: `${resolved.wells.length} well${resolved.wells.length === 1 ? "" : "s"}`,
    headerVariant: "none",
    header: [],
    printedOn: printedOn(),
    wells: resolved.wells,
    droppedWells: resolved.dropped,
    filters: [
      filterLine("Country", resolved.wells.map((w) => w.country)),
      filterLine("State/Province", resolved.wells.map((w) => w.stateProvince)),
      filterLine("Field Name", resolved.wells.map((w) => w.field)),
      filterLine("County", resolved.wells.map((w) => w.county)),
      filterLine("Job Category", jobs.map((j) => j.category)),
      filterLine("Primary Job Type", jobs.map((j) => j.primaryJobType)),
      filterLine("Secondary Job Type", jobs.map((j) => j.secondaryJobType)),
    ],
    rows,
    grandTotal,
  };
}

/* ══ report 16 — Phase Summary Pivot ═════════════════════════════════════════ */

/** One pivot row: a phase kind, and the spread of its durations across wells. */
export interface PhasePivotRow {
  jobCategory: string;
  phaseType1: string;
  phaseType2: string;
  count: number;
  avg: number | null;
  min: number | null;
  max: number | null;
  /** Population standard deviation; null for a single observation. */
  stdDev: number | null;
  sum: number | null;
}

export interface Report16Payload extends MultiWellEnvelope {
  filters: HeaderRow;
  rows: PhasePivotRow[];
  grandTotal: PhasePivotRow;
}

/**
 * The spread of one group's durations.
 *
 * POPULATION standard deviation (÷ n), not sample (÷ n−1): the rows are every
 * phase of that kind that was drilled, not a sample drawn from a larger set, and
 * the sample's own StdDev for a 3-value group matches ÷ n.
 */
function spread(values: number[]) {
  if (values.length === 0) {
    return { count: 0, avg: null, min: null, max: null, stdDev: null, sum: null };
  }
  const sum = values.reduce((a, b) => a + b, 0);
  const avg = sum / values.length;
  const variance = values.reduce((a, v) => a + (v - avg) ** 2, 0) / values.length;
  return {
    count: values.length,
    avg: round(avg),
    min: round(Math.min(...values)),
    max: round(Math.max(...values)),
    // A single phase has no spread. 0.00 would read as "they were all the same",
    // which is a claim one observation cannot support.
    stdDev: values.length > 1 ? round(Math.sqrt(variance)) : null,
    sum: round(sum),
  };
}

export async function buildReport16(
  prisma: PrismaClient,
  resolved: ResolvedWells,
): Promise<Report16Payload> {
  const wellIds = resolved.wells.map((w) => w.id);
  const jobs = wellIds.length === 0 ? [] : await prisma.job.findMany({
    where: { wellId: { in: wellIds } },
    select: {
      category: true, primaryJobType: true,
      well: { select: { name: true, stateProvince: true, field: true, wellType: true, profile: true } },
      phases: { select: { phaseType1: true, phaseType2: true, actualStartDate: true, actualEndDate: true } },
    },
  });

  // Group by the sample's three row dimensions. A phase whose duration cannot
  // be measured is not counted — it would drag Avg toward a number nobody
  // observed, and Count is supposed to say how many were MEASURED.
  const groups = new Map<string, { key: [string, string, string]; values: number[] }>();
  const all: number[] = [];
  for (const job of jobs) {
    const category = job.category ?? "Uncategorized";
    for (const p of job.phases) {
      const hours = jalaliHoursBetween(p.actualStartDate, p.actualEndDate);
      if (hours === null) continue;
      const days = hours / 24;
      const key: [string, string, string] = [
        category, p.phaseType1 ?? "(blank)", p.phaseType2 ?? "(blank)",
      ];
      const id = key.join(" ▸ ");
      const g = groups.get(id) ?? { key, values: [] };
      g.values.push(days);
      groups.set(id, g);
      all.push(days);
    }
  }

  const rows: PhasePivotRow[] = [...groups.values()]
    .map((g) => ({
      jobCategory: g.key[0], phaseType1: g.key[1], phaseType2: g.key[2], ...spread(g.values),
    }))
    // The sample orders by its row dimensions, not by size: a pivot is read
    // down its left-hand columns.
    .sort((a, b) =>
      a.jobCategory.localeCompare(b.jobCategory)
      || a.phaseType1.localeCompare(b.phaseType1)
      || a.phaseType2.localeCompare(b.phaseType2));

  return {
    type: "16",
    title: "Phase Summary Pivot",
    wellName: `${resolved.wells.length} well${resolved.wells.length === 1 ? "" : "s"}`,
    headerVariant: "none",
    header: [],
    printedOn: printedOn(),
    wells: resolved.wells,
    droppedWells: resolved.dropped,
    filters: [
      filterLine("Country", resolved.wells.map((w) => w.country)),
      filterLine("State/Province", resolved.wells.map((w) => w.stateProvince)),
      filterLine("Field Name", resolved.wells.map((w) => w.field)),
      filterLine("Well Type", resolved.wells.map((w) => w.wellType)),
      filterLine("Well Configuration Type", jobs.map((j) => j.well.profile)),
      filterLine("Primary Job Type", jobs.map((j) => j.primaryJobType)),
      filterLine("Well Name", resolved.wells.map((w) => w.name)),
    ],
    rows,
    // Over EVERY phase, not over the rows: averaging the Avg column would weight
    // a one-phase group the same as a twelve-phase one.
    grandTotal: {
      jobCategory: "Grand Total", phaseType1: "", phaseType2: "", ...spread(all),
    },
  };
}
