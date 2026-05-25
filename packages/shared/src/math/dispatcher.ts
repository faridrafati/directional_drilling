/**
 * Trajectory dispatcher — the high-level orchestrator.
 *
 * Port of the heart of `Button3Click` in old_delphi_code/Unit02.pas:2345.
 * The Pascal version is ~500 lines of densely-nested if/else over `rocal[1]`
 * (profile type). This is a faithful but more linear re-implementation.
 *
 * Approach:
 *   1. Walk through the user's Segment[] list.
 *   2. For each adjacent pair (prev, target), pick a builder based on
 *      target.profileType.
 *   3. For 2D builders, project the 3D problem onto the vertical plane
 *      defined by the previous-station orientation and the target offset,
 *      then unproject the resulting stations back into world coordinates.
 *   4. Collect everything into a single Station[].
 *
 * Limitations vs. the original (well-documented for future hardening):
 *   - The original prompts the user via Form07 to disambiguate between
 *     two azimuth candidates in HC3DTFT/CH3DFFK. Here we always pick
 *     candidate1 unless `azimuthChoice` is supplied.
 *   - VSEC reference direction is taken from the first non-zero segment
 *     in the same way Button3Click does (using v[0]).
 *   - DLS-direction sign tracking for the "fly-by-target" 3D-S variants
 *     is simplified.
 */

import type { Station, Segment } from "../types.js";
import { surToVct, vctToSur } from "./vector.js";
import { projectToPlane, unprojectFromPlane } from "./plane.js";
import { azmFind, incFind } from "./solve.js";
import { ProfileType } from "./profile-types.js";
import { hold } from "./builders/hold.js";
import { c3 } from "./builders/c3.js";
import { sursta } from "./builders/sursta.js";
import { hoctt } from "./builders/hoctt.js";
import { hc3dtft } from "./builders/hc3dtft.js";
import { ch3dffk } from "./builders/ch3dffk.js";
import { ch } from "./builders/ch.js";
import { hch } from "./builders/hch.js";
import { ch2dc1 } from "./builders/ch2dc1.js";
import { ch2dc2 } from "./builders/ch2dc2.js";
import { cc2d } from "./builders/cc2d.js";
import { curveEoc } from "./builders/curveEoc.js";
import { flyto } from "./builders/flyto.js";
import { mcombo } from "./builders/mcombo.js";
import type { BuilderResult } from "./builders/types.js";

export interface DispatchOptions {
  /** When a builder has two azimuth solutions, which to pick (default 1). */
  azimuthChoice?: 1 | 2;
  /** Densification step in MD units (default 100). */
  ppf?: number;
}

export interface DispatchResult {
  ok: boolean;
  stations: Station[];
  /**
   * Exact milestone points per profile group, in the order they appear in the
   * group (KOP, EOC, Target, ...). Each entry's `segmentOrder` matches the
   * group's last-row order — same value the dispatcher tags densified stations
   * with — so the UI can join them.
   */
  keypoints: Array<{ segmentOrder: number; points: Station[] }>;
  errors: Array<{ segmentIndex: number; message: string }>;
}

/**
 * Calculate a full station list from a list of design segments.
 *
 * The first segment is the START station — used as origin only, never built.
 */
