/**
 * CURVE_E1..E5 — Single curve EOC variants, ports of Pascal `rocal[1]=31..35`.
 * Source: Unit02.pas:4665-4948.
 *
 *   E1 (code 31)  MD + INC + DLS  → derive AZM (quadratic, 2 candidates)
 *   E2 (code 32)  MD + AZM + DLS  → derive INC (quadratic, 2 candidates)
 *   E3 (code 33)  INC + AZM + DLS → derive MD  (closed form)
 *   E4 (code 34)  INC + TVD + DLS → derive AZM + MD (radius-from-TVD)
 *   E5 (code 35)  INC + AZM + TVD → derive DLS (midpoint / chord formula)
 *
 * Pascal pops Form07 for E1/E2/E4 when both quadratic branches are
 * feasible. Form07.radio (Unit07.pas:42-46) checks both buttons in
 * sequence:
 *     if RB1.Enabled then RB1.Checked := true;
 *     if RB2.Enabled then RB2.Checked := true;
 * Two TRadioButtons share an auto-group, so the second .Checked = true
 * overrides the first — meaning when BOTH branches are feasible,
 * RB2 (the `-sqrt` branch) wins by default. We mirror that default
 * here by trying the `-sqrt` branch first.
 *
 * The actual 3D curve uses minimum-curvature integration. Pascal's
 * plane-projection-and-c3 approach produces the same geometry: a
 * constant-DLS arc from (theta1, prevAzm) to (theta2, azmOut). MC is
 * easier to read and gives an exact closed-form endpoint.
 *
 * Output convention: stations are in WORLD-RELATIVE 3D coordinates
 * (ns, ew, tvd all populated, relative to prev = (0, 0, 0)). The
 * dispatcher just adds prev's absolute (ns, ew, tvd, md) — no rotation,
 * since the builder already accounts for the azm change along the arc.
 */

import { type BuilderResult, type KeyPoint, DEFAULT_PPF, emptyStation } from "./types.js";
import type { Station } from "../../types.js";
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
  /** True when the builder's stations are in WORLD-relative 3D (full ns/ew/tvd
   *  populated). The dispatcher uses this to skip plane rotation. */
  worldFrame: true;
}

/**
 * Minimum-curvature ΔTVD/ΔNS/ΔEW between two survey stations.
 * Standard formula used by every directional-drilling software:
 *
 *   cos(DL) = cos(θ₁)cos(θ₂) + sin(θ₁)sin(θ₂)cos(α₂-α₁)
 *   RF      = (2 / DL) · tan(DL / 2)             (RF→1 as DL→0)
 *   ΔTVD   = (dmd / 2) · (cos θ₁ + cos θ₂) · RF
 *   ΔNS    = (dmd / 2) · (sin θ₁ cos α₁ + sin θ₂ cos α₂) · RF
 *   ΔEW    = (dmd / 2) · (sin θ₁ sin α₁ + sin θ₂ sin α₂) · RF
 */
function minCurv(
  theta1: number, azm1: number,
  theta2: number, azm2: number,
  dmd: number,
): { dtvd: number; dns: number; dew: number; dl: number } {
  const cosDL = Math.cos(theta1) * Math.cos(theta2)
              + Math.sin(theta1) * Math.sin(theta2) * Math.cos(azm2 - azm1);
  const dl = Math.acos(Math.max(-1, Math.min(1, cosDL)));
  const rf = dl < 1e-9 ? 1 : (2 / dl) * Math.tan(dl / 2);
  return {
    dtvd: (dmd / 2) * (Math.cos(theta1) + Math.cos(theta2)) * rf,
    dns:  (dmd / 2) * (Math.sin(theta1) * Math.cos(azm1) + Math.sin(theta2) * Math.cos(azm2)) * rf,
    dew:  (dmd / 2) * (Math.sin(theta1) * Math.sin(azm1) + Math.sin(theta2) * Math.sin(azm2)) * rf,
    dl,
  };
}

