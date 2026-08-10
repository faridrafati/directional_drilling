/**
 * The completion-side reports: 22, 24, 26, 28, 29 and 30.
 *
 * Five of the six are built around the SHARED SCHEMATIC, which is why they live
 * together: 24 puts it beside the tubing and the perforations, 26 beside the
 * perforation blocks, 28 alone with the job that made it, 29 twice — proposed
 * against actual — and 22 beside everything the well has. 30 is the one without
 * a picture: it is the register, printed.
 *
 * WHAT "CURRENT" MEANS
 * -------------------
 * Reports 28 and 29 both say "current", and it is not a stored flag. Current is
 * what the tables ADD UP TO: the deepest plug-back caps the well, the newest
 * perforation status decides whether a zone is open, and the completion string
 * with the latest run date is the one in the hole. Storing a "current" boolean
 * would be a second source of truth that goes stale the first time somebody
 * forgets to tick it.
 */
import type { PrismaClient } from "@prisma/client";
import { compareJalali } from "@dd/shared";
import {
  plotWellHeader, printedOn, standardWellHeader,
  type HeaderCell, type HeaderRow, type ReportEnvelope,
} from "./chrome.js";
import { buildSchematic, type SchematicPayload } from "./schematic.js";

const round = (v: number, dp = 2) => Number(v.toFixed(dp));
const cell = (label: string, value: string | number | null, kind?: HeaderCell["kind"]): HeaderCell =>
  ({ label, value, kind });

const WELL_HEADER_SELECT = {
  name: true, field: true, apiUwi: true, licenseNo: true, stateProvince: true,
  location: true, profile: true, groundElevation: true, casingFlangeElevation: true,
  kbGroundDistance: true, kbCasingFlangeDistance: true, spudDate: true, rigReleasedDate: true,
} as const;

/* ── shapes the completion reports share ──────────────────────────────────── */

export interface PerforationBlock {
  header: HeaderRow[];
  statuses: { date: string | null; status: string | null; com: string | null }[];
}

export interface TubingBlock {
  caption: string;
  header: HeaderRow;
  components: {
    itemDes: string | null; jts: number | null; make: string | null; model: string | null;
    odIn: string | null; idIn: number | null; massPerLenKgM: number | null;
    grade: string | null; lenM: number | null;
    topMkb: number | null; btmMkb: number | null; serialNo: string | null;
  }[];
}

const COMPLETION_INCLUDE = {
  zones: { orderBy: { order: "asc" } },
  reservoirs: { orderBy: { order: "asc" } },
  perforations: {
    orderBy: { order: "asc" },
    include: { statuses: { orderBy: { order: "asc" } }, zone: { select: { name: true } } },
  },
  tubingStrings: {
    orderBy: { order: "asc" },
    include: { components: { orderBy: { order: "asc" } } },
  },
  plugBacks: { orderBy: { order: "asc" } },
  deviationSurveys: { orderBy: { order: "asc" } },
  wellbores: { orderBy: { order: "asc" } },
  formations: { orderBy: { order: "asc" } },
} as const;

/**
 * The completion header the samples print above 24, 26 and 28.
 *
 * PBTD is DERIVED — the deepest plug-back, or the well's total depth where
 * nothing has been plugged back. It is not stored, because a stored "current
 * PBTD" goes stale the first time somebody plugs back and forgets to update it.
 */
function completionHeader(
  well: { rtElevation: number | null; kbTubingHeadDistance: number | null; spudDate: string | null; rigReleasedDate: string | null },
  wellboreName: string | null,
  pbtd: number | null,
  totalDepth: number | null,
  totalTvd: number | null,
): HeaderRow {
  // The samples print these as "Original Hole - 12,089.9": the depth is stated
  // against the wellbore it is in, because a sidetracked well has more than one.
  const at = (depth: number | null) =>
    depth === null ? null : `${wellboreName ?? "Original Hole"} - ${depth.toFixed(1)}`;
  return [
    cell("Original KB Elevation (m)", well.rtElevation, "decimal"),
    cell("KB-Tubing Head Distance (m)", well.kbTubingHeadDistance, "decimal"),
    cell("Spud Date", well.spudDate),
    cell("Rig Release Date", well.rigReleasedDate),
    cell("PBTD (All) (mKB)", at(pbtd)),
    cell("Total Depth All (mKB)", at(totalDepth)),
    // The samples' own column, and a DIFFERENT quantity from the one above:
    // along a deviated hole the measured depth is always the larger number.
    // Blank where no day recorded a TVD — the MD is not a substitute for it.
    cell("Total Depth All (TVD) (m)", totalTvd, "decimal"),
  ];
}

/** The deepest depth any daily report reached. */
async function totalDepthOf(prisma: PrismaClient, wellId: string): Promise<number | null> {
  const rows = await prisma.entryReport.findMany({
    where: { wellId }, select: { midnightDepth: true },
  });
  return rows.reduce<number | null>(
    (deep, r) => (r.midnightDepth !== null && (deep === null || r.midnightDepth > deep) ? r.midnightDepth : deep),
    null,
  );
}

/**
 * The deepest TVD any day reached — a DIFFERENT quantity from `totalDepthOf`.
 *
 * The samples label this column "Total Depth All (TVD)". Measured depth along a
 * deviated hole is always the larger number, so printing MD under a TVD heading
 * overstates how deep the well actually is by the whole of its horizontal
 * departure. Where no day recorded a TVD this returns null and the cell prints
 * blank — substituting the MD would be the very error the label warns about.
 */
async function totalTvdOf(prisma: PrismaClient, wellId: string): Promise<number | null> {
  const rows = await prisma.entryReport.findMany({
    where: { wellId }, select: { endDepthTvd: true },
  });
  return rows.reduce<number | null>(
    (deep, r) => (r.endDepthTvd !== null && (deep === null || r.endDepthTvd > deep) ? r.endDepthTvd : deep),
    null,
  );
}

