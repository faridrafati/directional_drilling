/**
 * Reports 04 (Casing, Liner and Cement) and 05 (Casing Summary).
 *
 * 05 is the whole well: every string, each with its properties line and its
 * tally. 04 is ONE string in full — the same tally plus the hole sections, the
 * wellhead, the last mud check, and the cement job with its stages, fluids and
 * additives.
 *
 * One assembler, because 04's casing block IS 05's row. Two would drift on the
 * tally's column set, which is the part an engineer actually reads.
 *
 * WHAT IS COMPUTED
 * ----------------
 * Very little, and deliberately. The sample prints Len, Top and Btm for every
 * tally line — all three — so none is derived from the other two: a tally with
 * a gap in it (a section pulled, a joint mis-measured) is a real thing, and
 * recomputing Len from the depths would quietly paper over it.
 *
 * The only derived figures are the roll-ups no column holds:
 *   String length  Σ the tally's lengths
 *   Joint count    Σ the tally's joint counts
 *   Cement volume  Σ the stage's fluids' pumped volumes, when the stage itself
 *                  records none
 *
 * "Last Mud Check" is the most recent mud check filed on or before the string's
 * run date — not the newest on the well. A cement job is judged against the mud
 * that was in the hole when it was pumped.
 */
import type { PrismaClient } from "@prisma/client";
import { compareJalali, jalaliKey } from "@dd/shared";
import {
  printedOn, standardWellHeader, type HeaderCell, type HeaderRow, type ReportEnvelope,
} from "./chrome.js";
import { buildSchematic, type SchematicPayload } from "./schematic.js";

const round = (n: number, dp = 2) => Number(n.toFixed(dp));
function sumOrNull(values: (number | null | undefined)[], dp = 2): number | null {
  let any = false, total = 0;
  for (const v of values) {
    if (v === null || v === undefined || !Number.isFinite(v)) continue;
    any = true; total += v;
  }
  return any ? round(total, dp) : null;
}
const cell = (label: string, value: string | number | null, kind?: HeaderCell["kind"]): HeaderCell =>
  ({ label, value, kind });

export interface CasingComponentRow {
  jts: number | null;
  itemDes: string | null;
  odIn: string | null;
  idIn: number | null;
  massPerLenKgM: number | null;
  grade: string | null;
  topThread: string | null;
  topMkb: number | null;
  btmMkb: number | null;
  lenM: number | null;
  pBurstPsi: number | null;
  pCollapsePsi: number | null;
}

export interface CasingStringBlock {
  /** "Surface Casing, 4,253.0mKB" — the sample's own block caption. */
  caption: string;
  properties: HeaderRow;
  components: CasingComponentRow[];
  /** Σ the tally — no column prints these, so they are stated beneath it. */
  totals: HeaderRow;
}

export interface Report05Payload extends ReportEnvelope {
  strings: CasingStringBlock[];
}

export interface CementFluidBlock {
  fluid: HeaderRow[];
  additives: { additive: string | null; additiveType: string | null; concentration: string | null }[];
}

export interface Report04Payload extends ReportEnvelope {
  /** "Deviated - Original Hole" — the sample's schematic caption. */
  runCaption: string;
  wellbore: HeaderRow;
  sections: { sectionDes: string | null; sizeIn: string | null; actTopMkb: number | null; actBtmMkb: number | null }[];
  wellhead: {
    des: string | null; make: string | null; model: string | null;
    sn: string | null; wpTopPsi: number | null;
  }[];
  lastMudCheck: HeaderRow;
  casing: CasingStringBlock;
  /** Null when the string has no cement job recorded. */
  cement: {
    header: HeaderRow[];
    stages: { header: HeaderRow[]; fluids: CementFluidBlock[] }[];
  } | null;
  /** Report 04 draws a vertical schematic; see the status doc for why we do not. */
  /** The wellbore section the sample draws beside these blocks. */
  schematic: SchematicPayload;
}

/** The tally + properties block both reports print for one string. */
function stringBlock(s: {
  description: string | null;
  setDepthMkb: number | null;
  setTensionKn: number | null;
  stringNominalOdIn: string | null;
  stringMinDriftIn: number | null;
  centralizers: string | null;
  scratchers: string | null;
  components: CasingComponentRow[];
}): CasingStringBlock {
  return {
    caption: [
      s.description,
      s.setDepthMkb === null ? null : `${s.setDepthMkb.toFixed(1)}mKB`,
    ].filter(Boolean).join(", "),
    properties: [
      cell("Set Depth (mKB)", s.setDepthMkb, "decimal"),
      cell("Set Tension (kN)", s.setTensionKn, "decimal"),
      cell("String Nominal OD (in)", s.stringNominalOdIn),
      cell("String Min Drift (in)", s.stringMinDriftIn, "in3"),
      cell("Centralizers", s.centralizers),
      cell("Scratchers", s.scratchers),
    ],
    components: s.components,
    totals: [
      cell("Joints", sumOrNull(s.components.map((c) => c.jts)), "int"),
      cell("String Length (m)", sumOrNull(s.components.map((c) => c.lenM))),
    ],
  };
}

