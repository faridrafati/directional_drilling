/**
 * CH3D in full 3D — Curve then Hold to a 3D target.
 *
 * Pascal Unit02.pas's CH3DFFK builder runs in a 2D plane after a Pascal
 * plane()/revplane() projection. Our dispatcher's inPlane2D path doesn't
 * do that projection, so for a non-vertical start (where the curve plane
 * is tilted) it fails with "Geometry infeasible".
 *
 * Same approach as hc3d3D — solve the 3D problem directly via the
 * standard minimum-curvature formulas, just with the order swapped:
 *
 *   CURVE from (I₁, A₁) → (I₂, A₂)  for length L1
 *   HOLD  at  (I₂, A₂)              for length L2
 *
 * Position constraints:
 *   ΔTVD = (L1/2)·(cos I₁ + cos I₂)·RF              +  L2·cos I₂
 *   ΔNS  = (L1/2)·(sin I₁ cos A₁ + sin I₂ cos A₂)·RF +  L2·sin I₂ cos A₂
 *   ΔEW  = (L1/2)·(sin I₁ sin A₁ + sin I₂ sin A₂)·RF +  L2·sin I₂ sin A₂
 *
 *   DL = arccos(cos I₁ cos I₂ + sin I₁ sin I₂ cos(A₂ - A₁))
 *   RF = (2/DL)·tan(DL/2)
 *
 * 3 unknowns (L1, L2, A₂); 3 equations. Bisect on A₂ until the residual
 * of the third equation (ΔEW) is zero.
 */

import { type BuilderResult, type KeyPoint, DEFAULT_PPF, emptyStation } from "./types.js";
import type { Station } from "../../types.js";

export interface CH3D3DInput {
  /** Start orientation. */
  theta1: number;
  prevAzm: number;
  /** Target inclination. */
  theta: number;
  /** Target position offset from prev (world frame). */
  tgtNs: number;
  tgtEw: number;
  tgtTvd: number;
  ppf?: number;
}

export interface CH3D3DResult extends BuilderResult {
  /** Derived target azimuth (radians). */
  solvedAzm: number;
  /** Curve length (start → EOC). */
  l1: number;
  /** Hold length (EOC → Target). */
  l2: number;
  /** Min-curvature DLS for the curve segment. */
  curveDls: number;
}

function minCurvDeltas(
  i1: number, a1: number,
  i2: number, a2: number,
  L: number,
): { dT: number; dN: number; dE: number } {
  const cosDL = Math.cos(i1) * Math.cos(i2)
              + Math.sin(i1) * Math.sin(i2) * Math.cos(a2 - a1);
  const DL = Math.acos(Math.max(-1, Math.min(1, cosDL)));
  const RF = DL < 1e-9 ? 1 : (2 / DL) * Math.tan(DL / 2);
  return {
    dT: (L / 2) * (Math.cos(i1) + Math.cos(i2)) * RF,
    dN: (L / 2) * (Math.sin(i1) * Math.cos(a1) + Math.sin(i2) * Math.cos(a2)) * RF,
    dE: (L / 2) * (Math.sin(i1) * Math.sin(a1) + Math.sin(i2) * Math.sin(a2)) * RF,
  };
}

/**
 * For a guess A2, solve the 2×2 linear system in (L1, L2) from ΔTVD + ΔNS
 * and return the ΔEW residual. Same shape as the HC3D solver but with the
 * hold's contribution on L2 instead of L1.
 */
function solveLinearForAzm(
  I1: number, A1: number, I2: number, A2: number,
  dT: number, dN: number, dE: number,
): { res: number; L1: number; L2: number; DL: number; RF: number } {
  const cosDL = Math.cos(I1) * Math.cos(I2)
              + Math.sin(I1) * Math.sin(I2) * Math.cos(A2 - A1);
  const DL = Math.acos(Math.max(-1, Math.min(1, cosDL)));
  const RF = DL < 1e-9 ? 1 : (2 / DL) * Math.tan(DL / 2);

  // Curve coefficients (multiplied onto L1)
  const a1 = ((Math.cos(I1) + Math.cos(I2)) / 2) * RF;
  const a2 = ((Math.sin(I1) * Math.cos(A1) + Math.sin(I2) * Math.cos(A2)) / 2) * RF;
  const a3 = ((Math.sin(I1) * Math.sin(A1) + Math.sin(I2) * Math.sin(A2)) / 2) * RF;
  // Hold coefficients (multiplied onto L2)
  const b1 = Math.cos(I2);
  const b2 = Math.sin(I2) * Math.cos(A2);
  const b3 = Math.sin(I2) * Math.sin(A2);

  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1e-12) {
    return { res: NaN, L1: NaN, L2: NaN, DL, RF };
  }
  const L1 = (dT * b2 - dN * b1) / det;
  const L2 = (dN * a1 - dT * a2) / det;
  const res = a3 * L1 + b3 * L2 - dE;
  return { res, L1, L2, DL, RF };
}

