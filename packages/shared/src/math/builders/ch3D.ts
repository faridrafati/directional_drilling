/**
 * CH (Curve-Hold, 2-row profile) in full 3D — direct min-curvature solver
 * for a deviated start.
 *
 * Pascal Unit02.pas's CH (rocal=2) solves a 2D quadratic in tan(θ/2) after a
 * plane projection. For a non-vertical prev tangent whose azimuth differs
 * from the prev→target bearing, the 2D projection tilts the problem
 * incorrectly and CH either returns the wrong target inclination or
 * "Geometry infeasible".
 *
 * Profile structure:
 *   CURVE from (I₁, A₁) → (I₂, A₂)  for length L1   (DLS given by user)
 *   HOLD  at  (I₂, A₂)              for length L2
 *
 * Unknowns: L1, L2, I2, A2.  Both I2 and A2 are unknowns here (unlike CH3D
 * where I2 is user-input) — that's what makes CH "2-row": EOC has DLS,
 * Target has TVD/NS/EW.
 *
 * Constraints:
 *   1. DL = arccos(cos I₁ cos I₂ + sin I₁ sin I₂ cos(A₂-A₁)),  L1 = DL/|dls|
 *   2. ΔTVD = (L1/2)(cos I₁ + cos I₂)·RF + L2·cos I₂
 *   3. ΔNS  = (L1/2)(sin I₁ cos A₁ + sin I₂ cos A₂)·RF + L2·sin I₂ cos A₂
 *   4. ΔEW  = (L1/2)(sin I₁ sin A₁ + sin I₂ sin A₂)·RF + L2·sin I₂ sin A₂
 *
 * Approach (nested 1D bisection):
 *   For each A₂ guess:
 *     For each I₂ guess (inner bisection): the hold tangent must point
 *     from EOC to Target — the angle of (target-EOC) from the TVD axis
 *     must equal I₂. Find I₂ where atan2(|H|, RT) = I₂.
 *   Then check the bearing: atan2(RE, RN) must equal A₂.
 *   Outer bisection on A₂ to drive the bearing residual to zero.
 */

import { type BuilderResult, type KeyPoint, DEFAULT_PPF, emptyStation } from "./types.js";
import type { Station } from "../../types.js";

export interface CH3DInput {
  /** Start orientation. */
  theta1: number;
  prevAzm: number;
  /** Curve DLS (rad / MD-unit). Positive = build; sign-flip handled by caller. */
  dls: number;
  /** Target position offset from prev (world frame). */
  tgtNs: number;
  tgtEw: number;
  tgtTvd: number;
  ppf?: number;
  /** Internal recursion guard — see hch3D.ts for the rationale. */
  __noHint?: boolean;
}

export interface CH3DDeviatedResult extends BuilderResult {
  /** Derived target inclination + azimuth. */
  solvedInc: number;
  solvedAzm: number;
  l1: number;
  l2: number;
}

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
 * For a fixed A2, find I2 such that the remaining (target - EOC) vector
 * makes angle I2 with the TVD axis. Returns I2 and the derived L1, L2, plus
 * the remaining (RN, RE, RT) vector for the outer bearing check.
 */
