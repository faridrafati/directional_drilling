/**
 * Reports 02 (BHA Detail) and 03 (Bit Summary).
 *
 * Both are scoped to the BHA RUN — the assembly's whole life in the hole, which
 * spans days. The daily sheet only ever holds a slice of one, so the run master
 * (`EntryBhaRun`) is deliberately thin and almost everything printed here is
 * DERIVED from the day rows that carry its id:
 *
 *   Depth In       the first day's `depthInMkb` — where the assembly went in
 *   Depth Drilled  Σ the days' `depthDrilledM`, falling back to Out − In
 *   Drilling Time  Σ the days' `drillingTimeHr`
 *   BHA ROP        Depth Drilled ÷ Drilling Time
 *   String Length  Σ the make-up's component lengths
 *   WOB/RPM/Flow   min and max over the run's drilled intervals
 *   Int Depth      each interval's End − Start;  Int ROP = Int Depth ÷ its hours
 *
 * `depthOutMkb` is the one stored figure, because a run can come out on a day
 * with no drilled interval at all — report 03's sample has runs with no WOB or
 * RPM recorded, so there is nothing to take a MAX over.
 *
 * The MAKE-UP is read from the run's FIRST day. A component list is entered when
 * the assembly is built; later days repeat or trim it, and taking the last would
 * print the string as it came out rather than as it was run.
 */
import type { PrismaClient } from "@prisma/client";
import { compareJalali } from "@dd/shared";
import { buildSchematic, type SchematicPayload } from "./schematic.js";
import {
  printedOn, standardWellHeader, type HeaderCell, type HeaderRow, type ReportEnvelope,
} from "./chrome.js";

const round = (n: number, dp = 2) => Number(n.toFixed(dp));
function sumOrNull(values: (number | null | undefined)[], dp = 2): number | null {
  let any = false, total = 0;
  for (const v of values) {
    if (v === null || v === undefined || !Number.isFinite(v)) continue;
    any = true; total += v;
  }
  return any ? round(total, dp) : null;
}
function ratio(a: number | null, b: number | null, dp = 1): number | null {
  if (a === null || b === null || !b) return null;
  return round(a / b, dp);
}
/** min / max over a nullable column; null when nothing contributed. */
function extent(values: (number | null)[]): { min: number | null; max: number | null } {
  const present = values.filter((v): v is number => v !== null && Number.isFinite(v));
  return present.length
    ? { min: Math.min(...present), max: Math.max(...present) }
    : { min: null, max: null };
}
const cell = (label: string, value: string | number | null, kind?: HeaderCell["kind"]): HeaderCell =>
  ({ label, value, kind });

export interface BhaComponentRow {
  jts: number | null;
  itemDes: string | null;
  odIn: number | null;
  idIn: number | null;
  massPerLenKgM: number | null;
  grade: string | null;
  driftIn: number | null;
  gaugeIn: number | null;
  connections: string | null;
  lenM: number | null;
  cumLenM: number | null;
}

export interface BhaParamRow {
  wellbore: string | null;
  startDate: string | null;
  endDate: string | null;
  drillTimeHr: number | null;
  startMkb: number | null;
  endDepthMkb: number | null;
  intDepthM: number | null;
  intRopMHr: number | null;
  wob1000Lbf: number | null;
  rpm: number | null;
  qFlowGpm: number | null;
  sppPsi: number | null;
}

export interface Report02Payload extends ReportEnvelope {
  /** "Deviated - Original Hole, <date> <time>" — the left-rail caption. */
  runCaption: string;
  runHeader: HeaderRow;
  bitRow: HeaderRow;
  stringRow: HeaderRow;
  nozzles: string | null;
  comment: string | null;
  components: BhaComponentRow[];
  bitTypes: {
    bitType: string | null; make: string | null; model: string | null;
    serialNumber: string | null; iadcCodes: string | null;
    itemCost: number | null; lengthM: number | null;
  }[];
  drillingParameters: BhaParamRow[];
  /** One row per nozzle, in 1/32". */
  bitNozzles: number[];
  sensors: { sensorType: string | null; distFromBitM: number | null; note: string | null }[];
  mudChecks: {
    date: string | null; depthMkb: number | null; type: string | null;
    densPpg: number | null; pvCp: number | null; ypLbf100ft2: number | null;
    ph: number | null; sandPct: number | null; solidsPct: number | null;
  }[];
  /** The wellbore section the sample draws down this page's left rail. */
  schematic: SchematicPayload;
}

export interface BitSummaryRow {
  bhaNo: number | null;
  bitRun: string | null;
  sizeIn: string | null;
  make: string | null;
  model: string | null;
  serialNo: string | null;
  iadcCodes: string | null;
  tfaIn2: number | null;
  nozzles: string | null;
  depthInMkb: number | null;
  depthOutMkb: number | null;
  drilledM: number | null;
  drillTimeHr: number | null;
  bhaRopMHr: number | null;
  wobMax: number | null;
  wobMin: number | null;
  rpmMax: number | null;
  rpmMin: number | null;
  bitDull: string | null;
}

