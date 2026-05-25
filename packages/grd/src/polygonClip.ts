/**
 * Polygon clipping — mask grid cells outside a user-drawn polygon.
 * Port of `Form21.Button3Click` in old_delphi_code/Unit21.pas:1280-1361.
 *
 * The Pascal app lets the user lasso a polygon on the 2D map and then sets
 * `draw[ii,jj] := false` for every cell whose center is outside the polygon.
 * Our equivalent: produce a new GrdFile where outside-cells are flagged with
 * the same `errorValue` the parser uses for null cells — so downstream code
 * (color ramp, contours, sampler) already skips them.
 *
 * The polygon is given in WORLD coordinates (same axes as the grid's
 * xmin/xmax + ymin/ymax bounds, NOT cell indices). We rasterize via a
 * standard "ray-cast counts crossings" test — `O(N · P)` where N = cells,
 * P = polygon vertices.
 */

import type { GrdFile } from "./index.js";

export interface Vertex2D {
  x: number;
  y: number;
}

/** Returns true if `(x, y)` is inside the polygon (ray-cast / even-odd rule). */
export function pointInPolygon(x: number, y: number, poly: Vertex2D[]): boolean {
  if (poly.length < 3) return false;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    const intersect =
      (yi > y) !== (yj > y) &&
      x < ((xj - xi) * (y - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Return a new GrdFile with cells outside `polygon` replaced by `errorValue`.
 * `polygon` is a list of {x, y} vertices in world coords (same units as xmin
 * etc.). The polygon is treated as closed (first and last vertices auto-
 * connect).
 *
 * Existing error-cells are preserved unchanged.
 */
export function clipPolygon(grid: GrdFile, polygon: Vertex2D[]): GrdFile {
  if (polygon.length < 3) {
    return grid; // not enough vertices for a polygon
  }
  const out = new Float32Array(grid.data.length);
  for (let i = 0; i < grid.ncol; i++) {
    const x = grid.xmin + i * grid.xinc;
    for (let j = 0; j < grid.nrow; j++) {
      const y = grid.ymin + j * grid.yinc;
      const k = i * grid.nrow + j;
      const v = grid.data[k];
      // Preserve existing error cells; mask outside-polygon cells.
      if (v === grid.errorValue) {
        out[k] = grid.errorValue;
      } else if (pointInPolygon(x, y, polygon)) {
        out[k] = v;
      } else {
        out[k] = grid.errorValue;
      }
    }
  }
  return { ...grid, data: out };
}
