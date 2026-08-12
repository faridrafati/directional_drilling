import { describe, it, expect } from "vitest";
import { buildRoadmap, wearCautionCutoff, MIN_RUNS, type RoadmapRun } from "./roadmap.js";

/** A run that drilled cleanly, with everything overridable. */
const run = (o: Partial<RoadmapRun> = {}): RoadmapRun => ({
  formation: "Asmari",
  bitSize: '12 1/4"',
  wobKlb: 20,
  rpm: 120,
  flowGpm: 700,
  ropMHr: 10,
  costPerM: 100,
  tripRopMHr: 9,
  mse: 30_000,
  dullInner: 1,
  dullOuter: 1,
  meters: 300,
  reasonCode: "TD",
  depthMid: 2_000,
  ...o,
});

describe("buildRoadmap — sample size", () => {
  it("reports a group below the minimum instead of dropping it", () => {
    const rows = buildRoadmap(Array.from({ length: MIN_RUNS - 1 }, () => run()));
    expect(rows).toHaveLength(1);
    expect(rows[0].insufficient).toBe(true);
    expect(rows[0].wob).toBeNull();
    expect(rows[0].n).toBe(MIN_RUNS - 1);
  });

  it("produces bands once the minimum is met", () => {
    const rows = buildRoadmap(Array.from({ length: 9 }, (_, i) => run({ wobKlb: 10 + i })));
    expect(rows[0].insufficient).toBe(false);
    expect(rows[0].wob).not.toBeNull();
    expect(rows[0].wob!.p25).toBeLessThanOrEqual(rows[0].wob!.p75);
  });
});

describe("buildRoadmap — the best tercile is what gets recommended", () => {
  it("bands come from the cheapest runs, not from all of them", () => {
    // Nine runs: the three cheapest all drilled at 30 klb, the rest at 10.
    const runs = [
      ...Array.from({ length: 3 }, () => run({ costPerM: 50, wobKlb: 30 })),
      ...Array.from({ length: 6 }, () => run({ costPerM: 500, wobKlb: 10 })),
    ];
    const rows = buildRoadmap(runs);
    expect(rows[0].basis).toBe("cost/m");
    expect(rows[0].wob!.median).toBe(30);
    expect(rows[0].bestN).toBe(3);
  });

  it("falls back to trip-adjusted ROP, then to raw ROP", () => {
    const noCost = Array.from({ length: 6 }, (_, i) =>
      run({ costPerM: null, tripRopMHr: i, wobKlb: i }));
    expect(buildRoadmap(noCost)[0].basis).toBe("trip-adjusted ROP");

    const nothing = Array.from({ length: 6 }, (_, i) =>
      run({ costPerM: null, tripRopMHr: null, ropMHr: i + 1 }));
    expect(buildRoadmap(nothing)[0].basis).toBe("ROP");
  });
});

describe("buildRoadmap — runs that ended badly are not recommended", () => {
  it("excludes severe dull even when those runs were the cheapest", () => {
    // The cheapest three destroyed their bits at 40 klb; the roadmap must not
    // hold them up as the example to follow.
    const runs = [
      ...Array.from({ length: 3 }, () => run({ costPerM: 10, wobKlb: 40, dullOuter: 6 })),
      ...Array.from({ length: 6 }, () => run({ costPerM: 200, wobKlb: 15 })),
    ];
    const rows = buildRoadmap(runs);
    expect(rows[0].wob!.median).toBe(15);
    expect(rows[0].screenFellBack).toBe(false);
  });

  it("excludes failure reason-pulled codes", () => {
    const runs = [
      ...Array.from({ length: 3 }, () => run({ costPerM: 10, wobKlb: 40, reasonCode: "DTF" })),
      ...Array.from({ length: 6 }, () => run({ costPerM: 200, wobKlb: 15 })),
    ];
    expect(buildRoadmap(runs)[0].wob!.median).toBe(15);
  });

  it("falls back to the full set — visibly — when every run was screened out", () => {
    const runs = Array.from({ length: 6 }, () => run({ dullInner: 5, wobKlb: 25 }));
    const rows = buildRoadmap(runs);
    expect(rows[0].screenFellBack).toBe(true);
    expect(rows[0].wob!.median).toBe(25);
  });
});

describe("buildRoadmap — missing parameters", () => {
  it("returns a null band for a parameter no run carried", () => {
    const rows = buildRoadmap(Array.from({ length: 6 }, () => run({ flowGpm: null })));
    expect(rows[0].flow).toBeNull();
    expect(rows[0].wob).not.toBeNull();   // the others still band
  });

  it("counts only the runs that carried the parameter", () => {
    const runs = [
      ...Array.from({ length: 3 }, () => run({ costPerM: 10, flowGpm: 800 })),
      ...Array.from({ length: 6 }, () => run({ costPerM: 900, flowGpm: null })),
    ];
    const rows = buildRoadmap(runs);
    expect(rows[0].flow!.n).toBe(3);
    expect(rows[0].flow!.median).toBe(800);
  });
});

