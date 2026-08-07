/**
 * Reports 06 (Daily Drilling) and 07 (Daily Drilling — Detail).
 *
 * One assembler for both: 07 IS 06 plus more. They share a well, a day, a time
 * log, mud checks, drill strings, drilling parameters, contacts, rigs, pumps and
 * safety checks; 07 adds TVD depths, the problem-time arithmetic, the personnel
 * log, mud volumes, hydraulics, survey data, formations, kicks, lost circulation
 * and — on its second page — problems, lessons and incidents.
 *
 * Building them together is what keeps them honest: the sample's two reports
 * print the SAME time log with the same durations, and two assemblers would
 * eventually disagree about a rounding rule.
 *
 * WHAT IS COMPUTED HERE
 * ---------------------
 * Everything the samples show as derived, and nothing else:
 *
 *   Depth Progress   = End Depth − Start Depth
 *   Dur (hr)         = each interval's own end − start, wrapping past midnight
 *   Cum Dur (hr)     = the running total down the day's log (reaches 24.00)
 *   Int ROP          = Cum Depth ÷ Cum Drill Time
 *   BHA ROP          = the string's depth drilled ÷ its drilling hours
 *   String Length    = Σ component lengths      Max Nominal OD = max component OD
 *   Day Total        = Σ the day's cost lines   Cum To Date = Σ up to this day
 *   Problem Time     = Σ the log's problem hours
 *   % Problem Time   = problem hours ÷ time-log hours
 *   DFS              = days from spud, the spud day being day 1
 *
 * A zero-length interval is NOT a zero-hour operation: the archive writes
 * 00:00→00:00 when the clock was never filled in, so it contributes nothing
 * rather than a printed 0.00. Same rule the DDR viewer already uses.
 */
import type { PrismaClient } from "@prisma/client";
import { jalaliDaysBetween, jalaliInRange, jalaliKey } from "@dd/shared";
// The hydraulics live in the shared drilling module — the same helpers the
// ROP-optimization page uses, so report 07 cannot print a different number for
// the same bit.
import { bitHHP, hsi as hsiOf, jetImpact, nozzlePressureDrop } from "@dd/shared/drilling";
import {
  printedOn, type HeaderCell, type HeaderRow, type ReportEnvelope,
} from "./chrome.js";

// ── time helpers ────────────────────────────────────────────────────────────

/** "HH:MM" → minutes past midnight. Hours may run past 24 (the 00:00–06:00
 *  morning extension is logged as 24:00–07:00). */
function minutesOf(x: string | null | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec((x ?? "").trim());
  if (!m) return null;
  const hh = Number(m[1]), mm = Number(m[2]);
  return hh <= 48 && mm < 60 ? hh * 60 + mm : null;
}

/**
 * One interval's own duration, wrapping past midnight (23:00 → 01:00 = 2 hr).
 *
 * A zero span returns null, not 0: the crew writes the same time twice when the
 * clock was never filled in, and printing 0.00 there invents a duration and
 * makes the day look accounted for when it is not.
 */
export function durationHr(from: string | null, to: string | null): number | null {
  const a = minutesOf(from), b = minutesOf(to);
  if (a === null || b === null || a === b) return null;
  return Number((((b > a ? b - a : b + 1440 - a)) / 60).toFixed(2));
}

const round = (n: number, dp = 2) => Number(n.toFixed(dp));
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

// ── printed shapes ──────────────────────────────────────────────────────────

export interface TimeLogRow {
  startTime: string | null;
  endTime: string | null;
  durHr: number | null;
  cumDurHr: number | null;
  code1: string | null;
  code2: string | null;
  /** Report 07 only. */
  isProblem: boolean;
  probHr: number | null;
  probRef: number | null;
  com: string | null;
}

export interface MudCheckBlock {
  /** The sub-header the sample prints: "<depth>mKB, <date> <time>". */
  caption: string;
  fields: HeaderRow[];
}

export interface DrillStringBlock {
  /** "BHA #2, 26in Drilling Assy" — the block's own sub-header. */
  caption: string;
  fields: HeaderRow;
  /** Comma-separated component descriptions, in make-up order. */
  components: string | null;
  comment: string | null;
  /** Report 07 prints the itemised tally instead of the one-line summary. */
  tally: {
    itemDes: string | null; jts: number | null; odIn: number | null;
    idIn: number | null; lenM: number | null; topThread: string | null;
  }[];
}

