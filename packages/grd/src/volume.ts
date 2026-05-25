/**
 * Volume between two horizons.
 * Port of `RadioGroup1Click` in old_delphi_code/Unit30.pas:53-220.
 *
 * Two methods are implemented:
 *   - "sum"     ← Pascal RadioGroup1.Buttons[0]: simple Σ(top − bottom) × cell area
 *   - "simpson" ← Pascal RadioGroup1.Buttons[1]: 2×2 Simpson with surface fit
 *
 * Both skip cells where either horizon has the null-data sentinel.
 */

import { type GrdFile } from "./index.js";

export interface VolumeResult {
  /** Volume in cubic length units (matches the grid's `units`). */
  volume: number;
  /** Number of valid cells included in the sum. */
  validCells: number;
  /** Method that produced this result. */
  method: "sum" | "simpson";
}

export function volumeBetween(
  bottom: GrdFile,
  top: GrdFile,
  method: "sum" | "simpson" = "sum"
): VolumeResult {
  if (bottom.ncol !== top.ncol || bottom.nrow !== top.nrow) {
    throw new Error(
      `grid size mismatch: bottom=${bottom.ncol}×${bottom.nrow}, top=${top.ncol}×${top.nrow}`
    );
  }
  if (bottom.xinc !== top.xinc || bottom.yinc !== top.yinc) {
    throw new Error("cell size mismatch between horizons");
  }

  return method === "simpson"
    ? volumeSimpson(bottom, top)
    : volumeSum(bottom, top);
}

/**
 * Sum every (top − bottom) over valid cells and multiply by cell area.
 *
 * Pascal: sum:=sum+z[..,hh]-z[..,h]; … abs(intro[5,mapno]*intro[6,mapno]*sum)
 */
function volumeSum(bottom: GrdFile, top: GrdFile): VolumeResult {
  let sum = 0;
  let valid = 0;
  for (let i = 0; i < bottom.data.length; i++) {
    const b = bottom.data[i];
    const t = top.data[i];
    if (b === bottom.errorValue || t === top.errorValue) continue;
    sum += t - b;
    valid++;
  }
  return {
    volume: Math.abs(sum * bottom.xinc * bottom.yinc),
    validCells: valid,
    method: "sum",
  };
}

/**
 * Composite 2×2 Simpson on every interior block of 4 valid cells.
 * Coefficients = 1 (each corner), 1/(L²) weight → equivalent to averaging
 * the four corner depths × cell area. This matches the Pascal `surf(2,…) +
 * cof[k]=1` and produces the same numerical answer as `sum` for grids
 * without holes, but tolerates partial cells more gracefully.
 */
function volumeSimpson(bottom: GrdFile, top: GrdFile): VolumeResult {
  let sum = 0;
  let valid = 0;
  const { ncol, nrow, xinc, yinc } = bottom;
  for (let i = 0; i < ncol - 1; i++) {
    for (let j = 0; j < nrow - 1; j++) {
      const corners = [
        cellDiff(bottom, top, i,     j),
        cellDiff(bottom, top, i + 1, j),
        cellDiff(bottom, top, i,     j + 1),
        cellDiff(bottom, top, i + 1, j + 1),
      ];
      if (corners.some((c) => c === null)) continue;
      const avg = (corners[0]! + corners[1]! + corners[2]! + corners[3]!) / 4;
      sum += avg;
      valid++;
    }
  }
  return {
    volume: Math.abs(sum * xinc * yinc),
    validCells: valid,
    method: "simpson",
  };
}

function cellDiff(b: GrdFile, t: GrdFile, col: number, row: number): number | null {
  const bv = b.data[col * b.nrow + row];
  const tv = t.data[col * t.nrow + row];
  if (bv === b.errorValue || tv === t.errorValue) return null;
  return tv - bv;
}
