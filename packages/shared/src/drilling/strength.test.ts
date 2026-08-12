import { describe, it, expect } from "vitest";
import {
  apparentCcsFromMse, binghamFit, dExponent, dcExponent,
  familiesForUcs, MSE_CCS_RATIO, CCS_UCS_RATIO,
} from "./strength.js";
import { quantile } from "./stats.js";

describe("apparentCcsFromMse", () => {
  it("divides the LOW quartile of MSE by the 3x efficiency anchor", () => {
    // The expectation is derived from the SAME quantile primitive rather than
    // hand-computed: the first draft assumed a nearest-rank P25 and asserted
    // 17,500 where the shared quantile interpolates on n-1 and returns 16,250.
    // The function was right and the guess was wrong.
    const msePsis = [10_000, 15_000, 20_000, 25_000, 30_000, 40_000];
    const s = apparentCcsFromMse(msePsis.map((msePsi) => ({ msePsi })))!;
    expect(s).not.toBeNull();
    expect(s.ccsPsi).toBeCloseTo(quantile(msePsis, 0.25)! / MSE_CCS_RATIO, 6);
    // …and that it really is the low end, well under the mean.
    const meanMse = msePsis.reduce((a, b) => a + b, 0) / msePsis.length;
    expect(s.ccsPsi).toBeLessThan(meanMse / MSE_CCS_RATIO);
  });

  it("uses the low quartile, not the mean — dysfunction inflates the mean", () => {
    // Same rock, but three runs met trouble. A mean would report the rock PLUS
    // the trouble and overstate strength; the quartile should barely move.
    const clean = [20_000, 21_000, 22_000, 23_000].map((msePsi) => ({ msePsi }));
    const withTrouble = [...clean, ...[90_000, 95_000, 120_000].map((msePsi) => ({ msePsi }))];
    const a = apparentCcsFromMse(clean)!;
    const b = apparentCcsFromMse(withTrouble)!;
    expect(b.ccsPsi / a.ccsPsi).toBeLessThan(1.15);
  });

  it("returns the UCS band implied by the published CCS:UCS ratio", () => {
    const s = apparentCcsFromMse([{ msePsi: 30_000 }, { msePsi: 30_000 }, { msePsi: 30_000 }])!;
    expect(s.ucsBand[0]).toBeCloseTo(s.ccsPsi / CCS_UCS_RATIO[1], 6);
    expect(s.ucsBand[1]).toBeCloseTo(s.ccsPsi / CCS_UCS_RATIO[0], 6);
    expect(s.ucsBand[0]).toBeLessThan(s.ucsBand[1]);
  });

  it("prefers measured torque once there is enough of it", () => {
    const vals = [
      ...Array.from({ length: 5 }, () => ({ msePsi: 12_000, measuredTorque: true })),
      ...Array.from({ length: 20 }, () => ({ msePsi: 60_000, measuredTorque: false })),
    ];
    const s = apparentCcsFromMse(vals)!;
    expect(s.fromMeasuredTorque).toBe(true);
    expect(s.ccsPsi).toBeCloseTo(12_000 / MSE_CCS_RATIO, 6);
  });

  it("falls back to all values when measured torque is too sparse", () => {
    const vals = [
      { msePsi: 12_000, measuredTorque: true },
      ...Array.from({ length: 8 }, () => ({ msePsi: 60_000, measuredTorque: false })),
    ];
    const s = apparentCcsFromMse(vals)!;
    expect(s.fromMeasuredTorque).toBe(false);
  });

  it("returns null with nothing usable", () => {
    expect(apparentCcsFromMse([])).toBeNull();
    expect(apparentCcsFromMse([{ msePsi: null }, { msePsi: 0 }, { msePsi: -5 }])).toBeNull();
  });
});

