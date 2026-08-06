# MIXED — Directional Drilling

Web application for planning and verifying directional wells, and for capturing
and analysing daily drilling reports. Built as a multi-package TypeScript
monorepo with React + Fastify + Prisma.

Trajectory math lives in one shared package so the browser can preview a design
locally while the API recomputes it on save — the two can never drift.

---

## What it does

Plan and verify directional wells:

- **Design the trajectory** — pick from 30+ profile types (HC3D, CH3D, HCH, CH,
  D3DS, D3DS-HOLD, CC3D, curve-EOC variants, fly-to-target, multi-curve combos)
  and let the dispatcher solve the geometry. Auto-handles drop curves
  (negative DLS), quadratic-branch selection, and reports the minimum DLS needed
  when targets are unreachable.
- **See the well in 3D** — orbit-camera wellbore viewer, vertical-section chart,
  plan-view scatter, cross-section chart, contoured field map with depth ramp.
- **Manage fields** — upload Petrel `.grd` grids, browse contoured maps,
  place wells by clicking on the map, lasso a polygon to clip the grid, compute
  reservoir volumes between two horizons.
- **Export** — landscape A4 PDF reports (pdfmake) and `.xlsx` workbooks
  (SheetJS) in the company's standard survey-report column layout.

Alongside the trajectory tools the app carries four more modules: the **DDR**
report browser, **Air & Gas** underbalanced hydraulics, **EMI/FMI** log
analysis, and the rig-side **Daily Report Entry** described below.

---

## Daily Drilling Reports — two halves, on purpose

DDR lives in two deliberately separate places:

| | Reads | Writes | Route |
|---|---|---|---|
| **Daily Drilling Reports** | the office's historical Access→SQLite archive, via `node:sqlite`, **read-only** | never | `/ddr` |
| **Daily Report Entry** | the app's own SQLite, via Prisma | company men on the rig | `/ddr-entry` |

The archive is a converted Access database of ~62,000 mud checks and decades of
bit records; nothing in this app opens it for writing. New reports are born in
the entry module instead, and the one place the two meet is the **ROP
Optimization** tab, where rig-entered drilling parameters are blended into the
scatter as hollow rings beside the archive's filled dots.

### Signing in

The rest of the API is unauthenticated; only `/entry/*` has a session (scrypt
password hashes and HMAC-signed tokens, both from `node:crypto` — no new
dependencies). On first run the server seeds an **`admin` / `admin`** account
that must change its password immediately; `ENTRY_ADMIN_USER` /
`ENTRY_ADMIN_PASSWORD` override it while the user table is still empty. An admin
registers rigs and wells, then ticks which wells each company man may report on —
every report route re-checks that assignment.

---

## Feature coverage

| Category | Status | Notes |
|---|---|---|
| **Trajectory builders** | ✅ Complete | All 30+ profile codes: `hold`, `c3`, `sursta`, `hoctt`, `hc3dtft`, `ch3dffk`, `ch`, `hch`, `ch2dc1`, `ch2dc2`, `cc2d`, `curveEoc` (E1–E5), `flyto` (1–5), `mcombo` (61–103) |
| **VSEC / TF / BR / TR** | ✅ Computed | Post-passes in the dispatcher |
| **DLS sign handling** | ✅ Auto | Dispatcher tries both signs (and both quadratic branches for CH2DC1/2) so drop curves "just work" |
| **Field map** | ✅ | 2D raster + contours + colour ramp + click-to-place-wells + polygon clip + cross-section line picker |
| **3D viewer** | ✅ Mesh + wells | Three.js / R3F. Stereo anaglyph and voxel-cube modes deferred (cosmetic) |
| **Reporting** | ✅ PDF + XLSX | |
| **DDR archive + rig-side entry** | ✅ | See the section above |
| **Casing / BHA / Mud / Hydraulics designers** | ❌ Not implemented | Net-new features, not yet scoped |
| **Per-well snapshot list** | ❌ Architectural | One canonical Calculation per well — versioning would need its own model |
| **Unit-preset modal** | ❌ Math present, no UI | `@dd/shared/units` has the conversions; just no preset picker |

---

## Tech stack

