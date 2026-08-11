"""
Checks the generated HTML against the source bytes. Independent of the parser.

The parser could be confidently wrong, so nothing here trusts it. Every check
goes back to the .afr file itself:

  1. EVERY `table.column` the HTML displays must appear LITERALLY in the raw
     bytes of its source .afr — the same test `strings file.afr | grep` makes.
     A name the parser hallucinated cannot pass this.
  2. EVERY block the parser found must appear in the HTML, by its own
     `<!-- block n: WellView table `x` -->` marker. A block dropped between
     parse and render is caught here.
  3. Every field name found in the raw bytes must be ACCOUNTED FOR — either
     rendered, or explicitly recorded as an embedded-control column list. This
     is the direction that catches under-extraction, which check 1 cannot.
  4. Files that failed to parse are reported, not skipped silently.

Exit status is non-zero if any check fails.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

FIELD_IN_HTML = re.compile(r"<span class=\"fieldname\">([a-z0-9_]+\.[a-z0-9_]+)</span>", re.I)
BLOCK_MARKER = re.compile(r"<!-- block \d+: WellView table `([a-z0-9_]+)`", re.I)
PRINTABLE = re.compile(rb"^[\x20-\x7e]+$")
FIELD_EXACT = re.compile(r"^wv[a-z0-9_]+\.[a-z0-9_]+$", re.I)
PLACEHOLDER = re.compile(r"<([a-z0-9_]+\.[a-z0-9_]+)>", re.I)


def raw_strings(path: Path) -> tuple[set[str], set[str]]:
    """
    Every `table.column` literal the file actually stores, and every one that
    appears inside a caption placeholder.

    Read as LENGTH-PREFIXED strings, exactly as the format writes them, rather
    than by scanning the bytes for a pattern. A loose byte scan is wrong in a way
    that looks right: a field followed by the width integer 50 has `0x32` as its
    next byte, which is ASCII "2", so `…directionstowell` reads back as
    `…directionstowell2` and every such field appears to be a parser invention.
    That produced 30-odd phantom failures on the first run of this check.
    """
    data = path.read_bytes()
    literals: set[str] = set()
    placeholders: set[str] = set()
    i, end = 0, len(data)
    while i < end:
        n = data[i]
        if 1 <= n <= 255 and i + 1 + n <= end and PRINTABLE.match(data[i + 1 : i + 1 + n]):
            text = data[i + 1 : i + 1 + n].decode("latin-1")
            if FIELD_EXACT.match(text):
                literals.add(text.lower())
            else:
                for m in PLACEHOLDER.finditer(text):
                    placeholders.add(m.group(1).lower())
            i += 1 + n
        else:
            i += 1
    return literals, placeholders


def main(out_dir: Path) -> int:
    data = json.loads((out_dir / "reports.json").read_text(encoding="utf-8"))
    source_root = Path(data["source_root"]).parent

    problems: list[str] = []
    checked = fields_checked = 0

    for rep in data["reports"]:
        src = source_root / rep["source_relative"]
        html_path = out_dir / rep["html"]
        if not html_path.exists():
            problems.append(f"{rep['name']}: HTML missing ({rep['html']})")
            continue
        if not src.exists():
            problems.append(f"{rep['name']}: source missing ({src})")
            continue

        checked += 1
        html_text = html_path.read_text(encoding="utf-8")
        literals, placeholders = raw_strings(src)

        # 1 ── every field the HTML shows is really in the bytes
        shown = [m.group(1) for m in FIELD_IN_HTML.finditer(html_text)]
        for name in shown:
            fields_checked += 1
            if name.lower() not in literals:
                problems.append(
                    f"{rep['name']}: HTML shows `{name}` which is NOT in the .afr bytes"
                )

        # 2 ── every parsed block reached the HTML
        rendered = [m.group(1).lower() for m in BLOCK_MARKER.finditer(html_text)]
        if len(rendered) != len(rep["blocks"]):
            problems.append(
                f"{rep['name']}: {len(rep['blocks'])} block(s) parsed but "
                f"{len(rendered)} rendered"
            )
        for b in rep["blocks"]:
            if b["table"].lower() not in rendered:
                problems.append(f"{rep['name']}: block `{b['table']}` missing from HTML")

        # 3 ── nothing in the bytes was silently dropped. A name can legitimately
        #      appear as a block field OR as a <placeholder> inside a caption —
        #      the caption ones are extracted too, into `captions`.
        accounted = {f["qualified"].lower() for b in rep["blocks"] for f in b["fields"]}
        in_captions = {
            m.group(1).lower()
            for c in rep["captions"]
            for m in PLACEHOLDER.finditer(c)
        }
        for lit in literals | placeholders:
            if lit not in accounted and lit not in in_captions:
                problems.append(
                    f"{rep['name']}: `{lit}` is in the .afr but was not extracted"
                )

    print(f"reports checked      : {checked}")
    print(f"field references     : {fields_checked}")
    print(f"parse failures       : {len(data['failures'])}")
    for f in data["failures"]:
        print(f"   NOT PARSED: {f['path']} -> {f['error']}")
    print(f"verification problems: {len(problems)}")
    for p in problems[:40]:
        print("   ", p)
    if len(problems) > 40:
        print(f"    … and {len(problems) - 40} more")
    return 1 if problems else 0


if __name__ == "__main__":
    raise SystemExit(main(Path(sys.argv[1])))
