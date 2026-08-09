/**
 * Reports 18 (Daily Geological), 19 (Formation Performance) and 20 (the
 * Geological Program).
 *
 * The three read one register between them, `WellFormation`, from three sides:
 *
 *   • 20 prints what was PREDICTED, before a bit turns;
 *   • 18 prints the register as it stands on a given day, beside that day's
 *     cuttings, shows and logs;
 *   • 19 prints predicted against DRILLED, which is the whole reason the two
 *     sets of columns are stored separately.
 *
 * That is also why none of them recomputes a top from another: report 19 would
 * have nothing to compare if the actual were derived from the prognosis, and a
 * derived "final" top would silently agree with the driller's call rather than
 * with the log it is supposed to come from.
 */
import type { PrismaClient } from "@prisma/client";
import { compareJalali, jalaliDaysBetween } from "@dd/shared";
import {
  printedOn, standardWellHeader, type HeaderCell, type HeaderRow, type ReportEnvelope,
} from "./chrome.js";
import { durationHr } from "./daily.js";

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

/* ══ shared shapes ═══════════════════════════════════════════════════════════ */

/** One formation, as any of the three reports prints it. */
export interface FormationRow {
  name: string | null;
  lithDes: string | null;
  elementType: string | null;
  layerName: string | null;
  progDepthTopSs: number | null;
  progTopTvd: number | null;
  progDepthBtmSs: number | null;
  progBtmTvd: number | null;
  drillTopMd: number | null;
  drillTopTvd: number | null;
  drillBtmMd: number | null;
  drillBtmTvd: number | null;
  finalTopMd: number | null;
  finalBtmMd: number | null;
  ropMHr: number | null;
  pPorePpg: number | null;
  pFracPpg: number | null;
  temperatureC: number | null;
  h2sConcPct: number | null;
}

const FORMATION_SELECT = {
  name: true, lithDes: true, elementType: true, layerName: true,
  progDepthTopSs: true, progTopTvd: true, progDepthBtmSs: true, progBtmTvd: true,
  drillTopMd: true, drillTopTvd: true, drillBtmMd: true, drillBtmTvd: true,
  finalTopMd: true, finalBtmMd: true, ropMHr: true,
  pPorePpg: true, pFracPpg: true, temperatureC: true, h2sConcPct: true,
} as const;

/* ══ report 18 — Daily Geological ════════════════════════════════════════════ */

export interface GeoTimeLogRow {
  startTime: string | null;
  endTime: string | null;
  durHr: number | null;
  cumDurHr: number | null;
  code1: string | null;
  code2: string | null;
  com: string | null;
}

export interface GeoMudCheckRow {
  type: string | null;
  time: string | null;
  depthMkb: number | null;
  densPpg: number | null;
  pvCp: number | null;
  ypPa: number | null;
  filtrateMl: number | null;
  ph: number | null;
}

export interface GeoBhaBlock {
  caption: string;
  header: HeaderRow;
  /** One row per drilled interval on the day, as report 18 tabulates them. */
  intervals: {
    endDepthMkb: number | null;
    tvdEndMkb: number | null;
    cumDepthM: number | null;
    cumDrillTimeHr: number | null;
    intRopMHr: number | null;
    rpm: number | null;
    wob1000Lbf: number | null;
    wellbore: string | null;
  }[];
}

export interface SampleDescriptionRow {
  topMkb: number | null; btmMkb: number | null;
  volCaPct: number | null; volMgPct: number | null; com: string | null;
}
export interface LithologyRow {
  topMkb: number | null; btmMkb: number | null;
  des: string | null; volPct: number | null; type: string | null; typeCode: string | null;
}
export interface OilShowRow {
  topMkb: number | null; btmMkb: number | null;
  showQuality: string | null; showOrigin: string | null; showType: string | null;
}
export interface GasShowRow {
  topMkb: number | null; btmMkb: number | null; showType: string | null;
  totalGasAvgPct: number | null; totalGasMinPct: number | null; totalGasMaxPct: number | null;
}
export interface LogRunRow {
  time: string | null; runNo: string | null; type: string | null;
  topMkb: number | null; btmMkb: number | null; loggingCompany: string | null;
}