| Layer | Choice | Reason |
|---|---|---|
| **Monorepo** | npm workspaces | Zero extra tooling, full TS path-mapping |
| **Frontend** | React 18 + Vite + Tailwind + TanStack Query + React Router | Fast HMR, code-splitting, typed cache |
| **3D** | Three.js + @react-three/fiber + drei | Orbit controls, instanced meshes, lazy-loaded (1.1 MB chunk) |
| **Charts** | Recharts | Lazy-loaded (395 kB chunk) |
| **Backend** | Fastify + Prisma + SQLite (Postgres-ready) | Fast schema migrations; type-safe queries |
| **Validation** | Zod | Schemas shared between web ↔ api ↔ tests |
| **Tests** | Vitest (unit) + Playwright (e2e) | Fast, parallel, native-TS |
| **Math** | Pure functions in `packages/shared` | Same code runs locally in the browser preview AND server-side on save |

Initial JS bundle: **153 kB gzip** (Three.js + pdfmake + xlsx + recharts all
lazy-loaded). Dev startup: ~2s.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                            apps/web                              │
│  React 18 + Vite. Lazy-loads heavy deps (Three, pdfmake, xlsx)   │
│  - pages/CalculationPage  — editable grid + 3D + charts + export │
│  - pages/FieldMapPage     — .grd upload + contour map + wells    │
│  - components/MapViewer2D — canvas raster + click tools          │
│  - components/WellViewer3D / FieldScene3D — Three.js viewers     │
└─────────────────────────────┬───────────────────────────────────┘
                              │  /api proxy (Vite dev)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                            apps/api                              │
