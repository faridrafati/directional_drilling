/**
 * Report 09 — Drilling Summary 1.
 *
 * A one-page dashboard over a whole job: the well's identification band, and
 * four panels that each answer one question a morning meeting asks.
 *
 *   1. TIME BREAKDOWN BY CODE1  — which operations the days went into, as a
 *      percentage of total logged time, longest first.
 *   2. COST BREAKDOWN BY DES    — where the money went, by cost description.
 *   3. NPT BY DES               — which unscheduled events cost the most time.
 *   4. DEPTH AND COST VS DAYS   — the job's progress curve, depth on one axis
 *      and cumulative field estimate on the other.
 *
 * Every percentage in panels 1 and 3 is over the SAME denominator: the total
 * hours logged on the job's days. Using each panel's own subtotal would let the
 * two read as if they described different jobs, and NPT — which is a slice of
 * the same clock — would come out as a share of itself.
 *
 * WHERE THE DATA COMES FROM
 * -------------------------
 * Nothing here is a new entry surface. Panels 1 and 3 come from the daily
 * OPERATIONS LOG — the from/to clock the crew fills in every morning, the same
 * rows reports 06 and 07 print — 2 is the job cost sheet grouped by description,
 * and 4 is the days' midnight depths against the cost lines dated on or before
 * each day.
 *
 * The operations log is used rather than the "Time Breakdown" summary table
 * because it is the one that is actually kept: the breakdown table is optional
 * and usually empty, and a dashboard built on it prints four blank panels for a
 * job whose every hour is logged.
 *
 * NPT hours are the log's own `probHr`, not the problem register's
 * `estLostTimeHr`. The first is the clock; the second is an estimate typed
 * before the trouble was over. The problem register supplies the NAME — an
 * interval carries the 1-based ordinal of the problem row it belongs to.
 */
import type { PrismaClient } from "@prisma/client";
import {
  printedOn, summaryWellHeader, type HeaderRow, type ReportEnvelope,
} from "./chrome.js";
import { compareJalali, jalaliDaysBetween } from "@dd/shared";
import { durationHr } from "./daily.js";
import { buildSchematic, type SchematicPayload } from "./schematic.js";

/** One bar of a breakdown panel. */
export interface BreakdownBar {
  /** What the bar is: an operation name, a cost description, a problem type. */
  label: string;
  /** The measured quantity — hours, or cost. */
  value: number;
  /** Its share of the panel's denominator, already a percentage. */
  percent: number | null;
}

/** One day on the progress curve. */
export interface ProgressPoint {
  /** 1 on the job's first day — the sample's "Job Day (days)". */
  jobDay: number;
  date: string;
  endDepth: number | null;
  cumFieldEst: number | null;
}

export interface Report09Payload extends ReportEnvelope {
  header: HeaderRow[];
  jobRow: HeaderRow;
  /** Panel 1 — Code 1 vs % Total Time (sorted). */
  timeByCode: BreakdownBar[];
  /** Panel 2 — Cost Description vs Field Est. */
  costByDes: BreakdownBar[];
  /** Panel 3 — Unscheduled Type vs % Total Time (sorted). */
  nptByDes: BreakdownBar[];
  /** Panel 4 — Job Day vs End Depth / Cum Field Est To Date. */
  progress: ProgressPoint[];
  /** Total hours logged: the denominator panels 1 and 3 share. */
  totalHours: number | null;
  /** The wellbore section the sample draws down its left column. */
  schematic: SchematicPayload;
}

const WELL_SELECT = {
  name: true, field: true, apiUwi: true, licenseNo: true, stateProvince: true,
  location: true, profile: true, groundElevation: true, casingFlangeElevation: true,
  kbGroundDistance: true, kbCasingFlangeDistance: true, spudDate: true, rigReleasedDate: true,
  client: true, area: true, county: true, latitude: true, longitude: true,
  ewDistance: true, ewRef: true, nsDistance: true, nsRef: true,
} as const;

const round = (v: number) => Math.round(v * 100) / 100;

/**
 * Turn a label→total map into sorted bars.
 *
 * `denominator` is passed in rather than summed from the map: panels 1 and 3
 * share the job's total hours, so panel 3's percentages stay a share of the
 * whole job rather than of NPT alone.
 */
function bars(totals: Map<string, number>, denominator: number | null): BreakdownBar[] {
  return [...totals.entries()]
    .map(([label, value]) => ({
      label,
      value: round(value),
      percent: denominator && denominator > 0 ? round((value / denominator) * 100) : null,
    }))
    .sort((a, b) => b.value - a.value);
}

