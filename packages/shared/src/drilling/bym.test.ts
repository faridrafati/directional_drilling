import { describe, it, expect } from "vitest";
import {
  bymPredict, bymFit, bymSurface, gridOver,
  BYM_BOUNDS, BYM_MIN_RUNS, BYM_MIN_SPREAD, bymReliability,
  type BymCoeffs, type BymRun, type BymFit,
} from "./bym.js";

const TRUTH: BymCoeffs = {
  a1: 2.0, a2: 0.00012, a5: 1.2, a6: 0.7, a7: 0.6, a8: 0.5, thresholdWPerDb: 0,
};

/** Synthetic runs generated FROM the model, so the fit has a known answer. */
function synth(n = 40, coeffs = TRUTH): BymRun[] {
  const runs: BymRun[] = [];
  // A deterministic sweep with real spread in both weight and speed.
  for (let i = 0; i < n; i += 1) {
    const wPerDb = 1.0 + 3.0 * ((i * 7) % n) / n;      // 1.0 .. 4.0 klb/in
    const rpm = 60 + 120 * ((i * 13) % n) / n;          // 60 .. 180 rpm
    const depthFt = 3_000 + 9_000 * ((i * 5) % n) / n;
    const wear = 0.4 * ((i * 3) % n) / n;
    const jetLbf = 600 + 1_400 * ((i * 11) % n) / n;
    const ropFtHr = bymPredict(coeffs, { depthFt, wPerDb, rpm, wear, jetLbf })!;
    runs.push({ depthFt, wPerDb, rpm, wear, jetLbf, ropFtHr });
  }
  return runs;
}

const isFit = (r: BymFit | { ok: false }): r is BymFit => !("ok" in r);

describe("bymPredict", () => {
  it("moves the right way in every variable", () => {
    const base = { depthFt: 8_000, wPerDb: 2.5, rpm: 120, wear: 0.2, jetLbf: 1_200 };
    const at = (o: Partial<typeof base>) => bymPredict(TRUTH, { ...base, ...o })!;
    expect(at({ wPerDb: 3.5 })).toBeGreaterThan(at({}));       // more weight, faster
    expect(at({ rpm: 160 })).toBeGreaterThan(at({}));          // more speed, faster
    expect(at({ wear: 0.8 })).toBeLessThan(at({}));            // duller, slower
    expect(at({ jetLbf: 1_800 })).toBeGreaterThan(at({}));     // better cleaning, faster
    expect(at({ depthFt: 12_000 })).toBeLessThan(at({}));      // deeper, slower
  });

  it("refuses below threshold weight instead of returning NaN", () => {
    // A fractional power of a negative number is NaN; the published form simply
    // has no branch for a bit that is riding rather than cutting.
    const c = { ...TRUTH, thresholdWPerDb: 1.0 };
    expect(bymPredict(c, { depthFt: 8_000, wPerDb: 0.5, rpm: 120, wear: 0.2, jetLbf: 1_200 })).toBeNull();
    expect(bymPredict(c, { depthFt: 8_000, wPerDb: 1.0, rpm: 120, wear: 0.2, jetLbf: 1_200 })).toBeNull();
    expect(bymPredict(c, { depthFt: 8_000, wPerDb: 1.5, rpm: 120, wear: 0.2, jetLbf: 1_200 })).not.toBeNull();
  });

  it("returns null rather than a number outside its own domain", () => {
    const base = { depthFt: 8_000, wPerDb: 2.5, rpm: 120, wear: 0.2, jetLbf: 1_200 };
    expect(bymPredict(TRUTH, { ...base, rpm: 0 })).toBeNull();
    expect(bymPredict(TRUTH, { ...base, jetLbf: 0 })).toBeNull();
    expect(bymPredict(TRUTH, { ...base, wear: 1.4 })).toBeNull();
    expect(bymPredict(TRUTH, { ...base, wear: -0.1 })).toBeNull();
  });

  it("puts every published bound inside its own domain", () => {
    // Guards against a bound typo that would let the search reach coefficients
    // the predictor cannot evaluate.
    for (const [k, [lo, hi]] of Object.entries(BYM_BOUNDS)) {
      expect(lo).toBeLessThan(hi);
      for (const v of [lo, hi]) {
        const c = { ...TRUTH, [k]: v } as BymCoeffs;
        const p = bymPredict(c, { depthFt: 8_000, wPerDb: 2.5, rpm: 120, wear: 0.2, jetLbf: 1_200 });
        expect(p).not.toBeNull();
        expect(Number.isFinite(p!)).toBe(true);
      }
    }
  });
});

