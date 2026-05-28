/**
 * Data model for the EIV ("Analyzing EMI Logs") port.
 *
 * EIV reads a CWLS LAS 2.0 file produced by a multi-pad caliper/resistivity
 * casing-inspection tool. Each depth sample carries one resistivity reading
 * per sensor button, per pad — curves named `PADn[m]` (pad n, button m).
 *
 * Pascal origin: old_eiv_code/Source/Unit3.pas (TForm1). The Pascal kept
 * everything in flat global arrays (`mat`, `intro`, `matintro`, `level`,
 * `coloursetting`, `anotherlog`). Here we give those a typed shape:
 *
 *   LasFile      — the parsed file (Unit3.Open1Click + Unit7 grammar table)
 *   EivParams    — the user-tunable knobs (Unit2/Form6 edit boxes → intro[])
 *   EivTensor    — mat[depthOut][button][pad] after row-averaging (datareader)
 *   EivLevels    — per-pad min/max + histogram + percentile levels (maxmin,
 *                  histogram, analize/calc, colourset)
 */

/** One curve (column) declared in the ~CURVE section. */
export interface LasCurve {
  /** Full mnemonic, e.g. "DEPT", "PAD1[0]", "PAD3[15]". */
  mnemonic: string;
  /** Unit string after the '.', e.g. "F". */
  unit: string;
  /** Free-text description after the ':'. */
  description: string;
  /** Pad number (1-based) if this is a `PADn[m]` curve, else null. */
  pad: number | null;
  /** Button index (0-based as written, e.g. PAD1[0]) if a pad curve, else null. */
  button: number | null;
}

/** ~WELL header values EIV actually uses (Unit3 storage[2] block). */
export interface LasWellInfo {
  /** START DEPTH (STRT). */
  strt: number;
  /** STOP DEPTH (STOP). */
  stop: number;
  /** STEP between samples (signed; negative when logging up). */
  step: number;
  /** NULL / absent-value sentinel (e.g. -999.25). */
  nullValue: number;
}

/** A fully parsed LAS file. */
export interface LasFile {
  /** Raw section name → array of its text lines (minus the ~HEADER line). */
  sections: Record<string, string[]>;
  /** Ordered section names as they appeared (for the LAS-sections viewer). */
  sectionOrder: string[];
  well: LasWellInfo;
  /** Curves in column order; curves[0] is the depth/index column. */
  curves: LasCurve[];
  /** Number of pads detected from PADn[m] mnemonics. */
  padCount: number;
  /** Buttons (resistors) per pad. */
  buttonsPerPad: number;
  /** Column index (0-based into each data row) of the first pad-data column. */
  firstPadCol: number;
  /** Column index of the last pad-data column. */
  lastPadCol: number;
  /** The ~ASCII numeric matrix: data[row][column]. NaN where unparsable. */
  data: number[][];
  /** Original file name (for display). */
  fileName?: string;
}

/**
 * User-tunable analysis parameters (Unit2/Form6). Defaults are derived from
 * the file on load; the Data Options dialog edits them.
 */
export interface EivParams {
  /** intro[5] — number of colour sections for the leveled image. */
  colorSections: number;
  /** intro[6] / Form6.Edit5 — error / clip percentile (%). */
  errorPercent: number;
  /** matintro[5] / Form6.Edit11 — rows averaged per output pixel (compression). */
  rowsPerPixel: number;
  /** Form6.Edit13 — number of histogram bins. */
  histogramBins: number;
  /** intro[3] — first output depth row to render (depth-window start). */
  startRow: number;
  /** intro[4] — last output depth row to render ("max" = all). */
  endRow: number | "max";
  /** Pad display order: logical pad → physical pad (Unit8/Unit21 pn[]). 1-based. */
  padOrder: number[];
  /** NULL sentinel echoed from the file (error in Pascal). */
  nullValue: number;
}

/** Per-pad statistics + percentile levels (maxmin / histogram / analize). */
export interface EivPadStats {
  /** Absolute min of valid (non-null, >0) readings. */
  min: number;
  /** Absolute max. */
  max: number;
  /** Low clip threshold (intro[10*kk+7], = level after extreme-correction). */
  clipLow: number;
  /** High clip threshold (intro[10*kk+8]). */
  clipHigh: number;
  /** Histogram bin counts (length = histogramBins). */
  histogram: number[];
  /** Peak histogram count (intro[10*kk+6]). */
  histogramPeak: number;
  /** Equal-population percentile levels, length colorSections+1, descending
   *  in colour-value but in resistivity order matching the Pascal level[]. */
  levels: number[];
  /** Per-level colour-map slope/intercept (coloursetting[hh][1|2][kk]). */
  colourSlope: number[];
  colourIntercept: number[];
}

/** The averaged tensor + derived stats — everything the renderer needs. */
export interface EivModel {
  las: LasFile;
  params: EivParams;
  /** Output depth-row count (after row averaging). */
  depthCount: number;
  /** mat[depthRow][button 0..buttonsPerPad-1][physicalPad 1..padCount].
   *  Stored flat for speed: index = ((row*buttons)+button)*padCount + (pad-1). */
  mat: Float64Array;
  /** Per-output-row depth value (anotherlog[row][0]). */
  depths: Float64Array;
  /** Per-pad stats, indexed by physical pad (1-based; index 0 unused). */
  pads: EivPadStats[];
}

/** Which heatmap variant to render. */
export type EivImageMode = "raw" | "corrected" | "leveled";