export interface DrillingParamRow {
  wellbore: string | null;
  startMkb: number | null;
  endDepthMkb: number | null;
  cumDepthM: number | null;
  drillTimeHr: number | null;
  cumDrillTimeHr: number | null;
  intRopMHr: number | null;
  qFlowGpm: number | null;
  wob1000Lbf: number | null;
  rpm: number | null;
  sppPsi: number | null;
  drillStrWtKlbf: number | null;
  puStrWtKlbf: number | null;
  soStrWtKlbf: number | null;
  drillTq: number | null;
  offBottomTorque: number | null;
}

export interface PumpBlock {
  caption: string;
  fields: HeaderRow[];
}

export interface DailyPayload extends ReportEnvelope {
  /** "06" or "07" — the two share this payload. */
  type: string;
  /** The title band's right-hand lines. */
  titleFields: HeaderRow;
  operations: HeaderRow[];
  timeLog: TimeLogRow[];
  timeLogTotalHr: number | null;
  mudChecks: MudCheckBlock[];
  drillStrings: DrillStringBlock[];
  drillingParameters: DrillingParamRow[];
  contacts: { jobContact: string | null; mobile: string | null }[];
  rigs: HeaderRow[];
  pumps: PumpBlock[];
  mudAdditives: { des: string | null; fieldEstPerUnit: number | null; consumed: number | null }[];
  safetyChecks: { time: string | null; type: string | null; des: string | null }[];
  wellbores: { name: string | null; koMdMkb: number | null }[];
  // ── report 07 only ──
  detail?: {
    counters: HeaderRow[];
    personnelLog: { type: string | null; count: number | null; totWorkTimeHr: number | null }[];
    safetyCheckSummary: { type: string; lastDate: string | null; nextDate: string | null }[];
    mudVolumes: {
      action: string | null; toWellBbl: number | null; fromWellBbl: number | null;
      cumToWellBbl: number | null; cumFromWellBbl: number | null;
    }[];
    hydraulics: HeaderRow[];
    surveys: { mdMkb: number | null; inc: number | null; azm: number | null; tvdMkb: number | null }[];
    lastFormations: { name: string | null; progTopMd: number | null; drillTopMd: number | null }[];
    lastCasing: { description: string | null; runDate: string | null; setDepthMkb: number | null }[];
    kicks: {
      kickDate: string | null; kickDepthMkb: number | null; controlDate: string | null;
      controlDepthMkb: number | null; kickClass: string | null; killNotes: string | null;
    }[];
    lostCirculation: {
      startDate: string | null; topDepthMkb: number | null; bottomDepthMkb: number | null;
      opsInProg: string | null; volLostTotBbl: number | null; endDate: string | null;
    }[];
    problems: {
      problemType: string | null; problemSubType: string | null; startDate: string | null;
      startDepthMkb: number | null; endDepthMkb: number | null; accountableParty: string | null;
      estCost: number | null; estLostTimeHr: number | null; comment: string | null;
    }[];
    lessons: {
      lessonType: string | null; startDate: string | null; endDate: string | null;
      startDepthMkb: number | null; endDepthMkb: number | null;
      estCostSaving: number | null; estTimeSavingHr: number | null; comment: string | null;
    }[];
    incidents: {
      time: string | null; category: string | null; type: string | null; subType: string | null;
      cause: string | null; lostTime: boolean | null; severity: string | null;
    }[];
  };
}

const cell = (label: string, value: string | number | null, kind?: HeaderCell["kind"]): HeaderCell =>
  ({ label, value, kind });

/**
 * Build report 06 or 07 for one well-day.
 *
 * `detail` decides which: false gives the one-page morning report, true adds
 * everything the legal-size sheet carries.
 */
