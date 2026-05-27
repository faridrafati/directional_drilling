/**
 * D3DS (Curve-Hold-Curve, 3-segment 3D-S) in full 3D — direct solver for a
 * deviated start.
 *
 * Pascal Unit02.pas's CH2DC1 (rocal=5/15) solves a 2D quadratic in
 * mid-inclination after a plane projection. For a deviated start whose
 * azimuth differs from the prev→target bearing, the 2D projection tilts
 * the problem incorrectly and either picks the wrong root or fails with
 * "Geometry infeasible".
 *
 * Profile structure:
 *   CURVE 1 from (I₁, A₁) → (I_mid, A_plane)   length L1 = DL1/|dls1|
 *   HOLD   at  (I_mid, A_plane)               length L_hold
 *   CURVE 2 from (I_mid, A_plane) → (theta, A_plane)   length L2 = |theta-I_mid|/|dls2|
 *
 * Constraint (matches Pascal's "single curve plane" assumption for 3D-S):
 *   Both hold and curve 2 share the same azimuth A_plane; only curve 1
 *   carries the azimuth turn from prev (A₁) to the design plane (A_plane).
 *   Curve 2 is then a vertical-plane arc at A_plane.
 *
 * Unknowns: I_mid, A_plane, L_hold (3).
 * Equations: ΔTVD, ΔNS, ΔEW (3).
 *
 * For each (I_mid, A_plane) guess:
 *   • L1 from DL1 = arccos(cos I₁ cos I_mid + sin I₁ sin I_mid cos(A_plane-A₁))
 *   • Curve 1 contributions (CT1, CN1, CE1) via min-curvature.
 *   • Curve 2 contributions (planar arc in vertical plane A_plane):
 *       Δh_in_plane = (L2/2)(sin I_mid + sin theta)·RF2
 *       ΔTVD       = (L2/2)(cos I_mid + cos theta)·RF2
 *     Then CT2 = ΔTVD, CN2 = Δh_in_plane·cos A_plane, CE2 = Δh_in_plane·sin A_plane.
 *   • L_hold = (ΔTVD - CT1 - CT2) / cos I_mid.
 *   • Residuals: ΔNS - CN1 - CN2 - L_hold·sin I_mid·cos A_plane,
 *                ΔEW - CE1 - CE2 - L_hold·sin I_mid·sin A_plane.
 *
 * Use nested 1D bisection: outer on A_plane (drives the bearing of the
 * hold-residual vector to match A_plane), inner on I_mid (drives the
 * magnitude to match L_hold·sin I_mid).
 */

import { type BuilderResult, type KeyPoint, DEFAULT_PPF, emptyStation } from "./types.js";
import type { Station } from "../../types.js";

export interface D3DS3DInput {
  theta1: number;
  prevAzm: number;
  theta: number;
  dls1: number;
  dls2: number;
  tgtNs: number;
  tgtEw: number;
  tgtTvd: number;
  ppf?: number;
  /** Internal recursion guard — see hch3D.ts for the rationale. */
  __noHint?: boolean;
  /**
   * Which candidate solution to use (1 = primary / shortest, 2 = alternate).
   * The 2D minimiser may converge on different local minima from different
   * starting points; the dispatcher surfaces both to the Form07 modal.
   * Default 1.
   */
  branch?: 1 | 2;
}

export interface D3DS3DResult extends BuilderResult {
  solvedMidInc: number;
  solvedPlaneAzm: number;
  l1: number;
  lHold: number;
  l2: number;
  /** All distinct candidates found, sorted by total length. */
  candidates: Array<{
    solvedMidInc: number;
    solvedPlaneAzm: number;
    l1: number;
    lHold: number;
    l2: number;
  }>;
}

function curve1Deltas(
  I1: number, A1: number,
  Imid: number, Aplane: number,
  L1: number,
): { dT: number; dN: number; dE: number } {
  const cosDL = Math.cos(I1) * Math.cos(Imid)
              + Math.sin(I1) * Math.sin(Imid) * Math.cos(Aplane - A1);
  const DL = Math.acos(Math.max(-1, Math.min(1, cosDL)));
  const RF = DL < 1e-9 ? 1 : (2 / DL) * Math.tan(DL / 2);
  return {
    dT: (L1 / 2) * (Math.cos(I1) + Math.cos(Imid)) * RF,
    dN: (L1 / 2) * (Math.sin(I1) * Math.cos(A1) + Math.sin(Imid) * Math.cos(Aplane)) * RF,
    dE: (L1 / 2) * (Math.sin(I1) * Math.sin(A1) + Math.sin(Imid) * Math.sin(Aplane)) * RF,
  };
}

