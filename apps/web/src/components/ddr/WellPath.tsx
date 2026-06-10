/**
 * Multi-well Well Path (directional survey) browser — the port of the Delphi DDR
 * "well path" report (DDR-Delphi/Unit1.pas:4483, tab 4, + drawpat). Faceted by
 * fields / wells / bit sizes / mud types / date; one row per M04 survey station
 * (that has N/S + E/W) joined with that day's hole size / mud type.
 *
 * Two views over the already-loaded rows (no extra fetch):
 *   • TABLE — the survey grid; a row opens that day's daily report when its
 *     report serial resolved.
 *   • GRAPH — the Delphi drawpat trajectory plots, one curve per well overlaid:
 *       · Vertical section — TVD (down) vs Section HD
 *       · Plan view        — N/S vs E/W (equal aspect, North up)
 *       · Dogleg           — DLS vs TVD (down)
 */
import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client.js";
import { MultiSelect, type Item } from "./DdrRemarksSearch.js";
import { useFacetOptions } from "./useFacetOptions.js";
import { JalaliDatePicker } from "./JalaliDatePicker.js";
import { WellPathTrajectory3D } from "./WellPathTrajectory3D.js";

interface SearchOptions {
  fields: string[]; wells: { code: string; name: string; field: string | null }[];
  holeSizes: string[]; mudTypes: string[]; rigs: string[];
}
// Well-Path facet options restricted to wells/fields that actually have
// directional-survey data (so the sidebar doesn't list vertical / un-surveyed wells).
interface WellPathOptions { fields: string[]; wells: { code: string; name: string; field: string | null }[] }
export interface PathRow {
  wellCode: string; date: string | null; serialNo: number | null;
  md: number | null; inc: number | null; az: number | null; tvd: number | null;
  ns: number | null; ew: number | null; sectionHD: number | null; dls: number | null; vs: number | null;
  direction: string | null; holeSize: string | null; mudType: string | null;
}
interface PathData { rows: PathRow[]; truncated?: boolean; total?: number; note?: string }

const fmtNum = (v: unknown): string =>
  v == null || v === "" ? "" : typeof v === "number" ? (Number.isInteger(v) ? String(v) : v.toFixed(2)) : String(v);

const COLS: { key: keyof PathRow; label: string; text?: boolean }[] = [
  { key: "md", label: "MD (m)" }, { key: "inc", label: "Inc (°)" }, { key: "az", label: "Az (°)" },
  { key: "tvd", label: "TVD (m)" }, { key: "ns", label: "N/S (m)" }, { key: "ew", label: "E/W (m)" },
  { key: "sectionHD", label: "Section HD (m)" }, { key: "dls", label: "DLS" }, { key: "vs", label: "VS (m)" },
  { key: "direction", label: "Dir", text: true }, { key: "holeSize", label: "Hole", text: true }, { key: "mudType", label: "Mud type", text: true },
];

const WELL_PALETTE = ["#1e40af", "#dc2626", "#0d9488", "#d97706", "#7c3aed", "#65a30d", "#db2777", "#0891b2", "#ea580c", "#4f46e5", "#16a34a", "#9f1239"];

// The three drawpat plots: which row fields map to X/Y, axis labels, and whether
// Y is depth (drawn increasing downward) or equal-aspect (the plan/map view).
const PLOTS = {
  plan: { label: "Plan view", x: "ew", y: "ns", xLabel: "E/W (m)  (− = West)", yLabel: "N/S (m)  (− = South)", yDown: false, equal: true },
  section: { label: "Vertical section", x: "sectionHD", y: "tvd", xLabel: "Section HD (m)", yLabel: "TVD (m)", yDown: true, equal: false },
  dls: { label: "DLS (dogleg)", x: "dls", y: "tvd", xLabel: "DLS (°/30m)", yLabel: "TVD (m)", yDown: true, equal: false },
} as const;
type PlotKey = keyof typeof PLOTS;

