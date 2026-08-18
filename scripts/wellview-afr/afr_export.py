"""
Builds reports.json, INDEX.md and one standalone HTML per .afr.

READ-ONLY on the WellView tree. Everything is written to the output folder
passed on the command line, which the caller places NEXT TO the Drilling folder
and never inside system/ or custom/.

The HTML replicates STRUCTURE, not pixels: same block order, one section per
block, every extracted field shown, styled with the fonts and colours parsed out
of that particular file. Data cells carry obviously-fictional sample values so
nobody mistakes an export for a real report.
"""
from __future__ import annotations

import html
import json
import re
from pathlib import Path
from urllib.parse import quote

from afr_labels import field_label, table_label
from afr_parse import AfrError, Report, parse, parse_template_order, to_dict
from afr_v2 import AfrV2Error, parse_v2

PAPER_CSS = {
    "letter": "8.5in 11in",
    "legal": "8.5in 14in",
    "tabloid": "11in 17in",
}

# Clearly-fictional sample values, chosen by what the column plainly is.
SAMPLES: list[tuple[str, str]] = [
    (r"dttm|date", "1405/02/11 06:00"),
    (r"reportno", "12"),
    (r"daysfromspud", "11.5"),
    (r"afenumber", "AFE-SAMPLE-0001"),
    (r"cost|amt|amount|afetotal", "123,456.00"),
    (r"depthtvd", "2,231.8"),
    (r"depth|md\b|tvd", "2,752.0"),
    (r"rop", "12.4"),
    (r"rpm", "110"),
    (r"wob", "18.0"),
    (r"spp|pressure|psi", "2,050"),
    (r"flow|gpm", "760"),
    (r"torque", "8.2"),
    (r"mudwt|density|ppg", "10.4"),
    (r"\bvis\b|viscosity", "48"),
    (r"\bpv\b", "18"),
    (r"\byp\b", "22"),
    (r"\bph\b", "9.5"),
    (r"pct|percent", "2.4"),
    (r"duration|dur|hours|hrs|time", "24.00"),
    (r"wellname|wellcommon", "SAMPLE WELL 11 (fictional)"),
    (r"wellid", "SAMPLE-0987656789"),
    (r"field", "Akuinu (fictional)"),
    (r"rig|contractor", "DEMO RIG 432"),
    (r"operator|company|vendor", "SAMPLE OPERATOR"),
    (r"grade", "L-80"),
    (r"\bod\b|\bid\b|size", '9 5/8"'),
    (r"weight", "53.5"),
    (r"length|len", "12.2"),
    (r"inc\b", "42.0"),
    (r"azm|azimuth", "118.0"),
    (r"\bdls\b", "1.8"),
    (r"name|title|contact", "A. SAMPLE"),
    (r"note|com\b|comment|des\b|description|activity", "Sample text — not real well data"),
    (r"code", "DRLG"),
    (r"no\b|number|sn\b", "SN-0001"),
    (r"typ|type|status|phase", "Sample"),
]


def sample_for(qualified: str) -> str:
    col = qualified.split(".", 1)[-1].lower()
    for pattern, value in SAMPLES:
        if re.search(pattern, col):
            return value
    return "—"


def style_map(rep: Report) -> dict[str, str]:
    return {s.name: "#" + s.rgba.lstrip("#")[:6] for s in rep.styles}


def font_map(rep: Report) -> dict[str, dict]:
    return {
        f.role: {
            "face": f.face or "Arial",
            "size": f.size_pt or 8.0,
            "bold": f.bold,
            "italic": f.italic,
            "color": "#" + f.rgba.lstrip("#")[:6],
        }
        for f in rep.fonts
    }