export async function buildReport09(
  prisma: PrismaClient,
  jobId: string,
): Promise<Report09Payload | null> {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      well: { select: WELL_SELECT },
      costItems: { include: { costCode: true } },
    },
  });
  if (!job) return null;
  const well = job.well;
  const schematic = await buildSchematic(prisma, job.wellId);

  // The job's days. A report is on the job when it carries its id; the days are
  // what both the time panels and the progress curve are built from.
  const reports = await prisma.entryReport.findMany({
    where: { jobId: job.id },
    select: {
      id: true, reportDate: true, midnightDepth: true,
      operations: {
        orderBy: { order: "asc" },
        select: {
          fromTime: true, toTime: true, opLetter: true,
          isProblem: true, probHr: true, problemRef: true,
        },
      },
      intervalProblems: { orderBy: { order: "asc" }, select: { order: true, problemType: true } },
    },
  });
  reports.sort((a, b) => compareJalali(a.reportDate, b.reportDate));

  // ── the shared denominator ────────────────────────────────────────────────
  // Σ of every logged interval. An interval whose from and to are the same time
  // contributes NOTHING — the crew writes one time twice when the clock was
  // never filled in, and counting it as zero hours would be honest while
  // counting it as a row would not.
  let totalHours = 0;
  for (const r of reports) {
    for (const op of r.operations) {
      const dur = durationHr(op.fromTime, op.toTime);
      if (dur !== null) totalHours += dur;
    }
  }
  const denominator = totalHours > 0 ? totalHours : null;

  // ── panel 1: time by Main Operation letter ────────────────────────────────
  // The letters are looked up so the bar reads "DRILLING", not "D". An entry
  // whose letter is not in the table keeps the letter — the code system is
  // advisory everywhere else in this app, and a bar is not the place to start
  // rejecting one.
  const operations = await prisma.wvMainOperation.findMany({ select: { code: true, name: true } });
  const opName = new Map(operations.map((o) => [o.code, o.name]));
  const byCode = new Map<string, number>();
  for (const r of reports) {
    for (const op of r.operations) {
      const dur = durationHr(op.fromTime, op.toTime);
      if (dur === null) continue;
      const key = op.opLetter ? `${op.opLetter} · ${opName.get(op.opLetter) ?? "—"}` : "Uncoded";
      byCode.set(key, (byCode.get(key) ?? 0) + dur);
    }
  }

  // ── panel 2: cost by description ──────────────────────────────────────────
  // The cost CODE's description is preferred over the line's own free text: two
  // lines charged to the same account should land on one bar even when the
  // crew typed a different note on each.
  const byDes = new Map<string, number>();
  let totalFieldEst = 0;
  for (const c of job.costItems) {
    if (c.fieldEstimate === null) continue;
    const key = c.costCode?.description ?? c.description ?? "Uncoded";
    byDes.set(key, (byDes.get(key) ?? 0) + c.fieldEstimate);
    totalFieldEst += c.fieldEstimate;
  }

  // ── panel 3: NPT by problem type ──────────────────────────────────────────
  // The hours are the log's; the name comes from the problem row the interval
  // points at by ORDINAL (`problemRef` is `order + 1`, not a foreign key — the
  // daily save replaces child rows wholesale, so a real id would dangle).
  const byNpt = new Map<string, number>();
  for (const r of reports) {
    const problemAt = new Map(r.intervalProblems.map((p) => [p.order + 1, p.problemType]));
    for (const op of r.operations) {
      if (!op.isProblem) continue;
      // Fall back to the interval's own span: a day can mark trouble on the log
      // and leave the separate problem-hours cell empty, and dropping it would
      // under-report NPT on exactly the days that had the most of it.
      const hours = op.probHr ?? durationHr(op.fromTime, op.toTime);
      if (hours === null) continue;
      const key = (op.problemRef === null ? null : problemAt.get(op.problemRef)) ?? "Unclassified";
      byNpt.set(key, (byNpt.get(key) ?? 0) + hours);
    }
  }

  // ── panel 4: the progress curve ───────────────────────────────────────────
  // Job day 1 is the job's first REPORT, not its start date: a job whose start
  // was back-dated to the move-in would otherwise draw a flat run of empty days
  // before the first depth.
  const firstDate = reports[0]?.reportDate ?? null;
  const costByDate = job.costItems
    .filter((c) => c.costDate !== null && c.fieldEstimate !== null)
    .map((c) => ({ date: c.costDate as string, amount: c.fieldEstimate as number }));

  const progress: ProgressPoint[] = reports.map((r, i) => {
    const days = firstDate === null ? null : jalaliDaysBetween(firstDate, r.reportDate);
    // Cumulative to date: every cost line dated on or before this day. Summed
    // per point rather than carried forward, so a line dated out of sequence
    // still lands in the right place on the curve.
    const cum = costByDate
      .filter((c) => compareJalali(c.date, r.reportDate) <= 0)
      .reduce((sum, c) => sum + c.amount, 0);
    return {
      jobDay: days === null ? i + 1 : days + 1,
      date: r.reportDate,
      endDepth: r.midnightDepth,
      cumFieldEst: costByDate.length ? round(cum) : null,
    };
  });

  const totalDepth = progress.reduce<number | null>(
    (deepest, p) => (p.endDepth !== null && (deepest === null || p.endDepth > deepest) ? p.endDepth : deepest),
    null,
  );

  return {
    type: "09",
    title: "Drilling Summary 1",
    wellName: well.name,
    headerVariant: "summary",
    header: summaryWellHeader(well, totalDepth),
    printedOn: printedOn(),
    jobRow: [
      { label: "Job", value: job.name ?? job.primaryJobType ?? job.category },
      { label: "Days Reported", value: reports.length, kind: "int" },
      { label: "Total Time (hr)", value: denominator === null ? null : round(totalHours), kind: "decimal" },
      { label: "Total Field Est (Cost)", value: totalFieldEst === 0 ? null : round(totalFieldEst), kind: "money" },
      { label: "Total Depth (mKB)", value: totalDepth, kind: "decimal" },
    ],
    timeByCode: bars(byCode, denominator),
    costByDes: bars(byDes, totalFieldEst > 0 ? totalFieldEst : null),
    nptByDes: bars(byNpt, denominator),
    progress,
    totalHours: denominator === null ? null : round(totalHours),
    schematic,
  };
}
