/**
 * Survey station — a curve to a given MD that ends at a specified inclination.
 * Port of `sursta` in old_delphi_code/Unit02.pas:2050.
 *
 *   Given theta1, target inclination `theta`, and MD,
 *   the implied radius is r = md / (theta - theta1) and dls = 1/r.
 *
 * Differs from `c3` in that MD (not DLS) is the controlled parameter.
 */

import { type BuilderResult, type KeyPoint, DEFAULT_PPF, emptyStation } from "./types.js";
import type { Station } from "../../types.js";

export interface SurstaInput {
  theta1: number;
  theta: number;
  md: number;
  ppf?: number;
}

export function sursta(input: SurstaInput): BuilderResult {
  const { theta1, theta, md } = input;
  const ppf = input.ppf ?? DEFAULT_PPF;

  if (theta === theta1) {
    return {
      ok: false, keyPoints: [], stations: [],
      reason: "theta == theta1 (use Hold instead)",
    };
  }
  if (md <= 0) {
    return { ok: false, keyPoints: [], stations: [], reason: "MD must be > 0" };
  }

  const r = md / (theta - theta1);
  const dls = 1 / r;

  const sta: KeyPoint = {
    ...emptyStation(),
    md,
    inc: theta,
    tvd: r * (Math.sin(theta) - Math.sin(theta1)),
    ew: r * (Math.cos(theta1) - Math.cos(theta)),
    dls,
    dmd: md,
    comment: "Survey Station",
  };

  const stations: Station[] = [];
  let s = 0;
  let prev = 0;
  for (;;) {
    const atEnd = s >= md;
    const m = atEnd ? md : s;
    const inc = atEnd ? theta : theta1 + m * dls;
    stations.push({
      ...emptyStation(),
      md: m,
      inc,
      tvd: atEnd ? sta.tvd : r * (Math.sin(inc) - Math.sin(theta1)),
      ew: atEnd ? sta.ew : r * (Math.cos(theta1) - Math.cos(inc)),
      dls,
      dmd: m - prev,
      comment: atEnd ? "Target" : "CURVE",
    });
    prev = m;
    if (atEnd) break;
    s += ppf;
  }
  return { ok: true, keyPoints: [sta], stations };
}
