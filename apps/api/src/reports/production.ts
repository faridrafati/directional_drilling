/**
 * Reports 23 (Daily Completion and Workover), 25 (Cost of Failure by Type) and
 * 27 (Production & Maintenance History).
 *
 * These are the three completion reports that are NOT a schematic: 23 is a day,
 * 25 a fleet pivot, 27 a well's production life. They share nothing but the
 * completion tables, which is why they are together rather than with the six
 * that are built around the picture.
 */
import type { PrismaClient } from "@prisma/client";
import type { FastifyRequest } from "fastify";
import { compareJalali, jalaliKey } from "@dd/shared";
import {
  plotWellHeader, printedOn, standardWellHeader,
  type HeaderCell, type HeaderRow, type ReportEnvelope,
} from "./chrome.js";
import { buildSchematic, type SchematicPayload } from "./schematic.js";
import { durationHr } from "./daily.js";
import type { ResolvedWells, WellRef } from "./multiwell.js";
import { tubingBlocks, type TubingBlock } from "./completion.js";
import { parseInches } from "./schematic.js";

const round = (v: number, dp = 2) => Number(v.toFixed(dp));
const cell = (label: string, value: string | number | null, kind?: HeaderCell["kind"]): HeaderCell =>
  ({ label, value, kind });

function sumOrNull(values: (number | null | undefined)[], dp = 2): number | null {
  let any = false, total = 0;
  for (const v of values) {
    if (v === null || v === undefined || !Number.isFinite(v)) continue;
    any = true; total += v;
  }
  return any ? round(total, dp) : null;
}

/* ══ report 23 — Daily Completion and Workover ═══════════════════════════════ */

/** A tubing string as report 23 prints it — run or pulled on the day. */
export interface TubingDayRow {
  time: string | null;
  description: string | null;
  setDepthMkb: number | null;
  maxNominalOdIn: string | null;
  massPerLenKgM: number | null;
  grade: string | null;
}

/** The widest nominal OD in a string, and its heaviest joint — as the sample prints. */
function tubingDayRow(
  t: {
    description: string | null; setDepthMkb: number | null;
    components: { odIn: string | null; massPerLenKgM: number | null; grade: string | null }[];
  },
  time: string | null,
): TubingDayRow {
  // "String Max Nominal OD" is the WIDEST component, not the first: a completion
  // is a taper, and the number that matters for what it will pass through is the
  // largest one in it.
  let widest: string | null = null;
  let widestVal = -1;
  for (const c of t.components) {
    const v = parseInches(c.odIn);
    if (v !== null && v > widestVal) { widestVal = v; widest = c.odIn; }
  }
  const body = t.components.find((c) => c.massPerLenKgM !== null) ?? t.components[0] ?? null;
  return {
    time,
    description: t.description,
    setDepthMkb: t.setDepthMkb,
    maxNominalOdIn: widest,
    massPerLenKgM: body?.massPerLenKgM ?? null,
    grade: body?.grade ?? null,
  };
}

export interface Report23Payload extends ReportEnvelope {
  identityRight: string | null;
  completionHeader: HeaderRow;
  caption: string;
  schematic: SchematicPayload;
  jobHeader: HeaderRow[];
  dailyReadings: HeaderRow;
  contacts: { jobContact: string | null; title: string | null; mobile: string | null }[];
  timeLog: {
    startTime: string | null; endTime: string | null; durHr: number | null;
    code1: string | null; code2: string | null; com: string | null;
  }[];
  fluids: { fluid: string | null; toWellBbl: number | null; fromWellBbl: number | null }[];
  safetyChecks: { time: string | null; des: string | null; type: string | null; com: string | null }[];
  logs: { time: string | null; type: string | null; topMkb: number | null; btmMkb: number | null; cased: boolean | null }[];
  /** The perforations and treatments done on or before this day. */
  perforations: { date: string | null; zone: string | null; topMkb: number | null; btmMkb: number | null; status: string | null }[];
  /** What went in and what came out ON THIS DAY — five tables the sample prints. */
  tubingRun: TubingDayRow[];
  tubingPulled: TubingDayRow[];
  otherInHoleRun: { time: string | null; des: string | null; odIn: string | null; topMkb: number | null; btmMkb: number | null }[];
  otherInHolePulled: { time: string | null; des: string | null; topMkb: number | null; btmMkb: number | null; odIn: string | null }[];
  cementOnDay: { startTime: string | null; des: string | null; type: string | null; string: string | null; company: string | null }[];
  stimulations: { date: string | null; time: string | null; zone: string | null; type: string | null; deliveryMode: string | null; company: string | null }[];
}

