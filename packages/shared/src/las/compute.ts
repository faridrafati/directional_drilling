/**
 * EIV compute pipeline — faithful port of old_eiv_code/Source/Unit3.pas.
 *
 *   buildTensor   ← datareader   (row-averaging into mat[row][button][pad])
 *   computeStats  ← maxmin + histogram + analize/calc + colourset
 *   pointFor*     ← imagetwo/imagethree/imagefour  (value → 0..768 colour index)
 *   colorForPoint ← the shared rgb() block in imageX (768-step colormap)
 *
 * The three render modes:
 *   raw       — linear min→max  (imagetwo, a=2,b=1,c=1)
 *   corrected — linear clipLow→clipHigh, extremes clamped (imagethree, 8,7,7)
 *   leveled   — piecewise-linear histogram-equalised bands (imagefour)
 */
import type {
  EivImageMode, EivModel, EivPadStats, EivParams, LasFile,
} from "./types.js";

/** Flat-index helper for the mat tensor: row → button → file-pad(1-based). */
function matIndex(
  row: number, button: number, pad: number,
  buttons: number, pads: number,
): number {
  return (row * buttons + button) * pads + (pad - 1);
}

/** Read mat[row][button][filePad]. pad is 1-based. */
export function matAt(m: EivModel, row: number, button: number, pad: number): number {
  return m.mat[matIndex(row, button, pad, m.las.buttonsPerPad, m.las.padCount)];
}

/**
 * Build the averaged tensor from the parsed LAS (Unit3.datareader).
 *
 * Each (pad,button) cell reads its source column from `las.padCol` (an explicit
 * lookup, so pad columns may be non-contiguous or reordered — as in FMI files).
 * We average `rowsPerPixel` input rows into each output row, ignoring NULL/≤0
 * readings (the Pascal divided by rowsPerPixel unconditionally, identical when
 * rowsPerPixel = 1 and no nulls fall in the window — but null-aware averaging
 * avoids -999.25 contamination at higher compression).
 */
interface TensorState {
  mat: Float64Array; depths: Float64Array; depthCount: number; rpp: number;
}

/** Allocate the (null-filled) tensor + depth array for a parsed LAS. */
function allocTensor(las: LasFile, params: EivParams): TensorState {
  const { data, padCount, buttonsPerPad } = las;
  const rpp = Math.max(1, Math.round(params.rowsPerPixel));
  const totalRows = data.length;
  const depthCount = Math.floor(totalRows / rpp) || (totalRows > 0 ? 1 : 0);
  const mat = new Float64Array(depthCount * buttonsPerPad * padCount);
  mat.fill(params.nullValue);
  return { mat, depths: new Float64Array(depthCount), depthCount, rpp };
}

/** Fill output rows [r0, r1) of the tensor (datareader, null-aware averaging). */
function fillTensorRows(
  st: TensorState, las: LasFile, params: EivParams, r0: number, r1: number,
): void {
  const { data, padCount, buttonsPerPad, padCol } = las;
  const totalRows = data.length;
  const isNull = (v: number) => !Number.isFinite(v) || v === params.nullValue;
  for (let r = r0; r < r1; r++) {
    const lo = r * st.rpp;
    const hi = Math.min(totalRows, lo + st.rpp);
    let dSum = 0, dN = 0;
    for (let s = lo; s < hi; s++) {
      const v = data[s][0];
      if (Number.isFinite(v)) { dSum += v; dN++; }
    }
    st.depths[r] = dN > 0 ? dSum / dN : params.nullValue;
    for (let pad = 1; pad <= padCount; pad++) {
      for (let b = 0; b < buttonsPerPad; b++) {
        // Explicit column lookup — robust to non-contiguous / reordered pad
        // columns (FMI). -1 means this channel is absent → leave it null.
        const col = padCol[(pad - 1) * buttonsPerPad + b];
        if (col < 0) {
          st.mat[matIndex(r, b, pad, buttonsPerPad, padCount)] = params.nullValue;
          continue;
        }
        let sum = 0, n = 0;
        for (let s = lo; s < hi; s++) {
          const row = data[s];
          const v = col < row.length ? row[col] : NaN;
          if (!isNull(v)) { sum += v; n++; }
        }
        st.mat[matIndex(r, b, pad, buttonsPerPad, padCount)] =
          n > 0 ? sum / n : params.nullValue;
      }
    }
  }
}