export function dispatch(segments: Segment[], options: DispatchOptions = {}): DispatchResult {
  const errors: DispatchResult["errors"] = [];
  const keypoints: DispatchResult["keypoints"] = [];
  if (segments.length === 0) {
    return { ok: true, stations: [], keypoints, errors };
  }

  // Sort by order to be safe; callers should already provide them in order.
  const sorted = [...segments].sort((a, b) => a.order - b.order);
  const stations: Station[] = [];

  // Push the start station verbatim.
  stations.push({ ...sorted[0] });

  // Group consecutive segments by profileType — each group represents ONE
  // profile operation (e.g. HC3D = KOP row + Target row, both with typ=1).
  // The LAST row of a group is the build target; earlier rows are milestone
  // placeholders that will be filled with computed key-point values.
  let i = 1;
  while (i < sorted.length) {
    const start = i;
    const typ = sorted[i].typ;
    while (i < sorted.length && sorted[i].typ === typ) i++;
    const groupEnd = i - 1;            // last index in this group

    // `prev` must reflect WORLD state (the running end of the path) — NOT
    // the raw input segment, whose computed cells (md/tvd/ns/ew) are 0
    // until Calculate fills them. Without this, the next group's keypoints
    // would be anchored at MD=0 again instead of continuing from where the
    // previous group ended.
    const prev: Segment = stations.length > 0
      ? (stations[stations.length - 1] as Segment)
      : sorted[start - 1];
    const target = sorted[groupEnd];   // the row the dispatcher actually solves for
    const group = sorted.slice(start, groupEnd + 1);

    const result = buildOne(prev, target, group, options);
    if (!result.ok) {
      errors.push({ segmentIndex: groupEnd, message: result.reason ?? "infeasible" });
      break;
    }
    // Drop the first station of each builder if it equals prev (avoid duplicates).
    const built = result.stations.map((s) => ({ ...s, order: target.order, typ: target.typ }));
    if (built.length > 0 && built[0].md === 0) built.shift();
    stations.push(...built);

    // Use the builder's EXACT keyPoints — they come straight from the
    // algebraic equations in hc3dtft/ch3dffk/hch/etc., NOT from sampling
    // the densified path — so KOP lands at e.g. MD=586 exactly instead of
    // the nearest 100-ft sample.
    //
    // inPlane2D / shiftBy already translate them into world coords with
    // MD shifted by prev.md, so no extra offset here.
    const groupSize = groupEnd - start + 1;
    const kp = result.keyPoints.slice(-groupSize).map((p) => ({
      ...p,
      order: target.order,
      typ: target.typ,
    }));
    keypoints.push({ segmentOrder: target.order, points: kp });
  }

  // Post-passes: fill VSEC, TF, BR, TR on every station and keypoint.
  //
  // Pascal sets these in the same loop as the dispatch (Unit02.pas:2578-2624,
  // 4471-4472, 5253-5263); doing them here as single passes over the final
  // station array is equivalent and simpler. All four depend only on the
  // completed path geometry.
  computeVsecPostPass(sorted, stations, keypoints);
  computeTfPostPass(stations, keypoints);
  computeBrTrPostPass(stations, keypoints);

  return { ok: errors.length === 0, stations, keypoints, errors };
}

/**
 * Fill BR (build-rate) and TR (turn-rate) on every station and keypoint.
 *
 * Port of Unit02.pas:2578-2579, 2585-2586, 4471-4472, etc.
 *
 *   BR = (this.inc - prev.inc) / this.dmd
 *   TR = (this.azm - prev.azm) / this.dmd
 *
 * Both are constant along a single arc, so the values land identical on
 * every densified station of that arc. We compute station-by-station using
 * consecutive deltas. Same for keypoints with prev = the previous keypoint
 * (across group boundaries — Pascal's `wlpt[0]` refers to the running
 * previous keypoint, not just the local group's).
 *
 * Edge cases:
 *   - First station / first keypoint: no prev → BR=TR=0.
 *   - dmd = 0 (duplicate MD): skip the divide.
 *   - Azimuth wraparound (±π discontinuity): unwrap before subtracting so
 *     TR doesn't spike to ±2π/dmd between e.g. 179°→-179°.
 */
function computeBrTrPostPass(
  stations: Station[],
  keypoints: DispatchResult["keypoints"],
): void {
  for (let i = 1; i < stations.length; i++) {
    const s = stations[i];
    const p = stations[i - 1];
    if (!s.dmd || s.dmd === 0) continue;
    s.br = (s.inc - p.inc) / s.dmd;
    s.tr = unwrapAzm(s.azm - p.azm) / s.dmd;
  }

  // Keypoints flow across groups too. Pascal uses the previous keypoint OR
  // the running previous station as the source of "prev" for the very first
  // keypoint (Unit02.pas:2578-2579 `wlpt2[0].br:=(wlpt2[0].inc-wlptp.inc)/wlpt2[0].dmd`,
  // where `wlptp` is the previous group's last computed station). We mirror
  // that by inserting the START station at the front of the flat walk.
  const flat: Station[] = [];
  if (stations.length > 0) flat.push(stations[0]); // implicit start as prev
  for (const g of keypoints) flat.push(...g.points);
  for (let k = 1; k < flat.length; k++) {
    const cur = flat[k];
    const prev = flat[k - 1];
    if (!cur.dmd || cur.dmd === 0) continue;
    cur.br = (cur.inc - prev.inc) / cur.dmd;
    cur.tr = unwrapAzm(cur.azm - prev.azm) / cur.dmd;
  }
}

