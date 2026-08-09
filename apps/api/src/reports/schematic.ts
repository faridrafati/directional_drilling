/**
 * The shared WELLBORE SCHEMATIC payload.
 *
 * Six samples draw one — 02 and 04 down a left rail, 09 down a left column, 21
 * as the centre of a composite log, and 24, 28 and 29 as the whole page. They
 * are the same picture at different sizes, so this assembles it ONCE, as data,
 * and every renderer draws the same shapes from the same numbers.
 *
 * WHAT A SCHEMATIC IS, HERE
 * -------------------------
 * A depth-indexed section: hole sections as the rock the bit made, casing
 * strings nested inside them, cement in the annulus between, and formation
 * bands beside. Nothing in it is invented — every interval comes from a row
 * somebody typed:
 *
 *   hole      ← HoleSection            (act top / act btm / size)
 *   casing    ← CasingString           (set depth) + its tally (the string's OD)
 *   cement    ← CementStage            (top / bottom depth)
 *   formation ← WellFormation          (drilled top / btm, or prognosed)
 *   shoe      ← the tally's Float Shoe row, at its own depth
 *
 * A string with no set depth and no tally has no extent, so it is DROPPED
 * rather than drawn from zero — a schematic that invents a depth is worse than
 * one that admits it has none.
 *
 * SCALE IS THE RENDERER'S JOB, NOT THIS FILE'S
 * --------------------------------------------
 * Everything here is in metres. The drawing decides how many pixels a metre is,
 * because the same payload is drawn 120 px wide down report 02's rail and full
 * page on report 28.
 */
import type { PrismaClient } from "@prisma/client";
import { compareJalali } from "@dd/shared";
import { plotWellHeader, printedOn, type HeaderRow, type ReportEnvelope } from "./chrome.js";

/** One drawn interval, in metres below KB. */
export interface SchematicInterval {
  topMkb: number;
  btmMkb: number;
  /** Printed beside the interval, e.g. "13 3/8 Surface Casing". */
  label: string | null;
  /** Outer diameter in INCHES where known — the drawing nests by this. */
  odIn: number | null;
  /** Free text for the tooltip / legend, e.g. the tally's grade. */
  detail: string | null;
}

export interface SchematicPayload {
  /** The deepest thing on the picture, so every renderer shares one scale. */
  maxDepthMkb: number | null;
  holeSections: SchematicInterval[];
  casingStrings: SchematicInterval[];
  cementIntervals: SchematicInterval[];
  formations: SchematicInterval[];
  /** Shoes are drawn as a mark, not a band — top and btm are the same depth. */
  shoes: SchematicInterval[];
  /**
   * The COMPLETION string, inside the casing: tubing, the TRSSV, the packer.
   * The Tier 5 samples label these on the picture ("2-1; Tubing", "2-4; TRSSV"),
   * which is why they are their own list rather than more casing — they nest
   * inside it and a reader has to be able to tell them apart.
   */
  completionItems: SchematicInterval[];
  /**
   * Why the picture is empty, when it is. The page prints this instead of an
   * empty frame, so "nothing entered" never looks like "nothing there".
   */
  emptyReason: string | null;
}

/**
 * Inches from a size string.
 *
 * The tallies store "13 3/8" and "20" and "10.752" in one TEXT column, because
 * that is how a tally is written. A schematic nests strings by diameter, so the
 * fraction has to become a number — and a value that will not parse yields null
 * rather than 0, which would draw the string as a hairline at the axis.
 */
export function parseInches(value: string | null | undefined): number | null {
  if (!value) return null;
  const text = value.trim();
  const mixed = /^(\d+)\s+(\d+)\s*\/\s*(\d+)$/.exec(text);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const fraction = /^(\d+)\s*\/\s*(\d+)$/.exec(text);
  if (fraction) return Number(fraction[1]) / Number(fraction[2]);
  const plain = Number.parseFloat(text);
  return Number.isFinite(plain) ? plain : null;
}

