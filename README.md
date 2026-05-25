# Directional Drilling

Modern web-based replacement for the legacy Delphi "MIXED" directional drilling application.
The original Pascal sources live under [`old_delphi_code/`](old_delphi_code/) and the full
project specification is in [REACT_CONVERSION_PROMPT.md](REACT_CONVERSION_PROMPT.md).

## Status: Phase 6 (polish) — complete

Done so far:
- **Monorepo** (npm workspaces): `apps/web`, `apps/api`, `packages/shared`, `packages/grd`, `e2e`
- **`@dd/grd`** — 13 passing unit tests, verified against the bundled `TOP_HITH_DEPTH.grd` Petrel grid:
  - `parseGrd` — ASCII grid parser (FSASCI header, ! metadata, column-major float data)
  - `gridRange`, `cellAt`, `gridToBytes`, `gridFromBytes`
  - `volumeBetween` — sum & 2×2 Simpson volume between horizons
  - `extractContours` / `suggestLevels` — marching-squares iso-line extraction
  - `sample` / `rampStops` — spectrum/grayscale/warm color ramps
  - `sampleLine` — bilinear-interpolated line slice through a grid (for cross-sections)
- **`@dd/shared`** — 47 passing unit tests:
  - Unit conversion (cm/m/km/ft/yd/mi/nmi, deg/rad, DLS), ported from `Unit23.pas`
  - Core math primitives — `surToVct`, `vctToSur`, `rotateAboutAxis`, `projectToPlane`, `unprojectFromPlane`, `azmFind`, `incFind` — ported from `Unit02.pas`
  - **All trajectory builders** ported from `Unit02.pas`: `hold`, `c3`, `sursta`, `hoctt`, `hc3dtft`, `ch3dffk`, `ch`, `hch`, `ch2dc1`, `ch2dc2`, `cc2d`
  - **Profile-type code mapping** (codes 0–103) from `Unit04.pas`/`Unit05.pas`/`Unit06.pas`
  - **Dispatcher** (`dispatch()`) — port of `Button3Click` orchestrator; chooses the right builder per segment, projects to 2D, translates back to 3D world coordinates
  - Zod schemas shared with the API
- **`@dd/api`**: Fastify + Prisma + SQLite with full CRUD for Project / Country / Field / Well / Calculation; `POST /calculations/:id/calculate` runs the dispatcher and persists stations; `GET /calculations/:id` includes the full parent chain (well → field → country → project) for report headers. Plus grid routes (`GET/POST /fields/:id/grids`, `GET/DELETE /grids/:id`, `POST /grids/volume`) and `GET /fields/:id/wells-with-paths` for the field-map overlays.
- **`@dd/web`**: React 18 + Vite + Tailwind + TanStack Query + React Router with:
  - Project list + nested explorer (Country → Field → Well → Calculation)
  - **Field Map page** (`/fields/:id/maps`) — three tabs:
    - **2D Map** — upload `.grd` files, colored raster + contour overlay + well triangles + paths + hover cell value
    - **Cross-section** — click two points on the map (A, B), shows the elevation profile along the line
    - **3D View** — grid surface as a triangle mesh coloured by depth, wells rendered as tubes
  - **Survey / Well-Design Editor** with 5 tabs:
    - **Grid** — editable segment table, profile picker modal, calculate button, live stations table
    - **3D View** — wellbore tube rendered with React Three Fiber + drei (orbit camera, ground grid, compass markers, wellhead/target spheres). Replaces `Form03`.
    - **Vertical Section** — Recharts line chart (VSEC × TVD with reversed Y). Replaces `Form10.Chart1`.
    - **Plan View** — Recharts scatter chart (EW × NS). Replaces `Form10.Chart2`.
    - **Export** — landscape A4 PDF (via pdfmake, matches `Unit10.RvSystem1Print` layout) and .xlsx (via SheetJS, columns match `Unit10.SaveAsExcelFile`)
