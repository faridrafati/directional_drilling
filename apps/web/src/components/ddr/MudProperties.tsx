/**
 * Multi-well Mud Properties browser, driven by the same facets as the Reports &
 * Search / Formation & Lithology tabs (fields / wells / bit sizes / mud types /
 * rigs). A faceted table of every N01 mud interval for the selected wells joined
 * with that day's N05 losses/gains balance — the multi-well version of the
 * Delphi mud report (DDR-Delphi/Unit1.pas:4433).
 *
 * The toggles do NOT auto-run; only the explicit "Show" button posts. Wells are
 * keyed BY CODE (names aren't unique — e.g. DA-008 & DA-009 are both
 * "DANAN-008"), with same-named wells disambiguated by appending (code).
 *
 * Views over the already-loaded rows (no extra fetch):
 *   • SUMMARY — the DEFAULT manager/mud-engineer dashboard: headline KPIs,
 *     per-property min/avg/max stats with out-of-range flags, a per-hole-section
 *     mud-weight & rheology table, plus mud-weight-vs-depth and PV/YP trend
 *     charts. All computed client-side from the loaded rows.
 *   • TABLE — the faceted grid; a row opens that day's full daily report (the
 *     same overlay Reports & Search uses) when its report serial resolved.
 *   • GRAPH — selected mud properties plotted with an X-axis (Depth | Date)
 *     picker, one small chart per well, over all loaded rows.
 *   • PROGRAM — the next-well mud-program design view.
 */
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client.js";
import { MultiSelect, type Item } from "./DdrRemarksSearch.js";
import { useFacetOptions } from "./useFacetOptions.js";
import { MudLogGraph, type MudTrack } from "./MudLogGraph.js";
import type { GraphWell } from "./LithologyGraph.js";
import { MudProgram, type ProgramFilters } from "./MudProgram.js";

interface SearchOptions {
  fields: string[]; wells: { code: string; name: string; field: string | null }[];
  holeSizes: string[]; mudTypes: string[]; rigs: string[];
}
export interface MudRow {
  wellCode: string; date: string | null; serialNo: number | null;
  from: number | null; to: number | null; bitSize: string | null; mudType: string | null;
  minWeight: number | null; maxWeight: number | null; visc: number | null;
  pv: number | null; yp: number | null; fan600: number | null; fan300: number | null;
  initialGel: number | null; gel10: number | null; ph: number | null; alk: number | null;
  waterLoss: number | null; hpht: number | null; airFoam: number | null;
  oilPercent: number | null; oilWater: number | null; stability: number | null; kcl: number | null;
  solids: number | null; salinity: number | null; calcium: number | null;
  mbt: number | null; pf: number | null; mf: number | null;
  temp: number | null; repTime: number | null; mudChangeDepth: number | null;
  totalLosses: number | null; lossesAtUnit: number | null;
  minGradLoss: number | null; maxGradLoss: number | null;
  totalGains: number | null; minGain: number | null; maxGain: number | null;
  remarks: string | null;
}
interface MudData { rows: MudRow[]; truncated?: boolean; total?: number; note?: string }

const fmtNum = (v: unknown): string =>
  v == null || v === "" ? "" : typeof v === "number" ? (Number.isInteger(v) ? String(v) : v.toFixed(1)) : String(v);

// Canonical labels reuse the names from the daily report's 'mud' mapping so they
// match the rest of the app. The N05 losses/gains columns are appended at the end.
const COLS: { key: keyof MudRow; label: string }[] = [
  { key: "from", label: "From (m)" }, { key: "to", label: "To (m)" },
  { key: "bitSize", label: "Bit size" }, { key: "mudType", label: "Mud type" },
  { key: "minWeight", label: "Min wt (pcf)" }, { key: "maxWeight", label: "Max wt (pcf)" },
  { key: "visc", label: "Visc (s)" },
  { key: "pv", label: "PV" }, { key: "yp", label: "YP" },
  { key: "fan600", label: "Fan 600" }, { key: "fan300", label: "Fan 300" },
  { key: "initialGel", label: "Initial gel" }, { key: "gel10", label: "10min gel" },
  { key: "ph", label: "pH" }, { key: "alk", label: "ALK" },
  { key: "waterLoss", label: "Water loss" }, { key: "hpht", label: "HPHT" },
  { key: "airFoam", label: "Air/Foam" },
  { key: "oilPercent", label: "Oil %" }, { key: "oilWater", label: "O/W" },
  { key: "stability", label: "E-stability" }, { key: "kcl", label: "KCl" },
  { key: "solids", label: "Solids %" }, { key: "salinity", label: "Salinity" }, { key: "calcium", label: "Ca" },
  { key: "mbt", label: "MBT" }, { key: "pf", label: "PF" }, { key: "mf", label: "MF" },
  { key: "temp", label: "Temp" }, { key: "repTime", label: "Rep time" }, { key: "mudChangeDepth", label: "Mud chg depth" },
  { key: "totalLosses", label: "Total losses" }, { key: "lossesAtUnit", label: "Losses@unit" },
  { key: "minGradLoss", label: "Min grad loss" }, { key: "maxGradLoss", label: "Max grad loss" },
  { key: "totalGains", label: "Total gains" }, { key: "minGain", label: "Min gain" }, { key: "maxGain", label: "Max gain" },
  { key: "remarks", label: "Remarks" },
];

