"""
Imports WellView's schematic icon library into the web app.

READ-ONLY on the WellView tree — every source file is opened "rb".

    python3 scripts/wellview-icons/import_icons.py \
      WellView_files/system/icons \
      apps/web/public/wellview-icons

WHAT COMES IN, AND WHAT GOES OUT
--------------------------------
    1,441 .emf   Windows vector, unreadable by any browser  -> SVG -> PNG
      138 .bmp   the lithology hatch tiles                  -> PNG
       32 .ico   miscellaneous symbols                      -> PNG
      727 .pce   Peloton's own metadata, not images         -> skipped, counted

The EMF files are converted by `emf_svg.py` (there is no EMF converter on this
machine) and then rasterised by `rasterize.mjs` through a real browser, because
these icons are shaded 3-D renders of roughly 500 gradient polygons each: 56 MB
of SVG after minifying, against 9 MB of PNG that looks the same at the size an
icon is drawn. The intermediate SVGs are written to a temporary directory and
are not shipped; re-run `emf_svg.py` directly if vector output is wanted.

Everything is reported. An EMF that leans on records this converter does not
implement, and a PNG that comes back essentially blank, both land in
`manifest.json` and in the summary — never quietly shipped as though they were
the icon.
"""
from __future__ import annotations

import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from emf_svg import EmfError, convert  # noqa: E402

MIME = {".bmp": "image/bmp", ".ico": "image/x-icon", ".svg": "image/svg+xml"}


def slugify(name: str) -> str:
    """A filename safe in a URL, keeping the original in the manifest."""
    keep = [c if (c.isalnum() or c in "-_") else "-" for c in name]
    out = "".join(keep)
    while "--" in out:
        out = out.replace("--", "-")
    return out.strip("-").lower() or "icon"


def main(src_root: Path, out_root: Path, size: int = 128) -> int:
    if out_root.exists():
        shutil.rmtree(out_root)
    out_root.mkdir(parents=True)

    tmp = Path(tempfile.mkdtemp(prefix="wv-icons-"))
    svg_dir = tmp / "svg"
    svg_dir.mkdir()

    work: list[dict] = []
    entries: list[dict] = []
    failures: list[dict] = []
    skipped_pce = 0
    partial: list[dict] = []

    for path in sorted(src_root.rglob("*")):
        if path.is_dir():
            continue
        ext = path.suffix.lower()
        if ext == ".pce":
            skipped_pce += 1
            continue
        if ext not in (".emf", ".bmp", ".ico"):
            continue

        category = path.parent.relative_to(src_root).as_posix() or "(root)"
        # `Fish 1.wireframe.emf` -> stem "Fish 1.wireframe"; the outline variant
        # is a distinct icon in WellView, so the suffix is kept, not stripped.
        stem = path.stem
        rel_png = f"{slugify(category)}/{slugify(stem)}.png"
        target = out_root / rel_png

        entry = {
            "name": stem,
            "category": category,
            "source": path.relative_to(src_root).as_posix(),
            "source_format": ext.lstrip("."),
            "png": rel_png,
        }

        if ext == ".emf":
            try:
                result = convert(path)
            except EmfError as e:
                failures.append({"source": entry["source"], "error": str(e)})
                continue
            except Exception as e:  # noqa: BLE001 — reported, never swallowed
                failures.append({"source": entry["source"], "error": f"{type(e).__name__}: {e}"})
                continue
            # Only a SKIPPED DRAWING record makes an icon partial. Recording
            # unrecognised state records here too marked every icon in the
            # library "partial", which is an alarm that means nothing.
            if result.skipped_records:
                entry["converter_notes"] = {"skipped": result.skipped_records}
                partial.append({"name": stem, "skipped": result.skipped_records})
            if result.unknown_records:
                entry["unknown_record_ids"] = result.unknown_records
            entry["shapes"] = result.drawn
            svg_path = svg_dir / f"{len(work):05d}.svg"
            svg_path.write_text(result.svg, encoding="utf-8")
            src_for_raster = svg_path
            mime = MIME[".svg"]
        else:
            src_for_raster = path
            mime = MIME[ext]

        work.append({
            "src": str(src_for_raster),
            "png": str(target),
            "name": stem,
            "mime": mime,
        })
        entries.append(entry)

    worklist = tmp / "work.json"
    worklist.write_text(json.dumps(work), encoding="utf-8")

    env = {
        **dict(__import__("os").environ),
        "WORKLIST": str(worklist),
        "SIZE": str(size),
        "VERBOSE": "1",
    }
    proc = subprocess.run(
        ["node", str(Path(__file__).parent / "rasterize.mjs")],
        capture_output=True, text=True, env=env,
    )
    if proc.returncode != 0:
        print(proc.stderr[-3000:], file=sys.stderr)
        raise SystemExit("rasterizer failed")
    raster = json.loads(proc.stdout.strip().splitlines()[-1])

    blank_names = {b["name"] for b in raster.get("blank", [])}
    failed_names = {f["name"] for f in raster.get("failures", [])}
    kept: list[dict] = []
    for e in entries:
        if e["name"] in failed_names:
            failures.append({"source": e["source"], "error": "render failed"})
            continue
        if e["name"] in blank_names:
            e["blank"] = True
        kept.append(e)

    by_category: dict[str, int] = {}
    for e in kept:
        by_category[e["category"]] = by_category.get(e["category"], 0) + 1

    manifest = {
        "source_root": str(src_root),
        "note": (
            "WellView's schematic icon library. EMF was converted to SVG by "
            "scripts/wellview-icons/emf_svg.py and rasterised through a browser; "
            "BMP and ICO were rasterised directly. .pce files are Peloton metadata, "
            "not images, and were skipped."
        ),
        "icon_size_px": size,
        "count": len(kept),
        "categories": by_category,
        "skipped_pce_files": skipped_pce,
        "failures": failures,
        "blank_renders": raster.get("blank", []),
        "partial_conversions": partial,
        "icons": sorted(kept, key=lambda e: (e["category"], e["name"])),
    }
    (out_root / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    shutil.rmtree(tmp, ignore_errors=True)

    print(f"icons imported : {len(kept)}")
    print(f"categories     : {len(by_category)}")
    print(f"skipped .pce   : {skipped_pce} (Peloton metadata, not images)")
    print(f"failures       : {len(failures)}")
    for f in failures[:10]:
        print("   ", f["source"], "->", f["error"])
    print(f"blank renders  : {len(raster.get('blank', []))}")
    for b in raster.get("blank", [])[:10]:
        print("   ", b["name"], f"(ink {b['inkRatio']})")
    print(f"partial (skipped records): {len(partial)}")
    return len(failures)


if __name__ == "__main__":
    raise SystemExit(main(Path(sys.argv[1]), Path(sys.argv[2]),
                          int(sys.argv[3]) if len(sys.argv) > 3 else 128) and 0)