export function ch3d3D(input: CH3D3DInput): CH3D3DResult {
  const { theta1: I1, prevAzm: A1, theta: I2, tgtNs: dN, tgtEw: dE, tgtTvd: dT } = input;
  const ppf = input.ppf ?? DEFAULT_PPF;

  const empty: CH3D3DResult = {
    ok: false, keyPoints: [], stations: [], reason: "n/a",
    solvedAzm: 0, l1: 0, l2: 0, curveDls: 0,
  };

  // Scan A2 across [A1 - π, A1 + π] for a sign change in the residual.
  const samples = 64;
  type Bracket = { lo: number; hi: number; loR: number; hiR: number };
  const brackets: Bracket[] = [];
  let prevA = A1 - Math.PI;
  let prevRes = solveLinearForAzm(I1, A1, I2, prevA, dT, dN, dE).res;
  for (let s = 1; s <= samples; s++) {
    const a = A1 - Math.PI + (2 * Math.PI * s) / samples;
    const r = solveLinearForAzm(I1, A1, I2, a, dT, dN, dE);
    if (Number.isFinite(r.res) && Number.isFinite(prevRes) && r.res * prevRes < 0) {
      brackets.push({ lo: prevA, hi: a, loR: prevRes, hiR: r.res });
    }
    prevA = a;
    prevRes = r.res;
  }

  // Each bracket can refine to a valid solution. We want the one with
  // POSITIVE L1 and L2 (geometrically physical).
  let best: { L1: number; L2: number; A2: number; DL: number; RF: number } | null = null;
  for (const { lo: lo0, hi: hi0 } of brackets) {
    let lo = lo0;
    let hi = hi0;
    for (let i = 0; i < 80; i++) {
      const mid = (lo + hi) / 2;
      const r = solveLinearForAzm(I1, A1, I2, mid, dT, dN, dE);
      if (!Number.isFinite(r.res)) break;
      const loR = solveLinearForAzm(I1, A1, I2, lo, dT, dN, dE).res;
      if (r.res * loR < 0) hi = mid;
      else lo = mid;
      if (Math.abs(r.res) < 1e-8) break;
    }
    const A2 = (lo + hi) / 2;
    const r = solveLinearForAzm(I1, A1, I2, A2, dT, dN, dE);
    if (Number.isFinite(r.L1) && Number.isFinite(r.L2) && r.L1 > 0 && r.L2 > 0) {
      if (!best || (r.L1 + r.L2) < (best.L1 + best.L2)) {
        best = { L1: r.L1, L2: r.L2, A2, DL: r.DL, RF: r.RF };
      }
    }
  }

  if (!best) {
    return { ...empty, reason: "CH3D 3D solver: no positive-length azimuth solution found" };
  }

  const { L1, L2, A2, DL } = best;
  const curveDls = L1 < 1e-9 ? 0 : DL / L1;

  // Densify: start, curve interpolation, EOC keypoint, hold densification, Target keypoint.
  const stations: Station[] = [];
  stations.push({
    ...emptyStation(),
    md: 0, inc: I1, azm: A1,
    ns: 0, ew: 0, tvd: 0,
    dls: 0, dmd: 0, comment: "Start",
  });

  // Curve portion 0 → L1
  let prevMd = 0;
  let s = ppf;
  while (s < L1) {
    const t = s / L1;
    const inc = I1 + t * (I2 - I1);
    const azm = A1 + t * (A2 - A1);
    const d = minCurvDeltas(I1, A1, inc, azm, s);
    stations.push({
      ...emptyStation(),
      md: s, inc, azm,
      ns: d.dN, ew: d.dE, tvd: d.dT,
      dls: curveDls, dmd: s - prevMd, comment: "Curve",
    });
    prevMd = s;
    s += ppf;
  }

  // EOC keypoint at end of curve
  const eocCalc = minCurvDeltas(I1, A1, I2, A2, L1);
  const eoc: KeyPoint = {
    ...emptyStation(),
    md: L1, inc: I2, azm: A2,
    ns: eocCalc.dN, ew: eocCalc.dE, tvd: eocCalc.dT,
    dls: curveDls, dmd: L1, comment: "EOC (Curve-Hold 3D*)",
  };
  stations.push({
    ...eoc,
    dmd: L1 - prevMd, comment: "Curve",
  });
  prevMd = L1;

  // Hold portion L1 → L1 + L2
  s = L1 + ppf;
  while (s < L1 + L2) {
    const holdLen = s - L1;
    stations.push({
      ...emptyStation(),
      md: s, inc: I2, azm: A2,
      ns: eoc.ns + holdLen * Math.sin(I2) * Math.cos(A2),
      ew: eoc.ew + holdLen * Math.sin(I2) * Math.sin(A2),
      tvd: eoc.tvd + holdLen * Math.cos(I2),
      dls: 0, dmd: s - prevMd, comment: "Keep",
    });
    prevMd = s;
    s += ppf;
  }

  // Target keypoint
  const target: KeyPoint = {
    ...emptyStation(),
    md: L1 + L2, inc: I2, azm: A2,
    ns: dN, ew: dE, tvd: dT,
    dls: 0, dmd: L2, comment: "Target",
  };
  stations.push({
    ...target,
    dmd: (L1 + L2) - prevMd, comment: "Keep",
  });

  return {
    ok: true,
    keyPoints: [eoc, target],
    stations,
    solvedAzm: A2,
    l1: L1,
    l2: L2,
    curveDls,
  };
}
