/**
 * Multi-well Tools / equipment browser — the port of the Delphi DDR tools tab
 * (DDR-Delphi/Unit1.pas:4552, tab 6). Pick a tool type (Bit / Casing / Liner /
 * Jar / DH-Motor / MWD / BHA / Drill string / Stabilizers); the grid shows every
 * record of that tool across the faceted wells, joined with the day's hole size /
 * mud type, with a per-column keyword search. Columns are tool-specific (resolved
 * server-side through each tool's lookup). A row opens that day's daily report.
 *
 * Three views over the already-loaded rows (no extra fetch):
 *   • SUMMARY — a KPI dashboard tailored to the tool. For Bit (L05): run-level
 *     performance (footage / rotating hours / ROP), ranked by bit size & type,
 *     PDC-vs-roller-cone, IADC dull-grade frequency and reason-pulled breakdown.
 *     For every other tool: usage KPIs + a per-type/-size usage table.
 *   • RECORDS — the original tool grid; a row opens that day's daily report.
 *   • CHARTS  — hand-rolled SVG: the bit-run footage-vs-hours scatter (coloured
 *     by ROP) and footage-by-bit-size bars; for other tools, records/hours by
 *     type/size.
 *
 * NOTE on bit data: L05 logs a bit's footage (BitMeterTotal) and rotating hours
 * (BitHour) CUMULATIVELY each day of its run, so the raw rows must be deduped to
 * one record per run — keyed by (well, bit no, serial, size), keeping the row with
 * the largest cumulative footage — before any run-level KPI is computed. Summing
 * the daily rows would overcount footage/hours several-fold.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client.js";
import { MultiSelect, type Item } from "./DdrRemarksSearch.js";
import { JalaliDatePicker } from "./JalaliDatePicker.js";
import { useFacetOptions } from "./useFacetOptions.js";
import { useDdrSelection } from "./ddrSelection.js";

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
const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const n1 = (v: number): string => (Number.isInteger(v) ? String(v) : v.toFixed(1));
const fmtM = (m: number): string => (m >= 100000 ? `${(m / 1000).toFixed(0)}k` : Math.round(m).toLocaleString());
const PALETTE = ["#1e40af", "#dc2626", "#0d9488", "#d97706", "#7c3aed", "#65a30d", "#db2777", "#0891b2", "#ea580c", "#4f46e5", "#16a34a", "#9f1239", "#ca8a04", "#0e7490", "#a21caf", "#475569"];
const colorOf = (i: number) => PALETTE[i % PALETTE.length];

export function Tools({ onOpenReport }: { onOpenReport?: (wellCode: string, serialNo: number, date: string | null) => void } = {}) {
  const [tool, setTool] = useState("bit");
  // Shared across tabs (see ddrSelection) so the facet picks survive a tab switch.
  const {
    fields: selFields, setFields: setSelFields, wells: selWells, setWells: setSelWells,
    holeSizes: selHole, setHoleSizes: setSelHole, mudTypes: selMud, setMudTypes: setSelMud,
    dateFrom, setDateFrom, dateTo, setDateTo,
  } = useDdrSelection();
  const [data, setData] = useState<ToolsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Default = the KPI dashboard; Records is the original grid; Charts the SVGs.
  const [view, setView] = useState<"summary" | "records" | "charts">("summary");

  // Client-side keyword search over the loaded rows (Delphi's per-column search).
  const [searchCol, setSearchCol] = useState("all");
  const [searchKw, setSearchKw] = useState("");

  // Chart kind (bit has its own perf charts; everything else shares the usage charts).
  const [chartKind, setChartKind] = useState<ChartKind>("scatter");

  const optsQ = useQuery({ queryKey: ["ddr", "search-options"], queryFn: () => api.get<SearchOptions>("/ddr/search-options") });
  const o = optsQ.data;
  // Value facets scoped to the selected fields/wells (fall back to global lists).
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
  function changeTool(t: string) {
    setTool(t); setSearchCol("all"); setSearchKw("");
    setChartKind(t === "bit" ? "scatter" : "usageType");   // sensible default chart per tool
    if (data) void run(t);
  }

  const isBit = (data?.tool ?? tool) === "bit";
  const cols = data?.columns ?? [];
  const rows = data?.rows ?? [];
  const filtered = useMemo(() => {
    const terms = searchKw.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return rows;
    const keys = searchCol === "all" ? ["wellCode", "date", ...cols.map((c) => c.key)] : [searchCol];
    return rows.filter((r) => { const hay = keys.map((k) => String(r[k] ?? "")).join("  ").toLowerCase(); return terms.every((t) => hay.includes(t)); });
  }, [rows, cols, searchCol, searchKw]);

  // Chart kinds available for the current tool.
  const chartKinds: { key: ChartKind; label: string }[] = isBit
    ? [{ key: "scatter", label: "Footage vs hours" }, { key: "sizeFootage", label: "Footage by size" }, { key: "kindRop", label: "ROP by size · kind" }, { key: "dull", label: "Dull grades" }]
    : [{ key: "usageType", label: "By type" }, { key: "usageSize", label: "By size" }];

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
        <MultiSelect title="Bit sizes" items={facet.holeSizes.map((h) => ({ value: h, label: h }))} selected={selHole} onChange={setSelHole} />
        <MultiSelect title="Mud types" items={facet.mudTypes.map((m) => ({ value: m, label: m }))} selected={selMud} onChange={setSelMud} />
        <div className="pt-2">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-600 mb-1">Date range (Jalali)</div>
          <div className="flex items-center gap-1.5">
            <JalaliDatePicker value={dateFrom} onChange={setDateFrom} placeholder="From" className="flex-1 min-w-0" />
            <span className="text-gray-400">–</span>
            <JalaliDatePicker value={dateTo} onChange={setDateTo} placeholder="To" className="flex-1 min-w-0" />
          </div>
        </div>
        <div className="flex gap-2 pt-3">
          <button onClick={() => run()} disabled={loading} className="h-9 px-4 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300">{loading ? "Loading…" : "Show"}</button>
          <button onClick={clearAll} className="h-9 px-3 text-sm rounded border border-gray-300 hover:bg-gray-50">Clear</button>
        </div>
        {error && <div className="text-xs text-red-600 pt-2">{error}</div>}

        {view === "charts" && data && rows.length > 0 && (
          <div className="pt-4 mt-3 border-t border-gray-100">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-600 mb-1">Chart</div>
            <div className="grid grid-cols-2 gap-1">
              {chartKinds.map((k) => (
                <button key={k.key} onClick={() => setChartKind(k.key)} className={`px-2 h-7 text-xs rounded border ${chartKind === k.key ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"}`}>{k.label}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded flex flex-col min-h-0 overflow-hidden">
        <div className="px-3 py-2 border-b border-gray-100 shrink-0 flex items-center justify-between gap-2 flex-wrap">
          <span className="text-sm text-gray-600 min-w-0 truncate">
            {data
              ? (data.note ? data.note : <>{data.label} · <b>{searchKw && view === "records" ? filtered.length : data.rows.length}</b>{searchKw && view === "records" ? ` of ${data.rows.length}` : ""} records{data.truncated ? ` (capped — ${data.total})` : ""}</>)
              : "Pick a tool + field / well, then Show."}
          </span>
          {data && rows.length > 0 && (
            <div className="flex items-center gap-2 shrink-0">
              {view === "records" && (
                <div className="flex items-center gap-1.5">
                  <select value={searchCol} onChange={(e) => setSearchCol(e.target.value)} className="h-7 border border-gray-300 rounded px-1 text-xs bg-white" title="Column to search">
                    <option value="all">All columns</option>
                    {cols.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                  </select>
                  <input value={searchKw} onChange={(e) => setSearchKw(e.target.value)} placeholder="Search…" className="h-7 w-40 border border-gray-300 rounded px-2 text-xs" />
                </div>
              )}
              <div className="inline-flex rounded border border-gray-300 overflow-hidden">
                {(["summary", "records", "charts"] as const).map((v) => (
                  <button key={v} onClick={() => setView(v)} className={`px-2.5 h-7 text-xs capitalize ${view === v ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>{v}</button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="overflow-auto flex-1 min-h-0">
          {data && (view === "summary" ? (
            isBit ? <BitSummary rows={rows} note={data.note} /> : <ToolSummary rows={rows} cols={cols} label={data.label} note={data.note} />
          ) : view === "charts" ? (
            isBit ? <BitChart rows={rows} kind={chartKind} note={data.note} /> : <ToolUsageChart rows={rows} cols={cols} kind={chartKind} note={data.note} />
          ) : (
            <ToolsTable cols={cols} rows={filtered} note={data.note} onOpenReport={onOpenReport} />
          ))}
        </div>
      </div>
    </div>
  );
}

type ChartKind = "scatter" | "sizeFootage" | "kindRop" | "dull" | "usageType" | "usageSize";

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

// ── Shared UI bits (match the Time-Analysis dashboard) ───────────────────────

/** A single KPI tile. */
function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "emerald" | "amber" | "red" | "blue" }) {
  const t = tone === "red" ? "text-red-600" : tone === "amber" ? "text-amber-600" : tone === "emerald" ? "text-emerald-600" : tone === "blue" ? "text-blue-700" : "text-gray-900";
  return (
    <div className="border border-gray-200 rounded-lg px-3 py-2 bg-gradient-to-b from-white to-gray-50">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`text-lg font-bold tabular-nums leading-tight ${t}`}>{value}</div>
      {sub && <div className="text-[10px] text-gray-400 truncate" title={sub}>{sub}</div>}
    </div>
  );
}

