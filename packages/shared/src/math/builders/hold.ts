/**
 * Hold (straight-line) segment.
 * Port of `Hold` in old_delphi_code/Unit02.pas:1906.
 *
 *   Given starting inclination theta1, azimuth azm, and a target MD,
 *   produce a straight-line trajectory of length MD with constant inc/azm.
 *
 *   ns(s)  = s · sin(theta1) · cos(azm)
 *   ew(s)  = s · sin(theta1) · sin(azm)
 *   tvd(s) = s · cos(theta1)
 *
 * Notes:
 *   - Unlike most other builders, Hold IS 3D (uses the actual azimuth — not just
 *     ew/tvd in the projected plane). The dispatcher passes the real azm.
 *   - DLS is zero throughout; no key points other than the target.
 */

import { type BuilderResult, type KeyPoint, DEFAULT_PPF, emptyStation } from "./types.js";
import type { Station } from "../../types.js";

export interface HoldInput {
  theta1: number;   // inclination at start (radians)
  azm: number;      // azimuth (radians)
  md: number;       // total length of the hold segment
  ppf?: number;     // densification step, default 100
}

export function hold(input: HoldInput): BuilderResult {
  const { theta1, azm, md } = input;
  const ppf = input.ppf ?? DEFAULT_PPF;

  if (md <= 0) {
    return { ok: false, keyPoints: [], stations: [], reason: "MD must be > 0" };
  }

  const target: KeyPoint = {
    ...emptyStation(),
    md,
    inc: theta1,
    azm,
    ns: md * Math.sin(theta1) * Math.cos(azm),
    ew: md * Math.sin(theta1) * Math.sin(azm),
    tvd: md * Math.cos(theta1),
    dls: 0,
    dmd: md,
    comment: "Target",
  };

  const stations = densifyHold(theta1, azm, md, ppf);
  return { ok: true, keyPoints: [target], stations };
}

/**
 * Sample the straight line every `ppf` units of MD, plus a final point at MD.
 * Mirrors the Pascal `while k=0 do ... if (i mod 2)=0 then md:=(i/2)*ppf ...` loop.
 */
function densifyHold(theta1: number, azm: number, totalMd: number, ppf: number): Station[] {
  const out: Station[] = [];
  // Walk MD from 0 to totalMd in `ppf` steps; final station is exactly totalMd.
  let s = 0;
  const sinT = Math.sin(theta1);
  const cosT = Math.cos(theta1);
  const cosA = Math.cos(azm);
  const sinA = Math.sin(azm);
  for (;;) {
    const atEnd = s >= totalMd;
    const md = atEnd ? totalMd : s;
    out.push({
      ...emptyStation(),
      md,
      inc: theta1,
      azm,
      ns: md * sinT * cosA,
      ew: md * sinT * sinA,
      tvd: md * cosT,
      dls: 0,
      dmd: md - (out[out.length - 1]?.md ?? 0),
      comment: atEnd ? "Target" : "Keep",
    });
    if (atEnd) break;
    s += ppf;
  }
  return out;
}
