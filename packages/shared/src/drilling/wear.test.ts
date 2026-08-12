import { describe, it, expect } from "vitest";
import {
  wearAvg, wearPerHour, wearPer100m, isSevereDull, isFailureReason,
  FAILURE_REASON_CODES,
} from "./wear.js";

describe("wearAvg", () => {
  it("averages the two cutting-structure rows", () => {
    expect(wearAvg(2, 4)).toBe(3);
    expect(wearAvg(0, 0)).toBe(0);
    expect(wearAvg(8, 8)).toBe(8);
  });

  it("returns null when either row is missing", () => {
    // Half-reported is not half-worn. Averaging 4 with a missing row would
    // report 2 and halve every rate built on it.
    expect(wearAvg(4, null)).toBeNull();
    expect(wearAvg(null, 4)).toBeNull();
    expect(wearAvg(null, null)).toBeNull();
    expect(wearAvg(undefined, 3)).toBeNull();
  });

  it("rejects values outside the 0-8 IADC scale", () => {
    expect(wearAvg(-1, 3)).toBeNull();
    expect(wearAvg(3, 9)).toBeNull();
    expect(wearAvg(NaN, 3)).toBeNull();
  });
});

describe("wearPerHour", () => {
  it("divides grade points by rotating hours", () => {
    expect(wearPerHour(4, 8)).toBeCloseTo(0.5, 10);
    expect(wearPerHour(3, 1.5)).toBeCloseTo(2, 10);
  });

  it("returns null on a non-positive or missing denominator", () => {
    expect(wearPerHour(4, 0)).toBeNull();
    expect(wearPerHour(4, -2)).toBeNull();
    expect(wearPerHour(4, null)).toBeNull();
    expect(wearPerHour(null, 8)).toBeNull();
  });
});

describe("wearPer100m", () => {
  it("scales to a per-100-metre rate", () => {
    // 3 grade points over 300 m = 1 point per 100 m.
    expect(wearPer100m(3, 300)).toBeCloseTo(1, 10);
    expect(wearPer100m(2, 50)).toBeCloseTo(4, 10);
  });

  it("returns null on a non-positive or missing denominator", () => {
    expect(wearPer100m(3, 0)).toBeNull();
    expect(wearPer100m(3, null)).toBeNull();
    expect(wearPer100m(null, 300)).toBeNull();
  });
});

describe("isSevereDull", () => {
  it("triggers on EITHER row at 4/8 or worse", () => {
    expect(isSevereDull(4, 0)).toBe(true);
    expect(isSevereDull(0, 4)).toBe(true);
    expect(isSevereDull(8, 8)).toBe(true);
  });

  it("does not average the rows away", () => {
    // Pristine inner, destroyed outer averages to 4 and would read "moderate"
    // on a mean test — but the gauge-side cutters are gone.
    expect(isSevereDull(0, 8)).toBe(true);
    expect(isSevereDull(3, 3)).toBe(false);
  });

  it("treats a missing row as no evidence, not as zero", () => {
    expect(isSevereDull(null, null)).toBe(false);
    expect(isSevereDull(null, 5)).toBe(true);
  });
});

describe("isFailureReason", () => {
  it("recognises the failure codes", () => {
    for (const c of FAILURE_REASON_CODES) expect(isFailureReason(c)).toBe(true);
  });

  it("is case- and whitespace-insensitive", () => {
    expect(isFailureReason(" dtf ")).toBe(true);
    expect(isFailureReason("Bt")).toBe(true);
  });

  it("does not flag a planned pull", () => {
    // TD, casing point and directional pulls are runs that ended ON PLAN.
    expect(isFailureReason("TD")).toBe(false);
    expect(isFailureReason("CP")).toBe(false);
    expect(isFailureReason("DP")).toBe(false);
    expect(isFailureReason(null)).toBe(false);
    expect(isFailureReason("")).toBe(false);
  });
});