// Plottable series = every numeric column: all of COLS except the depth axis
// (from/to) and the two text columns. Derived from COLS so any column added
// there is automatically selectable in the graph. Each gets a palette colour.
const NON_SERIES = new Set<keyof MudRow>(["from", "to", "bitSize", "mudType", "remarks", "repTime", "mudChangeDepth"]);
const PALETTE = [
  "#1e40af", "#0d9488", "#7c3aed", "#db2777", "#d97706", "#65a30d", "#dc2626", "#0891b2",
  "#9333ea", "#ea580c", "#16a34a", "#e11d48", "#2563eb", "#ca8a04", "#15803d", "#be123c",
  "#4f46e5", "#0e7490", "#a21caf", "#b45309", "#047857", "#9f1239", "#1d4ed8", "#a16207",
  "#166534", "#831843", "#3730a3", "#155e75", "#701a75", "#92400e", "#065f46", "#881337",
  "#1e3a8a", "#713f12",
];
const SERIES: { key: keyof MudRow; label: string; color: string }[] = COLS
  .filter((c) => !NON_SERIES.has(c.key))
  .map((c, i) => ({ key: c.key, label: c.label, color: PALETTE[i % PALETTE.length] }));
const DEFAULT_SERIES = new Set<keyof MudRow>(["maxWeight", "visc", "pv", "yp"]);

// Related properties that can optionally share one chart (default: separate).
const GROUPS: { id: string; label: string; keys: (keyof MudRow)[] }[] = [
  { id: "wt", label: "Min / Max wt", keys: ["minWeight", "maxWeight"] },
  { id: "pvyp", label: "PV / YP", keys: ["pv", "yp"] },
  { id: "fan", label: "Fan 600 / 300", keys: ["fan600", "fan300"] },
  { id: "gel", label: "Initial / 10min gel", keys: ["initialGel", "gel10"] },
  { id: "oil", label: "Oil % / O·W", keys: ["oilPercent", "oilWater"] },
  { id: "loss", label: "Losses (total / unit / grad)", keys: ["totalLosses", "lossesAtUnit", "minGradLoss"] },
];

/** Turn the selected series into chart tracks: one per property, except groups
 *  toggled "combined" collapse their selected members into a single track. */
function buildTracks(selected: { key: keyof MudRow; label: string; color: string }[], merged: Set<string>): MudTrack[] {
  const keyToGroup = new Map<keyof MudRow, (typeof GROUPS)[number]>();
  for (const g of GROUPS) for (const k of g.keys) keyToGroup.set(k, g);
  const sel = new Set(selected.map((s) => s.key));
  const out: MudTrack[] = [];
  const done = new Set<string>();
  for (const sd of selected) {
    const g = keyToGroup.get(sd.key);
    // Only merge a group when ALL its members are selected (matches the toggle).
    if (g && merged.has(g.id) && g.keys.every((k) => sel.has(k))) {
      if (done.has(g.id)) continue;
      done.add(g.id);
      const keys = selected.filter((x) => g.keys.includes(x.key));
      out.push({ id: g.id, label: keys.map((k) => k.label).join(" / "), keys });
    } else {
      out.push({ id: String(sd.key), label: sd.label, keys: [sd] });
    }
  }
  return out;
}