function solveI2(
  I1: number, A1: number, A2: number,
  dls: number,
  dT: number, dN: number, dE: number,
): { I2: number; L1: number; L2: number; RN: number; RE: number; RT: number } | null {
  const absDls = Math.abs(dls);
  if (absDls < 1e-12) return null;

  // g(I2) = atan2(sqrt(RN²+RE²), RT) - I2.  Root = self-consistent I2.
  const g = (I2: number): number => {
    const cosDL = Math.cos(I1) * Math.cos(I2)
                + Math.sin(I1) * Math.sin(I2) * Math.cos(A2 - A1);
    const DL = Math.acos(Math.max(-1, Math.min(1, cosDL)));
    if (DL < 1e-9) return I2 < 1e-9 ? 0 : -I2;   // degenerate curve
    const L1 = DL / absDls;
    const d = minCurvDeltas(I1, A1, I2, A2, L1);
    const RT = dT - d.dT;
    const RN = dN - d.dN;
    const RE = dE - d.dE;
    const H = Math.sqrt(RN * RN + RE * RE);
    return Math.atan2(H, RT) - I2;
  };

  // Scan I2 ∈ (1e-4, π−1e-4) for a sign change of g.
  const samples = 96;
  let prevI2 = 1e-4;
  let prevG = g(prevI2);
  for (let s = 1; s <= samples; s++) {
    const I2 = 1e-4 + ((Math.PI - 2e-4) * s) / samples;
    const gv = g(I2);
    if (Number.isFinite(gv) && Number.isFinite(prevG) && gv * prevG < 0) {
      // Bisect.
      let lo = prevI2, hi = I2;
      let loG = prevG;
      for (let i = 0; i < 80; i++) {
        const mid = (lo + hi) / 2;
        const mG = g(mid);
        if (!Number.isFinite(mG)) break;
        if (mG * loG < 0) hi = mid;
        else { lo = mid; loG = mG; }
        if (Math.abs(mG) < 1e-10) break;
      }
      const I2s = (lo + hi) / 2;
      const cosDL = Math.cos(I1) * Math.cos(I2s)
                  + Math.sin(I1) * Math.sin(I2s) * Math.cos(A2 - A1);
      const DL = Math.acos(Math.max(-1, Math.min(1, cosDL)));
      const L1 = DL / absDls;
      const d = minCurvDeltas(I1, A1, I2s, A2, L1);
      const RT = dT - d.dT;
      const RN = dN - d.dN;
      const RE = dE - d.dE;
      // L2 from TVD: L2 = RT / cos(I2). But if RT is small and I2 close
      // to π/2, that's unreliable — use horizontal magnitude instead.
      const H = Math.sqrt(RN * RN + RE * RE);
      const L2 = Math.cos(I2s) > 0.1 ? RT / Math.cos(I2s) : H / Math.max(Math.sin(I2s), 1e-9);
      return { I2: I2s, L1, L2, RN, RE, RT };
    }
    prevI2 = I2;
    prevG = gv;
  }
  return null;
}

/** Unwrap angle into (-π, π]. */
function unwrap(x: number): number {
  let y = x;
  while (y > Math.PI) y -= 2 * Math.PI;
  while (y <= -Math.PI) y += 2 * Math.PI;
  return y;
}