export interface Report03Payload extends ReportEnvelope {
  bits: BitSummaryRow[];
}

/** Everything one run needs, in the order its days were filed. */
const RUN_INCLUDE = {
  well: true,
  wellbore: true,
  sensors: { orderBy: { order: "asc" } },
  drillStrings: {
    include: {
      components: { orderBy: { order: "asc" } },
      report: { select: { reportDate: true, mud: true } },
    },
  },
  bitRuns: { include: { report: { select: { reportDate: true } } } },
  drillingParameters: {
    include: { wellbore: true, report: { select: { reportDate: true } } },
  },
} as const;

/** Order the run's day rows by the date their report was filed. */
function byReportDate<T extends { report: { reportDate: string } }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => compareJalali(a.report.reportDate, b.report.reportDate));
}

/**
 * The figures every run-scoped report needs, derived once.
 *
 * Generic over the drill-string row so the returned `days` keep the CALLER's
 * full shape — narrowing them to the fields this function reads would hide the
 * components and the make-up name from report 02.
 */
function runFigures<
  D extends {
    depthInMkb: number | null; depthDrilledM: number | null;
    drillingTimeHr: number | null; report: { reportDate: string };
  },
>(run: {
  depthOutMkb: number | null;
  drillStrings: D[];
  drillingParameters: { startMkb: number | null; endDepthMkb: number | null; wob1000Lbf: number | null; rpm: number | null; qFlowGpm: number | null }[];
}) {
  const days = byReportDate(run.drillStrings);
  const depthIn = days.find((d) => d.depthInMkb !== null)?.depthInMkb ?? null;
  const paramEnds = run.drillingParameters.map((p) => p.endDepthMkb);
  const depthOut = run.depthOutMkb ?? extent(paramEnds).max;
  const summed = sumOrNull(days.map((d) => d.depthDrilledM));
  // Σ the days' progress when it was recorded; otherwise the run's own span.
  const depthDrilled = summed ?? (depthIn !== null && depthOut !== null ? round(depthOut - depthIn) : null);
  const drillTime = sumOrNull(days.map((d) => d.drillingTimeHr));
  return {
    days,
    depthIn,
    depthOut,
    depthDrilled,
    drillTime,
    bhaRop: ratio(depthDrilled, drillTime),
    wob: extent(run.drillingParameters.map((p) => p.wob1000Lbf)),
    rpm: extent(run.drillingParameters.map((p) => p.rpm)),
    qFlow: extent(run.drillingParameters.map((p) => p.qFlowGpm)),
  };
}