describe("bymFit", () => {
  it("recovers coefficients it generated the data from, given room to search", () => {
    const fit = bymFit(synth(40), { maxPredicts: 5_000_000 });
    expect(isFit(fit)).toBe(true);
    if (!isFit(fit)) return;
    expect(fit.mare).toBeLessThan(0.01);
    expect(fit.coeffs.a5).toBeCloseTo(TRUTH.a5, 1);
    expect(fit.coeffs.a6).toBeCloseTo(TRUTH.a6, 1);
    expect(fit.n).toBe(40);
  });

  it("pays for the default budget in coefficient precision, not in fit quality", () => {
    // The trade-off, stated rather than hidden. The default budget exists so a
    // 134-run formation cannot freeze the browser; what it costs is the last
    // fraction of coefficient precision, while the error it achieves stays
    // within a whisker of an unbounded search. That matters because the
    // response surface reads a5 and a6 directly — so the surface is a ranking
    // of operating points, never a claim about the exponents themselves.
    const runs = synth(40);
    const ample = bymFit(runs, { maxPredicts: 5_000_000 });
    const cheap = bymFit(runs);
    if (!isFit(ample) || !isFit(cheap)) throw new Error("both should fit");
    expect(cheap.mare).toBeLessThan(ample.mare + 0.02);
    expect(Math.abs(cheap.coeffs.a6 - TRUTH.a6)).toBeLessThan(0.15);
  });

  it("is deterministic — the same runs always give the same coefficients", () => {
    // A model whose recommendation changed on reload would be worse than none.
    const runs = synth(40);
    const a = bymFit(runs);
    const b = bymFit(runs.slice());
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("refuses below the minimum run count", () => {
    const r = bymFit(synth(BYM_MIN_RUNS - 1));
    expect(isFit(r)).toBe(false);
    if (isFit(r)) return;
    expect(r.reason).toBe("too-few-runs");
    expect(r.n).toBe(BYM_MIN_RUNS - 1);
  });

  it("refuses when nobody varied the weight", () => {
    // The failure this guard exists for: the search still returns a number for
    // a5 — whichever bound it drifted to — with a respectable error, and the UI
    // would present it as advice about a parameter nobody ever changed.
    const runs = synth(40).map((r) => ({ ...r, wPerDb: 2.5 }));
    const res = bymFit(runs);
    expect(isFit(res)).toBe(false);
    if (isFit(res)) return;
    expect(res.reason).toBe("no-wob-spread");
    expect(res.spread).toBeCloseTo(1, 6);
  });

  it("refuses when nobody varied the speed", () => {
    const runs = synth(40).map((r) => ({ ...r, rpm: 120 }));
    const res = bymFit(runs);
    expect(isFit(res)).toBe(false);
    if (isFit(res)) return;
    expect(res.reason).toBe("no-rpm-spread");
  });

  it("accepts spread exactly at the guard and rejects just below it", () => {
    const half = (n: number, lo: number, hi: number) =>
      synth(n).map((r, i) => ({ ...r, wPerDb: i % 2 === 0 ? lo : hi }));
    // P90/P10 of a two-valued set is hi/lo.
    const ok = bymFit(half(40, 2, 2 * BYM_MIN_SPREAD));
    const no = bymFit(half(40, 2, 2 * (BYM_MIN_SPREAD - 0.05)));
    expect(isFit(ok)).toBe(true);
    expect(isFit(no)).toBe(false);
  });

  it("reports coefficients that ran into a bound", () => {
    // Data generated well outside the published envelope: the fit should hit a
    // wall and SAY so rather than quietly reporting the wall as an estimate.
    const wild = { ...TRUTH, a6: 0.4 };
    const runs = synth(40, wild).map((r) => ({ ...r, ropFtHr: r.ropFtHr * Math.pow(r.rpm / 60, -1.5) }));
    const fit = bymFit(runs);
    if (!isFit(fit)) return;
    expect(fit.atBounds).toContain("a6");
  });

  it("keeps f8 and drops the runs when most of them carry hydraulics", () => {
    const runs = synth(40);
    const holed = runs.map((r, i) => (i < 5 ? { ...r, jetLbf: null } : r));
    const fit = bymFit(holed);
    expect(isFit(fit)).toBe(true);
    if (!isFit(fit)) return;
    expect(fit.usedJet).toBe(true);
    expect(fit.n).toBe(35);
    expect(fit.jetCoverage).toBeCloseTo(35 / 40, 6);
  });

  it("drops f8 and keeps the runs when most of them do NOT", () => {
    // The trade the archive forces: only 52% of it records nozzles, so demanding
    // jet impact costs 57% of runs and halves the number of fittable formations.
    // A jet term fitted on the nozzle-recording minority is not more information,
    // it is the same model fitted to a biased subset.
    const runs = synth(40);
    const sparse = runs.map((r, i) => (i < 30 ? { ...r, jetLbf: null } : r));
    const fit = bymFit(sparse);
    expect(isFit(fit)).toBe(true);
    if (!isFit(fit)) return;
    expect(fit.usedJet).toBe(false);
    expect(fit.n).toBe(40);                  // every run kept, none dropped
    expect(fit.coeffs.a8).toBe(0);           // a8 = 0 IS the model without f8
    expect(fit.atBounds).not.toContain("a8");
    expect(fit.jetCoverage).toBeCloseTo(10 / 40, 6);
  });

  it("still predicts every run it fitted when f8 was dropped", () => {
    // The algebra that makes it work: x^0 = 1, so a run with no hydraulics is
    // predictable exactly when the jet term is off — no special case needed.
    const runs = synth(40).map((r) => ({ ...r, jetLbf: null }));
    const fit = bymFit(runs);
    expect(isFit(fit)).toBe(true);
    if (!isFit(fit)) return;
    expect(fit.points).toHaveLength(40);
    expect(fit.points.every((p) => Number.isFinite(p.predicted) && p.predicted > 0)).toBe(true);
  });

  it("refuses a hydraulics-free run while f8 is on", () => {
    expect(bymPredict(TRUTH, {
      depthFt: 8_000, wPerDb: 2.5, rpm: 120, wear: 0.2, jetLbf: null,
    })).toBeNull();
    expect(bymPredict({ ...TRUTH, a8: 0 }, {
      depthFt: 8_000, wPerDb: 2.5, rpm: 120, wear: 0.2, jetLbf: null,
    })).not.toBeNull();
  });

  it("optimises the same function it reports", () => {
    // The fit's inner loop uses a log-linear fast path (one exp per run instead
    // of four exp/pow), while the reported points come from bymPredict. If the
    // two ever drift apart, the reported MARE would describe a model nobody can
    // reproduce — so recompute it from the points and demand they agree.
    const fit = bymFit(synth(40));
    if (!isFit(fit)) return;
    const recomputed =
      fit.points.reduce((s, p) => s + Math.abs(p.predicted - p.actual) / p.actual, 0) / fit.points.length;
    expect(recomputed).toBeCloseTo(fit.mare, 10);
    for (const p of fit.points) {
      expect(p.predicted).toBeGreaterThan(0);
      expect(Number.isFinite(p.predicted)).toBe(true);
    }
  });

  it("stays inside its prediction budget on a large formation", () => {
    // The guard against the failure that made this budget necessary: an
    // unbounded search spent 24.5 SECONDS on one 134-run formation, which in a
    // browser is a frozen tab.
    const runs = synth(140);
    const t0 = performance.now();
    bymFit(runs);
    expect(performance.now() - t0).toBeLessThan(2_000);
  });

  it("reports median ARE alongside the mean it optimised", () => {
    const fit = bymFit(synth(40));
    if (!isFit(fit)) return;
    expect(fit.medianAre).toBeLessThanOrEqual(fit.mare + 1e-9);
    expect(fit.points).toHaveLength(fit.n);
  });
});

describe("bymReliability", () => {
  it("calls a clean, unclamped fit usable", () => {
    expect(bymReliability(0, 0.12)).toBe("usable");
  });

  it("demotes a fit resting on a bound, however small its error", () => {
    // A coefficient on a bound is a wall, not an estimate — the data wanted to
    // go somewhere the physics envelope forbids.
    expect(bymReliability(1, 0.05)).toBe("weak");
    expect(bymReliability(3, 0.05)).toBe("unreliable");
  });

  it("demotes on error alone", () => {
    expect(bymReliability(0, 0.35)).toBe("weak");
    expect(bymReliability(0, 0.60)).toBe("unreliable");
  });

  it("agrees with what the archive actually produces", () => {
    // Measured on the Dehloran/Paydar/Tabnak selection: of thirty-six formations
    // clearing the guards, the verdicts come out one usable, fifteen weak,
    // twenty unreliable. A clamped coefficient must never reach the surface as
    // advice, and a fit with nothing clamped and a small error must not be
    // buried in caveats either.
    expect(bymReliability(3, 0.36)).toBe("unreliable");   // Gachsaran-7
    expect(bymReliability(3, 0.24)).toBe("unreliable");   // Kangan
    expect(bymReliability(2, 0.43)).toBe("weak");         // Asmari
    expect(bymReliability(0, 0.17)).toBe("usable");       // Dashtak-"B" Evaporites
  });
});

describe("bymSurface", () => {
  it("covers the grid and marks nothing it cannot predict", () => {
    const cells = bymSurface(
      { ...TRUTH, thresholdWPerDb: 1.5 },
      { depthFt: 9_000, wear: 0.3, jetLbf: 1_100 },
      { wob: [1.0, 2.0, 3.0], rpm: [80, 140] },
    );
    expect(cells).toHaveLength(6);
    // W/db = 1.0 is below the 1.5 threshold — those cells must be null, not zero.
    expect(cells.filter((c) => c.wPerDb === 1.0).every((c) => c.ropFtHr === null)).toBe(true);
    expect(cells.filter((c) => c.wPerDb > 1.5).every((c) => (c.ropFtHr ?? 0) > 0)).toBe(true);
  });

  it("evaluates cost per cell when the caller supplies economics", () => {
    const cells = bymSurface(
      TRUTH, { depthFt: 9_000, wear: 0.3, jetLbf: 1_100 },
      { wob: [2, 3], rpm: [100, 150] },
      (rop) => 1_000 / rop,
    );
    expect(cells.every((c) => c.costPerFt != null)).toBe(true);
    // Faster is cheaper under this trivial cost model — a sanity check that the
    // ROP handed to the cost function is the cell's own.
    const sorted = [...cells].sort((a, b) => b.ropFtHr! - a.ropFtHr!);
    expect(sorted[0].costPerFt!).toBeLessThan(sorted[sorted.length - 1].costPerFt!);
  });

  it("leaves cost null when no economics are supplied", () => {
    const cells = bymSurface(TRUTH, { depthFt: 9_000, wear: 0.3, jetLbf: 1_100 }, { wob: [2], rpm: [100] });
    expect(cells[0].costPerFt).toBeNull();
  });
});

describe("gridOver", () => {
  it("spans the observed range inclusively", () => {
    const g = gridOver([10, 4, 7, 22], 4);
    expect(g[0]).toBe(4);
    expect(g[g.length - 1]).toBe(22);
    expect(g).toHaveLength(4);
  });

  it("collapses to one value when everything is the same", () => {
    expect(gridOver([5, 5, 5], 6)).toEqual([5]);
  });

  it("returns nothing usable from nothing usable", () => {
    expect(gridOver([], 5)).toEqual([]);
    expect(gridOver([NaN, Infinity], 5)).toEqual([]);
  });
});