export async function buildReport23(
  prisma: PrismaClient,
  reportId: string,
): Promise<Report23Payload | null> {
  const r = await prisma.entryReport.findUnique({
    where: { id: reportId },
    include: {
      well: {
        select: {
          name: true, field: true, apiUwi: true, licenseNo: true, stateProvince: true,
          location: true, profile: true, groundElevation: true, casingFlangeElevation: true,
          kbGroundDistance: true, kbCasingFlangeDistance: true, spudDate: true, rigReleasedDate: true,
          rtElevation: true, kbTubingHeadDistance: true,
          rig: { select: { name: true, contractor: true } },
          wellbores: { orderBy: { order: "asc" }, select: { name: true } },
          plugBacks: { orderBy: { order: "asc" }, select: { depthMkb: true } },
          perforations: {
            orderBy: { order: "asc" },
            include: { statuses: { orderBy: { order: "asc" } }, zone: { select: { name: true } } },
          },
          stimulations: {
            orderBy: { order: "asc" },
            include: { zone: { select: { name: true } } },
          },
          tubingStrings: {
            orderBy: { order: "asc" },
            include: { components: { orderBy: { order: "asc" } } },
          },
          otherInHole: { orderBy: { order: "asc" } },
          casingStrings: {
            orderBy: { order: "asc" },
            include: { cementJobs: { orderBy: { order: "asc" } } },
          },
        },
      },
      job: {
        select: {
          category: true, primaryJobType: true, secondaryJobType: true, targetFormation: true,
          afes: { orderBy: { order: "asc" }, select: { afeNumber: true, amount: true, supplements: { select: { amount: true } } } },
          costItems: { select: { costDate: true, fieldEstimate: true } },
        },
      },
      operations: { orderBy: { order: "asc" } },
      supervisors: { orderBy: { order: "asc" } },
      mudVolumes: { orderBy: { order: "asc" } },
      safetyChecks: { orderBy: { order: "asc" } },
      logRuns: { orderBy: { order: "asc" } },
    },
  });
  if (!r) return null;
  const well = r.well;

  const [schematic, deepest] = await Promise.all([
    buildSchematic(prisma, r.wellId),
    prisma.entryReport.findMany({ where: { wellId: r.wellId }, select: { midnightDepth: true } }),
  ]);
  const totalDepth = deepest.reduce<number | null>(
    (d, x) => (x.midnightDepth !== null && (d === null || x.midnightDepth > d) ? x.midnightDepth : d), null);
  const pbtd = well.plugBacks.reduce<number | null>(
    (d, p) => (p.depthMkb !== null && (d === null || p.depthMkb > d) ? p.depthMkb : d), null);
  const boreName = well.wellbores[0]?.name ?? "Original Hole";
  const at = (depth: number | null) => (depth === null ? null : `${boreName} - ${depth.toFixed(1)}`);

  // The day's own cost and the running total, sliced by date exactly as every
  // other cost-carrying report in this suite slices it.
  const items = r.job?.costItems ?? [];
  let daily = 0, cum = 0, anyDaily = false, anyCum = false;
  for (const c of items) {
    if (c.costDate === null || c.fieldEstimate === null) continue;
    const cmp = compareJalali(c.costDate, r.reportDate);
    if (cmp > 0) continue;
    cum += c.fieldEstimate; anyCum = true;
    if (cmp === 0) { daily += c.fieldEstimate; anyDaily = true; }
  }
  const afe = r.job?.afes[0] ?? null;
  const afeSupp = sumOrNull((r.job?.afes ?? []).flatMap((a) => [a.amount, ...a.supplements.map((s) => s.amount)]));

  // Only what had HAPPENED by this day: a workover sheet that lists a
  // perforation shot next week is a plan, not a record.
  const dayKey = jalaliKey(r.reportDate);
  const upTo = (d: string | null) => {
    const k = jalaliKey(d);
    return k === null || dayKey === null || k <= dayKey;
  };

  return {
    type: "23",
    title: "Daily Completion and Workover (schematic)",
    wellName: well.name,
    identityRight: `Report # ${r.serialNo}, Report Date: ${r.reportDate}`,
    headerVariant: "standard",
    header: standardWellHeader(well),
    printedOn: printedOn(),
    completionHeader: [
      cell("Original KB Elevation (m)", well.rtElevation, "decimal"),
      cell("KB-Tubing Head Distance (m)", well.kbTubingHeadDistance, "decimal"),
      cell("Spud Date", well.spudDate),
      cell("Rig Release Date", well.rigReleasedDate),
      cell("PBTD (All) (mKB)", at(pbtd)),
      cell("Total Depth All (mKB)", at(totalDepth)),
    ],
    caption: [well.profile, boreName].filter(Boolean).join(" - "),
    schematic,
    jobHeader: [
      [
        cell("Primary Job Type", r.job?.primaryJobType ?? null),
        cell("Secondary Job Type", r.job?.secondaryJobType ?? null),
        cell("Objective", r.job?.targetFormation ?? null),
      ],
      [
        cell("Contractor", well.rig.contractor ?? null),
        cell("Rig Number", well.rig.name),
      ],
      [
        cell("AFE Number", afe?.afeNumber ?? null),
        cell("AFE+Supp Amt (Cost)", afeSupp, "money"),
        cell("Daily Field Est Total (Cost)", anyDaily ? round(daily) : null, "money"),
        cell("Cum Field Est To Date (Cost)", anyCum ? round(cum) : null, "money"),
      ],
    ],
    dailyReadings: [
      cell("Weather", r.weather),
      cell("T (°C)", r.temperatureC, "decimal"),
      cell("Road Condition", r.roadCondition),
      // A completion day reports tubing and casing pressure where a drilling
      // day reports depth; neither is on the other's sheet.
      cell("P Tub (psi)", r.pTubingPsi, "decimal"),
      cell("P Cas (psi)", r.pCasingPsi, "decimal"),
      cell("Rig Time (hr)", sumOrNull(r.operations.map((op) => durationHr(op.fromTime, op.toTime))), "decimal"),
    ],
    contacts: r.supervisors.map((s) => ({
      jobContact: s.jobContact, title: s.position, mobile: s.mobile,
    })),
    timeLog: r.operations.map((op) => ({
      startTime: op.fromTime, endTime: op.toTime,
      durHr: durationHr(op.fromTime, op.toTime),
      code1: op.opDetail ?? op.opLetter, code2: op.opCode2, com: op.remarks,
    })),
    fluids: r.mudVolumes.map((v) => ({
      fluid: v.action, toWellBbl: v.toWellBbl, fromWellBbl: v.fromWellBbl,
    })),
    safetyChecks: r.safetyChecks.map((c) => ({
      time: c.time, des: c.des, type: c.type, com: c.com,
    })),
    logs: r.logRuns.map((l) => ({
      time: l.time, type: l.type, topMkb: l.topMkb, btmMkb: l.btmMkb, cased: l.cased,
    })),
    perforations: well.perforations.filter((p) => upTo(p.date)).map((p) => {
      const newest = p.statuses.slice().sort((a, b) => compareJalali(b.date, a.date))[0] ?? null;
      return {
        date: p.date, zone: p.zone?.name ?? null,
        topMkb: p.topMkb, btmMkb: p.btmMkb,
        status: newest?.status ?? null,
      };
    }),
    // The five day-scoped tables. Each is the register FILTERED to this day —
    // a completion sheet says what happened today, not what the well contains,
    // and the same rows read against a different day are a different report.
    tubingRun: well.tubingStrings
      .filter((t) => t.runDate !== null && jalaliKey(t.runDate) === dayKey)
      .map((t) => tubingDayRow(t, t.runDate)),
    tubingPulled: well.tubingStrings
      .filter((t) => t.pullDate !== null && jalaliKey(t.pullDate) === dayKey)
      .map((t) => tubingDayRow(t, t.pullDate)),
    otherInHoleRun: well.otherInHole
      .filter((o) => o.runDate !== null && jalaliKey(o.runDate) === dayKey)
      .map((o) => ({ time: o.runDate, des: o.des, odIn: o.odIn, topMkb: o.topMkb, btmMkb: o.btmMkb })),
    otherInHolePulled: well.otherInHole
      .filter((o) => o.pullDate !== null && jalaliKey(o.pullDate) === dayKey)
      .map((o) => ({ time: o.pullDate, des: o.des, topMkb: o.topMkb, btmMkb: o.btmMkb, odIn: o.odIn })),
    cementOnDay: well.casingStrings.flatMap((c) =>
      c.cementJobs
        .filter((j) => j.startDate !== null && jalaliKey(j.startDate) === dayKey)
        .map((j) => ({
          startTime: j.startDate, des: j.description, type: "Casing",
          string: c.description, company: j.company,
        }))),
    stimulations: well.stimulations.filter((st) => upTo(st.date)).map((st) => ({
      date: st.date, time: st.time, zone: st.zone?.name ?? null,
      type: st.type, deliveryMode: st.deliveryMode, company: st.company,
    })),
  };
}

