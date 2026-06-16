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
import React, { useId, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client.js";
import { MultiSelect, type Item } from "./DdrRemarksSearch.js";
import { useFacetOptions } from "./useFacetOptions.js";
import { useDdrSelection } from "./ddrSelection.js";
import { JalaliDatePicker } from "./JalaliDatePicker.js";
import { WellPathTrajectory3D } from "./WellPathTrajectory3D.js";
import { WellTrack, DepthTrack, usePatternImages, DEPTH_W, formHue, type GraphWell } from "./LithologyGraph.js";

// Per-well lithology + formation graph payload (the /ddr/lithology-graph shape).
interface LithoGraphData { wells: GraphWell[]; depthRange: { min: number; max: number } | null; lithoTypes: string[]; note?: string }

interface SearchOptions {
  fields: string[]; wells: { code: string; name: string; field: string | null }[];
  holeSizes: string[]; mudTypes: string[]; rigs: string[]; formations: string[];
}
// Well-Path facet options restricted to wells/fields that actually have
// directional-survey data (so the sidebar doesn't list vertical / un-surveyed wells).
interface WellPathOptions { fields: string[]; wells: { code: string; name: string; field: string | null }[] }
export interface PathRow {
  wellCode: string; date: string | null; serialNo: number | null;
  md: number | null; inc: number | null; az: number | null; tvd: number | null;
  ns: number | null; ew: number | null; sectionHD: number | null; dls: number | null; vs: number | null;
  direction: string | null; holeSize: string | null; topFormation: string | null; mudType: string | null;
}
interface PathData { rows: PathRow[]; truncated?: boolean; total?: number; note?: string }

const fmtNum = (v: unknown): string =>
  v == null || v === "" ? "" : typeof v === "number" ? (Number.isInteger(v) ? String(v) : v.toFixed(2)) : String(v);

// Strip a trailing run of Leg<N>/ST<N> to the sidetrack base (mirrors the API's
// sidetrackBase), so a leg's pooled lithology well is found under the base code.
const sidetrackBaseClient = (code: string): string => code.replace(/(?:(?:leg|st)\d+)+$/i, "") || code;

const COLS: { key: keyof PathRow; label: string; text?: boolean }[] = [
  { key: "md", label: "MD (m)" }, { key: "inc", label: "Inc (°)" }, { key: "az", label: "Az (°)" },
  { key: "tvd", label: "TVD (m)" }, { key: "ns", label: "N/S (m)" }, { key: "ew", label: "E/W (m)" },
  { key: "sectionHD", label: "Section HD (m)" }, { key: "dls", label: "DLS" }, { key: "vs", label: "VS (m)" },
  { key: "direction", label: "Dir", text: true }, { key: "holeSize", label: "Hole", text: true },
  { key: "topFormation", label: "Top formation", text: true }, { key: "mudType", label: "Mud type", text: true },
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
  // Shared across tabs (see ddrSelection) so the facet picks survive a tab switch.
  const {
    fields: selFields, setFields: setSelFields, wells: selWells, setWells: setSelWells,
    holeSizes: selHole, setHoleSizes: setSelHole, mudTypes: selMud, setMudTypes: setSelMud,
    formations: selForm, setFormations: setSelForm, depthFrom, setDepthFrom, depthTo, setDepthTo,
    dateFrom, setDateFrom, dateTo, setDateTo,
  } = useDdrSelection();
  const [data, setData] = useState<PathData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [view, setView] = useState<"summary" | "table" | "graph">("summary");

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
      const body = { fields: selFields, wells: selWells, holeSizes: selHole, mudTypes: selMud, formations: selForm, depthFrom, depthTo, dateFrom, dateTo };
      setData(await api.post<PathData>("/ddr/well-path", body));
    } catch (e) { setError(String(e)); } finally { setLoading(false); }
  }
  function clearAll() {
    setSelFields([]); setSelWells([]); setSelHole([]); setSelMud([]); setSelForm([]); setDepthFrom(""); setDepthTo(""); setDateFrom(""); setDateTo(""); setData(null);
  }

  return (
    <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4 overflow-hidden">
      <div className="flex flex-col min-h-0 bg-white border border-gray-200 rounded p-3 overflow-y-auto">
        <MultiSelect title="Fields · with path data" items={(wp?.fields ?? []).map((f) => ({ value: f, label: f }))} selected={selFields} onChange={setSelFields} />
        <MultiSelect title={selFields.length ? `Wells · in ${selFields.length} field(s)` : "Wells · with path data"} items={wellItems} selected={selWells} onChange={setSelWells} />
        <MultiSelect title="Bit sizes" items={facet.holeSizes.map((h) => ({ value: h, label: h }))} selected={selHole} onChange={setSelHole} />
        <MultiSelect title="Mud types" items={facet.mudTypes.map((m) => ({ value: m, label: m }))} selected={selMud} onChange={setSelMud} />
        <MultiSelect title="Formations" items={facet.formations.map((m) => ({ value: m, label: m }))} selected={selForm} onChange={setSelForm} />
        <div className="pt-2">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-600 mb-1">Depth interval (m)</div>
          <div className="flex items-center gap-1.5">
            <input type="number" inputMode="numeric" value={depthFrom} onChange={(e) => setDepthFrom(e.target.value)} placeholder="From" className="flex-1 min-w-0 h-9 border border-gray-300 rounded px-2 text-sm tabular-nums" />
            <span className="text-gray-400">–</span>
            <input type="number" inputMode="numeric" value={depthTo} onChange={(e) => setDepthTo(e.target.value)} placeholder="To" className="flex-1 min-w-0 h-9 border border-gray-300 rounded px-2 text-sm tabular-nums" />
          </div>
        </div>
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
              {(["summary", "table", "graph"] as const).map((v) => (
                <button key={v} onClick={() => setView(v)} className={`px-2.5 h-7 text-xs capitalize ${view === v ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>{v}</button>
              ))}
            </div>
          )}
        </div>
        <div className="overflow-auto flex-1 min-h-0">
          {data && (view === "summary" ? (
            <PathSummary rows={rows} note={data.note} />
          ) : view === "table" ? (
            <PathTable rows={rows} cols={usedCols} note={data.note} onOpenReport={onOpenReport} />
          ) : (
            <PerWellPaths rows={rows} note={data.note} onOpenReport={onOpenReport} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── SUMMARY: directional statistics by formation and by hole section ─────────

/** Numeric value of a hole-size label ("17-1/2\"" → 17.5) for widest→narrowest
 *  ordering (same parser the other tabs use). */
const holeValPath = (h: string): number => {
  const m = (h || "").match(/(\d+(?:\.\d+)?)(?:[\s-](\d+)\/(\d+))?/);
  if (!m) return 0;
  let v = parseFloat(m[1]) || 0;
  if (m[2] && m[3]) v += (+m[2]) / (+m[3]);
  return v;
};

interface DirStat {
  key: string; stations: number;
  mdMin: number | null; mdMax: number | null;
  incAvg: number | null; incMax: number | null;
  dlsAvg: number | null; dlsMax: number | null;
}

/** Build/turn statistics for one grouping key (formation or hole size) over the
 *  loaded survey stations: station count, MD span, average & max inclination and
 *  dogleg severity — the directional fingerprint of each interval. */
function groupDirStats(rows: PathRow[], keyOf: (r: PathRow) => string, order: (a: DirStat, b: DirStat) => number): DirStat[] {
  const m = new Map<string, { md: number[]; inc: number[]; dls: number[] }>();
  for (const r of rows) {
    const k = keyOf(r);
    const e = m.get(k) ?? { md: [], inc: [], dls: [] };
    if (typeof r.md === "number") e.md.push(r.md);
    if (typeof r.inc === "number") e.inc.push(r.inc);
    if (typeof r.dls === "number") e.dls.push(r.dls);
    m.set(k, e);
  }
  const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  return [...m.entries()].map(([key, e]) => ({
    key, stations: e.md.length || e.inc.length || e.dls.length,
    mdMin: e.md.length ? Math.min(...e.md) : null, mdMax: e.md.length ? Math.max(...e.md) : null,
    incAvg: avg(e.inc), incMax: e.inc.length ? Math.max(...e.inc) : null,
    dlsAvg: avg(e.dls), dlsMax: e.dls.length ? Math.max(...e.dls) : null,
  })).filter((s) => s.stations > 0).sort(order);
}

function PathSummary({ rows, note }: { rows: PathRow[]; note?: string }) {
  const st = useMemo(() => {
    const wells = new Set(rows.map((r) => r.wellCode));
    const incs = rows.map((r) => r.inc).filter((v): v is number => typeof v === "number");
    const dlss = rows.map((r) => r.dls).filter((v): v is number => typeof v === "number");
    const tvds = rows.map((r) => r.tvd).filter((v): v is number => typeof v === "number");
    const mds = rows.map((r) => r.md).filter((v): v is number => typeof v === "number");
    // Shallowest formation first; a group with no usable MD sorts last. Compare via
    // a finite key so two null-MD groups don't yield NaN (an unstable sort order).
    const mdKey = (s: DirStat) => (s.mdMin == null ? Number.MAX_SAFE_INTEGER : s.mdMin);
    const byForm = groupDirStats(rows, (r) => r.topFormation ?? "—", (a, b) => mdKey(a) - mdKey(b) || a.key.localeCompare(b.key));
    const bySize = groupDirStats(rows, (r) => r.holeSize ?? "—", (a, b) => holeValPath(b.key) - holeValPath(a.key));
    return {
      wells: wells.size, stations: rows.length,
      maxInc: incs.length ? Math.max(...incs) : null,
      maxDls: dlss.length ? Math.max(...dlss) : null,
      maxTvd: tvds.length ? Math.max(...tvds) : null,
      maxMd: mds.length ? Math.max(...mds) : null,
      byForm, bySize,
    };
  }, [rows]);
  if (note) return <div className="p-8 text-center text-sm text-gray-400">{note}</div>;
  if (!rows.length) return <div className="p-8 text-center text-sm text-gray-400">No survey stations to summarise.</div>;
  const Th = ({ children, r }: { children: React.ReactNode; r?: boolean }) => (
    <th className={`bg-gray-100 border border-gray-200 px-2 py-1 font-medium text-gray-600 ${r ? "text-right" : "text-left"}`}>{children}</th>
  );
  const f1 = (v: number | null) => (v == null ? "—" : Number.isInteger(v) ? String(v) : v.toFixed(1));
  const f0 = (v: number | null) => (v == null ? "—" : v.toFixed(0));
  const Kpi = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
    <div className="border border-gray-200 rounded-lg px-3 py-2 bg-gradient-to-b from-white to-gray-50">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      <div className="text-lg font-bold tabular-nums leading-tight text-gray-900">{value}</div>
      {sub && <div className="text-[10px] text-gray-400 truncate">{sub}</div>}
    </div>
  );
  const DirTable = ({ stats, firstLabel }: { stats: DirStat[]; firstLabel: string }) => (
    <table className="w-full tabular-nums border-collapse">
      <thead><tr><Th>{firstLabel}</Th><Th r>Stations</Th><Th r>MD from (m)</Th><Th r>MD to (m)</Th><Th r>Avg inc (°)</Th><Th r>Max inc (°)</Th><Th r>Avg DLS</Th><Th r>Max DLS</Th></tr></thead>
      <tbody>
        {stats.map((s, i) => (
          <tr key={s.key} className={i % 2 ? "bg-teal-50/40" : "bg-white"}>
            <td className="border border-gray-200 px-2 py-0.5 text-left font-medium text-gray-800 whitespace-nowrap">{s.key}</td>
            <td className="border border-gray-200 px-2 py-0.5 text-right text-gray-500">{s.stations}</td>
            <td className="border border-gray-200 px-2 py-0.5 text-right">{f0(s.mdMin)}</td>
            <td className="border border-gray-200 px-2 py-0.5 text-right">{f0(s.mdMax)}</td>
            <td className="border border-gray-200 px-2 py-0.5 text-right font-medium">{f1(s.incAvg)}</td>
            <td className="border border-gray-200 px-2 py-0.5 text-right">{f1(s.incMax)}</td>
            <td className={`border border-gray-200 px-2 py-0.5 text-right font-medium ${s.dlsAvg != null && s.dlsAvg > 3 ? "text-amber-600" : ""}`}>{f1(s.dlsAvg)}</td>
            <td className={`border border-gray-200 px-2 py-0.5 text-right ${s.dlsMax != null && s.dlsMax > 5 ? "text-red-600" : s.dlsMax != null && s.dlsMax > 3 ? "text-amber-600" : ""}`}>{f1(s.dlsMax)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
  return (
    <div className="p-3 space-y-5 text-[11px]">
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2">
        <Kpi label="Wells" value={String(st.wells)} sub={`${st.stations.toLocaleString()} survey stations`} />
        <Kpi label="Max MD" value={st.maxMd != null ? `${st.maxMd.toFixed(0)} m` : "—"} />
        <Kpi label="Max TVD" value={st.maxTvd != null ? `${st.maxTvd.toFixed(0)} m` : "—"} />
        <Kpi label="Max inclination" value={st.maxInc != null ? `${st.maxInc.toFixed(1)}°` : "—"} />
        <Kpi label="Max DLS" value={st.maxDls != null ? st.maxDls.toFixed(1) : "—"} sub="°/30 m" />
        <Kpi label="Formations" value={String(st.byForm.length)} sub={`${st.bySize.length} hole section${st.bySize.length === 1 ? "" : "s"}`} />
      </div>

      {st.byForm.length > 0 && (
        <section>
          <h3 className="font-semibold text-gray-700 mb-1">Directional profile by top formation <span className="font-normal text-gray-400">— shallowest → deepest</span></h3>
          <DirTable stats={st.byForm} firstLabel="Top formation" />
        </section>
      )}

      {st.bySize.length > 0 && (
        <section>
          <h3 className="font-semibold text-gray-700 mb-1">Directional profile by hole section <span className="font-normal text-gray-400">— widest → narrowest</span></h3>
          <DirTable stats={st.bySize} firstLabel="Hole / bit size" />
        </section>
      )}

      <p className="text-[10px] text-gray-400 leading-snug">
        Built from the loaded directional-survey stations. Inclination and dogleg severity (DLS, °/30 m) are summarised per top formation and per hole section, so a high build/turn interval stands out.
        DLS &gt; 3°/30 m is flagged amber, &gt; 5 red. The top formation is resolved from the survey station MD against the well’s formation tops.
      </p>
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

// Top / bottom padding inside the SinglePlot SVG (room for the x-axis title +
// ticks). Shared so the lithology track can inset to the same plot band and line
// up its TVD axis with the chart pixel-for-pixel.
const SINGLE_PAD_T = 22, SINGLE_PAD_B = 34;
// Tile size (px, user-space) for the SVG lithology pattern fills on the section.
const LITHO_TILE = 22;

const niceStep = (rough: number): number => {
  if (!(rough > 0)) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(rough))), m = rough / p;
  return (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p;
};
// Major + minor scale ticks for one axis: majors are the labelled "nice" steps,
// minors subdivide each major by `minorPer` (unlabelled fine gridlines).
const scaleTicks = (min: number, max: number, count = 4, minorPer = 5): { majors: number[]; minors: number[] } => {
  const step = niceStep((max - min) / count) || 1;
  const start = Math.floor(min / step) * step;
  const majors: number[] = [];
  for (let t = start; t <= max + step * 1e-6; t += step) majors.push(Number(t.toFixed(6)));
  const mstep = step / minorPer, minors: number[] = [];
  for (let t = start; t <= max + mstep * 1e-6; t += mstep) {
    const r = t / step; if (Math.abs(r - Math.round(r)) > 1e-6) minors.push(Number(t.toFixed(6)));
  }
  return { majors, minors };
};

/**
 * Build a monotone MD→TVD converter from the survey stations, so the lithology
 * track (logged in MD) can be drawn on the vertical section's TVD axis. Linearly
 * interpolates between the nearest stations and extrapolates flat beyond the ends
 * (returns identity if there aren't ≥2 usable MD/TVD pairs — better than nothing).
 */
function mdToTvdFn(rows: PathRow[]): (md: number) => number {
  const pairs = rows
    .filter((r): r is PathRow & { md: number; tvd: number } => typeof r.md === "number" && typeof r.tvd === "number")
    .map((r) => ({ md: r.md, tvd: r.tvd }))
    .sort((a, b) => a.md - b.md);
  // Drop duplicate MDs (keep first) so the lookup stays strictly increasing.
  const xs: number[] = [], ys: number[] = [];
  for (const p of pairs) { if (!xs.length || p.md > xs[xs.length - 1]) { xs.push(p.md); ys.push(p.tvd); } }
  if (xs.length < 2) return (md) => md;
  return (md) => {
    if (md <= xs[0]) return ys[0] + (md - xs[0]);                       // flat-ish extrapolation
    if (md >= xs[xs.length - 1]) return ys[ys.length - 1] + (md - xs[xs.length - 1]);
    let lo = 0, hi = xs.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (xs[mid] <= md) lo = mid; else hi = mid; }
    const t = (md - xs[lo]) / (xs[hi] - xs[lo] || 1);
    return ys[lo] + t * (ys[hi] - ys[lo]);
  };
}

/**
 * Per-well trajectory groups: one row per well, each showing its plan view,
 * vertical section, 3D trajectory, and DLS together (the four drawpat plots
 * grouped, plus the WebGL 3D). Wells are stacked vertically.
 */
function PerWellPaths({ rows, note, onOpenReport }: {
  rows: PathRow[]; note?: string;
  onOpenReport?: (wellCode: string, serialNo: number, date: string | null) => void;
}) {
  // The chart currently expanded into the full-screen popup (null = none). Either
  // a 2D drawpat plot (plan/section/DLS) or the 3D trajectory.
  type Station3DRow = {
    ns: number; ew: number; tvd: number; md: number | null;
    inc: number | null; az: number | null; dls: number | null;
    date: string | null; serialNo: number | null; wellCode: string;
  };
  type Maxed = {
    wellCode: string; rows: PathRow[]; color: string;
    stations3d: Station3DRow[];
  } & ({ kind: "plot"; plot: PlotKey } | { kind: "3d" });
  const [maxed, setMaxed] = useState<Maxed | null>(null);
  // Group by sidetrack BASE so a well and its legs (AB-011 + AB-011Leg1 + …) draw
  // as ONE trajectory, then order each merged group by MD for a continuous path.
  const wells = useMemo(() => {
    const order: string[] = [];
    const byWell = new Map<string, PathRow[]>();
    for (const r of rows) {
      const key = sidetrackBaseClient(r.wellCode);
      let arr = byWell.get(key);
      if (!arr) { arr = []; byWell.set(key, arr); order.push(key); }
      arr.push(r);
    }
    return order.map((wc) => ({
      wellCode: wc,
      rows: byWell.get(wc)!.slice().sort((a, b) => (a.md ?? Infinity) - (b.md ?? Infinity)),
    }));
  }, [rows]);

  if (note) return <div className="p-8 text-center text-sm text-gray-400">{note}</div>;
  if (!wells.length) return <div className="p-8 text-center text-sm text-gray-400">No plottable survey stations (the selected wells may be vertical).</div>;

  return (
    <div className="p-3 space-y-4">
      {wells.map(({ wellCode, rows: wr }, i) => {
        const color = WELL_PALETTE[i % WELL_PALETTE.length];
        const stations3d = wr
          .filter((r) => typeof r.ns === "number" && typeof r.ew === "number" && typeof r.tvd === "number")
          .map((r) => ({ ns: r.ns as number, ew: r.ew as number, tvd: r.tvd as number, md: r.md,
            inc: r.inc, az: r.az, dls: r.dls, date: r.date, serialNo: r.serialNo, wellCode: r.wellCode }));
        return (
          <div key={wellCode} className="border border-gray-200 rounded">
            <div className="px-3 py-1.5 border-b border-gray-100 flex items-center gap-2">
              <span className="inline-block w-3 h-0.5" style={{ background: color }} />
              <span className="text-sm font-semibold text-gray-800">{wellCode}</span>
              <span className="text-[11px] text-gray-400">· {wr.length} stations</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2 p-2">
              <SinglePlot rows={wr} plot="plan" color={color} onOpenReport={onOpenReport}
                onMaximize={() => setMaxed({ kind: "plot", wellCode, rows: wr, plot: "plan", color, stations3d })} />
              <SinglePlot rows={wr} plot="section" color={color} onOpenReport={onOpenReport}
                onMaximize={() => setMaxed({ kind: "plot", wellCode, rows: wr, plot: "section", color, stations3d })} />
              <div className="flex flex-col">
                <div className="text-[11px] text-gray-500 mb-1 px-1 flex items-center gap-1">
                  <span>3D trajectory</span>
                  {stations3d.length >= 2 && (
                    <button onClick={() => setMaxed({ kind: "3d", wellCode, rows: wr, color, stations3d })} title="Maximize"
                      className="ml-auto h-5 w-5 grid place-items-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700">⤢</button>
                  )}
                </div>
                <div className="flex-1 min-h-[260px] border border-gray-200 rounded overflow-hidden">
                  {stations3d.length >= 2
                    ? <WellPathTrajectory3D stations={stations3d} />
                    : <div className="h-full grid place-items-center text-[10px] text-gray-400">Not enough 3D stations.</div>}
                </div>
              </div>
              <SinglePlot rows={wr} plot="dls" color={color} onOpenReport={onOpenReport}
                onMaximize={() => setMaxed({ kind: "plot", wellCode, rows: wr, plot: "dls", color, stations3d })} />
            </div>
          </div>
        );
      })}

      {maxed && (
        <MaximizedChart wellCode={maxed.wellCode} rows={maxed.rows}
          plot={maxed.kind === "plot" ? maxed.plot : null} color={maxed.color}
          stations3d={maxed.stations3d} onOpenReport={onOpenReport} onClose={() => setMaxed(null)} />
      )}
    </div>
  );
}

/**
 * Full-screen popup for one Well-Path chart. Adds a "Lithology" toggle that
 * fetches this well's lithology + formation column on demand and shows it as a
 * depth track to the LEFT of the chart (sharing the same pixel height). Available
 * for the depth-oriented charts (vertical section, DLS, 3D) — the plan view is
 * map-space, so a depth track wouldn't align there.
 */
function MaximizedChart({ wellCode, rows, plot, color, stations3d, onOpenReport, onClose }: {
  wellCode: string; rows: PathRow[]; plot: PlotKey | null; color: string;   // plot === null ⇒ 3D trajectory
  stations3d: { ns: number; ew: number; tvd: number; md: number | null; inc: number | null; az: number | null; dls: number | null; date: string | null; serialNo: number | null; wellCode: string }[];
  onOpenReport?: (wellCode: string, serialNo: number, date: string | null) => void;
  onClose: () => void;
}) {
  const [showLitho, setShowLitho] = useState(false);
  // User-adjustable transparency for the geology overlay (section bands + 3D
  // layer slabs). Defaults to 15 % so the wellbore stays the focus; the slider
  // drives both the lithology and the formation slabs together.
  const [lithoOpacity, setLithoOpacity] = useState(0.15);
  // The depth-oriented charts (vertical section, DLS, 3D) can carry a depth track;
  // the plan view is map-space (N/S vs E/W), so a depth column wouldn't align.
  const depthOriented = plot !== "plan";
  // Section & DLS plot TVD on Y, so the lithology track can SHARE that exact TVD
  // axis (the litho's MD depths get remapped to TVD). The 3D view has no 2D Y.
  const sharesTvd = plot === "section" || plot === "dls";
  // The geology lives IN the chart for the section (bands) and 3D (layer slabs),
  // so the side lithology column is only useful for the 2D depth charts — the 3D
  // view drops it entirely (the layers are the core itself).
  const showColumn = showLitho && depthOriented && plot !== null;
  // Section/3D draw the geology overlay in-chart → show the opacity slider there.
  const hasOverlay = plot === "section" || plot === "dls" || plot === null;
  const chartH = Math.min(760, window.innerHeight - 170);
  const chartW = Math.min(820, window.innerWidth - (showColumn ? 300 : 120));

  // Fetch this single well's lithology graph the first time the toggle is used.
  const lithoQ = useQuery({
    queryKey: ["ddr", "lithology-graph", "wellpath", wellCode],
    queryFn: () => api.post<LithoGraphData>("/ddr/lithology-graph", { wells: [wellCode] }),
    enabled: showLitho && depthOriented,
    staleTime: 5 * 60_000,
  });
  // The endpoint pools sidetrack legs into one well keyed by the BASE code, so a
  // popup opened on AB-011Leg1 finds the merged well under AB-011.
  const rawWell = lithoQ.data?.wells.find((w) => w.wellCode === wellCode)
    ?? lithoQ.data?.wells.find((w) => sidetrackBaseClient(w.wellCode) === sidetrackBaseClient(wellCode))
    ?? lithoQ.data?.wells[0] ?? null;
  const title = plot ? PLOTS[plot].label : "3D trajectory";

  // Shared TVD axis: the section/DLS chart's TVD range, padded the same 5 % the
  // plot uses, becomes the window for BOTH the chart Y and the lithology track.
  const tvdDomain = useMemo<readonly [number, number] | undefined>(() => {
    if (!sharesTvd) return undefined;
    let lo = Infinity, hi = -Infinity;
    for (const r of rows) if (typeof r.tvd === "number") { if (r.tvd < lo) lo = r.tvd; if (r.tvd > hi) hi = r.tvd; }
    if (!Number.isFinite(lo) || hi <= lo) return undefined;
    const d = (hi - lo) * 0.05;
    return [lo - d, hi + d] as const;
  }, [rows, sharesTvd]);

  // Remap the lithology well's MD depths to TVD so it draws on the shared axis.
  const well = useMemo<GraphWell | null>(() => {
    if (!rawWell) return null;
    if (!sharesTvd) return rawWell;                         // 3D: keep MD column as-is
    const toTvd = mdToTvdFn(rows);
    return {
      ...rawWell,
      lithology: rawWell.lithology.map((iv) => ({ ...iv, from: toTvd(iv.from), to: iv.to == null ? null : toTvd(iv.to) })),
      formations: rawWell.formations.map((t) => ({ ...t, md: toTvd(t.md) })),
    };
  }, [rawWell, rows, sharesTvd]);

  // Vertical-section backdrop: lithology as full-width colour bands + formation
  // tops as dashed boundary lines — the layered earth the trajectory cuts through
  // (the textbook section figure). `well` is already remapped MD→TVD here, so the
  // bands sit on the chart's shared TVD axis. Each band is its interval's dominant
  // (highest-%) component colour.
  const geologySection = useMemo(() => {
    // Section AND DLS both plot TVD on Y, so both get the lithology backdrop.
    if (!showLitho || !well || !sharesTvd) return null;
    const lithoBands = well.lithology
      .map((iv) => {
        const to = typeof iv.to === "number" && iv.to > iv.from ? iv.to : null;
        if (to == null || !iv.comps.length) return null;
        const dom = iv.comps.reduce((a, b) => (b.pct > a.pct ? b : a), iv.comps[0]);
        return { from: iv.from, to, color: dom.color, pattern: dom.pattern };
      })
      .filter((b): b is { from: number; to: number; color: string; pattern: string } => !!b);
    const formationTops = well.formations.map((t, idx) => ({ name: t.name, tvd: t.md, hue: formHue(t.name, idx) }));
    return { lithoBands, formationTops };
  }, [plot, showLitho, well, sharesTvd]);

  // 3D core geology: EVERY lithology interval remapped MD→TVD with its own
  // dominant rock colour + pattern — baked into the core wall so each lithology
  // shows its real colour/pattern (not one dominant per formation).
  const litho3d = useMemo(() => {
    if (plot !== null || !showLitho || !rawWell) return [];
    const toTvd = mdToTvdFn(rows);
    return rawWell.lithology.map((iv) => {
      const to = typeof iv.to === "number" && iv.to > iv.from ? iv.to : null;
      if (to == null || !iv.comps.length) return null;
      const dom = iv.comps.reduce((a, b) => (b.pct > a.pct ? b : a), iv.comps[0]);
      const fromTvd = toTvd(iv.from), toTvdV = toTvd(to);
      if (!(toTvdV > fromTvd)) return null;
      const comps = iv.comps.map((c) => ({ name: c.name, pct: c.pct, color: c.color }));
      return { fromTvd, toTvd: toTvdV, color: dom.color, pattern: dom.pattern, comps };
    }).filter((b): b is { fromTvd: number; toTvd: number; color: string; pattern: string; comps: { name: string; pct: number; color: string }[] } => !!b);
  }, [plot, showLitho, rawWell, rows]);

  // Formation tops (MD→TVD) → labelled chips on the 3D core's rim.
  const formation3d = useMemo(() => {
    if (plot !== null || !showLitho || !rawWell) return [];
    const toTvd = mdToTvdFn(rows);
    return rawWell.formations
      .map((t, idx) => ({ name: t.name, tvd: toTvd(t.md), hue: formHue(t.name, idx) }))
      .filter((l) => Number.isFinite(l.tvd)).sort((a, b) => a.tvd - b.tvd);
  }, [plot, showLitho, rawWell, rows]);

  // Preload all lithology BMP tiles the 3D core wall needs.
  const litho3dImages = usePatternImages(useMemo(() => [...new Set(litho3d.map((b) => b.pattern).filter(Boolean))], [litho3d]));

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-[95vw] max-h-[95vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-2 border-b border-gray-100 flex items-center gap-2 shrink-0">
          <span className="inline-block w-3 h-0.5" style={{ background: color }} />
          <span className="text-sm font-semibold text-gray-800">{wellCode}</span>
          <span className="text-sm text-gray-500">· {title}</span>
          {depthOriented && (
            <label className="ml-3 flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
              <input type="checkbox" checked={showLitho} onChange={(e) => setShowLitho(e.target.checked)} />
              Lithology &amp; formation
            </label>
          )}
          {showLitho && hasOverlay && (
            <label className="flex items-center gap-1.5 text-xs text-gray-600 select-none" title="Layer transparency">
              <span className="text-gray-500">Opacity</span>
              <input type="range" min={0.1} max={1} step={0.05} value={lithoOpacity}
                onChange={(e) => setLithoOpacity(Number(e.target.value))} className="w-24 accent-blue-600" />
              <span className="tabular-nums w-8 text-right">{Math.round(lithoOpacity * 100)}%</span>
            </label>
          )}
          <button onClick={onClose} className="ml-auto h-7 w-7 grid place-items-center rounded hover:bg-gray-100 text-gray-500" title="Close">✕</button>
        </div>
        <div className="p-3 overflow-auto flex items-start gap-3">
          {showColumn && (
            <PopupLithoTrack well={well} loading={lithoQ.isFetching} error={lithoQ.error ? String(lithoQ.error) : null}
              lithoTypes={lithoQ.data?.lithoTypes ?? []} heightPx={chartH}
              forceWin={tvdDomain ? { min: tvdDomain[0], max: tvdDomain[1] } : null}
              depthLabel={sharesTvd ? "TVD (m)" : "MD (m)"}
              // When sharing the chart's TVD axis, inset the track to the SinglePlot's
              // plot band (padT top, padB bottom) so the depths line up pixel-for-pixel.
              inset={sharesTvd ? { top: SINGLE_PAD_T, bottom: SINGLE_PAD_B } : undefined} />
          )}
          {plot === null ? (
            <div className="border border-gray-200 rounded overflow-hidden" style={{ width: chartW, height: chartH }}>
              <WellPathTrajectory3D stations={stations3d} lithoColumn={litho3d} formations={formation3d} patternImages={litho3dImages} opacity={lithoOpacity} onOpenReport={onOpenReport} />
            </div>
          ) : (
            <SinglePlot rows={rows} plot={plot} color={color} onOpenReport={onOpenReport} size={{ w: chartW, h: chartH }} yDomain={tvdDomain} geology={geologySection} bandOpacity={lithoOpacity} />
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * The lithology + formation depth column shown beside a maximized chart. Reuses
 * the Formation tab's WellTrack renderer (composition bands + formation bands)
 * with its own MD depth axis (DepthTrack), so it reads as a parallel depth column.
 */
function PopupLithoTrack({ well, loading, error, lithoTypes, heightPx, forceWin, depthLabel, inset }: {
  well: GraphWell | null; loading: boolean; error: string | null; lithoTypes: string[]; heightPx: number;
  // When set, the track uses this exact depth window (the chart's shared TVD axis,
  // with the well already remapped MD→TVD) instead of its own data extent.
  forceWin?: { min: number; max: number } | null;
  depthLabel: string;
  // Vertical inset so the track's plot band matches the SinglePlot's (which reserves
  // padT/padB for its axis title) — keeps the shared TVD axis aligned to the pixel.
  inset?: { top: number; bottom: number };
}) {
  // Patterns to preload = the lithology pattern names present in this well's comps.
  const patternNames = useMemo(() => {
    const s = new Set<string>();
    for (const iv of well?.lithology ?? []) for (const c of iv.comps) if (c.pattern) s.add(c.pattern);
    return [...s];
  }, [well]);
  const images = usePatternImages(patternNames);
  const selLitho = useMemo(() => new Set(lithoTypes), [lithoTypes]);

  // Depth window: the shared chart axis when given, else the well's own extent.
  const win = useMemo(() => {
    if (forceWin && forceWin.max > forceWin.min) return forceWin;
    let lo = Infinity, hi = -Infinity;
    for (const iv of well?.lithology ?? []) { if (iv.from < lo) lo = iv.from; const to = (typeof iv.to === "number" ? iv.to : iv.from); if (to > hi) hi = to; }
    for (const t of well?.formations ?? []) { if (t.md < lo) lo = t.md; if (t.md > hi) hi = t.md; }
    return Number.isFinite(lo) && hi > lo ? { min: lo, max: hi } : null;
  }, [well, forceWin]);

  const TRACK_W = 150, colW = DEPTH_W + TRACK_W;
  return (
    <div className="shrink-0 flex flex-col" style={{ width: colW }}>
      <div className="text-[11px] text-gray-500 mb-1 px-1">Lithology &amp; formation · {depthLabel}</div>
      {loading ? (
        <div className="grid place-items-center text-[11px] text-gray-400 border border-gray-200 rounded" style={{ height: heightPx, width: colW }}>Loading…</div>
      ) : error ? (
        <div className="grid place-items-center text-[11px] text-red-500 border border-gray-200 rounded p-2 text-center" style={{ height: heightPx, width: colW }}>{error}</div>
      ) : !well || !win ? (
        <div className="grid place-items-center text-[11px] text-gray-400 border border-gray-200 rounded p-2 text-center" style={{ height: heightPx, width: colW }}>No lithology / formation data for this well.</div>
      ) : (() => {
        // headerH={0}: no per-well header here (the popup title bar already names
        // the well). When sharing the chart's TVD axis, inset the track to the
        // chart's plot band (top spacer + reduced height) so the depth axes align
        // pixel-for-pixel; otherwise fill the full height.
        const top = inset?.top ?? 0, bottom = inset?.bottom ?? 0;
        const innerH = Math.max(40, heightPx - top - bottom);
        return (
          <div className="border border-gray-200 rounded overflow-hidden" style={{ height: heightPx }}>
            <div style={{ height: top }} />
            <div className="flex" style={{ height: innerH }}>
              <DepthTrack win={win} heightPx={innerH} headerH={0} fmt={(d) => String(Math.round(d))} />
              <WellTrack well={well} win={win} images={images} selLitho={selLitho} opacity={1} width={TRACK_W} heightPx={innerH} headerH={0} />
            </div>
          </div>
        );
      })()}
    </div>
  );
}

/**
 * One drawpat 2D plot (plan / vertical section / DLS) for a SINGLE well.
 *
 * Clicking anywhere snaps to the nearest survey station and opens that day's
 * daily drilling report (when its report serial resolved). A ⤢ button maximizes
 * the plot into a full-screen popup; pass `size` to render at popup dimensions
 * (which also hides the maximize button, since it's already maximized).
 */
function SinglePlot({ rows, plot, color, onOpenReport, onMaximize, size, yDomain, geology, bandOpacity = 1 }: {
  rows: PathRow[]; plot: PlotKey; color: string;
  onOpenReport?: (wellCode: string, serialNo: number, date: string | null) => void;
  onMaximize?: () => void;
  size?: { w: number; h: number };
  // Forced Y (depth) window — used so the maximized vertical-section plot shares
  // the exact TVD axis of the lithology track beside it. Only honoured for the
  // depth-down, non-equal-aspect plots (section / DLS).
  yDomain?: readonly [number, number];
  // Geology backdrop drawn behind the trajectory on the (depth-down) section plot:
  // lithology as full-width bands by TVD (rock colour + the pattern tile multiply-
  // blended over it, as in the column) + formation tops as dashed lines.
  geology?: {
    lithoBands: { from: number; to: number; color: string; pattern: string }[];
    formationTops: { name: string | null; tvd: number; hue: number }[];
  } | null;
  // Transparency (0–1) of the geology bands, so the trajectory reads through them.
  bandOpacity?: number;
}) {
  const cfg = PLOTS[plot];
  const [hover, setHover] = useState<{ x: number; y: number; html: string } | null>(null);
  // Distinct lithology patterns in the geology backdrop → stable, instance-unique
  // <pattern> ids (useId keeps two open plots from colliding on the same fragment).
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const patDefs = useMemo(() => {
    const names = [...new Set((geology?.lithoBands ?? []).map((b) => b.pattern).filter(Boolean))];
    const id = new Map<string, string>();
    names.forEach((n, i) => id.set(n, `${uid}p${i}`));
    return { names, id };
  }, [geology, uid]);
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

  const W = size?.w ?? 300, H = size?.h ?? 280, padL = 44, padR = 10, padT = SINGLE_PAD_T, padB = SINGLE_PAD_B;
  const plotW = W - padL - padR, plotH = H - padT - padB;

  let body: React.ReactNode;
  if (!pts.length || !Number.isFinite(dom.xmin)) {
    body = <div className="grid place-items-center text-[10px] text-gray-400" style={{ height: H }}>No {cfg.label.toLowerCase()} data.</div>;
  } else {
    const padDom = (lo: number, hi: number) => { const d = (hi - lo) || Math.abs(hi) || 1; return [lo - d * 0.05, hi + d * 0.05] as const; };
    const [xlo, xhi] = padDom(dom.xmin, dom.xmax);
    // Honour a forced depth window (shared with the lithology track) for the
    // depth-down plots; otherwise pad the data range as usual.
    const [ylo, yhi] = (yDomain && cfg.yDown && !cfg.equal) ? yDomain : padDom(dom.ymin, dom.ymax);
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
    const xs = scaleTicks(xlo, xhi, size ? 6 : 4), ys = scaleTicks(ylo, yhi, size ? 6 : 4);
    const dotR = size ? 2.5 : 1.5, lineW = size ? 2 : 1.5, fs = size ? 11 : 8, fsLbl = size ? 12 : 8.5;
    const drawDots = pts.length <= (size ? 1200 : 400);

    // Screen positions of every station — for the nearest-point hover (works for
    // any station count, including the >400 case where the dot markers are off)
    // and for the click → daily-report navigation.
    const screen = pts.map((p) => ({ sx: xOf(p.x), sy: yOf(p.y), r: p.r }));
    const nearest = (mx: number, my: number) => {
      let best = -1, bd = Infinity;
      for (let j = 0; j < screen.length; j++) { const dx = screen[j].sx - mx, dy = screen[j].sy - my, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = j; } }
      return best;
    };
    const onMove = (e: React.MouseEvent<SVGRectElement>) => {
      const best = nearest(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
      if (best < 0) return setHover(null);
      const r = screen[best].r;
      setHover({ x: screen[best].sx, y: screen[best].sy, html: `${r.date ?? ""}${onOpenReport && r.serialNo != null ? " · click to open report" : ""}<br/>MD ${fmtNum(r.md)} m · Inc ${fmtNum(r.inc)}° · Az ${fmtNum(r.az)}°<br/>TVD ${fmtNum(r.tvd)} · N/S ${fmtNum(r.ns)} · E/W ${fmtNum(r.ew)} · DLS ${fmtNum(r.dls)}` });
    };
    const onClick = (e: React.MouseEvent<SVGRectElement>) => {
      if (!onOpenReport) return;
      const best = nearest(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
      if (best < 0) return;
      const r = screen[best].r;
      if (r.serialNo != null) onOpenReport(r.wellCode, r.serialNo, r.date);
    };
    const captureClickable = !!onOpenReport;

    body = (
      <svg width={W} height={H} className="block bg-white">
        {/* Geology backdrop (section only): full-width lithology colour bands by
            TVD, then formation tops as dashed boundary lines + labels — the
            layered earth the trajectory cuts through. Drawn first, behind all. */}
        {geology && cfg.yDown && !cfg.equal && (
          <g>
            <defs>
              {patDefs.names.map((n) => (
                <pattern key={n} id={patDefs.id.get(n)} patternUnits="userSpaceOnUse" width={LITHO_TILE} height={LITHO_TILE}>
                  <image href={`/api/ddr/litho-pattern/${encodeURIComponent(n)}`} width={LITHO_TILE} height={LITHO_TILE} preserveAspectRatio="none" />
                </pattern>
              ))}
            </defs>
            {/* Rock colour + pattern tile (multiply), the whole band at the
                user's opacity so the trajectory reads through it. */}
            {geology.lithoBands.map((b, i) => {
              const ya = yOf(b.from), yb = yOf(b.to);
              const top = Math.max(padT, Math.min(ya, yb)), bot = Math.min(padT + plotH, Math.max(ya, yb));
              if (bot - top < 0.3) return null;
              const pid = b.pattern ? patDefs.id.get(b.pattern) : null;
              return (
                <g key={`lb${i}`} opacity={bandOpacity}>
                  <rect x={padL} y={top} width={plotW} height={bot - top} fill={b.color} />
                  {pid && <rect x={padL} y={top} width={plotW} height={bot - top} fill={`url(#${pid})`} style={{ mixBlendMode: "multiply" }} />}
                </g>
              );
            })}
            {/* Formation tops: a bold dashed boundary + a high-contrast label drawn
                at FULL opacity (above the bands) so they stay legible over the
                textured layers regardless of the band transparency. */}
            {geology.formationTops.map((f, i) => {
              const y = yOf(f.tvd);
              if (y < padT - 0.5 || y > padT + plotH + 0.5) return null;
              const fz = (size ? 12.5 : 9);
              // Solid label chip (white box + formation-colour tab + border) so the
              // name reads clearly over the textured bands; sits just below the top
              // line, clamped to stay inside the plot.
              const chipH = fz + 6;
              const chipW = f.name ? Math.min(plotW - 8, f.name.length * fz * 0.6 + 16) : 0;
              const chipX = padL + 4;
              const chipY = Math.min(padT + plotH - chipH - 1, y + 2);
              return (
                <g key={`ft${i}`}>
                  <line x1={padL} x2={padL + plotW} y1={y} y2={y} stroke="#ffffff" strokeWidth={3.5} opacity={0.9} />
                  <line x1={padL} x2={padL + plotW} y1={y} y2={y} stroke="#b91c1c" strokeWidth={2} strokeDasharray="7 4" />
                  {f.name && (
                    <g>
                      <rect x={chipX} y={chipY} width={chipW} height={chipH} rx={2.5} fill="#ffffff" opacity={0.95} stroke="#64748b" strokeWidth={0.9} />
                      <rect x={chipX} y={chipY} width={4} height={chipH} rx={1} fill={`hsl(${f.hue} 55% 55%)`} />
                      <text x={chipX + 9} y={chipY + chipH / 2} fontSize={fz} fontWeight="bold" fill="#0f172a" dominantBaseline="middle">{f.name}</text>
                    </g>
                  )}
                </g>
              );
            })}
          </g>
        )}
        {/* MINOR scale: faint gridlines + short axis ticks (no labels). */}
        {xs.minors.map((t, i) => { const x = xOf(t); if (x < padL - 0.5 || x > W - padR + 0.5) return null; return (
          <g key={`xm${i}`}>
            <line x1={x} x2={x} y1={padT} y2={padT + plotH} stroke="#f6f8fb" />
            <line x1={x} x2={x} y1={padT + plotH} y2={padT + plotH + 2} stroke="#cbd5e1" />
          </g>); })}
        {ys.minors.map((t, i) => { const y = yOf(t); if (y < padT - 0.5 || y > padT + plotH + 0.5) return null; return (
          <g key={`ym${i}`}>
            <line x1={padL} x2={padL + plotW} y1={y} y2={y} stroke="#f6f8fb" />
            <line x1={padL - 2} x2={padL} y1={y} y2={y} stroke="#cbd5e1" />
          </g>); })}
        {/* MAJOR scale: gridlines + longer axis ticks + value labels. */}
        {xs.majors.map((t, i) => { const x = xOf(t); if (x < padL - 0.5 || x > W - padR + 0.5) return null; return (
          <g key={`x${i}`}>
            <line x1={x} x2={x} y1={padT} y2={padT + plotH} stroke="#e2e8f0" />
            <line x1={x} x2={x} y1={padT + plotH} y2={padT + plotH + 4} stroke="#94a3b8" />
            <text x={x} y={padT + plotH + 13} textAnchor="middle" fontSize={fs} fill="#94a3b8">{fmtNum(t)}</text>
          </g>); })}
        {ys.majors.map((t, i) => { const y = yOf(t); if (y < padT - 0.5 || y > padT + plotH + 0.5) return null; return (
          <g key={`y${i}`}>
            <line x1={padL} x2={padL + plotW} y1={y} y2={y} stroke="#e2e8f0" />
            <line x1={padL - 4} x2={padL} y1={y} y2={y} stroke="#94a3b8" />
            <text x={padL - 6} y={y + 3} textAnchor="end" fontSize={fs} fill="#94a3b8">{fmtNum(t)}</text>
          </g>); })}
        <rect x={padL} y={padT} width={plotW} height={plotH} fill="none" stroke="#cbd5e1" />
        <text x={padL + plotW / 2} y={H - 4} textAnchor="middle" fontSize={fsLbl} fill="#475569">{cfg.xLabel}</text>
        <text x={11} y={padT + plotH / 2} textAnchor="middle" fontSize={fsLbl} fill="#475569" transform={`rotate(-90 11 ${padT + plotH / 2})`}>{cfg.yLabel}</text>
        <polyline fill="none" stroke={color} strokeWidth={lineW} points={pts.map((p) => `${xOf(p.x).toFixed(1)},${yOf(p.y).toFixed(1)}`).join(" ")} />
        {drawDots && pts.map((p, j) => (
          <circle key={j} cx={xOf(p.x)} cy={yOf(p.y)} r={dotR} fill={color} />
        ))}
        {hover && <circle cx={hover.x} cy={hover.y} r={size ? 5 : 3.5} fill="none" stroke="#111827" strokeWidth={1.2} />}
        {/* Transparent capture layer → nearest-station tooltip + click-to-open-report. */}
        <rect x={padL} y={padT} width={plotW} height={plotH} fill="transparent" className={captureClickable ? "cursor-pointer" : undefined}
          onMouseMove={onMove} onMouseLeave={() => setHover(null)} onClick={onClick} />
      </svg>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="text-[11px] text-gray-500 mb-1 px-1 flex items-center gap-1">
        <span>{cfg.label}{cfg.equal ? " · N up" : cfg.yDown ? " · depth ↓" : ""}</span>
        {onMaximize && (
          <button onClick={onMaximize} title="Maximize"
            className="ml-auto h-5 w-5 grid place-items-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700">⤢</button>
        )}
      </div>
      <div className="border border-gray-200 rounded overflow-hidden relative">
        {body}
        {hover && (
          <div className="absolute z-20 pointer-events-none px-2 py-1 rounded bg-gray-900 text-white text-[10px] leading-tight shadow-lg"
            style={{ left: Math.min(hover.x + 10, W - 130), top: Math.max(hover.y - 4, 2), maxWidth: 200 }}
            dangerouslySetInnerHTML={{ __html: hover.html }} />
        )}
      </div>
    </div>
  );
}
