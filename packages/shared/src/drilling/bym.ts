/**
 * The Bourgoyne & Young drilling-rate model, constrained to what daily reports
 * actually carry.
 *
 * B&Y is the standard multi-variable ROP model: eight multiplicative functions
 * whose exponents are fitted per formation from ordinary bit-run data. Fitted
 * coefficients are the only thing in this whole tab that can answer "what would
 * happen if I turned RPM up and weight down" rather than "what happened when
 * someone else did". That is also exactly why it is labelled EXPERIMENTAL
 * everywhere it surfaces: a regression on run averages extrapolates confidently
 * and wrongly the moment the data has no spread to learn from.
 *
 * WHAT IS PRUNED, AND WHY
 * -----------------------
 * The full model is ROP = f1·f2·f3·f4·f5·f6·f7·f8. Two are always dropped:
 *   · f3, undercompaction — needs the pore-pressure gradient at depth;
 *   · f4, overbalance — needs pore pressure AND equivalent circulating density.
 * Neither is in the archive. Fitting them against a constant would not estimate
 * them, it would launder a1 through two extra parameters and report the same
 * curve with more decimal places. They are pruned rather than defaulted, and
 * the a1 bound is widened to absorb what they used to carry, because a1 is now
 * "formation strength AND whatever the pressure regime did".
 *
 * A third, f8 (jet impact), is pruned PER SELECTION by the same reasoning — see
 * the jet-coverage rule in `bymFit`. Requiring it everywhere would have cost 57%
 * of the archive's runs and cut the number of fittable formations from 36 to 19.
 *
 * So what remains is
 *
 *     ROP = exp(a1)                                  · f1  formation strength
 *         · exp(a2 · (10,000 − D))                   · f2  compaction with depth
 *         · ((W/db − (W/db)t) / (4 − (W/db)t))^a5    · f5  weight on bit
 *         · (N / 60)^a6                              · f6  rotary speed
 *         · exp(−a7 · h)                             · f7  tooth wear
 *         · (Fj / 1000)^a8                           · f8  jet impact (hydraulics)
 *
 * in API field units throughout: D in ft, W in 1,000 lbf, db in inches, N in
 * rpm, Fj in lbf, ROP out in ft/hr. Callers convert at the boundary.
 *
 * Sources: Bourgoyne & Young (1974); Bourgoyne, Millheim, Chenevert & Young,
 * "Applied Drilling Engineering" (SPE Textbook vol. 2) for the coefficient
 * bounds and the f-function forms.
 */
import { quantile } from "./stats.js";

/** One run, reduced to the model's variables. All API field units. */
export interface BymRun {
  /** True vertical-ish depth at the middle of the run [ft]. */
  depthFt: number;
  /** Weight on bit per inch of bit diameter [1,000 lbf / in]. */
  wPerDb: number;
  /** Rotary speed [rpm]. */
  rpm: number;
  /** Fractional tooth wear over the run, 0 (new) to 1 (gone). */
  wear: number;
  /**
   * Jet impact force [lbf], or null when the run has no nozzle/flow/mud-weight
   * record. Null is not a dropped run: see `bymFit`'s jet-coverage rule.
   */
  jetLbf: number | null;
  /** Observed rate of penetration [ft/hr]. */
  ropFtHr: number;
}

export interface BymCoeffs {
  a1: number; a2: number; a5: number; a6: number; a7: number; a8: number;
  /** Threshold weight (W/db at which the bit stops cutting) — held, not fitted. */
  thresholdWPerDb: number;
}

/**
 * Published coefficient bounds (Applied Drilling Engineering).
 *
 * a2/a5/a6/a7/a8 are the textbook ranges. a1 is widened from the textbook's
 * 0.5–1.9: with f3 and f4 pruned, a1 has to carry the pressure-regime effect
 * those two used to hold, and pinning it to the narrow range would push that
 * mismatch into a5 and a6 — the two coefficients the response surface is built
 * from, and therefore the two that must not absorb someone else's error.
 */