/** One perforation, as reports 24 and 26 print it. */
function perforationBlock(p: {
  date: string | null; time: string | null; topMkb: number | null; btmMkb: number | null;
  company: string | null; conveyanceMethod: string | null; gunSizeIn: string | null;
  carrierMake: string | null; shotDensityPerM: number | null; chargeType: string | null;
  phasingDeg: number | null; orientation: string | null; orientationMethod: string | null;
  overUnderBalanced: string | null; pOverUnderPsi: number | null;
  flMdBeforeMkb: number | null; flMdAfterMkb: number | null;
  pSurfInitPsi: number | null; pFinalSurfPsi: number | null; referenceLog: string | null;
  zone: { name: string | null } | null;
  statuses: { date: string | null; status: string | null; com: string | null }[];
}): PerforationBlock {
  return {
    header: [
      [
        cell("Date", p.date),
        cell("Zone", p.zone?.name ?? null),
        cell("Top Depth (mKB)", p.topMkb, "decimal"),
        cell("Bottom Depth (mKB)", p.btmMkb, "decimal"),
      ],
      [
        cell("Perforation Company", p.company),
        cell("Conveyance Method", p.conveyanceMethod),
        cell("Gun Size (in)", p.gunSizeIn),
        cell("Carrier Make", p.carrierMake),
      ],
      [
        cell("Shot Density (shots/m)", p.shotDensityPerM, "decimal"),
        cell("Charge Type", p.chargeType),
        cell("Phasing (°)", p.phasingDeg, "decimal"),
      ],
      [
        cell("Orientation", p.orientation),
        cell("Orientation Method", p.orientationMethod),
      ],
      [
        cell("Over/Under Balanced", p.overUnderBalanced),
        cell("P Over/Under (psi)", p.pOverUnderPsi, "decimal"),
        cell("FL MD Before (mKB)", p.flMdBeforeMkb, "decimal"),
        cell("FL MD After (mKB)", p.flMdAfterMkb, "decimal"),
        cell("P Surf Init (psi)", p.pSurfInitPsi, "decimal"),
        cell("P Final Surf (psi)", p.pFinalSurfPsi, "decimal"),
      ],
      [cell("Reference Log", p.referenceLog)],
    ],
    statuses: p.statuses.map((st) => ({ date: st.date, status: st.status, com: st.com })),
  };
}

function tubingBlocks(strings: {
  description: string | null; runDate: string | null;
  stringLengthM: number | null; setDepthMkb: number | null;
  components: TubingBlock["components"];
}[]): TubingBlock[] {
  return strings.map((t) => ({
    caption: [t.description ?? "Tubing string", t.setDepthMkb === null ? null : `${t.setDepthMkb.toFixed(1)}mKB`]
      .filter(Boolean).join(", "),
    header: [
      cell("Tubing Description", t.description),
      cell("Run Date", t.runDate),
      cell("String Length (m)", t.stringLengthM, "decimal"),
      cell("Set Depth (mKB)", t.setDepthMkb, "decimal"),
    ],
    components: t.components,
  }));
}

/* ══ report 24 — Downhole Well Profile ═══════════════════════════════════════ */

export interface Report24Payload extends ReportEnvelope {
  completionHeader: HeaderRow;
  caption: string;
  schematic: SchematicPayload;
  wellhead: { des: string | null; make: string | null; model: string | null; sn: string | null; wpTopPsi: number | null }[];
  casingStrings: {
    description: string | null; odIn: string | null; massPerLenKgM: number | null;
    grade: string | null; topThread: string | null; setDepthMkb: number | null;
  }[];
  perforations: {
    date: string | null; topMkb: number | null; btmMkb: number | null; zone: string | null;
  }[];
  tubingStrings: TubingBlock[];
}

export async function buildReport24(
  prisma: PrismaClient,
  wellId: string,
): Promise<Report24Payload | null> {
  const well = await prisma.entryWell.findUnique({
    where: { id: wellId },
    select: {
      ...WELL_HEADER_SELECT, rtElevation: true, kbTubingHeadDistance: true,
      ...COMPLETION_INCLUDE,
      casingStrings: {
        orderBy: { order: "asc" },
        include: { components: { orderBy: { order: "asc" }, take: 1 } },
      },
    },
  });
  if (!well) return null;

  const [schematic, totalDepth, totalTvd, wellheadRows] = await Promise.all([
    buildSchematic(prisma, wellId),
    totalDepthOf(prisma, wellId),
    totalTvdOf(prisma, wellId),
    prisma.entryWellheadComponent.findMany({
      where: { report: { wellId } },
      orderBy: { order: "asc" },
      include: { report: { select: { reportDate: true } } },
    }),
  ]);

  // The newest record of each component, exactly as report 04 dedupes them.
  const byKey = new Map<string, (typeof wellheadRows)[number]>();
  for (const w of wellheadRows) {
    const key = [w.sizeIn, w.type, w.make].join("|");
    const seen = byKey.get(key);
    if (!seen || compareJalali(w.report.reportDate, seen.report.reportDate) > 0) byKey.set(key, w);
  }

  const pbtd = well.plugBacks.reduce<number | null>(
    (deep, p) => (p.depthMkb !== null && (deep === null || p.depthMkb > deep) ? p.depthMkb : deep),
    null,
  );

  return {
    type: "24",
    title: "Downhole Well Profile",
    wellName: well.name,
    headerVariant: "plot",
    header: plotWellHeader(well),
    printedOn: printedOn(),
    completionHeader: completionHeader(well, well.wellbores[0]?.name ?? null, pbtd, totalDepth, totalTvd),
    caption: [well.profile, well.wellbores[0]?.name ?? null].filter(Boolean).join(" - "),
    schematic,
    wellhead: [...byKey.values()].map((w) => ({
      des: [w.sizeIn === null ? null : `${w.sizeIn}"`, w.type].filter(Boolean).join(" ") || null,
      make: w.make, model: w.model, sn: w.sn, wpTopPsi: w.wpPsi,
    })),
    casingStrings: well.casingStrings.map((c) => ({
      description: c.description,
      odIn: c.stringNominalOdIn ?? c.components[0]?.odIn ?? null,
      massPerLenKgM: c.components[0]?.massPerLenKgM ?? null,
      grade: c.components[0]?.grade ?? null,
      topThread: c.components[0]?.topThread ?? null,
      setDepthMkb: c.setDepthMkb,
    })),
    perforations: well.perforations.map((p) => ({
      date: p.date, topMkb: p.topMkb, btmMkb: p.btmMkb,
      zone: [p.zone?.name, well.wellbores[0]?.name].filter(Boolean).join(", ") || null,
    })),
    tubingStrings: tubingBlocks(well.tubingStrings),
  };
}

/* ══ report 26 — Perforations ════════════════════════════════════════════════ */

export interface Report26Payload extends ReportEnvelope {
  completionHeader: HeaderRow;
  caption: string;
  schematic: SchematicPayload;
  perforations: PerforationBlock[];
  totals: HeaderRow;
}

