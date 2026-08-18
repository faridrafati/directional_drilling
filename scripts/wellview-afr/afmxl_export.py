"""
Build reports-xl.json from `custom/reports multi/*.afmxl`.

An `.afmxl` is the DATA half of an Excel-based WellView report. It is a much
simpler container than a .afr/.afm — a root table, a flat list of fully
qualified columns, and an optional filter — paired with an `.xlt` workbook that
turns that extract into pivot tables and charts.

WHAT THIS DOES AND DOES NOT PRODUCE. It reproduces the extract: the same rows
and columns WellView would hand to Excel, for the wells the user selected,
downloadable as CSV. It does NOT reproduce the workbook — the pivots, the
charts, the conditional formatting — because that lives in the .xlt and
rebuilding it would be a different project. The application says so on the page
rather than implying the Excel report has been recreated.

FORMAT: f32 magic (1.1 or 1.2 — the layouts are identical), "WellView", i32,
f32, root table, i32 column count, that many qualified column names, then a
trailing block holding the filter criteria.

FILTERS ARE VALIDATED, NOT TRUSTED. A criterion decides which rows appear, so a
mis-read one silently changes the answer. Every criterion must name a table and
field the data model knows; if any does not, the whole filter is treated as
unread and the template says so, rather than applying half of it.

    python3 scripts/wellview-afr/afmxl_export.py
      -> apps/web/public/wellview-templates/reports-xl.json
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from afr_parse import Reader                              # noqa: E402
from afr_labels import field_label, table_label           # noqa: E402

REPO = Path(__file__).resolve().parents[2]
SRC = REPO / "WellView_files" / "custom" / "reports multi"
MODEL = REPO / "apps" / "web" / "public" / "wellview-templates" / "datamodel.json"
OUT = REPO / "apps" / "web" / "public" / "wellview-templates" / "reports-xl.json"

MAGICS = (1.1, 1.2)


def parse_afmxl(path: Path, model: dict) -> dict:
    d = path.read_bytes()
    r = Reader(d)
    magic = r.f32()
    if magic not in MAGICS:
        raise ValueError(f"unsupported .afmxl version {magic}")
    sig = r.string()
    if sig != "WellView":
        raise ValueError(f"missing WellView signature (found {sig!r})")
    # A brand-new, never-configured template: header only, no root table and
    # no columns. It is empty, not broken, and it is 20 bytes long — so test
    # before reading the two words a configured file has here.
    if len(d) - r.i < 9:
        return {"name": path.stem, "table": "", "fields": [], "criteria": [],
                "filterUnread": False, "format_version": magic}
    r.i32()
    r.f32()
    if len(d) - r.i < 5:
        return {"name": path.stem, "table": "", "fields": [], "criteria": [],
                "filterUnread": False, "format_version": magic}
    table = r.string()
    n = r.i32()
    if not (0 <= n < 500):
        raise ValueError(f"implausible column count {n}")
    columns = [r.string() for _ in range(n)]

    # Trailing block: the filter. Read defensively — its shape varies and a
    # half-read criterion is worse than none.
    criteria: list[dict] = []
    filter_unread = False
    try:
        r.f32()
        r.i32()
        r.u8()
        count = r.i32()
        if not (0 <= count < 20):
            raise ValueError("count")
        for _ in range(count):
            t, f, v = r.string(), r.string(), r.string()
            criteria.append({"table": t, "field": f, "value": v})
    except Exception:                                     # noqa: BLE001
        filter_unread = bool(criteria)
        criteria = []

    # Validate against the model; anything unrecognised invalidates the lot.
    for c in criteria:
        mt = model.get(c["table"].lower())
        if not mt or c["field"].lower() not in mt["fields"] or not c["value"].isprintable():
            filter_unread = True
            criteria = []
            break

    fields = []
    for q in columns:
        if "." in q:
            src, col = q.split(".", 1)
        else:
            src, col = table, q
        fields.append({
            "column": col,
            "source_table": src,
            "label_interpreted": field_label(q),
        })

    return {
        "name": path.stem,
        "table": table,
        "fields": fields,
        "criteria": criteria,
        "filterUnread": filter_unread,
        "format_version": magic,
    }


def main() -> int:
    if not SRC.is_dir():
        print(f"no multi-report folder at {SRC}", file=sys.stderr)
        return 1
    model = json.loads(MODEL.read_text(encoding="utf-8"))["tables"]

    reports, failures = [], []
    for path in sorted(SRC.rglob("*.afmxl")):
        rel = path.relative_to(SRC)
        try:
            got = parse_afmxl(path, model)
        except Exception as e:                            # noqa: BLE001
            failures.append({"file": str(rel), "reason": f"{type(e).__name__}: {e}"})
            continue
        workbook = path.with_suffix(".xlt")
        reports.append({
            "html": str(rel.with_suffix(".xl")).replace("\\", "/"),
            "name": got["name"],
            "folder": str(rel.parent).replace("\\", "/"),
            "table": got["table"],
            "title": table_label(got["table"]),
            "fields": got["fields"],
            "criteria": got["criteria"],
            "filterUnread": got["filterUnread"],
            "formatVersion": got["format_version"],
            # An empty starter template ships in Master Templates; it has no
            # columns and nothing to extract.
            "empty": len(got["fields"]) == 0,
            "hasWorkbook": workbook.exists() or workbook.with_suffix(".XLT").exists(),
        })

    OUT.write_text(json.dumps({
        "source_root": str(SRC.relative_to(REPO)),
        "generated_from": "WellView .afmxl Excel-report data extracts",
        "note": "The EXTRACT only. The paired .xlt workbook (pivots, charts, "
                "formatting) is not reproduced; templates say so in the app.",
        "report_count": len(reports),
        "failures": failures,
        "reports": reports,
    }, indent=1), encoding="utf-8")

    runnable = [r for r in reports if not r["empty"]]
    print(f"reports-xl.json -> {OUT}")
    print(f"  {len(reports)} extracts ({len(runnable)} with columns), "
          f"{sum(len(r['fields']) for r in reports)} fields")
    print(f"  with a filter: {sum(1 for r in reports if r['criteria'])}, "
          f"filter unread: {sum(1 for r in reports if r['filterUnread'])}")
    for f in failures:
        print(f"  FAILED {f['file']}: {f['reason']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