export const BYM_BOUNDS: Record<"a1" | "a2" | "a5" | "a6" | "a7" | "a8", [number, number]> = {
  a1: [-2.0, 7.0],
  a2: [0.000001, 0.0005],
  a5: [0.5, 2.0],
  a6: [0.4, 1.0],
  a7: [0.3, 1.5],
  a8: [0.3, 1.0],
};

/** A fit needs at least this many runs in the formation. */
export const BYM_MIN_RUNS = 15;

/**
 * …and this much spread in BOTH weight and speed (P90/P10).
 *
 * Without it the fit is not underdetermined in a way any residual would reveal:
 * every run at the same WOB makes a5 unidentifiable, and the search will still
 * return a number — whichever bound it drifted to — with a perfectly respectable
 * error. The guard is the difference between "this model has no opinion" and a
 * confident recommendation to change a parameter nobody ever varied.
 */
export const BYM_MIN_SPREAD = 1.3;

/** ROP [ft/hr] predicted by the pruned model, or null if a factor is undefined. */
export function bymPredict(c: BymCoeffs, r: {
  depthFt: number; wPerDb: number; rpm: number; wear: number; jetLbf: number | null;
}): number | null {
  const t = c.thresholdWPerDb;
  const wNum = r.wPerDb - t;
  const wDen = 4 - t;
  // Below threshold weight the bit is riding, not cutting; the published form
  // has no branch for it and a fractional power of a negative number is NaN.
  if (!(wDen > 0) || wNum <= 0) return null;
  if (!(r.rpm > 0)) return null;
  if (r.wear < 0 || r.wear > 1) return null;

  // a8 = 0 IS the model without f8 — anything to the power zero is one — so a
  // run with no hydraulics record is predictable exactly when the jet term has
  // been dropped, and not otherwise. No special case, just the algebra.
  let f8: number;
  if (c.a8 === 0) f8 = 1;
  else if (r.jetLbf != null && r.jetLbf > 0) f8 = Math.pow(r.jetLbf / 1_000, c.a8);
  else return null;

  const f1 = Math.exp(c.a1);
  const f2 = Math.exp(c.a2 * (10_000 - r.depthFt));
  const f5 = Math.pow(wNum / wDen, c.a5);
  const f6 = Math.pow(r.rpm / 60, c.a6);
  const f7 = Math.exp(-c.a7 * r.wear);
  const rop = f1 * f2 * f5 * f6 * f7 * f8;
  return Number.isFinite(rop) ? rop : null;
}

export interface BymFit {
  coeffs: BymCoeffs;
  /** Mean absolute relative error over the fitted runs, 0–∞. The fit objective. */
  mare: number;
  /** Median absolute relative error — the honest headline when residuals are skewed. */
  medianAre: number;
  n: number;
  /** Observed P90/P10 spread that cleared (or failed) the identifiability guard. */
  spread: { wob: number | null; rpm: number | null };
  /** Prediction against observation, for the scatter. */
  points: { actual: number; predicted: number }[];
  /** Coefficients sitting on a bound — the fit wanted to go further than physics allows. */
  atBounds: string[];
  /** How much weight the fitted coefficients can carry. See `bymReliability`. */
  reliability: "usable" | "weak" | "unreliable";
  /** Whether f8 (jet impact) was fitted, or held at zero for want of hydraulics. */
  usedJet: boolean;
  /** Fraction of otherwise-usable runs that carried a nozzle/flow/mud-weight record. */
  jetCoverage: number;
}

/**
 * How much weight a fit can carry, from the two things that actually invalidate
 * one.
 *
 * A coefficient resting on a published bound is not an estimate, it is a wall:
 * the data wanted to go somewhere the physics envelope forbids, and the reported
 * number is where it was stopped. On the Dehloran/Paydar/Tabnak archive that is
 * the NORMAL outcome, not the exception — of the thirty-six formations that
 * clear the guards, a5 pins at its 0.5 floor in seventeen, and the verdicts come
 * out one usable, fifteen weak, twenty unreliable at 9-98% median error. Read
 * plainly, the archive is saying that run-average ROP barely responds to weight
 * on bit within a formation once bit, well and crew are mixed together. That is
 * a real finding about this kind of data, not a bug to tune away — but the
 * response surface is built from a5 and a6, so a clamped fit must never present
 * a confident recommendation.
 *
 * The error thresholds are deliberately generous: a 30% median error is a poor
 * predictor but still a usable ranking of one operating point against another,
 * which is all the surface claims.
 */
