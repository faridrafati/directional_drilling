/**
 * HC3D in full 3D — Hold then Curve to a 3D target.
 *
 * Port of Pascal Unit02.pas's `HC3DTFT` for the case where the start is
 * NOT vertical. Pascal uses plane()/revplane() to project the 3D problem
 * onto a 2D plane, solve, then unproject. We solve the 3D problem directly
 * via the standard minimum-curvature formulas, finding the target tangent
 * azimuth that closes the geometry.
 *
 * Inputs:
 *   prev = start station (NS, EW, TVD, inc=I₁, azm=A₁)
 *   target inc I₂ + target position (NS_t, EW_t, TVD_t)
 *
 * Unknowns:
 *   L1 = hold length (MD until KOP)
 *   L2 = curve length (KOP → EOC)
 *   A2 = target tangent azimuth (derived)
 *
 * Position constraints (3 equations, 3 unknowns):
 *   ΔTVD = L1·cos(I₁) + (L2/2)·(cos I₁ + cos I₂)·RF
 *   ΔNS  = L1·sin(I₁)·cos(A₁) + (L2/2)·(sin I₁ cos A₁ + sin I₂ cos A₂)·RF
 *   ΔEW  = L1·sin(I₁)·sin(A₁) + (L2/2)·(sin I₁ sin A₁ + sin I₂ sin A₂)·RF
 *
 * where:
 *   DL = arccos(cos I₁ cos I₂ + sin I₁ sin I₂ cos(A₂ - A₁))   ← dogleg
 *   RF = (2/DL)·tan(DL/2)                                     ← min-curv RF
 *
 * For a fixed A₂, the system reduces to a 2×2 linear system in (L1, L2·RF).
 * We bisect on A₂ until the third equation's residual hits zero.
 */

import { type BuilderResult, type KeyPoint, DEFAULT_PPF, emptyStation } from "./types.js";
import type { Station } from "../../types.js";

export interface HC3D3DInput {
  /** Start orientation. */
  theta1: number;        // prev.inc
  prevAzm: number;       // prev.azm
  /** Target inclination. */
  theta: number;         // target.inc
  /** Target position offset from prev (world frame). */
  tgtNs: number;
  tgtEw: number;
  tgtTvd: number;
  ppf?: number;
}

export interface HC3D3DResult extends BuilderResult {
  /** Derived target azimuth (radians). */
  solvedAzm: number;
  /** Hold length until KOP. */
  l1: number;
  /** Curve length KOP → EOC. */
  l2: number;
  /** Min-curvature DLS (rad / MD-unit) for the curve segment. */
  curveDls: number;
}

/**
 * Minimum-curvature ΔTVD/ΔNS/ΔEW between two stations.
 */
function minCurvDeltas(
  i1: number, a1: number,
  i2: number, a2: number,
  L: number,
): { dT: number; dN: number; dE: number; DL: number } {
  const cosDL = Math.cos(i1) * Math.cos(i2)
              + Math.sin(i1) * Math.sin(i2) * Math.cos(a2 - a1);
  const DL = Math.acos(Math.max(-1, Math.min(1, cosDL)));
  const RF = DL < 1e-9 ? 1 : (2 / DL) * Math.tan(DL / 2);
  return {
    dT: (L / 2) * (Math.cos(i1) + Math.cos(i2)) * RF,
    dN: (L / 2) * (Math.sin(i1) * Math.cos(a1) + Math.sin(i2) * Math.cos(a2)) * RF,
    dE: (L / 2) * (Math.sin(i1) * Math.sin(a1) + Math.sin(i2) * Math.sin(a2)) * RF,
    DL,
  };
}

/**
 * For a guess of the target tangent azimuth A2, solve the 2×2 linear system
 * (from the ΔTVD and ΔNS equations) for L1 and L2·RF, then return the
 * residual of the ΔEW equation as a function of the guess.
 */
function solveLinearForAzm(
  I1: number, A1: number, I2: number, A2: number,
  dT: number, dN: number, dE: number,
): { res: number; L1: number; L2: number; DL: number; RF: number } {
  const cosDL = Math.cos(I1) * Math.cos(I2)
              + Math.sin(I1) * Math.sin(I2) * Math.cos(A2 - A1);
  const DL = Math.acos(Math.max(-1, Math.min(1, cosDL)));
  const RF = DL < 1e-9 ? 1 : (2 / DL) * Math.tan(DL / 2);

  const a1 = Math.cos(I1);
  const a2 = Math.sin(I1) * Math.cos(A1);
  const a3 = Math.sin(I1) * Math.sin(A1);
  const b1 = ((Math.cos(I1) + Math.cos(I2)) / 2) * RF;
  const b2 = ((Math.sin(I1) * Math.cos(A1) + Math.sin(I2) * Math.cos(A2)) / 2) * RF;
  const b3 = ((Math.sin(I1) * Math.sin(A1) + Math.sin(I2) * Math.sin(A2)) / 2) * RF;

  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1e-12) {
    return { res: NaN, L1: NaN, L2: NaN, DL, RF };
  }
  const L1 = (dT * b2 - dN * b1) / det;
  // b1/b2/b3 already include the RF factor (they're (1/2)·(...)·RF), so
  // solving b1·L2 = ΔTVD_c gives L2 directly — NOT L2·RF.
  const L2 = (dN * a1 - dT * a2) / det;
  const res = a3 * L1 + b3 * L2 - dE;
  return { res, L1, L2, DL, RF };
}

