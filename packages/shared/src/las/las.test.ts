import { describe, it, expect } from "vitest";
import { parseLas } from "./parser.js";
import {
  buildTensor, buildModel, computeStats, defaultParams, pointForValue, colorForPoint,
} from "./compute.js";
import { mergeLasFiles, mergeAndParse } from "./merge.js";

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

/**
 * A tiny synthetic FMI-style LAS: depth + a few aux curves + a reduced button
 * set (4 pads A–D × 2 rows × 2 buttons → buttonsPerPad = (2-1)*12+1 .. folds to
 * 24 capacity but only buttons 0,1,12,13 are present). Buttons are written in
 * the legacy file order — pads D,C,B,A and rows 4..1 — and interleaved AFTER
 * the aux block, to prove the explicit padCol lookup survives both.
 */
const FMI_SAMPLE = `~VERSION INFORMATION
VERS.   2.0 : CWLS LAS 2.0
WRAP.   NO  : One line per depth step
~WELL INFORMATION
STRT.F   500.0   : START DEPTH
STOP.F   498.0   : STOP DEPTH
STEP.F   -1.0    : STEP
NULL.    -999.25 : NULL VALUE
~CURVE INFORMATION
TDEP.1in      : BOREHOLE-DEPTH
GR.gAPI       : Gamma Ray
P1AZ.deg      : Pad 1 Azimuth
FCAX.m/s2     : X Acceleration
FCD2[0].      : Pad D Row 2 b0
FCD2[1].      : Pad D Row 2 b1
FCD1[0].      : Pad D Row 1 b0
FCD1[1].      : Pad D Row 1 b1
FCC2[0].      : Pad C Row 2 b0
FCC2[1].      : Pad C Row 2 b1
FCC1[0].      : Pad C Row 1 b0
FCC1[1].      : Pad C Row 1 b1
FCB2[0].      : Pad B Row 2 b0
FCB2[1].      : Pad B Row 2 b1
FCB1[0].      : Pad B Row 1 b0
FCB1[1].      : Pad B Row 1 b1
FCA2[0].      : Pad A Row 2 b0
FCA2[1].      : Pad A Row 2 b1
FCA1[0].      : Pad A Row 1 b0
FCA1[1].      : Pad A Row 1 b1
~ASCII
500.0 50 90 1.5   140 141 128 129   240 241 228 229   340 341 328 329   440 441 428 429
499.0 51 91 1.6   142 143 130 131   242 243 230 231   342 343 330 331   442 443 430 431
498.0 52 92 1.7   144 145 132 133   244 245 232 233   344 345 332 333   444 445 432 433
`;

describe("FMI LAS parsing", () => {
  const las = parseLas(FMI_SAMPLE, "fmi.las");

  it("detects 4 pads and folds rows into the button axis", () => {
    expect(las.padCount).toBe(4);
    // highest button present = FC*2[1] = (2-1)*12 + 1 = 13 → buttonsPerPad 14
    expect(las.buttonsPerPad).toBe(14);
    // pad letters A→1 … D→4
    const byMnem = (m: string) => las.curves.find((c) => c.mnemonic === m)!;
    expect(byMnem("FCA1[0]")).toMatchObject({ pad: 1, button: 0 });
    expect(byMnem("FCB1[0]")).toMatchObject({ pad: 2, button: 0 });
    expect(byMnem("FCC2[1]")).toMatchObject({ pad: 3, button: 13 }); // row2 → (2-1)*12+1
    expect(byMnem("FCD2[0]")).toMatchObject({ pad: 4, button: 12 });
  });

  it("padCol resolves each (pad,button) to its real data column despite file order", () => {
    const col = (pad: number, button: number) =>
      las.padCol[(pad - 1) * las.buttonsPerPad + button];
    // Column layout: 0=TDEP,1=GR,2=P1AZ,3=FCAX, then the 16 buttons in file order:
    // 4=FCD2[0],5=FCD2[1],6=FCD1[0],7=FCD1[1], 8=FCC2[0]…
    expect(col(4, 12)).toBe(4);  // FCD2[0]
    expect(col(4, 0)).toBe(6);   // FCD1[0]
    expect(col(1, 0)).toBe(18);  // FCA1[0] is the 15th button col → index 4+14
    // absent channel → -1
    expect(col(1, 5)).toBe(-1);
  });

  it("auxCols maps the non-pad curves (and not the buttons)", () => {
    expect(las.auxCols.TDEP).toBe(0);
    expect(las.auxCols.GR).toBe(1);
    expect(las.auxCols.P1AZ).toBe(2);
    expect(las.auxCols.FCAX).toBe(3);
    expect(las.auxCols["FCA1[0]"]).toBeUndefined(); // buttons are not aux
  });

  it("buildTensor lands button values at the right mat[] index via padCol", () => {
    const params = { ...defaultParams(las), rowsPerPixel: 1 };
    const { mat, depthCount } = buildTensor(las, params);
    expect(depthCount).toBe(3);
    const at = (r: number, b: number, pad: number) =>
      mat[(r * las.buttonsPerPad + b) * las.padCount + (pad - 1)];
    // row0: FCD2[0]=140 → pad4 button12 ; FCA1[1]=429 → pad1 button1
    expect(at(0, 12, 4)).toBe(140);
    expect(at(0, 1, 1)).toBe(429);
    // row2 ASCII: …244 245 232 233 (FCC2[0],FCC2[1],FCC1[0],FCC1[1])…
    // FCC1[0]=232 → pad3 (C) button0
    expect(at(2, 0, 3)).toBe(232);
    // an absent channel stays null
    expect(at(0, 5, 1)).toBe(params.nullValue);
  });

  it("per-pad stats ignore the absent/null channels", () => {
    const params = { ...defaultParams(las), rowsPerPixel: 1, colorSections: 4 };
    const pads = computeStats(buildTensor(las, params), las, params);
    // pad1 (A) values: 440,441,428,429 / 442,443,430,431 / 444,445,432,433
    expect(pads[1].min).toBe(428);
    expect(pads[1].max).toBe(445);
  });
});

