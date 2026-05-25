/**
 * Single curve from inclination theta1 to theta2 at fixed dogleg severity.
 * Port of `c3` in old_delphi_code/Unit02.pas:1831.
 *
 *   md  = (theta2 - theta1) / dls
 *   tvd(inc) = r * (sin(inc) - sin(theta1))
 *   ew(inc)  = r * (cos(theta1) - cos(inc))
 *   where r = 1 / dls and inc(s) = theta1 + s * dls.
 *
 * 2D builder (ns = 0). Densified every `ppf` units of MD.
 */

import { type BuilderResult, type KeyPoint, DEFAULT_PPF, emptyStation } from "./types.js";
import type { Station } from "../../types.js";

export interface C3Input {
  theta1: number;
  theta2: number;
  dls: number;      // radians per unit length (signed)
  ppf?: number;
}

export function c3(input: C3Input): BuilderResult {
  const { theta1, theta2, dls } = input;
  const ppf = input.ppf ?? DEFAULT_PPF;

  if (dls === 0) {
    return { ok: false, keyPoints: [], stations: [], reason: "DLS must be non-zero" };
  }

  const r = 1 / dls;
  const eoc: KeyPoint = {
    ...emptyStation(),
    md: (theta2 - theta1) / dls,
    inc: theta2,
    tvd: r * (Math.sin(theta2) - Math.sin(theta1)),
    ew: r * (Math.cos(theta1) - Math.cos(theta2)),
    dls,
    dmd: (theta2 - theta1) / dls,
    comment: "EOC",
  };

  if (eoc.md <= 0) {
    return { ok: false, keyPoints: [eoc], stations: [], reason: "Computed MD is non-positive" };
  }

  // Densify
  const stations: Station[] = [];
  let md = 0;
  let prevMd = 0;
  for (;;) {
    const atEnd = md >= eoc.md;
    const m = atEnd ? eoc.md : md;
    const inc = theta1 + m * dls;
    stations.push({
      ...emptyStation(),
      md: m,
      inc,
      tvd: r * (Math.sin(inc) - Math.sin(theta1)),
      ew: r * (Math.cos(theta1) - Math.cos(inc)),
      dls,
      dmd: m - prevMd,
      comment: atEnd ? "Target" : "Curve",
    });
    prevMd = m;
    if (atEnd) break;
    md += ppf;
  }

  return { ok: true, keyPoints: [eoc], stations };
}