/** Build the averaged tensor (sync). */
export function buildTensor(las: LasFile, params: EivParams): {
  mat: Float64Array; depths: Float64Array; depthCount: number;
} {
  const st = allocTensor(las, params);
  fillTensorRows(st, las, params, 0, st.depthCount);
  return { mat: st.mat, depths: st.depths, depthCount: st.depthCount };
}

/** Yield to the event loop so the UI can repaint a progress bar. */
function yieldToEventLoop(): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}

/** Per-pad absolute min/max over valid (non-null, >0) readings. (maxmin) */
/**
 * Full per-pad statistics + percentile levels — the result of maxmin +
 * histogram + analize/calc, but computed analytically instead of by the
 * Pascal's repeated full-tensor bisection.
 *
 * The original `analize` bisected each threshold by re-counting the whole
 * tensor 60× per target — O(rows·buttons·targets·iters·pads), ~12 s on an
 * 18 k-row file. The thresholds it converged to are simply QUANTILES of the
 * per-pad value distribution, so we collect each pad's valid readings ONCE,
 * sort them, and read the quantiles off directly. Identical results (the
 * snap-to-nearest is automatic — we pick actual sorted values), ~100× faster.
 *
 * Returns a 1-based array (index 0 unused) so pads[k] is physical pad k.
 */
/** Per-pad stats: collect valid readings, sort, derive clip + quantile levels. */
function statsForPad(
  tensor: { mat: Float64Array; depthCount: number },
  las: LasFile, params: EivParams, pad: number,
  sections: number, errPct: number, bins: number,
): EivPadStats {
  const { buttonsPerPad, padCount } = las;
  // Collect every valid (non-null, >0) reading for this pad, once.
  const vals: number[] = [];
  for (let r = 0; r < tensor.depthCount; r++) {
    const base = (r * buttonsPerPad) * padCount + (pad - 1);
    for (let b = 0; b < buttonsPerPad; b++) {
      const v = tensor.mat[base + b * padCount];
      if (v !== params.nullValue && v > 0 && Number.isFinite(v)) vals.push(v);
    }
  }
  if (vals.length === 0) return makeEmptyStats(sections);
  vals.sort((a, b) => a - b);
  const n = vals.length;
  const min = vals[0];
  const max = vals[n - 1];

  // Histogram: bins from max (bin 0) down to min (Pascal orientation).
  const span = max - min || 1;
  const histogram = new Array<number>(bins).fill(0);
  for (const v of vals) {
    let idx = Math.floor(((max - v) / span) * bins);
    if (idx < 0) idx = 0; else if (idx >= bins) idx = bins - 1;
    histogram[idx]++;
  }
  let peak = 0;
  for (const c of histogram) if (c > peak) peak = c;

  // ── Clip thresholds (analize §1): drop the lowest/highest errPct%. ──
  const k = Math.min(n - 1, Math.max(0, Math.floor((n * errPct) / 100)));
  const clipLow = vals[k];
  const clipHigh = vals[n - 1 - k];

  // ── Equal-population levels in [clipLow, clipHigh] (analize §2). ─────
  const loIdx = lowerBound(vals, clipLow);
  const hiIdx = upperBound(vals, clipHigh); // exclusive
  const m = Math.max(1, hiIdx - loIdx);
  const levels = new Array<number>(sections + 1);
  levels[0] = clipHigh;
  levels[sections] = clipLow;
  for (let hh = 1; hh < sections; hh++) {
    let rank = loIdx + Math.floor((m * (sections - hh)) / sections);
    if (rank < loIdx) rank = loIdx;
    if (rank > hiIdx - 1) rank = hiIdx - 1;
    levels[hh] = vals[rank];
  }

  // ── colourset: per-band linear map to 0..768. ──────────────────────
  const colourSlope = new Array<number>(sections).fill(0);
  const colourIntercept = new Array<number>(sections).fill(0);
  for (let hh = 0; hh < sections; hh++) {
    const y0 = 768 - (768 * hh) / sections;
    const y1 = 768 - (768 * (hh + 1)) / sections;
    const x0 = levels[hh];
    const x1 = levels[hh + 1];
    const slope = x1 !== x0 ? (y1 - y0) / (x1 - x0) : 0;
    colourSlope[hh] = slope;
    colourIntercept[hh] = y0 - slope * x0;
  }

  return { count: n, min, max, clipLow, clipHigh, histogram, histogramPeak: peak, levels, colourSlope, colourIntercept };
}