export async function buildReport26(
  prisma: PrismaClient,
  wellId: string,
): Promise<Report26Payload | null> {
  const well = await prisma.entryWell.findUnique({
    where: { id: wellId },
    select: { ...WELL_HEADER_SELECT, rtElevation: true, kbTubingHeadDistance: true, ...COMPLETION_INCLUDE },
  });
  if (!well) return null;

  const [schematic, totalDepth, totalTvd] = await Promise.all([
    buildSchematic(prisma, wellId),
    totalDepthOf(prisma, wellId),
    totalTvdOf(prisma, wellId),
  ]);
  const pbtd = well.plugBacks.reduce<number | null>(
    (deep, p) => (p.depthMkb !== null && (deep === null || p.depthMkb > deep) ? p.depthMkb : deep),
    null,
  );

  // A perforation is CURRENTLY open when its newest status says so — the
  // history is what report 26 prints, and the current state is read off the end
  // of it rather than stored beside it.
  const openNow = well.perforations.filter((p) => {
    const newest = p.statuses.slice().sort((a, b) => compareJalali(b.date, a.date))[0] ?? null;
    return newest === null || newest.status === "Open";
  }).length;

  const perforated = well.perforations.reduce(
    (m, p) => m + (p.topMkb !== null && p.btmMkb !== null ? p.btmMkb - p.topMkb : 0), 0,
  );

  return {
    type: "26",
    title: "Perforations",
    wellName: well.name,
    headerVariant: "standard",
    header: standardWellHeader(well),
    printedOn: printedOn(),
    completionHeader: completionHeader(well, well.wellbores[0]?.name ?? null, pbtd, totalDepth, totalTvd),
    caption: [well.profile, well.wellbores[0]?.name ?? null].filter(Boolean).join(" - "),
    schematic,
    perforations: well.perforations.map(perforationBlock),
    totals: [
      cell("Perforations", well.perforations.length, "int"),
      cell("Currently Open", openNow, "int"),
      cell("Perforated Interval (m)", perforated === 0 ? null : round(perforated), "decimal"),
      cell("Zones", well.zones.length, "int"),
    ],
  };
}

/* ══ reports 28 and 29 — the schematic pages ═════════════════════════════════ */

export interface Report28Payload extends ReportEnvelope {
  completionHeader: HeaderRow;
  caption: string;
  /** The job that made the well what it is now — the sample's own block. */
  mostRecentJob: HeaderRow | null;
  totalDepthLine: string | null;
  schematic: SchematicPayload;
}

export async function buildReport28(
  prisma: PrismaClient,
  wellId: string,
): Promise<Report28Payload | null> {
  const well = await prisma.entryWell.findUnique({
    where: { id: wellId },
    select: {
      ...WELL_HEADER_SELECT, rtElevation: true, kbTubingHeadDistance: true,
      wellbores: { orderBy: { order: "asc" } },
      plugBacks: { orderBy: { order: "asc" } },
      jobs: { orderBy: { order: "asc" } },
    },
  });
  if (!well) return null;

  const [schematic, totalDepth, totalTvd] = await Promise.all([
    buildSchematic(prisma, wellId),
    totalDepthOf(prisma, wellId),
    totalTvdOf(prisma, wellId),
  ]);
  const pbtd = well.plugBacks.reduce<number | null>(
    (deep, p) => (p.depthMkb !== null && (deep === null || p.depthMkb > deep) ? p.depthMkb : deep),
    null,
  );

  // "Most recent" by END date, falling back to start: a job still running has
  // no end date and is nonetheless the most recent thing that happened.
  const job = well.jobs.slice().sort((a, b) =>
    compareJalali(b.endDate ?? b.startDate, a.endDate ?? a.startDate))[0] ?? null;

  return {
    type: "28",
    title: "Schematic - Current",
    wellName: well.name,
    headerVariant: "standard",
    header: standardWellHeader(well),
    printedOn: printedOn(),
    completionHeader: completionHeader(well, well.wellbores[0]?.name ?? null, pbtd, totalDepth, totalTvd),
    caption: [well.profile, well.wellbores[0]?.name ?? null].filter(Boolean).join(" - "),
    mostRecentJob: job
      ? [
        cell("Job Category", job.category),
        cell("Primary Job Type", job.primaryJobType),
        cell("Secondary Job Type", job.secondaryJobType),
        cell("Start Date", job.startDate),
        cell("End Date", job.endDate),
      ]
      : null,
    totalDepthLine: totalDepth === null ? null : `TD: ${totalDepth.toFixed(1)}`,
    schematic,
  };
}

export interface Report29Payload extends ReportEnvelope {
  caption: string;
  /** As built — hole, casing, cement, completion. */
  actual: SchematicPayload;
  /** As designed — the prognosed formations and the planned trajectory's depth. */
  proposed: SchematicPayload;
  comparison: HeaderRow;
  /** Said on the page when there is no plan to compare against. */
  noProposal: string | null;
}

export async function buildReport29(
  prisma: PrismaClient,
  wellId: string,
): Promise<Report29Payload | null> {
  const well = await prisma.entryWell.findUnique({
    where: { id: wellId },
    select: {
      ...WELL_HEADER_SELECT,
      wellbores: { orderBy: { order: "asc" } },
      formations: { orderBy: { order: "asc" } },
      planStations: { orderBy: { order: "asc" } },
    },
  });
  if (!well) return null;

  const actual = await buildSchematic(prisma, wellId);

  // The PROPOSED picture is the prognosis: formations at their predicted tops,
  // and the plan's total depth. It carries no casing, because a design's casing
  // scheme is not something this application stores — and drawing the actual
  // casing on the "proposed" side would make the comparison meaningless.
  const proposedFormations = well.formations
    .filter((f) => f.progTopTvd !== null && f.progBtmTvd !== null)
    .map((f) => ({
      topMkb: f.progTopTvd as number,
      btmMkb: f.progBtmTvd as number,
      label: f.name,
      odIn: null,
      detail: [f.lithDes, "prognosed"].filter(Boolean).join(" · "),
    }));
  const planTd = well.planStations.reduce<number | null>(
    (deep, p) => (p.md !== null && (deep === null || p.md > deep) ? p.md : deep),
    null,
  );

  const proposed: SchematicPayload = {
    maxDepthMkb: planTd ?? (proposedFormations.length
      ? Math.max(...proposedFormations.map((f) => f.btmMkb)) : null),
    holeSections: [],
    casingStrings: [],
    cementIntervals: [],
    formations: proposedFormations,
    shoes: [],
    completionItems: [],
    emptyReason: proposedFormations.length === 0 && planTd === null
      ? "No prognosis to draw: this well has no prognosed formation tops and no directional plan. "
        + "They are entered under Well data → Geology and → Well registers."
      : null,
  };

  return {
    type: "29",
    title: "Schematic - Proposed vs Actual",
    wellName: well.name,
    headerVariant: "standard",
    header: standardWellHeader(well),
    printedOn: printedOn(),
    caption: [well.profile, well.wellbores[0]?.name ?? null].filter(Boolean).join(" - "),
    actual,
    proposed,
    comparison: [
      cell("Planned TD (mKB)", planTd, "decimal"),
      cell("Actual Deepest (mKB)", actual.maxDepthMkb, "decimal"),
      cell(
        "Difference (m)",
        planTd === null || actual.maxDepthMkb === null ? null : round(actual.maxDepthMkb - planTd),
        "decimal",
      ),
      cell("Prognosed Formations", proposedFormations.length, "int"),
      cell("Drilled Formations", actual.formations.length, "int"),
    ],
    noProposal: proposed.emptyReason,
  };
}

/* ══ report 22 — Complete Well Summary ═══════════════════════════════════════ */

