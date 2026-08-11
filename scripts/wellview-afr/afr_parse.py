"""
Parser for Peloton WellView 9.0 *.afr report-template files.

WHAT THIS IS
------------
`.afr` is WellView's proprietary binary report-layout format. This reads it and
nothing else — the source folders are opened "rb" and never written to.

THE FORMAT, AS VERIFIED AGAINST THE BYTES
-----------------------------------------
Every scalar is little-endian; every string is a single length byte followed by
that many ASCII bytes.

  HEADER   float  magic          3.0 on 181 of the 182 files here; one is 2.0
           str    "WellView"
           float  A              0.0 or 4.0 across this corpus
           float  B              2.1 on every v3 file — the sub-version
           byte   flag           1 on every file seen
           int×4  page margins   hundredths of an inch (e.g. 12 12 31 25)
           str    parent master template ("" when the report is standalone)
           str    paper          letter | legal | tabloid
           float×2               1.1, 1.1 (scale factors)

  STYLES   int count, then per style: name, float, 4 bytes RGBA shading

  FONTS    float 2.0 marker, int count, then per role:
             name, float, face, 4 flag bytes (bold, italic, underline, strike),
             float point size, 4 bytes RGBA

Two corrections to the brief this was written from, both confirmed against the
bytes and against all 182 files:

  * there is a FLAG BYTE between the sub-version float and the four margin
    integers. Without it the margins decode as 3073/3072/7936/6400 instead of
    12/12/31/25, and the parent-template and paper strings land one field apart.
  * a font record carries FOUR flag bytes after the face name, not one. Reading
    a single bold byte desynchronises the table from the second font onwards.

  BODY     a tree of blocks. Each block is a WellView table name, some layout
           bytes, an optional title, then `float 2.0, int fieldCount`, then that
           many `"table.column"` strings each followed by an int display width.
           Between blocks sit link/filter conditions stored as bare (table,
           column, value) strings, and caption strings carrying <placeholders>.

WHY THE BODY IS SCANNED RATHER THAN FULLY DECODED
-------------------------------------------------
The layout bytes between a block's name and its field list vary in length and
are not needed for the task: what is wanted is the block tree, the field names
and widths, the link conditions and the captions. So the body is walked as a
token stream of length-prefixed printable strings, and each is classified by its
own shape.

That would be guesswork if it could not be checked — so it is checked. Each
block declares its field count, and `blocks_ok` records whether the number of
fields attributed to a block equals the number it declared. A file where they
disagree is reported, never quietly emitted.
"""
from __future__ import annotations

import json
import re
import struct
from dataclasses import dataclass, field, asdict
from pathlib import Path

PRINTABLE = re.compile(rb"^[\x20-\x7e]+$")

# A table name in WellView is `wv…`; anything with a dot is one of its columns.
TABLE_RE = re.compile(r"^wv[a-z0-9_]+$", re.I)
FIELD_RE = re.compile(r"^(wv[a-z0-9_]+)\.([a-z0-9_]+)$", re.I)


class AfrError(Exception):
    """Raised when a file cannot be read as a v3 .afr — never swallowed."""


@dataclass
class Style:
    name: str
    value: float
    rgba: str


@dataclass
class Font:
    role: str
    marker: float
    face: str
    bold: bool
    italic: bool
    underline: bool
    strikeout: bool
    size_pt: float
    rgba: str


@dataclass
class Field:
    table: str
    column: str
    qualified: str
    width: int
    #: Which layout group the field sits in. WellView writes the field list as
    #: runs of `int n` followed by n fields, and the n fields of a run are the
    #: ones printed side by side under one caption row.
    group: int
    #: True when the name was packed straight against its neighbour with no width
    #: integer between them. Those are the column list of an embedded schematic
    #: control (`columnlistactual`), not cells of a printed block — so they are
    #: kept, marked, and excluded from the block's declared-count check.
    packed: bool = False