/** All per-pad stats (sync). 1-based; pads[k] is physical pad k. */
export function computeStats(
  tensor: { mat: Float64Array; depthCount: number },
  las: LasFile, params: EivParams,
): EivPadStats[] {
  const sections = Math.max(1, Math.round(params.colorSections));
  const errPct = params.errorPercent;
  const bins = Math.max(1, Math.round(params.histogramBins));
  const out: EivPadStats[] = [];
  out[0] = makeEmptyStats(sections);
  for (let pad = 1; pad <= las.padCount; pad++) {
    out[pad] = statsForPad(tensor, las, params, pad, sections, errPct, bins);
  }
  return out;
}

function makeEmptyStats(sections: number): EivPadStats {
  return {
    count: 0, min: 0, max: 1, clipLow: 0, clipHigh: 1,
    histogram: [], histogramPeak: 0,
    levels: new Array<number>(sections + 1).fill(0),
    colourSlope: new Array<number>(sections).fill(0),
    colourIntercept: new Array<number>(sections).fill(0),
  };
}

/** First index i with arr[i] >= target (arr sorted ascending). */
function lowerBound(arr: number[], target: number): number {
  let lo = 0, hi = arr.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (arr[mid] < target) lo = mid + 1; else hi = mid; }
  return lo;
}
/** First index i with arr[i] > target (arr sorted ascending). */
function upperBound(arr: number[], target: number): number {
  let lo = 0, hi = arr.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (arr[mid] <= target) lo = mid + 1; else hi = mid; }
  return lo;
}

/**
 * value → colour index (0..768) for one cell, per render mode. Returns -1 for
 * a NULL/invalid reading (caller paints it blue).
 */
export function pointForValue(
  value: number, mode: EivImageMode, stats: EivPadStats, nullValue: number,
): number {
  if (value === nullValue || !Number.isFinite(value)) return -1;
  if (!(value > 0)) return 1;

  let point: number;
  if (mode === "raw") {
    const fac = stats.max - stats.min !== 0 ? 768 / (stats.max - stats.min) : 1e6;
    point = fac * (value - stats.min);
  } else if (mode === "corrected") {
    const span = stats.clipHigh - stats.clipLow;
    const fac = span !== 0 ? 768 / span : 1e7;
    if (value > stats.clipLow) point = fac * (value - stats.clipLow);
    else point = 1;
  } else {
    // leveled — find the band hh where levels[hh] > value >= levels[hh+1].
    point = 1;
    for (let hh = 0; hh < stats.colourSlope.length; hh++) {
      if (value < stats.levels[hh] && value >= stats.levels[hh + 1]) {
        point = stats.colourSlope[hh] * value + stats.colourIntercept[hh];
        break;
      }
    }
  }
  point = Math.trunc(point);
  if (point > 768) point = 768;
  if (point < 1) point = 1;
  return point;
}

/**
 * Colour index (0..768) → [r,g,b]. The shared rgb() block from imageX:
 * a white→yellow→red→black ramp; -1 (NULL) → blue.
 */
