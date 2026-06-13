import { describe, expect, it } from "vitest";
import { parseBitSizeInches, bitClass } from "./bit.js";

describe("parseBitSizeInches", () => {
  it("parses mixed fractions, bare fractions and decimals", () => {
    expect(parseBitSizeInches("12 1/4")).toBeCloseTo(12.25, 9);
    expect(parseBitSizeInches("8 3/8")).toBeCloseTo(8.375, 9);
    expect(parseBitSizeInches("17 1/2")).toBeCloseTo(17.5, 9);
    expect(parseBitSizeInches("26")).toBe(26);
    expect(parseBitSizeInches("5.875")).toBeCloseTo(5.875, 9);
    expect(parseBitSizeInches("3/4")).toBeCloseTo(0.75, 9);
  });
  it("rejects blanks, junk and out-of-range values", () => {
    expect(parseBitSizeInches("")).toBeNull();
    expect(parseBitSizeInches(null)).toBeNull();
    expect(parseBitSizeInches("abc")).toBeNull();
    expect(parseBitSizeInches("99")).toBeNull(); // ≥ 60 in
  });
});

describe("bitClass", () => {
  it("letter-prefixed IADC ⇒ PDC, numeric ⇒ roller", () => {
    expect(bitClass({ iadc: "M323" })).toBe("PDC");
    expect(bitClass({ iadc: "537" })).toBe("roller");
  });
  it("falls back to the diamond flag / type text, then defaults to roller", () => {
    expect(bitClass({ diamond: true })).toBe("PDC");
    expect(bitClass({ type: "PDC FX" })).toBe("PDC");
    expect(bitClass({})).toBe("roller");
  });
});
