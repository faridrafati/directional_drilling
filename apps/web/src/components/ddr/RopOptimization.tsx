/**
 * ROP Optimization — drilling-performance explorer over the bit table (L05),
 * sitting next to the Tools tab. Each bit record becomes one operating point:
 * X = weight-on-bit (midpoint of the recorded MinWeight–MaxWeight range),
 * Y = RPM (midpoint of MinRPM–MaxRPM), Z = ROP (footage ÷ rotating hours). The
 * centrepiece is a WOB×RPM contour heatmap whose cell colour is the mean ROP of
 * the points in that cell — the classic "drill-off" parameter map showing where
 * weight/speed combinations drilled fastest. Faceted by fields / wells / bit
 * sizes / mud types / Jalali date, exactly like the other DDR tabs.
 *
 * Views (over one fetch): CONTOUR (heatmap + scatter overlay), SCATTERS
 * (ROP-vs-WOB and ROP-vs-RPM), BY SIZE (mean ROP per bit size), TABLE (the raw
 * records — a row opens that day's daily report).
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer, ScatterChart, Scatter, BarChart, Bar,
  XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, Legend, Cell,
} from "recharts";
import { api } from "../../api/client.js";
import { MultiSelect, type Item } from "./DdrRemarksSearch.js";
import { JalaliDatePicker } from "./JalaliDatePicker.js";
import { useFacetOptions } from "./useFacetOptions.js";

interface SearchOptions {
  fields: string[]; wells: { code: string; name: string; field: string | null }[];
  holeSizes: string[]; mudTypes: string[]; rigs: string[];
}
interface RopPoint {
  wob: number; rpm: number; rop: number; bitSize: string;
  wellCode: string; name: string; field: string | null;
  date: string | null; serialNo: number | null;
}
interface RopData {
  points: RopPoint[]; bitSizes: string[]; truncated?: boolean; total?: number; note?: string;
}

type View = "contour" | "scatter" | "size" | "table";
const VIEWS: { key: View; label: string }[] = [
  { key: "contour", label: "Contour" },
  { key: "scatter", label: "Scatters" },
  { key: "size", label: "By bit size" },
  { key: "table", label: "Table" },
];

// Distinct hues for per-bit-size series across the scatter charts + heatmap legend.
const SIZE_COLORS = ["#1e40af", "#0d9488", "#7c3aed", "#db2777", "#d97706", "#65a30d", "#dc2626", "#0891b2", "#9333ea", "#ca8a04"];
const colorForSize = (sizes: string[], size: string) => SIZE_COLORS[Math.max(0, sizes.indexOf(size)) % SIZE_COLORS.length];

const fmt1 = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));

export function RopOptimization({ onOpenReport }: { onOpenReport?: (wellCode: string, serialNo: number, date: string | null) => void } = {}) {
  const [selFields, setSelFields] = useState<string[]>([]);
  const [selWells, setSelWells] = useState<string[]>([]);
  const [selHole, setSelHole] = useState<string[]>([]);
  const [selMud, setSelMud] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [data, setData] = useState<RopData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>("contour");

  const optsQ = useQuery({ queryKey: ["ddr", "search-options"], queryFn: () => api.get<SearchOptions>("/ddr/search-options") });
  const o = optsQ.data;
  const facet = useFacetOptions(selFields, selWells, o);

  const wellItems = useMemo<Item[]>(() => {
    const fset = new Set(selFields);
    const visible = (o?.wells ?? []).filter((w) => !fset.size || (w.field != null && fset.has(w.field)));
    const nameCount = new Map<string, number>();
    for (const w of visible) { const n = w.name || w.code; nameCount.set(n, (nameCount.get(n) ?? 0) + 1); }
    return visible.map((w) => {
      const n = w.name || w.code;
      const dup = (nameCount.get(n) ?? 0) > 1;
      return { value: w.code, label: dup ? `${n} (${w.code})` : n, keywords: `${w.code} ${n}` };
    });
  }, [o?.wells, selFields]);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const body = { fields: selFields, wells: selWells, holeSizes: selHole, mudTypes: selMud, dateFrom, dateTo };
      setData(await api.post<RopData>("/ddr/rop-optimization", body));
    } catch (e) { setError(String(e)); } finally { setLoading(false); }
  }
  function clearAll() {
    setSelFields([]); setSelWells([]); setSelHole([]); setSelMud([]); setDateFrom(""); setDateTo(""); setData(null);
  }

  const points = data?.points ?? [];
  const bitSizes = data?.bitSizes ?? [];

  return (
    <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4 overflow-hidden">
      <div className="flex flex-col min-h-0 bg-white border border-gray-200 rounded p-3 overflow-y-auto">
        <MultiSelect title="Fields" items={(o?.fields ?? []).map((f) => ({ value: f, label: f }))} selected={selFields} onChange={setSelFields} />
        <MultiSelect title={selFields.length ? `Wells · in ${selFields.length} field(s)` : "Wells"} items={wellItems} selected={selWells} onChange={setSelWells} />
        <MultiSelect title="Bit sizes" items={facet.holeSizes.map((h) => ({ value: h, label: h }))} selected={selHole} onChange={setSelHole} />
        <MultiSelect title="Mud types" items={facet.mudTypes.map((m) => ({ value: m, label: m }))} selected={selMud} onChange={setSelMud} />
        <div className="pt-2">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-600 mb-1">Date range (Jalali)</div>
          <div className="flex items-center gap-1.5">
            <JalaliDatePicker value={dateFrom} onChange={setDateFrom} placeholder="From" />
            <span className="text-gray-400">–</span>
            <JalaliDatePicker value={dateTo} onChange={setDateTo} placeholder="To" />
          </div>
        </div>
        <div className="flex gap-2 pt-3">
          <button onClick={() => void run()} disabled={loading} className="h-9 px-4 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300">{loading ? "Loading…" : "Show"}</button>
          <button onClick={clearAll} className="h-9 px-3 text-sm rounded border border-gray-300 hover:bg-gray-50">Clear</button>
        </div>
        {error && <div className="text-xs text-red-600 pt-2">{error}</div>}
        <p className="text-[11px] text-gray-400 pt-3 leading-snug">
          WOB &amp; RPM are the midpoints of each bit record's recorded min–max range. ROP = drilled metres ÷ rotating hours.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded flex flex-col min-h-0 overflow-hidden">
        <div className="px-3 py-2 border-b border-gray-100 shrink-0 flex items-center justify-between gap-2 flex-wrap">
          <span className="text-sm text-gray-600 min-w-0 truncate">
            {data
              ? (data.note ? data.note : <><b>{points.length}</b> bit records{data.truncated ? ` (capped — ${data.total})` : ""} · {bitSizes.length} bit size{bitSizes.length === 1 ? "" : "s"}</>)
              : "Pick a field / well, then Show."}
          </span>
          {!!points.length && (
            <div className="inline-flex rounded border border-gray-300 overflow-hidden shrink-0">
              {VIEWS.map((v) => (
                <button key={v.key} onClick={() => setView(v.key)}
                  className={`px-2.5 h-7 text-xs ${view === v.key ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
                  {v.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="overflow-auto flex-1 min-h-0 p-3">
          {!data ? <Empty>Pick a field or well in the sidebar, then press Show.</Empty>
            : !points.length ? <Empty>{data.note ?? "No bit records with usable WOB / RPM / ROP for this selection."}</Empty>
            : view === "contour" ? <ContourView points={points} bitSizes={bitSizes} />
            : view === "scatter" ? <ScatterView points={points} bitSizes={bitSizes} />
            : view === "size" ? <BySizeView points={points} bitSizes={bitSizes} />
            : <TableView points={points} onOpenReport={onOpenReport} />}
        </div>
      </div>
    </div>
  );
}

// ── Contour: a binned WOB×RPM heatmap, cells coloured by mean ROP ────────────

const ROP_STOPS: [number, string][] = [
  [0, "#2c3e9e"], [0.2, "#2c7fb8"], [0.4, "#41b6c4"], [0.55, "#7fcdbb"],
  [0.7, "#c7e9b4"], [0.82, "#fed976"], [0.92, "#fd8d3c"], [1, "#e31a1c"],
];
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function hex(c: string) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
/** Sequential cool→warm ROP colour for a value in [0,1]. */
function ropColor(t: number): string {
  const u = Math.max(0, Math.min(1, t));
  for (let i = 1; i < ROP_STOPS.length; i++) {
    if (u <= ROP_STOPS[i][0]) {
      const [p0, c0] = ROP_STOPS[i - 1], [p1, c1] = ROP_STOPS[i];
      const k = (u - p0) / (p1 - p0 || 1);
      const a = hex(c0), b = hex(c1);
      return `rgb(${Math.round(lerp(a[0], b[0], k))},${Math.round(lerp(a[1], b[1], k))},${Math.round(lerp(a[2], b[2], k))})`;
    }
  }
  return ROP_STOPS[ROP_STOPS.length - 1][1];
}

