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
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client.js";
import { MultiSelect, type Item } from "./DdrRemarksSearch.js";
import { JalaliDatePicker } from "./JalaliDatePicker.js";

interface SearchOptions {
  fields: string[]; wells: { code: string; name: string; field: string | null }[];
  holeSizes: string[]; mudTypes: string[]; rigs: string[];
}
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
  section: { label: "Vertical section", x: "sectionHD", y: "tvd", xLabel: "Section HD (m)", yLabel: "TVD (m)", yDown: true, equal: false },
  plan: { label: "Plan (N / E)", x: "ew", y: "ns", xLabel: "E/W (m)  (− = West)", yLabel: "N/S (m)  (− = South)", yDown: false, equal: true },
  dls: { label: "Dogleg", x: "dls", y: "tvd", xLabel: "DLS (°/30m)", yLabel: "TVD (m)", yDown: true, equal: false },
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
  const [plot, setPlot] = useState<PlotKey>("section");

  const optsQ = useQuery({ queryKey: ["ddr", "search-options"], queryFn: () => api.get<SearchOptions>("/ddr/search-options") });
  const o = optsQ.data;

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
        <MultiSelect title="Fields" items={(o?.fields ?? []).map((f) => ({ value: f, label: f }))} selected={selFields} onChange={setSelFields} />
        <MultiSelect title={selFields.length ? `Wells · in ${selFields.length} field(s)` : "Wells"} items={wellItems} selected={selWells} onChange={setSelWells} />
        <MultiSelect title="Bit sizes" items={(o?.holeSizes ?? []).map((h) => ({ value: h, label: h }))} selected={selHole} onChange={setSelHole} />
        <MultiSelect title="Mud types" items={(o?.mudTypes ?? []).map((m) => ({ value: m, label: m }))} selected={selMud} onChange={setSelMud} />
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
          <div className="pt-4 mt-3 border-t border-gray-100">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-600 mb-1">Plot</div>
            <div className="inline-flex flex-col gap-1">
              {(Object.keys(PLOTS) as PlotKey[]).map((p) => (
                <button key={p} onClick={() => setPlot(p)} className={`px-2.5 h-7 text-xs text-left rounded border ${plot === p ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"}`}>{PLOTS[p].label}</button>
              ))}
            </div>
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
            <PathChart rows={rows} plot={plot} note={data.note} />
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

