import { describe, it, expect } from "vitest";
import { bestComposite, ropBands, MIN_BAND_RUNS, type WellTrack } from "./benchmark.js";

/** A well that drills at a constant rate. */
const track = (key: string, daysPerM: number, from = 0, to = 3_000, n = 10): WellTrack => ({
  key,
  points: Array.from({ length: n + 1 }, (_, i) => {
    const depth = from + ((to - from) * i) / n;
    return { day: (depth - from) * daysPerM, depth };
  }),
});

describe("bestComposite", () => {
  it("is monotone non-decreasing in depth", () => {
    const c = bestComposite([track("a", 0.01), track("b", 0.02), track("c", 0.005)]);
    expect(c.length).toBeGreaterThan(2);
    for (let i = 1; i < c.length; i += 1) {
      expect(c[i].depth).toBeGreaterThan(c[i - 1].depth);
      expect(c[i].day).toBeGreaterThanOrEqual(c[i - 1].day);
    }
  });

  it("is never later than the fastest actual well at any depth", () => {
    // The property that makes it a reference: a "best" curve a real well beats
    // is not a best curve.
    const wells = [track("slow", 0.02), track("mid", 0.012), track("fast", 0.006)];
    const c = bestComposite(wells);
    for (const w of wells) {
      for (const p of w.points) {
        // the composite point at or just past this depth
        const at = c.filter((x) => x.depth <= p.depth).pop();
        if (!at) continue;
        expect(at.day).toBeLessThanOrEqual(p.day + 1e-6);
      }
    }
  });

  it("takes the best rate per depth band, not the best well overall", () => {
    // One well is fast shallow and slow deep, the other the reverse. The
    // composite must beat BOTH end to end, which no single well does.
    const shallowFast: WellTrack = {
      key: "sf",
      points: [{ day: 0, depth: 0 }, { day: 5, depth: 1_500 }, { day: 45, depth: 3_000 }],
    };
    const deepFast: WellTrack = {
      key: "df",
      points: [{ day: 0, depth: 0 }, { day: 40, depth: 1_500 }, { day: 50, depth: 3_000 }],
    };
    const c = bestComposite([shallowFast, deepFast]);
    const total = c[c.length - 1].day;
    expect(total).toBeLessThan(45);
    expect(total).toBeLessThan(50);
  });

  it("is not beaten by a well whose first record is already a deep jump", () => {
    // The real-data failure this property exists to catch. PYE-005 logged 845 m
    // on day 2 with nothing in between, so band-wise integration had to climb
    // every shallow band at some other well's rate and landed 1.26 days behind
    // a well it is supposed to bound.
    const jumper: WellTrack = {
      key: "jumper",
      points: [{ day: 0, depth: 300 }, { day: 2, depth: 845 }, { day: 60, depth: 3_000 }],
    };
    const plodder: WellTrack = {
      key: "plodder",
      points: Array.from({ length: 31 }, (_, i) => ({ day: i * 2, depth: 12 + i * 100 })),
    };
    const c = bestComposite([jumper, plodder]);
    for (const w of [jumper, plodder]) {
      for (const p of w.points) {
        const at = c.filter((x) => x.depth <= p.depth).pop();
        if (!at) continue;
        expect(at.day).toBeLessThanOrEqual(p.day + 1e-6);
      }
    }
    for (let i = 1; i < c.length; i += 1) expect(c[i].day).toBeGreaterThanOrEqual(c[i - 1].day);
  });

  it("keeps both properties at a robust percentile", () => {
    // A percentile composite is slower than the literal minimum by construction,
    // but it must still bound every actual well — the arrival-time clip is what
    // guarantees that, not the choice of percentile.
    const wells = [track("slow", 0.02), track("mid", 0.012), track("fast", 0.006)];
    const min = bestComposite(wells);
    const p10 = bestComposite(wells, { percentile: 0.1 });
    expect(p10[p10.length - 1].day).toBeGreaterThanOrEqual(min[min.length - 1].day);
    for (const w of wells) {
      for (const p of w.points) {
        const at = p10.filter((x) => x.depth <= p.depth).pop();
        if (!at) continue;
        expect(at.day).toBeLessThanOrEqual(p.day + 1e-6);
      }
    }
    for (let i = 1; i < p10.length; i += 1) expect(p10[i].day).toBeGreaterThanOrEqual(p10[i - 1].day);
  });

  it("ignores a lone freak interval at a percentile, but not at the minimum", () => {
    // One record pair that drilled a whole band in a day. The literal minimum
    // adopts it as the technical limit for that band; a percentile does not.
    const steady: WellTrack = {
      key: "steady",
      points: Array.from({ length: 21 }, (_, i) => ({ day: i * 5, depth: i * 150 })),
    };
    const freak: WellTrack = {
      key: "freak",
      points: [{ day: 0, depth: 1_500 }, { day: 1, depth: 1_650 }, { day: 80, depth: 3_000 }],
    };
    const min = bestComposite([steady, freak]);
    const p25 = bestComposite([steady, freak], { percentile: 0.25 });
    expect(p25[p25.length - 1].day).toBeGreaterThan(min[min.length - 1].day);
  });

  it("accepts a bare bin count for the literal-minimum form", () => {
    const c = bestComposite([track("a", 0.01), track("b", 0.02)], 8);
    expect(c).toHaveLength(9);          // lo + 8 band edges
  });

  it("survives unordered input", () => {
    const shuffled: WellTrack = {
      key: "x",
      points: [{ day: 20, depth: 2_000 }, { day: 0, depth: 0 }, { day: 10, depth: 1_000 }],
    };
    const c = bestComposite([shuffled]);
    for (let i = 1; i < c.length; i += 1) {
      expect(c[i].day).toBeGreaterThanOrEqual(c[i - 1].day);
    }
  });

  it("returns nothing when there is not enough to integrate", () => {
    expect(bestComposite([])).toEqual([]);
    expect(bestComposite([{ key: "a", points: [{ day: 0, depth: 100 }] }])).toEqual([]);
    // All at one depth: no interval to take a rate over.
    expect(bestComposite([{ key: "a", points: [{ day: 0, depth: 100 }, { day: 5, depth: 100 }] }])).toEqual([]);
  });
});

