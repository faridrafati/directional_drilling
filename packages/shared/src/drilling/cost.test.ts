import { describe, expect, it } from "vitest";
import { rigUsdPerHr, tripHours, costPerMeter, tripAdjustedRop } from "./cost.js";

describe("rigUsdPerHr", () => {
  it("converts USD/day to USD/hr", () => {
    expect(rigUsdPerHr(30_000)).toBe(1250);
  });
});

describe("tripHours", () => {
  it("t = 2·depth/speed + handling", () => {
    expect(tripHours({ depthM: 2000, tripSpeedMHr: 300, handlingHr: 2 })).toBeCloseTo(15.3333, 4);
  });
  it("falls back to handling only when trip speed is non-positive", () => {
    expect(tripHours({ depthM: 2000, tripSpeedMHr: 0, handlingHr: 2 })).toBe(2);
  });
});

describe("costPerMeter", () => {
  it("C = (B + R·(T+t))/F — worked example", () => {
    // B 11 200, R 1250/hr, T 50 hr, t 20 hr, F 240 m → 411.25 USD/m
    const c = costPerMeter({ bitUsd: 11_200, rigUsdPerHr: 1250, drillHr: 50, tripHr: 20, meterageM: 240 })!;
    expect(c).toBeCloseTo(411.25, 6);
  });
  it("returns null for non-positive meterage", () => {
    expect(costPerMeter({ bitUsd: 11_200, rigUsdPerHr: 1250, drillHr: 50, tripHr: 20, meterageM: 0 })).toBeNull();
  });
});

describe("tripAdjustedRop", () => {
  it("meterage / (drill + trip)", () => {
    expect(tripAdjustedRop({ meterageM: 240, drillHr: 50, tripHr: 20 })!).toBeCloseTo(240 / 70, 9);
  });
});