export interface Report18Payload extends ReportEnvelope {
  /** "Date: … Report #: … DFS: …" — the sample's own right-hand identity. */
  identityRight: string | null;
  depthLine: string | null;
  dailySummary: HeaderRow;
  gas: HeaderRow[];
  narrative: HeaderRow[];
  timeLog: GeoTimeLogRow[];
  mudChecks: GeoMudCheckRow[];
  /** One block per BHA that drilled on the day. */
  bhaBlocks: GeoBhaBlock[];
  formations: FormationRow[];
  sampleDescriptions: SampleDescriptionRow[];
  lithology: LithologyRow[];
  oilShows: OilShowRow[];
  gasShows: GasShowRow[];
  logRuns: LogRunRow[];
  /**
   * True where the day holds a mud check but the model can only hold one. The
   * page says so rather than letting a reader assume one check was run.
   */
  mudCheckLimitation: boolean;
}

export async function buildReport18(
  prisma: PrismaClient,
  reportId: string,
): Promise<Report18Payload | null> {
  const r = await prisma.entryReport.findUnique({
    where: { id: reportId },
    include: {
      well: { include: { formations: { orderBy: { order: "asc" }, select: FORMATION_SELECT } } },
      job: {
        select: {
          category: true,
          afes: { orderBy: { order: "asc" }, select: { afeNumber: true, amount: true, supplements: { select: { amount: true } } } },
          costItems: { select: { costDate: true, fieldEstimate: true } },
        },
      },
      mud: true,
      operations: { orderBy: { order: "asc" } },
      drillingParameters: {
        orderBy: { order: "asc" },
        include: {
          wellbore: { select: { name: true } },
          bhaRun: { select: { bhaNo: true } },
        },
      },
      drillStrings: { orderBy: { order: "asc" }, select: { name: true, bhaNo: true } },
      bitRuns: { orderBy: { order: "asc" } },
      sampleDescriptions: { orderBy: { order: "asc" } },
      lithologyLog: { orderBy: { order: "asc" } },
      shows: { orderBy: { order: "asc" } },
      logRuns: { orderBy: { order: "asc" } },
    },
  });
  if (!r) return null;
  const well = r.well;

  // The day's own cost, and the running total — sliced from the job's cost
  // sheet by date, exactly as reports 06, 09 and 12 slice it.
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
  const suppAmt = sumOrNull((r.job?.afes ?? []).flatMap((a) => a.supplements.map((sp) => sp.amount)));
  const afeTotal = sumOrNull((r.job?.afes ?? []).map((a) => a.amount));
  const fieldEstTotal = sumOrNull(items.map((c) => c.fieldEstimate));

  let cumDur = 0;
  const timeLog: GeoTimeLogRow[] = r.operations.map((op) => {
    const dur = durationHr(op.fromTime, op.toTime);
    if (dur !== null) cumDur += dur;
    return {
      startTime: op.fromTime, endTime: op.toTime,
      durHr: dur, cumDurHr: dur === null ? null : round(cumDur),
      code1: op.opDetail ?? op.opLetter, code2: op.opCode2, com: op.remarks,
    };
  });

  // One block per BHA that drilled today. The intervals carry the run they
  // belong to, so a two-assembly day splits correctly rather than pooling.
  const byBha = new Map<string, typeof r.drillingParameters>();
  for (const p of r.drillingParameters) {
    const key = p.bhaRun?.bhaNo != null ? String(p.bhaRun.bhaNo) : "—";
    byBha.set(key, [...(byBha.get(key) ?? []), p]);
  }
  const bhaBlocks: GeoBhaBlock[] = [...byBha.entries()].map(([bhaNo, params]) => {
    const string = r.drillStrings.find((d) => String(d.bhaNo ?? "") === bhaNo) ?? r.drillStrings[0] ?? null;
    const bit = r.bitRuns[0] ?? null;
    // The interval's metreage is DERIVED from its ends: the table stores the
    // two depths, not their difference, and deriving it here keeps this report
    // agreeing with reports 02 and 07, which do the same.
    const intDepth = (p: { startMkb: number | null; endDepthMkb: number | null }) =>
      p.startMkb === null || p.endDepthMkb === null ? null : round(p.endDepthMkb - p.startMkb);
    const drilled = sumOrNull(params.map(intDepth));
    const hours = sumOrNull(params.map((p) => p.drillTimeHr));
    let cumDepth = 0, cumTime = 0;
    return {
      caption: [bhaNo === "—" ? "BHA" : `BHA #${bhaNo}`, string?.name].filter(Boolean).join(", "),
      header: [
        cell("Bit Run", bit?.bitNo ?? null),
        cell("Drill Bit", [bit?.size, bit?.type, bit?.bitSerialNo].filter(Boolean).join(", ") || null),
        cell("Drill String Name", string?.name ?? null),
        cell("BHA ROP (m/hr)", drilled === null || !hours ? null : round(drilled / hours), "decimal"),
        cell("BHA #", bhaNo === "—" ? null : Number(bhaNo), "int"),
      ],
      intervals: params.map((p) => {
        const m = intDepth(p);
        if (m !== null) cumDepth += m;
        if (p.drillTimeHr !== null) cumTime += p.drillTimeHr;
        return {
          endDepthMkb: p.endDepthMkb,
          // The interval carries no TVD of its own — the day's `endDepthTvd` is
          // the DAY's, not this interval's, and printing it on every row would
          // claim a precision the data does not have.
          tvdEndMkb: null,
          cumDepthM: round(cumDepth),
          cumDrillTimeHr: round(cumTime),
          intRopMHr: p.intRopMHr,
          rpm: p.rpm,
          wob1000Lbf: p.wob1000Lbf,
          wellbore: p.wellbore?.name ?? null,
        };
      }),
    };
  });

  const shows = r.shows;
  const dfs = jalaliDaysBetween(well.spudDate, r.reportDate);

  return {
    type: "18",
    title: "Daily Geological",
    wellName: well.name,
    identityRight: [
      `Date: ${r.reportDate}`,
      `Report #: ${r.serialNo}`,
      dfs === null ? null : `DFS: ${round(dfs)}`,
    ].filter(Boolean).join(", "),
    depthLine: r.previousDepth === null && r.midnightDepth === null
      ? null
      : `Depth Start: ${r.previousDepth ?? ""} - Depth End: ${r.midnightDepth ?? ""}`,
    headerVariant: "standard",
    header: [[
      cell("API/UWI", well.apiUwi),
      cell("License #", well.licenseNo),
      // "Licensee" on the sample. Our `client` is the operator the report is
      // filed for, which is the same party.
      cell("Licensee", well.client),
      cell("Field Name", well.field),
    ]],
    printedOn: printedOn(),
    dailySummary: [
      cell("AFE Number", afe?.afeNumber ?? null),
      cell("Job Category", r.job?.category ?? null),
      cell("Day Total (Cost)", anyDaily ? round(daily) : null, "money"),
      cell("Cum To Date (Cost)", anyCum ? round(cum) : null, "money"),
      cell("Supp Amt (Cost)", suppAmt, "money"),
      cell(
        "AFE-Field Estimate (Cost)",
        afeTotal === null && fieldEstTotal === null
          ? null : round((afeTotal ?? 0) + (suppAmt ?? 0) - (fieldEstTotal ?? 0)),
        "money",
      ),
    ],
    gas: [
      [
        cell("Avg Background Gas (%)", r.avgBackgroundGasPct, "decimal"),
        cell("Max Background Gas (%)", r.maxBackgroundGasPct, "decimal"),
        cell("Avg Connection Gas (%)", r.avgConnectionGasPct, "decimal"),
        cell("Max Connection Gas (%)", r.maxConnectionGasPct, "decimal"),
      ],
      [
        cell("Avg Trip Gas (%)", r.avgTripGasPct, "decimal"),
        cell("Max Trip Gas (%)", r.maxTripGasPct, "decimal"),
        cell("Avg Drill Gas (%)", r.avgDrillGasPct, "decimal"),
        cell("Max Drill Gas (%)", r.maxDrillGasPct, "decimal"),
      ],
    ],
    narrative: [
      [
        cell("Geological Activity at Report Time", r.geoActivityAtReportTime),
        cell("Geological Ops Next Report Period", r.geoOpsNextPeriod),
      ],
      [cell("Geological Ops This Report Period", r.geoOpsThisPeriod)],
    ],
    timeLog,
    mudChecks: r.mud
      ? [{
        type: r.mud.mudSystem,
        time: r.mud.reportTime,
        depthMkb: r.mud.depthMkb,
        densPpg: r.mud.densityMaxPpg ?? r.mud.densityMinPpg,
        pvCp: r.mud.pv,
        ypPa: r.mud.yp,
        filtrateMl: r.mud.filtrateMl,
        ph: r.mud.ph,
      }]
      : [],
    // The sample prints two checks on its day; one report holds one, so the
    // page says so rather than letting a reader assume only one was run.
    mudCheckLimitation: r.mud !== null,
    bhaBlocks,
    formations: well.formations,
    sampleDescriptions: r.sampleDescriptions.map((sd) => ({
      topMkb: sd.topMkb, btmMkb: sd.btmMkb,
      volCaPct: sd.volCaPct, volMgPct: sd.volMgPct, com: sd.com,
    })),
    lithology: r.lithologyLog.map((l) => ({
      topMkb: l.topMkb, btmMkb: l.btmMkb, des: l.des,
      volPct: l.volPct, type: l.type, typeCode: l.typeCode,
    })),
    oilShows: shows.filter((sh) => sh.kind !== "Gas").map((sh) => ({
      topMkb: sh.topMkb, btmMkb: sh.btmMkb,
      showQuality: sh.showQuality, showOrigin: sh.showOrigin, showType: sh.showType,
    })),
    gasShows: shows.filter((sh) => sh.kind === "Gas").map((sh) => ({
      topMkb: sh.topMkb, btmMkb: sh.btmMkb, showType: sh.showType,
      totalGasAvgPct: sh.totalGasAvgPct, totalGasMinPct: sh.totalGasMinPct, totalGasMaxPct: sh.totalGasMaxPct,
    })),
    logRuns: r.logRuns.map((l) => ({
      time: l.time, runNo: l.runNo, type: l.type,
      topMkb: l.topMkb, btmMkb: l.btmMkb, loggingCompany: l.loggingCompany,
    })),
  };
}

