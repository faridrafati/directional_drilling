# WellView report suite — status

Per-report checklist for reproducing the 30 sample reports in `Wellview/` from this app's own
database. Plan: [`wellview-tier0-tier1-plan.md`](wellview-tier0-tier1-plan.md).
Field inventory: [`../WELLVIEW_REPORT_SPEC.md`](../WELLVIEW_REPORT_SPEC.md).

A report is **done** only when the "verified" column is dated — meaning its PDF was generated from
seeded data, extracted with `scripts/pdf_text.mjs`, and compared section by section against the
sample and the spec.

Legend: `—` not started · `WIP` in progress · a date = finished on that date.

## Tier 0 — foundation

| Item | Status |
|---|---|
| Spec read (index, appendix, reports 01/02/03/06/07/10/11) | 2026-08-07 |
| Sample PDFs readable (`scripts/pdf_text.mjs`) | 2026-08-07 |
| Written Tier 0 + Tier 1 plan | 2026-08-07 |
| Code lookup tables + seed (21 letters · 33 details · 437 matrix cells · 5 indicators · 4 report codes · 10 phases) | 2026-08-07 |
| Job / JobPhase / JobPhasePlan / Afe / AfeSupplement / AfeLine / CostCode / CostItem | 2026-08-07 |
| `EntryWell` regulatory columns · `EntryReport`/`EntryTimeEntry`/`EntryOperation` bridges | 2026-08-07 |
| Job / AFE / cost API (`/entry/jobs*`, `/entry/cost-codes`, `/entry/wellview/codes`) | 2026-08-07 |
| Report-engine skeleton (`/entry/report-data/:type`, catalog page, `reportChrome.ts`) | 2026-08-07 |
| Shared Jalali comparator + Gregorian→Jalali (`packages/shared/src/jalali`, 22 tests) | 2026-08-07 |
| Demo seed (`scripts/seed-wellview-demo.mts`) | 2026-08-07 |
| Entry UI — Well Data workspace (Job, Phases, AFE & supplements, Cost sheet, Cost codes) | 2026-08-07 |

## Tier 1 — foundation

| Item | Status |
|---|---|
| `EntryWellbore` · `EntryMudPump` · the per-day and well-level event models | 2026-08-07 |
| Daily columns: weather / conditions / TVD / remarks, op codes and problem columns, mud-check cells, string weight, top thread, bit length, the parameter columns | 2026-08-07 |
| Entry UI — daily "Events & HSE" tab, extended operations log, contacts, personnel log | 2026-08-07 |
| Entry UI — Well registers panel (wellbores, mud pumps, lessons, kicks, lost circulation) | 2026-08-07 |
| `Col` gains a tri-state `bool` cell (Yes / No / unanswered) | 2026-08-07 |
| `EntryBhaRun` + `EntryBhaSensor` masters, bridged onto the daily string / bit / interval rows, with a backfill | 2026-08-07 |
| BHA runs derived automatically from the BHA number the daily save already carries | 2026-08-07 |
| Entry UI — BHA run facts and sensors in the Well registers panel | 2026-08-07 |

## Tier 1 — daily drilling

| # | Report | Spec read | Schema | Entry | Assembler | Preview | PDF | Verified |
|---|---|---|---|---|---|---|---|---|
| 06 | Daily Drilling | 2026-08-07 | 2026-08-07 | 2026-08-07 | 2026-08-07 | 2026-08-07 | 2026-08-07 | 2026-08-07 |
| 07 | Daily Drilling - Detail | 2026-08-07 | 2026-08-07 | 2026-08-07 | 2026-08-07 | 2026-08-07 | 2026-08-07 | 2026-08-07 |
| 02 | BHA Detail | 2026-08-07 | 2026-08-07 | 2026-08-07 | 2026-08-07 | 2026-08-07 | 2026-08-07 | 2026-08-07 |
| 03 | Bit Summary | 2026-08-07 | 2026-08-07 | 2026-08-07 | 2026-08-07 | 2026-08-07 | 2026-08-07 | 2026-08-07 |

## Tier 2 — foundation

