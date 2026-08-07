# Prompt for Claude Code (Opus 5) — WellView Report Suite

Copy everything below this line into a fresh Claude Code session started in
`/home/farid/directional_drilling`.

---

## Mission

The folder `Wellview/` contains 30 sample report PDFs produced by Peloton WellView
(`01_AFEvsFieldEstvsFinalInvoice.pdf` … `30_WellSummary.pdf`). This app must be able to
generate every one of these reports from **its own database** (the Prisma/SQLite entry DB —
not the read-only legacy archive). Your job, end to end:

1. **Extend the database** (Prisma schema + migrations + zod schemas + seeds) so every data
   element printed on those 30 reports has a home.
2. **Extend the DDR entry surface** (rig-side entry UI + `/entry/*` API) so users can enter
   all of that data — well-level master data and daily data.
3. **Build the report show/generation surface**: an on-screen preview and a pdfmake PDF
   export for each of the 30 reports, faithful to the sample layouts, plus the well/date/job
   pickers needed to parameterize them.

This is a large, multi-week-scale feature. Work in the tiers defined below; finish and
verify each tier before starting the next. Do not attempt all 30 reports in one pass.

## Required reading — do this before writing any code

1. **`WELLVIEW_REPORT_SPEC.md`** (repo root) — the authoritative field-level inventory of
   all 30 reports, extracted section-by-section from the PDFs. It opens with an
   **Entity → report index** table (which reports need which data entity) and ends with an
   appendix defining the operation/time-code system (activity letters A–U, detail codes
   01–33, P/U/T/X/N indicators, the 10 working phases, and the validity matrix). Read the
   index, the appendix, and the per-report spec of whichever report you are currently
   implementing. Re-read the relevant report spec every time you start a new report.
2. **The sample PDF itself** for the report you are implementing (`Wellview/NN_*.pdf`, use
   the Read tool with `pages`). The spec is the field inventory; the PDF is the authority
   on visual layout, ordering, and typography. Never build a renderer from the spec alone.
3. Current code, in this order:
   - `apps/api/prisma/schema.prisma` — all models. The `Entry*` block is the rig-entry DB
     (one `EntryReport` per well-day with ~22 child models). The `Project/Field/Well/
     Calculation/Segment/Station/Keypoint` block is the directional-plan store.
   - `a.json` (repo root) — the PEDC/POGC 21-section DDR JSON schema the entry editor and
     archive form both mirror. New daily fields must respect this vocabulary where overlap
     exists.
   - `apps/web/src/components/entry/ReportEditor.tsx` + `apps/api/src/routes/entry.ts` —
     the entry editor (20 tabs, one draft object, replace-all `PUT /entry/reports/:id`,
     prune-on-save doctrine) and its API.
   - `apps/web/src/components/ddr/DrReportForm.tsx` and `apps/web/src/pages/DdrReportsPage.tsx`
     — the a.json rendering doctrine (fixed section order, empty sections still render,
     `n/r` vs `—` empties, declarative `Col[]`/`Fld[]` + generic `RowTable`/`FieldGrid`).
   - `apps/web/src/export/` — the whole folder. `directionalPlot.ts` + `stationTable.ts` +
     `svgRaster.ts` + `pdfmakeSetup.ts` define the house PDF patterns you must follow:
     pdfmake 0.2.x lazy-imported at click time, shared `Content`-returning table builders,
     live-Recharts-SVG rasterization at 2× with legends re-drawn as vectors, fixed
     page-height budgets, user-facing thrown errors instead of blank pages.
   - `apps/api/src/ddr/db.ts` — how the legacy archive is read (read-only; you will not
     write to it) and the lookup tables available for pick-lists.

## Current state (verified 2026-08-07 — trust this summary, verify details in code)

- Monorepo: `apps/api` (Fastify + Prisma + SQLite at `apps/api/prisma/dev.db`), `apps/web`
  (React 18 + Vite + Recharts + pdfmake + SheetJS), `packages/shared` (zod schemas, units,
  math). Dates in the entry DB are **Jalali `"YYYY/MM/DD"` strings** (lexicographic sort =
  date sort); depths/lengths are **metric (mKB, m)**; some parameters are field units
  (ppg, psi, gpm, klbf).
