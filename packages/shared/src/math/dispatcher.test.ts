import { describe, it, expect } from "vitest";
import { dispatch } from "./dispatcher.js";
import { ProfileType } from "./profile-types.js";
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

  it("accepts either DLS sign on the default c3 fallback (drop curve from a build-curve start)", () => {
    // CURVE_E4 = build/drop curve to target inc. Stack: START (inc=0) →
    // CURVE_E1 builds to 60° (correct sign) → CURVE_E4 drops to 30°
    // BUT the user enters POSITIVE DLS on the drop. The dispatcher should
    // flip the sign automatically and still solve.
    const segments: Segment[] = [
      startStation(),
      // Build curve START→60° (positive DLS — correct direction).
      { ...startStation(), order: 1, typ: ProfileType.CURVE_E1,
        md: 1000, inc: 60 * PI / 180, dls: 6 * PI / 180 / 100 },
      // Drop curve 60°→30°. User enters POSITIVE DLS even though the
      // math needs negative for the drop direction.
      { ...startStation(), order: 2, typ: ProfileType.CURVE_E4,
        inc: 30 * PI / 180, dls: 3 * PI / 180 / 100 },
    ];
    const r = dispatch(segments);
    expect(r.ok).toBe(true);
    expect(r.errors).toHaveLength(0);
    const last = r.stations[r.stations.length - 1];
    expect(last.inc).toBeCloseTo(30 * PI / 180, 3);
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
