/**
 * Apparent formation strength, back-estimated from ordinary per-run data.
 *
 * This gives the tab its missing physical axis. Everything here is APPARENT —
 * inferred from what the bit felt, not measured on core — and every function
 * name and every label the UI builds from them says so. The distinction is not
 * pedantry: an apparent CCS derived from surface-torque MSE in a deviated well
 * carries the drillstring's friction as well as the rock's strength.
 *
 * THE THREE METHODS, AND WHAT EACH IS FOR
 * ---------------------------------------
 *  · apparentCcsFromMse — the level. Efficient drilling sits at MSE ~= 3x CCS
 *    (mechanical efficiency 0.30-0.35), so the LOW end of a formation's MSE
 *    distribution divided by three approximates its confined compressive
 *    strength. CCS rather than UCS because it includes confining pressure, and
 *    CCS ~= 1.8-2.3x UCS typically.
 *  · binghamFit — the ranking. Plotting ROP-per-revolution against WOB-per-inch
 *    gives a line whose slope falls and whose x-intercept rises with rock
 *    strength. Explicitly a per-bit-run-averages chart requiring no logs, which
 *    is why it fits this data exactly (OGJ 1994).
 *  · dExponent — the trend. The standard normalised drilling rate, whose
 *    corrected form tracks compaction and pore pressure with depth.
 *
 * Sources: SPE 2017 MSE/DS paper (the 3x anchor); OGJ 1994 "Dull bit grading and
 * rock strength analysis key to bit selection" (Bingham, UCS bands); OGJ 1994
 * "Confined compressive strength analysis can improve PDC bit selection".
 */
import { linearFit, quantile, type LinearFit } from "./stats.js";

/**
 * Mechanical efficiency anchor: efficient drilling runs at MSE about three times
 * the confined compressive strength.
 */
export const MSE_CCS_RATIO = 3;

/** Published CCS:UCS ratio range — CCS is the larger, by this factor. */
export const CCS_UCS_RATIO: readonly [number, number] = [1.8, 2.3];

export interface ApparentStrength {
  /** Apparent confined compressive strength [psi]. */
  ccsPsi: number;
  /** The UCS range that CCS implies, [low, high] psi. */
  ucsBand: [number, number];
  /** How many MSE values fed the estimate. */
  n: number;
  /** True when measured-torque MSE was used in preference to estimated. */
  fromMeasuredTorque: boolean;
}

/**
 * Apparent CCS from a formation's run-level MSE values.
 *
 * The P25 rather than the mean or the median: the anchor describes EFFICIENT
 * drilling, and a formation's MSE distribution is inflated by every run that met
 * dysfunction. The low quartile is the closest thing per-run averages offer to
 * "what this rock costs when things go well" — a mean would report the rock plus
 * the trouble and overstate strength.
 *
 * Measured-torque MSE is preferred whenever there is enough of it, because
 * estimated torque is a friction assumption rather than a reading.
 */
export function apparentCcsFromMse(
  values: { msePsi: number | null | undefined; measuredTorque?: boolean }[],
  opts: { minMeasured?: number } = {},
): ApparentStrength | null {
  const minMeasured = opts.minMeasured ?? 4;
  const usable = values.filter(
    (v): v is { msePsi: number; measuredTorque?: boolean } =>
      v.msePsi != null && Number.isFinite(v.msePsi) && v.msePsi > 0,
  );
  if (usable.length === 0) return null;

  const measured = usable.filter((v) => v.measuredTorque);
  const useMeasured = measured.length >= minMeasured;
  const pool = useMeasured ? measured : usable;

  const p25 = quantile(pool.map((v) => v.msePsi), 0.25);
  if (p25 == null || p25 <= 0) return null;

  const ccsPsi = p25 / MSE_CCS_RATIO;
  return {
    ccsPsi,
    ucsBand: [ccsPsi / CCS_UCS_RATIO[1], ccsPsi / CCS_UCS_RATIO[0]],
    n: pool.length,
    fromMeasuredTorque: useMeasured,
  };
}

export interface BinghamResult extends LinearFit {
  /** Threshold weight — the W/D at which the fitted line predicts zero ROP. */
  thresholdWD: number | null;
  /** Slope, restated as what it is: a RELATIVE drillability index. */
  drillabilityIndex: number;
}

/**
 * Bingham's linear approximation, fitted per formation.
 *
 * Plots R/N (ROP per revolution) against W/D (WOB per inch of bit diameter).
 * The slope is a RELATIVE drillability index — it falls as rock gets stronger —
 * and the x-intercept is the threshold weight below which the bit does not cut.
 *
 * The slope is never reported as a strength in psi. Bingham's line is an
 * empirical proportionality, not a calibrated rock-mechanics measurement, and
 * labelling its slope as an absolute strength would be inventing precision.
 */
