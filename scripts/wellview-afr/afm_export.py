"""
Build reports-multi.json from `WellView_files/custom/reports multi/*.afm`.

A MULTI-well report is the other half of WellView's reporting: where an .afr
prints one well, an .afm prints one table across a SET of wells chosen in the
Well Explorer — every bit run on the asset, every drilling problem this year,
cost by vendor across a campaign.

The container is byte-identical to the .afr v3.0 the existing parser already
reads (`0000 4040` + "WellView" + length-prefixed latin1 strings), so this
reuses that parser wholesale rather than writing a second one. What differs is
the shape: a multi block names ONE table and a flat field list, with no nested
sub-blocks, and it freely names columns that live on the WELL rather than on the
block's own table — `wellname` on a wvJob block — because each row is understood
to belong to a well.

Read-only on the WellView tree. Anything that fails to parse is recorded in
`failures` with its reason rather than dropped.

    python3 scripts/wellview-afr/afm_export.py
      -> apps/web/public/wellview-templates/reports-multi.json
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from afr_parse import AfrError, parse, to_dict          # noqa: E402
from afr_v2 import AfrV2Error, parse_v2                  # noqa: E402
from afr_labels import field_label, table_label          # noqa: E402

REPO = Path(__file__).resolve().parents[2]
SRC = REPO / "WellView_files" / "custom" / "reports multi"
OUT = REPO / "apps" / "web" / "public" / "wellview-templates" / "reports-multi.json"


def main() -> int:
    if not SRC.is_dir():
        print(f"no multi-report folder at {SRC}", file=sys.stderr)
        return 1

    reports, failures = [], []
    for path in sorted(SRC.rglob("*.afm")):
        rel = path.relative_to(SRC)
        d = None
        legacy = None
        try:
            d = to_dict(parse(path))
        except AfrError:
            # Three shipped templates predate v3.0. Read them with the older
            # container rather than reporting them missing — see afr_v2.py.
            try:
                legacy = parse_v2(path)
            except (AfrV2Error, Exception) as e:          # noqa: BLE001
                failures.append({"file": str(rel), "reason": f"{type(e).__name__}: {e}"})
                continue
        except Exception as e:                            # noqa: BLE001
            failures.append({"file": str(rel), "reason": f"{type(e).__name__}: {e}"})
            continue

        blocks = []
        if legacy is not None:
            for b in legacy.blocks:
                blocks.append({
                    "table": b.table,
                    "title": table_label(b.table),
                    # A v2.0 field names the table it is read FROM, which need
                    # not be the block's own — that is how a multi-well template
                    # prints the well name beside a task.
                    "fields": [
                        {
                            "column": f.column,
                            "source_table": f.table,
                            "label_interpreted": field_label(f.column),
                        }
                        for f in b.fields
                    ],
                })
        else:
            for b in d.get("blocks", []):
                table = b.get("table")
                if not table:
                    continue
                blocks.append({
                    "table": table,
                    "title": b.get("title") or table_label(table),
                    # KEEP the source table. A multi-well template routinely
                    # prints a column from a RELATED table — the bit's size on
                    # a drill-string row, the well's name on a job row — and
                    # dropping the qualifier loses the only thing that says
                    # where to read it from.
                    "fields": [
                        {
                            "column": f.get("column"),
                            "source_table": f.get("table") or table,
                            "label_interpreted": field_label(f.get("qualified") or f.get("column") or ""),
                        }
                        for f in b.get("fields", []) if f.get("column")
                    ],
                })

        reports.append({
            # `html` is the identifier the app addresses a template by, exactly
            # as the single-well set does: the path with the extension swapped.
            "html": str(rel.with_suffix(".html")).replace("\\", "/"),
            "name": path.stem,
            "folder": str(rel.parent).replace("\\", "/"),
            "multi": True,
            # Page furniture, not a runnable report: every other .afm names one
            # of these as its parent_template. Kept (the single-well set keeps
            # its equivalents) but marked, so the picker does not offer a
            # template that has nothing to print.
            "master": str(rel.parent).replace("\\", "/").lower() == "master templates" or not blocks,
            "format_version": 2.0 if legacy is not None else 3.0,
            "paper": (d or {}).get("paper"),
            "parent_template": legacy.parent_template if legacy is not None else (d or {}).get("parent_template"),
            "blocks": blocks,
        })

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({
        "source_root": str(SRC.relative_to(REPO)),
        "generated_from": "WellView .afm multi-well report templates",
        "note": "One table printed across a SET of wells. Templates that failed "
                "to parse are listed in `failures`, not omitted.",
        "report_count": len(reports),
        "failures": failures,
        "reports": reports,
    }, indent=1), encoding="utf-8")

    fields = sum(len(b["fields"]) for r in reports for b in r["blocks"])
    print(f"reports-multi.json -> {OUT}")
    print(f"  {len(reports)} templates, {sum(len(r['blocks']) for r in reports)} blocks, {fields} fields")
    if failures:
        print(f"  {len(failures)} could not be read:")
        for f in failures:
            print(f"    {f['file']}: {f['reason']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
