/**
 * Plane projection helpers.
 * Ports of `plane` / `revplane` from old_delphi_code/Unit02.pas:982 / :1022.
 *
 * Many trajectory builders solve a 2D problem in the vertical plane defined by
 * an origin point a1 and two direction vectors a2, a3. `plane()` rotates a
 * candidate point a4 INTO that plane (computing `theta` if not provided), and
 * `revplane()` undoes it.
 *
 * The math follows the Pascal verbatim. Both routines mutate `a4` in place in
 * the original; here we return a new vector for clarity.
 */

import type { Vec3 } from "../types.js";
import { rotateAboutAxis } from "./rotation.js";
import { sign } from "./vector.js";

export interface PlaneProjectResult {
  projected: Vec3;
  theta: number;
}

/**
 * Project `a4` into the plane through a1 spanned by (a2, a3).
 *
 * Pascal contract:
 *  - `theta` is in/out: if caller passes -999, compute it; otherwise reuse it.
 *  - Returns the rotated a4 (and the theta used).
 */
export function projectToPlane(
  a1: Vec3,
  a2: Vec3,
  a3: Vec3,
  a4: Vec3,
  thetaIn = -999
): PlaneProjectResult {
  let theta = thetaIn;
  if (a4.ns === 0) return { projected: { ...a4 }, theta };

  // Plane normal (un-normalised), Pascal: a = a2.ew*a3.tvd - a3.ew*a2.tvd; etc.
  let a = a2.ew * a3.tvd - a3.ew * a2.tvd;
  let b = -(a2.ns * a3.tvd - a3.ns * a2.tvd);
  let c = a2.ns * a3.ew - a3.ns * a2.ew;
  let d = Math.sqrt(a * a + b * b + c * c);
  if (d === 0) return { projected: { ...a4 }, theta };
  a /= d; b /= d; c /= d;
  d = a * a1.ns + b * a1.ew + c * a1.tvd;

  const denomBC = b * b + c * c;
  const tp = (d - b) / denomBC;
  const t = (a * a4.ns) / denomBC;
  if (theta === -999) {
    theta = sign(a4.ns) * Math.acos(Math.max(-1, Math.min(1, sign(tp * t) * Math.abs(a))));
  }

  if (Math.abs(b) > 1e-7 || Math.abs(c) > 1e-7) {
    if (b < 0) { b = -b; c = -c; d = -d; }
    let projected: Vec3;
    if (c !== 0) {
      projected = rotateAboutAxis(
        { ns: 0, ew: -c, tvd: b },
        { ns: 0, ew: 0, tvd: d / c },
        theta,
        a4
      );
    } else {
      projected = rotateAboutAxis(
        { ns: 0, ew: -c, tvd: b },
        { ns: 0, ew: d / b, tvd: 0 },
        theta,
        a4
      );
    }
    return { projected, theta };
  }
  return { projected: { ...a4 }, theta };
}

/**
 * Inverse of projectToPlane: given the same a1/a2/a3 and the previously
 * computed `theta`, rotate a4 back out of the plane.
 */
export function unprojectFromPlane(
  a1: Vec3,
  a2: Vec3,
  a3: Vec3,
  theta: number,
  a4: Vec3
): Vec3 {
  let a = a3.ew * a2.tvd - a2.ew * a3.tvd;
  let b = -(a3.ns * a2.tvd - a2.ns * a3.tvd);
  let c = a3.ns * a2.ew - a2.ns * a3.ew;
  if (b === 0 && c === 0) return { ...a4 };

  if (b < 0) { a = -a; b = -b; c = -c; }
  if (Math.abs(b) <= 1e-7 && Math.abs(c) <= 1e-7) return { ...a4 };

  if (c !== 0) {
    return rotateAboutAxis(
      { ns: 0, ew: -c, tvd: b },
      { ns: 0, ew: 0, tvd: (a * a1.ns + b * a1.ew + c * a1.tvd) / c },
      -theta,
      a4
    );
  }
  return rotateAboutAxis(
    { ns: 0, ew: 0, tvd: b },
    { ns: 0, ew: (a * a1.ns + b * a1.ew) / b, tvd: 0 },
    -theta,
    a4
  );
}
