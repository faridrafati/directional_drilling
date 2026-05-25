/**
 * Arbitrary-axis 3D rotation.
 * Port of `rotation` from old_delphi_code/Unit02.pas:1044.
 * Original credit: http://inside.mines.edu/~gmurray/arbitraryaxisrotation/
 *
 * Rotates point (x, y, z) by `theta` radians about the line through (a, b, c)
 * with direction (u, v, w). u/v/w need NOT be normalised — the formula handles it.
 */

import type { Vec3 } from "../types.js";

/**
 * Rotate `point` about an axis defined by an origin and a direction vector.
 *
 * @param axisOrigin a point the axis passes through (a, b, c in the Pascal code)
 * @param axisDir    direction of the axis (u, v, w); does not need to be unit-length
 * @param theta      angle in radians
 * @param point      the point being rotated (x, y, z)
 *
 * Implementation maps Pascal's (ns, ew, tvd) ⇔ (x, y, z) component-wise.
 */
export function rotateAboutAxis(
  axisOrigin: Vec3,
  axisDir: Vec3,
  theta: number,
  point: Vec3
): Vec3 {
  const a = axisOrigin.ns;
  const b = axisOrigin.ew;
  const c = axisOrigin.tvd;
  const u = axisDir.ns;
  const v = axisDir.ew;
  const w = axisDir.tvd;
  const x = point.ns;
  const y = point.ew;
  const z = point.tvd;

  const u2 = u * u;
  const v2 = v * v;
  const w2 = w * w;
  const denom = u2 + v2 + w2;
  if (denom === 0) return { ...point };
  const len = Math.sqrt(denom);
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);

  const xx =
    (a * (v2 + w2) +
      u * (-b * v - c * w + u * x + v * y + w * z) +
      ((x - a) * (v2 + w2) + u * (b * v + c * w - v * y - w * z)) * cosT +
      len * (b * w - c * v - w * y + v * z) * sinT) /
    denom;

  const yy =
    (b * (u2 + w2) +
      v * (-a * u - c * w + u * x + v * y + w * z) +
      ((y - b) * (u2 + w2) + v * (a * u + c * w - u * x - w * z)) * cosT +
      len * (c * u - a * w - u * z + w * x) * sinT) /
    denom;

  const zz =
    (c * (u2 + v2) +
      w * (-a * u - b * v + u * x + v * y + w * z) +
      ((z - c) * (u2 + v2) + w * (b * v + a * u - v * y - u * x)) * cosT +
      len * (a * v - b * u - v * x + u * y) * sinT) /
    denom;

  return { ns: xx, ew: yy, tvd: zz };
}
