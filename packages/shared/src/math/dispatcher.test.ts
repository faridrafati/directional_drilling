import { describe, it, expect } from "vitest";
import { dispatch } from "./dispatcher.js";
import { ProfileType } from "./profile-types.js";
import { rad2deg } from "../units/index.js";
import type { Segment } from "../types.js";

const PI = Math.PI;

function startStation(): Segment {
  return {
    comment: "Start", md: 0, inc: 0, azm: 0, tvd: 0, vsec: 0,
    ns: 0, ew: 0, dls: 0, tf: 0, br: 0, tr: 0, dmd: 0,
    order: 0, typ: ProfileType.START,
  };
}

describe("dispatch", () => {
  it("handles a vertical hold", () => {
    const segments: Segment[] = [
      startStation(),
      { ...startStation(), md: 1000, order: 1, typ: ProfileType.HOLD_NS },
    ];
    const r = dispatch(segments);
    expect(r.ok).toBe(true);
    expect(r.errors).toHaveLength(0);
    const last = r.stations[r.stations.length - 1];
    expect(last.tvd).toBeCloseTo(1000, 4);
    expect(last.md).toBeCloseTo(1000, 4);
  });

  it("handles a survey-station curve", () => {
    const segments: Segment[] = [
      startStation(),
      { ...startStation(), md: 500, inc: PI / 6, order: 1, typ: ProfileType.SURVEY_STATION },
    ];
    const r = dispatch(segments);
    expect(r.ok).toBe(true);
    const last = r.stations[r.stations.length - 1];
    expect(last.md).toBeCloseTo(500, 3);
    expect(last.inc).toBeCloseTo(PI / 6, 6);
  });

  it("handles a planning target (HOCTT)", () => {
    const segments: Segment[] = [
      startStation(),
      { ...startStation(), ew: 500, tvd: 1000, order: 1, typ: ProfileType.TARGET, azm: PI / 2 },
    ];
    const r = dispatch(segments);
    expect(r.ok).toBe(true);
    const last = r.stations[r.stations.length - 1];
    expect(last.tvd).toBeCloseTo(1000, 1);
  });

  it("handles HC3D with a deep deviated target", () => {
    // theta=PI/4 leaves enough vertical room for a 45° curve to reach (2000, 6000).
    const segments: Segment[] = [
      startStation(),
      {
        ...startStation(),
        order: 1, typ: ProfileType.HC3D,
        ew: 2000, ns: 0, tvd: 6000,
        inc: PI / 4, azm: PI / 2,
      },
    ];
    const r = dispatch(segments);
    expect(r.ok).toBe(true);
    expect(r.stations.length).toBeGreaterThan(2);
    const last = r.stations[r.stations.length - 1];
    expect(last.tvd).toBeCloseTo(6000, 1);
    expect(last.inc).toBeCloseTo(PI / 4, 4);
  });

  it("CC3D uses user-supplied azm from EOC#2 (not the bogus bearing back to origin)", () => {
    // CC3D's editable mask has no NS/EW, so target.ns/ew stay zero. Without
    // the azm override the dispatcher would back-compute the bearing from
    // prev (NS=2600, EW=2600 after a deep TARGET arc) to (0,0) — which is
    // 225°, i.e. prev.azm + 180°. The CC3D branch must use the user-input
    // azm from EOC#2 (45° here).
    const segments: Segment[] = [
      startStation(),
      // TARGET arc to (NS=2600, EW=2600, TVD=7000) lands at azm=45°.
      { ...startStation(), order: 1, typ: ProfileType.TARGET,
        ns: 2600, ew: 2600, tvd: 7000, azm: 45 * PI / 180 },
      // CC3D: EOC#1 (inc=30, dls=3°/100ft), EOC#2 (inc=10, azm=45°, dls=5°/100ft).
      { ...startStation(), order: 2, typ: ProfileType.CC3D,
        inc: 30 * PI / 180, dls: 3 * PI / 180 / 100 },
      { ...startStation(), order: 3, typ: ProfileType.CC3D,
        inc: 10 * PI / 180, azm: 45 * PI / 180, dls: 5 * PI / 180 / 100 },
    ];
    const r = dispatch(segments);
    expect(r.ok).toBe(true);
    expect(r.errors).toHaveLength(0);
    // Both CC3D keypoints must carry the user's 45° azimuth (NOT 225°).
    const cc3dKp = r.keypoints[r.keypoints.length - 1];
    for (const kp of cc3dKp.points) {
      expect(kp.azm).toBeCloseTo(45 * PI / 180, 3);
    }
  });

  it("accepts either DLS sign on CURVE_E4 drop curve", () => {
    // CURVE_E4 (Inc+TVD+DLS) drop curve: START (inc=0) → CURVE_E1 builds to
    // 60° → CURVE_E4 drops back to 30° at a target TVD. User enters POSITIVE
    // DLS even though the math may need negative — dispatcher flips the sign
    // automatically and the curveEoc builder solves.
    const segments: Segment[] = [
      startStation(),
      { ...startStation(), order: 1, typ: ProfileType.CURVE_E1,
        md: 1000, inc: 60 * PI / 180, dls: 6 * PI / 180 / 100 },
      { ...startStation(), order: 2, typ: ProfileType.CURVE_E4,
        inc: 30 * PI / 180, tvd: 2000, dls: 3 * PI / 180 / 100 },
    ];
    const r = dispatch(segments);
    expect(r.ok).toBe(true);
    expect(r.errors).toHaveLength(0);
    const last = r.stations[r.stations.length - 1];
    expect(last.inc).toBeCloseTo(30 * PI / 180, 3);
  });

  it("CURVE_E1 matches Pascal MIXED.exe output (screenshot reference)", () => {
    // Reference values captured from the original Delphi app, CURVE_E1:
    //   START: MD=0, INCL=5°, AZM=45°, TVD=0
    //   EOC:   MD=1000, INCL=15°, DLS=1.3°/100ft
    //   → Pascal Form07 picks the −sqrt branch by default:
    //   Expected EOC: AZM≈102.50°, TVD≈985.29, NS≈2.81, EW≈157.83
    const segments: Segment[] = [
      {
        ...startStation(),
        inc: 5 * PI / 180,
        azm: 45 * PI / 180,
      },
      {
        ...startStation(),
        order: 1, typ: ProfileType.CURVE_E1,
        md: 1000,
        inc: 15 * PI / 180,
        dls: 1.3 * PI / 180 / 100,
      },
    ];
    const r = dispatch(segments);
    expect(r.ok).toBe(true);
    expect(r.errors).toHaveLength(0);

    // The KEYPOINT (EOC) is what the grid shows on the second row.
    const eoc = r.keypoints[0].points[r.keypoints[0].points.length - 1];
    expect(eoc.md).toBeCloseTo(1000, 1);
    expect(rad2deg(eoc.inc)).toBeCloseTo(15, 1);
    expect(rad2deg(eoc.azm)).toBeCloseTo(102.50, 1);
    expect(eoc.tvd).toBeCloseTo(985.29, 1);
    expect(eoc.ns).toBeCloseTo(2.81, 1);
    expect(eoc.ew).toBeCloseTo(157.83, 1);
    // Keypoint stores the FULL profile length so BR = Δinc / dmd resolves
    // to the displayable 1.0 °/100ft. (Last densified row holds the step.)
    expect(eoc.dmd).toBeCloseTo(1000, 0);
    // VSEC must be non-zero — the post-pass should read the LAST computed
    // station's NS/EW for the reference vector, not the input row (which
    // has NS=EW=0 for CURVE_E1).
    expect(eoc.vsec).toBeCloseTo(157.85, 0);   // |v0| ≈ sqrt(2.81² + 157.83²)
    // BR / TR computed by the post-pass using the full dmd.
    expect(rad2deg(eoc.br) * 100).toBeCloseTo(1.00, 1);
    expect(rad2deg(eoc.tr) * 100).toBeCloseTo(5.75, 0);
    // TF at the START station — computed by the TF post-pass using the
    // CURVE to EOC. Pascal expected 76° per the screenshot.
    const startRow = r.stations[0];
    expect(rad2deg(startRow.tf)).toBeCloseTo(76, 0);
    // EOC.tf = 0 per Pascal Unit02.pas:5376 (last keypoint of last segment).
    expect(eoc.tf).toBe(0);
  });

  it("FLYTO_1 builds a curve to the given MD", () => {
    // FLYTO_1 from start (vertical) with MD=1000 ft, DLS=2°/100ft.
    // With prev.tf=0 the curve is in the prev.azm direction.
    const segments: Segment[] = [
      startStation(),
      { ...startStation(), order: 1, typ: ProfileType.FLYTO_1,
        md: 1000, dls: 2 * PI / 180 / 100 },
    ];
    const r = dispatch(segments);
    expect(r.ok).toBe(true);
    const last = r.stations[r.stations.length - 1];
    expect(last.md).toBeCloseTo(1000, 1);
  });

  it("FLYTO_3 builds a curve to the given DMD", () => {
    const segments: Segment[] = [
      startStation(),
      { ...startStation(), order: 1, typ: ProfileType.FLYTO_3,
        dmd: 800, dls: 3 * PI / 180 / 100 },
    ];
    const r = dispatch(segments);
    expect(r.ok).toBe(true);
    const last = r.stations[r.stations.length - 1];
    expect(last.dmd).toBeCloseTo(800 - (r.stations[r.stations.length - 2]?.md ?? 0), 0);
  });

  it("CURVE_E5 derives DLS from chord midpoint formula", () => {
    // CURVE_E5 (Inc+Azm+TVD → derive DLS). User gives all 3 angles + TVD.
    // The builder solves for the DLS that makes the geometry close.
    const segments: Segment[] = [
      startStation(),
      { ...startStation(), order: 1, typ: ProfileType.CURVE_E5,
        inc: 45 * PI / 180, azm: 30 * PI / 180, tvd: 1500 },
    ];
    const r = dispatch(segments);
    expect(r.ok).toBe(true);
    const last = r.stations[r.stations.length - 1];
    expect(last.inc).toBeCloseTo(45 * PI / 180, 3);
    expect(last.dls).toBeGreaterThan(0);
  });

  it("fills VSEC on every station as the projection onto the start→last-target bearing", () => {
    // Build a simple HC3D so we have a curve + densified stations.
    // Last target at (NS=0, EW=2000) → VSEC reference bearing is due east.
    // For any station with NS=0, VSEC = EW; for the start, VSEC = 0.
    const segments: Segment[] = [
      startStation(),
      {
        ...startStation(),
        order: 1, typ: ProfileType.HC3D,
        ns: 0, ew: 2000, tvd: 6000,
        inc: PI / 4, azm: PI / 2,
      },
    ];
    const r = dispatch(segments);
    expect(r.ok).toBe(true);
    // Start station = (0,0) → VSEC = 0
    expect(r.stations[0].vsec).toBeCloseTo(0, 6);
    // Last station should equal target → VSEC ≈ 2000
    const last = r.stations[r.stations.length - 1];
    expect(last.vsec).toBeCloseTo(2000, 1);
  });

  it("fills BR and TR on keypoints and stations via the post-pass", () => {
    // Build a HC3D so we have a real curve with both inc and azm changing.
    const segments: Segment[] = [
      startStation(),
      {
        ...startStation(),
        order: 1, typ: ProfileType.HC3D,
        ns: 0, ew: 2000, tvd: 6000,
        inc: PI / 4, azm: PI / 2,
      },
    ];
    const r = dispatch(segments);
    expect(r.ok).toBe(true);
    // The final keypoint (= target after curve) should have:
    //   br ≈ Δinc / dmd, sign positive for a build curve.
    //   tr finite (azm change exists too in HC3D).
    const lastKp = r.keypoints[0].points[r.keypoints[0].points.length - 1];
    expect(lastKp.br).toBeGreaterThan(0);
    expect(Number.isFinite(lastKp.tr)).toBe(true);
    // Densified stations along the curve must also have a nonzero br for any
    // station whose MD is inside the curve portion (not the initial hold).
    const inCurve = r.stations.find((s) => s.inc > 0.01 && s.dmd > 0);
    expect(inCurve?.br ?? 0).toBeGreaterThan(0);
  });

  it("HCH from a DEVIATED start: azmFind gives 2 candidates, dispatcher picks the chosen one", () => {
    // Pascal Unit02.pas:HCH calls azmfind whenever target.azm is left blank
    // and the prev tangent is non-vertical — azmfind returns two azimuth
    // candidates for the curve plane (Form07 lets the user pick). When the
    // start is INCLINED, both branches yield geometrically valid azimuths;
    // when vertical, both candidates collapse to the same value (since the
    // curve plane is fully determined by the target offset).
    //
    // Setup: START already inclined at (15°, 30° azm) — typical resumption
    // of a directional well. HCH builds to a target at (NS=500, EW=1500,
    // TVD=4000), final inc=45°, DLS=3°/100ft.
    const startDeviated: Segment = {
      ...startStation(),
      inc: 15 * PI / 180, azm: 30 * PI / 180,
      // Position the start at MD=500 (the wellhead column shows 0 but
      // dispatch reads it as the running prev md).
      md: 500, tvd: 480, ns: 65, ew: 38,
    };
    const segments: Segment[] = [
      startDeviated,
      { ...startStation(), order: 1, typ: ProfileType.HCH },   // KOP
      { ...startStation(), order: 2, typ: ProfileType.HCH,
        dls: 3 * PI / 180 / 100 },                              // EOC w/ DLS
      { ...startStation(), order: 3, typ: ProfileType.HCH,
        inc: 45 * PI / 180,
        tvd: 4000, ns: 500, ew: 1500 },                         // Target
    ];

    // HCH group's target row has order=3 — the per-segment choice key.
    const r1 = dispatch(segments, { azimuthChoices: { 3: 1 } });
    expect(r1.ok).toBe(true);
    expect(r1.errors).toHaveLength(0);
    const last1 = r1.stations[r1.stations.length - 1];
    expect(last1.ns).toBeCloseTo(500, 0);
    expect(last1.ew).toBeCloseTo(1500, 0);
    expect(last1.tvd).toBeCloseTo(4000, 0);
    expect(rad2deg(last1.inc)).toBeCloseTo(45, 1);

    // Branch 2 for the same group also closes — different side of the
    // start tangent, same 3D endpoint.
    const r2 = dispatch(segments, { azimuthChoices: { 3: 2 } });
    expect(r2.ok).toBe(true);
    const last2 = r2.stations[r2.stations.length - 1];
    expect(last2.ns).toBeCloseTo(500, 0);
    expect(last2.ew).toBeCloseTo(1500, 0);
    expect(last2.tvd).toBeCloseTo(4000, 0);

    // azmCandidates must be populated — Pascal Form07 surfaced this choice
    // to the user; we surface the same info so the React modal can pop.
    expect(r1.azmCandidates.length).toBeGreaterThanOrEqual(1);
    expect(r1.azmCandidates[0].candidate1Deg).not.toBeCloseTo(
      r1.azmCandidates[0].candidate2Deg,
      1,
    );
    expect(r1.azmCandidates[0].chosen).toBe(1);
    expect(r2.azmCandidates[0]?.chosen).toBe(2);

    // For this specific geometry the curve plane is fully determined by the
    // start tangent + target position (atan2 of NS/EW delta), so azmFind's
    // two candidates collapse to the same plane after `inPlane2D`'s 3D
    // unprojection. That's fine — the dispatcher's safety net is that it
    // always returns a feasible curve. Real 2-azm divergence only shows up
    // for the "starred" profiles where the user supplies a target azimuth
    // instead of NS/EW (see HC3D_STAR / CH3D_STAR / etc.).
    //
    // Both branches must at minimum produce a feasible result that lands
    // at the user's 3D target.
    expect(r2.errors).toHaveLength(0);
  });

  it("HC3D from a DEVIATED start: dispatcher handles 2 azm candidates", () => {
    // Same idea as the HCH azm test, but for HC3D — Pascal Unit02.pas:HC3DTFT
    // and the dispatcher's solveAndBuild() call azmfind() whenever target.azm
    // is left blank and the prev tangent is non-vertical, because the curve
    // plane orientation can be one of two candidates.
    //
    // Setup mirrors a realistic sidetrack scenario: the well is already
    // tilted (inc=10°, azm=20°) at some MD when the user adds an HC3D
    // segment to a deviated target. Both `azimuthChoice: 1` and `:2` must
    // produce a feasible curve that closes at the user's 3D target.
    const startDeviated: Segment = {
      ...startStation(),
      inc: 10 * PI / 180, azm: 20 * PI / 180,
      md: 800, tvd: 780, ns: 110, ew: 47,
    };
    const segments: Segment[] = [
      startDeviated,
      { ...startStation(), order: 1, typ: ProfileType.HC3D },  // KOP row
      { ...startStation(), order: 2, typ: ProfileType.HC3D,
        inc: 60 * PI / 180,
        tvd: 6000, ns: 1800, ew: 2400 },                        // EOC target
    ];

    // The HC3D group's last row has order=2 — the key for per-segment choice.
    for (const choice of [1, 2] as const) {
      const r = dispatch(segments, { azimuthChoices: { 2: choice } });
      expect(r.ok, `azimuthChoice=${choice} failed: ${r.errors[0]?.message}`).toBe(true);
      const last = r.stations[r.stations.length - 1];
      // Both branches must close to the user's requested 3D position.
      expect(last.ns).toBeCloseTo(1800, 0);
      expect(last.ew).toBeCloseTo(2400, 0);
      expect(last.tvd).toBeCloseTo(6000, 0);
      expect(rad2deg(last.inc)).toBeCloseTo(60, 1);
    }
  });

  it("fills TF=0 on the final keypoint (no following curve)", () => {
    // Pascal convention: the LAST keypoint of the trajectory has TF=0,
    // because TF is set from the NEXT curve's dogleg, and there isn't one.
    const segments: Segment[] = [
      startStation(),
      {
        ...startStation(),
        order: 1, typ: ProfileType.HC3D,
        ns: 0, ew: 2000, tvd: 6000,
        inc: PI / 4, azm: PI / 2,
      },
    ];
    const r = dispatch(segments);
    expect(r.ok).toBe(true);
    const allKps = r.keypoints.flatMap((g) => g.points);
    expect(allKps[allKps.length - 1].tf).toBe(0);
  });

  it("returns errors for infeasible geometry without crashing", () => {
    // 45° final inclination but only 200m TVD — no room for the curve.
    const segments: Segment[] = [
      startStation(),
      {
        ...startStation(),
        order: 1, typ: ProfileType.HC3D,
        ew: 2000, tvd: 200,
        inc: PI / 4, azm: PI / 2,
      },
    ];
    const r = dispatch(segments);
    expect(r.ok).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
  });
});
