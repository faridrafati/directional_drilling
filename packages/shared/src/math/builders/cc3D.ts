/**
 * CC3D (Curve-Curve, no closure target) in full 3D — direct forward solver
 * for a deviated start.
 *
 * Pascal Unit02.pas's CC2D (rocal=4) computes two back-to-back arcs in a
 * single 2D plane; for a deviated start the 2D path forces an instantaneous
 * azimuth jump at the first station (since A_plane ≠ A_start). This solver
 * makes arc 1 a TRUE 3D curve from (I₁, A₁) to (I_mid, A_plane), so the
 * azimuth transition is smooth.
 *
 * Profile structure:
 *   ARC 1: (I₁, A₁)         → (I_mid, A_plane)   length L1 = DL1/|dls1|
 *   ARC 2: (I_mid, A_plane) → (I_tgt, A_plane)   length L2 = |I_tgt-I_mid|/|dls2|
 *
 * No bisection needed — everything is forward-computed. Endpoint NS/EW/TVD
 * is whatever the chained arcs produce.
 */

import { type BuilderResult, type KeyPoint, DEFAULT_PPF, emptyStation } from "./types.js";
import type { Station } from "../../types.js";

export interface CC3DInput {
  theta1: number;
  prevAzm: number;
  /** Mid inclination (end of arc 1, start of arc 2). */
  midInc: number;
  /** Target inclination (end of arc 2). */
  theta: number;
  /** Plane azimuth — both arc 1's target tangent and arc 2 (which is planar). */
  planeAzm: number;
  dls1: number;
  dls2: number;
  ppf?: number;
}

export interface CC3DResult extends BuilderResult {
  l1: number;
  l2: number;
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

function unwrap(x: number): number {
  let y = x;
  while (y > Math.PI) y -= 2 * Math.PI;
  while (y <= -Math.PI) y += 2 * Math.PI;
  return y;
}

export function cc3D(input: CC3DInput): CC3DResult {
  const { theta1: I1, prevAzm: A1, midInc: Imid, theta, planeAzm: Aplane,
          dls1, dls2 } = input;
  const ppf = input.ppf ?? DEFAULT_PPF;

  const empty: CC3DResult = {
    ok: false, keyPoints: [], stations: [], reason: "n/a", l1: 0, l2: 0,
  };

  if (dls1 === 0 || dls2 === 0) {
    return { ...empty, reason: "CC3D 3D solver: both DLS values must be non-zero" };
  }

  const cosDL1 = Math.cos(I1) * Math.cos(Imid)
               + Math.sin(I1) * Math.sin(Imid) * Math.cos(Aplane - A1);
  const DL1 = Math.acos(Math.max(-1, Math.min(1, cosDL1)));
  const L1 = DL1 / Math.abs(dls1);
  const L2 = Math.abs(theta - Imid) / Math.abs(dls2);

  if (L1 < 0 || L2 < 0) {
    return { ...empty, reason: "CC3D 3D solver: negative segment length" };
  }

  const dls1Abs = L1 < 1e-9 ? 0 : Math.abs(dls1);
  const dls2Abs = L2 < 1e-9 ? 0 : Math.abs(dls2);

  const stations: Station[] = [];
  stations.push({
    ...emptyStation(),
    md: 0, inc: I1, azm: A1, ns: 0, ew: 0, tvd: 0,
    dls: 0, dmd: 0, comment: "Start",
  });

  // Arc 1 densification (3D curve).
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
    dls: dls1Abs, dmd: L1, comment: "EOC #1 (Curve Curve 3D)",
  };
  stations.push({ ...eoc1, dmd: L1 - prevMd, comment: "Curve" });
  prevMd = L1;

  // Arc 2 densification (planar arc at A_plane).
  s = L1 + ppf;
  while (s < L1 + L2) {
    const t = (s - L1) / L2;
    const inc = Imid + t * (theta - Imid);
    const d = curve2Deltas(Imid, inc, Aplane, s - L1);
    stations.push({
      ...emptyStation(),
      md: s, inc, azm: Aplane,
      ns: eoc1.ns + d.dN, ew: eoc1.ew + d.dE, tvd: eoc1.tvd + d.dT,
      dls: dls2Abs, dmd: s - prevMd, comment: "Curve",
    });
    prevMd = s;
    s += ppf;
  }
  const c2Full = curve2Deltas(Imid, theta, Aplane, L2);
  const eoc2: KeyPoint = {
    ...emptyStation(),
    md: L1 + L2, inc: theta, azm: Aplane,
    ns: eoc1.ns + c2Full.dN,
    ew: eoc1.ew + c2Full.dE,
    tvd: eoc1.tvd + c2Full.dT,
    dls: dls2Abs, dmd: L2, comment: "EOC #2",
  };
  stations.push({ ...eoc2, dmd: (L1 + L2) - prevMd, comment: "Curve" });

  return {
    ok: true,
    keyPoints: [eoc1, eoc2],
    stations,
    l1: L1,
    l2: L2,
  };
}
