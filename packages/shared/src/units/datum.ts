/**
 * Tools > Reference Datum — re-referencing every depth to a different point.
 *
 * The model states the anchor outright, in wvWellHeader.ElvOrigKB's own help:
 * "Original KB Elevation. ALL DEPTHS STORED IN THE DATABASE RELATIVE TO THIS
 * ELEVATION." So a stored depth is metres below the original kelly bushing, and
 * choosing another reference is a fixed offset — nothing is rewritten, exactly
 * as with the unit sets.
 *
 * THE OFFSET. Elevations are heights above sea level, so the drop from the KB
 * to the chosen point is `ElvOrigKB − Elv(chosen)`. Ground sits below the rig
 * floor, so that is positive, and a fixed point in the earth is FEWER metres
 * below ground than below the KB: `displayed = stored − Δ`.
 *
 * AND IT IS NOT THE SAME ARITHMETIC FOR EVERY FLAGGED FIELD. `applydatum` says
 * a value is measured from the reference; it does not say which way it points.
 * Two exceptions come out of the model's own help text and are carried on the
 * field as `datumMode`:
 *
 *  • "up" — Stick Up, `EQN: <lengthcalc> - <depthbtm>`, the length a string
 *    stands ABOVE the reference. Drop the reference by Δ and the stickup GROWS
 *    by Δ. Subtracting here would be wrong by 2Δ.
 *  • "invariant" — a difference of two depths ("Difference between Prog TVD and
 *    Actual TVD"). Both operands move together, so the difference does not move
 *    at all. Shifting it would invent a discrepancy that is not in the data.
 *
 * When the chosen datum has no elevation on a well — 7 of the sample's 42 have
 * no ground elevation, 37 no mudline — there IS no offset, and the honest
 * result is the stored KB-referenced depth plus a statement that it could not
 * be re-referenced. A datum shift that silently becomes zero is indistinguishable
 * from one that worked.
 */

/** The reference points a well can be re-referenced to. */
export const DATUMS = ["OrigKB", "Ground", "MudLine", "CasFlange", "TubHead", "SeaLevel"] as const;
export type Datum = (typeof DATUMS)[number];

export const DATUM_LABELS: Record<Datum, string> = {
  OrigKB: "Original KB",
  Ground: "Ground level",
  MudLine: "Mud line",
  CasFlange: "Casing flange",
  TubHead: "Tubing head",
  SeaLevel: "Sea level",
};

/**
 * Datums that are legitimately a long way from the kelly bushing.
 *
 * The mud line offshore is hundreds of metres down, and sea level is the whole
 * KB elevation away — 896 m on an Alberta well. Both must skip the placeholder
 * check below, which exists to catch a casing flange recorded as 0.
 */
const FAR_FROM_KB = new Set<Datum>(["MudLine", "SeaLevel"]);

/** A well's elevations, as wvWellHeader stores them (metres above sea level). */
export interface WellElevations {
  OrigKB?: number | null;
  Ground?: number | null;
  MudLine?: number | null;
  CasFlange?: number | null;
  TubHead?: number | null;
  /** Never stored: sea level is zero by definition. Present for completeness. */
  SeaLevel?: number | null;
}

/** How a datum-referenced value responds to a change of reference. */
export type DatumMode = "depth" | "up" | "invariant";

export interface DatumShift {
  /** Metres from the original KB down to the chosen reference. */
  delta: number;
  datum: Datum;
  /** False when the well lacks the elevation and nothing could be shifted. */
  resolved: boolean;
  /** Why it could not be resolved, for the screen to say. */
  reason?: string;
}

/**
 * The offset for a well and a chosen datum.
 *
 * Returns `resolved: false` rather than 0 when it cannot be computed, so a
 * caller can say "not re-referenced" instead of showing KB depths under a
 * ground-level heading.
 */
export function datumShift(elev: WellElevations, datum: Datum): DatumShift {
  if (datum === "OrigKB") return { delta: 0, datum, resolved: true };
  const kb = elev.OrigKB;
  // Sea level is the datum with no stored elevation: it IS zero, by definition,
  // so the drop from the KB is the KB's own height above the sea.
  const to = datum === "SeaLevel" ? 0 : elev[datum];
  if (kb == null || !Number.isFinite(kb)) {
    return { delta: 0, datum, resolved: false,
      reason: "this well has no original KB elevation, which is what its depths are stored against" };
  }
  if (to == null || !Number.isFinite(to)) {
    return { delta: 0, datum, resolved: false,
      reason: `this well has no ${DATUM_LABELS[datum].toLowerCase()} elevation` };
  }
  // A PLACEHOLDER ZERO, which is not the same as a missing value and is far
  // more dangerous. 11 of the sample's 42 wells store ElvCasFlange = 0 and 11
  // store ElvTubHead = 0 while their KB stands at 850–1027 m. Zero is finite,
  // so a plain null-check lets it through and every depth in the well moves by
  // the height of the rig — a 500 m casing shoe would read as −527 m.
  //
  // A casing flange, a tubing head and the ground are all within metres of the
  // kelly bushing by construction, so a drop of more than NEAR_KB_LIMIT from a
  // non-zero KB is not a rig floor on a hill: it is an unrecorded value. The
  // mud line is exempt — offshore it is legitimately hundreds of metres down.
  // Refusing costs the user a re-reference; accepting silently relocates the
  // whole well.
  const NEAR_KB_LIMIT = 100;
  const delta = kb - to;
  if (!FAR_FROM_KB.has(datum) && kb !== 0 && Math.abs(delta) > NEAR_KB_LIMIT) {
    return { delta: 0, datum, resolved: false,
      reason: `this well's ${DATUM_LABELS[datum].toLowerCase()} elevation reads ${to}, which is `
        + `${Math.abs(delta).toFixed(0)} m from its KB — too far to be a real one, so it has not been used` };
  }
  return { delta, datum, resolved: true };
}

/**
 * Apply a shift to one value.
 *
 * `mode` comes from the data model, not from the column name. A caller that
 * passes "depth" for everything gets Stick Up wrong by twice the offset and
 * invents a difference where the data has none.
 */
export function applyDatumShift(
  value: number,
  shift: DatumShift,
  mode: DatumMode = "depth",
): number {
  if (!shift.resolved || shift.delta === 0 || mode === "invariant") return value;
  return mode === "up" ? value + shift.delta : value - shift.delta;
}