const toComponent = (c: {
  jts: number | null; itemDes: string | null; odIn: string | null; idIn: number | null;
  massPerLenKgM: number | null; grade: string | null; topThread: string | null;
  topMkb: number | null; btmMkb: number | null; lenM: number | null;
  pBurstPsi: number | null; pCollapsePsi: number | null;
}): CasingComponentRow => ({ ...c });

export async function buildReport05(
  prisma: PrismaClient,
  wellId: string,
): Promise<Report05Payload | null> {
  const well = await prisma.entryWell.findUnique({ where: { id: wellId } });
  if (!well) return null;
  const strings = await prisma.casingString.findMany({
    where: { wellId },
    orderBy: { order: "asc" },
    include: { components: { orderBy: { order: "asc" } } },
  });

  return {
    type: "05",
    title: "Casing Summary",
    wellName: well.name,
    headerVariant: "standard",
    header: standardWellHeader(well),
    printedOn: printedOn(),
    strings: strings.map((s) => stringBlock({ ...s, components: s.components.map(toComponent) })),
  };
}

export async function buildReport04(
  prisma: PrismaClient,
  casingStringId: string,
): Promise<Report04Payload | null> {
  const s = await prisma.casingString.findUnique({
    where: { id: casingStringId },
    include: {
      well: {
        include: {
          holeSections: { orderBy: { order: "asc" }, include: { wellbore: true } },
        },
      },
      wellbore: true,
      components: { orderBy: { order: "asc" } },
      cementJobs: {
        orderBy: { order: "asc" },
        include: {
          stages: {
            orderBy: { order: "asc" },
            include: {
              fluids: {
                orderBy: { order: "asc" },
                include: { additives: { orderBy: { order: "asc" } } },
              },
            },
          },
        },
      },
    },
  });
  if (!s) return null;
  const well = s.well;
  // The sample draws the wellbore section beside these blocks.
  const schematic = await buildSchematic(prisma, well.id);

  // The wellhead as installed, from the daily rows: the newest entry for each
  // component, so a spool re-recorded on a later day prints once.
  const wellheadRows = await prisma.entryWellheadComponent.findMany({
    where: { report: { wellId: well.id } },
    orderBy: { order: "asc" },
    include: { report: { select: { reportDate: true } } },
  });
  const wellheadByKey = new Map<string, (typeof wellheadRows)[number]>();
  for (const w of wellheadRows) {
    const key = [w.sizeIn, w.type, w.make].join("|");
    const seen = wellheadByKey.get(key);
    if (!seen || compareJalali(w.report.reportDate, seen.report.reportDate) > 0) {
      wellheadByKey.set(key, w);
    }
  }

  // The mud that was in the hole when this string was run — not the newest on
  // the well. A cement job is judged against the mud it was pumped through.
  const runKey = jalaliKey(s.runDate);
  const mudRows = await prisma.entryMud.findMany({
    where: { report: { wellId: well.id } },
    include: { report: { select: { reportDate: true } } },
  });
  const eligible = mudRows.filter((m) => {
    if (runKey === null) return true;
    const k = jalaliKey(m.report.reportDate);
    return k !== null && k <= runKey;
  });
  eligible.sort((a, b) => compareJalali(b.report.reportDate, a.report.reportDate));
  const mud = eligible[0] ?? null;

  const job = s.cementJobs[0] ?? null;

  return {
    type: "04",
    title: "Casing, Liner and Cement report",
    wellName: well.name,
    identityRight: s.description,
    headerVariant: "standard",
    header: standardWellHeader(well),
    printedOn: printedOn(),
    runCaption: [well.profile, s.wellbore?.name ?? null].filter(Boolean).join(" - "),
    wellbore: [
      cell("Wellbore Name", s.wellbore?.name ?? null),
      cell("Profile Type", well.profile),
      cell("Kick Off Depth (mKB)", s.wellbore?.koMdMkb ?? null, "decimal"),
      cell("Vertical Section Direction (°)", null),
    ],
    sections: well.holeSections.map((h) => ({
      sectionDes: h.sectionDes, sizeIn: h.sizeIn,
      actTopMkb: h.actTopMkb, actBtmMkb: h.actBtmMkb,
    })),
    wellhead: [...wellheadByKey.values()].map((w) => ({
      des: [w.sizeIn === null ? null : `${w.sizeIn}"`, w.type].filter(Boolean).join(" ") || null,
      make: w.make, model: w.model, sn: w.sn, wpTopPsi: w.wpPsi,
    })),
    lastMudCheck: mud
      ? [
        cell("Date", mud.report.reportDate),
        cell("Type", mud.mudSystem),
        cell("Depth (mKB)", mud.depthMkb, "decimal"),
        cell("Dens (ppg)", mud.densityMaxPpg ?? mud.densityMinPpg, "decimal"),
        cell("Vis (s/qt)", mud.funnelVisc, "decimal"),
        cell("Gel (10s) (lbf/100ft²)", mud.gelInitial, "decimal"),
        cell("Gel (10m) (lbf/100ft²)", mud.gel10min, "decimal"),
        cell("PV OR (cp)", mud.pv, "decimal"),
        cell("YP OR (lbf/100ft²)", mud.yp, "decimal"),
      ]
      : [
        cell("Date", null), cell("Type", null), cell("Depth (mKB)", null),
        cell("Dens (ppg)", null), cell("Vis (s/qt)", null),
        cell("Gel (10s) (lbf/100ft²)", null), cell("Gel (10m) (lbf/100ft²)", null),
        cell("PV OR (cp)", null), cell("YP OR (lbf/100ft²)", null),
      ],
    casing: stringBlock({ ...s, components: s.components.map(toComponent) }),
    cement: job
      ? {
        header: [
          [
            cell("Cementing Start Date", job.startDate),
            cell("Cementing End Date", job.endDate),
            cell("Wellbore", s.wellbore?.name ?? null),
          ],
          [
            cell("Evaluation Method", job.evaluationMethod),
            cell("Cement Evaluation Results", job.evaluationResults),
          ],
          [cell("Comment", job.comment)],
        ],
        stages: job.stages.map((st) => ({
          header: [
            [
              cell("Top Depth (mKB)", st.topDepthMkb, "decimal"),
              cell("Bottom Depth (mKB)", st.bottomDepthMkb, "decimal"),
              cell("Full Return?", yesNo(st.fullReturn)),
              // Σ the fluids when the stage records no volume of its own — the
              // sample prints 0.0 there and the fluids carry the real figures.
              cell("Vol Cement (m³)", st.volCementM3 ?? sumOrNull(st.fluids.map((f) => f.volumePumpedM3)), "decimal"),
              cell("Top Plug?", yesNo(st.topPlug)),
              cell("Bottom Plug?", yesNo(st.bottomPlug)),
            ],
            [
              cell("Q Pump Init (m³/min)", st.qPumpInitM3Min, "decimal"),
              cell("Q Pump Final (m³/min)", st.qPumpFinalM3Min, "decimal"),
              cell("Avg Pump Rate (m³/min)", st.avgPumpRateM3Min, "decimal"),
              cell("Final Pump Pressure (psi)", st.finalPumpPressurePsi, "decimal"),
              cell("Plug Bump Pressure (psi)", st.plugBumpPressurePsi, "decimal"),
            ],
            [
              cell("Pipe Reciprocated?", yesNo(st.pipeReciprocated)),
              cell("Stroke (m)", st.strokeM, "decimal"),
              cell("Reciprocation Rate (spm)", st.reciprocationRateSpm, "decimal"),
              cell("Pipe Rotated?", yesNo(st.pipeRotated)),
              cell("Pipe RPM (rpm)", st.pipeRpm, "decimal"),
            ],
            [
              cell("Tagged Depth (mKB)", st.taggedDepthMkb, "decimal"),
              cell("Tag Method", st.tagMethod),
              cell("Depth Plug Drilled Out (mKB)", st.depthPlugDrilledOutMkb, "decimal"),
              cell("Drill Out Diameter (in)", st.drillOutDiameterIn),
              cell("Drill Out Date", st.drillOutDate),
            ],
          ],
          fluids: st.fluids.map((f) => ({
            fluid: [
              [
                cell("Fluid Type", f.fluidType),
                cell("Fluid Description", f.fluidDescription),
                cell("Amount (sacks)", f.amountSacks, "decimal"),
                cell("Class", f.cementClass),
                cell("Volume Pumped (m³)", f.volumePumpedM3, "decimal"),
              ],
              [
                cell("Estimated Top (mKB)", f.estimatedTopMkb, "decimal"),
                cell("Est Btm (mKB)", f.estimatedBtmMkb, "decimal"),
                cell("Yield (L/sack)", f.yieldLPerSack, "decimal"),
                cell("Mix H₂O Ratio (L/sack)", f.mixWaterLPerSack, "decimal"),
                cell("Free Water (%)", f.freeWaterPct, "decimal"),
              ],
              [
                cell("Density (ppg)", f.densityPpg, "decimal"),
                cell("Plastic Viscosity (cp)", f.plasticViscosityCp, "decimal"),
                cell("Thickening Time (hr)", f.thickeningTimeHr, "decimal"),
                cell("1st Compressive Strength (psi)", f.compressiveStrengthPsi, "decimal"),
              ],
            ],
            additives: f.additives.map((a) => ({
              additive: a.additive, additiveType: a.additiveType, concentration: a.concentration,
            })),
          })),
        })),
      }
      : null,
    schematic,
  };
}

/** Yes / No / blank — unanswered is not the same as "no". */
const yesNo = (v: boolean | null): string | null => (v === null ? null : v ? "Yes" : "No");
