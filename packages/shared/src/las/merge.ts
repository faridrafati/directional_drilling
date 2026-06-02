/**
 * FMI two-file LAS merge — faithful port of old_fmi_code/Unit10.pas
 * (TForm10.Button3Click).
 *
 * Schlumberger FMI runs are recorded as two LAS files at different sample
 * rates:
 *   • HI-RES  — the 192 imaging buttons (FCD4[0]…FCA1[11]) plus the fast
 *               channels TDEP/TIME/EV/FCAX/FCAY/FCAZ/FTIM, logged at a fine
 *               depth step (e.g. 0.1 in).
 *   • LO-RES  — the slow auxiliary curves CS/CVEL/TENS/ETIM/DEVI/ANOR/P1AZ/EI/
 *               GR, logged at a coarse step.
 *
 * The merge produces ONE LAS whose rows are the hi-res depths, with each
 * lo-res auxiliary value carried forward (held constant) until the next lo-res
 * depth mark. The output column order is the fixed 211-slot layout the Pascal
 * wrote (Unit10.pas:85-292) — depth + 16 aux + 192 buttons — but slots 17/18/19
 * are reserved and skipped, so 208 columns are emitted per row (Unit10.pas:691).
 *
 * The Pascal walked both files char-by-char; we reuse the project's `parseLas`
 * to read them into matrices, then reproduce the exact depth-alignment loop.
 */
import { parseLas } from "./parser.js";
import type { LasFile } from "./types.js";

// ── The fixed 211-slot column model (Unit10.pas:85-292, 382-604). ───────────
// Slot 1 = TDEP; slots 2..16 = the named hi-res/lo-res aux curves; slots
// 17/18/19 are reserved (never written, Unit10.pas:691); slots 20..211 are the
// 192 FMI buttons in the legacy order pads D,C,B,A / rows 4..1 / buttons 0..11.

/** 1-based slot number for each named curve mnemonic (Unit10.pas:382-604). */
const AUX_SLOT: Record<string, number> = {
  TDEP: 1, TIME: 2, EV: 3, FCAX: 4, FCAY: 5, FCAZ: 6, FTIM: 7,
  CS: 8, CVEL: 9, TENS: 10, ETIM: 11, DEVI: 12, ANOR: 13, P1AZ: 14, EI: 15, GR: 16,
};

/** Pad letters and rows in the legacy emit order (Unit10.pas:101-292). */
const PAD_LETTERS = ["D", "C", "B", "A"] as const;
const ROWS = [4, 3, 2, 1] as const;

/** Build the 1-based slot number for an FMI button mnemonic, e.g. FCD4[0]→20. */
function fmiButtonSlot(letter: string, row: number, button: number): number {
  const padIdx = PAD_LETTERS.indexOf(letter as (typeof PAD_LETTERS)[number]);
  const rowIdx = ROWS.indexOf(row as (typeof ROWS)[number]);
  // 192 buttons start at slot 20; each pad block is 48 (4 rows × 12), each row 12.
  return 20 + padIdx * 48 + rowIdx * 12 + button;
}

/**
 * Map a parsed file's curves onto 1-based output slots (Unit10.pas:382-607).
 * Returns slotOfColumn[c] = output slot for data column c (or 0 = ignore).
 */
function slotMap(file: LasFile): number[] {
  const out = new Array<number>(file.curves.length).fill(0);
  file.curves.forEach((c, col) => {
    const up = c.mnemonic.toUpperCase();
    if (up in AUX_SLOT) { out[col] = AUX_SLOT[up]; return; }
    const m = up.match(/^FC([A-D])([1-4])\[(\d+)\]$/);
    if (m) out[col] = fmiButtonSlot(m[1], parseInt(m[2], 10), parseInt(m[3], 10));
  });
  return out;
}

// The fixed ~CURVE definition lines for the merged file (Unit10.pas:85-292).
const AUX_CURVE_LINES = [
  "TDEP      ..1in                                   :BOREHOLE-DEPTH",
  "TIME      .ms                                     :0.1 Inch River Time Index",
  "EV        .V                                      :Emex Voltage",
  "FCAX      .m/s2                                   :High Resolution X Acceleration",
  "FCAY      .m/s2                                   :High Resolution Y Acceleration",
  "FCAZ      .m/s2                                   :High Resolution Z Acceleration",
  "FTIM      .ms                                     :Fast Channels Acquisition Time",
  "CS        .ft/h                                   :Cable Speed",
  "CVEL      .ft/min                                 :Cable Velocity",
  "TENS      .lbf                                    :Cable Tension",
  "ETIM      .s                                      :Elapsed Logging Time",
  "DEVI      .deg                                    :Deviation",
  "ANOR      .m/s2                                   :Acceleration Computed Norm",
  "P1AZ      .deg                                    :Pad 1 Azimuth",
  "EI        .mA                                     :EMEX current",
  "GR        .gAPI                                   :Gamma Ray",
];

/** Generate the 192 FMI button ~CURVE lines (Unit10.pas:101-292). */
function buttonCurveLines(): string[] {
  const lines: string[] = [];
  for (const letter of PAD_LETTERS) {
    for (const row of ROWS) {
      for (let b = 0; b <= 11; b++) {
        const mnem = `FC${letter}${row}[${b}]`.padEnd(10);
        lines.push(`${mnem}.                                       :FMI Buttons, Pad ${letter}, Row #${row}`);
      }
    }
  }
  return lines;
}

