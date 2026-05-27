/**
 * D3DS_HOLD (Curve-Hold-Curve-Hold, 4-segment 3D-S w/ final hold) in full 3D.
 *
 * Pascal Unit02.pas's CH2DC2 (rocal=6/16) solves a 2D quadratic after plane
 * projection. For a deviated start the 2D path mistilts the geometry; this
 * direct 3D solver handles it via grid search + Nelder-Mead refinement,
 * same pattern as d3ds3D.
 *
 * Profile structure:
 *   CURVE 1 from (I₁, A₁) → (I_mid, A_plane)   length L1 = DL1/|dls1|
 *   HOLD 1  at  (I_mid, A_plane)               length L_hold1
 *   CURVE 2 from (I_mid, A_plane) → (theta, A_plane)   length L2 = |theta-I_mid|/|dls2|
 *   HOLD 2 (FINAL) at (theta, A_plane)         length dmd  ← user input
 *
 * Mode A (ddmmdd=true, the D3DS_HOLD variant): user supplies the final
 * hold `dmd`; we solve for I_mid, A_plane, L_hold1.
 *
 * Mode B (ddmmdd=false, the D3DS_HOLD2 variant) where the user supplies
 * I_mid (thetaex) instead is NOT supported by this 3D solver yet — the
 * dispatcher's existing 2D path is used for that variant.
 */

import { type BuilderResult, type KeyPoint, DEFAULT_PPF, emptyStation } from "./types.js";
import type { Station } from "../../types.js";

export interface D3DSHold3DInput {
  theta1: number;
  prevAzm: number;
  theta: number;
  dls1: number;
  dls2: number;
  dmd: number;
  tgtNs: number;
  tgtEw: number;
  tgtTvd: number;
  ppf?: number;
}

export interface D3DSHold3DResult extends BuilderResult {
  solvedMidInc: number;
  solvedPlaneAzm: number;
  l1: number;
  lHold1: number;
  l2: number;
  lHold2: number;
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
  const DL = Math.abs(theta - Imid);
  const RF = DL < 1e-9 ? 1 : (2 / DL) * Math.tan(DL / 2);
  const dh = (L2 / 2) * (Math.sin(Imid) + Math.sin(theta)) * RF;
  return {
    dT: (L2 / 2) * (Math.cos(Imid) + Math.cos(theta)) * RF,
    dN: dh * Math.cos(Aplane),
    dE: dh * Math.sin(Aplane),
  };
}

interface Computed {
  L1: number; L2: number; L_hold1: number;
  RN: number; RE: number;
}

function compute(
  I1: number, A1: number, theta: number,
  Imid: number, Aplane: number,
  dls1: number, dls2: number, dmd: number,
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
  // Final hold contribution at (theta, A_plane).
  const h2_dT = dmd * Math.cos(theta);
  const h2_dN = dmd * Math.sin(theta) * Math.cos(Aplane);
  const h2_dE = dmd * Math.sin(theta) * Math.sin(Aplane);

  const rem_T = dT - c1.dT - c2.dT - h2_dT;
  const rem_N = dN - c1.dN - c2.dN - h2_dN;
  const rem_E = dE - c1.dE - c2.dE - h2_dE;

  const L_hold1 = rem_T / Math.cos(Imid);
  const RN = rem_N - L_hold1 * Math.sin(Imid) * Math.cos(Aplane);
  const RE = rem_E - L_hold1 * Math.sin(Imid) * Math.sin(Aplane);

  return { L1, L2, L_hold1, RN, RE };
}

