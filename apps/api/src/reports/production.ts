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
  logs: { time: string | null; type: string | null; topMkb: number | null; btmMkb: number | null }[];
  /** The perforations and treatments done on or before this day. */
  perforations: { date: string | null; zone: string | null; topMkb: number | null; btmMkb: number | null; status: string | null }[];
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
        },
      },
      job: {
        select: {
          category: true, primaryJobType: true, secondaryJobType: true,
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
      time: c.time, des: c.des, type: c.type, com: null,
    })),
    logs: r.logRuns.map((l) => ({
      time: l.time, type: l.type, topMkb: l.topMkb, btmMkb: l.btmMkb,
    })),
    perforations: well.perforations.filter((p) => upTo(p.date)).map((p) => {
      const newest = p.statuses.slice().sort((a, b) => compareJalali(b.date, a.date))[0] ?? null;
      return {
        date: p.date, zone: p.zone?.name ?? null,
        topMkb: p.topMkb, btmMkb: p.btmMkb,
        status: newest?.status ?? null,
      };
    }),
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
  /** The rate curves, oldest first so the decline reads left to right. */
  curve: {
    endDate: string;
    qOilBblD: number | null;
    qWaterBblD: number | null;
    qResGasMcfD: number | null;
  }[];
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
    curve: byDate
      .filter((p) => p.endDate !== null)
      .map((p) => ({
        endDate: p.endDate as string,
        qOilBblD: p.qOilBblD, qWaterBblD: p.qWaterBblD, qResGasMcfD: p.qResGasMcfD,
      })),
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
