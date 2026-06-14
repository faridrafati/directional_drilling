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
  holeSize: string | null; from: number | null; to: number | null; depth: number | null; mudType: string | null;
  group: string | null; type: string | null; activity: string | null;
  hours: number | null; description: string | null; dayNarrative: string | null;
}
interface TAData { rows: TARow[]; truncated?: boolean; total?: number; note?: string; wellNames?: Record<string, string> }

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

// Chart kinds + the selectable bar dimensions (X axis / split-by series).
type ChartKind = "bars" | "depthDays" | "npt" | "days1000";
type Dim = "well" | "type" | "activity";
const CHART_KINDS: { key: ChartKind; label: string }[] = [
  { key: "bars", label: "Bars" },
  { key: "depthDays", label: "Depth vs days" },
  { key: "npt", label: "NPT split" },
  { key: "days1000", label: "Days / 1000 m" },
];
const DIM_LABEL: Record<Dim, string> = { well: "Wells", type: "Activity type", activity: "Activity" };
const dimKey = (r: TARow, d: Dim, wellNames?: Record<string, string>): string =>
  d === "well" ? (wellNames?.[r.wellCode] || r.wellCode) : d === "type" ? (r.type ?? "—") : (r.activity ?? "—");

/** Jalali "YYYY/MM/DD" → serial day number (Birashk), for elapsed-day spacing. */
const idiv = (a: number, b: number) => Math.floor(a / b);
function jDay(date: string | null | undefined): number | null {
  const m = (date ?? "").trim().match(/^(\d{3,4})\/(\d{1,2})\/(\d{1,2})$/);
  if (!m) return null;
  const jy = +m[1] + 1595, jm = +m[2], jd = +m[3];
  if (jm < 1 || jm > 12 || jd < 1 || jd > 31) return null;
  return -355668 + 365 * jy + idiv(jy, 33) * 8 + idiv((jy % 33) + 3, 4) + jd + (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);
}

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
  const [pivotBy, setPivotBy] = useState<"type" | "activity">("type");   // pivot column dimension
  // Chart kind: generic bars (with selectable X / Split / 100%-stack), plus the
  // next-well engineering views (depth-vs-days learning curve, NPT split,
  // days-per-1000m benchmark).
  const [chartKind, setChartKind] = useState<ChartKind>("bars");
  const [chartType, setChartType] = useState<"grouped" | "stacked" | "pie">("stacked");
  const [normalize, setNormalize] = useState(false);                 // 100%-stacked
  const [barX, setBarX] = useState<Dim>("well");                     // X axis category
  const [barSplit, setBarSplit] = useState<Dim>("type");             // series (split-by)

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
              <div className="grid grid-cols-2 gap-1">
                {CHART_KINDS.map((k) => (
                  <button key={k.key} onClick={() => setChartKind(k.key)} className={`px-2 h-7 text-xs rounded border ${chartKind === k.key ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"}`}>{k.label}</button>
                ))}
              </div>
            </div>

            {chartKind === "bars" && (
              <>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-600 mb-1">Type</div>
                  <div className="inline-flex rounded border border-gray-300 overflow-hidden">
                    {(["stacked", "grouped", "pie"] as const).map((c) => (
                      <button key={c} onClick={() => setChartType(c)} className={`px-2.5 h-7 text-xs capitalize ${chartType === c ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>{c}</button>
                    ))}
                  </div>
                </div>
                {chartType !== "pie" && (
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-600 mb-1">X axis</div>
                    <div className="inline-flex rounded border border-gray-300 overflow-hidden">
                      {(["well", "activity", "type"] as Dim[]).map((d) => (
                        <button key={d} onClick={() => setBarX(d)} className={`px-2 h-7 text-xs ${barX === d ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>{DIM_LABEL[d]}</button>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-600 mb-1">Split by</div>
                  <div className="inline-flex rounded border border-gray-300 overflow-hidden">
                    {(["type", "activity", "well"] as Dim[]).map((d) => (
                      <button key={d} onClick={() => setBarSplit(d)} className={`px-2 h-7 text-xs ${barSplit === d ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>{DIM_LABEL[d]}</button>
                    ))}
                  </div>
                </div>
                {chartType === "stacked" && (
                  <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                    <input type="checkbox" checked={normalize} onChange={(e) => setNormalize(e.target.checked)} /> 100 % stacked
                  </label>
                )}
              </>
            )}
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
            <div className="flex items-center gap-2 shrink-0">
              {/* Pivot column dimension: activity TYPE vs individual ACTIVITY. */}
              {view === "pivot" && (
                <div className="inline-flex rounded border border-gray-300 overflow-hidden">
                  {([["type", "Activity type"], ["activity", "Activity"]] as const).map(([k, lbl]) => (
                    <button key={k} onClick={() => setPivotBy(k)} className={`px-2.5 h-7 text-xs ${pivotBy === k ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>{lbl}</button>
                  ))}
                </div>
              )}
              <div className="inline-flex rounded border border-gray-300 overflow-hidden">
                {(["rows", "pivot", "chart"] as const).map((v) => (
                  <button key={v} onClick={() => setView(v)} className={`px-2.5 h-7 text-xs capitalize ${view === v ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>{v}</button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="overflow-auto flex-1 min-h-0">
          {data && (view === "rows" ? (
            <TARowsTable rows={rows} cols={usedCols} note={data.note} onOpenReport={onOpenReport} />
          ) : view === "pivot" ? (
            <TAPivot rows={rows} note={data.note} pivotBy={pivotBy} />
          ) : (
            <TAChart rows={rows} kind={chartKind} chartType={chartType} normalize={normalize}
              barX={barX} barSplit={barSplit} wellNames={data.wellNames} note={data.note} />
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

/** Day × activity hours cross-tab with per-day and per-column SUMs (TABF 'A').
 *  Columns break out by activity TYPE or individual ACTIVITY, per `pivotBy`. */
function TAPivot({ rows, note, pivotBy }: { rows: TARow[]; note?: string; pivotBy: "type" | "activity" }) {
  const { days, types, groups, groupStart, cell, dayTotal, typeTotal, grand } = useMemo(() => {
    const colOf = (r: TARow) => (pivotBy === "activity" ? r.activity : r.type);
    const dayKey = (r: TARow) => `${r.wellCode}|${r.date ?? ""}`;
    const dayMap = new Map<string, { wellCode: string; date: string | null; holeSize: string | null; from: number | null; to: number | null; mudType: string | null }>();
    const cell = new Map<string, number>();        // `${dayKey}|${col}` -> hours
    const dayTotal = new Map<string, number>(), typeTotal = new Map<string, number>();
    // When pivoting by activity, remember each activity's parent activity-type so
    // the header can group activities (sub-headers) under their type (top header).
    const parentType = new Map<string, string>();
    let grand = 0;
    for (const r of rows) {
      const dk = dayKey(r);
      if (!dayMap.has(dk)) dayMap.set(dk, { wellCode: r.wellCode, date: r.date, holeSize: r.holeSize, from: r.from, to: r.to, mudType: r.mudType });
      const h = typeof r.hours === "number" ? r.hours : 0;
      const col = colOf(r);
      if (!h || !col) continue;
      if (pivotBy === "activity" && !parentType.has(col)) parentType.set(col, r.type ?? "—");
      const ck = `${dk}|${col}`;
      cell.set(ck, (cell.get(ck) ?? 0) + h);
      dayTotal.set(dk, (dayTotal.get(dk) ?? 0) + h);
      typeTotal.set(col, (typeTotal.get(col) ?? 0) + h);
      grand += h;
    }
    // Column order + the two-level grouping. Pivoting by activity → activities
    // sorted within each parent type (types alpha, activities alpha inside);
    // pivoting by type → a single flat group per type (no sub-header needed).
    const types = pivotBy === "activity"
      ? [...typeTotal.keys()].sort((a, b) => (parentType.get(a) ?? "").localeCompare(parentType.get(b) ?? "") || a.localeCompare(b))
      : [...typeTotal.keys()].sort();
    const groups: { type: string; cols: string[]; total: number }[] = [];
    for (const c of types) {
      const t = pivotBy === "activity" ? (parentType.get(c) ?? "—") : c;
      const last = groups[groups.length - 1];
      if (last && last.type === t) { last.cols.push(c); last.total += typeTotal.get(c) ?? 0; }
      else groups.push({ type: t, cols: [c], total: typeTotal.get(c) ?? 0 });
    }
    // First column of each group → gets the heavy group separator on its left.
    const groupStart = new Set(groups.map((g) => g.cols[0]));
    const days = [...dayMap.entries()].map(([k, v]) => ({ k, ...v }))
      .sort((a, b) => a.wellCode.localeCompare(b.wellCode) || String(a.date ?? "").localeCompare(String(b.date ?? "")));
    return { days, types, groups, groupStart, cell, dayTotal, typeTotal, grand };
  }, [rows, pivotBy]);

  if (!days.length) return <div className="p-8 text-center text-sm text-gray-400">{note ?? "No hours to pivot."}</div>;
  const num = (v: number | undefined) => (v ? h1(v) : "");
  // Heavy separator on the left edge of each activity-type group (activity pivot).
  const sep = (col: string) => (pivotBy === "activity" && groupStart.has(col) ? " border-l-2 border-l-gray-500" : "");
  return (
    <table className="text-[11px] tabular-nums border-collapse">
      <thead className="sticky top-0 z-20">
        {/* Pivoting by activity → two header rows: activity TYPE (grouped, spanning
            its activities) over the individual ACTIVITY sub-headers. Pivoting by
            type → a single header row. The fixed left columns span both rows. */}
        <tr className="bg-gray-100">
          {["Well", "Date", "Hole", "From", "To", "Mud type"].map((hh) => (
            <th key={hh} rowSpan={pivotBy === "activity" ? 2 : 1} className="bg-gray-100 border border-gray-300 px-2 py-1 text-left font-semibold text-gray-700 whitespace-nowrap align-bottom">{hh}</th>
          ))}
          <th rowSpan={pivotBy === "activity" ? 2 : 1} className="bg-amber-100 border border-gray-300 px-2 py-1 text-center font-semibold text-gray-800 whitespace-nowrap align-bottom">SUM</th>
          {pivotBy === "activity"
            ? groups.map((g) => (
                <th key={g.type} colSpan={g.cols.length} className="bg-gray-200 border-2 border-gray-500 px-2 py-1 text-center font-semibold text-gray-700 whitespace-nowrap max-w-[220px] truncate" title={g.type}>{g.type}</th>
              ))
            : types.map((t) => (
                <th key={t} className="bg-gray-100 border border-gray-300 px-2 py-1 text-center font-medium text-gray-700 whitespace-nowrap max-w-[110px] truncate" title={t}>{t}</th>
              ))}
        </tr>
        {pivotBy === "activity" && (
          <tr className="bg-gray-100">
            {types.map((t) => (
              <th key={t} className={`bg-gray-100 border border-gray-300 px-2 py-1 text-center font-medium text-gray-700 whitespace-nowrap max-w-[110px] truncate${sep(t)}`} title={t}>{t}</th>
            ))}
          </tr>
        )}
      </thead>
      <tbody>
        {days.map((d, ri) => (
          <tr key={d.k} className={ri % 2 ? "bg-teal-50/40" : "bg-white"}>
            <th className="border border-gray-300 px-2 py-0.5 text-left font-semibold text-gray-800 whitespace-nowrap">{d.wellCode}</th>
            <td className="border border-gray-300 px-2 py-0.5 text-left whitespace-nowrap">{d.date ?? ""}</td>
            <td className="border border-gray-300 px-2 py-0.5 text-left whitespace-nowrap">{d.holeSize ?? ""}</td>
            <td className="border border-gray-300 px-2 py-0.5 text-center">{fmtNum(d.from)}</td>
            <td className="border border-gray-300 px-2 py-0.5 text-center">{fmtNum(d.to)}</td>
            <td className="border border-gray-300 px-2 py-0.5 text-left whitespace-nowrap">{d.mudType ?? ""}</td>
            <td className="border border-gray-300 px-2 py-0.5 text-center font-semibold bg-amber-50">{num(dayTotal.get(d.k))}</td>
            {types.map((t) => <td key={t} className={`border border-gray-300 px-2 py-0.5 text-center${sep(t)}`}>{num(cell.get(`${d.k}|${t}`))}</td>)}
          </tr>
        ))}
        {/* Footer rows pin to the bottom; offsets stack them so none overlap.
            Pivoting by activity adds two type-rollup rows below, so the per-column
            SUM/% sit two row-heights (1.5rem each) higher. */}
        <tr className={`bg-amber-100 font-semibold sticky ${pivotBy === "activity" ? "bottom-[4.5rem]" : "bottom-6"}`}>
          <th className="border border-gray-300 px-2 py-0.5 text-left text-gray-800 whitespace-nowrap">SUM</th>
          <td className="border border-gray-300 px-2 py-0.5" colSpan={4} />
          <td className="border border-gray-300 px-2 py-0.5 text-center text-gray-500">{days.length} days</td>
          <td className="border border-gray-300 px-2 py-0.5 text-center text-gray-900">{h1(grand)}</td>
          {types.map((t) => <td key={t} className={`border border-gray-300 px-2 py-0.5 text-center text-gray-900${sep(t)}`}>{num(typeTotal.get(t))}</td>)}
        </tr>
        {/* Each column's share of total hours (SUM column = 100 %). */}
        <tr className={`bg-amber-50 font-semibold text-gray-600 sticky ${pivotBy === "activity" ? "bottom-[3rem]" : "bottom-0"}`}>
          <th className="border border-gray-300 px-2 py-0.5 text-left whitespace-nowrap">%</th>
          <td className="border border-gray-300 px-2 py-0.5" colSpan={5} />
          <td className="border border-gray-300 px-2 py-0.5 text-center text-gray-900">{grand > 0 ? "100%" : ""}</td>
          {types.map((t) => <td key={t} className={`border border-gray-300 px-2 py-0.5 text-center${sep(t)}`}>{grand > 0 ? `${(100 * (typeTotal.get(t) ?? 0) / grand).toFixed(1)}%` : ""}</td>)}
        </tr>
        {/* When pivoting by activity, roll the activities up to their parent
            activity-type: a SUM and % per type, each spanning its activity cols. */}
        {pivotBy === "activity" && (
          <>
            <tr className="bg-amber-200 font-semibold sticky bottom-6 text-gray-800">
              <th className="border border-gray-300 px-2 py-0.5 text-left whitespace-nowrap">Type SUM</th>
              <td className="border border-gray-300 px-2 py-0.5" colSpan={5} />
              <td className="border border-gray-300 px-2 py-0.5 text-center">{h1(grand)}</td>
              {groups.map((g) => <td key={g.type} colSpan={g.cols.length} className="border border-gray-300 border-l-2 border-l-gray-500 px-2 py-0.5 text-center" title={g.type}>{num(g.total)}</td>)}
            </tr>
            <tr className="bg-amber-100 font-semibold sticky bottom-0 text-gray-700">
              <th className="border border-gray-300 px-2 py-0.5 text-left whitespace-nowrap">Type %</th>
              <td className="border border-gray-300 px-2 py-0.5" colSpan={5} />
              <td className="border border-gray-300 px-2 py-0.5 text-center">{grand > 0 ? "100%" : ""}</td>
              {groups.map((g) => <td key={g.type} colSpan={g.cols.length} className="border border-gray-300 border-l-2 border-l-gray-500 px-2 py-0.5 text-center" title={g.type}>{grand > 0 ? `${(100 * g.total / grand).toFixed(1)}%` : ""}</td>)}
            </tr>
          </>
        )}
      </tbody>
    </table>
  );
}

/** Chart-view router: generic bars/pie (selectable X axis & split-by, optional
 *  100%-stack) plus the next-well engineering views — depth-vs-days learning
 *  curve, NPT (Drilling vs Waiting) split, and a days-per-1000 m benchmark. */
function TAChart({ rows, kind, chartType, normalize, barX, barSplit, wellNames, note }: {
  rows: TARow[]; kind: ChartKind; chartType: "grouped" | "stacked" | "pie"; normalize: boolean;
  barX: Dim; barSplit: Dim; wellNames?: Record<string, string>; note?: string;
}) {
  if (note) return <div className="p-8 text-center text-sm text-gray-400">{note}</div>;
  if (kind === "depthDays") return <DepthDaysChart rows={rows} wellNames={wellNames} />;
  if (kind === "npt") return <NptChart rows={rows} wellNames={wellNames} />;
  if (kind === "days1000") return <Days1000Chart rows={rows} wellNames={wellNames} />;
  return <BarsChart rows={rows} chartType={chartType} normalize={normalize} barX={barX} barSplit={barSplit} wellNames={wellNames} />;
}

const colorOf = (i: number) => PALETTE[i % PALETTE.length];

/** Floating HTML tooltip for the hand-rolled SVG charts (crisper than <title>). */
function useSvgHover() {
  const [hover, setHover] = useState<{ x: number; y: number; html: string } | null>(null);
  const enter = (html: string) => (e: React.MouseEvent) => setHover({ x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY, html });
  const leave = () => setHover(null);
  const node = hover ? (
    <div className="absolute z-20 pointer-events-none px-2 py-1 rounded bg-gray-900 text-white text-[11px] leading-tight shadow-lg"
      style={{ left: hover.x + 12, top: hover.y + 12, maxWidth: 260 }} dangerouslySetInnerHTML={{ __html: hover.html }} />
  ) : null;
  return { enter, leave, node };
}

/** Generic X × Split bar/pie chart over the time-analysis rows (the user-chosen
 *  dimensions). X ∈ {well, activity type, activity}; split-by likewise. */
function BarsChart({ rows, chartType, normalize, barX, barSplit, wellNames }: {
  rows: TARow[]; chartType: "grouped" | "stacked" | "pie"; normalize: boolean; barX: Dim; barSplit: Dim; wellNames?: Record<string, string>;
}) {
  const hover = useSvgHover();
  const { cats, series, matrix, catTotal, pie, grand, capped } = useMemo(() => {
    const cell = new Map<string, number>();
    const catTotalAll = new Map<string, number>(), serTotal = new Map<string, number>();
    for (const r of rows) {
      const h = typeof r.hours === "number" ? r.hours : 0; if (!h) continue;
      const c = dimKey(r, barX, wellNames), sName = dimKey(r, barSplit, wellNames);
      cell.set(`${c} ${sName}`, (cell.get(`${c} ${sName}`) ?? 0) + h);
      catTotalAll.set(c, (catTotalAll.get(c) ?? 0) + h);
      serTotal.set(sName, (serTotal.get(sName) ?? 0) + h);
    }
    const SER_MAX = 16, CAT_MAX = 30;
    const cats = [...catTotalAll.entries()].sort((a, b) => b[1] - a[1]).slice(0, CAT_MAX).map((x) => x[0]);
    const key = (c: string, s: string) => `${c} ${s}`;
    // Which series to keep: the top-N by GLOBAL total (stable — independent of
    // the category set). But ORDER them by their value in the LEFTMOST bar
    // (cats[0], the largest category), so that bar reads largest→smallest from the
    // base up and the legend follows the most-left bar. Ties break on global total.
    const topSeries = [...serTotal.entries()].sort((a, b) => b[1] - a[1]).slice(0, SER_MAX).map((x) => x[0]);
    const lead = cats[0];
    topSeries.sort((a, b) => (cell.get(key(lead, b)) ?? 0) - (cell.get(key(lead, a)) ?? 0) || (serTotal.get(b) ?? 0) - (serTotal.get(a) ?? 0));
    const capped = catTotalAll.size > cats.length || serTotal.size > topSeries.length;
    // If the split-by has more values than fit, fold the rest into an "Other"
    // bucket so each bar's stack still sums to the category's TRUE total. Without
    // this a bar's height depended on which series globally ranked top-N, so a
    // well's value changed when *another* well was added to / removed from the chart.
    const seriesOverflow = serTotal.size > topSeries.length;
    const series = seriesOverflow ? [...topSeries, "Other"] : topSeries;
    const topSet = new Set(topSeries);
    const matrix = cats.map((c) => series.map((sName) =>
      sName === "Other" && seriesOverflow
        ? (catTotalAll.get(c) ?? 0) - topSeries.reduce((a, s) => a + (cell.get(key(c, s)) ?? 0), 0)
        : (cell.get(key(c, sName)) ?? 0)));
    // Bar total = the category's true total (independent of the series cap).
    const catTotal = cats.map((c) => catTotalAll.get(c) ?? 0);
    const pie = series.map((sName) =>
      sName === "Other" && seriesOverflow
        ? { name: "Other", value: [...serTotal].filter(([n]) => !topSet.has(n)).reduce((a, [, v]) => a + v, 0) }
        : { name: sName, value: serTotal.get(sName) ?? 0 });
    const grand = pie.reduce((a, s) => a + s.value, 0);
    return { cats, series, matrix, catTotal, pie, grand, capped };
  }, [rows, barX, barSplit, wellNames]);

  if (!cats.length || grand <= 0) return <div className="p-8 text-center text-sm text-gray-400">No hours recorded to chart.</div>;

  // "Other" (the folded-in overflow series) is drawn neutral grey, not a palette hue.
  const serColor = (sName: string, si: number) => (sName === "Other" ? "#94a3b8" : colorOf(si));
  const legend = (
    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[11px] text-gray-600">
      {series.map((sName, si) => (
        <span key={sName} className="inline-flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: serColor(sName, si) }} />{sName}</span>
      ))}
    </div>
  );
  const otherCount = series.includes("Other") ? <span className="text-amber-600"> Lower-ranked {DIM_LABEL[barSplit].toLowerCase()} are folded into “Other”.</span> : null;
  const capNote = capped ? <span className="text-amber-600"> Showing the top {cats.length} {DIM_LABEL[barX].toLowerCase()}.{otherCount}</span> : null;

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
      <div className="p-3 relative">
        <div className="text-[11px] text-gray-500 mb-2">Overall time distribution by {DIM_LABEL[barSplit].toLowerCase()} — {h1(grand)} h total.{capNote}</div>
        <svg width={300} height={300} className="block">
          {slices.map((s) => { const a1 = a0 + (s.value / grand) * 2 * Math.PI; const d = arc(a1); a0 = a1; const html = `<b>${s.name}</b><br/>${h1(s.value)} h · ${(100 * s.value / grand).toFixed(1)}%`; return <path key={s.name} d={d} fill={serColor(s.name, series.indexOf(s.name))} stroke="#fff" strokeWidth={1} onMouseEnter={hover.enter(html)} onMouseMove={hover.enter(html)} onMouseLeave={hover.leave} />; })}
        </svg>
        {legend}
        {hover.node}
      </div>
    );
  }

  const stacked = chartType === "stacked";
  const pct = stacked && normalize;
  const max = pct ? 1 : stacked ? Math.max(...catTotal, 1) : Math.max(1, ...matrix.flat());
  const barGroupW = stacked ? 26 : Math.max(10, series.length * 9);
  const padCat = 16, axisW = 52, top = 12, plotH = 320, labelH = 110;
  const bandW = barGroupW + padCat;
  const chartW = axisW + cats.length * bandW + 16;
  const baseY = top + plotH;
  const yOf = (v: number) => baseY - (v / max) * plotH;
  const ticks = 4;
  const fmtTick = (v: number) => pct ? `${Math.round(v * 100)}%` : v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0);
  const title = `${stacked ? (pct ? "100% stacked" : "Stacked") : "Grouped"} — ${DIM_LABEL[barX]} (X) split by ${DIM_LABEL[barSplit]}`;

  return (
    <div className="p-3 relative">
      <div className="text-[11px] text-gray-500 mb-2">{title}. Cell = hours{pct ? " (share of the bar)" : ""}.{capNote}</div>
      <div className="overflow-x-auto">
        <svg width={chartW} height={baseY + labelH} className="block">
          {Array.from({ length: ticks + 1 }, (_, i) => { const v = (max / ticks) * i, y = yOf(v); return (
            <g key={i}><line x1={axisW} x2={chartW - 16} y1={y} y2={y} stroke="#eef2f7" /><text x={axisW - 4} y={y + 3} textAnchor="end" fontSize={9} fill="#94a3b8">{fmtTick(v)}</text></g>); })}
          {cats.map((c, ci) => {
            const x0 = axisW + ci * bandW + padCat / 2;
            const mid = x0 + barGroupW / 2;
            const tot = catTotal[ci] || 1;
            let acc = 0;
            return (
              <g key={c}>
                {series.map((sName, si) => {
                  const raw = matrix[ci][si]; if (raw <= 0) return null;
                  const v = pct ? raw / tot : raw;
                  const html = `<b>${c}</b> · ${sName}<br/>${h1(raw)} h${stacked ? ` · ${(100 * raw / tot).toFixed(1)}%` : ""}`;
                  if (stacked) { const y = yOf(acc + v), hgt = yOf(acc) - yOf(acc + v); acc += v; return <rect key={sName} x={x0} y={y} width={barGroupW} height={hgt} fill={serColor(sName, si)} onMouseEnter={hover.enter(html)} onMouseMove={hover.enter(html)} onMouseLeave={hover.leave} />; }
                  const bw = barGroupW / series.length, x = x0 + si * bw, y = yOf(v);
                  return <rect key={sName} x={x} y={y} width={Math.max(1, bw - 0.5)} height={baseY - y} fill={serColor(sName, si)} onMouseEnter={hover.enter(html)} onMouseMove={hover.enter(html)} onMouseLeave={hover.leave} />;
                })}
                <text x={mid} y={baseY + 12} textAnchor="end" fontSize={9} fill="#475569" transform={`rotate(-40 ${mid} ${baseY + 12})`}>{c.length > 18 ? c.slice(0, 17) + "…" : c}</text>
              </g>
            );
          })}
          <line x1={axisW} x2={chartW - 16} y1={baseY} y2={baseY} stroke="#cbd5e1" />
        </svg>
      </div>
      {legend}
      {hover.node}
    </div>
  );
}

/** Depth-vs-days learning curve: per well, the hole depth (Y, increasing down)
 *  against elapsed days from the well's first activity (X). The single most
 *  important next-well-planning chart — overlay offsets to benchmark pace. */
function DepthDaysChart({ rows, wellNames }: { rows: TARow[]; wellNames?: Record<string, string> }) {
  const hover = useSvgHover();
  const { wells, maxDay, maxDepth, capped } = useMemo(() => {
    // Per well: deepest depth seen on each date → (elapsed day, depth) points.
    const byWell = new Map<string, Map<number, number>>();   // well → (jDay → maxDepth)
    const span = new Map<string, number>();
    for (const r of rows) {
      if (r.depth == null) continue;
      const jd = jDay(r.date); if (jd == null) continue;
      const w = r.wellCode;
      let m = byWell.get(w); if (!m) { m = new Map(); byWell.set(w, m); }
      m.set(jd, Math.max(m.get(jd) ?? 0, r.depth));
    }
    const wellsAll = [...byWell.entries()].map(([code, m]) => {
      const days = [...m.keys()].sort((a, b) => a - b);
      const d0 = days[0];
      const pts = days.map((jd) => ({ day: jd - d0, depth: m.get(jd)! })).filter((p) => p.depth > 0);
      span.set(code, pts.length ? pts[pts.length - 1].depth : 0);
      return { code, name: wellNames?.[code] || code, pts };
    }).filter((w) => w.pts.length >= 2);
    // Deepest wells first (the meaningful learning curves).
    wellsAll.sort((a, b) => (span.get(b.code) ?? 0) - (span.get(a.code) ?? 0));
    const WELL_MAX = 12;
    const wells = wellsAll.slice(0, WELL_MAX);
    let maxDay = 1, maxDepth = 1;
    for (const w of wells) for (const p of w.pts) { if (p.day > maxDay) maxDay = p.day; if (p.depth > maxDepth) maxDepth = p.depth; }
    return { wells, maxDay, maxDepth, capped: wellsAll.length > wells.length };
  }, [rows, wellNames]);

  if (!wells.length) return <div className="p-8 text-center text-sm text-gray-400">No dated depth data to draw a learning curve. (Wells with no recorded hole depth — e.g. workovers — are skipped.)</div>;

  const PAD = { l: 56, r: 16, t: 12, b: 42 };
  const plotW = Math.max(560, maxDay * 7), plotH = 380;
  const W = PAD.l + plotW + PAD.r, H = PAD.t + plotH + PAD.b;
  const xOf = (d: number) => PAD.l + (d / maxDay) * plotW;
  const yOf = (dep: number) => PAD.t + (dep / maxDepth) * plotH;     // depth increases downward
  const xticks = niceTicks(0, maxDay, 6), yticks = niceTicks(0, maxDepth, 6);

  return (
    <div className="p-3 relative">
      <div className="text-[11px] text-gray-500 mb-2">
        Hole depth vs elapsed days — the <b>drilling learning curve</b>. Each line is a well; a curve that reaches depth in fewer days drilled faster.
        {capped ? <span className="text-amber-600"> Showing the {wells.length} deepest wells.</span> : null}
      </div>
      <div className="overflow-x-auto">
        <svg width={W} height={H} className="block">
          {xticks.map((t) => <g key={`x${t}`}><line x1={xOf(t)} x2={xOf(t)} y1={PAD.t} y2={PAD.t + plotH} stroke="#f1f5f9" /><text x={xOf(t)} y={PAD.t + plotH + 14} textAnchor="middle" fontSize={9} fill="#94a3b8">{Math.round(t)}</text></g>)}
          {yticks.map((t) => <g key={`y${t}`}><line x1={PAD.l} x2={PAD.l + plotW} y1={yOf(t)} y2={yOf(t)} stroke="#f1f5f9" /><text x={PAD.l - 5} y={yOf(t) + 3} textAnchor="end" fontSize={9} fill="#94a3b8">{Math.round(t)}</text></g>)}
          <rect x={PAD.l} y={PAD.t} width={plotW} height={plotH} fill="none" stroke="#cbd5e1" />
          <text x={PAD.l + plotW / 2} y={H - 4} textAnchor="middle" fontSize={10} fill="#475569" fontWeight={600}>Days from first activity</text>
          <text transform={`translate(12 ${PAD.t + plotH / 2}) rotate(-90)`} textAnchor="middle" fontSize={10} fill="#475569" fontWeight={600}>Hole depth (m)</text>
          {wells.map((w, wi) => (
            <g key={w.code}>
              <polyline fill="none" stroke={colorOf(wi)} strokeWidth={1.6} points={w.pts.map((p) => `${xOf(p.day).toFixed(1)},${yOf(p.depth).toFixed(1)}`).join(" ")} />
              {w.pts.map((p, j) => { const html = `<b>${w.name}</b><br/>Day ${p.day} · ${Math.round(p.depth)} m`; return <circle key={j} cx={xOf(p.day)} cy={yOf(p.depth)} r={2} fill={colorOf(wi)} onMouseEnter={hover.enter(html)} onMouseMove={hover.enter(html)} onMouseLeave={hover.leave} />; })}
            </g>
          ))}
        </svg>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[11px] text-gray-600">
        {wells.map((w, wi) => <span key={w.code} className="inline-flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: colorOf(wi) }} />{w.name}</span>)}
      </div>
      {hover.node}
    </div>
  );
}

/** NPT split: productive (Drilling group) vs non-productive (Waiting group)
 *  hours per well, as a 100%-stacked bar, ranked by NPT%. Targets the next
 *  well's lost-time reduction. */
function NptChart({ rows, wellNames }: { rows: TARow[]; wellNames?: Record<string, string> }) {
  const hover = useSvgHover();
  const wells = useMemo(() => {
    const m = new Map<string, { prod: number; npt: number }>();
    for (const r of rows) {
      const h = typeof r.hours === "number" ? r.hours : 0; if (!h) continue;
      const w = wellNames?.[r.wellCode] || r.wellCode;
      const e = m.get(w) ?? { prod: 0, npt: 0 };
      // Group "Waiting" = NPT; everything else (Drilling) = productive.
      if ((r.group ?? "").toLowerCase().startsWith("wait")) e.npt += h; else e.prod += h;
      m.set(w, e);
    }
    const arr = [...m.entries()].map(([name, e]) => { const tot = e.prod + e.npt; return { name, ...e, tot, nptPct: tot > 0 ? e.npt / tot : 0 }; }).filter((w) => w.tot > 0);
    arr.sort((a, b) => b.nptPct - a.nptPct);   // worst offenders first
    return arr.slice(0, 26);
  }, [rows, wellNames]);

  if (!wells.length) return <div className="p-8 text-center text-sm text-gray-400">No hours to split into productive / NPT.</div>;
  const PAD = { l: 150, r: 48, t: 8, b: 24 };
  const rowH = 22, plotW = 460;
  const W = PAD.l + plotW + PAD.r, H = PAD.t + wells.length * rowH + PAD.b;
  return (
    <div className="p-3 relative">
      <div className="text-[11px] text-gray-500 mb-2">
        <b>Non-productive time</b> (Waiting) vs productive (Drilling), per well — 100%-stacked, ranked worst-first. The <span style={{ color: "#dc2626" }}>red</span> share is the lost-time target for the next well.
      </div>
      <svg width={W} height={H} className="block">
        {[0, 0.25, 0.5, 0.75, 1].map((t) => <g key={t}><line x1={PAD.l + t * plotW} x2={PAD.l + t * plotW} y1={PAD.t} y2={PAD.t + wells.length * rowH} stroke="#eef2f7" /><text x={PAD.l + t * plotW} y={PAD.t + wells.length * rowH + 14} textAnchor="middle" fontSize={9} fill="#94a3b8">{Math.round(t * 100)}%</text></g>)}
        {wells.map((w, i) => {
          const y = PAD.t + i * rowH + 3, bh = rowH - 8;
          const prodW = (w.prod / w.tot) * plotW, nptW = (w.npt / w.tot) * plotW;
          const prodHtml = `<b>${w.name}</b><br/>Productive ${h1(w.prod)} h · ${(100 * w.prod / w.tot).toFixed(1)}%`;
          const nptHtml = `<b>${w.name}</b><br/>NPT (Waiting) ${h1(w.npt)} h · ${(100 * w.npt / w.tot).toFixed(1)}%`;
          return (
            <g key={w.name}>
              <text x={PAD.l - 6} y={y + bh / 2 + 3} textAnchor="end" fontSize={10} fill="#334155">{w.name.length > 22 ? w.name.slice(0, 21) + "…" : w.name}</text>
              <rect x={PAD.l} y={y} width={prodW} height={bh} fill="#0d9488" onMouseEnter={hover.enter(prodHtml)} onMouseMove={hover.enter(prodHtml)} onMouseLeave={hover.leave} />
              <rect x={PAD.l + prodW} y={y} width={nptW} height={bh} fill="#dc2626" onMouseEnter={hover.enter(nptHtml)} onMouseMove={hover.enter(nptHtml)} onMouseLeave={hover.leave} />
              <text x={PAD.l + plotW + 5} y={y + bh / 2 + 3} fontSize={9} fill="#dc2626" fontWeight={600}>{(100 * w.nptPct).toFixed(0)}%</text>
            </g>
          );
        })}
      </svg>
      <div className="flex gap-4 mt-2 text-[11px] text-gray-600">
        <span className="inline-flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: "#0d9488" }} />Productive (Drilling)</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: "#dc2626" }} />NPT (Waiting)</span>
      </div>
      {hover.node}
    </div>
  );
}

/** Days-per-1000 m efficiency benchmark: total elapsed days ÷ (metres drilled /
 *  1000) per well, ranked best→worst — a normalized pace KPI for setting the
 *  next well's target. */
function Days1000Chart({ rows, wellNames }: { rows: TARow[]; wellNames?: Record<string, string> }) {
  const hover = useSvgHover();
  const wells = useMemo(() => {
    const m = new Map<string, { days: Set<number>; minD: number; maxD: number }>();
    for (const r of rows) {
      const w = wellNames?.[r.wellCode] || r.wellCode;
      const e = m.get(w) ?? { days: new Set<number>(), minD: Infinity, maxD: -Infinity };
      const jd = jDay(r.date); if (jd != null) e.days.add(jd);
      if (r.depth != null) { if (r.depth < e.minD) e.minD = r.depth; if (r.depth > e.maxD) e.maxD = r.depth; }
      m.set(w, e);
    }
    const arr = [...m.entries()].map(([name, e]) => {
      const days = e.days.size, drilled = Number.isFinite(e.maxD) && Number.isFinite(e.minD) ? Math.max(0, e.maxD - e.minD) : 0;
      const val = drilled > 0 ? days / (drilled / 1000) : null;
      return { name, days, drilled, val };
    }).filter((w) => w.val != null && w.drilled > 100) as { name: string; days: number; drilled: number; val: number }[];
    arr.sort((a, b) => a.val - b.val);   // fastest (fewest days/1000m) first
    return arr.slice(0, 26);
  }, [rows, wellNames]);

  if (!wells.length) return <div className="p-8 text-center text-sm text-gray-400">Not enough depth + date data to compute days / 1000 m.</div>;
  const maxVal = Math.max(...wells.map((w) => w.val), 1);
  const PAD = { l: 150, r: 56, t: 8, b: 28 };
  const rowH = 22, plotW = 440;
  const W = PAD.l + plotW + PAD.r, H = PAD.t + wells.length * rowH + PAD.b;
  const xticks = niceTicks(0, maxVal, 5);
  return (
    <div className="p-3 relative">
      <div className="text-[11px] text-gray-500 mb-2">
        <b>Days per 1000 m drilled</b> — normalized drilling pace, fastest first. A clean apples-to-apples KPI for ranking offsets and setting the next well's target.
      </div>
      <svg width={W} height={H} className="block">
        {xticks.map((t) => <g key={t}><line x1={PAD.l + (t / maxVal) * plotW} x2={PAD.l + (t / maxVal) * plotW} y1={PAD.t} y2={PAD.t + wells.length * rowH} stroke="#eef2f7" /><text x={PAD.l + (t / maxVal) * plotW} y={PAD.t + wells.length * rowH + 16} textAnchor="middle" fontSize={9} fill="#94a3b8">{t.toFixed(t < 10 ? 1 : 0)}</text></g>)}
        {wells.map((w, i) => {
          const y = PAD.t + i * rowH + 3, bh = rowH - 8, bw = (w.val / maxVal) * plotW;
          const html = `<b>${w.name}</b><br/>${w.val.toFixed(1)} days / 1000 m<br/>${w.days} days · ${Math.round(w.drilled)} m drilled`;
          return (
            <g key={w.name}>
              <text x={PAD.l - 6} y={y + bh / 2 + 3} textAnchor="end" fontSize={10} fill="#334155">{w.name.length > 22 ? w.name.slice(0, 21) + "…" : w.name}</text>
              <rect x={PAD.l} y={y} width={Math.max(1, bw)} height={bh} fill={colorOf(i)} rx={2} onMouseEnter={hover.enter(html)} onMouseMove={hover.enter(html)} onMouseLeave={hover.leave} />
              <text x={PAD.l + bw + 5} y={y + bh / 2 + 3} fontSize={9} fill="#475569">{w.val.toFixed(1)}</text>
            </g>
          );
        })}
      </svg>
      {hover.node}
    </div>
  );
}

/** Round "nice" tick values across [lo, hi] (~count divisions). */
function niceTicks(lo: number, hi: number, count: number): number[] {
  const span = hi - lo || 1;
  const raw = span / count;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / p;
  const step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 0.001; v += step) out.push(Number(v.toFixed(6)));
  return out;
}
