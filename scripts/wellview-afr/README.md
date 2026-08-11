# WellView `.afr` template exporter

Reads Peloton WellView 9.0's proprietary binary report templates (`*.afr`) and
renders each one as a standalone HTML page. **Read-only** on the WellView tree —
the `.afr` files are opened `"rb"` and nothing is ever written back to them.

## Running it

```bash
python3 scripts/wellview-afr/afr_export.py \
  "WellView_files/custom/reports single" \
  docs/wellview-templates

python3 scripts/wellview-afr/afr_verify.py docs/wellview-templates
```

The exporter writes `reports.json`, `INDEX.md` and one HTML per template,
mirroring WellView's own category folders. The verifier re-reads the source
bytes and re-checks the output; it exits non-zero if anything fails.

## The files

| | |
|---|---|
| `afr_parse.py` | the binary format reader — header, styles, fonts, block tree |
| `afr_labels.py` | table/column name → human label. **Interpreted, not extracted** |
| `afr_export.py` | reports.json, INDEX.md and the HTML pages |
| `afr_verify.py` | independent check of the output against the source bytes |

## The format

Little-endian scalars; every string is one length byte then that many ASCII
bytes.

```
HEADER   float  3.0            magic (one file in this corpus is 2.0)
         str    "WellView"
         float  A              0.0 or 4.0
         float  B              2.1 — sub-version
         byte   flag
         int×4  page margins   hundredths of an inch
         str    parent master template ("" when standalone)
         str    paper          letter | legal | tabloid
         float×2               scale

STYLES   int count, then per style: name, float, 4 bytes RGBA

FONTS    float 2.0, int count, then per role: name, float, face,
         4 flag bytes (bold, italic, underline, strike), float size, RGBA

BODY     blocks. Each is a WellView table name, layout bytes, an optional title,
         then runs of `int n` + n × ("table.column", int width). Between blocks
         sit link/filter conditions and caption strings with <placeholders>.
```

Three things worth knowing, each found by disagreeing with an assumption and
checking the bytes:

- **A flag byte sits between the sub-version float and the margins.** Without it
  the margins decode as `3073/3072/7936/6400` instead of `12/12/31/25`, and the
  parent-template and paper strings land one field apart.
- **A font record has FOUR flag bytes after the face name, not one.** Reading a
  single bold byte desynchronises the table from the second font onward.
- **The int before a field list is a CELL-GROUP size, not the block's field
  count.** WellView writes the list as runs of `int n` + n fields — the n fields
  printed side by side under one caption row. Reading it as a block total makes a
  24-field block look like an 8-field one.

## What is exact and what is not

**Exact**, and checked: the block tree, every `table.column`, every display
width, the link conditions, the styles, the fonts, the paper size and margins.
`afr_verify.py` confirms every field name shown in an HTML appears literally in
its source `.afr`, that every parsed block reaches the page, and that nothing in
the bytes went unaccounted for.

**Not exact**, and marked as such:

- **Field labels are interpreted.** WellView keeps its captions in a data
  dictionary that is not in these files, so `wvwellheader.wellida` → "Well ID" is
  a translation. Interpreted labels carry a dotted underline in every export.
- **Pixel layout is approximate.** Block order and field order are faithful;
  exact positioning is not recovered.
- **Captions are salvaged by resync** from the byte stream, so a few come back
  truncated or with a junk prefix. Those are flagged per file in
  `VERIFICATION.md` rather than presented as clean.
- **Data values are fictional.** No real well data appears in any export.
