/**
 * Remarks & Summary — port of the Delphi DDR "REMARKS OR SUMMERY" tab (Unit1).
 *
 * Cross-well keyword search with AND / OR / NOT logic, plus the filterable
 * facets the Delphi form exposes — Fields, Wells, Bit (hole) sizes, Mud types,
 * Rigs, Operation names, the "Time included" toggle, and the saved search groups
 * from DB.sqlite FIELDDATA. Two result views query *different* source tables:
 *   • REMARKS = one row per operation (OperationAnalysis.Description) incl. op
 *     code + from/to time.
 *   • SUMMARY = one row per day = the L04 daily-report operations narrative
 *     (hole/depths/mud/weights/rig/well/date/description). A day with no logged
 *     operations still has a daily summary, so the two views differ.
 * Switching the view re-runs the search against the matching table. CSV export.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client.js";
import { JalaliDatePicker } from "./JalaliDatePicker.js";
import { useFacetOptions } from "./useFacetOptions.js";

interface GroupEditor { originalName: string | null; name: string; category: string; and: string; or: string; not: string }

interface SearchGroup { category: string; name: string; and: string[]; or: string[]; not: string[] }
interface SearchRow {
  wellCode: string; serialNo: number | null; date: string | null; opCode: string | null;
  fromTime: unknown; toTime: unknown; description: string | null;
  field: string | null; rig: string | null;
  holeSize: unknown; fromPoint: unknown; toPoint: unknown;
  mud: string | null; minWeight: unknown; maxWeight: unknown;
}
interface SearchResult { count: number; limit: number; truncated?: boolean; rows: SearchRow[]; note?: string; mode?: "remarks" | "summary" }
interface SearchOptions {
  fields: string[]; wells: { code: string; name: string; field: string | null }[]; holeSizes: string[];
  mudTypes: string[]; rigs: string[]; operations: { code: string; desc: string }[];
}
export interface Item { value: string; label: string; keywords?: string; hint?: string; icon?: ReactNode }

const parse = (s: string) => s.split(/[,;]+/).map((x) => x.trim()).filter(Boolean);
const fmt = (v: unknown): string => {
  if (v == null || v === "") return "—";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(2);
  return String(v);
};

const REMARKS_COLS: [keyof SearchRow, string][] = [
  ["holeSize", "Hole"], ["fromPoint", "From"], ["toPoint", "To"], ["mud", "Mud"],
  ["minWeight", "MinWt"], ["maxWeight", "MaxWt"], ["rig", "Rig"], ["wellCode", "Well"],
  ["date", "Date"], ["opCode", "Op"], ["fromTime", "F.Time"], ["toTime", "T.Time"], ["description", "Description"],
];
const SUMMARY_COLS: [keyof SearchRow, string][] = [
  ["holeSize", "Hole size"], ["fromPoint", "From point"], ["toPoint", "To point"], ["mud", "Mud name"],
  ["minWeight", "Min wt"], ["maxWeight", "Max wt"], ["rig", "Rig"], ["wellCode", "Well name"],
  ["date", "Drilling date"], ["description", "Description"],
];

// Short, human label per operation code (the DB only stores a long paragraph).
// Used for the Operations menu ("DRLG - Drilling"); the full text stays on hover.
const OP_SHORT: Record<string, string> = {
  ACD: "Accident", BHAF: "BHA failure", BHB: "BHA balling", BHS: "Wellbore instability",
  BOP: "BOP problem", BOPW: "BOP / wellhead", CAT: "Cased-hole test", CIC: "Circulate (casing)",
  CIR: "Circulate", CMC: "Cementing", CMT: "Cementing problem", COMP: "Completion", COR: "Coring",
  CSG: "Casing", CTP: "Condition hole", DCT: "Drill cement", DD: "Directional problem",
  DFS: "Drill float / shoe", DHO: "Hole opening / reaming", DMR: "Drilling (rotary)",
  DMS: "Drilling (slide)", DOT: "Drill (non-formation)", DRG: "Drag", DRL: "Drilling", DRLG: "Drilling",
  DSG: "Drill-string failure", FISH: "Fish in hole", FSH: "Fishing", HC: "Hole cleaning",
  HTL: "Handle tools", JF: "Job failure", LDP: "Lay down pipe", LOC: "Lost circulation", LOG: "Logging",
  LOT: "Leak-off test", MILL: "Milling", MLG: "Milling", MUD: "Mud / circulation loss", NT: "No trouble",
  OHT: "Open-hole test", OTH: "Other (unlisted)", PAG: "Permanent abandon", POR: "Pull riser",
  POV: "Position rig", RCS: "Run casing", RD: "Rig down", RDN: "Rig down", RDR: "Run riser",
  RM: "Rig move", RO: "Repair (service)", ROE: "Repair (other)", ROP: "Low ROP", RR: "Repair (rig)",
  RU: "Rig up", RW: "Wiper trip / ream", S: "Survey (mis-run)", SAC: "Misc (non-hole)", SRV: "Surveying",
  STK: "Stuck pipe", STRK: "Side-track", SUS: "Temporary abandon", TEST: "Well test", TF: "Tool failure",
  TH: "Tight hole", TIN: "Trip in", TOV: "Trip out", TRQ: "Torque", WC: "Well control", WCT: "Well control",
  WO: "Waiting (materials)", WOC: "Wait on cement", WOW: "Wait on weather", WTO: "Waiting (weather)",
};
const opLabel = (code: string) => (OP_SHORT[code] ? `${code} - ${OP_SHORT[code]}` : code);

export function DdrRemarksSearch({ onOpenReport }: { onOpenReport?: (wellCode: string, serialNo: number, date: string | null) => void } = {}) {
  const [andKw, setAndKw] = useState("");
  const [orKw, setOrKw] = useState("");
  const [notKw, setNotKw] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [onlyTimed, setOnlyTimed] = useState(false);
  const [view, setView] = useState<"remarks" | "summary">("remarks");
  const [groupFilter, setGroupFilter] = useState("");
  // facet selections
  const [selFields, setSelFields] = useState<string[]>([]);
  const [selWells, setSelWells] = useState<string[]>([]);
  const [selHole, setSelHole] = useState<string[]>([]);
  const [selMud, setSelMud] = useState<string[]>([]);
  const [selRigs, setSelRigs] = useState<string[]>([]);
  const [selOps, setSelOps] = useState<string[]>([]);
  // results
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // saved-group create/edit
  const [editor, setEditor] = useState<GroupEditor | null>(null);
  const [groupBusy, setGroupBusy] = useState(false);

  const queryClient = useQueryClient();
  const groupsQ = useQuery({ queryKey: ["ddr", "search-groups"], queryFn: () => api.get<SearchGroup[]>("/ddr/search-groups") });
  const optsQ = useQuery({ queryKey: ["ddr", "search-options"], queryFn: () => api.get<SearchOptions>("/ddr/search-options") });
  const o = optsQ.data;
  const facet = useFacetOptions(selFields, selWells, o);

  const groupsByCat = useMemo(() => {
    const q = groupFilter.trim().toLowerCase();
    const m = new Map<string, SearchGroup[]>();
    for (const g of groupsQ.data ?? []) {
      if (q && !`${g.name} ${g.and.join(" ")} ${g.or.join(" ")}`.toLowerCase().includes(q)) continue;
      (m.get(g.category) ?? m.set(g.category, []).get(g.category)!).push(g);
    }
    return m;
  }, [groupsQ.data, groupFilter]);

  // Wells are scoped to the selected fields (as the Delphi form does) — with no
  // field chosen, all wells with operations are shown.
  // One entry per well NAME — a well's legs/sidetracks (AGH-014, AGH-014ST1, …)
  // all share an EnglishName ("AGHAR-014") and should list once; selecting it
  // searches every one of its wellbore codes (expanded in runSearch).
  // One entry PER WELL CODE (codes are unique; names are NOT — e.g. DA-008 and
  // DA-009 are both "DANAN-008"). Keying by code keeps duplicates distinct;
  // same-named wells get the code appended so they're tellable apart.
  const wellItems = useMemo(() => {
    const fset = new Set(selFields);
    const visible = (o?.wells ?? []).filter((w) => !fset.size || (w.field != null && fset.has(w.field)));
    const nameCount = new Map<string, number>();
    for (const w of visible) { const n = w.name || w.code; nameCount.set(n, (nameCount.get(n) ?? 0) + 1); }
    // keywords = the wellbore code, so the well is findable by code too (AB-001).
    return visible.map((w) => {
      const n = w.name || w.code;
      const dup = (nameCount.get(n) ?? 0) > 1;
      return { value: w.code, label: dup ? `${n} (${w.code})` : n, keywords: `${w.code} ${n}` };
    });
  }, [o?.wells, selFields]);

  // Each field is also searchable by its wells' code prefix ("AB-" ⇒ Aban), so
  // typing "ab" or "ab-" surfaces the field even though its name is "Aban".
  const fieldKeywords = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const w of o?.wells ?? []) {
      if (!w.field) continue;
      const dash = w.code.indexOf("-");
      const prefix = dash > 0 ? w.code.slice(0, dash + 1) : w.code; // "AB-001WO1" → "AB-"
      if (!m.has(w.field)) m.set(w.field, new Set());
      m.get(w.field)!.add(prefix);
    }
    return m;
  }, [o?.wells]);

  // Drop any selected wells (by code) that fall outside the chosen fields.
  useEffect(() => {
    if (!selFields.length || !o?.wells) return;
    const allowed = new Set(
      o.wells.filter((w) => w.field != null && selFields.includes(w.field)).map((w) => w.code),
    );
    setSelWells((prev) => {
      const next = prev.filter((c) => allowed.has(c));
      return next.length === prev.length ? prev : next;
    });
  }, [selFields, o?.wells]);

  // modeOverride lets the view toggle re-query immediately (before the `view`
  // state update has flushed); the Run button passes nothing → uses `view`.
  async function runSearch(modeOverride?: "remarks" | "summary") {
    const mode = modeOverride ?? view;
    setLoading(true);
    setError(null);
    try {
      // selWells already holds unique well codes (the picker is keyed by code).
      const r = await api.post<SearchResult>("/ddr/operations/search", {
        and: parse(andKw), or: parse(orKw), not: parse(notKw),
        dateFrom: dateFrom.trim() || undefined, dateTo: dateTo.trim() || undefined,
        fields: selFields, wells: selWells, holeSizes: selHole, mudTypes: selMud, rigs: selRigs, opCodes: selOps,
        onlyTimed, mode, limit: 2000,
      });
      setResult(r);
    } catch (e) {
      setError(String(e));
      setResult(null);
    } finally {
      setLoading(false);
    }
  }
  function applyGroup(g: SearchGroup) {
    // Selecting a saved item REPLACES the keyword boxes (clear first), so each
    // pick is a fresh apply rather than accumulating onto the previous one.
    setAndKw(g.and.join(", "));
    setOrKw(g.or.join(", "));
    setNotKw(g.not.join(", "));
  }
  // Saved-group management (writes to DB.sqlite FIELDDATA, like the Delphi form).
  const openNewGroup = (category = "MY SEARCHES") => setEditor({ originalName: null, name: "", category, and: andKw, or: orKw, not: notKw });
  const openEditGroup = (g: SearchGroup) =>
    setEditor({ originalName: g.name, name: g.name, category: g.category, and: g.and.join(", "), or: g.or.join(", "), not: g.not.join(", ") });
  async function saveGroup() {
    if (!editor || !editor.name.trim()) return;
    setGroupBusy(true);
    setError(null);
    try {
      const body = { category: editor.category.trim(), name: editor.name.trim(), and: parse(editor.and), or: parse(editor.or), not: parse(editor.not) };
      if (editor.originalName) await api.put("/ddr/search-groups", { ...body, originalName: editor.originalName });
      else await api.post("/ddr/search-groups", body);
      await queryClient.invalidateQueries({ queryKey: ["ddr", "search-groups"] });
      setEditor(null);
    } catch (e) { setError(String(e)); } finally { setGroupBusy(false); }
  }
  async function deleteGroup(g: SearchGroup) {
    if (!window.confirm(`Delete saved search “${g.name}”?`)) return;
    setError(null);
    try {
      await api.del(`/ddr/search-groups/${encodeURIComponent(g.name)}`);
      await queryClient.invalidateQueries({ queryKey: ["ddr", "search-groups"] });
    } catch (e) { setError(String(e)); }
  }
  // Category headers: rename moves every item under it; delete removes them all.
  // (Adding a header = type a new category name in the editor when saving an item.)
  async function renameCat(cat: string) {
    const next = window.prompt(`Rename category “${cat}” to:`, cat);
    if (next == null || !next.trim() || next.trim() === cat) return;
    setError(null);
    try {
      await api.put("/ddr/search-groups/category", { oldName: cat, newName: next.trim() });
      await queryClient.invalidateQueries({ queryKey: ["ddr", "search-groups"] });
    } catch (e) { setError(String(e)); }
  }
  async function deleteCat(cat: string, count: number) {
    if (!window.confirm(`Delete category “${cat}” and its ${count} saved search(es)?`)) return;
    setError(null);
    try {
      await api.del(`/ddr/search-groups/category/${encodeURIComponent(cat)}`);
      await queryClient.invalidateQueries({ queryKey: ["ddr", "search-groups"] });
    } catch (e) { setError(String(e)); }
  }
  function clearAll() {
    setAndKw(""); setOrKw(""); setNotKw(""); setDateFrom(""); setDateTo(""); setOnlyTimed(false);
    setSelFields([]); setSelWells([]); setSelHole([]); setSelMud([]); setSelRigs([]); setSelOps([]);
    setResult(null);
  }
  function exportCsv() {
    if (!result?.rows.length) return;
    const cols = view === "summary" ? SUMMARY_COLS : REMARKS_COLS;
    const cell = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
    const lines = [cols.map(([, l]) => l).join(",")];
    for (const r of result.rows) lines.push(cols.map(([k]) => cell(fmt(r[k]))).join(","));
    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `ddr_${view}_${dateFrom || "all"}.csv`;
    a.click();
  }

  return (
    <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4 overflow-hidden">
      {/* Facets + saved searches */}
      <div className="flex flex-col min-h-0 bg-white border border-gray-200 rounded p-3 overflow-y-auto">
        <MultiSelect title="Fields" items={(o?.fields ?? []).map((f) => ({ value: f, label: f, keywords: [...(fieldKeywords.get(f) ?? [])].join(" ") }))} selected={selFields} onChange={setSelFields} />
        <MultiSelect title={selFields.length ? `Wells · in ${selFields.length} field(s)` : "Wells"} items={wellItems} selected={selWells} onChange={setSelWells} />
        <MultiSelect title="Bit sizes" items={facet.holeSizes.map((h) => ({ value: h, label: h }))} selected={selHole} onChange={setSelHole} />
        <MultiSelect title="Mud types" items={facet.mudTypes.map((m) => ({ value: m, label: m }))} selected={selMud} onChange={setSelMud} />
        <MultiSelect title="Rigs" items={(o?.rigs ?? []).map((r) => ({ value: r, label: r }))} selected={selRigs} onChange={setSelRigs} />
        <MultiSelect title="Operations" items={(o?.operations ?? []).map((op) => ({ value: op.code, label: opLabel(op.code), hint: op.desc }))} selected={selOps} onChange={setSelOps} />

        <div className="pt-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-600">Saved searches ({groupsQ.data?.length ?? 0})</span>
            <button onClick={() => openNewGroup()} title="Save the current keywords as a new group" className="text-[11px] text-blue-600 hover:underline">＋ New</button>
          </div>
          <input value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)} placeholder="Filter groups…" className="w-full mb-1 h-7 border border-gray-300 rounded px-1.5 text-xs" />
          <div className="max-h-60 overflow-y-auto">
            {[...groupsByCat.entries()].map(([cat, gs]) => (
              <div key={cat}>
                <div className="group/cat flex items-center gap-0.5 sticky top-0 bg-white py-0.5">
                  <span className="flex-1 min-w-0 text-[10px] font-semibold uppercase text-blue-700 truncate">{cat} ({gs.length})</span>
                  <button onClick={() => openNewGroup(cat)} title={`Add a saved search to “${cat}”`} className="shrink-0 px-1 text-gray-400 hover:text-green-700 text-[12px] leading-none opacity-0 group-hover/cat:opacity-100">＋</button>
                  <button onClick={() => renameCat(cat)} title="Rename category (moves all its items)" className="shrink-0 px-1 text-gray-400 hover:text-blue-700 text-[11px] opacity-0 group-hover/cat:opacity-100">✎</button>
                  <button onClick={() => deleteCat(cat, gs.length)} title="Delete category + its saved searches" className="shrink-0 px-1 text-gray-400 hover:text-red-600 text-[11px] opacity-0 group-hover/cat:opacity-100">✕</button>
                </div>
                {gs.map((g, i) => (
                  <div key={`${g.name}-${i}`} className="group/g flex items-center gap-0.5 rounded hover:bg-blue-50">
                    <button onClick={() => applyGroup(g)}
                      title={`AND: ${g.and.join(" ") || "-"}\nOR: ${g.or.join(" ") || "-"}\nNOT: ${g.not.join(" ") || "-"}`}
                      className="flex-1 min-w-0 text-left px-1.5 py-0.5 text-[11px] text-gray-700 truncate">
                      {g.name}
                    </button>
                    <button onClick={() => openEditGroup(g)} title="Edit" className="shrink-0 px-1 text-gray-400 hover:text-blue-700 text-[11px] opacity-0 group-hover/g:opacity-100">✎</button>
                    <button onClick={() => deleteGroup(g)} title="Delete" className="shrink-0 px-1 text-gray-400 hover:text-red-600 text-[11px] opacity-0 group-hover/g:opacity-100">✕</button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Search + results */}
      <div className="flex flex-col min-h-0 gap-3">
        <div className="bg-white border border-gray-200 rounded p-3 shrink-0 space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <KwInput label="AND (all of)" value={andKw} onChange={setAndKw} placeholder="STUCK, FISHING" />
            <KwInput label="OR (any of)" value={orKw} onChange={setOrKw} placeholder="W&R, WASH AND REAM" />
            <KwInput label="NOT (none of)" value={notKw} onChange={setNotKw} placeholder="BIT" />
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="block">
              <span className="text-[11px] text-gray-500 block mb-0.5">Date from (Jalali)</span>
              <JalaliDatePicker value={dateFrom} onChange={setDateFrom} placeholder="1390/01/01" />
            </label>
            <label className="block">
              <span className="text-[11px] text-gray-500 block mb-0.5">Date to (Jalali)</span>
              <JalaliDatePicker value={dateTo} onChange={setDateTo} placeholder="1392/12/29" />
            </label>
            <label
              className={`inline-flex items-center gap-1.5 text-xs h-9 select-none ${view === "summary" ? "text-gray-300 cursor-not-allowed" : "text-gray-600 cursor-pointer"}`}
              title={view === "summary" ? "“Time included” applies to REMARKS only" : "Only operations that have a from/to time"}
            >
              <input type="checkbox" checked={onlyTimed} disabled={view === "summary"} onChange={(e) => setOnlyTimed(e.target.checked)} className="rounded border-gray-300" />
              Time included
            </label>
            <button onClick={() => runSearch()} disabled={loading} className="h-9 px-4 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300">{loading ? "Searching…" : "Run search"}</button>
            <button onClick={clearAll} className="h-9 px-3 text-sm rounded border border-gray-300 hover:bg-gray-50">Clear</button>
            <button onClick={exportCsv} disabled={!result?.rows.length} className="h-9 px-3 text-sm rounded bg-green-700 text-white hover:bg-green-800 disabled:bg-gray-300">Export CSV</button>
            <div className="inline-flex rounded border border-gray-300 overflow-hidden ml-auto" title="REMARKS = per operation · SUMMARY = per day (daily report narrative)">
              {(["remarks", "summary"] as const).map((m) => (
                <button key={m} onClick={() => { setView(m); if (result || loading) runSearch(m); }}
                  className={`px-3 h-9 text-xs uppercase ${view === m ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>{m}</button>
              ))}
            </div>
          </div>
          {error && <div className="text-xs text-red-600">{error}</div>}
        </div>

        <div className="bg-white border border-gray-200 rounded flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-100 text-sm text-gray-600 shrink-0 flex items-center justify-between gap-2">
            <span>
              {result
                ? <>Found <span className="font-semibold">{result.count.toLocaleString()}</span> {(result.mode ?? view) === "summary" ? "daily summaries" : "operations"}{result.truncated ? ` (capped at ${result.limit.toLocaleString()})` : ""}{result.note ? ` — ${result.note}` : ""}</>
                : "Run search to list everything — or pick filters & keywords to narrow (nothing selected = all)."}
            </span>
            {onOpenReport && result && result.rows.length > 0 && (
              <span className="text-[11px] text-gray-400 whitespace-nowrap">Click a row to open its daily report →</span>
            )}
          </div>
          <div className="overflow-auto flex-1 min-h-0">
            {result && (
              <ResultTable
                cols={view === "summary" ? SUMMARY_COLS : REMARKS_COLS}
                rows={result.rows}
                onOpen={onOpenReport ? (r) => { if (r.serialNo != null) onOpenReport(r.wellCode, r.serialNo, r.date); } : undefined}
              />
            )}
          </div>
        </div>
      </div>

      {editor && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => !groupBusy && setEditor(null)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-4 space-y-2" onClick={(e) => e.stopPropagation()}>
            <div className="text-sm font-semibold text-gray-900">{editor.originalName ? "Edit saved search" : "New saved search"}</div>
            <label className="block">
              <span className="text-[11px] text-gray-500 block mb-0.5">Category</span>
              <input value={editor.category} onChange={(e) => setEditor({ ...editor, category: e.target.value })} list="ddr-group-cats"
                className="w-full h-9 border border-gray-300 rounded px-2 text-sm" />
              <datalist id="ddr-group-cats">{[...new Set((groupsQ.data ?? []).map((g) => g.category))].map((c) => <option key={c} value={c} />)}</datalist>
            </label>
            <KwInput label="Name" value={editor.name} onChange={(v) => setEditor({ ...editor, name: v })} placeholder="e.g. STUCK PIPE EVENTS" />
            <KwInput label="AND (all of)" value={editor.and} onChange={(v) => setEditor({ ...editor, and: v })} placeholder="STUCK, FISHING" />
            <KwInput label="OR (any of)" value={editor.or} onChange={(v) => setEditor({ ...editor, or: v })} placeholder="W&R, WASH" />
            <KwInput label="NOT (none of)" value={editor.not} onChange={(v) => setEditor({ ...editor, not: v })} placeholder="BIT" />
            <div className="text-[10px] text-gray-400">Keywords are space/comma separated; saved to the DDR database (FIELDDATA).</div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setEditor(null)} disabled={groupBusy} className="h-8 px-3 text-sm rounded border border-gray-300 hover:bg-gray-50">Cancel</button>
              <button onClick={saveGroup} disabled={groupBusy || !editor.name.trim()} className="h-8 px-4 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300">{groupBusy ? "Saving…" : "Save"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ResultTable({ cols, rows, onOpen }: {
  cols: [keyof SearchRow, string][]; rows: SearchRow[]; onOpen?: (r: SearchRow) => void;
}) {
  if (!rows.length) return <div className="p-8 text-center text-sm text-gray-400">No results.</div>;
  return (
    <table className="w-full text-[11px] tabular-nums">
      <thead className="bg-gray-50 sticky top-0">
        <tr className="text-gray-500 text-left">
          {cols.map(([k, l]) => <th key={String(k)} className="font-medium px-2 py-1.5 whitespace-nowrap">{l}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const clickable = !!onOpen && r.serialNo != null;
          return (
            <tr
              key={i}
              onClick={clickable ? () => onOpen!(r) : undefined}
              className={`${i % 2 ? "bg-gray-50/50" : ""} ${clickable ? "cursor-pointer hover:bg-blue-50" : ""}`}
              title={clickable ? "Open this day's daily drilling report" : undefined}
            >
              {cols.map(([k]) => (
                <td key={String(k)} className={`px-2 py-1 text-gray-700 ${k === "description" ? "min-w-[360px]" : "whitespace-nowrap"}`}
                  title={k === "description" ? fmt(r[k]) : undefined}>{fmt(r[k])}</td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function KwInput({ label, value, onChange, placeholder, small }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; small?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-[11px] text-gray-500 block mb-0.5">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className={`${small ? "w-36" : "w-full"} h-9 border border-gray-300 rounded px-2 text-sm`} />
    </label>
  );
}

/** Collapsible, searchable checklist with select-all. */
export function MultiSelect({ title, items, selected, onChange }: {
  title: string; items: Item[]; selected: string[]; onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const sel = new Set(selected);
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    // Partial, case-insensitive: "ab" → "Aban" (field) / "ABAN-005" (well) and,
    // for wells/operations, also matches the code / description via keywords.
    return t ? items.filter((i) => i.label.toLowerCase().includes(t) || (i.keywords ?? "").toLowerCase().includes(t)) : items;
  }, [items, q]);
  const allSel = selected.length > 0 && selected.length === items.length;
  const toggle = (v: string) => onChange(sel.has(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  const labelOf = (v: string) => items.find((i) => i.value === v)?.label ?? v;
  const iconOf = (v: string) => items.find((i) => i.value === v)?.icon;
  return (
    <div className="border-b border-gray-100">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between py-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-600 hover:text-gray-900">
        <span>{title}{selected.length > 0 && <span className="text-blue-600"> ({selected.length})</span>}</span>
        <span className="text-gray-400">{open ? "▾" : "▸"}</span>
      </button>
      {/* Selected items shown separately as removable chips (uncheck with ×),
          so they're visible without scrolling the full list. */}
      {selected.length > 0 && !allSel && (
        <div className="flex flex-wrap gap-1 pb-1 max-h-20 overflow-y-auto">
          {selected.slice(0, 40).map((v) => (
            <span key={v} className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 rounded px-1.5 py-0.5 text-[10px] max-w-[150px]">
              {iconOf(v)}
              <span className="truncate">{labelOf(v)}</span>
              <button type="button" onClick={() => toggle(v)} className="text-blue-500 hover:text-blue-900 leading-none shrink-0" title="Remove">×</button>
            </span>
          ))}
          {selected.length > 40 && <span className="text-[10px] text-gray-400 self-center">+{selected.length - 40} more</span>}
        </div>
      )}
      {open && (
        <div className="pb-1">
          <div className="flex items-center gap-2 mb-1">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter…" className="flex-1 h-7 border border-gray-300 rounded px-1.5 text-xs" />
            <button onClick={() => onChange(allSel ? [] : items.map((i) => i.value))} className="text-[10px] text-blue-600 hover:underline whitespace-nowrap">{allSel ? "None" : "All"}</button>
          </div>
          <div className="max-h-44 overflow-y-auto">
            {filtered.length === 0 ? <div className="text-[11px] text-gray-400 px-1 py-1">none</div> :
              filtered.map((i) => (
                <label key={i.value} className="flex items-center gap-1.5 px-1 py-0.5 text-[11px] text-gray-700 hover:bg-gray-50 cursor-pointer">
                  <input type="checkbox" checked={sel.has(i.value)} onChange={() => toggle(i.value)} className="rounded border-gray-300" />
                  {i.icon}
                  <span className="truncate" title={i.hint || i.label}>{i.label}</span>
                </label>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
