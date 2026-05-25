/**
 * Survey-vector primitives.
 * Ports of `surtovct` and `vcttosur` from old_delphi_code/Unit02.pas:593,630.
 */

import type { Vec3, SurveyAngles } from "../types.js";

const TWO_PI = 2 * Math.PI;
const EPS = 1e-8;

/** Sign function matching Pascal's `sign(x)`: -1, 0, or +1. */
function sign(x: number): number {
  return x > 0 ? 1 : x < 0 ? -1 : 0;
}

/**
 * Convert inclination/azimuth to a unit vector (ns, ew, tvd).
 * Pascal source: Unit02.pas:593 surtovct.
 *
 *   tvd = cos(inc)
 *   ns  = sign(sin(inc)) * cos(azm) * sqrt(1 - tvd^2)
 *   ew  = sign(sin(inc)) * sin(azm) * sqrt(1 - tvd^2)
 */
export function surToVct(angles: SurveyAngles): Vec3 {
  const { inc, azm } = angles;
  const tvd = Math.cos(inc);
  const s = sign(Math.sin(inc));
  const h = Math.sqrt(Math.max(0, 1 - tvd * tvd));
  return {
    ns: s * Math.cos(azm) * h,
    ew: s * Math.sin(azm) * h,
    tvd,
  };
}

/**
 * Convert a vector (ns, ew, tvd) back to inclination/azimuth.
 * Pascal source: Unit02.pas:630 vcttosur.
 *
 * - Normalises the vector first.
 * - Quadrant-resolves azimuth into [0, 2π).
 * - Snaps ns to 0 when very small to keep `cos(azm)≈0` cases stable.
 * - When |inc| is very small, azimuth is undefined → returns 0.
 */
export function vctToSur(v: Vec3): SurveyAngles {
  const l = Math.sqrt(v.ns * v.ns + v.ew * v.ew + v.tvd * v.tvd);
  if (l === 0) return { inc: 0, azm: 0 };
  let ns = v.ns / l;
  let ew = v.ew / l;
  const tvd = v.tvd / l;
  if (Math.abs(ns) < EPS) ns = 0;

  let azm: number;
  if (ns > 0 && ew > 0) {
    azm = Math.atan(ew / ns);
  } else if (ns < 0 && ew > 0) {
    azm = Math.PI - Math.atan(Math.abs(ew / ns));
  } else if (ns < 0 && ew < 0) {
    azm = Math.PI + Math.atan(Math.abs(ew / ns));
  } else if (ns > 0 && ew < 0) {
    azm = TWO_PI - Math.atan(Math.abs(ew / ns));
  } else if (ew === 0 && ns === 0) {
    azm = 0;
  } else if (ns === 0) {
    azm = ew > 0 ? Math.PI / 2 : (3 * Math.PI) / 2;
  } else if (ew === 0) {
    azm = ns > 0 ? 0 : Math.PI;
  } else {
    azm = 0;
  }

  const inc = Math.acos(Math.max(-1, Math.min(1, tvd)));
  if (Math.abs(inc) < 1e-4) azm = 0;

  // Normalise azimuth to [0, 2π).
  if (azm < 0) azm += TWO_PI * (Math.trunc(Math.abs(azm) / TWO_PI) + 1);
  if (azm >= TWO_PI) azm -= TWO_PI * Math.trunc(Math.abs(azm) / TWO_PI);

  return { inc, azm };
}

/** Vector dot product. */
export function dot(a: Vec3, b: Vec3): number {
  return a.ns * b.ns + a.ew * b.ew + a.tvd * b.tvd;
}

/** Vector cross product (right-handed in {ns, ew, tvd}). */
export function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    ns: a.ew * b.tvd - a.tvd * b.ew,
    ew: a.tvd * b.ns - a.ns * b.tvd,
    tvd: a.ns * b.ew - a.ew * b.ns,
  };
}

export function add(a: Vec3, b: Vec3): Vec3 {
  return { ns: a.ns + b.ns, ew: a.ew + b.ew, tvd: a.tvd + b.tvd };
}

export function sub(a: Vec3, b: Vec3): Vec3 {
  return { ns: a.ns - b.ns, ew: a.ew - b.ew, tvd: a.tvd - b.tvd };
}

export function scale(a: Vec3, k: number): Vec3 {
  return { ns: a.ns * k, ew: a.ew * k, tvd: a.tvd * k };
}

export function length(a: Vec3): number {
  return Math.sqrt(dot(a, a));
}

export function normalise(a: Vec3): Vec3 {
  const l = length(a);
  if (l === 0) return { ns: 0, ew: 0, tvd: 0 };
  return scale(a, 1 / l);
}

export const VEC3_ZERO: Vec3 = { ns: 0, ew: 0, tvd: 0 };

/** Re-export `sign` for callers that need Pascal-compatible behaviour. */
export { sign };
