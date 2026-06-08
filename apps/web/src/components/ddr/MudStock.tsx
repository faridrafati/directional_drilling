/**
 * Multi-well Mud Stock (chemical materials) browser — the port of the Delphi DDR
 * "mud stock" report (DDR-Delphi/Unit1.pas:4454, tab 3). Faceted by fields /
 * wells / bit sizes / mud types / materials / date; one row per ChemicalMaterials
 * entry joined with the material + unit and that day's hole size / mud type.
 *
 * Two views over the already-loaded rows (no extra fetch):
 *   • TABLE — the faceted grid; a row opens that day's full daily report (the
 *     same overlay the other tabs use) when its report serial resolved.
 *   • GRAPH — total Used summed by material or by well (the Delphi DRAWMAT bar
 *     chart), grouped bars with a group-by toggle.
 *   • PLANNING — next-well forecasting from the offset wells: per-metre
 *     consumption by hole section, an offset benchmark (mean + min–max range), a
 *     section-length forecast calculator, and the cost breakdown (see
 *     MudPlanning). Driven by a separate /ddr/mud-planning fetch.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client.js";
import { MultiSelect, type Item } from "./DdrRemarksSearch.js";
import { JalaliDatePicker } from "./JalaliDatePicker.js";
import { MudPlanning, type PlanningFilters } from "./MudPlanning.js";
import { useFacetOptions } from "./useFacetOptions.js";

interface SearchOptions {
  fields: string[]; wells: { code: string; name: string; field: string | null }[];
  holeSizes: string[]; mudTypes: string[]; rigs: string[]; materials: string[];
}
export interface StockRow {
  wellCode: string; date: string | null; serialNo: number | null;
  from: number | null; to: number | null;
  holeSize: string | null; mudType: string | null;
  material: string | null; measure: string | null;
  used: number | null; rec: number | null; stock: number | null;
  os: number | null; req: number | null; sent: number | null;
}
interface StockData { rows: StockRow[]; truncated?: boolean; total?: number; note?: string }

const fmtNum = (v: unknown): string =>
  v == null || v === "" ? "" : typeof v === "number" ? (Number.isInteger(v) ? String(v) : v.toFixed(1)) : String(v);

// Columns mirror the Delphi grid (Unit1.pas:4474): the depth + day context, then
// the material, unit and the six stock figures (Amount→Used, Rec, Stock, OS, Req,
// Sent). `text` columns are left-aligned; the numeric stock figures right-aligned.
const COLS: { key: keyof StockRow; label: string; title?: string; text?: boolean }[] = [
  { key: "from", label: "From (m)" }, { key: "to", label: "To (m)" },
  { key: "holeSize", label: "Hole", text: true }, { key: "mudType", label: "Mud type", text: true },
  { key: "material", label: "Material", text: true }, { key: "measure", label: "Unit", text: true },
  { key: "used", label: "Used", title: "Amount used / consumed that day (Delphi: Amount)" },
  { key: "rec", label: "Rec", title: "Received that day" },
  { key: "stock", label: "Stock", title: "Quantity remaining in stock" },
  { key: "os", label: "OS", title: "OS — as recorded in the source" },
  { key: "req", label: "Req", title: "Required / requested" },
  { key: "sent", label: "Sent", title: "Sent / dispatched" },
];

const PALETTE = ["#1e40af", "#dc2626", "#0d9488", "#d97706", "#7c3aed", "#65a30d", "#db2777", "#0891b2", "#ea580c", "#4f46e5", "#16a34a", "#9f1239"];

export function MudStock({ onOpenReport }: { onOpenReport?: (wellCode: string, serialNo: number, date: string | null) => void } = {}) {
  const [selFields, setSelFields] = useState<string[]>([]);
  const [selWells, setSelWells] = useState<string[]>([]);
  const [selHole, setSelHole] = useState<string[]>([]);
  const [selMud, setSelMud] = useState<string[]>([]);
  const [selMat, setSelMat] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [data, setData] = useState<StockData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The facet set that produced `data` — snapshotted on Show so the Planning
  // view (which fetches /ddr/mud-planning itself) stays in sync with the grid
  // and doesn't refetch on every sidebar keystroke.
  const [planningFilters, setPlanningFilters] = useState<PlanningFilters | null>(null);

  // Local view state — table/graph use the loaded rows; planning fetches its own.
  const [view, setView] = useState<"table" | "graph" | "planning">("table");
  const [groupBy, setGroupBy] = useState<"material" | "well">("material");

  const optsQ = useQuery({ queryKey: ["ddr", "search-options"], queryFn: () => api.get<SearchOptions>("/ddr/search-options") });
  const o = optsQ.data;
  const facet = useFacetOptions(selFields, selWells, o);

  // One entry PER WELL CODE (codes are unique; names are not), same-named wells
  // get the code appended — identical to the Mud Properties / Formation pickers.
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
  // Hide columns that are entirely empty for the current rows.
  const usedCols = useMemo(() => COLS.filter((c) => rows.some((r) => r[c.key] != null && r[c.key] !== "")), [rows]);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const body = { fields: selFields, wells: selWells, holeSizes: selHole, mudTypes: selMud, materials: selMat, dateFrom, dateTo };
      setData(await api.post<StockData>("/ddr/mud-stock", body));
      setPlanningFilters(body);
    } catch (e) { setError(String(e)); } finally { setLoading(false); }
  }
  function clearAll() {
    setSelFields([]); setSelWells([]); setSelHole([]); setSelMud([]); setSelMat([]);
    setDateFrom(""); setDateTo(""); setData(null); setPlanningFilters(null);
  }

  return (
    <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4 overflow-hidden">
      <div className="flex flex-col min-h-0 bg-white border border-gray-200 rounded p-3 overflow-y-auto">
        <MultiSelect title="Fields" items={(o?.fields ?? []).map((f) => ({ value: f, label: f }))} selected={selFields} onChange={setSelFields} />
        <MultiSelect title={selFields.length ? `Wells · in ${selFields.length} field(s)` : "Wells"} items={wellItems} selected={selWells} onChange={setSelWells} />
        <MultiSelect title="Bit sizes" items={facet.holeSizes.map((h) => ({ value: h, label: h }))} selected={selHole} onChange={setSelHole} />
        <MultiSelect title="Mud types" items={facet.mudTypes.map((m) => ({ value: m, label: m }))} selected={selMud} onChange={setSelMud} />
        <MultiSelect title="Materials" items={facet.materials.map((m) => ({ value: m, label: m }))} selected={selMat} onChange={setSelMat} />
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
          <div className="pt-4 mt-3 border-t border-gray-100 space-y-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-600 mb-1">Group by</div>
              <div className="inline-flex rounded border border-gray-300 overflow-hidden">
                {(["material", "well"] as const).map((g) => (
                  <button key={g} onClick={() => setGroupBy(g)} className={`px-2.5 h-7 text-xs capitalize ${groupBy === g ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>{g}</button>
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
              ? (data.note ? data.note : <>Mud stock · <b>{data.rows.length}</b> entries{data.truncated ? ` (capped — ${data.total})` : ""}</>)
              : "Pick a field / well, then Show."}
          </span>
          {data && rows.length > 0 && (
            <div className="inline-flex rounded border border-gray-300 overflow-hidden shrink-0">
              {(["table", "graph", "planning"] as const).map((v) => (
                <button key={v} onClick={() => setView(v)} className={`px-2.5 h-7 text-xs capitalize ${view === v ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>{v}</button>
              ))}
            </div>
          )}
        </div>
        <div className="overflow-auto flex-1 min-h-0">
          {data && (view === "table" ? (
            <StockTable rows={rows} cols={usedCols} note={data.note} onOpenReport={onOpenReport} />
          ) : view === "graph" ? (
            <StockGraph rows={rows} groupBy={groupBy} note={data.note} />
          ) : (
            <MudPlanning filters={planningFilters} />
          ))}
        </div>
      </div>
    </div>
  );
}

function StockTable({ rows, cols, note, onOpenReport }: {
  rows: StockRow[];
  cols: typeof COLS;
  note?: string;
  onOpenReport?: (wellCode: string, serialNo: number, date: string | null) => void;
}) {
  if (!rows.length) return <div className="p-8 text-center text-sm text-gray-400">{note ?? "No mud-stock entries."}</div>;
  return (
    <table className="text-[11px] tabular-nums border-collapse">
      <thead className="sticky top-0 z-20">
        <tr className="bg-gray-100">
          <th className="sticky left-0 z-30 bg-gray-100 border border-gray-300 px-2 py-1 text-left font-semibold text-gray-700 whitespace-nowrap">Well</th>
          <th className="bg-gray-100 border border-gray-300 px-2 py-1 text-left font-medium text-gray-700 whitespace-nowrap">Date</th>
          {cols.map((c) => (
            <th key={c.key} title={c.title} className={`bg-gray-100 border border-gray-300 px-2 py-1 font-medium text-gray-700 whitespace-nowrap ${c.text ? "text-left" : "text-right"}`}>{c.label}</th>
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

/** Total Used summed by material (bars = wells) or by well (bars = materials) —
 *  the Delphi DRAWMAT bar chart. Only Used is charted (it's additive); Received
 *  is a logistics figure and Stock is a daily snapshot, not a sum. For next-well
 *  forecasting use the Planning view, which normalises Used per metre by section. */
