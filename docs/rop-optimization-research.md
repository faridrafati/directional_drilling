# ROP Optimization & Bit Selection — research report

*Deep-research synthesis, 2026-08-12. Basis for [ROP_OPTIMIZATION_PROMPT.md](../ROP_OPTIMIZATION_PROMPT.md).*

**Scope.** What the published literature and commercial practice say about ROP-optimization
methods, chart types, and bit-selection workflows that are implementable from **per-bit-run
daily-drilling-report data** (one record per bit run / per day — no real-time WITS feed), going
beyond what the app's ROP Optimization tab already has (Teale MSE, founder detection, WOB×RPM
contour, HSI hydraulics, cost-per-meter economics, IADC dull fields, PDC/roller split).

**Method & verification status.** A multi-agent deep-research workflow ran 5 parallel search
sweeps, fetched ~28 sources, and extracted falsifiable claims with verbatim quotes. An
adversarial 3-vote verification pass started; 13 claims received votes before the session quota
cut it off — **every vote that completed was a "not refuted"; nothing was refuted**. Claims below
are marked ✅ (survived adversarial votes) or ◻ (extracted from the cited source with verbatim
quote, adversarial pass not completed). Source-quality labels (primary = SPE/peer-reviewed paper
or first-party product page; secondary = training decks, trade-press) are from the fetch agents.

---

## 1. MSE-based optimization practice (evidence: strongest in the field)

The canon is Dupriest & Koederitz, **SPE/IADC 92194** (2005) and Dupriest, **SPE 102210** (2006).

- ✅ A three-month, six-rig ExxonMobil pilot of real-time MSE surveillance raised average ROP
  **133%** and set field records on 10 of 11 wells (SPE 92194, primary).
- ✅ MSE surveillance improves performance through two mechanisms: easy identification of optimum
  WOB/RPM, and quantitative cost-justification of design changes that extend system limits
  (SPE 92194).
- ✅ SPE 102210 extends it into a drill-rate management workflow embedded in planning, execution
  and post-well review — "the industry's first comprehensive ROP design process" — deployed
  across ~4.5 million ft/year, with sustained gains in ROP, **bit life**, and vibration-related
  tool failures (SPE 102210, primary).
- ◻ Dupriest's diagnostic frame: every ROP limitation is either **inefficiency (founder)** — with
  exactly three causes: bit balling, bottomhole balling, vibrations — or an **energy-input
  limit** (hole cleaning, motor differential rating, top-drive/make-up torque, hole integrity…).
  ExxonMobil catalogued **40+ limiter categories, only 4 bit-related** — most slow footage is
  *not* the bit's fault (SPE 102210). All limiters sit on the same ROP-vs-WOB line, so exactly
  one is active at a time; the workflow is identify → redesign → repeat (Fast Drill / AADE deck).
- ◻ The efficiency anchor: efficient drilling ≈ **MSE ≈ 3× CCS** (mechanical efficiency
  ~0.30–0.35); CCS preferred over UCS because it includes confining pressure; **CCS ≈ 1.8–2.3×
  UCS** typically (SPE 2017 MSE/DS paper; OGJ CCS article). This matches the app's Em = 0.35
  default and μ = 0.25/0.5 torque fallback, independently corroborated by the 2022 Bayesian
  paper (Energies 15:8030).
- ◻ **MSE/DS ratio** (DS = drilling strength = WOB/(DOC·bit radius area term), DOC = depth of cut
  per rev): 1–1.5 = efficient, ≫5 = severe dysfunction; **MSE and MSE/DS rising together ⇒
  vibrations; MSE rising while MSE/DS falls ⇒ bit balling or wear** — the published way to
  separate dysfunction causes that MSE alone can't (SPE-185125-class 2017 paper, primary).
- ◻ **Honesty bound for daily data:** MSE-based *intra-run* dysfunction diagnosis needs ~1–3 ft
  depth density; 10-ft averaging already loses the diagnostic variations (same 2017 paper). So a
  DDR tab can do **cross-run screening and trends**, not real-time dysfunction detection — the UI
  wording must respect this.