export function hc3d3D(input: HC3D3DInput): HC3D3DResult {
  const { theta1: I1, prevAzm: A1, theta: I2, tgtNs: dN, tgtEw: dE, tgtTvd: dT } = input;
  const ppf = input.ppf ?? DEFAULT_PPF;

  const empty: HC3D3DResult = {
    ok: false, keyPoints: [], stations: [],
    reason: "n/a",
    solvedAzm: 0, l1: 0, l2: 0, curveDls: 0,
  };

  // Bisect on A2 across [A1 - π, A1 + π]. The residual changes sign as A2
  // sweeps; the bearing of the target gives a good initial seed.
  const bearing = Math.atan2(dE, dN);
  // Scan to find a sign change.
  const samples = 32;
  let prevA = A1 - Math.PI;
  let prevRes = solveLinearForAzm(I1, A1, I2, prevA, dT, dN, dE).res;
  let lo: number | null = null;
  let hi: number | null = null;
  for (let s = 1; s <= samples; s++) {
    const a = A1 - Math.PI + (2 * Math.PI * s) / samples;
    const r = solveLinearForAzm(I1, A1, I2, a, dT, dN, dE);
    if (Number.isFinite(r.res) && Number.isFinite(prevRes) && r.res * prevRes < 0) {
      lo = prevA; hi = a;
      // Prefer the sign change closest to the bearing.
      if (Math.abs(((prevA + a) / 2 - bearing + Math.PI) % (2 * Math.PI) - Math.PI) < Math.PI / 2) {
        break;
      }
    }
    prevA = a;
    prevRes = r.res;
  }
  if (lo === null || hi === null) {
    return { ...empty, reason: "HC3D 3D solver: no azimuth solution bracket found" };
  }

  // Bisect to refine.
  let bisectLo: number = lo;
  let bisectHi: number = hi;
  for (let i = 0; i < 80; i++) {
    const mid: number = (bisectLo + bisectHi) / 2;
    const r = solveLinearForAzm(I1, A1, I2, mid, dT, dN, dE);
    if (!Number.isFinite(r.res)) break;
    const loR = solveLinearForAzm(I1, A1, I2, bisectLo, dT, dN, dE).res;
    if (r.res * loR < 0) bisectHi = mid;
    else bisectLo = mid;
    if (Math.abs(r.res) < 1e-8) break;
  }
  const A2 = (bisectLo + bisectHi) / 2;
  const sol = solveLinearForAzm(I1, A1, I2, A2, dT, dN, dE);
  if (!Number.isFinite(sol.L1) || !Number.isFinite(sol.L2) || sol.L1 < 0 || sol.L2 < 0) {
    return { ...empty, reason: "HC3D 3D solver: L1 / L2 came out negative" };
  }

  const L1 = sol.L1;
  const L2 = sol.L2;
  const DL = sol.DL;
  const curveDls = L2 < 1e-9 ? 0 : DL / L2;

  // Build the densified trajectory.
  // The output stations are in WORLD-RELATIVE coordinates (ns, ew, tvd) all
  // measured from prev (which sits at the origin). The dispatcher's
  // existing offset helper will add prev's absolute (ns, ew, tvd) and
  // shift md by prev.md.
  const stations: Station[] = [];

  // Station 0 = the start itself.
  stations.push({
    ...emptyStation(),
    md: 0, inc: I1, azm: A1,
    ns: 0, ew: 0, tvd: 0,
    dls: 0, dmd: 0, comment: "Start",
  });

  // Hold portion — every ppf along the hold.
  let prevMd = 0;
  let s = ppf;
  while (s < L1) {
    stations.push({
      ...emptyStation(),
      md: s, inc: I1, azm: A1,
      ns: s * Math.sin(I1) * Math.cos(A1),
      ew: s * Math.sin(I1) * Math.sin(A1),
      tvd: s * Math.cos(I1),
      dls: 0, dmd: s - prevMd, comment: "Keep",
    });
    prevMd = s;
    s += ppf;
  }

  // KOP keypoint at md = L1.
  const kopNs = L1 * Math.sin(I1) * Math.cos(A1);
  const kopEw = L1 * Math.sin(I1) * Math.sin(A1);
  const kopTvd = L1 * Math.cos(I1);
  const kop: KeyPoint = {
    ...emptyStation(),
    md: L1, inc: I1, azm: A1,
    ns: kopNs, ew: kopEw, tvd: kopTvd,
    dls: 0, dmd: L1, comment: "KOP (Hold-Curve 3D*)",
  };
  // Push KOP as a densified station too (so the path has a marker there).
  stations.push({
    ...kop,
    dmd: L1 - prevMd, comment: "KOP",
  });
  prevMd = L1;

  // Curve portion — densify by ppf. inc/azm interpolate linearly along arc
  // length (matches min-curvature for the constant-DLS assumption).
  s = L1 + ppf;
  while (s < L1 + L2) {
    const t = (s - L1) / L2;
    const inc = I1 + t * (I2 - I1);
    const azm = A1 + t * (A2 - A1);
    const d = minCurvDeltas(I1, A1, inc, azm, s - L1);
    stations.push({
      ...emptyStation(),
      md: s, inc, azm,
      ns: kopNs + d.dN, ew: kopEw + d.dE, tvd: kopTvd + d.dT,
      dls: curveDls, dmd: s - prevMd, comment: "Curve",
    });
    prevMd = s;
    s += ppf;
  }

  // EOC = exact target endpoint.
  const eoc: KeyPoint = {
    ...emptyStation(),
    md: L1 + L2, inc: I2, azm: A2,
    ns: dN, ew: dE, tvd: dT,
    dls: curveDls, dmd: L2, comment: "EOC (Target)",
  };
  stations.push({
    ...eoc,
    dmd: (L1 + L2) - prevMd, comment: "Curve",
  });

  return {
    ok: true,
    keyPoints: [kop, eoc],
    stations,
    solvedAzm: A2,
    l1: L1,
    l2: L2,
    curveDls,
  };
}