/** Bring an azimuth-delta into [-π, π] so 179° → -179° reads as -2°, not +358°. */
function unwrapAzm(delta: number): number {
  let d = delta;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

/**
 * Fill VSEC on every station + keypoint.
 *
 * Port of Unit02.pas:2588-2595 and 5253-5263.
 *
 *   VSEC at station S = (S.ns·v0.ns + S.ew·v0.ew) / |v0|
 *
 * where v0 = (last-target.NS − start.NS, last-target.EW − start.EW).
 *
 * v0 is the **planned wellbore bearing in the horizontal plane** — projecting
 * each station's (ns, ew) onto v0 gives the signed distance along that
 * bearing, which is what reservoir engineers call "vertical section." It
 * matches the chart's x-axis on the VSEC plot.
 *
 * If v0 is degenerate (vertical well — last target has same NS/EW as start),
 * leave VSEC at 0 on every station.
 */
function computeVsecPostPass(
  sortedInput: Segment[],
  stations: Station[],
  keypoints: DispatchResult["keypoints"],
): void {
  if (sortedInput.length < 2) return;
  const start = sortedInput[0];
  const lastTarget = sortedInput[sortedInput.length - 1];
  const refNs = lastTarget.ns - start.ns;
  const refEw = lastTarget.ew - start.ew;
  const refLen = Math.sqrt(refNs * refNs + refEw * refEw);
  if (refLen === 0) return;

  const project = (ns: number, ew: number): number =>
    ((ns - start.ns) * refNs + (ew - start.ew) * refEw) / refLen;

  for (const s of stations) {
    s.vsec = project(s.ns, s.ew);
  }
  for (const g of keypoints) {
    for (const p of g.points) {
      p.vsec = project(p.ns, p.ew);
    }
  }
}

/**
 * Fill TF (tool face) on every keypoint where a curve starts/changes.
 *
 * Port of Unit02.pas:2596-2624 (and the same identity replicated for each
 * profile). The spherical-triangle formula at the START of a curve segment
 * gives the angle (around the wellbore axis at that point) between high-side
 * and the curve's instantaneous tilt direction:
 *
 *   DL  = dls · dmd                       (total dogleg over the next curve)
 *   sign = sign( sin(I2) · sin(A2−A1) / sin(DL) )
 *   |TF| = arccos( (cos(I1)·cos(DL) − cos(I2)) / (sin(I1)·sin(DL)) )
 *   TF  = sign · |TF|
 *
 * Pascal sets TF at keypoint K based on the NEXT keypoint's curve geometry
 * (so the last keypoint of the trajectory has TF=0). We do the same: walk
 * each profile group's keypoints, and for each (Kᵢ, Kᵢ₊₁) pair where the
 * next keypoint's dls and dmd are non-zero, fill Kᵢ.tf using Kᵢ₊₁'s curve.
 *
 * For stations: Pascal does NOT set TF on the densified rows — they keep
 * tf=0 — so we mirror that. (The TF column on the densified path is rarely
 * meaningful anyway: it's a curve-start property, not a per-1ft-MD property.)
 */
function computeTfPostPass(
  _stations: Station[],
  keypoints: DispatchResult["keypoints"],
): void {
  // Flatten every keypoint into one ordered list so curve transitions ACROSS
  // group boundaries are seen (e.g. CH ends → next group's CH3D starts).
  const all: Station[] = [];
  for (const g of keypoints) all.push(...g.points);

  for (let k = 0; k < all.length - 1; k++) {
    const p = all[k];
    const n = all[k + 1];
    p.tf = toolFaceAngle(p.inc, p.azm, n.inc, n.azm, n.dls, n.dmd);
  }
  // Last keypoint has no following curve → TF=0 by convention.
  if (all.length > 0) {
    all[all.length - 1].tf = 0;
  }
}

/**
 * Spherical-triangle tool-face formula. Returns a signed angle in radians.
 *
 * Returns 0 if the geometry is degenerate (DL=0, vertical pivot, or arg
 * outside [−1,1] due to floating-point drift).
 */
function toolFaceAngle(
  prevInc: number, prevAzm: number,
  curInc: number, curAzm: number,
  dls: number, dmd: number,
): number {
  const DL = dls * dmd;
  const sDL = Math.sin(DL);
  if (sDL === 0) return 0;
  const sI1 = Math.sin(prevInc);
  if (sI1 === 0) return 0;

  const arg = (Math.cos(prevInc) * Math.cos(DL) - Math.cos(curInc)) / (sI1 * sDL);
  // Clamp against fp-drift outside [-1, 1] — arccos NaNs otherwise.
  const clamped = Math.max(-1, Math.min(1, arg));
  const magnitude = Math.acos(clamped);

  const dA = curAzm - prevAzm;
  const sI2 = Math.sin(curInc);
  const sDA = Math.sin(dA);
  if (sI2 * sDA === 0) return magnitude;
  return Math.sign((sI2 * sDA) / sDL) * magnitude;
}

/**
 * Try a builder with every sign combination of the supplied DLS values,
 * starting from the user's original signs and walking outward.
 *
 * Why this exists: the builder equations encode curve *direction* in the
 * sign of DLS — positive = build (inc increases), negative = drop. If a
 * user enters +5 for a drop curve (target inc < start inc), the math
 * produces negative segment lengths and we'd reject it as infeasible
 * even though −5 would have worked. The user shouldn't have to guess the
 * sign convention; we try theirs first (so the result reflects their
 * intent when feasible) and fall back to the alternates if needed. The
 * returned BuilderResult's keypoints carry the *actual* signs used, so
 * the user can read off what direction the curve really turned.
 *
 * N DLS values → 2^N candidates. In practice N ≤ 2 so this is cheap.
 */
function tryDlsSigns(
  userDls: number[],
  build: (dls: number[]) => BuilderResult,
): BuilderResult {
  const n = userDls.length;
  const combos = 1 << n;
  let firstError: BuilderResult | null = null;
  for (let mask = 0; mask < combos; mask++) {
    const trial = userDls.map((v, i) => ((mask & (1 << i)) ? -v : v));
    const r = build(trial);
    if (r.ok) return r;
    if (!firstError) firstError = r;
  }
  return firstError as BuilderResult;
}

/** Build the segment from `prev` to `target` using the appropriate builder. */
/**
 * Build the segment from `prev` to `target` using the appropriate builder.
 * `group` contains all rows of the current profile group (1..N rows).
 *
 * Per the `Unit02.pas:rowcolor` port (see web/components/profileRoles.ts),
 * some profiles take user input on MIDDLE rows of the group rather than the
 * last one — e.g. HCH puts DLS on EOC (position 1) while the Target row
 * (position 2) holds the target coords. The dispatcher therefore needs to
 * see ALL rows of the group, not just `target`.
 */
function buildOne(
  prev: Segment,
  target: Segment,
  group: Segment[],
  options: DispatchOptions
): BuilderResult {
  const ppf = options.ppf;
  // Cheap helper: first non-zero value of `key` across the group.
  const groupVal = (key: keyof Segment): number => {
    for (const s of group) {
      const v = s[key];
      if (typeof v === "number" && v !== 0) return v;
    }
    return 0;
  };

  switch (target.typ) {
    case ProfileType.HOLD_NS:
    case ProfileType.HOLD_EW:
    case ProfileType.HOLD_VSEC: {
      // Straight hold from prev. MD is the user-given target.md - prev.md
      const md = target.md - prev.md;
      const r = hold({ theta1: prev.inc, azm: prev.azm, md, ppf });
      return shiftBy(r, prev);
    }

    case ProfileType.SURVEY_STATION: {
      const md = target.md - prev.md;
      const r = sursta({ theta1: prev.inc, theta: target.inc, md, ppf });
      return shiftBy(r, prev);
    }

    case ProfileType.TARGET: {
      // Single arc to target in the prev/target plane.
      const r2 = inPlane2D(prev, target, (tgtx, tgty) =>
        hoctt({ theta1: prev.inc, tgtx, tgty, ppf })
      );
      return r2;
    }

    case ProfileType.HC3D:
    case ProfileType.HC3D_STAR: {
      const r2 = solveAndBuild(prev, target, options, (tgtx, tgty, theta) =>
        hc3dtft({ theta1: prev.inc, tgtx, tgty, theta, ppf })
      );
      return r2;
    }

    case ProfileType.CH3D:
    case ProfileType.CH3D_STAR: {
      const r2 = solveAndBuild(prev, target, options, (tgtx, tgty, theta) =>
        ch3dffk({ theta1: prev.inc, tgtx, tgty, theta, ppf })
      );
      return r2;
    }

    case ProfileType.HCH:
    case ProfileType.HCH_STAR: {
      // DLS lives on the EOC row (position 1 of [KOP, EOC, Target]).
      // Accept either sign — HCH's `crvln = (theta - theta1)/dls` flips
      // negative for a drop curve unless dls is negative too. We try the
      // user's sign first, then fall back to the opposite.
      const dls = groupVal("dls");
      return tryDlsSigns([dls], ([d]) =>
        solveAndBuild(prev, target, options, (tgtx, tgty, theta) =>
          hch({ theta1: prev.inc, tgtx, tgty, theta, dls: d, ppf })
        )
      );
    }

    case ProfileType.CH: {
      // CH 2-row policy:
      //   row 1 (EOC, position 0)   = DLS (curve dogleg input)
      //   row 2 (Target, position 1) = TVD / NS / EW (target position input)
      //
      // CH's quadratic only finds the "build" solution with the given DLS sign.
      // If the target is MORE VERTICAL than the start angle the curve must
      // turn the other way (DLS effectively negative). Pascal punts on this
      // case ("Geometry infeasible"); we try both signs and prefer the user's
      // polarity. The output keypoint's DLS sign tells the user which way the
      // curve actually turned.
      const dls = groupVal("dls");
      return tryDlsSigns([dls], ([d]) =>
        inPlane2D(prev, target, (tgtx, tgty) =>
          ch({ theta1: prev.inc, tgtx, tgty, dls: d, ppf })
        )
      );
    }

    case ProfileType.D3DS:
    case ProfileType.D3DS_STAR:
    case ProfileType.D3DS_ALT:
    case ProfileType.D3DS_ALT_STAR: {
      // 3D-S without final hold → ch2dc1. Each arc has its own DLS row:
      //   group[0] (EOC #1) → dls1
      //   group[last]       → dls2 (falls back to dls1 if zero — Pascal default)
      // Either DLS can be entered build (+) or drop (−); we try all 4 sign
      // combos and use the first feasible one.
      const dls1Raw = group[0]?.dls || 0;
      const dls2Raw = group[group.length - 1]?.dls || dls1Raw;
      const dls1 = dls1Raw || dls2Raw;
      const dls2 = dls2Raw || dls1Raw;
      return tryDlsSigns([dls1, dls2], ([d1, d2]) =>
        solveAndBuild(prev, target, options, (tgtx, tgty, theta) =>
          ch2dc1({
            theta1: prev.inc, tgtx, tgty, theta,
            dls1: d1, dls2: d2, ppf,
          })
        )
      );
    }

    case ProfileType.D3DS_HOLD:
    case ProfileType.D3DS_HOLD_STAR:
    case ProfileType.D3DS_HOLD2:
    case ProfileType.D3DS_HOLD2_STAR: {
      // 3D-S with final hold → ch2dc2. 4 rows: EOC#1, KOP#2, EOC#2, Target.
      //   group[0] (EOC #1) → dls1
      //   group[2] (EOC #2) → dls2 (with fallback to dls1)
      //   group[3] (Target) → target XYZ + Inc + (DMD for *_HOLD2)
      // Same try-both-signs treatment as D3DS.
      const ddmmdd = target.typ === ProfileType.D3DS_HOLD || target.typ === ProfileType.D3DS_HOLD_STAR;
      const dls1Raw = group[0]?.dls || 0;
      const dls2Raw = group[2]?.dls || dls1Raw;
      const dls1 = dls1Raw || dls2Raw;
      const dls2 = dls2Raw || dls1Raw;
      const dmd = groupVal("dmd");
      return tryDlsSigns([dls1, dls2], ([d1, d2]) =>
        solveAndBuild(prev, target, options, (tgtx, tgty, theta) =>
          ch2dc2({
            theta1: prev.inc, tgtx, tgty, theta,
            dls1: d1, dls2: d2,
            thetaex: target.inc, dmd, ddmmdd, ppf,
          })
        )
      );
    }

    case ProfileType.CC3D:
    case ProfileType.CC3D_STAR: {
      // Two arcs — each gets its own angle + DLS from its row.
      // group = [EOC#1, EOC#2]; use position-by-position.
      // Each arc can be build or drop; try all 4 sign combos.
      //
      // CC3D has no editable NS/EW on either row, so target.ns/ew are 0
      // after Calculate. We must NOT let inPlane2D derive the plane azimuth
      // from the (prev → target) bearing — that would give prev.azm + 180°
      // (back to origin). Use the user-input azm directly: EOC#2's azm for
      // CC3D (where pos 1 owns azm) and EOC#1's for CC3D_STAR (pos 0 owns
      // azm). Fall back to prev.azm if the user left it blank.
      const arc1 = group[0] ?? target;
      const arc2 = group[1] ?? target;
      const userAzm =
        target.typ === ProfileType.CC3D_STAR
          ? (arc1.azm || arc2.azm || prev.azm)
          : (arc2.azm || arc1.azm || prev.azm);
      return tryDlsSigns([arc1.dls, arc2.dls], ([d1, d2]) =>
        inPlane2D(
          prev,
          target,
          () =>
            cc2d({
              theta1: prev.inc,
              theta2: arc1.inc, theta3: arc2.inc,
              dls1: d1, dls2: d2,
              ppf,
            }),
          userAzm,
        )
      );
    }

    case ProfileType.FLYTO_1:
    case ProfileType.FLYTO_2:
    case ProfileType.FLYTO_3:
    case ProfileType.FLYTO_4:
    case ProfileType.FLYTO_5: {
      // FLYTO codes 51..55. The "fly-to" curve extends from prev using
      // prev.tf as the initial tool-face. Pascal pulls tf from the previous
      // station's TF field — we now compute that as a post-pass on every
      // keypoint, so by the time we get here the running last-station's tf
      // is meaningful for non-zero curves.
      const variantMap: Record<number, 1 | 2 | 3 | 4 | 5> = {
        [ProfileType.FLYTO_1]: 1,
        [ProfileType.FLYTO_2]: 2,
        [ProfileType.FLYTO_3]: 3,
        [ProfileType.FLYTO_4]: 4,
        [ProfileType.FLYTO_5]: 5,
      };
      const variant = variantMap[target.typ];
      return tryDlsSigns([target.dls || 0], ([d]) => {
        const r = flyto({
          variant,
          theta1: prev.inc,
          prevAzm: prev.azm,
          prevTvd: prev.tvd,
          prevMd: prev.md,
          prevTf: prev.tf,
          md: target.md || undefined,
          tvd: target.tvd || undefined,
          dmd: target.dmd || undefined,
          inc: target.inc || undefined,
          azm: target.azm || undefined,
          dls: d,
          ppf,
        });
        if (!r.ok) return r;
        const azm = r.solved.azm ?? prev.azm;
        const translated = r.stations.map((s) => translate2DTo3D(s, prev, azm));
        const keyTranslated = r.keyPoints.map((s) => translate2DTo3D(s, prev, azm));
        return { ok: true, keyPoints: keyTranslated, stations: translated };
      });
    }

    case ProfileType.CURVE_E1:
    case ProfileType.CURVE_E2:
    case ProfileType.CURVE_E3:
    case ProfileType.CURVE_E4:
    case ProfileType.CURVE_E5: {
      // Five single-curve variants (Pascal rocal=31..35). curveEoc returns
      // world-relative 3D stations directly (ns/ew/tvd populated, not the
      // 2D plane format) because the curve's azm changes along the arc and
      // a single-azm plane rotation can't represent it. We just offset by
      // prev's absolute position.
      const variantMap: Record<number, 1 | 2 | 3 | 4 | 5> = {
        [ProfileType.CURVE_E1]: 1,
        [ProfileType.CURVE_E2]: 2,
        [ProfileType.CURVE_E3]: 3,
        [ProfileType.CURVE_E4]: 4,
        [ProfileType.CURVE_E5]: 5,
      };
      const variant = variantMap[target.typ];
      return tryDlsSigns([target.dls || 0], ([d]) => {
        const r = curveEoc({
          variant,
          theta1: prev.inc,
          prevAzm: prev.azm,
          prevTvd: prev.tvd,
          prevMd: prev.md,
          md: target.md || undefined,
          inc: target.inc || undefined,
          azm: target.azm || undefined,
          tvd: target.tvd || undefined,
          dls: d || undefined,
          ppf,
        });
        if (!r.ok) return r;
        return {
          ok: true,
          stations:  r.stations.map ((s) => offsetByPrev(s, prev)),
          keyPoints: r.keyPoints.map((s) => offsetByPrev(s, prev)),
        };
      });
    }

    default: {
      // Multi-curve combos 61..103 — Pascal `trunc(code/10) ∈ {6,7,8,9,10}`,
      // sub-types {1=BR, 2=TR, 3=both}. The mcombo builder derives the missing
      // scalars from the user's BR/TR/MD/DMD/INC/AZM inputs and runs c3.
      if (target.typ >= 60 && target.typ <= 103) {
        const r = mcombo({
          code: target.typ,
          theta1: prev.inc,
          prevAzm: prev.azm,
          prevMd: prev.md,
          md: target.md || undefined,
          dmd: target.dmd || undefined,
          inc: target.inc || undefined,
          azm: target.azm || undefined,
          tvd: target.tvd || undefined,
          br: target.br || undefined,
          tr: target.tr || undefined,
          ppf,
        });
        if (!r.ok) return r;
        const azm = r.solved.azm ?? prev.azm;
        const translated = r.stations.map((s) => translate2DTo3D(s, prev, azm));
        const keyTranslated = r.keyPoints.map((s) => translate2DTo3D(s, prev, azm));
        return { ok: true, keyPoints: keyTranslated, stations: translated };
      }
      // Last-resort fallback: c3 from prev.inc to target.inc at target.dls.
      const dls = target.dls === 0 ? 0.001 : target.dls;
      return tryDlsSigns([dls], ([d]) =>
        shiftBy(c3({ theta1: prev.inc, theta2: target.inc, dls: d, ppf }), prev)
      );
    }
  }
}

/**
 * Shift a builder result (which is in local coordinates: ns=0, prev at origin)
 * so its stations are absolute, anchored at `prev`.
 *
 * Used for Hold, SurveyStation, c3 — builders that don't need plane projection
 * because they operate in the same azimuth as `prev`.
 */
function shiftBy(r: BuilderResult, prev: Segment): BuilderResult {
  if (!r.ok) return r;
  const offset = { ns: prev.ns, ew: prev.ew, tvd: prev.tvd };
  return {
    ok: true,
    keyPoints: r.keyPoints.map((s) => translateStation(s, prev.md, offset)),
    stations: r.stations.map((s) => translateStation(s, prev.md, offset)),
  };
}

/**
 * Solve a 2D builder by projecting prev → target onto a vertical plane.
 * The azimuth is computed from the target's NS/EW offset relative to `prev`.
 *
 * The original Pascal does this via plane()/revplane() in Button3Click:
 *   a1 = prev (origin), a2 = prev tangent vector, a3 = target offset.
 *   Project a4 = target tangent into the plane (theta computed),
 *   build the 2D path, then unproject every result back.
 *
 * For simplicity here, we assume the target lies along a single azimuth from
 * prev (i.e. the 2D plane is uniquely defined by prev.azm). The full
 * azmFind/incFind branching for "starred" profiles is documented but not
 * exhaustively exercised — sufficient for most realistic well designs.
 */
function inPlane2D(
  prev: Segment,
  target: Segment,
  buildIn2D: (tgtx: number, tgty: number) => BuilderResult,
  /**
   * Optional plane azimuth override. Use for profiles whose target row has
   * no editable NS/EW (e.g. CC3D) — those leave `target.ns/ew = 0` after
   * Calculate, so `bearingFromPrevToTarget` would compute the bearing back
   * to the world origin instead of the user-intended direction.
   */
  azmOverride?: number,
): BuilderResult {
  const tgtx = horizontalDistance(prev, target);
  const tgty = target.tvd - prev.tvd;
  const r = buildIn2D(tgtx, tgty);
  if (!r.ok) return r;

  // Translate 2D (ew, tvd) → 3D (ns, ew, tvd) along prev's azimuth.
  const azm = azmOverride !== undefined
    ? azmOverride
    : bearingFromPrevToTarget(prev, target);
  const translated = r.stations.map((s) => translate2DTo3D(s, prev, azm));
  const keyTranslated = r.keyPoints.map((s) => translate2DTo3D(s, prev, azm));
  return { ok: true, keyPoints: keyTranslated, stations: translated };
}

/** Solve a 3-arg builder that needs a final inclination (theta).
 *
 * Two ambiguity cases we resolve here:
 *   1. target.inc == 0 → user only gave azm; solve inc via incFind.
 *   2. target.azm == 0 AND target gives no clear bearing → azmFind yields
 *      two candidates; we try the builder with each and pick based on
 *      feasibility + options.azimuthChoice. This is the port of Form07's
 *      "pick branch 1 vs branch 2" prompt.
 */
function solveAndBuild(
  prev: Segment,
  target: Segment,
  options: DispatchOptions,
  buildIn2D: (tgtx: number, tgty: number, theta: number) => BuilderResult
): BuilderResult {
  // Case 1: solve inc from azm if needed.
  let theta = target.inc;
  if (theta === 0 && target.azm !== 0) {
    const a2 = surToVct({ inc: prev.inc, azm: prev.azm });
    const a3 = { ns: target.ns - prev.ns, ew: target.ew - prev.ew, tvd: target.tvd - prev.tvd };
    const ir = incFind(a2, a3, target.azm);
    if (ir.ok) theta = ir.inc;
  }

  // Case 2: target.azm wasn't given and the offset doesn't determine it
  // unambiguously → azmFind gives two candidates. Try both and pick by
  // feasibility + the user's preference.
  if (target.azm === 0 && (target.ns !== prev.ns || target.ew !== prev.ew)) {
    const a1 = { ns: prev.ns, ew: prev.ew, tvd: prev.tvd };
    const a2 = surToVct({ inc: prev.inc, azm: prev.azm });
    const a3 = { ns: target.ns - prev.ns, ew: target.ew - prev.ew, tvd: target.tvd - prev.tvd };
    const cands = azmFind(a1, a2, a3, theta);
    if (cands.ok) {
      const choice = options.azimuthChoice ?? 1;
      const order = choice === 2
        ? [cands.candidate2, cands.candidate1]
        : [cands.candidate1, cands.candidate2];
      for (const candAzm of order) {
        const targetWithAzm = { ...target, azm: candAzm };
        const r = inPlane2D(prev, targetWithAzm, (tgtx, tgty) =>
          buildIn2D(tgtx, tgty, theta)
        );
        if (r.ok) return r;
      }
    }
  }

  return inPlane2D(prev, target, (tgtx, tgty) => buildIn2D(tgtx, tgty, theta));
}

/** Horizontal distance between two stations. */
function horizontalDistance(a: Segment, b: Segment): number {
  const dn = b.ns - a.ns;
  const de = b.ew - a.ew;
  return Math.sqrt(dn * dn + de * de);
}

/** Bearing (azimuth, radians) from a to b. */
function bearingFromPrevToTarget(a: Segment, b: Segment): number {
  const dn = b.ns - a.ns;
  const de = b.ew - a.ew;
  if (dn === 0 && de === 0) return a.azm; // colinear (vertical step)
  return vctToSur({ ns: dn, ew: de, tvd: 0 }).azm;
}

/**
 * Translate a 2D builder station (with local ns=0, ew=horizontal, tvd=vertical)
 * into 3D world coordinates anchored at `prev`, oriented along `azm`.
 */
function translate2DTo3D(s: Station, prev: Segment, azm: number): Station {
  return {
    ...s,
    md: s.md + prev.md,
    ns: prev.ns + s.ew * Math.cos(azm),
    ew: prev.ew + s.ew * Math.sin(azm),
    tvd: prev.tvd + s.tvd,
    azm: s.inc !== 0 ? azm : prev.azm,
  };
}

/**
 * Add prev's absolute (md, ns, ew, tvd) to a builder-returned station that
 * already has full 3D coordinates in world-relative form. Used for the
 * minimum-curvature builders (curveEoc) that don't go through the
 * 2D-plane-then-rotate flow.
 */
function offsetByPrev(s: Station, prev: Segment): Station {
  return {
    ...s,
    md:  s.md  + prev.md,
    ns:  s.ns  + prev.ns,
    ew:  s.ew  + prev.ew,
    tvd: s.tvd + prev.tvd,
  };
}

/** Add an offset to a station and shift MD baseline. */
function translateStation(
  s: Station,
  mdBase: number,
  offset: { ns: number; ew: number; tvd: number }
): Station {
  return {
    ...s,
    md: s.md + mdBase,
    ns: s.ns + offset.ns,
    ew: s.ew + offset.ew,
    tvd: s.tvd + offset.tvd,
  };
}

// projectToPlane / unprojectFromPlane are imported for future enhancement
// (full 3D plane-projection of starred profiles); referenced here to keep
// the import alive so it's available to downstream callers via the barrel.
void projectToPlane;
void unprojectFromPlane;
