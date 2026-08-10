/**
 * `parseInches` — the one place a typed diameter becomes a number.
 *
 * There were two implementations of this and they disagreed. The schematic's
 * used `parseFloat`, which reads `17-1/2" H.S.` as 17: a plausible number that
 * is the wrong diameter, drawn half an inch narrow and believed. The daily
 * report's used `Number()` on the whole string and returned null. Nothing
 * noticed, because a schematic band that is slightly too narrow looks exactly
 * like a schematic band.
 *
 * The strict reading won, so these cases pin it down: everything the samples
 * actually write must parse, and anything that is not wholly a diameter must
 * come back null rather than as its first few characters.
 */
import { describe, it, expect } from "vitest";
import { parseInches } from "./schematic.js";

describe("parseInches", () => {
  it("reads the notations the samples use", () => {
    // Whole, decimal, and the two ways a fractional diameter gets typed.
    expect(parseInches("20")).toBe(20);
    expect(parseInches("10.752")).toBeCloseTo(10.752, 6);
    expect(parseInches("13 3/8")).toBeCloseTo(13.375, 6);
    expect(parseInches("13-3/8")).toBeCloseTo(13.375, 6);
    expect(parseInches("17 1/2")).toBeCloseTo(17.5, 6);
    expect(parseInches("3/8")).toBeCloseTo(0.375, 6);
    expect(parseInches("12 1/4")).toBeCloseTo(12.25, 6);
  });

  it("tolerates a trailing unit and surrounding space", () => {
    expect(parseInches("26in")).toBe(26);
    expect(parseInches("26 in.")).toBe(26);
    expect(parseInches("  9 5/8  ")).toBeCloseTo(9.625, 6);
  });

  it("returns null rather than a confident wrong answer", () => {
    // THE case that motivated the unification: parseFloat gives 17 here.
    expect(parseInches('17-1/2" H.S.')).toBeNull();
    expect(parseInches("12 1/4 hole, reamed")).toBeNull();
    expect(parseInches("tbd")).toBeNull();
    expect(parseInches("")).toBeNull();
    expect(parseInches("   ")).toBeNull();
    expect(parseInches(null)).toBeNull();
    expect(parseInches(undefined)).toBeNull();
  });

  it("does not invent a diameter from a division by zero", () => {
    // `3/0` is not Infinity inches — it is somebody mistyping. Asserting NULL
    // rather than "not finite": the first version of this test passed while the
    // function still returned Infinity, which is the sort of test that makes a
    // bug look checked.
    expect(parseInches("3/0")).toBeNull();
    expect(parseInches("3 1/0")).toBeNull();
  });
});
