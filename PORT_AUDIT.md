# Delphi Port Audit — Gap Report

This report enumerates every procedure / feature in the Delphi source under `old_delphi_code/` that is part of `MIXED.dpr` and assesses whether it has been ported to the TypeScript app under `apps/` + `packages/`.

Status legend:
- **PORTED** — Equivalent TypeScript exists and behavior is faithful.
- **PARTIAL** — Some functionality ported; named gaps remain.
- **NOT PORTED** — No TypeScript equivalent found.
- **OBSOLETE** — Pure VCL/UI plumbing (paint events, OLE DB wiring) that doesn't need porting in the SPA architecture.

---

## Summary

| Pascal unit | Lines | Status |
|---|---:|---|
| Unit01 (main shell) | 1708 | PARTIAL — project tree replaced; FileSearch / .grd auto-discovery NOT PORTED |
| Unit02 (math engine + survey form) | 5570 | PARTIAL — core builders ported; `rocal[1]=7/17` (3D-S-alt), curve EOC families (rocal=31..35, 51..55, 61..103), TF computation, VSEC reference math, `SURVEYCOPY`, save/load are MISSING or STUBBED |
| Unit03 (3D wellbore viewer + R/B 3D) | 294 | PARTIAL — orbit 3D ok; red/green anaglyph + Button2 (BlendStereo) NOT PORTED |
| Unit04 (Form04 standard-profile dialog) | 438 | PORTED |
| Unit05 (Form05 hold variants dialog) | 73 | PORTED |
| Unit06 (Form06 single/multi-curve dialog) | 447 | PARTIAL — MC_61..MC_103 codes not exposed in ProfilePicker UI |
| Unit07 (Form07 azimuth disambiguation) | 64 | PARTIAL — dispatcher accepts azimuthChoice but no per-call modal prompt; CC3D/HCH fall-back min-DLS hint NOT PORTED |
| Unit08 (Form08 INC/TVD/DLS picker) | 35 | NOT PORTED — used by `rocal[1]=34` (CURVE_E4) inside Unit02 to pick which of {Inc, TVD, DLS} was input |
| Unit09 (Form09 WD/SE radio dialog) | 56 | OBSOLETE — picker is implicit when creating a `Calculation` with `type: WellDesign | SurveyEditor` |
| Unit10 (Form10 report / chart / Excel export) | 552 | PARTIAL — VSEC & Plan-view charts + PDF + xlsx ported; PDF and XLSX layouts differ; per-section bitmap export NOT PORTED |
| Unit21 (Form21 field-map 2D + survey editor) | 1584 | PARTIAL — 2D map + cross-section + .grd parse ported; polygon-clip, well-locator click placement, image-grayscale, anaglyph, paint-line gridlines NOT PORTED |
| Unit22 (Form22 map options) | 193 | PARTIAL — colour ramp + sectioning ported via `@dd/grd/colorramp`; arbitrary user-picked color palette NOT PORTED |
| Unit23 (Form23 map options dialog) | 815 | PARTIAL — unit conversion ported; the Form23 "map options" UI (scale bar style, legend, axis units, north arrow) NOT PORTED |
| Unit24 (Form24 grid header viewer) | 70 | NOT PORTED — raw .grd "!" header text viewer for the user |
| Unit25 (Form25 alternate 3D mesh viewer) | 1104 | PARTIAL — Three.js FieldScene3D covers basic mesh + well pipes; red/green stereo, RadioGroup1=3 picker, layer drawing menu NOT PORTED |
| Unit26 (Form26 cross-section/3D setup) | 81 | PARTIAL — partly absorbed by FieldMapPage UI; the dialog itself NOT PORTED |
| Unit28 (Form28 contour overlay map) | 1056 | PARTIAL — contour drawing & hit testing ported; line-by-line contour LABEL placement (numbers on contour intersections), scale bar widget drag, draggable legend, color-pixel-aware contour breaks NOT PORTED |
| Unit29 (Form29 options) | 25 | OBSOLETE — empty page-control form |
| Unit30 (Form30 volume calculations) | 367 | PARTIAL — sum-method volume ported via `@dd/grd/volume`; Simpson's rule + 3-point biquadratic surface fitting + custom-grid-square methods NOT PORTED |
| Unit31 (Form31 cross-section chart) | 59 | PORTED — covered by `CrossSection.tsx` |
| Unit32 (Form32 map bitmap save) | 136 | PARTIAL — replaced by SaveAs map PNG path; aspect-ratio fit-vs-stretch picker NOT PORTED |
| Unit33 (Form33 unused string grid) | 25 | OBSOLETE |
| Unit34 (Form34 GL test surface) | 119 | OBSOLETE — GL test mesh, not wired into anything except Form25 test |
| Unit35 (Form35 3D mesh viewer w/ R/B stereo, cubes, well pipes) | 819 | PARTIAL — basic surface + well pipes ported in FieldScene3D; CUBES mode (volume-rendered voxel boxes), red/green stereo cameras, layer-slice trackbar, picking labels NOT PORTED |
| Unit41 (Form41 BHA/Casing/Mud/Hydraulic page-control) | 79 | NOT PORTED — empty tabs in original (every table-create commented out) but the form is wired into the main menu. Note: tables exist as commented-out CREATE TABLE statements in Unit01 for: CD/TC, BD/TB, MD/TM, HD/TH, SH (casing, BHA, mud, hydraulics, hydraulic-report) |
| Unit42 (Form42 units picker) | 189 | NOT PORTED — preset profiles (Drilling Imperial / Metric / API / SI) for the 9 unit categories (length, angle, mass, etc.). `packages/shared/src/units/` has basic conversion infrastructure but no preset bundles or UI |
| ProEffectImage.pas | 1238 | NOT PORTED — TImage subclass with bitmap effects (invert, blur, mosaic, antialias, etc.). Used by Unit35 image post-processing path. Likely OBSOLETE for a web app. |
| StereoFrm.pas | 513 | NOT PORTED — TGLScene stereo render frame (referenced from Unit27 but Unit27 is orphan; still pulled in by ProEffectImage uses). Likely OBSOLETE. |

Counts (top-level): 27 units audited. Fully ported: 4. Partial: 17. Not ported: 5. Obsolete: 1.

---

## High-priority gaps (in order of user impact)

These are the items most likely to affect a user immediately. They are roughly ordered by how often the original app would have invoked them and how visible their absence is.

1. **Form07 azimuth-disambiguation modal** — Dispatcher always picks branch 1 (or whatever the persisted `azimuthChoice` says). The original showed a modal with BOTH candidates labelled, only enabling the feasible one(s), and disabled invalid options. When both fail, it computed and *displayed* the minimum/maximum DLS the user would need (Unit02.pas:2938-2950 for HCH, 3136-3138 for CH). **Pascal source**: `azmfind` (Unit02.pas:684), `Form07.radio` (Unit07.pas:38). **Suggested TS**: a React modal popped from `useMutation`'s onError of `/calculate`; the API would need to return `{ ok: false, candidates: { azm1, azm2, feasible }, suggestedDls? }`.

