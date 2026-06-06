/**
 * Multi-well Formation / Lithology browser, faceted by fields / wells / bit
 * sizes / mud types (no rigs facet here — irrelevant to formations/lithology).
 *   SHOW = Tables → Form. (tops cross-tab, with each well's bit sizes + mud
 *                   types) · Litho. (lithology-% table, each interval tagged
 *                   with the bit size + mud type covering that depth)
 *   SHOW = Graphs → multi-well lithology + formation graph (zoom / hover /
 *                   adjustable transparency), patterns from LITHO/*.bmp.
 * A lithology checklist filters which components appear; it applies to the
 * Litho. table and the graph.
 */
import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client.js";
import { MultiSelect, type Item } from "./DdrRemarksSearch.js";
import { LithologyGraph, type GraphWell } from "./LithologyGraph.js";

interface SearchOptions {
  fields: string[]; wells: { code: string; name: string; field: string | null }[];
  holeSizes: string[]; mudTypes: string[]; rigs: string[];
}
interface TopDetail { md: number; bit: string | null; mud: string | null }
interface MatrixRow { wellCode: string; name: string; field: string | null; bitSizes: string | null; mudTypes: string | null; tops: Record<string, number | null>; detail: Record<string, TopDetail> }
interface Matrix { formations: string[]; rows: MatrixRow[]; truncated?: boolean; total?: number; note?: string }
interface LithoComp { name: string; pct: number; pattern: string; color: string }
interface LithoData { rows: { wellCode: string; from: number; to: number | null; bitSize: string | null; mudType: string | null; comps: LithoComp[] }[]; lithoTypes: string[]; truncated?: boolean; total?: number; note?: string }
interface GraphData { wells: GraphWell[]; depthRange: { min: number; max: number } | null; lithoTypes: string[]; note?: string }

const fmtNum = (v: unknown): string =>
  v == null || v === "" ? "" : typeof v === "number" ? (Number.isInteger(v) ? String(v) : v.toFixed(1)) : String(v);

function LSwatch({ color, pattern, size = 11 }: { color: string; pattern?: string; size?: number }) {
  return (
    <span className="inline-block rounded-sm border border-gray-300 align-middle shrink-0" style={{
      width: size, height: size, backgroundColor: color,
      backgroundImage: pattern ? `url(/api/ddr/litho-pattern/${pattern})` : undefined,
      backgroundBlendMode: "multiply", backgroundSize: `${size + 6}px`,
    }} />
  );
}

