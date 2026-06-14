/**
 * Mud-properties well-log graph (the Delphi DRAWmud, Unit1.pas:1126, ported).
 *
 * Layout: ONE shared vertical axis on the left — depth (inverted: shallow at
 * top) or date — then side-by-side property tracks. Each track is one property
 * (or one merged group, e.g. Min/Max wt); every selected well is overlaid as a
 * curve. When a single well is selected (depth mode), its lithology + formation
 * column is shown as the FIRST track (reused WellTrack) so the depth scale lines
 * up across every track.
 *
 *   • separate track  → coloured by WELL (one colour per well)
 *   • merged track    → coloured by PROPERTY; if >1 well, dashed per well
 *
 * Curves render as STEP lines (value held over its interval), straight LINEs, or
 * POINTS. Each track's value (X) axis lives in the FROZEN header — showing the
 * axis min, max and round ticks — so it stays put while you scroll depth.
 * Hovering a track drops a depth cursor and shows THAT chart's value for each
 * selected well at the cursor depth.
 */
import { useMemo, useState } from "react";
import type { MudRow } from "./MudProperties.js";
import {
  DepthTrack, WellTrack, usePatternImages, ZoomStepper,
  widthFor, heightFor, HEADER_H, niceStep, type GraphWell,
} from "./LithologyGraph.js";

export interface MudTrack {
  id: string;
  label: string;
  keys: { key: keyof MudRow; label: string; color: string }[];
}
type Mode = "step" | "line" | "points";
interface DepthRange { min: number; max: number }

const WELL_PALETTE = [
  "#1e40af", "#dc2626", "#0d9488", "#d97706", "#7c3aed", "#65a30d",
  "#db2777", "#0891b2", "#ea580c", "#4f46e5", "#16a34a", "#9f1239",
];
const DASH = ["", "5,3", "2,2", "7,3,2,3", "1,3"];
const AXIS_H = 18;                 // value-axis strip height inside the frozen header
const HEAD = HEADER_H + AXIS_H;    // total frozen header height (label + axis)
const fmtV = (v: number): string => (Number.isInteger(v) ? String(v) : v.toFixed(Math.abs(v) < 10 ? 2 : 1));

