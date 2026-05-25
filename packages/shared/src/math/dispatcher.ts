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

  return { ok: errors.length === 0, stations, keypoints, errors };
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

    default: {
      // Single-curve fallback for codes 31..35, 51..55, 61..103.
      // Treat as `c3` from prev.inc to target.inc at target.dls.
      // Either sign is acceptable: c3's `md = (theta2 - theta1)/dls` flips
      // negative for a drop curve unless dls is negative too.
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
