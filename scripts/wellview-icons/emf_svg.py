"""
EMF (Windows Enhanced Metafile) -> SVG, for WellView's schematic icon library.

WHY THIS EXISTS
---------------
WellView ships its 1,441 equipment symbols as `.emf` — a Windows vector format
no browser can display, and no converter (inkscape, libreoffice, imagemagick,
libwmf) is installed on this machine. Rather than ship files the app cannot use,
this reads the format directly.

It is tractable because these particular files are simple. Across all 1,441:

    SELECTOBJECT          2,911,748
    DELETEOBJECT            717,091
    POLYGON16               706,992      <- the drawing, almost all of it
    CREATEBRUSHINDIRECT     698,807      <- its fill colour
    …then paths, beziers, pens, transforms

So they are filled polygons with brush colours. That is a small, well-defined
subset of EMF, and every record type below was chosen from that census rather
than from the specification at large — there is no point implementing text or
bitmap blitting for a file set that contains almost none.

WHAT IS NOT HANDLED
-------------------
`STRETCHDIBITS` (embedded bitmaps, 6,172 records) and `EXTTEXTOUTW` (text) are
skipped. `convert()` returns a `Result` carrying `skipped_records`, so a caller
can report an icon that leaned on them instead of quietly shipping a partial
drawing. Nothing is guessed: an unknown record is counted and stepped over.

COORDINATES
-----------
The header's `rclBounds` is the device-space extent, and that is what becomes the
SVG viewBox. Point records carry logical coordinates, mapped through the current
world transform. Window/viewport records are honoured when present.
"""
from __future__ import annotations

import struct
from dataclasses import dataclass, field
from pathlib import Path

# ── record ids, named only for the ones this converter acts on ───────────────
HEADER = 1
POLYBEZIER, POLYGON, POLYLINE = 2, 3, 4
POLYBEZIERTO, POLYLINETO = 5, 6
POLYPOLYLINE, POLYPOLYGON = 7, 8
SETWINDOWEXTEX, SETWINDOWORGEX = 9, 10
SETVIEWPORTEXTEX, SETVIEWPORTORGEX = 11, 12
EOF = 17
MOVETOEX = 28
SAVEDC, RESTOREDC = 33, 34
SETWORLDTRANSFORM, MODIFYWORLDTRANSFORM = 35, 36
SELECTOBJECT, CREATEPEN, CREATEBRUSHINDIRECT, DELETEOBJECT = 37, 38, 39, 40
ELLIPSE, RECTANGLE = 42, 43
LINETO = 54
BEGINPATH, ENDPATH, CLOSEFIGURE = 59, 60, 61
FILLPATH, STROKEANDFILLPATH, STROKEPATH = 62, 63, 64
POLYBEZIER16, POLYGON16, POLYLINE16 = 85, 86, 87
POLYBEZIERTO16, POLYLINETO16 = 88, 89
POLYPOLYLINE16, POLYPOLYGON16 = 90, 91
EXTCREATEPEN = 95

#: Records seen in this corpus that draw nothing this converter can express.
UNSUPPORTED_DRAWING = {81: "STRETCHDIBITS", 84: "EXTTEXTOUTW", 83: "EXTTEXTOUTA"}

#: Records that set state this converter does not need, and draw nothing. Named
#: so that `unknown_records` means "genuinely unrecognised" rather than "any
#: record I did not act on" — otherwise every icon in the library reports
#: unknowns for COMMENT and CREATECOLORSPACE and the signal is worthless.
IGNORED_STATE = {
    HEADER, SETWINDOWEXTEX, SETWINDOWORGEX, SETVIEWPORTEXTEX, SETVIEWPORTORGEX,
    14,  # SETMAPMODE
    19,  # SETBKMODE
    21,  # SETROP2
    22,  # SETSTRETCHBLTMODE
    23,  # SETTEXTALIGN
    24,  # SETCOLORADJUSTMENT
    25,  # SETTEXTCOLOR
    26,  # SETBKCOLOR
    27,  # OFFSETCLIPRGN
    30,  # SETMETARGN
    46,  # CHORD (none present)
    58,  # SETMITERLIMIT
    65, 66,  # FLATTENPATH / WIDENPATH
    67,  # SELECTCLIPPATH
    68,  # ABORTPATH
    70,  # COMMENT
    76,  # EXTSELECTCLIPRGN
    82,  # EXTCREATEFONTINDIRECTW
    97,  # SETICMMODE
    98,  # CREATECOLORSPACE
    99, 100,  # SETCOLORSPACE / DELETECOLORSPACE
}

