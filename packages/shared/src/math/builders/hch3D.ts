/**
 * HCH in full 3D — Hold then Curve then Hold to a 3D target.
 *
 * Pascal Unit02.pas's HCH builder runs in a 2D plane after plane projection.
 * For a deviated start (or simply when the curve plane is tilted), our 2D
 * dispatcher path comes out wrong. This builder solves the 3D problem
 * directly via minimum-curvature 3-equation closure, matching Pascal's
 * output for the deviated-start case.
 *
 * Profile structure:
 *   HOLD   at (I₁, A₁)              length L0
 *   CURVE  (I₁, A₁) → (I₂, A₂)      length L1   (DLS given by user)
 *   HOLD   at (I₂, A₂)              length L2
 *
 * The user supplies:
 *   • theta1 = prev.inc, prevAzm = prev.azm  (start orientation)
 *   • theta  = target.inc                    (target inclination)
 *   • dls    = curve DLS (rad / MD-unit)     (constrains L1)
 *   • 3D target offset (ns, ew, tvd)
 *
 * L1 is constrained by DLS:
 *   DL = arccos(cos I₁ cos I₂ + sin I₁ sin I₂ cos(A₂ − A₁))
 *   L1 = DL / |dls|
 *
 * That leaves 3 unknowns (L0, L2, A₂) and 3 position equations.
 * Bisect on A₂; for each guess solve the 2×2 linear system in (L0, L2)
 * from ΔTVD + ΔNS and check the ΔEW residual.
 */

import { type BuilderResult, type KeyPoint, DEFAULT_PPF, emptyStation } from "./types.js";
import type { Station } from "../../types.js";

export interface HCH3DInput {
  theta1: number;
  prevAzm: number;
  theta: number;
  dls: number;
  tgtNs: number;
  tgtEw: number;
  tgtTvd: number;
  ppf?: number;
  /**
   * Which candidate solution to use (1 = primary, 2 = alternate). The 3D
   * scan can produce multiple all-positive-length azimuth solutions; the
   * dispatcher surfaces both to the UI's Form07 modal so the user can pick.
   * Default 1 = shortest total length.
   */
  branch?: 1 | 2;
}