/** Floating HTML tooltip for the hand-rolled SVG charts. */
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

const Th = ({ children, r }: { children: React.ReactNode; r?: boolean }) => (
  <th className={`bg-gray-100 border border-gray-200 px-2 py-1 font-medium text-gray-600 ${r ? "text-right" : "text-left"}`}>{children}</th>
);

/** Numeric value of a bit/hole-size label ("12 1/4" → 12.25) for the widest →
 *  narrowest ordering. Accepts space- or hyphen-separated fractions and decimals. */
const sizeVal = (h: string): number => {
  const m = (h || "").match(/(\d+(?:\.\d+)?)(?:[\s-]+(\d+)\/(\d+))?/);
  if (!m) return 0;
  let v = parseFloat(m[1]) || 0;
  if (m[2] && m[3]) v += (+m[2]) / (+m[3]);
  return v;
};

// ── Bit (L05) run-level performance ──────────────────────────────────────────

interface BitRun {
  wellCode: string; date: string | null; serialNo: number | null;
  size: string; type: string; kind: string | null; iadc: string; bit: string;
  footage: number; hours: number; rop: number | null;
  dull: string | null; dullTitle: string | null; reason: string | null;
}
interface BitStats {
  runs: BitRun[]; rawRows: number;
  totFootage: number; totHours: number; fleetRop: number | null; avgRunRop: number | null;
  wells: number; sizes: number; pdc: number; cone: number;
  bySize: { size: string; runs: number; footage: number; hours: number; rop: number | null }[];
  byType: { type: string; runs: number; footage: number; hours: number; rop: number | null }[];
  reasons: { reason: string; runs: number; pct: number }[];
  dulls: { dull: string; runs: number; pct: number; title: string | null }[];
}

/** Dedup the cumulative daily L05 rows to one record per bit RUN (well, bit no,
 *  serial, size), keeping the row with the largest cumulative footage — then roll
 *  up to the run-level KPIs the Bit summary + charts share. */