| Item | Status |
|---|---|
| `HoleSection` · `CasingString` · `CasingComponent` · `CementJob` · `CementStage` · `CementFluid` · `CementFluidAdditive` | 2026-08-07 |
| `EntryCasingRun.casingStringId` — the daily run bridged onto the string master | 2026-08-07 |
| `EntryWellheadComponent.model` / `.sn` — report 04 prints both beside the make | 2026-08-07 |
| Casing / cement API (`GET`+`PUT /entry/wells/:id/casing`, `GET …/casing-strings`) | 2026-08-07 |
| Entry UI — Casing & cement panel (hole sections, strings, tallies, cement jobs → stages → fluids → additives) | 2026-08-07 |
| Entry UI — wellhead Model and SN columns on the daily sheet | 2026-08-07 |
| E2E — a casing string, its tally and its cement typed entirely by hand, then printed | 2026-08-07 |
| `WellPlanStation` — the directional plan, separate from the daily surveys | 2026-08-08 |
| `EntryWell.area` / `.county` / `.ewDistance` / `.ewRef` / `.nsDistance` / `.nsRef` — report 09's band | 2026-08-08 |
| Entry UI — the WellView header band on the well form (it was seeded but un-typeable) | 2026-08-08 |
| Entry UI — Directional plan table in the Well registers panel | 2026-08-08 |
| `chartCapture.ts` — the capture-or-throw rule shared by every charted report | 2026-08-08 |

## Tier 2 — well engineering

| # | Report | Spec read | Schema | Entry | Assembler | Preview | PDF | Verified |
|---|---|---|---|---|---|---|---|---|
| 04 | Casing, Liner and Cement | 2026-08-07 | 2026-08-07 | 2026-08-07 | 2026-08-07 | 2026-08-07 | 2026-08-07 | 2026-08-07 |
| 05 | Casing Summary | 2026-08-07 | 2026-08-07 | 2026-08-07 | 2026-08-07 | 2026-08-07 | 2026-08-07 | 2026-08-07 |
| 08 | Directional Plot | 2026-08-08 | 2026-08-08 | 2026-08-08 | 2026-08-08 | 2026-08-08 | 2026-08-08 | 2026-08-08 |
| 09 | Drilling Summary 1 | 2026-08-08 | 2026-08-08 | 2026-08-08 | 2026-08-08 | 2026-08-08 | 2026-08-08 | 2026-08-08 |
| 10 | Phases - Plan vs Actual | 2026-08-07 | 2026-08-07 | 2026-08-07 | 2026-08-07 | 2026-08-07 | 2026-08-07 | 2026-08-07 |
| 11 | Phase Summary Graph | 2026-08-07 | 2026-08-07 | 2026-08-07 | 2026-08-07 | 2026-08-07 | 2026-08-07 | 2026-08-07 |

## Tier 3 — cost & multi-well

| # | Report | Spec read | Schema | Entry | Assembler | Preview | PDF | Verified |
|---|---|---|---|---|---|---|---|---|
| 01 | AFE vs Field Est vs Final Invoice | 2026-08-07 | 2026-08-07 | 2026-08-07 | 2026-08-07 | 2026-08-07 | 2026-08-07 | 2026-08-07 |
| 12 | Multi-well Daily Drilling Summary 2 | — | — | — | — | — | — | — |
| 13 | Multi-well Drilling KPIs (XLSX) | — | — | — | — | — | — | — |
| 14 | Multi-well Drilling Offsets | — | — | — | — | — | — | — |
| 15 | Problem Cost by Accountable Party | — | — | — | — | — | — | — |
| 16 | Multi-well Phase Summary Pivot (XLSX) | — | — | — | — | — | — | — |
| 17 | Multi-well Safety Incidents | — | — | — | — | — | — | — |

## Tier 4 — geology

| # | Report | Spec read | Schema | Entry | Assembler | Preview | PDF | Verified |
|---|---|---|---|---|---|---|---|---|
| 18 | Daily Geological | — | — | — | — | — | — | — |
| 19 | Formation Performance | — | — | — | — | — | — | — |
| 20 | Geological Program | — | — | — | — | — | — | — |
| 21 | Geological Schematic | — | — | — | — | — | — | — |

## Tier 5 — completion & production