- ◻ Bit-life counterintuition worth testing on our data: absent dysfunction, **higher WOB
  increases PDC bit life** because wear is controlled by sliding distance and higher
  depth-of-cut cuts the sliding distance per foot (8-½" example: 10,679 ft of sliding per 100 ft
  drilled at 150 fph vs 32,038 ft at 50 fph) (Dupriest Fast Drill deck).

**Charts practitioners actually use:** MSE (and MSE/DS) vs depth annotated with dysfunction
intervals; ROP-vs-WOB drill-off with founder point and the *named active limiter*; MSE-vs-DS
cross-plot (slope = bit aggressivity, colored by depth); MSE-vs-WOB step-test plots; MSE-vs-depth
offset-run overlays used for bit-design choices (e.g. gauge length 2" vs 6", SPE 119625).

## 2. Formation strength & bit-type matching (evidence: strong, directly implementable)

- ◻ **Bingham's linear approximation** back-estimates rock strength from ordinary per-run data:
  plot ROP-per-revolution (R/N) vs WOB-per-inch (W/D); slope falls and X-intercept rises with
  rock strength. Explicitly a per-bit-run-averages chart — no logs needed (OGJ 1994 dull-grading
  article, secondary).
- ◻ **UCS-band bit suitability table** (secondary, two independent decks): milled tooth < 9,000
  psi; TCI ≥ 9,000 psi (uneconomic below); PDC up to ~22,000 psi, "possibly" beyond;
  diamond-impregnated > 15,000 psi. Roller-cone classes: soft-formation ≤ ~18,000 psi,
  medium ≤ ~26,000 psi (OGJ 1994).
- ◻ CCS thresholds map to PDC cutter size: 13-mm cutters to ~45,000 psi CCS, 8-mm high-density
  to ~55,000 psi (OGJ CCS article; validated over 100+ wells / 500,000+ ft, with the caveat it
  errs in conglomerates/unconsolidated rock).
- ◻ ROP varies inversely with rock strength; section-average strength seldom exceeds 40,000 psi
  (OGJ 1994).
- ◻ Selection methodology is a three-step screen: eliminate bit types unsuitable for the
  hardness → compare economics (ROP, time saved, rig cost, bit price) → apply special factors
  (directional needs); PDC envelope keeps expanding (training deck reproducing SPE material).
- ◻ Heterogeneity matters, not just average strength — hybrid roller/PDC bits exist precisely
  for medium/hard formations with hard stringers.

## 3. Bit selection: economics & dull-grade forensics (evidence: strong; the app has the data)

- ◻ **Break-even analysis is "the most important aspect" of bit economic evaluation**
  (PetroWiki/SPE): the break-even point is the footage + hours a candidate bit must achieve to
  match the offset's cost-per-foot. Cost-per-foot needs only rig rate, trip time, rotating time,
  bit cost, footage — **all per-run daily-report quantities**. Two inversions for planning:
  assume footage ⇒ required break-even ROP; assume ROP ⇒ required footage. Default trip rate
  convention when unrecorded: 1,000 ft/hr. Cost anchors: PDC up to 20× milled-tooth, 4× TCI.
- ◻ Offset-well bit records ranked by cost-per-foot were *the* standard selection method, with a
  known failure mode: it can't find a bit type never run in the offsets — hence strength-based
  selection as the complement (OGJ 1994).
- ◻ **Five-part selection workflow** coupling strength + forensics: determine rock strength →
  pick bit type from strength → grade the pulled dull → diagnose wear causes → spec the next
  bit from formation character + wear pattern (OGJ 1994).
- ◻ The IADC 8-point wear scale is **linear in remaining cutter height** (SPE/IADC 23939), which
  is what makes quantitative wear rates — dull grade per rotating hour / per meter — meaningful.
- ◻ **SPE/IADC 2022 "IADC Code Upgrade" bit-forensics paper** (primary): dull forensics works as
  a structured pipeline (damage → dysfunction → practice/design change); guided, standardized
  data collection measurably beats ad-hoc collection; routine drilling data (not new sensors) is
  sufficient if fed through the workflow; the classic dull-grade standard is under formal
  IADC/SPE revision because the industry found it insufficient for forensics.
