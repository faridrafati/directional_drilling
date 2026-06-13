/**
 * Drilling economics — the study's core metric is cost per metre, which trades
 * a bit's instantaneous ROP against the round-trip time its (low) meterage
 * forces. A fast bit that must be tripped often can lose to a slower bit that
 * drills the whole section.
 *
 * Units: depth / meterage m · time hr · money USD · ROP m/hr · speed m/hr.
 */

/** Default fixed handling time per trip (BHA / bit change) [hr]. */
export const HANDLING_HR_DEFAULT = 2;

/** Rig operating rate USD/day → USD/hr. */
export function rigUsdPerHr(usdPerDay: number): number {
  return usdPerDay / 24;
}

/**
 * Round-trip time estimate [hr]: `t = 2·depth / tripSpeed + handling`.
 * `tripSpeed` is the round-trip equivalent pipe speed (m/hr); `handling` is the
 * fixed per-trip surface time. Returns 0 for a non-positive trip speed.
 */
export function tripHours(opts: {
  depthM: number; tripSpeedMHr: number; handlingHr?: number;
}): number {
  const handling = opts.handlingHr ?? HANDLING_HR_DEFAULT;
  if (!(opts.tripSpeedMHr > 0)) return handling;
  return (2 * opts.depthM) / opts.tripSpeedMHr + handling;
}

/**
 * Drilling cost per metre [USD/m]: `C = (B + R·(T + t)) / F`
 * B bit cost USD · R rig rate USD/hr · T drilling hr · t trip hr · F meterage m.
 * Returns `null` for non-positive meterage.
 */
export function costPerMeter(opts: {
  bitUsd: number; rigUsdPerHr: number; drillHr: number; tripHr: number; meterageM: number;
}): number | null {
  if (!(opts.meterageM > 0)) return null;
  return (opts.bitUsd + opts.rigUsdPerHr * (opts.drillHr + opts.tripHr)) / opts.meterageM;
}

/**
 * Trip-adjusted (effective) ROP [m/hr]: `meterage / (drillHr + tripHr)` — the
 * study's "ROP regarding trip". Returns `null` when total time is non-positive.
 */
export function tripAdjustedRop(opts: {
  meterageM: number; drillHr: number; tripHr: number;
}): number | null {
  const t = opts.drillHr + opts.tripHr;
  if (!(t > 0)) return null;
  return opts.meterageM / t;
}
