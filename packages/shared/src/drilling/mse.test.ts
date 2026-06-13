import { describe, expect, it } from "vitest";
import { bitArea, psiToMPa, estimateTorque, mseTeale, founderPoint, founderAtConstantRpm, MU_DEFAULT } from "./mse.js";
import { tonnesToLbf, knmToFtLbf, mhrToFthr } from "./units.js";

const FT_PER_M = 3.280839895;

describe("bitArea / psiToMPa", () => {
  it("Aᵦ = π/4·d² for a 12¼\" bit", () => {
    expect(bitArea(12.25)).toBeCloseTo(117.8588, 3);
  });
  it("psi → MPa", () => {
    expect(psiToMPa(145.0377)).toBeCloseTo(1, 6);
  });
});

describe("estimateTorque", () => {
  it("T = μ·d·WOB/36 for a roller-cone 8½\" bit at 15 klb", () => {
    // 0.25 · 8.5 · 15000 / 36 = 885.42 ft·lbf
    expect(estimateTorque({ mu: MU_DEFAULT.roller, dIn: 8.5, wobLbf: 15000 })).toBeCloseTo(885.4167, 3);
  });
});

describe("mseTeale (Teale 1965, psi)", () => {
  it("matches the hand-computed 12¼\" example within 1%", () => {
    // WOB 20 klb, 120 RPM, torque 10 000 ft·lbf, ROP 3 m/hr → ≈ 390 141 psi
    const mse = mseTeale({
      wobLbf: 20_000, rpm: 120, torqueFtLbf: 10_000,
      ropFtHr: 3 * FT_PER_M, dIn: 12.25,
    })!;
    const expected = 390_141;
    expect(Math.abs(mse - expected) / expected).toBeLessThan(0.01);
  });
  it("applies the mechanical-efficiency divisor Eₘ", () => {
    const base = mseTeale({ wobLbf: 20_000, rpm: 120, torqueFtLbf: 10_000, ropFtHr: 10, dIn: 12.25 })!;
    const adj = mseTeale({ wobLbf: 20_000, rpm: 120, torqueFtLbf: 10_000, ropFtHr: 10, dIn: 12.25, Em: 0.5 })!;
    expect(adj).toBeCloseTo(base / 0.5, 6);
  });
  it("returns null when ROP or diameter is non-positive", () => {
    expect(mseTeale({ wobLbf: 20_000, rpm: 120, torqueFtLbf: 10_000, ropFtHr: 0, dIn: 12.25 })).toBeNull();
    expect(mseTeale({ wobLbf: 20_000, rpm: 120, torqueFtLbf: 10_000, ropFtHr: 10, dIn: 0 })).toBeNull();
  });
  it("matches the spec's metric hand example within 1% (12¼\", WOB 20 t, 120 RPM, 10 kN·m, 3 m/hr)", () => {
    const mse = mseTeale({
      wobLbf: tonnesToLbf(20), rpm: 120,
      torqueFtLbf: knmToFtLbf(10), ropFtHr: mhrToFthr(3), dIn: 12.25,
    })!;
    const expected = 288_000; // ≈ 374 psi axial + 287 600 psi rotary
    expect(Math.abs(mse - expected) / expected).toBeLessThan(0.01);
  });
});

describe("founderPoint", () => {
  it("finds the knee where ROP stops responding to WOB", () => {
    // ROP rises 1:1 with WOB up to 14 klb, then plateaus.
    const wobs: number[] = [], rops: number[] = [];
    for (const w of [5, 5, 8, 8, 11, 11, 14, 14, 17, 17, 20, 20, 23, 23]) {
      wobs.push(w); rops.push(Math.min(w, 14));
    }
    const f = founderPoint(wobs, rops)!;
    expect(f).not.toBeNull();
    expect(f.founderWob).not.toBeNull();
    expect(f.founderWob!).toBeGreaterThanOrEqual(14);
    expect(f.optimalWob!).toBeLessThanOrEqual(f.founderWob!);
    expect(f.initialSlope).toBeGreaterThan(0);
  });
  it("returns null without enough spread", () => {
    expect(founderPoint([10, 10, 10], [1, 2, 3])).toBeNull();
  });
});

describe("founderAtConstantRpm", () => {
  it("evaluates the drill-off inside the most-populated RPM band", () => {
    // Dense band at ~120 RPM with a plateau above WOB 14; a few stray 60-RPM points.
    const wobs: number[] = [], rpms: number[] = [], rops: number[] = [];
    for (const w of [5, 5, 8, 8, 11, 11, 14, 14, 17, 17, 20, 20, 23, 23]) {
      wobs.push(w); rpms.push(119 + (w % 3)); rops.push(Math.min(w, 14));
    }
    for (const w of [6, 12, 18]) { wobs.push(w); rpms.push(60); rops.push(w * 2); }
    const f = founderAtConstantRpm(wobs, rpms, rops)!;
    expect(f).not.toBeNull();
    expect(f.rpmLo).toBeGreaterThan(100);       // picked the ~120 band, not the 60s
    expect(f.nBand).toBe(14);
    expect(f.founder.founderWob).not.toBeNull();
    expect(f.founder.founderWob!).toBeGreaterThanOrEqual(14);
  });
  it("falls back to the full range when RPM has no spread", () => {
    const wobs = [5, 8, 11, 14, 17, 20], rpms = [100, 100, 100, 100, 100, 100], rops = [5, 8, 11, 14, 14, 14];
    const f = founderAtConstantRpm(wobs, rpms, rops)!;
    expect(f).not.toBeNull();
    expect(f.nBand).toBe(6);
  });
});