- The entry DB is **day-centric**: nearly everything hangs off `EntryReport` (per well-day)
  — bit runs, drill strings + components, drilling parameter intervals, mud check,
  chemicals, casing runs, formation tops, surveys, time breakdown, operations log,
  supervisors, onboard companies, HSE drills, bulk materials, wellhead components, SCR
  rates, FIT, marine, vessels. Well-constant header data lives on `EntryWell` (one row per
  well: field, rig, client, lat/long DMS text, elevations, spud date...). `EntryRig` is
  name + contractor only.
- The legacy Access→SQLite archive (`sqlite_DB/new.sqlite`, `DB.sqlite`) is read-only
  reference data with rich lookup tables (Formation, Lithology, Bit, Casing, Activities,
  Operations, Fields...). `EntryWell.legacyWellCode` links an entered well to its archive
  A01 code. Keep it read-only.
- Existing report/export assets you must reuse, not duplicate:
  - Report 08 (Directional Plot) already ~exists: `exportDirectionalPlotPdf` in
    `apps/web/src/export/directionalPlot.ts` (plan + vertical-section plots page 1,
    stations table page 2). Compare it against `Wellview/08_DirectionalPlot.pdf` and align
    (plan-vs-actual overlay, header block fields per the spec) rather than writing a new one.
  - The DDR modal already exports a generic DDR PDF/XLSX (`apps/web/src/export/ddr.ts`).
  - Charting: Recharts for standard charts, canvas for log-style tracks, hand-rolled SVG
    elsewhere. 3D via react-three-fiber (not needed for these reports).

## Gap analysis (the core architectural problem)

WellView reports are **well- and job-centric**; the entry DB is **day-centric**. The spec's
Entity → report index shows ~70 entities; roughly half have no home today. The biggest
structural gaps, grouped:

1. **Job / phase / AFE / cost spine** (reports 01, 06, 07, 09–17, 22, 23): no `Job` (a
   drilling/completion/workover campaign on a well), no `JobPhase` (plan vs actual per the
   10 working phases in the spec appendix), no `Afe` / `AfeLine` / supplements, no
   `CostItem` (daily field-estimate cost lines keyed by two-level cost code), no
   `CostCode` lookup. Almost every report prints AFE number, cum cost, or cost/day.
2. **Well-level engineering masters** (02–05, 21–22, 24, 26, 28–30): daily rows exist
   (`EntryCasingRun`, `EntryDrillString`, `EntryWellheadComponent`, `EntryFit`) but there
   are no well-lifetime masters: `CasingString` (+`CasingComponent` per joint/item),
   `CementJob` (+stages, fluids, additives, plugs), `BhaRun` master spanning days,
   `HoleSection`, `WellheadAssembly`, well-level survey/plan linkage. Decide and document
   a bridge: master tables + nullable FK from the existing daily rows (e.g.
   `EntryDrillString.bhaRunId`, `EntryCasingRun.casingStringId`), with a backfill
   migration that creates masters from existing daily data where inferable (match on
   wellId + bhaNo / casing description). Do not break the existing daily editor.
3. **Events & HSE** (07, 09, 13, 15, 17): `IntervalProblem` (problem time with type,
   accountable party, costs), `IntervalLesson`, `SafetyIncident`, `Kick`,
   `LostCirculation`, `SafetyCheck` — none exist (only fixed HSE drill dates do).
4. **Geology** (18–21): well-level `FormationTop` program (prognosed vs actual — today only
   per-day rows), `LithologyInterval`, `SampleDescription`, `GasReading`, oil/gas shows,
   `LogRun`, `Core`, `SamplingRequirement`. The legacy archive has lithology/formation
   lookups to seed from.
5. **Completion / production** (22–30): `Perforation`, `Zone`, `TubingString` /
   `TubingComponent`, `RodString` / `RodComponent`, `OtherInHole` / `DownholeEquipment`,
   `StimulationJob` / stages, `ProductionPeriod`, `ProductionFailure`, `SwabRun`,
   `PlugBack`, `WellContact`, `Attachment`.