export function WellPath({ onOpenReport }: { onOpenReport?: (wellCode: string, serialNo: number, date: string | null) => void } = {}) {
  const [selFields, setSelFields] = useState<string[]>([]);
  const [selWells, setSelWells] = useState<string[]>([]);
  const [selHole, setSelHole] = useState<string[]>([]);
  const [selMud, setSelMud] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [data, setData] = useState<PathData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [view, setView] = useState<"table" | "graph">("table");

  const optsQ = useQuery({ queryKey: ["ddr", "search-options"], queryFn: () => api.get<SearchOptions>("/ddr/search-options") });
  const o = optsQ.data;
  // Fields / wells restricted to those with directional-survey data.
  const wpOptsQ = useQuery({ queryKey: ["ddr", "well-path-options"], queryFn: () => api.get<WellPathOptions>("/ddr/well-path-options") });
  const wp = wpOptsQ.data;
  const facet = useFacetOptions(selFields, selWells, o);

  const wellItems = useMemo<Item[]>(() => {
    const fset = new Set(selFields);
    const visible = (wp?.wells ?? []).filter((w) => !fset.size || (w.field != null && fset.has(w.field)));
    const nameCount = new Map<string, number>();
    for (const w of visible) { const n = w.name || w.code; nameCount.set(n, (nameCount.get(n) ?? 0) + 1); }
    return visible.map((w) => {
      const n = w.name || w.code;
      const dup = (nameCount.get(n) ?? 0) > 1;
      return { value: w.code, label: dup ? `${n} (${w.code})` : n, keywords: `${w.code} ${n}` };
    });
  }, [wp?.wells, selFields]);

  const rows = data?.rows ?? [];
  const usedCols = useMemo(() => COLS.filter((c) => rows.some((r) => r[c.key] != null && r[c.key] !== "")), [rows]);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const body = { fields: selFields, wells: selWells, holeSizes: selHole, mudTypes: selMud, dateFrom, dateTo };
      setData(await api.post<PathData>("/ddr/well-path", body));
    } catch (e) { setError(String(e)); } finally { setLoading(false); }
  }
  function clearAll() {
    setSelFields([]); setSelWells([]); setSelHole([]); setSelMud([]); setDateFrom(""); setDateTo(""); setData(null);
  }

  return (
    <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4 overflow-hidden">
      <div className="flex flex-col min-h-0 bg-white border border-gray-200 rounded p-3 overflow-y-auto">
        <MultiSelect title="Fields · with path data" items={(wp?.fields ?? []).map((f) => ({ value: f, label: f }))} selected={selFields} onChange={setSelFields} />
        <MultiSelect title={selFields.length ? `Wells · in ${selFields.length} field(s)` : "Wells · with path data"} items={wellItems} selected={selWells} onChange={setSelWells} />
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
          <button onClick={() => run()} disabled={loading} className="h-9 px-4 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300">{loading ? "Loading…" : "Show"}</button>
          <button onClick={clearAll} className="h-9 px-3 text-sm rounded border border-gray-300 hover:bg-gray-50">Clear</button>
        </div>
        {error && <div className="text-xs text-red-600 pt-2">{error}</div>}

        {view === "graph" && data && rows.length > 0 && (
          <div className="pt-4 mt-3 border-t border-gray-100 text-[11px] text-gray-500 leading-snug">
            Each well shows its <b>plan view</b>, <b>vertical section</b>, <b>3D</b> trajectory, and <b>DLS</b> together. Drag the 3D view to orbit.
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded flex flex-col min-h-0 overflow-hidden">
        <div className="px-3 py-2 border-b border-gray-100 shrink-0 flex items-center justify-between gap-2">
          <span className="text-sm text-gray-600 min-w-0 truncate">
            {data
              ? (data.note ? data.note : <>Well path · <b>{data.rows.length}</b> survey stations{data.truncated ? ` (capped — ${data.total})` : ""}</>)
              : "Pick a field / well, then Show."}
          </span>
          {data && rows.length > 0 && (
            <div className="inline-flex rounded border border-gray-300 overflow-hidden shrink-0">
              {(["table", "graph"] as const).map((v) => (
                <button key={v} onClick={() => setView(v)} className={`px-2.5 h-7 text-xs capitalize ${view === v ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>{v}</button>
              ))}
            </div>
          )}
        </div>
        <div className="overflow-auto flex-1 min-h-0">
          {data && (view === "table" ? (
            <PathTable rows={rows} cols={usedCols} note={data.note} onOpenReport={onOpenReport} />
          ) : (
            <PerWellPaths rows={rows} note={data.note} />
          ))}
        </div>
      </div>
    </div>
  );
}

function PathTable({ rows, cols, note, onOpenReport }: {
  rows: PathRow[];
  cols: typeof COLS;
  note?: string;
  onOpenReport?: (wellCode: string, serialNo: number, date: string | null) => void;
}) {
  if (!rows.length) return <div className="p-8 text-center text-sm text-gray-400">{note ?? "No survey stations (the selected wells may be vertical / have no N-S·E-W coordinates)."}</div>;
  return (
    <table className="text-[11px] tabular-nums border-collapse">
      <thead className="sticky top-0 z-20">
        <tr className="bg-gray-100">
          <th className="sticky left-0 z-30 bg-gray-100 border border-gray-300 px-2 py-1 text-left font-semibold text-gray-700 whitespace-nowrap">Well</th>
          <th className="bg-gray-100 border border-gray-300 px-2 py-1 text-left font-medium text-gray-700 whitespace-nowrap">Date</th>
          {cols.map((c) => (
            <th key={c.key} className={`bg-gray-100 border border-gray-300 px-2 py-1 font-medium text-gray-700 whitespace-nowrap ${c.text ? "text-left" : "text-right"}`}>{c.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, ri) => {
          const clickable = !!onOpenReport && row.serialNo != null;
          const zebra = ri % 2 ? "bg-teal-50/40" : "bg-white";
          return (
            <tr
              key={ri}
              onClick={clickable ? () => onOpenReport!(row.wellCode, row.serialNo!, row.date) : undefined}
              className={`${zebra} ${clickable ? "cursor-pointer hover:bg-blue-50" : ""}`}
              title={clickable ? "Open this day's daily drilling report" : undefined}
            >
              <th className="sticky left-0 z-10 bg-inherit border border-gray-300 px-2 py-0.5 text-left font-semibold text-gray-800 whitespace-nowrap">{row.wellCode}</th>
              <td className="border border-gray-300 px-2 py-0.5 text-left whitespace-nowrap">{row.date ?? ""}</td>
              {cols.map((c) => {
                const v = row[c.key];
                return (
                  <td key={c.key} className={`border border-gray-300 px-2 py-0.5 whitespace-nowrap ${c.text ? "text-left" : "text-right"}`}>
                    {c.text ? (v == null ? "" : String(v)) : fmtNum(v)}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

const niceStep = (rough: number): number => {
  if (!(rough > 0)) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(rough))), m = rough / p;
  return (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p;
};
const ticksFor = (min: number, max: number, count = 5): number[] => {
  const step = niceStep((max - min) / count) || 1;
  const out: number[] = [];
  for (let t = Math.floor(min / step) * step; t <= max + step * 1e-6; t += step) out.push(Number(t.toFixed(6)));
  return out;
};

/**
 * Per-well trajectory groups: one row per well, each showing its plan view,
 * vertical section, 3D trajectory, and DLS together (the four drawpat plots
 * grouped, plus the WebGL 3D). Wells are stacked vertically.
 */
function PerWellPaths({ rows, note }: { rows: PathRow[]; note?: string }) {
  const wells = useMemo(() => {
    const order: string[] = [];
    const byWell = new Map<string, PathRow[]>();
    for (const r of rows) {
      let arr = byWell.get(r.wellCode);
      if (!arr) { arr = []; byWell.set(r.wellCode, arr); order.push(r.wellCode); }
      arr.push(r);
    }
    return order.map((wc) => ({ wellCode: wc, rows: byWell.get(wc)! }));
  }, [rows]);

  if (note) return <div className="p-8 text-center text-sm text-gray-400">{note}</div>;
  if (!wells.length) return <div className="p-8 text-center text-sm text-gray-400">No plottable survey stations (the selected wells may be vertical).</div>;

  return (
    <div className="p-3 space-y-4">
      {wells.map(({ wellCode, rows: wr }, i) => {
        const color = WELL_PALETTE[i % WELL_PALETTE.length];
        const stations3d = wr
          .filter((r) => typeof r.ns === "number" && typeof r.ew === "number" && typeof r.tvd === "number")
          .map((r) => ({ ns: r.ns as number, ew: r.ew as number, tvd: r.tvd as number, md: r.md }));
        return (
          <div key={wellCode} className="border border-gray-200 rounded">
            <div className="px-3 py-1.5 border-b border-gray-100 flex items-center gap-2">
              <span className="inline-block w-3 h-0.5" style={{ background: color }} />
              <span className="text-sm font-semibold text-gray-800">{wellCode}</span>
              <span className="text-[11px] text-gray-400">· {wr.length} stations</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2 p-2">
              <SinglePlot rows={wr} plot="plan" color={color} />
              <SinglePlot rows={wr} plot="section" color={color} />
              <div className="flex flex-col">
                <div className="text-[11px] text-gray-500 mb-1 px-1">3D trajectory</div>
                <div className="flex-1 min-h-[260px] border border-gray-200 rounded overflow-hidden">
                  {stations3d.length >= 2
                    ? <WellPathTrajectory3D stations={stations3d} />
                    : <div className="h-full grid place-items-center text-[10px] text-gray-400">Not enough 3D stations.</div>}
                </div>
              </div>
              <SinglePlot rows={wr} plot="dls" color={color} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** One drawpat 2D plot (plan / vertical section / DLS) for a SINGLE well. */
function SinglePlot({ rows, plot, color }: { rows: PathRow[]; plot: PlotKey; color: string }) {
  const cfg = PLOTS[plot];
  const [hover, setHover] = useState<{ x: number; y: number; html: string } | null>(null);
  const { pts, dom } = useMemo(() => {
    const pts: { x: number; y: number; r: PathRow }[] = [];
    for (const r of rows) {
      const x = r[cfg.x] as number | null, y = r[cfg.y] as number | null;
      if (typeof x === "number" && typeof y === "number") pts.push({ x, y, r });
    }
    let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
    for (const p of pts) {
      if (p.x < xmin) xmin = p.x; if (p.x > xmax) xmax = p.x;
      if (p.y < ymin) ymin = p.y; if (p.y > ymax) ymax = p.y;
    }
    return { pts, dom: { xmin, xmax, ymin, ymax } };
  }, [rows, cfg.x, cfg.y]);

  const W = 300, H = 280, padL = 44, padR = 10, padT = 22, padB = 34;
  const plotW = W - padL - padR, plotH = H - padT - padB;

  let body: React.ReactNode;
  if (!pts.length || !Number.isFinite(dom.xmin)) {
    body = <div className="grid place-items-center text-[10px] text-gray-400" style={{ height: H }}>No {cfg.label.toLowerCase()} data.</div>;
  } else {
    const padDom = (lo: number, hi: number) => { const d = (hi - lo) || Math.abs(hi) || 1; return [lo - d * 0.05, hi + d * 0.05] as const; };
    const [xlo, xhi] = padDom(dom.xmin, dom.xmax);
    const [ylo, yhi] = padDom(dom.ymin, dom.ymax);
    const xRange = xhi - xlo || 1, yRange = yhi - ylo || 1;

    let xOf: (x: number) => number, yOf: (y: number) => number;
    if (cfg.equal) {
      const upp = Math.max(xRange / plotW, yRange / plotH);
      const drawnW = xRange / upp, drawnH = yRange / upp;
      const offX = padL + (plotW - drawnW) / 2, offY = padT + (plotH - drawnH) / 2;
      xOf = (x) => offX + (x - xlo) / upp;
      yOf = (y) => offY + (yhi - y) / upp;           // North up
    } else {
      xOf = (x) => padL + ((x - xlo) / xRange) * plotW;
      yOf = (y) => cfg.yDown
        ? padT + ((y - ylo) / yRange) * plotH         // depth increases downward
        : padT + ((yhi - y) / yRange) * plotH;
    }
    const xticks = ticksFor(xlo, xhi, 4), yticks = ticksFor(ylo, yhi, 4);
    const drawDots = pts.length <= 400;

    // Screen positions of every station — for the nearest-point hover (works for
    // any station count, including the >400 case where the dot markers are off).
    const screen = pts.map((p) => ({ sx: xOf(p.x), sy: yOf(p.y), r: p.r }));
    const onMove = (e: React.MouseEvent<SVGRectElement>) => {
      const mx = e.nativeEvent.offsetX, my = e.nativeEvent.offsetY;
      let best = -1, bd = Infinity;
      for (let j = 0; j < screen.length; j++) { const dx = screen[j].sx - mx, dy = screen[j].sy - my, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = j; } }
      if (best < 0) return setHover(null);
      const r = screen[best].r;
      setHover({ x: screen[best].sx, y: screen[best].sy, html: `MD ${fmtNum(r.md)} m · Inc ${fmtNum(r.inc)}° · Az ${fmtNum(r.az)}°<br/>TVD ${fmtNum(r.tvd)} · N/S ${fmtNum(r.ns)} · E/W ${fmtNum(r.ew)} · DLS ${fmtNum(r.dls)}` });
    };

    body = (
      <svg width={W} height={H} className="block bg-white">
        {xticks.map((t, i) => { const x = xOf(t); if (x < padL - 0.5 || x > W - padR + 0.5) return null; return (
          <g key={`x${i}`}>
            <line x1={x} x2={x} y1={padT} y2={padT + plotH} stroke="#f1f5f9" />
            <text x={x} y={padT + plotH + 12} textAnchor="middle" fontSize={8} fill="#94a3b8">{fmtNum(t)}</text>
          </g>); })}
        {yticks.map((t, i) => { const y = yOf(t); if (y < padT - 0.5 || y > padT + plotH + 0.5) return null; return (
          <g key={`y${i}`}>
            <line x1={padL} x2={padL + plotW} y1={y} y2={y} stroke="#f1f5f9" />
            <text x={padL - 4} y={y + 3} textAnchor="end" fontSize={8} fill="#94a3b8">{fmtNum(t)}</text>
          </g>); })}
        <rect x={padL} y={padT} width={plotW} height={plotH} fill="none" stroke="#cbd5e1" />
        <text x={padL + plotW / 2} y={H - 4} textAnchor="middle" fontSize={8.5} fill="#475569">{cfg.xLabel}</text>
        <text x={11} y={padT + plotH / 2} textAnchor="middle" fontSize={8.5} fill="#475569" transform={`rotate(-90 11 ${padT + plotH / 2})`}>{cfg.yLabel}</text>
        <polyline fill="none" stroke={color} strokeWidth={1.5} points={pts.map((p) => `${xOf(p.x).toFixed(1)},${yOf(p.y).toFixed(1)}`).join(" ")} />
        {drawDots && pts.map((p, j) => (
          <circle key={j} cx={xOf(p.x)} cy={yOf(p.y)} r={1.5} fill={color} />
        ))}
        {hover && <circle cx={hover.x} cy={hover.y} r={3.5} fill="none" stroke="#111827" strokeWidth={1.2} />}
        {/* Transparent capture layer → nearest-station tooltip (covers the >400-station case too). */}
        <rect x={padL} y={padT} width={plotW} height={plotH} fill="transparent"
          onMouseMove={onMove} onMouseLeave={() => setHover(null)} />
      </svg>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="text-[11px] text-gray-500 mb-1 px-1">{cfg.label}{cfg.equal ? " · N up" : cfg.yDown ? " · depth ↓" : ""}</div>
      <div className="border border-gray-200 rounded overflow-hidden relative">
        {body}
        {hover && (
          <div className="absolute z-20 pointer-events-none px-2 py-1 rounded bg-gray-900 text-white text-[10px] leading-tight shadow-lg"
            style={{ left: Math.min(hover.x + 10, 170), top: Math.max(hover.y - 4, 2), maxWidth: 200 }}
            dangerouslySetInnerHTML={{ __html: hover.html }} />
        )}
      </div>
    </div>
  );
}
