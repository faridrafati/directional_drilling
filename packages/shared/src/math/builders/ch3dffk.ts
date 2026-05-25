/**
 * CH3DFFK — Curve + Hold to target (curve from start, then hold to target).
 * Port of `CH3DFFK` in old_delphi_code/Unit02.pas:1188.
 *
 *   Mirror of HC3DTFT: build the curve first, then a straight hold tangent at
 *   `theta` to the target.
 *
 *   r1 = (tgty·sin θ − tgtx·cos θ) /
 *        ((sin θ − sin θ1)·sin θ − (cos θ1 − cos θ)·cos θ)
 *   dls = 1/r1, crvln = (θ − θ1)/dls
 *   md (total) = crvln + (tgtx − r1·(cos θ1 − cos θ)) / sin θ          if θ ≠ 0
 *              = crvln + (tgty − r1·(sin θ  − sin θ1)) / cos θ          otherwise
 */

import { type BuilderResult, type KeyPoint, DEFAULT_PPF, emptyStation } from "./types.js";
import type { Station } from "../../types.js";

export interface CH3DFFKInput {
  theta1: number;
  tgtx: number;
  tgty: number;
  theta: number;
  ppf?: number;
}

export function ch3dffk(input: CH3DFFKInput): BuilderResult {
  const { theta1, tgtx, tgty, theta } = input;
  const ppf = input.ppf ?? DEFAULT_PPF;

  const denom =
    (Math.sin(theta) - Math.sin(theta1)) * Math.sin(theta) -
    (Math.cos(theta1) - Math.cos(theta)) * Math.cos(theta);
  if (denom === 0) {
    return { ok: false, keyPoints: [], stations: [], reason: "Singular geometry" };
  }
  const r1 = (tgty * Math.sin(theta) - tgtx * Math.cos(theta)) / denom;
  if (r1 === 0) {
    return { ok: false, keyPoints: [], stations: [], reason: "Zero curve radius" };
  }
  const dls = 1 / r1;
  const crvln = (theta - theta1) / dls;

  let totalMd: number;
  if (theta !== 0) {
    totalMd = crvln + (tgtx - r1 * (Math.cos(theta1) - Math.cos(theta))) / Math.sin(theta);
  } else {
    totalMd = crvln + (tgty - r1 * (Math.sin(theta) - Math.sin(theta1))) / Math.cos(theta);
  }

  if (crvln < 0 || totalMd < crvln) {
    return { ok: false, keyPoints: [], stations: [], reason: "Geometry infeasible" };
  }

  const eoc: KeyPoint = {
    ...emptyStation(),
    md: crvln,
    inc: crvln * dls + theta1,
    tvd: r1 * (Math.sin(crvln * dls + theta1) - Math.sin(theta1)),
    ew:  r1 * (Math.cos(theta1) - Math.cos(crvln * dls + theta1)),
    dls,
    comment: "EOC (CURVE-HOLD 3D*)",
    dmd: crvln,
  };
  const target: KeyPoint = {
    ...emptyStation(),
    md: totalMd,
    inc: theta,
    tvd: r1 * (Math.sin(theta) - Math.sin(theta1)) + (totalMd - crvln) * Math.cos(theta),
    ew:  r1 * (Math.cos(theta1) - Math.cos(theta)) + (totalMd - crvln) * Math.sin(theta),
    dls: 0,
    comment: "Target",
    dmd: totalMd - crvln,
  };

  // Densify
  const stations: Station[] = [];
  let s = 0;
  let prev = 0;
  for (;;) {
    let m: number, inc: number, tvd: number, ew: number, cmt: string, segDls: number;
    let atEnd = false;

    if (s <= eoc.md) {
      m = s;
      inc = theta1 + m * dls;
      tvd = r1 * (Math.sin(inc) - Math.sin(theta1));
      ew  = r1 * (Math.cos(theta1) - Math.cos(inc));
      cmt = "CURVE";
      segDls = dls;
    } else if (s < target.md) {
      m = s;
      inc = theta;
      tvd = eoc.tvd + (m - crvln) * Math.cos(theta);
      ew  = eoc.ew  + (m - crvln) * Math.sin(theta);
      cmt = "Keep";
      segDls = 0;
    } else {
      m = target.md;
      inc = theta;
      tvd = target.tvd;
      ew  = target.ew;
      cmt = "Target";
      segDls = 0;
      atEnd = true;
    }

    stations.push({ ...emptyStation(), md: m, inc, tvd, ew, dls: segDls, dmd: m - prev, comment: cmt });
    prev = m;
    if (atEnd) break;
    s += ppf;
  }

  return { ok: true, keyPoints: [eoc, target], stations };
}
