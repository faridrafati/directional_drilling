/**
 * Mechanical Specific Energy (Teale 1965) and founder-point detection.
 *
 * MSE is the mechanical work spent to destroy a unit volume of rock. Drilling
 * is efficient when MSE approaches the rock's confined compressive strength;
 * MSE ≫ UCS signals dysfunction (bit balling, vibration, founder).
 *
 * Field units throughout: WOB lbf · RPM rev/min · torque ft·lbf · ROP ft/hr ·
 * bit diameter inches · MSE psi.
 */
import type { BitClass } from "./bit.js";

/** 1 MPa = 145.0377 psi. */
const PSI_PER_MPA = 145.0377;
/** psi → MPa. */
export function psiToMPa(psi: number): number {
  return psi / PSI_PER_MPA;
}

/** Bit cross-sectional area Aᵦ = π/4·d²  [in²], d in inches. */
export function bitArea(dIn: number): number {
  return (Math.PI / 4) * dIn * dIn;
}

/** Default sliding-friction factor μ for the estimated-torque fallback. */
export const MU_DEFAULT: Record<BitClass, number> = { roller: 0.25, PDC: 0.5 };

/**
 * Estimate bit torque when it was not measured: `T = μ·d·WOB / 36`  [ft·lbf].
 * WOB in lbf, d in inches, μ the bit-class sliding-friction factor. The /36
 * folds the inch→ft (÷12) and the empirical lever-arm (≈ d/3) into one constant.
 */
export function estimateTorque(opts: { mu: number; dIn: number; wobLbf: number }): number {
  return (opts.mu * opts.dIn * opts.wobLbf) / 36;
}

export interface MseInput {
  /** Weight on bit [lbf]. */
  wobLbf: number;
  /** Rotary speed [rev/min]. */
  rpm: number;
  /** Bit torque [ft·lbf]. */
  torqueFtLbf: number;
  /** Rate of penetration [ft/hr]. */
  ropFtHr: number;
  /** Bit diameter [in]. */
  dIn: number;
  /** Optional mechanical efficiency Eₘ (0,1] → reports MSE/Eₘ. Default: none. */
  Em?: number;
}

/**
 * Teale Mechanical Specific Energy [psi]:
 *   MSE = WOB/Aᵦ + (120·π·RPM·T) / (Aᵦ·ROP)
 * The 120π constant is exact for torque in ft·lbf and ROP in ft/hr. Returns
 * `null` when diameter or ROP are non-positive (MSE undefined).
 */
export function mseTeale(i: MseInput): number | null {
  if (!(i.dIn > 0) || !(i.ropFtHr > 0)) return null;
  if (![i.wobLbf, i.rpm, i.torqueFtLbf].every(Number.isFinite)) return null;
  const ab = bitArea(i.dIn);
  const axial = i.wobLbf / ab;
  const rotary = (120 * Math.PI * i.rpm * i.torqueFtLbf) / (ab * i.ropFtHr);
  const mse = axial + rotary;
  if (i.Em != null && i.Em > 0) return mse / i.Em;
  return mse;
}

export interface FounderCurvePoint {
  /** Bin-centre weight on bit. */
  wob: number;
  /** Mean ROP of the runs in this WOB bin. */
  rop: number;
  /** Number of runs in this bin. */
  n: number;
}
export interface Founder {
  /** Binned ROP-vs-WOB response (ascending WOB). */
  curve: FounderCurvePoint[];
  /** WOB at which the marginal ROP gain collapses (founder), or `null`. */
  founderWob: number | null;
  /** Recommended WOB just below founder (the last still-productive bin). */
  optimalWob: number | null;
  /** Slope of the first response segment, for reference. */
  initialSlope: number;
}

/**
 * Founder (bit-balling / vibration onset) detection from a WOB→ROP cloud, per
 * the drill-off-test idea: bin WOB, take the mean ROP per bin, then walk up the
 * response until the marginal slope falls below `threshold`× the initial slope.
 * That knee is the founder point; the bin just below it is the optimal WOB.
 * Returns `null` when there is not enough spread to bin.
 */
