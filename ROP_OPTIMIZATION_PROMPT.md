# Prompt: Upgrade the ROP Optimization tab (evidence-based drilling analytics)

> Paste this whole file as the task for Claude Code (Opus 5) in the repo root.
> Research basis with full citations: `docs/rop-optimization-research.md` — read it first.

## Mission

Extend the existing **ROP Optimization** tab of the Daily Drilling Reports app with the
methods and chart types that the drilling-engineering literature and commercial practice
(SPE/IADC papers, PetroWiki, SLB DrillOps) actually use — and that are computable from
**per-bit-run daily-report data** (one record per bit run; no real-time WITS feed). The
research report ranks nine additions by evidence strength and implementability; implement
the seven core work packages below in order. Each is independently shippable.

You are working on real drilling data used by real drilling engineers in Iranian fields.
Correctness of formulas and honest labeling of what sparse data can and cannot claim
matter more than visual flash.

## Read first (in this order)

1. `docs/rop-optimization-research.md` — the evidence base; every WP cites it.
2. `apps/web/src/components/ddr/RopOptimization.tsx` — the tab: 11 views (`summary`,
   `contour`, `voxel`, `mse`, `hydraulics`, `economics`, `advisor`, `scatter`, `size`,
   `progress`, `table`), shared facet sidebar, client-side bit-class filter, IQR outlier
   screening, hand-rolled SVG + Recharts + react-three-fiber chart stack.
3. `packages/shared/src/drilling/` — `mse.ts` (Teale, founder), `bit.ts`, `stats.ts`,
   `cost.ts`, `hydraulics.ts`, `units.ts`, and their `*.test.ts` files (vitest).
4. `apps/api/src/routes/ddr.ts` (route `POST /ddr/rop-optimization`, ~line 166, and
   `enteredRopPoints` ~line 284) and `apps/api/src/ddr/db.ts` (`getRopOptimization`
   ~line 2000, `bitDull` ~line 1783) — how points are built from the legacy L05 bit table
   + rig-entered Prisma data, and how MSE/HSI/dull codes are computed server-side.
5. `apps/web/src/components/ddr/useFacetOptions.ts` and `ddrSelection.ts` — facet plumbing.

## Non-negotiable constraints

- **Data honesty.** Per-run averages support *cross-run screening and trends*, not
  intra-run dysfunction diagnosis (MSE diagnostics need ~1–3 ft data density — research §1).
  Never label a view "real-time" or "dysfunction detection". Use wording like "screening",
  "apparent", "estimated from run averages". Most ROP limiters are not the bit (40+
  categories, only 4 bit-related — research §1): annotate, don't over-attribute to the bit.
- **Units.** Keep the app convention: depth/footage/ROP metric (m, m/hr); WOB in klb with
  tonnes alongside in prose via `klbToTonnes`; MSE in psi with MPa secondary via `psiToMPa`;
  hydraulics in field units; money in USD. All canonical formulas run in API units
  internally (lbf, ft/hr, ft·lbf, in) exactly as `mseTeale` does.
- **Tri-state bit class.** `bitClass` is `"PDC" | "roller" | null`. Never fold `null`
  (no bit evidence) into roller. Groups without classified members stay out of per-class
  rollups (the `groupByIadc` rule).
- **Null-tolerance.** Any point field may be null. Every new metric returns `null` when its
  inputs are missing/non-positive, and every chart/aggregate skips nulls and shows how many
  points it used ("n = …" captions, like existing views).
- **Don't break the 11 existing views.** Additions are new views or clearly-scoped
  extensions of existing ones. The facet sidebar, outlier screening, `source` legacy/entered
  split, and click-through to daily reports (`onOpenReport`) keep working everywhere.
- **Pure math lives in `packages/shared/src/drilling/`** with vitest tests; components only
  orchestrate and render. Match the existing code style: comment density, doc-comment tone
  (state the engineering constraint, cite the source paper in the header comment), naming.