export async function buildSchematic(
  prisma: PrismaClient,
  wellId: string,
): Promise<SchematicPayload> {
  const [holes, strings, formations, tubing] = await Promise.all([
    prisma.holeSection.findMany({ where: { wellId }, orderBy: { order: "asc" } }),
    prisma.casingString.findMany({
      where: { wellId },
      orderBy: { order: "asc" },
      include: {
        components: { orderBy: { order: "asc" } },
        cementJobs: {
          orderBy: { order: "asc" },
          include: { stages: { orderBy: { order: "asc" } } },
        },
      },
    }),
    prisma.wellFormation.findMany({ where: { wellId }, orderBy: { order: "asc" } }),
    prisma.tubingString.findMany({
      where: { wellId },
      orderBy: { order: "asc" },
      include: { components: { orderBy: { order: "asc" } } },
    }),
  ]);

  const holeSections: SchematicInterval[] = holes
    .filter((h) => h.actTopMkb !== null && h.actBtmMkb !== null)
    .map((h) => ({
      topMkb: h.actTopMkb as number,
      btmMkb: h.actBtmMkb as number,
      label: [h.sizeIn ? `${h.sizeIn}"` : null, h.sectionDes].filter(Boolean).join(" ") || null,
      odIn: parseInches(h.sizeIn),
      detail: h.sectionDes,
    }));

  const casingStrings: SchematicInterval[] = [];
  const cementIntervals: SchematicInterval[] = [];
  const shoes: SchematicInterval[] = [];

  for (const s of strings) {
    // A string runs from surface to its set depth. Where no set depth was
    // typed, the tally's deepest bottom stands in — a string that has neither
    // has no extent and is dropped, because drawing it from zero to zero says
    // something false.
    const tallyBottom = s.components.reduce<number | null>(
      (deep, c) => (c.btmMkb !== null && (deep === null || c.btmMkb > deep) ? c.btmMkb : deep),
      null,
    );
    const btm = s.setDepthMkb ?? tallyBottom;
    if (btm === null) continue;

    const od = parseInches(s.stringNominalOdIn)
      ?? s.components.map((c) => parseInches(c.odIn)).find((v) => v !== null) ?? null;

    casingStrings.push({
      topMkb: 0,
      btmMkb: btm,
      label: [s.stringNominalOdIn ? `${s.stringNominalOdIn}"` : null, s.description]
        .filter(Boolean).join(" ") || null,
      odIn: od,
      detail: s.runDate,
    });

    for (const c of s.components) {
      if (!/shoe/i.test(c.itemDes ?? "")) continue;
      const at = c.btmMkb ?? c.topMkb;
      if (at === null) continue;
      shoes.push({
        topMkb: at, btmMkb: at,
        label: [s.stringNominalOdIn ? `${s.stringNominalOdIn}"` : null, "shoe"].filter(Boolean).join(" "),
        odIn: od,
        detail: c.itemDes,
      });
    }

    for (const job of s.cementJobs) {
      for (const st of job.stages) {
        if (st.topDepthMkb === null || st.bottomDepthMkb === null) continue;
        cementIntervals.push({
          topMkb: st.topDepthMkb,
          btmMkb: st.bottomDepthMkb,
          label: job.description,
          odIn: od,
          detail: st.fullReturn === true ? "Full returns" : st.fullReturn === false ? "Partial returns" : null,
        });
      }
    }
  }

  // Formations use the DRILLED interval where it exists and the prognosis
  // otherwise, so a schematic drawn before spud still shows the section — and
  // the label says which it is, because a predicted top drawn as a fact is how
  // a picture starts lying.
  const formationBands: SchematicInterval[] = formations.flatMap((f) => {
    const drilledTop = f.drillTopMd, drilledBtm = f.drillBtmMd;
    const progTop = f.progTopTvd, progBtm = f.progBtmTvd;
    const top = drilledTop ?? progTop;
    const btm = drilledBtm ?? progBtm;
    if (top === null || btm === null) return [];
    const predicted = drilledTop === null;
    return [{
      topMkb: top,
      btmMkb: btm,
      label: f.name,
      odIn: null,
      detail: [f.lithDes, predicted ? "prognosed" : null].filter(Boolean).join(" · ") || null,
    }];
  });

  // The completion string, numbered as the samples number it: string index,
  // then item index, then what the item is — "2-1; Tubing".
  const completionItems: SchematicInterval[] = tubing.flatMap((t, ti) =>
    t.components.flatMap((c, ci) => {
      const top = c.topMkb;
      const btm = c.btmMkb ?? (top !== null && c.lenM !== null ? top + c.lenM : null);
      if (top === null || btm === null) return [];
      return [{
        topMkb: top,
        btmMkb: btm,
        label: `${ti + 2}-${ci + 1}; ${c.itemDes ?? "item"}`,
        odIn: parseInches(c.odIn),
        detail: [t.description, c.make, c.model].filter(Boolean).join(" · ") || null,
      }];
    }));

  const everything = [...holeSections, ...casingStrings, ...cementIntervals, ...formationBands, ...shoes, ...completionItems];
  const maxDepthMkb = everything.length
    ? Math.max(...everything.map((i) => Math.max(i.topMkb, i.btmMkb)))
    : null;

  return {
    maxDepthMkb,
    holeSections,
    casingStrings,
    cementIntervals,
    formations: formationBands,
    shoes,
    completionItems,
    emptyReason: everything.length === 0
      ? "Nothing to draw: this well has no hole section, casing string, formation or completion "
        + "item with a depth. They are entered under Well data → Casing & cement, → Geology and "
        + "→ Completion."
      : null,
  };
}