describe("binghamFit", () => {
  it("recovers a known line", () => {
    // R/N = 0.5 · (W/D) - 1  =>  slope 0.5, threshold W/D of 2.
    const runs = [1, 2, 3, 4, 5, 6, 7, 8].map((wd) => ({
      diaIn: 10, wobKlb: wd * 10, rpm: 100, ropFtHr: (0.5 * wd - 1) * 100,
    }));
    const fit = binghamFit(runs)!;
    expect(fit.slope).toBeCloseTo(0.5, 8);
    expect(fit.thresholdWD).toBeCloseTo(2, 8);
    expect(fit.r2).toBeCloseTo(1, 8);
    expect(fit.drillabilityIndex).toBe(fit.slope);
  });

  it("gives a shallower slope for stronger rock", () => {
    const mk = (k: number) => [2, 3, 4, 5, 6, 7].map((wd) => ({
      diaIn: 10, wobKlb: wd * 10, rpm: 100, ropFtHr: k * wd * 100,
    }));
    const soft = binghamFit(mk(0.8))!;
    const hard = binghamFit(mk(0.2))!;
    expect(hard.slope).toBeLessThan(soft.slope);
  });

  it("needs enough points, and skips runs missing any input", () => {
    expect(binghamFit([])).toBeNull();
    const few = [1, 2, 3].map((wd) => ({ diaIn: 10, wobKlb: wd * 10, rpm: 100, ropFtHr: 500 }));
    expect(binghamFit(few)).toBeNull();

    const holey = [1, 2, 3, 4, 5, 6].map((wd, i) => ({
      diaIn: 10, wobKlb: wd * 10, rpm: i === 0 ? null : 100, ropFtHr: 500,
    }));
    expect(binghamFit(holey, { minPoints: 5 })).not.toBeNull();
  });

  it("rejects non-positive inputs rather than producing Infinity", () => {
    const bad = [1, 2, 3, 4, 5, 6].map((wd) => ({
      diaIn: 0, wobKlb: wd * 10, rpm: 100, ropFtHr: 500,
    }));
    expect(binghamFit(bad)).toBeNull();
  });
});

describe("dExponent", () => {
  it("matches a hand-computed value", () => {
    // R = 60 ft/hr, N = 120 rpm, W = 40,000 lbf, D = 8.5 in
    //   num = log10(60 / 7200)          = log10(0.0083333) = -2.0791812
    //   den = log10(480000 / 8_500_000) = log10(0.0564706) = -1.2484847
    //   d   = 1.6653...
    const d = dExponent({ ropFtHr: 60, rpm: 120, wobLbf: 40_000, dIn: 8.5 })!;
    const num = Math.log10(60 / (60 * 120));
    const den = Math.log10((12 * 40_000) / (1e6 * 8.5));
    expect(d).toBeCloseTo(num / den, 10);
    expect(d).toBeCloseTo(1.6654, 3);
  });

  it("rises as the rock gets harder — slower at the same weight", () => {
    const fast = dExponent({ ropFtHr: 120, rpm: 120, wobLbf: 40_000, dIn: 8.5 })!;
    const slow = dExponent({ ropFtHr: 20, rpm: 120, wobLbf: 40_000, dIn: 8.5 })!;
    expect(slow).toBeGreaterThan(fast);
  });

  it("returns null outside the definition's domain", () => {
    expect(dExponent({ ropFtHr: 0, rpm: 120, wobLbf: 40_000, dIn: 8.5 })).toBeNull();
    expect(dExponent({ ropFtHr: 60, rpm: 0, wobLbf: 40_000, dIn: 8.5 })).toBeNull();
    expect(dExponent({ ropFtHr: 60, rpm: 120, wobLbf: 0, dIn: 8.5 })).toBeNull();
    expect(dExponent({ ropFtHr: 60, rpm: 120, wobLbf: 40_000, dIn: null })).toBeNull();
  });
});

describe("dcExponent", () => {
  it("scales by the normal-to-actual mud-weight ratio", () => {
    expect(dcExponent(1.5, { mudPpg: 9.0 })).toBeCloseTo(1.5, 10);
    expect(dcExponent(1.5, { mudPpg: 18.0 })).toBeCloseTo(0.75, 10);
  });

  it("returns null without a usable mud weight", () => {
    expect(dcExponent(1.5, { mudPpg: null })).toBeNull();
    expect(dcExponent(1.5, { mudPpg: 0 })).toBeNull();
    expect(dcExponent(null, { mudPpg: 10 })).toBeNull();
  });
});

describe("familiesForUcs", () => {
  it("admits milled tooth only in soft rock", () => {
    expect(familiesForUcs(5_000).map((b) => b.family)).toContain("Milled tooth");
    expect(familiesForUcs(15_000).map((b) => b.family)).not.toContain("Milled tooth");
  });

  it("admits TCI only from 9,000 psi up", () => {
    expect(familiesForUcs(5_000).map((b) => b.family)).not.toContain("TCI");
    expect(familiesForUcs(12_000).map((b) => b.family)).toContain("TCI");
  });

  it("admits impregnated only above 15,000 psi", () => {
    expect(familiesForUcs(12_000).map((b) => b.family)).not.toContain("Diamond impregnated");
    expect(familiesForUcs(20_000).map((b) => b.family)).toContain("Diamond impregnated");
  });

  it("drops PDC past its published envelope, with the caveat recorded", () => {
    const pdc = familiesForUcs(10_000).find((b) => b.family === "PDC");
    expect(pdc).toBeDefined();
    expect(pdc!.note).toMatch(/possibly beyond/);
    expect(familiesForUcs(30_000).map((b) => b.family)).not.toContain("PDC");
  });
});
