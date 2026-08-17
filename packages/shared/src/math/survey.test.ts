/**
 * Minimum-curvature survey integration.
 *
 * A wrong TVD is worse than a blank one: it is plausible, it propagates into the
 * schematic and every depth-referenced report, and nobody re-derives it by hand.
 * So these cases pin the method against results that can be checked
 * independently — a vertical hole, a pure build, a known worked example, and the
 * degenerate inputs that break naive implementations.
 */
import { describe, it, expect } from "vitest";
import { computeSurvey } from "./survey.js";

const st = (md: number, inclination: number, azimuth: number, extra = {}) =>
  ({ md, inclination, azimuth, ...extra });

describe("computeSurvey", () => {
  it("leaves a vertical hole vertical", () => {
    const r = computeSurvey([st(0, 0, 0), st(500, 0, 0), st(1000, 0, 0)]);
    expect(r).toHaveLength(3);
    for (const s of r) {
      expect(s.tvd).toBeCloseTo(s.md, 9);
      expect(s.ns).toBeCloseTo(0, 9);
      expect(s.ew).toBeCloseTo(0, 9);
      expect(s.departure).toBeCloseTo(0, 9);
    }
    // No arc into the first station, so no dogleg there; straight hole after.
    expect(r[0].dls).toBeNull();
    expect(r[1].dls).toBeCloseTo(0, 9);
  });

  it("holds a constant-angle tangent on its bearing", () => {
    // 30° inclination due east, held for 100 m of measured depth.
    const r = computeSurvey([st(1000, 30, 90), st(1100, 30, 90)]);
    const s = r[1];
    expect(s.tvd - r[0].tvd).toBeCloseTo(100 * Math.cos(30 * Math.PI / 180), 9);
    expect(s.ew - r[0].ew).toBeCloseTo(100 * Math.sin(30 * Math.PI / 180), 9);
    expect(s.ns - r[0].ns).toBeCloseTo(0, 9);
    expect(s.dls).toBeCloseTo(0, 9);
    expect(s.buildRate).toBeCloseTo(0, 9);
  });

  it("reports dogleg severity as degrees per unit of measured depth", () => {
    // 3° of inclination change over 30 m is 0.1 °/m.
    const r = computeSurvey([st(1000, 0, 0), st(1030, 3, 0)]);
    expect(r[1].dls).toBeCloseTo(3 / 30, 6);
    expect(r[1].buildRate).toBeCloseTo(3 / 30, 9);
    expect(r[1].turnRate).toBeCloseTo(0, 9);
  });

  it("matches a worked minimum-curvature example", () => {
    // 1000 m at 15°/20° to 1100 m at 25°/45°, worked through the formula
    // independently of this implementation:
    //   β  = acos(cos(i₂−i₁) − sin i₁·sin i₂·(1 − cos Δazi)) = 12.951651°
    //   RF = (2/β)·tan(β/2)                                  =  1.004280
    //   ΔTVD = 50·(cos15 + cos25)·RF                         = 94.0123
    //   ΔNS  = 50·(sin15·cos20 + sin25·cos45)·RF             = 27.2183
    //   ΔEW  = 50·(sin15·sin20 + sin25·sin45)·RF             = 19.4508
    const r = computeSurvey([st(1000, 15, 20), st(1100, 25, 45)]);
    const d = r[1];
    expect(d.tvd - r[0].tvd).toBeCloseTo(94.0123, 3);
    expect(d.ns - r[0].ns).toBeCloseTo(27.2183, 3);
    expect(d.ew - r[0].ew).toBeCloseTo(19.4508, 3);
    expect(d.dls! * 30).toBeCloseTo(3.8855, 3);      // °/30 m
    // The arc is longer than the straight chord between the stations.
    expect(d.tvd - r[0].tvd).toBeGreaterThan(50 * (Math.cos(15 * Math.PI / 180) + Math.cos(25 * Math.PI / 180)));
  });

  it("drops stations flagged bad, which the real data interleaves", () => {
    // The sample database carries duplicate measured depths where one row is
    // flagged — including them yields a zero-length segment and a junk dogleg.
    const r = computeSurvey([
      st(0, 0, 0),
      st(100, 5, 90, { dontUse: true }),
      st(100, 2, 10),
      st(200, 4, 10),
    ]);
    expect(r).toHaveLength(3);
    expect(r.map((s) => s.md)).toEqual([0, 100, 200]);
    for (const s of r) expect(Number.isFinite(s.tvd)).toBe(true);
  });

  it("sorts by measured depth rather than trusting row order", () => {
    const r = computeSurvey([st(200, 4, 10), st(0, 0, 0), st(100, 2, 10)]);
    expect(r.map((s) => s.md)).toEqual([0, 100, 200]);
  });

  it("starts from the tie-in when the survey header carries one", () => {
    const r = computeSurvey([st(1100, 0, 0)], {
      tieIn: { md: 1000, tvd: 990, ns: 12, ew: -4, inclination: 0, azimuth: 0 },
    });
    // 100 m of vertical hole below a tie-in 10 m shallower than its measured depth.
    expect(r[0].tvd).toBeCloseTo(1090, 6);
    expect(r[0].ns).toBeCloseTo(12, 6);
    expect(r[0].ew).toBeCloseTo(-4, 6);
  });

  it("lets a stored override win, and carries it forward", () => {
    const r = computeSurvey([
      st(0, 0, 0),
      st(1000, 0, 0, { tvdOverride: 900 }),
      st(1100, 0, 0),
    ]);
    expect(r[1].tvd).toBe(900);
    expect(r[1].overridden).toBe(true);
    // The next station integrates on from the CORRECTED depth, not the computed
    // one — otherwise the correction is silently discarded one row later.
    expect(r[2].tvd).toBeCloseTo(1000, 6);
    expect(r[2].overridden).toBe(false);
  });

  it("computes vertical section along the wellbore's direction", () => {
    // Due north displacement, VS measured along north, is the northing itself.
    const north = computeSurvey([st(0, 0, 0), st(100, 90, 0)], { vsDirection: 0 });
    expect(north[1].vs).toBeCloseTo(north[1].ns, 6);
    // …and along east it is zero for a purely northward hole.
    const east = computeSurvey([st(0, 0, 0), st(100, 90, 0)], { vsDirection: 90 });
    expect(east[1].vs).toBeCloseTo(0, 6);
    // No direction on the wellbore means no vertical section, not a zero.
    expect(computeSurvey([st(0, 0, 0), st(100, 90, 0)])[1].vs).toBeNull();
  });

  it("takes the short way round when azimuth crosses north", () => {
    // 350° → 10° is a 20° turn to the right, not a 340° turn to the left.
    const r = computeSurvey([st(1000, 30, 350), st(1030, 30, 10)]);
    expect(r[1].turnRate).toBeCloseTo(20 / 30, 6);
    expect(r[1].dls!).toBeGreaterThan(0);
    expect(r[1].dls! * 30).toBeLessThan(20);      // the dogleg is not the raw turn
  });

  it("survives the degenerate inputs", () => {
    expect(computeSurvey([])).toEqual([]);
    // Every station flagged bad leaves nothing to integrate.
    expect(computeSurvey([st(0, 0, 0, { dontUse: true })])).toEqual([]);
    // Repeated depth: no arc, no divide by zero.
    const same = computeSurvey([st(500, 10, 20), st(500, 10, 20)]);
    expect(same).toHaveLength(2);
    expect(Number.isFinite(same[1].tvd)).toBe(true);
    expect(same[1].dls).toBeNull();
    // A 180° reversal is the extreme dogleg and must stay finite.
    const flip = computeSurvey([st(1000, 90, 0), st(1030, 90, 180)]);
    expect(Number.isFinite(flip[1].tvd)).toBe(true);
    expect(flip[1].dls! * 30).toBeCloseTo(180, 3);
  });
});
