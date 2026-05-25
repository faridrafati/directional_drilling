import { describe, it, expect } from "vitest";
import type { GrdFile } from "./index.js";
import { volumeBetween } from "./volume.js";

// Use a value that's exactly representable in Float32 so === comparisons hold.
const NULL_SENTINEL = new Float32Array([1e30])[0];

function flat(value: number, ncol: number, nrow: number): GrdFile {
  const data = new Float32Array(ncol * nrow).fill(value);
  return {
    errorValue: NULL_SENTINEL, xmin: 0, xmax: ncol, ymin: 0, ymax: nrow,
    xinc: 1, yinc: 1, ncol, nrow, units: "m", data,
  };
}

describe("volumeBetween", () => {
  it("two flat horizons 100 apart over 10×10 grid → volume 10×10×100 = 10000", () => {
    const bottom = flat(1000, 10, 10);
    const top = flat(900, 10, 10);
    const r = volumeBetween(bottom, top, "sum");
    expect(r.volume).toBeCloseTo(10000, 6);
    expect(r.validCells).toBe(100);
  });

  it("Simpson method agrees with sum for flat horizons", () => {
    const bottom = flat(1000, 10, 10);
    const top = flat(900, 10, 10);
    const sumR = volumeBetween(bottom, top, "sum");
    const sR = volumeBetween(bottom, top, "simpson");
    // Simpson is on the 9×9 interior cells, so 9×9×100 = 8100
    expect(sR.volume).toBeCloseTo(8100, 6);
    expect(sumR.volume).toBeGreaterThan(sR.volume);
  });

  it("skips cells where either horizon is null", () => {
    const bottom = flat(1000, 4, 4);
    const top = flat(900, 4, 4);
    // Poke a hole in the top.
    top.data[0] = top.errorValue;
    const r = volumeBetween(bottom, top, "sum");
    expect(r.validCells).toBe(15);
    expect(r.volume).toBeCloseTo(1500, 6);
  });

  it("rejects size mismatches", () => {
    expect(() => volumeBetween(flat(0, 4, 4), flat(0, 5, 5))).toThrow();
  });
});