/* ══ report 19 — Formation Performance ═══════════════════════════════════════ */

export interface DrilledIntervalRow {
  startMkb: number | null;
  endDepthMkb: number | null;
  intDepthM: number | null;
  drillTimeHr: number | null;
  intRopMHr: number | null;
  date: string;
}

export interface Report19Payload extends ReportEnvelope {
  wellboreBlocks: {
    caption: string;
    header: HeaderRow;
    intervals: DrilledIntervalRow[];
  }[];
  formations: FormationRow[];
  /** The ROP-against-depth profile the sample plots beneath its tables. */
  profile: { depth: number; ropMHr: number | null; name: string | null }[];
  totals: HeaderRow;
}

export async function buildReport19(
  prisma: PrismaClient,
  wellId: string,
): Promise<Report19Payload | null> {
  const well = await prisma.entryWell.findUnique({
    where: { id: wellId },
    include: {
      formations: { orderBy: { order: "asc" }, select: FORMATION_SELECT },
      wellbores: { orderBy: { order: "asc" } },
    },
  });
  if (!well) return null;

  const params = await prisma.entryDrillingParameter.findMany({
    where: { report: { wellId } },
    include: {
      report: { select: { reportDate: true } },
      wellbore: { select: { id: true, name: true } },
    },
  });

  // Declared BEFORE the wellbore blocks that call it: a `const` arrow below
  // them sits in the temporal dead zone at that point and throws at runtime
  // while typechecking perfectly.
  const intDepthOf = (p: { startMkb: number | null; endDepthMkb: number | null }) =>
    p.startMkb === null || p.endDepthMkb === null ? null : round(p.endDepthMkb - p.startMkb);

  // Grouped by wellbore, and within a wellbore ordered by DEPTH: the rows come
  // from many days, and a day entered out of sequence would otherwise draw the
  // hole running back up itself.
  const byBore = new Map<string, typeof params>();
  for (const p of params) {
    const key = p.wellbore?.id ?? "—";
    byBore.set(key, [...(byBore.get(key) ?? []), p]);
  }

  const wellboreBlocks = [...byBore.entries()].map(([id, rows]) => {
    const bore = well.wellbores.find((w) => w.id === id) ?? null;
    const sorted = rows.slice().sort((a, b) => {
      if (a.startMkb !== null && b.startMkb !== null && a.startMkb !== b.startMkb) {
        return a.startMkb - b.startMkb;
      }
      return compareJalali(a.report.reportDate, b.report.reportDate);
    });
    return {
      caption: bore?.name ?? "Unassigned intervals",
      header: [
        cell("Well Name", well.name),
        cell("Orig KB Elev (m)", well.rtElevation, "decimal"),
        cell("Gr Elev (m)", well.groundElevation, "decimal"),
        cell("Wellbore Name", bore?.name ?? null),
        cell("Profile Type", bore?.kind ?? well.profile),
        cell("KO MD (mKB)", bore?.koMdMkb ?? null, "decimal"),
      ] as HeaderRow,
      intervals: sorted.map((p) => {
        const m = intDepthOf(p);
        return {
          startMkb: p.startMkb,
          endDepthMkb: p.endDepthMkb,
          intDepthM: m,
          drillTimeHr: p.drillTimeHr,
          // DERIVED when the day did not store one — metres over hours is the
          // definition of the column, and a blank where both its inputs are
          // present would be the report failing to do its arithmetic rather
          // than the crew failing to record something.
          intRopMHr: p.intRopMHr ?? (m === null || !p.drillTimeHr ? null : round(m / p.drillTimeHr)),
          date: p.report.reportDate,
        };
      }),
    };
  });

  // The profile: one point per formation top, carrying the ROP through it.
  // Drawn from the register rather than from the intervals so the plot and the
  // Formations table cannot disagree about where a formation starts.
  const profile = well.formations
    .filter((f) => f.drillTopMd !== null)
    .map((f) => ({ depth: f.drillTopMd as number, ropMHr: f.ropMHr, name: f.name }))
    .sort((a, b) => a.depth - b.depth);

  const totalDrilled = sumOrNull(params.map(intDepthOf));
  const totalHours = sumOrNull(params.map((p) => p.drillTimeHr));

  return {
    type: "19",
    title: "Formation Performance",
    wellName: well.name,
    headerVariant: "none",
    header: [],
    printedOn: printedOn(),
    wellboreBlocks,
    formations: well.formations,
    profile,
    totals: [
      cell("Formations", well.formations.length, "int"),
      cell("Drilled Intervals", params.length, "int"),
      cell("Total Drilled (m)", totalDrilled, "decimal"),
      cell("Total Drill Time (hr)", totalHours, "decimal"),
      cell("Overall ROP (m/hr)",
        totalDrilled === null || !totalHours ? null : round(totalDrilled / totalHours), "decimal"),
    ],
  };
}