export async function buildDailyReport(
  prisma: PrismaClient,
  reportId: string,
  detail: boolean,
): Promise<DailyPayload | null> {
  const r = await prisma.entryReport.findUnique({
    where: { id: reportId },
    include: {
      well: {
        include: {
          rig: true,
          wellbores: { orderBy: { order: "asc" } },
          lessons: { orderBy: { order: "asc" } },
          kicks: { orderBy: { order: "asc" } },
          lostCirculation: { orderBy: { order: "asc" } },
        },
      },
      job: { include: { afes: { orderBy: { order: "asc" }, include: { supplements: true } } } },
      mud: true,
      operations: { orderBy: { order: "asc" } },
      drillStrings: { orderBy: { order: "asc" }, include: { components: { orderBy: { order: "asc" } } } },
      bitRuns: { orderBy: { order: "asc" } },
      drillingParameters: { orderBy: { order: "asc" }, include: { wellbore: true } },
      chemicals: { orderBy: { order: "asc" } },
      supervisors: { orderBy: { order: "asc" } },
      companies: { orderBy: { order: "asc" } },
      hseDrills: true,
      safetyChecks: { orderBy: { order: "asc" } },
      safetyIncidents: { orderBy: { order: "asc" } },
      intervalProblems: { orderBy: { order: "asc" } },
      mudVolumes: { orderBy: { order: "asc" } },
      scrRates: { orderBy: { order: "asc" }, include: { mudPump: true } },
      surveys: { orderBy: { order: "asc" } },
      formationTops: { orderBy: { order: "asc" } },
      casing: { orderBy: { order: "asc" } },
    },
  });
  if (!r) return null;
  const well = r.well;

  // ── the day's cost, and the campaign's to date ──────────────────────────
  // Both come from the SAME CostItem rows report 01 prints; there is no second
  // per-day cost table to disagree with.
  const costItems = r.jobId
    ? await prisma.costItem.findMany({
      where: { jobId: r.jobId },
      select: { fieldEstimate: true, costDate: true, category: true },
    })
    : [];
  const today = jalaliKey(r.reportDate);
  const onOrBefore = (d: string | null) => {
    const k = jalaliKey(d);
    return k !== null && today !== null && k <= today;
  };
  const isToday = (d: string | null) => jalaliKey(d) === today;
  const dayTotal = sumOrNull(costItems.filter((c) => isToday(c.costDate)).map((c) => c.fieldEstimate));
  const cumToDate = sumOrNull(costItems.filter((c) => onOrBefore(c.costDate)).map((c) => c.fieldEstimate));
  const mudDay = sumOrNull(costItems.filter((c) => c.category === "mud" && isToday(c.costDate)).map((c) => c.fieldEstimate));
  const mudCum = sumOrNull(costItems.filter((c) => c.category === "mud" && onOrBefore(c.costDate)).map((c) => c.fieldEstimate));

  const afe = r.job?.afes[0] ?? null;
  const afePlusSupp = afe
    ? sumOrNull([afe.amount, ...(afe.supplements ?? []).map((s) => s.amount)])
    : null;

  // ── title band ─────────────────────────────────────────────────────────
  // DFS is days from spud with the spud day counting as day 1, which is what
  // makes the sample's "Report #: 2.0, DFS: 2.00" agree on the second day.
  const elapsed = jalaliDaysBetween(well.spudDate, r.reportDate);
  const dfs = elapsed === null ? null : elapsed + 1;
  const depthProgress = r.midnightDepth !== null && r.previousDepth !== null
    ? round(r.midnightDepth - r.previousDepth) : null;

  // ── time log ───────────────────────────────────────────────────────────
  let cum = 0;
  let cumAny = false;
  const timeLog: TimeLogRow[] = r.operations.map((op) => {
    const dur = durationHr(op.fromTime, op.toTime);
    if (dur !== null) { cum += dur; cumAny = true; }
    return {
      startTime: op.fromTime,
      endTime: op.toTime,
      durHr: dur,
      cumDurHr: dur === null ? null : round(cum),
      // Code 1 is the numeric detail, Code 2 the alpha code beside it. The
      // composite `opCode` stays available on the remark line if neither is set.
      code1: op.opDetail ?? (op.opLetter ? `${op.opLetter}` : op.opCode),
      code2: op.opCode2,
      isProblem: op.isProblem,
      probHr: op.probHr,
      probRef: op.problemRef,
      com: op.remarks,
    };
  });
  const timeLogTotalHr = cumAny ? round(cum) : null;
  const problemHr = sumOrNull(r.operations.map((op) => (op.isProblem ? op.probHr : null)));

  // ── mud checks ─────────────────────────────────────────────────────────
  const m = r.mud;
  const mudChecks: MudCheckBlock[] = m
    ? [{
      caption: [m.depthMkb !== null ? `${m.depthMkb.toFixed(1)}mKB` : null, r.reportDate, m.reportTime]
        .filter(Boolean).join(", "),
      fields: detail
        ? [
          [cell("Type", m.mudSystem), cell("Time", m.reportTime), cell("Depth (mKB)", m.depthMkb),
            cell("Density (ppg)", m.densityMaxPpg ?? m.densityMinPpg), cell("Vis (s/qt)", m.funnelVisc),
            cell("PV Calc (cp)", m.pv), cell("YP Calc (lbf/100ft²)", m.yp)],
          [cell("Gel (10s)", m.gelInitial), cell("Gel (10m)", m.gel10min), cell("Gel (30m)", m.gel30min),
            cell("Filtrate (mL/30min)", m.filtrateMl), cell("Filter Cake (1/32\")", m.filterCake32nds),
            cell("pH", m.ph), cell("Solids (%)", m.solidsPct)],
          [cell("MBT (lb/bbl)", m.mbt), cell("Percent Oil (%)", m.oilPct), cell("Percent Water (%)", m.percentWater),
            cell("Chlorides (mg/L)", m.chloride), cell("Calcium (mg/L)", m.hardnessCaPpm),
            cell("Potassium (mg/L)", m.potassiumMgL), cell("Electric Stab (V)", m.eStability)],
        ]
        : [
          [cell("Type", m.mudSystem), cell("Time", m.reportTime), cell("Depth (mKB)", m.depthMkb),
            cell("Density (ppg)", m.densityMaxPpg ?? m.densityMinPpg),
            cell("Funnel Viscosity (s/qt)", m.funnelVisc), cell("PV Override (cp)", m.pv),
            cell("YP OR (lbf/100ft²)", m.yp)],
          [cell("Gel 10 sec", m.gelInitial), cell("Gel 10 min", m.gel10min),
            cell("Filtrate (mL/30min)", m.filtrateMl), cell("Filter Cake (1/32\")", m.filterCake32nds),
            cell("pH", m.ph), cell("Sand (%)", m.sandPct), cell("Solids (%)", m.solidsPct)],
          [cell("MBT (lb/bbl)", m.mbt), cell("Alkalinity (mL/mL)", m.alkalinity),
            cell("Chlorides (mg/L)", m.chloride), cell("Calcium (mg/L)", m.hardnessCaPpm),
            cell("Pf (mL/mL)", m.pf), cell("Pm (mL/mL)", m.pm), cell("Gel 30 min", m.gel30min)],
          [cell("Whole Mud Added (bbl)", m.wholeMudAddedBbl), cell("Mud Lost to Hole (bbl)", m.mudLostBbl),
            cell("Mud Lost to Surface (bbl)", m.mudLostSurfBbl),
            cell("Reserve Mud Volume (bbl)", m.volMudResBbl),
            cell("Active Mud Volume (bbl)", m.activeMudVolBbl)],
        ],
    }]
    : [];

  // ── drill strings ──────────────────────────────────────────────────────
  // The bit run is paired POSITIONALLY with the string, the way the daily sheet
  // is filled in: both are typed top to bottom on the same form.
  const drillStrings: DrillStringBlock[] = r.drillStrings.map((s, i) => {
    const bit = r.bitRuns[i] ?? null;
    const stringLength = sumOrNull(s.components.map((c) => c.lenM));
    const odValues = s.components.map((c) => c.odIn).filter((v): v is number => v !== null);
    const maxOd = odValues.length ? Math.max(...odValues) : null;
    const bhaRop = ratio(s.depthDrilledM, s.drillingTimeHr, 1);
    const drillBit = [bit?.size, bit?.type ?? bit?.model, bit?.bitSerialNo]
      .filter((x) => x !== null && x !== undefined && x !== "").join(", ") || null;
    return {
      caption: [s.bhaNo !== null ? `BHA #${s.bhaNo}` : null, s.name].filter(Boolean).join(", "),
      fields: detail
        ? [
          cell("Bit Run", bit?.bitNo ?? null), cell("Drill Bit", drillBit),
          cell("IADC Bit Dull", bit?.dullGrade ?? null), cell("TFA (incl Noz) (in²)", bit?.tfa ?? null),
          cell("Nozzles (1/32\")", bit?.nozzles ?? null),
          cell("String Length (m)", stringLength), cell("String Wt (1000lbf)", s.stringWtKlbf),
          cell("BHA ROP (m/hr)", bhaRop),
        ]
        : [
          cell("Bit Run", bit?.bitNo ?? null), cell("Drill Bit", drillBit),
          cell("Length (m)", bit?.lengthM ?? null), cell("IADC Bit Dull", bit?.dullGrade ?? null),
          cell("TFA (incl Noz) (in²)", bit?.tfa ?? null), cell("BHA ROP (m/hr)", bhaRop),
          cell("Nozzles (1/32\")", bit?.nozzles ?? null), cell("String Length (m)", stringLength),
          cell("Max Nominal OD (in)", maxOd),
        ],
      components: s.components.map((c) => c.itemDes).filter(Boolean).join(", ") || null,
      comment: s.note,
      tally: s.components.map((c) => ({
        itemDes: c.itemDes, jts: c.jts, odIn: c.odIn, idIn: c.idIn,
        lenM: c.lenM, topThread: c.topThread,
      })),
    };
  });

  // ── drilling parameters ────────────────────────────────────────────────
  // Cum Depth and Cum Drill Time are running totals down the day's rows; Int ROP
  // is their quotient, which is how the sample's 403.54 / 2.00 = 201.8 comes out.
  let cumDepth = 0, cumDrill = 0;
  const defaultWellbore = well.wellbores[0] ?? null;
  const drillingParameters: DrillingParamRow[] = r.drillingParameters.map((p) => {
    const interval = p.startMkb !== null && p.endDepthMkb !== null ? p.endDepthMkb - p.startMkb : null;
    if (interval !== null) cumDepth += interval;
    if (p.drillTimeHr !== null) cumDrill += p.drillTimeHr;
    const cd = interval === null ? null : round(cumDepth);
    const ct = p.drillTimeHr === null ? null : round(cumDrill);
    return {
      wellbore: p.wellbore?.name ?? defaultWellbore?.name ?? null,
      startMkb: p.startMkb,
      endDepthMkb: p.endDepthMkb,
      cumDepthM: cd,
      drillTimeHr: p.drillTimeHr,
      cumDrillTimeHr: ct,
      // The sample prints the CUMULATIVE rate, not the interval's own.
      intRopMHr: ratio(cd, ct, 1),
      qFlowGpm: p.qFlowGpm,
      wob1000Lbf: p.wob1000Lbf,
      rpm: p.rpm,
      sppPsi: p.sppPsi,
      drillStrWtKlbf: p.drillStrWtKlbf,
      puStrWtKlbf: p.puStrWtKlbf,
      soStrWtKlbf: p.soStrWtKlbf,
      drillTq: p.drillTq,
      offBottomTorque: p.offBottomTorque,
    };
  });

  // ── sidebar ────────────────────────────────────────────────────────────
  const pumps: PumpBlock[] = r.scrRates.map((s) => {
    const p = s.mudPump;
    return {
      caption: [p?.pumpNo ?? s.pumpNo, p?.manufacturer, p?.model].filter(Boolean).join(", "),
      fields: detail
        ? [
          [cell("Pump Rating (hp)", p?.ratingHp ?? null), cell("Rod Diameter (in)", p?.rodDiaIn ?? null),
            cell("Stroke (in)", p?.strokeIn ?? null)],
          [cell("Liner Size (in)", p?.linerSizeIn ?? null), cell("Vol/Stk OR (bbl/stk)", p?.volPerStkBbl ?? null)],
          [cell("P (psi)", s.pPsi), cell("Slow Spd", s.strokesSpm !== null ? "Yes" : "No"),
            cell("Strokes (spm)", s.strokesSpm), cell("Eff (%)", s.effPct)],
        ]
        : [
          [cell("Pump #", p?.pumpNo ?? s.pumpNo), cell("Pwr (hp)", p?.ratingHp ?? null),
            cell("Rod Dia (in)", p?.rodDiaIn ?? null)],
          [cell("Liner Size (in)", p?.linerSizeIn ?? null), cell("Stroke (in)", p?.strokeIn ?? null),
            cell("Vol/Stk OR (bbl/stk)", p?.volPerStkBbl ?? null)],
          [cell("P (psi)", s.pPsi), cell("Slow Spd", s.strokesSpm !== null ? "Yes" : "No"),
            cell("Strokes (spm)", s.strokesSpm), cell("Eff (%)", s.effPct)],
        ],
    };
  });

  const envelope: DailyPayload = {
    type: detail ? "07" : "06",
    title: detail ? "Daily Drilling - Detail" : "Daily Drilling",
    wellName: well.name,
    headerVariant: "dailyDrilling",
    printedOn: printedOn(),
    titleFields: [
      cell(detail ? "Report Start Date" : "Report for", r.reportDate),
      cell("Report #", r.serialNo, "int"),
      cell("DFS", dfs),
      cell("Depth Progress (m)", depthProgress),
    ],
    header: detail
      ? [
        [cell("API/UWI", well.apiUwi), cell("Surface Legal Location", well.location),
          cell("License #", well.licenseNo), cell("State/Province", well.stateProvince),
          cell("AFE Number", afe?.afeNumber ?? null), cell("AFE+Supp Amt (Cost)", afePlusSupp, "money")],
        [cell("Spud Date", well.spudDate), cell("Rig Release Date", well.rigReleasedDate),
          cell("KB-Ground Distance (m)", well.kbGroundDistance), cell("KB-Casing Flange Distance (m)", well.kbCasingFlangeDistance),
          cell("Daily Field Est Total (Cost)", dayTotal, "money"), cell("Cum To Date (Cost)", cumToDate, "money")],
        [cell("Weather", r.weather), cell("Temperature (°C)", r.temperatureC),
          cell("Road Condition", r.roadCondition), cell("Hole Condition", r.holeCondition),
          cell("Daily Mud Field Est (Cost)", mudDay, "money"), cell("Cum Mud Field Est (Cost)", mudCum, "money")],
      ]
      : [
        [cell("API/UWI", well.apiUwi), cell("Surface Legal Location", well.location),
          cell("License #", well.licenseNo), cell("State/Province", well.stateProvince),
          cell("AFE Number", afe?.afeNumber ?? null), cell("AFE+Supp Amt (Cost)", afePlusSupp, "money")],
        [cell("Spud Date", well.spudDate), cell("Rig Release Date", well.rigReleasedDate),
          cell("Ground Elevation (m)", well.groundElevation), cell("KB-Ground Distance (m)", well.kbGroundDistance),
          cell("Day Total (Cost)", dayTotal, "money"), cell("Cum To Date (Cost)", cumToDate, "money")],
        [cell("Weather", r.weather), cell("Temperature (°C)", r.temperatureC),
          cell("Road Condition", r.roadCondition), cell("Hole Condition", r.holeCondition),
          cell("Mud Field Est (Cost)", mudDay, "money"), cell("Cum Mud Field Est (Cost)", mudCum, "money")],
      ],
    operations: detail
      ? [
        [cell("Operations at Report Time", r.opsAtReportTime, "text"), cell("Operations Next Report Period", r.opsNextPeriod, "text")],
        [cell("Start Depth (mKB)", r.previousDepth), cell("End Depth (mKB)", r.midnightDepth),
          cell("Start Depth (TVD) (mKB)", r.startDepthTvd), cell("End Depth (TVD) (mKB)", r.endDepthTvd)],
        [cell("Operations Summary", r.description, "text")],
        [cell("Remarks", r.remarks, "text")],
        [cell("Target Formation", r.job?.targetFormation ?? null), cell("Target Depth (mKB)", r.job?.targetDepth ?? null)],
      ]
      : [
        [cell("Operations at Report Time", r.opsAtReportTime, "text"), cell("Operations Next Report Period", r.opsNextPeriod, "text")],
        [cell("Start Depth (mKB)", r.previousDepth), cell("End Depth (mKB)", r.midnightDepth)],
        [cell("Operations Summary", r.description, "text")],
        [cell("Target Formation", r.job?.targetFormation ?? null), cell("Target Depth (mKB)", r.job?.targetDepth ?? null),
          cell("Last Casing String", lastCasingLabel(r.casing))],
      ],
    timeLog,
    timeLogTotalHr,
    mudChecks,
    drillStrings,
    drillingParameters,
    contacts: r.supervisors.map((s) => ({ jobContact: s.jobContact, mobile: s.mobile })),
    rigs: [[
      cell("Contractor", well.rig.contractor ?? well.contractor),
      cell("Rig Number", well.rig.name),
      cell("Rig Supervisor", r.wellSiteSupt),
      cell("Phone Mobile", r.supervisors.find((s) => s.jobContact === r.wellSiteSupt)?.mobile ?? null),
    ]],
    pumps,
    mudAdditives: r.chemicals.map((c) => ({
      des: c.material, fieldEstPerUnit: null, consumed: c.used,
    })),
    safetyChecks: r.safetyChecks.map((s) => ({ time: s.time, type: s.type, des: s.des })),
    wellbores: well.wellbores.map((w) => ({ name: w.name, koMdMkb: w.koMdMkb })),
  };

  if (!detail) return envelope;

  // ── report 07 only ─────────────────────────────────────────────────────
  const personnelHours = sumOrNull(r.companies.map((c) => c.totWorkTimeHr));
  const pctProblem = ratio(problemHr, timeLogTotalHr === null ? null : timeLogTotalHr, 4);

  // Running totals down the day's movement ledger.
  let cumTo = 0, cumFrom = 0;
  const mudVolumes = r.mudVolumes.map((v) => {
    if (v.toWellBbl !== null) cumTo += v.toWellBbl;
    if (v.fromWellBbl !== null) cumFrom += v.fromWellBbl;
    return {
      action: v.action, toWellBbl: v.toWellBbl, fromWellBbl: v.fromWellBbl,
      cumToWellBbl: v.toWellBbl === null ? null : round(cumTo),
      cumFromWellBbl: v.fromWellBbl === null ? null : round(cumFrom),
    };
  });

  envelope.detail = {
    counters: [
      [cell("Personnel Total Hours (hr)", personnelHours), cell("Cum Pers Tot Hr (hr)", null)],
      [cell("Time Log Total Hours (hr)", timeLogTotalHr), cell("Problem Time Hours (hr)", problemHr)],
      [cell("Percent Problem Time (%)", pctProblem === null ? null : round(pctProblem * 100)),
        cell("Cum Prob Time (%)", null)],
      [cell("Days LTI (days)", r.daysLti), cell("Days RI (days)", r.daysRi)],
    ],
    personnelLog: r.companies.map((c) => ({
      type: c.personnelType ?? c.note, count: c.count, totWorkTimeHr: c.totWorkTimeHr,
    })),
    // The recurring drill SCHEDULE, not the day's checks: last date is what the
    // crew recorded, next is that plus the interval they set.
    safetyCheckSummary: r.hseDrills.map((h) => ({
      type: h.type,
      lastDate: h.date,
      nextDate: nextCheckDate(h.date, h.daysToNextCheck),
    })),
    mudVolumes,
    hydraulics: hydraulicsBlock(r.bitRuns[0] ?? null, r.drillingParameters[0] ?? null, m),
    surveys: r.surveys.map((s) => ({ mdMkb: s.md, inc: s.inc, azm: s.azi, tvdMkb: s.tvd })),
    // "Last 5 Formations" — the deepest five tops recorded on this day.
    lastFormations: r.formationTops.slice(-5).map((f) => ({
      name: f.formation, progTopMd: f.progTopMd, drillTopMd: f.depth,
    })),
    lastCasing: r.casing.slice(-1).map((c) => ({
      description: c.casing, runDate: c.runDate, setDepthMkb: c.depth,
    })),
    // The registers print on every day their range covers — that is what makes
    // them well-level rather than a datum of the day they started on.
    kicks: well.kicks
      .filter((k) => coversDay(k.kickDate, k.controlDate, r.reportDate))
      .map((k) => ({
        kickDate: k.kickDate, kickDepthMkb: k.kickDepthMkb, controlDate: k.controlDate,
        controlDepthMkb: k.controlDepthMkb, kickClass: k.kickClass, killNotes: k.killNotes,
      })),
    lostCirculation: well.lostCirculation
      .filter((l) => coversDay(l.startDate, l.endDate, r.reportDate))
      .map((l) => ({
        startDate: l.startDate, topDepthMkb: l.topDepthMkb, bottomDepthMkb: l.bottomDepthMkb,
        opsInProg: l.opsInProg, volLostTotBbl: l.volLostTotBbl, endDate: l.endDate,
      })),
    problems: r.intervalProblems.map((p) => ({
      problemType: p.problemType, problemSubType: p.problemSubType, startDate: p.startDate,
      startDepthMkb: p.startDepthMkb, endDepthMkb: p.endDepthMkb, accountableParty: p.accountableParty,
      estCost: p.estCost, estLostTimeHr: p.estLostTimeHr, comment: p.comment,
    })),
    lessons: well.lessons
      .filter((l) => coversDay(l.startDate, l.endDate, r.reportDate))
      .map((l) => ({
        lessonType: l.lessonType, startDate: l.startDate, endDate: l.endDate,
        startDepthMkb: l.startDepthMkb, endDepthMkb: l.endDepthMkb,
        estCostSaving: l.estCostSaving, estTimeSavingHr: l.estTimeSavingHr, comment: l.comment,
      })),
    incidents: r.safetyIncidents.map((s) => ({
      time: s.time, category: s.category, type: s.type, subType: s.subType,
      cause: s.cause, lostTime: s.lostTime, severity: s.severity,
    })),
  };
  return envelope;
}

