import { describe, expect, it } from "vitest";
import { linearFit, powerLawFit, spearman, mean, median, quantile, iqrFence } from "./stats.js";

describe("linearFit", () => {
  it("recovers a known line y = 3x + 2 with R² = 1", () => {
    const f = linearFit([0, 1, 2, 3], [2, 5, 8, 11])!;
    expect(f.slope).toBeCloseTo(3, 9);
    expect(f.intercept).toBeCloseTo(2, 9);
    expect(f.r2).toBeCloseTo(1, 9);
    expect(f.n).toBe(4);
  });
  it("ignores non-finite pairs and needs ≥ 2 with spread", () => {
    expect(linearFit([1, NaN, 3], [1, 2, 3])!.n).toBe(2);
    expect(linearFit([1], [1])).toBeNull();
    expect(linearFit([2, 2, 2], [1, 2, 3])).toBeNull(); // no x spread
  });
});

describe("powerLawFit", () => {
  it("recovers ROP = 5·MSE^(−0.8)", () => {
    const xs = Array.from({ length: 10 }, (_, i) => i + 1);
    const ys = xs.map((x) => 5 * Math.pow(x, -0.8));
    const f = powerLawFit(xs, ys)!;
    expect(f.a).toBeCloseTo(5, 6);
    expect(f.b).toBeCloseTo(0.8, 6);
    expect(f.r2).toBeCloseTo(1, 9);
  });
  it("uses only strictly-positive pairs", () => {
    const f = powerLawFit([1, 0, -2, 4], [2, 9, 9, 0.5]);
    expect(f!.n).toBe(2);
  });
});

describe("spearman", () => {
  it("is +1 for a monotone increasing relation, −1 for decreasing", () => {
    expect(spearman([1, 2, 3, 4, 5], [2, 4, 6, 8, 10])!).toBeCloseTo(1, 9);
    expect(spearman([1, 2, 3, 4, 5], [10, 8, 6, 4, 2])!).toBeCloseTo(-1, 9);
  });
  it("returns null below three pairs", () => {
    expect(spearman([1, 2], [1, 2])).toBeNull();
  });
});

describe("summaries", () => {
  it("mean / median / quantile", () => {
    expect(mean([1, 2, 3, 4])).toBeCloseTo(2.5, 9);
    expect(median([1, 2, 3, 4, 5])).toBe(3);
    expect(quantile([1, 2, 3, 4], 0.5)).toBeCloseTo(2.5, 9);
    expect(quantile([10], 0.9)).toBe(10);
  });
  it("iqrFence brackets the inlier range", () => {
    const f = iqrFence([1, 2, 3, 4, 5, 6, 7, 8])!;
    expect(f.q1).toBeCloseTo(2.75, 6);
    expect(f.q3).toBeCloseTo(6.25, 6);
    expect(f.lo).toBeCloseTo(2.75 - 1.5 * 3.5, 6);
    expect(f.hi).toBeCloseTo(6.25 + 1.5 * 3.5, 6);
  });
});