- **Phase 6 polish**:
  - **Code-splitting**: initial JS bundle dropped from 4.1 MB to 153 kB (gzip 45 kB). Three.js (1.1 MB), pdfmake (2 MB), xlsx (285 kB), recharts (395 kB) all load on demand via React.lazy + Vite manual chunks
  - **Undo/redo** on the segment grid via `useHistoryState` (50-deep history, Ctrl+Z / Ctrl+Shift+Z hotkeys, dedicated toolbar buttons). Hotkeys are skipped when typing in an input so native browser undo still works there
  - **Debounced autosave** — segments save 1.5 s after the last edit, with a "Saved 12s ago / Saving… / Unsaved changes / Save failed" status pill in the toolbar
  - **Azimuth picker** — proper dispatcher disambiguation for "starred" profiles where `azmFind` returns two candidates. Toolbar dropdown ("Azm: Branch 1 / Branch 2") persists per-calc in localStorage; backed by `DispatchOptions.azimuthChoice` end-to-end
  - **CSV importer** — bulk-load `countries.csv` + `fields.csv` + `wells.csv` + `calculations.csv` + `segments.csv` (column names match the Pascal `CREATE TABLE`s). Wipes & replaces the project's tree in one transaction. Replaces the deferred `.mdb` importer (see [PHASE5_NOTES.md](PHASE5_NOTES.md))
  - **Fixture test scaffold** ([`packages/shared/test/fixtures.test.ts`](packages/shared/test/fixtures.test.ts)) — drop `*.input.json` + `*.expected.json` pairs into `packages/shared/test/fixtures/` and they're automatically loaded and compared to `dispatch()` output within ±1e-6. Currently skipped (no fixtures bundled — see fixtures/README.md for how to capture from MIXED.exe)
  - **Playwright E2E** scaffold in `e2e/` with a happy-path test (create project → tree → HC3D segment → calculate → station count assert). Run locally with `npm --workspace e2e test`; CI integration deferred

End-to-end verified through Phase 6: HC3D trajectory lands at exact target coordinates; `TOP_HITH_DEPTH.grd` round-trips through the API as the expected 1,153,740 bytes (depth range 3460–5680 m matches the Petrel original); marching-squares contours draw cleanly; volume between identical horizons = 0 m³; initial JS bundle reduced 27×; **47 + 13 unit tests pass + 1 fixture suite ready to receive fixtures**.

Not done yet:
- Stereo / anaglyph cameras (low value vs. orbit controls — most users would skip it)
- Casing / BHA / Mud / Hydraulics designers: **never finished in the original** (all `CREATE TABLE` statements for BD/CD/MD/HD are commented out in `Unit01.pas:940-1210`); see PHASE5_NOTES.md
- Legacy `.mdb` importer: **not feasible server-side without ODBC** — CSV importer (above) is the practical substitute; see PHASE5_NOTES.md
- Captured fixture pairs to actually exercise the fixture test (needs a Windows machine with MIXED.exe — scaffolding is ready)

## Prerequisites

- Node 20+
- npm 10+ (workspaces support)

## First-time setup

```bash
# 1. Install all workspace dependencies
npm install

# 2. Set up the API database
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
npm run dev:api
# → http://localhost:4000  (health check: /health)
```

In another:

```bash
npm run dev:web
# → http://localhost:5173
# Vite proxies /api → http://localhost:4000
```

Or both at once:

```bash
npm run dev
```

## Tests

```bash
npm test                                 # 47 shared + 13 grd unit tests
npm --workspace e2e test                 # Playwright happy-path (needs servers running)
```

The unit suite enforces numerical fidelity for the trajectory math primitives
and the .grd parser/contour/volume code. The fixture suite at
[`packages/shared/test/fixtures/`](packages/shared/test/fixtures/) compares
`dispatch()` output against captured MIXED.exe runs within ±1e-6 — it starts
empty and auto-skips; see that directory's README for how to capture pairs.

## Project layout

```
/apps
  /web           React + Vite frontend (port 5173)
    /src
      /api       Typed fetch client
      /components  Shared components (3D viewers, charts, map)
      /export    PDF + XLSX generators (lazy-loaded)
      /hooks     useHistoryState (undo/redo)
      /import    CSV → import-payload converter
      /pages     Route components (lazy where heavy)
      /shell     App shell / nav
  /api           Fastify backend (port 4000)
    /prisma      schema.prisma + migrations
    /src
      /routes    REST endpoints
/packages
  /shared        Types, zod schemas, units, trajectory math, dispatcher
  /grd           .grd parser + volume + contours + colour ramps + line sampler
/e2e             Playwright happy-path tests
/old_delphi_code Reference (read-only)
REACT_CONVERSION_PROMPT.md  Full specification
PHASE5_NOTES.md             Why .mdb importer + casing/BHA/mud are deferred
```

## Architecture rules

- All trajectory math lives in `packages/shared` so the UI can preview locally
  and the API can recompute on save. No duplication.
- All angles stored in **radians**; all distances in the project's storage length
  unit. Convert only at the UI boundary.
- TypeScript strict mode throughout; no `any`.
- The Delphi sources are the source of truth for algorithm behaviour. When porting,
  cite the file + line in a comment.

## Future enhancements (post-Phase-6)

1. **Capture fixtures from MIXED.exe** to actually pin numerical fidelity (see `packages/shared/test/fixtures/README.md`)
2. CI wiring for Playwright + fixture tests
3. Multi-user auth + authorization on the API
4. PostgreSQL deployment target (Prisma makes this a one-line swap)
5. WebXR / VR navigation in the 3D field viewer
6. The casing / BHA / mud / hydraulics designers — these would be net-new features (see PHASE5_NOTES.md for why they're not part of the migration)
