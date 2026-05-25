/**
 * CH2DC2 — CH2DC1 with an additional final hold of length `dmd`.
 * Port of `CH2DC2` in old_delphi_code/Unit02.pas:1596.
 *
 *   Two modes (selected by `ddmmdd`):
 *     - ddmmdd = true:  same quadratic as CH2DC1 but with target shifted by
 *                       the final-hold projection, then dmd is given.
 *     - ddmmdd = false: middle inclination is supplied directly as `thetaex`,
 *                       and dmd is solved from geometry instead.
 *
 *   4 key points: EOC #1, KOP #2, EOC #2, Target.
 *
 *   In ddmmdd=true mode we try BOTH quadratic branches and pick the first
 *   feasible one (see ch2dc1.ts for the rationale).
 */

import { type BuilderResult, type KeyPoint, DEFAULT_PPF, emptyStation } from "./types.js";
import type { Station } from "../../types.js";

export interface CH2DC2Input {
  theta1: number;
  tgtx: number;
  tgty: number;
  theta: number;
  dls1: number;
  dls2: number;
  thetaex: number; // user-supplied middle inclination when ddmmdd=false
  dmd: number;     // when ddmmdd=true, the final hold's MD; otherwise solved
  ddmmdd: boolean; // true → solve midInc; false → solve dmd
  ppf?: number;
}

interface Candidate {
  midInc: number;
  l1: number;
  md0: number; tvd0: number; ew0: number;
  md1: number; tvd1: number; ew1: number;
  md2: number; tvd2: number; ew2: number;
  md3: number; tvd3: number; ew3: number;
}

function evalCandidate(
  midInc: number,
  theta1: number, theta: number,
  dls1: number, dls2: number,
  r1: number, r2: number,
  tgtx: number, dmd: number,
): Candidate {
  const l1 =
    (tgtx - dmd * Math.sin(theta) -
     r1 * (Math.cos(theta1) - Math.cos(midInc)) -
     r2 * (Math.cos(midInc) - Math.cos(theta))) /
    Math.sin(midInc);

  const md0 = (midInc - theta1) / dls1;
  const tvd0 = r1 * (Math.sin(midInc) - Math.sin(theta1));
  const ew0  = r1 * (Math.cos(theta1) - Math.cos(midInc));
  const md1 = md0 + l1;
  const tvd1 = tvd0 + l1 * Math.cos(midInc);
  const ew1  = ew0  + l1 * Math.sin(midInc);
  const md2 = md1 + (theta - midInc) / dls2;
  const tvd2 = tvd1 + r2 * (Math.sin(theta) - Math.sin(midInc));
  const ew2  = ew1  + r2 * (Math.cos(midInc) - Math.cos(theta));
  const md3 = md2 + dmd;
  const tvd3 = tvd2 + dmd * Math.cos(theta);
  const ew3  = ew2  + dmd * Math.sin(theta);

  return { midInc, l1, md0, tvd0, ew0, md1, tvd1, ew1, md2, tvd2, ew2, md3, tvd3, ew3 };
}

function isFeasible(c: Candidate): boolean {
  return c.md0 > 0
    && c.md1 - c.md0 > 0
    && c.md2 - c.md1 > 0
    && c.md3 - c.md2 > 0
    && Number.isFinite(c.l1);
}

