/**
 * Sample a grid along an arbitrary line.
 *
 * Replaces the line-walking part of old_delphi_code/Unit21.pas:cross.
 * Given two world-coordinate points, returns N samples evenly spaced along
 * the line, each carrying its distance from A and the interpolated grid value
 * (or null when it falls on a null-data cell or outside the grid).
 *
 * Bilinear interpolation between the 4 enclosing cells gives a smoother
 * cross-section than the Pascal nearest-cell pick.
 */

import { type GrdFile } from "./index.js";

export interface LineSample {
  /** Distance along the line from A in world units. */
  s: number;
  /** Interpolated grid value, or null. */
  value: number | null;
  /** World x at this sample. */
  x: number;
  /** World y at this sample. */
  y: number;
}

export function sampleLine(
  grid: GrdFile,
  a: { x: number; y: number },
  b: { x: number; y: number },
  steps = 200
): LineSample[] {
  const out: LineSample[] = new Array(steps + 1);
  const totalLen = Math.hypot(b.x - a.x, b.y - a.y);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = a.x + (b.x - a.x) * t;
    const y = a.y + (b.y - a.y) * t;
    out[i] = { s: t * totalLen, value: bilinear(grid, x, y), x, y };
  }
  return out;
}

/**
 * Bilinear interpolation. Returns null if any of the 4 corners is null-data
 * or the point is outside the grid.
 */
function bilinear(g: GrdFile, x: number, y: number): number | null {
  // Convert world → fractional column/row.
  const cf = ((x - g.xmin) / (g.xmax - g.xmin)) * (g.ncol - 1);
  const rf = ((g.ymax - y) / (g.ymax - g.ymin)) * (g.nrow - 1);
  if (cf < 0 || cf > g.ncol - 1 || rf < 0 || rf > g.nrow - 1) return null;
  const c0 = Math.floor(cf);
  const c1 = Math.min(g.ncol - 1, c0 + 1);
  const r0 = Math.floor(rf);
  const r1 = Math.min(g.nrow - 1, r0 + 1);
  const fc = cf - c0;
  const fr = rf - r0;
  const v00 = at(g, c0, r0);
  const v10 = at(g, c1, r0);
  const v01 = at(g, c0, r1);
  const v11 = at(g, c1, r1);
  if (v00 === null || v10 === null || v01 === null || v11 === null) return null;
  return (
    v00 * (1 - fc) * (1 - fr) +
    v10 * fc * (1 - fr) +
    v01 * (1 - fc) * fr +
    v11 * fc * fr
  );
}

function at(g: GrdFile, c: number, r: number): number | null {
  const v = g.data[c * g.nrow + r];
  return v === g.errorValue ? null : v;
}
