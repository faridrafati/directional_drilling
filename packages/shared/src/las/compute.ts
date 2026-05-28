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
function padMinMax(
  m: { mat: Float64Array; depthCount: number },
  las: LasFile, params: EivParams, pad: number,
): { min: number; max: number } {
  const { buttonsPerPad, padCount } = las;
  let min = NaN, max = NaN;
  for (let r = 0; r < m.depthCount; r++) {
    for (let b = 0; b < buttonsPerPad; b++) {
      const v = m.mat[matIndex(r, b, pad, buttonsPerPad, padCount)];
      if (v === params.nullValue || !(v > 0)) continue;
      if (Number.isNaN(min) || v < min) min = v;
      if (Number.isNaN(max) || v > max) max = v;
    }
  }
  if (Number.isNaN(min)) { min = 0; max = 1; }
  if (min === max) max = min + 1;
  return { min, max };
}

/** Per-pad histogram (Unit3.histogram). Bins from max down to min. */
function padHistogram(
  m: { mat: Float64Array; depthCount: number },
  las: LasFile, params: EivParams, pad: number, min: number, max: number,
): { histogram: number[]; peak: number } {
  const { buttonsPerPad, padCount } = las;
  const bins = Math.max(1, Math.round(params.histogramBins));
  const hist = new Array<number>(bins).fill(0);
  const span = max - min || 1;
  for (let r = 0; r < m.depthCount; r++) {
    for (let b = 0; b < buttonsPerPad; b++) {
      const v = m.mat[matIndex(r, b, pad, buttonsPerPad, padCount)];
      if (v === params.nullValue || !(v > 0)) continue;
      // bin 0 = top (near max) … bin bins-1 = bottom (near min), per Pascal.
      let idx = Math.floor(((max - v) / span) * bins);
      if (idx < 0) idx = 0;
      if (idx >= bins) idx = bins - 1;
      hist[idx]++;
    }
  }
  let peak = 0;
  for (const c of hist) if (c > peak) peak = c;
  return { histogram: hist, peak };
}

/** Count cells with `value` valid and below `level` and above `floor`. */
function countBetween(
  m: { mat: Float64Array; depthCount: number },
  las: LasFile, params: EivParams, pad: number,
  predicate: (v: number) => boolean,
): number {
  const { buttonsPerPad, padCount } = las;
  let count = 0;
  for (let r = 0; r < m.depthCount; r++) {
    for (let b = 0; b < buttonsPerPad; b++) {
      const v = m.mat[matIndex(r, b, pad, buttonsPerPad, padCount)];
      if (v === params.nullValue || !(v > 0)) continue;
      if (predicate(v)) count++;
    }
  }
  return count;
}

/** Snap `target` to the nearest actual reading (optionally only ≥ target). */
function snapToNearest(
  m: { mat: Float64Array; depthCount: number },
  las: LasFile, params: EivParams, pad: number,
  target: number, onlyAtOrAbove: boolean,
): number {
  const { buttonsPerPad, padCount } = las;
  let best = target, bestDist = Infinity, found = false;
  for (let r = 0; r < m.depthCount; r++) {
    for (let b = 0; b < buttonsPerPad; b++) {
      const v = m.mat[matIndex(r, b, pad, buttonsPerPad, padCount)];
      if (v === params.nullValue || !(v > 0)) continue;
      if (onlyAtOrAbove && v < target) continue;
      const d = Math.abs(v - target);
      if (d < bestDist) { bestDist = d; best = v; found = true; }
    }
  }
  return found ? best : target;
}

/**
 * Full per-pad statistics + percentile levels (maxmin + histogram + analize).
 * Returns 1-based array (index 0 unused) so pads[k] is physical pad k.
 */
export function computeStats(
  tensor: { mat: Float64Array; depthCount: number },
  las: LasFile, params: EivParams,
): EivPadStats[] {
  const sections = Math.max(1, Math.round(params.colorSections));
  const errPct = params.errorPercent;
  const out: EivPadStats[] = [];
  out[0] = makeEmptyStats(sections);

  for (let pad = 1; pad <= las.padCount; pad++) {
    const { min, max } = padMinMax(tensor, las, params, pad);
    const { histogram, peak } = padHistogram(tensor, las, params, pad, min, max);

    // ── Phase 1: clip thresholds via bisection (analize §1) ──────────────
    // total valid count drives the error-percentile target.
    const totalValid = countBetween(tensor, las, params, pad, () => true);
    const target = (totalValid * errPct) / 100;

    // hh=1 (section -1): count BELOW level → low clip. hh=2 (+1): ABOVE → high.
    const lowThresh = bisectThreshold(
      min, max,
      (lvl) => countBetween(tensor, las, params, pad, (v) => v < lvl),
      target,
    );
    const highThresh = bisectThreshold(
      min, max,
      (lvl) => countBetween(tensor, las, params, pad, (v) => v > lvl),
      target,
    );
    // Snap: clipHigh = nearest reading ≥ highThresh; clipLow = nearest to low.
    const clipHigh = snapToNearest(tensor, las, params, pad, highThresh, false);
    const clipLow = snapToNearest(tensor, las, params, pad, lowThresh, false);

    // ── Phase 2: equal-population levels in (clipLow..clipHigh) (analize §2)
    // levels[0] = clipHigh (colour 768), levels[sections] = clipLow (colour 0).
    const levels = new Array<number>(sections + 1);
    levels[0] = clipHigh;
    levels[sections] = clipLow;
    const inRange = countBetween(
      tensor, las, params, pad,
      (v) => v <= clipHigh && v >= clipLow,
    );
    for (let hh = 1; hh < sections; hh++) {
      const popTarget = (inRange * hh) / sections;
      // level[hh] s.t. count of clipLow≤v<clipHigh AND v>level ≈ popTarget.
      const lvl = bisectThreshold(
        clipLow, clipHigh,
        (L) => countBetween(
          tensor, las, params, pad,
          (v) => v > L && v < clipHigh,
        ),
        popTarget,
      );
      levels[hh] = snapToNearest(tensor, las, params, pad, lvl, false);
    }

    // ── colourset: per-band linear map to 0..768 ────────────────────────
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

/**
 * Bisect `level` in [lo, hi] until `counter(level) ≈ target` (±1), matching
 * the Pascal while-loop convergence (abs(sum-sum2)>0.0001, count within 1).
 * `counter` is monotonic decreasing in `level` for the "above" predicates and
 * increasing for "below"; we detect direction from the endpoints.
 */
function bisectThreshold(
  lo: number, hi: number,
  counter: (level: number) => number,
  target: number,
): number {
  let a = lo, b = hi;
  // Direction: does increasing level increase the count?
  const incUp = counter(hi) >= counter(lo);
  for (let iter = 0; iter < 60; iter++) {
    const mid = (a + b) / 2;
    const c = counter(mid);
    if (Math.abs(c - target) <= 1) return mid;
    const tooHigh = incUp ? c > target : c < target;
    if (tooHigh) b = mid; else a = mid;
    if (Math.abs(b - a) < 1e-9) break;
  }
  return (a + b) / 2;
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
