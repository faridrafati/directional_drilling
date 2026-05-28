import { describe, it, expect } from "vitest";
import { parseLas } from "./parser.js";
import {
  buildTensor, computeStats, defaultParams, pointForValue, colorForPoint,
} from "./compute.js";

/** A tiny synthetic LAS: 1 depth col + 2 pads × 3 buttons, 4 depth rows. */
const SAMPLE = `~VERSION INFORMATION
VERS.   2.0 : CWLS LAS 2.0
WRAP.   NO  : One line per depth step
~WELL INFORMATION
STRT.F   100.0   : START DEPTH
STOP.F   97.0    : STOP DEPTH
STEP.F   -1.0    : STEP
NULL.    -999.25 : NULL VALUE
~CURVE INFORMATION
DEPT.F        : DEPTH
PAD1[0].      : {AF13.4}
PAD1[1].      : {AF13.4}
PAD1[2].      : {AF13.4}
PAD2[0].      : {AF13.4}
PAD2[1].      : {AF13.4}
PAD2[2].      : {AF13.4}
~ASCII
100.0  10 11 12   20 21 22
99.0   13 14 15   23 24 25
98.0   16 17 18   26 27 28
97.0   19 -999.25 21   29 30 31
`;

describe("LAS parser", () => {
  const las = parseLas(SAMPLE, "sample.las");

  it("reads ~WELL STRT/STOP/STEP/NULL", () => {
    expect(las.well.strt).toBeCloseTo(100.0);
    expect(las.well.stop).toBeCloseTo(97.0);
    expect(las.well.step).toBeCloseTo(-1.0);
    expect(las.well.nullValue).toBeCloseTo(-999.25);
  });

  it("detects pad geometry from PADn[m] curves", () => {
    expect(las.padCount).toBe(2);
    expect(las.buttonsPerPad).toBe(3);
    expect(las.firstPadCol).toBe(1);  // col 0 is DEPT
    expect(las.lastPadCol).toBe(6);
    expect(las.curves[0].mnemonic).toBe("DEPT");
    expect(las.curves[1]).toMatchObject({ pad: 1, button: 0 });
    expect(las.curves[6]).toMatchObject({ pad: 2, button: 2 });
  });

  it("reads the ~ASCII matrix", () => {
    expect(las.data).toHaveLength(4);
    expect(las.data[0]).toEqual([100.0, 10, 11, 12, 20, 21, 22]);
    expect(Number.isNaN(las.data[3][2])).toBe(false); // -999.25 parses fine
  });
});

describe("EIV tensor + stats", () => {
  const las = parseLas(SAMPLE, "sample.las");
  const params = { ...defaultParams(las), rowsPerPixel: 1, colorSections: 4 };

  it("builds mat with row=depth, button, pad in file order", () => {
    const { mat, depths, depthCount } = buildTensor(las, params);
    expect(depthCount).toBe(4);
    expect(depths[0]).toBeCloseTo(100.0);
    // row0 pad1 button0 = 10 ; pad2 button2 = 22
    const idx = (r: number, b: number, pad: number) =>
      (r * las.buttonsPerPad + b) * las.padCount + (pad - 1);
    expect(mat[idx(0, 0, 1)]).toBe(10);
    expect(mat[idx(0, 2, 2)]).toBe(22);
    expect(mat[idx(2, 1, 1)]).toBe(17);
  });

  it("null-aware averaging drops -999.25", () => {
    // row3 pad1 button1 is NULL → stays nullValue (no contamination)
    const { mat } = buildTensor(las, params);
    const idx = (r: number, b: number, pad: number) =>
      (r * las.buttonsPerPad + b) * las.padCount + (pad - 1);
    expect(mat[idx(3, 1, 1)]).toBe(params.nullValue);
  });

  it("computes per-pad min/max ignoring nulls", () => {
    const tensor = buildTensor(las, params);
    const pads = computeStats(tensor, las, params);
    // pad1 readings: 10..19, then row3 = [19, null, 21] → min 10, max 21
    expect(pads[1].min).toBe(10);
    expect(pads[1].max).toBe(21);
    // pad2 values 20..31 → min 20, max 31
    expect(pads[2].min).toBe(20);
    expect(pads[2].max).toBe(31);
  });

  it("leveled bands are monotonic high→low", () => {
    const tensor = buildTensor(las, params);
    const pads = computeStats(tensor, las, params);
    const lv = pads[1].levels;
    for (let i = 0; i + 1 < lv.length; i++) {
      expect(lv[i]).toBeGreaterThanOrEqual(lv[i + 1] - 1e-9);
    }
  });
});

describe("colormap", () => {
  it("maps point bands to the white→yellow→red→black ramp", () => {
    expect(colorForPoint(-1)).toEqual([0, 0, 255]);     // NULL → blue
    expect(colorForPoint(1)).toEqual([255, 255, 255]);  // low → white
    expect(colorForPoint(256)).toEqual([255, 255, 0]);  // yellow
    expect(colorForPoint(512)).toEqual([255, 0, 0]);    // red
    expect(colorForPoint(768)).toEqual([0, 0, 0]);      // high → black
  });

  it("raw point scales min→max across 0..768", () => {
    const las = parseLas(SAMPLE);
    const params = { ...defaultParams(las), rowsPerPixel: 1 };
    const pads = computeStats(buildTensor(las, params), las, params);
    const lo = pointForValue(pads[1].min, "raw", pads[1], params.nullValue);
    const hi = pointForValue(pads[1].max, "raw", pads[1], params.nullValue);
    expect(lo).toBeLessThan(hi);
    expect(hi).toBe(768);
    expect(pointForValue(params.nullValue, "raw", pads[1], params.nullValue)).toBe(-1);
  });
});