function curve2Deltas(
  Imid: number, theta: number, Aplane: number,
  L2: number,
): { dT: number; dN: number; dE: number } {
  // Arc in the vertical plane at azimuth A_plane (no azm change).
  const DL = Math.abs(theta - Imid);
  const RF = DL < 1e-9 ? 1 : (2 / DL) * Math.tan(DL / 2);
  const dhInPlane = (L2 / 2) * (Math.sin(Imid) + Math.sin(theta)) * RF;
  return {
    dT: (L2 / 2) * (Math.cos(Imid) + Math.cos(theta)) * RF,
    dN: dhInPlane * Math.cos(Aplane),
    dE: dhInPlane * Math.sin(Aplane),
  };
}

interface Computed {
  L1: number; L2: number; L_hold: number;
  RT: number; RN: number; RE: number;
}

/** Compute everything for a (Imid, Aplane) guess. Returns null if infeasible. */
function compute(
  I1: number, A1: number, theta: number,
  Imid: number, Aplane: number,
  dls1: number, dls2: number,
  dT: number, dN: number, dE: number,
): Computed | null {
  if (Math.cos(Imid) <= 0.01) return null;
  const absDls1 = Math.abs(dls1);
  const absDls2 = Math.abs(dls2);
  if (absDls1 < 1e-12 || absDls2 < 1e-12) return null;

  const cosDL1 = Math.cos(I1) * Math.cos(Imid)
               + Math.sin(I1) * Math.sin(Imid) * Math.cos(Aplane - A1);
  const DL1 = Math.acos(Math.max(-1, Math.min(1, cosDL1)));
  const L1 = DL1 / absDls1;
  const L2 = Math.abs(theta - Imid) / absDls2;

  const c1 = curve1Deltas(I1, A1, Imid, Aplane, L1);
  const c2 = curve2Deltas(Imid, theta, Aplane, L2);

  const rem_T = dT - c1.dT - c2.dT;
  const rem_N = dN - c1.dN - c2.dN;
  const rem_E = dE - c1.dE - c2.dE;

  // L_hold from TVD: L_hold·cos(I_mid) = rem_T
  const L_hold = rem_T / Math.cos(Imid);

  // Residuals — these should be zero at the true solution.
  const RT = rem_T - L_hold * Math.cos(Imid);        // ~0 by construction
  const RN = rem_N - L_hold * Math.sin(Imid) * Math.cos(Aplane);
  const RE = rem_E - L_hold * Math.sin(Imid) * Math.sin(Aplane);

  return { L1, L2, L_hold, RT, RN, RE };
}

/** Unwrap angle into (-π, π]. */
function unwrap(x: number): number {
  let y = x;
  while (y > Math.PI) y -= 2 * Math.PI;
  while (y <= -Math.PI) y += 2 * Math.PI;
  return y;
}

