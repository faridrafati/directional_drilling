/**
 * CURVE_E1..E5 — Single curve EOC variants, ports of Pascal `rocal[1]=31..35`.
 * Source: Unit02.pas:4665-4948.
 *
 *   Five inputs combinations the user can give for "single curve to target":
 *
 *     E1 (code 31)  MD + INC + DLS  → derive AZM (quadratic, 2 candidates)
 *     E2 (code 32)  MD + AZM + DLS  → derive INC (quadratic, 2 candidates)
 *     E3 (code 33)  INC + AZM + DLS → derive MD  (closed form)
 *     E4 (code 34)  INC + TVD + DLS → derive AZM + MD (radius-from-TVD)
 *     E5 (code 35)  INC + AZM + TVD → derive DLS (midpoint / chord formula)
 *
 *   For E1/E2/E4 Pascal pops Form07 to let the user pick between two azimuth
 *   candidates. Until the modal is ported (task #23) we pick the FIRST
 *   feasible candidate; ambiguous cases will be revisited later.
 *
 *   All five end up producing a single circular arc from prev.inc to a final
 *   inclination, in a specific azimuthal plane. We compute the missing scalar
 *   in this module, then delegate the actual densification to the c3 builder.
 *   Plane projection back to 3D is done by the dispatcher (it has access to
 *   prev's world position).
 */

import { c3 } from "./c3.js";
import { type BuilderResult, type KeyPoint, emptyStation } from "./types.js";
import { surToVct, vctToSur } from "../vector.js";

export interface CurveEocInput {
  /** Profile variant (31..35 → 1..5). */
  variant: 1 | 2 | 3 | 4 | 5;
  /** Start (prev) station orientation. */
  theta1: number;
  prevAzm: number;
  /** Start TVD — only needed for E4/E5 which involve a TVD constraint. */
  prevTvd: number;
  /** Start MD — only needed when the user gave the END MD (E1/E2). */
  prevMd: number;
  /** User inputs — only the subset for this variant is meaningful. */
  md?: number;     // E1, E2
  inc?: number;    // E1, E3, E4, E5
  azm?: number;    // E2, E3, E5
  tvd?: number;    // E4, E5
  dls?: number;    // E1, E2, E3, E4
  ppf?: number;
}

export interface CurveEocResult extends BuilderResult {
  /** The variable that was DERIVED (others were given). Useful for the grid. */
  solved: {
    inc?: number;
    azm?: number;
    dls?: number;
    md?: number;
  };
}

