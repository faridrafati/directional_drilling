/**
 * Report 14 — Multi-well Drilling Offsets.
 *
 * Five plots of the same well set, each answering a different question a
 * drilling engineer asks about an offset:
 *
 *   1. ACTUAL DAYS VS DEPTH      — how fast did it go down, from the first day?
 *   2. DAYS FROM SPUD VS DEPTH   — the same, from SPUD, so a well that sat
 *      waiting on location does not look faster than one that did not.
 *   3. ACTUAL DAYS VS COST       — how fast did it spend?
 *   4. ACTUAL DEPTH VS COST      — what did a metre cost, all the way down?
 *   5. MUD WT. VS CHECK DEPTH    — the mud programme actually run.
 *
 * One series per well on every plot, which is the whole point: an offset curve
 * against nothing is not a comparison. A well with no days contributes no
 * series rather than a flat line at the origin.
 *
 * THE TWO DAY AXES ARE DIFFERENT MEASUREMENTS
 * -------------------------------------------
 * "Actual days" counts from the well's FIRST FILED REPORT; "days from spud"
 * counts from its spud date. They diverge exactly as much as the rig sat on
 * location before spudding, and plot 2 is in the sample precisely because plot 1
 * flatters a well that was late to spud. Neither is derived from the other here
 * — each is measured from its own origin, and a well missing a spud date simply
 * has no series on plot 2.
 */
import type { PrismaClient } from "@prisma/client";
import { compareJalali, jalaliDaysBetween } from "@dd/shared";
import { printedOn, type HeaderRow, type ReportEnvelope } from "./chrome.js";
import type { ResolvedWells, WellRef } from "./multiwell.js";

const round = (v: number, dp = 2) => Number(v.toFixed(dp));

/** One point on one well's curve. Both coordinates are always present. */
export interface OffsetPoint { x: number; y: number }

/** One well's curve on one plot. */
export interface OffsetSeries {
  wellId: string;
  wellName: string;
  points: OffsetPoint[];
}

/** One plot: what it is called, what its axes mean, and its curves. */
export interface OffsetPlot {
  key: "daysDepth" | "spudDepth" | "daysCost" | "depthCost" | "mudDepth";
  title: string;
  xLabel: string;
  yLabel: string;
  /** True where the Y axis grows DOWNWARD — every depth axis in this suite. */
  yReversed: boolean;
  series: OffsetSeries[];
  /** Said on the page when a plot has nothing to draw, instead of empty axes. */
  emptyReason: string | null;
}

export interface Report14Payload extends ReportEnvelope {
  wells: WellRef[];
  droppedWells: number;
  plots: OffsetPlot[];
  totals: HeaderRow;
}

/** Drop wells that contributed nothing, and say so when none did. */
function plot(
  key: OffsetPlot["key"],
  title: string,
  xLabel: string,
  yLabel: string,
  yReversed: boolean,
  series: OffsetSeries[],
  emptyReason: string,
): OffsetPlot {
  const drawn = series.filter((s) => s.points.length > 0);
  return {
    key, title, xLabel, yLabel, yReversed,
    series: drawn,
    emptyReason: drawn.length === 0 ? emptyReason : null,
  };
}

