import { describe, expect, it } from "vitest";
import { tonnesToLbf, knmToFtLbf, mhrToFthr, klbToTonnes } from "./units.js";

describe("metric → API converters (spec §4)", () => {
  it("WOB: 20 t = 44 092.4 lbf", () => {
    expect(tonnesToLbf(20)).toBeCloseTo(44092.4, 1);
  });
  it("torque: 10 kN·m = 7375.62 ft·lbf", () => {
    expect(knmToFtLbf(10)).toBeCloseTo(7375.62, 2);
  });
  it("rate: 3 m/hr = 9.84252 ft/hr", () => {
    expect(mhrToFthr(3)).toBeCloseTo(9.84252, 5);
  });
  it("klb → tonnes round-trips against tonnesToLbf", () => {
    expect(klbToTonnes(20)).toBeCloseTo(9.0719, 4);
    expect(tonnesToLbf(klbToTonnes(20)) / 1000).toBeCloseTo(20, 9);
  });
});