/** Pick the short angular distance between two azimuths, keeping its sign.  */
function shortAzmDelta(from: number, to: number): number {
  let d = to - from;
  while (d >  Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

/**
 * Densify a constant-DLS 3D arc between (theta1, azm1) and (theta2, azm2)
 * by interpolating inc/azm linearly at every `ppf` step and computing each
 * station's world-relative position via cumulative minimum-curvature.
 *
 * Returns the densified stations + the exact endpoint key-point. The
 * endpoint's position is computed by a SINGLE minimum-curvature step from
 * prev → target so it's numerically exact regardless of `ppf`.
 */
function densifyMinCurv(
  theta1: number, azm1: number,
  theta2: number, azm2: number,
  dmd: number, dls: number, ppf: number,
  comment: string,
): { stations: Station[]; keyPoint: KeyPoint } {
  const dAzmShort = shortAzmDelta(azm1, azm2);

  const stations: Station[] = [];
  // Start station at prev (relative origin).
  stations.push({
    ...emptyStation(),
    md: 0, inc: theta1, azm: azm1,
    ns: 0, ew: 0, tvd: 0,
    dls: 0, dmd: 0, comment: "Start",
  });

  let prevInc = theta1;
  let prevAz = azm1;
  let prevNs = 0, prevEw = 0, prevTvd = 0;
  let prevMd = 0;
  let s = ppf;
  while (s < dmd) {
    const t = s / dmd;
    const inc = theta1 + t * (theta2 - theta1);
    const azm = azm1 + t * dAzmShort;
    const d = minCurv(prevInc, prevAz, inc, azm, s - prevMd);
    const ns  = prevNs + d.dns;
    const ew  = prevEw + d.dew;
    const tvd = prevTvd + d.dtvd;
    stations.push({
      ...emptyStation(),
      md: s, inc, azm,
      ns, ew, tvd,
      dls, dmd: s - prevMd,
      comment: "Curve",
    });
    prevInc = inc; prevAz = azm;
    prevNs = ns; prevEw = ew; prevTvd = tvd;
    prevMd = s;
    s += ppf;
  }

  // Exact endpoint via min-curv directly from start (not from last interp).
  // This makes the final station EXACTLY where it should be, removing any
  // accumulated linear-interpolation error.
  const dFull = minCurv(theta1, azm1, theta2, azm2, dmd);
  // Pascal convention: the keypoint's `dmd` field stores the FULL profile
  // length (= 1000 for a 1000-ft CURVE_E1), not the step from the last
  // densified row. This matches Unit02.pas:5215 (wlpt2[0].dmd := wlpta2[0].dmd
  // — the c3 keypoint's full curve length) and is what the BR/TR post-pass
  // expects: BR = Δinc / dmd computed against the PREVIOUS group's keypoint.
  // We push a separate "last densified" row whose dmd is the small step.
  const lastInterp: Station = {
    ...emptyStation(),
    md: dmd, inc: theta2, azm: azm2,
    ns: dFull.dns, ew: dFull.dew, tvd: dFull.dtvd,
    dls, dmd: dmd - prevMd, comment: "Curve",
  };
  stations.push(lastInterp);
  const keyPoint: KeyPoint = {
    ...emptyStation(),
    md: dmd, inc: theta2, azm: azm2,
    ns: dFull.dns, ew: dFull.dew, tvd: dFull.dtvd,
    dls, dmd, comment,
  };
  return { stations, keyPoint };
}

export function curveEoc(input: CurveEocInput): CurveEocResult {
  const { variant, theta1, prevAzm, prevTvd, prevMd } = input;
  const ppf = input.ppf ?? DEFAULT_PPF;
  const empty: CurveEocResult = {
    ok: false, keyPoints: [], stations: [], reason: "n/a", solved: {}, worldFrame: true,
  };

  let theta2 = input.inc ?? 0;
  let azmOut = input.azm ?? prevAzm;
  let dls = input.dls ?? 0;
  let dmd = (input.md ?? prevMd) - prevMd;
  const solved: CurveEocResult["solved"] = {};

  switch (variant) {
    case 1: {
      // CURVE_E1: MD + INC + DLS → AZM
      if (dmd <= 0 || dls === 0 || theta2 === 0) {
        return { ...empty, reason: "MD/INC/DLS must all be non-zero" };
      }
      if (theta1 === 0) {
        // Vertical start: the user's azm IS the curve's azm (no quadratic).
        azmOut = prevAzm;
        solved.azm = azmOut;
        break;
      }
      // Pascal Unit02.pas:4683-4711 — quadratic in a3.ns:
      //   a·n² + b·n + c = 0
      //   a = a2.ew² + a2.ns²
      //   b = -2·a2.ns·(cos θ - a2.tvd·a3.tvd)
      //   c = (cos θ - a2.tvd·a3.tvd)² - r²·a2.ew²    where r = sin θ₂
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
        const minDls = Math.abs((Math.acos(a2.tvd * a3tvd + r * Math.sqrt(a)) * 180 * 100) / (Math.PI * dmd));
        const maxDls = Math.abs((Math.acos(a2.tvd * a3tvd - r * Math.sqrt(a)) * 180 * 100) / (Math.PI * dmd));
        return { ...empty, reason: `Geometry infeasible. Min DLS = ${minDls.toFixed(3)}, Max DLS = ${maxDls.toFixed(3)} (°/100ft)` };
      }
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
        return vctToSur({ ns: a3ns, ew: a3ew, tvd: a3tvd }).azm;
      };
      // Pascal Form07.radio default: when BOTH branches are feasible, the
      // -sqrt branch (RadioButton2) ends up checked. Mirror that by trying
      // -1 first; fall back to +1 if -1 isn't feasible.
      const candNeg = tryBranch(-1);
      const candPos = tryBranch(1);
      azmOut = candNeg ?? candPos ?? prevAzm;
      solved.azm = azmOut;
      break;
    }

    case 2: {
      // CURVE_E2: MD + AZM + DLS → INC. Pascal Unit02.pas:4718-4813.
      if (dmd <= 0 || dls === 0) {
        return { ...empty, reason: "MD and DLS must be non-zero" };
      }
      if (theta1 === 0) {
        // Vertical start → inc = dmd · dls.
        theta2 = dmd * dls;
        solved.inc = theta2;
        break;
      }
      const a2 = surToVct({ inc: theta1, azm: prevAzm });
      const target = surToVct({ inc: Math.PI / 2, azm: azmOut });
      const theta = dmd * dls;
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
        if (sur.inc < 0 || sur.inc > Math.PI) return null;
        return sur.inc;
      };
      const candNeg = tryFor(-1);
      const candPos = tryFor(1);
      const pick = candNeg ?? candPos;
      if (pick === null || !Number.isFinite(pick)) {
        return { ...empty, reason: "CURVE_E2: no feasible inclination" };
      }
      theta2 = pick;
      solved.inc = theta2;
      break;
    }

    case 3: {
      // CURVE_E3: INC + AZM + DLS → MD. Closed form via dogleg integral.
      // Pascal Unit02.pas:4814-4826 uses plane projection + c3; the result
      // is dmd = arccos(prevTangent · endTangent) / dls.
      if (dls === 0) return { ...empty, reason: "DLS must be non-zero" };
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
      // CURVE_E4: INC + TVD + DLS → AZM + MD. Pascal Unit02.pas:4847-4925.
      if (input.tvd === undefined || dls === 0) {
        return { ...empty, reason: "INC/TVD/DLS must be given" };
      }
      const tvdDelta = input.tvd - prevTvd;
      if (tvdDelta <= 0) {
        return { ...empty, reason: "Target TVD must be greater than start TVD" };
      }
      if (theta1 === 0 || theta2 === 0) {
        // Vertical-pivot case (Unit02.pas:4859-4875).
        if (theta1 === 0) theta2 = Math.asin(tvdDelta * dls);
        dmd = theta2 / dls;
        azmOut = prevAzm;
        solved.md = prevMd + dmd;
        break;
      }
      const rPrime = (2 * tvdDelta) / (Math.cos(theta1) + Math.cos(theta2));
      const epsilon = 4 / (dls * rPrime) ** 2;
      const inner = (epsilon - 1) / (epsilon + 1);
      if (inner < -1 || inner > 1) {
        return { ...empty, reason: "CURVE_E4: dmd derivation out of domain" };
      }
      dmd = Math.acos(inner) / dls;
      solved.md = prevMd + dmd;
      // E1-style quadratic to derive azm now that dmd is known.
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
        return { ...empty, reason: "CURVE_E4: no feasible azimuth" };
      }
      // Same Form07-default branch ordering as E1.
      const tryBranch = (sign: 1 | -1) => {
        const a3ns = (-b + sign * Math.sqrt(disc)) / (2 * a);
        const a3ew = a2.ew !== 0
          ? (Math.cos(theta) - a3ns * a2.ns - a3tvd * a2.tvd) / a2.ew
          : Math.sqrt(Math.max(0, 1 - a3ns * a3ns - a3tvd * a3tvd));
        return vctToSur({ ns: a3ns, ew: a3ew, tvd: a3tvd }).azm;
      };
      azmOut = tryBranch(-1);
      solved.azm = azmOut;
      break;
    }

    case 5: {
      // CURVE_E5: INC + AZM + TVD → DLS. Pascal Unit02.pas:4926-4948.
      if (input.tvd === undefined) {
        return { ...empty, reason: "Target TVD must be given for CURVE_E5" };
      }
      const a2 = surToVct({ inc: theta1, azm: prevAzm });
      const a3 = surToVct({ inc: theta2, azm: azmOut });
      const tvdDelta = input.tvd - prevTvd;
      const dot = a2.ns * a3.ns + a2.ew * a3.ew + a2.tvd * a3.tvd;
      const cosLessOne = 1 - dot;
      if (Math.abs(cosLessOne) < 1e-11) {
        dls = 0;
        dmd = Math.abs(tvdDelta) / Math.max(Math.cos(theta1), 1e-9);
        solved.dls = 0;
        solved.md = prevMd + dmd;
      } else {
        const a7ns = ((a2.ns + a3.ns) * tvdDelta) / (a2.tvd + a3.tvd);
        const a7ew = ((a2.ew + a3.ew) * tvdDelta) / (a2.tvd + a3.tvd);
        const a7tvd = ((a2.tvd + a3.tvd) * tvdDelta) / (a2.tvd + a3.tvd);
        const rSquared = (a7ns ** 2 + a7ew ** 2 + a7tvd ** 2) / (2 * cosLessOne);
        const radius = Math.sqrt(rSquared);
        dls = 1 / radius;
        solved.dls = dls;
        dmd = Math.acos(Math.max(-1, Math.min(1, dot))) / dls;
        solved.md = prevMd + dmd;
      }
      break;
    }
  }

  // Densify the curve using min-curv. The endpoint is exact; intermediates
  // are linear-interpolated in (inc, azm) and accumulated via min-curv.
  if (dls === 0 || dmd === 0) {
    // Degenerate hold-style fallback: single endpoint at prev's orientation.
    const target: KeyPoint = {
      ...emptyStation(),
      md: dmd, inc: theta2, azm: azmOut, tvd: 0, ns: 0, ew: 0,
      dls: 0, dmd, comment: "EOC",
    };
    return { ok: true, keyPoints: [target], stations: [target], solved, worldFrame: true };
  }
  const { stations, keyPoint } = densifyMinCurv(
    theta1, prevAzm, theta2, azmOut, dmd, dls, ppf, "EOC",
  );
  return { ok: true, keyPoints: [keyPoint], stations, solved, worldFrame: true };
}