export function bymReliability(atBounds: number, medianAre: number): BymFit["reliability"] {
  if (atBounds >= 3 || medianAre > 0.5) return "unreliable";
  if (atBounds >= 1 || medianAre > 0.3) return "weak";
  return "usable";
}

export type BymRefusal =
  | { ok: false; reason: "too-few-runs"; n: number }
  | { ok: false; reason: "no-wob-spread"; spread: number | null }
  | { ok: false; reason: "no-rpm-spread"; spread: number | null };

/**
 * Fit the pruned model by bounded multi-start pattern search on MARE.
 *
 * MARE, NOT R². R² on ROP is dominated by the fast runs — a model can score 0.9
 * while being 3x wrong on every slow interval, and slow intervals are where the
 * money is. Mean absolute RELATIVE error weights a 2 ft/hr miss on a 4 ft/hr run
 * the same as a 30 ft/hr miss on a 60 ft/hr run, which is how a driller reads it.
 *
 * Pattern search (Hooke-Jeeves) rather than a gradient method: the objective has
 * flat regions wherever a coefficient is unidentifiable, and it costs nothing at
 * this problem size. Starts are deterministic — a fixed lattice plus a seeded
 * LCG — so the same selection always yields the same coefficients. A model that
 * changed its recommendation on reload would be worse than no model.
 */