/* ══ report 21 — Geological Schematic ════════════════════════════════════════ */


/** One depth-indexed band on a categorical track (lithology, mud). */
export interface SchematicBand {
  topMkb: number;
  btmMkb: number;
  label: string | null;
}

/** One survey station, as report 21's left-hand columns print it. */
export interface SchematicStation {
  md: number | null;
  tvd: number | null;
  inc: number | null;
  dls: number | null;
}

/** One point on a parameter curve — the tracks down report 21's right. */
export interface ParameterPoint {
  depthMkb: number;
  densPpg: number | null;
  intRopMHr: number | null;
  rpm: number | null;
  qFlowGpm: number | null;
  wob1000Lbf: number | null;
}

export interface Report21Payload extends ReportEnvelope {
  caption: string;
  schematic: SchematicPayload;
  stations: SchematicStation[];
  /** The mud logger's intervals, deepest last — report 21's litho track. */
  lithology: SchematicBand[];
  /** The mud system in the hole, as bands over the depths it was used at. */
  mud: SchematicBand[];
  parameters: ParameterPoint[];
  totals: HeaderRow;
}

const WELL_SELECT_21 = {
  name: true, field: true, apiUwi: true, licenseNo: true, stateProvince: true,
  location: true, profile: true, groundElevation: true, casingFlangeElevation: true,
  kbGroundDistance: true, kbCasingFlangeDistance: true, spudDate: true, rigReleasedDate: true,
} as const;