/* ══ report 25 — Cost of Failure by Type ═════════════════════════════════════ */

export interface FailureCostCell {
  well: string;
  failureType: string;
  cost: number;
  count: number;
}

export interface Report25Payload extends ReportEnvelope {
  wells: WellRef[];
  droppedWells: number;
  /** X axis: the wells, in descending total failure cost. */
  wellTotals: { well: string; cost: number; count: number }[];
  /** The stack's series, in descending total cost. */
  failureTypes: string[];
  cells: FailureCostCell[];
  totals: HeaderRow;
}

/** Report 25's own name for an unclassified failure — the sample's word. */
const BLANK = "(blank)";

export async function buildReport25(
  prisma: PrismaClient,
  resolved: ResolvedWells,
): Promise<Report25Payload> {
  const wellIds = resolved.wells.map((w) => w.id);
  const failures = wellIds.length === 0 ? [] : await prisma.equipmentFailure.findMany({
    where: { wellId: { in: wellIds } },
    include: { well: { select: { name: true } } },
  });

  const cells = new Map<string, FailureCostCell>();
  const wellTotals = new Map<string, { cost: number; count: number }>();
  const typeTotals = new Map<string, number>();
  let total = 0;

  for (const f of failures) {
    const well = f.well.name;
    // The sample's own label for a failure nobody classified. Folding these
    // into "Other" would claim somebody made a judgement they did not.
    const failureType = f.failureType ?? BLANK;
    const cost = f.cost ?? 0;
    const key = `${well} ${failureType}`;

    const c = cells.get(key) ?? { well, failureType, cost: 0, count: 0 };
    c.cost += cost; c.count += 1;
    cells.set(key, c);

    const wt = wellTotals.get(well) ?? { cost: 0, count: 0 };
    wt.cost += cost; wt.count += 1;
    wellTotals.set(well, wt);

    typeTotals.set(failureType, (typeTotals.get(failureType) ?? 0) + cost);
    total += cost;
  }

  return {
    type: "25",
    title: "Cost of Failure by Type",
    wellName: `${resolved.wells.length} well${resolved.wells.length === 1 ? "" : "s"}`,
    headerVariant: "none",
    header: [],
    printedOn: printedOn(),
    wells: resolved.wells,
    droppedWells: resolved.dropped,
    wellTotals: [...wellTotals.entries()]
      .map(([well, t]) => ({ well, cost: round(t.cost), count: t.count }))
      .sort((a, b) => b.cost - a.cost),
    failureTypes: [...typeTotals.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t),
    cells: [...cells.values()].map((c) => ({ ...c, cost: round(c.cost) })),
    totals: [
      cell("Failures", failures.length, "int"),
      cell("Total Cost", total === 0 ? null : round(total), "money"),
      cell("Failure Types", typeTotals.size, "int"),
      cell("Unclassified", failures.filter((f) => !f.failureType).length, "int"),
      cell("Wells", resolved.wells.length, "int"),
    ],
  };
}

