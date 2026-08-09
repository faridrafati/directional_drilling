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

  const [schematic, totalDepth, wellheadRows] = await Promise.all([
    buildSchematic(prisma, wellId),
    totalDepthOf(prisma, wellId),
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
    completionHeader: completionHeader(well, well.wellbores[0]?.name ?? null, pbtd, totalDepth),
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

  const [schematic, totalDepth] = await Promise.all([
    buildSchematic(prisma, wellId),
    totalDepthOf(prisma, wellId),
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
    completionHeader: completionHeader(well, well.wellbores[0]?.name ?? null, pbtd, totalDepth),
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

  const [schematic, totalDepth] = await Promise.all([
    buildSchematic(prisma, wellId),
    totalDepthOf(prisma, wellId),
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
    completionHeader: completionHeader(well, well.wellbores[0]?.name ?? null, pbtd, totalDepth),
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

export interface Report22Payload extends ReportEnvelope {
  identity: HeaderRow[];
  caption: string;
  schematic: SchematicPayload;
  wellbore: HeaderRow;
  holeSections: { sizeIn: string | null; actTopMkb: number | null; actBtmMkb: number | null }[];
  plugBacks: { date: string | null; depthMkb: number | null; method: string | null; com: string | null }[];
  formations: {
    name: string | null; elementType: string | null; h2sConcPct: number | null;
    finalTopMd: number | null; finalTopTvd: number | null;
  }[];
  deviationSurveys: { date: string | null; des: string | null; proposed: boolean | null; definitive: boolean | null }[];
  reservoirs: { name: string | null; topMkb: number | null; btmMkb: number | null; datumDepthM: number | null }[];
  casingStrings: {
    caption: string; runDate: string | null; centralizers: string | null;
    scratchers: string | null; minDriftIn: number | null;
  }[];
  tubingStrings: TubingBlock[];
  perforations: { date: string | null; zone: string | null; topMkb: number | null; btmMkb: number | null }[];
  totals: HeaderRow;
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
      casingStrings: { orderBy: { order: "asc" } },
    },
  });
  if (!well) return null;

  const [schematic, totalDepth] = await Promise.all([
    buildSchematic(prisma, wellId),
    totalDepthOf(prisma, wellId),
  ]);
  const bore = well.wellbores[0] ?? null;

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
      cell("Profile Type", bore?.kind ?? well.profile),
      cell("KO MD (mKB)", bore?.koMdMkb ?? null, "decimal"),
      cell("Total Depth (mKB)", totalDepth, "decimal"),
    ],
    holeSections: well.holeSections.map((h) => ({
      sizeIn: h.sizeIn, actTopMkb: h.actTopMkb, actBtmMkb: h.actBtmMkb,
    })),
    plugBacks: well.plugBacks.map((p) => ({
      date: p.date, depthMkb: p.depthMkb, method: p.method, com: p.com,
    })),
    formations: well.formations.map((f) => ({
      name: f.name, elementType: f.elementType, h2sConcPct: f.h2sConcPct,
      finalTopMd: f.finalTopMd ?? f.drillTopMd, finalTopTvd: f.drillTopTvd,
    })),
    deviationSurveys: well.deviationSurveys.map((d) => ({
      date: d.date, des: d.des, proposed: d.proposed, definitive: d.definitive,
    })),
    reservoirs: well.reservoirs.map((r) => ({
      name: r.name, topMkb: r.topMkb, btmMkb: r.btmMkb, datumDepthM: r.datumDepthM,
    })),
    casingStrings: well.casingStrings.map((c) => ({
      caption: [c.description ?? "Casing", c.setDepthMkb === null ? null : `${c.setDepthMkb.toFixed(1)}mKB`]
        .filter(Boolean).join(", "),
      runDate: c.runDate, centralizers: c.centralizers, scratchers: c.scratchers,
      minDriftIn: c.stringMinDriftIn,
    })),
    tubingStrings: tubingBlocks(well.tubingStrings),
    perforations: well.perforations.map((p) => ({
      date: p.date, zone: p.zone?.name ?? null, topMkb: p.topMkb, btmMkb: p.btmMkb,
    })),
    totals: [
      cell("Hole Sections", well.holeSections.length, "int"),
      cell("Casing Strings", well.casingStrings.length, "int"),
      cell("Formations", well.formations.length, "int"),
      cell("Perforations", well.perforations.length, "int"),
      cell("Reservoirs", well.reservoirs.length, "int"),
      cell("Total Depth (mKB)", totalDepth, "decimal"),
    ],
  };
}

/* ══ report 30 — Well Summary ════════════════════════════════════════════════ */

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

  const [totalDepth, wellheadRows] = await Promise.all([
    totalDepthOf(prisma, wellId),
    prisma.entryWellheadComponent.findMany({
      where: { report: { wellId } },
      orderBy: { order: "asc" },
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
      company: null as string | null,
      stage: [
        cell("Top Depth (mKB)", st.topDepthMkb, "decimal"),
        cell("Bottom Depth (mKB)", st.bottomDepthMkb, "decimal"),
        cell("Full Return?", st.fullReturn === null ? null : st.fullReturn ? "Yes" : "No"),
        cell("Vol Cement (m³)", st.volCementM3, "decimal"),
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
      // The app models one hole per row with no parent link; a sidetrack names
      // its parent in its own name, so this states what is known.
      parent: null,
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
    totals: [
      cell("Wellbores", well.wellbores.length, "int"),
      cell("Casing Strings", well.casingStrings.length, "int"),
      cell("Cement Stages", cementJobs.length, "int"),
      cell("Wellhead Components", byKey.size, "int"),
      cell("Total Depth (mKB)", totalDepth, "decimal"),
    ],
  };
}
