/**
 * CC2D — Curve-Curve 2D, two back-to-back arcs at fixed DLS each.
 * Port of `CC2D` in old_delphi_code/Unit02.pas:1965.
 *
 *   No target position is given — the target is the natural endpoint of two
 *   consecutive curves from theta1 → theta2 (at dls1) → theta3 (at dls2).
 *
 *   tgtx (ew) = r1·(cos θ1 − cos θ2) + r2·(cos θ2 − cos θ3)
 *   tgty (tvd) = r1·(sin θ2 − sin θ1) + r2·(sin θ3 − sin θ2)
 */

import { type BuilderResult, type KeyPoint, DEFAULT_PPF, emptyStation } from "./types.js";
import type { Station } from "../../types.js";

export interface CC2DInput {
  theta1: number;
  theta2: number;
  theta3: number;
  dls1: number;
  dls2: number;
  ppf?: number;
}

export function cc2d(input: CC2DInput): BuilderResult {
  const { theta1, theta2, theta3, dls1, dls2 } = input;
  const ppf = input.ppf ?? DEFAULT_PPF;

  if (dls1 === 0 || dls2 === 0) {
    return { ok: false, keyPoints: [], stations: [], reason: "DLS values must be non-zero" };
  }
  const r1 = 1 / dls1;
  const r2 = 1 / dls2;
  const tgtx = r1 * (Math.cos(theta1) - Math.cos(theta2)) + r2 * (Math.cos(theta2) - Math.cos(theta3));
  const tgty = r1 * (Math.sin(theta2) - Math.sin(theta1)) + r2 * (Math.sin(theta3) - Math.sin(theta2));

  const md1 = (theta2 - theta1) / dls1;
  const md2 = md1 + (theta3 - theta2) / dls2;
  if (md1 < 0 || md2 < md1) {
    return { ok: false, keyPoints: [], stations: [], reason: "Geometry infeasible" };
  }

  const eoc1: KeyPoint = {
    ...emptyStation(),
    md: md1, inc: theta2, azm: Math.PI / 2,
    tvd: r1 * (Math.sin(theta2) - Math.sin(theta1)),
    ew:  r1 * (Math.cos(theta1) - Math.cos(theta2)),
    dls: dls1, comment: "EOC #1 (Curve Curve 2D)", dmd: md1,
  };
  const eoc2: KeyPoint = {
    ...emptyStation(),
    md: md2, inc: theta3, tvd: tgty, ew: tgtx,
    dls: dls2, comment: "EOC #2", dmd: md2 - md1,
  };

  const stations: Station[] = [];
  let s = 0, prev = 0;
  for (;;) {
    let m: number, inc: number, tvd: number, ew: number, cmt: string, segDls: number;
    let atEnd = false;
    if (s < eoc1.md) {
      m = s;
      inc = theta1 + m * dls1;
      tvd = r1 * (Math.sin(inc) - Math.sin(theta1));
      ew  = r1 * (Math.cos(theta1) - Math.cos(inc));
      cmt = "CURVE #1"; segDls = dls1;
    } else if (s < eoc2.md) {
      m = s;
      inc = theta2 + (m - eoc1.md) * dls2;
      tvd = eoc1.tvd + r2 * (Math.sin(inc) - Math.sin(theta2));
      ew  = eoc1.ew  + r2 * (Math.cos(theta2) - Math.cos(inc));
      cmt = "CURVE #2"; segDls = dls2;
    } else {
      m = eoc2.md; inc = theta3; tvd = eoc2.tvd; ew = eoc2.ew;
      cmt = "Target"; segDls = dls2; atEnd = true;
    }
    stations.push({ ...emptyStation(), md: m, inc, tvd, ew, dls: segDls, dmd: m - prev, comment: cmt });
    prev = m;
    if (atEnd) break;
    s += ppf;
  }
  return { ok: true, keyPoints: [eoc1, eoc2], stations };
}