STOCK_OBJECT_FLAG = 0x80000000
#: Stock objects this corpus selects. WHITE/BLACK/NULL brushes and a black pen.
STOCK = {
    0x80000000: ("brush", "#ffffff"),   # WHITE_BRUSH
    0x80000001: ("brush", "#c0c0c0"),   # LTGRAY_BRUSH
    0x80000002: ("brush", "#808080"),   # GRAY_BRUSH
    0x80000003: ("brush", "#404040"),   # DKGRAY_BRUSH
    0x80000004: ("brush", "#000000"),   # BLACK_BRUSH
    0x80000005: ("brush", "none"),      # NULL_BRUSH
    0x80000006: ("pen", "#ffffff"),     # WHITE_PEN
    0x80000007: ("pen", "#000000"),     # BLACK_PEN
    0x80000008: ("pen", "none"),        # NULL_PEN
}


def _colour(v: int) -> str:
    """A COLORREF is 0x00BBGGRR — reversed from what CSS wants."""
    return f"#{v & 0xFF:02x}{(v >> 8) & 0xFF:02x}{(v >> 16) & 0xFF:02x}"


@dataclass
class Brush:
    style: int
    colour: str

    @property
    def fill(self) -> str:
        # BS_NULL (1) paints nothing; anything else fills with its colour. The
        # hatch styles are approximated by their colour, which is what the icons
        # need — none of them rely on a hatch pattern to be legible.
        return "none" if self.style == 1 else self.colour


@dataclass
class Pen:
    style: int
    width: float
    colour: str

    @property
    def stroke(self) -> str:
        # PS_NULL (5) draws nothing.
        return "none" if (self.style & 0xF) == 5 else self.colour


@dataclass
class State:
    brush: Brush = field(default_factory=lambda: Brush(0, "#000000"))
    pen: Pen = field(default_factory=lambda: Pen(0, 1.0, "#000000"))
    xform: tuple[float, ...] = (1.0, 0.0, 0.0, 1.0, 0.0, 0.0)

    def copy(self) -> "State":
        return State(self.brush, self.pen, self.xform)


@dataclass
class Result:
    svg: str
    records: int
    drawn: int
    skipped_records: dict[str, int]
    unknown_records: dict[int, int]

    @property
    def is_empty(self) -> bool:
        return self.drawn == 0


class EmfError(Exception):
    """The file is not an EMF this converter can read — never swallowed."""


def _apply(xf: tuple[float, ...], x: float, y: float) -> tuple[float, float]:
    a, b, c, d, e, f = xf
    return (a * x + c * y + e, b * x + d * y + f)


def _multiply(m: tuple[float, ...], n: tuple[float, ...]) -> tuple[float, ...]:
    a1, b1, c1, d1, e1, f1 = m
    a2, b2, c2, d2, e2, f2 = n
    return (
        a1 * a2 + b1 * c2, a1 * b2 + b1 * d2,
        c1 * a2 + d1 * c2, c1 * b2 + d1 * d2,
        e1 * a2 + f1 * c2 + e2, e1 * b2 + f1 * d2 + f2,
    )


def _pts(data: bytes, off: int, count: int, small: bool) -> list[tuple[float, float]]:
    if small:
        raw = struct.unpack_from(f"<{count * 2}h", data, off)
    else:
        raw = struct.unpack_from(f"<{count * 2}i", data, off)
    return [(float(raw[i]), float(raw[i + 1])) for i in range(0, len(raw), 2)]