6. **Reference/lookup tables to create and seed**: operation letter codes (21), detail
   codes (33), indicators (P/U/T/X/N), the 10 working phases, the letter×detail validity
   matrix (all in the spec appendix — seed them exactly, including the documented errata
   decisions), cost codes, problem types, accountable parties, unscheduled event types.
   Wire `EntryTimeEntry`/`EntryOperation` to these as **soft** validation (warn, never
   block — existing free-text data must keep loading).

## Architecture directives

- **One database**: extend the Prisma entry DB. New models get clean domain names (`Job`,
  `Afe`, `CostItem`, `CasingString`...) — do **not** rename or restructure existing
  `Entry*` models; add nullable FKs to bridge. Every migration must be additive and run
  cleanly on an existing populated `dev.db` (`prisma migrate dev`). SQLite: no enums —
  string fields with doc-comments listing allowed values, mirrored in zod.
- **Store what is entered; derive what is printed.** Cumulative/rollup/variance columns on
  the reports (cum cost, phase hours, KPI pivots, AFE variance, BHA ROP...) are computed at
  report-assembly time server-side. The spec flags which printed columns are computed and
  from what — implement exactly those formulas. Never store a derivable number unless the
  sample demonstrably prints an entered (not computed) value.
- **Report engine shape**: for each report `NN`, a server assembler
  (`apps/api/src/reports/NN-*.ts`, mounted under a new authenticated route group, e.g.
  `GET /entry/report-data/:type?wellId=…&date=…&jobId=…&wellIds=…`) returns one typed JSON
  payload; a client module renders (a) an on-screen preview page using the existing
  `Col[]`/`RowTable`/`FieldGrid` doctrine and (b) a pdfmake export
  (`apps/web/src/export/wellview/NN-*.ts`) built from the **same** payload and shared table
  builders — one builder module per canonical table (the `stationTable.ts` model) so
  preview and PDF can never disagree. Report-data endpoints read the entry DB, so they sit
  behind the existing entry token auth like the rest of `/entry/*`.
- **New page** `apps/web/src/pages/WellviewReportsPage.tsx` ("Well Reports"): a catalog of
  the 30 reports grouped by category (Daily / Engineering / Cost & Multi-well / Geology /
  Completion & Schematics), each with its parameter pickers (well; date or date-range; job;
  BHA run; multi-well selector where the report is multi-well — the spec states the
  granularity per report), preview, and PDF/Excel buttons. Reports 13 and 16 are
  Excel-pivot-style in the samples — give those an XLSX export (SheetJS, one sheet per
  pivot) in addition to the PDF.
- **Wellbore schematic renderer** (reports 21, 23, 24, 28, 29, and the schematic column of
  22): build **one** reusable `WellboreSchematic` SVG React component (casing strings by
  depth, cement tops, tubing, perforations, plugs, formation bands, annotations) with a
  depth-scale prop, and rasterize it for PDFs via the existing `svgRaster.ts`. Do not draw
  five separate schematic implementations.
- **Charts in PDFs**: on-screen Recharts captured via `svgRaster.ts` + `readChartLegend`
  (the `directionalPlot.ts` pattern) for anything already rendered in the preview; simple
  bar/line charts that exist only in the PDF may instead be drawn as pdfmake vectors.
  Throw user-facing errors when a chart is not mounted; never emit a blank page.
- **Units & dates**: the samples are US-unit (ftKB, bbl); this app's data is metric (mKB,
  m) with field units for pressures/flows. Reproduce **layout and labels**, not the sample
  units: print the app's stored units with correct unit labels from one shared
  label/format helper per unit (extend `packages/shared` units). Dates print as stored
  (Jalali strings) — do not convert to Gregorian; multi-well day arithmetic uses the
  existing Birashk day-number helpers in `DdrReportsPage.tsx` (extract to shared).
- **Entry UX doctrine** (must match the existing editor): repeating tables with `minRows`
  blanks pruned on save; replace-all PUT per sheet in one transaction; blank → `null`
  (never 0); advisory amber warnings only, nothing blocks save; fixed-row tables posted
  whole; Jalali date picker; number fields via the existing `NumField`. Well-level master
  data gets its own editor area (a "Well Data" workspace parallel to the daily editor —
  tabs per domain: Jobs & Phases, AFE & Costs, Casing & Cement, Wellhead, Geology Program,
  Completion, Contacts, HSE) with the same save doctrine, admin- or assignment-guarded
  like the rest of `/entry/*`.