export function binghamFit(
  runs: {
    ropFtHr: number | null | undefined;
    rpm: number | null | undefined;
    wobKlb: number | null | undefined;
    diaIn: number | null | undefined;
  }[],
  opts: { minPoints?: number } = {},
): BinghamResult | null {
  const minPoints = opts.minPoints ?? 5;
  const xs: number[] = [];
  const ys: number[] = [];
  for (const r of runs) {
    if (r.ropFtHr == null || r.rpm == null || r.wobKlb == null || r.diaIn == null) continue;
    if (!(r.rpm > 0) || !(r.diaIn > 0) || !(r.ropFtHr > 0) || !(r.wobKlb > 0)) continue;
    xs.push(r.wobKlb / r.diaIn);      // W/D, klb per inch
    ys.push(r.ropFtHr / r.rpm);       // R/N, ft per revolution-hour
  }
  if (xs.length < minPoints) return null;
  const fit = linearFit(xs, ys);
  if (fit == null) return null;
  const thresholdWD = fit.slope !== 0 ? -fit.intercept / fit.slope : null;
  return { ...fit, thresholdWD, drillabilityIndex: fit.slope };
}

/**
 * The d-exponent — normalised drilling rate.
 *
 *     d = log10(R / 60N) / log10(12W / (10^6 · D))
 *
 * with R in ft/hr, N in rpm, W in lbf and D in inches. Rises as rock gets harder
 * or more compacted, which is what makes its trend with depth informative.
 *
 * Both logarithm arguments must be positive AND the denominator non-zero, so the
 * guards below are the definition's own domain rather than defensive padding.
 */
export function dExponent(opts: {
  ropFtHr: number | null | undefined;
  rpm: number | null | undefined;
  wobLbf: number | null | undefined;
  dIn: number | null | undefined;
}): number | null {
  const { ropFtHr, rpm, wobLbf, dIn } = opts;
  if (ropFtHr == null || rpm == null || wobLbf == null || dIn == null) return null;
  if (!(ropFtHr > 0) || !(rpm > 0) || !(wobLbf > 0) || !(dIn > 0)) return null;
  const num = Math.log10(ropFtHr / (60 * rpm));
  const den = Math.log10((12 * wobLbf) / (1e6 * dIn));
  if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return null;
  const d = num / den;
  return Number.isFinite(d) ? d : null;
}

/**
 * The corrected d-exponent, `dc = d · normalPpg / mudPpg`.
 *
 * The correction properly uses equivalent circulating density. ECD is not
 * recorded in these reports, so mud weight stands in for it — which the UI says
 * out loud, because the substitution understates the correction whenever
 * annular losses are significant.
 */
export function dcExponent(
  d: number | null | undefined,
  opts: { mudPpg: number | null | undefined; normalPpg?: number },
): number | null {
  const normal = opts.normalPpg ?? 9.0;
  if (d == null || !Number.isFinite(d)) return null;
  if (opts.mudPpg == null || !(opts.mudPpg > 0)) return null;
  return (d * normal) / opts.mudPpg;
}

/** A bit family's published working range against unconfined compressive strength. */
export interface UcsBand {
  family: string;
  /** Inclusive psi bounds; null means unbounded on that side. */
  minPsi: number | null;
  maxPsi: number | null;
  note?: string;
}

/**
 * Published UCS suitability bands (OGJ 1994, two independent decks).
 *
 * These screen bit types IN or OUT before economics is considered — the first
 * step of the three-step selection method. They are guidance, not physics: the
 * PDC envelope in particular keeps expanding, which the "possibly beyond" note
 * records rather than hides.
 */
export const UCS_BANDS: readonly UcsBand[] = [
  { family: "Milled tooth", minPsi: null, maxPsi: 9_000 },
  { family: "TCI", minPsi: 9_000, maxPsi: null, note: "uneconomic below 9,000 psi" },
  { family: "Roller — soft formation", minPsi: null, maxPsi: 18_000 },
  { family: "Roller — medium", minPsi: null, maxPsi: 26_000 },
  { family: "PDC", minPsi: null, maxPsi: 22_000, note: "and possibly beyond — the envelope keeps expanding" },
  { family: "Diamond impregnated", minPsi: 15_000, maxPsi: null },
];

/** The families whose published band admits this apparent UCS. */
export function familiesForUcs(ucsPsi: number): UcsBand[] {
  return UCS_BANDS.filter(
    (b) => (b.minPsi == null || ucsPsi >= b.minPsi) && (b.maxPsi == null || ucsPsi <= b.maxPsi),
  );
}
