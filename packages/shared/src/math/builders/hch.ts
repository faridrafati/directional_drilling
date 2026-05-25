/**
 * HCH — Hold-Curve-Hold to target at given final inclination and DLS.
 * Port of `HCH` in old_delphi_code/Unit02.pas:1287.
 *
 *   Three segments:
 *     1. Hold at theta1 from start to KOP (length a)
 *     2. Curve from theta1 to theta at the specified DLS (length crvln)
 *     3. Hold at theta from EOC to target (length b)
 *
 *   a, b solved from the chord-projection identities:
 *     a = (tgty·sin θ  − tgtx·cos θ  − r·(1 − cos(θ−θ1))) / sin(θ−θ1)
 *     b = (tgty·sin θ1 − tgtx·cos θ1 − r·(cos(θ−θ1) − 1)) / sin(θ1−θ)
 */

import { type BuilderResult, type KeyPoint, DEFAULT_PPF, emptyStation } from "./types.js";
import type { Station } from "../../types.js";

export interface HCHInput {
  theta1: number;
  tgtx: number;
  tgty: number;
  theta: number;
  dls: number;
  ppf?: number;
}

export function hch(input: HCHInput): BuilderResult {
  const { theta1, tgtx, tgty, theta, dls } = input;
  const ppf = input.ppf ?? DEFAULT_PPF;

  if (dls === 0 || theta === theta1) {
    return { ok: false, keyPoints: [], stations: [], reason: "DLS must be non-zero and theta != theta1" };
  }
  const r1 = 1 / dls;
  const a =
    (tgty * Math.sin(theta) - tgtx * Math.cos(theta) - r1 * (1 - Math.cos(theta - theta1))) /
    Math.sin(theta - theta1);
  const b =
    (tgty * Math.sin(theta1) - tgtx * Math.cos(theta1) - r1 * (Math.cos(theta - theta1) - 1)) /
    Math.sin(theta1 - theta);
  const crvln = (theta - theta1) / dls;

  if (a < 0 || b < 0 || crvln < 0) {
    return { ok: false, keyPoints: [], stations: [], reason: "Geometry infeasible (negative segment)" };
  }

  const kop: KeyPoint = {
    ...emptyStation(),
    md: a, inc: theta1, tvd: a * Math.cos(theta1), ew: a * Math.sin(theta1),
    dls: 0, comment: "KOP (Computed)", dmd: a,
  };
  const eoc: KeyPoint = {
    ...emptyStation(),
    md: a + crvln, inc: theta,
    tvd: kop.tvd + r1 * (Math.sin(theta) - Math.sin(theta1)),
    ew:  kop.ew  + r1 * (Math.cos(theta1) - Math.cos(theta)),
    dls, comment: "EOC", dmd: crvln,
  };
  const target: KeyPoint = {
    ...emptyStation(),
    md: a + crvln + b, inc: theta,
    tvd: eoc.tvd + b * Math.cos(theta),
    ew:  eoc.ew  + b * Math.sin(theta),
    dls: 0, comment: "Target", dmd: b,
  };

  // Densify
  const stations: Station[] = [];
  let s = 0, prev = 0;
  for (;;) {
    let m: number, inc: number, tvd: number, ew: number, cmt: string, segDls: number;
    let atEnd = false;
    if (s <= kop.md) {
      m = s; inc = theta1; tvd = m * Math.cos(theta1); ew = m * Math.sin(theta1);
      cmt = "Keep"; segDls = 0;
    } else if (s < eoc.md) {
      m = s;
      inc = theta1 + (m - kop.md) * dls;
      tvd = kop.tvd + r1 * (Math.sin(inc) - Math.sin(theta1));
      ew  = kop.ew  + r1 * (Math.cos(theta1) - Math.cos(inc));
      cmt = "Curve"; segDls = dls;
    } else if (s < target.md) {
      m = s; inc = theta;
      tvd = eoc.tvd + (m - eoc.md) * Math.cos(theta);
      ew  = eoc.ew  + (m - eoc.md) * Math.sin(theta);
      cmt = "Keep"; segDls = 0;
    } else {
      m = target.md; inc = theta; tvd = target.tvd; ew = target.ew;
      cmt = "Target"; segDls = 0; atEnd = true;
    }
    stations.push({ ...emptyStation(), md: m, inc, tvd, ew, dls: segDls, dmd: m - prev, comment: cmt });
    prev = m;
    if (atEnd) break;
    s += ppf;
  }

  return { ok: true, keyPoints: [kop, eoc, target], stations };
}
