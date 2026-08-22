# WellView database and template builders

These turn Peloton's shipped files — the data model, the query and chart
templates, the library pick-lists, the Access databases — into the JSON the web
app reads. All of them are **read-only** on `WellView_files/`: nothing here ever
writes back into the WellView tree.

Two of the scripts here are not builders at all. Read "The ones you cannot
re-run" below before adding anything to a rebuild-everything command.

## Rebuilding the app's template assets

```bash
npm run wellview:assets
```

That runs the four re-runnable builders in order. Each is independent; the order
only makes the log readable.

| script | reads | writes |
|---|---|---|
| `build_datamodel.mjs` | `WellView_files/system/Peloton.WellView.mdl.xml` | `apps/web/public/wellview-templates/datamodel.json` |
| `build_queries.mjs` | `WellView_files/custom/queries/**/*.afq` | `apps/web/public/wellview-templates/queries.json` |
| `build_dvdc.mjs` | `WellView_files/custom/daysvdepthcost/**/*.dvdc` | `apps/web/public/wellview-templates/days-vs-depth.json` |
| `build_picklists.mjs` | `custom/library/*.lib` + the sample DB + the model | `apps/web/public/wellview-picklists.json` |

Each honours an environment variable if the WellView tree lives elsewhere —
`WELLVIEW_MDL`, `WELLVIEW_QUERIES`, `WELLVIEW_DVDC`, `WELLVIEW_LIB_DIR` /
`WELLVIEW_SAMPLE_DB` / `WELLVIEW_MODEL_XML`.

The report templates are built by a separate set of scripts; see
[`../wellview-afr/README.md`](../wellview-afr/README.md) for `reports.json`
(single-well `.afr`), `reports-multi.json` (`.afm`) and `reports-xl.json`
(`.afmxl`).

**After any rebuild, restart the web dev server.** Vite caches `public/`, and a
freshly written JSON otherwise comes back as `index.html` — which parses as a
syntax error a long way from its cause.

## The ones you cannot re-run

`gen_calc_registry.mjs` and `gen_units.mjs` are **one-shot code generators, not
builders.** They read `$SCR/calc-registry.json` and `$SCR/unit-families.json`
from a session scratchpad that no longer exists, and they wrote
`apps/api/src/wellview/calcDerivations.ts` and
`packages/shared/src/units/wellview.ts` — both of which have been hand-edited
since. Running either would overwrite committed, tested source with output
generated from missing input. They are kept only as a record of how those two
files were originally derived.

`mdb_to_sqlite.mjs` converts the user's own WellView `.mdb` files into
`sqlite_DB/wellview/*.sqlite`. It needs the Access databases, which are not in
this repository, and its output is gitignored field data. Run it by hand when
converting a new database, not as part of an asset rebuild:

```bash
node scripts/wellview-db/mdb_to_sqlite.mjs <path-to.mdb>
```

## Why the outputs are committed

`WellView_files/` is not in the repository — it is a 16 MB vendor tree on the
user's machine. The decoded JSON is committed so a clean checkout builds and
tests without it, which is also why the API's model loader treats a missing file
as "no model" rather than an error.
