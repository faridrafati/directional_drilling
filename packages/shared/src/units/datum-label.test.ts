/**
 * The datum code on a depth's unit — `Btm (mCF)` rather than `Btm (m)`.
 *
 * WellView appends a two-or-three letter datum code INSIDE the unit's
 * parentheses on every field that moves with Tools > Reference Datum. Peloton's
 * own help circles exactly those two headings in its Reference Datum examples,
 * which is a fair signal of how much it matters: a casing shoe at 3,739 m from
 * the casing flange and 3,739 m from the kelly bushing are different places,
 * and the suffix is the only thing on screen that says which one is meant.
 *
 * The codes are read off Peloton's Select Reference Datum dialog, not invented.
 * That is worth a test on its own, because the obvious guesses are wrong: ground
 * is GRD and not GL, mean sea level is MSL and not SL.
 */
import { describe, it, expect } from "vitest";
import { DATUMS, DATUM_CODES, DATUM_LABELS, datumShift, type Datum } from "./datum.js";
import { displayUnitLabel } from "./wellview-display.js";

/** A well with every elevation, so any datum resolves. */
const ELEV = { OrigKB: 1000, Ground: 995, CasFlange: 998, TubHead: 997, MudLine: 900 };
const shiftTo = (d: Datum) => datumShift(ELEV, d);

/** A measured depth: converts with the unit set AND moves with the datum. */
const DEPTH = { unit: "m", units: { US: { unit: "ft" } }, applyDatum: true, datumMode: "depth" as const };

describe("WellView's datum codes", () => {
  it("are the ones Peloton's own dialog gives", () => {
    // From "Select Reference Datum": Original KB Elevation (KB), Ground
    // Elevation (GRD), Casing Flange Elevation (CF), Tubing Head Elevation
    // (TH), Mud Line Elevation (ML), Mean Sea Level Elevation (MSL).
    expect(DATUM_CODES).toEqual({
      OrigKB: "KB", Ground: "GRD", CasFlange: "CF",
      TubHead: "TH", MudLine: "ML", SeaLevel: "MSL",
    });
    // Every datum the app offers has one; a datum without a code would print a
    // bare unit and lose exactly the distinction the code exists to make.
    for (const d of DATUMS) expect(DATUM_CODES[d], d).toBeTruthy();
    // …and Peloton's wording for the names, not this app's paraphrase of them.
    expect(DATUM_LABELS.Ground).toBe("Ground Elevation");
    expect(DATUM_LABELS.SeaLevel).toBe("Mean Sea Level Elevation");
  });
});

describe("the unit a depth is labelled with", () => {
  it("carries the code, fused to the unit, in every set", () => {
    expect(displayUnitLabel(DEPTH, "Metric", shiftTo("CasFlange"))).toBe("mCF");
    expect(displayUnitLabel(DEPTH, "US", shiftTo("CasFlange"))).toBe("ftCF");
    expect(displayUnitLabel(DEPTH, "Metric", shiftTo("Ground"))).toBe("mGRD");
    // The default datum is labelled too. WellView shows mKB rather than a bare
    // m, so a user cannot tell "not re-referenced" from "unlabelled".
    expect(displayUnitLabel(DEPTH, "Metric", shiftTo("OrigKB"))).toBe("mKB");
  });

  it("leaves alone what does not move with the datum", () => {
    // A length is not a depth. Its unit converts; its value does not shift.
    const length = { unit: "m", units: { US: { unit: "ft" } } };
    expect(displayUnitLabel(length, "Metric", shiftTo("CasFlange"))).toBe("m");
    expect(displayUnitLabel(length, "US", shiftTo("CasFlange"))).toBe("ft");

    // The model marks some depth-like numbers as not shifting at all.
    const invariant = { ...DEPTH, datumMode: "invariant" as const };
    expect(displayUnitLabel(invariant, "Metric", shiftTo("CasFlange"))).toBe("m");

    // A field with no unit gets no label rather than a naked code.
    expect(displayUnitLabel({ units: {} }, "Metric", shiftTo("CasFlange"))).toBe("");
  });

  it("does NOT claim a re-reference that did not happen", () => {
    // This is the failure the label exists to prevent, so it must not be the
    // failure the label creates. A well with no casing flange elevation cannot
    // be shifted; `toDisplay` leaves the stored value alone, and the heading
    // must stay `m`. Printing `mCF` over an unshifted KB depth would be a
    // worse lie than printing nothing.
    const noFlange = datumShift({ OrigKB: 1000 }, "CasFlange");
    expect(noFlange.resolved).toBe(false);
    expect(displayUnitLabel(DEPTH, "Metric", noFlange)).toBe("m");

    // …and the same while the elevations are still loading.
    expect(displayUnitLabel(DEPTH, "Metric", null)).toBe("m");
    expect(displayUnitLabel(DEPTH, "Metric")).toBe("m");
  });

  it("refuses the placeholder zero the same way the shift does", () => {
    // 11 of the sample's 42 wells store a casing flange of 0 under a KB near
    // 1,000 m. datumShift rejects that as unrecorded rather than moving the
    // well by the height of the rig — and the label has to follow it, or the
    // heading says CF while the number is still KB.
    const placeholder = datumShift({ OrigKB: 1000, CasFlange: 0 }, "CasFlange");
    expect(placeholder.resolved).toBe(false);
    expect(displayUnitLabel(DEPTH, "Metric", placeholder)).toBe("m");
  });
});
