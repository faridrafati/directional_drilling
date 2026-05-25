import { describe, it, expect } from "vitest";
import type { GrdFile } from "./index.js";
import { sampleLine } from "./sample.js";

const NULL = new Float32Array([1e30])[0];

// World extent matches cell centres so world x=k → col index k exactly.
function makeGrid(values: (c: number, r: number) => number): GrdFile {
  const ncol = 10, nrow = 10;
  const data = new Float32Array(ncol * nrow);
  for (let c = 0; c < ncol; c++) {
    for (let r = 0; r < nrow; r++) {
      data[c * nrow + r] = values(c, r);
    }
  }
  return {
    errorValue: NULL, xmin: 0, xmax: ncol - 1, ymin: 0, ymax: nrow - 1,
    xinc: 1, yinc: 1, ncol, nrow, units: "m", data,
  };
}

describe("sampleLine", () => {
  it("constant grid → all samples equal", () => {
    const g = makeGrid(() => 42);
    // Grid now spans 0..9 (ncol-1).
    const samples = sampleLine(g, { x: 0, y: 0 }, { x: 9, y: 9 }, 10);
    for (const s of samples) expect(s.value).toBeCloseTo(42, 5);
  });

  it("samples have correct distances", () => {
    const g = makeGrid(() => 0);
    const samples = sampleLine(g, { x: 0, y: 0 }, { x: 3, y: 4 }, 5);
    expect(samples).toHaveLength(6);
    expect(samples[0].s).toBe(0);
    expect(samples[samples.length - 1].s).toBeCloseTo(5, 6); // 3-4-5 triangle
  });

  it("points outside the grid return null", () => {
    const g = makeGrid(() => 100);
    // Grid spans x=0..9; sample from x=-5 to x=15 → endpoints outside.
    const samples = sampleLine(g, { x: -5, y: 4 }, { x: 15, y: 4 }, 4);
    expect(samples[0].value).toBeNull();
    expect(samples[samples.length - 1].value).toBeNull();
    expect(samples[2].value).toBeCloseTo(100, 5);
  });

  it("interpolates linearly along a gradient", () => {
    // value = column index; world extent aligned with cell centres.
    const g = makeGrid((c) => c);
    const samples = sampleLine(g, { x: 0, y: 4 }, { x: 9, y: 4 }, 9);
    expect(samples[0].value).toBeCloseTo(0, 4);
    expect(samples[9].value).toBeCloseTo(9, 4);
    expect(samples[5].value).toBeCloseTo(5, 4);
  });
});