/* ══ report 27 — Production & Maintenance History ════════════════════════════ */

export interface ProductionRow {
  startDate: string | null;
  endDate: string | null;
  activityType: string | null;
  zone: string | null;
  prodTimeDays: number | null;
  downTimeDays: number | null;
  volResGasMcf: number | null;
  volOilBbl: number | null;
  volWaterBbl: number | null;
  qResGasMcfD: number | null;
  qOilBblD: number | null;
  qWaterBblD: number | null;
  waterGasRatioPct: number | null;
}

export interface Report27Payload extends ReportEnvelope {
  /** The sample prints the zone and activity it is filtered to, top right. */
  filterLine: string | null;
  /** Most recent FIRST, as the sample's own caption says. */
  rows: ProductionRow[];
  /**
   * The three curves the sample plots, oldest first so the decline reads left to
   * right. Rate, cumulative VOLUME and cumulative % downtime are three different
   * questions about the same periods — a well can hold its rate while its
   * downtime climbs, and only the third panel shows it.
   */
  curve: {
    endDate: string;
    qOilBblD: number | null;
    qWaterBblD: number | null;
    qResGasMcfD: number | null;
    /** Running totals to this period — derived, never stored. */
    cumOilBbl: number | null;
    cumWaterBbl: number | null;
    cumResGasMcf: number | null;
    /** Downtime as a share of all elapsed time so far, in percent. */
    cumDownTimePct: number | null;
  }[];
  /** The sample's "Completion/Workover Job History" table. */
  jobHistory: {
    jobType: string | null; startDate: string | null; endDate: string | null; summary: string | null;
  }[];
  /** The sample's "Tubing/Components" block, beside the history. */
  tubingStrings: TubingBlock[];
  totals: HeaderRow;
}

