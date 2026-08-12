/**
 * Offset-mined drilling-parameter roadmap: recommended WOB / RPM / flow bands
 * per formation and hole size, derived from what actually drilled well.
 *
 * WHY THIS SHAPE
 * --------------
 * This is the most-adopted deliverable in commercial drilling analytics. SLB's
 * DrillOps sells precisely it — "create on-demand roadmaps for any target well
 * by intelligently mining your historical offsets… breaks the well into sections
 * and formations, revealing the precise parameters to boost ROP and drive down
 * MSE" — which is first-party confirmation that offset-history-only parameter
 * recommendation is deployed practice at exactly our data constraint. The SPE
 * 2024 Muscat paper (OPES) field-tested the same workflow in four environments
 * and contributes the load-bearing idea implemented below: SEGMENT the hole into
 * benign and dysfunction-prone zones, and only recommend aggressive parameters
 * in the benign ones.
 *
 * THE RECIPE, STATED PLAINLY
 * --------------------------
 * Within each formation × hole-size group of at least MIN_RUNS runs:
 *
 *   1. Throw out runs that ended badly — severe cutting-structure wear, or a
 *      reason-pulled code meaning failure. A run that drilled fast and destroyed
 *      the bit is evidence AGAINST its parameters, and a roadmap built without
 *      this screen recommends the settings that tore bits up.
 *   2. Rank what is left by cost per metre where the economics are computable,
 *      else by trip-adjusted ROP, else by raw ROP. Cost per metre is preferred
 *      because it is the quantity the operator actually pays.
 *   3. Take the best tercile (at least MIN_BEST runs) and report P25–P75 of
 *      their WOB, RPM and flow. A BAND, not a set point: the spread across good
 *      runs is the honest statement of what worked, and a single median would
 *      imply a precision these averages cannot support.
 *
 * WHAT THIS IS NOT
 * ----------------
 * Per-run averages support cross-run screening and trends, not intra-run
 * dysfunction diagnosis — that needs 1–3 ft depth density. And most ROP limiters
 * are not the bit: ExxonMobil catalogued 40+ limiter categories of which only 4
 * are bit-related (SPE 102210). A caution flag here says "this group shows
 * evidence of trouble", not "the bit is at fault".
 */
import { isFailureReason, isSevereDull, wearAvg, wearPer100m } from "./wear.js";
import { mean, median, quantile } from "./stats.js";

/** A group needs this many runs before a band is reported at all. */
export const MIN_RUNS = 5;
/** …and this many in the best tercile, else the tercile is not a sample. */
export const MIN_BEST = 3;

/** One bit run, reduced to what the roadmap needs. */
export interface RoadmapRun {
  formation: string | null;
  bitSize: string;
  wobKlb: number | null;
  rpm: number | null;
  flowGpm: number | null;
  ropMHr: number | null;
  /** Cost per metre, when the economics inputs were available for this run. */
  costPerM?: number | null;
  /** Trip-adjusted ROP — the fallback ranking when cost is not computable. */
  tripRopMHr?: number | null;
  mse: number | null;
  dullInner: number | null;
  dullOuter: number | null;
  meters: number | null;
  reasonCode: string | null;
  depthMid: number | null;
}

export interface Band {
  p25: number;
  p75: number;
  median: number;
  /** How many of the best-tercile runs actually carried this parameter. */
  n: number;
}

export type ZoneFlag = "benign" | "caution";

export interface RoadmapRow {
  formation: string;
  bitSizes: string[];
  /** Median depth range across the group's runs, for ordering and display. */
  depthFrom: number | null;
  depthTo: number | null;
  n: number;
  /** Null when the group has too few runs — the row is reported, not dropped. */
  wob: Band | null;
  rpm: Band | null;
  flow: Band | null;
  zone: ZoneFlag;
  /** Why the zone was flagged, for the tooltip. Empty when benign. */
  zoneReasons: string[];
  /** How the best set was chosen, for the basis column. */
  basis: "cost/m" | "trip-adjusted ROP" | "ROP";
  bestN: number;
  /** True when the dull screen removed every run and the fallback was used. */
  screenFellBack: boolean;
  /** Set when the group is below MIN_RUNS: no bands, shown greyed. */
  insufficient: boolean;
  medianWearPer100m: number | null;
  mseCv: number | null;
  failureShare: number;
}

const num = (v: number | null | undefined): v is number =>
  v != null && Number.isFinite(v);

function band(values: (number | null | undefined)[]): Band | null {
  const xs = values.filter(num);
  if (xs.length === 0) return null;
  const p25 = quantile(xs, 0.25);
  const p75 = quantile(xs, 0.75);
  const med = median(xs);
  if (p25 == null || p75 == null || med == null) return null;
  return { p25, p75, median: med, n: xs.length };
}