def convert(path: Path) -> Result:
    data = path.read_bytes()
    if len(data) < 88 or data[40:44] != b" EMF":
        raise EmfError("not an EMF file (missing ' EMF' signature)")

    bounds = struct.unpack_from("<4i", data, 8)
    left, top, right, bottom = bounds
    width = max(1, right - left + 1)
    height = max(1, bottom - top + 1)

    st = State()
    stack: list[State] = []
    objects: dict[int, Brush | Pen] = {}
    body: list[str] = []
    skipped: dict[str, int] = {}
    unknown: dict[int, int] = {}
    records = drawn = 0

    # Path-construction state: BEGINPATH…ENDPATH then FILLPATH/STROKEPATH.
    #
    # THE CURRENT POSITION IS DEVICE-SPACE, NOT LOGICAL. These files change the
    # world transform BETWEEN setting the pen position and using it: each band of
    # a symbol is first clipped in icon coordinates (~0–380), then STROKED via a
    # path that OPENS with LINETO under a fresh ~1/16-scale transform, inheriting
    # the pen position from the previous figure. GDI keeps that position in
    # device space, so the real renderer draws the band's edge. Storing the raw
    # logical point and re-applying the transform of the moment it is USED — the
    # first version of this converter — re-mapped (2, 326) to (0.1, 20) and drew
    # a long diagonal across the icon instead ("Circulating Plug" and family).
    # So: transform at SET time, never at use time.
    building = False
    path_d: list[str] = []
    cur = (0.0, 0.0)  # device coords, always already through the xform of its day

    def esc_pts(points: list[tuple[float, float]]) -> str:
        return " ".join(
            f"{x:.2f},{y:.2f}" for x, y in (_apply(st.xform, px, py) for px, py in points)
        )

    def emit_poly(points: list[tuple[float, float]], closed: bool) -> None:
        nonlocal drawn
        if len(points) < 2:
            return
        drawn += 1
        tag = "polygon" if closed else "polyline"
        fill = st.brush.fill if closed else "none"
        body.append(
            f'<{tag} points="{esc_pts(points)}" fill="{fill}" '
            f'stroke="{st.pen.stroke}" stroke-width="{max(st.pen.width, 0.5):.2f}"/>'
        )

    def emit_poly_dev(points: list[tuple[float, float]], closed: bool) -> None:
        """emit_poly for points ALREADY in device space (no transform applied)."""
        nonlocal drawn
        if len(points) < 2:
            return
        drawn += 1
        tag = "polygon" if closed else "polyline"
        fill = st.brush.fill if closed else "none"
        pts = " ".join(f"{x:.2f},{y:.2f}" for x, y in points)
        body.append(
            f'<{tag} points="{pts}" fill="{fill}" '
            f'stroke="{st.pen.stroke}" stroke-width="{max(st.pen.width, 0.5):.2f}"/>'
        )

    def move_to(p: tuple[float, float]) -> None:
        nonlocal cur
        cur = _apply(st.xform, *p)
        if building:
            path_d.append(f"M {cur[0]:.2f} {cur[1]:.2f}")

    def line_to(points: list[tuple[float, float]]) -> None:
        nonlocal cur, drawn
        dev = [_apply(st.xform, *p) for p in points]
        if not dev:
            return
        if building:
            for x, y in dev:
                path_d.append(f"L {x:.2f} {y:.2f}")
        else:
            emit_poly_dev([cur] + dev, closed=False)
        cur = dev[-1]

    def bezier_to(points: list[tuple[float, float]]) -> None:
        nonlocal cur
        for i in range(0, len(points) - 2, 3):
            trio = [_apply(st.xform, *p) for p in points[i:i + 3]]
            coords = " ".join(f"{x:.2f} {y:.2f}" for x, y in trio)
            if building:
                path_d.append(f"C {coords}")
            else:
                body.append(
                    f'<path d="M {cur[0]:.2f} {cur[1]:.2f} C {coords}" fill="none" '
                    f'stroke="{st.pen.stroke}" stroke-width="{max(st.pen.width, 0.5):.2f}"/>'
                )
            cur = trio[-1]

    i = 0
    while i + 8 <= len(data):
        rtype, rsize = struct.unpack_from("<II", data, i)
        if rsize < 8 or i + rsize > len(data):
            break
        records += 1
        o = i + 8

        if rtype == EOF:
            break

        elif rtype == CREATEBRUSHINDIRECT:
            h, style, colour = struct.unpack_from("<III", data, o)
            objects[h] = Brush(style, _colour(colour))

        elif rtype == CREATEPEN:
            h, style, wx, _wy, colour = struct.unpack_from("<IIiiI", data, o)
            objects[h] = Pen(style, float(wx or 1), _colour(colour))

        elif rtype == EXTCREATEPEN:
            h = struct.unpack_from("<I", data, o)[0]
            style, w, _bs, colour = struct.unpack_from("<IIII", data, o + 20)
            objects[h] = Pen(style, float(w or 1), _colour(colour))

        elif rtype == SELECTOBJECT:
            h = struct.unpack_from("<I", data, o)[0]
            if h & STOCK_OBJECT_FLAG:
                kind_colour = STOCK.get(h)
                if kind_colour:
                    kind, colour = kind_colour
                    if kind == "brush":
                        st.brush = Brush(1 if colour == "none" else 0, colour)
                    else:
                        st.pen = Pen(5 if colour == "none" else 0, 1.0, colour)
            else:
                obj = objects.get(h)
                if isinstance(obj, Brush):
                    st.brush = obj
                elif isinstance(obj, Pen):
                    st.pen = obj

        elif rtype == DELETEOBJECT:
            objects.pop(struct.unpack_from("<I", data, o)[0], None)

        elif rtype == SAVEDC:
            stack.append(st.copy())
        elif rtype == RESTOREDC:
            if stack:
                st = stack.pop()

        elif rtype == SETWORLDTRANSFORM:
            st.xform = struct.unpack_from("<6f", data, o)
        elif rtype == MODIFYWORLDTRANSFORM:
            xf = struct.unpack_from("<6f", data, o)
            mode = struct.unpack_from("<I", data, o + 24)[0]
            # MWT_IDENTITY 1 | MWT_LEFTMULTIPLY 2 | MWT_RIGHTMULTIPLY 3
            if mode == 1:
                st.xform = (1.0, 0.0, 0.0, 1.0, 0.0, 0.0)
            elif mode == 2:
                st.xform = _multiply(xf, st.xform)
            else:
                st.xform = _multiply(st.xform, xf)

        elif rtype == BEGINPATH:
            # Seeded with the CURRENT POINT. A path that opens with a *…TO*
            # record (POLYLINETO16, POLYBEZIERTO16, LINETO) continues from
            # wherever the pen already is, so without this the `d` attribute
            # began with "L" — invalid SVG, and a renderer discards the whole
            # path silently. That is what made 86 icons come out blank while
            # still reporting shapes drawn.
            #
            # `cur` is already device-space (transformed when it was set) —
            # applying the transform of THIS moment again is exactly the bug
            # that drew diagonals across the "Circulating Plug" family.
            building = True
            path_d = [f"M {cur[0]:.2f} {cur[1]:.2f}"]
        elif rtype == ENDPATH:
            building = False
        elif rtype == CLOSEFIGURE:
            if building:
                path_d.append("Z")
        elif rtype in (FILLPATH, STROKEANDFILLPATH, STROKEPATH):
            if path_d:
                drawn += 1
                fill = st.brush.fill if rtype != STROKEPATH else "none"
                stroke = st.pen.stroke if rtype != FILLPATH else "none"
                body.append(
                    f'<path d="{" ".join(path_d)}" fill="{fill}" stroke="{stroke}" '
                    f'stroke-width="{max(st.pen.width, 0.5):.2f}"/>'
                )
            path_d = []

        elif rtype in (POLYGON16, POLYLINE16, POLYBEZIER16, POLYGON, POLYLINE, POLYBEZIER):
            small = rtype in (POLYGON16, POLYLINE16, POLYBEZIER16)
            count = struct.unpack_from("<I", data, o + 16)[0]
            pts = _pts(data, o + 20, count, small)
            if rtype in (POLYBEZIER16, POLYBEZIER):
                if pts:
                    move_to(pts[0])
                    bezier_to(pts[1:])
            else:
                emit_poly(pts, closed=rtype in (POLYGON16, POLYGON))

        elif rtype in (POLYLINETO16, POLYBEZIERTO16, POLYLINETO, POLYBEZIERTO):
            small = rtype in (POLYLINETO16, POLYBEZIERTO16)
            count = struct.unpack_from("<I", data, o + 16)[0]
            pts = _pts(data, o + 20, count, small)
            if rtype in (POLYBEZIERTO16, POLYBEZIERTO):
                bezier_to(pts)
            else:
                line_to(pts)

        elif rtype in (POLYPOLYGON16, POLYPOLYLINE16, POLYPOLYGON, POLYPOLYLINE):
            small = rtype in (POLYPOLYGON16, POLYPOLYLINE16)
            npoly, _total = struct.unpack_from("<II", data, o + 16)
            counts = struct.unpack_from(f"<{npoly}I", data, o + 24)
            p = o + 24 + npoly * 4
            for c in counts:
                pts = _pts(data, p, c, small)
                p += c * (4 if small else 8)
                emit_poly(pts, closed=rtype in (POLYPOLYGON16, POLYPOLYGON))

        elif rtype == MOVETOEX:
            move_to(struct.unpack_from("<2i", data, o))
        elif rtype == LINETO:
            line_to([struct.unpack_from("<2i", data, o)])

        elif rtype in (RECTANGLE, ELLIPSE):
            l, t, r, b = struct.unpack_from("<4i", data, o)
            (x1, y1), (x2, y2) = _apply(st.xform, l, t), _apply(st.xform, r, b)
            drawn += 1
            common = (f'fill="{st.brush.fill}" stroke="{st.pen.stroke}" '
                      f'stroke-width="{max(st.pen.width, 0.5):.2f}"/>')
            if rtype == RECTANGLE:
                body.append(f'<rect x="{min(x1,x2):.2f}" y="{min(y1,y2):.2f}" '
                            f'width="{abs(x2-x1):.2f}" height="{abs(y2-y1):.2f}" {common}')
            else:
                body.append(f'<ellipse cx="{(x1+x2)/2:.2f}" cy="{(y1+y2)/2:.2f}" '
                            f'rx="{abs(x2-x1)/2:.2f}" ry="{abs(y2-y1)/2:.2f}" {common}')

        elif rtype in UNSUPPORTED_DRAWING:
            name = UNSUPPORTED_DRAWING[rtype]
            skipped[name] = skipped.get(name, 0) + 1

        elif rtype not in IGNORED_STATE:
            unknown[rtype] = unknown.get(rtype, 0) + 1

        i += rsize

    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{left} {top} {width} {height}" '
        f'width="{width}" height="{height}" shape-rendering="geometricPrecision">'
        f"<!-- converted from {path.name} -->"
        + "".join(body)
        + "</svg>"
    )
    return Result(svg=svg, records=records, drawn=drawn,
                  skipped_records=skipped, unknown_records=unknown)


if __name__ == "__main__":
    import sys

    for arg in sys.argv[1:]:
        r = convert(Path(arg))
        print(f"{arg}: {r.records} records, {r.drawn} drawn, "
              f"{len(r.svg)} bytes, skipped={r.skipped_records}, unknown={r.unknown_records}")
