/**
 * Formation-PROGNOSIS view — synthesises the selected offset wells' formation
 * tops into the inputs a drilling/geology engineer prognoses the NEXT well from.
 * Where the Form./Litho. tables and Graph browse one well at a time, this answers
 * "given these offsets, where do I expect each formation top, how thick, in which
 * hole section, and which formations lose mud?". Four sub-views over one
 * /ddr/formation-prognosis fetch:
 *
 *   • PROGNOSIS    — prognosed-tops table: per formation, top depth (MD) across
 *     offsets (min / mean / median / max / std / spread) in stratigraphic order.
 *   • CORRELATION  — the offset wells side by side as depth columns, tops drawn
 *     as correlation lines connecting the same formation well-to-well.
 *   • THICKNESS    — per formation, interval thickness across offsets + the hole
 *     section the top sits in (casing-seat view).
 *   • HAZARDS      — each formation's mud-loss exposure (events / volume) and a
 *     mobile-salt/anhydrite flag — the geology-driven risk list.
 */
import { useMemo, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { api } from "../../api/client.js";

export interface PrognosisFilters {
  fields: string[]; wells: string[]; holeSizes: string[]; mudTypes: string[];
}
interface TopStat { formation: string; n: number; min: number; mean: number; median: number; max: number; std: number; spread: number }
interface ThickStat { formation: string; n: number; min: number; median: number; max: number; section: string | null }
interface WellTops { wellCode: string; name: string; tops: { name: string; md: number }[] }
interface Hazard { formation: string; meanDepth: number | null; lossEvents: number; lossVol: number; mobile: boolean }
interface PrognosisData {
  prognosis: TopStat[]; thickness: ThickStat[]; wells: WellTops[]; hazards: Hazard[];
  wellCount: number; depthRange: { min: number; max: number } | null; truncatedWells?: boolean; note?: string;
}

type Sub = "prognosis" | "correlation" | "thickness" | "hazards";
const SUBS: { key: Sub; label: string }[] = [
  { key: "prognosis", label: "Top prognosis" },
  { key: "correlation", label: "Correlation" },
  { key: "thickness", label: "Thickness" },
  { key: "hazards", label: "Hazards" },
];

const num = (v: number | null) => v == null || !Number.isFinite(v) ? "—" : Math.round(v).toLocaleString();

// Stable pastel hue per formation name, shared by the correlation lines + legend.
function hueOf(name: string): number {
  let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h % 360;
}
const formColor = (name: string) => `hsl(${hueOf(name)} 55% 45%)`;

export function FormationPrognosis({ filters }: { filters: PrognosisFilters | null }) {
  const [sub, setSub] = useState<Sub>("prognosis");

  const q = useQuery({
    queryKey: ["ddr", "formation-prognosis", filters],
    queryFn: () => api.post<PrognosisData>("/ddr/formation-prognosis", filters),
    enabled: !!filters,
    placeholderData: keepPreviousData,
  });
  const data = q.data;

  if (!filters) return <Empty>Pick a field / well and press Show.</Empty>;
  if (q.isLoading && !data) return <Empty>Loading offset formation tops…</Empty>;
  if (q.error) return <Empty>{String(q.error)}</Empty>;
  if (!data) return <Empty>No data.</Empty>;
  if (data.note) return <Empty>{data.note}</Empty>;
  if (!data.prognosis.length) return <Empty>None of the selected wells have formation tops recorded.</Empty>;

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="inline-flex rounded border border-gray-300 overflow-hidden">
          {SUBS.map((sv) => (
            <button key={sv.key} onClick={() => setSub(sv.key)}
              className={`px-2.5 h-7 text-xs ${sub === sv.key ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>{sv.label}</button>
          ))}
        </div>
        <span className="text-[11px] text-gray-400">
          {data.wellCount} offset well{data.wellCount === 1 ? "" : "s"} · {data.prognosis.length} formations · tops in MD (m).
        </span>
      </div>

      {sub === "prognosis" ? <PrognosisTable data={data} />
        : sub === "correlation" ? <Correlation data={data} />
        : sub === "thickness" ? <Thickness data={data} />
        : <Hazards data={data} />}
    </div>
  );
}

// ── PROGNOSIS: the prognosed-tops table ──────────────────────────────────────

function PrognosisTable({ data }: { data: PrognosisData }) {
  const rows = data.prognosis;
  const maxMax = Math.max(...rows.map((r) => r.max), 1);
  return (
    <div className="space-y-2">
      <p className="text-[11px] text-gray-500">
        Predicted formation top depth (MD) across the offset wells, in stratigraphic order. Plan the next well's top near the
        <b> mean</b>; the <b>spread / std</b> is the prognosis uncertainty to allow for when setting casing points. Bar = min–max depth range.
      </p>
      <div className="overflow-auto">
        <table className="text-[11px] tabular-nums border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-gray-100 text-gray-700">
              <th className="sticky left-0 bg-gray-100 border border-gray-300 px-2 py-1 text-left font-semibold">Formation</th>
              <th className="border border-gray-300 px-2 py-1 text-right font-medium" title="Wells with this top">n</th>
              {["Min", "Mean", "Median", "Max", "Std", "Spread"].map((h) => (
                <th key={h} className="border border-gray-300 px-2 py-1 text-right font-medium">{h}</th>
              ))}
              <th className="border border-gray-300 px-2 py-1 text-left font-medium w-40">Depth range (m)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={r.formation} className={ri % 2 ? "bg-teal-50/30" : "bg-white"}>
                <th className="sticky left-0 bg-inherit border border-gray-300 px-2 py-0.5 text-left font-semibold text-gray-800 whitespace-nowrap">
                  <span className="inline-block w-2 h-2 rounded-sm mr-1.5 align-middle" style={{ background: formColor(r.formation) }} />{r.formation}
                </th>
                <td className="border border-gray-300 px-2 py-0.5 text-right text-gray-500">{r.n}</td>
                <td className="border border-gray-300 px-2 py-0.5 text-right text-gray-600">{num(r.min)}</td>
                <td className="border border-gray-300 px-2 py-0.5 text-right font-semibold text-gray-900">{num(r.mean)}</td>
                <td className="border border-gray-300 px-2 py-0.5 text-right text-gray-600">{num(r.median)}</td>
                <td className="border border-gray-300 px-2 py-0.5 text-right text-gray-600">{num(r.max)}</td>
                <td className="border border-gray-300 px-2 py-0.5 text-right text-gray-500" title="Standard deviation of the top depth across wells">±{num(r.std)}</td>
                <td className="border border-gray-300 px-2 py-0.5 text-right text-gray-500">{num(r.spread)}</td>
                <td className="border border-gray-300 px-2 py-0.5">
                  <div className="relative h-3 bg-gray-100 rounded" title={`${num(r.min)}–${num(r.max)} m`}>
                    <div className="absolute h-full rounded" style={{ left: `${(r.min / maxMax) * 100}%`, width: `${Math.max(1, ((r.max - r.min) / maxMax) * 100)}%`, background: formColor(r.formation), opacity: 0.45 }} />
                    <div className="absolute top-[-1px] h-[14px] w-0.5" style={{ left: `${(r.mean / maxMax) * 100}%`, background: formColor(r.formation) }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── CORRELATION: offset wells side by side, tops connected ───────────────────

function Correlation({ data }: { data: PrognosisData }) {
  const wells = data.wells;
  const range = data.depthRange;

  const PAD = { l: 48, t: 28, b: 8, r: 8 };
  const colW = 96, gap = 28, plotH = 520;
  const trackW = colW - 8;
  const W = PAD.l + wells.length * (colW + gap) + PAD.r;
  const H = PAD.t + plotH + PAD.b;
  // Guard the depth span: if every top collapses to one depth (range.min ===
  // range.max, e.g. a single well/top on an exact-100 m boundary), a zero span
  // would make y() return NaN and the whole SVG render blank.
  const rMin = range?.min ?? 0;
  const span = Math.max(1, (range?.max ?? 0) - rMin);
  const y = (md: number) => PAD.t + ((md - rMin) / span) * plotH;
  const colX = (i: number) => PAD.l + i * (colW + gap);

  // Formations that appear in ≥2 wells get a correlation line; colour by formation.
  const formCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const w of wells) for (const t of w.tops) m.set(t.name, (m.get(t.name) ?? 0) + 1);
    return m;
  }, [wells]);

  // Pixel position of each (well, formation) top, for the connecting lines.
  const pos = useMemo(() => {
    const m = new Map<string, { x: number; y: number }[]>();
    wells.forEach((w, i) => {
      for (const t of w.tops) {
        if ((formCount.get(t.name) ?? 0) < 2) continue;
        let arr = m.get(t.name); if (!arr) { arr = []; m.set(t.name, arr); }
        arr.push({ x: colX(i) + trackW / 2, y: y(t.md) });
      }
    });
    for (const arr of m.values()) arr.sort((a, b) => a.x - b.x);
    return m;
  }, [wells, formCount, rMin, span]);

  const depthTicks = useMemo(() => {
    if (!range) return [];
    const step = niceStep(span / 8);
    const out: number[] = [];
    for (let d = Math.ceil(range.min / step) * step; d <= range.max; d += step) out.push(d);
    return out;
  }, [range, span]);

  // Early return AFTER all hooks (Rules of Hooks).
  if (!wells.length || !range) return <Empty>Not enough tops to correlate.</Empty>;

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-gray-500">
        The offset wells as depth columns (MD), with each formation top drawn as a tick and the same formation connected
        well-to-well — the <b>stratigraphic correlation</b>. Sloping lines reveal structural dip / thickening between wells.{data.truncatedWells ? ` Showing 12 of ${data.wellCount} wells.` : ""}
      </p>
      <div className="overflow-auto">
        <svg width={W} height={H} className="block">
          {/* depth axis */}
          {depthTicks.map((d) => (
            <g key={d}>
              <line x1={PAD.l - 4} y1={y(d)} x2={W - PAD.r} y2={y(d)} stroke="#f1f5f9" />
              <text x={PAD.l - 6} y={y(d) + 3} textAnchor="end" fontSize={9} fill="#94a3b8">{d}</text>
            </g>
          ))}
          <text transform={`translate(12 ${PAD.t + plotH / 2}) rotate(-90)`} textAnchor="middle" fontSize={10} fill="#475569" fontWeight={600}>Depth MD (m)</text>

          {/* correlation lines (behind the columns) */}
          {[...pos.entries()].map(([name, pts]) => (
            <polyline key={name} points={pts.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke={formColor(name)} strokeWidth={1.5} strokeOpacity={0.5} />
          ))}

          {/* well columns */}
          {wells.map((w, i) => {
            const x = colX(i);
            return (
              <g key={w.wellCode}>
                <rect x={x} y={PAD.t} width={trackW} height={plotH} fill="#fafafa" stroke="#e5e7eb" />
                <text x={x + trackW / 2} y={PAD.t - 14} textAnchor="middle" fontSize={9} fill="#334155" fontWeight={600}>{w.wellCode}</text>
                <text x={x + trackW / 2} y={PAD.t - 4} textAnchor="middle" fontSize={8} fill="#94a3b8">{w.tops.length} tops</text>
                {w.tops.map((t) => {
                  const yy = y(t.md), shown = (formCount.get(t.name) ?? 0) >= 2;
                  return (
                    <g key={t.name}>
                      <line x1={x} y1={yy} x2={x + trackW} y2={yy} stroke={formColor(t.name)} strokeWidth={shown ? 2 : 1} strokeOpacity={shown ? 0.9 : 0.4} />
                      <title>{`${w.wellCode} — ${t.name} @ ${t.md} m`}</title>
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>
      {/* legend: formations on a correlation line */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-gray-600">
        {[...pos.keys()].sort().map((name) => (
          <span key={name} className="inline-flex items-center gap-1"><span className="w-3 h-[2px] inline-block" style={{ background: formColor(name) }} />{name}</span>
        ))}
      </div>
    </div>
  );
}

// ── THICKNESS: per-formation interval thickness + hole section ───────────────

function Thickness({ data }: { data: PrognosisData }) {
  const rows = data.thickness;
  if (!rows.length) return <Empty>Not enough consecutive tops to derive thickness.</Empty>;
  const maxMax = Math.max(...rows.map((r) => r.max), 1);
  return (
    <div className="space-y-2">
      <p className="text-[11px] text-gray-500">
        Interval thickness (next top − this top) across the offset wells, with the <b>hole section</b> each top sits in — for
        casing-seat planning. Bar = min–max, marker = median.
      </p>
      <div className="space-y-1">
        {rows.map((r) => (
          <div key={r.formation} className="flex items-center gap-2 text-[11px]">
            <div className="w-32 truncate text-right text-gray-700" title={r.formation}>
              <span className="inline-block w-2 h-2 rounded-sm mr-1 align-middle" style={{ background: formColor(r.formation) }} />{r.formation}
            </div>
            <div className="flex-1 relative h-4 bg-gray-50 rounded">
              <div className="absolute top-1/2 -translate-y-1/2 h-2 rounded" style={{ left: `${(r.min / maxMax) * 100}%`, width: `${Math.max(1, ((r.max - r.min) / maxMax) * 100)}%`, background: formColor(r.formation), opacity: 0.4 }} />
              <div className="absolute top-1/2 -translate-y-1/2 w-1 h-3.5 rounded-sm" style={{ left: `${(r.median / maxMax) * 100}%`, background: formColor(r.formation) }} title={`median ${r.median} m`} />
            </div>
            <div className="w-32 text-gray-500 tabular-nums whitespace-nowrap text-right">
              <b className="text-gray-800">{r.median}</b> <span className="text-gray-400">({r.min}–{r.max}) m</span>
            </div>
            <div className="w-16 text-gray-500 truncate" title={r.section ?? ""}>{r.section ?? ""}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── HAZARDS: formation loss exposure + mobile flag ───────────────────────────

function Hazards({ data }: { data: PrognosisData }) {
  const rows = data.hazards;
  if (!rows.length) return <Empty>No loss-prone or mobile formations for this selection.</Empty>;
  const maxVol = Math.max(...rows.map((r) => r.lossVol), 1);
  const totalVol = rows.reduce((s, r) => s + r.lossVol, 0);
  return (
    <div className="space-y-2">
      <p className="text-[11px] text-gray-500">
        Which formations lost mud across the offsets (events / volume from the daily losses, mapped to each formation's depth
        interval), and which are <b>mobile</b> salt / anhydrite. The next well's <b>LCM &amp; casing plan</b> should target these.
        Total <b>{totalVol.toLocaleString()} bbl</b> lost in flagged formations.
      </p>
      <div className="space-y-1">
        {rows.map((r) => (
          <div key={r.formation} className="flex items-center gap-2 text-[11px]">
            <div className="w-36 truncate text-right text-gray-700" title={r.formation}>
              {r.mobile && <span title="Mobile salt / anhydrite" className="text-amber-600 mr-0.5">⬡</span>}
              <span className="inline-block w-2 h-2 rounded-sm mr-1 align-middle" style={{ background: formColor(r.formation) }} />{r.formation}
            </div>
            <div className="w-14 text-right text-gray-400 tabular-nums" title="Mean top depth (MD)">{r.meanDepth ? `${Math.round(r.meanDepth)}m` : ""}</div>
            <div className="flex-1 relative h-4 bg-gray-50 rounded overflow-hidden">
              <div className="absolute top-0 bottom-0 left-0 rounded-sm" style={{ width: `${(r.lossVol / maxVol) * 100}%`, background: r.mobile ? "#d97706" : "#ef4444", opacity: 0.7 }} />
            </div>
            <div className="w-28 text-gray-500 tabular-nums whitespace-nowrap text-right">
              <b className="text-gray-800">{r.lossVol.toLocaleString()}</b> bbl <span className="text-gray-400">· {r.lossEvents} ev</span>
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-3 pt-1 text-[10px] text-gray-600">
        <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: "#ef4444", opacity: 0.7 }} />loss-prone</span>
        <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: "#d97706", opacity: 0.7 }} />⬡ mobile salt / anhydrite</span>
      </div>
    </div>
  );
}

/** A "nice" axis step (1/2/5 × 10ⁿ). */
function niceStep(raw: number): number {
  const p = Math.pow(10, Math.floor(Math.log10(Math.max(1, raw))));
  const n = raw / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="p-8 text-center text-sm text-gray-400">{children}</div>;
}