export function d3ds3D(input: D3DS3DInput): D3DS3DResult {
  const { theta1: I1, prevAzm: A1, theta, dls1, dls2,
          tgtNs: dN, tgtEw: dE, tgtTvd: dT } = input;
  const ppf = input.ppf ?? DEFAULT_PPF;
  const branch = input.branch ?? 1;

  const empty: D3DS3DResult = {
    ok: false, keyPoints: [], stations: [], reason: "n/a",
    solvedMidInc: 0, solvedPlaneAzm: 0, l1: 0, lHold: 0, l2: 0,
    candidates: [],
  };

  if (dls1 === 0 || dls2 === 0) {
    return { ...empty, reason: "D3DS 3D solver: both DLS values must be non-zero" };
  }

  // Objective: |R|² = RN² + RE². Driven to zero at the true (I_mid, A_plane).
  const errSquared = (Imid: number, Aplane: number): number => {
    const c = compute(I1, A1, theta, Imid, Aplane, dls1, dls2, dT, dN, dE);
    if (!c) return Infinity;
    if (!Number.isFinite(c.L_hold) || c.L1 < 0 || c.L2 < 0 || c.L_hold < 0) return Infinity;
    return c.RN * c.RN + c.RE * c.RE;
  };

  // Coarse grid scan → record EVERY cell, not just the best, so we can later
  // identify multiple local minima for the Pascal 2-azm candidate behaviour.
  const nI = 48;
  const nA = 96;
  type Cell = { Imid: number; Aplane: number; err: number };
  const cells: Cell[] = [];
  let bestErr = Infinity;
  for (let i = 1; i < nI; i++) {
    const Imid = (i / nI) * Math.PI;
    for (let j = 0; j < nA; j++) {
      const Aplane = A1 - Math.PI + (j / nA) * 2 * Math.PI + 0.00731;
      const e = errSquared(Imid, Aplane);
      cells.push({ Imid, Aplane, err: e });
      if (e < bestErr) bestErr = e;
    }
  }
  if (bestErr === Infinity) {
    const hint = input.__noHint ? null : findMinDls(input);
    const hintMsg = hint
      ? ` — minimum DLS needed ≈ ${hint.toFixed(3)}°/100ft (applied to both arcs)`
      : "";
    return {
      ...empty,
      reason: `D3DS 3D solver: no feasible (I_mid, A_plane) found in scan${hintMsg}`,
    };
  }

  // Identify all LOCAL minima of the error surface — cells whose err is
  // smaller than all 8 grid neighbours and below a generous near-best
  // threshold. Each local minimum is a potential 2-azm candidate. We seed
  // Nelder-Mead from each.
  //
  // The grid is dense enough (~3.75° in A, ~3.75° in I) that two distinct
  // minima from the azmfind quadratic separated by tens of degrees won't
  // share a basin.
  const NEAR_BEST = Math.max(bestErr * 100, 1e3);
  const idxOf = (i: number, j: number): number => (i - 1) * nA + j;
  const localMinima: Cell[] = [];
  for (let i = 1; i < nI; i++) {
    for (let j = 0; j < nA; j++) {
      const e = cells[idxOf(i, j)].err;
      if (e > NEAR_BEST) continue;
      let isMin = true;
      for (let di = -1; di <= 1 && isMin; di++) {
        for (let dj = -1; dj <= 1 && isMin; dj++) {
          if (di === 0 && dj === 0) continue;
          const ni = i + di;
          const nj = ((j + dj) % nA + nA) % nA; // wrap A around
          if (ni < 1 || ni >= nI) continue;
          if (cells[idxOf(ni, nj)].err < e) { isMin = false; break; }
        }
      }
      if (isMin) localMinima.push(cells[idxOf(i, j)]);
    }
  }
  // Always include the global best in case its 8-neighbour test was strict.
  if (localMinima.length === 0) {
    const globalBest = cells.reduce((acc, c) => (c.err < acc.err ? c : acc), cells[0]);
    localMinima.push(globalBest);
  }
  // Sort starting points by error ascending so we refine the most-likely
  // candidates first.
  localMinima.sort((a, b) => a.err - b.err);

  // Nelder-Mead refinement helper — extracted so we can apply it to every
  // candidate starting point.
  const refine = (startImid: number, startAplane: number): { Imid: number; Aplane: number; err: number } => {
    let simplex: Array<[number, number]> = [
      [startImid, startAplane],
      [startImid + 0.005, startAplane],
      [startImid, startAplane + 0.005],
    ];
    for (let it = 0; it < 100; it++) {
      simplex.sort((a, b) => errSquared(a[0], a[1]) - errSquared(b[0], b[1]));
      const [a, b, c] = simplex;
      const fa = errSquared(a[0], a[1]);
      const fc = errSquared(c[0], c[1]);
      if (fa < 1e-12) break;
      if (Math.abs(fa - fc) < 1e-12) break;
      const cent: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const refl: [number, number] = [2 * cent[0] - c[0], 2 * cent[1] - c[1]];
      const fr = errSquared(refl[0], refl[1]);
      if (fr < fa) {
        const exp: [number, number] = [3 * cent[0] - 2 * c[0], 3 * cent[1] - 2 * c[1]];
        const fe = errSquared(exp[0], exp[1]);
        simplex[2] = fe < fr ? exp : refl;
      } else if (fr < fc) {
        simplex[2] = refl;
      } else {
        const con: [number, number] = [(cent[0] + c[0]) / 2, (cent[1] + c[1]) / 2];
        const fcon = errSquared(con[0], con[1]);
        if (fcon < fc) {
          simplex[2] = con;
        } else {
          simplex[1] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
          simplex[2] = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2];
        }
      }
    }
    simplex.sort((a, b) => errSquared(a[0], a[1]) - errSquared(b[0], b[1]));
    return {
      Imid: simplex[0][0],
      Aplane: simplex[0][1],
      err: errSquared(simplex[0][0], simplex[0][1]),
    };
  };

  // Refine each local minimum; keep only feasible (err < 1e-2, lengths > 0)
  // results. Dedupe by (Imid, Aplane) proximity (< 0.5°) so we don't surface
  // numerical near-twins of the same physical minimum.
  type Solution = {
    Imid: number; Aplane: number; L1: number; L2: number; L_hold: number;
  };
  const normAzm = (x: number): number => {
    let y = x;
    while (y > Math.PI) y -= 2 * Math.PI;
    while (y < -Math.PI) y += 2 * Math.PI;
    return y;
  };
  const refined: Solution[] = [];
  const TOO_CLOSE = 0.5 * Math.PI / 180;
  for (const start of localMinima.slice(0, 8)) {
    const r = refine(start.Imid, start.Aplane);
    if (r.err > 1e-2) continue;
    const c = compute(I1, A1, theta, r.Imid, r.Aplane, dls1, dls2, dT, dN, dE);
    if (!c || c.L1 <= 0 || c.L2 <= 0 || c.L_hold <= 0) continue;
    // Dedupe against existing solutions
    let isDup = false;
    for (const kept of refined) {
      const dAzm = Math.abs(normAzm(r.Aplane - kept.Aplane));
      const dAzmMirror = Math.abs(dAzm - Math.PI);
      const dI = Math.abs(r.Imid - kept.Imid);
      if ((dAzm < TOO_CLOSE || dAzmMirror < TOO_CLOSE) && dI < TOO_CLOSE) {
        isDup = true; break;
      }
    }
    if (!isDup) {
      refined.push({
        Imid: r.Imid, Aplane: r.Aplane,
        L1: c.L1, L2: c.L2, L_hold: c.L_hold,
      });
    }
  }

  if (refined.length === 0) {
    const hint = input.__noHint ? null : findMinDls(input);
    const hintMsg = hint
      ? ` — minimum DLS needed ≈ ${hint.toFixed(3)}°/100ft (applied to both arcs)`
      : "";
    return {
      ...empty,
      reason: `D3DS 3D solver: no feasible solution${hintMsg}`,
    };
  }

  // Sort by total length; pick the requested branch.
  refined.sort((a, b) => (a.L1 + a.L_hold + a.L2) - (b.L1 + b.L_hold + b.L2));
  const idx = branch === 2 ? Math.min(1, refined.length - 1) : 0;
  const { Imid, Aplane, L1, L2, L_hold } = refined[idx];

  const dls1Abs = L1 < 1e-9 ? 0 : Math.abs(dls1);
  const dls2Abs = L2 < 1e-9 ? 0 : Math.abs(dls2);

  // Densify: start → curve1 → EOC#1 → hold → KOP#2 → curve2 → Target.
  const stations: Station[] = [];
  stations.push({
    ...emptyStation(),
    md: 0, inc: I1, azm: A1, ns: 0, ew: 0, tvd: 0,
    dls: 0, dmd: 0, comment: "Start",
  });

  // Curve 1 densification (0 → L1)
  let prevMd = 0;
  let s = ppf;
  while (s < L1) {
    const t = s / L1;
    const inc = I1 + t * (Imid - I1);
    const azm = A1 + t * unwrap(Aplane - A1);
    const d = curve1Deltas(I1, A1, inc, azm, s);
    stations.push({
      ...emptyStation(),
      md: s, inc, azm,
      ns: d.dN, ew: d.dE, tvd: d.dT,
      dls: dls1Abs, dmd: s - prevMd, comment: "Curve",
    });
    prevMd = s;
    s += ppf;
  }
  const c1Full = curve1Deltas(I1, A1, Imid, Aplane, L1);
  const eoc1: KeyPoint = {
    ...emptyStation(),
    md: L1, inc: Imid, azm: Aplane,
    ns: c1Full.dN, ew: c1Full.dE, tvd: c1Full.dT,
    dls: dls1Abs, dmd: L1, comment: "EOC #1 3D-S",
  };
  stations.push({ ...eoc1, dmd: L1 - prevMd, comment: "Curve" });
  prevMd = L1;

  // Hold densification (L1 → L1 + L_hold)
  s = L1 + ppf;
  while (s < L1 + L_hold) {
    const h = s - L1;
    stations.push({
      ...emptyStation(),
      md: s, inc: Imid, azm: Aplane,
      ns: eoc1.ns + h * Math.sin(Imid) * Math.cos(Aplane),
      ew: eoc1.ew + h * Math.sin(Imid) * Math.sin(Aplane),
      tvd: eoc1.tvd + h * Math.cos(Imid),
      dls: 0, dmd: s - prevMd, comment: "Keep",
    });
    prevMd = s;
    s += ppf;
  }
  const kop2: KeyPoint = {
    ...emptyStation(),
    md: L1 + L_hold, inc: Imid, azm: Aplane,
    ns: eoc1.ns + L_hold * Math.sin(Imid) * Math.cos(Aplane),
    ew: eoc1.ew + L_hold * Math.sin(Imid) * Math.sin(Aplane),
    tvd: eoc1.tvd + L_hold * Math.cos(Imid),
    dls: 0, dmd: L_hold, comment: "KOP #2",
  };
  stations.push({ ...kop2, dmd: (L1 + L_hold) - prevMd, comment: "Keep" });
  prevMd = L1 + L_hold;

  // Curve 2 densification (L1+L_hold → L1+L_hold+L2). Arc 2 is planar at A_plane.
  s = L1 + L_hold + ppf;
  while (s < L1 + L_hold + L2) {
    const t = (s - L1 - L_hold) / L2;
    const inc = Imid + t * (theta - Imid);
    const d = curve2Deltas(Imid, inc, Aplane, s - L1 - L_hold);
    stations.push({
      ...emptyStation(),
      md: s, inc, azm: Aplane,
      ns: kop2.ns + d.dN, ew: kop2.ew + d.dE, tvd: kop2.tvd + d.dT,
      dls: dls2Abs, dmd: s - prevMd, comment: "Curve",
    });
    prevMd = s;
    s += ppf;
  }
  const target: KeyPoint = {
    ...emptyStation(),
    md: L1 + L_hold + L2, inc: theta, azm: Aplane,
    ns: dN, ew: dE, tvd: dT,
    dls: dls2Abs, dmd: L2, comment: "EOC Target",
  };
  stations.push({ ...target, dmd: (L1 + L_hold + L2) - prevMd, comment: "Curve" });

  return {
    ok: true,
    keyPoints: [eoc1, kop2, target],
    stations,
    solvedMidInc: Imid,
    solvedPlaneAzm: Aplane,
    l1: L1,
    lHold: L_hold,
    l2: L2,
    candidates: refined.map((s) => ({
      solvedMidInc: s.Imid,
      solvedPlaneAzm: s.Aplane,
      l1: s.L1,
      lHold: s.L_hold,
      l2: s.L2,
    })),
  };
}