/** Report 06's composite "Structural Casing, 1,598.8mKB". */
function lastCasingLabel(casing: { casing: string | null; depth: number | null }[]): string | null {
  const last = casing[casing.length - 1];
  if (!last) return null;
  return [last.casing, last.depth === null ? null : `${last.depth.toFixed(1)}mKB`]
    .filter(Boolean).join(", ") || null;
}

/**
 * Does a register entry's range cover this day?
 *
 * Inclusive at BOTH ends, unlike a phase window: an event that started and was
 * controlled on the same day must still print on it, and an open-ended event
 * (no end date yet) prints from its start onwards.
 */
function coversDay(start: string | null, end: string | null, day: string): boolean {
  const s = jalaliKey(start), e = jalaliKey(end), d = jalaliKey(day);
  if (d === null) return false;
  if (s !== null && d < s) return false;
  if (e !== null && d > e) return false;
  if (s === null && e === null) return false;
  return true;
}

/** Last check + interval → the next due date, as a printable Jalali string. */
function nextCheckDate(last: string | null, days: number | null): string | null {
  if (!last || days === null) return null;
  // Walk forward day by day through the shared calendar helpers rather than
  // doing month arithmetic here — Jalali months are 31 then 30 days.
  const target = days;
  let probe = last;
  for (let i = 0; i < 400; i++) {
    const gap = jalaliDaysBetween(last, probe);
    if (gap !== null && gap >= target) return probe;
    probe = addOneDay(probe);
    if (!probe) return null;
  }
  return null;
}

