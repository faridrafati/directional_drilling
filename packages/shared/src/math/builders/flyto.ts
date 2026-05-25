/**
 * FLYTO_1..FLYTO_5 — Fly-to-target builders. Pascal rocal=51..55.
 * Source: Unit02.pas:4351-5086.
 *
 * The "fly-to" family extends a curve from the previous station using the
 * STARTING tool-face (TF) and a curve DLS. The user picks ONE constraint
 * (MD, TVD, DMD, target Inc, or target Azm) and the builder derives
 * everything else.
 *
 *   FLYTO_1 (code 51)  user gives MD  → derive {dmd, inc, azm}
 *   FLYTO_2 (code 52)  user gives TVD → bisect dmd to match TVD
 *   FLYTO_3 (code 53)  user gives DMD → derive {inc, azm}
 *   FLYTO_4 (code 54)  user gives target INC → quadratic solve for dmd
 *   FLYTO_5 (code 55)  user gives target AZM → closed-form solve for dmd
 *
 * For all variants the resulting end orientation is computed from:
 *   inc = arccos(cos(I1)·cos(DL) − sin(I1)·sin(DL)·cos(TF))
 *   azm = I1=0 ? prev.azm : prev.azm + atan2(tan(DL)·sin(TF),
 *                                           sin(I1) + tan(DL)·cos(I1)·cos(TF))
 *
 * where DL = dmd·dls is the curve's total dogleg.
 *
 * Then we build a c3 curve from (theta1, prevAzm) to (inc, azm). The
 * dispatcher does the 3D translation back to world coords using the
 * computed azm.
 */

import { c3 } from "./c3.js";
import { type BuilderResult, type KeyPoint, emptyStation } from "./types.js";

export interface FlytoInput {
  /** Variant 1..5 corresponding to FLYTO_1..FLYTO_5. */
  variant: 1 | 2 | 3 | 4 | 5;
  /** Previous-station orientation. */
  theta1: number;     // prev.inc
  prevAzm: number;
  prevTvd: number;
  prevMd: number;
  /** Tool-face at the previous station (radians). For a fresh well this is 0. */
  prevTf: number;
  /** User inputs (only the subset for this variant matters). */
  md?: number;        // FLYTO_1
  tvd?: number;       // FLYTO_2
  dmd?: number;       // FLYTO_3
  inc?: number;       // FLYTO_4
  azm?: number;       // FLYTO_5
  /** DLS (always user input). */
  dls: number;
  ppf?: number;
}

export interface FlytoResult extends BuilderResult {
  solved: {
    inc?: number;
    azm?: number;
    dmd?: number;
    md?: number;
  };
}

/** Derive end (inc, azm) from prev.inc, prev.azm, prev.tf, dmd, dls. */
function deriveEnd(
  theta1: number, prevAzm: number, prevTf: number,
  dmd: number, dls: number,
): { inc: number; azm: number } {
  const DL = dmd * dls;
  if (theta1 === 0) {
    return {
      inc: Math.acos(
        Math.cos(theta1) * Math.cos(DL) -
        Math.sin(theta1) * Math.sin(DL) * Math.cos(prevTf),
      ),
      azm: prevAzm,
    };
  }
  const tDL = Math.tan(DL);
  const num = tDL * Math.sin(prevTf);
  const den = Math.sin(theta1) + tDL * Math.cos(theta1) * Math.cos(prevTf);
  let azm: number;
  if (den === 0) {
    azm = prevAzm;
  } else {
    const t = Math.atan(tDL / den);
    if (t > 0) azm = prevAzm + Math.atan(num / den);
    else if (t < 0) azm = Math.PI + prevAzm + Math.atan(num / den);
    else azm = prevAzm;
  }
  // sign() of the arcsin argument; protect against div-by-0 when azm=prevAzm
  const sinDA = Math.sin(azm - prevAzm);
  const arg = sinDA !== 0
    ? Math.sin(prevTf) * Math.sin(DL) / sinDA
    : 0;
  const clampedArg = Math.max(-1, Math.min(1, arg));
  const signFactor = arg !== 0 ? Math.sign(Math.asin(clampedArg)) || 1 : 1;
  const incArg = Math.cos(theta1) * Math.cos(DL) -
                 Math.sin(theta1) * Math.sin(DL) * Math.cos(prevTf);
  const inc = signFactor * Math.acos(Math.max(-1, Math.min(1, incArg)));
  return { inc, azm };
}

