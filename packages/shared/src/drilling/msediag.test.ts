import { describe, it, expect } from "vitest";
import {
  aggressiveness, depthOfCutIn, drillingStrength, efficiencyRatio,
  estimateTorque, bitArea, MU_DEFAULT,
} from "./mse.js";

describe("aggressiveness", () => {
  it("inverts estimateTorque exactly", () => {
    // The property that makes the measured-torque restriction necessary: feed
    // an ESTIMATED torque back in and you get the assumption out again.
    for (const mu of [0.15, MU_DEFAULT.roller, MU_DEFAULT.PDC, 0.9]) {
      for (const dIn of [6, 8.5, 12.25, 17.5]) {
        for (const wobLbf of [5_000, 30_000, 60_000]) {
          const T = estimateTorque({ mu, dIn, wobLbf });
          expect(aggressiveness({ torqueFtLbf: T, dIn, wobLbf })).toBeCloseTo(mu, 10);
        }
      }
    }
  });

  it("rises with torque at fixed weight and diameter", () => {
    const low = aggressiveness({ torqueFtLbf: 4_000, dIn: 12.25, wobLbf: 40_000 })!;
    const high = aggressiveness({ torqueFtLbf: 9_000, dIn: 12.25, wobLbf: 40_000 })!;
    expect(high).toBeGreaterThan(low);
  });

  it("returns null on missing or non-positive inputs", () => {
    expect(aggressiveness({ torqueFtLbf: null, dIn: 8.5, wobLbf: 30_000 })).toBeNull();
    expect(aggressiveness({ torqueFtLbf: 5_000, dIn: 0, wobLbf: 30_000 })).toBeNull();
    expect(aggressiveness({ torqueFtLbf: 5_000, dIn: 8.5, wobLbf: 0 })).toBeNull();
  });
});

describe("depthOfCutIn", () => {
  it("matches the definition", () => {
    // 60 ft/hr at 60 rpm = 1 ft per 60 rev = 12 in / 60 = 0.2 in/rev
    expect(depthOfCutIn({ ropFtHr: 60, rpm: 60 })).toBeCloseTo(0.2, 10);
    expect(depthOfCutIn({ ropFtHr: 120, rpm: 120 })).toBeCloseTo(0.2, 10);
  });

  it("deepens as ROP rises at fixed RPM", () => {
    const slow = depthOfCutIn({ ropFtHr: 30, rpm: 100 })!;
    const fast = depthOfCutIn({ ropFtHr: 90, rpm: 100 })!;
    expect(fast).toBeCloseTo(3 * slow, 10);
  });

  it("returns null outside the domain", () => {
    expect(depthOfCutIn({ ropFtHr: 0, rpm: 100 })).toBeNull();
    expect(depthOfCutIn({ ropFtHr: 60, rpm: 0 })).toBeNull();
    expect(depthOfCutIn({ ropFtHr: 60, rpm: null })).toBeNull();
  });
});

describe("drillingStrength", () => {
  it("matches a hand-computed value", () => {
    // D = 8.5 in -> area = pi/4 * 8.5^2 = 56.745 in^2
    // DOC = 0.2 in, W = 40,000 lbf  ->  S = 40000 / (56.745 * 0.2) = 3,524.8 psi
    const dIn = 8.5;
    const area = bitArea(dIn);
    const s = drillingStrength({ wobLbf: 40_000, dIn, docIn: 0.2 })!;
    expect(s).toBeCloseTo(40_000 / (area * 0.2), 8);
    expect(s).toBeCloseTo(3_524.8, 0);
  });

  it("falls as the cut deepens at fixed weight", () => {
    const shallow = drillingStrength({ wobLbf: 40_000, dIn: 8.5, docIn: 0.05 })!;
    const deep = drillingStrength({ wobLbf: 40_000, dIn: 8.5, docIn: 0.4 })!;
    expect(deep).toBeLessThan(shallow);
  });

  it("returns null outside the domain", () => {
    expect(drillingStrength({ wobLbf: 0, dIn: 8.5, docIn: 0.2 })).toBeNull();
    expect(drillingStrength({ wobLbf: 40_000, dIn: 8.5, docIn: 0 })).toBeNull();
    expect(drillingStrength({ wobLbf: 40_000, dIn: null, docIn: 0.2 })).toBeNull();
  });
});

describe("efficiencyRatio", () => {
  it("is 1 exactly at the MSE = 3 x CCS anchor", () => {
    expect(efficiencyRatio(30_000, 10_000)).toBeCloseTo(1, 10);
  });

  it("falls below 1 when a run burned more energy than the rock should cost", () => {
    expect(efficiencyRatio(60_000, 10_000)).toBeCloseTo(0.5, 10);
  });

  it("returns null on missing or non-positive inputs", () => {
    expect(efficiencyRatio(null, 10_000)).toBeNull();
    expect(efficiencyRatio(30_000, 0)).toBeNull();
    expect(efficiencyRatio(0, 10_000)).toBeNull();
  });
});