/** Coefficient of variation — the spread of MSE relative to its own level. */
function cv(values: number[]): number | null {
  const xs = values.filter(num);
  if (xs.length < 3) return null;
  const m = mean(xs);
  if (m == null || m <= 0) return null;
  const varr = xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(varr) / m;
}

/** A run that ended badly, and so must not be held up as an example. */
function endedBadly(r: RoadmapRun): boolean {
  return isSevereDull(r.dullInner, r.dullOuter) || isFailureReason(r.reasonCode);
}

/**
 * The absolute floor for calling MSE variation "dysfunction evidence".
 *
 * The brief specified this as the whole test — caution when the coefficient of
 * variation exceeds 0.5. Measured against the real archive it does not
 * discriminate: across four fields and 3,685 runs, 32 of 43 formation groups
 * exceed 0.5 and the MEDIAN group sits at 0.91, so every formation came out
 * "caution" and the flag said nothing.
 *
 * The reason is that 0.5 is a sensible bound on variation WITHIN a run, where
 * MSE should be roughly steady; across per-run averages it is not, because the
 * runs differ in bit, depth, parameters and crew. So the test keeps 0.5 as a
 * floor — below it there is no variability worth reporting — but also requires
 * the group to be in the worst quartile of THIS selection, which is exactly how
 * the wear criterion already works. A flag that fires on three quarters of the
 * data is an alarm nobody can act on.
 */
export const MSE_CV_FLOOR = 0.5;

/**
 * Builds the roadmap.
 *
 * Both caution thresholds are supplied by the caller rather than computed here,
 * because "worst quartile" is a statement about the WHOLE displayed set and this
 * function only ever sees one group at a time. Callers use `cautionCutoffs()`
 * below over all runs first.
 */
export function buildRoadmap(
  runs: RoadmapRun[],
  opts: { wearCautionThreshold?: number | null; mseCvThreshold?: number | null } = {},
): RoadmapRow[] {
  const groups = new Map<string, RoadmapRun[]>();
  const labels = new Map<string, string>();
  for (const r of runs) {
    const shown = r.formation ?? "—";
    const key = shown.trim().toLowerCase();
    if (!labels.has(key)) labels.set(key, shown);
    const a = groups.get(key);
    if (a) a.push(r);
    else groups.set(key, [r]);
  }

  const rows: RoadmapRow[] = [];
  for (const [key, gs] of groups) {
    const formation = labels.get(key) ?? key;
    const sizes = [...new Set(gs.map((r) => r.bitSize))].sort();
    const depthFrom = median(gs.map((r) => r.depthMid).filter(num));
    const wearRates = gs
      .map((r) => wearPer100m(wearAvg(r.dullInner, r.dullOuter), r.meters))
      .filter(num);
    const medWear = median(wearRates);
    const mseCv = cv(gs.map((r) => r.mse).filter(num));
    const failures = gs.filter((r) => isFailureReason(r.reasonCode)).length;
    const failureShare = gs.length ? failures / gs.length : 0;

    const zoneReasons: string[] = [];
    // Strictly ABOVE a POSITIVE cutoff.
    //
    // Both guards are load-bearing, and the archive proves it: most runs carry a
    // 0/0 dull grade, so the 75th percentile of the per-group median wear rate
    // comes out at exactly 0 — and `medWear >= 0` is true of every group on
    // earth. All 43 formations came back "caution" on that alone. A cutoff of
    // zero means there is no wear signal in this selection, which is a reason to
    // say nothing rather than to flag everything.
    if (opts.wearCautionThreshold != null && opts.wearCautionThreshold > 0
        && medWear != null && medWear > opts.wearCautionThreshold) {
      zoneReasons.push(
        `wear rate ${medWear.toFixed(2)}/100 m — worst quartile of this selection`,
      );
    }
    // Above the absolute floor AND in the worst quartile of this selection —
    // see MSE_CV_FLOOR for why the floor alone flags nearly everything.
    const cvCut = Math.max(MSE_CV_FLOOR, opts.mseCvThreshold ?? MSE_CV_FLOOR);
    if (mseCv != null && mseCv > cvCut) {
      zoneReasons.push(`MSE varies by ${Math.round(mseCv * 100)}% of its mean — worst quartile here`);
    }
    if (failureShare >= 0.25) zoneReasons.push(`${Math.round(failureShare * 100)}% of runs pulled for failure`);

    const common = {
      formation,
      bitSizes: sizes,
      depthFrom: depthFrom ?? null,
      depthTo: median(gs.map((r) => r.depthMid).filter(num)) ?? null,
      n: gs.length,
      zone: (zoneReasons.length ? "caution" : "benign") as ZoneFlag,
      zoneReasons,
      medianWearPer100m: medWear,
      mseCv,
      failureShare,
    };

    if (gs.length < MIN_RUNS) {
      rows.push({
        ...common, wob: null, rpm: null, flow: null,
        basis: "ROP", bestN: 0, screenFellBack: false, insufficient: true,
      });
      continue;
    }

    // 1 ── screen out the runs that ended badly.
    let pool = gs.filter((r) => !endedBadly(r));
    let screenFellBack = false;
    if (pool.length < MIN_BEST) {
      // Every good run was screened out. Falling back to the full set is better
      // than reporting nothing, but the caller must be able to SAY so.
      pool = gs;
      screenFellBack = true;
    }

    // 2 ── rank by the best available objective.
    const costed = pool.filter((r) => num(r.costPerM) && r.costPerM! > 0);
    const tripped = pool.filter((r) => num(r.tripRopMHr) && r.tripRopMHr! > 0);
    let basis: RoadmapRow["basis"];
    let ranked: RoadmapRun[];
    if (costed.length >= MIN_BEST) {
      basis = "cost/m";
      ranked = [...costed].sort((a, b) => a.costPerM! - b.costPerM!);
    } else if (tripped.length >= MIN_BEST) {
      basis = "trip-adjusted ROP";
      ranked = [...tripped].sort((a, b) => b.tripRopMHr! - a.tripRopMHr!);
    } else {
      basis = "ROP";
      ranked = [...pool]
        .filter((r) => num(r.ropMHr) && r.ropMHr! > 0)
        .sort((a, b) => b.ropMHr! - a.ropMHr!);
    }

    // 3 ── best tercile, at least MIN_BEST.
    const take = Math.max(MIN_BEST, Math.ceil(ranked.length / 3));
    const best = ranked.slice(0, Math.min(take, ranked.length));

    rows.push({
      ...common,
      wob: band(best.map((r) => r.wobKlb)),
      rpm: band(best.map((r) => r.rpm)),
      flow: band(best.map((r) => r.flowGpm)),
      basis,
      bestN: best.length,
      screenFellBack,
      insufficient: false,
    });
  }

  // Ordered by depth — a roadmap is read top-down as the hole is drilled.
  return rows.sort((a, b) => {
    const ad = a.depthFrom ?? Number.POSITIVE_INFINITY;
    const bd = b.depthFrom ?? Number.POSITIVE_INFINITY;
    return ad - bd || a.formation.localeCompare(b.formation);
  });
}

