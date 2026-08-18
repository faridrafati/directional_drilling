/**
 * Reference datum.
 *
 * A wrong sign here moves every depth in a drilling application by a few metres
 * — plausible, invisible, and exactly the sort of number nobody re-derives. So
 * these fix the direction against physical sense, and pin the two field classes
 * where a plain subtraction is WRONG: stick-up, which points the other way, and
 * a difference of two depths, which does not move at all.
 */
import { describe, it, expect } from "vitest";
import { datumShift, applyDatumShift, DATUMS, DATUM_LABELS } from "./datum.js";
import { toDisplay, fromDisplay } from "./wellview-display.js";

// Sample 12's real elevations: the rig floor stands 4.4989 m above the ground.
const SAMPLE = { OrigKB: 896.5996704101562, Ground: 892.100830078125, CasFlange: 896.5999755859375 };

describe("reference datum", () => {
  it("measures the offset from the KB down to the chosen point", () => {
    const s = datumShift(SAMPLE, "Ground");
    expect(s.resolved).toBe(true);
    expect(s.delta).toBeCloseTo(4.49884, 4);
    // The KB is its own reference and cannot move.
    expect(datumShift(SAMPLE, "OrigKB").delta).toBe(0);
  });

  it("makes a fixed point FEWER metres below ground than below the rig floor", () => {
    // The physical check. Ground is below the KB, so re-referencing a casing
    // shoe to ground must make its depth smaller, never larger.
    const s = datumShift(SAMPLE, "Ground");
    const shoe = 1000;
    const fromGround = applyDatumShift(shoe, s);
    expect(fromGround).toBeLessThan(shoe);
    expect(fromGround).toBeCloseTo(1000 - 4.49884, 4);

    // Stated the other way: the shoe's elevation is the same either way.
    const elevViaKB = SAMPLE.OrigKB - shoe;
    const elevViaGround = SAMPLE.Ground - fromGround;
    expect(elevViaKB).toBeCloseTo(elevViaGround, 9);
  });

  it("moves STICK UP the opposite way, because it points up", () => {
    // Stick Up is `lengthcalc - depthbtm`: the length a string stands above the
    // reference. Drop the reference and the stickup grows. Treating it as a
    // depth would be wrong by twice the offset.
    const s = datumShift(SAMPLE, "Ground");
    const stickup = 3;
    expect(applyDatumShift(stickup, s, "up")).toBeCloseTo(3 + 4.49884, 4);
    // The size of the error a naive implementation would make.
    const naive = applyDatumShift(stickup, s, "depth");
    expect(applyDatumShift(stickup, s, "up") - naive).toBeCloseTo(2 * s.delta, 9);
  });

  it("does NOT move a difference of two depths", () => {
    // "Difference between Prog TVD and Actual TVD" — both operands shift
    // together, so the gap between them is unchanged. Shifting it would invent
    // a discrepancy the data does not contain.
    const s = datumShift(SAMPLE, "Ground");
    expect(applyDatumShift(12.5, s, "invariant")).toBe(12.5);
    // …and it really is what the two depths do.
    const prog = applyDatumShift(2000, s);
    const actual = applyDatumShift(1987.5, s);
    expect(prog - actual).toBeCloseTo(12.5, 9);
  });

  it("REFUSES to shift when the well has no such elevation", () => {
    // 7 of the 42 sample wells have no ground elevation and 37 no mud line.
    // Silently shifting by zero would show KB depths under a ground heading.
    const s = datumShift({ OrigKB: 896.6 }, "MudLine");
    expect(s.resolved).toBe(false);
    expect(s.reason).toMatch(/mud line/i);
    expect(applyDatumShift(1000, s)).toBe(1000);

    // …and the same when the anchor itself is missing.
    const noKb = datumShift({ Ground: 892.1 }, "Ground");
    expect(noKb.resolved).toBe(false);
    expect(noKb.reason).toMatch(/original KB/i);
  });

  it("handles an offshore mud line below sea level", () => {
    // A negative elevation is ordinary offshore: the mud line is under water.
    const s = datumShift({ OrigKB: 25, MudLine: -300 }, "MudLine");
    expect(s.resolved).toBe(true);
    expect(s.delta).toBe(325);
    // A point 1000 below the KB is only 675 below the mud line.
    expect(applyDatumShift(1000, s)).toBe(675);
  });

  it("names every datum it offers", () => {
    for (const d of DATUMS) expect(DATUM_LABELS[d]?.length).toBeGreaterThan(2);
  });

  it("round-trips a typed depth back to the KB-referenced value it stores", () => {
    // The corruption that would be invisible: the user is shown a ground-
    // referenced depth in feet, types a correction, and what lands in the
    // database must still be metres below the ORIGINAL KB. Getting the
    // inversion wrong shifts the record by twice the offset, silently.
    const s = datumShift(SAMPLE, "Ground");
    const spec = {
      unit: "m",
      units: { US: { unit: "ft", decimals: 2 } },
      applyDatum: true,
    };
    const stored = 1234.5;
    const shown = toDisplay(stored, spec, "US", s)!;
    // Ground-referenced, in feet.
    expect(shown.unit).toBe("ft");
    expect(shown.value).toBeCloseTo((stored - s.delta) / 0.3048, 6);
    // …and back again, unchanged.
    expect(fromDisplay(String(shown.value), spec, "US", s)).toBeCloseTo(stored, 6);
  });

  it("round-trips the two awkward modes too", () => {
    const s = datumShift(SAMPLE, "Ground");
    for (const mode of ["up", "invariant"] as const) {
      const spec = { unit: "m", units: { US: { unit: "ft", decimals: 2 } }, applyDatum: true, datumMode: mode };
      const stored = 7.25;
      const shown = toDisplay(stored, spec, "US", s)!;
      expect(fromDisplay(String(shown.value), spec, "US", s), mode).toBeCloseTo(stored, 6);
    }
    // An invariant field must not have moved on the way out either.
    const inv = { unit: "m", applyDatum: true, datumMode: "invariant" as const };
    expect(toDisplay(12.5, inv, "Metric", s)!.value).toBe(12.5);
  });

  it("leaves a field the model does NOT mark alone", () => {
    // Only the 355 flagged fields move. A pipe diameter is not a depth.
    const s = datumShift(SAMPLE, "Ground");
    const size = { unit: "m", units: { US: { unit: "in", decimals: 3 } } };
    expect(toDisplay(0.244475, size, "US", s)!.value).toBeCloseTo(9.625, 6);
  });

  it("REFUSES a placeholder zero elevation instead of relocating the well", () => {
    // 11 of the 42 sample wells store ElvCasFlange = 0 with a KB at 850–1027 m.
    // Zero is finite, so a null-check alone lets it through and every depth
    // moves by the height of the rig: a 500 m shoe would read as −527 m.
    const s = datumShift({ OrigKB: 1026.6, CasFlange: 0 }, "CasFlange");
    expect(s.resolved).toBe(false);
    expect(s.reason).toMatch(/too far to be a real one/);
    expect(applyDatumShift(500, s)).toBe(500);
  });

  it("still allows a mud line hundreds of metres down", () => {
    // The exemption that makes the guard safe offshore.
    const s = datumShift({ OrigKB: 25, MudLine: -300 }, "MudLine");
    expect(s.resolved).toBe(true);
    expect(s.delta).toBe(325);
  });

  it("allows a genuine near-KB elevation", () => {
    // Sample 12's real casing flange is 0.3 mm below the KB.
    const s = datumShift({ OrigKB: 896.5996704101562, CasFlange: 896.5999755859375 }, "CasFlange");
    expect(s.resolved).toBe(true);
    expect(Math.abs(s.delta)).toBeLessThan(0.01);
  });

  it("offers sea level, whose elevation is zero by definition", () => {
    // The seventh datum WellView ships. It has no stored column — MSL IS zero —
    // and it is exempt from the placeholder guard, since the whole KB height
    // above the sea is a legitimate offset.
    const s = datumShift({ OrigKB: 896.5996704101562 }, "SeaLevel");
    expect(s.resolved).toBe(true);
    expect(s.delta).toBeCloseTo(896.5997, 4);
    // A shoe 1000 below the KB is 103.4 below sea level.
    expect(applyDatumShift(1000, s)).toBeCloseTo(103.4003, 4);
    // …and above sea level it reads negative, which is correct, not clamped.
    expect(applyDatumShift(100, s)).toBeLessThan(0);
  });
});