| # | Report | Spec read | Schema | Entry | Assembler | Preview | PDF | Verified |
|---|---|---|---|---|---|---|---|---|
| 22 | Complete Well Summary | — | — | — | — | — | — | — |
| 23 | Daily Completion and Workover | — | — | — | — | — | — | — |
| 24 | Downhole Well Profile | — | — | — | — | — | — | — |
| 25 | Cost of Failure by Type | — | — | — | — | — | — | — |
| 26 | Perforations | — | — | — | — | — | — | — |
| 27 | Production & Maintenance History | — | — | — | — | — | — | — |
| 28 | Schematic - Current | — | — | — | — | — | — | — |
| 29 | Schematic - Proposed vs Actual | — | — | — | — | — | — | — |
| 30 | Well Summary | — | — | — | — | — | — | — |

## Decisions and known deviations

Recorded as they are made, with the reason. "PDF wins" is the tie-break rule when the spec text and
the sample disagree; where both are ambiguous, the closest existing `a.json` / DR.xls field name wins.

- **2026-08-07 — units.** The samples are US-unit (ftKB, ft, bbl, °F). We reproduce the label *text*
  and the column order and swap the unit token (`ftKB → mKB`, `ft → m`, `Cost/ft → Cost/m`), the same
  way `DrReportForm.tsx` already relabels the archive. No numeric conversion is performed anywhere.
- **2026-08-07 — dates.** Printed as stored, in Jalali. Report headers that print a US date in the
  sample (`2000-02-21 00:00`) print the Jalali string instead.
- **2026-08-07 — cost codes ship empty.** Report 01's 1200/1210 … 7000/7602 are Peloton demo
  accounts. Seeding them would put fictional accounts in front of finance; the sample rows exist only
  as a dev fixture for the report-01 layout test.
- **2026-08-07 — `WvReportCode` is separate from `WvTimeIndicator`.** The one-page sheet's P/N/T/U
  and the procedure's P/U/T/X/N share letters with different meanings (spec errata 5); merging them
  would silently mis-classify time.
- **2026-08-07 — matrix errata.** Row A column 9 is seeded as valid (the source prints "A4"; column 4
  is blank for row A — spec errata 3). Letter U has no matrix row (errata 4). Detail 33 has no matrix
  column (errata 2). Detail numbering follows the matrix and code sheet, not procedure §6's off-by-one
  headings (errata 1).
- **2026-08-07 — the vendor logo is not reproduced.** The samples carry the Peloton logo and
  `www.peloton.com` in the footer. Ours prints neither.
- **2026-08-07 — one migration, not four.** The plan listed the Tier 0 schema as four migrations for
  auditability. Prisma generates from a schema diff, so it landed as a single additive migration
  (`20260807061421_wellview_tier0_job_cost_spine`). Its SQL was read before applying: plain
  `ADD COLUMN` for `EntryOperation` and `EntryWell`, `CREATE TABLE` for the new models, and Prisma's
  standard SQLite table-redefine for `EntryReport` and `EntryTimeEntry`. Verified against the
  populated `dev.db`: row counts unchanged, `PRAGMA foreign_key_check` clean.
- **2026-08-07 — report 01 verified against the sample.** The demo seed carries the sample's own 29
  cost lines. The generated PDF was extracted with `scripts/pdf_text.mjs` and compared to the
  extracted sample: all 29 rows identical (description, both codes, all five money columns), and all
  four totals match — 10,218,000.00 / 125,000.00 / 10,127,291.47 / 215,708.53.
- **2026-08-07 — money cells declare their format.** Header cells carry a `kind`
  (`money` / `decimal` / `int`). Deciding by `Number.isInteger` printed the sample's
  "10,218,000.00" as "10,218,000" purely because that total is round.
- **2026-08-07 — the cost codes live beside the job sheet, not inside it.** They are a
  company-wide chart of accounts, and nesting them under a job made them unreachable until a job
  existed — which is backwards, since a cost line cannot be typed before its code exists.
- **2026-08-07 — entry labels are associated, not just styled.** `TextField` / `NumField` now render
  a real `<label htmlFor>`, and the well/job pickers use `htmlFor` rather than wrapping their
  `<select>` (a wrapping label folds the selected option into the field's accessible name, so the
  well picker announced as "Well Dehloran-099 — PDX-555").
