/**
 * Reports 10 (Phases — Plan vs Actual) and 11 (Phase Summary Graph).
 *
 * Both read the job's phases: 10 as a table with a depth-and-cost graph beneath
 * it, 11 as a bar chart of duration and cost per phase. One assembler, because
 * the two disagree about nothing — 11 is 10's data without the table.
 *
 * WHAT IS COMPUTED, AND CHECKED AGAINST THE SAMPLE
 * -----------------------------------------------
 *   Pl Cum Days ML      running Σ of the planned durations
 *   Pl Cum Cost ML      running Σ of the planned costs
 *   Plan Cost/Depth     planned cost ÷ (planned end − planned start)
 *   Actual Dur          actual end − actual start, in DAYS to 2 dp
 *   Act Cum Dur         running Σ of the above
 *   Actual Phase Cost   Σ the job's cost lines charged to that phase
 *   Act Cum Cost        running Σ of the above
 *   Cost/Depth          actual phase cost ÷ (actual end − actual start)
 *
 * The sample's own arithmetic pins every one of these:
 *   row 1  09:00 → 21:45 next day  = 36.75 hr = 1.53 days ✓
 *   row 1  185,252.91 ÷ 321.52     = 576.17 Cost/ft ✓  (NOT ÷ the printed 321.5,
 *                                     which is why the depths are stored at full
 *                                     precision and only rounded on the page)
 *   row 2  60,000 ÷ 981.0          = 61.16 planned Cost/ft ✓
 *   row 2  45,828.28 ÷ 659.48      = 69.49 Cost/ft ✓
 *   row 2  1.53 + 1.38             = 2.91 cumulative days ✓
 *
 * A zero-length interval yields NO cost-per-depth rather than a division by
 * zero — the sample leaves those cells blank (rows 1, 3, 6, 7, 8).
 */
import type { PrismaClient } from "@prisma/client";
import { jalaliHoursBetween } from "@dd/shared";
import { printedOn, type HeaderCell, type HeaderRow, type ReportEnvelope } from "./chrome.js";

const round = (n: number, dp = 2) => Number(n.toFixed(dp));
function sumOrNull(values: (number | null | undefined)[], dp = 2): number | null {
  let any = false, total = 0;
  for (const v of values) {
    if (v === null || v === undefined || !Number.isFinite(v)) continue;
    any = true; total += v;
  }
  return any ? round(total, dp) : null;
}
/** Cost per unit depth. Null when the interval is zero — never a divide by zero. */
function costPerDepth(cost: number | null, from: number | null, to: number | null): number | null {
  if (cost === null || from === null || to === null) return null;
  const span = to - from;
  return span > 0 ? round(cost / span) : null;
}
const cell = (label: string, value: string | number | null, kind?: HeaderCell["kind"]): HeaderCell =>
  ({ label, value, kind });

export interface PhaseRow {
  phaseType1: string | null;
  phaseType2: string | null;
  // ── planned ──
  plannedStartDepth: number | null;
  plannedEndDepth: number | null;
  durMlDays: number | null;
  cumDurMlDays: number | null;
  plannedCost: number | null;
  cumPlannedCost: number | null;
  planCostPerDepth: number | null;
  // ── actual ──
  actualStartDate: string | null;
  actualEndDate: string | null;
  actualDurDays: number | null;
  cumActualDurDays: number | null;
  actualStartDepth: number | null;
  actualEndDepth: number | null;
  actualCost: number | null;
  cumActualCost: number | null;
  costPerDepth: number | null;
}

/** One point of the depth-and-cost graph beneath report 10's table. */
export interface PhaseChartPoint {
  /** Cumulative days — the graph's X axis. */
  days: number | null;
  /** Cumulative PLANNED days, for the two planned series. */
  planDays: number | null;
  actualEndDepth: number | null;
  actualCumCost: number | null;
  plannedCumCost: number | null;
  plannedEndDepth: number | null;
  label: string;
}

export interface Report10Payload extends ReportEnvelope {
  jobHeader: HeaderRow;
  phases: PhaseRow[];
  totals: HeaderRow;
  chart: PhaseChartPoint[];
}

