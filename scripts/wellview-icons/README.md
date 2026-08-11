# WellView icon importer

Imports WellView's schematic component library — packers, centralizers, bits,
pumps, wellheads, lithology hatches — into the web app. **Read-only** on the
WellView tree: every source file is opened `"rb"`.

## Running it

```bash
python3 scripts/wellview-icons/import_icons.py \
  WellView_files/system/icons \
  apps/web/public/wellview-icons 128
```

> **Restart the Vite dev server afterwards.** The importer deletes and recreates
> the output folder, and Vite caches its `public/` listing at startup — until it
> is restarted the manifest 404s into the SPA fallback and the tab sits on
> "Loading icons…". The production build is unaffected.

## The problem this solves

WellView ships 1,441 of its 1,611 icons as `.emf` — a Windows vector format no
browser can display — and this machine has no EMF converter (no inkscape, no
libreoffice, no imagemagick, no libwmf). So the format is read directly.

| in | | out |
|---|---|---|
| 1,441 `.emf` | Windows vector | SVG → PNG |
| 138 `.bmp` | lithology hatch tiles | PNG |
| 32 `.ico` | miscellaneous symbols | PNG |
| 727 `.pce` | Peloton metadata, not images | skipped, counted |

## Why PNG and not SVG

These icons are shaded 3-D renders exported as vector — roughly 500 tiny
gradient polygons each. That is 105 MB of SVG, or 56 MB minified, against 17 MB
of PNG that looks identical at the size an icon is drawn. `emf_svg.py` still
emits SVG if you want it; the importer just does not ship it.

## The files

| | |
|---|---|
| `emf_svg.py` | the EMF reader — records, objects, transforms, paths → SVG |
| `rasterize.mjs` | SVG/BMP/ICO → PNG through a real browser, with blank detection |
| `import_icons.py` | walks the library, drives both, writes `manifest.json` |

## What the converter implements, and what it does not

Chosen from a census of all 1,441 files rather than from the specification at
large. The corpus is overwhelmingly `POLYGON16` + `CREATEBRUSHINDIRECT` +
`SELECTOBJECT` — filled polygons with brush colours — plus paths, beziers, pens
and world transforms.

**Not implemented:** `STRETCHDIBITS` (embedded bitmaps) and the text records.
441 icons contain one of those and are marked `partial` in the manifest and in
the app. 11 render blank and are marked too — most are wireframe outlines of
solid colour swatches, and one is literally named `Blank`.

Two bugs worth remembering, both found by looking at the output rather than at
the code:

- **A path built from `…TO` records began with `L`.** `BEGINPATH` followed by
  `POLYLINETO16`/`POLYBEZIERTO16` continues from the current point, so the `d`
  attribute opened with a line command — invalid SVG, which a renderer discards
  in full. 86 icons came out blank while still reporting shapes drawn. The path
  is now seeded with the current point.
- **Unrecognised STATE records were reported as conversion problems.** Every
  icon touches `COMMENT` and `CREATECOLORSPACE`, so the app marked all 1,441
  "partial" — an alarm that means nothing. State records are now named and
  ignored, and only a skipped DRAWING record makes an icon partial.