export function flyto(input: FlytoInput): FlytoResult {
  const { variant, theta1, prevAzm, prevTvd, prevMd, prevTf, dls, ppf } = input;
  const empty: FlytoResult = { ok: false, keyPoints: [], stations: [], reason: "n/a", solved: {} };

  if (dls === 0) return { ...empty, reason: "FLYTO DLS must be non-zero" };

  let dmd = 0;
  const solved: FlytoResult["solved"] = {};

  switch (variant) {
    case 1: {
      // FLYTO_1: user gives MD
      if (input.md === undefined) return { ...empty, reason: "FLYTO_1 needs MD" };
      dmd = input.md - prevMd;
      if (dmd <= 0) return { ...empty, reason: "MD must exceed previous MD" };
      solved.dmd = dmd;
      break;
    }
    case 3: {
      // FLYTO_3: user gives DMD
      if (input.dmd === undefined || input.dmd <= 0) {
        return { ...empty, reason: "FLYTO_3 needs DMD > 0" };
      }
      dmd = input.dmd;
      solved.md = prevMd + dmd;
      break;
    }
    case 4: {
      // FLYTO_4: user gives target INC. Pascal Unit02.pas:5031-5071.
      // Quadratic: a·t² + b·t + c = 0 where t = tan(DL/2).
      if (input.inc === undefined) return { ...empty, reason: "FLYTO_4 needs target Inc" };
      const targetInc = input.inc;
      if (theta1 === 0) {
        // Vertical pivot: DL = arccos(cos(targetInc) / sthg…). Simpler path:
        // inc = arccos(cos(0)*cos(DL) - 0) = arccos(cos(DL)) = DL.
        // So DL = targetInc.
        dmd = targetInc / dls;
      } else {
        const a = Math.cos(theta1) + Math.cos(targetInc);
        const b = 2 * Math.sin(theta1) * Math.cos(prevTf);
        const c = Math.cos(targetInc) - Math.cos(theta1);
        const disc = b * b - 4 * a * c;
        if (disc < 0) {
          return { ...empty, reason: "FLYTO_4: target Inc unreachable with given DLS+TF" };
        }
        const t1 = (-b + Math.sqrt(disc)) / (2 * a);
        const t2 = (-b - Math.sqrt(disc)) / (2 * a);
        // Prefer the positive root (Pascal's Form07 picker chooses the
        // positive one when both >0; we just take the first positive).
        const tPick = t1 > 0 ? t1 : t2 > 0 ? t2 : null;
        if (tPick === null) {
          return { ...empty, reason: "FLYTO_4: no positive DMD root" };
        }
        dmd = (2 * Math.atan(tPick)) / dls;
      }
      solved.dmd = dmd;
      solved.md = prevMd + dmd;
      break;
    }
    case 5: {
      // FLYTO_5: user gives target AZM. Pascal Unit02.pas:5072-5085.
      if (input.azm === undefined) return { ...empty, reason: "FLYTO_5 needs target Azm" };
      if (theta1 === 0) {
        return { ...empty, reason: "FLYTO_5: target Azm requires non-vertical start" };
      }
      const a = input.azm - prevAzm;
      const num = Math.tan(a) * Math.sin(theta1);
      const den = Math.sin(prevTf) - Math.tan(a) * Math.cos(theta1) * Math.cos(prevTf);
      if (den === 0) return { ...empty, reason: "FLYTO_5: degenerate denominator" };
      dmd = Math.atan(num / den) / dls;
      if (dmd <= 0) {
        return { ...empty, reason: "FLYTO_5: solved DMD ≤ 0 — target Azm unreachable" };
      }
      solved.dmd = dmd;
      solved.md = prevMd + dmd;
      break;
    }
    case 2: {
      // FLYTO_2: user gives TVD; bisect dmd to match.
      // Pascal Unit02.pas:4351-4466.
      if (input.tvd === undefined) return { ...empty, reason: "FLYTO_2 needs target TVD" };
      const targetTvd = input.tvd;
      const tvdDelta = targetTvd - prevTvd;
      if (tvdDelta === 0) {
        return { ...empty, reason: "FLYTO_2: target TVD equals previous TVD" };
      }

      // The local-frame TVD of a c3 curve from theta1 to theta2 at dls is
      //   tvd_local = (sin(theta2) - sin(theta1)) / dls
      // But that's a 2D plane projection. Pascal does a full 3D plane
      // (a10, a2, a3) projection, then a c3 in that plane, then unprojects.
      // For the bisection we just need a monotone TVD-vs-dmd function; we
      // approximate using the c3 builder's 2D output projected onto the
      // world TVD axis via the derived end orientation.
      const evalTvd = (trial: number): number => {
        const ends = deriveEnd(theta1, prevAzm, prevTf, trial, dls);
        // Plane-tilted c3: stations are in (ew, tvd) local. The world TVD
        // for the endpoint is the projection of the local (ew, tvd) onto
        // the world vertical axis. Since c3's TVD is along world TVD when
        // the curve plane stays vertical, we approximate world TVD as the
        // raw local TVD. (This is exact for vertical-plane curves and a
        // reasonable approximation for shallow plane-tilts.)
        const r = c3({ theta1, theta2: ends.inc, dls, ppf });
        if (!r.ok) return Number.NaN;
        const endStation = r.stations[r.stations.length - 1];
        return endStation.tvd;
      };

      // Step outward until we bracket the target.
      const step = ppf ?? 100;
      let lo = 0;
      let hi = step;
      let lastValidTvd = 0;
      const maxBracket = 50000;  // 50000 ft of MD search range
      while (hi < maxBracket) {
        const v = evalTvd(hi);
        if (!Number.isFinite(v)) { hi += step; continue; }
        lastValidTvd = v;
        if ((tvdDelta > 0 && v >= tvdDelta) || (tvdDelta < 0 && v <= tvdDelta)) break;
        lo = hi;
        hi += step;
      }
      if (hi >= maxBracket) {
        return { ...empty, reason: `FLYTO_2: target TVD not reachable within ${maxBracket} ft (last TVD ${lastValidTvd.toFixed(1)})` };
      }

      // Bisect.
      for (let iter = 0; iter < 60; iter++) {
        const mid = (lo + hi) / 2;
        const v = evalTvd(mid);
        if (!Number.isFinite(v)) { hi = mid; continue; }
        if (Math.abs(v - tvdDelta) < 1e-5) {
          dmd = mid;
          break;
        }
        if ((tvdDelta > 0 && v < tvdDelta) || (tvdDelta < 0 && v > tvdDelta)) {
          lo = mid;
        } else {
          hi = mid;
        }
        dmd = mid;
      }
      solved.dmd = dmd;
      solved.md = prevMd + dmd;
      break;
    }
  }

  // Derive end (inc, azm) and run c3.
  const ends = deriveEnd(theta1, prevAzm, prevTf, dmd, dls);
  solved.inc = ends.inc;
  solved.azm = ends.azm;

  // c3 builds the 2D curve from (theta1) → (ends.inc) at the user's dls.
  // Pascal picks a sign for dls based on whether the curve climbs or
  // drops; we let `tryDlsSigns` in the dispatcher handle that.
  const r = c3({ theta1, theta2: ends.inc, dls, ppf });
  if (!r.ok) return { ...empty, ok: false, reason: r.reason ?? "c3 failed", solved };

  // Pin the FINAL station to the exact derived MD (Pascal also writes
  // wlpt2[0].MD := wlpta2[0].MD + wlptp.MD; we add prev.md externally in
  // the dispatcher).
  const lastIdx = r.stations.length - 1;
  if (lastIdx >= 0) {
    r.stations[lastIdx].md = dmd;
    r.stations[lastIdx].dmd = dmd - (r.stations[lastIdx - 1]?.md ?? 0);
  }
  // Add an explicit KeyPoint for the end so the grid shows the derived values.
  const targetKp: KeyPoint = {
    ...emptyStation(),
    md: dmd, inc: ends.inc, azm: ends.azm,
    tvd: r.stations[lastIdx]?.tvd ?? 0,
    ew: r.stations[lastIdx]?.ew ?? 0,
    dls, dmd, comment: "FLYTO Target",
  };
  return {
    ok: true,
    keyPoints: [targetKp],
    stations: r.stations,
    solved,
  };
}