export function colorForPoint(point: number): [number, number, number] {
  if (point < 0) return [0, 0, 255];               // NULL → blue
  if (point > 512 && point <= 768) return [768 - point, 0, 0];      // red→black
  if (point > 256 && point <= 512) return [255, 512 - point, 0];    // yellow→red
  return [255, 255, Math.max(0, 256 - point)];                       // white→yellow
}

/**
 * One band-filter from the "Special Coloring" form (old_fmi_code/
 * Unit3.dfm / Form3: Filter 1 (Blue), Filter 2 (Green), Filter 3 (Purple),
 * each with an enable checkbox + Max/Min value). When enabled, any reading
 * whose value lies in [min, max] is painted `color`, overriding the WYRB ramp.
 */
export interface ColorBand {
  enabled: boolean;
  min: number;
  max: number;
  /** Solid override colour, [r, g, b] each 0..255. */
  color: [number, number, number];
}

/**
 * Return the first enabled band whose inclusive [min, max] contains `value`,
 * else null. A null result means "use the normal colour ramp" — so this is a
 * no-op when `bands` is empty/undefined or every band is disabled, and it never
 * recolours a NULL/non-finite reading. (old_fmi_code/Unit3.pas Form3.)
 */
export function bandColor(
  value: number, bands: ColorBand[] | undefined, nullValue: number,
): [number, number, number] | null {
  if (!bands || bands.length === 0) return null;
  if (value === nullValue || !Number.isFinite(value)) return null;
  for (const b of bands) {
    if (b.enabled && value >= b.min && value <= b.max) return b.color;
  }
  return null;
}

/** Convenience: assemble a full EivModel from a parsed LAS + params. */
export function buildModel(las: LasFile, params: EivParams): EivModel {
  const { mat, depths, depthCount } = buildTensor(las, params);
  const pads = computeStats({ mat, depthCount }, las, params);
  const rpp = Math.max(1, Math.round(params.rowsPerPixel));
  const aux = buildAux(las, params, depthCount, rpp);
  return { las, params, depthCount, mat, depths, pads, aux };
}

/**
 * Async, chunked build that reports progress (0..1) and a phase label, and
 * yields to the event loop between chunks so a progress bar repaints and the
 * page stays responsive on big files. Same result as buildModel().
 *
 *   0.00 – 0.55  building the tensor (datareader), per row-chunk
 *   0.55 – 1.00  analysing pads (maxmin/histogram/leveling), per pad
 */
export async function buildModelAsync(
  las: LasFile, params: EivParams,
  onProgress?: (frac: number, label: string) => void,
): Promise<EivModel> {
  const st = allocTensor(las, params);
  const chunks = 20;
  const chunkRows = Math.max(1, Math.ceil(st.depthCount / chunks));
  for (let r0 = 0; r0 < st.depthCount; r0 += chunkRows) {
    const r1 = Math.min(st.depthCount, r0 + chunkRows);
    fillTensorRows(st, las, params, r0, r1);
    onProgress?.(0.55 * (r1 / Math.max(1, st.depthCount)), "Reading data…");
    await yieldToEventLoop();
  }

  const sections = Math.max(1, Math.round(params.colorSections));
  const errPct = params.errorPercent;
  const bins = Math.max(1, Math.round(params.histogramBins));
  const tensor = { mat: st.mat, depthCount: st.depthCount };
  const pads: EivPadStats[] = [];
  pads[0] = makeEmptyStats(sections);
  for (let pad = 1; pad <= las.padCount; pad++) {
    pads[pad] = statsForPad(tensor, las, params, pad, sections, errPct, bins);
    onProgress?.(0.55 + 0.45 * (pad / Math.max(1, las.padCount)), "Analysing pads…");
    await yieldToEventLoop();
  }
  const aux = buildAux(las, params, st.depthCount, st.rpp);
  onProgress?.(1, "Done");
  return { las, params, depthCount: st.depthCount, mat: st.mat, depths: st.depths, pads, aux };
}