function bitStats(rows: ToolRow[]): BitStats {
  const byRun = new Map<string, ToolRow[]>();
  for (const r of rows) {
    const k = `${r.wellCode}|${String(r.bitNo ?? "")}|${String(r.serial ?? "")}|${String(r.size ?? "")}`;
    (byRun.get(k) ?? byRun.set(k, []).get(k)!).push(r);
  }
  const runs: BitRun[] = [];
  for (const g of byRun.values()) {
    // Best snapshot = the largest cumulative footage (meters, else to−from).
    const score = (r: ToolRow) => (num(r.meters) && r.meters > 0 ? r.meters : (num(r.to) && num(r.from) && r.to > r.from ? r.to - r.from : -1));
    const best = g.reduce((a, b) => (score(b) > score(a) ? b : a));
    let footage = num(best.meters) && best.meters > 0 ? best.meters : 0;
    if (footage <= 0 && num(best.to) && num(best.from) && best.to > best.from) footage = best.to - best.from;
    const hours = num(best.bitHrs) && best.bitHrs > 0 ? best.bitHrs : 0;
    runs.push({
      wellCode: best.wellCode, date: best.date, serialNo: best.serialNo,
      size: String(best.size ?? "—") || "—", type: String(best.type ?? "") || "—",
      kind: best.kind != null ? String(best.kind) : null, iadc: String(best.iadc ?? ""), bit: String(best.bit ?? ""),
      footage, hours, rop: footage > 0 && hours > 0 ? footage / hours : null,
      dull: best.dull != null && best.dull !== "" ? String(best.dull) : null,
      dullTitle: best.dullTitle != null ? String(best.dullTitle) : null,
      reason: best.reasonPulled != null && best.reasonPulled !== "" ? String(best.reasonPulled) : null,
    });
  }

  let totFootage = 0, totHours = 0, pdc = 0, cone = 0;
  const rops: number[] = [];
  const wells = new Set<string>(), sizes = new Set<string>();
  const bySizeM = new Map<string, { runs: number; footage: number; hours: number }>();
  const byTypeM = new Map<string, { runs: number; footage: number; hours: number }>();
  const reasonM = new Map<string, number>(), dullM = new Map<string, { runs: number; title: string | null }>();
  for (const r of runs) {
    totFootage += r.footage; totHours += r.hours;
    if (r.rop != null) rops.push(r.rop);
    wells.add(r.wellCode); if (r.size !== "—") sizes.add(r.size);
    if (r.kind === "PDC") pdc++; else if (r.kind === "Roller cone") cone++;
    const acc = (m: Map<string, { runs: number; footage: number; hours: number }>, key: string) => {
      const e = m.get(key) ?? { runs: 0, footage: 0, hours: 0 }; e.runs++; e.footage += r.footage; e.hours += r.hours; m.set(key, e);
    };
    acc(bySizeM, r.size); acc(byTypeM, r.type);
    if (r.reason) reasonM.set(r.reason, (reasonM.get(r.reason) ?? 0) + 1);
    if (r.dull) { const e = dullM.get(r.dull) ?? { runs: 0, title: r.dullTitle }; e.runs++; dullM.set(r.dull, e); }
  }
  const roll = (m: Map<string, { runs: number; footage: number; hours: number }>) =>
    [...m.entries()].map(([k, e]) => ({ ...e, key: k, rop: e.footage > 0 && e.hours > 0 ? e.footage / e.hours : null }));
  const bySize = roll(bySizeM).map((e) => ({ size: e.key, runs: e.runs, footage: e.footage, hours: e.hours, rop: e.rop }))
    .sort((a, b) => b.footage - a.footage);
  const byType = roll(byTypeM).map((e) => ({ type: e.key, runs: e.runs, footage: e.footage, hours: e.hours, rop: e.rop }))
    .filter((t) => t.footage > 0).sort((a, b) => b.footage - a.footage);
  const totReason = [...reasonM.values()].reduce((a, b) => a + b, 0) || 1;
  const reasons = [...reasonM.entries()].map(([reason, runs]) => ({ reason, runs, pct: runs / totReason })).sort((a, b) => b.runs - a.runs);
  const totDull = [...dullM.values()].reduce((a, e) => a + e.runs, 0) || 1;
  const dulls = [...dullM.entries()].map(([dull, e]) => ({ dull, runs: e.runs, pct: e.runs / totDull, title: e.title })).sort((a, b) => b.runs - a.runs);

  return {
    runs, rawRows: rows.length,
    totFootage, totHours, fleetRop: totHours > 0 ? totFootage / totHours : null,
    avgRunRop: rops.length ? rops.reduce((a, b) => a + b, 0) / rops.length : null,
    wells: wells.size, sizes: sizes.size, pdc, cone, bySize, byType, reasons, dulls,
  };
}

/** Bit performance dashboard: run-level KPIs, performance by bit size & type,
 *  PDC-vs-roller-cone, reason-pulled and IADC dull-grade frequency. */