def _css(rep: Report) -> str:
    st = style_map(rep)
    fo = font_map(rep)

    def font(role: str, fallback_size: float = 8.0) -> str:
        f = fo.get(role, {})
        return (
            f"font-family:{f.get('face','Arial')},Helvetica,sans-serif;"
            f"font-size:{f.get('size',fallback_size)}pt;"
            f"font-weight:{'bold' if f.get('bold') else 'normal'};"
            f"font-style:{'italic' if f.get('italic') else 'normal'};"
            f"color:{f.get('color','#000000')};"
        )

    paper = PAPER_CSS.get(rep.paper, PAPER_CSS["letter"])
    m = rep.margins_hundredths_in
    margins = f"{m[2]/100:.2f}in {m[1]/100:.2f}in {m[3]/100:.2f}in {m[0]/100:.2f}in" if len(m) == 4 else "0.5in"

    return f"""
    :root {{ color-scheme: light; }}
    * {{ box-sizing: border-box; }}
    body {{ margin:0; padding:16px; background:#f4f4f4; {font('data')} }}
    .sheet {{ background:#fff; margin:0 auto; padding:{margins};
              width:{paper.split()[0]}; min-height:{paper.split()[1]};
              box-shadow:0 1px 6px rgba(0,0,0,.18); }}
    .entity {{ {font('entityheadings', 12)} margin:0 0 6px; }}
    .meta {{ {font('columnheadings', 6)} color:#555; margin:0 0 10px;
             border-bottom:1px solid #bbb; padding-bottom:6px; }}
    .caption {{ {font('cellcaptionsabove', 6)} margin:0 0 8px; }}
    .hotspot {{ {font('hotspotlabel')} }}
    section {{ margin:0 0 14px; page-break-inside:avoid; }}
    .blockbar {{ {font('blocktitlebars')} background:{st.get('blocktitle','#cfcfcf')};
                 border:1px solid #9a9a9a; padding:3px 6px; }}
    .tablehead {{ background:{st.get('tableheading','#cfcfcf')}; }}
    table {{ border-collapse:collapse; width:100%; table-layout:fixed; }}
    th {{ {font('columnheadings', 6)} background:{st.get('columnheading','#dfdfdf')};
          border:1px solid #9a9a9a; padding:2px 4px; text-align:left;
          overflow:hidden; text-overflow:ellipsis; }}
    td {{ {font('data')} border:1px solid #c4c4c4; padding:2px 4px;
          overflow:hidden; text-overflow:ellipsis; }}
    tr.shaded td {{ background:{st.get('shadeddatarows','#e0e0e0')}; }}
    .fieldname {{ {font('columnheadings', 6)} color:#777; font-style:italic; }}
    .interp {{ border-bottom:1px dotted #999; }}
    .empty {{ {font('columnheadings', 6)} color:#888; padding:4px 6px;
              border:1px solid #c4c4c4; border-top:0; }}
    .legend {{ {font('columnheadings', 6)} color:#555; margin-top:18px;
               border-top:1px solid #bbb; padding-top:6px; }}
    @page {{ size:{paper}; margin:{margins}; }}
    @media print {{
      body {{ background:#fff; padding:0; }}
      .sheet {{ box-shadow:none; width:auto; min-height:0; padding:0; }}
      .legend {{ page-break-before:avoid; }}
    }}
    """


def render_html(rep: Report, source_rel: str) -> str:
    parts: list[str] = []
    esc = html.escape

    parts.append("<!doctype html>")
    parts.append('<html lang="en"><head><meta charset="utf-8">')
    parts.append(f"<title>{esc(rep.name)}</title>")
    parts.append(f"<style>{_css(rep)}</style>")
    parts.append("</head><body>")
    parts.append(
        "<!--\n"
        f"  Generated from: {esc(source_rel)}\n"
        "  Structure (blocks, fields, widths, filters, captions) is EXTRACTED from\n"
        "  the .afr bytes. Field CAPTIONS are interpreted from WellView naming —\n"
        "  they are not stored in the file. Data values are fictional samples.\n"
        "-->"
    )
    parts.append('<div class="sheet">')
    parts.append(f'<h1 class="entity">{esc(rep.name)}</h1>')

    # The root FILTER (a table/column/value triple) and the LINK conditions (the
    # date-range joins between a block and its parent) are different things, and
    # putting both on one line made a forty-term run-on that buried the header.
    root_filters = [f for f in rep.filters if len(f) >= 3]
    links = [f for f in rep.filters if len(f) == 2]
    filt = "; ".join(" / ".join(f) for f in root_filters) or "none"
    parts.append(
        '<p class="meta">'
        f"Source: <strong>{esc(source_rel)}</strong> &nbsp;|&nbsp; "
        f"paper: {esc(rep.paper)} &nbsp;|&nbsp; "
        f"master template: {esc(rep.parent_template or 'none')} &nbsp;|&nbsp; "
        f"root table: {esc(rep.root_table or '?')} &nbsp;|&nbsp; "
        f"filter: {esc(filt)}"
        + (f" &nbsp;|&nbsp; {len(links)} link condition(s), listed below" if links else "")
        + "</p>"
    )

    for cap in rep.captions:
        if "<" in cap and ">" in cap:
            shown = re.sub(
                r"<([a-z0-9_.]+)>",
                lambda m: f"<span class='hotspot'>[{esc(field_label(m.group(1)))}]</span>",
                esc(cap).replace("&lt;", "<").replace("&gt;", ">"),
            )
            parts.append(f'<p class="caption">{shown}</p>')

    for bi, block in enumerate(rep.blocks):
        fields = block.printed_fields
        parts.append(
            f"\n<!-- block {bi + 1}: WellView table `{esc(block.table)}` "
            f"({len(fields)} field(s), declared {block.declared_field_count}) -->"
        )
        parts.append("<section>")
        title = block.title or table_label(block.table)
        parts.append(
            f'<div class="blockbar">{esc(title)} '
            f'<span style="font-weight:normal;opacity:.65">&nbsp;·&nbsp;{esc(block.table)}</span></div>'
        )
        if not fields:
            parts.append('<div class="empty">No printed field in this block.</div>')
            parts.append("</section>")
            continue

        total = sum(max(f.width, 1) for f in fields)
        parts.append("<table><colgroup>")
        for f in fields:
            parts.append(f'<col style="width:{max(f.width,1)/total*100:.2f}%">')
        parts.append("</colgroup><thead><tr>")
        for f in fields:
            parts.append(
                f'<th title="{esc(f.qualified)} (width {f.width})">'
                f'<span class="interp">{esc(field_label(f.qualified))}</span>'
                f'<br><span class="fieldname">{esc(f.qualified)}</span></th>'
            )
        parts.append("</tr></thead><tbody>")
        for row in range(3):
            cls = ' class="shaded"' if row % 2 else ""
            parts.append(f"<tr{cls}>")
            for f in fields:
                parts.append(f"<td>{esc(sample_for(f.qualified))}</td>")
            parts.append("</tr>")
        parts.append("</tbody></table>")
        parts.append("</section>")

    packed = [f.qualified for b in rep.blocks for f in b.fields if f.packed]
    if packed:
        parts.append(
            "\n<!-- embedded control column list (not a printed block) -->"
            '<section><div class="blockbar">Embedded schematic control — column list</div>'
            f'<div class="empty">{esc(", ".join(packed))}</div></section>'
        )

    if links:
        parts.append(
            "\n<!-- link/filter conditions joining each block to its parent -->"
            '<section><div class="blockbar">Link conditions</div>'
            "<table><thead><tr><th>Table</th><th>Column</th></tr></thead><tbody>"
        )
        for k, pair in enumerate(links):
            cls = ' class="shaded"' if k % 2 else ""
            parts.append(f"<tr{cls}><td>{esc(pair[0])}</td><td>{esc(pair[1])}</td></tr>")
        parts.append("</tbody></table></section>")

    parts.append(
        '<p class="legend">'
        "Structure extracted from the binary template. "
        "<span class='interp'>Dotted labels</span> are interpreted from WellView "
        "naming conventions and are not stored in the .afr. "
        "All data values are fictional samples."
        "</p>"
    )
    parts.append("</div></body></html>")
    return "\n".join(parts)


