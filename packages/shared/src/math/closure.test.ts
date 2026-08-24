/**
 * Vertical section when nobody entered a direction to measure it along.
 *
 * Peloton's help states the rule outright: "If you do not enter the Vertical
 * Section Direction, WellView calculates a Closure Direction, and the Vertical
 * Section is then calculated along this direction. The Closure Direction is the
 * azimuth that describes a straight line between the starting point of the
 * wellbore and the end point of the wellbore."
 *
 * Only three of the sample's 41 surveyed wellbores carry a direction of their
 * own, so the column was blank on 38 of them.
 *
 * The refusals are the substance here. A closure direction drawn through a
 * survey that never recorded a bearing is a number with nothing behind it, and
 * it would fill the column on exactly the wells where a reader is least able to
 * tell.
 */
import { describe, it, expect } from "vitest";
import { computeSurvey, closureOf, type SurveyStation } from "./survey.js";

/** A station list, angles in degrees. */
const stn = (rows: [number, number, number][]): SurveyStation[] =>
  rows.map(([md, inclination, azimuth]) => ({ md, inclination, azimuth }));

describe("the closure direction", () => {
  it("is the bearing from the first station to the last", () => {
    // Straight down, then a bend due east. The closure of the whole hole is
    // east of north by whatever the horizontal displacement says.
    const r = computeSurvey(stn([
      [0, 0, 90], [500, 0, 90], [1000, 60, 90], [1500, 60, 90],
    ]), {});
    const c = closureOf(r)!;
    expect(c).toBeTruthy();
    expect(c.direction, "due east").toBeCloseTo(90, 6);
    expect(c.distance).toBeGreaterThan(0);
    // …and the last station's EW is that distance, since it went only east.
    expect(c.distance).toBeCloseTo(r[r.length - 1].ew - r[0].ew, 6);
  });

  it("measures the vertical section along it when the wellbore has none", () => {
    const stations = stn([[0, 0, 45], [500, 0, 45], [1000, 60, 45], [1500, 60, 45]]);
    const withNone = computeSurvey(stations, {});
    const c = closureOf(withNone)!;

    // Every station now has a VS, and each is flagged as derived.
    for (const s of withNone) {
      expect(s.vs, "vertical section").not.toBeNull();
      expect(s.vsDirectionDerived).toBe(true);
    }
    // At the last station, VS along the closure IS the closure distance — the
    // whole displacement projects onto the line it defines.
    expect(withNone[withNone.length - 1].vs!).toBeCloseTo(c.distance, 6);

    // An ENTERED direction wins, and is not flagged derived.
    const withDir = computeSurvey(stations, { vsDirection: 45 });
    for (const s of withDir) expect(s.vsDirectionDerived).toBeFalsy();
    expect(withDir[withDir.length - 1].vs!).toBeCloseTo(c.distance, 6);
  });

  it("refuses a survey that never recorded a bearing", () => {
    // Null azimuths: the integration already flags the stations, and a closure
    // through assumed bearings is a closure through an assumption.
    const noAzi: SurveyStation[] = [
      { md: 0, inclination: 0, azimuth: null as unknown as number },
      { md: 500, inclination: 30, azimuth: null as unknown as number },
      { md: 1000, inclination: 60, azimuth: null as unknown as number },
    ];
    const r = computeSurvey(noAzi, {});
    expect(r.some((s) => s.azimuthAssumed)).toBe(true);
    expect(closureOf(r)).toBeNull();
    for (const s of r) expect(s.vs, "no direction, no vertical section").toBeNull();
  });

  it("refuses a survey whose every azimuth is stored as exactly zero", () => {
    /*
     * The case the null-azimuth guard cannot see, and the sample has one: 27
     * stations with a maximum inclination of two degrees and the azimuth
     * written as 0 on every one — a vertical hole whose bearings were never
     * recorded and were stored as zero rather than left blank.
     *
     * Nothing in the values separates that from a hole running due north, so
     * this guard exists on its own. Left alone it yields a closure direction of
     * exactly 0.00 degrees and a fully populated vertical section column for a
     * well that does not have one.
     */
    const r = computeSurvey(stn([
      [0, 0, 0], [400, 1, 0], [800, 2, 0], [1200, 1.5, 0], [1999, 2, 0],
    ]), {});
    expect(r.some((s) => s.azimuthAssumed), "the azimuths are present, just zero").toBe(false);
    expect(closureOf(r)).toBeNull();
    for (const s of r) expect(s.vs).toBeNull();
  });

  it("refuses a hole that never leaves vertical", () => {
    // Real bearings, but the hole goes nowhere: there is no direction to
    // project onto and the closure azimuth is whatever the noise added up to.
    const r = computeSurvey(stn([
      [0, 0, 30], [500, 1, 200], [1000, 2, 95], [1500, 1, 310],
    ]), {});
    expect(closureOf(r)).toBeNull();
    for (const s of r) expect(s.vs).toBeNull();
  });

  it("does not fall over on a survey with one station", () => {
    expect(closureOf(computeSurvey(stn([[0, 0, 0]]), {}))).toBeNull();
    expect(closureOf([])).toBeNull();
  });

  it("reports an azimuth in [0, 360), not a signed one", () => {
    // atan2 returns (-180, 180]. A hole heading west closes at 270, not -90:
    // a negative bearing would differ from the desktop by 360 degrees while
    // describing the same line.
    const r = computeSurvey(stn([[0, 0, 270], [500, 0, 270], [1000, 60, 270]]), {});
    const c = closureOf(r)!;
    expect(c.direction).toBeGreaterThanOrEqual(0);
    expect(c.direction).toBeLessThan(360);
    expect(c.direction).toBeCloseTo(270, 6);
  });

  it("honours the vertical-section origin the wellbore states", () => {
    const stations = stn([[0, 0, 90], [500, 0, 90], [1000, 60, 90]]);
    const plain = computeSurvey(stations, {});
    const shifted = computeSurvey(stations, { vsOriginEw: 100 });
    // Same direction, origin moved 100 east: every VS drops by 100.
    for (let i = 0; i < plain.length; i++) {
      expect(shifted[i].vs!).toBeCloseTo(plain[i].vs! - 100, 6);
    }
  });
});
