/**
 * Mud-PROGRAM design view — synthesises the selected offset wells into the inputs
 * a mud engineer designs the NEXT well's mud program from. Where the Mud
 * Properties Table/Graph browse one well at a time, this answers "given these
 * offsets, what mud weight / rheology / loss risk should I plan per depth and
 * section?". Four sub-views over one /ddr/mud-program fetch:
 *
 *   • WEIGHT WINDOW — mud weight vs depth: the p10–p90 band + median across
 *     offset wells (the empirical mud-weight window). Unit toggle pcf/ppg/SG.
 *   • LOSS MAP      — N05 loss (and gain/kick) events vs depth, by severity and
 *     hole section — the loss-prone zones to plan LCM / weight for.
 *   • RHEOLOGY      — per hole section, the min–median–max of weight, PV, YP,
 *     gels, visc, solids%, filtrate the offsets ran — the next well's spec.
 *   • PROGRAM       — the mud systems used in each section + typical weight — the
 *     program skeleton.
 */
import React, { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { api } from "../../api/client.js";

export interface ProgramFilters {
  fields: string[]; wells: string[]; holeSizes: string[]; mudTypes: string[];
}
interface Stat { n: number; min: number; median: number; max: number }
interface WeightBin { depth: number; n: number; min: number; p10: number; median: number; p90: number; max: number }
interface LossBin {
  depth: number; events: number; vol: number;
  seepage: number; partial: number; severe: number; total: number;
  gains: number; gainVol: number; section: string | null;
}
interface RheoSection {
  section: string; maxWeight: Stat | null; visc: Stat | null; pv: Stat | null;
  yp: Stat | null; gel: Stat | null; solids: Stat | null; waterLoss: Stat | null;
}
interface MudSection { section: string; muds: { mud: string; n: number; medianWeight: number | null }[] }
interface ProgramData {
  weightByDepth: WeightBin[]; losses: LossBin[];
  rheologyBySection: RheoSection[]; mudBySection: MudSection[];
  wellCount: number; depthRange: { min: number; max: number } | null; bin?: number; note?: string;
}

type Sub = "weight" | "loss" | "rheology" | "program";
const SUBS: { key: Sub; label: string }[] = [
  { key: "weight", label: "Weight window" },
  { key: "loss", label: "Loss map" },
  { key: "rheology", label: "Rheology" },
  { key: "program", label: "Program" },
];

// Mud-weight unit conversions from pcf (lb/ft³, as stored).
type Unit = "pcf" | "ppg" | "sg";
const UNITS: { key: Unit; label: string; conv: (pcf: number) => number; dp: number }[] = [
  { key: "pcf", label: "pcf", conv: (v) => v, dp: 0 },
  { key: "ppg", label: "ppg", conv: (v) => v * 0.1336806, dp: 1 },
  { key: "sg", label: "SG", conv: (v) => v / 62.4279606, dp: 2 },
];

const PALETTE = ["#1e40af", "#0d9488", "#7c3aed", "#db2777", "#d97706", "#65a30d", "#dc2626", "#0891b2", "#9333ea", "#ea580c"];

export function MudProgram({ filters }: { filters: ProgramFilters | null }) {
  const [sub, setSub] = useState<Sub>("weight");
  const [unit, setUnit] = useState<Unit>("pcf");

  const q = useQuery({
    queryKey: ["ddr", "mud-program", filters],
    queryFn: () => api.post<ProgramData>("/ddr/mud-program", filters),
    enabled: !!filters,
    placeholderData: keepPreviousData,
  });
  const data = q.data;

  if (!filters) return <Empty>Pick a field / well and press Show.</Empty>;
  if (q.isLoading && !data) return <Empty>Loading offset mud data…</Empty>;
  if (q.error) return <Empty>{String(q.error)}</Empty>;
  if (!data) return <Empty>No data.</Empty>;
  if (data.note) return <Empty>{data.note}</Empty>;

  const u = UNITS.find((x) => x.key === unit)!;

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="inline-flex rounded border border-gray-300 overflow-hidden">
          {SUBS.map((sv) => (
            <button key={sv.key} onClick={() => setSub(sv.key)}
              className={`px-2.5 h-7 text-xs ${sub === sv.key ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>{sv.label}</button>
          ))}
        </div>
        {(sub === "weight" || sub === "rheology" || sub === "program") && (
          <label className="flex items-center gap-1.5 text-xs text-gray-600">
            Weight unit
            <select value={unit} onChange={(e) => setUnit(e.target.value as Unit)} className="h-7 border border-gray-300 rounded px-1.5 bg-white">
              {UNITS.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
            </select>
          </label>
        )}
        <span className="text-[11px] text-gray-400">
          {data.wellCount} offset well{data.wellCount === 1 ? "" : "s"}{data.bin ? ` · ${data.bin} m depth bins` : ""} · planning inputs synthesised across the selection.
        </span>
      </div>

      {sub === "weight" ? <WeightWindow data={data} u={u} />
        : sub === "loss" ? <LossMap data={data} />
        : sub === "rheology" ? <Rheology data={data} u={u} />
        : <Program data={data} u={u} />}
    </div>
  );
}

// ── WEIGHT WINDOW: mud weight vs depth, p10–p90 band + median ────────────────

function WeightWindow({ data, u }: { data: ProgramData; u: typeof UNITS[number] }) {
  const bins = data.weightByDepth;
  if (!bins.length) return <Empty>No mud-weight readings for this selection.</Empty>;

  const cv = (v: number) => u.conv(v);
  const fmt = (v: number) => cv(v).toFixed(u.dp);
  // Plot geometry: depth DOWN the Y axis, weight across X.
  const PAD = { l: 56, r: 16, t: 16, b: 36 };
  const plotW = 520, rowH = 22;
  const H = PAD.t + bins.length * rowH + PAD.b;
  const W = PAD.l + plotW + PAD.r;
  let wlo = Infinity, whi = -Infinity;
  for (const b of bins) { wlo = Math.min(wlo, cv(b.min)); whi = Math.max(whi, cv(b.max)); }
  const padX = (whi - wlo) * 0.05 || 1;
  wlo -= padX; whi += padX;
  const x = (w: number) => PAD.l + ((cv(w) - wlo) / (whi - wlo)) * plotW;
  const y = (i: number) => PAD.t + i * rowH + rowH / 2;
  const ticks = 6;

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-gray-500">
        Mud weight actually run by the offset wells at each depth — the <b>empirical mud-weight window</b>. Bar = p10–p90 across wells,
        line = median, whiskers = min/max. Plan the next well's weight near the median, inside the band. Values in <b>{u.label}</b>.
      </p>
      <div className="overflow-auto">
        <svg width={W} height={H} className="block">
          {/* X grid + ticks (weight) */}
          {Array.from({ length: ticks + 1 }, (_, i) => {
            const w = wlo + ((whi - wlo) / ticks) * i, px = PAD.l + (plotW / ticks) * i;
            return (
              <g key={i}>
                <line x1={px} y1={PAD.t} x2={px} y2={PAD.t + bins.length * rowH} stroke="#eef2f7" />
                <text x={px} y={H - PAD.b + 16} textAnchor="middle" fontSize={9} fill="#94a3b8">{w.toFixed(u.dp)}</text>
              </g>
            );
          })}
          <text x={PAD.l + plotW / 2} y={H - 4} textAnchor="middle" fontSize={10} fill="#475569" fontWeight={600}>Mud weight ({u.label})</text>
          {/* rows: one per depth bin */}
          {bins.map((b, i) => {
            const yy = y(i);
            const x10 = x(b.p10), x90 = x(b.p90), xmed = x(b.median), xmin = x(b.min), xmax = x(b.max);
            const tip = `${b.depth} m — median ${fmt(b.median)} ${u.label} (p10 ${fmt(b.p10)} – p90 ${fmt(b.p90)}, range ${fmt(b.min)}–${fmt(b.max)}, n=${b.n})`;
            return (
              <g key={b.depth}>
                <text x={PAD.l - 6} y={yy + 3} textAnchor="end" fontSize={9} fill="#475569">{b.depth}</text>
                {/* min–max whisker */}
                <line x1={xmin} x2={xmax} y1={yy} y2={yy} stroke="#cbd5e1" />
                <line x1={xmin} x2={xmin} y1={yy - 3} y2={yy + 3} stroke="#cbd5e1" />
                <line x1={xmax} x2={xmax} y1={yy - 3} y2={yy + 3} stroke="#cbd5e1" />
                {/* p10–p90 band */}
                <rect x={Math.min(x10, x90)} y={yy - 6} width={Math.abs(x90 - x10)} height={12} fill="#3b82f6" fillOpacity={0.25} rx={2} />
                {/* median */}
                <line x1={xmed} x2={xmed} y1={yy - 7} y2={yy + 7} stroke="#1e40af" strokeWidth={2} />
                {/* full-row transparent hover target so band / whiskers / anywhere on the row shows the value */}
                <rect x={PAD.l} y={yy - 8} width={W - PAD.l - PAD.r} height={16} fill="transparent">
                  <title>{tip}</title>
                </rect>
              </g>
            );
          })}
          {/* Y axis label */}
          <text transform={`translate(12 ${PAD.t + bins.length * rowH / 2}) rotate(-90)`} textAnchor="middle" fontSize={10} fill="#475569" fontWeight={600}>Depth (m)</text>
        </svg>
      </div>
    </div>
  );
}

// ── LOSS MAP: loss/gain events vs depth, severity + section ──────────────────

const SEV = [
  { key: "seepage", label: "Seepage (<10)", color: "#fcd34d" },
  { key: "partial", label: "Partial (10–50)", color: "#fb923c" },
  { key: "severe", label: "Severe (50–100)", color: "#ef4444" },
  { key: "total", label: "Total (>100 bbl)", color: "#991b1b" },
] as const;

function LossMap({ data }: { data: ProgramData }) {
  const bins = data.losses;
  if (!bins.length) return <Empty>No mud losses or gains recorded for this selection.</Empty>;
  const maxEvents = Math.max(...bins.map((b) => b.events), 1);
  const totalVol = bins.reduce((s, b) => s + b.vol, 0);
  const totalGains = bins.reduce((s, b) => s + b.gains, 0);

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-gray-500">
        Where the offset wells lost mud, by depth — the <b>loss-risk map</b>. Bar split by severity; the worst zones need LCM and a tighter
        mud-weight / ECD plan. Total <b>{totalVol.toLocaleString()} bbl</b> lost{totalGains > 0 && <> · <b>{totalGains}</b> gain/kick event(s) flagged</>}.
      </p>
      <div className="space-y-0.5">
        {bins.map((b) => {
          const w = (n: number) => (n / maxEvents) * 100;
          return (
            <div key={b.depth} className="flex items-center gap-2 text-[11px]">
              <div className="w-12 text-right text-gray-600 tabular-nums">{b.depth}</div>
              <div className="flex-1 relative h-5 bg-gray-50 rounded overflow-hidden flex">
                {SEV.map((s) => {
                  const n = b[s.key]; if (n <= 0) return null;
                  return <div key={s.key} style={{ width: `${w(n)}%`, background: s.color }} title={`${b.depth} m · ${s.label}: ${n} event(s)`} className="h-full" />;
                })}
                {b.gains > 0 && <div className="absolute right-0 top-0 bottom-0 px-1 flex items-center text-[9px] font-bold text-red-700" title={`${b.gains} gain/kick event(s), ${b.gainVol} bbl`}>⚠{b.gains}</div>}
              </div>
              <div className="w-12 text-gray-500 tabular-nums text-right">{b.events}</div>
              <div className="w-20 text-gray-400 tabular-nums text-right">{b.vol.toLocaleString()} bbl</div>
              <div className="w-16 text-gray-500 truncate" title={b.section ?? ""}>{b.section ?? ""}</div>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1 text-[10px] text-gray-600">
        {SEV.map((s) => <span key={s.key} className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: s.color }} />{s.label}</span>)}
        <span className="inline-flex items-center gap-1 text-red-700">⚠ gain / kick</span>
      </div>
    </div>
  );
}

// ── RHEOLOGY: per-section min–median–max spec ────────────────────────────────

function Rheology({ data, u }: { data: ProgramData; u: typeof UNITS[number] }) {
  const secs = data.rheologyBySection;
  if (!secs.length) return <Empty>No rheology readings resolvable to a hole section.</Empty>;
  const cell = (st: Stat | null, isWeight = false) => {
    if (!st) return <td className="border border-gray-300 px-2 py-0.5 text-center text-gray-300">·</td>;
    const c = isWeight ? (v: number) => u.conv(v).toFixed(u.dp) : (v: number) => String(v);
    return (
      <td className="border border-gray-300 px-2 py-0.5 text-right whitespace-nowrap" title={`min ${c(st.min)} · median ${c(st.median)} · max ${c(st.max)} (n=${st.n})`}>
        <span className="text-gray-400">{c(st.min)}</span> <b className="text-gray-800">{c(st.median)}</b> <span className="text-gray-400">{c(st.max)}</span>
      </td>
    );
  };
  const COLS: { key: keyof RheoSection; label: string; weight?: boolean }[] = [
    { key: "maxWeight", label: `Weight (${u.label})`, weight: true },
    { key: "visc", label: "Visc (s)" }, { key: "pv", label: "PV" }, { key: "yp", label: "YP" },
    { key: "gel", label: "Init gel" }, { key: "solids", label: "Solids %" }, { key: "waterLoss", label: "Filtrate" },
  ];
  return (
    <div className="space-y-2">
      <p className="text-[11px] text-gray-500">
        Rheology &amp; solids the offset wells ran in each hole section — the next well's <b>mud spec</b> per section. Each cell shows
        <span className="text-gray-400"> min</span> <b> median</b> <span className="text-gray-400">max</span>.
      </p>
      <table className="text-[11px] tabular-nums border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-gray-300 px-2 py-1 text-left font-semibold text-gray-700 whitespace-nowrap">Section</th>
            {COLS.map((c) => <th key={String(c.key)} className="border border-gray-300 px-2 py-1 text-right font-medium text-gray-700 whitespace-nowrap">{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {secs.map((s, ri) => (
            <tr key={s.section} className={ri % 2 ? "bg-teal-50/30" : "bg-white"}>
              <th className="border border-gray-300 px-2 py-0.5 text-left font-semibold text-gray-800 whitespace-nowrap">{s.section}</th>
              {COLS.map((c) => <React.Fragment key={String(c.key)}>{cell(s[c.key] as Stat | null, c.weight)}</React.Fragment>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── PROGRAM: mud systems by section ──────────────────────────────────────────

function Program({ data, u }: { data: ProgramData; u: typeof UNITS[number] }) {
  const secs = data.mudBySection;
  if (!secs.length) return <Empty>No mud-type usage resolvable to a hole section.</Empty>;
  return (
    <div className="space-y-2">
      <p className="text-[11px] text-gray-500">
        Mud systems the offset wells ran in each hole section, by frequency, with the typical (median) weight — the next well's
        <b> mud-program skeleton</b>. Weight in <b>{u.label}</b>.
      </p>
      <div className="space-y-2">
        {secs.map((s) => {
          const tot = s.muds.reduce((a, m) => a + m.n, 0);
          return (
            <div key={s.section} className="flex items-start gap-3">
              <div className="w-16 shrink-0 text-sm font-semibold text-gray-800 pt-0.5">{s.section}</div>
              <div className="flex-1 space-y-1">
                <div className="flex h-5 rounded overflow-hidden border border-gray-200">
                  {s.muds.map((m, i) => {
                    const pct = tot > 0 ? (m.n / tot) * 100 : 0;
                    if (pct < 1) return null;
                    return <div key={m.mud} style={{ width: `${pct}%`, background: PALETTE[i % PALETTE.length] }} title={`${m.mud}: ${m.n} interval(s)${m.medianWeight != null ? `, ~${u.conv(m.medianWeight).toFixed(u.dp)} ${u.label}` : ""}`} className="h-full" />;
                  })}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-gray-600">
                  {s.muds.slice(0, 6).map((m, i) => (
                    <span key={m.mud} className="inline-flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: PALETTE[i % PALETTE.length] }} />
                      {m.mud}{m.medianWeight != null && <span className="text-gray-400"> ~{u.conv(m.medianWeight).toFixed(u.dp)} {u.label}</span>}
                      <span className="text-gray-400">({m.n})</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="p-8 text-center text-sm text-gray-400">{children}</div>;
}