export function ch3D(input: CH3DInput): CH3DDeviatedResult {
  const { theta1: I1, prevAzm: A1, dls, tgtNs: dN, tgtEw: dE, tgtTvd: dT } = input;
  const ppf = input.ppf ?? DEFAULT_PPF;

  const empty: CH3DDeviatedResult = {
    ok: false, keyPoints: [], stations: [], reason: "n/a",
    solvedInc: 0, solvedAzm: 0, l1: 0, l2: 0,
  };

  if (dls === 0) {
    return { ...empty, reason: "CH 3D solver: DLS must be non-zero" };
  }

  // Outer: bisect on A2 in [A1-π, A1+π] for a sign change in the bearing
  // residual b(A2) = unwrap(atan2(RE, RN) - A2).
  const bearingRes = (A2: number): { res: number; sol: ReturnType<typeof solveI2> } => {
    const sol = solveI2(I1, A1, A2, dls, dT, dN, dE);
    if (!sol) return { res: NaN, sol: null };
    const bearing = Math.atan2(sol.RE, sol.RN);
    return { res: unwrap(bearing - A2), sol };
  };

  const samples = 96;
  const brackets: Array<{ lo: number; hi: number }> = [];
  let prevA = A1 - Math.PI;
  let prevR = bearingRes(prevA).res;
  for (let s = 1; s <= samples; s++) {
    const a = A1 - Math.PI + (2 * Math.PI * s) / samples;
    const r = bearingRes(a);
    if (Number.isFinite(r.res) && Number.isFinite(prevR) && r.res * prevR < 0
        && Math.abs(r.res - prevR) < Math.PI) {
      // Skip sign changes that arise from atan2 wrap (jump of ~2π).
      brackets.push({ lo: prevA, hi: a });
    }
    prevA = a;
    prevR = r.res;
  }

  type Solution = { I2: number; A2: number; L1: number; L2: number };
  const solutions: Solution[] = [];
  for (const { lo: lo0, hi: hi0 } of brackets) {
    let lo = lo0;
    let hi = hi0;
    let loR = bearingRes(lo).res;
    for (let i = 0; i < 80; i++) {
      const mid = (lo + hi) / 2;
      const m = bearingRes(mid);
      if (!Number.isFinite(m.res)) break;
      if (m.res * loR < 0) hi = mid;
      else { lo = mid; loR = m.res; }
      if (Math.abs(m.res) < 1e-9) break;
    }
    const A2 = (lo + hi) / 2;
    const m = bearingRes(A2);
    if (m.sol && Number.isFinite(m.sol.L1) && Number.isFinite(m.sol.L2)
        && m.sol.L1 > 0 && m.sol.L2 > 0) {
      solutions.push({ I2: m.sol.I2, A2, L1: m.sol.L1, L2: m.sol.L2 });
    }
  }

  if (solutions.length === 0) {
    // Port of Pascal Unit02.pas:3136-3138 ("Minimum Needed DLS to Reach
    // target"). The Pascal 2D closed-form doesn't generalise to arbitrary
    // 3D plane tilts, so we sample the solver numerically. `__noHint` guards
    // against infinite recursion from findMinDls re-invoking ch3D.
    const hint = input.__noHint ? null : findMinDls(input);
    const hintMsg = hint
      ? ` — minimum DLS needed ≈ ${hint.toFixed(3)}°/100ft`
      : "";
    return {
      ...empty,
      reason: `CH 3D solver: no curve+hold can reach the target at this DLS${hintMsg}`,
    };
  }

  // Shortest total length wins (matches Pascal's quadratic branch pick).
  solutions.sort((a, b) => (a.L1 + a.L2) - (b.L1 + b.L2));
  const { I2, A2, L1, L2 } = solutions[0];
  const curveDls = L1 < 1e-9 ? 0 : Math.abs(dls);

  // Densify: start → curve (interp) → EOC keypoint → hold (interp) → Target.
  const stations: Station[] = [];
  stations.push({
    ...emptyStation(),
    md: 0, inc: I1, azm: A1, ns: 0, ew: 0, tvd: 0,
    dls: 0, dmd: 0, comment: "Start",
  });

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

  const eocCalc = minCurvDeltas(I1, A1, I2, A2, L1);
  const eoc: KeyPoint = {
    ...emptyStation(),
    md: L1, inc: I2, azm: A2,
    ns: eocCalc.dN, ew: eocCalc.dE, tvd: eocCalc.dT,
    dls: curveDls, dmd: L1, comment: "EOC (CURVE-HOLD)",
  };
  stations.push({ ...eoc, dmd: L1 - prevMd, comment: "Curve" });
  prevMd = L1;

  // Hold L1 → L1+L2
  s = L1 + ppf;
  while (s < L1 + L2) {
    const h = s - L1;
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

  const target: KeyPoint = {
    ...emptyStation(),
    md: L1 + L2, inc: I2, azm: A2,
    ns: dN, ew: dE, tvd: dT,
    dls: 0, dmd: L2, comment: "Target",
  };
  stations.push({ ...target, dmd: (L1 + L2) - prevMd, comment: "Keep" });

  return {
    ok: true,
    keyPoints: [eoc, target],
    stations,
    solvedInc: I2,
    solvedAzm: A2,
    l1: L1,
    l2: L2,
  };
}

/**
 * Find the minimum DLS that would make the CH geometry close. Numerical
 * sweep + bisection on a scale factor applied to the user's DLS — see
 * the same pattern in hch3D.ts.
 *
 * Returns the answer in deg/100 length-unit (the user-facing display unit).
 */
function findMinDls(input: CH3DInput): number | null {
  const probe = (dlsTry: number): boolean => {
    const r = ch3D({ ...input, dls: dlsTry, __noHint: true });
    return r.ok;
  };
  const sign = input.dls > 0 ? 1 : -1;
  const absDls = Math.abs(input.dls);
  const ladder = [1.02, 1.05, 1.1, 1.2, 1.5, 2, 3, 5, 8, 13, 21, 34, 55, 100];
  let kLo: number | null = null;
  let kHi: number | null = null;
  let prevK = 1;
  for (const k of ladder) {
    if (probe(sign * absDls * k)) {
      kLo = prevK;
      kHi = k;
      break;
    }
    prevK = k;
  }
  if (kHi === null || kLo === null) return null;
  let lo = kLo;
  let hi = kHi;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (probe(sign * absDls * mid)) hi = mid;
    else lo = mid;
    if (hi - lo < 1e-4) break;
  }
  return (absDls * hi * 18000) / Math.PI;
}