describe("FMI aux traces (model.aux)", () => {
  const las = parseLas(FMI_SAMPLE, "fmi.las");
  const params = { ...defaultParams(las), rowsPerPixel: 1 };
  const model = buildModel(las, params);

  it("extracts named aux traces window-averaged per output row", () => {
    expect(model.aux).toBeDefined();
    // GR column row values are 50,51,52 across the 3 rows (rowsPerPixel=1).
    expect(model.aux!.GR[0]).toBe(50);
    expect(model.aux!.GR[2]).toBe(52);
    // P1AZ values are 90,91,92.
    expect(model.aux!.P1AZ[0]).toBe(90);
    // FCAX values 1.5,1.6,1.7.
    expect(model.aux!.FCAX[1]).toBeCloseTo(1.6);
  });

  it("synthesizes CONDSUM = mean of present buttons / 5", () => {
    // row0 buttons (all 16 present): 140,141,128,129,240,241,228,229,
    // 340,341,328,329,440,441,428,429. mean = sum/16, then /5.
    const vals = [140,141,128,129,240,241,228,229,340,341,328,329,440,441,428,429];
    const expected = vals.reduce((a, b) => a + b, 0) / vals.length / 5;
    expect(model.aux!.CONDSUM[0]).toBeCloseTo(expected);
  });

  it("plain PADn[m] logs have no overlay aux but still get CONDSUM", () => {
    const eiv = parseLas(SAMPLE);
    const m = buildModel(eiv, { ...defaultParams(eiv), rowsPerPixel: 1 });
    // No FCAX/GR/P1AZ curves → none of those keys.
    expect(m.aux?.GR).toBeUndefined();
    expect(m.aux?.P1AZ).toBeUndefined();
    // But it has buttons, so CONDSUM is still produced.
    expect(m.aux?.CONDSUM).toBeDefined();
  });
});

describe("FMI two-file merge", () => {
  // Hi-res: TDEP + one button per pad, fine step (0.5). Depths decrease.
  const HI_RES = `~VERSION INFORMATION
VERS. 2.0 : CWLS LAS 2.0
WRAP. NO  : one line per depth
~WELL INFORMATION
STRT.1in 100.0 : START DEPTH
STOP.1in  98.0 : STOP DEPTH
STEP.1in  -0.5 : STEP
NULL.    -999.25 : NULL
~CURVE INFORMATION
TDEP.1in   : depth
FCA1[0].   : pad A
FCB1[0].   : pad B
FCC1[0].   : pad C
FCD1[0].   : pad D
~A
100.0  11 21 31 41
99.5   12 22 32 42
99.0   13 23 33 43
98.5   14 24 34 44
98.0   15 25 35 45
`;
  // Lo-res: TDEP + GR + P1AZ, coarse step (1.0).
  const LO_RES = `~VERSION INFORMATION
VERS. 2.0 : CWLS LAS 2.0
WRAP. NO  : one line per depth
~WELL INFORMATION
STRT.1in 100.0 : START DEPTH
STOP.1in  98.0 : STOP DEPTH
STEP.1in  -1.0 : STEP
NULL.    -999.25 : NULL
~CURVE INFORMATION
TDEP.1in   : depth
GR.gAPI    : gamma
P1AZ.deg   : azimuth
~A
100.0  60 10
99.0   61 20
98.0   62 30
`;

  it("produces a re-parseable merged LAS with 4 pads and aux curves", () => {
    const merged = mergeAndParse(HI_RES, LO_RES, "merged.las");
    expect(merged.padCount).toBe(4);
    // each pad has its single button at folded index 0
    expect(merged.padCol[(1 - 1) * merged.buttonsPerPad + 0]).toBeGreaterThanOrEqual(0);
    expect(merged.auxCols.GR).toBeGreaterThanOrEqual(0);
    expect(merged.auxCols.P1AZ).toBeGreaterThanOrEqual(0);
    expect(merged.auxCols.TDEP).toBe(0);
  });

  it("emits 208 data columns per row (211 slots minus reserved 17/18/19)", () => {
    const text = mergeLasFiles(HI_RES, LO_RES);
    const dataLines = text.split("\n").slice(text.split("\n").indexOf("~A") + 1).filter((l) => l.trim());
    expect(dataLines.length).toBeGreaterThan(0);
    for (const l of dataLines) {
      expect(l.trim().split(/\s+/).length).toBe(208);
    }
  });

  it("preserves hi-res depths and carries lo-res aux forward", () => {
    const merged = mergeAndParse(HI_RES, LO_RES);
    const grCol = merged.auxCols.GR;
    const depthCol = 0;
    // Hi-res depths (100..98 @0.5) should all appear.
    const depths = merged.data.map((r) => r[depthCol]);
    expect(depths).toContain(100);
    expect(depths).toContain(99.5);
    expect(depths).toContain(98.5);
    // GR is held constant within each lo-res 1.0 interval: the rows at depth
    // 100.0 and 99.5 both carry the lo-res GR from the 100.0 mark (=60).
    const row100 = merged.data.find((r) => r[depthCol] === 100)!;
    expect(row100[grCol]).toBe(60);
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