/**
 * The wear rate above which a group counts as dysfunction-prone: the 75th
 * percentile of every group's median wear rate across the displayed set.
 *
 * Computed over all groups because "worst quartile" is only meaningful relative
 * to the rest of the data on screen.
 */
export function wearCautionCutoff(runs: RoadmapRun[]): number | null {
  const byGroup = new Map<string, number[]>();
  for (const r of runs) {
    const key = (r.formation ?? "—").trim().toLowerCase();
    const w = wearPer100m(wearAvg(r.dullInner, r.dullOuter), r.meters);
    if (w == null) continue;
    const a = byGroup.get(key);
    if (a) a.push(w);
    else byGroup.set(key, [w]);
  }
  const medians = [...byGroup.values()]
    .map((xs) => median(xs))
    .filter(num);
  if (medians.length < 4) return null;   // too few groups for a quartile to mean anything
  return quantile(medians, 0.75);
}

/**
 * Both caution cutoffs for a displayed set: the 75th percentile of the per-group
 * median wear rate, and of the per-group MSE coefficient of variation.
 *
 * Returned together because a caller always needs both and computing them in one
 * pass keeps the grouping logic in one place.
 */
export function cautionCutoffs(runs: RoadmapRun[]): {
  wear: number | null;
  mseCv: number | null;
} {
  const wearByGroup = new Map<string, number[]>();
  const mseByGroup = new Map<string, number[]>();
  for (const r of runs) {
    const key = (r.formation ?? "—").trim().toLowerCase();
    const w = wearPer100m(wearAvg(r.dullInner, r.dullOuter), r.meters);
    if (w != null) {
      const a = wearByGroup.get(key);
      if (a) a.push(w); else wearByGroup.set(key, [w]);
    }
    if (num(r.mse) && r.mse! > 0) {
      const a = mseByGroup.get(key);
      if (a) a.push(r.mse!); else mseByGroup.set(key, [r.mse!]);
    }
  }
  const p75 = (xs: number[]) => (xs.length >= 4 ? quantile(xs, 0.75) : null);
  return {
    wear: p75([...wearByGroup.values()].map((xs) => median(xs)).filter(num)),
    mseCv: p75([...mseByGroup.values()].map((xs) => cv(xs)).filter(num)),
  };
}
