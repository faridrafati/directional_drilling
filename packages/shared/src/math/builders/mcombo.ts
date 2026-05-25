/**
 * Multi-curve combos — codes 61..103. Pascal Unit02.pas:5087-5186.
 *
 * 5 groups × 3 subtypes = 15 profile codes covering "single curve with one
 * of {MD, TVD, DMD, INC, AZM} given and one or both of {BR (build-rate),
 * TR (turn-rate)} as the linear-rate constraint":
 *
 *   group = trunc(code / 10)    constraint sourced from:
 *     6  MD given                code mod 10 ∈ {1=BR, 2=TR, 3=both}
 *     7  TVD given               (bisection — not yet ported)
 *     8  DMD given               same {BR, TR, both}
 *     9  INC + BR  → dmd = (inc - prevInc) / br
 *    10  AZM + TR  → dmd = (azm - prevAzm) / tr
 *
 * Algorithm:
 *   1. Solve for the missing scalars (dmd, end inc, end azm) based on group.
 *   2. Compute the implied DLS = arccos(prevTangent · endTangent) / dmd.
 *   3. Build a c3 curve from prev to (end inc, end azm) at that DLS.
 *
 * The dispatcher then translates the resulting 2D stations into 3D world
 * coords using the derived azimuth.
 */

import { c3 } from "./c3.js";
import { surToVct } from "../vector.js";
import { type BuilderResult, type KeyPoint, emptyStation } from "./types.js";

export interface McomboInput {
  /** Pascal code (61..103). */
  code: number;
  theta1: number;
  prevAzm: number;
  prevMd: number;

  /** User inputs (depend on group). */
  md?: number;
  dmd?: number;
  inc?: number;
  azm?: number;
  tvd?: number;
  /** Build rate (rad / MD-unit). Positive = build, negative = drop. */
  br?: number;
  /** Turn rate  (rad / MD-unit). */
  tr?: number;
  ppf?: number;
}

export interface McomboResult extends BuilderResult {
  solved: {
    inc?: number;
    azm?: number;
    dmd?: number;
    md?: number;
    dls?: number;
  };
}

export function mcombo(input: McomboInput): McomboResult {
  const { code, theta1, prevAzm, prevMd, br, tr, ppf } = input;
  const empty: McomboResult = { ok: false, keyPoints: [], stations: [], reason: "n/a", solved: {} };

  const group = Math.trunc(code / 10);
  const subtype = code % 10;
  let dmd = 0;
  let endInc = theta1;
  let endAzm = prevAzm;
  const solved: McomboResult["solved"] = {};

  // Step 1: derive dmd.
  switch (group) {
    case 6:
      if (input.md === undefined) return { ...empty, reason: `Code ${code} needs MD` };
      dmd = input.md - prevMd;
      break;
    case 8:
      if (input.dmd === undefined) return { ...empty, reason: `Code ${code} needs DMD` };
      dmd = input.dmd;
      break;
    case 9:
      if (input.inc === undefined) return { ...empty, reason: `Code ${code} needs target Inc` };
      if (!br || br === 0) return { ...empty, reason: `Code ${code} needs non-zero BR` };
      dmd = (input.inc - theta1) / br;
      break;
    case 10:
      if (input.azm === undefined) return { ...empty, reason: `Code ${code} needs target Azm` };
      if (theta1 === 0) return { ...empty, reason: `Code ${code} requires non-vertical start` };
      if (!tr || tr === 0) return { ...empty, reason: `Code ${code} needs non-zero TR` };
      dmd = (input.azm - prevAzm) / tr;
      break;
    case 7:
      return { ...empty, reason: `TVD-based multi-curve (code ${code}) needs bisection — not yet implemented` };
    default:
      return { ...empty, reason: `Unsupported multi-curve code ${code}` };
  }
  if (dmd <= 0) {
    return { ...empty, reason: `Multi-curve code ${code}: derived DMD ≤ 0 — inputs unreachable` };
  }
  solved.dmd = dmd;
  solved.md = prevMd + dmd;

  // Step 2: derive end (inc, azm) from group + subtype.
  switch (subtype) {
    case 1:
      // BR only — azm stays
      endAzm = prevAzm;
      endInc = theta1 + dmd * (br ?? 0);
      break;
    case 2:
      // TR only — inc stays
      endAzm = prevAzm + dmd * (tr ?? 0);
      endInc = theta1;
      break;
    case 3:
      // Both
      endAzm = prevAzm + dmd * (tr ?? 0);
      endInc = theta1 + dmd * (br ?? 0);
      break;
    default:
      return { ...empty, reason: `Unsupported subtype ${subtype} for code ${code}` };
  }
  solved.inc = endInc;
  solved.azm = endAzm;

  // Step 3: derive DLS from prev / end tangents.
  const a2 = surToVct({ inc: theta1, azm: prevAzm });
  const a3 = surToVct({ inc: endInc, azm: endAzm });
  const dot = a2.ns * a3.ns + a2.ew * a3.ew + a2.tvd * a3.tvd;
  const clamped = Math.max(-1, Math.min(1, dot));
  const totalDogleg = Math.acos(clamped);
  const dls = totalDogleg / dmd;
  solved.dls = dls;

  if (dls === 0) {
    // Straight hold — single station.
    const target: KeyPoint = {
      ...emptyStation(),
      md: dmd, inc: endInc, azm: endAzm,
      tvd: 0, ew: 0, dls: 0, dmd,
      br: br ?? 0, tr: tr ?? 0,
      comment: `MC ${code}`,
    };
    return { ok: true, keyPoints: [target], stations: [target], solved };
  }

  // Build c3 from theta1 → endInc at the derived dls.
  const r = c3({ theta1, theta2: endInc, dls, ppf });
  if (!r.ok) {
    return { ...empty, ok: false, reason: r.reason ?? "c3 failed", solved };
  }
  return { ok: true, keyPoints: r.keyPoints, stations: r.stations, solved };
}