export function FormationMatrix() {
  const [show, setShow] = useState<"tables" | "graphs">("tables");
  const [mode, setMode] = useState<"form" | "litho">("form");
  const [selFields, setSelFields] = useState<string[]>([]);
  const [selWells, setSelWells] = useState<string[]>([]);
  const [selHole, setSelHole] = useState<string[]>([]);
  const [selMud, setSelMud] = useState<string[]>([]);
  const [selLitho, setSelLitho] = useState<string[]>([]);
  const [transparency, setTransparency] = useState(20);
  const [form, setForm] = useState<Matrix | null>(null);
  const [litho, setLitho] = useState<LithoData | null>(null);
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const optsQ = useQuery({ queryKey: ["ddr", "search-options"], queryFn: () => api.get<SearchOptions>("/ddr/search-options") });
  const o = optsQ.data;

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

  const lithoTypes = (show === "graphs" ? graph?.lithoTypes : litho?.lithoTypes) ?? [];
  const showLithoFacet = show === "graphs" || (show === "tables" && mode === "litho");

  async function run(s: "tables" | "graphs" = show, m: "form" | "litho" = mode) {
    setLoading(true);
    setError(null);
    try {
      // selWells already holds unique well codes (the picker is keyed by code).
      const body = { fields: selFields, wells: selWells, holeSizes: selHole, mudTypes: selMud };
      if (s === "graphs") { const r = await api.post<GraphData>("/ddr/lithology-graph", body); setGraph(r); setSelLitho(r.lithoTypes ?? []); }
      else if (m === "form") setForm(await api.post<Matrix>("/ddr/formation-matrix", body));
      else { const r = await api.post<LithoData>("/ddr/lithology-table", body); setLitho(r); setSelLitho(r.lithoTypes ?? []); }
    } catch (e) { setError(String(e)); } finally { setLoading(false); }
  }
  function clearAll() { setSelFields([]); setSelWells([]); setSelHole([]); setSelMud([]); setForm(null); setLitho(null); setGraph(null); }

  const selLithoSet = useMemo(() => new Set(selLitho), [selLitho]);
  const lithoRows = useMemo(() => {
    if (!litho) return [];
    return selLithoSet.size ? litho.rows.filter((r) => r.comps.some((c) => selLithoSet.has(c.name))) : litho.rows;
  }, [litho, selLithoSet]);

  return (
    <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4 overflow-hidden">
      <div className="flex flex-col min-h-0 bg-white border border-gray-200 rounded p-3 overflow-y-auto">
        <MultiSelect title="Fields" items={(o?.fields ?? []).map((f) => ({ value: f, label: f }))} selected={selFields} onChange={setSelFields} />
        <MultiSelect title={selFields.length ? `Wells · in ${selFields.length} field(s)` : "Wells"} items={wellItems} selected={selWells} onChange={setSelWells} />
        <MultiSelect title="Bit sizes" items={(o?.holeSizes ?? []).map((h) => ({ value: h, label: h }))} selected={selHole} onChange={setSelHole} />
        <MultiSelect title="Mud types" items={(o?.mudTypes ?? []).map((m) => ({ value: m, label: m }))} selected={selMud} onChange={setSelMud} />
        {showLithoFacet && lithoTypes.length > 0 && (
          <MultiSelect title="Lithology" items={lithoTypes.map((t) => ({ value: t, label: t }))} selected={selLitho} onChange={setSelLitho} />
        )}
        {show === "graphs" && (
          <label className="block pt-2">
            <span className="text-[11px] text-gray-500">Pattern transparency · {transparency}%</span>
            <input type="range" min={0} max={100} value={transparency} onChange={(e) => setTransparency(+e.target.value)} className="w-full" />
          </label>
        )}
        <div className="flex gap-2 pt-3">
          <button onClick={() => run()} disabled={loading} className="h-9 px-4 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300">{loading ? "Loading…" : show === "graphs" ? "Show graphs" : mode === "form" ? "Show tops" : "Show lithology"}</button>
          <button onClick={clearAll} className="h-9 px-3 text-sm rounded border border-gray-300 hover:bg-gray-50">Clear</button>
        </div>
        {error && <div className="text-xs text-red-600 pt-2">{error}</div>}
      </div>

      <div className="bg-white border border-gray-200 rounded flex flex-col min-h-0 overflow-hidden">
        <div className="px-3 py-2 border-b border-gray-100 shrink-0 flex items-center justify-between gap-2">
          <span className="text-sm text-gray-600 min-w-0 truncate">
            {show === "graphs"
              ? (graph ? <>Graph · <b>{graph.wells.length}</b> well(s){graph.note ? ` — ${graph.note}` : ""}</> : "Pick a field / well, then Show graphs.")
              : mode === "form"
                ? (form ? (form.note ? form.note : <>Formation tops · <b>{form.rows.length}</b> wells × {form.formations.length} formations{form.truncated ? ` (capped — ${form.total})` : ""}</>) : "Pick facets, then Show tops.")
                : (litho ? <>Lithology · <b>{lithoRows.length}</b> intervals{litho.truncated ? ` (capped — ${litho.total})` : ""}{litho.note ? ` — ${litho.note}` : ""}</> : "Pick a field / well, then Show lithology.")}
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            {show === "tables" && (
              <div className="inline-flex rounded border border-gray-300 overflow-hidden">
                {(["form", "litho"] as const).map((m) => (
                  <button key={m} onClick={() => setMode(m)} className={`px-2.5 h-7 text-xs ${mode === m ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>{m === "form" ? "Form." : "Litho."}</button>
                ))}
              </div>
            )}
            <div className="inline-flex rounded border border-gray-300 overflow-hidden">
              {(["tables", "graphs"] as const).map((sv) => (
                <button key={sv} onClick={() => setShow(sv)} className={`px-2.5 h-7 text-xs capitalize ${show === sv ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>{sv}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="overflow-auto flex-1 min-h-0">
          {show === "graphs" ? (graph && <LithologyGraph wells={graph.wells} depthRange={graph.depthRange} selLitho={selLithoSet} opacity={1 - transparency / 100} />)
            : mode === "form" ? (form && <MatrixTable m={form} />)
              : (litho && <LithoTable rows={lithoRows} />)}
        </div>
      </div>
    </div>
  );
}

function MatrixTable({ m }: { m: Matrix }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  if (!m.rows.length) return <div className="p-8 text-center text-sm text-gray-400">{m.note ?? "No wells match."}</div>;
  const toggle = (wc: string) => setExpanded((prev) => { const n = new Set(prev); n.has(wc) ? n.delete(wc) : n.add(wc); return n; });
  const colSpan = 3 + m.formations.length; // Well + Bit sizes + Mud types + formation columns
  return (
    <table className="text-[11px] tabular-nums border-collapse">
      <thead className="sticky top-0 z-20">
        <tr>
          <th className="sticky left-0 z-30 bg-gray-100 border border-gray-300 px-2 py-1 text-left font-semibold text-gray-700 whitespace-nowrap">Well</th>
          {["Bit sizes", "Mud types"].map((h) => <th key={h} className="bg-gray-100 border border-gray-300 px-2 py-1 text-left font-medium text-gray-700 whitespace-nowrap">{h}</th>)}
          {m.formations.map((f) => <th key={f} className="bg-gray-100 border border-gray-300 px-2 py-1 text-left font-medium text-gray-700 whitespace-nowrap">{f}</th>)}
        </tr>
      </thead>
      <tbody>
        {m.rows.map((row) => {
          const open = expanded.has(row.wellCode);
          return (
            <Fragment key={row.wellCode}>
              <tr className={open ? "bg-blue-50/40" : undefined}>
                <th className={`sticky left-0 z-10 border border-gray-300 px-2 py-0.5 text-left font-semibold text-gray-800 whitespace-nowrap ${open ? "bg-blue-50" : "bg-white"}`} title={row.name}>
                  <button onClick={() => toggle(row.wellCode)} className="inline-flex items-center gap-1 hover:text-blue-700" title={open ? "Collapse" : "Expand bit size / mud type per formation top"}>
                    <span className={`inline-block transition-transform text-gray-400 ${open ? "rotate-90" : ""}`}>▶</span>{row.wellCode}
                  </button>
                </th>
                <td className="border border-gray-300 px-2 py-0.5 text-left text-gray-700 whitespace-nowrap">{row.bitSizes ?? ""}</td>
                <td className="border border-gray-300 px-2 py-0.5 text-left text-gray-700 whitespace-nowrap">{row.mudTypes ?? ""}</td>
                {m.formations.map((f) => {
                  const v = row.tops[f];
                  return <td key={f} className={`border border-gray-300 px-2 py-0.5 text-right ${v != null ? "bg-white text-gray-800" : "bg-teal-50"}`}>{fmtNum(v)}</td>;
                })}
              </tr>
              {open && (
                <tr>
                  <td colSpan={colSpan} className="border border-gray-300 bg-gray-50 p-0">
                    <ExpandedWell row={row} formations={m.formations} />
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}

/** One sub-row per formation top (sorted by depth): Formation · Top · Bit size · Mud type. */
function ExpandedWell({ row, formations }: { row: MatrixRow; formations: string[] }) {
  const items = useMemo(() => formations
    .map((f) => ({ formation: f, ...(row.detail[f] ?? (row.tops[f] != null ? { md: row.tops[f] as number, bit: null, mud: null } : null)) }))
    .filter((x): x is { formation: string; md: number; bit: string | null; mud: string | null } => x != null && typeof x.md === "number")
    .sort((a, b) => a.md - b.md), [row, formations]);
  if (!items.length) return <div className="px-4 py-3 text-gray-400">No formation tops recorded for {row.wellCode}.</div>;
  return (
    <div className="px-4 py-2">
      <table className="text-[11px] tabular-nums border-collapse">
        <thead>
          <tr className="text-gray-500">
            {["Formation", "Top (MD)", "Bit size", "Mud type"].map((h) => (
              <th key={h} className="border-b border-gray-300 px-3 py-1 text-left font-medium whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.formation} className="hover:bg-blue-50/50">
              <td className="px-3 py-0.5 whitespace-nowrap font-medium text-gray-800">{it.formation}</td>
              <td className="px-3 py-0.5 text-right text-gray-800">{fmtNum(it.md)}</td>
              <td className="px-3 py-0.5 whitespace-nowrap text-gray-700">{it.bit ?? <span className="text-gray-300">—</span>}</td>
              <td className="px-3 py-0.5 whitespace-nowrap text-gray-700">{it.mud ?? <span className="text-gray-300">—</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const SLOTS = [0, 1, 2, 3, 4, 5];
function LithoTable({ rows }: { rows: LithoData["rows"] }) {
  if (!rows.length) return <div className="p-8 text-center text-sm text-gray-400">No intervals.</div>;
  // Only show slot columns (Lith N + its %) that at least one row actually
  // fills — drop trailing/empty pairs so the table isn't padded with blanks.
  const usedSlots = SLOTS.filter((i) => rows.some((r) => r.comps[i]));
  return (
    <table className="text-[11px] tabular-nums border-collapse">
      <thead className="sticky top-0 z-20">
        <tr className="bg-gray-100">
          {["Well", "From", "To", "Bit size", "Mud type"].map((h) => <th key={h} className="border border-gray-300 px-2 py-1 text-left font-semibold text-gray-700 whitespace-nowrap">{h}</th>)}
          {usedSlots.map((i) => [
            <th key={`l${i}`} className="border border-gray-300 px-3 py-1 text-left font-medium text-gray-700 whitespace-nowrap min-w-[120px]">{`Lith${i + 1}`}</th>,
            // % column is ~3× wider so the value + gradient bar are readable.
            <th key={`p${i}`} className="border border-gray-300 px-3 py-1 text-left font-medium text-gray-700 whitespace-nowrap min-w-[72px]">%</th>,
          ])}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, ri) => (
          <tr key={ri} className={ri % 2 ? "bg-teal-50/40" : "bg-white"}>
            <td className="border border-gray-300 px-2 py-0.5 font-semibold text-gray-800 whitespace-nowrap">{row.wellCode}</td>
            <td className="border border-gray-300 px-2 py-0.5 text-right">{fmtNum(row.from)}</td>
            <td className="border border-gray-300 px-2 py-0.5 text-right">{fmtNum(row.to)}</td>
            <td className="border border-gray-300 px-2 py-0.5 whitespace-nowrap">{row.bitSize ?? ""}</td>
            <td className="border border-gray-300 px-2 py-0.5 whitespace-nowrap">{row.mudType ?? ""}</td>
            {usedSlots.map((i) => {
              const c = row.comps[i];
              return [
                <td key={`l${i}`} className="border border-gray-300 px-3 py-0.5 whitespace-nowrap min-w-[120px]">
                  {c ? <span className="inline-flex items-center gap-1"><LSwatch color={c.color} pattern={c.pattern || undefined} /> {c.name}</span> : ""}
                </td>,
                <td key={`p${i}`} className="border border-gray-300 px-3 py-0.5 text-right min-w-[72px]"
                  style={c ? { background: `linear-gradient(to right, #b2dfdb ${Math.min(100, c.pct)}%, transparent ${Math.min(100, c.pct)}%)` } : undefined}>
                  {c ? c.pct : ""}
                </td>,
              ];
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
