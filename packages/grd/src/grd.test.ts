import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseGrd, cellAt, gridRange, gridToBytes, gridFromBytes } from "./index.js";

/**
 * The TOP_HITH_DEPTH sample is a 288,435-cell Delphi grid that lives in the
 * legacy reference tree — which is GITIGNORED, and was relocated under `old/`
 * in fddb44d. So it is present on a machine that has the legacy tree and absent
 * on a fresh clone, and a hard `readFileSync` turned that absence into four red
 * tests that no clone could ever make green.
 *
 * Both known locations are tried, and the tests that need the file SKIP when it
 * is not there. Skipping says "not run here"; failing says "the parser is
 * broken", and only one of those is true.
 */
const FIXTURE = [
  "../../old_delphi_code/NEW FIELD/TOP_HITH_DEPTH.grd",
  "../../old/old_delphi_code/NEW FIELD/TOP_HITH_DEPTH.grd",
].map((p) => resolve(p)).find((p) => existsSync(p));

/** Reads the sample, or fails loudly if a caller forgot to guard on FIXTURE. */
const sample = () => parseGrd(readFileSync(FIXTURE!, "utf-8"));

describe("parseGrd", () => {
  it.skipIf(FIXTURE)("reports the missing legacy fixture once", () => {
    // Not a failure: it records in the run WHY the four tests below are grey.
    expect(FIXTURE).toBeUndefined();
  });

  it.skipIf(!FIXTURE)("parses the bundled TOP_HITH_DEPTH sample", () => {
    const g = sample();
    expect(g.ncol).toBe(469);
    expect(g.nrow).toBe(615);
    expect(g.xmin).toBeCloseTo(2001200, 1);
    expect(g.xmax).toBeCloseTo(2024600, 1);
    expect(g.ymin).toBeCloseTo(802400, 1);
    expect(g.ymax).toBeCloseTo(833100, 1);
    expect(g.xinc).toBe(50);
    expect(g.yinc).toBe(50);
    expect(g.units).toBe("m");
    // Header's 6th token is the sentinel — this file uses 1e9 (matches the
    // 0.1000000E+10 padding values in the data block).
    expect(g.errorValue).toBeCloseTo(1e9, 0);
    expect(g.data.length).toBe(469 * 615);
  });

  it.skipIf(!FIXTURE)("computes min/max correctly", () => {
    const g = sample();
    const { min, max } = gridRange(g);
    // We don't know exact values but expect a finite range (the file has at
    // least some valid cells, given depths).
    expect(isFinite(min)).toBe(true);
    expect(isFinite(max)).toBe(true);
    expect(max).toBeGreaterThan(min);
  });

  it.skipIf(!FIXTURE)("round-trips via gridToBytes / gridFromBytes", () => {
    const g = sample();
    const bytes = gridToBytes(g);
    const restored = gridFromBytes(g, bytes);
    expect(restored.data.length).toBe(g.data.length);
    expect(restored.data[0]).toBe(g.data[0]);
    expect(restored.data[g.data.length - 1]).toBe(g.data[g.data.length - 1]);
  });

  it.skipIf(!FIXTURE)("cellAt out-of-range returns NaN", () => {
    const g = sample();
    expect(cellAt(g, -1, 0)).toBeNaN();
    expect(cellAt(g, 0, -1)).toBeNaN();
    expect(cellAt(g, g.ncol, 0)).toBeNaN();
    expect(cellAt(g, 0, g.nrow)).toBeNaN();
  });

  it("rejects malformed input", () => {
    expect(() => parseGrd("not a grd file")).toThrow();
  });
});
