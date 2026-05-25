# MIXED — Directional Drilling

Modern web-based replacement for the legacy Delphi **MIXED** directional drilling
application. A complete TypeScript port of ~19,000 lines of Pascal trajectory
math + UI, rebuilt as a multi-package monorepo with React + Fastify + Prisma.

The original Pascal sources live read-only under
[`old_delphi_code/`](old_delphi_code/); every TypeScript file that ports Pascal
code cites the source unit and line number in a comment so the lineage stays
auditable. The complete port-status audit is in
[`PORT_AUDIT.md`](PORT_AUDIT.md).

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
  (SheetJS) matching the original Delphi `Unit10.RvSystem1Print` column layout.

---

## Coverage vs. the original Delphi app

Audited 27 Pascal units (`MIXED.dpr` direct dependencies). Per-procedure
results in [`PORT_AUDIT.md`](PORT_AUDIT.md).

| Category | Status | Notes |
|---|---|---|
| **Trajectory builders (Unit02.pas)** | ✅ 100% | All 30+ profile codes: `hold`, `c3`, `sursta`, `hoctt`, `hc3dtft`, `ch3dffk`, `ch`, `hch`, `ch2dc1`, `ch2dc2`, `cc2d`, `curveEoc` (E1–E5), `flyto` (1–5), `mcombo` (61–103) |
| **VSEC / TF / BR / TR** | ✅ Computed | Post-passes in the dispatcher ported from Unit02.pas:2578–2624 |
| **DLS sign handling** | ✅ Auto | Dispatcher tries both signs (and both quadratic branches for CH2DC1/2) so drop curves "just work" |
| **Field map (Unit21.pas)** | ✅ + extras | 2D raster + contours + colour ramp + click-to-place-wells + polygon clip + cross-section line picker |
| **3D viewer (Unit03, Unit25, Unit35)** | ✅ Mesh + wells | Three.js / R3F. Stereo anaglyph and voxel-cube modes deferred (cosmetic) |
| **Reporting (Unit10.pas)** | ✅ PDF + XLSX | Column layout matches Pascal `RvSystem1Print` |
| **Casing / BHA / Mud / Hydraulics (Unit41)** | ❌ Empty in original Pascal too | All `CREATE TABLE`s for these are commented out in Unit01.pas:940-1210 |
| **`.mdb` import (Unit01.Load1Click)** | ❌ Replaced with CSV importer | ODBC isn't feasible server-side; bulk CSV import covers the data flow |
| **Per-well snapshot list (Unit02.SURVEYCOPY)** | ❌ Architectural | TS app uses one canonical Calculation per well — would need a Versions model |
| **Unit-preset modal (Unit42)** | ❌ Conversion math present, no UI | `@dd/shared/units` has the conversions; just no preset picker |

Detailed list of every remaining file/line with reasons is in
[`PORT_AUDIT.md`](PORT_AUDIT.md).

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
- **Pascal traceability.** Every ported file references the Pascal unit and
  line range it was ported from. Grep the codebase for `Unit02.pas` to find
  the audit trail.

---

## Features in detail

### Trajectory editor

- **Profile picker modal** ports `Form04` / `Form05` / `Form06`. 30+ profile
  types organized by family (standard / hold / single-curve / multi-curve).