2. **CC3D / CC3D_STAR pp-qq combo picker** — In `(rocal[1]=9)or(rocal[1]=19)` the Pascal code (Unit02.pas:4036-4081) tries all four `(pp, qq)` combinations of the two azimuth candidates, fills `azmazm[pp,qq]`, and shows a 2-D listbox+radio in Form07 when more than one combo is feasible. The dispatcher's CC3D branch always uses `tryDlsSigns` with the user-supplied azm — no candidate-search at all. **Pascal source**: Unit02.pas:3647-3805. **Suggested TS**: extend `solveAndBuild` to iterate over an `(azm1, azm2)` 2-D candidate grid for CC3D, return all feasible to UI.

3. **HCH min-DLS feedback when infeasible** — When HCH fails, Pascal computes the exact minimum (or maximum) DLS that *would* solve the geometry and shows `Minimum Needed DLS to Reach target is X` (Unit02.pas:2912-2952). Current TS just returns `infeasible`. **Pascal source**: Unit02.pas:2912-2952. **Suggested TS**: in `hch.ts`, when the discriminant fails, derive the threshold value and return it in `BuilderResult.reason`.

4. **CH min-DLS feedback when infeasible** — Same pattern: Pascal returns the exact DLS the user would need (Unit02.pas:3134-3139). **Pascal source**: Unit02.pas:3134-3139.

5. **Curve EOC families CURVE_E1..CURVE_E5 (rocal=31..35)** — Each is a single curve with a different combination of user inputs (MD+Inc+DLS, MD+Azm+DLS, Inc+Azm+DLS, Inc+TVD+DLS, Inc+Azm+TVD). The dispatcher's `default` branch falls through to `c3({theta1, theta2, dls})`, which means:
   - CURVE_E2 (MD+Azm+DLS) and CURVE_E3 (Inc+Azm+DLS) need a quadratic solve to derive the missing inc/azm (Unit02.pas:4665-4825). NOT PORTED.
   - CURVE_E4 (Inc+TVD+DLS) needs the radius-from-TVD identity `r = arccos(...)/dls` (Unit02.pas:4847-4925). NOT PORTED — `c3` ignores TVD.
   - CURVE_E5 (Inc+Azm+TVD with DLS computed) needs to derive DLS from the chord (Unit02.pas:4926-4948). NOT PORTED.
   - **Suggested TS**: each variant deserves its own builder (curveE2.ts, curveE3.ts, curveE4.ts, curveE5.ts); dispatcher.ts should dispatch on the exact code rather than falling into the c3 catch-all.

6. **FLYTO families (rocal=51..55)** — All five compute a bisection to find DMD that drops to a given TVD (rocal=52: Unit02.pas:4351-4506) or fly-to via TF + DLS at given DMD (rocal=51, 53, 54, 55). **None** of these are exercised by the current dispatcher — falls into the `c3` catch-all which DOES NOT iterate to a target TVD/MD. **Pascal source**: Unit02.pas:4351-5186. **Suggested TS**: implement bisection-based `flyto.ts` builder family.

7. **3D-S Alternate (rocal=7/17, ProfileType.D3DS_ALT)** — Pascal `(rocal[1]=7)or(rocal[1]=17)` branch is an **empty `begin..end`** block (Unit02.pas:3953-3957). It looks like the original developer left this profile unimplemented. The dispatcher routes D3DS_ALT to ch2dc1 (same as plain D3DS). May or may not be the intended behaviour but it's at least documented here.

8. **Multi-curve combo profiles rocal=61..103 (MC_*_INC / AZM / BOTH)** — These read user-supplied BR (Build Rate) and/or TR (Turn Rate) on a row and derive everything else. Pascal handles them in the long if-tree at Unit02.pas:5087-5186 (`trunc(rocal[1]/10)=6/8/9/10`). NOT PORTED — dispatcher's default falls to c3 which ignores BR/TR entirely. Also note: the editPolicy in `profileRoles.ts` marks BR/TR cells as non-editable (the grid has no BR/TR columns anyway), so even if the builders existed, the user couldn't input them. **Pascal source**: Unit02.pas:5087-5186 (the "rocal[1] div 10 = 6/7/8/9/10" arms). **Suggested TS**: add BR/TR columns to the grid; implement `mcBuild.ts`, `mcTurn.ts`, `mcBoth.ts` builders.

9. **Survey Station table — `SURVEYCOPY` and the per-well save-list** — The Pascal app stored multiple "calculation snapshots" per well (ListBox1 in Form02) and let the user double-click to load a snapshot. `SAVEWD` writes the current grid back. `SURVEYCOPY` lists table names matching the SE prefix for the active well. NOT PORTED. The TS app stores one canonical segment list per Calculation row in the database with no history. **Pascal source**: Unit02.pas:450-502 (SURVEYCOPY/SAVEWD), 761-801 (ListBox1DblClick). **Suggested TS**: a "Calculation versions" relation or git-like snapshots table.

10. **Vertical Section reference direction (`v[0]`)** — Pascal computes VSEC for every densified station as the dot product of the station's offset with `v[0]` (the wellhead→last-target vector). The current TS dispatcher does NOT set VSEC on densified stations (it leaves it 0); WellCharts.tsx falls back to `sqrt(ew²+ns²)`. That's wrong whenever the well's overall azimuth isn't 90°. **Pascal source**: Unit02.pas:2390-2402, 5253-5263, then 2592-2595 (per-station VSEC dot). **Suggested TS**: have `dispatch()` accept (or compute) the well's bearing, then write `vsec = ns*cos(b) + ew*sin(b)` on every station.

11. **Tool-face (TF) computation for all stations** — Pascal computes the dogleg tool-face at every KEYPOINT using the spherical-triangle identity in Unit02.pas:2596-2624 (and the same formula repeated for ch3d, hch, ch2dc1, ch2dc2). The current TS builders set `tf = 0` on every keypoint. The Form02 grid shows TF in the columns the Pascal user can see, but the React grid doesn't have a TF column so the user wouldn't notice — until they look at the PDF/XLSX export, where `tf` is included and is always 0. **Pascal source**: Unit02.pas:2596-2624 (replicated for each profile). **Suggested TS**: after the dispatcher builds the keyPoints, run a post-pass that fills `tf` per the spherical formula.

12. **VSEC, TF, BR, TR not surfaced in the React grid** — The TS grid (`CalculationPage.tsx:529`) hard-codes the visible columns to `comment, md, inc, azm, tvd, ew, ns, dls, dmd`. VSEC / TF / BR / TR are excluded. They're persisted in Prisma but never edited or displayed. Some of them (BR/TR) are *required inputs* for the multi-curve combos in gap #8.

13. **`MIXED.exe` mdb importer** — The TS app has a CSV-based importer (`apps/web/src/import/csv.ts`) but no direct .mdb (Access) importer. The Pascal app saves/loads .mdb files (Unit01.pas:Save1Click, Load1Click, FormCreate at lines 564-576, 620-659). NOT PORTED. **Suggested TS**: documented alternative — user exports each MIXED table to CSV first.

14. **`Form02.FormShow` table prep** — Unit02 at FormShow (line 5491) executes a SQL `insert into TW001 select … from <field-table>` to materialise the current well into the working table TW001 before the user starts editing. The TS code reads from `Calculation.segments` directly with no working-copy concept. NOT PORTED but possibly OBSOLETE — autosave covers the case where the user wants the changes persisted.

