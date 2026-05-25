/**
 * Inclination / azimuth solvers used when designing a segment that must lie
 * within a specific plane.
 *
 * Ports of `azmfind` and `incfind` from old_delphi_code/Unit02.pas:684 / :730.
 *
 * The original mutates `form07.RadioButton{1,2}.Caption` to remember the two
 * candidate solutions and uses `qq` (1 or 2) to pick one. Here we return both
 * solutions explicitly; the caller picks.
 */

import type { Vec3 } from "../types.js";
import { vctToSur } from "./vector.js";

export interface AzimuthCandidates {
  ok: boolean;
  /** Azimuth (radians) for choice = 1 (positive sqrt branch). */
  candidate1: number;
  /** Azimuth (radians) for choice = 2 (negative sqrt branch). */
  candidate2: number;
  /** Set when the plane is degenerate and the caller must prompt for inc. */
  degenerate?: boolean;
}

/**
 * Find azimuth(s) such that a vector with the given `inc` (radians) lies in
 * the plane through `a1` spanned by `a2`, `a3`.
 *
 * Returns both quadrant candidates; the original UI prompts the user to pick.
 * If the cross product's east component is 0 the operation is impossible.
 */
export function azmFind(a1: Vec3, a2: Vec3, a3: Vec3, inc: number): AzimuthCandidates {
  void a1; // present for API symmetry with the Pascal signature
  const ax = a2.ew * a3.tvd - a2.tvd * a3.ew;
  const ay = -(a2.ns * a3.tvd - a2.tvd * a3.ns);
  const az = a2.ns * a3.ew - a2.ew * a3.ns;

  if (ax === 0) {
    return { ok: false, candidate1: 0, candidate2: 0 };
  }

  if (Math.abs(az) > 1e-6) {
    const aa = (ay / ax) ** 2 + 1;
    const bb = (2 * Math.cos(inc) * az * ay) / (ax * ax);
    const cc = -1 + Math.cos(inc) ** 2 * (1 + (az / ax) ** 2);

    const disc = Math.max(0, bb * bb - 4 * aa * cc);
    const root = Math.sqrt(disc);

    // Branch 1: positive root
    const apTvd1 = Math.cos(inc);
    const apNs1 = (-bb + root) / (2 * aa);
    const apEw1 = (-ax * apTvd1 - ay * apNs1) / az;
    const sol1 = vctToSur({ ns: apNs1, ew: apEw1, tvd: apTvd1 });

    // Branch 2: negative root
    const apNs2 = (-bb - root) / (2 * aa);
    const apEw2 = (-ax * apTvd1 - ay * apNs2) / az;
    const sol2 = vctToSur({ ns: apNs2, ew: apEw2, tvd: apTvd1 });

    return { ok: true, candidate1: sol1.azm, candidate2: sol2.azm };
  }

  // az ≈ 0 — both candidates degenerate to the cross-product vector ± .
  const sol1 = vctToSur({ ns: a3.ns, ew: a3.ew, tvd: a3.tvd });
  const sol2 = vctToSur({ ns: -a3.ns, ew: -a3.ew, tvd: -a3.tvd });
  return { ok: true, candidate1: sol1.azm, candidate2: sol2.azm };
}

/**
 * Find inclination such that a vector with the given `azm` (radians) lies in
 * the plane through a1 spanned by a2, a3.
 *
 * Returns `{ ok, inc }`. `degenerate: true` signals the original code's
 * fallback path that prompts the user for inc directly.
 */
export interface InclinationResult {
  ok: boolean;
  inc: number;
  degenerate?: boolean;
}

export function incFind(a2: Vec3, a3: Vec3, azm: number): InclinationResult {
  const ax = a2.ew * a3.tvd - a2.tvd * a3.ew;
  const ay = -(a2.ns * a3.tvd - a2.tvd * a3.ns);
  const az = a2.ns * a3.ew - a2.ew * a3.ns;

  // surtovct(pi/2, azm) — horizontal vector at azimuth
  const apNs = Math.cos(azm);
  const apEw = Math.sin(azm);

  if (az !== 0) {
    const apTvd = -(ax * apNs + ay * apEw) / az;
    const len2 = apNs * apNs + apEw * apEw + apTvd * apTvd;
    const inc = Math.acos(Math.max(-1, Math.min(1, apTvd / Math.sqrt(len2))));
    return { ok: true, inc };
  }
  return { ok: false, inc: 0, degenerate: true };
}