@dataclass
class Block:
    table: str
    title: str | None
    #: The size of each layout group, in order, as declared in the file.
    group_sizes: list[int] = field(default_factory=list)
    fields: list[Field] = field(default_factory=list)

    @property
    def declared_field_count(self) -> int:
        """What the file says this block holds — the sum of its group sizes."""
        return sum(self.group_sizes)

    @property
    def printed_fields(self) -> list[Field]:
        """The cells the block actually prints — packed control lists excluded."""
        return [f for f in self.fields if not f.packed]

    @property
    def counts_agree(self) -> bool:
        """The check that keeps the body scan honest: declared == recovered."""
        return self.declared_field_count == len(self.printed_fields)


@dataclass
class Report:
    path: str
    name: str
    folder: str
    version: float
    sub_version: float
    header_float_a: float
    flag_byte: int
    margins_hundredths_in: list[int]
    parent_template: str
    paper: str
    scale: list[float]
    styles: list[Style]
    fonts: list[Font]
    root_table: str | None
    filters: list[list[str]]
    blocks: list[Block]
    captions: list[str]
    misc_strings: list[str]
    warnings: list[str]


class Reader:
    def __init__(self, data: bytes) -> None:
        self.d = data
        self.i = 0

    def f32(self) -> float:
        v = struct.unpack_from("<f", self.d, self.i)[0]
        self.i += 4
        return round(v, 4)

    def i32(self) -> int:
        v = struct.unpack_from("<i", self.d, self.i)[0]
        self.i += 4
        return v

    def u8(self) -> int:
        v = self.d[self.i]
        self.i += 1
        return v

    def rgba(self) -> str:
        v = self.d[self.i : self.i + 4].hex()
        self.i += 4
        return "#" + v

    def string(self) -> str:
        n = self.d[self.i]
        self.i += 1
        v = self.d[self.i : self.i + n].decode("latin-1")
        self.i += n
        return v


def _tokenise(data: bytes, start: int) -> list[tuple[int, str, int | None]]:
    """Every length-prefixed printable string in the body, with the int after it."""
    out: list[tuple[int, str, int | None]] = []
    i = start
    end = len(data)
    while i < end:
        n = data[i]
        if 1 <= n <= 255 and i + 1 + n <= end and PRINTABLE.match(data[i + 1 : i + 1 + n]):
            text = data[i + 1 : i + 1 + n].decode("latin-1")
            nxt = (
                struct.unpack_from("<i", data, i + 1 + n)[0]
                if i + 1 + n + 4 <= end
                else None
            )
            out.append((i, text, nxt))
            i += 1 + n
        else:
            i += 1
    return out


def _group_size(data: bytes, first_field_offset: int) -> int | None:
    """
    The size of the layout group beginning at this field.

    A block's field list is written as runs: `int n`, then n × (field, width).
    The count sits in the four bytes immediately before the run's first field:

        ... 02 00 00 00 | 13 "wvjob.afenumbercalc" | 0a 00 00 00 | 12 "wvjob…" …
             n = 2         len=19                     width = 10

    It is NOT the block's total field count. Reading it that way made a 24-field
    block look like an 8-field one and produced 73 phantom mismatches — the `8`
    was the first group, not the block.
    """
    off = first_field_offset - 4
    if off < 0 or off + 4 > len(data):
        return None
    n = struct.unpack_from("<i", data, off)[0]
    return n if 1 <= n <= 100 else None


