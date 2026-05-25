import { describe, it, expect } from "vitest";
import { convertLength, convertAngle, deg2rad, rad2deg, dlsToDisplay, dlsFromDisplay } from "./index.js";

describe("convertLength", () => {
  it("is identity for same unit", () => {
    expect(convertLength(42, "m", "m")).toBe(42);
  });

  it("converts m to ft (1 m = 3.2808398950 ft)", () => {
    expect(convertLength(1, "m", "ft")).toBeCloseTo(3.2808398950, 6);
  });

  it("converts ft to m round-trip", () => {
    const ft = convertLength(1000, "m", "ft");
    expect(convertLength(ft, "ft", "m")).toBeCloseTo(1000, 6);
  });

  it("converts km to mi", () => {
    expect(convertLength(1, "km", "mi")).toBeCloseTo(0.621371, 5);
  });

  it("converts nmi to m", () => {
    expect(convertLength(1, "nmi", "m")).toBe(1852);
  });
});

describe("convertAngle / deg2rad / rad2deg", () => {
  it("90° = π/2", () => {
    expect(deg2rad(90)).toBeCloseTo(Math.PI / 2, 12);
  });
  it("π = 180°", () => {
    expect(rad2deg(Math.PI)).toBeCloseTo(180, 12);
  });
  it("convertAngle is symmetric", () => {
    const r = convertAngle(45, "deg", "rad");
    expect(convertAngle(r, "rad", "deg")).toBeCloseTo(45, 12);
  });
});

describe("DLS conversion", () => {
  it("round-trips deg/100ft for ft-storage project", () => {
    const display = 3.5; // deg/100ft
    const stored = dlsFromDisplay(display, "ft", "deg/100ft");
    expect(dlsToDisplay(stored, "ft", "deg/100ft")).toBeCloseTo(display, 12);
  });

  it("round-trips deg/30m for m-storage project", () => {
    const display = 2.0;
    const stored = dlsFromDisplay(display, "m", "deg/30m");
    expect(dlsToDisplay(stored, "m", "deg/30m")).toBeCloseTo(display, 12);
  });

  it("3°/100ft stored in m equals 3° per (100 ft in metres)", () => {
    const stored = dlsFromDisplay(3, "m", "deg/100ft");
    // 3 degrees per 30.48 m → expect ≈ 0.05236 rad / 30.48 ≈ 0.001718 rad/m
    expect(stored).toBeCloseTo((3 * Math.PI / 180) / 30.48, 9);
  });
});