describe("ropBands", () => {
  const mk = (formation: string, vals: number[]) =>
    vals.map((ropMHr) => ({ formation, ropMHr }));

  it("reports P10/P50/P90 in order", () => {
    const runs = mk("Asmari", [2, 4, 6, 8, 10, 12, 14, 16, 18, 20]);
    const [b] = ropBands(runs);
    expect(b.p10).toBeLessThanOrEqual(b.p50);
    expect(b.p50).toBeLessThanOrEqual(b.p90);
    expect(b.n).toBe(10);
    expect(b.insufficient).toBe(false);
  });

  it("marks a thin formation rather than dropping it", () => {
    const runs = mk("Thin", [5, 6, 7]);
    const [b] = ropBands(runs);
    expect(b.insufficient).toBe(true);
    expect(b.n).toBe(3);
    expect(b.n).toBeLessThan(MIN_BAND_RUNS);
  });

  it("folds formation spellings together", () => {
    const runs = [...mk("Asmari", [5, 6, 7, 8]), ...mk("ASMARI", [9, 10, 11, 12])];
    const bands = ropBands(runs);
    expect(bands).toHaveLength(1);
    expect(bands[0].n).toBe(8);
    expect(bands[0].formation).toBe("Asmari");
  });

  it("skips runs without a usable ROP", () => {
    const runs = [
      ...mk("A", [5, 6, 7]),
      { formation: "A", ropMHr: null },
      { formation: "A", ropMHr: 0 },
      { formation: "A", ropMHr: -3 },
    ];
    expect(ropBands(runs)[0].n).toBe(3);
  });

  it("orders by sample size, busiest first", () => {
    const runs = [...mk("Few", [1, 2]), ...mk("Many", [1, 2, 3, 4, 5, 6, 7, 8, 9])];
    expect(ropBands(runs).map((b) => b.formation)).toEqual(["Many", "Few"]);
  });

  it("keeps the no-formation bucket separate and last, however large", () => {
    // On the real archive this bucket is the biggest single group. Reporting it
    // as a formation named "—" at the top of the list would present "we don't
    // know" as the headline. It stays, with a null name, at the bottom.
    const runs = [
      ...Array.from({ length: 40 }, (_, i) => ({ formation: null, ropMHr: 1 + i * 0.1 })),
      ...mk("Asmari", [5, 6, 7, 8, 9]),
      ...[{ formation: "   ", ropMHr: 4 }],
    ];
    const bands = ropBands(runs);
    expect(bands.map((b) => b.formation)).toEqual(["Asmari", null]);
    expect(bands[1].n).toBe(41);          // the blank-string row folds in with null
    expect(bands[0].n).toBe(5);
  });
});