export async function buildReport27(
  prisma: PrismaClient,
  wellId: string,
): Promise<Report27Payload | null> {
  const well = await prisma.entryWell.findUnique({
    where: { id: wellId },
    select: {
      name: true, field: true, apiUwi: true, licenseNo: true, stateProvince: true,
      location: true, profile: true, groundElevation: true, casingFlangeElevation: true,
      kbGroundDistance: true, kbCasingFlangeDistance: true, spudDate: true, rigReleasedDate: true,
      productionPeriods: {
        orderBy: { order: "asc" },
        include: { zone: { select: { name: true } } },
      },
      tubingStrings: {
        orderBy: { order: "asc" },
        include: { components: { orderBy: { order: "asc" } } },
      },
      jobs: { orderBy: { order: "asc" } },
    },
  });
  if (!well) return null;

  const periods = well.productionPeriods;
  // Oldest first for the curve, newest first for the table — the sample says
  // "Most Recent at Top" for the one and plots time left-to-right for the other.
  const byDate = periods.slice().sort((a, b) => compareJalali(a.endDate, b.endDate));

  const zones = [...new Set(periods.map((p) => p.zone?.name).filter(Boolean))];
  const activities = [...new Set(periods.map((p) => p.activityType).filter(Boolean))];

  return {
    type: "27",
    title: "Production & Maintenance History",
    wellName: well.name,
    headerVariant: "plot",
    header: plotWellHeader(well),
    printedOn: printedOn(),
    filterLine: periods.length === 0 ? null : [
      zones.length === 1 ? `Zone: ${zones[0]}` : zones.length > 1 ? `Zone: (${zones.length})` : null,
      activities.length === 1 ? `Activity Type: ${activities[0]}` : null,
    ].filter(Boolean).join("   ") || null,
    rows: byDate.slice().reverse().map((p) => ({
      startDate: p.startDate, endDate: p.endDate, activityType: p.activityType,
      zone: p.zone?.name ?? null,
      prodTimeDays: p.prodTimeDays, downTimeDays: p.downTimeDays,
      volResGasMcf: p.volResGasMcf, volOilBbl: p.volOilBbl, volWaterBbl: p.volWaterBbl,
      qResGasMcfD: p.qResGasMcfD, qOilBblD: p.qOilBblD, qWaterBblD: p.qWaterBblD,
      waterGasRatioPct: p.waterGasRatioPct,
    })),
    curve: (() => {
      // Running totals, accumulated in date order. Cumulative production is
      // DERIVED for the same reason "Pl Cum Days ML" is on report 22: a stored
      // running total is a second source of truth that goes wrong the first time
      // a period is corrected.
      let oil = 0, water = 0, gas = 0, up = 0, down = 0;
      let anyOil = false, anyWater = false, anyGas = false, anyTime = false;
      return byDate
        .filter((p) => p.endDate !== null)
        .map((p) => {
          if (p.volOilBbl !== null) { oil += p.volOilBbl; anyOil = true; }
          if (p.volWaterBbl !== null) { water += p.volWaterBbl; anyWater = true; }
          if (p.volResGasMcf !== null) { gas += p.volResGasMcf; anyGas = true; }
          if (p.prodTimeDays !== null) { up += p.prodTimeDays; anyTime = true; }
          if (p.downTimeDays !== null) { down += p.downTimeDays; anyTime = true; }
          const elapsed = up + down;
          return {
            endDate: p.endDate as string,
            qOilBblD: p.qOilBblD, qWaterBblD: p.qWaterBblD, qResGasMcfD: p.qResGasMcfD,
            cumOilBbl: anyOil ? round(oil) : null,
            cumWaterBbl: anyWater ? round(water) : null,
            cumResGasMcf: anyGas ? round(gas) : null,
            cumDownTimePct: anyTime && elapsed > 0 ? round((down / elapsed) * 100) : null,
          };
        });
    })(),
    // Only the jobs this report is ABOUT. A drilling job is not completion or
    // workover history, and listing it would make the table answer a question
    // nobody asked of it.
    jobHistory: well.jobs
      .filter((j) => /completion|workover/i.test(`${j.category ?? ""} ${j.primaryJobType ?? ""}`))
      .map((j) => ({
        jobType: j.secondaryJobType ?? j.primaryJobType,
        startDate: j.startDate, endDate: j.endDate, summary: j.summary,
      })),
    tubingStrings: tubingBlocks(well.tubingStrings),
    totals: [
      cell("Periods", periods.length, "int"),
      cell("Prod Time (days)", sumOrNull(periods.map((p) => p.prodTimeDays)), "decimal"),
      cell("Down Time (days)", sumOrNull(periods.map((p) => p.downTimeDays)), "decimal"),
      cell("Cum Oil (bbl)", sumOrNull(periods.map((p) => p.volOilBbl)), "decimal"),
      cell("Cum Water (bbl)", sumOrNull(periods.map((p) => p.volWaterBbl)), "decimal"),
      cell("Cum Res Gas (MCF)", sumOrNull(periods.map((p) => p.volResGasMcf)), "decimal"),
    ],
  };
}

/** Kept so the route file can narrow a request without re-importing fastify. */
export type MultiWellRequest = FastifyRequest<{ Querystring: { wellIds?: string } }>;
