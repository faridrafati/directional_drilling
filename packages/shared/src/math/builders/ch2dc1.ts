/**
 * CH2DC1 — Curve-Hold-Curve 2D, single solver for the middle inclination.
 * Port of `CH2DC1` in old_delphi_code/Unit02.pas:1482.
 *
 *   3 segments: curve(dls1) → hold → curve(dls2). The middle inclination
 *   (shared by hold and the start of the second curve) is solved from a
 *   quadratic. Pascal picks one branch based on `|tgtx| > |r1|`, but for
 *   chained profiles (e.g. D3DS following a CH) that heuristic can pick the
 *   wrong root and produce negative segment lengths even when the other
 *   root is perfectly feasible. We compute BOTH candidate mid-inclinations,
 *   validate each against the segment-length non-negativity check, and use
 *   the first one that passes.
 */

import { type BuilderResult, type KeyPoint, DEFAULT_PPF, emptyStation } from "./types.js";
import type { Station } from "../../types.js";

export interface CH2DC1Input {
  theta1: number;
  tgtx: number;
  tgty: number;
  theta: number;   // final inclination at target
  dls1: number;
  dls2: number;
  ppf?: number;
}

/** Result of evaluating one quadratic branch — geometry only, no stations yet. */
interface Candidate {
  midInc: number;
  l1: number;
  md0: number; tvd0: number; ew0: number;
  md1: number; tvd1: number; ew1: number;
  md2: number; tvd2: number; ew2: number;
}

function evalCandidate(
  midInc: number,
  theta1: number, theta: number,
  r1: number, r2: number,
  tgtx: number,
): Candidate {
  const l1 = (tgtx -
              r1 * (Math.cos(theta1) - Math.cos(midInc)) -
              r2 * (Math.cos(midInc) - Math.cos(theta))) / Math.sin(midInc);
  const md0 = (midInc - theta1) * r1;
  const tvd0 = r1 * (Math.sin(midInc) - Math.sin(theta1));
  const ew0  = r1 * (Math.cos(theta1) - Math.cos(midInc));
  const md1 = md0 + l1;
  const tvd1 = tvd0 + l1 * Math.cos(midInc);
  const ew1  = ew0  + l1 * Math.sin(midInc);
  const md2 = md1 + (theta - midInc) * r2;
  const tvd2 = tvd1 + r2 * (Math.sin(theta) - Math.sin(midInc));
  const ew2  = ew1  + r2 * (Math.cos(midInc) - Math.cos(theta));
  return { midInc, l1, md0, tvd0, ew0, md1, tvd1, ew1, md2, tvd2, ew2 };
}

function isFeasible(c: Candidate): boolean {
  return c.md0 >= 0 && c.md1 >= c.md0 && c.md2 >= c.md1 && Number.isFinite(c.l1);
}

export function ch2dc1(input: CH2DC1Input): BuilderResult {
  const { theta1, tgtx, tgty, theta, dls1, dls2 } = input;
  const ppf = input.ppf ?? DEFAULT_PPF;

  if (dls1 === 0 || dls2 === 0) {
    return { ok: false, keyPoints: [], stations: [], reason: "DLS values must be non-zero" };
  }
  const r1 = 1 / dls1;
  const r2 = 1 / dls2;
  const a = r1 - r2 - r2 * Math.cos(theta) + r1 * Math.cos(theta1) - tgtx;
  const b = 2 * (r2 * Math.sin(theta) - r1 * Math.sin(theta1) - tgty);
  const c = r1 - r2 + r2 * Math.cos(theta) - r1 * Math.cos(theta1) + tgtx;

  if (b * b - 4 * a * c <= 0) {
    return { ok: false, keyPoints: [], stations: [], reason: "Unsolvable quadratic" };
  }
  const root = Math.sqrt(Math.abs(b * b - 4 * a * c));

  // Try both quadratic branches. Pascal hard-picks one based on |tgtx| vs |r1|,
  // but in chained profiles the heuristic can pick the impossible root. We try
  // the heuristic's preferred branch first (cheap path matches Pascal output
  // when both are feasible), then fall back to the other.
  const preferred = Math.abs(tgtx) > Math.abs(r1)
    ? 2 * Math.atan((-b - root) / (2 * a))
    : 2 * Math.atan((-b + root) / (2 * a));
  const alternate = Math.abs(tgtx) > Math.abs(r1)
    ? 2 * Math.atan((-b + root) / (2 * a))
    : 2 * Math.atan((-b - root) / (2 * a));

  let chosen: Candidate | null = null;
  for (const candidateInc of [preferred, alternate]) {
    const cand = evalCandidate(candidateInc, theta1, theta, r1, r2, tgtx);
    if (isFeasible(cand)) { chosen = cand; break; }
  }

  if (!chosen) {
    return { ok: false, keyPoints: [], stations: [], reason: "Geometry infeasible (negative segment)" };
  }

  const { midInc, l1, md0, tvd0, ew0, md1, tvd1, ew1, md2, tvd2, ew2 } = chosen;

  const eoc1: KeyPoint = {
    ...emptyStation(),
    md: md0, inc: midInc, tvd: tvd0, ew: ew0, dls: dls1,
    comment: "EOC #1 3D*-S", dmd: md0,
  };
  const kop2: KeyPoint = {
    ...emptyStation(),
    md: md1, inc: midInc, tvd: tvd1, ew: ew1, dls: 0,
    comment: "KOP #2", dmd: l1,
  };
  const target: KeyPoint = {
    ...emptyStation(),
    md: md2, inc: theta, tvd: tvd2, ew: ew2, dls: dls2,
    comment: "EOC Target", dmd: md2 - md1,
  };

  const stations: Station[] = [];
  let s = 0, prev = 0;
  for (;;) {
    let m: number, inc: number, tvd: number, ew: number, cmt: string, segDls: number;
    let atEnd = false;
    if (s <= eoc1.md) {
      m = s; inc = theta1 + m / r1;
      tvd = r1 * (Math.sin(inc) - Math.sin(theta1));
      ew  = r1 * (Math.cos(theta1) - Math.cos(inc));
      cmt = "Curve"; segDls = dls1;
    } else if (s < kop2.md) {
      m = s; inc = midInc;
      tvd = eoc1.tvd + (m - eoc1.md) * Math.cos(midInc);
      ew  = eoc1.ew  + (m - eoc1.md) * Math.sin(midInc);
      cmt = "Keep"; segDls = 0;
    } else if (s < target.md) {
      m = s; inc = midInc + (m - kop2.md) / r2;
      tvd = kop2.tvd + r2 * (Math.sin(inc) - Math.sin(midInc));
      ew  = kop2.ew  + r2 * (Math.cos(midInc) - Math.cos(inc));
      cmt = "Curve"; segDls = dls2;
    } else {
      m = target.md; inc = theta; tvd = target.tvd; ew = target.ew;
      cmt = "Target"; segDls = 0; atEnd = true;
    }
    stations.push({ ...emptyStation(), md: m, inc, tvd, ew, dls: segDls, dmd: m - prev, comment: cmt });
    prev = m;
    if (atEnd) break;
    s += ppf;
  }

  return { ok: true, keyPoints: [eoc1, kop2, target], stations };
}
