/**
 * Mud-material PLANNING view — turns the offset wells' chemical consumption into
 * a forecast for the NEXT well. Where the Mud Stock graph answers "how much did
 * we use in total?", this answers "how much should I order for a new well of
 * these sections?" — the way offset-well material planning is actually done:
 * normalise consumption per metre drilled, split by hole section (26"/17½"/12¼"/
 * 8½"…), benchmark across wells (mean + spread), and roll it up to a cost.
 *
 * Four sub-views over one /ddr/mud-planning fetch:
 *   • PER METRE  — material × section grid of mean consumption per metre (the
 *                  core planning rates), bar-charted per material.
 *   • BENCHMARK  — per material/section: mean per-metre with the min–max offset
 *                  spread, so you pick a planning rate with a contingency.
 *   • FORECAST   — enter the new well's section lengths (m); get the material
 *                  shopping list (qty + est. cost) = Σ rate × metres.
 *   • COST       — total & per-metre mud-material cost by material (Rial/$).
 */
import { useMemo, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { api } from "../../api/client.js";

export interface PlanningFilters {
  fields: string[]; wells: string[]; holeSizes: string[];
  mudTypes: string[]; materials: string[]; dateFrom: string; dateTo: string;
}
interface Section { code: string; size: string; wells: number; metres: number }
interface SectionStat {
  code: string; size: string; used: number; metres: number; wells: number;
  perMmean: number; perMmedian: number; perMmin: number; perMmax: number;
  costR: number; costD: number;
}
interface MaterialPlan {
  material: string; unit: string;
  totalUsed: number; totalCostR: number; totalCostD: number;
  bySection: SectionStat[];
}
interface PlanningData { sections: Section[]; materials: MaterialPlan[]; wellCount: number; note?: string }

type Sub = "perMetre" | "benchmark" | "forecast" | "cost";
const SUBS: { key: Sub; label: string }[] = [
  { key: "perMetre", label: "Per metre" },
  { key: "benchmark", label: "Benchmark" },
  { key: "forecast", label: "Forecast" },
  { key: "cost", label: "Cost" },
];

// Which benchmark statistic to use as the planning rate (median is robust to the
// odd outlier well; mean matches a simple average; max is a conservative order).
type Basis = "perMmean" | "perMmedian" | "perMmax";
const BASES: { key: Basis; label: string; hint: string }[] = [
  { key: "perMmedian", label: "Median", hint: "P50 across wells — robust to outliers" },
  { key: "perMmean", label: "Mean", hint: "simple average across wells" },
  { key: "perMmax", label: "Max", hint: "worst-case (conservative order)" },
];

const PALETTE = ["#1e40af", "#dc2626", "#0d9488", "#d97706", "#7c3aed", "#65a30d", "#db2777", "#0891b2", "#ea580c", "#4f46e5", "#16a34a", "#9f1239"];
const num = (v: number, d = 0) => v == null || !Number.isFinite(v) ? "—" : v >= 1000 ? v.toLocaleString(undefined, { maximumFractionDigits: 0 }) : v.toFixed(d);
const fmtRate = (v: number) => v >= 100 ? v.toFixed(0) : v >= 1 ? v.toFixed(2) : v.toFixed(3);

export function MudPlanning({ filters }: { filters: PlanningFilters | null }) {
  const [sub, setSub] = useState<Sub>("perMetre");
  const [basis, setBasis] = useState<Basis>("perMmedian");

  const q = useQuery({
    queryKey: ["ddr", "mud-planning", filters],
    queryFn: () => api.post<PlanningData>("/ddr/mud-planning", filters),
    enabled: !!filters,
    placeholderData: keepPreviousData,
  });
  const data = q.data;

  if (!filters) return <Empty>Pick a field / well and press Show.</Empty>;
  if (q.isLoading && !data) return <Empty>Loading planning data…</Empty>;
  if (q.error) return <Empty>{String(q.error)}</Empty>;
  if (!data) return <Empty>No data.</Empty>;
  if (data.note) return <Empty>{data.note}</Empty>;
  if (!data.materials.length) return <Empty>No consumption with a resolvable hole section for this selection.</Empty>;

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="inline-flex rounded border border-gray-300 overflow-hidden">
          {SUBS.map((sv) => (
            <button key={sv.key} onClick={() => setSub(sv.key)}
              className={`px-2.5 h-7 text-xs ${sub === sv.key ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>{sv.label}</button>
          ))}
        </div>
        {(sub === "forecast" || sub === "benchmark") && (
          <label className="flex items-center gap-1.5 text-xs text-gray-600">
            Planning rate
            <select value={basis} onChange={(e) => setBasis(e.target.value as Basis)} className="h-7 border border-gray-300 rounded px-1.5 bg-white" title={BASES.find((b) => b.key === basis)?.hint}>
              {BASES.map((b) => <option key={b.key} value={b.key}>{b.label}</option>)}
            </select>
          </label>
        )}
        <span className="text-[11px] text-gray-400">
          {data.wellCount} offset well{data.wellCount === 1 ? "" : "s"} · {data.sections.length} section{data.sections.length === 1 ? "" : "s"} · per-metre rates from metres drilled in each section.
        </span>
      </div>

      {sub === "perMetre" ? <PerMetre data={data} />
        : sub === "benchmark" ? <Benchmark data={data} basis={basis} />
        : sub === "forecast" ? <Forecast data={data} basis={basis} />
        : <Cost data={data} />}
    </div>
  );
}

// ── PER METRE: material × section grid of mean consumption per metre ─────────

function PerMetre({ data }: { data: PlanningData }) {
  const sections = data.sections;
  return (
    <div className="space-y-4">
      <p className="text-[11px] text-gray-500">
        Average consumption <b>per metre drilled</b> in each hole section, across the offset wells. Read off the rate for the
        section you're planning, then multiply by that section's length. Cells show <b>unit/m</b>; hover for the well count.
      </p>
      <div className="overflow-auto">
        <table className="text-[11px] tabular-nums border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-gray-100">
              <th className="sticky left-0 z-20 bg-gray-100 border border-gray-300 px-2 py-1 text-left font-semibold text-gray-700 whitespace-nowrap">Material</th>
              <th className="bg-gray-100 border border-gray-300 px-2 py-1 text-left font-medium text-gray-600 whitespace-nowrap">Unit</th>
              {sections.map((sec) => (
                <th key={sec.code} className="bg-gray-100 border border-gray-300 px-2 py-1 text-right font-medium text-gray-700 whitespace-nowrap" title={`${num(sec.metres)} m drilled across ${sec.wells} well(s)`}>{sec.size}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.materials.map((m, ri) => {
              const bySec = new Map(m.bySection.map((b) => [b.code, b]));
              // Colour-scale each row by its own max rate (intra-material comparison).
              const rowMax = Math.max(0, ...m.bySection.map((b) => b.perMmean));
              return (
                <tr key={m.material} className={ri % 2 ? "bg-teal-50/30" : "bg-white"}>
                  <th className="sticky left-0 z-[1] bg-inherit border border-gray-300 px-2 py-0.5 text-left font-semibold text-gray-800 whitespace-nowrap">{m.material}</th>
                  <td className="border border-gray-300 px-2 py-0.5 text-left text-gray-500 whitespace-nowrap">{m.unit}</td>
                  {sections.map((sec) => {
                    const b = bySec.get(sec.code);
                    if (!b || b.perMmean <= 0) return <td key={sec.code} className="border border-gray-300 px-2 py-0.5 text-right text-gray-300">·</td>;
                    const t = rowMax > 0 ? b.perMmean / rowMax : 0;
                    return (
                      <td key={sec.code} className="border border-gray-300 px-2 py-0.5 text-right whitespace-nowrap"
                        style={{ background: `rgba(37,99,235,${(0.07 + 0.33 * t).toFixed(3)})` }}
                        title={`${m.material} · ${sec.size}: mean ${fmtRate(b.perMmean)} ${m.unit}/m · median ${fmtRate(b.perMmedian)} · range ${fmtRate(b.perMmin)}–${fmtRate(b.perMmax)} · ${b.wells} well(s), ${num(b.metres)} m`}>
                        {fmtRate(b.perMmean)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── BENCHMARK: per-metre mean with the min–max offset spread, per section ────

function Benchmark({ data, basis }: { data: PlanningData; basis: Basis }) {
  const [sel, setSel] = useState<string>(data.sections[0]?.code ?? "");
  const section = data.sections.find((s) => s.code === sel) ?? data.sections[0];
  const rows = useMemo(() => {
    return data.materials
      .map((m) => ({ material: m.material, unit: m.unit, b: m.bySection.find((x) => x.code === section?.code) }))
      .filter((r): r is { material: string; unit: string; b: SectionStat } => !!r.b && r.b.perMmax > 0)
      .sort((a, b) => b.b[basis] - a.b[basis])
      .slice(0, 20);
  }, [data, section?.code, basis]);
  const max = Math.max(0, ...rows.map((r) => r.b.perMmax));

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs">
        <span className="text-gray-600">Section</span>
        <select value={sel} onChange={(e) => setSel(e.target.value)} className="h-7 border border-gray-300 rounded px-1.5 bg-white">
          {data.sections.map((s) => <option key={s.code} value={s.code}>{s.size} · {num(s.metres)} m · {s.wells} well(s)</option>)}
        </select>
        <span className="text-gray-400">Bar = {BASES.find((b) => b.key === basis)?.label.toLowerCase()} per-metre rate; whisker = min–max across the offset wells.</span>
      </div>
      <div className="space-y-1">
        {rows.map((r) => {
          const pm = r.b[basis], w = max > 0 ? (pm / max) * 100 : 0;
          const lo = max > 0 ? (r.b.perMmin / max) * 100 : 0, hi = max > 0 ? (r.b.perMmax / max) * 100 : 0;
          return (
            <div key={r.material} className="flex items-center gap-2 text-[11px]">
              <div className="w-32 truncate text-right text-gray-700" title={r.material}>{r.material}</div>
              <div className="flex-1 relative h-5 bg-gray-50 rounded">
                {/* min–max whisker band */}
                <div className="absolute top-1/2 -translate-y-1/2 h-1 bg-blue-200 rounded" style={{ left: `${lo}%`, width: `${Math.max(0, hi - lo)}%` }} />
                {/* the planning rate bar */}
                <div className="absolute top-0.5 bottom-0.5 bg-blue-600 rounded-sm" style={{ left: 0, width: `${w}%` }} title={`${BASES.find((b) => b.key === basis)?.label}: ${fmtRate(pm)} ${r.unit}/m`} />
                {/* min/max ticks */}
                <div className="absolute top-1/2 -translate-y-1/2 w-px h-3 bg-blue-400" style={{ left: `${lo}%` }} />
                <div className="absolute top-1/2 -translate-y-1/2 w-px h-3 bg-blue-400" style={{ left: `${hi}%` }} />
              </div>
              <div className="w-40 text-gray-500 tabular-nums whitespace-nowrap">
                <b className="text-gray-800">{fmtRate(pm)}</b> {r.unit}/m <span className="text-gray-400">({fmtRate(r.b.perMmin)}–{fmtRate(r.b.perMmax)})</span>
              </div>
            </div>
          );
        })}
        {!rows.length && <Empty>No consumption recorded for this section.</Empty>}
      </div>
    </div>
  );
}

// ── FORECAST: section lengths → material shopping list (qty + cost) ──────────

function Forecast({ data, basis }: { data: PlanningData; basis: Basis }) {
  // Prefill each planned section with the offset average metres (a sensible default).
  const [lengths, setLengths] = useState<Record<string, string>>(() =>
    Object.fromEntries(data.sections.map((s) => [s.code, s.wells ? String(Math.round(s.metres / s.wells)) : ""])));
  const [contingency, setContingency] = useState("10");

  const cont = 1 + (Number(contingency) || 0) / 100;
  const plannedLen = (code: string) => Math.max(0, Number(lengths[code]) || 0);
  const totalLen = data.sections.reduce((sum, s) => sum + plannedLen(s.code), 0);

  const forecast = useMemo(() => {
    return data.materials.map((m) => {
      let qty = 0, costR = 0, costD = 0;
      for (const b of m.bySection) {
        const len = plannedLen(b.code);
        if (len <= 0) continue;
        const rate = b[basis];
        qty += rate * len;
        // Cost per metre for this material/section = section cost ÷ section metres.
        if (b.metres > 0) { costR += (b.costR / b.metres) * len; costD += (b.costD / b.metres) * len; }
      }
      return { material: m.material, unit: m.unit, qty: qty * cont, costR: costR * cont, costD: costD * cont };
    }).filter((r) => r.qty > 0).sort((a, b) => b.costD - a.costD || b.qty - a.qty);
  }, [data, lengths, basis, cont]);

  const totalR = forecast.reduce((s, r) => s + r.costR, 0), totalD = forecast.reduce((s, r) => s + r.costD, 0);

  return (
    <div className="space-y-3">
      <div className="bg-blue-50/60 border border-blue-200 rounded p-3">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-blue-700 mb-2">Next well — planned section lengths (m)</div>
        <div className="flex flex-wrap gap-3 items-end">
          {data.sections.map((s) => (
            <label key={s.code} className="flex flex-col text-[11px] text-gray-600">
              <span className="mb-0.5">{s.size} <span className="text-gray-400">(avg {s.wells ? Math.round(s.metres / s.wells) : 0} m)</span></span>
              <input type="number" min={0} value={lengths[s.code] ?? ""} onChange={(e) => setLengths((p) => ({ ...p, [s.code]: e.target.value }))}
                className="h-8 w-24 border border-gray-300 rounded px-2 text-sm tabular-nums" />
            </label>
          ))}
          <label className="flex flex-col text-[11px] text-gray-600">
            <span className="mb-0.5">Contingency %</span>
            <input type="number" min={0} value={contingency} onChange={(e) => setContingency(e.target.value)}
              className="h-8 w-20 border border-gray-300 rounded px-2 text-sm tabular-nums" />
          </label>
          <div className="text-[11px] text-gray-500 ml-auto self-center">
            Total planned depth <b className="text-gray-800">{num(totalLen)} m</b> · rate = {BASES.find((b) => b.key === basis)?.label.toLowerCase()} per metre × {contingency || 0}% contingency
          </div>
        </div>
      </div>

      <div className="overflow-auto">
        <table className="text-[11px] tabular-nums border-collapse w-full">
          <thead className="sticky top-0 z-10">
            <tr className="bg-gray-100 text-gray-700">
              <th className="sticky left-0 bg-gray-100 border border-gray-300 px-2 py-1 text-left font-semibold">Material</th>
              <th className="border border-gray-300 px-2 py-1 text-left font-medium">Unit</th>
              <th className="border border-gray-300 px-2 py-1 text-right font-medium">Forecast qty</th>
              <th className="border border-gray-300 px-2 py-1 text-right font-medium">Est. cost (Rial)</th>
              <th className="border border-gray-300 px-2 py-1 text-right font-medium">Est. cost ($)</th>
            </tr>
          </thead>
          <tbody>
            {forecast.map((r, ri) => (
              <tr key={r.material} className={ri % 2 ? "bg-teal-50/30" : "bg-white"}>
                <th className="sticky left-0 bg-inherit border border-gray-300 px-2 py-0.5 text-left font-semibold text-gray-800 whitespace-nowrap">{r.material}</th>
                <td className="border border-gray-300 px-2 py-0.5 text-left text-gray-500">{r.unit}</td>
                <td className="border border-gray-300 px-2 py-0.5 text-right font-medium">{num(Math.ceil(r.qty))}</td>
                <td className="border border-gray-300 px-2 py-0.5 text-right text-gray-600">{r.costR > 0 ? num(Math.round(r.costR)) : "—"}</td>
                <td className="border border-gray-300 px-2 py-0.5 text-right text-gray-600">{r.costD > 0 ? num(Math.round(r.costD)) : "—"}</td>
              </tr>
            ))}
            {!forecast.length && <tr><td colSpan={5} className="p-6 text-center text-gray-400">Enter a section length to compute the forecast.</td></tr>}
          </tbody>
          {forecast.length > 0 && (
            <tfoot>
              <tr className="bg-gray-50 font-semibold text-gray-800">
                <td className="sticky left-0 bg-gray-50 border border-gray-300 px-2 py-1 text-left" colSpan={3}>Total estimated mud-material cost</td>
                <td className="border border-gray-300 px-2 py-1 text-right">{totalR > 0 ? num(Math.round(totalR)) : "—"}</td>
                <td className="border border-gray-300 px-2 py-1 text-right">{totalD > 0 ? num(Math.round(totalD)) : "—"}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <p className="text-[11px] text-gray-400">
        Forecast qty = Σ over sections (planning rate × planned metres) × contingency. Cost uses each material/section's
        recorded cost ÷ metres as a per-metre unit cost; blank where the source has no cost. A planning aid — verify against current prices.
      </p>
    </div>
  );
}

// ── COST: total & per-metre mud-material cost by material ─────────────────────

function Cost({ data }: { data: PlanningData }) {
  const totalMetres = data.sections.reduce((s, x) => s + x.metres, 0);
  const rows = useMemo(() =>
    data.materials
      .map((m) => ({ material: m.material, unit: m.unit, used: m.totalUsed, costR: m.totalCostR, costD: m.totalCostD, perMR: totalMetres > 0 ? m.totalCostR / totalMetres : 0, perMD: totalMetres > 0 ? m.totalCostD / totalMetres : 0 }))
      .filter((r) => r.costR > 0 || r.costD > 0)
      .sort((a, b) => b.costD - a.costD || b.costR - a.costR), [data, totalMetres]);

  if (!rows.length) return <Empty>No cost (CostRial / CostDollar) recorded for this selection.</Empty>;
  const maxD = Math.max(...rows.map((r) => r.costD), 0), useDollar = maxD > 0;
  const maxBar = Math.max(...rows.map((r) => (useDollar ? r.costD : r.costR)), 0);
  const grandR = rows.reduce((s, r) => s + r.costR, 0), grandD = rows.reduce((s, r) => s + r.costD, 0);

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-gray-500">Total mud-material cost across the offset wells ({num(totalMetres)} m drilled). Bar = {useDollar ? "US$" : "Rial"} share.</p>
      <div className="space-y-1">
        {rows.slice(0, 20).map((r, i) => {
          const v = useDollar ? r.costD : r.costR, w = maxBar > 0 ? (v / maxBar) * 100 : 0;
          return (
            <div key={r.material} className="flex items-center gap-2 text-[11px]">
              <div className="w-32 truncate text-right text-gray-700" title={r.material}>{r.material}</div>
              <div className="flex-1 relative h-5 bg-gray-50 rounded">
                <div className="absolute top-0.5 bottom-0.5 left-0 rounded-sm" style={{ width: `${w}%`, background: PALETTE[i % PALETTE.length] }} />
              </div>
              <div className="w-44 text-gray-500 tabular-nums whitespace-nowrap text-right">
                {useDollar ? `$${num(Math.round(r.costD))}` : `${num(Math.round(r.costR))} R`}
                <span className="text-gray-400"> · {useDollar ? `$${fmtRate(r.perMD)}` : `${fmtRate(r.perMR)}`}/m</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="text-[11px] text-gray-600 border-t border-gray-100 pt-2 flex gap-4">
        {grandD > 0 && <span>Total <b className="text-gray-800">${num(Math.round(grandD))}</b>{totalMetres > 0 && <span className="text-gray-400"> · ${fmtRate(grandD / totalMetres)}/m</span>}</span>}
        {grandR > 0 && <span>Total <b className="text-gray-800">{num(Math.round(grandR))}</b> Rial{totalMetres > 0 && <span className="text-gray-400"> · {fmtRate(grandR / totalMetres)}/m</span>}</span>}
      </div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="p-8 text-center text-sm text-gray-400">{children}</div>;
}
