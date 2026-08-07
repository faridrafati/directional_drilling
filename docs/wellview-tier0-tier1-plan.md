# WellView report suite — Tier 0 + Tier 1 implementation plan

> Written 2026-08-07, before any schema change, from `WELLVIEW_REPORT_SPEC.md`, the 30 sample
> PDFs in `Wellview/`, `a.json`, and the existing `Entry*` / `/entry/*` / `apps/web/src/export`
> code. Sample PDFs were read with `scripts/pdf_text.mjs` (this box has no poppler; the samples
> are also RC4-encrypted — see that file's header).
>
> Tier 0 = foundation (lookups, job/phase/AFE/cost spine, report-engine skeleton).
> Tier 1 = daily drilling (reports 06, 07, 02, 03).

## 0. Decisions that shape everything below

1. **One cost spine, job-scoped.** Reports 01, 06, 07, 09–15, 18, 22, 23 all print money. They are
   *not* separate systems: report 01's `Job Cost Summary` rows, report 06's `Day Total (Cost)` and
   report 10's `Actual Phase Field Est` are three views of one `CostItem` table. `CostItem` therefore
   hangs off `Job`, carries `costDate` (Jalali) for the daily slice and `phaseId` for the phase slice.
   There is **no** second per-report cost table — two tables would have to agree, and would not.

2. **Codes validate softly, never block.** `EntryTimeEntry` / `EntryOperation` gain plain nullable
   `opLetter` / `opDetail` / `timeIndicator` **String** columns with *no* foreign key. The existing
   free-text `group` / `type` / `activity` / `opCode` columns stay and keep printing. A value that is
   not in the lookup raises an amber advisory in the editor and is saved unchanged — every existing
   draft must keep loading.

3. **Reproduce the layout, print our units.** The samples are ftKB/ft/bbl/°F. We keep the label
   *text* and the column order and swap the unit token: `ftKB → mKB`, `ft → m`, `(Cost/ft) → (Cost/m)`.
   This is what `DrReportForm.tsx` already does for the archive ("Final top MD (mKB)", "Set depth
   (mKB)"). Money and hour columns are unaffected. **No numeric conversion happens anywhere** — the
   stored value is metric and is printed as stored.

4. **Store what is entered, derive what is printed.** Every `Cum`, `Var`, `ROP`, `Dur`, `%` and
   `Total` column on these reports is computed in the server assembler. The one deliberate exception
   is `EntryBhaRun.depthOutMkb` — report 03 row 1 and row 5 carry no drilling-parameter interval at
   all, so there is nothing to take a `MAX()` over.

5. **Additive migrations only.** No renames, no drops, no new `NOT NULL` without a default, no new
   unique constraint on a populated table. Verified by running `prisma migrate deploy` against a copy
   of the populated `dev.db` and diffing row counts.

## 1. Reconciliations forced by the design review

Tier 0 and Tier 1 were designed independently and overlapped. These are the resolutions:

| Conflict | Resolution |
|---|---|
| Two AFE/cost spines (`Afe`/`CostItem` vs `EntryAfe`/`EntryCostItem`) | Keep the **job-scoped** `Afe`/`AfeSupplement`/`AfeLine`/`CostCode`/`CostItem`. `CostItem` absorbs the daily design's `category` (the "Mud Field Est" roll-up filter) and `costDate`. Drop `EntryAfe*` / `EntryCostItem` entirely. |
| Two code-lookup sets (`Wv*` vs `EntryOpCode1/2`) | Keep the **`Wv*`** tables — they carry the validity matrix, the indicators, the working phases and the errata. Drop `EntryOpCode1/2`. |
| Two `ALTER TABLE EntryWell` migrations adding the same five columns | **One** migration, Tier 0's names. `jobType` → `Job.primaryJobType`; `targetFormation` → `Job.targetFormation`. |
| `massPerLenLbFt` (lb/ft) multiplied by `lenM` (metres) | Store **`massPerLenKgM`** (kg/m) to match `lenM`; string weight is derived in one shared helper with the conversion written out once. |
| `false` / defaulted FK ids in blank rows defeat `prune()` | Blank-row factories use `null`, never `false`. One shared `LINK_SKIP` constant lists the FK columns `filled()` must ignore, so a future FK cannot be forgotten. |
| `Col<T>` has no boolean cell type but the design asks for Yes/No columns | Add `type: "bool"` to `Col<T>` and a tri-state (Yes / No / —) control to `RowTable`, keeping the 44 px touch rule. |
| Jalali strings compared lexicographically, but `/^\d{3,4}\/\d{1,2}\/\d{1,2}$/` accepts `1404/5/9` | Add `jalaliKey()` to `packages/shared`; every range test, sort and window-stamp goes through it. |
| `problemRef` ordinal drifts because `prune()` filters without re-indexing | `prune()` re-indexes surviving rows; `problemRef` is defined as `order + 1`, stated once. |
| Lookup rows duplicated in a migration *and* a seed script | Rows live **only** in `apps/api/prisma/seed-wellview-codes.ts`, called from `server.ts` beside the existing `seedAdmin` — the pattern this repo already uses. |
| Cost-code admin screen 400s on `RowTable`'s spare blank row | Same prune-before-post step as every other replace-all surface. |
| `matrixLabel` seeded only for C | Seeded for **C, F, G, H, O, P** — six rows whose Tab. 7-1 wording differs from the code sheet. |
| Job save cannot reference a phase created in the same PUT | New `JobPhase` / `AfeLine` rows get a **client-minted cuid**, so a cost row can point at them before the first save returns. |

## 2. Tier 0 — models

### 2.1 Code lookups (seeded, read-only to users)

Source: `WELLVIEW_REPORT_SPEC.md` appendix, lines 4185–4390.

- **`WvMainOperation`** — 21 letters A–U. `code @id`, `name`, `order`, `matrixLabel?`, `onMatrix`
  (false for U only), `riglessOnly` (R/S/T), `note?`.
- **`WvOperationDetail`** — 33 details. `code @id` zero-padded `"01".."33"`, `num @unique` 1–33,
  `name`, `definition?`, `onMatrix` (false for 33 only), `note?`.
- **`WvMatrixCell`** — the Tab. 7-1 validity matrix as **437 rows**, `@@id([letter, detailNum])`.
  Errata 3 honoured: row A carries detail **9** (printed "A4"), with the note on the row.
- **`WvTimeIndicator`** — P/U/T/X/N with the §3 definitions.
- **`WvReportCode`** — the sheet's P/N/T/U. A *separate* table: the letters collide with different
  meanings (sheet `P` = Productive, procedure `P` = Planned — errata 5).
- **`WvWorkingPhase`** — the 10 Tab. 4-1 phases with their start/end triggers.

### 2.2 Job / phase / AFE / cost spine

- **`Job`** — `wellId`, `order`, `category`, `primaryJobType`, `secondaryJobType`, `status1`,
  `plannedStartDate`, `startDate`, `min/mostLikely/maxPlannedEndDate`, `endDate`, `targetDepth`,
  `targetFormation`, `summary` (report 01's job narrative — *not* `EntryReport.description`),
  `possCostSave`, `possTimeSaveHr`, `estProblemCost`, `estLostTimeHr` (all four from **report 22**).
- **`JobPhase`** — `jobId`, `order`, `phaseType1`, `phaseType2`, `actualStartDate`/`actualEndDate`
  (**date + time** — report 10's boundaries land at 09:00 / 21:45 / 06:45 …, so date-only makes
  Actual Dur unreproducible), `actualStartDepth`/`actualEndDepth` (full precision, never the printed
  1 dp — row 1's Cost/Depth 576.17 needs 321.52), `workingPhaseCode` (soft tag).
- **`JobPhasePlan`** — 1:1 with `JobPhase`: `startDepth`, `endDepth`, `durMostLikelyDays`,
  `costMostLikely`. Separate so a missing plan never fabricates zeros in the cumulative columns.
- **`Afe`** — `jobId`, `order`, `afeNumber` (TEXT — `1234567C` exists), `description`, `amount`
  (the control total, used for a reconciliation warning), `approvedDate`.
- **`AfeSupplement`** — `afeId`, `order`, `number`, `amount`, `approvedDate`.
- **`AfeLine`** — `afeId`, `costCodeId?`, `order`, `description`, `amount`.
- **`CostCode`** — company chart of accounts, `@@unique([code1, code2])`. **Ships empty**: report
  01's 1200/1210 … 7000/7602 are Peloton demo accounts, not this company's.
- **`CostItem`** — one printed row of report 01's Job Cost Summary and the source of every money
  figure on 01/06/07/10/11/12. `jobId`, `phaseId?`, `costCodeId?`, `afeLineId?`, `supplementId?`,
  `order`, `description?`, `afeAmount?`, `suppAmount?`, `fieldEstimate?`, `finalInvoice?`,
  `category?` (`"mud"` drives the header's Mud Field Est), `costDate?`.
  **No unique on (jobId, costCodeId)** — the sample prints 7000/7602 twice.

### 2.3 Bridges onto existing models (all nullable, all additive)

- `EntryWell` **+7 columns**: `apiUwi`, `licenseNo`, `stateProvince`, `groundElevation`,
  `casingFlangeElevation`, `kbGroundDistance`, `kbCasingFlangeDistance`. The last two are **stored,
  not derived** — the sample prints the casing-flange distance while both ground values are blank.
- `EntryReport.jobId?` / `EntryReport.phaseId?` — real FKs, `onDelete: SetNull` (deleting a job must
  never delete the crew's reports). No SQL backfill; an admin action attaches existing days.
- `EntryTimeEntry.phaseId?` + `opLetter?` / `opDetail?` / `timeIndicator?` (plain strings, no FK).
- `EntryOperation.opLetter?` / `opDetail?` / `timeIndicator?` (plain strings, no FK). `opCode` stays.

### 2.4 Tier 0 migrations, in order

1. `wellview_code_tables` — CREATE only. Touches nothing existing.
2. `job_cost_spine` — CREATE only. The one new UNIQUE lands on an empty table.
3. `well_regulatory_columns` — 7 × nullable `ALTER TABLE EntryWell ADD COLUMN`. Metadata-only.
4. `entry_code_and_job_links` — the bridges. `jobId`/`phaseId` are real relations, so Prisma emits
   its SQLite table-redefine for `EntryReport` and `EntryTimeEntry`; the code-tag columns are plain
   TEXT and force no rewrite. `EntryOperation` gets a plain `ADD COLUMN` only.

Codes are seeded by `seedWellviewCodes()` at API boot, not by a migration.

### 2.5 Tier 0 surfaces

- `apps/api/prisma/seed-wellview-codes.ts` — idempotent upserts; asserts the matrix generates
  exactly 437 cells so a spec correction cannot silently drift.
- `apps/api/src/routes/entry.ts` — `/entry/jobs*`, `/entry/cost-codes*`, `/entry/wells/:id/jobs`.
  Job saves are **id-stable upserts** (not replace-all) because cost rows reference phase ids.
- `apps/api/src/reports/` — the assembler route group `GET /entry/report-data/:type`, behind the
  same entry-token auth as the rest of `/entry/*`.
- `apps/web/src/pages/WellviewReportsPage.tsx` — the catalog, grouped by category, with per-report
  parameter pickers.
- `apps/web/src/export/reportChrome.ts` — **one** shared header/footer builder covering the 13
  header variants and 4 footer variants the 30 samples actually use, returning pdfmake `Content`
  exactly like `stationTable.ts` (never calling `createPdf`), with an exported `*_STYLES` object and
  exported geometry constants so callers keep their page-height budgets honest.
- `apps/web/src/components/entry/WellDataEditor.tsx` — the well-level workspace (Jobs & Phases,
  AFE & Costs …) using the existing `Section` / `RowTable` / `NumField` primitives and the same
  prune-on-save doctrine.

## 3. Tier 1 — models (reports 06, 07, 02, 03)

### 3.1 New models

- **`EntryWellbore`** (well-level) — `name`, `kind`, `koMdMkb`. Reports 02/06/07 all print a wellbore.
- **`EntryBhaRun`** (well-level master) — deliberately thin: `bhaNo`, `depthOutMkb`, `dateOut`,
  `timeOut`, `comment`, `wellboreId?`. Name, depth-in, date-in and hours are **derived** from the
  daily `EntryDrillString` rows. `@@unique([wellId, bhaNo])`.
- **`EntryBhaSensor`** (run-level) — `sensorType`, `distFromBitM`, `note`. Not derivable from
  `cumLenM`: that is the distance to a *collar*, not to the sensor inside it.
- **`EntryMudPump`** (rig-level plant) — `pumpNo`, `manufacturer`, `model`, `ratingHp`, `rodDiaIn`,
  `strokeIn`, `linerSizeIn` (**TEXT** — the page prints `6 1/2`), `volPerStkBbl` (override).
  The daily readings stay on the existing `EntryScrRate`.
- **Per-day**: `EntryIntervalProblem` (with `accountableParty` — report 15 pivots on it),
  `EntrySafetyCheck`, `EntrySafetyIncident`, `EntryMudVolume`.
- **Well-level registers** (they carry *two* dates, so they outlive a day and are reprinted on every
  day their range covers): `EntryIntervalLesson`, `EntryKick`, `EntryLostCirculation`.

### 3.2 Tier 1 bridges

`EntryDrillString.bhaRunId?`, `EntryBitRun.bhaRunId?`, `EntryDrillingParameter.bhaRunId?` +
`.wellboreId?`, `EntryScrRate.mudPumpId?`, `EntryOperation.problemRef?` (an **ordinal**, not an FK —
the replace-all PUT re-mints child ids on every save).

Backfill: one `EntryBhaRun` per distinct `(wellId, bhaNo)`; bits match on the day's single string,
else on equal `order`. Rows with a null `bhaNo` stay unlinked and are simply invisible to 02/03.
The existing daily editor is untouched — it never sets any of these columns.

### 3.3 Tier 1 column additions to existing daily models

`EntryReport`: `weather`, `roadCondition`, `holeCondition`, `startDepthTvd`, `remarks`, `daysRi`.
`EntryOperation`: `opCode2`, `isProblem`, `probHr`, `problemRef`.
`EntryMud`: `filterCake32nds`, `sandPct`, `pm`, `gel30min`, `wholeMudAddedBbl`, `mudLostSurfaceBbl`.
`EntryBitRun`: `lengthM`. `EntryDrillStringComponent`: `massPerLenKgM`, `grade`, `driftIn`,
`gaugeIn`, `connections`, `odLabel`, `isBit`.

## 4. Shared table builders (built once, used by many reports)

Named now so no report invents its own: `timeLogTable` (06, 07, 12, 18, 23), `mudCheckSection`
(two layout modes — compact table and label-over-value block), `drillingParametersTable`,
`stringComponentTally` (casing / tubing / rod / BHA, one builder with presets), `bitRunTable`,
`formationTopsTable`, `contactsTable`, `afeCostRollupBlock`, `jobBlock`. The existing
`stationTable.ts` is **extended with column presets**, never rewritten.

## 5. Verification gate per report

Seed demo data → generate the PDF → extract both it and the sample with `scripts/pdf_text.mjs` →
compare section by section against the spec → `npm run typecheck` → confirm the DDR archive viewer,
the daily entry editor and the directional pages still work. Recorded in
`docs/wellview-report-status.md`.
