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

## Tier 3 — foundation

| Item | Status |
|---|---|
| `EntrySafetyIncident.com` — the narrative report 17 is essentially made of | 2026-08-08 |
| Multi-well spine (`resolveWells`, `WellRef`, the shared well-set block) | 2026-08-08 |
| Multi-well API (`?wellIds=` comma list, `?from=`/`?to=` inclusive Jalali range) | 2026-08-08 |
| Reports page — well-set picker and the date-range inputs | 2026-08-08 |
| Entry UI — incident Com column and the sample's own category list | 2026-08-08 |
| XLSX export path for the suite (`export/wellview/pivots.ts`), Excel button on `ReportPanel` | 2026-08-08 |
| `WellRef.wellType` — report 16's filter block names it | 2026-08-08 |
| `asOf` report param, distinct from `dateRange` — a cap, not a window | 2026-08-08 |
| Demo seed — a second, faster, shallower OFFSET well with its own days and mud programme | 2026-08-08 |

## Tier 3 — cost & multi-well

| # | Report | Spec read | Schema | Entry | Assembler | Preview | PDF | Verified |
|---|---|---|---|---|---|---|---|---|
| 01 | AFE vs Field Est vs Final Invoice | 2026-08-07 | 2026-08-07 | 2026-08-07 | 2026-08-07 | 2026-08-07 | 2026-08-07 | 2026-08-07 |
| 12 | Multi-well Daily Drilling Summary 2 | 2026-08-08 | n/a | n/a | 2026-08-08 | 2026-08-08 | 2026-08-08 | 2026-08-08 |
| 13 | Multi-well Drilling KPIs (XLSX) | 2026-08-08 | n/a | n/a | 2026-08-08 | 2026-08-08 | 2026-08-08 | 2026-08-08 |
| 14 | Multi-well Drilling Offsets | 2026-08-08 | n/a | n/a | 2026-08-08 | 2026-08-08 | 2026-08-08 | 2026-08-08 |
| 15 | Problem Cost by Accountable Party | 2026-08-08 | 2026-08-08 | 2026-08-08 | 2026-08-08 | 2026-08-08 | 2026-08-08 | 2026-08-08 |
| 16 | Multi-well Phase Summary Pivot (XLSX) | 2026-08-08 | n/a | n/a | 2026-08-08 | 2026-08-08 | 2026-08-08 | 2026-08-08 |
| 17 | Multi-well Safety Incidents | 2026-08-08 | 2026-08-08 | 2026-08-08 | 2026-08-08 | 2026-08-08 | 2026-08-08 | 2026-08-08 |

## Tier 4 — foundation

| Item | Status |
|---|---|
| `WellFormation` — the register, prognosis AND actual side by side | 2026-08-09 |
| `GeoSamplingRequirement` · `JobContact` | 2026-08-09 |
| `EntrySampleDescription` · `EntryLithology` · `EntryShow` · `EntryLogRun` | 2026-08-09 |
| `EntryReport` — four gas kinds (avg + max) and the geologist's three narrative fields | 2026-08-09 |
| Geology API (`GET`+`PUT /entry/wells/:id/geology`); contacts ride the job save | 2026-08-09 |
| Entry UI — well-level Geology panel (formation register in three bands, sampling requirements) | 2026-08-09 |
| Entry UI — daily Geology tab (gas, narrative, samples, lithology, shows, log runs) | 2026-08-09 |
| Entry UI — job Contacts tab | 2026-08-09 |

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
- **2026-08-08 — a multi-well report filters the well set, it does not 403.** Asking for ten wells
  and being allowed six is a normal answer to "summarize my wells", and refusing the whole request
  because one id was stale would be useless. The payload reports how many were dropped and the page
  says so in amber — a silently shorter report is a wrong report.
- **2026-08-08 — an empty well set means EVERY well the account may use.** That is what a company man
  opening a cross-well summary almost always wants, and it means the page has something to show
  before anything is ticked. The picker draws every box ticked in that state, so unticking one means
  "all except this one"; ticking the last one back collapses the set to empty again, so "all" stays
  one state rather than two that print the same report.
- **2026-08-08 — the multi-well date filter is INCLUSIVE at both ends.** Not `jalaliInRange`, whose
  end bound is exclusive — right for a phase whose interval runs up to the next one's start, wrong
  for a filter somebody typed. It also keeps a row whose date will not parse: a safety log that
  silently hides a badly-typed row is worse than one that shows it.