export function founderPoint(
  wobs: number[],
  rops: number[],
  opts: { bins?: number; threshold?: number } = {},
): Founder | null {
  const bins = opts.bins ?? 8;
  const threshold = opts.threshold ?? 0.3;
  const xs: number[] = [], ys: number[] = [];
  const n = Math.min(wobs.length, rops.length);
  for (let i = 0; i < n; i++) {
    if (Number.isFinite(wobs[i]) && Number.isFinite(rops[i]) && rops[i] >= 0) { xs.push(wobs[i]); ys.push(rops[i]); }
  }
  if (xs.length < 4) return null;
  let lo = Infinity, hi = -Infinity;
  for (const x of xs) { if (x < lo) lo = x; if (x > hi) hi = x; }
  if (!(hi > lo)) return null;
  const step = (hi - lo) / bins;
  const acc = Array.from({ length: bins }, () => ({ sum: 0, n: 0 }));
  for (let i = 0; i < xs.length; i++) {
    const b = Math.min(bins - 1, Math.floor((xs[i] - lo) / step));
    acc[b].sum += ys[i]; acc[b].n += 1;
  }
  const curve: FounderCurvePoint[] = [];
  acc.forEach((c, b) => { if (c.n) curve.push({ wob: lo + (b + 0.5) * step, rop: c.sum / c.n, n: c.n }); });
  if (curve.length < 2) return null;

  const seg = (j: number) => (curve[j + 1].rop - curve[j].rop) / (curve[j + 1].wob - curve[j].wob);
  const initialSlope = seg(0);
  let founderWob: number | null = null, optimalWob: number | null = curve[curve.length - 1].wob;
  if (initialSlope > 0) {
    for (let j = 0; j < curve.length - 1; j++) {
      if (seg(j) < threshold * initialSlope) { founderWob = curve[j + 1].wob; optimalWob = curve[j].wob; break; }
    }
  }
  return { curve, founderWob, optimalWob, initialSlope };
}

export interface FounderAtRpm {
  /** RPM band the drill-off was evaluated in (the densest band). */
  rpmLo: number; rpmHi: number;
  /** Number of points inside the band. */
  nBand: number;
  founder: Founder;
}

/**
 * Founder detection "at ~constant RPM" (the drill-off-test convention): the
 * ROP-vs-WOB response is only meaningful when rotary speed is held roughly
 * constant, so bin the records by RPM, take the most-populated band, and run
 * `founderPoint` inside it. Falls back to the full RPM range when no band has
 * enough points. Returns `null` when no founder response can be built at all.
 */
export function founderAtConstantRpm(
  wobs: number[], rpms: number[], rops: number[],
  opts: { rpmBins?: number; bins?: number; threshold?: number } = {},
): FounderAtRpm | null {
  const rpmBins = opts.rpmBins ?? 5;
  const n = Math.min(wobs.length, rpms.length, rops.length);
  const W: number[] = [], R: number[] = [], P: number[] = [];
  for (let i = 0; i < n; i++) {
    if ([wobs[i], rpms[i], rops[i]].every(Number.isFinite)) { W.push(wobs[i]); R.push(rpms[i]); P.push(rops[i]); }
  }
  if (W.length < 4) return null;
  let rlo = Infinity, rhi = -Infinity;
  for (const r of R) { if (r < rlo) rlo = r; if (r > rhi) rhi = r; }
  let lo = rlo, hi = rhi, idx = W.map((_, i) => i);
  if (rhi > rlo) {
    const step = (rhi - rlo) / rpmBins;
    const buckets: number[][] = Array.from({ length: rpmBins }, () => []);
    R.forEach((r, i) => buckets[Math.min(rpmBins - 1, Math.floor((r - rlo) / step))].push(i));
    let bi = 0;
    buckets.forEach((b, j) => { if (b.length > buckets[bi].length) bi = j; });
    if (buckets[bi].length >= 4) { idx = buckets[bi]; lo = rlo + bi * step; hi = lo + step; }
  }
  const founder = founderPoint(idx.map((i) => W[i]), idx.map((i) => P[i]), opts);
  if (!founder) return null;
  return { rpmLo: lo, rpmHi: hi, nBand: idx.length, founder };
}