│  Fastify + Prisma. Routes:                                       │
│  /projects /countries /fields /wells /calculations               │
│  /grids /grids/:id/volume /grids/upload                          │
│  /ddr/*    read-only archive reader (node:sqlite)                │
│  /entry/*  rig-side report entry — the only authenticated part   │
│  /airmud/* Air & Gas sample wells                                │
│                                                                  │
│  POST /calculations/:id/calculate                                │
│   1. Load segments from Prisma                                   │
│   2. Run @dd/shared dispatch() — same code the browser previews  │
│   3. Persist stations + keypoints in one transaction             │
└──────┬──────────────────────────────────┬───────────────────────┘
       │                                  │
       ▼                                  ▼
┌───────────────────┐          ┌──────────────────────────────────┐
│  packages/shared  │          │            packages/grd          │
│  Trajectory math: │          │  .grd ASCII parser + contours +  │
│   - 14 builders   │          │  volume + colour ramp + line     │
│   - dispatcher    │          │  sampler + polygon clip          │
│   - VSEC/TF/BR/TR │          │  13 unit tests against a real    │
│     post-passes   │          │  Petrel grid                     │
│   - 57 unit tests │          └──────────────────────────────────┘
│   Zod schemas     │
│   Unit conv.      │
└───────────────────┘
```

### Why this design

- **Math is shared, not duplicated.** The browser previews calculations
  client-side; the API recomputes server-side on save. Both import from the
  same `@dd/shared/math/dispatcher`. There is no possibility of drift.
- **Angles always in radians; distances always in the project's unit.**
  Conversion happens only at the UI / CSV import boundaries.
- **One source of truth per concern.** The legacy DDR archive is read-only and
  reached through a single reader; everything writable goes through Prisma.

---

## Features in detail

### Trajectory editor

- **Profile picker modal** — 30+ profile types organized by family
  (standard / hold / single-curve / multi-curve).
- **Per-profile editable-cell mask** — yellow cells are user inputs, gray cells
  are computed. Each profile spawns its own set of milestone rows
  (KOP / EOC / Target / EOC #1 / KOP #2 / ...).
- **Exact algebraic keypoints** — every milestone (KOP, EOC, Target) lands at
  its exact analytic MD instead of being snapped to the nearest 100-ft densified
  station.
- **Auto DLS sign flip** — enter `+5` for a drop curve and the dispatcher tries
  the negative sign internally. Output displays magnitude only.
- **Quadratic branch selection** — CH2DC1 / CH2DC2 try both quadratic roots and
  pick the feasible one; a fixed `|tgtx| > |r1|` heuristic is wrong for chained
  CH→D3DS profiles.
- **Min-DLS hints on failure** — when CH or HCH can't reach the target, the
  error message includes the minimum DLS that would solve the geometry.
- **Smart-diff segment saves** — adding a row to the grid no longer wipes
  previously-calculated stations. Only changed/added/removed orders and rows
  after them are invalidated.
- **Undo / redo** — 50-deep history with Ctrl+Z / Ctrl+Shift+Z; never traps
  the browser's own undo when typing in a cell.
- **Debounced autosave** — 1.5 s after the last edit; status pill shows
  "Unsaved / Saving… / Saved 12s ago / Save failed".

### Field maps

- **`.grd` parser** — ASCII grid format (FSASCI header + `!` metadata +
  column-major floats). Verified against a 1.15 MB `TOP_HITH_DEPTH.grd`
  Petrel export.
- **Coloured raster** — spectrum / warm / grayscale ramps. Hover tooltip shows
  the cell value.
- **Marching-squares contours** — extract iso-lines at user-suggested levels;
  draw on overlay canvas.
- **Cross-section line picker** — click point A, click point B, see the
  elevation profile chart along the line (Recharts).
- **Click-to-place wells** — click the map, name the well in the modal; it
  POSTs `/wells` and the new pin appears.
- **Polygon clip** — lasso a region, double-click to finish; cells outside
  become null.
- **Volume calculator** — sum-method volume between two horizons. Verified
  to give 0 when comparing a grid to itself.

### 3D viewers

- **Wellbore viewer** — `WellViewer3D` uses R3F with a tubular mesh along
  the densified stations, ground grid, compass markers, wellhead and target
  spheres.
- **Field scene** — `FieldScene3D` renders the grid as a triangle mesh
  coloured by depth, with all wells in the field overlaid as tubes.
- Orbit controls, lazy-loaded (Three.js is a 1.1 MB chunk).

### Reports & export

- **PDF** — landscape A4 multi-page table via `pdfmake`. Columns: Comment, MD,
  Incl, Azm, TVD, VSEC, NS, EW, DLS, TF, BR, TR, DMD.
- **XLSX** — `.xlsx` workbook via SheetJS. Same column order.
- **CSV import** — bulk-load `countries.csv` + `fields.csv` + `wells.csv` +
  `calculations.csv` + `segments.csv` in one transaction.

---

## Prerequisites

- **Node 22.13+** — the DDR and Air/Gas modules read the legacy `.sqlite` files
  through the built-in `node:sqlite`, which is only unflagged from 22.13 / 23.4.
  On Node 20 the API exits at import with `ERR_UNKNOWN_BUILTIN_MODULE` before it
  binds a port.
- npm 10+ (workspaces support)

## Running

The launchers do the whole first-time setup themselves — dependency install,
`apps/api/.env`, Prisma client + migrations, the shared package builds — then
start both servers:

```bash
./run.sh
```

On Windows, double-click `run.bat` (or run it from a terminal). Both scripts:

- check the Node version and try to switch via `nvm` before failing with
  install instructions;
- create `apps/api/.env` from the example and generate `ENTRY_TOKEN_SECRET`
  into it, so rig logins survive a server restart;
- locate the DDR archive databases — they look for the folder holding
  `new.sqlite`, `sqlite_DB/` by default — and export `DDR_DB_DIR` /
  `AIRMUD_DB_DIR`. Those files are gitignored (`new.sqlite` alone is ~430 MB),
  so each machine keeps its own copy; set `DDR_DB_DIR` yourself to point
  somewhere else;
- print a clear warning, not a stack trace, when any of that is missing.

To run the halves separately:

```bash
npm run dev:api      # → http://localhost:4000  (health check: /health)
npm run dev:web      # → http://localhost:5173  (Vite proxies /api → :4000)
npm run dev          # both at once
```

Note that `npm run dev` on its own does **not** export `DDR_DB_DIR`, so the DDR
tabs will report the database as missing — use `./run.sh` or export it yourself.

## Tests

```bash
npm test                            # 57 @dd/shared + 13 @dd/grd unit tests
npm --workspace e2e test            # Playwright happy-path (needs servers running)
```

The unit suite enforces numerical fidelity for the trajectory math primitives
and the .grd parser/contour/volume code.

---

## Project layout

```
/apps
  /web              React + Vite frontend (port 5173)
    /src
      /api          Typed fetch client
      /components   3D viewers, charts, field map, profile picker,
                    editable cell, profile roles
      /export       PDF + XLSX generators (lazy-loaded)
      /hooks        useHistoryState (undo/redo)
      /import       CSV → import-payload converter
      /entry        Report-entry session + typed /entry/* client
      /pages        CalculationPage, FieldMapPage, ProjectsPage,
                    DdrReportsPage (archive), ReportEntryPage (rig), etc.
      /shell        App shell / nav
      /components
        /ddr        Archive viewer tabs (search, formations, mud, ROP…)
        /entry      The fillable sheet: 20 subforms + input primitives
  /api              Fastify backend (port 4000)
    /prisma         schema.prisma + migrations
    /src
      /ddr          Legacy Access→SQLite reader (node:sqlite, READ-ONLY)
      /entry        scrypt + HMAC auth for /entry/*
      /routes       REST endpoints
/packages
  /shared           Types, zod schemas, units, trajectory math
    /src
      /math
        /builders   hold, c3, sursta, hoctt, hc3dtft, ch3dffk, ch,
                    hch, cc2d, ch2dc1, ch2dc2, curveEoc, flyto, mcombo
        dispatcher.ts   Orchestrator + VSEC/TF/BR/TR post-passes
        plane.ts, vector.ts, rotation.ts, solve.ts
        profile-types.ts
      /schemas      Zod
      /units        cm/m/km/ft/yd/mi/nmi + deg/rad + DLS conversion
  /grd              .grd parser + volume + contours + colour ramps +
                    line sampler + polygon clip
/e2e                Playwright happy-path tests
/sqlite_DB          Legacy DDR databases — gitignored, per machine (~430 MB)
a.json              PEDC/POGC DDR JSON Schema — canonical field names + units
run.sh / run.bat    Dev launchers (Node check, DB autodetect, env, migrate, run)
```

## Architecture rules

- All trajectory math lives in `packages/shared` so the UI can preview locally
  and the API can recompute on save. No duplication.
- All angles stored in **radians**; all distances in the project's storage
  length unit. Convert only at the UI / import boundaries.
- TypeScript strict mode throughout; no `any` outside narrow interop spots.
- DLS is stored signed internally (the dispatcher uses sign to encode build
  vs. drop direction); always displayed as a magnitude.
- The legacy DDR databases are **read-only**. Anything writable belongs in the
  Prisma store; nothing opens the Access conversions for writing.
- Report-entry saves post the **whole sheet** in one `PUT`; the API replaces the
  child rows inside a single transaction, which keeps a save atomic and
  idempotent. Add a new block by following that pattern, not around it.
- Entry form primitives live in `components/entry/fields.tsx` and are
  mobile-first: 16px inputs (anything smaller makes iOS Safari zoom on focus),
  44px touch targets, wide tables becoming one card per row on phones. Reuse
  them rather than hand-rolling inputs.
- React components are declared at **module scope**. A component defined inside
  another is a new type on every render, so React remounts its inputs and drops
  focus after each keystroke.

---

## Roadmap

Phase 6 polish is complete. Items deferred for later, ordered by user impact:

1. **Azimuth-disambiguation modal** — a proper popup showing both candidates.
   Current behaviour: a global Branch 1 / Branch 2 selector persisted in
   localStorage.
2. **Unit-preset modal** (Imperial / Metric / API / SI) — `@dd/shared/units`
   has the conversion math; just no UI to bulk-pick a preset.
3. **Raw .grd header viewer** — needs a `Grid.metadata` Prisma field to persist
   the raw `!`-prefixed lines.
4. **Volume methods 1–4** (Simpson + biquadratic surface fit). Currently only
   the sum method is in `@dd/grd/volume`.
5. **3D viewer extras** — voxel-cube render mode and red/green anaglyph stereo.
   Both are cosmetic alternatives to the smooth-mesh path.
6. **Numerical fixtures** to pin fidelity at ±1e-6 (the harness in
   `packages/shared/test/fixtures/` is ready to receive them).
7. **CI** wiring for Vitest + Playwright + the fixture suite.
8. **PostgreSQL** deployment target (Prisma makes this a one-line swap).

Out of scope for now:

- Casing / BHA / Mud / Hydraulics designers — net-new features that need
  scoping before they are worth building.
- Legacy `.mdb` import — ODBC isn't practical server-side; the CSV importer is
  the substitute.

---

## License

Internal project.