export interface Report11Payload extends ReportEnvelope {
  wellRow: HeaderRow;
  jobRow: HeaderRow;
  planRow: HeaderRow;
  /** One bar group per phase: planned against actual, duration and cost. */
  bars: {
    label: string;
    /** The axis tick — the sample labels its bars with the phase's SECOND type
     *  ("Drill-Vertical"), not the pair, because the pair does not fit. */
    shortLabel: string;
    plannedDurDays: number | null;
    actualDurDays: number | null;
    plannedCost: number | null;
    actualCost: number | null;
  }[];
}

/** The phase rows both reports are built from, computed once. */
async function phaseRows(prisma: PrismaClient, jobId: string) {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      well: true,
      afes: { orderBy: { order: "asc" }, include: { supplements: true } },
      phases: { orderBy: { order: "asc" }, include: { plan: true } },
      costItems: { select: { phaseId: true, fieldEstimate: true } },
    },
  });
  if (!job) return null;

  // Cost charged to each phase — the same CostItem rows report 01 prints.
  const byPhase = new Map<string, number>();
  for (const c of job.costItems) {
    if (!c.phaseId || c.fieldEstimate === null) continue;
    byPhase.set(c.phaseId, round((byPhase.get(c.phaseId) ?? 0) + c.fieldEstimate));
  }

  let cumPlanDays = 0, cumPlanCost = 0, cumActDays = 0, cumActCost = 0;
  let anyPlanDays = false, anyPlanCost = false, anyActDays = false, anyActCost = false;

  const rows: PhaseRow[] = job.phases.map((p) => {
    const plan = p.plan;
    const hours = jalaliHoursBetween(p.actualStartDate, p.actualEndDate);
    const rawDurDays = hours === null ? null : hours / 24;
    const actualDur = rawDurDays === null ? null : round(rawDurDays);
    const actualCost = byPhase.get(p.id) ?? null;

    // The running totals accumulate the UNROUNDED values and are rounded only
    // for the page. The sample settles it: its per-phase durations printed to
    // 2 dp add to 25.47, but its last cumulative cell reads 25.46 — which is
    // what rounding the true sum gives.
    if (plan?.durMostLikelyDays != null) { cumPlanDays += plan.durMostLikelyDays; anyPlanDays = true; }
    if (plan?.costMostLikely != null) { cumPlanCost += plan.costMostLikely; anyPlanCost = true; }
    if (rawDurDays !== null) { cumActDays += rawDurDays; anyActDays = true; }
    if (actualCost !== null) { cumActCost += actualCost; anyActCost = true; }

    return {
      phaseType1: p.phaseType1,
      phaseType2: p.phaseType2,
      plannedStartDepth: plan?.startDepth ?? null,
      plannedEndDepth: plan?.endDepth ?? null,
      durMlDays: plan?.durMostLikelyDays ?? null,
      cumDurMlDays: anyPlanDays ? round(cumPlanDays) : null,
      plannedCost: plan?.costMostLikely ?? null,
      cumPlannedCost: anyPlanCost ? round(cumPlanCost) : null,
      planCostPerDepth: costPerDepth(plan?.costMostLikely ?? null, plan?.startDepth ?? null, plan?.endDepth ?? null),
      actualStartDate: p.actualStartDate,
      actualEndDate: p.actualEndDate,
      actualDurDays: actualDur,
      cumActualDurDays: anyActDays ? round(cumActDays) : null,
      actualStartDepth: p.actualStartDepth,
      actualEndDepth: p.actualEndDepth,
      actualCost,
      cumActualCost: anyActCost ? round(cumActCost) : null,
      costPerDepth: costPerDepth(actualCost, p.actualStartDepth, p.actualEndDepth),
    };
  });

  const afe = job.afes[0] ?? null;
  const afePlusSupp = afe
    ? sumOrNull([afe.amount, ...(afe.supplements ?? []).map((s) => s.amount)])
    : null;
  const totalFieldEst = sumOrNull(job.costItems.map((c) => c.fieldEstimate));

  return { job, rows, afe, afePlusSupp, totalFieldEst };
}

/** "Surface · Drill-Vertical", or whichever half exists. */
const phaseLabel = (r: PhaseRow, i: number) =>
  [r.phaseType1, r.phaseType2].filter(Boolean).join(" · ") || `Phase ${i + 1}`;

