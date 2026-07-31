/**
 * Formation & Lithology tab.
 *
 * Two top-level views over the same facet selection (Fields / Wells / Bit sizes /
 * Mud types):
 *
 *   • SUMMARY (default) — a manager/geologist KPI dashboard, computed client-side
 *     from /ddr/formation-prognosis + /ddr/lithology-table for the selected wells:
 *       – headline KPI cards (wells, formations, logged interval, deepest top,
 *         loss-prone / mobile formations);
 *       – a formation-tops table in stratigraphic order (mean top MD across the
 *         offset wells, spread/std uncertainty band, median thickness, the hole
 *         section the top sits in, and mud-loss exposure) with an inline depth-
 *         range bar — the prognosis-style "where do I expect each top" view;
 *       – a lithology-composition summary (% of logged footage by rock type, with
 *         the LITHO/*.bmp colour + pattern swatches);
 *       – an SVG formation-tops range chart (min–mean–max MD per formation across
 *         wells) and a lithology-share bar.
 *
 *   • BROWSE — the existing multi-well browser (FormationMatrix): the Form./Litho.
 *     tops cross-tab, the lithology + formation Graph, and the Prognosis sub-views
 *     (top prognosis / correlation / thickness / hazards). Its sidebar is bound to
 *     the SAME shared selection, so switching view keeps the Fields / Wells / Bit
 *     size / Mud type picks (each view still has its own Show button + results).
 *
 * Only this file is authored here; the Summary fetches the same /ddr/* endpoints
 * FormationMatrix already uses, so nothing else changes.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client.js";
import { MultiSelect, type Item } from "./DdrRemarksSearch.js";
import { useFacetOptions } from "./useFacetOptions.js";
import { useDdrSelection } from "./ddrSelection.js";
import { FormationMatrix } from "./FormationMatrix.js";

interface SearchOptions {
  fields: string[]; wells: { code: string; name: string; field: string | null }[];
  holeSizes: string[]; mudTypes: string[]; rigs: string[];
}

// ── Shapes returned by /ddr/formation-prognosis + /ddr/lithology-table ───────
interface TopStat { formation: string; n: number; min: number; mean: number; median: number; max: number; std: number; spread: number }
interface ThickStat { formation: string; n: number; min: number; median: number; max: number; section: string | null }
interface Hazard { formation: string; meanDepth: number | null; lossEvents: number; lossVol: number; mobile: boolean }
interface PrognosisData {
  prognosis: TopStat[]; thickness: ThickStat[];
  wells: { wellCode: string; name: string; tops: { name: string; md: number }[] }[];
  hazards: Hazard[]; wellCount: number; depthRange: { min: number; max: number } | null;
  truncatedWells?: boolean; note?: string;
}
interface LithoComp { name: string; pct: number; pattern: string; color: string }
interface LithoData {
  rows: { wellCode: string; from: number; to: number | null; bitSize: string | null; mudType: string | null; comps: LithoComp[] }[];
  lithoTypes: string[]; truncated?: boolean; total?: number; note?: string;
}

// ── Small shared helpers (kept local — no edits to shared components) ─────────
const numFmt = (v: number | null | undefined) =>
  v == null || !Number.isFinite(v) ? "—" : Math.round(v).toLocaleString();

/** Rock colour + pattern swatch (LITHO/<name>.bmp tile), matching the Litho. table. */
function LSwatch({ color, pattern, size = 11 }: { color: string; pattern?: string; size?: number }) {
  return (
    <span className="inline-block rounded-sm border border-gray-300 align-middle shrink-0" style={{
      width: size, height: size, backgroundColor: color,
      backgroundImage: pattern ? `url(/api/ddr/litho-pattern/${pattern})` : undefined,
      backgroundBlendMode: "multiply", backgroundSize: `${size + 6}px`,
    }} />
  );
}

/** Floating HTML tooltip for the hand-rolled SVG charts (same helper as TimeAnalysis). */
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