export async function buildReport14(
  prisma: PrismaClient,
  resolved: ResolvedWells,
): Promise<Report14Payload> {
  const wellIds = resolved.wells.map((w) => w.id);

  const [reports, jobs] = wellIds.length === 0 ? [[], []] : await Promise.all([
    prisma.entryReport.findMany({
      where: { wellId: { in: wellIds } },
      select: {
        wellId: true, reportDate: true, midnightDepth: true,
        mud: { select: { depthMkb: true, densityMaxPpg: true, densityMinPpg: true } },
      },
    }),
    prisma.job.findMany({
      where: { wellId: { in: wellIds } },
      select: { wellId: true, costItems: { select: { costDate: true, fieldEstimate: true } } },
    }),
  ]);

  const daysDepth: OffsetSeries[] = [];
  const spudDepth: OffsetSeries[] = [];
  const daysCost: OffsetSeries[] = [];
  const depthCost: OffsetSeries[] = [];
  const mudDepth: OffsetSeries[] = [];

  for (const well of resolved.wells) {
    const days = reports
      .filter((r) => r.wellId === well.id)
      .sort((a, b) => compareJalali(a.reportDate, b.reportDate));
    if (days.length === 0) continue;

    const first = days[0].reportDate;
    const costItems = jobs
      .filter((j) => j.wellId === well.id)
      .flatMap((j) => j.costItems)
      .filter((c) => c.costDate !== null && c.fieldEstimate !== null) as
        { costDate: string; fieldEstimate: number }[];

    const base = { wellId: well.id, wellName: well.name };
    const dd: OffsetPoint[] = [];
    const sd: OffsetPoint[] = [];
    const dc: OffsetPoint[] = [];
    const pc: OffsetPoint[] = [];

    for (const r of days) {
      const elapsed = jalaliDaysBetween(first, r.reportDate);
      const sinceSpud = jalaliDaysBetween(well.spudDate, r.reportDate);
      // Cumulative to this day, summed rather than carried forward, so a cost
      // line dated out of sequence still lands where it belongs.
      const cum = costItems
        .filter((c) => compareJalali(c.costDate, r.reportDate) <= 0)
        .reduce((sum, c) => sum + c.fieldEstimate, 0);
      const hasCost = costItems.length > 0;

      if (elapsed !== null && r.midnightDepth !== null) dd.push({ x: elapsed, y: r.midnightDepth });
      if (sinceSpud !== null && r.midnightDepth !== null) sd.push({ x: sinceSpud, y: r.midnightDepth });
      if (elapsed !== null && hasCost) dc.push({ x: elapsed, y: round(cum) });
      if (r.midnightDepth !== null && hasCost) pc.push({ x: r.midnightDepth, y: round(cum) });
    }

    // The mud programme: every check the well recorded, deepest last. Density is
    // the MAX of the day's range where one was given — a mud weight is quoted by
    // what it was raised to, not by where it started.
    const mud: OffsetPoint[] = days
      .flatMap((r) => (r.mud ? [r.mud] : []))
      .filter((m) => m.depthMkb !== null && (m.densityMaxPpg !== null || m.densityMinPpg !== null))
      .map((m) => ({
        x: (m.densityMaxPpg ?? m.densityMinPpg) as number,
        y: m.depthMkb as number,
      }))
      .sort((a, b) => a.y - b.y);

    daysDepth.push({ ...base, points: dd });
    spudDepth.push({ ...base, points: sd });
    daysCost.push({ ...base, points: dc });
    depthCost.push({ ...base, points: pc });
    mudDepth.push({ ...base, points: mud });
  }

  const withDays = daysDepth.filter((s) => s.points.length > 0).length;

  return {
    type: "14",
    title: "Drilling Offsets",
    wellName: `${resolved.wells.length} well${resolved.wells.length === 1 ? "" : "s"}`,
    headerVariant: "none",
    header: [],
    printedOn: printedOn(),
    wells: resolved.wells,
    droppedWells: resolved.dropped,
    plots: [
      plot("daysDepth", "Actual Days Vs Depth", "Days", "Depth (mKB)", true, daysDepth,
        "No well in the set has a day with a midnight depth."),
      plot("spudDepth", "Days from Spud Vs Depth", "Days from spud", "Depth (mKB)", true, spudDepth,
        "No well in the set has both a spud date and a day with a midnight depth."),
      plot("daysCost", "Actual Days Vs Cost", "Days", "Cum Field Est (Cost)", false, daysCost,
        "No well in the set has dated cost lines."),
      plot("depthCost", "Actual Depth Vs Cost", "Depth (mKB)", "Cum Field Est (Cost)", false, depthCost,
        "No well in the set has both depths and dated cost lines."),
      plot("mudDepth", "Mud WT. Vs Check Depth", "Mud density (ppg)", "Check depth (mKB)", true, mudDepth,
        "No well in the set has a mud check with both a depth and a density."),
    ],
    totals: [
      { label: "Wells", value: resolved.wells.length, kind: "int" },
      { label: "Wells With Days", value: withDays, kind: "int" },
      { label: "Days Plotted", value: daysDepth.reduce((n, s) => n + s.points.length, 0), kind: "int" },
      { label: "Mud Checks Plotted", value: mudDepth.reduce((n, s) => n + s.points.length, 0), kind: "int" },
    ],
  };
}
