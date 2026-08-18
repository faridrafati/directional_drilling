"""
The older WellView v2.0 report container (.afr and .afm, circa 2006).

Three of the shipped templates predate the v3.0 format the main parser reads —
`Depth vs Cost Graph.afr`, `Task Summary.afm` and `Tasks - Incomplete.afm` —
and the difference is one detail: a v2.0 string is prefixed with a LITTLE-ENDIAN
U16 length, where v3.0 uses a varint. Everything else is the same family, and
the same rule applies as for .dvdc and .afq: read the strings IN ORDER, never at
fixed offsets, because the fields between them vary in width.

This deliberately extracts only what the application actually renders — the
block's table and its ordered column list — and not the styling. Reconstructing
margins and fonts from a format with three surviving examples would be guesswork
with nothing to check it against, and the app draws its own chrome anyway.

Columns arrive fully qualified (`wvtask.status`, `wvwellheader.wellname`), which
is how a multi-well template names a column that lives on the WELL rather than
on the block's own table.
"""
from __future__ import annotations

import re
import struct
from dataclasses import dataclass
from pathlib import Path

MAGIC_V2 = 2.0
# A qualified column as these files spell it: lowercase table.column.
QUALIFIED = re.compile(r"^[a-z][a-z0-9]*\.[a-z0-9_]+$")


class AfrV2Error(Exception):
    pass


@dataclass
class V2Field:
    """A printed column, with the table it is READ FROM.

    That is not always the block's own table: a multi-well template names
    `wvwellheader.wellname` on a `wvtask` block, because every row belongs to a
    well and the well's name is what identifies it in a list spanning wells.
    """
    table: str
    column: str


@dataclass
class V2Block:
    table: str
    fields: list[V2Field]


@dataclass
class V2Report:
    path: Path
    name: str
    version: float
    parent_template: str | None
    blocks: list[V2Block]


def _strings(data: bytes) -> list[str]:
    """Every u16-length-prefixed printable string, in file order."""
    out: list[str] = []
    i = 0
    end = len(data)
    while i + 2 <= end:
        n = struct.unpack_from("<H", data, i)[0]
        if 1 <= n <= 200 and i + 2 + n <= end:
            raw = data[i + 2:i + 2 + n]
            # A real string here is printable ASCII; anything else is a
            # coincidental length word inside binary padding.
            if all(32 <= c < 127 for c in raw):
                out.append(raw.decode("latin1"))
                i += 2 + n
                continue
        i += 1
    return out


def parse_v2(path: Path) -> V2Report:
    data = path.read_bytes()
    if len(data) < 16:
        raise AfrV2Error("file too short to be a report")
    magic = struct.unpack_from("<f", data, 0)[0]
    if abs(magic - MAGIC_V2) > 1e-6:
        raise AfrV2Error(f"not a v2.0 container (magic {magic})")

    strings = _strings(data)
    if "WellView" not in strings[:4]:
        raise AfrV2Error(f"missing WellView signature (first strings {strings[:4]})")

    parent = next((s for s in strings if s.lower().endswith((".afr", ".afm"))), None)

    # The layout, read off the three surviving files: a BARE table name opens a
    # block, and each field is then a bare qualifier followed by that
    # qualifier's `table.column`. So a bare name that is NOT followed by a
    # qualified column of ITSELF is a block header, and a qualified column whose
    # table is neither the block's nor the well header starts a new block when
    # its own header was not captured.
    blocks: list[V2Block] = []
    for i, s in enumerate(strings):
        nxt = strings[i + 1] if i + 1 < len(strings) else ""
        bare = s.startswith("wv") and "." not in s
        if bare:
            if not nxt.startswith(s + "."):
                blocks.append(V2Block(table=s, fields=[]))
            continue
        if not QUALIFIED.match(s):
            continue
        table, column = s.split(".", 1)
        if not table.startswith("wv"):
            continue
        if not blocks or (table != blocks[-1].table and table != "wvwellheader"
                          and not any(f.table == table for f in blocks[-1].fields)):
            blocks.append(V2Block(table=table, fields=[]))
        if not any(f.table == table and f.column == column for f in blocks[-1].fields):
            blocks[-1].fields.append(V2Field(table=table, column=column))

    blocks = [b for b in blocks if b.fields]
    if not blocks:
        raise AfrV2Error("no qualified wv* columns found")
    return V2Report(path=path, name=path.stem, version=magic,
                    parent_template=parent, blocks=blocks)


if __name__ == "__main__":
    import json
    import sys
    for arg in sys.argv[1:]:
        r = parse_v2(Path(arg))
        print(json.dumps({
            "name": r.name, "version": r.version, "parent": r.parent_template,
            "blocks": [{"table": b.table, "fields": [f"{f.table}.{f.column}" for f in b.fields]} for b in r.blocks],
        }, indent=1))
