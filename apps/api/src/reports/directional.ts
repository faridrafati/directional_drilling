/**
 * Report 08 — Directional Plot, Plan vs Actual.
 *
 * Two plots over one well:
 *
 *   • VERTICAL SECTION — vertical section against TVD, TVD growing downward;
 *   • PLAN             — east/west against north/south, looking down the hole.
 *
 * Each carries two curves. The PLAN curve comes from `WellPlanStation`, the
 * listing the directional company issued for the well; the ACTUAL curve comes
 * from the survey rows the crew types on the daily sheets. They are separate
 * tables on purpose: a survey belongs to the day it was shot and is replaced
 * when that day is re-saved, whereas the plan is issued once and does not move
 * when a day does.
 *
 * WHAT IS AND IS NOT DERIVED
 * --------------------------
 * NS / EW / VS are printed as ENTERED. This assembler does not run a minimum-
 * curvature closure over inc/azi to fill them in, and that is deliberate: the
 * directional company's own listing is what the well is steered against, and a
 * second, silently different set of offsets computed here would be indefensible
 * the moment the two disagreed. A station with no NS/EW simply does not appear
 * in the plan view — the curve breaks rather than jumping to the origin.
 *
 * VS is the one offset with a convention attached: it is the horizontal
 * displacement projected onto the plan's vertical-section azimuth. Where a
 * survey row has NS and EW but no VS, the closure along that azimuth would need
 * the azimuth, which no daily row carries. So VS is required for the vertical
 * section and is simply blank where it was never entered.
 */
import type { PrismaClient } from "@prisma/client";
import {
  plotWellHeader, printedOn, type HeaderRow, type ReportEnvelope,
} from "./chrome.js";
import { compareJalali } from "@dd/shared";

/** One point on either curve. Nulls are gaps, never zeros. */
export interface PlotStation {
  md: number | null;
  inc: number | null;
  azi: number | null;
  tvd: number | null;
  ns: number | null;
  ew: number | null;
  vs: number | null;
  /** Only the plan carries one — "KOP", "Target A". */
  comment?: string | null;
  /** Only the actual carries one: the day the station was shot. */
  date?: string | null;
}

export interface Report08Payload extends ReportEnvelope {
  header: HeaderRow[];
  /** The trajectory the well was designed to follow. */
  plan: PlotStation[];
  /** The surveys actually shot, oldest day first. */
  actual: PlotStation[];
  /** What each curve reached, for the caption under the plots. */
  extents: HeaderRow;
  /**
   * True when the well has no plan at all — the page then draws the actual
   * alone and SAYS so, rather than titling an empty comparison "plan vs actual".
   */
  planMissing: boolean;
}

const WELL_SELECT = {
  name: true, field: true, apiUwi: true, licenseNo: true, stateProvince: true,
  location: true, profile: true, groundElevation: true, casingFlangeElevation: true,
  kbGroundDistance: true, kbCasingFlangeDistance: true, spudDate: true, rigReleasedDate: true,
} as const;

/** The deepest value in a list, ignoring the gaps. */
function deepest(values: (number | null)[]): number | null {
  const real = values.filter((v): v is number => v !== null && Number.isFinite(v));
  return real.length ? Math.max(...real) : null;
}

export async function buildReport08(
  prisma: PrismaClient,
  wellId: string,
): Promise<Report08Payload | null> {
  const well = await prisma.entryWell.findUnique({ where: { id: wellId }, select: WELL_SELECT });
  if (!well) return null;

  const [planRows, surveyRows] = await Promise.all([
    prisma.wellPlanStation.findMany({ where: { wellId }, orderBy: { order: "asc" } }),
    prisma.entrySurvey.findMany({
      where: { report: { wellId } },
      include: { report: { select: { reportDate: true } } },
    }),
  ]);

  // Surveys are stored per day and ordered within a day. Across days the row
  // order means nothing, so they are sorted by DEPTH — the curve has to run
  // down the hole, and a day entered out of sequence would otherwise draw a
  // line back up it.
  const actual = surveyRows
    .slice()
    .sort((a, b) => {
      if (a.md !== null && b.md !== null && a.md !== b.md) return a.md - b.md;
      return compareJalali(a.report.reportDate, b.report.reportDate);
    })
    .map((r): PlotStation => ({
      md: r.md, inc: r.inc, azi: r.azi, tvd: r.tvd,
      ns: r.ns, ew: r.ew, vs: r.vs, date: r.report.reportDate,
    }));

  const plan = planRows.map((r): PlotStation => ({
    md: r.md, inc: r.inc, azi: r.azi, tvd: r.tvd,
    ns: r.ns, ew: r.ew, vs: r.vs, comment: r.comment,
  }));

  return {
    type: "08",
    title: "Directional Plot - Plan vs Actual",
    wellName: well.name,
    headerVariant: "plot",
    header: plotWellHeader(well),
    printedOn: printedOn(),
    plan,
    actual,
    planMissing: plan.length === 0,
    extents: [
      { label: "Plan Stations", value: plan.length, kind: "int" },
      { label: "Plan TD (mKB)", value: deepest(plan.map((p) => p.md)), kind: "decimal" },
      { label: "Plan TVD (mKB)", value: deepest(plan.map((p) => p.tvd)), kind: "decimal" },
      { label: "Actual Stations", value: actual.length, kind: "int" },
      { label: "Actual MD (mKB)", value: deepest(actual.map((p) => p.md)), kind: "decimal" },
      { label: "Actual TVD (mKB)", value: deepest(actual.map((p) => p.tvd)), kind: "decimal" },
    ],
  };
}