/** `"20/20/20"` → `[20, 20, 20]`. Report 02 prints one row per nozzle. */
function parseNozzles(s: string | null): number[] {
  if (!s) return [];
  return s.split(/[\/,\s]+/).map((x) => Number(x.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

export async function buildReport02(
  prisma: PrismaClient,
  bhaRunId: string,
): Promise<Report02Payload | null> {
  const run = await prisma.entryBhaRun.findUnique({ where: { id: bhaRunId }, include: RUN_INCLUDE });
  if (!run) return null;
  const f = runFigures(run);
  // The sample draws the wellbore section down this page's left rail; the
  // shared assembler builds it from the well's own hole, casing and cement.
  const schematic = await buildSchematic(prisma, run.wellId);

  // The make-up is the FIRST day's list — that is the assembly as it was run.
  const makeUp = f.days.find((d) => d.components.length > 0) ?? f.days[0] ?? null;
  const stringLength = makeUp ? sumOrNull(makeUp.components.map((c) => c.lenM)) : null;
  const bits = byReportDate(run.bitRuns);
  const bit = bits[0] ?? null;

  return {
    type: "02",
    title: "BHA Detail",
    wellName: run.well.name,
    identityRight: [
      run.bhaNo !== null ? `BHA#: ${run.bhaNo}` : null,
      makeUp?.name ?? null,
    ].filter(Boolean).join(",  ") || null,
    headerVariant: "none",
    header: [],
    printedOn: printedOn(),
    runCaption: [
      run.well.profile,
      run.wellbore?.name ?? null,
      [run.dateOut, run.timeOut].filter(Boolean).join(" ") || null,
    ].filter(Boolean).join(" - "),
    runHeader: [
      cell("Depth In (mKB)", f.depthIn),
      cell("Depth Out (mKB)", f.depthOut),
      cell("Depth Drilled (m)", f.depthDrilled),
      cell("Drilling Time (hr)", f.drillTime),
      cell("BHA ROP (m/hr)", f.bhaRop),
    ],
    bitRow: [
      cell("Bit Run", bit?.bitNo ?? null),
      cell("Length (m)", bit?.lengthM ?? null),
      cell("Make", bit?.make ?? null),
      cell("Model", bit?.type ?? bit?.model ?? null),
      cell("Serial Number", bit?.bitSerialNo ?? null),
      cell("IADC Codes", bit?.iadcCode ?? null),
      cell("IADC Bit Dull", bit?.dullGrade ?? null),
    ],
    stringRow: [
      cell("String Wt (1000lbf)", makeUp?.stringWtKlbf ?? null),
      cell("String Length (m)", stringLength),
      cell("WOB Max (1000lbf)", f.wob.max),
      cell("WOB Min (1000lbf)", f.wob.min),
      cell("Max RPM (rpm)", f.rpm.max),
      cell("Min RPM (rpm)", f.rpm.min),
      cell("Q Flow Max (gpm)", f.qFlow.max),
      cell("Q Flow Min (gpm)", f.qFlow.min),
    ],
    nozzles: bit?.nozzles ?? null,
    comment: run.comment ?? makeUp?.note ?? null,
    components: (makeUp?.components ?? []).map((c) => ({
      jts: c.jts, itemDes: c.itemDes, odIn: c.odIn, idIn: c.idIn,
      massPerLenKgM: c.massPerLenKgM, grade: c.grade, driftIn: c.driftIn,
      gaugeIn: c.gaugeIn, connections: c.connections, lenM: c.lenM, cumLenM: c.cumLenM,
    })),
    // The sample lists the bit as its own sub-table beneath the tally.
    bitTypes: bits.map((b) => ({
      bitType: b.type ?? null, make: b.make, model: b.model ?? b.type,
      serialNumber: b.bitSerialNo, iadcCodes: b.iadcCode,
      itemCost: b.itemCost, lengthM: b.lengthM,
    })),
    drillingParameters: byReportDate(run.drillingParameters).map((p) => {
      const intDepth = p.startMkb !== null && p.endDepthMkb !== null
        ? round(p.endDepthMkb - p.startMkb) : null;
      return {
        wellbore: p.wellbore?.name ?? run.wellbore?.name ?? null,
        startDate: p.report.reportDate,
        endDate: p.report.reportDate,
        drillTimeHr: p.drillTimeHr,
        startMkb: p.startMkb,
        endDepthMkb: p.endDepthMkb,
        intDepthM: intDepth,
        intRopMHr: ratio(intDepth, p.drillTimeHr),
        wob1000Lbf: p.wob1000Lbf,
        rpm: p.rpm,
        qFlowGpm: p.qFlowGpm,
        sppPsi: p.sppPsi,
      };
    }),
    bitNozzles: parseNozzles(bit?.nozzles ?? null),
    sensors: run.sensors.map((s) => ({
      sensorType: s.sensorType, distFromBitM: s.distFromBitM, note: s.note,
    })),
    // Every mud check taken on a day this run was in the hole.
    mudChecks: f.days
      .map((d) => ({ date: d.report.reportDate, mud: d.report.mud }))
      .filter((x): x is { date: string; mud: NonNullable<typeof x.mud> } => x.mud !== null)
      .map(({ date, mud }) => ({
        date,
        depthMkb: mud.depthMkb,
        type: mud.mudSystem,
        densPpg: mud.densityMaxPpg ?? mud.densityMinPpg,
        pvCp: mud.pv,
        ypLbf100ft2: mud.yp,
        ph: mud.ph,
        sandPct: mud.sandPct,
        solidsPct: mud.solidsPct,
      })),
    schematic,
  };
}

export async function buildReport03(
  prisma: PrismaClient,
  wellId: string,
  jobId?: string | null,
): Promise<Report03Payload | null> {
  const well = await prisma.entryWell.findUnique({ where: { id: wellId } });
  if (!well) return null;
  const runs = await prisma.entryBhaRun.findMany({
    where: { wellId },
    orderBy: { bhaNo: "asc" },
    include: RUN_INCLUDE,
  });
  const job = jobId ? await prisma.job.findUnique({ where: { id: jobId } }) : null;

  return {
    type: "03",
    title: "Bit Summary",
    wellName: well.name,
    identityRight: job?.primaryJobType ? `Job Type:   ${job.primaryJobType}` : null,
    headerVariant: "standard",
    header: standardWellHeader(well),
    printedOn: printedOn(),
    bits: runs.map((run) => {
      const f = runFigures(run);
      const bit = byReportDate(run.bitRuns)[0] ?? null;
      return {
        bhaNo: run.bhaNo,
        bitRun: bit?.bitNo ?? null,
        sizeIn: bit?.size ?? null,
        make: bit?.make ?? null,
        model: bit?.type ?? bit?.model ?? null,
        serialNo: bit?.bitSerialNo ?? null,
        iadcCodes: bit?.iadcCode ?? null,
        tfaIn2: bit?.tfa ?? null,
        nozzles: bit?.nozzles ?? null,
        depthInMkb: f.depthIn,
        depthOutMkb: f.depthOut,
        drilledM: f.depthDrilled,
        drillTimeHr: f.drillTime,
        bhaRopMHr: f.bhaRop,
        wobMax: f.wob.max,
        wobMin: f.wob.min,
        rpmMax: f.rpm.max,
        rpmMin: f.rpm.min,
        bitDull: bit?.dullGrade ?? null,
      };
    }),
  };
}