/** A casing string with the tally the sample prints underneath it. */
export interface CasingBlock {
  caption: string;
  header: HeaderRow;
  components: {
    odIn: string | null; itemDes: string | null; btmMkb: number | null; jts: number | null;
    idIn: number | null; massPerLenKgM: number | null; grade: string | null; topThread: string | null;
  }[];
}

/** A cement job: who pumped it, how they judged it, its stages and its fluids. */
export interface CementBlock {
  caption: string;
  header: HeaderRow;
  stages: {
    stage: HeaderRow;
    fluids: {
      fluidType: string | null; cementClass: string | null; amountSacks: number | null;
      yieldLPerSack: number | null; mixWaterLPerSack: number | null;
      volumePumpedM3: number | null; fluidDescription: string | null;
    }[];
  }[];
}

/** One BHA, its bit, and the string it was run on. */
export interface BhaBlock {
  caption: string;
  header: HeaderRow;
  figures: HeaderRow;
  /** The sample prints the make-up as ONE comma-joined line, not a table. */
  stringComponents: string;
}

/** A job, its money, and the phases and contacts under it. */
export interface JobBlock {
  caption: string;
  header: HeaderRow;
  money: HeaderRow;
  summary: string | null;
  savings: HeaderRow;
  phases: {
    phaseType: string | null; plannedCost: number | null;
    plCumDaysMl: number | null; plannedEndDepthMkb: number | null;
  }[];
  contacts: {
    contactName: string | null; company: string | null; title: string | null;
    office: string | null; mobile: string | null;
  }[];
}

export interface Report22Payload extends ReportEnvelope {
  identity: HeaderRow[];
  caption: string;
  schematic: SchematicPayload;
  wellbore: HeaderRow;
  holeSections: { sizeIn: string | null; actTopMkb: number | null; actBtmMkb: number | null }[];
  plugBacks: { date: string | null; depthMkb: number | null; method: string | null; com: string | null }[];
  formations: {
    name: string | null; geologicAge: string | null; elementType: string | null; h2sConcPct: number | null;
    finalTopMd: number | null; finalTopTvd: number | null;
  }[];
  deviationSurveys: { date: string | null; des: string | null; proposed: boolean | null; definitive: boolean | null }[];
  reservoirs: { name: string | null; topMkb: number | null; btmMkb: number | null; datumDepthM: number | null }[];
  casingStrings: CasingBlock[];
  cementJobs: CementBlock[];
  otherInHole: {
    odIn: string | null; des: string | null; topMkb: number | null; btmMkb: number | null;
    idIn: number | null; make: string | null; model: string | null;
  }[];
  wellheadMaster: HeaderRow | null;
  wellheadComponents: {
    make: string | null; model: string | null; section: string | null;
    topConnType: string | null; topSizeIn: number | null;
    btmConnType: string | null; btmSizeIn: number | null;
    des: string | null; wpPsi: number | null;
  }[];
  generalNotes: { date: string | null; com: string | null }[];
  jobs: JobBlock[];
  bhas: BhaBlock[];
  logs: { date: string | null; type: string | null; topMkb: number | null; btmMkb: number | null; company: string | null }[];
  cores: {
    coreNo: string | null; type: string | null; topMkb: number | null; btmMkb: number | null;
    recoveredM: number | null; wellbore: string | null;
  }[];
  leakOffTests: {
    testDate: string | null; lastCasingStringRun: string | null; pSurfAppliedPsi: number | null;
    depthMkb: number | null; fluidDensityPpg: number | null; leakedOff: boolean | null;
  }[];
  annotations: { depthMkb: number | null; annotation: string | null }[];
  productionFailures: {
    date: string | null; failureDes: string | null; failureType: string | null; cause: string | null;
    failedItem: string | null; resolvedDate: string | null; cost: number | null;
  }[];
  tubingStrings: TubingBlock[];
  perforations: { date: string | null; zone: string | null; topMkb: number | null; btmMkb: number | null }[];
  totals: HeaderRow;
}

/**
 * The shared shape of a casing string and its tally, and of a cement job and
 * its stages. Reports 22 and 30 both print these; 05 prints the tally alone.
 */
function casingBlocks(
  strings: {
    description: string | null; setDepthMkb: number | null; runDate: string | null;
    centralizers: string | null; scratchers: string | null; stringMinDriftIn: number | null;
    components: {
      odIn: string | null; itemDes: string | null; btmMkb: number | null; jts: number | null;
      idIn: number | null; massPerLenKgM: number | null; grade: string | null; topThread: string | null;
    }[];
  }[],
): CasingBlock[] {
  return strings.map((c) => ({
    caption: [
      c.description ?? "Casing",
      c.setDepthMkb === null ? null : `${c.setDepthMkb.toFixed(1)}mKB`,
    ].filter(Boolean).join(", "),
    header: [
      cell("Run Date", c.runDate),
      cell("Centralizers", c.centralizers),
      cell("Scratchers", c.scratchers),
      cell("Drift Min (in)", c.stringMinDriftIn, "in3"),
    ],
    components: c.components.map((k) => ({
      odIn: k.odIn, itemDes: k.itemDes, btmMkb: k.btmMkb, jts: k.jts,
      idIn: k.idIn, massPerLenKgM: k.massPerLenKgM, grade: k.grade, topThread: k.topThread,
    })),
  }));
}

/** Every cement job on the well, in casing-string order then job order. */
function cementBlocks(
  strings: {
    description: string | null;
    cementJobs: {
      description: string | null; startDate: string | null; company: string | null;
      evaluationMethod: string | null; evaluationResults: string | null;
      stages: {
        order: number; topDepthMkb: number | null; bottomDepthMkb: number | null;
        fullReturn: boolean | null; volReturnM3: number | null;
        fluids: {
          fluidType: string | null; cementClass: string | null; amountSacks: number | null;
          yieldLPerSack: number | null; mixWaterLPerSack: number | null;
          volumePumpedM3: number | null; fluidDescription: string | null;
        }[];
      }[];
    }[];
  }[],
): CementBlock[] {
  const out: CementBlock[] = [];
  for (const str of strings) {
    for (const job of str.cementJobs) {
      out.push({
        caption: [job.description ?? `${str.description ?? "Casing"} Cement`, "Casing", job.startDate]
          .filter(Boolean).join(", "),
        header: [
          cell("Cementing Company", job.company),
          cell("Evaluation Method", job.evaluationMethod),
          cell("Cement Evaluation Results", job.evaluationResults),
        ],
        stages: job.stages.map((st) => ({
          stage: [
            cell("Stg #", st.order + 1, "int"),
            cell("Description", "Casing Cement"),
            cell("Top (mKB)", st.topDepthMkb, "decimal"),
            cell("Btm (mKB)", st.bottomDepthMkb, "decimal"),
            cell("Full Return?", st.fullReturn === null ? null : st.fullReturn ? "Yes" : "No"),
            cell("Vol Return (m³)", st.volReturnM3, "decimal"),
          ],
          fluids: st.fluids.map((f) => ({
            fluidType: f.fluidType, cementClass: f.cementClass, amountSacks: f.amountSacks,
            yieldLPerSack: f.yieldLPerSack, mixWaterLPerSack: f.mixWaterLPerSack,
            volumePumpedM3: f.volumePumpedM3, fluidDescription: f.fluidDescription,
          })),
        })),
      });
    }
  }
  return out;
}

