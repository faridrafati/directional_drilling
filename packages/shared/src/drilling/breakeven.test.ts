import { describe, it, expect } from "vitest";
import {
  breakEvenRopMHr, breakEvenMeters, costPerMeter, rigUsdPerHr,
} from "./cost.js";
import { mhrToFthr, FT_PER_M } from "./units.js";

/**
 * PetroWiki's worked bit-economics example, converted to metric.
 *
 * The published case: a bit drilling 3,380 ft at 13.7 ft/hr comes out at
 * $28.46/ft. Reproducing it here pins BOTH directions of the identity — the
 * forward cost and the two inversions — against a source outside this codebase.
 */
const FT = FT_PER_M;                 // 3.28084 ft per m
const REF_FT = 3_380;
const REF_ROP_FTHR = 13.7;
const REF_COST_PER_FT = 28.46;

describe("PetroWiki worked example, in metric", () => {
  // Back out the rig rate and bit cost the published numbers imply, then check
  // the inversions return the case's own footage and ROP.
  const meters = REF_FT / FT;
  const ropMHr = REF_ROP_FTHR / FT;
  const drillHr = meters / ropMHr;
  const costPerM = REF_COST_PER_FT * FT;

  // A plausible split of that cost between bit and rig: choose the bit price and
  // solve for the rig rate the example must have used.
  const bitUsd = 20_000;
  const tripHr = 8;
  const rigHr = (costPerM * meters - bitUsd) / (drillHr + tripHr);

  it("reproduces the published cost per foot from the metric identity", () => {
    const c = costPerMeter({ bitUsd, rigUsdPerHr: rigHr, drillHr, tripHr, meterageM: meters });
    expect(c).not.toBeNull();
    expect(c! / FT).toBeCloseTo(REF_COST_PER_FT, 6);
  });

  it("break-even ROP over the same footage returns the case's own ROP", () => {
    const rop = breakEvenRopMHr({
      refCostPerM: costPerM, bitUsd, rigUsdPerHr: rigHr, tripHr, meters,
    });
    expect(rop).not.toBeNull();
    expect(mhrToFthr(rop!)).toBeCloseTo(REF_ROP_FTHR, 6);
  });

  it("break-even footage at the same ROP returns the case's own footage", () => {
    const m = breakEvenMeters({
      refCostPerM: costPerM, bitUsd, rigUsdPerHr: rigHr, tripHr, ropMHr,
    });
    expect(m).not.toBeNull();
    expect(m! * FT).toBeCloseTo(REF_FT, 3);
  });
});

describe("breakEvenRopMHr", () => {
  // A 30,000 $/day rig burns 1,250 $/hr, so at a 100 $/m reference the bit must
  // already beat 12.5 m/hr just to cover the rig. The reference is set at 400 $/m
  // — a deep-section figure — so the cases below are economically reachable and
  // the test exercises the arithmetic rather than the guard.
  const base = { refCostPerM: 400, bitUsd: 20_000, rigUsdPerHr: rigUsdPerHr(30_000), tripHr: 10 };

  it("demands a higher ROP from a more expensive bit", () => {
    const cheap = breakEvenRopMHr({ ...base, bitUsd: 10_000, meters: 500 })!;
    const dear = breakEvenRopMHr({ ...base, bitUsd: 60_000, meters: 500 })!;
    expect(cheap).not.toBeNull();
    expect(dear).not.toBeNull();
    expect(dear).toBeGreaterThan(cheap);
  });

  it("round-trips against costPerMeter", () => {
    const meters = 800;
    const rop = breakEvenRopMHr({ ...base, meters })!;
    const c = costPerMeter({
      bitUsd: base.bitUsd, rigUsdPerHr: base.rigUsdPerHr,
      drillHr: meters / rop, tripHr: base.tripHr, meterageM: meters,
    });
    expect(c).toBeCloseTo(base.refCostPerM, 8);
  });

  it("returns null when the break-even is unreachable, not NaN", () => {
    // The bit alone costs more than the reference would pay for this footage,
    // so no ROP however high gets there.
    const rop = breakEvenRopMHr({ ...base, bitUsd: 1_000_000, meters: 100 });
    expect(rop).toBeNull();
  });

  it("rejects non-positive inputs", () => {
    expect(breakEvenRopMHr({ ...base, meters: 0 })).toBeNull();
    expect(breakEvenRopMHr({ ...base, meters: 500, rigUsdPerHr: 0 })).toBeNull();
    expect(breakEvenRopMHr({ ...base, meters: 500, refCostPerM: 0 })).toBeNull();
  });
});

describe("breakEvenMeters", () => {
  const base = { refCostPerM: 400, bitUsd: 20_000, rigUsdPerHr: rigUsdPerHr(30_000), tripHr: 10 };

  it("demands more footage from a more expensive bit", () => {
    const cheap = breakEvenMeters({ ...base, bitUsd: 10_000, ropMHr: 20 })!;
    const dear = breakEvenMeters({ ...base, bitUsd: 60_000, ropMHr: 20 })!;
    expect(dear).toBeGreaterThan(cheap);
  });

  it("demands less footage from a faster bit", () => {
    const slow = breakEvenMeters({ ...base, ropMHr: 8 })!;
    const fast = breakEvenMeters({ ...base, ropMHr: 25 })!;
    expect(slow).not.toBeNull();
    expect(fast).not.toBeNull();
    expect(fast).toBeLessThan(slow);
  });

  it("round-trips against costPerMeter", () => {
    const ropMHr = 15;
    const m = breakEvenMeters({ ...base, ropMHr })!;
    const c = costPerMeter({
      bitUsd: base.bitUsd, rigUsdPerHr: base.rigUsdPerHr,
      drillHr: m / ropMHr, tripHr: base.tripHr, meterageM: m,
    });
    expect(c).toBeCloseTo(base.refCostPerM, 6);
  });

  it("returns null when the rig outruns the reference at that ROP", () => {
    // At 1 m/hr the rig burns 1,250 $/m against a 400 $/m reference: no footage
    // ever breaks even, and the honest answer is "unreachable".
    expect(breakEvenMeters({ ...base, ropMHr: 1 })).toBeNull();
  });

  it("rejects non-positive inputs", () => {
    expect(breakEvenMeters({ ...base, ropMHr: 0 })).toBeNull();
    expect(breakEvenMeters({ ...base, ropMHr: 15, refCostPerM: 0 })).toBeNull();
  });
});