/** The Delphi drawpat trajectory plots, one polyline per well overlaid. */
function PathChart({ rows, plot, note }: { rows: PathRow[]; plot: PlotKey; note?: string }) {
  const cfg = PLOTS[plot];
  const { series, dom } = useMemo(() => {
    const wells = [...new Set(rows.map((r) => r.wellCode))];
    const series = wells.map((well, i) => {
      const pts: { x: number; y: number; r: PathRow }[] = [];
      for (const r of rows) {
        if (r.wellCode !== well) continue;
        const x = r[cfg.x] as number | null, y = r[cfg.y] as number | null;
        if (typeof x === "number" && typeof y === "number") pts.push({ x, y, r });
      }
      return { well, color: WELL_PALETTE[i % WELL_PALETTE.length], pts };
    }).filter((s) => s.pts.length > 0);
    let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
    for (const s of series) for (const p of s.pts) {
      if (p.x < xmin) xmin = p.x; if (p.x > xmax) xmax = p.x;
      if (p.y < ymin) ymin = p.y; if (p.y > ymax) ymax = p.y;
    }
    return { series, dom: { xmin, xmax, ymin, ymax } };
  }, [rows, cfg.x, cfg.y]);

  if (note) return <div className="p-8 text-center text-sm text-gray-400">{note}</div>;
  if (!series.length || !Number.isFinite(dom.xmin)) return <div className="p-8 text-center text-sm text-gray-400">No plottable survey stations for this plot.</div>;

  const W = 760, H = 460, padL = 60, padR = 16, padT = 16, padB = 46;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  // pad domains by 5% so curves don't touch the frame.
  const padDom = (lo: number, hi: number) => { const d = (hi - lo) || Math.abs(hi) || 1; return [lo - d * 0.05, hi + d * 0.05] as const; };
  const [xlo, xhi] = padDom(dom.xmin, dom.xmax);
  const [ylo, yhi] = padDom(dom.ymin, dom.ymax);
  const xRange = xhi - xlo || 1, yRange = yhi - ylo || 1;

  let xOf: (x: number) => number, yOf: (y: number) => number;
  if (cfg.equal) {
    // Equal aspect (plan/map view): same metres-per-pixel on both axes, centred.
    const upp = Math.max(xRange / plotW, yRange / plotH);
    const drawnW = xRange / upp, drawnH = yRange / upp;
    const offX = padL + (plotW - drawnW) / 2, offY = padT + (plotH - drawnH) / 2;
    xOf = (x) => offX + (x - xlo) / upp;
    yOf = (y) => offY + (yhi - y) / upp;           // North up
  } else {
    xOf = (x) => padL + ((x - xlo) / xRange) * plotW;
    yOf = (y) => cfg.yDown
      ? padT + ((y - ylo) / yRange) * plotH        // depth: shallow (min) at top
      : padT + ((yhi - y) / yRange) * plotH;
  }

  const xticks = ticksFor(xlo, xhi), yticks = ticksFor(ylo, yhi);
  const drawDots = series.reduce((a, s) => a + s.pts.length, 0) <= 800;

  return (
    <div className="p-3">
      <div className="text-[11px] text-gray-500 mb-2">{cfg.label} — {series.length} well{series.length > 1 ? "s" : ""} overlaid{cfg.equal ? ", equal aspect (map view, North up)" : cfg.yDown ? ", depth increases downward" : ""}.</div>
      <div className="overflow-auto">
        <svg width={W} height={H} className="block bg-white border border-gray-200">
          {/* grid + axis ticks */}
          {xticks.map((t, i) => { const x = xOf(t); if (x < padL - 0.5 || x > W - padR + 0.5) return null; return (
            <g key={`x${i}`}>
              <line x1={x} x2={x} y1={padT} y2={padT + plotH} stroke="#eef2f7" />
              <text x={x} y={padT + plotH + 14} textAnchor="middle" fontSize={9} fill="#64748b">{fmtNum(t)}</text>
            </g>); })}
          {yticks.map((t, i) => { const y = yOf(t); if (y < padT - 0.5 || y > padT + plotH + 0.5) return null; return (
            <g key={`y${i}`}>
              <line x1={padL} x2={padL + plotW} y1={y} y2={y} stroke="#eef2f7" />
              <text x={padL - 5} y={y + 3} textAnchor="end" fontSize={9} fill="#64748b">{fmtNum(t)}</text>
            </g>); })}
          {/* frame */}
          <rect x={padL} y={padT} width={plotW} height={plotH} fill="none" stroke="#cbd5e1" />
          {/* axis labels */}
          <text x={padL + plotW / 2} y={H - 6} textAnchor="middle" fontSize={10} fill="#475569">{cfg.xLabel}</text>
          <text x={14} y={padT + plotH / 2} textAnchor="middle" fontSize={10} fill="#475569" transform={`rotate(-90 14 ${padT + plotH / 2})`}>{cfg.yLabel}</text>
          {/* curves */}
          {series.map((s) => (
            <g key={s.well}>
              <polyline fill="none" stroke={s.color} strokeWidth={1.5} points={s.pts.map((p) => `${xOf(p.x).toFixed(1)},${yOf(p.y).toFixed(1)}`).join(" ")}>
                <title>{s.well}</title>
              </polyline>
              {drawDots && s.pts.map((p, j) => (
                <circle key={j} cx={xOf(p.x)} cy={yOf(p.y)} r={1.6} fill={s.color}>
                  <title>{`${s.well}  MD ${fmtNum(p.r.md)}  Inc ${fmtNum(p.r.inc)}°  Az ${fmtNum(p.r.az)}°  TVD ${fmtNum(p.r.tvd)}\nN/S ${fmtNum(p.r.ns)}  E/W ${fmtNum(p.r.ew)}  Sec ${fmtNum(p.r.sectionHD)}  DLS ${fmtNum(p.r.dls)}`}</title>
                </circle>
              ))}
            </g>
          ))}
        </svg>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[11px] text-gray-600">
        {series.map((s) => (
          <span key={s.well} className="inline-flex items-center gap-1"><span className="inline-block w-3 h-0.5 align-middle" style={{ background: s.color }} />{s.well}</span>
        ))}
      </div>
    </div>
  );
}
