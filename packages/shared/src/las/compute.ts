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
 * Columns: index 0 is depth; [firstPadCol..lastPadCol] are the pad buttons,
 * laid out pad-major: buttonsPerPad columns per pad, in file order. We average
 * `rowsPerPixel` input rows into each output row, ignoring NULL/≤0 readings
 * (the Pascal divided by rowsPerPixel unconditionally, identical when
 * rowsPerPixel = 1 and no nulls fall in the window — but null-aware averaging
 * avoids -999.25 contamination at higher compression).
 */
export function buildTensor(las: LasFile, params: EivParams): {
  mat: Float64Array; depths: Float64Array; depthCount: number;
} {
  const { data, padCount, buttonsPerPad, firstPadCol } = las;
  const rpp = Math.max(1, Math.round(params.rowsPerPixel));
  const totalRows = data.length;
  const depthCount = Math.floor(totalRows / rpp) || (totalRows > 0 ? 1 : 0);
  const isNull = (v: number) =>
    !Number.isFinite(v) || v === params.nullValue;

  const mat = new Float64Array(depthCount * buttonsPerPad * padCount);
  mat.fill(params.nullValue);
  const depths = new Float64Array(depthCount);

  for (let r = 0; r < depthCount; r++) {
    const lo = r * rpp;
    const hi = Math.min(totalRows, lo + rpp);

    // Depth = mean of column 0 over the window.
    let dSum = 0, dN = 0;
    for (let s = lo; s < hi; s++) {
      const v = data[s][0];
      if (Number.isFinite(v)) { dSum += v; dN++; }
    }
    depths[r] = dN > 0 ? dSum / dN : params.nullValue;

    // Each pad button = mean of its column over the window (null-aware).
    for (let pad = 1; pad <= padCount; pad++) {
      for (let b = 0; b < buttonsPerPad; b++) {
        const col = firstPadCol + (pad - 1) * buttonsPerPad + b;
        let sum = 0, n = 0;
        for (let s = lo; s < hi; s++) {
          const row = data[s];
          const v = col < row.length ? row[col] : NaN;
          if (!isNull(v)) { sum += v; n++; }
        }
        mat[matIndex(r, b, pad, buttonsPerPad, padCount)] =
          n > 0 ? sum / n : params.nullValue;
      }
    }
  }
  return { mat, depths, depthCount };
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
export function computeStats(
  tensor: { mat: Float64Array; depthCount: number },
  las: LasFile, params: EivParams,
): EivPadStats[] {
  const sections = Math.max(1, Math.round(params.colorSections));
  const errPct = params.errorPercent;
  const bins = Math.max(1, Math.round(params.histogramBins));
  const { buttonsPerPad, padCount } = las;
  const out: EivPadStats[] = [];
  out[0] = makeEmptyStats(sections);

  for (let pad = 1; pad <= padCount; pad++) {
    // Collect every valid (non-null, >0) reading for this pad, once.
    const vals: number[] = [];
    for (let r = 0; r < tensor.depthCount; r++) {
      const base = (r * buttonsPerPad) * padCount + (pad - 1);
      for (let b = 0; b < buttonsPerPad; b++) {
        const v = tensor.mat[base + b * padCount];
        if (v !== params.nullValue && v > 0 && Number.isFinite(v)) vals.push(v);
      }
    }
    if (vals.length === 0) { out[pad] = makeEmptyStats(sections); continue; }
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
    // levels[0] = clipHigh (colour 768) … levels[sections] = clipLow (0),
    // descending; intermediate levels are quantiles of the in-range values.
    const loIdx = lowerBound(vals, clipLow);
    const hiIdx = upperBound(vals, clipHigh); // exclusive
    const m = Math.max(1, hiIdx - loIdx);
    const levels = new Array<number>(sections + 1);
    levels[0] = clipHigh;
    levels[sections] = clipLow;
    for (let hh = 1; hh < sections; hh++) {
      // fraction (sections-hh)/sections of in-range values lie BELOW levels[hh].
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

    out[pad] = {
      min, max, clipLow, clipHigh,
      histogram, histogramPeak: peak,
      levels, colourSlope, colourIntercept,
    };
  }
  return out;
}

function makeEmptyStats(sections: number): EivPadStats {
  return {
    min: 0, max: 1, clipLow: 0, clipHigh: 1,
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

/** Convenience: assemble a full EivModel from a parsed LAS + params. */
export function buildModel(las: LasFile, params: EivParams): EivModel {
  const { mat, depths, depthCount } = buildTensor(las, params);
  const pads = computeStats({ mat, depthCount }, las, params);
  return { las, params, depthCount, mat, depths, pads };
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