- **Per-profile editable-cell mask** ports `Unit02.pas:rowcolor`. Yellow cells
  are user inputs; gray cells are computed. Each profile spawns the exact set
  of milestone rows (KOP / EOC / Target / EOC #1 / KOP #2 / ...) Pascal would.
- **Exact algebraic keypoints** — every milestone (KOP, EOC, Target) lands at
  its exact analytic MD instead of being snapped to the nearest 100-ft densified
  station. Pascal does the same in `Form02.cellfill`.
- **Auto DLS sign flip** — enter `+5` for a drop curve and the dispatcher tries
  the negative sign internally. Output displays magnitude only (per Pascal's
  `wlpt2[1].dls := abs(...)` convention).
- **Quadratic branch selection** — CH2DC1 / CH2DC2 try both quadratic roots
  and pick the feasible one. Pascal's fixed `|tgtx| > |r1|` heuristic was a
  bug for chained CH→D3DS profiles.
- **Min-DLS hints on failure** — when CH or HCH can't reach the target, the
  error message includes the minimum DLS that would solve the geometry.
  Ported from `Unit02.pas:3134-3138`.
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
- **Coloured raster** — spectrum / warm / grayscale ramps via the Pascal
  `Form23.Degrade` algorithm. Hover tooltip shows cell value.
- **Marching-squares contours** — extract iso-lines at user-suggested levels;
  draw on overlay canvas.
- **Cross-section line picker** — click point A, click point B, see the
  elevation profile chart along the line (Recharts).
- **Click-to-place wells** — Pascal `Form21.Image2MouseDown` ported with a
  modal asking for the well name; POST `/wells` and the new pin shows up.
- **Polygon clip** — lasso a region, double-click to finish, cells outside
  become null. Pascal `Form21.Button3Click`.
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

- **PDF** — landscape A4 multi-page table via `pdfmake`. Column layout
  matches `Unit10.RvSystem1Print`: Comment, MD, Incl, Azm, TVD, VSEC, NS, EW,
  DLS, TF, BR, TR, DMD.
- **XLSX** — `.xlsx` workbook via SheetJS. Same column order.
- **CSV import** — bulk-load `countries.csv` + `fields.csv` + `wells.csv` +
  `calculations.csv` + `segments.csv` in one transaction. Column names match
  Pascal `CREATE TABLE` statements.

---

## Prerequisites

- Node 20+
- npm 10+ (workspaces support)

## First-time setup

```bash
# 1. Install all workspace dependencies
npm install

# 2. Set up the API database (SQLite by default)
cd apps/api
cp .env.example .env
npx prisma generate
npx prisma migrate dev --name init
cd ../..

# 3. Build the shared package (web and api import from its dist/)
npm run build:shared
```

## Running

In one terminal:

```bash
npm run dev:api      # → http://localhost:4000  (health check: /health)
```

In another:

```bash
npm run dev:web      # → http://localhost:5173
                     #   Vite proxies /api → http://localhost:4000
```

Or both at once:

```bash
npm run dev
```

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
      /pages        CalculationPage, FieldMapPage, ProjectsPage, etc.
      /shell        App shell / nav
  /api              Fastify backend (port 4000)
    /prisma         schema.prisma + migrations
    /src
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
/old_delphi_code    Reference (read-only)
PORT_AUDIT.md       Full audit of every Pascal unit + procedure
PHASE5_NOTES.md     Why .mdb importer + casing/BHA/mud are deferred
REACT_CONVERSION_PROMPT.md   Original specification
```

## Architecture rules

- All trajectory math lives in `packages/shared` so the UI can preview locally
  and the API can recompute on save. No duplication.
- All angles stored in **radians**; all distances in the project's storage
  length unit. Convert only at the UI / import boundaries.
- TypeScript strict mode throughout; no `any` outside narrow interop spots.
- The Delphi sources are the source of truth for algorithm behaviour. When
  porting, cite `Unit##.pas:###` in a code comment so the lineage stays
  auditable.
- DLS is stored signed internally (the dispatcher uses sign to encode build
  vs. drop direction); always displayed as a magnitude per Pascal convention.

---

## Roadmap

Phase 6 polish is complete. Items deferred for later, ordered by user impact:

1. **Form07 azimuth-disambiguation modal** — proper popup with both candidates
   shown. Current behaviour: global Branch 1 / Branch 2 selector persisted in
   localStorage.
2. **Unit-preset modal** (Imperial / Metric / API / SI) — `@dd/shared/units`
   has the conversion math; just no UI to bulk-pick a preset.
3. **Form24 raw .grd header viewer** — needs `Grid.metadata` Prisma field to
   persist the raw `!`-prefixed lines.
4. **Volume methods 1–4** (Simpson + biquadratic surface fit) from
   `Unit30.pas`. Currently only the sum method is in `@dd/grd/volume`.
5. **3D viewer extras** — voxel-cube render mode and red/green anaglyph
   stereo from `Unit35.pas`. Both are cosmetic alternatives to the smooth-mesh
   path.
6. **Captured fixtures from MIXED.exe** to pin numerical fidelity at ±1e-6
   (the test harness in `packages/shared/test/fixtures/` is ready to receive
   them).
7. **CI** wiring for Vitest + Playwright + the fixture suite.
8. **PostgreSQL** deployment target (Prisma makes this a one-line swap).

Documented as not-feasible-here:

- Casing / BHA / Mud / Hydraulics designers — never finished in the original
  Pascal either (all `CREATE TABLE` statements commented out in Unit01.pas);
  these would be net-new features rather than a port.
- Legacy `.mdb` importer — ODBC isn't practical server-side; CSV importer is
  the substitute.
- `ProEffectImage.pas` (1,238 lines of bitmap effects) — modern browsers do
  this via CSS `filter:`.

---

## License

Internal project. The reference Pascal sources under `old_delphi_code/` retain
their original author's copyright.