- Update `packages/shared/src/schemas` zod alongside every Prisma change, and keep
  `apps/api/src/routes/entry.ts` payload schemas in lockstep.

## Implementation order (tiers — verify each before the next)

- **Tier 0 — Foundation.** Lookup/code tables + seed script (op letters, details,
  indicators, phases, validity matrix, cost codes, problem types); `Job`/`JobPhase`/
  `Afe`/`AfeLine`/`CostItem` spine + entry UI for them; report-engine skeleton (route
  group, catalog page, one shared PDF header/footer builder rendering the standard
  WellView-style well header block + `Page n/m` footer used by nearly every report — spec
  sections "Well header block" / "Page footer").
- **Tier 1 — Daily drilling (06, 07, 02, 03).** 06 Daily Drilling first (most fields
  already exist), then 07 Detail (adds problems, lessons, kicks, lost circulation, safety
  checks, personnel, hydraulics), then 02 BHA Detail and 03 Bit Summary (needs `BhaRun`
  master bridge).
- **Tier 2 — Well engineering (04, 05, 08, 09, 10, 11).** Casing/cement masters; align
  the existing directional-plot export with sample 08; drilling summary; phases
  plan-vs-actual + phase graph (needs Tier 0 phases).
- **Tier 3 — Cost & multi-well (01, 12, 13, 14, 15, 16, 17).** AFE report; multi-well
  pickers; KPI/pivot assemblers; safety incidents.
- **Tier 4 — Geology (18, 19, 20, 21).** Geology models + entry tabs; the schematic
  component gets its first use in 21.
- **Tier 5 — Completion & production (22, 23, 24, 25, 26, 27, 28, 29, 30).** Completion
  models + entry; remaining schematics; Complete Well Summary (22) and Well Summary (30)
  last — they aggregate nearly everything.

## Verification (required per report — no report is "done" without this)

1. Seed realistic demo data approximating the sample report's content
   (`scripts/seed-wellview-demo.ts`, idempotent, one well + one job covering all tiers so
   far; extend it as tiers add entities).
2. Generate the PDF, then open it and the sample side-by-side (Read both PDFs) and check
   **section by section against the spec**: every section present in order, every field
   label present with the right unit label, computed columns recompute correctly from the
   seeded inputs (spot-check the arithmetic the spec flags as computed), multi-page
   behavior (repeated headers) correct.
3. `npm run typecheck` / build / existing tests green; the existing pages (DDR archive
   viewer, daily entry editor, directional pages) still work — they must never regress.
4. Keep a running checklist file `docs/wellview-report-status.md`: per report — spec read,
   schema done, entry done, assembler done, preview done, PDF done, verified-against-sample
   done, with dates and known deviations listed explicitly.

## Environment notes

- **Node**: the system node is v20 and breaks the API — use Node 24 via nvm
  (`source ~/.nvm/nvm.sh && nvm use 24`) before running anything.
- API on :4000 (`apps/api/.env`, `DATABASE_URL="file:./dev.db"`), web via Vite (`run.sh`).
  Entry auth: Bearer token from `POST /entry/auth/login`.
- Commit per coherent step (schema+seed / entry UI / one report) on a feature branch with
  conventional-commit messages matching the repo's existing style (`feat(ddr): …`).

## Working practices

- Start by reading everything in "Required reading", then produce a written plan for
  Tier 0 + Tier 1 (files to touch, models with fields, migration list) before coding.
- When the spec and the sample PDF disagree, the PDF wins; when both are ambiguous, match
  the closest existing a.json/DR.xls field name and record the decision in the status doc.
- Prefer extending existing shared components/helpers over new ones; follow the codebase's
  established naming, comment, and Col[]-doctrine conventions everywhere.
- The 21-section a.json daily form remains the daily-entry contract — new daily fields are
  additions alongside it, and reports 06/07 should print from the same fields the a.json
  form already captures wherever they overlap (do not create duplicate fields).
