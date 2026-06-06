/**
 * Multi-well lithology + formation graph (Canvas), with the EIV/FMI imaging
 * graph's interaction chrome: a frozen toolbar with Zoom Y (depth) / Zoom X
 * (track width) steppers off a shared ZOOM_LADDER, a freeze-pane viewport with
 * ONE shared depth track frozen on the left and per-well headers frozen on top,
 * and a drag-box → zoom-modal (Unit13) that re-shows the SAME wells clipped to
 * the picked depth window.
 *
 * The core viz is unchanged: each well is a depth column drawing lithology as
 * 0–100 % composition bands (real LITHO/<pattern>.bmp tiles multiply-blended
 * over the rock colour at an adjustable opacity). All tracks share the SAME
 * visible depth window and the SAME pixel height (span × px/m × zoomY); the
 * depth axis lives once in the frozen DepthTrack.
 *
 * Formation tops are NOT thin lines — they are COLOURED FORMATION BANDS with
 * BOLD labels, mirroring the single-well stratigraphic column
 * (components/ddr/FormationLithology.tsx StratColumn): each formation occupies a
 * band from its own top down to the next top (last → bottom of window), filled
 * with a stable translucent per-formation tint drawn BEHIND the lithology so the
 * composition + patterns still read on top, then a bold boundary line + a bold
 * opaque label chip at each top.
 *
 * Depth zoom is the Zoom Y stepper; track width is the Zoom X stepper. Hovering
 * a track shows a floating depth / formation / composition readout. A legend bar
 * along the bottom maps every lithology colour + pattern to its rock name.
 */
import { useEffect, useMemo, useRef, useState } from "react";

interface Comp { name: string; pct: number; pattern: string; color: string }
interface Interval { from: number; to: number | null; comps: Comp[] }
interface Top { name: string | null; md: number }
export interface GraphWell { wellCode: string; name: string; lithology: Interval[]; formations: Top[] }
interface DepthRange { min: number; max: number }

/**
 * Shared zoom ladder (mirrors the EIV/FMI graph). Fractional steps shrink a
 * tall depth range to fit; integer steps enlarge. Used for BOTH Zoom Y (depth
 * px/m) and Zoom X (track width).
 */
const ZOOM_LADDER = [
  1 / 8, 1 / 6, 1 / 5, 1 / 4, 1 / 3, 1 / 2,
  1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 30,
];
function fmtZoom(v: number): string {
  return v < 1 ? `1/${Math.round(1 / v)}` : `${v}×`;
}
export function ZoomStepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  // Snap the current value to the nearest ladder index.
  let idx = 0, best = Infinity;
  ZOOM_LADDER.forEach((z, i) => { const d = Math.abs(z - value); if (d < best) { best = d; idx = i; } });
  const dec = () => onChange(ZOOM_LADDER[Math.max(0, idx - 1)]);
  const inc = () => onChange(ZOOM_LADDER[Math.min(ZOOM_LADDER.length - 1, idx + 1)]);
  return (
    <div className="flex items-center gap-1">
      <button onClick={dec} disabled={idx === 0}
        className="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-30" title="Zoom out">−</button>
      <span className="w-10 text-center tabular-nums">{fmtZoom(value)}</span>
      <button onClick={inc} disabled={idx === ZOOM_LADDER.length - 1}
        className="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-30" title="Zoom in">+</button>
    </div>
  );
}

/** Baseline depth scale (px per metre) at Zoom Y = 1× — a full 1000 m window is
 *  ~600 px tall, matching the original fixed canvas height. */
const PX_PER_M = 0.6;
/** Baseline track width (px) at Zoom X = 1×, with sane clamps. */
const BASE_W = 176;
const MIN_W = 110;
const MAX_W = 560;
/** Frozen depth-track width + the common header height. Every column's header is
 *  exactly HEADER_H tall so each track's plot top lines up with the depth
 *  ruler's first tick. */
export const DEPTH_W = 72;
export const HEADER_H = 24;

export const widthFor = (zoomX: number) => Math.round(Math.min(MAX_W, Math.max(MIN_W, BASE_W * zoomX)));
/** Pixel height of a depth span at the given Zoom Y. */
export const heightFor = (span: number, zoomY: number) => Math.max(120, Math.round(span * PX_PER_M * zoomY));