- **2026-08-07 — E2E runs with one worker.** Every spec drives the same database through the UI;
  two in parallel let one test's job appear inside another's assertions.
- **2026-08-07 — reports 06 and 07 share one assembler.** 07 is 06 plus its detail sections, and the
  two print the same time log with the same durations; separate assemblers would eventually disagree
  about a rounding rule. `detail: true` is what switches the extra sections on.
- **2026-08-07 — an interval with equal start and end times contributes NO duration.** The archive
  writes 00:00→00:00 when the clock was never filled in, and printing 0.00 there would make the day
  look accounted for when it is not. Same rule the DDR viewer already applies.
- **2026-08-07 — report 07 runs to three pages where the sample runs to two.** The layout, section
  order and page-break behaviour are the sample's (headers repeat, the problems/lessons/incidents
  block starts a fresh page), but the demo day fills every section — including the lost-circulation
  table, which is empty in the sample — so the body is genuinely longer. Report 06 fits one page, as
  the sample does.
- **2026-08-07 — "Prob Ref #" is an ordinal, not a foreign key.** The daily save replaces child rows
  wholesale, so every save mints new ids and a real reference would dangle. The number the report
  prints is the 1-based position of the row in the day's Interval Problems table.
- **2026-08-07 — the day's cost comes from the job's `CostItem` rows, sliced by `costDate`.** There
  is no second per-day cost table; report 06's Day Total and report 01's Job Cost Summary add up the
  same rows.
- **2026-08-07 — a BHA run is derived, not created by hand.** The crew already types a BHA number on
  the drill-strings tab every morning, so the daily save upserts one `EntryBhaRun` per
  (well, BHA number) and points that day's string, its bit and its drilled intervals at it. The run
  master stays thin: only what no day can know — where the assembly came out and when, its sensors,
  the run comment — is typed in the Well registers panel. A migration backfilled the runs that
  existed as day slices before this.
- **2026-08-07 — a drilled interval is attributed to a run only on a single-string day.** With two
  assemblies in one day the daily rows do not record which was in the hole for a given interval, and
  guessing would put another assembly's parameters in report 02's ranges.
- **2026-08-07 — report 02's schematic is not drawn.** The sample prints a vertical wellbore
  schematic down its left rail. The shared schematic component is a Tier 4/5 deliverable, so both
  the preview and the PDF say so in place of it rather than leaving a silent gap.
- **2026-08-07 — component mass is stored in kg/m, not lb/ft.** The samples print lb/ft, but the
  lengths beside it are metres; mixing the two silently scales a string weight by 3.28.
- **2026-08-07 — cumulative columns accumulate UNROUNDED values.** Report 10's own sample settles it:
  its eight per-phase durations printed to 2 dp add to 25.47, but its last cumulative cell reads
  25.46 — which is what rounding the true sum gives. Every running total in the suite now follows
  that rule, and a totals row reads the last cumulative cell rather than re-summing the rounded
  column, so the two can never disagree.
- **2026-08-07 — report 10's planned series get their own day axis.** The planned depth and cost are
  plotted against PLANNED cumulative days, the actuals against elapsed days, over one shared range.
  Sharing a single axis silently drew the plan at the actual's positions, which makes a late job look
  on schedule.
- **2026-08-07 — charts are captured from the live Recharts surface.** Reports 10 and 11 rasterize
  the very SVG on screen through `svgRaster.ts`, the pattern the directional-plot export set, and
  throw a user-facing error rather than printing a blank panel when the chart is not mounted. Their
  legends are read off the DOM and redrawn as vectors, so the printed key names the series the chart
  actually has.
- **2026-08-07 — report 11 labels its bars with the phase's SECOND type.** "Drill-Vertical", not
  "Production · Drill-Vertical" — the pair does not fit on the axis, which is why the sample does the
  same. The full name is in the tooltip and in report 10's table.
