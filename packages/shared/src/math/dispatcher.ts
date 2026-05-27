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
import { ProfileType, profileTypeLabel } from "./profile-types.js";
import { hold } from "./builders/hold.js";
import { c3 } from "./builders/c3.js";
import { sursta } from "./builders/sursta.js";
import { hoctt } from "./builders/hoctt.js";
import { hc3dtft } from "./builders/hc3dtft.js";
import { hc3d3D } from "./builders/hc3d3D.js";
import { ch3d3D } from "./builders/ch3d3D.js";
import { ch3dffk } from "./builders/ch3dffk.js";
import { ch } from "./builders/ch.js";
import { ch3D } from "./builders/ch3D.js";
import { hch } from "./builders/hch.js";
import { hch3D } from "./builders/hch3D.js";
import { ch2dc1 } from "./builders/ch2dc1.js";
import { ch2dc2 } from "./builders/ch2dc2.js";
import { d3ds3D } from "./builders/d3ds3D.js";
import { d3dsHold3D } from "./builders/d3dsHold3D.js";
import { cc2d } from "./builders/cc2d.js";
import { cc3D } from "./builders/cc3D.js";
import { curveEoc } from "./builders/curveEoc.js";
import { flyto } from "./builders/flyto.js";
import { mcombo } from "./builders/mcombo.js";
import type { BuilderResult } from "./builders/types.js";

export interface DispatchOptions {
  /**
   * Per-segment azimuth-branch picker, keyed by the segment group's last-row
   * order. When the builder finds two azimuth solutions for a group, this
   * map tells the dispatcher which branch to commit to. Groups not in the
   * map default to branch 1. This replaces the old global `azimuthChoice`
   * so the user can pick a different branch for each ambiguous profile.
   */
  azimuthChoices?: Record<number, 1 | 2>;
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
  errors: Array<{
    /** Sorted-array index of the LAST row in the failing profile group. */
    segmentIndex: number;
    /** 1-based ordinal of the profile group that failed (= "3" in "3.2"). */
    groupNumber: number;
    /** 1-based position of the failing row within its group (= "2" in "3.2"). */
    groupPosition: number;
    /** Total number of rows in the failing profile group. */
    groupSize: number;
    message: string;
  }>;
  /**
   * Per-segment 2-azimuth ambiguity report (port of Pascal Form07's prompt).
   *
   * For HC3D / HCH / CH3D / D3DS / D3DS_HOLD / CC3D when the user supplies a
   * 3D target position but no target azimuth, `azmFind` returns TWO candidate
   * target tangent azimuths. The dispatcher picks one based on
   * `DispatchOptions.azimuthChoice`; this array tells the UI which groups had
   * a real choice so it can pop a "pick branch 1 or 2" modal.
   *
   * Empty when no group had a 2-azm choice (vertical starts, starred profiles
   * with azm-input, etc.).
   */
  azmCandidates: Array<{
    /** Order of the LAST row in the profile group (matches station/keypoint
     *  segmentOrder, so the UI can highlight the row that has the choice). */
    segmentOrder: number;
    /** Human label for the modal — e.g. "Hold-Curve 3D" or "Hold-Curve-Hold". */
    profileLabel: string;
    /** Target azimuths in DEGREES (0=N, 90=E) — what the curve's final
     *  tangent points at for each candidate. */
    candidate1Deg: number;
    candidate2Deg: number;
    /** Which candidate the dispatcher actually used (1 or 2). Lets the UI
     *  pre-select the active choice in the modal. */
    chosen: 1 | 2;
  }>;
}

/**
 * Calculate a full station list from a list of design segments.
 *
 * The first segment is the START station — used as origin only, never built.
 */
