# WellView Online

The Peloton WellView desktop application rebuilt as a web module, following the
**WellView – SASBU Master Training Guide** chapter by chapter, over the user's
own databases converted from Access to SQLite (`sqlite_DB/wellview/`).

Route: **`/wellview`** · nav entry **WellView** · signs in through the same
`/entry` session as the rest of the app.

## What is implemented, and where it comes from in the guide

| Guide | Feature | Where |
|---|---|---|
| ch 1 | Open Database window (pick a converted `.sqlite`) | `WellViewOnlinePage.tsx` |
| §3.1 | Toolbar: Open · Edit Data · Data Audit · Multi Well Reports · Change Database | `WellExplorer.tsx` |
| §3.2 | Well folders: Recently Opened (20), My Wells (100), All Wells, Group by Properties (4 levels asc/desc); well list with column chooser, sort, multi-select, Copy Well List (tab-separated with headings) | `WellExplorer.tsx` |
| §3.3 | Quick Query: Look in (any header field) + Look for (full/partial) + Refresh | `WellExplorer.tsx` |
| §3.8 | Reports tab: all 181 parsed templates fill from the chosen DB for the opened well; block title → Edit Data | `WellWindow.tsx` |
| §3.8 | Schematic tab: wellbore sizes, casing (+shoes, cement hatch), tubing, rods, other-in-hole, perforations, zones; **history player** (first/prev/play/next/last) over every date the downhole state changed | `WellWindow.tsx` |
| §3.9 | Edit Data window: subject-area folder tree (dimmed = empty), horizontal/vertical edit modes, parent-record chain with Previous/Next, ghost row for new records, duplicate, cascade delete, lookup lists (datalist from `wellview-picklists.json`), Show System Fields | `EditData.tsx` |
| §3.10 + §10.2 | Data Auditor: the business rules of §10.2, each skipped **visibly** when the schema lacks its columns; findings click through to Edit Data | `DataAudit.tsx`, rules in `wellviewDb.ts` |

## The data model behind it

Every WellView table carries `idwell`; records are keyed `IDRec`; children point
to their parent record via `IDRecParent`. The parent **table** is encoded in the
table name: the longest proper prefix that is itself a table
(`wvJobReportTimeLog` → `wvJobReport` → `wvJob`). Verified against the sample
database: 128 child tables with live rows all resolve. Exceptions:
`wvWellbore.IDRecParent` is a **self**-reference on original holes (a sidetrack
points at a different bore — the audit rule accounts for this), and
`wvAttachment`/`wvComment` attach to any record.

API: `apps/api/src/routes/wellviewDb.ts` (`/entry/wellview/dbs/*`) — database
list, wells + quick query, subject tree with per-well counts, record CRUD
(IDRec generated as 32-hex GUID, `sysCreate*/sysMod*` stamped, cascade delete),
audit, schematic payload, and template resolution shared with
`wellviewSample.ts` (`resolveTemplateData`).

**Mutations write to the `.sqlite` file** — that file is the database, exactly
as the `.mdb` was for the desktop app. The conversion sources are kept in
`WellView_files/db/`, so a database can always be regenerated
(`scripts/mdb_to_sqlite.py`).

## Verification

- `apps/api/src/routes/wellviewDb.test.ts` — 11 integration tests against the
  real converted sample DB (well list, quick query, tree, parent-scoped
  records, audit, schematic, template fill, insert→edit→cascade-delete leaving
  the DB clean, id/system column write refusal).
- `e2e/tests/wellview-online.spec.ts` — the desktop core loop in a real
  browser: open database → explorer → quick query → open well → filled report →
  schematic → edit-data tree walk → auditor.
- vitest note: `node:sqlite` needs the alias in `apps/api/vitest.config.ts`
  (see `src/test/node-sqlite-shim.mjs`) because the Vite under vitest 2
  predates prefix-only builtins.

## Not implemented (deliberately)

Sync (ch 6), Add-Ins (ch 10 — Citrix/SAP/Oracle plumbing), report/schematic
template *designers* (§8.3, §9.2–9.3), spell check, record locking. The Multi
Well Reports button routes to the existing 30-report Well Reports page.