export async function buildReport22(
  prisma: PrismaClient,
  wellId: string,
): Promise<Report22Payload | null> {
  const well = await prisma.entryWell.findUnique({
    where: { id: wellId },
    select: {
      ...WELL_HEADER_SELECT, rtElevation: true, kbTubingHeadDistance: true,
      client: true, latitude: true, longitude: true,
      ...COMPLETION_INCLUDE,
      holeSections: { orderBy: { order: "asc" } },
      casingStrings: {
        orderBy: { order: "asc" },
        include: {
          components: { orderBy: { order: "asc" } },
          cementJobs: {
            orderBy: { order: "asc" },
            include: {
              stages: {
                orderBy: { order: "asc" },
                include: { fluids: { orderBy: { order: "asc" } } },
              },
            },
          },
        },
      },
      otherInHole: { orderBy: { order: "asc" } },
      bottomHoleCores: { orderBy: { order: "asc" }, include: { wellbore: { select: { name: true } } } },
      schematicAnnotations: { orderBy: { order: "asc" } },
      notes: { orderBy: { order: "asc" } },
      equipmentFailures: { orderBy: { order: "asc" } },
      jobs: {
        orderBy: { order: "asc" },
        include: {
          phases: { orderBy: { order: "asc" }, include: { plan: true } },
          afes: { orderBy: { order: "asc" }, include: { supplements: true } },
          contacts: { orderBy: { order: "asc" } },
          costItems: { select: { fieldEstimate: true, finalInvoice: true } },
        },
      },
      bhaRuns: {
        orderBy: { bhaNo: "asc" },
        include: {
          drillStrings: { include: { components: { orderBy: { order: "asc" } } } },
          bitRuns: { orderBy: { order: "asc" } },
        },
      },
    },
  });
  if (!well) return null;

  // Logs, wellhead components and pressure tests live on the DAYS, because that
  // is when they happen — but they are facts about the WELL, so this report
  // gathers them across every day rather than making the reader open each one.
  const [schematic, totalDepth, totalTvd, logRuns, wellheads, fits] = await Promise.all([
    buildSchematic(prisma, wellId),
    totalDepthOf(prisma, wellId),
    totalTvdOf(prisma, wellId),
    prisma.entryLogRun.findMany({
      where: { report: { wellId } },
      orderBy: [{ report: { reportDate: "asc" } }, { order: "asc" }],
      include: { report: { select: { reportDate: true } } },
    }),
    prisma.entryWellheadComponent.findMany({
      where: { report: { wellId } },
      orderBy: [{ report: { reportDate: "asc" } }, { order: "asc" }],
    }),
    prisma.entryFit.findMany({
      where: { report: { wellId } },
      orderBy: { testDate: "asc" },
    }),
  ]);
  const bore = well.wellbores[0] ?? null;

  // One wellhead row per distinct component, newest wins — the same de-dup
  // report 04 does, for the same reason: a component re-entered on a later day
  // is the SAME component, not a second one.
  const byKey = new Map<string, (typeof wellheads)[number]>();
  for (const w of wellheads) byKey.set(`${w.des ?? ""}|${w.sizeIn ?? ""}|${w.section ?? ""}`, w);
  const heads = [...byKey.values()];
  const master = heads[0] ?? null;

  return {
    type: "22",
    title: "Complete Well Summary",
    wellName: well.name,
    headerVariant: "none",
    header: [],
    printedOn: printedOn(),
    identity: [
      [cell("API/UWI", well.apiUwi), cell("Operator", well.client)],
      [
        cell("Original KB Elevation (m)", well.rtElevation, "decimal"),
        cell("KB-Ground Distance (m)", well.kbGroundDistance, "decimal"),
        cell("Spud Date", well.spudDate),
        cell("Rig Release Date", well.rigReleasedDate),
      ],
      [
        cell("Surface Legal Location", well.location),
        cell("Latitude (°)", well.latitude),
        cell("Longitude (°)", well.longitude),
      ],
    ],
    caption: [well.profile, bore?.name ?? null].filter(Boolean).join(" - "),
    schematic,
    wellbore: [
      cell("Wellbore Name", bore?.name ?? null),
      cell("Wellbore API/UWI", bore?.apiUwi ?? null),
      cell("Btm. Loc.", bore?.btmLocation ?? null),
      cell("Profile Type", bore?.kind ?? well.profile),
      cell("KO MD (mKB)", bore?.koMdMkb ?? null, "decimal"),
      cell("VS Dir (°)", bore?.vsAzimuthDeg ?? null, "decimal"),
      cell("Total Depth (mKB)", totalDepth, "decimal"),
      // A different quantity from the measured depth above, not a restatement.
      cell("Total Depth (TVD) (m)", totalTvd, "decimal"),
    ],
    holeSections: well.holeSections.map((h) => ({
      sizeIn: h.sizeIn, actTopMkb: h.actTopMkb, actBtmMkb: h.actBtmMkb,
    })),
    plugBacks: well.plugBacks.map((p) => ({
      date: p.date, depthMkb: p.depthMkb, method: p.method, com: p.com,
    })),
    formations: well.formations.map((f) => ({
      name: f.name, geologicAge: f.geologicAge, elementType: f.elementType, h2sConcPct: f.h2sConcPct,
      finalTopMd: f.finalTopMd ?? f.drillTopMd, finalTopTvd: f.drillTopTvd,
    })),
    deviationSurveys: well.deviationSurveys.map((d) => ({
      date: d.date, des: d.des, proposed: d.proposed, definitive: d.definitive,
    })),
    reservoirs: well.reservoirs.map((r) => ({
      name: r.name, topMkb: r.topMkb, btmMkb: r.btmMkb, datumDepthM: r.datumDepthM,
    })),
    casingStrings: casingBlocks(well.casingStrings),
    cementJobs: cementBlocks(well.casingStrings),
    otherInHole: well.otherInHole.map((o) => ({
      odIn: o.odIn, des: o.des, topMkb: o.topMkb, btmMkb: o.btmMkb,
      idIn: o.idIn, make: o.make, model: o.model,
    })),
    wellheadMaster: master === null ? null : [
      cell("Install Date", master.installDate),
      cell("Type", master.type),
      cell("Make", master.make),
      cell("WP (psi)", master.wpPsi, "decimal"),
      cell("Size (in)", master.sizeIn, "in3"),
    ],
    wellheadComponents: heads.map((w) => ({
      make: w.make, model: w.model, section: w.section,
      topConnType: w.topConnectionType, topSizeIn: w.topSizeIn,
      btmConnType: w.btmConnectionType, btmSizeIn: w.btmSizeIn,
      des: w.des, wpPsi: w.wpPsi,
    })),
    generalNotes: well.notes.map((n) => ({ date: n.date, com: n.com })),
    jobs: well.jobs.map((j) => {
      const afe = j.afes[0] ?? null;
      const afeSupp = j.afes.flatMap((a) => [a.amount, ...a.supplements.map((x) => x.amount)])
        .filter((v): v is number => v !== null);
      const fieldEst = j.costItems.map((c) => c.fieldEstimate).filter((v): v is number => v !== null);
      const invoice = j.costItems.map((c) => c.finalInvoice).filter((v): v is number => v !== null);
      const sum = (xs: number[]) => (xs.length ? round(xs.reduce((a, b) => a + b, 0)) : null);
      return {
        caption: [j.name ?? j.primaryJobType ?? "Job", j.startDate].filter(Boolean).join(", "),
        header: [
          cell("Job Category", j.category),
          cell("Primary Job Type", j.primaryJobType),
          cell("Start Date", j.startDate),
          cell("End Date", j.endDate),
        ],
        money: [
          cell("AFE Number", afe?.afeNumber ?? null),
          cell("AFE+Supp Amt (Cost)", sum(afeSupp), "money"),
          cell("Total Fld Est (Cost)", sum(fieldEst), "money"),
          cell("Total Final Invoice (Cost)", sum(invoice), "money"),
        ],
        summary: j.summary,
        savings: [
          cell("Poss Cost Save (Cost)", j.possCostSave, "money"),
          cell("Poss Time Save (hr)", j.possTimeSaveHr, "decimal"),
          cell("Est Prob Cost (Cost)", j.estProblemCost, "money"),
          cell("Est Lost Time (hr)", j.estLostTimeHr, "decimal"),
        ],
        // "Pl Cum Days ML" is CUMULATIVE in the sample — 2.00, 4.00, 9.00, 11.00 —
        // so it is a running total of each phase's most-likely duration, not a
        // stored figure. Storing it would be a second source of truth that goes
        // wrong the first time a phase duration is edited.
        phases: (() => {
          let cum = 0;
          let anyDuration = false;
          return j.phases.map((ph) => {
            if (ph.plan?.durMostLikelyDays != null) {
              cum += ph.plan.durMostLikelyDays;
              anyDuration = true;
            }
            return {
              phaseType: ph.phaseType1,
              plannedCost: ph.plan?.costMostLikely ?? null,
              plCumDaysMl: anyDuration ? round(cum) : null,
              plannedEndDepthMkb: ph.plan?.endDepth ?? null,
            };
          });
        })(),
        contacts: j.contacts.map((c) => ({
          contactName: c.contactName, company: c.company, title: c.title,
          office: c.office, mobile: c.mobile,
        })),
      };
    }),
    bhas: well.bhaRuns.map((r) => {
      // The BHA's own row carries only the number and where it came out; the
      // string it was run on carries the depths and times, and the BIT carries
      // the size, model and dull grade. The sample prints all three together,
      // which is why this reads from three places rather than one.
      const str = r.drillStrings[0] ?? null;
      const bit = r.bitRuns[0] ?? null;
      return {
        caption: `BHA #${r.bhaNo ?? "?"}${str?.name ? `, ${str.name}` : ""}`,
        header: [
          cell("BHA #", r.bhaNo, "int"),
          cell("Size (in)", bit?.size ?? null),
          cell("Model", bit?.type ?? bit?.model ?? null),
          cell("IADC Codes", bit?.iadcCode ?? null),
          cell("IADC Bit Dull", bit?.dullGrade ?? null),
        ],
        figures: [
          cell("Depth In (mKB)", str?.depthInMkb ?? null, "decimal"),
          cell("Depth Out (mKB)", r.depthOutMkb, "decimal"),
          cell("Drilled (m)", str?.depthDrilledM ?? null, "decimal"),
          cell("Drill Time (hr)", str?.drillingTimeHr ?? null, "decimal"),
          cell("Bit Hrs Out", bit?.hours ?? null, "decimal"),
        ],
        // ONE comma-joined line, as the sample prints it: the make-up is read as
        // a sequence, and a 17-row table for what fits on two lines buries it.
        stringComponents: (str?.components ?? [])
          .map((c) => c.itemDes)
          .filter((x): x is string => !!x)
          .join(", "),
      };
    }),
    logs: logRuns.map((l) => ({
      date: l.report.reportDate, type: l.type, topMkb: l.topMkb, btmMkb: l.btmMkb,
      company: l.loggingCompany,
    })),
    cores: well.bottomHoleCores.map((c) => ({
      coreNo: c.coreNo, type: c.type, topMkb: c.topMkb, btmMkb: c.btmMkb,
      recoveredM: c.recoveredM, wellbore: c.wellbore?.name ?? null,
    })),
    leakOffTests: fits.map((f) => ({
      testDate: f.testDate, lastCasingStringRun: f.lastCasingStringRun,
      pSurfAppliedPsi: f.appliedSurfacePressurePsi, depthMkb: f.depthMkb,
      fluidDensityPpg: f.fluidDensityPpg,
      // "Leaked off?" is not stored — it is whether a leak-off pressure was
      // reached. A FIT that held has no leak-off pressure; a LOT that broke down
      // does. Deriving it beats a second flag that can disagree with the number.
      leakedOff: f.leakOffPressurePsi === null ? null : f.leakOffPressurePsi > 0,
    })),
    annotations: well.schematicAnnotations.map((a) => ({
      depthMkb: a.depthMkb, annotation: a.annotation,
    })),
    productionFailures: well.equipmentFailures.map((f) => ({
      date: f.date, failureDes: f.componentDes, failureType: f.failureType, cause: f.cause,
      failedItem: f.failedItem, resolvedDate: f.resolvedDate, cost: f.cost,
    })),
    tubingStrings: tubingBlocks(well.tubingStrings),
    perforations: well.perforations.map((p) => ({
      date: p.date, zone: p.zone?.name ?? null, topMkb: p.topMkb, btmMkb: p.btmMkb,
    })),
    totals: [
      cell("Hole Sections", well.holeSections.length, "int"),
      cell("Casing Strings", well.casingStrings.length, "int"),
      cell("Cement Jobs", well.casingStrings.reduce((n, c) => n + c.cementJobs.length, 0), "int"),
      cell("BHAs", well.bhaRuns.length, "int"),
      cell("Formations", well.formations.length, "int"),
      cell("Perforations", well.perforations.length, "int"),
      cell("Total Depth (mKB)", totalDepth, "decimal"),
    ],
  };
}