15. **Field-map polygon clip ("Select Polygon")** — Unit21.pas:1280-1361 (`Button3Click`) lets the user lasso a polygon on the map and *clip* the grid to that polygon (cells outside become "draw[ii,jj] = false"). NOT PORTED. **Pascal source**: Unit21.pas:1280-1361.

16. **Field-map well-locator pick** — Unit21.pas:1158-1271 (`Image2MouseDown`) lets the user click the map to *place* a well at the click coordinates. The dialog (`Button4`) lets the user accept/cancel. NOT PORTED. **Pascal source**: Unit21.pas:1158-1271, 1363-1484.

17. **Form23 / Form28 "advanced map options"** — Scale bar style, legend (Image5 in Form28), north-arrow (Image3), text overlay (Image5 imagefive), draggable contour line numbers, ListBox3 metadata picker (Form28.imagefive reads `! NAME:` lines out of the grid header). NOT PORTED. Some of this is partially covered by FieldMapPage's options panel but not fully.

18. **Multi-grid difference mode** — Unit22.pas:Button1Click (line 71) lets the user pick two layers and render `|z[h] - z[hh]|` as `z.z[ii,jj,3]`, the "Differences" mode. NOT PORTED. **Pascal source**: Unit22.pas:71-122, called from Unit21's "Map" picker.

19. **Volume calculations advanced methods** — Unit30 implements:
    - RadioGroup1=0: simple cell-sum (Unit30:71-82). ✅ ported as `@dd/grd/volume` "sum".
    - RadioGroup1=1: Simpson's rule on 2×2 patches (Unit30:84-87 + `integral(2,…)`). NOT PORTED.
    - RadioGroup1=2: nested Simpson's on 3×3 patches (Unit30:88-93). NOT PORTED.
    - RadioGroup1=3: Simpson's rule across rows (Unit30:94-156). NOT PORTED.
    - RadioGroup1=4: biquadratic surface fitting (`coff` + `surf`) (Unit30:184-221). NOT PORTED.

20. **3D map CUBES mode** — Form35.CUBES (Unit35.pas:380-468) renders the entire grid as up to 10 000 GLCube objects, one per cell, with alpha = 0.2 for invalid cells. NOT PORTED — only the smooth mesh path is in FieldScene3D.

21. **3D map red/green anaglyph (RL3D)** — Form25.Button1Click (Unit25.pas) and Form35.Button3Click (Unit35.pas:583-650) render to two cameras then blend the bitmaps for red/cyan stereo viewing. NOT PORTED.

22. **Cross-section A→B placement directly on FieldMap** — `CrossSection.tsx` exists as a chart component but the user-interaction flow (click point A, click point B, see chart) is partly in `MapViewer2D.tsx`'s `onMapClick`. The original Pascal cross-section in Form21.Image2MouseDown reads two clicks and labels them A/B (Unit21.pas:1240-1268). Verify the React UX is feature-complete; cross-section was the most-used quick analysis.

