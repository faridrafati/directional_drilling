/**
 * CH — Curve + Hold with the final inclination solved from a quadratic.
 * Port of `CH` in old_delphi_code/Unit02.pas:1391.
 *
 * Unlike CH3DFFK, the user does NOT specify `theta`; instead the geometry is
 * pinned by (tgtx, tgty) and the fixed DLS. We solve a quadratic in
 * tan(θ/2) using the half-angle substitution.
 *
 *   a = -sin θ1 - tgty/r,  b = -cos θ1 + tgtx/r,  r = 1/dls
 *   Solvable iff a² + b² > 1.
 *   Two branches; the original code picks the negative-root branch when
 *   tgtx ≥ r (target outside the circle), else the positive root.
 */

import { type BuilderResult, type KeyPoint, DEFAULT_PPF, emptyStation } from "./types.js";
import type { Station } from "../../types.js";

export interface CHInput {
  theta1: number;
  tgtx: number;
  tgty: number;
  dls: number;
  ppf?: number;
}

export function ch(input: CHInput): BuilderResult {
  const { theta1, tgtx, tgty, dls } = input;
  const ppf = input.ppf ?? DEFAULT_PPF;

  if (dls === 0) {
    return { ok: false, keyPoints: [], stations: [], reason: "DLS must be non-zero" };
  }
  const r1 = 1 / dls;
  const a = -Math.sin(theta1) - tgty / r1;
  const b = -Math.cos(theta1) + tgtx / r1;
  const disc = a * a + b * b - 1;
  if (disc <= 0 || b === 1) {
    return { ok: false, keyPoints: [], stations: [], reason: "Unsolvable quadratic" };
  }
  const root = Math.sqrt(disc);
  const theta =
    tgtx < r1
      ? 2 * Math.atan((a + root) / (b - 1))
      : 2 * Math.atan((a - root) / (b - 1));

  const crvln = (theta - theta1) / dls;
  const totalMd = crvln + (tgty - r1 * (Math.sin(theta) - Math.sin(theta1))) / Math.cos(theta);

  if (crvln <= 0 || totalMd <= crvln) {
    return { ok: false, keyPoints: [], stations: [], reason: "Geometry infeasible" };
  }

  const eoc: KeyPoint = {
    ...emptyStation(),
    md: crvln,
    inc: crvln * dls + theta1,
    tvd: r1 * (Math.sin(crvln * dls + theta1) - Math.sin(theta1)),
    ew:  r1 * (Math.cos(theta1) - Math.cos(crvln * dls + theta1)),
    dls: Math.abs(dls),
    comment: "EOC (CURVE-HOLD)",
    dmd: crvln,
  };
  const target: KeyPoint = {
    ...emptyStation(),
    md: totalMd,
    inc: theta,
    tvd: r1 * (Math.sin(theta) - Math.sin(theta1)) + (totalMd - crvln) * Math.cos(theta),
    ew:  r1 * (Math.cos(theta1) - Math.cos(theta))  + (totalMd - crvln) * Math.sin(theta),
    dls: 0,
    comment: "Target",
    dmd: totalMd - crvln,
  };

  const stations: Station[] = [];
  let s = 0, prev = 0;
  for (;;) {
    let m: number, inc: number, tvd: number, ew: number, cmt: string, segDls: number;
    let atEnd = false;
    if (s <= eoc.md) {
      m = s;
      inc = theta1 + m * dls;
      tvd = r1 * (Math.sin(inc) - Math.sin(theta1));
      ew  = r1 * (Math.cos(theta1) - Math.cos(inc));
      cmt = "CURVE";
      segDls = eoc.dls;
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
