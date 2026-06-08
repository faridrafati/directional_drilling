/**
 * Multi-well Time Analysis browser — the port of the Delphi DDR time-analysis
 * report (DDR-Delphi/Unit1.pas:4511, tab 5, + the TABF('A') cross-tab and the
 * drawACT chart). Faceted by fields / wells / bit sizes / mud types / activity
 * types / date; one row per TimeAnalysis entry (hours on an activity that day),
 * resolved through Group → Type → Activity and joined with that day's hole size,
 * mud type, drilled interval and narrative.
 *
 * Three views over the already-loaded rows (no extra fetch):
 *   • ROWS  — the activity grid; a row opens that day's daily report.
 *   • PIVOT — day × activity-type hours, with per-day and per-type SUMs (TABF).
 *   • CHART — total hours by well, split by activity type / activity, as grouped
 *     or stacked bars, or an overall pie (drawACT).
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client.js";
import { MultiSelect, type Item } from "./DdrRemarksSearch.js";
import { JalaliDatePicker } from "./JalaliDatePicker.js";
import { useFacetOptions } from "./useFacetOptions.js";

interface SearchOptions {
  fields: string[]; wells: { code: string; name: string; field: string | null }[];
  holeSizes: string[]; mudTypes: string[]; rigs: string[]; activityTypes: string[];
}
export interface TARow {
  wellCode: string; date: string | null; serialNo: number | null;
  holeSize: string | null; from: number | null; to: number | null; mudType: string | null;
  group: string | null; type: string | null; activity: string | null;
  hours: number | null; description: string | null; dayNarrative: string | null;
}
interface TAData { rows: TARow[]; truncated?: boolean; total?: number; note?: string }

const fmtNum = (v: unknown): string =>
  v == null || v === "" ? "" : typeof v === "number" ? (Number.isInteger(v) ? String(v) : v.toFixed(1)) : String(v);
const h1 = (v: number): string => (Number.isInteger(v) ? String(v) : v.toFixed(1));

const COLS: { key: keyof TARow; label: string; text?: boolean; wide?: boolean }[] = [
  { key: "holeSize", label: "Hole", text: true }, { key: "from", label: "From (m)" }, { key: "to", label: "To (m)" },
  { key: "mudType", label: "Mud type", text: true },
  { key: "group", label: "Group", text: true }, { key: "type", label: "Activity type", text: true }, { key: "activity", label: "Activity", text: true },
  { key: "hours", label: "Hours" },
  { key: "description", label: "Description", text: true, wide: true }, { key: "dayNarrative", label: "Day narrative", text: true, wide: true },
];

const PALETTE = ["#1e40af", "#dc2626", "#0d9488", "#d97706", "#7c3aed", "#65a30d", "#db2777", "#0891b2", "#ea580c", "#4f46e5", "#16a34a", "#9f1239", "#ca8a04", "#0e7490", "#a21caf", "#475569"];

export function TimeAnalysis({ onOpenReport }: { onOpenReport?: (wellCode: string, serialNo: number, date: string | null) => void } = {}) {
  const [selFields, setSelFields] = useState<string[]>([]);
  const [selWells, setSelWells] = useState<string[]>([]);
  const [selHole, setSelHole] = useState<string[]>([]);
  const [selMud, setSelMud] = useState<string[]>([]);
  const [selAct, setSelAct] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [data, setData] = useState<TAData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [view, setView] = useState<"rows" | "pivot" | "chart">("rows");
  const [chartType, setChartType] = useState<"grouped" | "stacked" | "pie">("stacked");
  const [groupBy, setGroupBy] = useState<"type" | "activity">("type");

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

  const rows = data?.rows ?? [];
  const usedCols = useMemo(() => COLS.filter((c) => rows.some((r) => r[c.key] != null && r[c.key] !== "")), [rows]);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const body = { fields: selFields, wells: selWells, holeSizes: selHole, mudTypes: selMud, activityTypes: selAct, dateFrom, dateTo };
      setData(await api.post<TAData>("/ddr/time-analysis", body));
    } catch (e) { setError(String(e)); } finally { setLoading(false); }
  }
  function clearAll() {
    setSelFields([]); setSelWells([]); setSelHole([]); setSelMud([]); setSelAct([]); setDateFrom(""); setDateTo(""); setData(null);
  }

  return (
    <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4 overflow-hidden">
      <div className="flex flex-col min-h-0 bg-white border border-gray-200 rounded p-3 overflow-y-auto">
        <MultiSelect title="Fields" items={(o?.fields ?? []).map((f) => ({ value: f, label: f }))} selected={selFields} onChange={setSelFields} />
        <MultiSelect title={selFields.length ? `Wells · in ${selFields.length} field(s)` : "Wells"} items={wellItems} selected={selWells} onChange={setSelWells} />
        <MultiSelect title="Bit sizes" items={facet.holeSizes.map((h) => ({ value: h, label: h }))} selected={selHole} onChange={setSelHole} />
        <MultiSelect title="Mud types" items={facet.mudTypes.map((m) => ({ value: m, label: m }))} selected={selMud} onChange={setSelMud} />
        <MultiSelect title="Activity types" items={facet.activityTypes.map((a) => ({ value: a, label: a }))} selected={selAct} onChange={setSelAct} />
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

        {view === "chart" && data && rows.length > 0 && (
          <div className="pt-4 mt-3 border-t border-gray-100 space-y-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-600 mb-1">Chart</div>
              <div className="inline-flex rounded border border-gray-300 overflow-hidden">
                {(["stacked", "grouped", "pie"] as const).map((c) => (
                  <button key={c} onClick={() => setChartType(c)} className={`px-2.5 h-7 text-xs capitalize ${chartType === c ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>{c}</button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-600 mb-1">Split by</div>
              <div className="inline-flex rounded border border-gray-300 overflow-hidden">
                {(["type", "activity"] as const).map((g) => (
                  <button key={g} onClick={() => setGroupBy(g)} className={`px-2.5 h-7 text-xs capitalize ${groupBy === g ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>{g === "type" ? "Activity type" : "Activity"}</button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded flex flex-col min-h-0 overflow-hidden">
        <div className="px-3 py-2 border-b border-gray-100 shrink-0 flex items-center justify-between gap-2">
          <span className="text-sm text-gray-600 min-w-0 truncate">
            {data
              ? (data.note ? data.note : <>Time analysis · <b>{data.rows.length}</b> entries{data.truncated ? ` (capped — ${data.total})` : ""}</>)
              : "Pick a field / well, then Show."}
          </span>
          {data && rows.length > 0 && (
            <div className="inline-flex rounded border border-gray-300 overflow-hidden shrink-0">
              {(["rows", "pivot", "chart"] as const).map((v) => (
                <button key={v} onClick={() => setView(v)} className={`px-2.5 h-7 text-xs capitalize ${view === v ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>{v}</button>
              ))}
            </div>
          )}
        </div>
        <div className="overflow-auto flex-1 min-h-0">
          {data && (view === "rows" ? (
            <TARowsTable rows={rows} cols={usedCols} note={data.note} onOpenReport={onOpenReport} />
          ) : view === "pivot" ? (
            <TAPivot rows={rows} note={data.note} />
          ) : (
            <TAChart rows={rows} chartType={chartType} groupBy={groupBy} note={data.note} />
          ))}
        </div>
      </div>
    </div>
  );
}

function TARowsTable({ rows, cols, note, onOpenReport }: {
  rows: TARow[]; cols: typeof COLS; note?: string;
  onOpenReport?: (wellCode: string, serialNo: number, date: string | null) => void;
}) {
  if (!rows.length) return <div className="p-8 text-center text-sm text-gray-400">{note ?? "No time-analysis entries."}</div>;
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
                if (c.wide) {
                  const t = v == null ? "" : String(v);
                  return <td key={c.key} className="border border-gray-300 px-2 py-0.5 text-left max-w-[320px] truncate" title={t}>{t}</td>;
                }
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

/** Day × activity-type hours cross-tab with per-day and per-type SUMs (TABF 'A'). */
function TAPivot({ rows, note }: { rows: TARow[]; note?: string }) {
  const { days, types, cell, dayTotal, typeTotal, grand } = useMemo(() => {
    const types = [...new Set(rows.map((r) => r.type).filter((t): t is string => !!t))].sort();
    const dayKey = (r: TARow) => `${r.wellCode}|${r.date ?? ""}`;
    const dayMap = new Map<string, { wellCode: string; date: string | null; holeSize: string | null; from: number | null; to: number | null; mudType: string | null }>();
    const cell = new Map<string, number>();        // `${dayKey}|${type}` -> hours
    const dayTotal = new Map<string, number>(), typeTotal = new Map<string, number>();
    let grand = 0;
    for (const r of rows) {
      const dk = dayKey(r);
      if (!dayMap.has(dk)) dayMap.set(dk, { wellCode: r.wellCode, date: r.date, holeSize: r.holeSize, from: r.from, to: r.to, mudType: r.mudType });
      const h = typeof r.hours === "number" ? r.hours : 0;
      if (!h || !r.type) continue;
      const ck = `${dk}|${r.type}`;
      cell.set(ck, (cell.get(ck) ?? 0) + h);
      dayTotal.set(dk, (dayTotal.get(dk) ?? 0) + h);
      typeTotal.set(r.type, (typeTotal.get(r.type) ?? 0) + h);
      grand += h;
    }
    const days = [...dayMap.entries()].map(([k, v]) => ({ k, ...v }))
      .sort((a, b) => a.wellCode.localeCompare(b.wellCode) || String(a.date ?? "").localeCompare(String(b.date ?? "")));
    return { days, types, cell, dayTotal, typeTotal, grand };
  }, [rows]);

  if (!days.length) return <div className="p-8 text-center text-sm text-gray-400">{note ?? "No hours to pivot."}</div>;
  const num = (v: number | undefined) => (v ? h1(v) : "");
  return (
    <table className="text-[11px] tabular-nums border-collapse">
      <thead className="sticky top-0 z-20">
        <tr className="bg-gray-100">
          {["Well", "Date", "Hole", "From", "To", "Mud type"].map((hh) => (
            <th key={hh} className="bg-gray-100 border border-gray-300 px-2 py-1 text-left font-semibold text-gray-700 whitespace-nowrap">{hh}</th>
          ))}
          <th className="bg-amber-100 border border-gray-300 px-2 py-1 text-right font-semibold text-gray-800 whitespace-nowrap">SUM</th>
          {types.map((t) => (
            <th key={t} className="bg-gray-100 border border-gray-300 px-2 py-1 text-right font-medium text-gray-700 whitespace-nowrap max-w-[110px] truncate" title={t}>{t}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {days.map((d, ri) => (
          <tr key={d.k} className={ri % 2 ? "bg-teal-50/40" : "bg-white"}>
            <th className="border border-gray-300 px-2 py-0.5 text-left font-semibold text-gray-800 whitespace-nowrap">{d.wellCode}</th>
            <td className="border border-gray-300 px-2 py-0.5 text-left whitespace-nowrap">{d.date ?? ""}</td>
            <td className="border border-gray-300 px-2 py-0.5 text-left whitespace-nowrap">{d.holeSize ?? ""}</td>
            <td className="border border-gray-300 px-2 py-0.5 text-right">{fmtNum(d.from)}</td>
            <td className="border border-gray-300 px-2 py-0.5 text-right">{fmtNum(d.to)}</td>
            <td className="border border-gray-300 px-2 py-0.5 text-left whitespace-nowrap">{d.mudType ?? ""}</td>
            <td className="border border-gray-300 px-2 py-0.5 text-right font-semibold bg-amber-50">{num(dayTotal.get(d.k))}</td>
            {types.map((t) => <td key={t} className="border border-gray-300 px-2 py-0.5 text-right">{num(cell.get(`${d.k}|${t}`))}</td>)}
          </tr>
        ))}
        <tr className="bg-amber-100 font-semibold sticky bottom-0">
          <th className="border border-gray-300 px-2 py-0.5 text-left text-gray-800 whitespace-nowrap">SUM</th>
          <td className="border border-gray-300 px-2 py-0.5" colSpan={4} />
          <td className="border border-gray-300 px-2 py-0.5 text-right text-gray-500">{days.length} days</td>
          <td className="border border-gray-300 px-2 py-0.5 text-right text-gray-900">{h1(grand)}</td>
          {types.map((t) => <td key={t} className="border border-gray-300 px-2 py-0.5 text-right text-gray-900">{num(typeTotal.get(t))}</td>)}
        </tr>
      </tbody>
    </table>
  );
}

/** Total hours by well, split by activity type / activity — grouped/stacked bars
 *  or an overall pie (the Delphi drawACT "TOTAL TIME" chart). */
function TAChart({ rows, chartType, groupBy, note }: {
  rows: TARow[]; chartType: "grouped" | "stacked" | "pie"; groupBy: "type" | "activity"; note?: string;
}) {
  const { wells, series, matrix, wellTotal, pie, grand, capped } = useMemo(() => {
    const serKey = (r: TARow) => (groupBy === "type" ? (r.type ?? "—") : (r.activity ?? "—"));
    const cell = new Map<string, number>();         // `${well}|${series}`
    const wellTotalAll = new Map<string, number>(), serTotal = new Map<string, number>();
    for (const r of rows) {
      const h = typeof r.hours === "number" ? r.hours : 0; if (!h) continue;
      const w = r.wellCode, sName = serKey(r);
      cell.set(`${w}|${sName}`, (cell.get(`${w}|${sName}`) ?? 0) + h);
      wellTotalAll.set(w, (wellTotalAll.get(w) ?? 0) + h);
      serTotal.set(sName, (serTotal.get(sName) ?? 0) + h);
    }
    const SER_MAX = groupBy === "type" ? 15 : 12, WELL_MAX = 24;
    const wells = [...wellTotalAll.entries()].sort((a, b) => b[1] - a[1]).slice(0, WELL_MAX).map((x) => x[0]);
    const series = [...serTotal.entries()].sort((a, b) => b[1] - a[1]).slice(0, SER_MAX).map((x) => x[0]);
    const capped = wellTotalAll.size > wells.length || serTotal.size > series.length;
    const matrix = wells.map((w) => series.map((sName) => cell.get(`${w}|${sName}`) ?? 0));
    const wellTotal = wells.map((_, i) => matrix[i].reduce((a, b) => a + b, 0));
    const pie = series.map((sName) => ({ name: sName, value: serTotal.get(sName) ?? 0 }));
    const grand = pie.reduce((a, s) => a + s.value, 0);
    return { wells, series, matrix, wellTotal, pie, grand, capped };
  }, [rows, groupBy]);

  if (note) return <div className="p-8 text-center text-sm text-gray-400">{note}</div>;
  if (!wells.length || grand <= 0) return <div className="p-8 text-center text-sm text-gray-400">No hours recorded to chart.</div>;

  const colorOf = (i: number) => PALETTE[i % PALETTE.length];
  const legend = (
    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[11px] text-gray-600">
      {series.map((sName, si) => (
        <span key={sName} className="inline-flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: colorOf(si) }} />{sName}</span>
      ))}
    </div>
  );
  const capNote = capped ? <span className="text-amber-600"> Showing the top {wells.length} wells × {series.length} {groupBy === "type" ? "types" : "activities"}.</span> : null;

  if (chartType === "pie") {
    const slices = pie.filter((s) => s.value > 0);
    const cx = 150, cy = 150, r = 130;
    let a0 = -Math.PI / 2;
    const arc = (a1: number) => {
      const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0), x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
      const large = a1 - a0 > Math.PI ? 1 : 0;
      return `M ${cx} ${cy} L ${x0.toFixed(1)} ${y0.toFixed(1)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(1)} ${y1.toFixed(1)} Z`;
    };
    return (
      <div className="p-3">
        <div className="text-[11px] text-gray-500 mb-2">Overall time distribution by {groupBy === "type" ? "activity type" : "activity"} — {h1(grand)} h total across {wells.length} well{wells.length > 1 ? "s" : ""}.{capNote}</div>
        <svg width={300} height={300} className="block">
          {slices.map((s) => { const a1 = a0 + (s.value / grand) * 2 * Math.PI; const d = arc(a1); a0 = a1; return <path key={s.name} d={d} fill={colorOf(series.indexOf(s.name))} stroke="#fff" strokeWidth={1}><title>{`${s.name}: ${h1(s.value)} h (${(100 * s.value / grand).toFixed(1)}%)`}</title></path>; })}
        </svg>
        {legend}
      </div>
    );
  }

  // bars (grouped or stacked), x = wells, series = activity type/activity.
  const stacked = chartType === "stacked";
  const max = stacked ? Math.max(...wellTotal, 1) : Math.max(1, ...matrix.flat());
  const barGroupW = stacked ? 26 : Math.max(10, series.length * 9);
  const padCat = 16, axisW = 52, top = 12, plotH = 320, labelH = 96;
  const bandW = barGroupW + padCat;
  const chartW = axisW + wells.length * bandW + 16;
  const baseY = top + plotH;
  const yOf = (v: number) => baseY - (v / max) * plotH;
  const ticks = 4;
  return (
    <div className="p-3">
      <div className="text-[11px] text-gray-500 mb-2">Total hours by well, {stacked ? "stacked" : "grouped"} by {groupBy === "type" ? "activity type" : "activity"}.{capNote}</div>
      <div className="overflow-x-auto">
        <svg width={chartW} height={baseY + labelH} className="block">
          {Array.from({ length: ticks + 1 }, (_, i) => { const v = (max / ticks) * i, y = yOf(v); return (
            <g key={i}><line x1={axisW} x2={chartW - 16} y1={y} y2={y} stroke="#eef2f7" /><text x={axisW - 4} y={y + 3} textAnchor="end" fontSize={9} fill="#94a3b8">{v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0)}</text></g>); })}
          {wells.map((w, wi) => {
            const x0 = axisW + wi * bandW + padCat / 2;
            const mid = x0 + barGroupW / 2;
            let acc = 0;
            return (
              <g key={w}>
                {series.map((sName, si) => {
                  const v = matrix[wi][si]; if (v <= 0) return null;
                  if (stacked) { const y = yOf(acc + v), hgt = yOf(acc) - yOf(acc + v); acc += v; return <rect key={sName} x={x0} y={y} width={barGroupW} height={hgt} fill={colorOf(si)}><title>{`${w} · ${sName}: ${h1(v)} h`}</title></rect>; }
                  const bw = barGroupW / series.length, x = x0 + si * bw, y = yOf(v);
                  return <rect key={sName} x={x} y={y} width={Math.max(1, bw - 0.5)} height={baseY - y} fill={colorOf(si)}><title>{`${w} · ${sName}: ${h1(v)} h`}</title></rect>;
                })}
                <text x={mid} y={baseY + 12} textAnchor="end" fontSize={9} fill="#475569" transform={`rotate(-40 ${mid} ${baseY + 12})`}>{w.length > 16 ? w.slice(0, 15) + "…" : w}</text>
              </g>
            );
          })}
          <line x1={axisW} x2={chartW - 16} y1={baseY} y2={baseY} stroke="#cbd5e1" />
        </svg>
      </div>
      {legend}
    </div>
  );
}
