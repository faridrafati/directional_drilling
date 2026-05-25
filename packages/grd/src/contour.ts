/**
 * Marching-squares contour extraction.
 *
 * Modern equivalent of `Form28.contour`/`contourdraw` (which walked pixel
 * neighbours to find colour-band boundaries). Returns a list of line
 * segments per iso level, ready to draw on a 2D canvas.
 */

import { type GrdFile } from "./index.js";

export interface Segment {
  x1: number; y1: number;  // grid-cell coordinates (col, row)
  x2: number; y2: number;
}

export interface IsoLine {
  level: number;
  segments: Segment[];
}

/**
 * Extract contour line segments at the given iso levels.
 * Returned coordinates are in grid-cell units; the caller scales to pixels.
 */
export function extractContours(grid: GrdFile, levels: number[]): IsoLine[] {
  const out: IsoLine[] = [];
  const { ncol, nrow } = grid;

  for (const level of levels) {
    const segs: Segment[] = [];
    for (let c = 0; c < ncol - 1; c++) {
      for (let r = 0; r < nrow - 1; r++) {
        // Corner values, in marching-squares standard order (TL, TR, BR, BL).
        const tl = val(grid, c,     r);
        const tr = val(grid, c + 1, r);
        const br = val(grid, c + 1, r + 1);
        const bl = val(grid, c,     r + 1);
        if (tl === null || tr === null || br === null || bl === null) continue;
        addCellSegments(segs, c, r, level, tl, tr, br, bl);
      }
    }
    out.push({ level, segments: segs });
  }
  return out;
}

/** Suggest N evenly-spaced iso levels from min..max, rounded to a nice step. */
export function suggestLevels(min: number, max: number, count: number): number[] {
  if (count <= 1) return [(min + max) / 2];
  const step = (max - min) / (count - 1);
  return Array.from({ length: count }, (_, i) => min + i * step);
}

function val(g: GrdFile, c: number, r: number): number | null {
  const v = g.data[c * g.nrow + r];
  return v === g.errorValue ? null : v;
}

/**
 * Classic marching-squares lookup. Compute a 4-bit corner-above-level mask,
 * then emit 0-2 segments for each cell.
 */
function addCellSegments(
  out: Segment[],
  c: number, r: number,
  level: number,
  tl: number, tr: number, br: number, bl: number
) {
  let mask = 0;
  if (tl >= level) mask |= 8;
  if (tr >= level) mask |= 4;
  if (br >= level) mask |= 2;
  if (bl >= level) mask |= 1;
  if (mask === 0 || mask === 15) return;

  // Edge crossings (interpolated). Edges:
  //   T: top    (tl→tr)  varies in x
  //   R: right  (tr→br)  varies in y
  //   B: bottom (br→bl)  varies in x
  //   L: left   (bl→tl)  varies in y
  const T = (): [number, number] => [c + lerp(tl, tr, level), r];
  const R = (): [number, number] => [c + 1, r + lerp(tr, br, level)];
  const B = (): [number, number] => [c + lerp(bl, br, level), r + 1];
  const L = (): [number, number] => [c, r + lerp(tl, bl, level)];

  const push = (a: [number, number], b: [number, number]) =>
    out.push({ x1: a[0], y1: a[1], x2: b[0], y2: b[1] });

  switch (mask) {
    case 1:  case 14: push(L(), B()); break;
    case 2:  case 13: push(B(), R()); break;
    case 3:  case 12: push(L(), R()); break;
    case 4:  case 11: push(T(), R()); break;
    case 5:           push(L(), T()); push(B(), R()); break; // saddle
    case 6:  case 9:  push(T(), B()); break;
    case 7:  case 8:  push(L(), T()); break;
    case 10:          push(L(), B()); push(T(), R()); break; // saddle
  }
}

function lerp(a: number, b: number, level: number): number {
  if (a === b) return 0.5;
  return (level - a) / (b - a);
}
