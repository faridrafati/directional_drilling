/**
 * Multi-well Tools / equipment browser — the port of the Delphi DDR tools tab
 * (DDR-Delphi/Unit1.pas:4552, tab 6). Pick a tool type (Bit / Casing / Liner /
 * Jar / DH-Motor / MWD / BHA / Drill string / Stabilizers); the grid shows every
 * record of that tool across the faceted wells, joined with the day's hole size /
 * mud type, with a per-column keyword search. Columns are tool-specific (resolved
 * server-side through each tool's lookup). A row opens that day's daily report.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client.js";
import { MultiSelect, type Item } from "./DdrRemarksSearch.js";
import { JalaliDatePicker } from "./JalaliDatePicker.js";

// Tool types (keys match the API's TOOL_SPECS). Bit first (richest / default).
const TOOLS = [
  { key: "bit", label: "Bit (L05)" }, { key: "casing", label: "Casing (L08)" }, { key: "liner", label: "Liner (L06)" },
  { key: "jar", label: "Jar" }, { key: "dhMotor", label: "DH Motor" }, { key: "mwd", label: "MWD" },
  { key: "bha", label: "BHA" }, { key: "drillString", label: "Drill string" }, { key: "stabilizers", label: "Stabilizers" },
];

interface SearchOptions {
  fields: string[]; wells: { code: string; name: string; field: string | null }[];
  holeSizes: string[]; mudTypes: string[]; rigs: string[];
}
interface ToolColumn { key: string; label: string; text?: boolean; wide?: boolean; titleKey?: string }
type ToolRow = Record<string, unknown> & { wellCode: string; date: string | null; serialNo: number | null };
interface ToolsData { tool: string; label: string; columns: ToolColumn[]; rows: ToolRow[]; truncated?: boolean; total?: number; note?: string }

const fmtNum = (v: unknown): string =>
  v == null || v === "" ? "" : typeof v === "number" ? (Number.isInteger(v) ? String(v) : v.toFixed(1)) : String(v);

export function Tools({ onOpenReport }: { onOpenReport?: (wellCode: string, serialNo: number, date: string | null) => void } = {}) {
  const [tool, setTool] = useState("bit");
  const [selFields, setSelFields] = useState<string[]>([]);
  const [selWells, setSelWells] = useState<string[]>([]);
  const [selHole, setSelHole] = useState<string[]>([]);
  const [selMud, setSelMud] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [data, setData] = useState<ToolsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Client-side keyword search over the loaded rows (Delphi's per-column search).
  const [searchCol, setSearchCol] = useState("all");
  const [searchKw, setSearchKw] = useState("");

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

  async function run(t = tool) {
    setLoading(true);
    setError(null);
    try {
      const body = { tool: t, fields: selFields, wells: selWells, holeSizes: selHole, mudTypes: selMud, dateFrom, dateTo };
      setData(await api.post<ToolsData>("/ddr/tools", body));
    } catch (e) { setError(String(e)); } finally { setLoading(false); }
  }
  function clearAll() {
    setSelFields([]); setSelWells([]); setSelHole([]); setSelMud([]); setDateFrom(""); setDateTo(""); setSearchKw(""); setData(null);
  }
  function changeTool(t: string) { setTool(t); setSearchCol("all"); setSearchKw(""); if (data) void run(t); }

  const cols = data?.columns ?? [];
  const rows = data?.rows ?? [];
  const filtered = useMemo(() => {
    const terms = searchKw.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return rows;
    const keys = searchCol === "all" ? ["wellCode", "date", ...cols.map((c) => c.key)] : [searchCol];
    return rows.filter((r) => { const hay = keys.map((k) => String(r[k] ?? "")).join("  ").toLowerCase(); return terms.every((t) => hay.includes(t)); });
  }, [rows, cols, searchCol, searchKw]);

  return (
    <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4 overflow-hidden">
      <div className="flex flex-col min-h-0 bg-white border border-gray-200 rounded p-3 overflow-y-auto">
        <div className="pb-2">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-600 mb-1">Tool</div>
          <select value={tool} onChange={(e) => changeTool(e.target.value)} className="w-full h-9 border border-gray-300 rounded px-2 text-sm bg-white">
            {TOOLS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
        </div>
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
      </div>

      <div className="bg-white border border-gray-200 rounded flex flex-col min-h-0 overflow-hidden">
        <div className="px-3 py-2 border-b border-gray-100 shrink-0 flex items-center justify-between gap-2 flex-wrap">
          <span className="text-sm text-gray-600 min-w-0 truncate">
            {data
              ? (data.note ? data.note : <>{data.label} · <b>{searchKw ? filtered.length : data.rows.length}</b>{searchKw ? ` of ${data.rows.length}` : ""} records{data.truncated ? ` (capped — ${data.total})` : ""}</>)
              : "Pick a tool + field / well, then Show."}
          </span>
          {data && rows.length > 0 && (
            <div className="flex items-center gap-1.5 shrink-0">
              <select value={searchCol} onChange={(e) => setSearchCol(e.target.value)} className="h-7 border border-gray-300 rounded px-1 text-xs bg-white" title="Column to search">
                <option value="all">All columns</option>
                {cols.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
              <input value={searchKw} onChange={(e) => setSearchKw(e.target.value)} placeholder="Search…" className="h-7 w-40 border border-gray-300 rounded px-2 text-xs" />
            </div>
          )}
        </div>
        <div className="overflow-auto flex-1 min-h-0">
          {data && <ToolsTable cols={cols} rows={filtered} note={data.note} onOpenReport={onOpenReport} />}
        </div>
      </div>
    </div>
  );
}

function ToolsTable({ cols, rows, note, onOpenReport }: {
  cols: ToolColumn[]; rows: ToolRow[]; note?: string;
  onOpenReport?: (wellCode: string, serialNo: number, date: string | null) => void;
}) {
  if (!rows.length) return <div className="p-8 text-center text-sm text-gray-400">{note ?? "No records."}</div>;
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
                const decoded = c.titleKey ? (String(row[c.titleKey] ?? "") || undefined) : undefined;
                if (c.wide) {
                  const t = v == null ? "" : String(v);
                  return <td key={c.key} className="border border-gray-300 px-2 py-0.5 text-left max-w-[340px] truncate" title={decoded ?? t}>{t}</td>;
                }
                return (
                  <td key={c.key} title={decoded} className={`border border-gray-300 px-2 py-0.5 whitespace-nowrap ${c.text ? "text-left" : "text-right"} ${decoded ? "cursor-help underline decoration-dotted decoration-gray-400" : ""}`}>
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