function StockGraph({ rows, groupBy, note }: {
  rows: StockRow[]; groupBy: "material" | "well"; note?: string;
}) {
  const metric = "used" as const;
  const { cats, series, matrix, max, capped } = useMemo(() => {
    const catKey = (r: StockRow) => (groupBy === "material" ? (r.material ?? "—") : r.wellCode);
    const serKey = (r: StockRow) => (groupBy === "material" ? r.wellCode : (r.material ?? "—"));
    const sums = new Map<string, Map<string, number>>();
    const catTotal = new Map<string, number>(), serTotal = new Map<string, number>();
    for (const r of rows) {
      const v = r[metric];
      if (typeof v !== "number" || v === 0) continue;
      const c = catKey(r), sName = serKey(r);
      let m = sums.get(c); if (!m) { m = new Map(); sums.set(c, m); }
      m.set(sName, (m.get(sName) ?? 0) + v);
      catTotal.set(c, (catTotal.get(c) ?? 0) + v);
      serTotal.set(sName, (serTotal.get(sName) ?? 0) + v);
    }
    const CATS_MAX = 18, SER_MAX = 10;
    const cats = [...catTotal.entries()].sort((a, b) => b[1] - a[1]).slice(0, CATS_MAX).map((x) => x[0]);
    const series = [...serTotal.entries()].sort((a, b) => b[1] - a[1]).slice(0, SER_MAX).map((x) => x[0]);
    const capped = catTotal.size > cats.length || serTotal.size > series.length;
    let max = 0;
    const matrix = cats.map((c) => series.map((sName) => { const v = sums.get(c)?.get(sName) ?? 0; if (v > max) max = v; return v; }));
    return { cats, series, matrix, max, capped };
  }, [rows, metric, groupBy]);

  if (note) return <div className="p-8 text-center text-sm text-gray-400">{note}</div>;
  if (!cats.length) return <div className="p-8 text-center text-sm text-gray-400">No {metric === "used" ? "usage" : "receipts"} recorded to chart for these rows.</div>;

  const colorOf = (i: number) => PALETTE[i % PALETTE.length];
  const barW = 14, padCat = 18, axisW = 50, top = 12, plotH = 300, labelH = 110;
  const bandW = series.length * barW + padCat;
  const chartW = axisW + cats.length * bandW + 16;
  const baseY = top + plotH;
  const yOf = (v: number) => baseY - (max > 0 ? (v / max) * plotH : 0);
  const ticks = 4;

  return (
    <div className="p-3">
      <div className="text-[11px] text-gray-500 mb-2">
        Total <b>{metric === "used" ? "used" : "received"}</b> by {groupBy}{groupBy === "material" ? " — bars are wells" : " — bars are materials"}.
        {capped && <span className="text-amber-600"> Showing the top {cats.length} {groupBy === "material" ? "materials" : "wells"} × {series.length} series.</span>}
      </div>
      <div className="overflow-x-auto">
        <svg width={chartW} height={baseY + labelH} className="block">
          {Array.from({ length: ticks + 1 }, (_, i) => {
            const v = (max / ticks) * i, y = yOf(v);
            return (
              <g key={i}>
                <line x1={axisW} x2={chartW - 16} y1={y} y2={y} stroke="#eef2f7" />
                <text x={axisW - 4} y={y + 3} textAnchor="end" fontSize={9} fill="#94a3b8">{v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0)}</text>
              </g>
            );
          })}
          {cats.map((c, ci) => {
            const x0 = axisW + ci * bandW + padCat / 2;
            const mid = x0 + (series.length * barW) / 2;
            return (
              <g key={c}>
                {series.map((sName, si) => {
                  const v = matrix[ci][si]; if (v <= 0) return null;
                  const x = x0 + si * barW, y = yOf(v);
                  return <rect key={sName} x={x} y={y} width={barW - 1} height={baseY - y} fill={colorOf(si)}><title>{`${c} · ${sName}: ${v.toFixed(1)}`}</title></rect>;
                })}
                <text x={mid} y={baseY + 12} textAnchor="end" fontSize={9} fill="#475569" transform={`rotate(-40 ${mid} ${baseY + 12})`}>{c.length > 18 ? c.slice(0, 17) + "…" : c}</text>
              </g>
            );
          })}
          <line x1={axisW} x2={chartW - 16} y1={baseY} y2={baseY} stroke="#cbd5e1" />
        </svg>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[11px] text-gray-600">
        {series.map((sName, si) => (
          <span key={sName} className="inline-flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: colorOf(si) }} />{sName}</span>
        ))}
      </div>
    </div>
  );
}