- **Charts** reuse the existing stack (Recharts for scatters/bars/lines, hand-rolled SVG for
  heatmap/depth-track idioms, the shared `Colorbar`/`ropColor`/`niceStep` helpers). New
  `Interp` interpretation blocks follow the existing pattern and end with a one-line source
  citation (the app already does this for the Khangiran reference study).
- **No new runtime dependencies** without a stated reason. Everything below is implementable
  with what's installed.
- **Performance:** the endpoint caps at 20,000 points; every new aggregation must be O(n)
  or O(n log n) over points and computed in `useMemo` keyed on the filtered points, like
  existing views.

## Work packages

### WP1 — "Roadmap" view: offset-mined drilling-parameter roadmap  *(research §5, §6 — rec #1)*

The single most-adopted deliverable in commercial drilling analytics (SLB DrillOps sells
exactly this; SPE 2024 Muscat paper field-tested the workflow): per-formation, per-section
**recommended WOB / RPM / flow bands vs depth**, mined from offset bit runs.

Build a new `roadmap` view:

- **Aggregation** (new shared function, e.g. `drilling/roadmap.ts`): group the filtered
  points by top formation (case-folded, like `aggregateByFormation`) × normalized bit size.
  Within each group with **n ≥ 5** runs:
  - Rank runs by cost-per-meter where computable (reuse `costPerMeter` with the economics
    view's price/rig-rate inputs), else by trip-adjusted ROP, else raw ROP. Take the **best
    tercile** (min 3 runs).
  - Recommended band per parameter = **P25–P75 of the best-tercile runs** (via `quantile`)
    for WOB (klb), RPM, and flow (gpm, when present); record the band's n and median depth
    range (from/to midpoints).
  - **Exclude from the "best" set** runs with severe dull (inner or outer wear ≥ 4) or
    reason-pulled codes indicating failure (`DTF`, `PR`, `BT`, `LOT` — map from the codes
    present in `IADC_REASON`), so the roadmap never recommends parameters that tore bits up.
  - **Zone flag** per group: `caution` when the group shows dysfunction evidence — median
    wear rate in the worst quartile of all groups (WP2 metric), or MSE coefficient of
    variation > 0.5, or ≥ 25% of runs pulled for failure reasons; else `benign`. (Zone
    segmentation is the load-bearing idea of the SPE 2024 hybrid workflow.)
- **Rendering:** a depth track (downward depth axis, same idiom as `RopMseDepthChart`) with
  one row per formation ordered by median depth: formation name, depth range, hole sizes,
  the WOB and RPM bands drawn as horizontal ranged bars on shared parameter axes, flow band
  and n as text, zone flag as a colored chip (amber for caution with a tooltip naming the
  evidence). Beside it, a plain table of the same rows (formation, depth, size, WOB band
  klb *and tonnes*, RPM band, flow band, n, zone, basis: "best tercile by cost/m of N runs").
- **Export:** a "Copy as CSV" button for the table (clipboard), so engineers can paste the
  roadmap into a drilling program. No print CSS needed.
- **Interp block:** states the recipe transparently (best-tercile by cost-per-meter,
  P25–P75, dull-screened) and cites SLB DrillOps + SPE OPES-2024 (research §5–6).
- **Acceptance:** groups with n < 5 are listed greyed-out as "insufficient runs" rather than
  silently dropped; a formation whose best runs are all dull-screened falls back to the full
  set with a visible note; unit tests cover the tercile/band/exclusion logic on synthetic
  runs including all-null flow.

### WP2 — Quantitative dull-grade forensics: "Bit wear" view  *(research §3 — rec #2)*

The IADC 8-point wear scale is linear in remaining cutter height (SPE/IADC 23939), so wear
*rates* are meaningful; the SPE/IADC 2022 forensics paper shows structured dull analysis
measurably improves causal diagnosis. The tab stores dull data but uses it only as text.

- **Backend:** extend the point payload with the discrete dull positions the server already
  assembles inside `bitDull` (`db.ts:1783`) but doesn't emit: `dullChar` (position 3 code),
  `dullLocation`, `dullBearing`, `dullGauge`, plus `torqueFtLbf`/`torqueMeasured` (needed by
  WP5; the value exists server-side where `mseEstimated` is set). Keep the assembled
  `dullGrade`/`dullTitle` unchanged.
- **New shared functions** (`drilling/wear.ts`): `wearAvg = (inner + outer) / 2` (null if
  either missing); `wearPerHour = wearAvg / bitHour`; `wearPer100m = 100 * wearAvg / meters`
  (nulls on non-positive denominators).
- **Charts:**
  1. **Wear-rate heatmap** (reuse the contour view's SVG grid machinery): rows = top
     formations (ordered by depth), columns = bit family (PDC / roller / unclassified,
     or IADC series chips when one class is selected), cell = mean `wearPer100m`, cell
     tooltip shows n, mean hours, mean meters. This is the "which bit survives which
     formation" chart — the core of offset bit-record forensics.
  2. **Dull-characteristic Pareto** (Recharts bar): count of runs per dull characteristic
     code (decoded titles), split PDC vs roller by color; identifies the dominant damage
     mode per the forensic workflow (damage → dysfunction → practice change).
  3. **Wear vs ROP scatter**: `wearPer100m` vs ROP, per bit class. Caption the Dupriest
     sliding-distance hypothesis (absent dysfunction, higher ROP/WOB should *reduce* wear
     per meter — research §1) and report the Spearman ρ so the data confirms or refutes it
     for these fields.
- **Advisor integration:** add median `wearPer100m` as a sixth criterion in the `advisor`
  view's weighted ranking (lower is better, default weight 0 so existing rankings don't
  silently change; slider like the others).
- **Acceptance:** runs missing dull grades or hours/meters are excluded with visible counts;
  the heatmap renders with ≥ 1 populated cell even under heavy filtering; unit tests cover
  the rate math and the null paths; Interp cites SPE/IADC 23939 + the 2022 IADC Code
  Upgrade paper.

### WP3 — Break-even bit economics  *(research §3 — rec #3)*

PetroWiki/SPE calls break-even "the most important aspect" of bit economic evaluation, and
every input is a per-run daily-report quantity. Extend the `economics` view:

- **New shared functions** (`cost.ts`): metric break-even solving
  `C_ref = (bitUsd + rigUsdPerHr · (tripHr + drillHr)) / meters`:
  - `breakEvenRopMHr({ refCostPerM, bitUsd, rigUsdPerHr, tripHr, meters })` → the ROP a
    candidate bit must sustain over `meters` to match `refCostPerM`
    (`drillHr = (refCostPerM · meters − bitUsd − rig · tripHr) / rig`; null when ≤ 0).
  - `breakEvenMeters({ refCostPerM, bitUsd, rigUsdPerHr, tripHr, ropMHr })` → footage needed
    at an assumed ROP (solve the same identity for meters; null when infeasible).
- **UI:** in the economics view, a "Break-even vs best offset" panel: reference = the
  lowest cost/m IADC group currently displayed (or a user-entered $/m). For every other
  IADC group show required break-even ROP at its own average meterage and required footage
  at its own average ROP, flagging groups that already beat the reference. One Recharts
  chart: cost/m vs meterage curves per IADC group (line = cost/m as a function of meters at
  the group's average ROP), with the reference cost/m as a dashed `ReferenceLine` — the
  intersection *is* the break-even footage, annotated.
- **Interp:** note the known failure mode — offset cost-per-meter ranking cannot surface a
  bit type never run in the offsets (research §3) — pointing at WP4's strength-based screen
  as the complement. Cite PetroWiki.
- **Acceptance:** unit tests with the PetroWiki worked example converted to metric (13.7
  ft/hr over 3,380 ft at $28.46/ft — reproduce in $/m and m/hr within rounding); infeasible
  break-evens (negative drill time) render as "unreachable", not NaN.

### WP4 — Formation strength & bit-type match: "Strength" view  *(research §2 — rec #4)*

Gives the tab its missing physical axis — apparent rock strength per formation — from data
it already has, then screens bit types against it.

- **New shared functions** (`drilling/strength.ts`):
  - `apparentCcsFromMse(msePsiValues)` — apparent CCS ≈ P25 of run-level MSE ÷ 3 (the
    MSE ≈ 3×CCS efficient-drilling anchor, mechanical efficiency ~0.33; research §1).
    Prefer measured-torque MSE when ≥ 4 such values exist, else all. Also return
    `ucsBand: [ccs/2.3, ccs/1.8]` (the published CCS/UCS ratio range).
  - `binghamFit(points)` — per-formation linear fit (reuse `linearFit`) of
    R/N vs W/D, where R/N = ROP(ft/hr)/RPM and W/D = WOB(klb)/diameter(in): returns slope,
    x-intercept (threshold weight), R², n. Slope is a *relative drillability index*
    (falls with strength — Bingham per OGJ 1994); label it relative, never absolute psi.
  - `dExponent({ ropFtHr, rpm, wobLbf, dIn })` = `log10(R/(60N)) / log10(12W/(10⁶·D))`,
    plus `dcExponent(d, { mudPpg, normalPpg = 9.0 })` = `d · normalPpg / mudPpg`
    (ECD unavailable; mud weight is the available proxy — say so in the caption).
- **Charts:**
  1. **Strength ladder** (SVG depth-track idiom): formations ordered by depth, horizontal
     bar = apparent UCS band (psi + MPa), colored by the five-band UCS suitability table;
     right-hand chips show which bit families the band admits (milled tooth < 9k psi;
     TCI ≥ 9k; PDC ≤ 22k, "possibly" beyond; impreg > 15k; roller soft ≤ 18k / medium
     ≤ 26k — research §2), and which families were *actually run* there (from the data),
     highlighting mismatches.
  2. **Bingham panel**: R/N vs W/D scatter for the selected formation with the fitted
     line; small-multiple table of slopes across formations, sorted, as the drillability
     ranking.
  3. **dc-exponent vs depth** scatter (per well color, like `progress`) as the
     compaction/strength trend — a standard DDR-computable log.
- **Acceptance:** formations with < 5 MSE values or no WOB/RPM spread show "insufficient
  data" rather than a fit; unit tests pin `dExponent` against a hand-computed example and
  `binghamFit` against synthetic lines; every strength figure is labeled "apparent";
  Interp cites the OGJ dull-grading & CCS articles and the MSE≈3×CCS anchor.

### WP5 — MSE view upgrades: efficiency ratio, aggressiveness, E–S diagnostics  *(research §1 — rec #5)*

- **Efficiency ratio strip:** with WP4's per-formation apparent CCS, chart each run's
  efficiency = `3 · CCS_apparent / MSE` (≈1 = efficient, ≪1 = inefficient) vs depth,
  colored by formation. This turns the absolute-MSE log into the normalized efficiency
  display practitioners use. Runs with estimated torque render hollow (existing
  measured/estimated split convention).
- **Bit aggressiveness:** `mu = 36 · torqueFtLbf / (dIn · wobLbf)` — **measured-torque runs
  only** (estimated torque would just return `MU_DEFAULT`; guard it, and say so in the
  caption). Box/strip plot of μ by bit make and IADC series within the selected size.
  Aggressiveness is a published ML bit-selection feature and the standard PDC/roller
  discriminator (research §5).
- **E–S cross-plot (Detournay & Defourny frame, the 2017 MSE-vs-DS practice):** per run
  compute depth of cut per rev `docIn = mhrToFthr(rop) · 12 / (60 · rpm)`, drilling
  strength `S = wobLbf / (bitArea(dIn) · docIn)` [psi], and plot MSE vs S per formation,
  colored by depth. Overlay the identity-efficiency reference (MSE = S line) and annotate:
  points hugging a common friction line = consistent bit behavior; MSE and MSE/S rising
  together across runs ⇒ vibration-type dysfunction; MSE rising while MSE/S falls ⇒
  balling/wear-type (research §1). **Wording: "cross-run screening", never "detection".**
- **Limiter framing:** in the founder panel's Interp, adopt Dupriest's taxonomy: label the
  founder side "inefficiency (balling / vibrations)" and the pre-founder plateau "energy-
  input limited", and list the non-bit limiter categories in the tooltip (research §1).
  Cite SPE 92194 / SPE 102210 / the 2017 MSE-DS paper.
- **Acceptance:** μ and E–S panels state n and exclude estimated-torque points; unit tests
  for `mu` (inverts `estimateTorque` exactly: feeding T = μdW/36 back returns μ) and for
  `S` on hand-computed values; efficiency strip caps display at, say, 1.5 with an
  out-of-range marker rather than letting one noisy run flatten the scale.

### WP6 — Benchmarking upgrades: composite-best curve & percentile bands  *(research §6 — rec #6)*

- **Progress view, "Depth vs days" mode:** add a **best-composite reference curve** — for
  each depth bin (reuse ~24-bin idiom), the minimum days-per-meter achieved by any
  displayed well, integrated into a monotone depth-time curve — drawn as a dashed dark
  reference line labeled "Best composite (technical limit)". This is the SPE "True Lies"
  depth-vs-days-vs-reference chart, explicitly buildable from one depth point per day.
- **New "Benchmark" panel (inside `summary` or the `size` view):** per-formation ROP
  percentile bands — P10/P50/P90 across all displayed runs (via `quantile`) drawn as a
  banded horizontal chart, with the currently selected well's runs overlaid as dots. Answers
  "is this well drilling this formation at P20 or P80?" — the offset-benchmarking idiom.
- **KPI note:** where the summary reports hours/footage, add a caption warning against
  ratio-KPIs like NPT% (drilling faster with the same NPT hours *raises* NPT% — research
  §6); benchmark against the composite curve instead. Cite SPE "True Lies" 2016.
- **Acceptance:** composite curve is monotone non-decreasing in depth and never later than
  the fastest well at any bin (property test); bands need ≥ 8 runs per formation else the
  row is greyed "insufficient runs".

### WP7 — Constrained per-formation Bourgoyne & Young fit: "Model" view  *(research §4 — rec #7, experimental)*

B&Y is the literature's default classical model, designed to be fitted per formation from
offset records — but naive regression is a documented failure mode. Implement it the way
the literature says it works:

- **Shared module** (`drilling/bym.ts`):
  - `bymPredict(params, run)` implementing the multiplicative subfunctions that our data
    supports: f1 drillability (e^a1), f2 depth/compaction (needs TVD — use run mid-depth),
    f5 WOB/diameter (normalized at 4 klb/in, with threshold weight), f6 RPM (normalized at
    100 rpm), f7 tooth wear (fractional wear h = wearAvg/8 from WP2), f8 jet impact
    (`jetImpact` from hydraulics.ts, normalized at 1,000 lbf). **Drop f3/f4** (pore
    pressure / differential pressure — no data; the literature prunes collinear/unsupported
    terms rather than faking inputs).
  - `bymFit(runs, bounds)` — **bounded search only** (unconstrained regression produces
    meaningless coefficients — research §4): coordinate-descent or multi-start random
    search *within published coefficient bounds* (take the bounds table from the
    Advances-in-Geo-Energy-Research 2021 review / Eren 2015 as embedded constants with a
    source comment), minimizing **mean absolute relative error** (research §4: R² is
    unreliable here — a presalt case got R² = −1.94 with a usable model).
  - Fit only formations with **n ≥ 15** runs spanning meaningful WOB and RPM ranges
    (guard: P90/P10 spread ≥ 1.3× on both axes); else report "not fittable".
- **UI:** formation picker → fitted-vs-actual scatter with MARE% caption; **response
  surface** of predicted ROP over the WOB×RPM plane (reuse the contour SVG grid) at the
  formation's median depth/wear/hydraulics, with the cost-per-meter-optimal cell marked
  (combine with `costPerMeter` at the economics inputs). Label the whole view
  **"experimental — per-formation fit from N runs; relative error X%"**.
- **Acceptance:** unit tests fit synthetic data generated from known coefficients and
  recover them within tolerance; a formation failing the spread guard renders the guard
  message; fitted coefficients always lie inside bounds; Interp cites B&Y 1974, the 2021
  review, and the bounded-fitting papers.

### Optional stretch (only if all seven core WPs are done, tested, and committed)

- **WP8 — Bit-type suggestion model** (research §5): random-forest-style classifier is
  overkill in-browser; instead implement the published *feature set* as a transparent
  nearest-neighbors suggester: for a target formation + hole size, rank bit types run in
  analogous strength/size contexts by outcome (cost/m, wear rate), with class-imbalance
  caveats surfaced (minority bit types flagged "few samples — low confidence"). Cite the
  Energies 2021 Volve study; report per-class counts, never a bare accuracy claim.
- **WP9 — Multi-objective view**: Pareto front of the IADC groups over (cost/m, median MSE,
  wear rate) rendered as a scatter with dominated points greyed (research §5, Bayesian
  multi-objective paper's objective pair) — no optimizer needed, just dominance filtering.

## Verification protocol (run after every WP)

1. `source ~/.nvm/nvm.sh && nvm use 24` — **system node 20 breaks the API; use Node 24.**
2. `npm run typecheck` (or the workspace equivalent — check root `package.json` scripts).
3. `npx vitest run` in `packages/shared` — all existing + new tests green.
4. Launch the app (see `run.sh` / the project's run skill), open Well Reports → DDR → ROP
   Optimization, load a real selection (pick a field with many wells), and click through
   **all** views — the 11 existing ones must be visually unchanged except where a WP
   explicitly extends them; each new view must render with real data, with facets, outlier
   toggle, and bit-class filter applied.
5. Check the browser console for errors and the API log for slow queries (> 1 s).
6. Commit per work package on `main` and push (repo convention: no feature branches):
   `feat(rop): <WP summary>` — mirror the existing commit-message style.

## Reference numbers you'll need (from the research report — do not re-derive)

| Constant | Value | Source |
|---|---|---|
| Efficient-drilling anchor | MSE ≈ 3 × CCS (Em ≈ 0.30–0.35) | SPE 2017 MSE/DS; matches app Em default |
| CCS : UCS ratio | 1.8 – 2.3 | OGJ CCS article |
| UCS bit bands (psi) | MT < 9k; TCI ≥ 9k; PDC ≤ 22k (possibly above); impreg > 15k; roller soft ≤ 18k, medium ≤ 26k | Research §2 |
| PDC cutter vs CCS | 13 mm → ~45k psi; 8 mm → ~55k psi | OGJ CCS article |
| Aggressiveness | μ = 36·T[ft·lbf] / (D[in]·WOB[lbf]) | Bit-calculations ref; inverse of `estimateTorque` |
| Depth of cut | DOC[in/rev] = ROP[ft/hr]·12 / (60·RPM) | Definition |
| d-exponent | d = log10(R/(60N)) / log10(12W/(10⁶D)); dc = d·9.0/mudPpg | Standard; R ft/hr, W lbf, D in |
| Break-even identity | C = (C_bit + R_rig·(t_trip + t_drill)) / footage | PetroWiki |
| Default trip rate (when unrecorded) | 1,000 ft/hr round-trip convention | PetroWiki |
| Bit cost ratios | PDC ≤ 20× milled tooth, ≤ 4× TCI | PetroWiki |
| B&Y normalization | TVD_N 10,000 ft; (W/D)_N 4 klb/in; RPM_N 100; Fj_N 1,000 lbf | Presalt study / B&Y 1974 |
| B&Y error target | MARE ~5–27% is the published attainable range | Research §4 |
| IADC wear scale | 0–8, linear in remaining cutter height | SPE/IADC 23939 |
| MSE/DS bands | 1–1.5 efficient; ≫ 5 severe; ↑MSE+↑ratio ⇒ vibrations; ↑MSE+↓ratio ⇒ balling/wear | SPE 2017 |
| Dupriest limiters | 40+ categories, 4 bit-related; founder causes: bit balling, bottomhole balling, vibrations | SPE 102210 |

Full citations and URLs: `docs/rop-optimization-research.md` §"Source list".