function BitSummary({ rows, note }: { rows: ToolRow[]; note?: string }) {
  const st = useMemo(() => bitStats(rows), [rows]);
  if (note) return <div className="p-8 text-center text-sm text-gray-400">{note}</div>;
  if (!st.runs.length) return <div className="p-8 text-center text-sm text-gray-400">No bit records to summarise.</div>;
  const maxSizeF = Math.max(...st.bySize.map((s) => s.footage), 1);
  const maxTypeF = Math.max(...st.byType.map((t) => t.footage), 1);
  const kindKnown = st.pdc + st.cone;
  return (
    <div className="p-3 space-y-5 text-[11px]">
      {/* Headline KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-2">
        <Kpi label="Bit runs" value={st.runs.length.toLocaleString()} sub={`${st.wells} well(s) · ${st.rawRows.toLocaleString()} daily rows`} />
        <Kpi label="Footage" value={`${fmtM(st.totFootage)} m`} />
        <Kpi label="Rotating hrs" value={st.totHours >= 1000 ? `${(st.totHours / 1000).toFixed(1)}k` : n1(st.totHours)} />
        <Kpi label="Fleet ROP" value={st.fleetRop != null ? `${st.fleetRop.toFixed(2)} m/hr` : "—"} sub="footage ÷ hours" tone="blue" />
        <Kpi label="Avg run ROP" value={st.avgRunRop != null ? `${st.avgRunRop.toFixed(2)} m/hr` : "—"} sub="mean of runs" />
        <Kpi label="Bit sizes" value={String(st.sizes)} sub={`${st.byType.length} bit types`} />
        <Kpi label="PDC / cone" value={kindKnown ? `${st.pdc} / ${st.cone}` : "—"} sub={kindKnown ? `${Math.round(100 * st.pdc / kindKnown)}% PDC of graded` : "kind not graded"} />
      </div>

      {/* Performance by bit size */}
      <section>
        <h3 className="font-semibold text-gray-700 mb-1">Performance by bit size <span className="font-normal text-gray-400">— most footage first</span></h3>
        <table className="w-full tabular-nums border-collapse">
          <thead><tr><Th>Bit size</Th><Th r>Runs</Th><Th r>Footage (m)</Th><Th r>Hours</Th><Th r>ROP m/hr</Th><th className="bg-gray-100 border border-gray-200 px-2 py-1 font-medium text-gray-600 text-right w-[30%]">Footage share</th></tr></thead>
          <tbody>
            {st.bySize.map((s, i) => (
              <tr key={s.size} className={i % 2 ? "bg-gray-50/60" : "bg-white"}>
                <td className="border border-gray-200 px-2 py-0.5 text-left font-medium text-gray-800">{s.size}</td>
                <td className="border border-gray-200 px-2 py-0.5 text-right">{s.runs}</td>
                <td className="border border-gray-200 px-2 py-0.5 text-right">{Math.round(s.footage).toLocaleString()}</td>
                <td className="border border-gray-200 px-2 py-0.5 text-right text-gray-500">{s.hours > 0 ? n1(s.hours) : "—"}</td>
                <td className="border border-gray-200 px-2 py-0.5 text-right">{s.rop != null ? s.rop.toFixed(2) : "—"}</td>
                <td className="border border-gray-200 px-2 py-0.5">
                  <div className="flex items-center gap-1.5">
                    <div className="flex-1 h-2.5 bg-gray-100 rounded-sm overflow-hidden"><div className="h-full rounded-sm bg-teal-600" style={{ width: `${100 * s.footage / maxSizeF}%` }} /></div>
                    <span className="w-10 text-right text-gray-600">{(100 * s.footage / (st.totFootage || 1)).toFixed(1)}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Top bit types by footage */}
      {st.byType.length > 0 && (
        <section>
          <h3 className="font-semibold text-gray-700 mb-1">Top bit types <span className="font-normal text-gray-400">— by footage drilled</span></h3>
          <table className="w-full tabular-nums border-collapse">
            <thead><tr><Th>Bit type</Th><Th r>Runs</Th><Th r>Footage (m)</Th><Th r>ROP m/hr</Th><th className="bg-gray-100 border border-gray-200 px-2 py-1 font-medium text-gray-600 text-right w-[34%]">Footage</th></tr></thead>
            <tbody>
              {st.byType.slice(0, 12).map((t, i) => (
                <tr key={t.type} className={i % 2 ? "bg-gray-50/60" : "bg-white"}>
                  <td className="border border-gray-200 px-2 py-0.5 text-left">{t.type}</td>
                  <td className="border border-gray-200 px-2 py-0.5 text-right">{t.runs}</td>
                  <td className="border border-gray-200 px-2 py-0.5 text-right">{Math.round(t.footage).toLocaleString()}</td>
                  <td className="border border-gray-200 px-2 py-0.5 text-right">{t.rop != null ? t.rop.toFixed(2) : "—"}</td>
                  <td className="border border-gray-200 px-2 py-0.5">
                    <div className="h-2.5 bg-gray-100 rounded-sm overflow-hidden"><div className="h-full rounded-sm bg-blue-600" style={{ width: `${100 * t.footage / maxTypeF}%` }} /></div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Reason pulled */}
        {st.reasons.length > 0 && (
          <section>
            <h3 className="font-semibold text-gray-700 mb-1">Reason pulled</h3>
            <table className="w-full tabular-nums border-collapse">
              <thead><tr><Th>Reason</Th><Th r>Runs</Th><Th r>Share</Th></tr></thead>
              <tbody>
                {st.reasons.slice(0, 10).map((rn, i) => (
                  <tr key={rn.reason} className={i % 2 ? "bg-gray-50/60" : "bg-white"}>
                    <td className="border border-gray-200 px-2 py-0.5 text-left">{rn.reason}</td>
                    <td className="border border-gray-200 px-2 py-0.5 text-right">{rn.runs}</td>
                    <td className="border border-gray-200 px-2 py-0.5 text-right text-gray-600">{(100 * rn.pct).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* IADC dull-grade frequency */}
        {st.dulls.length > 0 && (
          <section>
            <h3 className="font-semibold text-gray-700 mb-1">IADC dull grades <span className="font-normal text-gray-400">— most frequent</span></h3>
            <table className="w-full tabular-nums border-collapse">
              <thead><tr><Th>Grade (I-O-D-L-B-G-O-R)</Th><Th r>Runs</Th><Th r>Share</Th></tr></thead>
              <tbody>
                {st.dulls.slice(0, 10).map((d, i) => (
                  <tr key={d.dull} className={i % 2 ? "bg-gray-50/60" : "bg-white"} title={d.title ?? undefined}>
                    <td className={`border border-gray-200 px-2 py-0.5 text-left font-mono ${d.title ? "cursor-help underline decoration-dotted decoration-gray-400" : ""}`}>{d.dull}</td>
                    <td className="border border-gray-200 px-2 py-0.5 text-right">{d.runs}</td>
                    <td className="border border-gray-200 px-2 py-0.5 text-right text-gray-600">{(100 * d.pct).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </div>

      <p className="text-[10px] text-gray-400 leading-snug">
        A “run” is one bit deployment (well + bit no + serial + size). L05 logs footage (BitMeterTotal) and rotating hours (BitHour)
        cumulatively each day, so daily rows are deduped to the deepest snapshot per run before footage/hours/ROP are computed.
        ROP = footage ÷ rotating hours; cost-per-metre needs bit cost + rig rate, which this dataset doesn’t carry.
      </p>
    </div>
  );
}

/** Bit chart router. */
function BitChart({ rows, kind, note }: { rows: ToolRow[]; kind: ChartKind; note?: string }) {
  const st = useMemo(() => bitStats(rows), [rows]);
  if (note) return <div className="p-8 text-center text-sm text-gray-400">{note}</div>;
  if (!st.runs.length) return <div className="p-8 text-center text-sm text-gray-400">No bit runs to chart.</div>;
  if (kind === "sizeFootage") return <BitSizeFootageChart st={st} />;
  if (kind === "kindRop") return <BitSizeRopChart st={st} />;
  if (kind === "dull") return <BitDullChart st={st} />;
  return <BitScatterChart st={st} />;
}

/** Footage-vs-hours bit-run scatter — the classic bit-run comparison. Each point
 *  is a run; colour = bit kind, diagonal iso-ROP lines read off m/hr. */
function BitScatterChart({ st }: { st: BitStats }) {
  const hover = useSvgHover();
  const pts = st.runs.filter((r) => r.footage > 0 && r.hours > 0);
  if (!pts.length) return <div className="p-8 text-center text-sm text-gray-400">No runs have both footage and rotating hours recorded.</div>;
  const maxH = Math.max(...pts.map((p) => p.hours), 1), maxF = Math.max(...pts.map((p) => p.footage), 1);
  const PAD = { l: 56, r: 16, t: 14, b: 44 }, plotW = 600, plotH = 380;
  const W = PAD.l + plotW + PAD.r, H = PAD.t + plotH + PAD.b;
  const xOf = (h: number) => PAD.l + (h / maxH) * plotW;
  const yOf = (f: number) => PAD.t + plotH - (f / maxF) * plotH;
  const xticks = niceTicks(0, maxH, 6), yticks = niceTicks(0, maxF, 6);
  const colKind = (k: string | null) => (k === "PDC" ? "#7c3aed" : k === "Roller cone" ? "#0d9488" : "#94a3b8");
  // Iso-ROP guide lines (m/hr) that stay inside the plot box.
  const isoRops = [1, 2, 4, 8].filter((r) => (r * maxH) > maxF * 0.04);
  return (
    <div className="p-3 relative">
      <div className="text-[11px] text-gray-500 mb-2"><b>Bit-run comparison</b> — footage drilled vs rotating hours, one point per run. Steeper (toward the top-left) = faster. Dashed lines are constant <b>ROP</b> (m/hr).</div>
      <div className="overflow-x-auto">
        <svg width={W} height={H} className="block">
          {xticks.map((t) => <g key={`x${t}`}><line x1={xOf(t)} x2={xOf(t)} y1={PAD.t} y2={PAD.t + plotH} stroke="#f1f5f9" /><text x={xOf(t)} y={PAD.t + plotH + 14} textAnchor="middle" fontSize={9} fill="#94a3b8">{Math.round(t)}</text></g>)}
          {yticks.map((t) => <g key={`y${t}`}><line x1={PAD.l} x2={PAD.l + plotW} y1={yOf(t)} y2={yOf(t)} stroke="#f1f5f9" /><text x={PAD.l - 5} y={yOf(t) + 3} textAnchor="end" fontSize={9} fill="#94a3b8">{Math.round(t)}</text></g>)}
          {isoRops.map((rop) => {
            // line footage = rop × hours, clipped to the plot box.
            const hAtTop = maxF / rop;
            const x2 = hAtTop <= maxH ? xOf(hAtTop) : xOf(maxH);
            const y2 = hAtTop <= maxH ? yOf(maxF) : yOf(rop * maxH);
            return <g key={rop}><line x1={xOf(0)} y1={yOf(0)} x2={x2} y2={y2} stroke="#cbd5e1" strokeDasharray="4 3" /><text x={x2 - 2} y={y2 + 11} textAnchor="end" fontSize={9} fill="#64748b">{rop} m/hr</text></g>;
          })}
          <rect x={PAD.l} y={PAD.t} width={plotW} height={plotH} fill="none" stroke="#cbd5e1" />
          <text x={PAD.l + plotW / 2} y={H - 4} textAnchor="middle" fontSize={10} fill="#475569" fontWeight={600}>Rotating hours</text>
          <text transform={`translate(12 ${PAD.t + plotH / 2}) rotate(-90)`} textAnchor="middle" fontSize={10} fill="#475569" fontWeight={600}>Footage drilled (m)</text>
          {pts.map((p, i) => {
            const html = `<b>${p.wellCode}</b> · ${p.size}${p.type !== "—" ? ` · ${p.type}` : ""}<br/>${Math.round(p.footage)} m in ${n1(p.hours)} h<br/>ROP ${p.rop!.toFixed(2)} m/hr${p.kind ? `<br/>${p.kind}` : ""}`;
            return <circle key={i} cx={xOf(p.hours)} cy={yOf(p.footage)} r={3} fill={colKind(p.kind)} fillOpacity={0.7} stroke="#fff" strokeWidth={0.5} onMouseEnter={hover.enter(html)} onMouseMove={hover.enter(html)} onMouseLeave={hover.leave} />;
          })}
        </svg>
      </div>
      <div className="flex gap-4 mt-2 text-[11px] text-gray-600">
        <span className="inline-flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full" style={{ background: "#7c3aed" }} />PDC</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full" style={{ background: "#0d9488" }} />Roller cone</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full" style={{ background: "#94a3b8" }} />Not graded</span>
      </div>
      {hover.node}
    </div>
  );
}

/** Footage by bit size — total metres drilled per size, widest → narrowest. */
function BitSizeFootageChart({ st }: { st: BitStats }) {
  const hover = useSvgHover();
  const secs = useMemo(() => st.bySize.filter((s) => s.footage > 0).slice().sort((a, b) => sizeVal(b.size) - sizeVal(a.size)), [st]);
  if (!secs.length) return <div className="p-8 text-center text-sm text-gray-400">No footage by bit size.</div>;
  const max = Math.max(...secs.map((s) => s.footage), 1);
  const PAD = { l: 56, r: 16, t: 16, b: 48 }, barW = 44, gap = 28;
  const plotW = secs.length * (barW + gap) + gap, plotH = 320;
  const W = PAD.l + plotW + PAD.r, H = PAD.t + plotH + PAD.b;
  const yOf = (f: number) => PAD.t + plotH - (f / max) * plotH;
  const xOf = (i: number) => PAD.l + gap + i * (barW + gap);
  const ticks = niceTicks(0, max, 4);
  return (
    <div className="p-3 relative">
      <div className="text-[11px] text-gray-500 mb-2"><b>Footage by bit size</b> — total metres drilled per size (widest → narrowest). The run count sits above each bar.</div>
      <div className="overflow-x-auto">
        <svg width={W} height={H} className="block">
          {ticks.map((t) => <g key={t}><line x1={PAD.l} x2={PAD.l + plotW} y1={yOf(t)} y2={yOf(t)} stroke="#eef2f7" /><text x={PAD.l - 4} y={yOf(t) + 3} textAnchor="end" fontSize={9} fill="#94a3b8">{t >= 1000 ? `${(t / 1000).toFixed(0)}k` : Math.round(t)}</text></g>)}
          {secs.map((s, i) => {
            const x = xOf(i), h = (s.footage / max) * plotH, y = PAD.t + plotH - h;
            const html = `<b>${s.size}</b><br/>${Math.round(s.footage).toLocaleString()} m · ${s.runs} runs${s.rop != null ? `<br/>ROP ${s.rop.toFixed(2)} m/hr` : ""}`;
            return (
              <g key={s.size}>
                <rect x={x} y={y} width={barW} height={h} fill={colorOf(i)} rx={2} onMouseEnter={hover.enter(html)} onMouseMove={hover.enter(html)} onMouseLeave={hover.leave} />
                <text x={x + barW / 2} y={y - 3} textAnchor="middle" fontSize={9} fill="#475569">{s.runs}</text>
                <text x={x + barW / 2} y={PAD.t + plotH + 14} textAnchor="middle" fontSize={9} fill="#475569">{s.size}</text>
              </g>
            );
          })}
          <line x1={PAD.l} x2={PAD.l + plotW} y1={PAD.t + plotH} y2={PAD.t + plotH} stroke="#cbd5e1" />
          <text transform={`translate(12 ${PAD.t + plotH / 2}) rotate(-90)`} textAnchor="middle" fontSize={10} fill="#475569" fontWeight={600}>Footage (m)</text>
        </svg>
      </div>
      {hover.node}
    </div>
  );
}

/** ROP by bit size — fleet ROP (footage ÷ hours) per size, widest → narrowest. */
function BitSizeRopChart({ st }: { st: BitStats }) {
  const hover = useSvgHover();
  const secs = useMemo(() => st.bySize.filter((s) => s.rop != null).slice().sort((a, b) => sizeVal(b.size) - sizeVal(a.size)), [st]);
  if (!secs.length) return <div className="p-8 text-center text-sm text-gray-400">No size has both footage and rotating hours to compute ROP.</div>;
  const max = Math.max(...secs.map((s) => s.rop!), 1);
  const PAD = { l: 56, r: 16, t: 16, b: 48 }, barW = 44, gap = 28;
  const plotW = secs.length * (barW + gap) + gap, plotH = 320;
  const W = PAD.l + plotW + PAD.r, H = PAD.t + plotH + PAD.b;
  const yOf = (v: number) => PAD.t + plotH - (v / max) * plotH;
  const xOf = (i: number) => PAD.l + gap + i * (barW + gap);
  const ticks = niceTicks(0, max, 4);
  return (
    <div className="p-3 relative">
      <div className="text-[11px] text-gray-500 mb-2"><b>ROP by bit size</b> — fleet rate of penetration (total footage ÷ total rotating hours) per size, widest → narrowest.</div>
      <div className="overflow-x-auto">
        <svg width={W} height={H} className="block">
          {ticks.map((t) => <g key={t}><line x1={PAD.l} x2={PAD.l + plotW} y1={yOf(t)} y2={yOf(t)} stroke="#eef2f7" /><text x={PAD.l - 4} y={yOf(t) + 3} textAnchor="end" fontSize={9} fill="#94a3b8">{t.toFixed(t < 10 ? 1 : 0)}</text></g>)}
          {secs.map((s, i) => {
            const x = xOf(i), h = (s.rop! / max) * plotH, y = PAD.t + plotH - h;
            const html = `<b>${s.size}</b><br/>ROP ${s.rop!.toFixed(2)} m/hr<br/>${Math.round(s.footage).toLocaleString()} m · ${n1(s.hours)} h`;
            return (
              <g key={s.size}>
                <rect x={x} y={y} width={barW} height={h} fill="#1e40af" rx={2} onMouseEnter={hover.enter(html)} onMouseMove={hover.enter(html)} onMouseLeave={hover.leave} />
                <text x={x + barW / 2} y={y - 3} textAnchor="middle" fontSize={9} fill="#475569">{s.rop!.toFixed(1)}</text>
                <text x={x + barW / 2} y={PAD.t + plotH + 14} textAnchor="middle" fontSize={9} fill="#475569">{s.size}</text>
              </g>
            );
          })}
          <line x1={PAD.l} x2={PAD.l + plotW} y1={PAD.t + plotH} y2={PAD.t + plotH} stroke="#cbd5e1" />
          <text transform={`translate(12 ${PAD.t + plotH / 2}) rotate(-90)`} textAnchor="middle" fontSize={10} fill="#475569" fontWeight={600}>ROP (m/hr)</text>
        </svg>
      </div>
      {hover.node}
    </div>
  );
}

/** IADC dull-grade frequency — the most common pull conditions, runs per grade. */
function BitDullChart({ st }: { st: BitStats }) {
  const hover = useSvgHover();
  const cats = st.dulls.slice(0, 16);
  if (!cats.length) return <div className="p-8 text-center text-sm text-gray-400">No IADC dull grades recorded for this selection.</div>;
  const max = Math.max(...cats.map((c) => c.runs), 1);
  const PAD = { l: 168, r: 44, t: 8, b: 24 }, rowH = 22, plotW = 380;
  const W = PAD.l + plotW + PAD.r, H = PAD.t + cats.length * rowH + PAD.b;
  const ticks = niceTicks(0, max, 5);
  return (
    <div className="p-3 relative">
      <div className="text-[11px] text-gray-500 mb-2"><b>IADC dull-grade frequency</b> — runs per 8-position dull code (I-O-D-L-B-G-O-R), most common first. Hover for the decoded condition.</div>
      <svg width={W} height={H} className="block">
        {ticks.map((t) => <g key={t}><line x1={PAD.l + (t / max) * plotW} x2={PAD.l + (t / max) * plotW} y1={PAD.t} y2={PAD.t + cats.length * rowH} stroke="#eef2f7" /><text x={PAD.l + (t / max) * plotW} y={PAD.t + cats.length * rowH + 16} textAnchor="middle" fontSize={9} fill="#94a3b8">{Math.round(t)}</text></g>)}
        {cats.map((c, i) => {
          const y = PAD.t + i * rowH + 3, bh = rowH - 8, bw = (c.runs / max) * plotW;
          const html = `<b>${c.dull}</b>${c.title ? `<br/>${c.title}` : ""}<br/>${c.runs} runs · ${(100 * c.pct).toFixed(1)}%`;
          return (
            <g key={c.dull}>
              <text x={PAD.l - 6} y={y + bh / 2 + 3} textAnchor="end" fontSize={9} fill="#334155" fontFamily="monospace">{c.dull}</text>
              <rect x={PAD.l} y={y} width={Math.max(1, bw)} height={bh} fill="#dc2626" rx={2} onMouseEnter={hover.enter(html)} onMouseMove={hover.enter(html)} onMouseLeave={hover.leave} />
              <text x={PAD.l + bw + 5} y={y + bh / 2 + 3} fontSize={9} fill="#475569">{c.runs}</text>
            </g>
          );
        })}
      </svg>
      {hover.node}
    </div>
  );
}

// ── Generic (non-bit) tool usage ─────────────────────────────────────────────

/** Pick the most useful "type" and "size" columns for a non-bit tool from its
 *  spec columns (e.g. jarType/size, type/size, casing, no/size/grade). */
function genericKeys(cols: ToolColumn[]): { typeKey?: string; sizeKey?: string; hasHours: boolean } {
  const keys = new Set(cols.map((c) => c.key));
  const typeKey = ["type", "jarType", "mwdType", "casing", "liner", "grade", "assemblyNo"].find((k) => keys.has(k));
  const sizeKey = ["size", "depth", "from", "length"].find((k) => keys.has(k));
  return { typeKey, sizeKey, hasHours: keys.has("hours") };
}

interface GenStats {
  records: number; wells: number; totHours: number | null;
  byType: { key: string; records: number; hours: number; wells: number }[] | null;
  bySize: { key: string; records: number; hours: number; wells: number }[] | null;
  typeLabel: string; sizeLabel: string; hasHours: boolean;
}
function genStats(rows: ToolRow[], cols: ToolColumn[]): GenStats {
  const { typeKey, sizeKey, hasHours } = genericKeys(cols);
  const wells = new Set<string>();
  let totHours = 0, anyHours = false;
  const agg = (key?: string) => {
    if (!key) return null;
    const m = new Map<string, { records: number; hours: number; wells: Set<string> }>();
    for (const r of rows) {
      const v = r[key]; if (v == null || v === "") continue;
      const k = String(v);
      const e = m.get(k) ?? { records: 0, hours: 0, wells: new Set<string>() };
      e.records++; e.wells.add(r.wellCode);
      if (num(r.hours)) e.hours += r.hours;
      m.set(k, e);
    }
    return [...m.entries()].map(([key, e]) => ({ key, records: e.records, hours: e.hours, wells: e.wells.size }))
      .sort((a, b) => b.hours - a.hours || b.records - a.records);
  };
  for (const r of rows) { wells.add(r.wellCode); if (num(r.hours)) { totHours += r.hours; anyHours = true; } }
  const labelOf = (k?: string) => cols.find((c) => c.key === k)?.label ?? k ?? "—";
  return {
    records: rows.length, wells: wells.size, totHours: anyHours ? totHours : null,
    byType: agg(typeKey), bySize: agg(sizeKey),
    typeLabel: labelOf(typeKey), sizeLabel: labelOf(sizeKey), hasHours,
  };
}

/** Generic usage dashboard for non-bit tools: record / well / hours KPIs and a
 *  usage table broken out by the tool's "type" (and "size") columns. */
function ToolSummary({ rows, cols, label, note }: { rows: ToolRow[]; cols: ToolColumn[]; label: string; note?: string }) {
  const st = useMemo(() => genStats(rows, cols), [rows, cols]);
  if (note) return <div className="p-8 text-center text-sm text-gray-400">{note}</div>;
  if (!st.records) return <div className="p-8 text-center text-sm text-gray-400">No {label} records to summarise.</div>;
  const UsageTable = ({ title, dimLabel, data }: { title: string; dimLabel: string; data: GenStats["byType"] }) => {
    if (!data || !data.length) return null;
    const metric = st.hasHours ? "hours" : "records";
    const maxV = Math.max(...data.map((d) => d[metric] as number), 1);
    return (
      <section>
        <h3 className="font-semibold text-gray-700 mb-1">{title}</h3>
        <table className="w-full tabular-nums border-collapse">
          <thead><tr><Th>{dimLabel}</Th><Th r>Records</Th><Th r>Wells</Th>{st.hasHours && <Th r>Hours</Th>}<th className="bg-gray-100 border border-gray-200 px-2 py-1 font-medium text-gray-600 text-right w-[34%]">{st.hasHours ? "Hours" : "Records"}</th></tr></thead>
          <tbody>
            {data.slice(0, 18).map((d, i) => (
              <tr key={d.key} className={i % 2 ? "bg-gray-50/60" : "bg-white"}>
                <td className="border border-gray-200 px-2 py-0.5 text-left max-w-[260px] truncate" title={d.key}>{d.key}</td>
                <td className="border border-gray-200 px-2 py-0.5 text-right">{d.records.toLocaleString()}</td>
                <td className="border border-gray-200 px-2 py-0.5 text-right text-gray-500">{d.wells}</td>
                {st.hasHours && <td className="border border-gray-200 px-2 py-0.5 text-right">{d.hours > 0 ? n1(d.hours) : "—"}</td>}
                <td className="border border-gray-200 px-2 py-0.5">
                  <div className="h-2.5 bg-gray-100 rounded-sm overflow-hidden"><div className="h-full rounded-sm bg-teal-600" style={{ width: `${100 * (d[metric] as number) / maxV}%` }} /></div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    );
  };
  return (
    <div className="p-3 space-y-5 text-[11px]">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Kpi label="Records" value={st.records.toLocaleString()} />
        <Kpi label="Wells" value={String(st.wells)} />
        {st.byType && <Kpi label={st.typeLabel} value={String(st.byType.length)} sub="distinct" />}
        {st.totHours != null ? <Kpi label="Total hours" value={st.totHours >= 1000 ? `${(st.totHours / 1000).toFixed(1)}k` : n1(st.totHours)} tone="blue" /> : (st.bySize && <Kpi label={st.sizeLabel} value={String(st.bySize.length)} sub="distinct" />)}
      </div>
      <UsageTable title={`Usage by ${st.typeLabel.toLowerCase()}`} dimLabel={st.typeLabel} data={st.byType} />
      {st.sizeLabel.toLowerCase().includes("size") && <UsageTable title={`Usage by ${st.sizeLabel.toLowerCase()}`} dimLabel={st.sizeLabel} data={st.bySize} />}
      <p className="text-[10px] text-gray-400 leading-snug">
        Counts are raw {label} records (often one per rig-day). {st.hasHours ? "Hours are summed across the loaded records." : "This tool table carries no run hours."}
      </p>
    </div>
  );
}

/** Generic usage chart for non-bit tools — records / hours by type or size. */
function ToolUsageChart({ rows, cols, kind, note }: { rows: ToolRow[]; cols: ToolColumn[]; kind: ChartKind; note?: string }) {
  const hover = useSvgHover();
  const st = useMemo(() => genStats(rows, cols), [rows, cols]);
  if (note) return <div className="p-8 text-center text-sm text-gray-400">{note}</div>;
  const data = (kind === "usageSize" ? st.bySize : st.byType);
  const dimLabel = kind === "usageSize" ? st.sizeLabel : st.typeLabel;
  if (!data || !data.length) return <div className="p-8 text-center text-sm text-gray-400">Nothing to chart for {dimLabel.toLowerCase()}.</div>;
  const metric = st.hasHours ? "hours" : "records";
  const cats = data.filter((d) => (d[metric] as number) > 0).slice(0, 20);
  if (!cats.length) return <div className="p-8 text-center text-sm text-gray-400">No {metric} to chart.</div>;
  const max = Math.max(...cats.map((c) => c[metric] as number), 1);
  const PAD = { l: 180, r: 48, t: 8, b: 24 }, rowH = 22, plotW = 360;
  const W = PAD.l + plotW + PAD.r, H = PAD.t + cats.length * rowH + PAD.b;
  const ticks = niceTicks(0, max, 5);
  const unit = st.hasHours ? "hours" : "records";
  return (
    <div className="p-3 relative">
      <div className="text-[11px] text-gray-500 mb-2"><b>{st.hasHours ? "Hours" : "Records"} by {dimLabel.toLowerCase()}</b> — largest first.</div>
      <svg width={W} height={H} className="block">
        {ticks.map((t) => <g key={t}><line x1={PAD.l + (t / max) * plotW} x2={PAD.l + (t / max) * plotW} y1={PAD.t} y2={PAD.t + cats.length * rowH} stroke="#eef2f7" /><text x={PAD.l + (t / max) * plotW} y={PAD.t + cats.length * rowH + 16} textAnchor="middle" fontSize={9} fill="#94a3b8">{t >= 1000 ? `${(t / 1000).toFixed(0)}k` : Math.round(t)}</text></g>)}
        {cats.map((c, i) => {
          const y = PAD.t + i * rowH + 3, bh = rowH - 8, v = c[metric] as number, bw = (v / max) * plotW;
          const lbl = c.key.length > 26 ? c.key.slice(0, 25) + "…" : c.key;
          const html = `<b>${c.key}</b><br/>${c.records.toLocaleString()} records · ${c.wells} wells${st.hasHours ? `<br/>${n1(c.hours)} h` : ""}`;
          return (
            <g key={c.key}>
              <text x={PAD.l - 6} y={y + bh / 2 + 3} textAnchor="end" fontSize={9} fill="#334155">{lbl}</text>
              <rect x={PAD.l} y={y} width={Math.max(1, bw)} height={bh} fill={colorOf(i)} rx={2} onMouseEnter={hover.enter(html)} onMouseMove={hover.enter(html)} onMouseLeave={hover.leave} />
              <text x={PAD.l + bw + 5} y={y + bh / 2 + 3} fontSize={9} fill="#475569">{st.hasHours ? n1(v) : v}</text>
            </g>
          );
        })}
      </svg>
      <div className="text-[10px] text-gray-400 mt-1">Bar length = {unit}.</div>
      {hover.node}
    </div>
  );
}