/** Slots that are reserved and never written to a data row (Unit10.pas:691). */
const RESERVED_SLOTS = new Set([17, 18, 19]);

/** Format a merged data row from a 1-based slot→value map (Unit10.pas:691). */
function formatRow(slotValue: number[]): string {
  let s = "";
  for (let x = 1; x <= 211; x++) {
    if (RESERVED_SLOTS.has(x)) continue;
    const v = slotValue[x];
    s += (Number.isFinite(v) ? floatToStr(v) : "0") + "   ";
  }
  return s;
}

/** Match Delphi FloatToStr: trim trailing zeros, no exponent for normal magnitudes. */
function floatToStr(v: number): string {
  if (Number.isInteger(v)) return String(v);
  // Delphi shows up to 15 significant digits; trim trailing zeros.
  let s = v.toPrecision(15);
  if (s.indexOf(".") >= 0) s = s.replace(/0+$/, "").replace(/\.$/, "");
  return s;
}

/**
 * Merge a hi-res FMI file with a lo-res auxiliary file by depth alignment.
 * Returns the merged LAS as text (the Pascal wrote this to SaveDialog1).
 *
 * Algorithm (Unit10.pas:612-696):
 *   1. Advance the lo-res file to the first depth ≤ the hi-res start depth.
 *   2. For each subsequent lo-res depth `d`, emit every hi-res record whose
 *      depth is ≥ `d`, attaching the *current* lo-res aux values, until the
 *      hi-res depth drops to/below `d`. Then advance to the next lo-res depth.
 * (Depths decrease — logging up — matching the Pascal's `<=` comparisons.)
 */
export function mergeLasFiles(hiResText: string, loResText: string): string {
  const hi = parseLas(hiResText);
  const lo = parseLas(loResText);
  if (hi.curves.length === 0 || hi.data.length === 0) {
    throw new Error("Hi-res file has no curves/data.");
  }
  if (lo.curves.length === 0 || lo.data.length === 0) {
    throw new Error("Lo-res file has no curves/data.");
  }

  const hiSlot = slotMap(hi);
  const loSlot = slotMap(lo);
  const hiDepthCol = 0; // TDEP is always the first/index column.
  const loDepthCol = 0;

  // ── Header (Unit10.pas:82-294). Copy the hi-res header up to and including
  // ~CURVE, then emit our fixed curve block and the ~A marker. ──────────────
  const headerLines: string[] = [];
  for (const name of hi.sectionOrder) {
    if (name.startsWith("CURVE") || name[0] === "A") break;
    headerLines.push(`~${sectionTitle(name)}`);
    for (const l of hi.sections[name]) headerLines.push(l);
  }
  const out: string[] = [];
  out.push(...headerLines);
  out.push("~Curve Information Block");
  out.push("#MNEM.UNIT       API CODE        :CURVE DESCRIPTION");
  out.push("#---------       ----------      -------------------------");
  out.push(...AUX_CURVE_LINES);
  out.push(...buttonCurveLines());
  out.push("#--------------------------------------------------");
  out.push("~A");

  // ── Depth-aligned merge (Unit10.pas:612-696). ─────────────────────────────
  const hiStart = hi.data[0][hiDepthCol];
  let li = 0;
  // Step 1: advance lo-res to first depth ≤ hi-res start.
  while (li < lo.data.length && !(lo.data[li][loDepthCol] <= hiStart)) li++;

  let hiIdx = 0;
  // For each lo-res depth mark, emit hi-res records (carrying the lo-res aux
  // values forward) until the hi-res depth reaches/passes that mark, then move
  // to the next lo-res mark. Stops when either file is exhausted.
  for (; li < lo.data.length && hiIdx < hi.data.length; li++) {
    const loDepth = lo.data[li][loDepthCol];
    // Lo-res aux values for this depth mark (held constant downward).
    const loVals: number[] = [];
    lo.curves.forEach((_, c) => { if (loSlot[c]) loVals[loSlot[c]] = lo.data[li][c]; });

    while (hiIdx < hi.data.length) {
      const hiRow = hi.data[hiIdx];
      const slotValue = new Array<number>(212).fill(0);
      // Lo-res aux carried forward, then hi-res values fill/override.
      for (let s = 1; s <= 211; s++) if (loVals[s] !== undefined) slotValue[s] = loVals[s];
      hi.curves.forEach((_, c) => { if (hiSlot[c]) slotValue[hiSlot[c]] = hiRow[c]; });
      out.push(formatRow(slotValue));
      hiIdx++;
      if (hiRow[hiDepthCol] <= loDepth) break;
    }
  }

  return out.join("\n") + "\n";
}

/** Pretty section header from a stored section key (best-effort echo). */
function sectionTitle(name: string): string {
  if (name.startsWith("VERSION")) return "Version Information";
  if (name.startsWith("WELL")) return "Well Information";
  if (name.startsWith("PARAMETER")) return "Parameter Information";
  return name;
}

/** Convenience: merge then parse straight into the EIV pipeline. */
export function mergeAndParse(hiResText: string, loResText: string, fileName?: string): LasFile {
  return parseLas(mergeLasFiles(hiResText, loResText), fileName);
}