/* ══ report 30 — Well Summary ════════════════════════════════════════════════ */

/** A rod string and its make-up — the same shape as a tubing string. */
export interface RodBlock {
  caption: string;
  header: HeaderRow;
  components: {
    itemDes: string | null; odNominalIn: string | null; massPerLenKgM: number | null;
    grade: string | null; joints: number | null; lenM: number | null;
    topMkb: number | null; btmMkb: number | null;
  }[];
}

/** A stimulation and the stages pumped into it. */
export interface StimulationBlock {
  caption: string;
  header: HeaderRow;
  stages: {
    stageNo: number | null; stageType: string | null;
    topDepthMkb: number | null; bottomDepthMkb: number | null; cleanVolPumpedM3: number | null;
  }[];
}

export interface Report30Payload extends ReportEnvelope {
  identity: HeaderRow[];
  elevations: HeaderRow;
  directionsToWell: string | null;
  wellhead: { type: string | null; make: string | null; wpPsi: number | null; service: string | null }[];
  wellbores: { name: string | null; parent: string | null; profile: string | null; koMdMkb: number | null }[];
  casingStrings: {
    description: string | null; runDate: string | null; odIn: string | null; idIn: number | null;
    massPerLenKgM: number | null; grade: string | null; setDepthMkb: number | null;
  }[];
  cementJobs: {
    caption: string; company: string | null;
    stage: HeaderRow;
    fluids: { description: string | null; type: string | null; amountSacks: number | null; cementClass: string | null }[];
  }[];
  otherInHole: {
    des: string | null; topMkb: number | null; btmMkb: number | null;
    runDate: string | null; pullDate: string | null;
  }[];
  zones: {
    name: string | null; topMkb: number | null; btmMkb: number | null;
    status: string | null; statusDate: string | null;
  }[];
  perforations: {
    date: string | null; type: string | null; topMkb: number | null; btmMkb: number | null;
    zone: string | null; shotDensityPerM: number | null; phasingDeg: number | null; status: string | null;
  }[];
  stimulations: StimulationBlock[];
  logs: { date: string | null; topMkb: number | null; btmMkb: number | null; type: string | null; cased: boolean | null }[];
  tubingStrings: TubingBlock[];
  rodStrings: RodBlock[];
  rodPumps: HeaderRow[];
  swabs: {
    date: string | null; swabCompany: string | null; zone: string | null;
    totalVolBbl: number | null; totalOilBbl: number | null; totalBswBbl: number | null;
  }[];
  jobs: {
    startDate: string | null; endDate: string | null;
    jobType: string | null; jobSubType: string | null; summary: string | null;
  }[];
  attachments: { des: string | null; kind: string | null; date: string | null }[];
  totals: HeaderRow;
}

