import { describe, expect, it } from "vitest";
import {
  tfaFromNozzles, nozzlePressureDrop, bitHHP, hsi, jetImpact, hsiFromHydraulics,
} from "./hydraulics.js";
import { bitArea } from "./mse.js";

describe("tfaFromNozzles", () => {
  it("sums π/4·(n/32)² over the jets (three 14/32\" nozzles)", () => {
    const expected = 3 * (Math.PI / 4) * (14 / 32) ** 2;
    expect(tfaFromNozzles([14, 14, 14])).toBeCloseTo(expected, 9);
    expect(tfaFromNozzles([14, 14, 14, 0])).toBeCloseTo(expected, 9); // zero jets ignored
  });
});

describe("nozzlePressureDrop / HHP / HSI / jet impact", () => {
  const tfa = tfaFromNozzles([14, 14, 14]); // ≈ 0.45097 in²
  it("ΔPᵦ ≈ 1132 psi at 10 ppg, 500 gpm", () => {
    const dp = nozzlePressureDrop({ rhoPpg: 10, qGpm: 500, tfaIn2: tfa })!;
    expect(Math.abs(dp - 1132) / 1132).toBeLessThan(0.01);
  });
  it("HHPᵦ = ΔP·Q/1714", () => {
    expect(bitHHP(1132, 500)).toBeCloseTo(330.22, 1);
  });
  it("HSI = HHPᵦ / Aᵦ", () => {
    expect(hsi(330.22, 8.5)!).toBeCloseTo(330.22 / bitArea(8.5), 6);
  });
  it("jet impact force Fⱼ = 0.01823·Cd·Q·√(ρ·ΔP)", () => {
    const fj = jetImpact({ qGpm: 500, rhoPpg: 10, dPbPsi: 1132 });
    expect(fj).toBeCloseTo(0.01823 * 0.95 * 500 * Math.sqrt(10 * 1132), 6);
  });
  it("hsiFromHydraulics chains ΔP → HHP → HSI", () => {
    const direct = hsiFromHydraulics({ tfaIn2: tfa, qGpm: 500, rhoPpg: 10, dIn: 8.5 })!;
    const dp = nozzlePressureDrop({ rhoPpg: 10, qGpm: 500, tfaIn2: tfa })!;
    expect(direct).toBeCloseTo(hsi(bitHHP(dp, 500), 8.5)!, 9);
  });
  it("returns null when TFA or flow is non-positive", () => {
    expect(nozzlePressureDrop({ rhoPpg: 10, qGpm: 500, tfaIn2: 0 })).toBeNull();
    expect(hsiFromHydraulics({ tfaIn2: 0.45, qGpm: 0, rhoPpg: 10, dIn: 8.5 })).toBeNull();
  });
});
