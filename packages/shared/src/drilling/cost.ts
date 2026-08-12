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

/**
 * BREAK-EVEN ANALYSIS
 *
 * PetroWiki/SPE calls this "the most important aspect" of bit economic
 * evaluation, and every input is a per-run daily-report quantity. The question
 * it answers is the planning one: a candidate bit costs more — how much faster,
 * or how much further, must it drill to pay for itself against the offset?
 *
 * Both functions invert the same identity `costPerMeter` computes forward:
 *
 *     C = (B + R·(t_trip + t_drill)) / F
 *
 * so there is exactly one relationship here, solved for two different unknowns.
 * Neither is a new model.
 *
 * The known blind spot, stated in the UI beside these numbers: ranking offsets by
 * cost per metre cannot surface a bit type that was never run in the offsets. The
 * strength-based screen is the complement, not a rival (OGJ 1994).
 */

/**
 * The ROP a candidate must sustain over `meters` to match `refCostPerM` [m/hr].
 *
 * Solving the identity for drilling time gives
 * `t_drill = (C·F − B − R·t_trip) / R`, and the required ROP is `F / t_drill`.
 *
 * Returns null when the break-even is UNREACHABLE — when the bit price and the
 * trip alone already cost more than the reference would pay for that footage,
 * the implied drilling time is zero or negative and no ROP, however high, gets
 * there. That is a real answer ("you cannot win this way"), so it must not come
 * back as NaN or Infinity dressed as a number.
 */
export function breakEvenRopMHr(opts: {
  refCostPerM: number; bitUsd: number; rigUsdPerHr: number; tripHr: number; meters: number;
}): number | null {
  const { refCostPerM, bitUsd, rigUsdPerHr, tripHr, meters } = opts;
  if (!(meters > 0) || !(rigUsdPerHr > 0) || !(refCostPerM > 0)) return null;
  const drillHr = (refCostPerM * meters - bitUsd - rigUsdPerHr * tripHr) / rigUsdPerHr;
  if (!(drillHr > 0)) return null;
  return meters / drillHr;
}

/**
 * The footage a candidate must make at an assumed ROP to match `refCostPerM` [m].
 *
 * Solving the same identity for F, with `t_drill = F / ROP`:
 *
 *     C·F = B + R·t_trip + R·F/ROP
 *     F·(C − R/ROP) = B + R·t_trip
 *
 * Returns null when `C ≤ R/ROP` — the rig burns money faster than the reference
 * pays for the hole being made, so no footage ever breaks even. Again a real
 * answer rather than a division blowing up.
 */
export function breakEvenMeters(opts: {
  refCostPerM: number; bitUsd: number; rigUsdPerHr: number; tripHr: number; ropMHr: number;
}): number | null {
  const { refCostPerM, bitUsd, rigUsdPerHr, tripHr, ropMHr } = opts;
  if (!(ropMHr > 0) || !(rigUsdPerHr > 0) || !(refCostPerM > 0)) return null;
  const denom = refCostPerM - rigUsdPerHr / ropMHr;
  if (!(denom > 0)) return null;
  const meters = (bitUsd + rigUsdPerHr * tripHr) / denom;
  return Number.isFinite(meters) && meters > 0 ? meters : null;
}
