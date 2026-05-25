import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseGrd, cellAt, gridRange, gridToBytes, gridFromBytes } from "./index.js";

describe("parseGrd", () => {
  it("parses the bundled TOP_HITH_DEPTH sample", () => {
    const path = resolve(
      "../../old_delphi_code/NEW FIELD/TOP_HITH_DEPTH.grd"
    );
    const text = readFileSync(path, "utf-8");
    const g = parseGrd(text);
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

  it("computes min/max correctly", () => {
    const path = resolve(
      "../../old_delphi_code/NEW FIELD/TOP_HITH_DEPTH.grd"
    );
    const g = parseGrd(readFileSync(path, "utf-8"));
    const { min, max } = gridRange(g);
    // We don't know exact values but expect a finite range (the file has at
    // least some valid cells, given depths).
    expect(isFinite(min)).toBe(true);
    expect(isFinite(max)).toBe(true);
    expect(max).toBeGreaterThan(min);
  });

  it("round-trips via gridToBytes / gridFromBytes", () => {
    const path = resolve(
      "../../old_delphi_code/NEW FIELD/TOP_HITH_DEPTH.grd"
    );
    const g = parseGrd(readFileSync(path, "utf-8"));
    const bytes = gridToBytes(g);
    const restored = gridFromBytes(g, bytes);
    expect(restored.data.length).toBe(g.data.length);
    expect(restored.data[0]).toBe(g.data[0]);
    expect(restored.data[g.data.length - 1]).toBe(g.data[g.data.length - 1]);
  });

  it("cellAt out-of-range returns NaN", () => {
    const path = resolve(
      "../../old_delphi_code/NEW FIELD/TOP_HITH_DEPTH.grd"
    );
    const g = parseGrd(readFileSync(path, "utf-8"));
    expect(cellAt(g, -1, 0)).toBeNaN();
    expect(cellAt(g, 0, -1)).toBeNaN();
    expect(cellAt(g, g.ncol, 0)).toBeNaN();
    expect(cellAt(g, 0, g.nrow)).toBeNaN();
  });

  it("rejects malformed input", () => {
    expect(() => parseGrd("not a grd file")).toThrow();
  });
});