- ◻ Cost-per-foot's blind spots (ignores formation/directional context) and specific-energy
  selection's blind spots (ignores rock mechanics, vibration effects on dulls) are the stated
  motivation for data-driven selection as a *supplement* (Energies 2021 bit-classifier paper).

## 4. Classical ROP models (evidence: strong; fit constraints well documented)

- ◻ Across a ~45-study half-century review, **Bourgoyne & Young (1974) is the most-used
  analytical ROP model** (Hareland & Hoberock's modified Warren second) and the review's
  recommended default when a (semi-)analytical model is wanted (Advances in Geo-Energy Research
  2021, primary).
- ◻ The eight coefficients a1–a8 are **local, per-formation constants regressed from prior/offset
  drilling data** — the model is *designed* for historical records, not real-time feeds.
- ◻ **Unconstrained regression fails**: coefficients come out physically meaningless / out of
  recommended ranges (two independent 2011 papers), and the full 8-term regression suffers
  multicollinearity requiring term pruning (JPSE 2021 loss-zone modification). A presalt case
  got **negative R² (−1.94)** with original bounds — R² is unreliable for this nonlinear model;
  use relative error; widening coefficient bounds and re-anchoring normalization cut relative
  error 46% → 27% (OTC presalt study).
- ◻ **What works: bounded/constrained fitting** — trust-region, progressive stochastic, genetic
  algorithms, or bounded iterative sampling from published coefficient ranges. A Persian Gulf
  field study achieved 4.4–6.3% mean ROP prediction error this way (review, citing Rahimzadeh
  2011).
- ◻ Field payoffs reported for classical-model optimization: 10–80% cost reduction (B&Y, Gulf
  Coast), 30–180% (Khangiran, Iran), 38% average (Hareland & Hoberock, Asmari, Iran) — the
  Iranian numbers are directly relevant to this app's fields.
- ◻ B&Y responds adequately on PDC bits in hard carbonate when bounds/normalization are adjusted
  (presalt study), and mud-loss context (recorded in DDRs) is a relevant covariate in carbonates
  (JPSE 2021).

## 5. Data-driven optimization & bit selection (evidence: growing; mind the data granularity)

- ◻ **Bit selection as multiclass classification works at exactly our data granularity**: 4,312
  samples from *final drilling reports* of 8 Volve wells, 19 bit-type classes; random forest
  with bootstrap class weighting hit 92–99% test accuracy (G-mean 0.84–0.97), beating six other
  algorithms. Feature set = per-run variables (WOB, RPM, torque, ROP, SPP, mud weight, flow,
  bit size, TFA, depth) **plus engineered features: MSE, depth-of-cut, bit aggressiveness
  DBA = 36·TQ/(WOB·D), d-exponent**. Bit size and TFA ranked most predictive. Class imbalance
  breaks naive classifiers (G-mean 0 on minority classes at high headline accuracy) — imbalance
  handling is mandatory, and accuracy alone is a misleading metric (Energies 2021, primary).
- ◻ **Ensemble ROP prediction** (RF/GB/XGBoost, SPE 2023 Iraqi field): works, but needed 14
  per-depth inputs including wireline logs — *per-depth* data, weak fit for our per-run
  constraint. Pooling 3 offset wells with cross-validation beat single-well training.
- ◻ **Constrained Bayesian multi-objective optimization** of WOB/RPM/flow with objectives {MSE,
  unit footage cost} beat NSGA-II and random search (hypervolume +54% vs random, converged in
  ~80 iterations); field test: unit cost −18%, MSE −20%, ROP +11% average — **gains were
  formation-dependent** (17/11/13% in homogeneous segments vs 5/8% in heterogeneous), so
  per-formation segmentation matters. Visualization: fitted **response surfaces of MSE / cost /
  objective over the WOB×RPM plane** (Energies 2022, primary; real-time data context).
- ◻ **The hybrid ML + domain-knowledge "operating parameter roadmap"** (SPE 2024, Muscat;
  field-tested in 4 environments): aligns offset wells by formation tops, auto-segments depth
  into zones (benign / hard stringer / interbedded / severe shock-and-vibration), recommends
  aggressive parameters only in benign zones and reads dysfunction-prone zones' parameters off
  offset sweet-spot heatmaps; delivers a **depth-based parameter roadmap**; reduced drilling
  time and dysfunctions vs the manual roadmap process (unquantified in abstract).

## 6. Dashboard & benchmarking conventions (evidence: commercial adoption + SPE case studies)

- ◻ **SLB DrillOps sells exactly the offset-mined roadmap**: "create on-demand roadmaps for any
  target well by intelligently mining your historical offsets… breaks the well into sections
  and formations, revealing the precise parameters to boost ROP and drive down MSE", with
  classical-statistical and ML engines as peer options, and depth-aligned multi-offset
  comparison as a first-class view (SLB product page, primary/first-party). This validates that
  offset-history-only parameter recommendation is commercially deployed practice — our exact
  data constraint.
- ◻ Multiwell KPI benchmarking (SPE-187470, offshore Malaysia, 7 wells): per-well KPIs compared
  across a campaign, technical-limit enforcement, invisible-lost-time quantification; >20% ILT
  reduction, 10% AFE saving. (Its granular activity KPIs need rig-sensor rig-state detection —
  not implementable from DDRs alone; the campaign-level comparisons are.)
- ◻ **"True Lies" (SPE/IADC 2016)**: reference-framework for honest KPIs — four time references
  (Best of the Best, Best in Class, Technical Limit, Maximum Theoretical Performance) drawn as
  reference lines/bands; the workhorse chart is **depth-vs-days actual wells vs an MTP
  reference curve — buildable from one depth point per day, i.e. exactly DDR data**. Warns that
  ~90% "operational efficiency" can be ~25% true efficiency, and that **NPT% is a perverse KPI**
  (drilling faster with the same NPT hours *raises* NPT%; improving productive time beats
  chasing NPT).

---

## Ranked recommendations (evidence × implementability from per-run DDR data)

| # | Addition | Evidence | Implementability |
|---|----------|----------|------------------|
| 1 | **Parameter roadmap view** — per-formation/section recommended WOB/RPM(/flow) bands vs depth, mined from offset runs; benign vs dysfunction-prone zone flags | SLB commercial + SPE 2024 field-tested | High — direct aggregation of existing points |
| 2 | **Quantitative dull forensics** — wear rate (grade/hr, grade/100 m) via linear IADC scale; formation × bit-family wear heatmap; dull-characteristic Pareto; damage→dysfunction annotations | SPE/IADC 23939 + SPE/IADC 2022 forensics | High — fields already parsed server-side |
| 3 | **Break-even economics** — offset cost/m reference, required-ROP and required-footage break-even curves per candidate bit | PetroWiki/SPE canonical | High — all inputs present |
| 4 | **Formation strength view** — Bingham R/N vs W/D fits per formation; MSE-derived apparent UCS/CCS; UCS-band bit-suitability matrix | OGJ workflows + MSE≈3×CCS anchor | High — pure math on existing points |
| 5 | **MSE upgrades** — efficiency ratio (MSE vs 3×CCS), MSE-vs-DS cross-plot + MSE/DS bands, aggressiveness μ=36T/(dW) by bit make, limiter labels (founder vs energy-limited) | SPE 92194/102210 + 2017 MSE/DS | High–Medium — needs measured torque subset |
| 6 | **Benchmarking upgrades** — depth-vs-days vs best-composite/technical-limit curves; per-formation ROP percentile bands (P10–P90) | SPE 2016/2017 | High |
| 7 | **Constrained B&Y per-formation fit** — pruned terms, bounded search, relative-error reporting; response surface → recommended window | 45-study review + fit-failure literature | Medium — needs enough runs per formation |
| 8 | **Bit-type classifier** (optional) — RF with class weighting on per-run features incl. MSE/DOC/DBA/d-exp; G-mean metric | Energies 2021 (Volve, DDR-granularity) | Medium — worth it once data volume justifies |
| 9 | Bayesian multi-objective WOB/RPM recommendation (optional, offline flavor) | Energies 2022 field-tested | Medium–Low — published version is real-time |

**Cross-cutting caveats to encode in the UI:** (a) per-run averages support cross-run screening,
not intra-run dysfunction diagnosis (1–3 ft density finding); (b) most ROP limiters are not the
bit (40+ categories, 4 bit-related) — annotate, don't over-attribute; (c) NPT%-style ratios are
misleading KPIs; benchmark against composite/technical-limit references instead; (d) surface-
torque MSE overstates absolute MSE in deviated wells — trends are robust, absolute levels aren't.

## Source list

1. Dupriest & Koederitz, SPE/IADC 92194 (2005) — https://onepetro.org/SPEDC/proceedings-abstract/05DC/05DC/SPE-92194-MS/72603
2. Dupriest, SPE 102210 (2006) — https://onepetro.org/SPEATCE/proceedings-abstract/06ATCE/06ATCE/SPE-102210-MS/139869
3. ExxonMobil Fast Drill Process training deck (AADE) — https://www.aade.org/download_file/2943/263
4. Menand et al., AADE-17-NTCE-033, MSE for vibration & bit-wear detection — https://www.aade.org/application/files/7815/7132/1752/AADE-17-NTCE-033_-_Menand.pdf
5. MSE & Drilling Strength diagnostics paper (SPE, 2017-04) — MSE/DS bands, torque-source ranking, 1–3 ft density bound
6. Chen et al., new MSE model + ROP prediction (Arab J Sci Eng, 2014) — https://link.springer.com/article/10.1007/s13369-014-1376-0
7. Bourgoyne & Young constants via bounded search (2011, ×2 papers) — https://www.researchgate.net/publication/254353111
8. Invited ROP-modeling review, Advances in Geo-Energy Research 5(3) 2021 — https://www.yandy-ager.com/index.php/ager/article/download/330/pdf
9. Modified B&Y for carbonate loss zones, JPSE 205 (2021) — https://www.sciencedirect.com/science/article/pii/S0920410521006537
10. B&Y presalt case study (2015) — https://www.researchgate.net/publication/283954452
11. PetroWiki: Drill bit economics — https://petrowiki.spe.org/Drill_bit_economics
12. OGJ: Dull bit grading and rock strength analysis key to bit selection (1994) — https://www.ogj.com/home/article/17211206/
13. OGJ: Confined compressive strength analysis can improve PDC bit selection (1994) — https://www.ogj.com/home/article/17211527/
14. SPE/IADC 23939: IADC dull grading for PDC bits — https://www.bestebit.com/wp-content/uploads/2016/12/PDC-Dull-Grading.pdf
15. Bit calculations (aggressiveness μ = 36T/(W·D)) — https://www.bestebit.com/wp-content/uploads/2016/12/Bit-Calculations.pdf
16. IADC Code Upgrade: bit forensics workflow (SPE/IADC 2022) — https://www.researchgate.net/publication/358936617
17. SLB DrillOps parameter roadmap — https://www.slb.com/videos/drillops-performance-insightsdrilling-parameter-roadmap
18. Intelligent operating-parameter roadmap design (SPE 2024, Muscat) — https://onepetro.org/SPEOGWA/proceedings-abstract/24OPES/24OPES/D021S027R001/544474
19. SPE-187470: Multiwell operational performance benchmarking — https://onepetro.org/SPEIOGS/proceedings/17IOGC/All-17IOGC/SPE-187470-MS/194888
20. True Lies: measuring drilling & completion efficiency (SPE/IADC 2016) — https://onepetro.org/SPEDC/proceedings-abstract/16DC/16DC/D031S026R001/207852
21. Ensemble bit selection on Volve DDR data (Energies 14:432, 2021) — https://doi.org/10.3390/en14020432
22. Ensemble ROP prediction, southern Iraq (SPE WRM 2023) — https://onepetro.org/SPEWRM/proceedings-abstract/23WRM/23WRM/D021S004R007/519629
23. Constrained Bayesian drilling-parameter optimization (Energies 15:8030, 2022) — https://www.mdpi.com/1996-1073/15/21/8030