/** "YYYY/MM/DD" + 1 day, honouring the 31/30/29-day Jalali months. */
function addOneDay(date: string): string {
  const m = /^(\d{3,4})\/(\d{1,2})\/(\d{1,2})/.exec(date);
  if (!m) return date;
  let y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]) + 1;
  const lengthOf = (month: number, year: number) =>
    month <= 6 ? 31 : month <= 11 ? 30 : ((year % 33) % 4 === 1 ? 30 : 29);
  if (d > lengthOf(mo, y)) { d = 1; mo += 1; }
  if (mo > 12) { mo = 1; y += 1; }
  return `${y}/${String(mo).padStart(2, "0")}/${String(d).padStart(2, "0")}`;
}

/**
 * Report 07's "Hydraulic Calculations".
 *
 * Derived from the bit and the interval that drilled with it, using the shared
 * drilling helpers so these numbers match the ROP-optimization page. Every cell
 * is null unless its inputs are all present — the sample prints the block empty,
 * and a half-computed hydraulic is worse than a blank one.
 */
function hydraulicsBlock(
  bit: { tfa: number | null; nozzles: string | null; size: string | null } | null,
  param: { qFlowGpm: number | null } | null,
  mud: { densityMaxPpg: number | null; densityMinPpg: number | null } | null,
): HeaderRow[] {
  const q = param?.qFlowGpm ?? null;
  const tfa = bit?.tfa ?? null;
  const ppg = mud?.densityMaxPpg ?? mud?.densityMinPpg ?? null;
  const bitDia = parseInches(bit?.size ?? null);

  let dP: number | null = null, hhp: number | null = null;
  let hpArea: number | null = null, vJet: number | null = null;
  if (q !== null && tfa !== null && ppg !== null && tfa > 0) {
    const drop = nozzlePressureDrop({ rhoPpg: ppg, qGpm: q, tfaIn2: tfa });
    if (drop !== null) {
      dP = round(drop, 1);
      hhp = round(bitHHP(drop, q), 1);
      const perArea = bitDia !== null ? hsiOf(hhp, bitDia) : null;
      hpArea = perArea === null ? null : round(perArea, 2);
      // Jet velocity, ft/s: Q [gpm] → 0.32086·Q/TFA.
      vJet = round((0.32086 * q) / tfa, 1);
    }
  }
  void jetImpact;   // available for a later report; report 07 does not print it

  return [[
    { label: "Bit Hydraulic Power (hp)", value: hhp },
    { label: "HP/Area (hp/in²)", value: hpArea },
    { label: "Bit Jet Velocity (ft/s)", value: vJet },
    { label: "Bit Pressure Drop (psi)", value: dP },
    { label: "% P @ bit (%)", value: null },
  ]];
}

/** `12 1/4` / `12.25` / `26in` → inches, or null. */
function parseInches(label: string | null): number | null {
  if (!label) return null;
  const t = label.trim().replace(/in\.?$/i, "").trim();
  const mixed = /^(\d+)\s+(\d+)\s*\/\s*(\d+)$/.exec(t);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const frac = /^(\d+)\s*\/\s*(\d+)$/.exec(t);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

// `jalaliInRange` is the half-open phase-window test; the registers above need
// the inclusive form, which is why `coversDay` exists rather than reusing it.
void jalaliInRange;
