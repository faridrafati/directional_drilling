/**
 * HC3DTFT — Hold + Curve to target with specified final inclination.
 * Port of `HC3DTFT` in old_delphi_code/Unit02.pas:1093.
 *
 *   Geometry:
 *     - Hold from start at inclination theta1 down to a KOP
 *     - Single curve from theta1 to theta hitting (tgtx, tgty) tangent to `theta`
 *
 *   r1 (curve radius)  = (tgty·sin θ1 − tgtx·cos θ1) / (cos(θ − θ1) − 1)
 *   dls                = 1/r1
 *   crvln (arc length) = (θ − θ1) / dls
 *   KOP MD             = TVD-of-KOP / cos θ1   (or EW/sin θ1 if vertical)
 *
 * 2D builder (ns = 0).
 */

import { type BuilderResult, type KeyPoint, DEFAULT_PPF, emptyStation } from "./types.js";
import type { Station } from "../../types.js";

export interface HC3DTFTInput {
  theta1: number;
  tgtx: number;
  tgty: number;
  theta: number;
  ppf?: number;
}

export function hc3dtft(input: HC3DTFTInput): BuilderResult {
  const { theta1, tgtx, tgty, theta } = input;
  const ppf = input.ppf ?? DEFAULT_PPF;

  const denom = Math.cos(theta - theta1) - 1;
  if (denom === 0) {
    return { ok: false, keyPoints: [], stations: [], reason: "theta == theta1" };
  }
  const r1 = (tgty * Math.sin(theta1) - tgtx * Math.cos(theta1)) / denom;
  if (r1 === 0) {
    return { ok: false, keyPoints: [], stations: [], reason: "Zero curve radius" };
  }
  const dls = 1 / r1;
  const crvln = (theta - theta1) / dls;

  // KOP (key point 0)
  const kop: KeyPoint = { ...emptyStation(), inc: theta1, comment: "KOP (HOLD-CURVE 3D*)" };
  kop.tvd = tgty - r1 * (Math.sin(theta) - Math.sin(theta1));
  kop.ew  = tgtx - r1 * (Math.cos(theta1) - Math.cos(theta));
  if (Math.cos(theta1) !== 0) {
    kop.md = kop.tvd / Math.cos(theta1);
  } else {
    kop.md = kop.ew / Math.sin(theta1);
  }
  kop.dls = 0;
  kop.dmd = kop.md;

  if (kop.md <= 0 || crvln <= 0) {
    return {
      ok: false,
      keyPoints: [kop],
      stations: [],
      reason: "Geometry infeasible (negative MD or curve length)",
    };
  }

  // EOC (target)
  const eoc: KeyPoint = {
    ...emptyStation(),
    inc: theta,
    md: kop.md + crvln,
    tvd: tgty,
    ew: tgtx,
    dls,
    comment: "EOC (Target)",
    dmd: crvln,
  };

  // Densify: hold from 0..kop.md, then curve from kop.md..eoc.md
  const stations: Station[] = [];
  let s = 0;
  let prev = 0;
  for (;;) {
    let m: number;
    let inc: number;
    let tvd: number;
    let ew: number;
    let cmt: string;
    let segDls: number;
    let atEnd = false;

    if (s <= kop.md) {
      m = s;
      inc = theta1;
      tvd = m * Math.cos(theta1);
      ew  = m * Math.sin(theta1);
      cmt = theta1 === 0 ? "Vertical" : "KEEP SEC.";
      segDls = 0;
    } else if (s < eoc.md) {
      m = s;
      inc = (m - kop.md) * dls + theta1;
      tvd = kop.md * Math.cos(theta1) + r1 * (Math.sin(inc) - Math.sin(theta1));
      ew  = kop.md * Math.sin(theta1) + r1 * (Math.cos(theta1) - Math.cos(inc));
      cmt = "CURVE";
      segDls = dls;
    } else {
      m = eoc.md;
      inc = theta;
      tvd = eoc.tvd;
      ew  = eoc.ew;
      cmt = "EOC - Target";
      segDls = 0;
      atEnd = true;
    }

    stations.push({ ...emptyStation(), md: m, inc, tvd, ew, dls: segDls, dmd: m - prev, comment: cmt });
    prev = m;
    if (atEnd) break;
    s += ppf;
  }

  return { ok: true, keyPoints: [kop, eoc], stations };
}