- **2026-08-08 — report 15's stack key is "Type - Sub Type", with the blank printed.** The sample
  stacks "Rig Failure -(blank)" beside "Hole Trouble -Tight Hole". A problem with no sub-type is a
  different bar from one with a sub-type, and collapsing them would understate one of them.
- **2026-08-08 — report 17 prints an unanswered "Lost time?" as blank, and counts it.** Folding it
  into "No" would make a gap in the record look like an answer. The totals row names the count.
- **2026-08-08 — report 17's "Type" prefers `type` over `category`.** The sample has two levels where
  we store three; `category` carries the values matching its Type column ("Near Miss", "First Aid"),
  and `type` is the more specific middle level, so it wins where it is filled.
- **2026-08-08 — `EntrySafetyIncident.com` was missing and is the report.** The other eight columns
  are how you find the row; this is what happened. The daily incident grid gained it, along with the
  sample's own category values.
- **2026-08-08 — reports 13 and 16 need no new schema: "n/a" in their Schema and Entry columns.**
  Both are pure derivations — 13 adds up the job cost sheet, the daily operations log and the daily
  personnel log; 16 measures the phase spine reports 10 and 11 already print. Nothing new is typed
  for either.
- **2026-08-08 — a spreadsheet holds NUMBERS, not formatted strings.** A cell containing
  "10,218,000.00" cannot be summed, sorted or charted, which is the only reason to want the file.
  The thousands separators and two decimals are a cell number format (`z`), so Excel shows what the
  page shows while the value stays a number. Verified by reading the generated file back with
  `cellNF: true`: all 22 numeric cells in 13 and all 46 in 16 carry their format.
- **2026-08-08 — a blank stays blank in the sheet too.** `null` is written as `undefined`, which
  SheetJS leaves genuinely empty; writing 0 would turn "not recorded" into a measurement. The demo's
  second well has no job and no days, and its whole row is empty in both the PDF and the XLSX.
- **2026-08-08 — the Grand Total re-derives its ratios, it does not average the column.** Averaging
  Cost/Depth or ROP down the column weights a three-day well the same as a thirty-day one, which is
  how a fleet ROP comes out faster than every rig in it. The total's ratios come from the summed
  numerator over the summed denominator.
- **2026-08-08 — the pivot filter block prints the SET'S values, not "(All)".** WellView prints
  "(All)" for any dimension nobody filtered on. We print the distinct values the selected wells
  actually carry and fall back to "(All)" only when there is genuinely more than one:
  "State/Province: Bushehr" tells a reader what is in front of them, "(All)" tells them nothing.
  A dimension with nothing recorded prints blank, which is a third statement again.
- **2026-08-08 — report 16's StdDev is the POPULATION deviation, and blank for a single phase.** The
  rows are every phase of that kind that was drilled, not a sample drawn from a larger set, and the
  sample's own StdDev for a three-value group matches ÷ n. A one-phase group prints blank rather than
  0.00, which would read as "they were all the same" — a claim one observation cannot support.
- **2026-08-08 — report 16's Count is how many phases were MEASURED.** A phase missing either
  datetime has no duration and is not counted, rather than counted as zero days — which would drag
  Avg toward a number nobody observed.
- **2026-08-08 — the two pivots cross-check the reports built before them.** 13's AFE+Supp, Field Est
  and variance reproduce report 01's four totals by a different route, and 16's phase-duration Sum of
  25.46 days is the very figure report 10's last cumulative cell prints. Both are asserted in the E2E
  specs, so a change that breaks one of the pair fails loudly.
- **2026-08-08 — report 12 shows each well's LATEST day, not one shared date.** The sample settles
  it: its three blocks are dated 2002-04-14, 2001-06-27 and 2001-06-28 — three wells whose campaigns
  did not overlap at all. A fleet summary answers "where is each of my wells", and a well that filed
  nothing yesterday still has a last known position.
- **2026-08-08 — `asOf` is a separate report param from `dateRange`.** A range is a window rows are
  filtered into; "as of" is a cap on which day gets chosen. Report 12 has no meaning for a lower
  bound, and sharing the param would have rendered a From box the report ignores.
- **2026-08-08 — a well with no day gets a block that SAYS so.** An absent well reads as nothing; a
  present one reads as "not drilling". The difference matters when the list is what you check
  against at a morning meeting.