export function d3dsHold3D(input: D3DSHold3DInput): D3DSHold3DResult {
  const { theta1: I1, prevAzm: A1, theta, dls1, dls2, dmd,
          tgtNs: dN, tgtEw: dE, tgtTvd: dT } = input;
  const ppf = input.ppf ?? DEFAULT_PPF;

  const empty: D3DSHold3DResult = {
    ok: false, keyPoints: [], stations: [], reason: "n/a",
    solvedMidInc: 0, solvedPlaneAzm: 0, l1: 0, lHold1: 0, l2: 0, lHold2: 0,
  };

  if (dls1 === 0 || dls2 === 0) {
    return { ...empty, reason: "D3DS_HOLD 3D solver: both DLS values must be non-zero" };
  }

  const errSquared = (Imid: number, Aplane: number): number => {
    const c = compute(I1, A1, theta, Imid, Aplane, dls1, dls2, dmd, dT, dN, dE);
    if (!c) return Infinity;
    if (!Number.isFinite(c.L_hold1) || c.L1 < 0 || c.L2 < 0 || c.L_hold1 < 0) return Infinity;
    return c.RN * c.RN + c.RE * c.RE;
  };

  const nI = 48;
  const nA = 96;
  let bestImid = -1, bestAplane = -1, bestErr = Infinity;
  for (let i = 1; i < nI; i++) {
    const Imid = (i / nI) * Math.PI;
    for (let j = 0; j < nA; j++) {
      const Aplane = A1 - Math.PI + (j / nA) * 2 * Math.PI + 0.00731;
      const e = errSquared(Imid, Aplane);
      if (e < bestErr) {
        bestErr = e; bestImid = Imid; bestAplane = Aplane;
      }
    }
  }
  if (bestErr === Infinity) {
    return { ...empty, reason: "D3DS_HOLD 3D solver: no feasible (I_mid, A_plane) found" };
  }

  // Nelder-Mead refinement.
  let simplex: Array<[number, number]> = [
    [bestImid, bestAplane],
    [bestImid + 0.005, bestAplane],
    [bestImid, bestAplane + 0.005],
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
  const Imid = simplex[0][0];
  const Aplane = simplex[0][1];
  const finalErr = errSquared(Imid, Aplane);
  if (finalErr > 1e-2) {
    return {
      ...empty,
      reason: `D3DS_HOLD 3D solver: residual ${finalErr.toFixed(4)} too large; geometry infeasible`,
    };
  }
  const final = compute(I1, A1, theta, Imid, Aplane, dls1, dls2, dmd, dT, dN, dE);
  if (!final || final.L1 <= 0 || final.L2 <= 0 || final.L_hold1 <= 0) {
    return { ...empty, reason: "D3DS_HOLD 3D solver: solution has non-positive segment length" };
  }

  const { L1, L2, L_hold1 } = final;
  const dls1Abs = L1 < 1e-9 ? 0 : Math.abs(dls1);
  const dls2Abs = L2 < 1e-9 ? 0 : Math.abs(dls2);

  // Densify: start → curve1 → EOC#1 → hold1 → KOP#2 → curve2 → EOC#2 → hold2 → Target.
  const stations: Station[] = [];
  stations.push({
    ...emptyStation(),
    md: 0, inc: I1, azm: A1, ns: 0, ew: 0, tvd: 0,
    dls: 0, dmd: 0, comment: "Start",
  });

  // Helper: unwrap azimuth delta to shortest path.
  const unwrap = (x: number): number => {
    let y = x;
    while (y > Math.PI) y -= 2 * Math.PI;
    while (y <= -Math.PI) y += 2 * Math.PI;
    return y;
  };

  // Curve 1
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

  // Hold 1
  s = L1 + ppf;
  while (s < L1 + L_hold1) {
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
    md: L1 + L_hold1, inc: Imid, azm: Aplane,
    ns: eoc1.ns + L_hold1 * Math.sin(Imid) * Math.cos(Aplane),
    ew: eoc1.ew + L_hold1 * Math.sin(Imid) * Math.sin(Aplane),
    tvd: eoc1.tvd + L_hold1 * Math.cos(Imid),
    dls: 0, dmd: L_hold1, comment: "KOP #2",
  };
  stations.push({ ...kop2, dmd: (L1 + L_hold1) - prevMd, comment: "Keep" });
  prevMd = L1 + L_hold1;

  // Curve 2
  s = L1 + L_hold1 + ppf;
  while (s < L1 + L_hold1 + L2) {
    const t = (s - L1 - L_hold1) / L2;
    const inc = Imid + t * (theta - Imid);
    const d = curve2Deltas(Imid, inc, Aplane, s - L1 - L_hold1);
    stations.push({
      ...emptyStation(),
      md: s, inc, azm: Aplane,
      ns: kop2.ns + d.dN, ew: kop2.ew + d.dE, tvd: kop2.tvd + d.dT,
      dls: dls2Abs, dmd: s - prevMd, comment: "Curve",
    });
    prevMd = s;
    s += ppf;
  }
  const c2Full = curve2Deltas(Imid, theta, Aplane, L2);
  const eoc2: KeyPoint = {
    ...emptyStation(),
    md: L1 + L_hold1 + L2, inc: theta, azm: Aplane,
    ns: kop2.ns + c2Full.dN, ew: kop2.ew + c2Full.dE, tvd: kop2.tvd + c2Full.dT,
    dls: dls2Abs, dmd: L2, comment: "EOC #2",
  };
  stations.push({ ...eoc2, dmd: (L1 + L_hold1 + L2) - prevMd, comment: "Curve" });
  prevMd = L1 + L_hold1 + L2;

  // Hold 2 (final hold, length dmd)
  s = L1 + L_hold1 + L2 + ppf;
  while (s < L1 + L_hold1 + L2 + dmd) {
    const h = s - L1 - L_hold1 - L2;
    stations.push({
      ...emptyStation(),
      md: s, inc: theta, azm: Aplane,
      ns: eoc2.ns + h * Math.sin(theta) * Math.cos(Aplane),
      ew: eoc2.ew + h * Math.sin(theta) * Math.sin(Aplane),
      tvd: eoc2.tvd + h * Math.cos(theta),
      dls: 0, dmd: s - prevMd, comment: "Keep",
    });
    prevMd = s;
    s += ppf;
  }
  const target: KeyPoint = {
    ...emptyStation(),
    md: L1 + L_hold1 + L2 + dmd, inc: theta, azm: Aplane,
    ns: dN, ew: dE, tvd: dT,
    dls: 0, dmd, comment: "Target",
  };
  stations.push({ ...target, dmd: (L1 + L_hold1 + L2 + dmd) - prevMd, comment: "Keep" });

  return {
    ok: true,
    keyPoints: [eoc1, kop2, eoc2, target],
    stations,
    solvedMidInc: Imid,
    solvedPlaneAzm: Aplane,
    l1: L1,
    lHold1: L_hold1,
    l2: L2,
    lHold2: dmd,
  };
}