def parse(path: Path) -> Report:
    data = path.read_bytes()
    r = Reader(data)

    magic = r.f32()
    if magic != 3.0:
        raise AfrError(
            f"unsupported format version {magic} (this parser reads v3.0 only)"
        )
    name = r.string()
    if name != "WellView":
        raise AfrError(f"missing WellView signature (found {name!r})")

    float_a = r.f32()
    sub_version = r.f32()
    flag = r.u8()
    margins = [r.i32() for _ in range(4)]
    parent = r.string()
    paper = r.string()
    scale = [r.f32(), r.f32()]

    warnings: list[str] = []
    if not all(0 <= m <= 500 for m in margins):
        warnings.append(f"margins out of the expected 0-500 range: {margins}")
    if paper not in ("letter", "legal", "tabloid"):
        warnings.append(f"unrecognised paper size {paper!r}")

    styles = []
    for _ in range(r.i32()):
        styles.append(Style(r.string(), r.f32(), r.rgba()))

    font_marker = r.f32()
    fonts = []
    for _ in range(r.i32()):
        role = r.string()
        marker = r.f32()
        face = r.string()
        flags = data[r.i : r.i + 4]
        r.i += 4
        fonts.append(
            Font(
                role=role,
                marker=marker,
                face=face,
                bold=bool(flags[0]),
                italic=bool(flags[1]),
                underline=bool(flags[2]),
                strikeout=bool(flags[3]),
                size_pt=r.f32(),
                rgba=r.rgba(),
            )
        )
    if font_marker != 2.0:
        warnings.append(f"unexpected font-table marker {font_marker}")

    # ── body ────────────────────────────────────────────────────────────────
    #
    # Tokens are first classified by shape — FIELD ("table.column"), TABLE (a
    # bare "wv…" name) or TEXT — and then a bare TABLE is decided by LOOKAHEAD:
    #
    #   a TABLE opens a BLOCK when the next FIELD-or-TABLE token after it is a
    #   FIELD; otherwise it is an operand of a link/filter condition.
    #
    # That is what tells `wvjobreport` opening the Daily Summary block apart from
    # the `wvjob / wvtyp / dril` filter triple three tokens earlier, even though
    # a title string sits between the block name and its first field. Deciding it
    # by "the field's own table" instead does not work: a block's fields are
    # frequently joined in from ANOTHER table, so the Daily Summary block leads
    # with `wvjob.afenumbercalc` while the block itself is a wvjobreport block.
    tokens = _tokenise(data, r.i)

    FIELD, TABLE, TEXT = "field", "table", "text"
    kinds: list[tuple[int, str, int | None, str]] = []
    for offset, text, nxt in tokens:
        if FIELD_RE.match(text):
            kinds.append((offset, text, nxt, FIELD))
        elif TABLE_RE.match(text):
            kinds.append((offset, text, nxt, TABLE))
        else:
            kinds.append((offset, text, nxt, TEXT))

    # A link/filter condition is written as TABLE, TABLE, VALUE — `wvjob`,
    # `wvtyp`, `drill`. Recognised as a UNIT before anything else, because the
    # second name is a COLUMN (`wvtyp`) that matches the table pattern, and a
    # file which puts a visualizer control's property list between the filter and
    # the first field would otherwise make that column look like a block opener.
    filter_span: set[int] = set()
    for k in range(len(kinds) - 2):
        if k in filter_span:
            continue
        if (kinds[k][3] == TABLE and kinds[k + 1][3] == TABLE
                and kinds[k + 2][3] == TEXT and " " not in kinds[k + 2][1]):
            filter_span.update({k, k + 1, k + 2})

    def opens_block(k: int) -> bool:
        for _, _, _, kind in kinds[k + 1 :]:
            if kind == FIELD:
                return True
            if kind == TABLE:
                return False
        return False

    blocks: list[Block] = []
    captions: list[str] = []
    misc: list[str] = []
    filters: list[list[str]] = []
    root_table: str | None = None
    pending_title: str | None = None
    operands: list[str] = []
    remaining_in_group = 0
    unreadable_groups = 0
    # `nonlocal`-free: the loop below rebinds pending_title directly.

    def close_operands() -> None:
        nonlocal operands
        if len(operands) >= 2:
            filters.append(operands)
        else:
            misc.extend(operands)
        operands = []

    for k, (offset, text, nxt, kind) in enumerate(kinds):
        if k in filter_span:
            if kinds[k + 1][3] == TEXT if k + 1 < len(kinds) else False:
                pass
            if kind == TABLE and (k + 2) < len(kinds) and (k + 2) in filter_span \
                    and kinds[k + 1][3] == TABLE:
                filters.append([text, kinds[k + 1][1], kinds[k + 2][1]])
            continue
        if kind == TABLE:
            if opens_block(k):
                close_operands()
                blocks.append(Block(table=text, title=pending_title))
                pending_title = None
                remaining_in_group = 0
            else:
                if root_table is None:
                    root_table = text
                    misc.append(text)
                else:
                    operands.append(text)
            continue

        if kind == FIELD:
            close_operands()
            if not blocks:
                blocks.append(Block(table=FIELD_RE.match(text).group(1), title=pending_title))
                pending_title = None
            b = blocks[-1]
            if not b.fields:
                # A title written between the block name and its first field
                # belongs to THIS block. Cleared either way so it cannot leak
                # onto the next block.
                if b.title is None and pending_title is not None:
                    b.title = pending_title
                pending_title = None
            # Decided BEFORE any group bookkeeping: a packed name is an entry
            # in an embedded control's column list, so it must not open a group
            # or consume a slot in one.
            end = offset + 1 + len(text)
            nxt_off = kinds[k + 1][0] if k + 1 < len(kinds) else None
            packed = nxt_off == end          # no width integer between them
            m = FIELD_RE.match(text)
            if packed:
                b.fields.append(
                    Field(table=m.group(1), column=m.group(2), qualified=text,
                          width=0, group=-1, packed=True)
                )
                continue
            if remaining_in_group == 0:
                n = _group_size(data, offset)
                if n is None:
                    n = 1
                    unreadable_groups += 1
                b.group_sizes.append(n)
                remaining_in_group = n
            remaining_in_group -= 1
            width = nxt if (nxt is not None and 0 <= nxt <= 1000) else 0
            b.fields.append(
                Field(table=m.group(1), column=m.group(2), qualified=text,
                      width=width, group=len(b.group_sizes) - 1, packed=False)
            )
            continue

        # TEXT: a filter's VALUE, a block title, or a caption.
        #
        # A filter VALUE is a bare code — "drill", "Lessons". A caption has
        # spaces or <placeholders> in it. Without that distinction a caption
        # sitting after a link condition is swallowed as the condition's value,
        # which put `Job: <wvjob.wvtyp>, Job Start Date: <wvjob.dttmstart>` into
        # `filters` and lost it from `captions` entirely.
        looks_like_caption = (" " in text) or ("<" in text)
        if operands and not looks_like_caption:
            operands.append(text)
            close_operands()
            continue
        if operands:
            close_operands()
        if "<" in text and ">" in text:
            captions.append(text)
        elif len(text) > 2 and " " in text:
            pending_title = text
            captions.append(text)
        else:
            misc.append(text)

    close_operands()

    # A caption recovered from a misaligned resync starts mid-token or carries a
    # junk prefix. The structure above is checked exactly; captions are text
    # salvaged from a byte stream, so any that look damaged are REPORTED rather
    # than presented as if they were read cleanly.
    for c in captions:
        if "<" in c and c.count("<") != c.count(">"):
            warnings.append(f"caption may be truncated: {c[:60]!r}")
        elif c[:1] and not (c[0].isalnum() or c[0] in "(<[#"):
            warnings.append(f"caption has a suspect prefix: {c[:60]!r}")
    if unreadable_groups:
        warnings.append(f"{unreadable_groups} field group size(s) could not be read")

    # A block's title is the caption printed on its bar; where the same string
    # was also recorded as a caption, keep it in both — one is the bar, the other
    # is the literal the file carries.
    seen = blocks

    return Report(
        path=str(path),
        name=path.stem,
        folder=str(path.parent),
        version=magic,
        sub_version=sub_version,
        header_float_a=float_a,
        flag_byte=flag,
        margins_hundredths_in=margins,
        parent_template=parent,
        paper=paper,
        scale=scale,
        styles=styles,
        fonts=fonts,
        root_table=root_table,
        filters=filters,
        blocks=seen,
        captions=captions,
        misc_strings=misc,
        warnings=warnings,
    )


def parse_template_order(path: Path) -> list[str]:
    """templateorder.pce — float, int count, then that many names."""
    d = path.read_bytes()
    r = Reader(d)
    r.f32()
    return [r.string() for _ in range(r.i32())]


def to_dict(rep: Report) -> dict:
    out = asdict(rep)
    for b, src in zip(out["blocks"], rep.blocks):
        b["counts_agree"] = src.counts_agree
    return out


if __name__ == "__main__":
    import sys

    for arg in sys.argv[1:]:
        print(json.dumps(to_dict(parse(Path(arg))), indent=2)[:4000])