export function curveEoc(input: CurveEocInput): CurveEocResult {
  const { variant, theta1, prevAzm, prevTvd, prevMd, ppf } = input;
  const empty: CurveEocResult = { ok: false, keyPoints: [], stations: [], reason: "n/a", solved: {} };

  let theta2 = input.inc ?? 0;
  let azmOut = input.azm ?? prevAzm;
  let dls = input.dls ?? 0;
  let dmd = (input.md ?? prevMd) - prevMd;
  const solved: CurveEocResult["solved"] = {};

  switch (variant) {
    case 1: {
      // CURVE_E1: MD + INC + DLS → AZM
      // dmd known; theta2 known; dls known. Find azm such that the curve
      // from (theta1, prevAzm) to (theta2, azmOut) has dogleg dmd·dls.
      //
      // Pascal Unit02.pas:4665-4717. Vector setup:
      //   a2 = surToVct(theta1, prevAzm)
      //   a3 = surToVct(theta2, ?)             ← the unknown
      //   constraint: a2·a3 = cos(dmd·dls)
      //   constraint: |a3| = 1
      // Solving for (a3.ns, a3.ew) is a quadratic in a3.ns.
      if (dmd <= 0 || dls === 0 || theta2 === 0) {
        return { ...empty, reason: "MD/INC/DLS must all be non-zero" };
      }
      if (theta1 === 0) {
        // Vertical start → curve plane is defined by the user's azm,
        // so azmOut just stays prevAzm or the user's input.
        // Just produce the curve directly.
        break;
      }
      const a2 = surToVct({ inc: theta1, azm: prevAzm });
      const a3p = surToVct({ inc: theta2, azm: 0 }); // tvd component only
      const r = a3p.ns;                              // = sin(theta2) when azm=0
      const a3tvd = a3p.tvd;                         // = cos(theta2)
      const theta = dmd * dls;
      const a = a2.ew * a2.ew + a2.ns * a2.ns;
      const b = -2 * a2.ns * (Math.cos(theta) - a2.tvd * a3tvd);
      const c = (Math.cos(theta) - a2.tvd * a3tvd) ** 2 - r * r * a2.ew * a2.ew;
      const disc = b * b - 4 * a * c;
      if (disc < 0) {
        // Pascal reports min/max DLS at this point — we surface that too.
        const minDls = Math.abs((Math.acos(a2.tvd * a3tvd + r * Math.sqrt(a)) * 180 * 100) / (Math.PI * dmd));
        const maxDls = Math.abs((Math.acos(a2.tvd * a3tvd - r * Math.sqrt(a)) * 180 * 100) / (Math.PI * dmd));
        return { ...empty, reason: `Geometry infeasible. Min DLS = ${minDls.toFixed(3)}, Max DLS = ${maxDls.toFixed(3)} (°/100ft)` };
      }
      // Two solutions; try +sqrt branch first, fall back to -sqrt.
      const tryBranch = (sign: 1 | -1): number | null => {
        const a3ns = (-b + sign * Math.sqrt(disc)) / (2 * a);
        let a3ew: number;
        if (a2.ew !== 0) {
          a3ew = (Math.cos(theta) - a3ns * a2.ns - a3tvd * a2.tvd) / a2.ew;
        } else {
          const rem = 1 - a3ns * a3ns - a3tvd * a3tvd;
          if (rem < 0) return null;
          a3ew = Math.sqrt(rem);
        }
        // Reconstruct azm
        return vctToSur({ ns: a3ns, ew: a3ew, tvd: a3tvd }).azm;
      };
      const cand1 = tryBranch(1);
      const cand2 = tryBranch(-1);
      azmOut = cand1 ?? cand2 ?? prevAzm;
      solved.azm = azmOut;
      break;
    }

    case 2: {
      // CURVE_E2: MD + AZM + DLS → INC
      // Pascal Unit02.pas:4718-4813. Similar quadratic, but in a3.tvd instead.
      if (dmd <= 0 || dls === 0) {
        return { ...empty, reason: "MD and DLS must be non-zero" };
      }
      if (theta1 === 0) {
        // Vertical start → derived inc is just dmd·dls.
        theta2 = dmd * dls;
        solved.inc = theta2;
        break;
      }
      const a2 = surToVct({ inc: theta1, azm: prevAzm });
      const target = surToVct({ inc: Math.PI / 2, azm: azmOut });
      const theta = dmd * dls;
      // Pascal solves for a3.tvd via a quadratic; r = a3.ns / a3.ew.
      // We'll just iterate over the two roots and pick the first feasible.
      const tryFor = (sign: 1 | -1): number | null => {
        let a3ns = 0, a3ew = 0, a3tvd = 0;
        if (Math.abs(target.ew) > 1e-12) {
          const r = target.ns / target.ew;
          const a = (a2.ns * r + a2.ew) ** 2 + a2.tvd * a2.tvd * (r * r + 1);
          const b = -2 * (r * r + 1) * (a2.tvd * Math.cos(theta));
          const c = (r * r + 1) * Math.cos(theta) ** 2 - (a2.ns * r + a2.ew) ** 2;
          const disc = b * b - 4 * a * c;
          if (disc < 0) return null;
          a3tvd = (-b + sign * Math.sqrt(disc)) / (2 * a);
          a3ew = (Math.cos(theta) - a2.tvd * a3tvd) / (a2.ns * r + a2.ew);
          a3ns = r * a3ew;
        } else {
          // azm aligned with NS axis
          const a = a2.ns ** 2 + a2.tvd ** 2;
          const b = -2 * a2.tvd * Math.cos(theta);
          const c = Math.cos(theta) ** 2 - a2.ns ** 2;
          const disc = b * b - 4 * a * c;
          if (disc < 0) return null;
          a3tvd = (-b + sign * Math.sqrt(disc)) / (2 * a);
          a3ew = 0;
          a3ns = (Math.cos(theta) - a2.tvd * a3tvd) / a2.ns;
        }
        const sur = vctToSur({ ns: a3ns, ew: a3ew, tvd: a3tvd });
        // Inc must be positive and < π
        if (sur.inc < 0 || sur.inc > Math.PI) return null;
        return sur.inc;
      };
      const cand1 = tryFor(1);
      const cand2 = tryFor(-1);
      const pick = cand1 ?? cand2;
      if (pick === null || !Number.isFinite(pick)) {
        return { ...empty, reason: "CURVE_E2: no feasible inclination" };
      }
      theta2 = pick;
      solved.inc = theta2;
      break;
    }

    case 3: {
      // CURVE_E3: INC + AZM + DLS → MD  (closed form via Pascal Unit02.pas:4814-4826)
      // Just integrate the dogleg arc-length from theta1 to theta2 at constant dls.
      // The dispatcher's c3 builder already does this — we just compute dmd here
      // so the result includes a usable MD for the user.
      if (dls === 0) {
        return { ...empty, reason: "DLS must be non-zero" };
      }
      const a2 = surToVct({ inc: theta1, azm: prevAzm });
      const a3 = surToVct({ inc: theta2, azm: azmOut });
      const dot = a2.ns * a3.ns + a2.ew * a3.ew + a2.tvd * a3.tvd;
      const clamped = Math.max(-1, Math.min(1, dot));
      const doglegTotal = Math.acos(clamped);
      dmd = doglegTotal / dls;
      solved.md = prevMd + dmd;
      break;
    }

    case 4: {
      // CURVE_E4: INC + TVD + DLS → AZM + MD
      // Pascal Unit02.pas:4847-4925. Derive dmd from the TVD constraint, then
      // run the same quadratic as E1 to find azm.
      if (input.tvd === undefined || dls === 0) {
        return { ...empty, reason: "INC/TVD/DLS must be given" };
      }
      const tvdDelta = input.tvd - prevTvd;
      if (tvdDelta <= 0) {
        return { ...empty, reason: "Target TVD must be greater than start TVD" };
      }
      if (theta1 === 0 || theta2 === 0) {
        // Simplified vertical-pivot case (Unit02.pas:4859-4875)
        if (theta1 === 0) theta2 = Math.asin(tvdDelta * dls);
        dmd = theta2 / dls;
        azmOut = prevAzm;
        solved.md = prevMd + dmd;
        break;
      }
      // Derive dmd from chord-TVD identity (Unit02.pas:4879-4882):
      //   r' = 2·tvdDelta / (cos(theta1) + cos(theta2))
      //   ε  = 4 / (dls·r')²
      //   dmd = arccos((ε-1)/(ε+1)) / dls
      const rPrime = (2 * tvdDelta) / (Math.cos(theta1) + Math.cos(theta2));
      const epsilon = 4 / (dls * rPrime) ** 2;
      const inner = (epsilon - 1) / (epsilon + 1);
      if (inner < -1 || inner > 1) {
        return { ...empty, reason: "CURVE_E4: dmd derivation out of domain" };
      }
      dmd = Math.acos(inner) / dls;
      solved.md = prevMd + dmd;
      // Now run the E1 quadratic for azm:
      const a2 = surToVct({ inc: theta1, azm: prevAzm });
      const a3p = surToVct({ inc: theta2, azm: 0 });
      const r = a3p.ns;
      const a3tvd = a3p.tvd;
      const theta = dmd * dls;
      const a = a2.ew * a2.ew + a2.ns * a2.ns;
      const b = -2 * a2.ns * (Math.cos(theta) - a2.tvd * a3tvd);
      const c = (Math.cos(theta) - a2.tvd * a3tvd) ** 2 - r * r * a2.ew * a2.ew;
      const disc = b * b - 4 * a * c;
      if (disc < 0) {
        return { ...empty, reason: "CURVE_E4: no feasible azimuth (geometry infeasible)" };
      }
      const a3ns = (-b + Math.sqrt(disc)) / (2 * a);
      const a3ew = a2.ew !== 0
        ? (Math.cos(theta) - a3ns * a2.ns - a3tvd * a2.tvd) / a2.ew
        : Math.sqrt(Math.max(0, 1 - a3ns * a3ns - a3tvd * a3tvd));
      azmOut = vctToSur({ ns: a3ns, ew: a3ew, tvd: a3tvd }).azm;
      solved.azm = azmOut;
      break;
    }

    case 5: {
      // CURVE_E5: INC + AZM + TVD → DLS  (Pascal Unit02.pas:4926-4948)
      //   a7 = chord-midpoint vector (planar projection)
      //   DLS = 1/r where r is derived from |a7|² and a2·a3.
      if (input.tvd === undefined) {
        return { ...empty, reason: "Target TVD must be given for CURVE_E5" };
      }
      if (theta1 === 0) {
        // Vertical pivot — Pascal also handles azm fallback at line 4928.
      }
      const a2 = surToVct({ inc: theta1, azm: prevAzm });
      const a3 = surToVct({ inc: theta2, azm: azmOut });
      const tvdDelta = input.tvd - prevTvd;
      const a7ns = ((a2.ns + a3.ns) * tvdDelta) / (a2.tvd + a3.tvd);
      const a7ew = ((a2.ew + a3.ew) * tvdDelta) / (a2.tvd + a3.tvd);
      const a7tvd = ((a2.tvd + a3.tvd) * tvdDelta) / (a2.tvd + a3.tvd);
      const dot = a2.ns * a3.ns + a2.ew * a3.ew + a2.tvd * a3.tvd;
      const cosLessOne = 1 - dot;
      if (Math.abs(cosLessOne) < 1e-11) {
        dls = 0;
        dmd = Math.sqrt(a7ns ** 2 + a7ew ** 2 + a7tvd ** 2);  // straight line
        solved.dls = 0;
        solved.md = prevMd + dmd;
      } else {
        const rSquared = (a7ns ** 2 + a7ew ** 2 + a7tvd ** 2) / (2 * cosLessOne);
        const radius = Math.sqrt(rSquared);
        dls = 1 / radius;
        solved.dls = dls;
        // dmd = angle * radius = (theta2 - theta1) * radius for monotonic curve.
        dmd = Math.acos(Math.max(-1, Math.min(1, dot))) / dls;
        solved.md = prevMd + dmd;
      }
      break;
    }
  }

  // Run c3 to get the 2D curve from theta1 → theta2 at the derived dls.
  if (dls === 0) {
    // Straight hold — return a single-station result.
    const target: KeyPoint = {
      ...emptyStation(),
      md: dmd, inc: theta2, azm: azmOut, tvd: 0, ew: 0, dls: 0, dmd, comment: "EOC",
    };
    return { ok: true, keyPoints: [target], stations: [target], solved };
  }
  const r = c3({ theta1, theta2, dls, ppf });
  if (!r.ok) {
    return { ...empty, ok: false, reason: r.reason ?? "c3 builder failed", solved };
  }
  return { ok: true, keyPoints: r.keyPoints, stations: r.stations, solved };
}