describe("buildRoadmap — zone flags", () => {
  it("is benign with steady MSE and no failures", () => {
    const rows = buildRoadmap(Array.from({ length: 8 }, () => run({ mse: 30_000 })));
    expect(rows[0].zone).toBe("benign");
    expect(rows[0].zoneReasons).toHaveLength(0);
  });

  it("cautions on MSE variation above the floor AND the selection's worst quartile", () => {
    const runs = Array.from({ length: 8 }, (_, i) =>
      run({ mse: i % 2 === 0 ? 5_000 : 60_000 }));      // CV well above 0.5
    const rows = buildRoadmap(runs, { mseCvThreshold: 0.5 });
    expect(rows[0].zone).toBe("caution");
    expect(rows[0].zoneReasons.join(" ")).toMatch(/MSE varies/);
  });

  it("does NOT caution on variation that is merely above the absolute floor", () => {
    // The whole reason the rule is relative: on the real archive the median
    // formation sits at CV 0.91, so a bare "> 0.5" flags three quarters of them
    // and the chip stops meaning anything.
    const runs = Array.from({ length: 8 }, (_, i) =>
      run({ mse: i % 2 === 0 ? 20_000 : 40_000 }));      // CV ~0.35
    const rows = buildRoadmap(runs, { mseCvThreshold: 2.0 });
    expect(rows[0].zoneReasons.join(" ")).not.toMatch(/MSE varies/);
  });

  it("keeps the floor: a steady group is never flagged, however low the quartile", () => {
    const runs = Array.from({ length: 8 }, () => run({ mse: 30_000 }));
    const rows = buildRoadmap(runs, { mseCvThreshold: 0.01 });
    expect(rows[0].zoneReasons.join(" ")).not.toMatch(/MSE varies/);
  });

  it("cautions when a quarter of the runs were pulled for failure", () => {
    const runs = [
      ...Array.from({ length: 2 }, () => run({ reasonCode: "BT" })),
      ...Array.from({ length: 6 }, () => run()),
    ];
    const rows = buildRoadmap(runs);
    expect(rows[0].zone).toBe("caution");
    expect(rows[0].zoneReasons.join(" ")).toMatch(/pulled for failure/);
  });

  it("cautions on a wear rate in the worst quartile", () => {
    const runs = Array.from({ length: 8 }, () => run({ dullInner: 3, dullOuter: 3, meters: 100 }));
    // wearPer100m = 100 * 3 / 100 = 3
    const rows = buildRoadmap(runs, { wearCautionThreshold: 2 });
    expect(rows[0].zone).toBe("caution");
    expect(rows[0].zoneReasons.join(" ")).toMatch(/worst quartile/);
  });

  it("ignores a zero wear cutoff — no signal is not the same as bad", () => {
    // The archive's dull grades are mostly 0/0, so the 75th percentile of the
    // per-group medians is exactly 0. With `>= 0` every formation in the field
    // came back "caution"; the flag has to stay silent when there is nothing to
    // say.
    const runs = Array.from({ length: 8 }, () => run({ dullInner: 0, dullOuter: 0 }));
    const rows = buildRoadmap(runs, { wearCautionThreshold: 0 });
    expect(rows[0].zone).toBe("benign");
  });

  it("does not fire for a group sitting exactly ON the cutoff", () => {
    const runs = Array.from({ length: 8 }, () => run({ dullInner: 2, dullOuter: 2, meters: 100 }));
    // wearPer100m = 2 exactly
    const rows = buildRoadmap(runs, { wearCautionThreshold: 2 });
    expect(rows[0].zoneReasons.join(" ")).not.toMatch(/wear rate/);
  });
});

describe("buildRoadmap — grouping and ordering", () => {
  it("folds formation spellings together, as the other rollups do", () => {
    const runs = [
      ...Array.from({ length: 3 }, () => run({ formation: "Asmari" })),
      ...Array.from({ length: 3 }, () => run({ formation: "ASMARI" })),
    ];
    const rows = buildRoadmap(runs);
    expect(rows).toHaveLength(1);
    expect(rows[0].n).toBe(6);
    expect(rows[0].formation).toBe("Asmari");   // the first spelling seen
  });

  it("orders rows by depth, because a roadmap is read as the hole is drilled", () => {
    const runs = [
      ...Array.from({ length: 5 }, () => run({ formation: "Deep", depthMid: 3_000 })),
      ...Array.from({ length: 5 }, () => run({ formation: "Shallow", depthMid: 500 })),
    ];
    expect(buildRoadmap(runs).map((r) => r.formation)).toEqual(["Shallow", "Deep"]);
  });
});

describe("wearCautionCutoff", () => {
  it("is the 75th percentile of the per-group median wear rates", () => {
    const mk = (formation: string, wear: number) =>
      run({ formation, dullInner: wear, dullOuter: wear, meters: 100 });
    // Four groups with per-100m rates of 1, 2, 3 and 4.
    const runs = [mk("A", 1), mk("B", 2), mk("C", 3), mk("D", 4)];
    const cutoff = wearCautionCutoff(runs);
    expect(cutoff).not.toBeNull();
    expect(cutoff!).toBeGreaterThan(2);
    expect(cutoff!).toBeLessThanOrEqual(4);
  });

  it("returns null when there are too few groups for a quartile to mean anything", () => {
    expect(wearCautionCutoff([run({ formation: "A" }), run({ formation: "B" })])).toBeNull();
  });
});