export function MudLogGraph({ rows, xAxis, tracks, litho, note, wellNames }: {
  rows: MudRow[];
  xAxis: "depth" | "date";
  tracks: MudTrack[];
  litho: GraphWell | null;
  note?: string;
  wellNames?: Map<string, string>;
}) {
  const [zoomY, setZoomY] = useState(1);
  const [zoomX, setZoomX] = useState(1);
  const [mode, setMode] = useState<Mode>("step");

  const wells = useMemo(() => [...new Set(rows.map((r) => r.wellCode))], [rows]);
  const anyMerged = useMemo(() => tracks.some((t) => t.keys.length > 1), [tracks]);
  const nameOf = (w: string) => wellNames?.get(w) ?? w;   // well code → display name
  const wellColor = useMemo(() => { const m = new Map<string, string>(); wells.forEach((w, i) => m.set(w, WELL_PALETTE[i % WELL_PALETTE.length])); return m; }, [wells]);
  const rowsByWell = useMemo(() => { const m = new Map<string, MudRow[]>(); for (const r of rows) { const a = m.get(r.wellCode); if (a) a.push(r); else m.set(r.wellCode, [r]); } return m; }, [rows]);

  const dates = useMemo(() => (xAxis === "date" ? [...new Set(rows.map((r) => r.date).filter(Boolean) as string[])].sort() : []), [rows, xAxis]);
  const dateRank = useMemo(() => { const m = new Map<string, number>(); dates.forEach((d, i) => m.set(d, i)); return m; }, [dates]);
  const yOfRow = useMemo(() => (r: MudRow): number | null =>
    xAxis === "depth" ? (typeof r.from === "number" ? r.from : null) : (r.date != null ? dateRank.get(r.date) ?? null : null),
  [xAxis, dateRank]);

  const win = useMemo<DepthRange | null>(() => {
    let lo = Infinity, hi = -Infinity;
    for (const r of rows) { const y = yOfRow(r); if (y == null) continue; if (y < lo) lo = y; if (y > hi) hi = y; }
    if (xAxis === "depth" && litho) for (const l of litho.lithology) { if (l.from < lo) lo = l.from; const t = l.to ?? l.from; if (t > hi) hi = t; }
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return null;
    return { min: lo, max: lo === hi ? lo + 1 : hi };
  }, [rows, xAxis, litho, yOfRow]);

  const lithoPatterns = useMemo(() => (litho ? [...new Set(litho.lithology.flatMap((l) => l.comps.map((c) => c.pattern)).filter(Boolean))] : []), [litho]);
  const lithoImages = usePatternImages(lithoPatterns);
  const allLitho = useMemo(() => new Set(litho ? litho.lithology.flatMap((l) => l.comps.map((c) => c.name)) : []), [litho]);
  const fmtY = useMemo(() => (xAxis === "depth" ? (y: number) => String(Math.round(y)) : (y: number) => dates[Math.max(0, Math.min(dates.length - 1, Math.round(y)))] ?? ""), [xAxis, dates]);

  if (note) return <div className="p-8 text-center text-sm text-gray-400">{note}</div>;
  if (!rows.length) return <div className="p-8 text-center text-sm text-gray-400">No rows to plot.</div>;
  if (!tracks.length) return <div className="p-8 text-center text-sm text-gray-400">Tick at least one property to plot.</div>;
  if (!win) return <div className="p-8 text-center text-sm text-gray-400">No plottable points for the chosen axis.</div>;

  const trackH = heightFor(win.max - win.min, zoomY);
  const trackW = widthFor(zoomX);
  const showLitho = xAxis === "depth" && !!litho && wells.length === 1;

  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="shrink-0 flex items-center flex-wrap gap-x-5 gap-y-2 px-2 py-1.5 border-b border-gray-100 text-[11px] text-gray-600">
        <div className="flex items-center gap-1.5"><span className="text-gray-500">Zoom Y</span><ZoomStepper value={zoomY} onChange={setZoomY} /></div>
        <div className="flex items-center gap-1.5"><span className="text-gray-500">Zoom X</span><ZoomStepper value={zoomX} onChange={setZoomX} /></div>
        <div className="inline-flex rounded border border-gray-300 overflow-hidden">
          {(["step", "line", "points"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} className={`px-2 h-6 capitalize ${mode === m ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>{m}</button>
          ))}
        </div>
        <button onClick={() => { setZoomY(1); setZoomX(1); }} className="h-6 px-2 rounded border border-gray-300 bg-white hover:bg-gray-50">Reset</button>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-semibold uppercase tracking-wide text-gray-500">Wells</span>
          {/* Show each well's colour AND its dash: separate tracks tell wells apart
              by colour, merged tracks (e.g. Initial/10min gel) by dash — so the
              legend must carry both to match every track. */}
          {wells.map((w, wi) => (<span key={w} className="inline-flex items-center gap-1"><LineSwatch color={wellColor.get(w) ?? "#1e40af"} dash={DASH[wi % DASH.length]} />{nameOf(w)}</span>))}
        </div>
        {anyMerged && wells.length > 1 && (
          <div className="text-[10px] text-gray-400">Merged tracks: one colour per property; wells shown by line dash.</div>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        <div className="flex gap-3 items-start w-max p-2">
          <DepthTrack win={win} heightPx={trackH} headerH={HEAD} title={xAxis === "depth" ? "Depth" : "Date"} fmt={fmtY} />
          {showLitho && litho && (
            <WellTrack well={litho} win={win} images={lithoImages} selLitho={allLitho} opacity={0.85} width={trackW} heightPx={trackH} headerH={HEAD} />
          )}
          {tracks.map((t) => (
            <CurveTrack
              key={t.id} track={t} wells={wells} rowsByWell={rowsByWell} wellColor={wellColor}
              yOfRow={yOfRow} win={win} width={trackW} heightPx={trackH} mode={mode} fmtY={fmtY}
              wellNames={wellNames}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/** One property (or merged group) track: value on X (axis frozen in the header), depth/date on Y (shared). */
function CurveTrack({ track, wells, rowsByWell, wellColor, yOfRow, win, width, heightPx, mode, fmtY, wellNames }: {
  track: MudTrack;
  wells: string[];
  rowsByWell: Map<string, MudRow[]>;
  wellColor: Map<string, string>;
  yOfRow: (r: MudRow) => number | null;
  win: DepthRange;
  width: number; heightPx: number;
  mode: Mode;
  fmtY: (y: number) => string;
  wellNames?: Map<string, string>;
}) {
  const W = width, H = heightPx;
  const lo = win.min, hi = win.max, span = Math.max(1e-9, hi - lo);
  const yOf = (yy: number) => ((yy - lo) / span) * H;
  const multiKey = track.keys.length > 1;
  const [hover, setHover] = useState<{ cx: number; cy: number; yy: number } | null>(null);

  const { lines, vmin, vmax } = useMemo(() => {
    const nameOf = (w: string) => wellNames?.get(w) ?? w;
    const out: { color: string; dash: string; label: string; pts: { yy: number; v: number }[] }[] = [];
    let vmin = Infinity, vmax = -Infinity;
    wells.forEach((well, wi) => {
      const wr = rowsByWell.get(well) ?? [];
      track.keys.forEach((kd) => {
        const pts: { yy: number; v: number }[] = [];
        for (const r of wr) { const yy = yOfRow(r); const v = r[kd.key]; if (yy == null || typeof v !== "number") continue; pts.push({ yy, v }); if (v < vmin) vmin = v; if (v > vmax) vmax = v; }
        if (!pts.length) return;
        pts.sort((a, b) => a.yy - b.yy);
        out.push({
          color: multiKey ? kd.color : (wellColor.get(well) ?? "#1e40af"),
          dash: multiKey ? DASH[wi % DASH.length] : "",
          label: multiKey ? `${kd.label}${wells.length > 1 ? ` · ${nameOf(well)}` : ""}` : nameOf(well),
          pts,
        });
      });
    });
    return { lines: out, vmin, vmax };
  }, [track, wells, rowsByWell, wellColor, yOfRow, multiKey, wellNames]);

  if (!Number.isFinite(vmin)) {
    return <div className="shrink-0" style={{ width: W }}><div className="sticky top-0 z-10 bg-white text-center" style={{ height: HEAD }}><span className="text-xs font-semibold text-gray-700">{track.label}</span></div><div className="grid place-items-center text-[11px] text-gray-400 border border-gray-200 bg-white" style={{ width: W, height: H }}>no data</div></div>;
  }
  // Round axis bounds so the min/max + ticks are clean numbers.
  const rawStep = niceStep((Math.max(1e-9, vmax - vmin) || Math.abs(vmax) || 1) / 4);
  let a = Math.floor(vmin / rawStep) * rawStep;
  let b = Math.ceil(vmax / rawStep) * rawStep;
  if (a === b) { a -= rawStep; b += rawStep; }
  const xOf = (v: number) => ((v - a) / (b - a)) * W;
  const ticks: number[] = [];
  for (let x = a; x <= b + 1e-9; x += rawStep) ticks.push(Number(x.toFixed(6)));

  const pointsStr = (pts: { yy: number; v: number }[]) => pts.map((p) => `${xOf(p.v).toFixed(1)},${yOf(p.yy).toFixed(1)}`).join(" ");
  const stepStr = (pts: { yy: number; v: number }[]) => { const o: string[] = []; pts.forEach((p, i) => { if (i > 0) o.push(`${xOf(pts[i - 1].v).toFixed(1)},${yOf(p.yy).toFixed(1)}`); o.push(`${xOf(p.v).toFixed(1)},${yOf(p.yy).toFixed(1)}`); }); return o.join(" "); };

  // This chart's value for every well/key at the hovered depth, read so it MATCHES
  // the curve as drawn (per mode): the marker sits ON the line and the value
  // changes at the data-point depths — NOT at the midpoint between points (the old
  // "nearest" behaviour, where the value held while the marker drifted down with
  // the cursor and then jumped sideways at the half-way mark). Outside a series'
  // [shallowest, deepest] span there's no data → null, so the readout shows "—".
  // pts are sorted shallow→deep; `my` is the depth to draw this well's marker at.
  const readout = hover ? lines.map((ln) => {
    const pts = ln.pts, first = pts[0], last = pts[pts.length - 1];
    let v: number | null = null;
    let my = hover.yy;
    if (first && hover.yy >= first.yy && hover.yy <= last.yy) {
      if (mode === "points") {
        // No connecting line — snap to (and mark) the nearest actual point.
        let bd = Infinity, bp = first;
        for (const p of pts) { const d = Math.abs(p.yy - hover.yy); if (d < bd) { bd = d; bp = p; } }
        v = bp.v; my = bp.yy;
      } else if (mode === "line") {
        // Straight line — interpolate between the two points bracketing the cursor.
        let lo = first, hi = last;
        for (const p of pts) { if (p.yy <= hover.yy) lo = p; else { hi = p; break; } }
        v = hi.yy === lo.yy ? lo.v : lo.v + (hi.v - lo.v) * ((hover.yy - lo.yy) / (hi.yy - lo.yy));
      } else {
        // step (default) — pin to the data point whose value the step line HOLDS
        // over the cursor's interval (the deepest point at or above the cursor).
        // The marker sits ON that point and the value is its value, so while the
        // held value is constant the marker stays put — it jumps to the next point
        // exactly at the next data-point depth (the step), never drifting between.
        let fp = first;
        for (const p of pts) { if (p.yy <= hover.yy) fp = p; else break; }
        v = fp.v; my = fp.yy;
      }
    }
    return { color: ln.color, dash: ln.dash, label: ln.label, v, my };
  }) : [];

  return (
    <div className="shrink-0" style={{ width: W }}>
      {/* Frozen header: track label + value (X) axis with min, max and ticks. */}
      <div className="sticky top-0 z-10 bg-white" style={{ height: HEAD }}>
        <div className="text-xs font-semibold text-gray-700 text-center truncate px-1" title={track.label} style={{ height: HEADER_H, lineHeight: `${HEADER_H}px` }}>{track.label}</div>
        <svg width={W} height={AXIS_H} className="block">
          <line x1={0} x2={W} y1={AXIS_H - 0.5} y2={AXIS_H - 0.5} stroke="#cbd5e1" strokeWidth={0.75} />
          {ticks.map((v, i) => {
            const x = xOf(v); const anchor = x < 8 ? "start" : x > W - 8 ? "end" : "middle"; const tx = x < 8 ? 1 : x > W - 8 ? W - 1 : x;
            return <g key={i}><line x1={x} x2={x} y1={AXIS_H - 4} y2={AXIS_H} stroke="#cbd5e1" /><text x={tx} y={AXIS_H - 6} textAnchor={anchor} fontSize={9} fill="#475569">{fmtV(v)}</text></g>;
          })}
        </svg>
      </div>
      {/* Plot. */}
      <svg
        width={W} height={H} className="block bg-white border border-gray-200"
        onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); const cy = e.clientY - r.top; setHover({ cx: e.clientX, cy: e.clientY, yy: lo + (cy / Math.max(1, r.height)) * span }); }}
        onMouseLeave={() => setHover(null)}
      >
        {ticks.map((v, i) => <line key={`g${i}`} x1={xOf(v)} x2={xOf(v)} y1={0} y2={H} stroke="#eef2f7" />)}
        {lines.map((ln, i) => (
          mode === "points"
            ? <g key={i}>{ln.pts.map((p, j) => <circle key={j} cx={xOf(p.v)} cy={yOf(p.yy)} r={1.6} fill={ln.color} />)}</g>
            : <polyline key={i} fill="none" stroke={ln.color} strokeWidth={1.5} strokeDasharray={ln.dash || undefined} points={mode === "step" ? stepStr(ln.pts) : pointsStr(ln.pts)} />
        ))}
        {hover && hover.yy >= lo && hover.yy <= hi && (
          <g>
            <line x1={0} x2={W} y1={yOf(hover.yy)} y2={yOf(hover.yy)} stroke="#64748b" strokeWidth={0.75} strokeDasharray="3,3" />
            {readout.map((r, i) => r.v == null ? null : <circle key={i} cx={xOf(r.v)} cy={yOf(r.my)} r={2.5} fill={r.color} stroke="#fff" strokeWidth={0.75} />)}
          </g>
        )}
      </svg>
      {/* Hover readout: this chart's value per well at the cursor depth. The top
          header carries the graph (track) header; each row shows the well's line
          colour then its NAME, over a milky (frosted-glass) background. */}
      {hover && readout.some((r) => r.v != null) && (
        <div className="fixed z-50 pointer-events-none bg-white/85 backdrop-blur-md text-gray-800 text-[10px] rounded px-2 py-1.5 shadow-lg ring-1 ring-black/10"
          style={{ left: Math.min(hover.cx + 14, window.innerWidth - 180), top: Math.min(hover.cy + 12, window.innerHeight - 20 - readout.length * 13) }}>
          <div className="font-semibold text-center text-gray-900 border-b border-gray-300 pb-1 mb-1 px-1">{track.label}<span className="font-normal text-gray-500"> · {fmtY(hover.yy)}{/* depth/date */}</span></div>
          {readout.map((r, i) => (
            <div key={i} className="flex items-center gap-2 whitespace-nowrap">
              <LineSwatch color={r.color} dash={r.dash} />
              <span className="font-medium text-gray-800">{r.label}</span>
              <span className="tabular-nums text-gray-500 ml-auto pl-3">{r.v == null ? "—" : fmtV(r.v)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** A small legend/tooltip swatch drawn as a LINE so the dash pattern reads — in a
 *  merged track, wells differ only by dash (same colour per property), so a plain
 *  colour bar can't tell e.g. "Initial gel · WellA" from "· WellB". */
function LineSwatch({ color, dash }: { color: string; dash?: string }) {
  return (
    <svg width={16} height={6} className="shrink-0" style={{ overflow: "visible" }} aria-hidden>
      <line x1={0} x2={16} y1={3} y2={3} stroke={color} strokeWidth={1.5} strokeDasharray={dash || undefined} />
    </svg>
  );
}