/** A "nice" bin step (1/2/5 × 10ⁿ) for a target bin count over a span. */
function niceStep(span: number, target: number): number {
  const raw = span / Math.max(1, target);
  const p = Math.pow(10, Math.floor(Math.log10(Math.max(1e-9, raw))));
  const n = raw / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

function ContourView({ points, bitSizes }: { points: RopPoint[]; bitSizes: string[] }) {
  const [sizeFilter, setSizeFilter] = useState<string>("");   // "" = all sizes
  const [overlay, setOverlay] = useState(true);

  const pts = useMemo(() => (sizeFilter ? points.filter((p) => p.bitSize === sizeFilter) : points), [points, sizeFilter]);

  const grid = useMemo(() => buildGrid(pts), [pts]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap text-xs">
        <label className="flex items-center gap-1.5 text-gray-600">
          Bit size
          <select value={sizeFilter} onChange={(e) => setSizeFilter(e.target.value)} className="h-7 border border-gray-300 rounded px-1.5 bg-white">
            <option value="">All ({points.length})</option>
            {bitSizes.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-gray-600 cursor-pointer">
          <input type="checkbox" checked={overlay} onChange={(e) => setOverlay(e.target.checked)} /> Show data points
        </label>
        <span className="text-gray-400">Cell colour = mean ROP (m/hr) of the bit records in that WOB×RPM cell.</span>
      </div>
      {grid ? <Heatmap grid={grid} points={overlay ? pts : []} /> : <Empty>Not enough points to bin.</Empty>}
    </div>
  );
}

interface Grid {
  wobMin: number; wobStep: number; nx: number;
  rpmMin: number; rpmStep: number; ny: number;
  cells: { sum: number; n: number }[];   // length nx*ny, row-major (x + y*nx)
  ropMin: number; ropMax: number;
}
function buildGrid(pts: RopPoint[]): Grid | null {
  if (pts.length < 2) return null;
  let wlo = Infinity, whi = -Infinity, rlo = Infinity, rhi = -Infinity, plo = Infinity, phi = -Infinity;
  for (const p of pts) {
    wlo = Math.min(wlo, p.wob); whi = Math.max(whi, p.wob);
    rlo = Math.min(rlo, p.rpm); rhi = Math.max(rhi, p.rpm);
    plo = Math.min(plo, p.rop); phi = Math.max(phi, p.rop);
  }
  if (!Number.isFinite(wlo) || whi <= wlo || rhi <= rlo) return null;
  const wobStep = niceStep(whi - wlo, 14), rpmStep = niceStep(rhi - rlo, 12);
  const wobMin = Math.floor(wlo / wobStep) * wobStep;
  const rpmMin = Math.floor(rlo / rpmStep) * rpmStep;
  const nx = Math.max(1, Math.ceil((whi - wobMin) / wobStep + 1e-9));
  const ny = Math.max(1, Math.ceil((rhi - rpmMin) / rpmStep + 1e-9));
  const cells = Array.from({ length: nx * ny }, () => ({ sum: 0, n: 0 }));
  for (const p of pts) {
    const ix = Math.min(nx - 1, Math.floor((p.wob - wobMin) / wobStep));
    const iy = Math.min(ny - 1, Math.floor((p.rpm - rpmMin) / rpmStep));
    const c = cells[ix + iy * nx]; c.sum += p.rop; c.n += 1;
  }
  return { wobMin, wobStep, nx, rpmMin, rpmStep, ny, cells, ropMin: plo, ropMax: phi };
}

function Heatmap({ grid, points }: { grid: Grid; points: RopPoint[] }) {
  const [hover, setHover] = useState<{ x: number; y: number; html: string } | null>(null);
  const PAD = { l: 64, r: 24, t: 12, b: 48 };
  const CW = 46, CH = 30;                                  // px per cell
  const plotW = grid.nx * CW, plotH = grid.ny * CH;
  const W = PAD.l + plotW + PAD.r, H = PAD.t + plotH + PAD.b;
  const span = grid.ropMax - grid.ropMin || 1;
  const norm = (rop: number) => (rop - grid.ropMin) / span;
  // Screen position: x grows right, RPM (y) grows UP, so high RPM at the top.
  const sx = (wob: number) => PAD.l + ((wob - grid.wobMin) / grid.wobStep) * CW;
  const sy = (rpm: number) => PAD.t + plotH - ((rpm - grid.rpmMin) / grid.rpmStep) * CH;

  return (
    <div className="relative inline-block">
      <svg width={W} height={H} className="block max-w-full" style={{ fontFamily: "inherit" }}>
        {/* cells */}
        {grid.cells.map((c, i) => {
          if (!c.n) return null;
          const ix = i % grid.nx, iy = Math.floor(i / grid.nx);
          const mean = c.sum / c.n;
          const x = PAD.l + ix * CW, y = PAD.t + plotH - (iy + 1) * CH;
          const wobLo = grid.wobMin + ix * grid.wobStep, rpmLo = grid.rpmMin + iy * grid.rpmStep;
          const html = `WOB ${fmt1(wobLo)}–${fmt1(wobLo + grid.wobStep)} klb · RPM ${Math.round(rpmLo)}–${Math.round(rpmLo + grid.rpmStep)}<br/><b>mean ROP ${mean.toFixed(1)} m/hr</b> · ${c.n} record${c.n === 1 ? "" : "s"}`;
          return (
            <rect key={i} x={x} y={y} width={CW} height={CH} fill={ropColor(norm(mean))} stroke="#ffffff" strokeWidth={1}
              onMouseEnter={(e) => setHover({ x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY, html })}
              onMouseMove={(e) => setHover({ x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY, html })}
              onMouseLeave={() => setHover(null)} />
          );
        })}
        {/* scatter overlay */}
        {points.map((p, i) => (
          <circle key={i} cx={sx(p.wob)} cy={sy(p.rpm)} r={2.2} fill="#111827" fillOpacity={0.45} stroke="#fff" strokeWidth={0.4} pointerEvents="none" />
        ))}
        {/* axes frame */}
        <rect x={PAD.l} y={PAD.t} width={plotW} height={plotH} fill="none" stroke="#cbd5e1" />
        {/* X ticks (WOB) */}
        {Array.from({ length: grid.nx + 1 }, (_, k) => {
          const v = grid.wobMin + k * grid.wobStep, x = PAD.l + k * CW;
          return (
            <g key={`x${k}`}>
              <line x1={x} y1={PAD.t + plotH} x2={x} y2={PAD.t + plotH + 4} stroke="#94a3b8" />
              <text x={x} y={PAD.t + plotH + 16} textAnchor="middle" fontSize={10} fill="#475569">{fmt1(v)}</text>
            </g>
          );
        })}
        <text x={PAD.l + plotW / 2} y={H - 8} textAnchor="middle" fontSize={11} fill="#334155" fontWeight={600}>Weight on bit (klb)</text>
        {/* Y ticks (RPM) — bottom→top */}
        {Array.from({ length: grid.ny + 1 }, (_, k) => {
          const v = grid.rpmMin + k * grid.rpmStep, y = PAD.t + plotH - k * CH;
          return (
            <g key={`y${k}`}>
              <line x1={PAD.l - 4} y1={y} x2={PAD.l} y2={y} stroke="#94a3b8" />
              <text x={PAD.l - 8} y={y + 3} textAnchor="end" fontSize={10} fill="#475569">{Math.round(v)}</text>
            </g>
          );
        })}
        <text transform={`translate(14 ${PAD.t + plotH / 2}) rotate(-90)`} textAnchor="middle" fontSize={11} fill="#334155" fontWeight={600}>RPM</text>
      </svg>
      <Colorbar ropMin={grid.ropMin} ropMax={grid.ropMax} />
      {hover && (
        <div className="absolute z-20 pointer-events-none px-2 py-1 rounded bg-gray-900 text-white text-[11px] leading-tight shadow-lg"
          style={{ left: hover.x + 12, top: hover.y + 12, maxWidth: 240 }}
          dangerouslySetInnerHTML={{ __html: hover.html }} />
      )}
    </div>
  );
}

/** Horizontal ROP colour legend under the heatmap. */
function Colorbar({ ropMin, ropMax }: { ropMin: number; ropMax: number }) {
  const stops = Array.from({ length: 33 }, (_, i) => i / 32);
  return (
    <div className="flex items-center gap-2 mt-1 ml-16 text-[10px] text-gray-500">
      <span>ROP {ropMin.toFixed(1)}</span>
      <div className="flex h-3 w-48 rounded overflow-hidden border border-gray-300">
        {stops.map((t, i) => <div key={i} style={{ background: ropColor(t), width: `${100 / stops.length}%` }} />)}
      </div>
      <span>{ropMax.toFixed(1)} m/hr</span>
    </div>
  );
}

// ── Scatters: ROP vs WOB and ROP vs RPM, split by bit size ───────────────────

function ScatterView({ points, bitSizes }: { points: RopPoint[]; bitSizes: string[] }) {
  const series = useMemo(() => {
    const m = new Map<string, RopPoint[]>();
    for (const p of points) { const a = m.get(p.bitSize); if (a) a.push(p); else m.set(p.bitSize, [p]); }
    return bitSizes.filter((b) => m.has(b)).map((b) => ({ size: b, data: m.get(b)! }));
  }, [points, bitSizes]);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <ScatterPanel title="ROP vs Weight on bit" xKey="wob" xLabel="WOB (klb)" series={series} bitSizes={bitSizes} />
      <ScatterPanel title="ROP vs RPM" xKey="rpm" xLabel="RPM" series={series} bitSizes={bitSizes} />
    </div>
  );
}

function ScatterPanel({ title, xKey, xLabel, series, bitSizes }: {
  title: string; xKey: "wob" | "rpm"; xLabel: string;
  series: { size: string; data: RopPoint[] }[]; bitSizes: string[];
}) {
  return (
    <div className="border border-gray-200 rounded p-2">
      <div className="text-sm font-medium text-gray-700 mb-1">{title}</div>
      <ResponsiveContainer width="100%" height={340}>
        <ScatterChart margin={{ top: 8, right: 12, bottom: 28, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
          <XAxis type="number" dataKey={xKey} name={xLabel} tick={{ fontSize: 11 }}
            label={{ value: xLabel, position: "insideBottom", offset: -14, fontSize: 11 }} />
          <YAxis type="number" dataKey="rop" name="ROP" tick={{ fontSize: 11 }}
            label={{ value: "ROP (m/hr)", angle: -90, position: "insideLeft", fontSize: 11 }} />
          <ZAxis range={[28, 28]} />
          <Tooltip cursor={{ strokeDasharray: "3 3" }} content={<ScatterTip xKey={xKey} xLabel={xLabel} />} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {series.map((s) => (
            <Scatter key={s.size} name={s.size} data={s.data} fill={colorForSize(bitSizes, s.size)} fillOpacity={0.6} />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

function ScatterTip({ active, payload, xKey, xLabel }: any) {
  if (!active || !payload?.length) return null;
  const p: RopPoint = payload[0].payload;
  return (
    <div className="px-2 py-1 rounded bg-gray-900 text-white text-[11px] leading-tight shadow-lg">
      <div className="font-semibold">{p.name} · {p.bitSize}"</div>
      <div>{xLabel}: {fmt1(xKey === "wob" ? p.wob : p.rpm)}</div>
      <div>ROP: {p.rop} m/hr</div>
      {p.date && <div className="text-gray-300">{p.date}</div>}
    </div>
  );
}

// ── By bit size: mean / max ROP per bit diameter ─────────────────────────────

function BySizeView({ points, bitSizes }: { points: RopPoint[]; bitSizes: string[] }) {
  const rows = useMemo(() => {
    const m = new Map<string, { sum: number; n: number; max: number }>();
    for (const p of points) {
      const e = m.get(p.bitSize) ?? { sum: 0, n: 0, max: 0 };
      e.sum += p.rop; e.n += 1; e.max = Math.max(e.max, p.rop); m.set(p.bitSize, e);
    }
    return bitSizes.filter((b) => m.has(b)).map((b) => {
      const e = m.get(b)!;
      return { size: b, meanRop: Number((e.sum / e.n).toFixed(2)), maxRop: e.max, n: e.n };
    });
  }, [points, bitSizes]);

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium text-gray-700">Mean ROP by bit size</div>
      <ResponsiveContainer width="100%" height={Math.max(220, rows.length * 46)}>
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 48, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11 }} label={{ value: "Mean ROP (m/hr)", position: "insideBottom", offset: -4, fontSize: 11 }} />
          <YAxis type="category" dataKey="size" width={64} tick={{ fontSize: 11 }} />
          <Tooltip content={<SizeTip />} />
          <Bar dataKey="meanRop" radius={[0, 3, 3, 0]} label={{ position: "right", fontSize: 11, formatter: (v: number) => v.toFixed(1) }}>
            {rows.map((r) => <Cell key={r.size} fill={colorForSize(bitSizes, r.size)} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function SizeTip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload as { size: string; meanRop: number; maxRop: number; n: number };
  return (
    <div className="px-2 py-1 rounded bg-gray-900 text-white text-[11px] leading-tight shadow-lg">
      <div className="font-semibold">{r.size}" bit</div>
      <div>Mean ROP: {r.meanRop} m/hr</div>
      <div>Max ROP: {fmt1(r.maxRop)} m/hr</div>
      <div className="text-gray-300">{r.n} record{r.n === 1 ? "" : "s"}</div>
    </div>
  );
}

// ── Table: the underlying bit records, a row opens that day's report ─────────

function TableView({ points, onOpenReport }: {
  points: RopPoint[]; onOpenReport?: (wellCode: string, serialNo: number, date: string | null) => void;
}) {
  const sorted = useMemo(() => points.slice().sort((a, b) => b.rop - a.rop), [points]);
  return (
    <table className="text-[11px] tabular-nums border-collapse">
      <thead className="sticky top-0 z-20">
        <tr className="bg-gray-100">
          <th className="sticky left-0 z-30 bg-gray-100 border border-gray-300 px-2 py-1 text-left font-semibold text-gray-700 whitespace-nowrap">Well</th>
          {["Date", "Bit size", "WOB (klb)", "RPM", "ROP (m/hr)"].map((h, i) => (
            <th key={h} className={`bg-gray-100 border border-gray-300 px-2 py-1 font-medium text-gray-700 whitespace-nowrap ${i === 0 ? "text-left" : "text-right"}`}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sorted.map((p, ri) => {
          const clickable = !!onOpenReport && p.serialNo != null;
          const zebra = ri % 2 ? "bg-teal-50/40" : "bg-white";
          return (
            <tr key={ri}
              onClick={clickable ? () => onOpenReport!(p.wellCode, p.serialNo!, p.date) : undefined}
              className={`${zebra} ${clickable ? "cursor-pointer hover:bg-blue-50" : ""}`}
              title={clickable ? "Open this day's daily drilling report" : undefined}>
              <th className="sticky left-0 z-10 bg-inherit border border-gray-300 px-2 py-0.5 text-left font-semibold text-gray-800 whitespace-nowrap">{p.name || p.wellCode}</th>
              <td className="border border-gray-300 px-2 py-0.5 text-left whitespace-nowrap">{p.date ?? ""}</td>
              <td className="border border-gray-300 px-2 py-0.5 text-right whitespace-nowrap">{p.bitSize}</td>
              <td className="border border-gray-300 px-2 py-0.5 text-right whitespace-nowrap">{fmt1(p.wob)}</td>
              <td className="border border-gray-300 px-2 py-0.5 text-right whitespace-nowrap">{Math.round(p.rpm)}</td>
              <td className="border border-gray-300 px-2 py-0.5 text-right whitespace-nowrap font-medium">{p.rop}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="p-8 text-center text-sm text-gray-400">{children}</div>;
}