export interface HCH3DResult extends BuilderResult {
  solvedAzm: number;
  l0: number;
  l1: number;
  l2: number;
  /**
   * All distinct positive-length azimuth solutions found, sorted by total
   * length ascending. The dispatcher uses this to populate `azmCandidates`
   * so the React modal can offer a branch pick. Distinct = differ by >0.5°
   * AND not 180° apart (those are spurious mirror solutions).
   */
  candidates: Array<{ solvedAzm: number; l0: number; l1: number; l2: number }>;
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
 * For a guess of A₂, derive L1 from DLS, compute the curve contribution,
 * then solve the 2×2 linear system in (L0, L2) from the remaining ΔTVD + ΔNS.
 * Return the ΔEW residual.
 */
function solveLinearForAzm(
  I1: number, A1: number, I2: number, A2: number,
  dls: number,
  dT: number, dN: number, dE: number,
): { res: number; L0: number; L1: number; L2: number } {
  const cosDL = Math.cos(I1) * Math.cos(I2)
              + Math.sin(I1) * Math.sin(I2) * Math.cos(A2 - A1);
  const DL = Math.acos(Math.max(-1, Math.min(1, cosDL)));
  const absDls = Math.abs(dls);
  if (absDls < 1e-12 || DL < 1e-9) {
    return { res: NaN, L0: NaN, L1: NaN, L2: NaN };
  }
  const L1 = DL / absDls;
  const curve = minCurvDeltas(I1, A1, I2, A2, L1);
  const remT = dT - curve.dT;
  const remN = dN - curve.dN;
  const remE = dE - curve.dE;

  // Linear system: L0·a + L2·b = rem
  //   ΔTVD: cos I₁·L0 + cos I₂·L2 = remT
  //   ΔNS:  sin I₁ cos A₁·L0 + sin I₂ cos A₂·L2 = remN
  //   ΔEW:  sin I₁ sin A₁·L0 + sin I₂ sin A₂·L2 = remE   ← residual eq.
  const a1c = Math.cos(I1);
  const a2c = Math.sin(I1) * Math.cos(A1);
  const a3c = Math.sin(I1) * Math.sin(A1);
  const b1c = Math.cos(I2);
  const b2c = Math.sin(I2) * Math.cos(A2);
  const b3c = Math.sin(I2) * Math.sin(A2);
  const det = a1c * b2c - a2c * b1c;
  if (Math.abs(det) < 1e-12) {
    return { res: NaN, L0: NaN, L1, L2: NaN };
  }
  const L0 = (remT * b2c - remN * b1c) / det;
  const L2 = (remN * a1c - remT * a2c) / det;
  const res = a3c * L0 + b3c * L2 - remE;
  return { res, L0, L1, L2 };
}

export function hch3D(input: HCH3DInput): HCH3DResult {
  const { theta1: I1, prevAzm: A1, theta: I2, dls, tgtNs: dN, tgtEw: dE, tgtTvd: dT } = input;
  const ppf = input.ppf ?? DEFAULT_PPF;
  const branch = input.branch ?? 1;

  const empty: HCH3DResult = {
    ok: false, keyPoints: [], stations: [], reason: "n/a",
    solvedAzm: 0, l0: 0, l1: 0, l2: 0, candidates: [],
  };

  if (dls === 0) {
    return { ...empty, reason: "HCH 3D solver: DLS must be non-zero" };
  }

  // Scan + bisect on A₂ (target tangent azimuth) for sign changes in the
  // residual. Take whichever bracketed solution has all three lengths
  // positive (= geometrically realisable).
  const samples = 64;
  const brackets: Array<{ lo: number; hi: number }> = [];
  let prevA = A1 - Math.PI;
  let prevR = solveLinearForAzm(I1, A1, I2, prevA, dls, dT, dN, dE).res;
  for (let s = 1; s <= samples; s++) {
    const a = A1 - Math.PI + (2 * Math.PI * s) / samples;
    const r = solveLinearForAzm(I1, A1, I2, a, dls, dT, dN, dE);
    if (Number.isFinite(r.res) && Number.isFinite(prevR) && r.res * prevR < 0) {
      brackets.push({ lo: prevA, hi: a });
    }
    prevA = a;
    prevR = r.res;
  }

  // Collect ALL all-positive-length azimuth solutions; dedupe later.
  const solutions: Array<{ L0: number; L1: number; L2: number; A2: number }> = [];
  for (const { lo: lo0, hi: hi0 } of brackets) {
    let lo = lo0;
    let hi = hi0;
    for (let i = 0; i < 80; i++) {
      const mid = (lo + hi) / 2;
      const r = solveLinearForAzm(I1, A1, I2, mid, dls, dT, dN, dE);
      if (!Number.isFinite(r.res)) break;
      const loR = solveLinearForAzm(I1, A1, I2, lo, dls, dT, dN, dE).res;
      if (r.res * loR < 0) hi = mid;
      else lo = mid;
      if (Math.abs(r.res) < 1e-8) break;
    }
    const A2 = (lo + hi) / 2;
    const r = solveLinearForAzm(I1, A1, I2, A2, dls, dT, dN, dE);
    if (Number.isFinite(r.L0) && Number.isFinite(r.L1) && Number.isFinite(r.L2)
        && r.L0 >= 0 && r.L1 >= 0 && r.L2 >= 0) {
      solutions.push({ L0: r.L0, L1: r.L1, L2: r.L2, A2 });
    }
  }
  if (solutions.length === 0) {
    return { ...empty, reason: "HCH 3D solver: no all-positive-length azimuth solution found" };
  }

  // Sort by total length ascending (matches Pascal's "shortest path" pick).
  solutions.sort((a, b) => (a.L0 + a.L1 + a.L2) - (b.L0 + b.L1 + b.L2));

  // Dedupe azimuth-near-duplicates (numerical bisection of the same root
  // from adjacent brackets) and 180°-mirror solutions (geometrically the
  // same curve, see hc3d3D / ch3d3D for the same filter).
  const norm = (x: number): number => {
    let y = x;
    while (y > Math.PI) y -= 2 * Math.PI;
    while (y < -Math.PI) y += 2 * Math.PI;
    return y;
  };
  const distinct: typeof solutions = [];
  for (const cand of solutions) {
    let isDup = false;
    for (const kept of distinct) {
      const d = Math.abs(norm(cand.A2 - kept.A2));
      const dMirror = Math.abs(d - Math.PI);
      if (d < 0.5 * Math.PI / 180 || dMirror < 0.5 * Math.PI / 180) {
        isDup = true; break;
      }
    }
    if (!isDup) distinct.push(cand);
  }

  const idx = branch === 2 ? Math.min(1, distinct.length - 1) : 0;
  const picked = distinct[idx];
  const { L0, L1, L2, A2 } = picked;

  // Densify: start → hold → KOP → curve → EOC → hold → Target.
  const stations: Station[] = [];
  stations.push({
    ...emptyStation(),
    md: 0, inc: I1, azm: A1, ns: 0, ew: 0, tvd: 0,
    dls: 0, dmd: 0, comment: "Start",
  });

  // Hold 0 → L0
  let prevMd = 0;
  let s = ppf;
  while (s < L0) {
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
  // KOP keypoint
  const kop: KeyPoint = {
    ...emptyStation(),
    md: L0, inc: I1, azm: A1,
    ns: L0 * Math.sin(I1) * Math.cos(A1),
    ew: L0 * Math.sin(I1) * Math.sin(A1),
    tvd: L0 * Math.cos(I1),
    dls: 0, dmd: L0, comment: "KOP (Computed)",
  };
  stations.push({ ...kop, dmd: L0 - prevMd });
  prevMd = L0;

  // Curve L0 → L0+L1
  const curveDls = L1 < 1e-9 ? 0 : Math.abs(dls);
  s = L0 + ppf;
  while (s < L0 + L1) {
    const t = (s - L0) / L1;
    const inc = I1 + t * (I2 - I1);
    const azm = A1 + t * (A2 - A1);
    const d = minCurvDeltas(I1, A1, inc, azm, s - L0);
    stations.push({
      ...emptyStation(),
      md: s, inc, azm,
      ns: kop.ns + d.dN, ew: kop.ew + d.dE, tvd: kop.tvd + d.dT,
      dls: curveDls, dmd: s - prevMd, comment: "Curve",
    });
    prevMd = s;
    s += ppf;
  }
  // EOC keypoint
  const cFull = minCurvDeltas(I1, A1, I2, A2, L1);
  const eoc: KeyPoint = {
    ...emptyStation(),
    md: L0 + L1, inc: I2, azm: A2,
    ns: kop.ns + cFull.dN,
    ew: kop.ew + cFull.dE,
    tvd: kop.tvd + cFull.dT,
    dls: curveDls, dmd: L1, comment: "EOC",
  };
  stations.push({ ...eoc, dmd: (L0 + L1) - prevMd, comment: "Curve" });
  prevMd = L0 + L1;

  // Hold L0+L1 → L0+L1+L2
  s = L0 + L1 + ppf;
  while (s < L0 + L1 + L2) {
    const h = s - (L0 + L1);
    stations.push({
      ...emptyStation(),
      md: s, inc: I2, azm: A2,
      ns: eoc.ns + h * Math.sin(I2) * Math.cos(A2),
      ew: eoc.ew + h * Math.sin(I2) * Math.sin(A2),
      tvd: eoc.tvd + h * Math.cos(I2),
      dls: 0, dmd: s - prevMd, comment: "Keep",
    });
    prevMd = s;
    s += ppf;
  }

  // Target keypoint
  const target: KeyPoint = {
    ...emptyStation(),
    md: L0 + L1 + L2, inc: I2, azm: A2,
    ns: dN, ew: dE, tvd: dT,
    dls: 0, dmd: L2, comment: "Target",
  };
  stations.push({ ...target, dmd: (L0 + L1 + L2) - prevMd, comment: "Keep" });

  return {
    ok: true,
    keyPoints: [kop, eoc, target],
    stations,
    solvedAzm: A2,
    l0: L0,
    l1: L1,
    l2: L2,
    candidates: distinct.map((c) => ({
      solvedAzm: c.A2, l0: c.L0, l1: c.L1, l2: c.L2,
    })),
  };
}
