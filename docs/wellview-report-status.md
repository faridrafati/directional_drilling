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
| Code lookup tables + seed (21 letters · 33 details · 437 matrix cells · 5 indicators · 4 report codes · 10 phases) | — |
| Job / JobPhase / JobPhasePlan / Afe / AfeSupplement / AfeLine / CostCode / CostItem | — |
| `EntryWell` regulatory columns · `EntryReport`/`EntryTimeEntry`/`EntryOperation` bridges | — |
| Entry UI — Well Data workspace (Jobs & Phases, AFE & Costs) | — |
| Report-engine skeleton (`/entry/report-data/:type`, catalog page, `reportChrome.ts`) | — |

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
| 01 | AFE vs Field Est vs Final Invoice | 2026-08-07 | — | — | — | — | — | — |
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