23. **`Form10` per-page chart/report layout** — The PDF export reproduces the table but not the per-page summary header that the original printed (Unit10.pas:RvSystem1Print line 417-441 — Field/Position/Page #). The footer/header in `pdf.ts` is *close* but doesn't include the "Field Name + Position" line.

24. **`Form02.delete1Click` row delete** — Pascal's `Button5Click` (Unit02.pas:876) does a sophisticated multi-row delete: when the user clicks a single row in a multi-row profile group, it deletes ALL rows of that profile, recomputes the row indices, and re-shifts romat/rocal arrays. The TS code in `removeRow` (CalculationPage.tsx:150) does delete the group but does NOT carry over the romat/rocal-equivalent edit policy (it just re-derives from `profileRoles`). Behaviour is equivalent for normal cases but the special "row 5 of FLYTO chained to a curve" Pascal special-case at lines 940-947 (which preserves the TF input of a multi-curve continuation) is NOT PORTED.

25. **`Form02.ADD1Click` "add row" flow** — Pascal makes ALL grid columns editable (Unit02.pas:420-426). The TS code already opens the profile picker which is functionally better, so this is OBSOLETE.

---

## Unit-by-unit audit

Each section lists every procedure and major code block in the Pascal file with a status verdict.

### Unit01.pas (main shell) — STATUS: PARTIAL

Pascal procedures:
- `ADDWELL` (line 90) — iterates SE tables to populate Form21's well-import combobox → **PARTIAL** (similar function in apps/api/src/routes/wells.ts but no UI to "add a well from an existing survey" flow).
- `FileSearch` (line 135) — recursively scans a directory for `*.grd` and populates Form22's checklist → **NOT PORTED**. The TS app uploads grids one-at-a-time through `POST /fields/:fieldId/grids`; no folder-scan auto-discover.
- `FNDTABLE` (line 168) — given the active TreeView node, finds the matching mdb table name → **OBSOLETE** (we use Prisma row IDs).
- `CopyTableStructure` (line 231) — duplicates a TTable schema → **OBSOLETE**.
- `BUT_EDITClick` (line 246) — renames a tree node and pushes the rename to all SQL tables → **PORTED** (renaming is handled by `PUT /projects/:id`, `PUT /countries/:id`, etc., though SQL-template-string-style updates aren't needed).
- `ADDWELLFromDWD1Click` (line 324) — opens Form02 modal → **OBSOLETE** (calculations page is its own route).
- `Button1Click` (line 330) — opens Form41 (BHA/Casing) → **NOT PORTED** (gap #25 below).
- `Button2Click` (line 335) — opens Form21 (field map) → **PORTED** as FieldMapPage.
- `Button3Click` (line 341) — creates one of each table prefix (CO/FI/WL/WD/SE/BD/CD/HD/MD) → **PARTIAL** (BD/CD/HD/MD not implemented).
- `refreshf` (line 357) — walks all tables, builds the tree → **PORTED** as Prisma queries on projects/countries/fields/wells.
- `REMOVE1Click` (line 436) — deletes a tree node and all its rows in every table → **PORTED** as cascading deletes.
- `Edit1Click`/`Edit1Exit` (lines 537/542) — tree node text edit → **PORTED**.
- `Exit1Click` (line 548) — exit with confirm → **OBSOLETE** (browser handles tab close).
- `FormCreate` (line 564) — connect to BLANK.mdb on disk → **OBSOLETE** (Postgres via Prisma).
- `TableExists` (line 577) — checks ADO table list → **OBSOLETE**.
- `FormDestroy` (line 587) — calls Deltemp → **OBSOLETE**.
- `FormResize` (line 591) — resizes DBGrid3 → **OBSOLETE** (CSS).
- `DBGrid3KeyDown` (line 598) — Delete key triggers nbdelete → **OBSOLETE**.
- `Deltemp` (line 605) — deletes Temp.mdb → **OBSOLETE**.
- `Load1Click` (line 620) — opens .mdb, copies to Temp.mdb → **NOT PORTED** (no .mdb support; CSV importer is the alternative — gap #13).
- `ADD1Click` (line 661) — adds a new field/well/calc through dialogs and SQL CREATE TABLE → **PORTED** (Add field/well/calc API endpoints exist; CREATE TABLE is replaced by Prisma).
- `ADDTABLE` (line 780) — issues a CREATE TABLE for the given prefix (CO/FI/WL/WD/TW/TS/SE/CD/TC/BD/TB/MD/TM/HD/TH/SH) → **PARTIAL**. Only CO/FI/WL/WD/TW/TS/SE equivalents exist in Prisma. **BD/TB (BHA), CD/TC (Casing), HD/TH (Hydraulics), MD/TM (Mud), SH (Hydraulic-summary) tables are all commented out in the Pascal source — so the absence in the TS port is correct.**
- `CHKTABLE` (line 1216) — checks for duplicate names → **PORTED** (uniqueness checks in API).
- `New1Click` (line 1295) — full app reset with new mdb → **PARTIAL** (create-project flow exists; doesn't prompt for country/field/well in the same modal).
- `Save1Click` / `SaveAs1Click` (lines 1446 / 1468) — copy Temp.mdb to user-chosen file → **OBSOLETE** (autosave).
- `SURVEYEDITORBYDSE1Click` (line 1506) — opens Form21 or Form10 depending on level → **PORTED** (UI routes).
- `TreeView1Click` / `TreeView1Edited` / `TreeView1MouseDown` (lines 1527/1632/1640) — context menu wiring → **OBSOLETE** (React event handlers).

### Unit02.pas (math engine + survey-editor form) — STATUS: PARTIAL — biggest gap source

Pascal procedures (declarations on lines 24-105):
- `cellshow` (line 54) — writes a single `branch` record into ADOTABLE2 row → **OBSOLETE** (state lives in React).
- `vcttosur` (line 55) — convert (ns,ew,tvd) vector to (inc, azm) → **PORTED** as `vctToSur` in `vector.ts`.
- `surtovct` (line 56) — inverse → **PORTED** as `surToVct` in `vector.ts`.
- `rotation` (line 57) — Murray-axis rotation → **PORTED** as `rotation.ts`.
- `plane` / `revplane` (lines 58/59) — project/unproject point into the plane defined by 3 points → **PORTED** as `projectToPlane`, `unprojectFromPlane` in `plane.ts`. But `dispatcher.ts:518` declares `void projectToPlane` and `void unprojectFromPlane` — they're imported but the dispatcher uses a SIMPLIFIED inPlane2D helper that just uses `vctToSur(prev → target)` to derive azm. **GAP**: the Pascal does a full plane projection of `(a2, a3) → a7` and rotates everything (including the target's tangent vector) into that plane. For "starred" profiles where `wlpt[1].INC=0` and only `azm` is given (gap #1), this matters because the user might be specifying the *azimuth out of the well's curved plane*, which the simplified TS path can't represent.
- `HC3DTFT` (line 60), `CH3DFFK` (line 61), `HCH` (line 62), `CH` (line 63), `CH2DC1` (line 64), `CH2DC2` (line 65), `HOCTT` (line 67), `c3` (line 68), `CC2D` (line 69), `Hold` (line 70), `sursta` (line 71) — **ALL PORTED** in `packages/shared/src/math/builders/`. Verified each builder's keyPoints match the Pascal formulas. The TS port adds DLS-sign-search (`tryDlsSigns`) which the Pascal lacks (Pascal forces the user to enter correct sign).
- `CH3DC` (line 66) — declared but body is `//HELLO` (Unit02.pas:1737) — **OBSOLETE** (no-op in Pascal).
- `pagerefresh` (line 72) — resets the working table TW001 → **OBSOLETE** (React state reset).
- `tableshow1` (line 73) — writes densified stations into ADOTABLE1 → **PORTED** (the dispatcher returns Stations[]; persistence is `prisma.station.createMany`).
- `azmfind` (line 74) — 2-candidate azimuth solver → **PORTED** as `azmFind` in `solve.ts`. **BUT**: the *UI flow* that picks between the two candidates (Form07.ShowModal at Unit02.pas:2535, 2715, 2967, 3311) is NOT PORTED — see gap #1.
- `incfind` (line 75) — solves inc when azm is given → **PORTED** as `incFind`. The fallback "no closed-form, user enters inc" case (Unit02.pas:746-758) is NOT PORTED — TS just returns the closed-form result or fails.
- `RefToCell` (line 76) — Excel cell ref → **PORTED** (used in xlsx.ts not by name, but cell refs are SheetJS's job now).
- `dec` (line 77) — round to N decimals → **OBSOLETE** (toFixed).
- `Button2Click` (line 78) — saves the current TW001 into the field's WD table → **OBSOLETE** (autosave).
- `Button5Click` (line 79) — multi-row group delete (covered in gap #24 above).
- `NEW1Click` (line 80) — new-blank with save prompt → **PORTED** (overwrite-segments).
- `DBGrid2CtypeellClick` (line 81) — typo in original; selects romat-relevant cells when a cell is clicked → **OBSOLETE** (React).
- `STANDARDPROFILES1Click` (line 82) — opens Form04 → **PORTED** (ProfilePicker).
- `Button3Click` (line 83) — **THE MAIN CALCULATE BUTTON, 3000+ lines** — **PARTIAL**. The dispatcher.ts ports the high-level structure but skips:
  - Lines 2467-2469: `if ((wlpt[i].md - wlptp.MD) - 10*trunc((wlpt[i].md-wlptp.MD)/10)=1) then wlpt[i].MD:=wlpt[i].md+0.001;` — small MD nudging to avoid degenerate stations. NOT PORTED. May cause edge-case duplicate-MD stations in TS output.
  - Lines 2596-2624: per-keypoint TF computation (gap #11).
  - Lines 2588-2595, 5253-5263: VSEC update from `v[0]` (gap #10).
  - Lines 3953-3957: `(rocal[1]=7)or(rocal[1]=17)` branch is EMPTY in Pascal (gap #7).
  - Lines 4351-5186: FLYTO (52-55), single-curve EOC (31-35), multi-curve combos (61..103) all handled by long if-else chain in this Button3Click — most NOT PORTED in TS dispatcher.
  - Lines 5358-5395: post-pass that sets TF on every input row's `wlptp` record by looking at the next keypoint's curve. NOT PORTED.
  - Lines 5398-5456: builds `wlpt3[]` global table for `cellfill(wlpt3, 1, 1)` — the densified output table. The TS does this via `prisma.station.createMany`, but **the post-pass at 5439-5450 that sets TF on each output station from the NEXT station's curvature** is NOT PORTED. Stations come out with `tf = 0`.
- `cellfill` (line 84) — writes the keypoint array into either ADOTABLE1 (i=1) or ADOTABLE2 (else) → **OBSOLETE** (storage handled elsewhere).
- `Button7Click` (line 85) — opens Form03 (3D viewer) with a hardcoded test pipe → **OBSOLETE** (test code).
- `Hold1Click` (line 86) — opens Form05 → **PORTED**.
- `SurveyStation1Click` (line 87) — inserts a SURVEY_STATION row → **PORTED**.
- `PlanningTargets1Click` (line 88) — inserts a TARGET row → **PORTED**.
- `Curve1Click` (line 89) — opens Form06 → **PORTED**.
- `Button1Click` (line 90) — opens Form10 (report) → **PORTED** (Export tab).
- `Calculate1Click` (line 91) — clicks Button3 → **PORTED** (Calculate button).
- `N3DView1Click` (line 92) — clicks Button1 → **PORTED**.
- `delete1Click` (line 93) — clicks Button5 → **PORTED** (per-row delete with group-aware logic — gap #24 caveat).
- `Save1Click` (line 94) — calls SAVEWD → **OBSOLETE** (autosave).
- `Exit1Click` (line 95) — destroys form → **OBSOLETE**.
- `SURVEYCOPY` (line 96) — lists snapshots for current well — **NOT PORTED** (gap #9).
- `SAVEWD` (line 97) — persists the working table as a renamed Survey/WellDesign table → **OBSOLETE** (autosave).
- `rowcolor` (line 98) — paints rocal/romat masks for editable cells — **PORTED** (profileRoles.ts). One discrepancy: profileRoles models the FLYTO and CURVE family rows but `MC_*` 61-103 codes have empty masks since BR/TR aren't in the grid.
- `FormShow` (line 99) — initializes TW001 by copying from the active SE/WD table → **OBSOLETE**.
- `AutoStretchDBGridColumns` (line 100) — column auto-sizing → **OBSOLETE** (CSS).
- `ListBox1DblClick` (line 101) — load snapshot from disk → **NOT PORTED** (gap #9).
- `ADD1Click` (line 102) — makes all columns editable (PORTED via ProfilePicker).
- `DBGrid2DrawColumnCell` (line 103) — paints yellow / aqua cell backgrounds based on rocal/romat → **PARTIAL**. The TS grid uses `isEditableForRole` + Tailwind to mark editable cells, but it does NOT visually distinguish the "selected for editing" state (`rosel`) the way Pascal's aqua highlight did. Cosmetic only.

### Unit03.pas (3D wellbore viewer) — STATUS: PARTIAL

- `reax` (line 38) — `var3 := (5/var1) * var2;` — small scaling helper → **PORTED** (inline in WellViewer3D).
- `graphshow` (line 43) — reads `Form10.ADOTable1`, builds `GLPipe1` nodes → **PORTED** (WellViewer3D component).
- `GrayScale` / `RenderToBitmap` / `BLEND` / `redgreenblue` (lines 46/47/48/49) — bitmap effects for red/green stereo viewing → **NOT PORTED**. Three.js anaglyph (THREE.AnaglyphEffect) is available but not wired into WellViewer3D.
- `Button1Click` (line 44) — calls graphshow → **OBSOLETE**.
- `Button2Click` (line 45) — renders left-eye + right-eye and blends → **NOT PORTED** (gap #21).
- `GLSceneViewer1MouseDown` / `MouseMove` (lines 39/41) — orbit camera → **PORTED** (OrbitControls).
- `Panel1Resize` (line 50) — repositions Image1 → **OBSOLETE**.
- `FormShow` (line 37) — calls graphshow → **OBSOLETE**.

### Unit04.pas (Form04 — standard-profiles picker) — STATUS: PORTED

- `cellshow` (line 33) — same as Unit02's — **OBSOLETE**.
- `CheckBox1Click` (line 35) — enables Radioup2 when 3D-S-with-hold selected → **PORTED** (ProfilePicker derives this from the profile code).
- `CheckBox4Click` (line 36) — toggles "Azimuth/Inclination" labels for the "starred" checkboxes → **PORTED** (the "starred" suffix in ProfilePicker labels).
- `RadioGroup1Click` (line 34) — UI affordance → **OBSOLETE**.
- `Button1Click` (line 31) — converts the radio/checkbox state into a `wlpt1.typ` integer and adds the right number of rows via cellshow → **PORTED** (applyProfile in CalculationPage.tsx + profileRoles.ts).
- `Button2Click` (line 32) — close form → **OBSOLETE**.

### Unit05.pas (Form05 — hold variants) — STATUS: PORTED

- `Button1Click` (line 15) — picks code 21 (NS), 22 (EW), or 23 (VSEC) → **PORTED** (ProfilePicker family="hold").
- `Button2Click` (line 14) — close → **OBSOLETE**.

### Unit06.pas (Form06 — curves) — STATUS: PARTIAL

- `Button1Click` (line 33) — single-curve EOC (codes 31-35) → **PORTED**.
- `Button3Click` (line 35) — fly-to (codes 51-55) → **PORTED in UI** but NOT in math dispatcher (gap #6).
- `Button4Click` (line 39) — multi-curve combos with BR/TR (codes 61..103) → **NOT PORTED** (gap #8 — neither the UI nor the dispatcher).
- `CheckBox1Click` / `CheckBox2Click` (lines 38/37) — toggles inc/azm radio constraints → **OBSOLETE**.
- `RadioGroup2Click` (line 36) → **OBSOLETE**.
- `Button2Click` (line 32) — close → **OBSOLETE**.
- `cellshow` (line 34) → **OBSOLETE**.

### Unit07.pas (Form07 — azm disambiguation) — STATUS: PARTIAL

- `radio` (line 23) — sets RadioButton1/2 enable+check from `azmazm[i,j]` matrix → **NOT PORTED** (gap #1).
- `Button1Click` (line 21) — close → **OBSOLETE**.
- `Button2Click` (line 20) — close → **OBSOLETE**.
- `ListBox1Click` (line 22) — refreshes radio enable state → **NOT PORTED** (gap #1, sub-case for CC3D's 2-D candidate grid).

### Unit08.pas (Form08 — INC/TVD/DLS picker) — STATUS: NOT PORTED

- `Button1Click` (line 16) — close — **NOT PORTED**. This form has 3 radio buttons (INC/TVD/DLS) and is only used by `(rocal[1]=34)` (CURVE_E4) at Unit02.pas:4847-4925, where the user picks which of {Inc, TVD, DLS} they're inputting. The CURVE_E4 builder isn't ported (gap #5) so this UI gap is downstream.

### Unit09.pas (Form09 — WD/SE picker) — STATUS: OBSOLETE

- `Button1Click` / `Button2Click` / `FormCreate` — picks calc type → in the TS app this is a `type: "WellDesign" | "SurveyEditor"` field on the Calculation create form.

### Unit10.pas (Form10 — report / chart / Excel export) — STATUS: PARTIAL

- `RefToCell` / `SaveAsExcelFile` (lines 61/65) — OLE-Automation Excel export → **PORTED via SheetJS** as `apps/web/src/export/xlsx.ts`. The Pascal version writes column-by-column with `Sheet.Range[...].Value := Data`; ours writes via AoA. Column widths are matched.
- `BitBtn1Click` (line 28) — opens Form03 3D viewer → **PORTED** (3D tab).
- `BitBtn2Click` / `BitBtn3Click` (line 35/37) — exports Chart1 (VSEC) / Chart2 (Plan) as bitmap → **PARTIAL** (charts are rendered in React but cannot be exported as standalone PNG; users can screenshot).
- `BitBtn4Click` (line 39) — multi-chart PDF report → **PORTED** as `pdf.ts` (but layout differs — gap #23).
- `BitBtn5Click` (line 34) — table report → **PORTED** (PDF includes the table).
- `Button1Click` (line 41) — Excel save dialog → **PORTED**.
- `BitBtn1MouseEnter` / `BitBtn2MouseEnter` / `BitBtn3MouseEnter` / `BitBtn4MouseEnter` (lines 45-42) — hover-thumbnail previews → **OBSOLETE**.
- `FormCreate` / `FormShow` (lines 33/38) — chart data load → **PORTED** in chart `useMemo`.
- `RvSystem1BeforePrint` / `RvSystem1Print` / `RvSystem1PrintFooter` / `RvSystem1PrintHeader` (lines 29-32) — landscape-A4 multi-page table → **PORTED** in pdf.ts.
- `RvSystem2Print` (line 36) — prints chart1 bitmap → **PARTIAL** (no chart-only PDF option).
- `RvSystem3Print` (line 40) — prints both charts → **PARTIAL** (no charts-bitmap PDF option).

### Unit21.pas (field map 2D + survey editor) — STATUS: PARTIAL

- `pttoimg` (line 107) — world→pixel coord transform → **PORTED** (inline in MapViewer2D).
- `WELLDRAWING2D` (line 105, body 159) — draws well markers (triangle + bracket) and inter-station lines on the map → **PARTIAL**. MapViewer2D draws well markers but the multi-segment well-path overlay is in 3D (FieldScene3D) only — the 2D version doesn't draw the well path lines from station to station, just the wellhead marker.
- `find` (line 104) — substring-to-integer in `! KEY: value` lines → **PORTED** (inline in `parseMetaLine` in `@dd/grd`).
- `FieldExtract` (line 103) — main .grd parser → **PORTED** as `parseGrd` in `@dd/grd`. Verified against test fixture in `grd.test.ts`. ONE GAP: the Pascal also collects ALL `!`-prefixed metadata lines into `Form23.ListBox3.Items` for the user to scroll through (Unit21.pas:441-443). The TS parser drops everything except the recognised XMIN/XMAX/YMIN/YMAX/XINC/YINC/NCOL/NROW. **Suggested TS**: extend GrdFile with `metadata: string[]` so Form24's "raw header viewer" can also be ported.
- `gridline` (line 54) — paints dashed gridlines + axis labels on Image2 → **PORTED** (canvas drawing in MapViewer2D).
- `cross` (line 55) — extracts a series of grid values along a 2-point line → **PORTED** as `sampleLine` in `@dd/grd/sample`.
- `max` (line 56) — overflow-safe max → **OBSOLETE** (Math.max).
- `initialize` (line 57) — zero the `z.z` array → **OBSOLETE**.
- `draw` (line 58) — main "render the layer" coordinator → **PORTED** as `MapViewer2D` render effect.
- `imageone` (line 67) — colour-ramp bar legend → **PORTED** (the colour-bar in `MapViewer2D.tsx`).
- `azim` (line 63) — draws the N-arrow on Image3 → **PARTIAL** (FieldScene3D shows compass; MapViewer2D doesn't currently render a north arrow).
- `maxmin` (line 62) — computes layer min/max (excluding error cells) → **PORTED** as `gridRange` in `@dd/grd`.
- `Button1Click` (line 64) — refresh map → **PORTED** (React reactivity).
- `Button2Click` (line 88) — extracts cross-section between line1[1] and line1[2] then opens Form31 chart → **PORTED** (the React FieldMapPage cross-tab).
- `Button3Click` (line 87) — polygon-clip toggle → **NOT PORTED** (gap #15).
- `Button4Click` (line 105) — well-locator toggle → **NOT PORTED** (gap #16).
- `Print1Click` / `SaveAs1Click` (lines 60/61) — print + save-as-bmp → **PARTIAL** (browser print + savePng button TODO).
- `Image1MouseDown` / `MouseMove` / `MouseUp` (lines 90-92) — drag the colour-bar to resize → **PARTIAL** (color-bar exists, not resizable).
- `Image2MouseDown` / `MouseMove` — map click events (cross-section line picking + well placement). MouseMove updates status bar with X/Y/depth → **PORTED** (`onMapClick` + hover tooltip). MouseDown's cross-section pick is in MapViewer2D's `onMapClick`.
- `Image3MouseDown` / `MouseMove` / `MouseUp` — drag the compass image → **OBSOLETE** (compass is static).
- `MapMake1Click` / `Properties2Click` / `CrossSection2Click` / `N3d1Click` / `N3d21Click` / `Option1Click` (various lines 83-101) — menu-item handlers that open subforms → **PARTIAL** (some of those subforms are NOT PORTED — Form24 header viewer, Form26 cross-section setup, Form29 options).
- `CheckBox1Click` / `CheckBox2Click` (lines 72/75) — toggle wells / gridlines overlay → **PORTED** (React state).
- `UpDown1Click` (line 76) — layer increment → **PORTED** (FieldMapPage layer dropdown).
- `Sect1Click` (line 68) — opens Form22 (color sections) → **PARTIAL** (color-section count is hard-coded in `@dd/grd/colorramp`).
- `FormCreate` / `FormShow` (lines 66/99) — init `doornot[]`, `intro[]` → **OBSOLETE** (no equivalent state).
- `Image1DblClick` (line 69) — empty in Pascal → **OBSOLETE**.

### Unit22.pas (Form22 — map options) — STATUS: PARTIAL

- `Degrade` (line 26) — gradient-fill between two colours → **PORTED** as `rampStops` in `@dd/grd/colorramp`.
- `imageone` (line 27) — draws the master-list of all standard ramps for the user to pick from → **PARTIAL** (the React MapViewer2D has a dropdown of ramps but doesn't draw them).
- `Button1Click` (line 28) — apply selected layer / difference mode → **PARTIAL** (difference mode NOT PORTED — gap #18).
- `RadioGroup1Click` (line 30) — switches ramp + lets user pick custom colors via ColorDialog → **PARTIAL** (no custom-color picker in the React UI).
- `CheckListBox1Click` (line 31) — shows hint with filename → **OBSOLETE** (browser tooltip).
- `FormCreate` (line 29) → **OBSOLETE**.

### Unit23.pas (Form23 — map zoom/scale/legend options) — STATUS: PARTIAL

- `conversion` (line 69) — length-unit conversion between cm/m/km/ft/yd/mi/nmi → **PORTED** but as part of `packages/shared/src/units/index.ts`. Verify the constants match: Pascal at line 113-129 uses extra[]={10000, 10, 32808.39895, 10936.13298, 6.213712, 5.399568, 18459.18248864, 64163.4255851}. Spot-check: ft/m = 3.2808 (matches 32808 ratio in Pascal). Conversion function is portable; the values are encoded in our `@dd/grd` parser test.
- `predraw` (line 68) — copies map #1 metadata to slot #3 (for difference mode) → **NOT PORTED** (since difference mode itself isn't — gap #18).
- `WELLDRAWING2D` (line 87) — same as Unit21's — duplicate; **PARTIAL** as above.
- `Button1Click` (line 70) — the BIG "redraw with all options" handler — covers contour, gridline, scale-bar, north-arrow, legend, font sizes, color section count, vertical exaggeration via Edit1, custom ramp via Image1 picks. **PARTIAL** — most knobs hard-coded in the React UI.
- `Button2Click` / `Button3Click` (lines 80/86) → **OBSOLETE**.
- `FormShow` (line 78) → **OBSOLETE**.
- `CheckBox1..8Click` (lines 72-78) — sub-feature toggles (wells, contours, scale bar, north arrow, legend, custom-area legend) → **PARTIAL** (some toggles exist in FieldMapPage; not all).
- `RadioGroup1Click` (line 76) — color-scheme picker → **PARTIAL**.
- `RadioGroup3Click` (line 85) — N-arrow source picker (copy from Form21.Image3 or load from file) → **NOT PORTED**.
- `UpDown1..5Changing` (lines 79, 81-84) — font-size selectors → **NOT PORTED** (hardcoded in the React UI).
- `FormCreate` (line 71) → **OBSOLETE**.

### Unit24.pas (Form24 — raw .grd header viewer) — STATUS: NOT PORTED

- `open` (line 13) — re-reads the active grid file's `!` header lines into Memo1 → **NOT PORTED**.
- `FormShow` / `UpDown1Click` → **NOT PORTED**.

### Unit25.pas (Form25 — alternate 3D mesh viewer) — STATUS: PARTIAL

Substantial form (1104 lines). Combines a GLScene mesh viewer with cross-section trackbars (Image3 with t1/t2/t3 angle picks), red/green stereo cameras, and the same WELLDRAWING-like overlay.

Procedures audited:
- `inout` (line 40) — point-in-triangle test → **PORTED** (Three.js raycaster covers this implicitly).
- `imagetwo` (line 41) — colour-bar legend → **PORTED**.
- `ApplyDark` (line 42) — darken a TColor by an integer → **OBSOLETE**.
- `det` (line 43) — 3D cross-product determinant → **PORTED** as VectorMath utilities.
- `Button1Click` (line 44) — main render → **PORTED** (FieldScene3D.tsx renders a similar surface).
- `sizing` (line 45) — fill Edit text boxes with sizing values → **OBSOLETE**.
- `imagethree` (line 46) — draws the trihedron Image3 → **PARTIAL** (compass is shown but not a 3D trihedron).
- `xyztoxz` (line 47) — 3D-to-2D-screen projection → **PORTED** (Three.js).
- `zoom3d` (line 85) → **PORTED** (camera distance).
- `Button1` triangle add → **PORTED** in FieldScene3D's BufferGeometry build.
- `Image1MouseDown/Move/Up` (lines 78-83) — rotation drag on the trihedron → **NOT PORTED**.
- `Image3MouseDown/Move/Up` (lines 67-72) — drag in the projection panel → **NOT PORTED**.
- `UpDown1..6Changing/MouseUp/Click` — vertical exaggeration sliders → **PARTIAL** (zScale prop on FieldScene3D).
- `CheckBox1..5Click` — overlay toggles (grid, contour, legend, etc.) → **PARTIAL**.
- `LayersDrawing1Click` / `LayerDrawing1Click` (lines 76/77) — menu-driven layer toggles → **NOT PORTED**.
- `Options2/Options3Click` (lines 87/89) → **NOT PORTED**.
- `SaveasBitmap2Click` (line 87) — save scene as bitmap → **PARTIAL** (browser screenshot).
- `GLSceneViewer1MouseDown/Move/Up` (lines 73-74) — orbit + pick → **PORTED**.

### Unit26.pas (Form26 — cross-section / 3D setup) — STATUS: PARTIAL

- `Button1Click` (line 33) — clicks Form35's Button1 to re-render → **OBSOLETE** (React reactivity).
- `CheckBox1Click` (line 34) — toggles sizing(1)/sizing(2) which is real-coord vs grid-cell-coord mode → **NOT PORTED** (Three.js scene is always in world coords).
- `FormShow` / `FormCreate` (lines 35/36) → **OBSOLETE**.

### Unit28.pas (Form28 — contour overlay map) — STATUS: PARTIAL

This form is the "polished" map view that Form23 hands off to.

- `contourdraw` (line 28) — draws contour-line LABELS at each grid-cell color-change, with rotated text matching the contour direction → **PARTIAL**. Our `extractContours` in `@dd/grd/contour` produces the line *segments* but does NOT label them with the depth value or rotate text along the contour direction.
- `contour` (line 29) — paints the contour-line color-changes on the raster → **PORTED** in MapViewer2D.
- `angle` (line 30) — finds the contour direction (10ths of degrees) for text rotation → **NOT PORTED** (no rotated labels).
- `imagetwo` (line 36) — colour-ramp legend → **PORTED**.
- `imagethree` (line 31) — draggable copy of Image2 (north arrow) → **PARTIAL** (static compass).
- `imagefour` (line 32) — scale bar with 0-5 hatched cells → **NOT PORTED** (no scale bar in MapViewer2D).
- `imagefive` (line 33) — draws metadata text (from `! NAME:` lines) onto Image5 → **NOT PORTED**.
- `imagenine` (line 34) — draggable copy of Form23.Image4 (custom legend) → **NOT PORTED**.
- `draw` (line 35) — main raster paint → **PORTED**.
- `Image1MouseDown` (line 37) — contour-label pick (user clicks two points; label-numbers drawn between) → **NOT PORTED**.
- `Image1MouseMove` (line 39) — hover X/Y/Depth → **PORTED**.
- `Image2..9MouseDown/Move/Up` — drag/resize all the legend overlays → **NOT PORTED**.
- `MapOptions1Click` / `MapSave1Click` (lines 84-85) — open Form23 / save bitmap → **PARTIAL** (Save→PNG button exists; per-element drag-positioned save is bigger gap).
- `FormCreate` / `MAPOPTION1Click` (lines 86-87) → **OBSOLETE**.

### Unit29.pas (Form29) — STATUS: OBSOLETE — empty form

### Unit30.pas (Form30 — volume calculations) — STATUS: PARTIAL — see gap #19

- `Button1Click` (line 15) — fills valid[] pixels with gray → **PORTED** (highlight valid cells in MapViewer2D).
- `RadioGroup1Click` (line 16) — five volume methods (gap #19).
- `surf` (line 17) — 3×3 biquadratic least-squares → **NOT PORTED**.
- `integral` (line 18) — Simpson's rule integrator over a NxN grid block → **NOT PORTED**.
- `coff` (line 19) — Simpson coefficient table for n=2 or n=3 → **NOT PORTED**.
- `FormShow` (line 20) → **OBSOLETE**.
- `FormCreate` (line 21) → **OBSOLETE**.

### Unit31.pas (Form31 — cross-section chart) — STATUS: PORTED

- `FormClose` / `FormCreate` (lines 16-17) — series-clear + sort order → **PORTED** (CrossSection.tsx handles via useMemo).

### Unit32.pas (Form32 — bitmap save) — STATUS: PARTIAL

- `SaveasBitmap1Click` (line 19) — save final composite as bitmap with chosen aspect (Image1 fit / Image2 stretch) → **PARTIAL** (browser canvas.toBlob can produce PNG but the layout adjuster UI is gone).
- `RadioGroup1Click` / `CheckBox1Click` (lines 20/22) — layout option toggles → **OBSOLETE**.
- `draw` (line 21) — copies form28.image8 into form32.image2/image3 with chosen aspect → **PARTIAL**.

### Unit33.pas — STATUS: OBSOLETE — empty form with a string-grid

### Unit34.pas — STATUS: OBSOLETE — test mesh form

### Unit35.pas (Form35 — 3D mesh viewer w/ stereo + cubes + well pipes) — STATUS: PARTIAL — see gaps #20, #21

- `AddTriangle` (line 68) — feeds glMesh1.Vertices → **PORTED** (BufferGeometry).
- `Formula1` (line 70) — sample formula for test mesh → **OBSOLETE**.
- `GLSceneViewer1MouseDown/Move/Up` (lines 73-84) — orbit + pick + stereo-camera position update → **PARTIAL** (no stereo).
- `Button1Click` (line 77) — toggles MESHING vs CUBES mode → **PARTIAL** (only MESHING).
- `GrayScale` / `RenderToBitmap` / `redgreenblue` (lines 78-80) — bitmap-based red/blue stereo → **NOT PORTED** (gap #21).
- `FormCreate` / `FormShow` (lines 81-82) → **PORTED** (FieldScene3D init).
- `Option1Click` (line 83) — open Form26 → **NOT PORTED** (no equivalent dialog).
- `CheckBox1..5Click` (lines 86-89) — toggle grid/axes/HUD/etc. → **PARTIAL** (some flags exist).
- `TrackBar1..3Change` (lines 87, 95-96) — depth-slice trackbars → **NOT PORTED** (no slice viewer).
- `Button2Click` (line 88) — draw well pipes from `welldd` → **PORTED** (in FieldScene3D).
- `Button3Click` (line 89) — render red/green stereo → **NOT PORTED** (gap #21).
- `Button4Click` (line 90) — save scene → **PARTIAL** (browser screenshot).
- `Positioning` (line 91) — moves GLSphere1 marker → **NOT PORTED** (no draggable sphere marker).
- `BLEND` (line 92) — bitmap blend → **NOT PORTED**.
- `RadioGroup2Click` (line 93) → **OBSOLETE**.
- `PageControl1Change` (line 94) → **OBSOLETE**.
- `GLCadencer1Progress` (line 97) — keyboard fly-camera (mostly commented out in Pascal) → **OBSOLETE**.
- `lineline` (line 99) — line equation helper → **OBSOLETE**.
- `RadioGroup3Click` (line 100) — switch between MESHING/CUBES/wireframe → **PARTIAL** (only MESHING).
- `MESHING` (line 101) — triangle-mesh build → **PORTED**.
- `CUBES` (line 102) — voxel/cube rendering (gap #20).

### Unit41.pas (Form41 — BHA/Casing/Mud/Hydraulics container) — STATUS: NOT PORTED

- `Exit1Click` (line 41) → close.
- `FormCreate` (line 43) → ADO setup.
- `Units1Click` (line 42) → opens Form42.

The form has 4 TabSheets that the Pascal source LEAVES EMPTY (BD/CD/MD/HD tables are all commented out in Unit01.pas:ADDTABLE). So **Form41 is unused-functionality even in the original** — it was the planned-but-unimplemented BHA/Casing/Mud/Hydraulics modeller. Worth noting but NOT a porting gap.

### Unit42.pas (Form42 — units presets) — STATUS: NOT PORTED — see gap below

- `checkform` (line 21) — based on RadioGroup1 (Imperial / Metric / API / SI) sets all 8 sub-RadioGroups → **NOT PORTED**.
- `RadioGroup1..9Click` (lines 22-30) — change preset → **NOT PORTED**.
- `FormCreate` / `FormShow` (lines 31/32) → **NOT PORTED**.

The 9 RadioGroups cover Length, Angle, DLS, Mass, Force, Pressure, Volume, Temperature, Time. The TS has the conversion plumbing in `@dd/shared/units` but no UI to pick a preset.

### ProEffectImage.pas — STATUS: NOT PORTED — OBSOLETE for a web app

22 published bitmap effects (Invert, GrayScale, GaussianBlur, FishEye, Mosaic, Emboss, Twist, etc.). Used by Unit35 for image-post-processing of the rendered scene. Web alternative: CSS filter / Canvas filter / WebGL post.

### StereoFrm.pas — STATUS: NOT PORTED — OBSOLETE

TGLScene stereo (red/green anaglyph) helper, only referenced from Unit27 which is orphan (not in MIXED.dpr).

---

## Files audited but found 100% obsolete / out-of-scope

- **Unit27.pas** — not part of MIXED.dpr per the user's brief.
- **filesearch/**, **h1p2_6Materials/** — not in scope.
- **reabout.pas / reinit.pas / remain.pas / richedit.dpr** — RichEdit demo subproject.
- **test.pas** — test harness, not used by MIXED.
- **Project1.dpr / Project2.dpr** — separate small sub-projects, not in MIXED.

---

## Cross-cutting notes

1. **Trigonometric handedness** — Pascal uses `surtovct(inc, azm, out ns, out ew, out tvd)` where `ns = sign(sin inc) cos azm sqrt(1-tvd²)`. The TS `surToVct` in `vector.ts` should be cross-checked for the `sign(sin inc)` factor; if Pascal handles negative inclinations and TS doesn't, builders that pass negative `theta1` may differ.
2. **Builder return signatures** — Each Pascal builder takes `var wlpt1, wlpt2: abranch`. wlpt1 = the densified path (with ppf step), wlpt2 = the keypoints. The TS equivalent splits these explicitly into `stations` and `keyPoints` — matches the Pascal split.
3. **DLS sign** — Pascal forces the user to enter the correct sign for build vs drop (Unit02.pas:2872-2875 for HCH: `if wlptp2.INC>wlpt2[2].INC then wlpt[1].DLS:=-abs(wlpt[1].DLS)`). The TS dispatcher's `tryDlsSigns` tries all sign combinations and reports the actual signs used. **This is an improvement over Pascal**.
4. **PPF (points per ~100 ft)** — Hardcoded to 100 in every Pascal builder. The TS exposes it as a `BuilderOptions.ppf` option that defaults to 100. Verified at builders/types.ts.
5. **Unit conversion** — Pascal stores angles in degrees in the database (via `dec(3, val * 180 / pi)`) and degrees/100 for DLS. The TS Prisma schema stores everything in radians. The CSV importer at `apps/web/src/import/csv.ts` correctly converts on the way in (lines 93-103).
6. **`ddmmdd` boolean for CH2DC2** — Pascal `ddmmdd` selects between RG2=0 (free `thetaex`, solve for it) and RG2=1 (fixed `thetaex`, free `dmd`). The TS port handles both cases (see `dispatcher.ts:299, ch2dc2.ts`). Verified.
7. **`a10 = origin`** — Pascal uses a fixed `a10 = (0,0,0)` point throughout Button3Click as the "vector projection origin". The TS port wraps this in `inPlane2D` without exposing it; behaviourally equivalent.

---

## Suggested prioritization

If the goal is to get all "everyday user features" of the original app working in the SPA, in priority order:

1. **#5, #6, #8** — Build out the curve EOC and FLYTO and multi-curve builder families. These represent the bulk of the "useful but missing" math.
2. **#10, #11** — Fix VSEC and TF computation on every station. Currently both are 0 in the API output, which makes the PDF/XLSX export of these columns wrong.
3. **#1, #2, #3** — Restore the azimuth-disambiguation UX. Right now starred profiles silently pick a candidate; users from the original would expect the modal.
4. **#15, #16, #19, #20** — Field-map polish (polygon clip, well placement, advanced volume methods, voxel-cube 3D mode).
5. **#13, #25** — Either implement a .mdb importer or document the CSV-only workflow clearly.

Cosmetic / non-blocking items (legend dragging, contour labels, anaglyph stereo, font-size pickers, ProEffectImage filters) can be deferred.
