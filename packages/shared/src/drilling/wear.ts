/**
 * Quantitative bit-wear forensics from IADC dull grades.
 *
 * WHY A RATE IS MEANINGFUL AT ALL
 * -------------------------------
 * The IADC 8-point cutting-structure scale is LINEAR in remaining cutter height
 * (SPE/IADC 23939, "IADC dull grading for PDC bits"). That linearity is the
 * whole licence for this file: a grade of 4 really is twice the wear of a 2, so
 * dividing by rotating hours or by metres drilled produces a rate that can be
 * compared across runs, formations and bit families. On a non-linear scale the
 * same division would be meaningless arithmetic on ordinal labels.
 *
 * The SPE/IADC 2022 "IADC Code Upgrade" bit-forensics paper is the workflow
 * these rates feed: damage -> dysfunction -> practice change, driven by routine
 * drilling data rather than new sensors.
 *
 * WHAT THESE NUMBERS ARE NOT
 * --------------------------
 * A wear rate computed from a run AVERAGE says how hard the whole run was on the
 * bit. It cannot say WHEN in the run the damage happened, and it cannot separate
 * causes on its own — that needs the dull characteristic and location alongside.
 * Cross-run screening, not intra-run diagnosis.
 */

/**
 * Mean cutting-structure wear, 0–8.
 *
 * Null unless BOTH inner and outer are present: a run graded only on the inner
 * rows is not half-worn, it is half-reported, and averaging one number with a
 * missing one would silently halve the rate.
 */
export function wearAvg(
  inner: number | null | undefined,
  outer: number | null | undefined,
): number | null {
  if (inner == null || outer == null) return null;
  if (!Number.isFinite(inner) || !Number.isFinite(outer)) return null;
  if (inner < 0 || inner > 8 || outer < 0 || outer > 8) return null;
  return (inner + outer) / 2;
}

/** Wear per rotating hour — grade points per hour on bottom. */
export function wearPerHour(
  avg: number | null | undefined,
  bitHour: number | null | undefined,
): number | null {
  if (avg == null || bitHour == null) return null;
  if (!Number.isFinite(avg) || !Number.isFinite(bitHour) || bitHour <= 0) return null;
  return avg / bitHour;
}

/**
 * Wear per 100 m drilled — the rate that answers "which bit survives which
 * formation", because it normalises by hole made rather than by time spent.
 *
 * This is the metric Dupriest's sliding-distance argument predicts should FALL
 * as ROP rises: absent dysfunction, a deeper cut per revolution means fewer
 * revolutions — and so less sliding distance — per metre drilled, so a faster
 * run should wear the bit LESS per metre even though it wears it more per hour.
 * The wear-vs-ROP scatter exists to test that on real data rather than assume it.
 */
export function wearPer100m(
  avg: number | null | undefined,
  meters: number | null | undefined,
): number | null {
  if (avg == null || meters == null) return null;
  if (!Number.isFinite(avg) || !Number.isFinite(meters) || meters <= 0) return null;
  return (100 * avg) / meters;
}

/**
 * Reason-pulled codes that mean the run ENDED BADLY, as opposed to ending on
 * plan (TD, casing point, directional needs).
 *
 * Used to keep a parameter roadmap from recommending the settings that tore bits
 * up: a run pulled for downhole-tool failure or a broken cutting structure is
 * evidence AGAINST its parameters, however fast it drilled while it lasted.
 *
 *   DTF  downhole tool failure      PR   penetration rate
 *   BT   broken teeth/cutters       LOT  lost or damaged teeth/cutters
 */
export const FAILURE_REASON_CODES: readonly string[] = ["DTF", "PR", "BT", "LOT"];

/** True when a reason-pulled code marks a failure rather than a planned pull. */
export function isFailureReason(code: string | null | undefined): boolean {
  if (!code) return false;
  return FAILURE_REASON_CODES.includes(code.trim().toUpperCase());
}

/**
 * Severe cutting-structure wear — either row at 4/8 or worse, i.e. at least half
 * the cutter height gone.
 *
 * Deliberately OR rather than the average: a bit with a pristine inner row and a
 * destroyed outer row averages to 4 and reads as "moderate", when in fact the
 * gauge-side cutters are gone and the run should not be held up as an example.
 */
export function isSevereDull(
  inner: number | null | undefined,
  outer: number | null | undefined,
): boolean {
  return (inner != null && inner >= 4) || (outer != null && outer >= 4);
}