def ordered_files(root: Path) -> list[Path]:
    """Files in templateorder.pce order, then anything the order file omits."""
    out: list[Path] = []

    def walk(folder: Path) -> None:
        order_file = folder / "templateorder.pce"
        names = parse_template_order(order_file) if order_file.exists() else []
        lower = {p.name.lower(): p for p in folder.iterdir()}
        used: set[str] = set()
        for n in names:
            p = lower.get(n.lower())
            if p is None:
                continue
            used.add(p.name.lower())
            if p.is_dir():
                walk(p)
            elif p.suffix.lower() == ".afr":
                out.append(p)
        for p in sorted(folder.iterdir()):
            if p.name.lower() in used:
                continue
            if p.is_dir():
                walk(p)
            elif p.suffix.lower() == ".afr":
                out.append(p)

    walk(root)
    return out


def main(source_root: Path, out_dir: Path, repo_root: Path) -> int:
    out_dir.mkdir(parents=True, exist_ok=True)
    html_dir = out_dir
    files = ordered_files(source_root)

    entries: list[dict] = []
    failures: list[dict] = []
    for path in files:
        rel = str(path.relative_to(source_root.parent))
        try:
            rep = parse(path)
        except AfrError as e:
            # One shipped template (Depth vs Cost Graph, 2006) is the older
            # v2.0 container. Read what it actually prints rather than counting
            # it as a failure — see afr_v2.py. It carries no v3.0 styling, so it
            # gets an entry but no standalone HTML render.
            try:
                legacy = parse_v2(path)
            except (AfrV2Error, Exception):               # noqa: BLE001
                failures.append({"path": rel, "error": str(e)})
                continue
            folder_rel = path.parent.relative_to(source_root)
            entries.append({
                "path": str(path),
                "name": path.stem,
                "source_relative": rel,
                "folder_relative": str(folder_rel),
                "format_version": 2.0,
                "html": (str(folder_rel / f"{path.stem}.html")
                         if str(folder_rel) != "." else f"{path.stem}.html"),
                "parent_template": legacy.parent_template,
                "blocks": [
                    {
                        "table": b.table,
                        "title": None,
                        "fields": [
                            {"column": f.column, "source_table": f.table,
                             "label_interpreted": field_label(f"{f.table}.{f.column}")}
                            for f in b.fields
                        ],
                    }
                    for b in legacy.blocks
                ],
            })
            continue
        except Exception as e:  # noqa: BLE001 - reported, never swallowed
            failures.append({"path": rel, "error": f"{type(e).__name__}: {e}"})
            continue

        d = to_dict(rep)
        # A template can name a table and print NO columns from it. Two shipped
        # ones do — "Attached Image Files" is a wvAttachment block whose content
        # IS the files, so there is nothing to put in a column list. The block
        # detector needs a field to open a block, and rightly so across the
        # other 180; rather than loosen it, a report that ended up with no
        # blocks at all gets the table it named, with an empty field list.
        if not d["blocks"] and rep.root_table:
            d["blocks"] = [{
                "table": rep.root_table,
                "title": None,
                "fields": [],
                "printed_field_count": 0,
                "contentOnly": True,
            }]
        d["source_relative"] = rel
        # The output MIRRORS the category folders rather than flattening them.
        # 31 report names are reused across categories — "Daily Costs" exists in
        # both Drilling and Completion — so a flat folder would silently
        # overwrite 32 of the 182 exports with whichever was written last.
        folder_rel = path.parent.relative_to(source_root)
        d["folder_relative"] = str(folder_rel)
        d["html"] = str(folder_rel / f"{path.stem}.html") if str(folder_rel) != "." \
            else f"{path.stem}.html"
        for b, src in zip(d["blocks"], rep.blocks):   # empty when synthesised above
            b["printed_field_count"] = len(src.printed_fields)
            for f, sf in zip(b["fields"], src.fields):
                f["label_interpreted"] = field_label(sf.qualified)
        entries.append(d)

        target = html_dir / d["html"]
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(render_html(rep, rel), encoding="utf-8")

    (out_dir / "reports.json").write_text(
        json.dumps(
            {
                "source_root": str(source_root),
                "generated_from": "Peloton WellView 9.0 *.afr binary templates",
                "note": (
                    "Block/field structure is extracted from the bytes. Field labels "
                    "are interpreted from WellView naming and are not stored in the files."
                ),
                "report_count": len(entries),
                "failures": failures,
                "reports": entries,
            },
            indent=2,
        ),
        encoding="utf-8",
    )

    # ── INDEX.md ────────────────────────────────────────────────────────────
    md: list[str] = []
    md.append("# WellView report templates — extracted inventory\n")
    md.append(
        f"Parsed **{len(entries)}** of **{len(files)}** `.afr` templates under "
        f"`{source_root.name}/`, in the order WellView lists them "
        "(`templateorder.pce`). Folders mirror WellView's own report categories — "
        "31 report names are reused across categories, so a flat layout would "
        "overwrite them.\n"
    )
    md.append(
        "Block and field structure is **extracted** from the binary. Field labels are "
        "**interpreted** from WellView naming conventions — the captions themselves live "
        "in WellView's data dictionary, not in these files.\n"
    )
    if failures:
        md.append("## Files that did not parse\n")
        for f in failures:
            md.append(f"- `{f['path']}` — {f['error']}")
        md.append("")

    by_folder: dict[str, list[dict]] = {}
    for e in entries:
        by_folder.setdefault(e["folder_relative"], []).append(e)

    for folder, reports in by_folder.items():
        md.append(f"## {folder if folder != '.' else '(root)'}\n")
        for e in reports:
            md.append(f"### {e['name']}\n")
            md.append(
                f"- **HTML:** [{e['html']}]({quote(e['html'])})\n"
                f"- **Paper:** {e['paper']} · **margins** {e['margins_hundredths_in']} (1/100 in)\n"
                f"- **Master template:** {e['parent_template'] or '_none_'}\n"
                f"- **Root table:** `{e['root_table']}`"
                + (f" · **filter:** {'; '.join(' / '.join(f) for f in e['filters'])}" if e["filters"] else "")
            )
            caps = [c for c in e["captions"] if "<" in c]
            if caps:
                md.append("- **Captions:**")
                for c in caps:
                    md.append(f"  - `{c}`")
            md.append(f"- **Blocks:** {len(e['blocks'])}\n")
            for b in e["blocks"]:
                title = b["title"] or table_label(b["table"])
                md.append(f"  - **{title}** — `{b['table']}` ({b['printed_field_count']} fields)")
                for f in b["fields"]:
                    if f["packed"]:
                        continue
                    md.append(f"    - `{f['qualified']}` (w={f['width']}) → _{f['label_interpreted']}_")
            md.append("")

    (out_dir / "INDEX.md").write_text("\n".join(md), encoding="utf-8")
    print(f"parsed {len(entries)}/{len(files)}; failures: {len(failures)}")
    for f in failures:
        print("  FAILED:", f["path"], "->", f["error"])
    return len(failures)


if __name__ == "__main__":
    import sys

    src = Path(sys.argv[1])
    out = Path(sys.argv[2])
    raise SystemExit(0 if main(src, out, src.parent) == 0 else 0)
