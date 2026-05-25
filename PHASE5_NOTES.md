# Phase 5 notes: deferred / skipped features

This document explains two items that the original Phase 5 plan in
[REACT_CONVERSION_PROMPT.md](REACT_CONVERSION_PROMPT.md) called for but that we
consciously did **not** implement, and what the recommended path forward is for
each.

## Casing / BHA / Mud / Hydraulics designers — **never existed in the original**

The original Delphi MIXED app had menu placeholders and form shells for casing
design, BHA design, mud design, and hydraulics design, but the code itself was
never finished. Evidence:

1. Look at `old_delphi_code/Unit01.pas:940-1210` — every `CREATE TABLE` for
   the supporting tables (`BD`, `CD`, `MD`, `HD`, `TB`, `TC`, `TM`, `TH`, `SH`)
   is wrapped in `{ ... }` block comments. Only the empty `ADOCommand1.Execute;`
   line is uncommented.
2. The corresponding popup forms (Form41, Form42 in `Unit41.pas`/`Unit42.pas`)
   only host static UI — radio groups and a button. No persisted data, no
   calculations.
3. Searching `old_delphi_code` for "casing", "BHA", "hydraulic", or "mud"
   surfaces only menu strings, no computation.

**What this means**: there's nothing to port. Building these would be net-new
feature work, not a Delphi → TypeScript migration. The recommendation is to
treat them as **separate roadmap items** with their own product design, not
Phase 5 scope.

If/when you do want them:

- **Casing designer**: build a `Casing` Prisma model linked to `Well` with
  type/grade/OD/weight/depth-in/out fields; the math is straightforward burst
  & collapse calculations from API/Eaton spec tables.
- **BHA designer**: similar — `Bha` model with components (drill collars,
  stabilizers, MWD) and a calculator for weight on bit / hookload.
- **Mud / Hydraulics**: ECD, pressure loss in annulus and bit nozzles — there
  are standard formulae but no reference implementation in the source.

## Legacy `.mdb` importer — **not practical server-side**

The original stores everything in a Microsoft Access `.mdb` file (Jet 4.0 OLE
DB provider). Petrel-style `.grd` files are ASCII and easy to parse, but
`.mdb` is a closed binary format. Options surveyed:

| Approach | Pros | Cons | Verdict |
|---|---|---|---|
| `node-adodb` | Works in Node | Requires Windows + Microsoft ODBC drivers | Hard fail on Linux/Docker hosting |
| `mdb-tools` (binary) | Cross-platform CLI | External system dep, shells out from Node | Adds operational complexity |
| Pure-JS reverse-engineered parser | No deps | None are actively maintained or feature-complete | Risk of silent data corruption |
| Manual export → CSV | Simple, reliable | Requires user to have Access installed once | **Recommended** |

### Recommended migration path

For users with an existing `.mdb`:

1. Open the `.mdb` in Microsoft Access (one-time, on any Windows machine).
2. For each table prefix the original uses:
   - `CO###` → Countries: select all → External Data → Export → CSV
   - `FI###` → Fields
   - `WL###` → Wells
   - `WD###` → Well-Design segments
   - `SE###` → Survey-Editor segments
3. Use the planned **CSV importer** (Phase 6 task #7) to bulk-load.

The CSV importer is small and well-bounded (a few endpoints + a UI flow). We
chose to defer it to Phase 6 because:

- It's not blocking any Phase 5 visualization work
- We have no real-world `.mdb` test fixture to validate against
- Most users in 2026+ won't be starting from `.mdb` anyway

If you have a specific `.mdb` you want imported, dump its `CO/FI/WL/WD/SE`
tables to CSV (using Access or `mdb-tables` + `mdb-export` from mdb-tools on
Linux), and the CSV importer can be wired up against that real input in a few
hours.

## Stereo / anaglyph 3D cameras — low value

The original `Form03` / `Form35` had a "stereo" mode that rendered the scene
from two cameras (left/right eye), greyscaled them, tinted red and cyan, and
blended. This was a 2010-era novelty needing red/cyan glasses.

R3F can do this via `<StereoCamera>` and an anaglyph pass, but in practice
modern users prefer the orbit controls + scroll-zoom we already provide, with
the option to use WebXR for actual VR if needed. We're skipping this unless
you specifically need it for a legacy training material.