/**
 * Find the minimum DLS multiplier that would make this 3D-S geometry close,
 * applied uniformly to both arcs' DLS values. Returns the SHARED min DLS in
 * deg/100 length-unit (matching Pascal's "Minimum Needed DLS" hint, which
 * is also a single number even though there are two arcs).
 *
 * Sweep + bisect on a scale factor — see hch3D.ts for the same pattern.
 */
function findMinDls(input: D3DS3DInput): number | null {
  const sign1 = input.dls1 > 0 ? 1 : -1;
  const sign2 = input.dls2 > 0 ? 1 : -1;
  const absDls1 = Math.abs(input.dls1);
  const absDls2 = Math.abs(input.dls2);
  // Use the SMALLER absolute DLS as the reporting baseline (= the limiting
  // arc whose tighter curvature the user usually needs to raise). The
  // multiplier k scales BOTH arcs uniformly.
  const baseline = Math.min(absDls1, absDls2);
  if (baseline < 1e-12) return null;
  const probe = (k: number): boolean => {
    const r = d3ds3D({
      ...input,
      dls1: sign1 * absDls1 * k,
      dls2: sign2 * absDls2 * k,
      __noHint: true,
    });
    return r.ok;
  };
  const ladder = [1.02, 1.05, 1.1, 1.2, 1.5, 2, 3, 5, 8, 13, 21, 34, 55, 100];
  let kLo: number | null = null;
  let kHi: number | null = null;
  let prevK = 1;
  for (const k of ladder) {
    if (probe(k)) {
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
    if (probe(mid)) hi = mid;
    else lo = mid;
    if (hi - lo < 1e-4) break;
  }
  return (baseline * hi * 18000) / Math.PI;
}