/* ══ report 20 — Geological Program ══════════════════════════════════════════ */

export interface Report20Payload extends ReportEnvelope {
  wellbores: {
    name: string | null; profileType: string | null;
    parentWellbore: string | null; proposedSurvey: string | null;
  }[];
  formations: FormationRow[];
  jobs: HeaderRow[];
  geologicalObjective: string | null;
  samplingRequirements: {
    topDes: string | null; topMkb: number | null;
    btmDes: string | null; btmMkb: number | null;
    wellbore: string | null; rqdBy: string | null; sampledBy: string | null; com: string | null;
  }[];
  contacts: {
    company: string | null; contactName: string | null; title: string | null;
    mobile: string | null; email: string | null; note: string | null;
  }[];
}

export async function buildReport20(
  prisma: PrismaClient,
  wellId: string,
): Promise<Report20Payload | null> {
  const well = await prisma.entryWell.findUnique({
    where: { id: wellId },
    include: {
      formations: { orderBy: { order: "asc" }, select: FORMATION_SELECT },
      wellbores: { orderBy: { order: "asc" } },
      samplingRequirements: {
        orderBy: { order: "asc" },
        include: { wellbore: { select: { name: true } } },
      },
      jobs: {
        orderBy: { order: "asc" },
        include: {
          afes: { orderBy: { order: "asc" }, select: { afeNumber: true } },
          contacts: { orderBy: { order: "asc" } },
        },
      },
      planStations: { orderBy: { order: "asc" }, select: { md: true } },
    },
  });
  if (!well) return null;

  const planned = well.planStations.length;

  return {
    type: "20",
    title: "Geological Program",
    wellName: well.name,
    headerVariant: "standard",
    header: standardWellHeader(well),
    printedOn: printedOn(),
    wellbores: well.wellbores.map((w) => ({
      name: w.name,
      profileType: w.kind ?? well.profile,
      // The app models one hole per row with no parent link; a sidetrack names
      // its parent in its own name rather than by reference, so this states
      // what is known rather than inventing a hierarchy.
      parentWellbore: null,
      proposedSurvey: planned === 0 ? null : `${planned} planned stations`,
    })),
    formations: well.formations,
    jobs: well.jobs.map((j) => ([
      cell("Primary Job Type", j.primaryJobType),
      cell("Target Formation", j.targetFormation),
      cell("Target Depth (mKB)", j.targetDepth, "decimal"),
      cell("AFE Number", j.afes[0]?.afeNumber ?? null),
      cell("Planned Start Date", j.plannedStartDate),
    ] as HeaderRow)),
    // The program's objective belongs to the job that is drilling it; the first
    // job that states one wins, because a well with two jobs has one programme.
    geologicalObjective: well.jobs.find((j) => j.geologicalObjective)?.geologicalObjective ?? null,
    samplingRequirements: well.samplingRequirements.map((r) => ({
      topDes: r.topDes, topMkb: r.topMkb, btmDes: r.btmDes, btmMkb: r.btmMkb,
      wellbore: r.wellbore?.name ?? null,
      rqdBy: r.rqdBy, sampledBy: r.sampledBy, com: r.com,
    })),
    contacts: well.jobs.flatMap((j) => j.contacts.map((c) => ({
      company: c.company, contactName: c.contactName, title: c.title,
      mobile: c.mobile, email: c.email, note: c.note,
    }))),
  };
}