export function dispatch(segments: Segment[], options: DispatchOptions = {}): DispatchResult {
  const errors: DispatchResult["errors"] = [];
  const keypoints: DispatchResult["keypoints"] = [];
  const azmCandidates: DispatchResult["azmCandidates"] = [];
  if (segments.length === 0) {
    return { ok: true, stations: [], keypoints, errors, azmCandidates };
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
  let groupNumber = 0; // 1-based ordinal for "Profile 3" in errors.
  while (i < sorted.length) {
    const start = i;
    const typ = sorted[i].typ;
    while (i < sorted.length && sorted[i].typ === typ) i++;
    const groupEnd = i - 1;            // last index in this group
    const groupSize = groupEnd - start + 1;
    groupNumber += 1;

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

    const result = buildOne(prev, target, group, options, azmCandidates);
    if (!result.ok) {
      errors.push({
        segmentIndex: groupEnd,
        groupNumber,
        // The failing row is the dispatch target = LAST row of the group.
        // UI may prefer to point to a different row (e.g. the row that
        // owns the DLS input) — that's a presentation concern, so pass
        // the full {groupNumber, groupSize} and let the UI decide.
        groupPosition: groupSize,
        groupSize,
        message: result.reason ?? "infeasible",
      });
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

  return { ok: errors.length === 0, stations, keypoints, errors, azmCandidates };
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
 * where v0 = (lastEnd.NS − start.NS, lastEnd.EW − start.EW). Pascal computes
 * `wlptpt` by walking ADOTABLE2 to its LAST RECORD (5253-5260) — which at
 * that point holds the POST-calculate computed NS/EW, not the user inputs.
 * For profiles like CURVE_E1 / FLYTO_* where the user doesn't enter NS/EW
 * (they're derived), the input row is still zeros — so we mirror Pascal by
 * reading the LAST STATION'S computed NS/EW instead of the input segment.
 *
 * If v0 is degenerate (vertical well — last endpoint has same NS/EW as
 * start), leave VSEC at 0 on every station.
 */
function computeVsecPostPass(
  sortedInput: Segment[],
  stations: Station[],
  keypoints: DispatchResult["keypoints"],
): void {
  if (sortedInput.length < 2 || stations.length < 1) return;
  const start = sortedInput[0];
  // Use the LAST COMPUTED station (= the trajectory's endpoint). For
  // profiles that don't take user NS/EW input the segment row's ns/ew are
  // zeros and would give a degenerate reference; this fix matches the
  // Pascal behavior of reading the post-calc table value.
  const lastEnd = stations[stations.length - 1];
  const refNs = lastEnd.ns - start.ns;
  const refEw = lastEnd.ew - start.ew;
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
  stations: Station[],
  keypoints: DispatchResult["keypoints"],
): void {
  // Pass 1 — compute TF on the START and every KEYPOINT, using the
  // NEXT keypoint's curve geometry. Pascal Unit02.pas:5341 sets the
  // START station's TF from the first curve's (dls × dmd); :5368-5378
  // sets each keypoint's TF from the next group's curve (or 0 when it's
  // the trajectory's last keypoint).
  const all: Station[] = [];
  if (stations.length > 0) all.push(stations[0]);   // START as first prev
  for (const g of keypoints) all.push(...g.points);

  for (let k = 0; k < all.length - 1; k++) {
    const p = all[k];
    const n = all[k + 1];
    p.tf = toolFaceAngle(p.inc, p.azm, n.inc, n.azm, n.dls, n.dmd);
  }
  if (all.length > 0) {
    all[all.length - 1].tf = 0;
  }

  // Pass 2 — propagate the arc-start TF down to every densified row that
  // falls INSIDE that arc. Toolface is geometrically constant along a
  // constant-DLS arc, so every interp station between two keypoints shares
  // the TF of the keypoint that STARTS its arc.
  //
  // Pascal Unit02.pas:5439-5450 recomputes TF per densified step. That
  // works there because Pascal's c3 puts stations EXACTLY on the arc; our
  // densifier uses linear-in-inc/azm interpolation (cheaper, slightly off
  // the arc), so a per-step recompute would yield jittery TF values that
  // disagree with the constant arc toolface. Inheriting from the arc's
  // start keypoint is mathematically equivalent for a constant-DLS arc.
  if (stations.length === 0) return;
  const kpByMd = new Map<number, Station>();
  for (const g of keypoints) {
    for (const p of g.points) kpByMd.set(p.md, p);
  }
  let arcStartTf = stations[0].tf;
  for (let i = 0; i < stations.length; i++) {
    const s = stations[i];
    // Use a small epsilon — station and keypoint MDs are floats from
    // independent code paths.
    let matchedKp: Station | undefined;
    for (const [md, kp] of kpByMd) {
      if (Math.abs(md - s.md) < 1e-3) { matchedKp = kp; break; }
    }
    if (matchedKp) {
      s.tf = matchedKp.tf;
      arcStartTf = matchedKp.tf;
    } else {
      s.tf = arcStartTf;
    }
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
  options: DispatchOptions,
  azmCandidates: DispatchResult["azmCandidates"],
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
      // For a DEVIATED start (prev.inc > a small threshold), Pascal's
      // HC3DTFT works only after a plane projection that tilts the 2D
      // problem onto the (start-tangent, target-offset) plane. Our
      // dispatcher's inPlane2D doesn't do that projection, so it gives
      // the wrong KOP azimuth (= bearing instead of prev.azm) and a
      // slightly-wrong curve geometry. Use the direct 3D min-curvature
      // solver instead, which preserves prev.azm on the hold portion and
      // derives the target tangent azimuth from the actual 3D geometry.
      //
      // Vertical-start (prev.inc ≈ 0) still routes through the original
      // hc3dtft 2D builder — there's no plane tilt to handle, and the
      // hc3dtft analytic equations are exact for that case.
      if (Math.abs(prev.inc) > 1e-4) {
        const branch = options.azimuthChoices?.[target.order] ?? 1;
        const r3 = hc3d3D({
          theta1: prev.inc,
          prevAzm: prev.azm,
          theta: target.inc,
          tgtNs: target.ns - prev.ns,
          tgtEw: target.ew - prev.ew,
          tgtTvd: target.tvd - prev.tvd,
          ppf,
          branch,
        });
        if (!r3.ok) return r3;
        // Surface the 2-azm choice (Pascal Form07) when the solver found
        // 2+ distinct positive-length azimuth solutions.
        if (azmCandidates && r3.candidates.length >= 2) {
          const c1Deg = ((r3.candidates[0].solvedAzm * 180) / Math.PI + 360) % 360;
          const c2Deg = ((r3.candidates[1].solvedAzm * 180) / Math.PI + 360) % 360;
          azmCandidates.push({
            segmentOrder: target.order,
            profileLabel: profileTypeLabel(target.typ),
            candidate1Deg: c1Deg,
            candidate2Deg: c2Deg,
            chosen: branch,
          });
        }
        // The 3D solver returns stations in prev-relative world coords.
        // Add prev's absolute (ns, ew, tvd, md) to land in world frame.
        const shift = (s: Station): Station => ({
          ...s,
          md: s.md + prev.md,
          ns: s.ns + prev.ns,
          ew: s.ew + prev.ew,
          tvd: s.tvd + prev.tvd,
        });
        return {
          ok: true,
          stations: r3.stations.map(shift),
          keyPoints: r3.keyPoints.map(shift),
        };
      }
      const r2 = solveAndBuild(prev, target, options, (tgtx, tgty, theta) =>
        hc3dtft({ theta1: prev.inc, tgtx, tgty, theta, ppf }),
      azmCandidates);
      return r2;
    }

    case ProfileType.CH3D:
    case ProfileType.CH3D_STAR: {
      // Same reasoning as HC3D: for a deviated start (or a curve that
      // requires a big azimuth turn from a tilted prev tangent), the 2D
      // ch3dffk builder + single-rotation inPlane2D either fails outright
      // ("Geometry infeasible") or produces wrong azimuths. Route through
      // the direct 3D solver instead, which finds (curve length, hold
      // length, target azm) by min-curvature 3-equation closure.
      if (Math.abs(prev.inc) > 1e-4) {
        const branch = options.azimuthChoices?.[target.order] ?? 1;
        const r3 = ch3d3D({
          theta1: prev.inc,
          prevAzm: prev.azm,
          theta: target.inc,
          tgtNs: target.ns - prev.ns,
          tgtEw: target.ew - prev.ew,
          tgtTvd: target.tvd - prev.tvd,
          ppf,
          branch,
        });
        if (!r3.ok) return r3;
        if (azmCandidates && r3.candidates.length >= 2) {
          const c1Deg = ((r3.candidates[0].solvedAzm * 180) / Math.PI + 360) % 360;
          const c2Deg = ((r3.candidates[1].solvedAzm * 180) / Math.PI + 360) % 360;
          azmCandidates.push({
            segmentOrder: target.order,
            profileLabel: profileTypeLabel(target.typ),
            candidate1Deg: c1Deg,
            candidate2Deg: c2Deg,
            chosen: branch,
          });
        }
        const shift = (s: Station): Station => ({
          ...s,
          md: s.md + prev.md,
          ns: s.ns + prev.ns,
          ew: s.ew + prev.ew,
          tvd: s.tvd + prev.tvd,
        });
        return {
          ok: true,
          stations: r3.stations.map(shift),
          keyPoints: r3.keyPoints.map(shift),
        };
      }
      const r2 = solveAndBuild(prev, target, options, (tgtx, tgty, theta) =>
        ch3dffk({ theta1: prev.inc, tgtx, tgty, theta, ppf }),
      azmCandidates);
      return r2;
    }

    case ProfileType.HCH:
    case ProfileType.HCH_STAR: {
      // DLS lives on the EOC row (position 1 of [KOP, EOC, Target]).
      // Accept either sign — HCH's `crvln = (theta - theta1)/dls` flips
      // negative for a drop curve unless dls is negative too. We try the
      // user's sign first, then fall back to the opposite.
      const dls = groupVal("dls");

      // Deviated start: route to the direct 3D solver for the same reason
      // as HC3D / CH3D — Pascal's hch runs in a 2D plane after projection,
      // and our inPlane2D path doesn't tilt the plane onto prev's tangent,
      // so KOP azimuth comes out as the position bearing instead of prev.azm.
      // hch3D solves the full 3D min-curvature closure directly.
      //
      // The 3D solver can return multiple positive-length azimuth solutions
      // — we surface them as `azmCandidates` so the Form07 modal can pop,
      // and we honour the per-segment branch pick from azimuthChoices.
      if (Math.abs(prev.inc) > 1e-4) {
        const branch = options.azimuthChoices?.[target.order] ?? 1;
        const tryHch3D = (d: number, br: 1 | 2): ReturnType<typeof hch3D> => hch3D({
          theta1: prev.inc,
          prevAzm: prev.azm,
          theta: target.inc,
          dls: d,
          tgtNs: target.ns - prev.ns,
          tgtEw: target.ew - prev.ew,
          tgtTvd: target.tvd - prev.tvd,
          ppf,
          branch: br,
        });
        const result = tryDlsSigns([dls], ([d]) => {
          const r = tryHch3D(d, branch);
          if (!r.ok) return r;
          // Surface the 2-azm choice if it exists. azmCandidates lets the
          // UI pop Form07's "branch 1 vs branch 2" modal.
          if (azmCandidates && r.candidates.length >= 2) {
            const c1 = r.candidates[0].solvedAzm;
            const c2 = r.candidates[1].solvedAzm;
            const c1Deg = ((c1 * 180) / Math.PI + 360) % 360;
            const c2Deg = ((c2 * 180) / Math.PI + 360) % 360;
            azmCandidates.push({
              segmentOrder: target.order,
              profileLabel: profileTypeLabel(target.typ),
              candidate1Deg: c1Deg,
              candidate2Deg: c2Deg,
              chosen: branch,
            });
          }
          const shift = (s: Station): Station => ({
            ...s,
            md: s.md + prev.md,
            ns: s.ns + prev.ns,
            ew: s.ew + prev.ew,
            tvd: s.tvd + prev.tvd,
          });
          return {
            ok: true,
            stations: r.stations.map(shift),
            keyPoints: r.keyPoints.map(shift),
          };
        });
        return result;
      }

      return tryDlsSigns([dls], ([d]) =>
        solveAndBuild(prev, target, options, (tgtx, tgty, theta) =>
          hch({ theta1: prev.inc, tgtx, tgty, theta, dls: d, ppf }),
        azmCandidates)
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

      // Deviated start: route to the direct 3D solver. Pascal's CH runs in
      // a 2D plane after projection; our inPlane2D doesn't tilt the plane
      // onto prev's tangent, so for a non-vertical prev whose azimuth
      // differs from the prev→target bearing, the 2D solver computes the
      // wrong target inc or returns "Geometry infeasible".
      if (Math.abs(prev.inc) > 1e-4) {
        const tryCh3D = (d: number): BuilderResult => {
          const r3 = ch3D({
            theta1: prev.inc,
            prevAzm: prev.azm,
            dls: d,
            tgtNs: target.ns - prev.ns,
            tgtEw: target.ew - prev.ew,
            tgtTvd: target.tvd - prev.tvd,
            ppf,
          });
          if (!r3.ok) return r3;
          const shift = (s: Station): Station => ({
            ...s,
            md: s.md + prev.md,
            ns: s.ns + prev.ns,
            ew: s.ew + prev.ew,
            tvd: s.tvd + prev.tvd,
          });
          return {
            ok: true,
            stations: r3.stations.map(shift),
            keyPoints: r3.keyPoints.map(shift),
          };
        };
        return tryDlsSigns([dls], ([d]) => tryCh3D(d));
      }

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

      // Deviated start: route to the direct 3D solver. The 2D ch2dc1 path
      // doesn't tilt the curve plane onto prev's tangent, so for a non-
      // vertical prev whose azimuth differs from the prev→target bearing,
      // ch2dc1 picks the wrong root or returns "Geometry infeasible". The
      // d3ds3D solver assumes the standard 3D-S "single curve plane"
      // constraint (curve 2 + hold share azimuth A_plane; curve 1 carries
      // the azimuth turn from prev to A_plane).
      if (Math.abs(prev.inc) > 1e-4) {
        const branch = options.azimuthChoices?.[target.order] ?? 1;
        const tryD3ds3D = (d1: number, d2: number): BuilderResult => {
          const r3 = d3ds3D({
            theta1: prev.inc,
            prevAzm: prev.azm,
            theta: target.inc,
            dls1: d1, dls2: d2,
            tgtNs: target.ns - prev.ns,
            tgtEw: target.ew - prev.ew,
            tgtTvd: target.tvd - prev.tvd,
            ppf,
            branch,
          });
          if (!r3.ok) return r3;
          if (azmCandidates && r3.candidates.length >= 2) {
            const c1Deg = ((r3.candidates[0].solvedPlaneAzm * 180) / Math.PI + 360) % 360;
            const c2Deg = ((r3.candidates[1].solvedPlaneAzm * 180) / Math.PI + 360) % 360;
            azmCandidates.push({
              segmentOrder: target.order,
              profileLabel: profileTypeLabel(target.typ),
              candidate1Deg: c1Deg,
              candidate2Deg: c2Deg,
              chosen: branch,
            });
          }
          const shift = (s: Station): Station => ({
            ...s,
            md: s.md + prev.md,
            ns: s.ns + prev.ns,
            ew: s.ew + prev.ew,
            tvd: s.tvd + prev.tvd,
          });
          return {
            ok: true,
            stations: r3.stations.map(shift),
            keyPoints: r3.keyPoints.map(shift),
          };
        };
        return tryDlsSigns([dls1, dls2], ([d1, d2]) => tryD3ds3D(d1, d2));
      }

      return tryDlsSigns([dls1, dls2], ([d1, d2]) =>
        solveAndBuild(prev, target, options, (tgtx, tgty, theta) =>
          ch2dc1({
            theta1: prev.inc, tgtx, tgty, theta,
            dls1: d1, dls2: d2, ppf,
          }),
        azmCandidates)
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

      // Deviated start: route Mode A (D3DS_HOLD / D3DS_HOLD_STAR, where the
      // user supplies the final hold's dmd) through the direct 3D solver.
      // Mode B (D3DS_HOLD2 / *_STAR, where the user supplies the middle inc
      // and dmd is solved) still uses the 2D path — TODO to port.
      if (Math.abs(prev.inc) > 1e-4 && ddmmdd) {
        const branch = options.azimuthChoices?.[target.order] ?? 1;
        const tryD3dsHold3D = (d1: number, d2: number): BuilderResult => {
          const r3 = d3dsHold3D({
            theta1: prev.inc,
            prevAzm: prev.azm,
            theta: target.inc,
            dls1: d1, dls2: d2,
            dmd,
            tgtNs: target.ns - prev.ns,
            tgtEw: target.ew - prev.ew,
            tgtTvd: target.tvd - prev.tvd,
            ppf,
            branch,
          });
          if (!r3.ok) return r3;
          if (azmCandidates && r3.candidates.length >= 2) {
            const c1Deg = ((r3.candidates[0].solvedPlaneAzm * 180) / Math.PI + 360) % 360;
            const c2Deg = ((r3.candidates[1].solvedPlaneAzm * 180) / Math.PI + 360) % 360;
            azmCandidates.push({
              segmentOrder: target.order,
              profileLabel: profileTypeLabel(target.typ),
              candidate1Deg: c1Deg,
              candidate2Deg: c2Deg,
              chosen: branch,
            });
          }
          const shift = (s: Station): Station => ({
            ...s,
            md: s.md + prev.md,
            ns: s.ns + prev.ns,
            ew: s.ew + prev.ew,
            tvd: s.tvd + prev.tvd,
          });
          return {
            ok: true,
            stations: r3.stations.map(shift),
            keyPoints: r3.keyPoints.map(shift),
          };
        };
        return tryDlsSigns([dls1, dls2], ([d1, d2]) => tryD3dsHold3D(d1, d2));
      }

      return tryDlsSigns([dls1, dls2], ([d1, d2]) =>
        solveAndBuild(prev, target, options, (tgtx, tgty, theta) =>
          ch2dc2({
            theta1: prev.inc, tgtx, tgty, theta,
            dls1: d1, dls2: d2,
            thetaex: target.inc, dmd, ddmmdd, ppf,
          }),
        azmCandidates)
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

      // Deviated start: route through the direct 3D solver. The 2D path
      // forces an instantaneous azimuth jump at the first station (from
      // prev.azm to userAzm); the 3D solver makes arc 1 a true 3D curve
      // that smoothly transitions between the two azimuths.
      if (Math.abs(prev.inc) > 1e-4) {
        const tryCc3D = (d1: number, d2: number): BuilderResult => {
          const r3 = cc3D({
            theta1: prev.inc,
            prevAzm: prev.azm,
            midInc: arc1.inc,
            theta: arc2.inc,
            planeAzm: userAzm,
            dls1: d1, dls2: d2,
            ppf,
          });
          if (!r3.ok) return r3;
          const shift = (s: Station): Station => ({
            ...s,
            md: s.md + prev.md,
            ns: s.ns + prev.ns,
            ew: s.ew + prev.ew,
            tvd: s.tvd + prev.tvd,
          });
          return {
            ok: true,
            stations: r3.stations.map(shift),
            keyPoints: r3.keyPoints.map(shift),
          };
        };
        return tryDlsSigns([arc1.dls, arc2.dls], ([d1, d2]) => tryCc3D(d1, d2));
      }

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
  buildIn2D: (tgtx: number, tgty: number, theta: number) => BuilderResult,
  azmCandidates?: DispatchResult["azmCandidates"],
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
  // feasibility + the user's preference. Also record the ambiguity so the
  // UI can pop a "pick branch 1 vs branch 2" modal (Pascal Form07).
  if (target.azm === 0 && (target.ns !== prev.ns || target.ew !== prev.ew)) {
    const a1 = { ns: prev.ns, ew: prev.ew, tvd: prev.tvd };
    const a2 = surToVct({ inc: prev.inc, azm: prev.azm });
    const a3 = { ns: target.ns - prev.ns, ew: target.ew - prev.ew, tvd: target.tvd - prev.tvd };
    const cands = azmFind(a1, a2, a3, theta);
    if (cands.ok) {
      // Per-segment branch pick: look up by target.order; default branch 1.
      const choice = options.azimuthChoices?.[target.order] ?? 1;
      const c1Deg = ((cands.candidate1 * 180) / Math.PI + 360) % 360;
      const c2Deg = ((cands.candidate2 * 180) / Math.PI + 360) % 360;
      // Filter out spurious candidates. azmFind solves a quadratic; one
      // root is always physical (matches the position bearing → curve
      // closes at the user's target) and the other is its 180° mirror
      // (curve closes at −NS/−EW, not the requested target). Surfacing
      // the mirror as a "choice" misleads users: picking it appears to
      // change the geometry but in fact the dispatcher still uses the
      // bearing for the 3D unprojection so the curve always closes at
      // the user-given NS/EW. We only emit candidates when the two are
      // a GENUINE geometric choice — distinct AND not ~180° apart.
      const sep = Math.min(
        Math.abs(c1Deg - c2Deg),
        360 - Math.abs(c1Deg - c2Deg),
      );
      const isRealChoice = sep > 0.01 && Math.abs(sep - 180) > 0.5;
      if (azmCandidates && isRealChoice) {
        azmCandidates.push({
          segmentOrder: target.order,
          profileLabel: profileTypeLabel(target.typ),
          candidate1Deg: c1Deg,
          candidate2Deg: c2Deg,
          chosen: choice,
        });
      }
      const order = choice === 2
        ? [cands.candidate2, cands.candidate1]
        : [cands.candidate1, cands.candidate2];
      for (const candAzm of order) {
        const targetWithAzm = { ...target, azm: candAzm };
        // inPlane2D uses bearingFromPrevToTarget(prev, target) — atan2 of
        // the NS/EW delta — so the curve always closes at the user's
        // requested 3D position. The candidate azm flows through
        // `targetWithAzm.azm` but doesn't change the unprojection;
        // it's used by builders that read target.azm directly (e.g.
        // CC3D_STAR's user-input azimuth path).
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