/** Stable pastel hue per formation key (mirrors FormationLithology's hueOf), so
 *  band colours stay consistent across renders / wells. */
const hueOf = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h % 360; };
/** GraphWell.formations only carry {name, md}; derive the stable hue from the
 *  name, falling back to a spread per-index hue when the name is null. */
const formHue = (name: string | null, idx: number) => name ? hueOf(name) : (idx * 47) % 360;
/** Opaque chip / label tint at full strength (used for the bold label chip). */
const formColorSolid = (name: string | null, idx: number) => `hsl(${formHue(name, idx)} 48% 80%)`;
/** Translucent band tint, drawn BEHIND lithology so composition stays visible. */
const formColorBand = (name: string | null, idx: number) => `hsl(${formHue(name, idx)} 48% 80% / 0.4)`;

export function usePatternImages(names: string[]): Map<string, HTMLImageElement> {
  const [imgs, setImgs] = useState<Map<string, HTMLImageElement>>(new Map());
  const key = names.slice().sort().join(",");
  useEffect(() => {
    let cancelled = false;
    const m = new Map<string, HTMLImageElement>();
    let pending = names.length;
    if (!pending) { setImgs(new Map()); return; }
    const done = () => { if (--pending === 0 && !cancelled) setImgs(new Map(m)); };
    for (const n of names) {
      const img = new Image();
      img.onload = () => { m.set(n, img); done(); };
      img.onerror = done;
      img.src = `/api/ddr/litho-pattern/${n}`;
    }
    return () => { cancelled = true; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return imgs;
}

export const niceStep = (raw: number) => { const p = Math.pow(10, Math.floor(Math.log10(Math.max(1, raw)))); const n = raw / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p; };

export function LithologyGraph({ wells, depthRange, selLitho, opacity }: {
  wells: GraphWell[]; depthRange: DepthRange | null; selLitho: Set<string>; opacity: number;
}) {
  const [win, setWin] = useState<DepthRange | null>(depthRange);
  const [zoomY, setZoomY] = useState(1);
  const [zoomX, setZoomX] = useState(1);
  useEffect(() => setWin(depthRange), [depthRange?.min, depthRange?.max]);

  const patterns = useMemo(() => [...new Set(wells.flatMap((w) => w.lithology.flatMap((l) => l.comps.map((c) => c.pattern))).filter(Boolean))], [wells]);
  const images = usePatternImages(patterns);

  // Distinct lithology types across all wells → the legend (name + swatch).
  const legend = useMemo(() => {
    const m = new Map<string, { name: string; color: string; pattern: string }>();
    for (const w of wells) for (const l of w.lithology) for (const c of l.comps) {
      if (!m.has(c.name)) m.set(c.name, { name: c.name, color: c.color, pattern: c.pattern });
    }
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [wells]);

  if (!depthRange || !win) return <div className="p-8 text-center text-sm text-gray-400">Pick a field / well, then Show graphs.</div>;
  if (!wells.length) return <div className="p-8 text-center text-sm text-gray-400">No wells match.</div>;

  const trackW = widthFor(zoomX);
  const trackH = heightFor(win.max - win.min, zoomY);

  return (
    <div className="flex flex-col min-h-0 h-full">
      {/* Frozen toolbar above the graph (mirrors the EIV toolbar). */}
      <div className="shrink-0 flex items-center flex-wrap gap-x-5 gap-y-2 px-2 py-1.5 border-b border-gray-100 text-[11px] text-gray-600">
        <div className="flex items-center gap-1.5">
          <span className="text-gray-500">Zoom Y</span>
          <ZoomStepper value={zoomY} onChange={setZoomY} />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-gray-500">Zoom X</span>
          <ZoomStepper value={zoomX} onChange={setZoomX} />
        </div>
        <button onClick={() => { setWin(depthRange); setZoomY(1); setZoomX(1); }}
          className="h-6 px-2 rounded border border-gray-300 bg-white hover:bg-gray-50">Reset</button>
        <span className="text-gray-400">
          use Zoom Y / Zoom X · hover for details
        </span>
      </div>

      {/* Freeze-pane viewport: depth track frozen left, well headers frozen top. */}
      <div className="flex-1 min-h-0 overflow-auto">
        <div className="flex gap-4 items-start w-max p-2">
          <DepthTrack win={win} heightPx={trackH} />
          {wells.map((w) => (
            <WellTrack
              key={w.wellCode} well={w} win={win}
              images={images} selLitho={selLitho} opacity={opacity}
              width={trackW} heightPx={trackH}
            />
          ))}
        </div>
      </div>

      {/* Lithology legend — every rock colour + pattern → its name. Types not in
          the current lithology filter (selLitho) are dimmed (not drawn). */}
      {legend.length > 0 && (
        <div className="shrink-0 border-t border-gray-100 px-2 py-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-gray-600">
          <span className="font-semibold uppercase tracking-wide text-gray-500 self-center">Lithology</span>
          {legend.map((r) => {
            const on = selLitho.size === 0 || selLitho.has(r.name);
            return (
              <span key={r.name} className={`inline-flex items-center gap-1 ${on ? "" : "opacity-35"}`}
                title={on ? r.name : `${r.name} (hidden by filter)`}>
                <LegendSwatch color={r.color} pattern={r.pattern} />
                {r.name}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Legend swatch = rock colour with the LITHO/<pattern>.bmp tile multiply-blended
 *  on top, matching how the track bands are drawn. */
function LegendSwatch({ color, pattern, size = 12 }: { color: string; pattern?: string; size?: number }) {
  return (
    <span className="inline-block rounded-sm border border-gray-300 align-middle shrink-0" style={{
      width: size, height: size, backgroundColor: color,
      backgroundImage: pattern ? `url(/api/ddr/litho-pattern/${pattern})` : undefined,
      backgroundBlendMode: "multiply", backgroundSize: `${size + 6}px`,
    }} />
  );
}

/**
 * One shared depth ruler, frozen on the LEFT (sticky) with a header frozen on
 * TOP (the corner is sticky on both axes). The header is exactly HEADER_H tall
 * so the ruler's first tick lines up with every well track's plot top. Major
 * ticks ≈ every 70 px carry a depth label; MINOR_PER short unlabeled ticks
 * subdivide each major interval (mirrors the EIV DepthTrack).
 */
const MINOR_PER = 5;
export function DepthTrack({ win, heightPx, title = "Depth", fmt = (d: number) => String(Math.round(d)), headerH = HEADER_H }: { win: DepthRange; heightPx: number; title?: string; fmt?: (d: number) => string; headerH?: number }) {
  const span = Math.max(1, win.max - win.min);
  const majorN = Math.max(2, Math.min(40, Math.round(heightPx / 70)));
  const totalMinor = majorN * MINOR_PER;
  const marks = Array.from({ length: totalMinor + 1 }, (_, i) => i);
  return (
    <div className="shrink-0 sticky left-0 z-20 bg-white text-right" style={{ width: DEPTH_W }}>
      {/* Top-left corner: frozen on top AND left, above everything. */}
      <div className="sticky top-0 z-30 bg-white text-xs font-medium text-gray-700 flex items-end justify-end pb-0.5"
        style={{ height: headerH }}>
        {title}
      </div>
      <div className="relative border-r border-gray-300" style={{ height: heightPx }}>
        {marks.map((i) => {
          const isMajor = i % MINOR_PER === 0;
          const frac = i / totalMinor;
          const depth = win.min + frac * span;
          return (
            // top = frac * heightPx so depth hi maps to pixel heightPx, the SAME
            // mapping the well-track canvas uses (yOf), keeping axis + hover aligned.
            <div key={i} className="absolute right-0" style={{ top: frac * heightPx }}>
              {/* Long, darker tick for majors; short, light tick for minors. */}
              <div className={`absolute right-0 -translate-y-1/2 border-t ${isMajor ? "w-2.5 border-gray-400" : "w-1.5 border-gray-300"}`} />
              {isMajor && (
                <div className="absolute right-3.5 -translate-y-1/2 text-[10px] text-gray-500 whitespace-nowrap">
                  {fmt(depth)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * A single well's lithology + formation column (no own depth axis — that lives
 * in the shared DepthTrack). Draw order per track: (a) white bg, (b) translucent
 * formation BANDS, (c) lithology composition bands + multiply patterns, (d) bold
 * boundary line at each top, (e) bold opaque label chip, (f) gridlines / border.
 * A frozen well-code header sits above. Hover shows a floating cursor-following
 * readout. Depth zoom is driven solely by the Zoom Y stepper (no scroll-zoom,
 * no pan, no drag).
 */
export function WellTrack({
  well, win, images, selLitho, opacity, width, heightPx, headerH = HEADER_H,
}: {
  well: GraphWell; win: DepthRange;
  images: Map<string, HTMLImageElement>;
  selLitho: Set<string>; opacity: number; width: number; heightPx: number; headerH?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<{ x: number; y: number; depth: number; form: string | null; comps: Comp[] } | null>(null);

  const W = width, H = heightPx;
  // The plot fills the full track height; depth maps linearly across it.
  const lo = win.min, hi = win.max, span = Math.max(1, hi - lo);
  const yOf = (d: number) => ((d - lo) / span) * H;
  // Map a CSS-pixel offset to depth using the ACTUAL rendered height so the
  // readout matches the depth axis even when the canvas is sub-pixel scaled by
  // layout/browser zoom (was dividing by the logical H, which drifted at high
  // Zoom Y and made the hover depth disagree with the Y-axis labels).
  const dOf = (cy: number, rectH: number) => lo + (cy / Math.max(1, rectH)) * span;

  // Formation bands: top = own md, btm = next top (last → bottom of full data),
  // mirroring StratColumn's `bands`. The deepest extent is the well's deepest
  // datum (lithology bottom / last top) so the last band fills to the data end.
  const formBands = useMemo(() => {
    const tops = well.formations;
    if (!tops.length) return [] as { name: string | null; top: number; btm: number; idx: number }[];
    let dataMax = -Infinity;
    for (const l of well.lithology) {
      const to = typeof l.to === "number" && l.to > l.from ? l.to : l.from;
      if (to > dataMax) dataMax = to;
    }
    const lastTop = tops.reduce((m, t) => Math.max(m, t.md), -Infinity);
    const end = Math.max(dataMax, lastTop);
    return tops.map((f, i) => ({
      name: f.name,
      top: f.md,
      btm: i + 1 < tops.length ? tops[i + 1].md : end,
      idx: i,
    }));
  }, [well]);

  useEffect(() => {
    const cv = canvasRef.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = W * dpr; cv.height = H * dpr; cv.style.width = `${W}px`; cv.style.height = `${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // (a) White plot background.
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, W, H);

    // (b) Translucent formation BANDS, BEHIND the lithology so composition reads.
    for (const f of formBands) {
      if (f.btm < lo || f.top > hi) continue;
      const y0 = yOf(Math.max(lo, f.top));
      const y1 = yOf(Math.min(hi, f.btm));
      if (y1 - y0 < 0.2) continue;
      ctx.fillStyle = formColorBand(f.name, f.idx);
      ctx.fillRect(0, y0, W, y1 - y0);
    }

    // Depth gridlines (no labels — the shared DepthTrack carries those).
    const step = niceStep(span / Math.max(5, H / 55));
    ctx.strokeStyle = "#eef2f7"; ctx.lineWidth = 1;
    for (let d = Math.ceil(lo / step) * step; d <= hi; d += step) {
      const y = yOf(d);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // (c) Lithology composition bands: colour fill, then multiply-blend pattern.
    for (const l of well.lithology) {
      const to = typeof l.to === "number" && l.to > l.from ? l.to : l.from + 1;
      if (to < lo || l.from > hi) continue;
      const y0 = yOf(l.from), y1 = Math.max(y0 + 0.4, yOf(to));
      const comps = l.comps.filter((c) => selLitho.has(c.name));
      const denom = Math.max(100, comps.reduce((sum, c) => sum + c.pct, 0));
      let x = 0;
      for (const c of comps) {
        const w = (c.pct / denom) * W;
        ctx.fillStyle = c.color; ctx.fillRect(x, y0, w, y1 - y0);
        const img = images.get(c.pattern);
        if (img && img.width) {
          const pat = ctx.createPattern(img, "repeat");
          if (pat) { ctx.save(); ctx.globalAlpha = opacity; ctx.globalCompositeOperation = "multiply"; ctx.fillStyle = pat; ctx.fillRect(x, y0, w, y1 - y0); ctx.restore(); }
        }
        x += w;
      }
    }

    // (d) Thick RED boundary line at each formation top — the most visible cue.
    for (const f of formBands) {
      if (f.top < lo || f.top > hi) continue;
      const y = yOf(f.top);
      ctx.strokeStyle = "#dc2626"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // (e) BOLD opaque label chip, just below each top line. The chip
    // height/padding scale with the font size.
    const FORM_FONT = 12.5;
    const chipH = Math.round(FORM_FONT + 7); // room for the bigger glyphs
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    ctx.font = `bold ${FORM_FONT}px sans-serif`;
    for (const f of formBands) {
      if (f.top < lo || f.top > hi) continue;
      if (!f.name) continue;
      const y = yOf(f.top);
      const tw = ctx.measureText(f.name).width;
      const chipW = Math.min(W - 6, tw + 12);
      const chipX = 3;
      const chipY = y + 2; // just below the top line
      // Solid near-white chip with a thin border + a left colour tab.
      ctx.fillStyle = "#ffffff"; ctx.fillRect(chipX, chipY, chipW, chipH);
      ctx.fillStyle = formColorSolid(f.name, f.idx); ctx.fillRect(chipX, chipY, 4, chipH);
      ctx.strokeStyle = "#94a3b8"; ctx.lineWidth = 0.75; ctx.strokeRect(chipX + 0.5, chipY + 0.5, chipW - 1, chipH - 1);
      ctx.fillStyle = "#0f172a";
      ctx.save();
      ctx.beginPath(); ctx.rect(chipX + 6, chipY, chipW - 7, chipH); ctx.clip();
      ctx.fillText(f.name, chipX + 8, chipY + chipH - 6);
      ctx.restore();
    }

    // (f) Plot border.
    ctx.strokeStyle = "#cbd5e1"; ctx.lineWidth = 0.8; ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
  }, [well, win, images, selLitho, opacity, width, heightPx, formBands]); // eslint-disable-line react-hooks/exhaustive-deps

  const compAt = (depth: number) => {
    const l = well.lithology.find((x) => depth >= x.from && depth < (typeof x.to === "number" ? x.to : x.from + 1));
    let form: string | null = null;
    for (const fo of well.formations) if (fo.md <= depth) form = fo.name;
    return { comps: l ? l.comps.filter((c) => selLitho.has(c.name)) : [], form };
  };

  return (
    <div className="shrink-0" style={{ width: W }}>
      {/* Frozen well header (sticks to the top while scrolling vertically). */}
      <div className="sticky top-0 z-10 bg-white">
        <div className="text-xs font-bold text-blue-700 text-center truncate flex items-end justify-center pb-0.5" title={well.name}
          style={{ height: headerH }}>
          {well.wellCode}
        </div>
      </div>
      <div className="relative" style={{ width: W, height: H }}>
        <canvas
          ref={canvasRef}
          className="block cursor-crosshair"
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const my = e.clientY - r.top;
            if (my < 0 || my > r.height) { setHover(null); return; }
            // Use the measured rect height so the readout depth lines up with
            // the shared depth axis at any Zoom Y.
            const depth = dOf(my, r.height);
            const { comps, form } = compAt(depth);
            setHover({ x: e.clientX - r.left, y: my, depth, form, comps });
          }}
          onMouseLeave={() => setHover(null)}
        />
        {/* Floating cursor-following readout. */}
        {hover && (
          <div className="absolute z-20 pointer-events-none bg-gray-900/90 text-white text-[10px] rounded px-1.5 py-1 shadow"
            style={{ left: Math.min(hover.x + 12, W - 130), top: Math.min(hover.y + 12, H - 60) }}>
            <div className="font-semibold">{Math.round(hover.depth)} m</div>
            {hover.form && <div className="font-bold text-blue-300">{hover.form}</div>}
            {hover.comps.length ? hover.comps.map((c, i) => (
              <div key={i} className="flex items-center gap-1 whitespace-nowrap">
                <span className="inline-block w-2.5 h-2.5 rounded-sm border border-gray-500" style={{ backgroundColor: c.color, backgroundImage: c.pattern ? `url(/api/ddr/litho-pattern/${c.pattern})` : undefined, backgroundBlendMode: "multiply", backgroundSize: "10px" }} />
                {c.name} <span className="tabular-nums text-gray-300">{c.pct}%</span>
              </div>
            )) : <div className="text-gray-400">no sample</div>}
          </div>
        )}
      </div>
    </div>
  );
}
