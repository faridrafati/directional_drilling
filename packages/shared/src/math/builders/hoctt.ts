/**
 * HOCTT — single arc from theta1 directly to the target (tgtx, tgty).
 * Port of `HOCTT` in old_delphi_code/Unit02.pas:1742.
 *
 *   Let a = inclination of the vector (ns=0, ew=tgtx, tvd=tgty).
 *   End inclination = 2a − theta1 (reflection of the start inclination about
 *   the chord direction).
 *   DLS magnitude from chord-length identity:  |dls| = sqrt(2(1-cos Δθ)) / |chord|
 *   Sign depends on whether theta1 > a (left turn) or < a (right turn).
 *
 * 2D builder (ns = 0).
 */

import { type BuilderResult, type KeyPoint, DEFAULT_PPF, emptyStation } from "./types.js";
import { vctToSur } from "../vector.js";
import type { Station } from "../../types.js";

const EPS = 1e-8;

export interface HocttInput {
  theta1: number;
  tgtx: number;
  tgty: number;
  ppf?: number;
}

export function hoctt(input: HocttInput): BuilderResult {
  const { theta1, tgtx, tgty } = input;
  const ppf = input.ppf ?? DEFAULT_PPF;

  // a = inclination of (ns=0, ew=tgtx, tvd=tgty)
  const { inc: a } = vctToSur({ ns: 0, ew: tgtx, tvd: tgty });
  const endInc = 2 * a - theta1;
  const chord2 = tgty * tgty + tgtx * tgtx;
  if (chord2 === 0) {
    return { ok: false, keyPoints: [], stations: [], reason: "Target is at origin" };
  }
  const magnitude = Math.sqrt((2 * (1 - Math.cos(theta1 - endInc))) / chord2);
  const dls = theta1 > a ? -magnitude : magnitude;

  const target: KeyPoint = { ...emptyStation(), comment: "Target" };

  if (Math.abs(dls) < EPS) {
    // Degenerate: theta1 already points at the target; pure hold to it.
    const md = Math.sqrt(chord2);
    target.md = md;
    target.inc = theta1;
    target.tvd = md * Math.cos(theta1);
    target.ew = md * Math.sin(theta1);
    target.dls = 0;
    target.dmd = md;
    const stations: Station[] = [];
    let s = 0;
    let prev = 0;
    for (;;) {
      const atEnd = s >= md;
      const m = atEnd ? md : s;
      stations.push({
        ...emptyStation(),
        md: m, inc: theta1,
        tvd: m * Math.cos(theta1),
        ew: m * Math.sin(theta1),
        dls: 0, dmd: m - prev,
        comment: atEnd ? "Target" : "Keep",
      });
      prev = m;
      if (atEnd) break;
      s += ppf;
    }
    return { ok: true, keyPoints: [target], stations };
  }

  // General arc case
  const r1 = 1 / dls;
  target.md = (endInc - theta1) / dls;
  target.inc = endInc;
  target.tvd = r1 * (Math.sin(endInc) - Math.sin(theta1));
  target.ew = r1 * (Math.cos(theta1) - Math.cos(endInc));
  target.dls = dls;
  target.dmd = target.md;

  const stations: Station[] = [];
  let s = 0;
  let prev = 0;
  for (;;) {
    const atEnd = s >= target.md;
    const m = atEnd ? target.md : s;
    const inc = theta1 + m * dls;
    stations.push({
      ...emptyStation(),
      md: m,
      inc,
      tvd: r1 * (Math.sin(inc) - Math.sin(theta1)),
      ew: r1 * (Math.cos(theta1) - Math.cos(inc)),
      dls,
      dmd: m - prev,
      comment: atEnd ? "Target" : "Curve",
    });
    prev = m;
    if (atEnd) break;
    s += ppf;
  }
  return { ok: true, keyPoints: [target], stations };
}