export function MudProperties({ onOpenReport }: { onOpenReport?: (wellCode: string, serialNo: number, date: string | null) => void } = {}) {
  const [selFields, setSelFields] = useState<string[]>([]);
  const [selWells, setSelWells] = useState<string[]>([]);
  const [selHole, setSelHole] = useState<string[]>([]);
  const [selMud, setSelMud] = useState<string[]>([]);
  const [data, setData] = useState<MudData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The facet set that produced `data`, snapshotted on Show — drives the Program
  // (next-well design) view, which fetches /ddr/mud-program itself.
  const [programFilters, setProgramFilters] = useState<ProgramFilters | null>(null);

  // Local view state — never triggers a network fetch. Summary is the default
  // (KPI dashboard); the original detail views sit behind the toggle.
  const [view, setView] = useState<"summary" | "table" | "graph" | "program">("summary");
  const [xAxis, setXAxis] = useState<"depth" | "date">("depth");
  const [series, setSeries] = useState<Set<keyof MudRow>>(() => new Set(DEFAULT_SERIES));
  const [merged, setMerged] = useState<Set<string>>(new Set());

  const optsQ = useQuery({ queryKey: ["ddr", "search-options"], queryFn: () => api.get<SearchOptions>("/ddr/search-options") });
  const o = optsQ.data;
  const facet = useFacetOptions(selFields, selWells, o);

  // One entry PER WELL CODE (codes are unique; names are not — e.g. DA-008 and
  // DA-009 are both "DANAN-008"). Selecting by code keeps duplicates distinct.
  // Same-named wells get the code appended so they're tellable apart.
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
  // Hide columns / graph series that are entirely empty for the current rows.
  const usedCols = useMemo(() => COLS.filter((c) => rows.some((r) => r[c.key] != null && r[c.key] !== "")), [rows]);
  const usedSeries = useMemo(() => SERIES.filter((sd) => rows.some((r) => typeof r[sd.key] === "number")), [rows]);
  const wellCodes = useMemo(() => [...new Set(rows.map((r) => r.wellCode))], [rows]);
  // Code → display name for the loaded wells. Names aren't unique, so any name
  // shared by >1 loaded well gets its code appended (the same rule the well
  // picker uses) — lets the graph label wells by NAME instead of by code.
  const wellNames = useMemo(() => {
    const byCode = new Map((o?.wells ?? []).map((w) => [w.code, w.name || w.code] as const));
    const nameCount = new Map<string, number>();
    for (const code of wellCodes) { const n = byCode.get(code) ?? code; nameCount.set(n, (nameCount.get(n) ?? 0) + 1); }
    const m = new Map<string, string>();
    for (const code of wellCodes) { const n = byCode.get(code) ?? code; m.set(code, (nameCount.get(n) ?? 0) > 1 ? `${n} (${code})` : n); }
    return m;
  }, [o?.wells, wellCodes]);
  const tracks = useMemo(() => buildTracks(usedSeries.filter((sd) => series.has(sd.key)), merged), [usedSeries, series, merged]);
  // A group's "combine" toggle shows only once ALL its members are checked (and have data).
  const readyGroups = useMemo(() => GROUPS.filter((g) => g.keys.every((k) => usedSeries.some((s) => s.key === k) && series.has(k))), [usedSeries, series]);
  // Lithology column for the well-log graph when exactly one well is shown (depth mode).
  const singleWell = view === "graph" && wellCodes.length === 1 ? wellCodes[0] : null;
  const lithoQ = useQuery({
    queryKey: ["ddr", "litho-graph", singleWell],
    queryFn: () => api.post<{ wells: GraphWell[] }>("/ddr/lithology-graph", { wells: [singleWell] }),
    enabled: !!singleWell,
  });
  const litho = singleWell ? lithoQ.data?.wells?.[0] ?? null : null;

  async function run() {
    setLoading(true);
    setError(null);
    try {
      // selWells already holds unique well codes (the picker is keyed by code).
      const body = { fields: selFields, wells: selWells, holeSizes: selHole, mudTypes: selMud };
      const d = await api.post<MudData>("/ddr/mud-properties", body);
      setData(d);
      setProgramFilters(body);
    } catch (e) { setError(String(e)); } finally { setLoading(false); }
  }
  function clearAll() {
    setSelFields([]); setSelWells([]); setSelHole([]); setSelMud([]);
    setData(null); setProgramFilters(null);
  }

  const toggleSeries = (key: keyof MudRow) =>
    setSeries((prev) => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  const toggleMerge = (id: string) =>
    setMerged((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  return (
    <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4 overflow-hidden">
      <div className="flex flex-col min-h-0 bg-white border border-gray-200 rounded p-3 overflow-y-auto">
        <MultiSelect title="Fields" items={(o?.fields ?? []).map((f) => ({ value: f, label: f }))} selected={selFields} onChange={setSelFields} />
        <MultiSelect title={selFields.length ? `Wells · in ${selFields.length} field(s)` : "Wells"} items={wellItems} selected={selWells} onChange={setSelWells} />
        <MultiSelect title="Bit sizes" items={facet.holeSizes.map((h) => ({ value: h, label: h }))} selected={selHole} onChange={setSelHole} />
        <MultiSelect title="Mud types" items={facet.mudTypes.map((m) => ({ value: m, label: m }))} selected={selMud} onChange={setSelMud} />
        <div className="flex gap-2 pt-3">
          <button onClick={() => run()} disabled={loading} className="h-9 px-4 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300">{loading ? "Loading…" : "Show"}</button>
          <button onClick={clearAll} className="h-9 px-3 text-sm rounded border border-gray-300 hover:bg-gray-50">Clear</button>
        </div>
        {error && <div className="text-xs text-red-600 pt-2">{error}</div>}

        {/* Graph controls only matter in the Graph view — keep them with the
            facets so the result panel stays a clean canvas. */}
        {view === "graph" && data && rows.length > 0 && (
          <div className="pt-4 mt-3 border-t border-gray-100 space-y-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-600 mb-1">X-axis</div>
              <div className="inline-flex rounded border border-gray-300 overflow-hidden">
                {(["depth", "date"] as const).map((x) => (
                  <button key={x} onClick={() => setXAxis(x)} className={`px-2.5 h-7 text-xs capitalize ${xAxis === x ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>{x}</button>
                ))}
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-600">Properties</div>
                <div className="flex gap-2">
                  <button onClick={() => setSeries(new Set(usedSeries.map((s) => s.key)))} className="text-[10px] text-blue-600 hover:underline">All</button>
                  <button onClick={() => setSeries(new Set())} className="text-[10px] text-blue-600 hover:underline">None</button>
                </div>
              </div>
              <div className="space-y-0.5 max-h-72 overflow-y-auto pr-1">
                {usedSeries.map((sd) => (
                  <label key={sd.key} className="flex items-center gap-1.5 text-[11px] text-gray-700 cursor-pointer">
                    <input type="checkbox" checked={series.has(sd.key)} onChange={() => toggleSeries(sd.key)} className="rounded border-gray-300" />
                    <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: sd.color }} />
                    {sd.label}
                  </label>
                ))}
              </div>
            </div>
            {readyGroups.length > 0 && (
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-600 mb-1">Combine on one chart</div>
                <div className="space-y-0.5">
                  {readyGroups.map((g) => (
                    <label key={g.id} className="flex items-center gap-1.5 text-[11px] text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={merged.has(g.id)} onChange={() => toggleMerge(g.id)} className="rounded border-gray-300" />
                      {g.label}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded flex flex-col min-h-0 overflow-hidden">
        <div className="px-3 py-2 border-b border-gray-100 shrink-0 flex items-center justify-between gap-2">
          <span className="text-sm text-gray-600 min-w-0 truncate">
            {data
              ? (data.note ? data.note : <>Mud properties · <b>{data.rows.length}</b> intervals{data.truncated ? ` (capped — ${data.total})` : ""}</>)
              : "Pick a field / well, then Show."}
          </span>
          {data && rows.length > 0 && (
            <div className="inline-flex rounded border border-gray-300 overflow-hidden shrink-0">
              {(["summary", "table", "graph", "program"] as const).map((v) => (
                <button key={v} onClick={() => setView(v)} className={`px-2.5 h-7 text-xs capitalize ${view === v ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>{v}</button>
              ))}
            </div>
          )}
        </div>
        <div className="overflow-auto flex-1 min-h-0">
          {data && (view === "summary" ? (
            <MudSummary rows={rows} wellNames={wellNames} note={data.note} />
          ) : view === "table" ? (
            <MudTable rows={rows} cols={usedCols} note={data.note} onOpenReport={onOpenReport} />
          ) : view === "graph" ? (
            <MudLogGraph rows={rows} xAxis={xAxis} tracks={tracks} litho={litho} note={data.note} wellNames={wellNames} />
          ) : (
            <MudProgram filters={programFilters} />
          ))}
        </div>
      </div>
    </div>
  );
}

function MudTable({ rows, cols, note, onOpenReport }: {
  rows: MudRow[];
  cols: { key: keyof MudRow; label: string }[];
  note?: string;
  onOpenReport?: (wellCode: string, serialNo: number, date: string | null) => void;
}) {
  if (!rows.length) return <div className="p-8 text-center text-sm text-gray-400">{note ?? "No mud intervals."}</div>;
  return (
    <table className="text-[11px] tabular-nums border-collapse">
      <thead className="sticky top-0 z-20">
        <tr className="bg-gray-100">
          <th className="sticky left-0 z-30 bg-gray-100 border border-gray-300 px-2 py-1 text-left font-semibold text-gray-700 whitespace-nowrap">Well</th>
          <th className="bg-gray-100 border border-gray-300 px-2 py-1 text-left font-medium text-gray-700 whitespace-nowrap">Date</th>
          {cols.map((c) => (
            <th key={c.key} className={`bg-gray-100 border border-gray-300 px-2 py-1 font-medium text-gray-700 whitespace-nowrap ${c.key === "mudType" || c.key === "bitSize" || c.key === "remarks" ? "text-left" : "text-right"}`}>{c.label}</th>
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
                // Remarks (L04 day narrative) — single line, full text (wide column).
                if (c.key === "remarks") {
                  const t = v == null ? "" : String(v);
                  return <td key={c.key} className="border border-gray-300 px-2 py-0.5 text-left whitespace-nowrap" title={t}>{t}</td>;
                }
                const isText = c.key === "mudType" || c.key === "bitSize";
                return (
                  <td key={c.key} className={`border border-gray-300 px-2 py-0.5 whitespace-nowrap ${isText ? "text-left" : "text-right"}`}>
                    {isText ? (v == null ? "" : String(v)) : fmtNum(v)}
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

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY — the default KPI dashboard (computed client-side from the loaded
// rows). Mirrors the Time-Analysis Summary: headline KPI cards, a per-property
// min/avg/max stats table with typical-range flags, a per-hole-section mud
// table, and two trend charts (mud weight vs depth, PV/YP vs depth).
// ─────────────────────────────────────────────────────────────────────────────

const h1 = (v: number): string => (Number.isInteger(v) ? String(v) : v.toFixed(1));
/** pcf → ppg (1 ppg = 7.48 pcf); mud weight is stored in pounds-per-cubic-foot. */
const PCF_PER_PPG = 7.48;
const toPpg = (pcf: number): number => pcf / PCF_PER_PPG;

/** Numeric value of a hole-size label ("17-1/2\"" → 17.5) for widest→narrowest
 *  section ordering (same parser the Time-Analysis tab uses). */
const holeVal = (h: string): number => {
  const m = (h || "").match(/(\d+(?:\.\d+)?)(?:[\s-](\d+)\/(\d+))?/);
  if (!m) return 0;
  let v = parseFloat(m[1]) || 0;
  if (m[2] && m[3]) v += (+m[2]) / (+m[3]);
  return v;
};

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

const SUM_PALETTE = ["#1e40af", "#dc2626", "#0d9488", "#d97706", "#7c3aed", "#65a30d", "#db2777", "#0891b2", "#ea580c", "#4f46e5", "#16a34a", "#9f1239"];
const colorOf = (i: number) => SUM_PALETTE[i % SUM_PALETTE.length];

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

/** A single KPI tile (matches the Time-Analysis dashboard). */
function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "emerald" | "amber" | "red" }) {
  const t = tone === "red" ? "text-red-600" : tone === "amber" ? "text-amber-600" : tone === "emerald" ? "text-emerald-600" : "text-gray-900";
  return (
    <div className="border border-gray-200 rounded-lg px-3 py-2 bg-gradient-to-b from-white to-gray-50">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`text-lg font-bold tabular-nums leading-tight ${t}`}>{value}</div>
      {sub && <div className="text-[10px] text-gray-400 truncate" title={sub}>{sub}</div>}
    </div>
  );
}

// Typical operational ranges for water/brine-base mud properties in FIELD UNITS,
// sourced from drillingformulas.com & solids-control references (see tab notes).
// `lo`/`hi` are the soft "normal" band — readings outside are flagged amber.
// Mud weight is kept in pcf (the stored unit); the band ~52–150 pcf ≈ 7–20 ppg.
interface PropSpec { key: keyof MudRow; label: string; unit?: string; lo?: number; hi?: number; note?: string }
const PROP_SPECS: PropSpec[] = [
  { key: "maxWeight", label: "Mud weight", unit: "pcf", lo: 52, hi: 150, note: "Density / hydrostatic head (≈ 7–20 ppg)" },
  { key: "visc", label: "Funnel visc", unit: "s", lo: 30, hi: 80, note: "Marsh-funnel, qualitative thickness" },
  { key: "pv", label: "Plastic visc (PV)", unit: "cP", lo: 5, hi: 60, note: "Rises with colloidal solids" },
  { key: "yp", label: "Yield point (YP)", unit: "lb/100ft²", lo: 5, hi: 40, note: "Cuttings-carrying capacity" },
  { key: "initialGel", label: "10-s gel", unit: "lb/100ft²", lo: 1, hi: 30, note: "Static suspension" },
  { key: "gel10", label: "10-min gel", unit: "lb/100ft²", lo: 2, hi: 45, note: "Progressive gelation" },
  { key: "ph", label: "pH", lo: 8.5, hi: 11, note: "Alkalinity control" },
  { key: "waterLoss", label: "API water loss", unit: "mL", lo: 0, hi: 15, note: "Filtrate / cake quality" },
  { key: "hpht", label: "HTHP filtrate", unit: "mL", lo: 0, hi: 25 },
  { key: "solids", label: "Solids", unit: "%", lo: 0, hi: 40, note: "Drill-solids fraction — keep low" },
  { key: "salinity", label: "Salinity", unit: "ppm" },
  { key: "calcium", label: "Calcium", unit: "ppm" },
  { key: "mbt", label: "MBT", unit: "ppb", note: "Reactive-clay (CEC) loading" },
  { key: "temp", label: "Flowline temp", unit: "°C" },
];

interface PropStat { spec: PropSpec; n: number; min: number; avg: number; max: number; outLo: number; outHi: number }
interface SectionStat { hole: string; n: number; mwMin: number; mwAvg: number; mwMax: number; pvAvg: number | null; ypAvg: number | null; solidsAvg: number | null }
interface MudStats {
  wells: number; intervals: number; days: number;
  mw: { n: number; min: number; avg: number; max: number } | null;
  pvAvg: number | null; ypAvg: number | null; solidsAvg: number | null; maxSolids: number | null;
  mudTypes: { name: string; n: number }[];
  props: PropStat[]; sections: SectionStat[];
}

function mean(a: number[]): number { return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0; }

/** One pass over the loaded mud rows → the KPI + table bundle the Summary uses. */
function computeMudStats(rows: MudRow[]): MudStats {
  const wells = new Set<string>(), days = new Set<string>();
  const mwAll: number[] = [], pvAll: number[] = [], ypAll: number[] = [], solAll: number[] = [];
  const mudTypeN = new Map<string, number>();
  const num = (k: keyof MudRow): number[] => rows.map((r) => r[k]).filter((v): v is number => typeof v === "number");
  for (const r of rows) {
    wells.add(r.wellCode);
    if (r.date) days.add(`${r.wellCode}|${r.date}`);
    if (typeof r.maxWeight === "number") mwAll.push(r.maxWeight);
    if (typeof r.pv === "number") pvAll.push(r.pv);
    if (typeof r.yp === "number") ypAll.push(r.yp);
    if (typeof r.solids === "number") solAll.push(r.solids);
    if (r.mudType) mudTypeN.set(r.mudType, (mudTypeN.get(r.mudType) ?? 0) + 1);
  }
  const props: PropStat[] = [];
  for (const spec of PROP_SPECS) {
    const v = num(spec.key); if (!v.length) continue;
    const outLo = spec.lo != null ? v.filter((x) => x < spec.lo!).length : 0;
    const outHi = spec.hi != null ? v.filter((x) => x > spec.hi!).length : 0;
    props.push({ spec, n: v.length, min: Math.min(...v), avg: mean(v), max: Math.max(...v), outLo, outHi });
  }
  // Per hole / bit-size section: mud-weight band + average rheology & solids.
  const secMap = new Map<string, { mw: number[]; pv: number[]; yp: number[]; sol: number[] }>();
  for (const r of rows) {
    const hole = r.bitSize ?? "—";
    const e = secMap.get(hole) ?? { mw: [], pv: [], yp: [], sol: [] };
    if (typeof r.maxWeight === "number") e.mw.push(r.maxWeight);
    if (typeof r.pv === "number") e.pv.push(r.pv);
    if (typeof r.yp === "number") e.yp.push(r.yp);
    if (typeof r.solids === "number") e.sol.push(r.solids);
    secMap.set(hole, e);
  }
  const sections: SectionStat[] = [...secMap.entries()]
    .filter(([, e]) => e.mw.length > 0)
    .map(([hole, e]) => ({
      hole, n: e.mw.length,
      mwMin: Math.min(...e.mw), mwAvg: mean(e.mw), mwMax: Math.max(...e.mw),
      pvAvg: e.pv.length ? mean(e.pv) : null, ypAvg: e.yp.length ? mean(e.yp) : null,
      solidsAvg: e.sol.length ? mean(e.sol) : null,
    }))
    .sort((a, b) => holeVal(b.hole) - holeVal(a.hole));
  return {
    wells: wells.size, intervals: rows.length, days: days.size,
    mw: mwAll.length ? { n: mwAll.length, min: Math.min(...mwAll), avg: mean(mwAll), max: Math.max(...mwAll) } : null,
    pvAvg: pvAll.length ? mean(pvAll) : null, ypAvg: ypAll.length ? mean(ypAll) : null,
    solidsAvg: solAll.length ? mean(solAll) : null, maxSolids: solAll.length ? Math.max(...solAll) : null,
    mudTypes: [...mudTypeN.entries()].map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n),
    props, sections,
  };
}

/** Manager / mud-engineer dashboard: headline KPIs, per-property stats with
 *  typical-range flags, per-hole-section mud table, and trend charts. */
function MudSummary({ rows, wellNames, note }: { rows: MudRow[]; wellNames: Map<string, string>; note?: string }) {
  const st = useMemo(() => computeMudStats(rows), [rows]);
  if (note) return <div className="p-8 text-center text-sm text-gray-400">{note}</div>;
  if (!st.intervals) return <div className="p-8 text-center text-sm text-gray-400">No mud intervals to summarise.</div>;
  const solTone = st.maxSolids != null && st.maxSolids > 40 ? "red" : st.maxSolids != null && st.maxSolids > 30 ? "amber" : "emerald";
  const Th = ({ children, r }: { children: ReactNode; r?: boolean }) => (
    <th className={`bg-gray-100 border border-gray-200 px-2 py-1 font-medium text-gray-600 ${r ? "text-right" : "text-left"}`}>{children}</th>
  );
  return (
    <div className="p-3 space-y-5 text-[11px]">
      {/* Headline KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-2">
        <Kpi label="Wells" value={String(st.wells)} sub={`${st.days} well-days`} />
        <Kpi label="Mud intervals" value={st.intervals.toLocaleString()} sub="daily readings" />
        <Kpi label="Avg mud wt" value={st.mw ? `${st.mw.avg.toFixed(0)} pcf` : "—"} sub={st.mw ? `${toPpg(st.mw.avg).toFixed(1)} ppg` : undefined} />
        <Kpi label="Mud wt range" value={st.mw ? `${st.mw.min.toFixed(0)}–${st.mw.max.toFixed(0)}` : "—"} sub={st.mw ? `${toPpg(st.mw.min).toFixed(1)}–${toPpg(st.mw.max).toFixed(1)} ppg` : undefined} />
        <Kpi label="Avg PV / YP" value={st.pvAvg != null ? `${st.pvAvg.toFixed(0)} / ${st.ypAvg != null ? st.ypAvg.toFixed(0) : "—"}` : "—"} sub="cP · lb/100ft²" />
        <Kpi label="Avg solids" value={st.solidsAvg != null ? `${st.solidsAvg.toFixed(1)}%` : "—"} sub={st.maxSolids != null ? `max ${st.maxSolids.toFixed(0)}%` : undefined} tone={solTone} />
        <Kpi label="Mud systems" value={String(st.mudTypes.length)} sub={st.mudTypes.slice(0, 2).map((m) => m.name).join(", ")} />
      </div>

      {/* Per-property statistics with typical-range flags */}
      <section>
        <h3 className="font-semibold text-gray-700 mb-1">Property statistics <span className="font-normal text-gray-400">— min / avg / max over all readings; flagged outside typical ranges</span></h3>
        <div className="overflow-x-auto">
          <table className="w-full tabular-nums border-collapse">
            <thead><tr><Th>Property</Th><Th>Unit</Th><Th r>Readings</Th><Th r>Min</Th><Th r>Avg</Th><Th r>Max</Th><Th>Typical</Th><Th r>Flagged</Th></tr></thead>
            <tbody>
              {st.props.map((p, i) => {
                const out = p.outLo + p.outHi;
                const band = p.spec.lo != null || p.spec.hi != null ? `${p.spec.lo ?? ""}–${p.spec.hi ?? ""}` : "—";
                const flagTone = out === 0 ? "text-emerald-600" : out / p.n > 0.15 ? "text-red-600" : "text-amber-600";
                return (
                  <tr key={String(p.spec.key)} className={i % 2 ? "bg-gray-50/60" : "bg-white"}>
                    <td className="border border-gray-200 px-2 py-0.5 text-left text-gray-800" title={p.spec.note}>{p.spec.label}</td>
                    <td className="border border-gray-200 px-2 py-0.5 text-left text-gray-400">{p.spec.unit ?? ""}</td>
                    <td className="border border-gray-200 px-2 py-0.5 text-right text-gray-500">{p.n}</td>
                    <td className="border border-gray-200 px-2 py-0.5 text-right">{h1(p.min)}</td>
                    <td className="border border-gray-200 px-2 py-0.5 text-right font-medium">{p.avg.toFixed(1)}</td>
                    <td className="border border-gray-200 px-2 py-0.5 text-right">{h1(p.max)}</td>
                    <td className="border border-gray-200 px-2 py-0.5 text-left text-gray-400">{band}</td>
                    <td className={`border border-gray-200 px-2 py-0.5 text-right font-medium ${flagTone}`} title={out ? `${p.outLo} below · ${p.outHi} above the typical band` : "all in band"}>
                      {out ? `${out} (${(100 * out / p.n).toFixed(0)}%)` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Mud weight & rheology by hole section */}
      {st.sections.length > 0 && (
        <section>
          <h3 className="font-semibold text-gray-700 mb-1">Mud weight &amp; rheology by hole section <span className="font-normal text-gray-400">— widest → narrowest</span></h3>
          <table className="w-full tabular-nums border-collapse">
            <thead><tr><Th>Hole / bit size</Th><Th r>Readings</Th><Th r>Min wt (pcf)</Th><Th r>Avg wt (pcf)</Th><Th r>Avg wt (ppg)</Th><Th r>Max wt (pcf)</Th><Th r>Avg PV</Th><Th r>Avg YP</Th><Th r>Avg solids %</Th></tr></thead>
            <tbody>
              {st.sections.map((s, i) => (
                <tr key={s.hole} className={i % 2 ? "bg-teal-50/40" : "bg-white"}>
                  <td className="border border-gray-200 px-2 py-0.5 text-left font-medium text-gray-800">{s.hole}</td>
                  <td className="border border-gray-200 px-2 py-0.5 text-right text-gray-500">{s.n}</td>
                  <td className="border border-gray-200 px-2 py-0.5 text-right">{s.mwMin.toFixed(0)}</td>
                  <td className="border border-gray-200 px-2 py-0.5 text-right font-medium">{s.mwAvg.toFixed(0)}</td>
                  <td className="border border-gray-200 px-2 py-0.5 text-right text-gray-600">{toPpg(s.mwAvg).toFixed(1)}</td>
                  <td className="border border-gray-200 px-2 py-0.5 text-right">{s.mwMax.toFixed(0)}</td>
                  <td className="border border-gray-200 px-2 py-0.5 text-right">{s.pvAvg != null ? s.pvAvg.toFixed(0) : "—"}</td>
                  <td className="border border-gray-200 px-2 py-0.5 text-right">{s.ypAvg != null ? s.ypAvg.toFixed(0) : "—"}</td>
                  <td className={`border border-gray-200 px-2 py-0.5 text-right ${s.solidsAvg != null && s.solidsAvg > 40 ? "text-red-600" : s.solidsAvg != null && s.solidsAvg > 30 ? "text-amber-600" : ""}`}>{s.solidsAvg != null ? s.solidsAvg.toFixed(1) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Trend charts */}
      <section className="grid grid-cols-1 2xl:grid-cols-2 gap-4">
        <MwDepthChart rows={rows} wellNames={wellNames} />
        <PvYpDepthChart rows={rows} />
      </section>

      <p className="text-[10px] text-gray-400 leading-snug">
        Mud weight is stored in pcf (1 ppg = 7.48 pcf). Typical bands are general water/brine-base guidance — PV 5–60 cP, YP 5–40 lb/100ft², 10-s/10-min gels low-and-flat,
        API filtrate &lt; 15 mL, solids ideally low (drill-solids ≈ 6–7% by volume); colloidal-solids build-up shows up as rising PV. Ranges vary by mud system and hole section,
        so flags are advisory. PV/YP are derived from the Fann 600/300 readings.
      </p>
    </div>
  );
}

/** Mud weight (Y, ppg) vs hole depth (X, m), one step-curve per well — the
 *  density-management trend: weight should ramp up with depth as pore pressure
 *  rises and stay inside the pore/frac window. */
function MwDepthChart({ rows, wellNames }: { rows: MudRow[]; wellNames: Map<string, string> }) {
  const hover = useSvgHover();
  const { wells, maxDepth, minMw, maxMw, capped } = useMemo(() => {
    const byWell = new Map<string, { depth: number; mw: number }[]>();
    for (const r of rows) {
      if (typeof r.maxWeight !== "number") continue;
      const depth = typeof r.to === "number" && r.to > 0 ? r.to : typeof r.from === "number" ? r.from : null;
      if (depth == null || depth <= 0) continue;
      const a = byWell.get(r.wellCode) ?? []; a.push({ depth, mw: toPpg(r.maxWeight) }); byWell.set(r.wellCode, a);
    }
    const wellsAll = [...byWell.entries()].map(([code, pts]) => ({
      code, name: wellNames.get(code) ?? code, pts: pts.slice().sort((a, b) => a.depth - b.depth),
    })).filter((w) => w.pts.length >= 2);
    wellsAll.sort((a, b) => Math.max(...b.pts.map((p) => p.depth)) - Math.max(...a.pts.map((p) => p.depth)));
    const wells = wellsAll.slice(0, 12);
    let maxDepth = 1, minMw = Infinity, maxMw = 0;
    for (const w of wells) for (const p of w.pts) { if (p.depth > maxDepth) maxDepth = p.depth; if (p.mw < minMw) minMw = p.mw; if (p.mw > maxMw) maxMw = p.mw; }
    if (!Number.isFinite(minMw)) minMw = 0;
    return { wells, maxDepth, minMw: Math.floor(minMw - 0.5), maxMw: Math.ceil(maxMw + 0.5), capped: wellsAll.length > wells.length };
  }, [rows, wellNames]);

  if (!wells.length) return <ChartCard title="Mud weight vs depth"><div className="p-6 text-center text-sm text-gray-400">No mud-weight-with-depth data.</div></ChartCard>;
  const PAD = { l: 44, r: 12, t: 10, b: 36 };
  const plotW = 360, plotH = 300;
  const W = PAD.l + plotW + PAD.r, H = PAD.t + plotH + PAD.b;
  const span = Math.max(0.5, maxMw - minMw);
  const xOf = (mw: number) => PAD.l + ((mw - minMw) / span) * plotW;
  const yOf = (d: number) => PAD.t + (d / maxDepth) * plotH;                       // depth increases downward
  const xticks = niceTicks(minMw, maxMw, 5), yticks = niceTicks(0, maxDepth, 6);
  return (
    <ChartCard title="Mud weight vs depth" subtitle={<>Density management — weight (ppg) should ramp with depth. Each line is a well.{capped ? <span className="text-amber-600"> Top {wells.length} deepest.</span> : null}</>}>
      <div className="relative overflow-x-auto">
        <svg width={W} height={H} className="block">
          {xticks.map((t) => <g key={`x${t}`}><line x1={xOf(t)} x2={xOf(t)} y1={PAD.t} y2={PAD.t + plotH} stroke="#f1f5f9" /><text x={xOf(t)} y={PAD.t + plotH + 13} textAnchor="middle" fontSize={9} fill="#94a3b8">{t}</text></g>)}
          {yticks.map((t) => <g key={`y${t}`}><line x1={PAD.l} x2={PAD.l + plotW} y1={yOf(t)} y2={yOf(t)} stroke="#f1f5f9" /><text x={PAD.l - 4} y={yOf(t) + 3} textAnchor="end" fontSize={9} fill="#94a3b8">{Math.round(t)}</text></g>)}
          <rect x={PAD.l} y={PAD.t} width={plotW} height={plotH} fill="none" stroke="#cbd5e1" />
          <text x={PAD.l + plotW / 2} y={H - 3} textAnchor="middle" fontSize={10} fill="#475569" fontWeight={600}>Mud weight (ppg)</text>
          <text transform={`translate(11 ${PAD.t + plotH / 2}) rotate(-90)`} textAnchor="middle" fontSize={10} fill="#475569" fontWeight={600}>Depth (m)</text>
          {wells.map((w, wi) => (
            <g key={w.code}>
              <polyline fill="none" stroke={colorOf(wi)} strokeWidth={1.5} points={w.pts.map((p) => `${xOf(p.mw).toFixed(1)},${yOf(p.depth).toFixed(1)}`).join(" ")} />
              {w.pts.map((p, j) => { const html = `<b>${w.name}</b><br/>${Math.round(p.depth)} m · ${p.mw.toFixed(2)} ppg (${(p.mw * PCF_PER_PPG).toFixed(0)} pcf)`; return <circle key={j} cx={xOf(p.mw)} cy={yOf(p.depth)} r={1.8} fill={colorOf(wi)} onMouseEnter={hover.enter(html)} onMouseMove={hover.enter(html)} onMouseLeave={hover.leave} />; })}
            </g>
          ))}
        </svg>
        {hover.node}
      </div>
      <WellLegend wells={wells} />
    </ChartCard>
  );
}

/** PV & YP vs hole depth — the rheology trend. Two overlaid series (PV blue,
 *  YP red), all wells pooled, so drift in carrying capacity / solids is visible. */
function PvYpDepthChart({ rows }: { rows: MudRow[] }) {
  const hover = useSvgHover();
  const { pv, yp, maxDepth, maxVal } = useMemo(() => {
    const pv: { depth: number; v: number }[] = [], yp: { depth: number; v: number }[] = [];
    for (const r of rows) {
      const depth = typeof r.to === "number" && r.to > 0 ? r.to : typeof r.from === "number" ? r.from : null;
      if (depth == null || depth <= 0) continue;
      if (typeof r.pv === "number") pv.push({ depth, v: r.pv });
      if (typeof r.yp === "number" && r.yp >= 0) yp.push({ depth, v: r.yp });   // drop the rare negative YP (bad reading)
    }
    let maxDepth = 1, maxVal = 1;
    for (const p of [...pv, ...yp]) { if (p.depth > maxDepth) maxDepth = p.depth; if (p.v > maxVal) maxVal = p.v; }
    return { pv, yp, maxDepth, maxVal };
  }, [rows]);

  if (!pv.length && !yp.length) return <ChartCard title="PV / YP vs depth"><div className="p-6 text-center text-sm text-gray-400">No PV/YP readings (need Fann 600/300).</div></ChartCard>;
  const PAD = { l: 44, r: 12, t: 10, b: 36 };
  const plotW = 360, plotH = 300;
  const W = PAD.l + plotW + PAD.r, H = PAD.t + plotH + PAD.b;
  const xOf = (v: number) => PAD.l + (v / maxVal) * plotW;
  const yOf = (d: number) => PAD.t + (d / maxDepth) * plotH;
  const xticks = niceTicks(0, maxVal, 5), yticks = niceTicks(0, maxDepth, 6);
  const dot = (pts: { depth: number; v: number }[], color: string, name: string) =>
    pts.map((p, j) => { const html = `<b>${name}</b><br/>${Math.round(p.depth)} m · ${h1(p.v)}`; return <circle key={`${name}${j}`} cx={xOf(p.v)} cy={yOf(p.depth)} r={1.7} fill={color} fillOpacity={0.7} onMouseEnter={hover.enter(html)} onMouseMove={hover.enter(html)} onMouseLeave={hover.leave} />; });
  return (
    <ChartCard title="PV / YP vs depth" subtitle={<>Rheology trend, all wells pooled — <span style={{ color: "#1e40af" }}>PV</span> (solids-driven) and <span style={{ color: "#dc2626" }}>YP</span> (carrying capacity) by depth.</>}>
      <div className="relative overflow-x-auto">
        <svg width={W} height={H} className="block">
          {xticks.map((t) => <g key={`x${t}`}><line x1={xOf(t)} x2={xOf(t)} y1={PAD.t} y2={PAD.t + plotH} stroke="#f1f5f9" /><text x={xOf(t)} y={PAD.t + plotH + 13} textAnchor="middle" fontSize={9} fill="#94a3b8">{Math.round(t)}</text></g>)}
          {yticks.map((t) => <g key={`y${t}`}><line x1={PAD.l} x2={PAD.l + plotW} y1={yOf(t)} y2={yOf(t)} stroke="#f1f5f9" /><text x={PAD.l - 4} y={yOf(t) + 3} textAnchor="end" fontSize={9} fill="#94a3b8">{Math.round(t)}</text></g>)}
          <rect x={PAD.l} y={PAD.t} width={plotW} height={plotH} fill="none" stroke="#cbd5e1" />
          <text x={PAD.l + plotW / 2} y={H - 3} textAnchor="middle" fontSize={10} fill="#475569" fontWeight={600}>PV (cP) · YP (lb/100ft²)</text>
          <text transform={`translate(11 ${PAD.t + plotH / 2}) rotate(-90)`} textAnchor="middle" fontSize={10} fill="#475569" fontWeight={600}>Depth (m)</text>
          {dot(pv, "#1e40af", "PV")}
          {dot(yp, "#dc2626", "YP")}
        </svg>
        {hover.node}
      </div>
      <div className="flex gap-4 mt-1 text-[11px] text-gray-600">
        <span className="inline-flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: "#1e40af" }} />PV ({pv.length})</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: "#dc2626" }} />YP ({yp.length})</span>
      </div>
    </ChartCard>
  );
}

/** Shared titled card wrapper for the Summary trend charts. */
function ChartCard({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children: ReactNode }) {
  return (
    <div className="border border-gray-200 rounded-lg p-3">
      <h3 className="font-semibold text-gray-700">{title}</h3>
      {subtitle && <div className="text-[10px] text-gray-500 mb-1">{subtitle}</div>}
      {children}
    </div>
  );
}

/** Per-well colour legend shared by the multi-well trend charts. */
function WellLegend({ wells }: { wells: { code: string; name: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-[11px] text-gray-600">
      {wells.map((w, wi) => <span key={w.code} className="inline-flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: colorOf(wi) }} />{w.name}</span>)}
    </div>
  );
}