export function ch2dc2(input: CH2DC2Input): BuilderResult {
  const { theta1, tgtx, tgty, theta, dls1, dls2, thetaex, ddmmdd } = input;
  let { dmd } = input;
  const ppf = input.ppf ?? DEFAULT_PPF;
  if (dls1 === 0 || dls2 === 0) {
    return { ok: false, keyPoints: [], stations: [], reason: "DLS values must be non-zero" };
  }
  const r1 = 1 / dls1;
  const r2 = 1 / dls2;

  let chosen: Candidate | null = null;

  if (ddmmdd) {
    // Solve mid inclination from the shifted target.
    const a = r1 - r2 - r2 * Math.cos(theta) + r1 * Math.cos(theta1) - (tgtx - dmd * Math.sin(theta));
    const b = 2 * (r2 * Math.sin(theta) - r1 * Math.sin(theta1) - (tgty - dmd * Math.cos(theta)));
    const c = r1 - r2 + r2 * Math.cos(theta) - r1 * Math.cos(theta1) + (tgtx - dmd * Math.sin(theta));
    if (b * b - 4 * a * c <= 0) {
      return { ok: false, keyPoints: [], stations: [], reason: "Unsolvable quadratic" };
    }
    const root = Math.sqrt(Math.abs(b * b - 4 * a * c));

    let preferred = tgtx > r1
      ? 2 * Math.atan((-b - root) / (2 * a))
      : 2 * Math.atan((-b + root) / (2 * a));
    let alternate = tgtx > r1
      ? 2 * Math.atan((-b + root) / (2 * a))
      : 2 * Math.atan((-b - root) / (2 * a));
    if (preferred < 0) preferred += Math.PI;
    if (alternate < 0) alternate += Math.PI;

    for (const candidateInc of [preferred, alternate]) {
      const cand = evalCandidate(candidateInc, theta1, theta, dls1, dls2, r1, r2, tgtx, dmd);
      if (isFeasible(cand)) { chosen = cand; break; }
    }
  } else {
    const midInc = thetaex;
    const num =
      r1 * (1 - Math.cos(thetaex - theta1)) -
      r2 * (1 - Math.cos(theta - thetaex)) -
      tgty * Math.sin(thetaex) +
      tgtx * Math.cos(thetaex);
    const den = Math.cos(thetaex) * Math.sin(theta) - Math.cos(theta) * Math.sin(thetaex);
    dmd = num / den;
    if (dmd < 0) {
      return { ok: false, keyPoints: [], stations: [], reason: "Solved dmd is negative" };
    }
    const cand = evalCandidate(midInc, theta1, theta, dls1, dls2, r1, r2, tgtx, dmd);
    if (isFeasible(cand)) chosen = cand;
  }

  if (!chosen) {
    return { ok: false, keyPoints: [], stations: [], reason: "Geometry infeasible (negative segment)" };
  }

  const { midInc, l1, md0, tvd0, ew0, md1, tvd1, ew1, md2, tvd2, ew2, md3, tvd3, ew3 } = chosen;

  const eoc1: KeyPoint = { ...emptyStation(), md: md0, inc: midInc, tvd: tvd0, ew: ew0, dls: dls1, comment: "EOC #1 3D*-S", dmd: md0 };
  const kop2: KeyPoint = { ...emptyStation(), md: md1, inc: midInc, tvd: tvd1, ew: ew1, dls: 0, comment: "KOP #2", dmd: l1 };
  const eoc2: KeyPoint = { ...emptyStation(), md: md2, inc: theta,  tvd: tvd2, ew: ew2, dls: dls2, comment: "EOC #2", dmd: md2 - md1 };
  const target: KeyPoint = { ...emptyStation(), md: md3, inc: theta, tvd: tvd3, ew: ew3, dls: 0, comment: "Target", dmd };

  const stations: Station[] = [];
  let s = 0, prev = 0;
  for (;;) {
    let m: number, inc: number, tvd: number, ew: number, cmt: string, segDls: number;
    let atEnd = false;
    if (s <= eoc1.md) {
      m = s; inc = theta1 + m * dls1;
      tvd = r1 * (Math.sin(inc) - Math.sin(theta1));
      ew  = r1 * (Math.cos(theta1) - Math.cos(inc));
      cmt = "Curve"; segDls = dls1;
    } else if (s < kop2.md) {
      m = s; inc = midInc;
      tvd = eoc1.tvd + (m - eoc1.md) * Math.cos(midInc);
      ew  = eoc1.ew  + (m - eoc1.md) * Math.sin(midInc);
      cmt = "Keep"; segDls = 0;
    } else if (s < eoc2.md) {
      m = s; inc = midInc + (m - kop2.md) * dls2;
      tvd = kop2.tvd + r2 * (Math.sin(inc) - Math.sin(midInc));
      ew  = kop2.ew  + r2 * (Math.cos(midInc) - Math.cos(inc));
      cmt = "Curve"; segDls = dls2;
    } else if (s < target.md) {
      m = s; inc = theta;
      tvd = eoc2.tvd + (m - eoc2.md) * Math.cos(theta);
      ew  = eoc2.ew  + (m - eoc2.md) * Math.sin(theta);
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

  return { ok: true, keyPoints: [eoc1, kop2, eoc2, target], stations };
}
