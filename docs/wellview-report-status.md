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

## Tier 1 — daily drilling

| # | Report | Spec read | Schema | Entry | Assembler | Preview | PDF | Verified |
|---|---|---|---|---|---|---|---|---|
| 06 | Daily Drilling | 2026-08-07 | — | — | — | — | — | — |
| 07 | Daily Drilling - Detail | 2026-08-07 | — | — | — | — | — | — |
| 02 | BHA Detail | 2026-08-07 | — | — | — | — | — | — |
| 03 | Bit Summary | 2026-08-07 | — | — | — | — | — | — |

## Tier 2 — well engineering

| # | Report | Spec read | Schema | Entry | Assembler | Preview | PDF | Verified |
|---|---|---|---|---|---|---|---|---|
| 04 | Casing, Liner and Cement | — | — | — | — | — | — | — |
| 05 | Casing Summary | — | — | — | — | — | — | — |
| 08 | Directional Plot | — | n/a | n/a | — | exists | exists | — |
| 09 | Drilling Summary 1 | — | — | — | — | — | — | — |
| 10 | Phases - Plan vs Actual | 2026-08-07 | — | — | — | — | — | — |
| 11 | Phase Summary Graph | 2026-08-07 | — | — | — | — | — | — |

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
- **2026-08-07 — pre-existing test failures, not caused by this work.** `@dd/grd`'s four `parseGrd`
  tests and the two older E2E specs (`happy-path`, `mobile-smoke`, which still expect `/` to land on
  `/projects` — the app has redirected to `/ddr` since before this branch) fail on `main` too.