export function bymFit(
  runs: BymRun[],
  opts: {
    minRuns?: number; minSpread?: number; thresholdWPerDb?: number;
    starts?: number; maxEvals?: number; maxPredicts?: number;
    /** Fraction of runs that must carry hydraulics before f8 is fitted at all. */
    minJetCoverage?: number;
  } = {},
): BymFit | BymRefusal {
  const minRuns = opts.minRuns ?? BYM_MIN_RUNS;
  const minSpread = opts.minSpread ?? BYM_MIN_SPREAD;
  const threshold = opts.thresholdWPerDb ?? 0;

  const core = runs.filter(
    (r) =>
      Number.isFinite(r.depthFt) && Number.isFinite(r.wPerDb) && Number.isFinite(r.rpm) &&
      Number.isFinite(r.wear) && Number.isFinite(r.ropFtHr) &&
      r.ropFtHr > 0 && r.rpm > 0 && r.wPerDb > threshold &&
      r.wear >= 0 && r.wear <= 1,
  );
  const withJet = core.filter((r) => r.jetLbf != null && r.jetLbf > 0);

  // WHETHER TO FIT f8 AT ALL — the same judgement that pruned f3 and f4, applied
  // per selection instead of once. Only 52% of the archive records nozzles, so
  // demanding jet impact costs 57% of the runs and halves the number of
  // formations that can be fitted at all (36 down to 19 on the five-field
  // selection). A jet term fitted on the minority of runs that happen to carry
  // nozzle records is not more information, it is the same model fitted to a
  // biased subset. So f8 is kept only when most runs support it; otherwise a8 is
  // held at zero — which IS the model without f8 — and its effect is absorbed
  // into a1, exactly as f3 and f4 are.
  const jetCoverage = core.length > 0 ? withJet.length / core.length : 0;
  const useJet = withJet.length >= minRuns && jetCoverage >= (opts.minJetCoverage ?? 0.6);
  const usable = useJet ? withJet : core;
  if (usable.length < minRuns) return { ok: false, reason: "too-few-runs", n: usable.length };

  const spreadOf = (xs: number[]): number | null => {
    const p10 = quantile(xs, 0.1);
    const p90 = quantile(xs, 0.9);
    if (p10 == null || p90 == null || !(p10 > 0)) return null;
    return p90 / p10;
  };
  const wobSpread = spreadOf(usable.map((r) => r.wPerDb));
  const rpmSpread = spreadOf(usable.map((r) => r.rpm));
  if (wobSpread == null || wobSpread < minSpread) return { ok: false, reason: "no-wob-spread", spread: wobSpread };
  if (rpmSpread == null || rpmSpread < minSpread) return { ok: false, reason: "no-rpm-spread", spread: rpmSpread };

  const keys = (useJet
    ? ["a1", "a2", "a5", "a6", "a7", "a8"]
    : ["a1", "a2", "a5", "a6", "a7"]) as ("a1" | "a2" | "a5" | "a6" | "a7" | "a8")[];
  const lo = keys.map((k) => BYM_BOUNDS[k][0]);
  const hi = keys.map((k) => BYM_BOUNDS[k][1]);
  const clamp = (v: number[]) => v.map((x, i) => Math.min(hi[i], Math.max(lo[i], x)));
  const toCoeffs = (v: number[]): BymCoeffs => ({
    a1: v[0], a2: v[1], a5: v[2], a6: v[3], a7: v[4],
    a8: useJet ? v[5] : 0,
    thresholdWPerDb: threshold,
  });

  // The model is log-linear in its coefficients:
  //
  //   ln ROP = a1 + a2·(10,000−D) + a5·ln((W/db−t)/(4−t)) + a6·ln(N/60)
  //            − a7·h + a8·ln(Fj/1000)
  //
  // so everything that does not depend on a coefficient is a per-run constant.
  // Precomputing them turns each objective evaluation from four exp/pow calls
  // per run into one exp and five multiplies — the difference between a fit that
  // takes seconds and one that takes tens of milliseconds. `bymPredict` stays
  // the single public definition; a test asserts the two agree by recomputing
  // the reported MARE from the reported points.
  const wDen = 4 - threshold;
  if (!(wDen > 0)) return { ok: false, reason: "too-few-runs", n: 0 };
  const pre = usable.map((r) => ({
    kDepth: 10_000 - r.depthFt,
    kWob: Math.log((r.wPerDb - threshold) / wDen),
    kRpm: Math.log(r.rpm / 60),
    kWear: r.wear,
    kJet: useJet && r.jetLbf != null ? Math.log(r.jetLbf / 1_000) : 0,
    rop: r.ropFtHr,
  }));

  // A HARD evaluation budget, shared across every start. The objective has long
  // flat valleys wherever a coefficient is weakly identified, and an unbounded
  // pattern search walks them in ever-smaller steps: on the real archive one
  // 134-run formation took 24.5 SECONDS, which in a browser is a frozen tab.
  // The budget is expressed in per-run predictions rather than iterations so it
  // holds whatever the formation's size, and a search that runs out returns the
  // best point it reached — on the measured data, cutting the budget tenfold
  // moved MARE by 0.1%, so the tail of the search is buying nothing.
  const maxEvals = opts.maxEvals ?? Math.max(200, Math.ceil((opts.maxPredicts ?? 150_000) / pre.length));
  let evals = 0;
  const cost = (v: number[]): number => {
    evals += 1;
    const [a1, a2, a5, a6, a7] = v;
    const a8 = useJet ? v[5] : 0;
    let sum = 0;
    for (const r of pre) {
      const p = Math.exp(a1 + a2 * r.kDepth + a5 * r.kWob + a6 * r.kRpm - a7 * r.kWear + a8 * r.kJet);
      // A candidate that overflows to Infinity is a failure of the candidate,
      // not a free pass: scoring it 1 (100% relative error) keeps the search out
      // of corners where the model stops covering the data.
      sum += Number.isFinite(p) ? Math.abs(p - r.rop) / r.rop : 1;
    }
    return sum / pre.length;
  };

  // Deterministic starts: the bound midpoints, the two corners, plus a seeded
  // low-discrepancy sprinkle. No Math.random — a model whose recommendation
  // changed on reload would be worse than no model.
  const starts: number[][] = [
    lo.map((l, i) => (l + hi[i]) / 2),
    lo.slice(),
    hi.slice(),
    lo.map((l, i) => l + 0.25 * (hi[i] - l)),
    lo.map((l, i) => l + 0.75 * (hi[i] - l)),
  ];
  let seed = 20260812;
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let s = starts.length; s < (opts.starts ?? 12); s += 1) {
    starts.push(lo.map((l, i) => l + rand() * (hi[i] - l)));
  }

  let best: number[] | null = null;
  let bestCost = Infinity;
  for (const start of starts) {
    if (evals >= maxEvals) break;
    let x = clamp(start);
    let fx = cost(x);
    // Step per coordinate, scaled to that coefficient's own range: a2 lives in
    // 1e-6..5e-4 and a1 in -2..7, so one shared step size would search one of
    // them and ignore the other.
    let scale = 0.25;
    while (scale > 1e-4 && evals < maxEvals) {
      let improved = false;
      for (let i = 0; i < x.length; i += 1) {
        const step = scale * (hi[i] - lo[i]);
        for (const dir of [1, -1]) {
          const trial = clamp(x.map((v, j) => (j === i ? v + dir * step : v)));
          const ft = cost(trial);
          if (ft < fx - 1e-9) { x = trial; fx = ft; improved = true; }
        }
      }
      if (!improved) scale /= 2;
    }
    if (fx < bestCost) { bestCost = fx; best = x; }
  }
  if (best == null) return { ok: false, reason: "too-few-runs", n: usable.length };

  const coeffs = toCoeffs(best);
  const points: { actual: number; predicted: number }[] = [];
  const ares: number[] = [];
  for (const r of usable) {
    const p = bymPredict(coeffs, r);
    if (p == null) continue;
    points.push({ actual: r.ropFtHr, predicted: p });
    ares.push(Math.abs(p - r.ropFtHr) / r.ropFtHr);
  }
  const atBounds = keys.filter((_k, i) =>
    Math.abs(best![i] - lo[i]) < 1e-9 * Math.max(1, Math.abs(lo[i])) ||
    Math.abs(best![i] - hi[i]) < 1e-9 * Math.max(1, Math.abs(hi[i])));

  const medianAre = quantile(ares, 0.5) ?? bestCost;
  return {
    coeffs,
    mare: bestCost,
    medianAre,
    n: usable.length,
    spread: { wob: wobSpread, rpm: rpmSpread },
    points,
    atBounds: [...atBounds],
    reliability: bymReliability(atBounds.length, medianAre),
    usedJet: useJet,
    jetCoverage,
  };
}