- **2026-08-08 — report 12 prints "Days From Spud" even when it comes out NEGATIVE.** One demo well
  has a legacy-imported day that predates its spud date, and the block prints −368.00. That is what
  the data says, and hiding it would hide the inconsistency rather than the symptom. Same doctrine as
  everywhere else in the suite: store what is entered, derive what is printed.
- **2026-08-08 — "ahead" is PLANNED minus ACTUAL.** A positive Phase/Job Days Ahead means ahead of
  schedule, which is the only reading of the word that does not need a footnote beside it.
- **2026-08-08 — report 14's two day axes are different MEASUREMENTS, not one derived from the
  other.** "Actual days" counts from a well's first filed report; "days from spud" counts from its
  spud date. They diverge by exactly as long as the rig sat on location, and the sample plots both
  because the first flatters a well that was late to spud. A well with no spud date has no series on
  the second plot rather than a guessed one.
- **2026-08-08 — an offset plot's colour is keyed on the WELL, not on the series' position.** A well
  missing from one plot would otherwise shift every colour after it, and the same well would be blue
  on one page and orange on the next.
- **2026-08-08 — a plot with nothing to draw is not captured.** It prints its reason instead.
  Demanding an SVG for every plot would fail the whole five-page export over a well that merely has
  no mud checks.
- **2026-08-08 — the demo seed gained a second well.** Report 14 compares wells against each other,
  and an offset curve against nothing is not a comparison. "Sample 12 - Offset" is deliberately
  thinner than the showcase well — a spud date, a job with dated cost lines and phases, and twelve
  days carrying depth and a mud check — because that is what an offset actually looks like in the
  database. It is drilled faster and shallower so the curves separate, and it spudded four days
  after the rig arrived so the two day axes genuinely differ.
- **2026-08-09 — a formation's PROGNOSIS and its ACTUAL are separate columns.** Report 19 exists to
  print them against each other, and a predicted top overwritten the moment it is drilled cannot be
  compared with anything. The entry grid is split into three labelled bands over the SAME rows —
  identity, prognosis, as-drilled — so a geologist filling in a prognosis before spud is not walking
  past twelve columns they cannot answer yet.
- **2026-08-09 — the formation register is WELL-level; `EntryFormationTop` stays per-day.** The
  register is what a geologist maintains from the prognosis onward and what reports 18–21 read; the
  daily row is the note a driller makes when a top comes in on their shift. Both are real, and they
  are not the same record.
- **2026-08-09 — oil and gas shows share one table with a `kind`.** The sample prints two blocks, but
  every column except the gas readings is common to both, and two tables would need every query and
  every entry grid twice over — and would make a geologist choose which grid to open before they know
  what they have.
- **2026-08-09 — the day's gas is four KINDS, each with an average and a maximum.** A 2% background
  with a 40% connection peak is a different well from one reading 2% flat, and one "gas" column
  cannot say which you have.
- **2026-08-09 — the geologist's narrative is separate from the driller's.** `description`,
  `opsAtReportTime` and `opsNextPeriod` stay where they are; report 18 prints only
  `geoActivityAtReportTime`, `geoOpsThisPeriod` and `geoOpsNextPeriod`. They are written by different
  people about different things, which is also why the daily editor gives geology its own tab.
- **2026-08-09 — `EntryReport.lithologyLog` is not `EntryReport.lithology`.** The latter already
  exists as the day's free-text summary a driller types; the new relation is the mud logger's
  interval-by-interval log, and report 21 draws its lithology track from it. Prisma refusing the
  duplicate name is what surfaced the distinction.
- **2026-08-09 — KNOWN LIMITATION: one mud check per day.** `EntryMud` is `@unique` on `reportId`,
  and report 18's sample prints TWO checks on its day. Widening it to a one-to-many is a
  restructuring of an existing `Entry*` model, which this work does not do; report 18 prints the
  day's single check. Worth revisiting — a rig commonly runs a morning and an evening check.
- **2026-08-07 — pre-existing test failures, not caused by this work.** `@dd/grd`'s four `parseGrd`
  tests and the two older E2E specs (`happy-path`, `mobile-smoke`, which still expect `/` to land on
  `/projects` — the app has redirected to `/ddr` since before this branch) fail on `main` too.