- **2026-08-07 — a casing string is a MASTER, and the daily run points at it.** `EntryCasingRun` (the
  day's "we ran casing" row) keeps its own columns and gains a nullable `casingStringId`. The string,
  its tally, its hole section and its cement live at well level because they outlive the day: the
  cement is pumped the next shift and the plug is drilled out three days later. The link is
  `onDelete: SetNull`, so deleting a string never deletes the day that ran it.
- **2026-08-07 — the casing sheet saves id-stable at the string level, replace-all below it.** A
  daily run row carries `casingStringId`, so re-minting string ids each save would silently unlink
  the day the string was run. Nothing points into a tally row, a cement stage, a fluid or an
  additive, so inside a string they are deleted and re-created exactly like a daily child table.
- **2026-08-07 — report 05 prints a Joints / String Length roll-up the sample does not have.** The
  sample ends each string at its last tally row. Ours adds one labelled summary line, summed from the
  tally rather than read from the set depth — on the demo string those differ by 0.02 m, which is
  exactly the kind of tally error the line is there to expose.
- **2026-08-07 — "Vol Cement" is derived when it is left blank.** WellView prints the stored figure,
  including `0.0`. Ours prints what was typed when something was, and otherwise adds up the fluids'
  pumped volumes — a stage whose ticket did not state a total still prints one, and the entry panel
  says so.
- **2026-08-07 — report 04's "Last Mud Check" is the newest check ON OR BEFORE the run date**, not
  the newest on the well. A cement job is judged against the mud it was pumped through.
- **2026-08-07 — inch diameters print to three decimals (`kind: "in3"`).** A casing ID and a drift are
  quoted to a thousandth: the sample prints 12.415, and the suite's usual two decimals turned that
  into 12.42 — the digit a drift check actually turns on.
- **2026-08-07 — cement yield is stored and printed in L/sack, not m³/sack.** A class G slurry yields
  about 0.033 m³/sack, which at the suite's two decimals printed as "0.03" — a 10% error on the figure
  a slurry volume is calculated from. Renamed rather than deprecated because the column was
  introduced by the migration immediately before, so no database outside the demo seed ever held a
  value under the old name.
- **2026-08-07 — the header grid honours the cell's own `kind`.** It was calling `headerValue(value)`
  without it, so every whole-number header — a tally's joint count, a daily report number — printed
  as "8.00". The PDF renderer had been passing it all along; only the on-screen preview dropped it.
- **2026-08-07 — the tally's "Item Des" column is fixed-width, not flexible.** As the flex column it
  was squeezed to about 52 pt by the eleven fixed ones and every "Casing Joint(s)" wrapped onto a
  second line the sample does not have. The slack now comes out of P Collapse.
- **2026-08-07 — report 04's schematic is not drawn**, for the same reason as report 02's: the shared
  wellbore schematic is a Tier 4/5 deliverable. Both the preview and the PDF say so where the
  sample's left rail would be.
- **2026-08-07 — report 04 runs to two pages where the sample runs to one.** The sample puts the
  schematic down the left rail and the data blocks in a narrow right column; ours prints the blocks
  full width, and the demo cement job has two fluids and three additives where the sample has one of
  each. Block order and labels are the sample's.
- **2026-08-07 — a wellhead component's size prints as a decimal (`20.75"`), not a fraction
  (`20-3/4"`).** `EntryWellheadComponent.sizeIn` is a `Float` inherited from `a.json`, and the rule
  for this work is that existing `Entry*` models are never restructured. The new columns beside it —
  `model` and `sn` — are additive, because report 04 prints both and the archive simply never carried
  them.
- **2026-08-08 — the directional PLAN is its own table, not more survey rows.** `EntrySurvey` belongs
  to the day it was shot and is replaced wholesale when that day is re-saved; the plan is issued once
  for the well by the directional company and does not move when a day does. Merging them would make
  "plan vs actual" impossible to state. Report 08 draws one curve from each.
- **2026-08-08 — NS / EW / VS are printed as ENTERED, never re-derived.** Report 08 does not run a
  minimum-curvature closure over inc/azi to fill in missing offsets. The directional company's own
  listing is what the well is steered against, and a second, silently different set of offsets
  computed here would be indefensible the moment the two disagreed. A station without the offset a
  panel needs is dropped from that panel; the curve breaks where the data does.
- **2026-08-08 — each curve gets its own Recharts `data` array.** A merged array needs one X key,
  and the plan and the actual do not share X values — interleaving them into rows where each series
  fills only its own keys left every row missing the other series' axis key, and one curve silently
  vanished. This was caught by screenshotting the panel, not by the type checker.
- **2026-08-08 — plot legends sit ABOVE their axes.** Recharts positions an `insideBottom` axis label
  against the chart box rather than the plot area, so a bottom legend and "VS (m)" print on the same
  line whatever height is reserved for the key.
- **2026-08-08 — report 08 prints a station listing the sample does not have.** The sample is plots
  only. The listing is on its own page (a 200-station survey must never push the plots off theirs)
  and it is what makes the plots auditable — a reader can check a point rather than measure it off a
  rasterized axis.
- **2026-08-08 — report 09 reads the OPERATIONS LOG, not the Time Breakdown table.** The breakdown
  table is optional and usually empty; the from/to clock is the one that is actually kept. A
  dashboard built on the breakdown table printed four blank panels for a job whose every hour is
  logged.
- **2026-08-08 — report 09's NPT hours come from the log's `probHr`, its NAMES from the problem
  register.** The first is the clock; `estLostTimeHr` is an estimate typed before the trouble was
  over. The interval points at its problem row by the same 1-based ordinal report 07 prints.
- **2026-08-08 — panels 1 and 3 share one denominator: the job's total logged hours.** Each panel's
  own subtotal would let the two read as if they described different jobs, and NPT — a slice of the
  same clock — would come out as a share of itself.
- **2026-08-08 — report 09 prints each panel's figures beside its bars.** A bar chart answers "which
  is biggest"; a morning meeting also asks "by how much", and reading a percentage off a rasterized
  axis is guesswork. Both come from one payload, so they cannot disagree. It is why the report runs
  to two pages where the sample runs to one — that, and the sample's narrow right column.
- **2026-08-08 — report 09's panels rasterize at 1.5×, not 2×.** They print side by side at about
  half the page width, so 2× was resolution nobody could see, and the four rasters together took the
  export past thirty seconds.
- **2026-08-08 — a spanned header cell is N star columns merged with `colSpan`.** pdfmake's table
  widths understand `"*"` and numbers only; the weighted `"2*"` that `labelValueGrid` used to emit
  reached its number parser as a literal string and threw "unsupported number: 25.52*6.500" from
  deep inside the layout engine, naming nothing. Report 09's header was the first to use a span.
- **2026-08-08 — the well form gained the WellView header band.** `apiUwi`, `licenseNo`,
  `stateProvince`, the four elevations and now `area` / `county` / the surface offsets were added
  with the Tier 0 schema and seeded, but there was nowhere to TYPE them: the form stopped at the
  DR.xls fields. Every report in the suite prints that band.
- **2026-08-08 — the demo well now carries twelve days, not one.** Report 09's panels are job-wide,
  and one showcase day gives them a single bar and a single point. The eleven added days are
  deliberately thin — a depth, a coded log that sums to 24 hours, a problem on two of them. Day-scoped
  specs therefore NAME the day they mean; the picker defaults to whichever day the list starts with.
- **2026-08-08 — the demo day's operation letters were wrong and are fixed.** Every interval was
  stamped "G" (Casing/Liner Job) because nothing grouped by letter. Report 09's time panel does, and
  a whole day under one letter is not a breakdown. Letters now follow what the interval was doing;
  lost time keeps the letter of the operation in progress and takes the U indicator, which is what
  the OIEC procedure asks for.
- **2026-08-08 — reports 08 and 09 have no wellbore schematic.** Both samples draw one — 08 down the
  left rail, 09 down the left column. Same reason as 02 and 04: the shared component is a Tier 4/5
  deliverable, and both the preview and the PDF say so where it would be.
- **2026-08-07 — pre-existing test failures, not caused by this work.** `@dd/grd`'s four `parseGrd`
  tests and the two older E2E specs (`happy-path`, `mobile-smoke`, which still expect `/` to land on
  `/projects` — the app has redirected to `/ddr` since before this branch) fail on `main` too.
