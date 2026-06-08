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
 * Two views over the already-loaded rows (no extra fetch):
 *   • TABLE — the faceted grid; a row opens that day's full daily report (the
 *     same overlay Reports & Search uses) when its report serial resolved.
 *   • GRAPH — selected mud properties plotted with an X-axis (Depth | Date)
 *     picker, one small chart per well, over all loaded rows.
 */
import { useMemo, useState } from "react";
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

  // Local view state — never triggers a network fetch.
  const [view, setView] = useState<"table" | "graph" | "program">("table");
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
              {(["table", "graph", "program"] as const).map((v) => (
                <button key={v} onClick={() => setView(v)} className={`px-2.5 h-7 text-xs capitalize ${view === v ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>{v}</button>
              ))}
            </div>
          )}
        </div>
        <div className="overflow-auto flex-1 min-h-0">
          {data && (view === "table" ? (
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