export interface SurfaceCell {
  wPerDb: number;
  rpm: number;
  ropFtHr: number | null;
  /** Cost per foot at this operating point, when the caller supplies economics. */
  costPerFt: number | null;
}

/**
 * The WOB x RPM response surface at fixed depth, wear and hydraulics.
 *
 * This is the model's only real product: ROP over a parameter grid the crew can
 * actually dial. Cost is evaluated per cell when the caller supplies rig rate
 * and bit economics, because the fastest cell and the cheapest cell are not the
 * same cell — the fastest usually wears the bit faster, and the model has no
 * opinion about that at all, which is why the caller passes the cost function.
 */
export function bymSurface(
  coeffs: BymCoeffs,
  at: { depthFt: number; wear: number; jetLbf: number | null },
  grid: { wob: number[]; rpm: number[] },
  costOf?: (ropFtHr: number, wPerDb: number, rpm: number) => number | null,
): SurfaceCell[] {
  const out: SurfaceCell[] = [];
  for (const wPerDb of grid.wob) {
    for (const rpm of grid.rpm) {
      const ropFtHr = bymPredict(coeffs, { ...at, wPerDb, rpm });
      out.push({
        wPerDb, rpm, ropFtHr,
        costPerFt: ropFtHr != null && costOf ? costOf(ropFtHr, wPerDb, rpm) : null,
      });
    }
  }
  return out;
}

/** Evenly spaced grid values spanning the observed range, inclusive. */
export function gridOver(xs: number[], steps: number): number[] {
  const usable = xs.filter((x) => Number.isFinite(x));
  if (usable.length === 0 || steps < 1) return [];
  const lo = Math.min(...usable);
  const hi = Math.max(...usable);
  if (!(hi > lo)) return [lo];
  return Array.from({ length: steps }, (_, i) => lo + ((hi - lo) * i) / (steps - 1));
}