/** Stable hue per formation, shared by the tops table marker + range chart. */
function hueOf(name: string): number {
  let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h % 360;
}
const formColor = (name: string) => `hsl(${hueOf(name)} 55% 45%)`;

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

export function FormationLithology() {
  const [view, setView] = useState<"summary" | "browse">("summary");
  // Shared across tabs (see ddrSelection) so the facet picks survive a tab switch.
  const {
    fields: selFields, setFields: setSelFields, wells: selWells, setWells: setSelWells,
    holeSizes: selHole, setHoleSizes: setSelHole, mudTypes: selMud, setMudTypes: setSelMud,
  } = useDdrSelection();

  // Snapshotted facets that produced the last Show — the Summary fetches from these.
  const [filters, setFilters] = useState<{ fields: string[]; wells: string[]; holeSizes: string[]; mudTypes: string[] } | null>(null);

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

  function run() {
    setFilters({ fields: selFields, wells: selWells, holeSizes: selHole, mudTypes: selMud });
  }
  function clearAll() {
    setSelFields([]); setSelWells([]); setSelHole([]); setSelMud([]); setFilters(null);
  }

  // BROWSE re-uses the multi-well browser (Show / Clear / Tables / Graphs /
  // Prognosis). It renders its own copy of the sidebar — bound to the same shared
  // selection — so the Summary sidebar is hidden here rather than sitting beside it.
  if (view === "browse") {
    return (
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="px-1 pb-2 shrink-0 flex items-center justify-end">
          <ViewToggle view={view} setView={setView} />
        </div>
        <FormationMatrix />
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4 overflow-hidden">
      <div className="flex flex-col min-h-0 bg-white border border-gray-200 rounded p-3 overflow-y-auto">
        <MultiSelect title="Fields" items={(o?.fields ?? []).map((f) => ({ value: f, label: f }))} selected={selFields} onChange={setSelFields} />
        <MultiSelect title={selFields.length ? `Wells · in ${selFields.length} field(s)` : "Wells"} items={wellItems} selected={selWells} onChange={setSelWells} />
        <MultiSelect title="Bit sizes" items={facet.holeSizes.map((h) => ({ value: h, label: h }))} selected={selHole} onChange={setSelHole} />
        <MultiSelect title="Mud types" items={facet.mudTypes.map((m) => ({ value: m, label: m }))} selected={selMud} onChange={setSelMud} />
        <div className="flex gap-2 pt-3">
          <button onClick={run} className="h-9 px-4 text-sm rounded bg-blue-600 text-white hover:bg-blue-700">Show summary</button>
          <button onClick={clearAll} className="h-9 px-3 text-sm rounded border border-gray-300 hover:bg-gray-50">Clear</button>
        </div>
        <p className="text-[10px] text-gray-400 leading-snug pt-3">
          The summary synthesises the selected wells' formation tops and lithology log into a
          KPI dashboard. Switch to <b>Browse</b> for the per-well tops cross-tab, lithology graph and prognosis sub-views.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded flex flex-col min-h-0 overflow-hidden">
        <div className="px-3 py-2 border-b border-gray-100 shrink-0 flex items-center justify-end gap-2">
          <ViewToggle view={view} setView={setView} />
        </div>
        <div className="overflow-auto flex-1 min-h-0">
          <FormationSummary filters={filters} />
        </div>
      </div>
    </div>
  );
}

function ViewToggle({ view, setView }: { view: "summary" | "browse"; setView: (v: "summary" | "browse") => void }) {
  return (
    <div className="inline-flex rounded border border-gray-300 overflow-hidden">
      {(["summary", "browse"] as const).map((v) => (
        <button key={v} onClick={() => setView(v)} className={`px-2.5 h-7 text-xs capitalize ${view === v ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>{v}</button>
      ))}
    </div>
  );
}

// ── Summary dashboard ────────────────────────────────────────────────────────

/** % of logged footage (interval length, evenly split across that interval's
 *  components) by rock type — a true thickness-weighted composition. */
interface LithoShare { name: string; metres: number; pct: number; color: string; pattern: string }
function lithoShares(data: LithoData | undefined): { shares: LithoShare[]; totalLogged: number } {
  if (!data) return { shares: [], totalLogged: 0 };
  const m = new Map<string, { metres: number; color: string; pattern: string }>();
  let totalLogged = 0;
  for (const r of data.rows) {
    const len = r.to != null && r.to > r.from ? r.to - r.from : 0;
    if (len <= 0 || !r.comps.length) continue;
    totalLogged += len;
    // Weight each rock by the interval length × its % share of that interval.
    const sumPct = r.comps.reduce((a, c) => a + (c.pct > 0 ? c.pct : 0), 0) || 1;
    for (const c of r.comps) {
      const w = (len * (c.pct > 0 ? c.pct : 0)) / sumPct;
      const e = m.get(c.name) ?? { metres: 0, color: c.color, pattern: c.pattern };
      e.metres += w; m.set(c.name, e);
    }
  }
  const grand = [...m.values()].reduce((a, e) => a + e.metres, 0) || 1;
  const shares = [...m.entries()]
    .map(([name, e]) => ({ name, metres: e.metres, pct: (100 * e.metres) / grand, color: e.color, pattern: e.pattern }))
    .sort((a, b) => b.metres - a.metres);
  return { shares, totalLogged };
}

function FormationSummary({ filters }: { filters: { fields: string[]; wells: string[]; holeSizes: string[]; mudTypes: string[] } | null }) {
  const enabled = !!filters && (filters.fields.length > 0 || filters.wells.length > 0);
  const progQ = useQuery({
    queryKey: ["ddr", "formation-prognosis", "summary", filters],
    queryFn: () => api.post<PrognosisData>("/ddr/formation-prognosis", filters),
    enabled,
  });
  const lithoQ = useQuery({
    queryKey: ["ddr", "lithology-table", "summary", filters],
    queryFn: () => api.post<LithoData>("/ddr/lithology-table", filters),
    enabled,
  });

  const prog = progQ.data;
  const litho = lithoQ.data;
  const { shares, totalLogged } = useMemo(() => lithoShares(litho), [litho]);

  // Per-formation join: tops stat + thickness + hazard, in stratigraphic order.
  const formRows = useMemo(() => {
    if (!prog) return [];
    const thickBy = new Map(prog.thickness.map((t) => [t.formation, t]));
    const hazBy = new Map(prog.hazards.map((h) => [h.formation, h]));
    return prog.prognosis.map((p) => ({
      ...p,
      thick: thickBy.get(p.formation) ?? null,
      hazard: hazBy.get(p.formation) ?? null,
    }));
  }, [prog]);

  if (!enabled) return <Empty>Pick a field or well, then press <b>Show summary</b>.</Empty>;
  if ((progQ.isLoading && !prog) || (lithoQ.isLoading && !litho)) return <Empty>Loading formation tops &amp; lithology…</Empty>;
  if (progQ.error) return <Empty>{String(progQ.error)}</Empty>;
  if (prog?.note) return <Empty>{prog.note}</Empty>;
  if (!prog || !prog.prognosis.length) return <Empty>None of the selected wells have formation tops recorded.</Empty>;

  // Headline KPIs.
  const deepest = prog.prognosis.reduce<TopStat | null>((acc, p) => (acc == null || p.mean > acc.mean ? p : acc), null);
  const lossForms = prog.hazards.filter((h) => h.lossVol > 0).length;
  const mobileForms = prog.hazards.filter((h) => h.mobile).length;
  const totalLossVol = prog.hazards.reduce((a, h) => a + h.lossVol, 0);
  const maxMaxDepth = Math.max(...prog.prognosis.map((p) => p.max), 1);
  const maxThick = Math.max(1, ...prog.thickness.map((t) => t.max));

  return (
    <div className="p-3 space-y-5 text-[11px]">
      {/* Headline KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2">
        <Kpi label="Offset wells" value={String(prog.wellCount)} sub={prog.truncatedWells ? "tops capped at 12 in correlation" : "with formation tops"} />
        <Kpi label="Formations" value={String(prog.prognosis.length)} sub="distinct tops" />
        <Kpi label="Deepest top" value={deepest ? `${numFmt(deepest.mean)} m` : "—"} sub={deepest?.formation} />
        <Kpi label="Logged interval" value={totalLogged > 0 ? `${numFmt(totalLogged)} m` : "—"} sub={`${shares.length} rock type${shares.length === 1 ? "" : "s"}`} />
        <Kpi label="Loss-prone" value={String(lossForms)} sub={totalLossVol > 0 ? `${numFmt(totalLossVol)} bbl lost` : "formations"} tone={lossForms > 0 ? "red" : undefined} />
        <Kpi label="Mobile salt / anhy." value={String(mobileForms)} sub="creep / loss risk" tone={mobileForms > 0 ? "amber" : undefined} />
      </div>

      {/* Formation tops table — stratigraphic order, mean MD + uncertainty + thickness + section + loss */}
      <section>
        <h3 className="font-semibold text-gray-700 mb-1">
          Formation tops <span className="font-normal text-gray-400">— prognosed depth across the offset wells, shallow → deep</span>
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full tabular-nums border-collapse">
            <thead>
              <tr>
                <Th>Formation</Th>
                <Th r title="Wells with this top recorded">n</Th>
                <Th r title="Mean top depth (MD) across the offset wells">Mean MD</Th>
                <Th r title="Standard deviation of the top depth — prognosis uncertainty">± Std</Th>
                <Th r title="Min–max depth spread across wells">Spread</Th>
                <Th r title="Median interval thickness (next top − this top)">Thickness</Th>
                <Th>Hole section</Th>
                <Th r title="Mud lost inside this formation across the offsets">Loss (bbl)</Th>
                <th className="bg-gray-100 border border-gray-200 px-2 py-1 font-medium text-gray-600 text-left w-[22%]">Depth range (m)</th>
              </tr>
            </thead>
            <tbody>
              {formRows.map((r, i) => (
                <tr key={r.formation} className={i % 2 ? "bg-teal-50/30" : "bg-white"}>
                  <td className="border border-gray-200 px-2 py-0.5 text-left font-medium text-gray-800 whitespace-nowrap">
                    {r.hazard?.mobile && <span title="Mobile salt / anhydrite" className="text-amber-600 mr-0.5">⬡</span>}
                    <span className="inline-block w-2 h-2 rounded-sm mr-1 align-middle" style={{ background: formColor(r.formation) }} />{r.formation}
                  </td>
                  <td className="border border-gray-200 px-2 py-0.5 text-right text-gray-500">{r.n}</td>
                  <td className="border border-gray-200 px-2 py-0.5 text-right font-semibold text-gray-900">{numFmt(r.mean)}</td>
                  <td className="border border-gray-200 px-2 py-0.5 text-right text-gray-500">±{numFmt(r.std)}</td>
                  <td className="border border-gray-200 px-2 py-0.5 text-right text-gray-500">{numFmt(r.spread)}</td>
                  <td className="border border-gray-200 px-2 py-0.5 text-right text-gray-700">{r.thick ? numFmt(r.thick.median) : "—"}</td>
                  <td className="border border-gray-200 px-2 py-0.5 text-left text-gray-600 whitespace-nowrap">{r.thick?.section ?? "—"}</td>
                  <td className={`border border-gray-200 px-2 py-0.5 text-right ${r.hazard && r.hazard.lossVol > 0 ? "text-red-600 font-medium" : "text-gray-400"}`}>
                    {r.hazard && r.hazard.lossVol > 0 ? numFmt(r.hazard.lossVol) : "—"}
                  </td>
                  <td className="border border-gray-200 px-2 py-0.5">
                    <div className="relative h-3 bg-gray-100 rounded" title={`${numFmt(r.min)}–${numFmt(r.max)} m`}>
                      <div className="absolute h-full rounded" style={{ left: `${(r.min / maxMaxDepth) * 100}%`, width: `${Math.max(1, ((r.max - r.min) / maxMaxDepth) * 100)}%`, background: formColor(r.formation), opacity: 0.45 }} />
                      <div className="absolute top-[-1px] h-[14px] w-0.5" style={{ left: `${(r.mean / maxMaxDepth) * 100}%`, background: formColor(r.formation) }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-gray-400 leading-snug pt-1">
          Plan the next well's top near the <b>mean</b>; the <b>std / spread</b> is the prognosis uncertainty for setting casing points.
          Bar = min–max range, tick = mean. ⬡ = mobile salt / anhydrite.
        </p>
      </section>

      {/* Lithology composition */}
      {shares.length > 0 && (
        <section>
          <h3 className="font-semibold text-gray-700 mb-1">
            Lithology composition <span className="font-normal text-gray-400">— % of logged footage by rock type</span>
          </h3>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <table className="w-full tabular-nums border-collapse self-start">
              <thead><tr><Th>Rock type</Th><Th r>Footage (m)</Th><th className="bg-gray-100 border border-gray-200 px-2 py-1 font-medium text-gray-600 text-right w-[42%]">Share</th></tr></thead>
              <tbody>
                {shares.slice(0, 16).map((s, i) => (
                  <tr key={s.name} className={i % 2 ? "bg-gray-50/60" : "bg-white"}>
                    <td className="border border-gray-200 px-2 py-0.5 text-left whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5"><LSwatch color={s.color} pattern={s.pattern || undefined} /> {s.name}</span>
                    </td>
                    <td className="border border-gray-200 px-2 py-0.5 text-right text-gray-600">{numFmt(s.metres)}</td>
                    <td className="border border-gray-200 px-2 py-0.5">
                      <div className="flex items-center gap-1.5">
                        <div className="flex-1 h-2.5 bg-gray-100 rounded-sm overflow-hidden">
                          <div className="h-full rounded-sm" style={{ width: `${s.pct}%`, background: s.color }} />
                        </div>
                        <span className="w-12 text-right text-gray-600">{s.pct.toFixed(1)}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <LithoShareBar shares={shares} />
          </div>
          {litho?.truncated && <p className="text-[10px] text-amber-600 pt-1">Lithology log capped at {litho.total?.toLocaleString()} intervals — composition is over the sampled footage.</p>}
        </section>
      )}

      {/* Formation tops range chart */}
      <section>
        <h3 className="font-semibold text-gray-700 mb-1">
          Formation top depths across wells <span className="font-normal text-gray-400">— min · mean · max (MD)</span>
        </h3>
        <FormationRangeChart rows={prog.prognosis} maxMax={maxMaxDepth} />
      </section>

      {/* Formation thickness chart (casing-seat planning) */}
      {prog.thickness.length > 0 && (
        <section>
          <h3 className="font-semibold text-gray-700 mb-1">
            Formation thickness <span className="font-normal text-gray-400">— median interval (m), for casing-seat planning</span>
          </h3>
          <ThicknessChart rows={prog.thickness} maxThick={maxThick} />
        </section>
      )}

      <p className="text-[10px] text-gray-400 leading-snug">
        Depths are MD as recorded in the daily reports' formation tops (D07) and lithology log (DailyLitologyDecription).
        Thickness = next top − this top per well (median across offsets). Loss exposure maps the daily mud-loss volumes into each
        formation's depth interval.
      </p>
    </div>
  );
}

/** 100% horizontal stacked bar of lithology share by rock type (top 14 + Other). */
function LithoShareBar({ shares }: { shares: LithoShare[] }) {
  const hover = useSvgHover();
  const top = shares.slice(0, 14);
  const otherPct = shares.slice(14).reduce((a, s) => a + s.pct, 0);
  const segs = otherPct > 0
    ? [...top, { name: "Other", metres: shares.slice(14).reduce((a, s) => a + s.metres, 0), pct: otherPct, color: "#94a3b8", pattern: "" } as LithoShare]
    : top;
  const W = 520, barH = 34, PAD = 4;
  let x = PAD;
  return (
    <div className="relative self-start">
      <svg width={W} height={barH + 8} className="block max-w-full">
        {segs.map((s) => {
          const w = (s.pct / 100) * (W - 2 * PAD);
          const html = `<b>${s.name}</b><br/>${Math.round(s.metres).toLocaleString()} m · ${s.pct.toFixed(1)}%`;
          const seg = (
            <g key={s.name}>
              <rect x={x} y={4} width={Math.max(0, w)} height={barH} fill={s.color} stroke="#fff" strokeWidth={0.5}
                onMouseEnter={hover.enter(html)} onMouseMove={hover.enter(html)} onMouseLeave={hover.leave} />
              {w > 30 && <text x={x + w / 2} y={4 + barH / 2 + 3} textAnchor="middle" fontSize={9} fill="#fff" fontWeight={600}>{s.pct.toFixed(0)}%</text>}
            </g>
          );
          x += w;
          return seg;
        })}
      </svg>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[10px] text-gray-600">
        {segs.map((s) => (
          <span key={s.name} className="inline-flex items-center gap-1">
            <LSwatch color={s.color} pattern={s.pattern || undefined} size={10} />{s.name} <span className="text-gray-400">{s.pct.toFixed(1)}%</span>
          </span>
        ))}
      </div>
      {hover.node}
    </div>
  );
}

/** Per-formation depth range (min–max MD) as horizontal bars with a mean tick,
 *  shallow → deep — the multi-well stratigraphic depth profile. */
function FormationRangeChart({ rows, maxMax }: { rows: TopStat[]; maxMax: number }) {
  const hover = useSvgHover();
  if (!rows.length) return <Empty>No formation tops to chart.</Empty>;
  const PAD = { l: 150, r: 56, t: 8, b: 26 };
  const rowH = 20, plotW = 460;
  const W = PAD.l + plotW + PAD.r, H = PAD.t + rows.length * rowH + PAD.b;
  const xOf = (d: number) => PAD.l + (d / maxMax) * plotW;
  const ticks = niceTicks(0, maxMax, 6);
  return (
    <div className="relative">
      <div className="overflow-x-auto">
        <svg width={W} height={H} className="block">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={xOf(t)} x2={xOf(t)} y1={PAD.t} y2={PAD.t + rows.length * rowH} stroke="#eef2f7" />
              <text x={xOf(t)} y={PAD.t + rows.length * rowH + 16} textAnchor="middle" fontSize={9} fill="#94a3b8">{t >= 1000 ? `${(t / 1000).toFixed(1)}k` : t}</text>
            </g>
          ))}
          {rows.map((r, i) => {
            const y = PAD.t + i * rowH + 3, bh = rowH - 8;
            const x0 = xOf(r.min), x1 = xOf(r.max), xm = xOf(r.mean);
            const html = `<b>${r.formation}</b><br/>mean ${numFmt(r.mean)} m · n=${r.n}<br/>${numFmt(r.min)}–${numFmt(r.max)} m · ±${numFmt(r.std)}`;
            return (
              <g key={r.formation}>
                <text x={PAD.l - 6} y={y + bh / 2 + 3} textAnchor="end" fontSize={9} fill="#334155">{r.formation.length > 22 ? r.formation.slice(0, 21) + "…" : r.formation}</text>
                <rect x={x0} y={y} width={Math.max(1, x1 - x0)} height={bh} rx={2} fill={formColor(r.formation)} opacity={0.4}
                  onMouseEnter={hover.enter(html)} onMouseMove={hover.enter(html)} onMouseLeave={hover.leave} />
                <rect x={xm - 1} y={y - 1} width={2} height={bh + 2} fill={formColor(r.formation)} />
                <text x={x1 + 5} y={y + bh / 2 + 3} fontSize={9} fill="#475569">{numFmt(r.mean)}</text>
              </g>
            );
          })}
          <line x1={PAD.l} x2={PAD.l + plotW} y1={PAD.t + rows.length * rowH} y2={PAD.t + rows.length * rowH} stroke="#cbd5e1" />
        </svg>
      </div>
      <p className="text-[10px] text-gray-400 pt-1">Bar = min–max top depth across the offset wells; tick = mean. A wide bar means the top is harder to prognose.</p>
      {hover.node}
    </div>
  );
}

/** Per-formation median thickness (with min–max whisker), shallow → deep. */
function ThicknessChart({ rows, maxThick }: { rows: ThickStat[]; maxThick: number }) {
  const hover = useSvgHover();
  if (!rows.length) return <Empty>Not enough consecutive tops to derive thickness.</Empty>;
  const PAD = { l: 150, r: 56, t: 8, b: 26 };
  const rowH = 20, plotW = 460;
  const W = PAD.l + plotW + PAD.r, H = PAD.t + rows.length * rowH + PAD.b;
  const xOf = (d: number) => PAD.l + (d / maxThick) * plotW;
  const ticks = niceTicks(0, maxThick, 6);
  return (
    <div className="relative">
      <div className="overflow-x-auto">
        <svg width={W} height={H} className="block">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={xOf(t)} x2={xOf(t)} y1={PAD.t} y2={PAD.t + rows.length * rowH} stroke="#eef2f7" />
              <text x={xOf(t)} y={PAD.t + rows.length * rowH + 16} textAnchor="middle" fontSize={9} fill="#94a3b8">{t >= 1000 ? `${(t / 1000).toFixed(1)}k` : t}</text>
            </g>
          ))}
          {rows.map((r, i) => {
            const y = PAD.t + i * rowH + 3, bh = rowH - 8;
            const bw = xOf(r.median) - PAD.l;
            const html = `<b>${r.formation}</b><br/>median ${numFmt(r.median)} m<br/>${numFmt(r.min)}–${numFmt(r.max)} m · n=${r.n}${r.section ? `<br/>${r.section}` : ""}`;
            return (
              <g key={r.formation}>
                <text x={PAD.l - 6} y={y + bh / 2 + 3} textAnchor="end" fontSize={9} fill="#334155">{r.formation.length > 22 ? r.formation.slice(0, 21) + "…" : r.formation}</text>
                <rect x={PAD.l} y={y} width={Math.max(1, bw)} height={bh} rx={2} fill={formColor(r.formation)}
                  onMouseEnter={hover.enter(html)} onMouseMove={hover.enter(html)} onMouseLeave={hover.leave} />
                {/* min–max whisker */}
                <line x1={xOf(r.min)} x2={xOf(r.max)} y1={y + bh / 2} y2={y + bh / 2} stroke="#475569" strokeWidth={1} opacity={0.6} />
                <text x={Math.max(xOf(r.median), xOf(r.max)) + 5} y={y + bh / 2 + 3} fontSize={9} fill="#475569">{numFmt(r.median)}</text>
              </g>
            );
          })}
          <line x1={PAD.l} x2={PAD.l + plotW} y1={PAD.t + rows.length * rowH} y2={PAD.t + rows.length * rowH} stroke="#cbd5e1" />
        </svg>
      </div>
      <p className="text-[10px] text-gray-400 pt-1">Bar = median thickness; whisker = min–max across the offset wells.</p>
      {hover.node}
    </div>
  );
}

const toneCls = (tone?: "emerald" | "amber" | "red") =>
  tone === "red" ? "text-red-600" : tone === "amber" ? "text-amber-600" : tone === "emerald" ? "text-emerald-600" : "text-gray-900";

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "emerald" | "amber" | "red" }) {
  return (
    <div className="border border-gray-200 rounded-lg px-3 py-2 bg-gradient-to-b from-white to-gray-50">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`text-lg font-bold tabular-nums leading-tight ${toneCls(tone)}`}>{value}</div>
      {sub && <div className="text-[10px] text-gray-400 truncate" title={sub}>{sub}</div>}
    </div>
  );
}

function Th({ children, r, title }: { children: React.ReactNode; r?: boolean; title?: string }) {
  return <th title={title} className={`bg-gray-100 border border-gray-200 px-2 py-1 font-medium text-gray-600 ${r ? "text-right" : "text-left"}`}>{children}</th>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="p-8 text-center text-sm text-gray-400">{children}</div>;
}