/**
 * Per-output-row auxiliary traces (old_fmi_code/Unit7.pas overlay curves).
 *
 * For each aux mnemonic present in the file we average its column over the same
 * `rowsPerPixel` window the tensor uses, producing one value per output depth
 * row. We also synthesize `CONDSUM` = mean conductivity per row: the sum of all
 * pad-button readings / button-count / 5 (Unit7.pas:647 normalised the 192
 * buttons by /192/5). Returns null when the file has no overlay-relevant aux
 * curves (e.g. a plain EIV PADn[m] log).
 */
const AUX_TRACE_KEYS = ["FCAX", "FCAY", "FCAZ", "GR", "P1AZ"] as const;

function buildAux(
  las: LasFile, params: EivParams, depthCount: number, rpp: number,
): Record<string, Float64Array> | undefined {
  const present = AUX_TRACE_KEYS.filter((k) => k in las.auxCols);
  const hasButtons = las.padCount > 0 && las.buttonsPerPad > 0;
  if (present.length === 0 && !hasButtons) return undefined;

  const { data } = las;
  const total = data.length;
  const isNull = (v: number) => !Number.isFinite(v) || v === params.nullValue;
  const out: Record<string, Float64Array> = {};
  for (const k of present) out[k] = new Float64Array(depthCount);
  const cond = hasButtons ? new Float64Array(depthCount) : null;

  for (let r = 0; r < depthCount; r++) {
    const lo = r * rpp;
    const hi = Math.min(total, lo + rpp);
    // Each named aux curve: window-averaged, null-aware.
    for (const k of present) {
      const col = las.auxCols[k];
      let sum = 0, n = 0;
      for (let s = lo; s < hi; s++) {
        const v = data[s][col];
        if (!isNull(v)) { sum += v; n++; }
      }
      out[k][r] = n > 0 ? sum / n : params.nullValue;
    }
    // CONDSUM: mean over every present button column in the window / count / 5.
    if (cond) {
      let sum = 0, n = 0;
      for (const col of las.padCol) {
        if (col < 0) continue;
        for (let s = lo; s < hi; s++) {
          const v = data[s][col];
          if (!isNull(v) && v > 0) { sum += v; n++; }
        }
      }
      cond[r] = n > 0 ? sum / n / 5 : params.nullValue;
    }
  }
  if (cond) out.CONDSUM = cond;
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Per-output-row mean resistivity across one pad's buttons (null/≤0-aware).
 * Returns a Float64Array of length depthCount; a row with no valid reading is
 * set to the null sentinel. This is the "Linear Average" wiggle drawn beside
 * the image (old_fmi_code/Unit7.pas:576,647 — Resistivity_Sum / count).
 */
export function padRowAverages(m: EivModel, pad: number): Float64Array {
  const { buttonsPerPad, padCount } = m.las;
  const nullValue = m.params.nullValue;
  const out = new Float64Array(m.depthCount);
  for (let r = 0; r < m.depthCount; r++) {
    const base = (r * buttonsPerPad) * padCount + (pad - 1);
    let sum = 0, n = 0;
    for (let b = 0; b < buttonsPerPad; b++) {
      const v = m.mat[base + b * padCount];
      if (v !== nullValue && v > 0 && Number.isFinite(v)) { sum += v; n++; }
    }
    out[r] = n > 0 ? sum / n : nullValue;
  }
  return out;
}

/** Default analysis params derived from a freshly parsed file. */
export function defaultParams(las: LasFile): EivParams {
  const totalRows = las.data.length;
  const rowsPerPixel = Math.max(1, Math.floor(totalRows / 40000) + 1);
  return {
    colorSections: 12,
    errorPercent: 1,
    rowsPerPixel,
    histogramBins: 50,
    startRow: 0,
    endRow: "max",
    padOrder: Array.from({ length: las.padCount }, (_, i) => i + 1),
    nullValue: las.well.nullValue,
  };
}