export async function buildReport10(
  prisma: PrismaClient,
  jobId: string,
): Promise<Report10Payload | null> {
  const built = await phaseRows(prisma, jobId);
  if (!built) return null;
  const { job, rows, afe, afePlusSupp, totalFieldEst } = built;

  const variance = afePlusSupp !== null || totalFieldEst !== null
    ? round((afePlusSupp ?? 0) - (totalFieldEst ?? 0))
    : null;

  return {
    type: "10",
    title: "Phases - Plan vs Actual",
    wellName: job.well.name,
    headerVariant: "wellJob",
    header: [],
    printedOn: printedOn(),
    jobHeader: [
      cell("Job Category", job.category),
      cell("Primary Job Type", job.primaryJobType),
      cell("Secondary Job Type", job.secondaryJobType),
      cell("AFE Number", afe?.afeNumber ?? null),
      cell("Total AFE + Supp Amount (Cost)", afePlusSupp, "money"),
      cell("Total Field Estimate (Cost)", totalFieldEst, "money"),
      cell("AFE-Field Estimate (Cost)", variance, "money"),
    ],
    phases: rows,
    totals: [
      cell("Planned Likely Duration (days)", rows.length ? rows[rows.length - 1].cumDurMlDays : null),
      // The last cumulative cell already IS the total, and it was accumulated
      // unrounded — re-summing the rounded column here would disagree with it.
      cell("Actual Duration (days)", rows.length ? rows[rows.length - 1].cumActualDurDays : null),
      cell("Planned Likely Cost (Cost)", rows.length ? rows[rows.length - 1].cumPlannedCost : null, "money"),
      cell("Actual Field Est (Cost)", rows.length ? rows[rows.length - 1].cumActualCost : null, "money"),
    ],
    // The graph's four series, all against a day axis: actual depth and actual
    // cost against elapsed days, planned depth and planned cost against planned
    // days. Every value is a CUMULATIVE running total, which is why the series
    // rise monotonically on the sample.
    chart: rows.map((r, i) => ({
      days: r.cumActualDurDays,
      planDays: r.cumDurMlDays,
      actualEndDepth: r.actualEndDepth,
      actualCumCost: r.cumActualCost,
      plannedCumCost: r.cumPlannedCost,
      plannedEndDepth: r.plannedEndDepth,
      label: phaseLabel(r, i),
    })),
  };
}

export async function buildReport11(
  prisma: PrismaClient,
  jobId: string,
): Promise<Report11Payload | null> {
  const built = await phaseRows(prisma, jobId);
  if (!built) return null;
  const { job, rows, afe } = built;
  const w = job.well;

  // The well's deepest recorded phase end — the sample's "Total Depth".
  const totalDepth = rows.reduce<number | null>(
    (deepest, r) => (r.actualEndDepth !== null && (deepest === null || r.actualEndDepth > deepest)
      ? r.actualEndDepth : deepest),
    null,
  );

  return {
    type: "11",
    title: "Phase Summary Graph",
    wellName: w.name,
    headerVariant: "wellJob",
    header: [],
    printedOn: printedOn(),
    wellRow: [
      cell("API/UWI", w.apiUwi),
      cell("License #", w.licenseNo),
      cell("Field Name", w.field),
      cell("State/Province", w.stateProvince),
      cell("Well Configuration Type", w.profile),
      cell("Spud Date", w.spudDate),
      cell("Rig Release Date", w.rigReleasedDate),
      cell("KB-Ground Distance (m)", w.kbGroundDistance, "decimal"),
      cell("Total Depth (mKB)", totalDepth, "decimal"),
    ],
    jobRow: [
      cell("AFE Number", afe?.afeNumber ?? null),
      cell("Job Category", job.category),
      cell("Primary Job Type", job.primaryJobType),
      cell("Status 1", job.status1),
      cell("Target Depth (mKB)", job.targetDepth, "decimal"),
      cell("Target Formation", job.targetFormation),
    ],
    planRow: [
      cell("Planned Start Date", job.plannedStartDate),
      cell("Start Date", job.startDate),
      cell("Min Planned End Date", job.minPlannedEndDate),
      cell("Planned Most Likely End Date", job.mostLikelyPlannedEndDate),
      cell("Max Planned End Date", job.maxPlannedEndDate),
      cell("End Date", job.endDate),
    ],
    bars: rows.map((r, i) => ({
      label: phaseLabel(r, i),
      shortLabel: r.phaseType2 ?? r.phaseType1 ?? `Phase ${i + 1}`,
      plannedDurDays: r.durMlDays,
      actualDurDays: r.actualDurDays,
      plannedCost: r.plannedCost,
      actualCost: r.actualCost,
    })),
  };
}