export async function buildReport21(
  prisma: PrismaClient,
  wellId: string,
): Promise<Report21Payload | null> {
  const well = await prisma.entryWell.findUnique({
    where: { id: wellId },
    select: { ...WELL_SELECT_21, wellbores: { orderBy: { order: "asc" }, select: { name: true } } },
  });
  if (!well) return null;

  const [schematic, surveys, lithology, muds, params] = await Promise.all([
    buildSchematic(prisma, wellId),
    prisma.entrySurvey.findMany({
      where: { report: { wellId } },
      include: { report: { select: { reportDate: true } } },
    }),
    prisma.entryLithology.findMany({
      where: { report: { wellId } },
      orderBy: { order: "asc" },
    }),
    prisma.entryMud.findMany({
      where: { report: { wellId } },
      include: { report: { select: { reportDate: true } } },
    }),
    prisma.entryDrillingParameter.findMany({
      where: { report: { wellId } },
      include: { report: { select: { reportDate: true } } },
    }),
  ]);

  // Stations run DOWN the hole. They come from many days, so they are sorted by
  // depth rather than by row order — a day entered out of sequence would draw
  // the track running back up itself.
  const stations: SchematicStation[] = surveys
    .slice()
    .sort((a, b) => {
      if (a.md !== null && b.md !== null && a.md !== b.md) return a.md - b.md;
      return compareJalali(a.report.reportDate, b.report.reportDate);
    })
    .map((s) => ({ md: s.md, tvd: s.tvd, inc: s.inc, dls: s.dls }));

  const lithoBands: SchematicBand[] = lithology
    .filter((l) => l.topMkb !== null && l.btmMkb !== null)
    .map((l) => ({
      topMkb: l.topMkb as number,
      btmMkb: l.btmMkb as number,
      label: l.type ?? l.typeCode ?? l.des,
    }))
    .sort((a, b) => a.topMkb - b.topMkb);

  // The mud track: each check is a band from where the PREVIOUS check was taken
  // to its own depth, because a check describes the mud that has been in the
  // hole since the last one — not a point.
  const mudChecks = muds
    .filter((m) => m.depthMkb !== null && m.mudSystem)
    .sort((a, b) => (a.depthMkb as number) - (b.depthMkb as number));
  const mudBands: SchematicBand[] = mudChecks.map((m, i) => ({
    topMkb: i === 0 ? 0 : (mudChecks[i - 1].depthMkb as number),
    btmMkb: m.depthMkb as number,
    label: m.mudSystem,
  }));

  // Parameter curves, keyed on the interval's END depth: the reading describes
  // the metres just drilled, and hanging it at the start would put every value
  // one interval too shallow.
  const parameters: ParameterPoint[] = params
    .filter((p) => p.endDepthMkb !== null)
    .sort((a, b) => (a.endDepthMkb as number) - (b.endDepthMkb as number))
    .map((p) => {
      const mud = mudChecks
        .filter((m) => (m.depthMkb as number) <= (p.endDepthMkb as number))
        .slice(-1)[0] ?? null;
      const metres = p.startMkb === null || p.endDepthMkb === null
        ? null : p.endDepthMkb - p.startMkb;
      return {
        depthMkb: p.endDepthMkb as number,
        densPpg: mud ? (mud.densityMaxPpg ?? mud.densityMinPpg) : null,
        intRopMHr: p.intRopMHr
          ?? (metres === null || !p.drillTimeHr ? null : Number((metres / p.drillTimeHr).toFixed(2))),
        rpm: p.rpm,
        qFlowGpm: p.qFlowGpm,
        wob1000Lbf: p.wob1000Lbf,
      };
    });

  return {
    type: "21",
    title: "Schematic",
    wellName: well.name,
    headerVariant: "plot",
    header: plotWellHeader(well),
    printedOn: printedOn(),
    caption: [well.profile, well.wellbores[0]?.name ?? null].filter(Boolean).join(" - "),
    schematic,
    stations,
    lithology: lithoBands,
    mud: mudBands,
    parameters,
    totals: [
      { label: "Hole Sections", value: schematic.holeSections.length, kind: "int" },
      { label: "Casing Strings", value: schematic.casingStrings.length, kind: "int" },
      { label: "Formations", value: schematic.formations.length, kind: "int" },
      { label: "Survey Stations", value: stations.length, kind: "int" },
      { label: "Deepest (mKB)", value: schematic.maxDepthMkb, kind: "decimal" },
    ],
  };
}
