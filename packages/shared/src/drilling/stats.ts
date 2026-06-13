/**
 * Small statistical helpers for the drilling-performance analytics
 * (ROP–MSE power-law fit, ROP–HSI trend, distribution summaries).
 *
 * All functions are pure, ignore non-finite samples, and return `null`
 * rather than NaN when there is not enough usable data to answer.
 */

/** Drop index-aligned (x, y) pairs where either value is non-finite. */
function finitePairs(xs: number[], ys: number[]): [number[], number[]] {
  const fx: number[] = [], fy: number[] = [];
  const n = Math.min(xs.length, ys.length);
  for (let i = 0; i < n; i++) {
    const x = xs[i], y = ys[i];
    if (Number.isFinite(x) && Number.isFinite(y)) { fx.push(x); fy.push(y); }
  }
  return [fx, fy];
}

export interface LinearFit {
  /** Slope of y = slope·x + intercept. */
  slope: number;
  /** Intercept of y = slope·x + intercept. */
  intercept: number;
  /** Coefficient of determination R² in [0, 1]. */
  r2: number;
  /** Number of finite pairs used. */
  n: number;
}

/**
 * Ordinary least-squares fit of `y = slope·x + intercept`.
 * Returns `null` when fewer than two finite pairs exist or x has no spread.
 */
export function linearFit(xs: number[], ys: number[]): LinearFit | null {
  const [x, y] = finitePairs(xs, ys);
  const n = x.length;
  if (n < 2) return null;
  let mx = 0, my = 0;
  for (let i = 0; i < n; i++) { mx += x[i]; my += y[i]; }
  mx /= n; my /= n;
  let sxx = 0, sxy = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx, dy = y[i] - my;
    sxx += dx * dx; sxy += dx * dy; syy += dy * dy;
  }
  if (sxx === 0) return null;
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  // R² = explained / total; a flat y (syy = 0) is a perfect fit of a constant.
  const r2 = syy === 0 ? 1 : Math.max(0, Math.min(1, (sxy * sxy) / (sxx * syy)));
  return { slope, intercept, r2, n };
}

export interface PowerLawFit {
  /** Coefficient a in ROP = a · MSE^(−b). */
  a: number;
  /** Positive decay exponent b (the study's signature diagnostic). */
  b: number;
  /** R² of the underlying log–log linear fit. */
  r2: number;
  /** Number of strictly-positive pairs used. */
  n: number;
}

/**
 * Fit a decaying power law `y = a · x^(−b)` by linear regression on logs
 * (`ln y = ln a − b·ln x`). Only strictly-positive (x, y) pairs contribute.
 * `b` near 1 ⇒ energy efficiently converted to rock destruction; `b ≪ 1`
 * ⇒ energy lost to regrind / heat / bit damage.
 */
export function powerLawFit(xs: number[], ys: number[]): PowerLawFit | null {
  const [x, y] = finitePairs(xs, ys);
  const lx: number[] = [], ly: number[] = [];
  for (let i = 0; i < x.length; i++) {
    if (x[i] > 0 && y[i] > 0) { lx.push(Math.log(x[i])); ly.push(Math.log(y[i])); }
  }
  const fit = linearFit(lx, ly);
  if (!fit) return null;
  return { a: Math.exp(fit.intercept), b: -fit.slope, r2: fit.r2, n: fit.n };
}

/** Average-tie ranks (1-based) of a sample, for Spearman correlation. */
function ranks(v: number[]): number[] {
  const idx = v.map((value, i) => ({ value, i })).sort((a, b) => a.value - b.value);
  const r = new Array<number>(v.length);
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1].value === idx[i].value) j++;
    const avg = (i + j) / 2 + 1; // average of the 1-based positions i..j
    for (let k = i; k <= j; k++) r[idx[k].i] = avg;
    i = j + 1;
  }
  return r;
}

/**
 * Spearman rank correlation ρ in [−1, 1] over paired finite samples
 * (Pearson correlation of the average-tie ranks). Returns `null` when
 * fewer than three pairs exist or a sample has no spread.
 */
export function spearman(xs: number[], ys: number[]): number | null {
  const [x, y] = finitePairs(xs, ys);
  if (x.length < 3) return null;
  const rx = ranks(x), ry = ranks(y);
  const fit = linearFit(rx, ry);
  if (!fit) return null;
  // Sign of the slope · √R² recovers the signed correlation coefficient.
  return Math.sign(fit.slope) * Math.sqrt(fit.r2);
}

/** Arithmetic mean of the finite values, or `null` when there are none. */
export function mean(xs: number[]): number | null {
  let s = 0, n = 0;
  for (const x of xs) if (Number.isFinite(x)) { s += x; n++; }
  return n ? s / n : null;
}

/**
 * Linear-interpolated quantile (q in [0, 1]) of the finite values.
 * Returns `null` for an empty sample.
 */
export function quantile(xs: number[], q: number): number | null {
  const v = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  if (v.length === 1) return v[0];
  const pos = Math.max(0, Math.min(1, q)) * (v.length - 1);
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return lo === hi ? v[lo] : v[lo] + (v[hi] - v[lo]) * (pos - lo);
}

/** Median (50th percentile). */
export function median(xs: number[]): number | null {
  return quantile(xs, 0.5);
}

export interface IqrFence {
  q1: number; q3: number;
  /** Lower / upper inlier bounds: q1 − k·IQR, q3 + k·IQR. */
  lo: number; hi: number;
}

/**
 * Tukey IQR fence (default k = 1.5) for mark-don't-delete outlier handling.
 * Returns `null` for fewer than four finite values.
 */
export function iqrFence(xs: number[], k = 1.5): IqrFence | null {
  const v = xs.filter((x) => Number.isFinite(x));
  if (v.length < 4) return null;
  const q1 = quantile(v, 0.25)!, q3 = quantile(v, 0.75)!;
  const iqr = q3 - q1;
  return { q1, q3, lo: q1 - k * iqr, hi: q3 + k * iqr };
}