export async function buildReport30(
  prisma: PrismaClient,
  wellId: string,
): Promise<Report30Payload | null> {
  const well = await prisma.entryWell.findUnique({
    where: { id: wellId },
    select: {
      ...WELL_HEADER_SELECT,
      rtElevation: true, thElevation: true, otherElevation: true,
      kbTubingHeadDistance: true, directionsToWell: true,
      wellbores: { orderBy: { order: "asc" } },
      zones: { orderBy: { order: "asc" } },
      perforations: {
        orderBy: { order: "asc" },
        include: { statuses: { orderBy: { order: "asc" } }, zone: { select: { name: true } } },
      },
      stimulations: {
        orderBy: { order: "asc" },
        include: { stages: { orderBy: { order: "asc" } }, zone: { select: { name: true } } },
      },
      tubingStrings: { orderBy: { order: "asc" }, include: { components: { orderBy: { order: "asc" } } } },
      rodStrings: { orderBy: { order: "asc" }, include: { components: { orderBy: { order: "asc" } } } },
      rodPumps: { orderBy: { order: "asc" } },
      swabs: { orderBy: { order: "asc" }, include: { zone: { select: { name: true } } } },
      otherInHole: { orderBy: { order: "asc" } },
      attachments: { orderBy: { order: "asc" } },
      jobs: { orderBy: { order: "asc" } },
      casingStrings: {
        orderBy: { order: "asc" },
        include: {
          components: { orderBy: { order: "asc" }, take: 1 },
          cementJobs: {
            orderBy: { order: "asc" },
            include: {
              stages: {
                orderBy: { order: "asc" },
                include: { fluids: { orderBy: { order: "asc" } } },
              },
            },
          },
        },
      },
    },
  });
  if (!well) return null;

  const [totalDepth, totalTvd, wellheadRows, logRuns] = await Promise.all([
    totalDepthOf(prisma, wellId),
    totalTvdOf(prisma, wellId),
    prisma.entryWellheadComponent.findMany({
      where: { report: { wellId } },
      orderBy: { order: "asc" },
      include: { report: { select: { reportDate: true } } },
    }),
    // Logs are recorded on the DAY they were run, but they are a fact about the
    // well — this report gathers them across every day rather than making the
    // reader open each one to find out what has been logged.
    prisma.entryLogRun.findMany({
      where: { report: { wellId } },
      orderBy: [{ report: { reportDate: "asc" } }, { order: "asc" }],
      include: { report: { select: { reportDate: true } } },
    }),
  ]);
  const byKey = new Map<string, (typeof wellheadRows)[number]>();
  for (const w of wellheadRows) {
    const key = [w.sizeIn, w.type, w.make].join("|");
    const seen = byKey.get(key);
    if (!seen || compareJalali(w.report.reportDate, seen.report.reportDate) > 0) byKey.set(key, w);
  }

  const cementJobs = well.casingStrings.flatMap((c) =>
    c.cementJobs.flatMap((j) => j.stages.map((st) => ({
      caption: [j.description ?? "Cement", c.description, j.startDate].filter(Boolean).join(", "),
      company: j.company,
      stage: [
        cell("Top Depth (mKB)", st.topDepthMkb, "decimal"),
        cell("Bottom Depth (mKB)", st.bottomDepthMkb, "decimal"),
        cell("Full Return?", st.fullReturn === null ? null : st.fullReturn ? "Yes" : "No"),
        cell("Vol Cement (m³)", st.volCementM3, "decimal"),
        cell("Cement Vol Return (m³)", st.volReturnM3, "decimal"),
      ] as HeaderRow,
      fluids: st.fluids.map((f) => ({
        description: f.fluidDescription, type: f.fluidType,
        amountSacks: f.amountSacks, cementClass: f.cementClass,
      })),
    }))));

  return {
    type: "30",
    title: "Well Summary",
    wellName: well.name,
    headerVariant: "none",
    header: [],
    printedOn: printedOn(),
    identity: [
      [
        cell("API/UWI", well.apiUwi),
        cell("Surface Legal Location", well.location),
        cell("Field Name", well.field),
        cell("License #", well.licenseNo),
      ],
      [
        cell("Spud Date", well.spudDate),
        cell("Rig Release Date", well.rigReleasedDate),
        cell("Well Configuration Type", well.profile),
        cell("Total Depth (mKB)", totalDepth, "decimal"),
        cell("Total Depth (TVD) (m)", totalTvd, "decimal"),
      ],
    ],
    elevations: [
      cell("Original KB Elevation (m)", well.rtElevation, "decimal"),
      cell("Ground Elevation (m)", well.groundElevation, "decimal"),
      cell("CF Elev (m)", well.casingFlangeElevation, "decimal"),
      cell("TH Elev (m)", well.thElevation, "decimal"),
      cell("Other Elevation (m)", well.otherElevation, "decimal"),
      cell("KB-Ground Distance (m)", well.kbGroundDistance, "decimal"),
      cell("KB-CF (m)", well.kbCasingFlangeDistance, "decimal"),
      cell("KB-TH (m)", well.kbTubingHeadDistance, "decimal"),
    ],
    directionsToWell: well.directionsToWell,
    wellhead: [...byKey.values()].map((w) => ({
      type: w.type, make: w.make, wpPsi: w.wpPsi, service: w.com,
    })),
    wellbores: well.wellbores.map((w) => ({
      name: w.name,
      // Resolved by id from the same list rather than by a self-join, because
      // `parentWellboreId` is a plain column — see the note on the model.
      parent: w.parentWellboreId === null
        ? null
        : well.wellbores.find((x) => x.id === w.parentWellboreId)?.name ?? null,
      profile: w.kind ?? well.profile,
      koMdMkb: w.koMdMkb,
    })),
    casingStrings: well.casingStrings.map((c) => ({
      description: c.description, runDate: c.runDate,
      odIn: c.stringNominalOdIn ?? c.components[0]?.odIn ?? null,
      idIn: c.components[0]?.idIn ?? null,
      massPerLenKgM: c.components[0]?.massPerLenKgM ?? null,
      grade: c.components[0]?.grade ?? null,
      setDepthMkb: c.setDepthMkb,
    })),
    cementJobs,
    otherInHole: well.otherInHole.map((o) => ({
      des: o.des, topMkb: o.topMkb, btmMkb: o.btmMkb,
      runDate: o.runDate, pullDate: o.pullDate,
    })),
    zones: well.zones.map((z) => ({
      name: z.name, topMkb: z.topMkb, btmMkb: z.btmMkb,
      status: z.status, statusDate: z.statusDate,
    })),
    perforations: well.perforations.map((p) => {
      // The CURRENT status is the newest one recorded, not a stored flag — the
      // same rule reports 26, 28 and 29 apply.
      const newest = p.statuses.slice().sort((a, b) => compareJalali(b.date, a.date))[0] ?? null;
      return {
        date: p.date, type: p.conveyanceMethod, topMkb: p.topMkb, btmMkb: p.btmMkb,
        zone: p.zone?.name ?? null,
        shotDensityPerM: p.shotDensityPerM, phasingDeg: p.phasingDeg,
        status: newest?.status ?? null,
      };
    }),
    stimulations: well.stimulations.map((st) => ({
      caption: [st.type ?? "Stimulation", st.date && `on ${st.date}`].filter(Boolean).join(" "),
      header: [
        cell("Date", st.date),
        cell("Zone", st.zone?.name ?? null),
        cell("Type", st.type),
      ],
      stages: st.stages.map((g, i) => ({
        stageNo: g.stageNo ?? i + 1,
        stageType: g.stageType,
        topDepthMkb: g.topDepthMkb,
        bottomDepthMkb: g.bottomDepthMkb,
        cleanVolPumpedM3: g.cleanVolPumpedM3,
      })),
    })),
    logs: logRuns.map((l) => ({
      date: l.report.reportDate, topMkb: l.topMkb, btmMkb: l.btmMkb,
      type: l.type, cased: l.cased,
    })),
    tubingStrings: tubingBlocks(well.tubingStrings),
    rodStrings: well.rodStrings.map((r) => ({
      caption: r.description ?? "Rod String",
      header: [
        cell("Run Date", r.runDate),
        cell("Set Depth (mKB)", r.setDepthMkb, "decimal"),
      ],
      components: r.components.map((c) => ({
        itemDes: c.itemDes, odNominalIn: c.odNominalIn, massPerLenKgM: c.massPerLenKgM,
        grade: c.grade, joints: c.joints, lenM: c.lenM, topMkb: c.topMkb, btmMkb: c.btmMkb,
      })),
    })),
    // One HeaderRow per pump: the sample prints 23 named properties in a block,
    // not a table, because they are the properties of ONE object.
    rodPumps: well.rodPumps.map((p) => [
      cell("Make", p.make), cell("Model", p.model), cell("Serial Number", p.serialNo),
      cell("Pump Bore (in)", p.pumpBoreIn, "in3"),
      cell("API Pump Type", p.apiPumpType), cell("API Barrel Type", p.apiBarrelType),
      cell("API Anchor Type", p.apiAnchorType), cell("Seat Assy Typ", p.seatAssyType),
      cell("Barrel Length (m)", p.barrelLenM, "decimal"),
      cell("Nom Plunger Len (m)", p.nomPlungerLenM, "decimal"),
      cell("Upper Ext Len (m)", p.upperExtLenM, "decimal"),
      cell("Lwr Ext Len (m)", p.lowerExtLenM, "decimal"),
      cell("Plung OD Clr (in)", p.plungerOdClearanceIn, "in3"),
      cell("Seating Assembly Description", p.seatingAssemblyDes),
      cell("Seat Assy Sz (in)", p.seatAssySizeIn, "in3"),
      cell("API Barrel Material", p.apiBarrelMaterial),
      cell("API Plunger Material", p.apiPlungerMaterial),
      cell("Gas Anc OD (in)", p.gasAnchorOdIn, "in3"),
      cell("Gas Anchor Length (m)", p.gasAnchorLenM, "decimal"),
      cell("Traveling Valve Ball Material", p.travelingValveBallMaterial),
      cell("Traveling Valve Seat Material", p.travelingValveSeatMaterial),
      cell("Standing Valve Ball Material", p.standingValveBallMaterial),
      cell("Standing Valve Seat Material", p.standingValveSeatMaterial),
    ]),
    swabs: well.swabs.map((w) => ({
      date: w.date, swabCompany: w.swabCompany, zone: w.zone?.name ?? null,
      totalVolBbl: w.totalVolBbl, totalOilBbl: w.totalOilBbl, totalBswBbl: w.totalBswBbl,
    })),
    jobs: well.jobs.map((j) => ({
      startDate: j.startDate, endDate: j.endDate,
      jobType: j.primaryJobType, jobSubType: j.secondaryJobType, summary: j.summary,
    })),
    attachments: well.attachments.map((a) => ({ des: a.des, kind: a.kind, date: a.date })),
    totals: [
      cell("Wellbores", well.wellbores.length, "int"),
      cell("Casing Strings", well.casingStrings.length, "int"),
      cell("Cement Stages", cementJobs.length, "int"),
      cell("Zones", well.zones.length, "int"),
      cell("Perforations", well.perforations.length, "int"),
      cell("Tubing Strings", well.tubingStrings.length, "int"),
      cell("Total Depth (mKB)", totalDepth, "decimal"),
    ],
  };
}
