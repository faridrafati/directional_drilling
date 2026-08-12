/**
 * ROP Optimization — drilling-performance explorer over the bit table (L05),
 * sitting next to the Tools tab. Each bit record becomes one operating point:
 * X = weight-on-bit (midpoint of the recorded MinWeight–MaxWeight range),
 * Y = RPM (midpoint of MinRPM–MaxRPM), Z = ROP (footage ÷ rotating hours). The
 * centrepiece is a WOB×RPM contour heatmap whose cell colour is the mean ROP of
 * the points in that cell — the classic "drill-off" parameter map showing where
 * weight/speed combinations drilled fastest. Faceted by fields / wells / bit
 * sizes / mud types / Jalali date, exactly like the other DDR tabs.
 *
 * Views (over one fetch): CONTOUR (heatmap + scatter overlay), SCATTERS
 * (ROP-vs-WOB and ROP-vs-RPM), BY SIZE (mean ROP per bit size), TABLE (the raw
 * records — a row opens that day's daily report).
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer, ScatterChart, Scatter, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, Legend, Cell, ReferenceArea, ReferenceLine,
} from "recharts";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, GizmoHelper, GizmoViewport, Text } from "@react-three/drei";
import * as THREE from "three";
import {
  powerLawFit, linearFit, spearman, mean, median, founderAtConstantRpm,
  tripHours, costPerMeter, tripAdjustedRop, rigUsdPerHr, psiToMPa,
  iqrFence, klbToTonnes, type IqrFence,
  buildRoadmap, cautionCutoffs, type RoadmapRun, type RoadmapRow, type Band,
} from "@dd/shared/drilling";
import { api } from "../../api/client.js";
import { MultiSelect, type Item } from "./DdrRemarksSearch.js";
import { JalaliDatePicker } from "./JalaliDatePicker.js";
import { useFacetOptions } from "./useFacetOptions.js";
import { useDdrSelection } from "./ddrSelection.js";

interface SearchOptions {
  fields: string[]; wells: { code: string; name: string; field: string | null }[];
  holeSizes: string[]; mudTypes: string[]; rigs: string[]; formations: string[];
}
interface RopPoint {
  wob: number; rpm: number; rop: number; bitSize: string; topFormation: string | null;
  wellCode: string; name: string; field: string | null;
  date: string | null; serialNo: number | null;
  from: number | null; to: number | null; meters: number | null;
  // Drilling-engineering metrics (added by the backend) for the MSE / Hydraulics
  // / Economics / Advisor views. Any of these may be null when the source row
  // lacks the inputs (e.g. no torque, no hydraulics, unparseable bit size).
  // bitClass is TRI-STATE: null = no bit evidence on the source row (an entered
  // report with no bit run, or one carrying neither an IADC code nor a type).
  // Never fold those into "roller" — the PDC-vs-roller split is what this tab is
  // for. They reach the charts through the "Unclassified" bit-type facet.
  iadc: string | null; bitClass: "PDC" | "roller" | null; make: string | null; diaIn: number | null;
  mse: number | null; mseEstimated: boolean;
  hsi: number | null; hsiSource: "reported" | "computed" | null;
  tfa: number | null; nozzles: number[] | null; flow: number | null; spp: number | null; mudWeight: number | null;
  dullInner: number | null; dullOuter: number | null; bitHour: number | null;
  dullGrade: string | null; dullTitle: string | null;
  reasonCode: string | null; reasonLabel: string | null;
  // Where the operating point came from: the legacy bit archive (default) or a
  // drilling-parameter row typed on the rig in the entry module.
  source?: "legacy" | "entered";
}
interface RopData {
  points: RopPoint[]; bitSizes: string[]; truncated?: boolean; total?: number; note?: string;
}

/** Bit-type facet selection. "" = every class; "none" = points whose source row
 *  carried no bit evidence (RopPoint.bitClass === null). */
type ClassSel = "" | "PDC" | "roller" | "none";

type View = "summary" | "contour" | "voxel" | "roadmap" | "mse" | "hydraulics" | "economics" | "advisor" | "scatter" | "size" | "progress" | "table";
const VIEWS: { key: View; label: string }[] = [
  { key: "summary", label: "Summary" },
  { key: "contour", label: "Contour" },
  { key: "voxel", label: "3D ROP" },
  { key: "roadmap", label: "Roadmap" },
  { key: "mse", label: "MSE" },
  { key: "hydraulics", label: "Hydraulics" },
  { key: "economics", label: "Economics" },
  { key: "advisor", label: "Bit advisor" },
  { key: "scatter", label: "Scatters" },
  { key: "size", label: "By bit size" },
  { key: "progress", label: "Progress" },
  { key: "table", label: "Table" },
];

// Distinct hues for per-bit-size series across the scatter charts + heatmap legend.
const SIZE_COLORS = ["#1e40af", "#0d9488", "#7c3aed", "#db2777", "#d97706", "#65a30d", "#dc2626", "#0891b2", "#9333ea", "#ca8a04"];
const colorForSize = (sizes: string[], size: string) => SIZE_COLORS[Math.max(0, sizes.indexOf(size)) % SIZE_COLORS.length];

const fmt1 = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));

// Bit/hole size string → inches, and inches → the canonical "12-1/2"" label —
// mirrors the backend's holeSizeValue / normHoleSize so the "Bit sizes" dropdown
// values round-trip exactly through the API's size filter.
function holeSizeInches(raw: string): number | null {
  const t = raw.replace(/[^0-9./ -]/g, " ").replace(/\s+/g, " ").trim();
  if (!t) return null;
  let m = t.match(/^(\d+)[\s-]+(\d+)\s*\/\s*(\d+)$/); if (m) return +m[1] + +m[2] / +m[3];
  m = t.match(/^(\d+)\s*\/\s*(\d+)$/); if (m) return +m[1] / +m[2];
  m = t.match(/^(\d+(?:\.\d+)?)$/); if (m) return +m[1];
  return null;
}
function normHoleSizeStr(raw: string): string {
  const v = holeSizeInches(raw);
  if (v == null) return raw;
  const whole = Math.floor(v + 1e-9);
  let num = Math.round((v - whole) * 32);
  if (num >= 32) return `${whole + 1}"`;
  if (num === 0) return `${whole}"`;
  let den = 32;
  const g = (a: number, b: number): number => (b ? g(b, a % b) : a);
  const k = g(num, den); num /= k; den /= k;
  return `${whole}-${num}/${den}"`;
}

/** Round `v` outward (down for the low bound, up for the high) to a 1/2/5·10ⁿ
 *  grid step sized to the value, so padded axis bounds land on tidy numbers. */
function snapOut(v: number, dir: -1 | 1): number {
  if (!Number.isFinite(v) || v === 0) return 0;
  const mag = Math.pow(10, Math.floor(Math.log10(Math.abs(v))));
  const norm = Math.abs(v) / mag;
  const step = (norm <= 2 ? 0.5 : norm <= 5 ? 1 : 2) * mag;
  return (dir < 0 ? Math.floor(v / step) : Math.ceil(v / step)) * step;
}

/**
 * Data-driven axis domain so each chart fills its plot area and re-scales when a
 * facet/filter narrows the visible set — instead of Recharts' default of pinning
 * numeric axes to 0. Passed as the function form of `domain`, so Recharts calls
 * each bound with the live data min/max; we pad ~`pad` and snap to round numbers.
 * Non-negative data never gets a negative lower bound (e.g. ROP can't go below 0).
 */
const niceDomain = (pad = 0.06): [(min: number) => number, (max: number) => number] => [
  (min: number) => {
    const lo = snapOut(min - Math.abs(min) * pad, -1);
    return min >= 0 ? Math.max(0, lo) : lo;
  },
  (max: number) => snapOut(max + Math.abs(max) * pad, 1),
];

// Legends sit at the TOP so they never collide with the x-axis title, which
// lives in the bottom margin (insideBottom). Spread onto every <Legend> paired
// with a bottom axis label. `height` reserves the strip so the plot shifts down.
const LEGEND_TOP = { verticalAlign: "top", align: "center", height: 26, wrapperStyle: { fontSize: 11, paddingBottom: 4 } } as const;
// Charts carrying LEGEND_TOP need extra headroom so the plot clears the legend.
const CHART_MARGIN = { top: 30, right: 24, bottom: 34, left: 8 };
/** "35–40 klb (15.9–18.1 t)" — klb range with its metric-tonne equivalent. */
const wobRange = (loKlb: number, hiKlb: number) =>
  `${fmt1(loKlb)}–${fmt1(hiKlb)} klb (${klbToTonnes(loKlb).toFixed(1)}–${klbToTonnes(hiKlb).toFixed(1)} t)`;

/**
 * Leading IADC digit of a bit run — the cutter "series" used to sub-group bits
 * within a class. Roller-cone codes are purely numeric ("537" → "5"); PDC codes
 * are letter-prefixed ("M323" → first digit after the letter, "3"). Returns null
 * when the code carries no usable digit.
 */
function iadcSeries(iadc: string | null): string | null {
  const m = (iadc ?? "").match(/\d/);
  return m ? m[0] : null;
}

/**
 * The study's statistical screening (§5): Tukey IQR fence (1.5×) on ROP, WOB,
 * RPM and MSE — mark-don't-delete, so the raw set is kept and screening is a
 * toggle. A point is screened out when ANY of the four metrics falls outside
 * its fence (MSE only judged where it exists).
 */
function screenOutliers(points: RopPoint[]): { kept: RopPoint[]; removed: number } {
  if (points.length < 8) return { kept: points, removed: 0 };
  const fr = iqrFence(points.map((p) => p.rop));
  const fw = iqrFence(points.map((p) => p.wob));
  const fp = iqrFence(points.map((p) => p.rpm));
  const mseVals = points.filter((p) => p.mse != null).map((p) => p.mse as number);
  const fm = mseVals.length >= 8 ? iqrFence(mseVals) : null;
  const inside = (v: number, f: IqrFence | null) => !f || (v >= f.lo && v <= f.hi);
  const kept = points.filter((p) =>
    inside(p.rop, fr) && inside(p.wob, fw) && inside(p.rpm, fp) && (p.mse == null || inside(p.mse, fm)));
  return { kept, removed: points.length - kept.length };
}

export function RopOptimization({ onOpenReport }: { onOpenReport?: (wellCode: string, serialNo: number, date: string | null) => void } = {}) {
  // Shared across tabs (see ddrSelection) so the facet picks survive a tab switch.
  const {
    fields: selFields, setFields: setSelFields, wells: selWells, setWells: setSelWells,
    holeSizes: selHole, setHoleSizes: setSelHole, mudTypes: selMud, setMudTypes: setSelMud,
    formations: selForm, setFormations: setSelForm, depthFrom, setDepthFrom, depthTo, setDepthTo,
    dateFrom, setDateFrom, dateTo, setDateTo,
  } = useDdrSelection();
  const [data, setData] = useState<RopData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>("summary");
  const [includeOutliers, setIncludeOutliers] = useState(false); // screening ON by default (spec §5)
  // Bit-type / IADC-series facet — purely client-side over the loaded points.
  // "" = all classes; selPdcSeries / selConeSeries hold the picked leading IADC
  // digits within each class (empty = all series of that class).
  const [selClass, setSelClass] = useState<ClassSel>("");
  const [selPdcSeries, setSelPdcSeries] = useState<string[]>([]);
  const [selConeSeries, setSelConeSeries] = useState<string[]>([]);

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

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const body = { fields: selFields, wells: selWells, holeSizes: selHole, mudTypes: selMud, formations: selForm, depthFrom, depthTo, dateFrom, dateTo };
      const next = await api.post<RopData>("/ddr/rop-optimization", body);
      // The class tabs are rendered from what the CURRENT result contains, so a
      // selection the new result can't offer would leave every view empty with no
      // tab lit — and if the whole facet unmounts, no control left to clear it.
      const has = (c: ClassSel) => c === "" ||
        next.points.some((p) => (c === "none" ? p.bitClass == null : p.bitClass === c));
      setSelClass((c) => (has(c) ? c : ""));
      setData(next);
    } catch (e) { setError(String(e)); } finally { setLoading(false); }
  }
  function clearAll() {
    setSelFields([]); setSelWells([]); setSelHole([]); setSelMud([]); setDateFrom(""); setDateTo(""); setData(null);
    setSelForm([]); setDepthFrom(""); setDepthTo("");
    setSelClass(""); setSelPdcSeries([]); setSelConeSeries([]);
  }

  // IADC-series options per class, derived from the loaded set (before any
  // class/series filtering), so each list shows the series actually present.
  const seriesOpts = useMemo(() => {
    const pdc = new Set<string>(), cone = new Set<string>();
    let unclassified = 0;
    for (const p of data?.points ?? []) {
      // An unclassified point has no class to file a series under — count it so
      // the facet can offer the third tab, and never let it land in `cone`.
      if (p.bitClass == null) { unclassified++; continue; }
      const sNum = iadcSeries(p.iadc);
      if (sNum == null) continue;
      (p.bitClass === "PDC" ? pdc : cone).add(sNum);
    }
    const sort = (s: Set<string>) => [...s].sort((a, b) => Number(a) - Number(b));
    return { pdc: sort(pdc), cone: sort(cone), unclassified };
  }, [data]);

  // Bit-class + IADC-series gate, applied before outlier screening so all views
  // (contour, scatters, by-size, table…) and the IQR fences see the same subset.
  const classFiltered = useMemo(() => {
    const raw = data?.points ?? [];
    if (!selClass) return raw;
    // "none" = the unclassified bucket; it has no IADC series to narrow by.
    if (selClass === "none") return raw.filter((p) => p.bitClass == null);
    const series = new Set(selClass === "PDC" ? selPdcSeries : selConeSeries);
    // `=== selClass` already excludes the nulls — they are only ever reachable
    // through the "none" tab, never as a silent member of PDC or roller.
    return raw.filter((p) => p.bitClass === selClass && (!series.size || (() => {
      const sNum = iadcSeries(p.iadc); return sNum != null && series.has(sNum);
    })()));
  }, [data, selClass, selPdcSeries, selConeSeries]);

  const { kept: points, removed } = useMemo(() => {
    return includeOutliers ? { kept: classFiltered, removed: 0 } : screenOutliers(classFiltered);
  }, [classFiltered, includeOutliers]);
  // Bit sizes present in the (class-filtered) set, so per-size views / dropdowns
  // stay in sync with the active bit-type selection. Falls back to the full list.
  const bitSizes = useMemo(() => {
    if (!selClass) return data?.bitSizes ?? [];
    const present = new Set(points.map((p) => p.bitSize));
    return (data?.bitSizes ?? []).filter((b) => present.has(b));
  }, [data, selClass, points]);

  // The "Bit sizes" dropdown lists the bit sizes ACTUALLY PRESENT (normalized to
  // the 12-1/2" form the backend filters on), so the choices match the points
  // that come back — never a phantom L04 section size with no matching bit. Falls
  // back to the shared section facet before the first load populates data.
  const sizeOptions = useMemo(() => {
    const src = data?.bitSizes?.length ? data.bitSizes.map(normHoleSizeStr) : facet.holeSizes;
    return [...new Set(src)].sort((a, b) => (holeSizeInches(b) ?? 0) - (holeSizeInches(a) ?? 0));
  }, [data, facet.holeSizes]);

  return (
    <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4 overflow-hidden">
      <div className="flex flex-col min-h-0 bg-white border border-gray-200 rounded p-3 overflow-y-auto">
        <MultiSelect title="Fields" items={(o?.fields ?? []).map((f) => ({ value: f, label: f }))} selected={selFields} onChange={setSelFields} />
        <MultiSelect title={selFields.length ? `Wells · in ${selFields.length} field(s)` : "Wells"} items={wellItems} selected={selWells} onChange={setSelWells} />
        <MultiSelect title="Bit sizes" items={sizeOptions.map((h) => ({ value: h, label: h }))} selected={selHole} onChange={setSelHole} />
        <BitTypeFilter
          selClass={selClass} onClass={setSelClass}
          pdcSeries={seriesOpts.pdc} coneSeries={seriesOpts.cone} unclassified={seriesOpts.unclassified}
          selPdcSeries={selPdcSeries} onPdcSeries={setSelPdcSeries}
          selConeSeries={selConeSeries} onConeSeries={setSelConeSeries}
        />
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
        <label className="flex items-center gap-1.5 pt-2 text-[11px] text-gray-600 cursor-pointer" title="Statistical screening: Tukey IQR fence (1.5×) on ROP / WOB / RPM / MSE — outliers are hidden, not deleted.">
          <input type="checkbox" checked={includeOutliers} onChange={(e) => setIncludeOutliers(e.target.checked)} />
          Include outliers (skip IQR screening)
        </label>
        <div className="flex gap-2 pt-3">
          <button onClick={() => void run()} disabled={loading} className="h-9 px-4 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300">{loading ? "Loading…" : "Show"}</button>
          <button onClick={clearAll} className="h-9 px-3 text-sm rounded border border-gray-300 hover:bg-gray-50">Clear</button>
        </div>
        {error && <div className="text-xs text-red-600 pt-2">{error}</div>}
        <p className="text-[11px] text-gray-400 pt-3 leading-snug">
          WOB &amp; RPM are the midpoints of each bit record's recorded min–max range. ROP = drilled metres ÷ rotating hours.
          Statistical outliers (IQR ×1.5 on ROP / WOB / RPM / MSE) are screened out unless included above.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded flex flex-col min-h-0 overflow-hidden">
        <div className="px-3 py-2 border-b border-gray-100 shrink-0 flex items-center justify-between gap-2 flex-wrap">
          <span className="text-sm text-gray-600 min-w-0 truncate">
            {data
              ? (data.note ? data.note : <><b>{points.length}</b> bit records{removed > 0 ? <> · <span title="Tukey IQR ×1.5 on ROP / WOB / RPM / MSE">{removed} outliers screened</span></> : ""}{data.truncated ? ` (capped — ${data.total})` : ""} · {bitSizes.length} bit size{bitSizes.length === 1 ? "" : "s"}</>)
              : "Pick a field / well, then Show."}
          </span>
          {!!points.length && (
            <div className="inline-flex rounded border border-gray-300 overflow-hidden shrink-0">
              {VIEWS.map((v) => (
                <button key={v.key} onClick={() => setView(v.key)}
                  className={`px-2.5 h-7 text-xs ${view === v.key ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
                  {v.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="overflow-auto flex-1 min-h-0 p-3">
          {!data ? <Empty>Pick a field or well in the sidebar, then press Show.</Empty>
            : !points.length ? <Empty>{data.note ?? "No bit records with usable WOB / RPM / ROP for this selection."}</Empty>
            : view === "summary" ? <SummaryView points={points} bitSizes={bitSizes} onOpenReport={onOpenReport} onView={setView} />
            : view === "contour" ? <ContourView points={points} bitSizes={bitSizes} />
            : view === "voxel" ? <Voxel3DView points={points} bitSizes={bitSizes} />
            : view === "roadmap" ? <RoadmapView points={points} bitSizes={bitSizes} />
            : view === "mse" ? <MseView points={points} bitSizes={bitSizes} />
            : view === "hydraulics" ? <HydraulicsView points={points} bitSizes={bitSizes} />
            : view === "economics" ? <EconomicsView points={points} bitSizes={bitSizes} />
            : view === "advisor" ? <AdvisorView points={points} bitSizes={bitSizes} />
            : view === "scatter" ? <ScatterView points={points} bitSizes={bitSizes} />
            : view === "size" ? <BySizeView points={points} bitSizes={bitSizes} />
            : view === "progress" ? <ProgressView points={points} />
            : <TableView points={points} onOpenReport={onOpenReport} />}
        </div>
      </div>
    </div>
  );
}

/* ══ ROADMAP ═══════════════════════════════════════════════════════════════════
 *
 * Per-formation recommended WOB / RPM / flow bands, mined from the offset runs
 * on screen. The aggregation lives in `@dd/shared/drilling/roadmap` — this
 * component only supplies the economics inputs, draws the depth track and the
 * table, and copies it out as CSV.
 */
function RoadmapView({ points, bitSizes }: { points: RopPoint[]; bitSizes: string[] }) {
  const [sizeFilter, setSizeFilter] = useState("");
  const [rigDay, setRigDay] = useState(30000);
  const [tripSpeed, setTripSpeed] = useState(300);
  const [prices] = useState<BitPrices>(PRICE_DEFAULTS);
  const [copied, setCopied] = useState(false);

  const pts = useMemo(
    () => (sizeFilter ? points.filter((p) => p.bitSize === sizeFilter) : points),
    [points, sizeFilter],
  );

  const rows = useMemo(() => {
    const rigHr = rigUsdPerHr(rigDay);
    // Cost per metre is computed PER RUN here, not per IADC group as the
    // economics view does: the roadmap ranks individual runs against each other
    // inside a formation, so it needs each run's own cost.
    const runs: RoadmapRun[] = pts.map((p) => {
      const depth = runDepth(p);
      const tripHr = depth != null && depth > 0
        ? tripHours({ depthM: depth, tripSpeedMHr: tripSpeed, handlingHr: 2 })
        : 0;
      const bitUsd = p.bitClass != null ? priceFor(p.bitClass, p.diaIn, prices) : null;
      const costPerM = bitUsd != null && p.meters != null && p.meters > 0 && p.bitHour != null && p.bitHour > 0
        ? costPerMeter({ bitUsd, rigUsdPerHr: rigHr, drillHr: p.bitHour, tripHr, meterageM: p.meters })
        : null;
      const tripRopMHr = p.meters != null && p.meters > 0 && p.bitHour != null && p.bitHour > 0
        ? tripAdjustedRop({ meterageM: p.meters, drillHr: p.bitHour, tripHr })
        : null;
      return {
        formation: p.topFormation, bitSize: p.bitSize,
        wobKlb: p.wob, rpm: p.rpm, flowGpm: p.flow, ropMHr: p.rop,
        costPerM, tripRopMHr, mse: p.mse,
        dullInner: p.dullInner, dullOuter: p.dullOuter,
        meters: p.meters, reasonCode: p.reasonCode, depthMid: midDepth(p),
      };
    });
    const cuts = cautionCutoffs(runs);
    return buildRoadmap(runs, { wearCautionThreshold: cuts.wear, mseCvThreshold: cuts.mseCv });
  }, [pts, rigDay, tripSpeed, prices]);

  const usable = rows.filter((r) => !r.insufficient);
  const short = rows.filter((r) => r.insufficient);

  // Shared parameter axes, so a band's LENGTH is comparable between rows.
  const axis = (pick: (r: RoadmapRow) => Band | null) => {
    const vs = usable.flatMap((r) => { const b = pick(r); return b ? [b.p25, b.p75] : []; });
    if (!vs.length) return null;
    const lo = Math.min(...vs), hi = Math.max(...vs);
    return hi > lo ? { lo, hi } : { lo: lo * 0.9, hi: hi * 1.1 || 1 };
  };
  const wobAxis = axis((r) => r.wob), rpmAxis = axis((r) => r.rpm);

  const csv = () => {
    const head = ["Formation", "Depth (m)", "Hole size", "WOB P25 (klb)", "WOB P75 (klb)",
      "WOB P25 (t)", "WOB P75 (t)", "RPM P25", "RPM P75", "Flow P25 (gpm)", "Flow P75 (gpm)",
      "Runs", "Best-set n", "Zone", "Basis"];
    const cell = (v: unknown) => {
      const t = v == null ? "" : String(v);
      return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
    };
    const body = usable.map((r) => [
      r.formation, r.depthFrom != null ? Math.round(r.depthFrom) : "", r.bitSizes.join(" / "),
      r.wob ? r.wob.p25.toFixed(1) : "", r.wob ? r.wob.p75.toFixed(1) : "",
      r.wob ? klbToTonnes(r.wob.p25).toFixed(1) : "", r.wob ? klbToTonnes(r.wob.p75).toFixed(1) : "",
      r.rpm ? Math.round(r.rpm.p25) : "", r.rpm ? Math.round(r.rpm.p75) : "",
      r.flow ? Math.round(r.flow.p25) : "", r.flow ? Math.round(r.flow.p75) : "",
      r.n, r.bestN, r.zone, `best tercile by ${r.basis} of ${r.n} runs`,
    ].map(cell).join(","));
    void navigator.clipboard?.writeText([head.join(","), ...body].join("\n"));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  if (!rows.length) return <Empty>No runs carry a formation for this selection.</Empty>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3 text-xs">
        <label className="flex flex-col gap-1">
          <span className="text-gray-500">Hole size</span>
          <select value={sizeFilter} onChange={(e) => setSizeFilter(e.target.value)}
            className="h-7 px-2 border border-gray-300 rounded bg-white">
            <option value="">All</option>
            {bitSizes.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-gray-500">Rig rate ($/day)</span>
          <input type="number" value={rigDay} min={0} step={1000}
            onChange={(e) => setRigDay(Math.max(0, Number(e.target.value) || 0))}
            className="h-7 px-2 w-28 border border-gray-300 rounded" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-gray-500">Trip speed (m/hr)</span>
          <input type="number" value={tripSpeed} min={1} step={50}
            onChange={(e) => setTripSpeed(Math.max(1, Number(e.target.value) || 1))}
            className="h-7 px-2 w-24 border border-gray-300 rounded" />
        </label>
        <button type="button" onClick={csv} disabled={!usable.length}
          className="h-7 px-3 rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40">
          {copied ? "Copied ✓" : "Copy as CSV"}
        </button>
        <span className="text-gray-400 ml-auto">
          {usable.length} formation{usable.length === 1 ? "" : "s"} banded
          {short.length ? ` · ${short.length} with too few runs` : ""}
        </span>
      </div>

      {/* Depth track: one row per formation, ordered as the hole is drilled. */}
      {usable.length > 0 && (
        <div className="border border-gray-200 rounded-lg bg-white p-3 overflow-x-auto">
          <div className="text-[11px] font-semibold text-gray-700 mb-2">
            Recommended operating bands by formation
            <span className="font-normal text-gray-400"> · P25–P75 of the best-performing runs</span>
          </div>
          <table className="w-full text-[11px]" style={{ minWidth: 720 }}>
            <thead>
              <tr className="text-gray-500 text-left">
                <th className="py-1 pr-2 font-medium">Formation</th>
                <th className="py-1 pr-2 font-medium w-20">Depth</th>
                <th className="py-1 pr-2 font-medium" style={{ width: "30%" }}>WOB (klb)</th>
                <th className="py-1 pr-2 font-medium" style={{ width: "30%" }}>RPM</th>
                <th className="py-1 pr-2 font-medium w-16">Zone</th>
              </tr>
            </thead>
            <tbody>
              {usable.map((r) => (
                <tr key={r.formation} className="border-t border-gray-100 align-middle">
                  <td className="py-1 pr-2 text-gray-800">{r.formation}</td>
                  <td className="py-1 pr-2 tabular-nums text-gray-500">{intc(r.depthFrom)}</td>
                  <td className="py-1 pr-2"><BandBar band={r.wob} axis={wobAxis} unit="klb" /></td>
                  <td className="py-1 pr-2"><BandBar band={r.rpm} axis={rpmAxis} unit="rpm" /></td>
                  <td className="py-1 pr-2">
                    <span
                      title={r.zoneReasons.join("; ") || "no dysfunction evidence in these runs"}
                      className={`px-1.5 py-0.5 rounded text-[10px] ${
                        r.zone === "caution"
                          ? "bg-amber-100 text-amber-800 border border-amber-300"
                          : "bg-emerald-50 text-emerald-700 border border-emerald-200"}`}
                    >
                      {r.zone}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* The same rows as a plain table, with the numbers spelled out. */}
      <div className="border border-gray-200 rounded-lg bg-white overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead className="bg-gray-50 text-gray-600">
            <tr className="text-left">
              <th className="px-2 py-1.5 font-medium">Formation</th>
              <th className="px-2 py-1.5 font-medium">Depth (m)</th>
              <th className="px-2 py-1.5 font-medium">Hole size</th>
              <th className="px-2 py-1.5 font-medium">WOB (klb)</th>
              <th className="px-2 py-1.5 font-medium">WOB (t)</th>
              <th className="px-2 py-1.5 font-medium">RPM</th>
              <th className="px-2 py-1.5 font-medium">Flow (gpm)</th>
              <th className="px-2 py-1.5 font-medium">n</th>
              <th className="px-2 py-1.5 font-medium">Zone</th>
              <th className="px-2 py-1.5 font-medium">Basis</th>
            </tr>
          </thead>
          <tbody>
            {usable.map((r) => (
              <tr key={r.formation} className="border-t border-gray-100">
                <td className="px-2 py-1 text-gray-800">{r.formation}</td>
                <td className="px-2 py-1 tabular-nums text-gray-500">{intc(r.depthFrom)}</td>
                <td className="px-2 py-1 text-gray-500">{r.bitSizes.join(" / ")}</td>
                <td className="px-2 py-1 tabular-nums">{bandText(r.wob, 1)}</td>
                <td className="px-2 py-1 tabular-nums text-gray-500">
                  {r.wob ? `${klbToTonnes(r.wob.p25).toFixed(1)}–${klbToTonnes(r.wob.p75).toFixed(1)}` : "—"}
                </td>
                <td className="px-2 py-1 tabular-nums">{bandText(r.rpm, 0)}</td>
                <td className="px-2 py-1 tabular-nums">{bandText(r.flow, 0)}</td>
                <td className="px-2 py-1 tabular-nums text-gray-500">{r.n}</td>
                <td className="px-2 py-1">
                  <span className={r.zone === "caution" ? "text-amber-700" : "text-emerald-700"}>{r.zone}</span>
                </td>
                <td className="px-2 py-1 text-gray-400">
                  best tercile by {r.basis} of {r.n} runs
                  {r.screenFellBack && (
                    <span className="text-amber-700"> · every run was dull-screened, so the full set was used</span>
                  )}
                </td>
              </tr>
            ))}
            {short.map((r) => (
              <tr key={r.formation} className="border-t border-gray-100 text-gray-400">
                <td className="px-2 py-1">{r.formation}</td>
                <td className="px-2 py-1 tabular-nums">{intc(r.depthFrom)}</td>
                <td className="px-2 py-1">{r.bitSizes.join(" / ")}</td>
                <td className="px-2 py-1" colSpan={6}>insufficient runs — {r.n} of the 5 needed for a band</td>
                <td className="px-2 py-1" />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Interp>
        Each band is the <b>P25–P75</b> of the parameters used by the best third of runs in that
        formation, ranked by cost per metre where the economics are computable and by
        trip-adjusted ROP otherwise. Runs that ended badly — cutting structure at 4/8 or worse, or
        pulled for a failure reason — are <b>excluded before ranking</b>, so the roadmap never
        recommends the settings that tore bits up. A <b>caution</b> zone means the group shows
        dysfunction evidence (wear rate in the worst quartile, MSE varying by more than half its
        mean, or a quarter of runs pulled for failure); hover the chip for which. These are offset
        averages, so treat them as a starting window to be confirmed on the rig — and remember most
        ROP limiters are not the bit. Source: SLB DrillOps parameter roadmap; SPE OPES-2024 (Muscat)
        hybrid roadmap workflow.
      </Interp>
    </div>
  );
}

/** A P25–P75 band drawn on a shared axis, so lengths compare across rows. */
function BandBar({ band, axis, unit }: {
  band: Band | null;
  axis: { lo: number; hi: number } | null;
  unit: string;
}) {
  if (!band || !axis) return <span className="text-gray-300">—</span>;
  const span = axis.hi - axis.lo || 1;
  const left = ((band.p25 - axis.lo) / span) * 100;
  const width = Math.max(1.5, ((band.p75 - band.p25) / span) * 100);
  const mid = ((band.median - axis.lo) / span) * 100;
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-3 flex-1 bg-gray-100 rounded" title={`${band.n} run(s) carried this parameter`}>
        <div className="absolute h-3 rounded bg-blue-200 border border-blue-400"
          style={{ left: `${left}%`, width: `${width}%` }} />
        <div className="absolute h-3 w-0.5 bg-blue-700" style={{ left: `${mid}%` }} />
      </div>
      <span className="tabular-nums text-gray-600 whitespace-nowrap">
        {bandText(band, unit === "rpm" ? 0 : 1)}
      </span>
    </div>
  );
}

const bandText = (b: Band | null, dp: number) =>
  b ? `${b.p25.toFixed(dp)}–${b.p75.toFixed(dp)}` : "—";

// ── Bit-type facet: cone vs PDC, then IADC series (leading digit) within each ──
// Sidebar filter sitting under "Bit sizes". Picking a class reveals that class's
// IADC-series chips (the leading IADC digit — cutter series). Filtering is
// client-side over the already-loaded points, so it applies instantly.

function BitTypeFilter({
  selClass, onClass, pdcSeries, coneSeries, unclassified,
  selPdcSeries, onPdcSeries, selConeSeries, onConeSeries,
}: {
  selClass: ClassSel;
  onClass: (c: ClassSel) => void;
  pdcSeries: string[]; coneSeries: string[];
  /** How many loaded points carry no bit class — gates the third tab. */
  unclassified: number;
  selPdcSeries: string[]; onPdcSeries: (s: string[]) => void;
  selConeSeries: string[]; onConeSeries: (s: string[]) => void;
}) {
  // Nothing to offer until a fetch has populated the class options.
  if (!pdcSeries.length && !coneSeries.length && !unclassified) return null;

  const series = selClass === "PDC" ? pdcSeries : selClass === "roller" ? coneSeries : [];
  const sel = selClass === "PDC" ? selPdcSeries : selConeSeries;
  const setSel = selClass === "PDC" ? onPdcSeries : onConeSeries;
  const toggle = (v: string) => setSel(sel.includes(v) ? sel.filter((x) => x !== v) : [...sel, v]);

  const TABS: { key: ClassSel; label: string; title?: string }[] = [
    { key: "", label: "All" },
    { key: "roller", label: "Cone" },
    { key: "PDC", label: "PDC" },
    // Only offered when such points are loaded — without it they would be
    // unreachable from the sidebar, which is how they used to be miscounted as
    // cone instead.
    ...(unclassified
      ? [{ key: "none" as const, label: "Unclassified",
           title: `${unclassified} point${unclassified === 1 ? "" : "s"} whose report carries no bit run (or no IADC code / bit type) — class unknown.` }]
      : []),
  ];

  return (
    <div className="pt-2">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-600 mb-1">Bit type</div>
      <div className="inline-flex rounded border border-gray-300 overflow-hidden">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => onClass(t.key)} title={t.title}
            className={`px-2.5 h-7 text-xs ${selClass === t.key ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
            {t.label}
          </button>
        ))}
      </div>
      {/* Unclassified points have no IADC code by construction — no series chips. */}
      {selClass && selClass !== "none" && (
        <div className="mt-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wide text-gray-500" title="Leading IADC digit — the cutter series.">
              IADC series {selClass === "PDC" ? "(after the letter)" : ""}
            </span>
            {!!sel.length && (
              <button onClick={() => setSel([])} className="text-[10px] text-blue-600 hover:underline">clear</button>
            )}
          </div>
          {series.length ? (
            <div className="flex flex-wrap gap-1">
              {series.map((d) => {
                const on = sel.includes(d);
                return (
                  <button key={d} onClick={() => toggle(d)}
                    className={`px-2 h-6 text-xs rounded border ${on ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"}`}>
                    {d}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-[11px] text-gray-400">No {selClass === "PDC" ? "PDC" : "cone"} bits with an IADC code in this selection.</div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Contour: a binned WOB×RPM heatmap, cells coloured by mean ROP ────────────

const ROP_STOPS: [number, string][] = [
  [0, "#2c3e9e"], [0.2, "#2c7fb8"], [0.4, "#41b6c4"], [0.55, "#7fcdbb"],
  [0.7, "#c7e9b4"], [0.82, "#fed976"], [0.92, "#fd8d3c"], [1, "#e31a1c"],
];
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function hex(c: string) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
/** Sequential cool→warm ROP colour for a value in [0,1]. */
function ropColor(t: number): string {
  const u = Math.max(0, Math.min(1, t));
  for (let i = 1; i < ROP_STOPS.length; i++) {
    if (u <= ROP_STOPS[i][0]) {
      const [p0, c0] = ROP_STOPS[i - 1], [p1, c1] = ROP_STOPS[i];
      const k = (u - p0) / (p1 - p0 || 1);
      const a = hex(c0), b = hex(c1);
      return `rgb(${Math.round(lerp(a[0], b[0], k))},${Math.round(lerp(a[1], b[1], k))},${Math.round(lerp(a[2], b[2], k))})`;
    }
  }
  return ROP_STOPS[ROP_STOPS.length - 1][1];
}

/** A "nice" bin step (1/2/5 × 10ⁿ) for a target bin count over a span. */
function niceStep(span: number, target: number): number {
  const raw = span / Math.max(1, target);
  const p = Math.pow(10, Math.floor(Math.log10(Math.max(1e-9, raw))));
  const n = raw / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

function ContourView({ points, bitSizes }: { points: RopPoint[]; bitSizes: string[] }) {
  const [sizeFilter, setSizeFilter] = useState<string>("");   // "" = all sizes
  const [overlay, setOverlay] = useState(true);

  const pts = useMemo(() => (sizeFilter ? points.filter((p) => p.bitSize === sizeFilter) : points), [points, sizeFilter]);

  const grid = useMemo(() => buildGrid(pts), [pts]);
  const best = useMemo(() => (grid ? bestCell(grid) : null), [grid]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap text-xs">
        <label className="flex items-center gap-1.5 text-gray-600">
          Bit size
          <select value={sizeFilter} onChange={(e) => setSizeFilter(e.target.value)} className="h-7 border border-gray-300 rounded px-1.5 bg-white">
            <option value="">All ({points.length})</option>
            {bitSizes.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-gray-600 cursor-pointer">
          <input type="checkbox" checked={overlay} onChange={(e) => setOverlay(e.target.checked)} /> Show data points
        </label>
        <span className="text-gray-400">
          Cell colour = mean ROP (m/hr) of the bit records in that WOB×RPM cell.
          {grid ? <> Scale {grid.ropMin.toFixed(1)}–{grid.ropMax.toFixed(1)} m/hr{sizeFilter ? ` · ${sizeFilter}" (${pts.length})` : ""}.</> : null}
        </span>
      </div>
      {best && (
        <div className="text-xs rounded bg-amber-50 border border-amber-200 text-amber-900 px-2 py-1">
          <b>Optimal window</b> (gold outline): best mean ROP <b>{best.mean.toFixed(1)} m/hr</b> at WOB {wobRange(best.wobLo, best.wobHi)} · RPM {Math.round(best.rpmLo)}–{Math.round(best.rpmHi)} ({best.n} record{best.n === 1 ? "" : "s"}).
        </div>
      )}
      {grid ? <Heatmap grid={grid} points={overlay ? pts : []} best={best} /> : <Empty>Not enough points to bin.</Empty>}
    </div>
  );
}

interface Grid {
  wobMin: number; wobStep: number; nx: number;
  rpmMin: number; rpmStep: number; ny: number;
  cells: { sum: number; n: number }[];   // length nx*ny, row-major (x + y*nx)
  ropMin: number; ropMax: number;
}
function buildGrid(pts: RopPoint[]): Grid | null {
  if (pts.length < 2) return null;
  let wlo = Infinity, whi = -Infinity, rlo = Infinity, rhi = -Infinity;
  for (const p of pts) {
    wlo = Math.min(wlo, p.wob); whi = Math.max(whi, p.wob);
    rlo = Math.min(rlo, p.rpm); rhi = Math.max(rhi, p.rpm);
  }
  if (!Number.isFinite(wlo) || whi <= wlo || rhi <= rlo) return null;
  const wobStep = niceStep(whi - wlo, 14), rpmStep = niceStep(rhi - rlo, 12);
  const wobMin = Math.floor(wlo / wobStep) * wobStep;
  const rpmMin = Math.floor(rlo / rpmStep) * rpmStep;
  const nx = Math.max(1, Math.ceil((whi - wobMin) / wobStep + 1e-9));
  const ny = Math.max(1, Math.ceil((rhi - rpmMin) / rpmStep + 1e-9));
  const cells = Array.from({ length: nx * ny }, () => ({ sum: 0, n: 0 }));
  for (const p of pts) {
    const ix = Math.min(nx - 1, Math.floor((p.wob - wobMin) / wobStep));
    const iy = Math.min(ny - 1, Math.floor((p.rpm - rpmMin) / rpmStep));
    const c = cells[ix + iy * nx]; c.sum += p.rop; c.n += 1;
  }
  // Colour scale spans the CELL-MEAN range actually shown (so the legend's
  // min/max track the selected bit size and the full colour ramp is used),
  // not the raw single-record spread.
  let plo = Infinity, phi = -Infinity;
  for (const c of cells) { if (!c.n) continue; const m = c.sum / c.n; if (m < plo) plo = m; if (m > phi) phi = m; }
  if (!Number.isFinite(plo)) { plo = 0; phi = 1; }
  if (phi <= plo) phi = plo + 1;   // keep a non-zero span when one cell only
  return { wobMin, wobStep, nx, rpmMin, rpmStep, ny, cells, ropMin: plo, ropMax: phi };
}

interface BestCell { ix: number; iy: number; mean: number; n: number; wobLo: number; wobHi: number; rpmLo: number; rpmHi: number; }
/** The WOB×RPM cell with the highest mean ROP — the recommended operating window.
 *  Requires ≥ minN records to avoid chasing single-point noise; relaxes to 1 only
 *  if no cell qualifies. */
function bestCell(grid: Grid, minN = 2): BestCell | null {
  let best: BestCell | null = null;
  for (let i = 0; i < grid.cells.length; i++) {
    const c = grid.cells[i]; if (c.n < minN) continue;
    const mean = c.sum / c.n;
    if (!best || mean > best.mean) {
      const ix = i % grid.nx, iy = Math.floor(i / grid.nx);
      best = { ix, iy, mean, n: c.n,
        wobLo: grid.wobMin + ix * grid.wobStep, wobHi: grid.wobMin + (ix + 1) * grid.wobStep,
        rpmLo: grid.rpmMin + iy * grid.rpmStep, rpmHi: grid.rpmMin + (iy + 1) * grid.rpmStep };
    }
  }
  if (!best && minN > 1) return bestCell(grid, 1);
  return best;
}

function Heatmap({ grid, points, best }: { grid: Grid; points: RopPoint[]; best?: BestCell | null }) {
  const [hover, setHover] = useState<{ x: number; y: number; html: string } | null>(null);
  const PAD = { l: 64, r: 24, t: 12, b: 48 };
  const CW = 46, CH = 30;                                  // px per cell
  const plotW = grid.nx * CW, plotH = grid.ny * CH;
  const W = PAD.l + plotW + PAD.r, H = PAD.t + plotH + PAD.b;
  const span = grid.ropMax - grid.ropMin || 1;
  const norm = (rop: number) => (rop - grid.ropMin) / span;
  // Screen position: x grows right, RPM (y) grows UP, so high RPM at the top.
  const sx = (wob: number) => PAD.l + ((wob - grid.wobMin) / grid.wobStep) * CW;
  const sy = (rpm: number) => PAD.t + plotH - ((rpm - grid.rpmMin) / grid.rpmStep) * CH;

  return (
    <div className="relative inline-block">
      <svg width={W} height={H} className="block max-w-full" style={{ fontFamily: "inherit" }}>
        {/* cells */}
        {grid.cells.map((c, i) => {
          if (!c.n) return null;
          const ix = i % grid.nx, iy = Math.floor(i / grid.nx);
          const mean = c.sum / c.n;
          const x = PAD.l + ix * CW, y = PAD.t + plotH - (iy + 1) * CH;
          const wobLo = grid.wobMin + ix * grid.wobStep, rpmLo = grid.rpmMin + iy * grid.rpmStep;
          const html = `WOB ${fmt1(wobLo)}–${fmt1(wobLo + grid.wobStep)} klb · RPM ${Math.round(rpmLo)}–${Math.round(rpmLo + grid.rpmStep)}<br/><b>mean ROP ${mean.toFixed(1)} m/hr</b> · ${c.n} record${c.n === 1 ? "" : "s"}`;
          return (
            <rect key={i} x={x} y={y} width={CW} height={CH} fill={ropColor(norm(mean))} stroke="#ffffff" strokeWidth={1}
              onMouseEnter={(e) => setHover({ x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY, html })}
              onMouseMove={(e) => setHover({ x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY, html })}
              onMouseLeave={() => setHover(null)} />
          );
        })}
        {/* scatter overlay */}
        {points.map((p, i) => (
          <circle key={i} cx={sx(p.wob)} cy={sy(p.rpm)} r={2.2} fill="#111827" fillOpacity={0.45} stroke="#fff" strokeWidth={0.4} pointerEvents="none" />
        ))}
        {/* optimal-window highlight: the highest-mean-ROP cell */}
        {best && (
          <rect x={PAD.l + best.ix * CW} y={PAD.t + plotH - (best.iy + 1) * CH} width={CW} height={CH}
            fill="none" stroke="#b45309" strokeWidth={3} pointerEvents="none" />
        )}
        {/* axes frame */}
        <rect x={PAD.l} y={PAD.t} width={plotW} height={plotH} fill="none" stroke="#cbd5e1" />
        {/* X ticks (WOB) */}
        {Array.from({ length: grid.nx + 1 }, (_, k) => {
          const v = grid.wobMin + k * grid.wobStep, x = PAD.l + k * CW;
          return (
            <g key={`x${k}`}>
              <line x1={x} y1={PAD.t + plotH} x2={x} y2={PAD.t + plotH + 4} stroke="#94a3b8" />
              <text x={x} y={PAD.t + plotH + 16} textAnchor="middle" fontSize={10} fill="#475569">{fmt1(v)}</text>
            </g>
          );
        })}
        <text x={PAD.l + plotW / 2} y={H - 8} textAnchor="middle" fontSize={11} fill="#334155" fontWeight={600}>Weight on bit (klb)</text>
        {/* Y ticks (RPM) — bottom→top */}
        {Array.from({ length: grid.ny + 1 }, (_, k) => {
          const v = grid.rpmMin + k * grid.rpmStep, y = PAD.t + plotH - k * CH;
          return (
            <g key={`y${k}`}>
              <line x1={PAD.l - 4} y1={y} x2={PAD.l} y2={y} stroke="#94a3b8" />
              <text x={PAD.l - 8} y={y + 3} textAnchor="end" fontSize={10} fill="#475569">{Math.round(v)}</text>
            </g>
          );
        })}
        <text transform={`translate(14 ${PAD.t + plotH / 2}) rotate(-90)`} textAnchor="middle" fontSize={11} fill="#334155" fontWeight={600}>RPM</text>
      </svg>
      <Colorbar ropMin={grid.ropMin} ropMax={grid.ropMax} />
      {hover && (
        <div className="absolute z-20 pointer-events-none px-2 py-1 rounded bg-gray-900 text-white text-[11px] leading-tight shadow-lg"
          style={{ left: hover.x + 12, top: hover.y + 12, maxWidth: 240 }}
          dangerouslySetInnerHTML={{ __html: hover.html }} />
      )}
    </div>
  );
}

/** Horizontal ROP colour legend under the heatmap. */
function Colorbar({ ropMin, ropMax }: { ropMin: number; ropMax: number }) {
  const stops = Array.from({ length: 33 }, (_, i) => i / 32);
  return (
    <div className="flex items-center gap-2 mt-1 ml-16 text-[10px] text-gray-500">
      <span>ROP {ropMin.toFixed(1)}</span>
      <div className="flex h-3 w-48 rounded overflow-hidden border border-gray-300">
        {stops.map((t, i) => <div key={i} style={{ background: ropColor(t), width: `${100 / stops.length}%` }} />)}
      </div>
      <span>{ropMax.toFixed(1)} m/hr</span>
    </div>
  );
}

// ── 3D ROP voxels: WOB × RPM × depth lattice, cube colour = mean ROP ─────────
// The drill-off parameter map extended into the depth dimension: X = weight on
// bit, Y = RPM, Z = depth, each cube the mean ROP of the bit records that fall
// in that WOB×RPM×depth cell (cool→warm = slow→fast). Hover a cube for its mean.

interface Voxel { ix: number; iy: number; iz: number; mean: number; n: number; }
interface Lattice {
  wobMin: number; wobStep: number; nx: number;
  rpmMin: number; rpmStep: number; ny: number;
  depMin: number; depStep: number; nz: number;
  voxels: Voxel[]; ropMin: number; ropMax: number; used: number;
}
/** Depth of a bit run = midpoint of its from/to interval (else whichever end). */
const ptDepth = (p: RopPoint): number | null =>
  p.from != null && p.to != null ? (p.from + p.to) / 2 : (p.to ?? p.from ?? null);

function buildLattice(pts: RopPoint[], granularity: number = 1): Lattice | null {
  const withDepth = pts.filter((p) => ptDepth(p) != null);
  if (withDepth.length < 2) return null;
  let wlo = Infinity, whi = -Infinity, rlo = Infinity, rhi = -Infinity, dlo = Infinity, dhi = -Infinity;
  for (const p of withDepth) {
    const d = ptDepth(p)!;
    wlo = Math.min(wlo, p.wob); whi = Math.max(whi, p.wob);
    rlo = Math.min(rlo, p.rpm); rhi = Math.max(rhi, p.rpm);
    dlo = Math.min(dlo, d); dhi = Math.max(dhi, d);
  }
  if (whi <= wlo || rhi <= rlo || dhi <= dlo) return null;
  const wobStep = niceStep(whi - wlo, 8) / granularity, rpmStep = niceStep(rhi - rlo, 7) / granularity, depStep = niceStep(dhi - dlo, 8) / granularity;
  const wobMin = Math.floor(wlo / wobStep) * wobStep;
  const rpmMin = Math.floor(rlo / rpmStep) * rpmStep;
  const depMin = Math.floor(dlo / depStep) * depStep;
  const nx = Math.max(1, Math.ceil((whi - wobMin) / wobStep + 1e-9));
  const ny = Math.max(1, Math.ceil((rhi - rpmMin) / rpmStep + 1e-9));
  const nz = Math.max(1, Math.ceil((dhi - depMin) / depStep + 1e-9));
  const acc = new Map<number, { sum: number; n: number }>();
  for (const p of withDepth) {
    const d = ptDepth(p)!;
    const ix = Math.min(nx - 1, Math.floor((p.wob - wobMin) / wobStep));
    const iy = Math.min(ny - 1, Math.floor((p.rpm - rpmMin) / rpmStep));
    const iz = Math.min(nz - 1, Math.floor((d - depMin) / depStep));
    const key = ix + iy * nx + iz * nx * ny;
    const c = acc.get(key) ?? { sum: 0, n: 0 }; c.sum += p.rop; c.n += 1; acc.set(key, c);
  }
  let ropMin = Infinity, ropMax = -Infinity;
  const voxels: Voxel[] = [];
  for (const [key, c] of acc) {
    const ix = key % nx, iy = Math.floor(key / nx) % ny, iz = Math.floor(key / (nx * ny));
    const mean = c.sum / c.n; if (mean < ropMin) ropMin = mean; if (mean > ropMax) ropMax = mean;
    voxels.push({ ix, iy, iz, mean, n: c.n });
  }
  if (!Number.isFinite(ropMin)) { ropMin = 0; ropMax = 1; }
  if (ropMax <= ropMin) ropMax = ropMin + 1;
  return { wobMin, wobStep, nx, rpmMin, rpmStep, ny, depMin, depStep, nz, voxels, ropMin, ropMax, used: withDepth.length };
}

function Voxel3DView({ points, bitSizes }: { points: RopPoint[]; bitSizes: string[] }) {
  const [sizeFilter, setSizeFilter] = useState<string>("");
  const [granularity, setGranularity] = useState(1);
  const pts = useMemo(() => (sizeFilter ? points.filter((p) => p.bitSize === sizeFilter) : points), [points, sizeFilter]);
  const lattice = useMemo(() => buildLattice(pts, granularity), [pts, granularity]);
  const withDepth = pts.filter((p) => ptDepth(p) != null).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap text-xs">
        <label className="flex items-center gap-1.5 text-gray-600">
          Bit size
          <select value={sizeFilter} onChange={(e) => setSizeFilter(e.target.value)} className="h-7 border border-gray-300 rounded px-1.5 bg-white">
            <option value="">All ({points.length})</option>
            {bitSizes.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-gray-600">
          Cell size
          <div className="inline-flex rounded border border-gray-300 gap-0.5 bg-white p-0.5">
            {[1, 2, 4, 8].map((g) => (
              <button key={g} onClick={() => setGranularity(g)}
                className={`px-2 py-1 text-[11px] rounded ${granularity === g ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}>
                ÷{g}
              </button>
            ))}
          </div>
        </label>
        <span className="text-gray-400">
          X = WOB (klb) · Y = RPM · Z = depth (m). Cube colour = mean ROP. Drag to orbit, scroll to zoom.
          {lattice ? <> Scale {lattice.ropMin.toFixed(1)}–{lattice.ropMax.toFixed(1)} m/hr · {lattice.voxels.length} cells from {withDepth} records.</> : null}
        </span>
      </div>
      {lattice
        ? <>
            <div className="border border-gray-200 rounded overflow-hidden" style={{ height: 700 }}>
              <VoxelScene lattice={lattice} />
            </div>
            <Colorbar ropMin={lattice.ropMin} ropMax={lattice.ropMax} />
          </>
        : <Empty>Not enough bit records with depth (from/to) to build a 3D lattice for this selection.</Empty>}
    </div>
  );
}

function VoxelScene({ lattice }: { lattice: Lattice }) {
  const [hover, setHover] = useState<string | null>(null);
  // Map the lattice into a centred ~±10 unit box (axis-independent scaling so
  // the cube grid reads clearly regardless of the real WOB/RPM/depth extents).
  const { cubes, axes } = useMemo(() => {
    const L = lattice, S = 18;
    const sx = S / L.nx, sy = S / L.ny, sz = S / L.nz;
    const cx = (L.nx * sx) / 2, cy = (L.ny * sy) / 2, cz = (L.nz * sz) / 2;
    const span = L.ropMax - L.ropMin || 1;
    const gap = 0.86;
    const cubes = L.voxels.map((v) => {
      const t = (v.mean - L.ropMin) / span;
      const wobLo = L.wobMin + v.ix * L.wobStep, rpmLo = L.rpmMin + v.iy * L.rpmStep, depLo = L.depMin + v.iz * L.depStep;
      return {
        key: `${v.ix}-${v.iy}-${v.iz}`,
        // Z grows DOWN (depth): negative Y so deeper voxels sit lower.
        pos: [v.ix * sx - cx + sx / 2, -(v.iz * sz - cz + sz / 2), v.iy * sy - cy + sy / 2] as [number, number, number],
        size: [sx * gap, sz * gap, sy * gap] as [number, number, number],
        color: ropColor(t),
        info: `WOB ${fmt1(wobLo)}–${fmt1(wobLo + L.wobStep)} · RPM ${Math.round(rpmLo)}–${Math.round(rpmLo + L.rpmStep)} · depth ${Math.round(depLo)}–${Math.round(depLo + L.depStep)} m — mean ROP ${v.mean.toFixed(1)} m/hr (${v.n})`,
      };
    });
    const axes = { sx, sy, sz, cx, cy, cz, half: S / 2 };
    return { cubes, axes };
  }, [lattice]);

  return (
    <div className="relative h-full">
      <Canvas camera={{ position: [22, 16, 24], fov: 42, near: 0.1, far: 1000 }} dpr={[1, 1.5]} className="bg-gray-50">
        <ambientLight intensity={0.85} />
        <directionalLight position={[12, 24, 12]} intensity={0.55} />
        <directionalLight position={[-12, -8, -12]} intensity={0.25} />
        {cubes.map((c) => (
          <mesh key={c.key} position={c.pos}
            onPointerOver={(e) => { e.stopPropagation(); setHover(c.info); }}
            onPointerOut={() => setHover(null)}>
            <boxGeometry args={c.size} />
            <meshStandardMaterial color={c.color} transparent opacity={0.92} />
          </mesh>
        ))}
        {/* axis frame at the box corner + labels */}
        <lineSegments position={[0, 0, 0]}>
          <edgesGeometry args={[new THREE.BoxGeometry(axes.half * 2, axes.half * 2, axes.half * 2)]} />
          <lineBasicMaterial color="#cbd5e1" />
        </lineSegments>
        <Text position={[0, -axes.half - 1.6, axes.half + 1.6]} fontSize={1.1} color="#334155" anchorX="center">WOB →</Text>
        <Text position={[axes.half + 1.6, -axes.half - 1.6, 0]} rotation={[0, Math.PI / 2, 0]} fontSize={1.1} color="#334155" anchorX="center">RPM →</Text>
        <Text position={[-axes.half - 1.6, 0, axes.half + 1.6]} rotation={[0, 0, Math.PI / 2]} fontSize={1.1} color="#334155" anchorX="center">← depth</Text>
        <OrbitControls enablePan enableZoom enableRotate makeDefault />
        <GizmoHelper alignment="bottom-right" margin={[40, 40]}>
          <GizmoViewport axisColors={["#dc2626", "#16a34a", "#2563eb"]} labelColor="white" />
        </GizmoHelper>
      </Canvas>
      {hover && (
        <div className="absolute left-2 bottom-2 z-20 pointer-events-none px-2 py-1 rounded bg-gray-900 text-white text-[11px] leading-tight shadow-lg max-w-[420px]">
          {hover}
        </div>
      )}
    </div>
  );
}

// ── Scatters: ROP vs WOB and ROP vs RPM, split by bit size ───────────────────

// Points typed on the rig (entry module) are drawn as a hollow ring in their bit
// size's colour, so they read as the same series but are told apart at a glance
// from the filled legacy-archive dots.
const renderEnteredRing = (props: { cx?: number; cy?: number; fill?: string }) => (
  <circle cx={props.cx} cy={props.cy} r={4} fill="none" stroke={props.fill ?? "#111827"} strokeWidth={1.6} strokeOpacity={0.95} />
);

function ScatterView({ points, bitSizes }: { points: RopPoint[]; bitSizes: string[] }) {
  const series = useMemo(() => {
    const m = new Map<string, { legacy: RopPoint[]; entered: RopPoint[] }>();
    for (const p of points) {
      let e = m.get(p.bitSize);
      if (!e) { e = { legacy: [], entered: [] }; m.set(p.bitSize, e); }
      (p.source === "entered" ? e.entered : e.legacy).push(p);
    }
    return bitSizes.filter((b) => m.has(b)).map((b) => ({ size: b, ...m.get(b)! }));
  }, [points, bitSizes]);
  const enteredCount = useMemo(() => points.filter((p) => p.source === "entered").length, [points]);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <ScatterPanel title="ROP vs Weight on bit" xKey="wob" xLabel="WOB (klb)" series={series} bitSizes={bitSizes} />
      <ScatterPanel title="ROP vs RPM" xKey="rpm" xLabel="RPM" series={series} bitSizes={bitSizes} />
      {enteredCount > 0 && (
        <div className="xl:col-span-2 flex items-center gap-1.5 text-[11px] text-gray-600">
          <svg width={13} height={13} className="shrink-0" aria-hidden>
            <circle cx={6.5} cy={6.5} r={4} fill="none" stroke="#334155" strokeWidth={1.6} />
          </svg>
          <span>
            <b>{enteredCount}</b> of {points.length} point{points.length === 1 ? "" : "s"} entered on the rig
            (drilling parameters, one per drilled interval) — hollow rings; filled dots are legacy archive bit records.
          </span>
        </div>
      )}
    </div>
  );
}

function ScatterPanel({ title, xKey, xLabel, series, bitSizes }: {
  title: string; xKey: "wob" | "rpm"; xLabel: string;
  series: { size: string; legacy: RopPoint[]; entered: RopPoint[] }[]; bitSizes: string[];
}) {
  return (
    <div className="border border-gray-200 rounded p-2">
      <div className="text-sm font-medium text-gray-700 mb-1">{title}</div>
      <ResponsiveContainer width="100%" height={340}>
        <ScatterChart margin={{ ...CHART_MARGIN, right: 12 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
          <XAxis type="number" dataKey={xKey} name={xLabel} tick={{ fontSize: 11 }} domain={niceDomain()} allowDataOverflow
            label={{ value: xLabel, position: "insideBottom", offset: -18, fontSize: 11 }} />
          <YAxis type="number" dataKey="rop" name="ROP" tick={{ fontSize: 11 }} domain={niceDomain()} allowDataOverflow
            label={{ value: "ROP (m/hr)", angle: -90, position: "insideLeft", fontSize: 11 }} />
          <ZAxis range={[28, 28]} />
          <Tooltip cursor={{ strokeDasharray: "3 3" }} content={<ScatterTip xKey={xKey} xLabel={xLabel} />} />
          <Legend {...LEGEND_TOP} />
          {/* One legend entry per bit size (the archive dots), plus the same-colour
              rings for that size's rig-entered points. */}
          {/* Only sizes that actually have archive points get a filled-dot series:
              a size present solely in rig-entered data would otherwise contribute an
              empty series whose legend swatch (a filled dot) contradicts every mark
              on the plot — the normal case when the legacy DB is absent. */}
          {series.filter((s) => s.legacy.length).map((s) => (
            <Scatter key={s.size} name={s.size} data={s.legacy} fill={colorForSize(bitSizes, s.size)} fillOpacity={0.6} />
          ))}
          {series.filter((s) => s.entered.length).map((s) => (
            <Scatter key={`${s.size}-entered`} name={`${s.size} · rig entry`} data={s.entered}
              fill={colorForSize(bitSizes, s.size)}
              shape={renderEnteredRing}
              // Sizes with no archive points have no other legend entry, so this
              // ring series must carry one; otherwise the size is unlabelled.
              legendType={s.legacy.length ? "none" : "circle"} />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

function ScatterTip({ active, payload, xKey, xLabel }: any) {
  if (!active || !payload?.length) return null;
  const p: RopPoint = payload[0].payload;
  return (
    <div className="px-2 py-1 rounded bg-gray-900 text-white text-[11px] leading-tight shadow-lg">
      <div className="font-semibold">{p.name} · {p.bitSize}"</div>
      <div>{xLabel}: {fmt1(xKey === "wob" ? p.wob : p.rpm)}</div>
      <div>ROP: {p.rop} m/hr</div>
      {p.date && <div className="text-gray-300">{p.date}</div>}
      {p.source === "entered" && <div className="text-amber-300">rig entry · drilling parameters</div>}
    </div>
  );
}

// ── By bit size: mean / max ROP per bit diameter ─────────────────────────────

function BySizeView({ points, bitSizes }: { points: RopPoint[]; bitSizes: string[] }) {
  const rows = useMemo(() => {
    const m = new Map<string, { sum: number; n: number; max: number }>();
    for (const p of points) {
      const e = m.get(p.bitSize) ?? { sum: 0, n: 0, max: 0 };
      e.sum += p.rop; e.n += 1; e.max = Math.max(e.max, p.rop); m.set(p.bitSize, e);
    }
    return bitSizes.filter((b) => m.has(b)).map((b) => {
      const e = m.get(b)!;
      return { size: b, meanRop: Number((e.sum / e.n).toFixed(2)), maxRop: e.max, n: e.n };
    });
  }, [points, bitSizes]);

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium text-gray-700">Mean ROP by bit size</div>
      <ResponsiveContainer width="100%" height={Math.max(220, rows.length * 46)}>
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 48, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11 }} label={{ value: "Mean ROP (m/hr)", position: "insideBottom", offset: -4, fontSize: 11 }} />
          <YAxis type="category" dataKey="size" width={64} tick={{ fontSize: 11 }} />
          <Tooltip content={<SizeTip />} />
          <Bar dataKey="meanRop" radius={[0, 3, 3, 0]} label={{ position: "right", fontSize: 11, formatter: (v: number) => v.toFixed(1) }}>
            {rows.map((r) => <Cell key={r.size} fill={colorForSize(bitSizes, r.size)} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function SizeTip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload as { size: string; meanRop: number; maxRop: number; n: number };
  return (
    <div className="px-2 py-1 rounded bg-gray-900 text-white text-[11px] leading-tight shadow-lg">
      <div className="font-semibold">{r.size}" bit</div>
      <div>Mean ROP: {r.meanRop} m/hr</div>
      <div>Max ROP: {fmt1(r.maxRop)} m/hr</div>
      <div className="text-gray-300">{r.n} record{r.n === 1 ? "" : "s"}</div>
    </div>
  );
}

// ── Progress: drilling-progress / learning-curve views over the bit runs ─────
// Three next-well-engineering views: (1) cumulative bit depth vs elapsed days,
// one line per well — the drilling learning curve; (2) cumulative metres drilled
// vs bit-run number — each bit's footage contribution; (3) ROP vs depth — how
// penetration rate degrades with depth (bit / parameter selection for the next
// well's deeper sections).

/** Jalali "YYYY/MM/DD" → serial day number (Birashk), for elapsed-day spacing. */
const idiv = (a: number, b: number) => Math.floor(a / b);
function jDay(date: string | null | undefined): number | null {
  const m = (date ?? "").trim().match(/^(\d{3,4})\/(\d{1,2})\/(\d{1,2})$/);
  if (!m) return null;
  const jy = +m[1] + 1595, jm = +m[2], jd = +m[3];
  if (jm < 1 || jm > 12 || jd < 1 || jd > 31) return null;
  return -355668 + 365 * jy + idiv(jy, 33) * 8 + idiv((jy % 33) + 3, 4) + jd + (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);
}

const PROGRESS_COLORS = ["#1e40af", "#dc2626", "#0d9488", "#d97706", "#7c3aed", "#65a30d", "#db2777", "#0891b2", "#ea580c", "#4f46e5", "#16a34a", "#9f1239"];

type ProgressMode = "depthDays" | "footageRun" | "ropDepth";
const PROGRESS_MODES: { key: ProgressMode; label: string }[] = [
  { key: "depthDays", label: "Depth vs days" },
  { key: "footageRun", label: "Footage by bit run" },
  { key: "ropDepth", label: "ROP vs depth" },
];

function ProgressView({ points }: { points: RopPoint[] }) {
  const [mode, setMode] = useState<ProgressMode>("depthDays");
  // Per-well bit runs ordered by date (then by depth), capped to a legible set.
  const WELL_MAX = 12;
  const wells = useMemo(() => {
    const m = new Map<string, RopPoint[]>();
    for (const p of points) { const a = m.get(p.wellCode); if (a) a.push(p); else m.set(p.wellCode, [p]); }
    const ordered = [...m.entries()].map(([code, pts]) => {
      const sorted = pts.slice().sort((a, b) => {
        const da = jDay(a.date), db = jDay(b.date);
        if (da != null && db != null && da !== db) return da - db;
        return (a.to ?? a.from ?? 0) - (b.to ?? b.from ?? 0);
      });
      return { code, name: sorted[0]?.name || code, pts: sorted, n: sorted.length };
    });
    // Most-active wells first (more bit runs = richer curve).
    return ordered.sort((a, b) => b.n - a.n);
  }, [points]);

  const shown = wells.slice(0, WELL_MAX);
  const capped = wells.length > shown.length;
  const colorOf = (i: number) => PROGRESS_COLORS[i % PROGRESS_COLORS.length];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="inline-flex rounded border border-gray-300 overflow-hidden">
          {PROGRESS_MODES.map((m) => (
            <button key={m.key} onClick={() => setMode(m.key)}
              className={`px-2.5 h-7 text-xs ${mode === m.key ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
              {m.label}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-gray-400">
          {mode === "depthDays" ? "Cumulative bit depth against elapsed days — the drilling learning curve (lower-right = faster)."
            : mode === "footageRun" ? "Cumulative metres drilled against bit-run number — each bit's footage contribution."
            : "ROP against depth — how penetration rate changes with depth."}
          {capped ? ` Showing the ${shown.length} most-active wells of ${wells.length}.` : ""}
        </span>
      </div>
      {!shown.length ? <Empty>No usable depth/date on these bit records to plot progress.</Empty>
        : mode === "depthDays" ? <DepthDaysChart wells={shown} colorOf={colorOf} />
        : mode === "footageRun" ? <FootageRunChart wells={shown} colorOf={colorOf} />
        : <RopDepthChart wells={shown} colorOf={colorOf} />}
    </div>
  );
}

type WellRuns = { code: string; name: string; pts: RopPoint[]; n: number };

/** Cumulative bit depth (ToPoint) vs elapsed days from each well's first bit run. */
function DepthDaysChart({ wells, colorOf }: { wells: WellRuns[]; colorOf: (i: number) => string }) {
  const series = useMemo(() => wells.map((w) => {
    const day0 = w.pts.map((p) => jDay(p.date)).filter((d): d is number => d != null)[0] ?? null;
    const data: { day: number; depth: number; date: string | null; bitSize: string }[] = [];
    let runIdx = 0;
    for (const p of w.pts) {
      const jd = jDay(p.date);
      const day = jd != null && day0 != null ? jd - day0 : runIdx; // fall back to run index when dates missing
      const depth = p.to ?? p.from;
      if (depth == null) { runIdx++; continue; }
      data.push({ day, depth, date: p.date, bitSize: p.bitSize });
      runIdx++;
    }
    return { ...w, data };
  }).filter((w) => w.data.length >= 1), [wells]);

  if (!series.some((s) => s.data.length >= 2)) return <Empty>Not enough dated bit runs to draw a learning curve.</Empty>;
  return (
    <ResponsiveContainer width="100%" height={460}>
      <LineChart margin={CHART_MARGIN}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
        <XAxis type="number" dataKey="day" tick={{ fontSize: 11 }} allowDuplicatedCategory={false} domain={niceDomain()} allowDataOverflow
          label={{ value: "Days from first bit run", position: "insideBottom", offset: -18, fontSize: 11 }} />
        <YAxis type="number" reversed dataKey="depth" tick={{ fontSize: 11 }} domain={niceDomain()} allowDataOverflow
          label={{ value: "Bit depth (m)", angle: -90, position: "insideLeft", fontSize: 11 }} />
        <Tooltip content={<ProgressTip kind="depthDays" />} />
        <Legend {...LEGEND_TOP} />
        {series.map((s, i) => (
          <Line key={s.code} type="monotone" dataKey="depth" data={s.data} name={s.name} stroke={colorOf(i)}
            strokeWidth={1.8} dot={{ r: 2 }} activeDot={{ r: 4 }} isAnimationActive={false} connectNulls />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Cumulative metres drilled vs bit-run number, one step-line per well. */
function FootageRunChart({ wells, colorOf }: { wells: WellRuns[]; colorOf: (i: number) => string }) {
  const series = useMemo(() => wells.map((w) => {
    let cum = 0;
    const data = w.pts.map((p, j) => {
      const m = p.meters ?? ((p.to != null && p.from != null) ? p.to - p.from : 0);
      cum += Math.max(0, m);
      return { run: j + 1, cum: Number(cum.toFixed(1)), m: Math.max(0, m), date: p.date, bitSize: p.bitSize, rop: p.rop };
    });
    return { ...w, data };
  }).filter((w) => w.data.length >= 1), [wells]);

  if (!series.some((s) => s.data.length >= 1)) return <Empty>No footage to accumulate.</Empty>;
  return (
    <ResponsiveContainer width="100%" height={460}>
      <LineChart margin={CHART_MARGIN}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
        <XAxis type="number" dataKey="run" tick={{ fontSize: 11 }} allowDecimals={false}
          label={{ value: "Bit run #", position: "insideBottom", offset: -18, fontSize: 11 }} />
        <YAxis type="number" dataKey="cum" tick={{ fontSize: 11 }} domain={niceDomain()} allowDataOverflow
          label={{ value: "Cumulative metres", angle: -90, position: "insideLeft", fontSize: 11 }} />
        <Tooltip content={<ProgressTip kind="footageRun" />} />
        <Legend {...LEGEND_TOP} />
        {series.map((s, i) => (
          <Line key={s.code} type="stepAfter" dataKey="cum" data={s.data} name={s.name} stroke={colorOf(i)}
            strokeWidth={1.8} dot={{ r: 2 }} activeDot={{ r: 4 }} isAnimationActive={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

/** ROP vs depth (the run's mid-depth) — how penetration rate changes with depth. */
function RopDepthChart({ wells, colorOf }: { wells: WellRuns[]; colorOf: (i: number) => string }) {
  const series = useMemo(() => wells.map((w) => {
    const data = w.pts.map((p) => {
      const depth = (p.from != null && p.to != null) ? (p.from + p.to) / 2 : (p.to ?? p.from);
      return depth == null ? null : { depth: Number(depth.toFixed(0)), rop: p.rop, date: p.date, bitSize: p.bitSize };
    }).filter(Boolean) as { depth: number; rop: number; date: string | null; bitSize: string }[];
    return { ...w, data: data.sort((a, b) => a.depth - b.depth) };
  }).filter((w) => w.data.length >= 1), [wells]);

  if (!series.some((s) => s.data.length >= 1)) return <Empty>No depth to plot ROP against.</Empty>;
  return (
    <ResponsiveContainer width="100%" height={460}>
      <ScatterChart margin={CHART_MARGIN}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
        <XAxis type="number" dataKey="depth" tick={{ fontSize: 11 }} name="Depth" domain={niceDomain()} allowDataOverflow
          label={{ value: "Depth (m)", position: "insideBottom", offset: -18, fontSize: 11 }} />
        <YAxis type="number" dataKey="rop" tick={{ fontSize: 11 }} name="ROP" domain={niceDomain()} allowDataOverflow
          label={{ value: "ROP (m/hr)", angle: -90, position: "insideLeft", fontSize: 11 }} />
        <ZAxis range={[30, 30]} />
        <Tooltip cursor={{ strokeDasharray: "3 3" }} content={<ProgressTip kind="ropDepth" />} />
        <Legend {...LEGEND_TOP} />
        {series.map((s, i) => (
          <Scatter key={s.code} name={s.name} data={s.data} fill={colorOf(i)} fillOpacity={0.65} line={{ stroke: colorOf(i), strokeWidth: 1 }} lineType="joint" />
        ))}
      </ScatterChart>
    </ResponsiveContainer>
  );
}

function ProgressTip({ active, payload, kind }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const name = payload[0].name;
  return (
    <div className="px-2 py-1 rounded bg-gray-900 text-white text-[11px] leading-tight shadow-lg">
      <div className="font-semibold">{name}{p.bitSize ? ` · ${p.bitSize}"` : ""}</div>
      {kind === "depthDays" && <><div>Day {fmt1(p.day)} · depth {fmt1(p.depth)} m</div></>}
      {kind === "footageRun" && <><div>Run #{p.run} · +{fmt1(p.m)} m → {fmt1(p.cum)} m</div>{p.rop != null && <div>ROP {p.rop} m/hr</div>}</>}
      {kind === "ropDepth" && <><div>Depth {fmt1(p.depth)} m · ROP {p.rop} m/hr</div></>}
      {p.date && <div className="text-gray-300">{p.date}</div>}
    </div>
  );
}

// ── Table: the underlying bit records, a row opens that day's report ─────────

// Every bit-record field surfaced by the TABLE view, in display order. `align`
// drives header + cell justification; `get` renders one point (null → "—").
// Keeping headers and cells in one list stops the columns drifting out of sync.
const TABLE_COLS: { key: string; label: string; align: "left" | "right"; get: (p: RopPoint) => React.ReactNode }[] = [
  { key: "date", label: "Date", align: "left", get: (p) => p.date ?? "—" },
  { key: "field", label: "Field", align: "left", get: (p) => p.field ?? "—" },
  { key: "bitSize", label: "Bit size", align: "right", get: (p) => p.bitSize },
  { key: "topFormation", label: "Top formation", align: "left", get: (p) => p.topFormation ?? "—" },
  { key: "iadc", label: "IADC", align: "left", get: (p) => p.iadc ?? "—" },
  { key: "bitClass", label: "Class", align: "left", get: (p) => p.bitClass ?? "—" },
  { key: "make", label: "Make", align: "left", get: (p) => p.make ?? "—" },
  { key: "from", label: "From (m)", align: "right", get: (p) => (p.from != null ? Math.round(p.from) : "—") },
  { key: "to", label: "To (m)", align: "right", get: (p) => (p.to != null ? Math.round(p.to) : "—") },
  { key: "meters", label: "Meters", align: "right", get: (p) => (p.meters != null ? fmt1(p.meters) : "—") },
  { key: "bitHour", label: "Bit hrs", align: "right", get: (p) => (p.bitHour != null ? fmt1(p.bitHour) : "—") },
  { key: "wob", label: "WOB (klb)", align: "right", get: (p) => fmt1(p.wob) },
  { key: "rpm", label: "RPM", align: "right", get: (p) => Math.round(p.rpm) },
  { key: "mse", label: "MSE (psi)", align: "right", get: (p) => (p.mse != null ? Math.round(p.mse).toLocaleString() : "—") },
  { key: "hsi", label: "HSI", align: "right", get: (p) => (p.hsi != null ? fmt1(p.hsi) : "—") },
  { key: "flow", label: "Flow (gpm)", align: "right", get: (p) => (p.flow != null ? Math.round(p.flow) : "—") },
  { key: "spp", label: "SPP (psi)", align: "right", get: (p) => (p.spp != null ? Math.round(p.spp) : "—") },
  // Full IADC 8-position dull grade; hover the code for the decoded title, else
  // fall back to the inner/outer numbers when no full grade was recorded.
  { key: "dull", label: "IADC dull grade", align: "left", get: (p) => p.dullGrade ? <span title={p.dullTitle ?? undefined} className="cursor-help underline decoration-dotted decoration-gray-400">{p.dullGrade}</span> : (p.dullInner != null || p.dullOuter != null ? `${p.dullInner ?? "–"}/${p.dullOuter ?? "–"}` : "—") },
];

function TableView({ points, onOpenReport }: {
  points: RopPoint[]; onOpenReport?: (wellCode: string, serialNo: number, date: string | null) => void;
}) {
  const sorted = useMemo(() => points.slice().sort((a, b) => b.rop - a.rop), [points]);
  return (
    <table className="text-[11px] tabular-nums border-collapse">
      <thead className="sticky top-0 z-20">
        <tr className="bg-gray-100">
          <th className="sticky left-0 z-30 bg-gray-100 border border-gray-300 px-2 py-1 text-left font-semibold text-gray-700 whitespace-nowrap">Well</th>
          {TABLE_COLS.map((c) => (
            <th key={c.key} className={`bg-gray-100 border border-gray-300 px-2 py-1 font-medium text-gray-700 whitespace-nowrap text-${c.align}`}>{c.label}</th>
          ))}
          <th className="bg-gray-100 border border-gray-300 px-2 py-1 font-medium text-gray-700 whitespace-nowrap text-right">ROP (m/hr)</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((p, ri) => {
          const clickable = !!onOpenReport && p.serialNo != null;
          const zebra = ri % 2 ? "bg-teal-50/40" : "bg-white";
          return (
            <tr key={ri}
              onClick={clickable ? () => onOpenReport!(p.wellCode, p.serialNo!, p.date) : undefined}
              className={`${zebra} ${clickable ? "cursor-pointer hover:bg-blue-50" : ""}`}
              title={clickable ? "Open this day's daily drilling report" : undefined}>
              <th className="sticky left-0 z-10 bg-inherit border border-gray-300 px-2 py-0.5 text-left font-semibold text-gray-800 whitespace-nowrap">{p.name || p.wellCode}</th>
              {TABLE_COLS.map((c) => (
                <td key={c.key} className={`border border-gray-300 px-2 py-0.5 whitespace-nowrap text-${c.align}`}>{c.get(p)}</td>
              ))}
              <td className="border border-gray-300 px-2 py-0.5 text-right whitespace-nowrap font-medium">{p.rop}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="p-8 text-center text-sm text-gray-400">{children}</div>;
}

// ════════════════════════════════════════════════════════════════════════════
// Summary — the DEFAULT KPI-dashboard view (matches the Time-Analysis pattern):
// small KPI cards over the loaded bit runs, a bit-performance ranking table with
// inline bars, and two complementary hand-rolled SVG charts the other views
// don't already cover — ROP & MSE binned by depth across hole sections, and a
// per-section performance summary. Everything computed client-side; nothing here
// duplicates the existing scatter / contour / economics views.
// ════════════════════════════════════════════════════════════════════════════

/** Floating HTML tooltip for the hand-rolled SVG charts (same helper as the
 *  Time-Analysis tab). */
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

/** Mid-depth of a bit run (interval midpoint, else whichever end is recorded). */
const midDepth = (p: RopPoint): number | null =>
  p.from != null && p.to != null ? (p.from + p.to) / 2 : (p.to ?? p.from ?? null);

/** "1,234" with thousands separators; em-dash for null. */
const intc = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? "—" : Math.round(v).toLocaleString());

/** Numeric value of a bit-size label (12-1/4" → 12.25) for widest→narrowest order. */
const sizeVal = (s: string): number => holeSizeInches(s) ?? -1;

/** One KPI card — bold value + small caption, optional sub-line and accent bar. */
function KpiCard({ label, value, unit, sub, accent = "#1e40af" }: {
  label: string; value: string; unit?: string; sub?: React.ReactNode; accent?: string;
}) {
  return (
    <div className="relative rounded border border-gray-200 bg-white px-3 py-2 overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: accent }} />
      <div className="text-[10px] uppercase tracking-wide text-gray-500 truncate">{label}</div>
      <div className="text-xl font-semibold text-gray-800 tabular-nums leading-tight">
        {value}{unit ? <span className="text-xs font-normal text-gray-400 ml-1">{unit}</span> : null}
      </div>
      {sub ? <div className="text-[11px] text-gray-500 truncate">{sub}</div> : null}
    </div>
  );
}

/** A right-aligned cell with an inline horizontal % bar behind the number — the
 *  Time-Analysis ranking-table idiom. `frac` ∈ [0,1] sizes the bar. */
function BarCell({ text, frac, color = "#1e40af", align = "right" }: {
  text: React.ReactNode; frac: number; color?: string; align?: "left" | "right";
}) {
  const pct = Math.max(0, Math.min(100, frac * 100));
  return (
    <td className="border border-gray-300 px-0 py-0 relative">
      <div className="absolute inset-y-0 left-0 opacity-20" style={{ width: `${pct}%`, background: color }} />
      <div className={`relative px-2 py-0.5 ${align === "right" ? "text-right" : "text-left"} tabular-nums`}>{text}</div>
    </td>
  );
}

interface SizeAgg {
  size: string; n: number; meters: number; hours: number;
  // overallRop = footage-weighted pace (total m ÷ total hr) — reconciles to the
  // "Overall ROP" headline card; meanRop = simple per-run mean. worstRop = slowest
  // single run in the group, matching the "Slowest run ROP" card.
  meanRop: number; overallRop: number; bestRop: number; worstRop: number;
  medMse: number | null; avgDull: number | null;
}
/** Roll one group of points up to the section-performance row shape. */
function rollupAgg(size: string, ps: RopPoint[]): SizeAgg {
  const meters = ps.reduce((a, p) => a + (p.meters ?? 0), 0);
  const hours = ps.reduce((a, p) => a + (p.bitHour ?? 0), 0);
  const mses = ps.map((p) => p.mse).filter((v): v is number => v != null && v > 0);
  const dulls = ps.map((p) => (p.dullInner != null && p.dullOuter != null ? (p.dullInner + p.dullOuter) / 2 : null)).filter((v): v is number => v != null);
  const meanRop = mean(ps.map((p) => p.rop)) ?? 0;
  return {
    size, n: ps.length, meters, hours, meanRop,
    overallRop: hours > 0 ? meters / hours : meanRop,
    bestRop: Math.max(...ps.map((p) => p.rop)),
    worstRop: Math.min(...ps.map((p) => p.rop)),
    medMse: median(mses),
    avgDull: dulls.length ? mean(dulls)! : null,
  };
}

/** Per-bit-size rollup for the section-performance table. */
function aggregateBySize(points: RopPoint[], bitSizes: string[]): SizeAgg[] {
  const m = new Map<string, RopPoint[]>();
  for (const p of points) { const a = m.get(p.bitSize); if (a) a.push(p); else m.set(p.bitSize, [p]); }
  const order = bitSizes.length ? bitSizes : [...m.keys()].sort((a, b) => sizeVal(b) - sizeVal(a));
  return order.filter((b) => m.has(b)).map((b) => rollupAgg(b, m.get(b)!));
}

/** Per-top-formation rollup, busiest (most footage) first — the geology-keyed
 *  companion to aggregateBySize. */
function aggregateByFormation(points: RopPoint[]): SizeAgg[] {
  const m = new Map<string, RopPoint[]>();
  // Group case-insensitively, display the first spelling seen. The archive
  // resolves a D07 lookup ("Gachsaran") while the rig types the name free-hand
  // ("GACHSARAN"); keyed verbatim these split into two rows and the footage of
  // one formation is reported twice, half each.
  const label = new Map<string, string>();
  for (const p of points) {
    const shown = p.topFormation ?? "—";
    const k = shown.trim().toLowerCase();
    if (!label.has(k)) label.set(k, shown);
    const a = m.get(k); if (a) a.push(p); else m.set(k, [p]);
  }
  // rollupAgg is labelled with the spelling first seen, not the folded key.
  return [...m.entries()].map(([k, ps]) => rollupAgg(label.get(k) ?? k, ps)).sort((a, b) => b.meters - a.meters || b.meanRop - a.meanRop);
}

interface ReasonAgg { reason: string; n: number; meters: number; meanRop: number; }
/** Reason-pulled rollup (IADC dull-grade position 8) — why each bit came off
 *  bottom, busiest reason first. Null/empty reasons fold into the "—" group. */
function aggregateByReason(points: RopPoint[]): ReasonAgg[] {
  const m = new Map<string, RopPoint[]>();
  for (const p of points) { const k = p.reasonLabel ?? "—"; const a = m.get(k); if (a) a.push(p); else m.set(k, [p]); }
  return [...m.entries()].map(([reason, ps]) => ({
    reason, n: ps.length,
    meters: ps.reduce((a, p) => a + (p.meters ?? 0), 0),
    meanRop: mean(ps.map((p) => p.rop)) ?? 0,
  })).sort((a, b) => b.n - a.n);
}

function SummaryView({ points, bitSizes, onOpenReport, onView }: {
  points: RopPoint[]; bitSizes: string[];
  onOpenReport?: (wellCode: string, serialNo: number, date: string | null) => void;
  onView?: (v: View) => void;
}) {
  // ── headline KPIs over the loaded (screened) runs ──────────────────────────
  const kpi = useMemo(() => {
    const n = points.length;
    const rops = points.map((p) => p.rop);
    const meanRop = mean(rops) ?? 0;
    const medRop = median(rops) ?? 0;
    let best = points[0], worst = points[0];
    for (const p of points) { if (p.rop > best.rop) best = p; if (p.rop < worst.rop) worst = p; }
    const totalM = points.reduce((a, p) => a + (p.meters ?? 0), 0);
    const totalHr = points.reduce((a, p) => a + (p.bitHour ?? 0), 0);
    const mses = points.map((p) => p.mse).filter((v): v is number => v != null && v > 0);
    const wells = new Set(points.map((p) => p.wellCode)).size;
    // PDC share is computed over the CLASSIFIED points only — both numerator and
    // denominator. Points with no bit evidence (bitClass null) are neither PDC
    // nor roller; charging them to "roller" via `n - pdc` would have overstated
    // roller-cone usage by exactly the number of rig reports missing a bit run.
    const classified = points.filter((p) => p.bitClass != null).length;
    const pdc = points.filter((p) => p.bitClass === "PDC").length;
    const roller = classified - pdc;
    const unclassified = n - classified;
    // Overall realised pace = total metres ÷ total rotating hours (footage-weighted,
    // not the simple per-run mean — what a manager actually cares about).
    const overallRop = totalHr > 0 ? totalM / totalHr : meanRop;
    return { n, meanRop, medRop, best, worst, totalM, totalHr, medMse: median(mses), wells, pdc, roller, unclassified, overallRop };
  }, [points]);

  const sizeAgg = useMemo(() => aggregateBySize(points, bitSizes), [points, bitSizes]);
  // By-formation rollup, shown only when the runs actually carry a formation.
  const formAgg = useMemo(() => aggregateByFormation(points).filter((s) => s.size !== "—"), [points]);
  // Reason-pulled rollup; rendered only when at least one run carries a reason.
  const reasonAgg = useMemo(() => aggregateByReason(points).filter((r) => r.reason !== "—"), [points]);

  // Top bit runs by ROP for the leaderboard (footage-weighted columns get bars).
  const topRuns = useMemo(() => {
    const maxM = Math.max(1, ...points.map((p) => p.meters ?? 0));
    const maxRop = Math.max(1, ...points.map((p) => p.rop));
    return points.slice().sort((a, b) => b.rop - a.rop).slice(0, 15).map((p) => ({ p, maxM, maxRop }));
  }, [points]);

  const maxSizeM = Math.max(1, ...sizeAgg.map((s) => s.meters));
  const maxSizeRop = Math.max(1, ...sizeAgg.map((s) => s.bestRop));
  const maxFormM = Math.max(1, ...formAgg.map((s) => s.meters));
  const maxFormRop = Math.max(1, ...formAgg.map((s) => s.bestRop));
  const reasonRuns = reasonAgg.reduce((a, r) => a + r.n, 0);

  return (
    <div className="space-y-4">
      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
        <KpiCard label="Overall ROP" value={kpi.overallRop.toFixed(1)} unit="m/hr" accent="#1e40af"
          sub={<>footage-weighted · mean {kpi.meanRop.toFixed(1)} · median {kpi.medRop.toFixed(1)}</>} />
        <KpiCard label="Best run ROP" value={fmt1(kpi.best.rop)} unit="m/hr" accent="#16a34a"
          sub={<>{kpi.best.name} · {kpi.best.bitSize}{kpi.best.iadc ? ` · ${kpi.best.iadc}` : ""}</>} />
        <KpiCard label="Slowest run ROP" value={fmt1(kpi.worst.rop)} unit="m/hr" accent="#dc2626"
          sub={<>{kpi.worst.name} · {kpi.worst.bitSize}</>} />
        <KpiCard label="Total footage" value={intc(kpi.totalM)} unit="m" accent="#0d9488"
          sub={<>across {kpi.wells} well{kpi.wells === 1 ? "" : "s"}</>} />
        <KpiCard label="Bit runs" value={intc(kpi.n)} accent="#7c3aed"
          sub={<>{kpi.pdc} PDC · {kpi.roller} roller{kpi.unclassified ? <span title="Reports with no bit run (or no IADC code / bit type) — bit class unknown, so they count towards neither share."> · {kpi.unclassified} unclassified</span> : null}</>} />
        <KpiCard label="Rotating hours" value={intc(kpi.totalHr)} unit="hr" accent="#d97706"
          sub={<>{(kpi.totalHr / 24).toFixed(0)} rig-days on bottom</>} />
        <KpiCard label="Median MSE" value={kpi.medMse != null ? intc(kpi.medMse) : "—"} unit={kpi.medMse != null ? "psi" : undefined} accent="#0891b2"
          sub={kpi.medMse != null ? <>{psiToMPa(kpi.medMse).toFixed(0)} MPa</> : "no MSE inputs"} />
        <KpiCard label="Bit sizes" value={intc(sizeAgg.length)} accent="#65a30d"
          sub={sizeAgg.map((s) => s.size).join(" · ")} />
      </div>

      {/* Section / bit-size performance table with inline bars */}
      <div className="border border-gray-200 rounded overflow-hidden">
        <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">Performance by hole section (bit size)</span>
          {onView && <button onClick={() => onView("size")} className="text-[11px] text-blue-600 hover:underline">mean-ROP chart →</button>}
        </div>
        <div className="overflow-auto">
          <table className="text-[11px] tabular-nums border-collapse w-full">
            <thead><tr className="bg-gray-100">
              {["Section", "Runs", "Footage (m)", "Hours", "Overall ROP", "Mean ROP", "Best ROP", "Slowest ROP", "Median MSE", "Avg dull"].map((h, i) => (
                <th key={h} className={`border border-gray-300 px-2 py-1 font-medium text-gray-700 whitespace-nowrap ${i === 0 ? "text-left" : "text-right"}`}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {sizeAgg.map((s, i) => (
                <tr key={s.size} className={i % 2 ? "bg-teal-50/40" : "bg-white"}>
                  <td className="border border-gray-300 px-2 py-0.5 text-left font-semibold" style={{ color: colorForSize(bitSizes, s.size) }}>{s.size}</td>
                  <td className="border border-gray-300 px-2 py-0.5 text-right">{s.n}</td>
                  <BarCell text={intc(s.meters)} frac={s.meters / maxSizeM} color={colorForSize(bitSizes, s.size)} />
                  <td className="border border-gray-300 px-2 py-0.5 text-right">{intc(s.hours)}</td>
                  <BarCell text={s.overallRop.toFixed(1)} frac={s.overallRop / maxSizeRop} color="#1e40af" />
                  <td className="border border-gray-300 px-2 py-0.5 text-right">{s.meanRop.toFixed(1)}</td>
                  <td className="border border-gray-300 px-2 py-0.5 text-right text-green-700">{fmt1(s.bestRop)}</td>
                  <td className="border border-gray-300 px-2 py-0.5 text-right text-red-700">{fmt1(s.worstRop)}</td>
                  <td className="border border-gray-300 px-2 py-0.5 text-right">{s.medMse != null ? intc(s.medMse) : "—"}</td>
                  <td className="border border-gray-300 px-2 py-0.5 text-right">{s.avgDull != null ? s.avgDull.toFixed(1) : "—"}</td>
                </tr>
              ))}
              <tr className="bg-amber-50 font-semibold text-gray-800">
                <td className="border border-gray-300 px-2 py-0.5 text-left">Total / overall</td>
                <td className="border border-gray-300 px-2 py-0.5 text-right">{kpi.n}</td>
                <td className="border border-gray-300 px-2 py-0.5 text-right">{intc(kpi.totalM)}</td>
                <td className="border border-gray-300 px-2 py-0.5 text-right">{intc(kpi.totalHr)}</td>
                <td className="border border-gray-300 px-2 py-0.5 text-right">{kpi.overallRop.toFixed(1)}</td>
                <td className="border border-gray-300 px-2 py-0.5 text-right">{kpi.meanRop.toFixed(1)}</td>
                <td className="border border-gray-300 px-2 py-0.5 text-right text-green-700">{fmt1(kpi.best.rop)}</td>
                <td className="border border-gray-300 px-2 py-0.5 text-right text-red-700">{fmt1(kpi.worst.rop)}</td>
                <td className="border border-gray-300 px-2 py-0.5 text-right">{kpi.medMse != null ? intc(kpi.medMse) : "—"}</td>
                <td className="border border-gray-300 px-2 py-0.5 text-right">—</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="px-3 py-1 text-[11px] text-gray-400">Overall ROP = footage-weighted pace (section metres ÷ section rotating hours) and reconciles to the headline cards on the “Total / overall” row; Mean ROP = simple average per run. Best / Slowest ROP are the fastest / slowest single runs. Avg dull = (inner + outer) ÷ 2 on the IADC dull-grade scale (0 = new, 8 = worn).</div>
      </div>

      {/* Performance by top formation */}
      {formAgg.length > 0 && (
        <div className="border border-gray-200 rounded overflow-hidden">
          <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-200">
            <span className="text-sm font-medium text-gray-700">Performance by top formation</span>
            <span className="text-[11px] text-gray-400"> — most footage first</span>
          </div>
          <div className="overflow-auto">
            <table className="text-[11px] tabular-nums border-collapse w-full">
              <thead><tr className="bg-gray-100">
                {["Top formation", "Runs", "Footage (m)", "Hours", "Overall ROP", "Mean ROP", "Best ROP", "Slowest ROP", "Median MSE", "Avg dull"].map((h, i) => (
                  <th key={h} className={`border border-gray-300 px-2 py-1 font-medium text-gray-700 whitespace-nowrap ${i === 0 ? "text-left" : "text-right"}`}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {formAgg.map((s, i) => (
                  <tr key={s.size} className={i % 2 ? "bg-teal-50/40" : "bg-white"}>
                    <td className="border border-gray-300 px-2 py-0.5 text-left font-semibold text-gray-800">{s.size}</td>
                    <td className="border border-gray-300 px-2 py-0.5 text-right">{s.n}</td>
                    <BarCell text={intc(s.meters)} frac={s.meters / maxFormM} color="#7c3aed" />
                    <td className="border border-gray-300 px-2 py-0.5 text-right">{intc(s.hours)}</td>
                    <BarCell text={s.overallRop.toFixed(1)} frac={s.overallRop / maxFormRop} color="#1e40af" />
                    <td className="border border-gray-300 px-2 py-0.5 text-right">{s.meanRop.toFixed(1)}</td>
                    <td className="border border-gray-300 px-2 py-0.5 text-right text-green-700">{fmt1(s.bestRop)}</td>
                    <td className="border border-gray-300 px-2 py-0.5 text-right text-red-700">{fmt1(s.worstRop)}</td>
                    <td className="border border-gray-300 px-2 py-0.5 text-right">{s.medMse != null ? intc(s.medMse) : "—"}</td>
                    <td className="border border-gray-300 px-2 py-0.5 text-right">{s.avgDull != null ? s.avgDull.toFixed(1) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-3 py-1 text-[11px] text-gray-400">ROP and MSE rolled up by the top formation at each bit run’s depth — the geology-keyed view of where the bit drilled fast or stalled.</div>
        </div>
      )}

      {/* Why bits came off bottom (reason pulled) */}
      {reasonAgg.length > 0 && (
        <div className="border border-gray-200 rounded overflow-hidden">
          <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-200">
            <span className="text-sm font-medium text-gray-700">Why bits came off bottom (reason pulled)</span>
            <span className="text-[11px] text-gray-400"> — most runs first</span>
          </div>
          <div className="overflow-auto">
            <table className="text-[11px] tabular-nums border-collapse w-full">
              <thead><tr className="bg-gray-100">
                {["Reason pulled", "Runs", "% of runs", "Footage (m)", "Mean ROP"].map((h, i) => (
                  <th key={h} className={`border border-gray-300 px-2 py-1 font-medium text-gray-700 whitespace-nowrap ${i === 0 ? "text-left" : "text-right"}`}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {reasonAgg.map((r, i) => (
                  <tr key={r.reason} className={i % 2 ? "bg-teal-50/40" : "bg-white"}>
                    <td className="border border-gray-300 px-2 py-0.5 text-left font-semibold text-gray-800">{r.reason}</td>
                    <td className="border border-gray-300 px-2 py-0.5 text-right">{r.n}</td>
                    <BarCell text={`${((r.n / reasonRuns) * 100).toFixed(0)}%`} frac={r.n / reasonRuns} color="#7c3aed" />
                    <td className="border border-gray-300 px-2 py-0.5 text-right">{intc(r.meters)}</td>
                    <td className="border border-gray-300 px-2 py-0.5 text-right">{r.meanRop.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-3 py-1 text-[11px] text-gray-400">IADC reason-pulled code (position 8) decoded — TD = drilled to section depth, the rest are early pulls.</div>
        </div>
      )}

      {/* Two complementary charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <RopMseDepthChart points={points} />
        <SectionRopChart agg={sizeAgg} bitSizes={bitSizes} />
      </div>

      {/* Top bit-run leaderboard */}
      <div className="border border-gray-200 rounded overflow-hidden">
        <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">Fastest bit runs</span>
          {onView && <button onClick={() => onView("table")} className="text-[11px] text-blue-600 hover:underline">full table →</button>}
        </div>
        <div className="overflow-auto">
          <table className="text-[11px] tabular-nums border-collapse w-full">
            <thead><tr className="bg-gray-100">
              {["#", "Well", "Date", "Section", "IADC / class", "ROP (m/hr)", "Footage (m)", "Hours", "MSE (psi)", "Dull grade"].map((h, i) => (
                <th key={h} className={`border border-gray-300 px-2 py-1 font-medium text-gray-700 whitespace-nowrap ${i >= 5 ? "text-right" : "text-left"}`}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {topRuns.map(({ p, maxM, maxRop }, i) => {
                const clickable = !!onOpenReport && p.serialNo != null;
                return (
                  <tr key={i}
                    onClick={clickable ? () => onOpenReport!(p.wellCode, p.serialNo!, p.date) : undefined}
                    className={`${i % 2 ? "bg-teal-50/40" : "bg-white"} ${clickable ? "cursor-pointer hover:bg-blue-50" : ""}`}
                    title={clickable ? "Open this day's daily drilling report" : undefined}>
                    <td className="border border-gray-300 px-2 py-0.5 text-left text-gray-500">{i + 1}</td>
                    <td className="border border-gray-300 px-2 py-0.5 text-left font-semibold text-gray-800 whitespace-nowrap">{p.name || p.wellCode}</td>
                    <td className="border border-gray-300 px-2 py-0.5 text-left whitespace-nowrap">{p.date ?? "—"}</td>
                    <td className="border border-gray-300 px-2 py-0.5 text-left" style={{ color: colorForSize(bitSizes, p.bitSize) }}>{p.bitSize}</td>
                    <td className="border border-gray-300 px-2 py-0.5 text-left whitespace-nowrap">{p.iadc ? p.iadc : "—"} · {p.bitClass ?? "—"}</td>
                    <BarCell text={<b>{p.rop}</b>} frac={p.rop / maxRop} color="#16a34a" />
                    <BarCell text={intc(p.meters)} frac={(p.meters ?? 0) / maxM} color="#0d9488" />
                    <td className="border border-gray-300 px-2 py-0.5 text-right">{p.bitHour != null ? fmt1(p.bitHour) : "—"}</td>
                    <td className="border border-gray-300 px-2 py-0.5 text-right">{p.mse != null ? intc(p.mse) : "—"}</td>
                    <td className="border border-gray-300 px-2 py-0.5 text-right">{p.dullGrade ? <span title={p.dullTitle ?? undefined} className="cursor-help underline decoration-dotted decoration-gray-400">{p.dullGrade}</span> : (p.dullInner != null || p.dullOuter != null ? `${p.dullInner ?? "–"}/${p.dullOuter ?? "–"}` : "—")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/** ROP & MSE binned by depth (50–100 m bins), drawn as two stacked mini-tracks
 *  sharing a depth (Y, increasing down) axis — the classic drilling "parameters
 *  vs depth" plot. Complements the per-well ROP-vs-depth scatter in Progress by
 *  rolling all wells into a single depth profile and overlaying mean MSE. */
function RopMseDepthChart({ points }: { points: RopPoint[] }) {
  const hover = useSvgHover();
  const bins = useMemo(() => {
    const withD = points.map((p) => ({ d: midDepth(p), rop: p.rop, mse: p.mse })).filter((x): x is { d: number; rop: number; mse: number | null } => x.d != null);
    if (withD.length < 2) return null;
    let lo = Infinity, hi = -Infinity;
    for (const x of withD) { if (x.d < lo) lo = x.d; if (x.d > hi) hi = x.d; }
    if (hi <= lo) return null;
    const step = niceStep(hi - lo, 24);
    const min = Math.floor(lo / step) * step;
    const nb = Math.max(1, Math.ceil((hi - min) / step + 1e-9));
    const acc = Array.from({ length: nb }, () => ({ ropSum: 0, ropN: 0, mseSum: 0, mseN: 0 }));
    for (const x of withD) {
      const i = Math.min(nb - 1, Math.floor((x.d - min) / step));
      const c = acc[i]; c.ropSum += x.rop; c.ropN += 1;
      if (x.mse != null && x.mse > 0) { c.mseSum += x.mse; c.mseN += 1; }
    }
    const rows = acc.map((c, i) => ({
      dLo: min + i * step, dHi: min + (i + 1) * step,
      rop: c.ropN ? c.ropSum / c.ropN : null, n: c.ropN,
      mse: c.mseN ? c.mseSum / c.mseN : null,
    })).filter((r) => r.n > 0);
    const maxRop = Math.max(...rows.map((r) => r.rop ?? 0), 1);
    const maxMse = Math.max(...rows.map((r) => r.mse ?? 0), 1);
    return { rows, min, step, depMin: min, depMax: min + nb * step, maxRop, maxMse };
  }, [points]);

  if (!bins) return <div className="border border-gray-200 rounded p-2"><div className="text-sm font-medium text-gray-700 mb-1">ROP &amp; MSE vs depth</div><Empty>Not enough bit runs with depth to build a depth profile.</Empty></div>;

  const PAD = { l: 52, r: 12, t: 22, b: 28 };
  const trackW = 150, gap = 30;
  const plotH = 360;
  const W = PAD.l + trackW + gap + trackW + PAD.r, H = PAD.t + plotH + PAD.b;
  const span = bins.depMax - bins.depMin || 1;
  const yOf = (d: number) => PAD.t + ((d - bins.depMin) / span) * plotH;
  const depTicks = niceTicks(bins.depMin, bins.depMax, 6);
  const x0Rop = PAD.l, x0Mse = PAD.l + trackW + gap;

  return (
    <div className="border border-gray-200 rounded p-2 relative">
      <div className="text-sm font-medium text-gray-700 mb-1">ROP &amp; MSE vs depth — all wells, {bins.step.toFixed(0)} m bins</div>
      <svg width={W} height={H} className="block max-w-full">
        {/* depth axis (shared) */}
        {depTicks.map((d) => (
          <g key={d}>
            <line x1={PAD.l - 4} x2={W - PAD.r} y1={yOf(d)} y2={yOf(d)} stroke="#f1f5f9" />
            <text x={PAD.l - 7} y={yOf(d) + 3} textAnchor="end" fontSize={9} fill="#94a3b8">{Math.round(d)}</text>
          </g>
        ))}
        <text transform={`translate(12 ${PAD.t + plotH / 2}) rotate(-90)`} textAnchor="middle" fontSize={10} fill="#475569" fontWeight={600}>Depth (m)</text>
        {/* ROP track (bars grow right, coloured by speed) */}
        <text x={x0Rop + trackW / 2} y={PAD.t - 8} textAnchor="middle" fontSize={10} fill="#1e40af" fontWeight={600}>mean ROP (m/hr)</text>
        {bins.rows.map((r, i) => {
          const y = yOf(r.dLo), h = Math.max(1, yOf(r.dHi) - yOf(r.dLo) - 1);
          const w = ((r.rop ?? 0) / bins.maxRop) * trackW;
          const html = `Depth ${Math.round(r.dLo)}–${Math.round(r.dHi)} m<br/><b>mean ROP ${(r.rop ?? 0).toFixed(1)} m/hr</b> · ${r.n} run${r.n === 1 ? "" : "s"}${r.mse != null ? `<br/>mean MSE ${intc(r.mse)} psi` : ""}`;
          return <rect key={i} x={x0Rop} y={y} width={w} height={h} fill={ropColor((r.rop ?? 0) / bins.maxRop)}
            onMouseEnter={hover.enter(html)} onMouseMove={hover.enter(html)} onMouseLeave={hover.leave} />;
        })}
        <line x1={x0Rop} x2={x0Rop} y1={PAD.t} y2={PAD.t + plotH} stroke="#cbd5e1" />
        {/* MSE track */}
        <text x={x0Mse + trackW / 2} y={PAD.t - 8} textAnchor="middle" fontSize={10} fill="#b45309" fontWeight={600}>mean MSE (psi)</text>
        {bins.rows.map((r, i) => {
          if (r.mse == null) return null;
          const y = yOf(r.dLo), h = Math.max(1, yOf(r.dHi) - yOf(r.dLo) - 1);
          const w = (r.mse / bins.maxMse) * trackW;
          const html = `Depth ${Math.round(r.dLo)}–${Math.round(r.dHi)} m<br/><b>mean MSE ${intc(r.mse)} psi</b> (${psiToMPa(r.mse).toFixed(0)} MPa)`;
          return <rect key={i} x={x0Mse} y={y} width={w} height={h} fill="#d97706" fillOpacity={0.8}
            onMouseEnter={hover.enter(html)} onMouseMove={hover.enter(html)} onMouseLeave={hover.leave} />;
        })}
        <line x1={x0Mse} x2={x0Mse} y1={PAD.t} y2={PAD.t + plotH} stroke="#cbd5e1" />
      </svg>
      <div className="text-[11px] text-gray-400">Each band is a depth interval; bar length is the mean across all bit runs in it. ROP bars are speed-coloured (cool = slow, warm = fast); the matching MSE track flags where energy efficiency drops as ROP falls.</div>
      {hover.node}
    </div>
  );
}

/** Per-section footage + mean/best ROP overview as grouped horizontal bars —
 *  the at-a-glance "which section drilled most / fastest" companion to the table. */
function SectionRopChart({ agg, bitSizes }: { agg: SizeAgg[]; bitSizes: string[] }) {
  const hover = useSvgHover();
  if (!agg.length) return <div className="border border-gray-200 rounded p-2"><div className="text-sm font-medium text-gray-700 mb-1">Section footage &amp; ROP</div><Empty>No sections to summarise.</Empty></div>;
  const maxM = Math.max(1, ...agg.map((s) => s.meters));
  const maxRop = Math.max(1, ...agg.map((s) => s.bestRop));
  const PAD = { l: 64, r: 48, t: 24, b: 8 };
  const rowH = 34, barH = 11;
  const plotW = 280;
  const W = PAD.l + plotW + PAD.r, H = PAD.t + agg.length * rowH + PAD.b;
  return (
    <div className="border border-gray-200 rounded p-2 relative">
      <div className="text-sm font-medium text-gray-700 mb-1">Section footage &amp; ROP</div>
      <svg width={W} height={H} className="block max-w-full">
        <text x={PAD.l} y={PAD.t - 10} fontSize={10} fill="#0d9488" fontWeight={600}>footage (bar)</text>
        <text x={PAD.l + plotW} y={PAD.t - 10} textAnchor="end" fontSize={10} fill="#1e40af" fontWeight={600}>● mean ROP  ○ best ROP</text>
        {agg.map((s, i) => {
          const yc = PAD.t + i * rowH + rowH / 2;
          const w = (s.meters / maxM) * plotW;
          const mx = PAD.l + (s.meanRop / maxRop) * plotW;
          const bx = PAD.l + (s.bestRop / maxRop) * plotW;
          const html = `<b>${s.size}</b><br/>${intc(s.meters)} m · ${s.n} runs<br/>mean ROP ${s.meanRop.toFixed(1)} · best ${fmt1(s.bestRop)} m/hr`;
          return (
            <g key={s.size}>
              <text x={PAD.l - 6} y={yc + 3} textAnchor="end" fontSize={10} fill="#334155" fontWeight={600}>{s.size}</text>
              <rect x={PAD.l} y={yc - barH / 2} width={w} height={barH} fill={colorForSize(bitSizes, s.size)} fillOpacity={0.85}
                onMouseEnter={hover.enter(html)} onMouseMove={hover.enter(html)} onMouseLeave={hover.leave} />
              <text x={PAD.l + w + 4} y={yc + 3} fontSize={9} fill="#64748b">{intc(s.meters)} m</text>
              {/* ROP markers on the same row, scaled to the best-ROP max */}
              <circle cx={bx} cy={yc} r={4} fill="none" stroke="#1e40af" strokeWidth={1.4} />
              <circle cx={mx} cy={yc} r={3.5} fill="#1e40af" />
            </g>
          );
        })}
        <line x1={PAD.l} x2={PAD.l} y1={PAD.t} y2={PAD.t + agg.length * rowH} stroke="#cbd5e1" />
      </svg>
      <div className="text-[11px] text-gray-400">Bar = total footage per section (teal scale). Dots overlay mean (filled) and best (open) ROP, scaled to the fastest section — wide section, slow dots ⇒ a long, hard-drilling phase.</div>
      {hover.node}
    </div>
  );
}

/** "Nice" evenly-spaced tick values across [lo, hi] (≈ `count` ticks). */
function niceTicks(lo: number, hi: number, count: number): number[] {
  if (!(hi > lo)) return [lo];
  const step = niceStep(hi - lo, count);
  const start = Math.ceil(lo / step) * step;
  const out: number[] = [];
  for (let v = start; v <= hi + 1e-9; v += step) out.push(Number(v.toFixed(6)));
  return out.length ? out : [lo, hi];
}

// ════════════════════════════════════════════════════════════════════════════
// DrillBit-AI engineering analytics — MSE, hydraulics (HSI), economics, advisor.
// Each operating point carries the extra metrics the backend computes from the
// bit table (L05); these views fit / rank / interpret them with @dd/shared.
// ════════════════════════════════════════════════════════════════════════════

/** Mid-depth of a bit run (interval midpoint, else whichever end is recorded). */
const runDepth = (p: RopPoint): number | null =>
  p.from != null && p.to != null ? (p.from + p.to) / 2 : (p.to ?? p.from ?? null);

// Distinct hues per IADC code, stable across the economics & advisor charts.
const IADC_COLORS = ["#1e40af", "#dc2626", "#0d9488", "#d97706", "#7c3aed", "#65a30d", "#db2777", "#0891b2", "#ea580c", "#4f46e5", "#16a34a", "#9f1239", "#0369a1", "#a16207"];
const colorForIadc = (codes: string[], code: string) => IADC_COLORS[Math.max(0, codes.indexOf(code)) % IADC_COLORS.length];

/** A reusable labelled numeric input for the economics / advisor controls. */
function NumInput({ label, value, onChange, step = 1, suffix, width = "w-24" }: {
  label: string; value: number; onChange: (v: number) => void; step?: number; suffix?: string; width?: string;
}) {
  return (
    <label className="flex items-center gap-1.5 text-gray-600">
      {label}
      <input type="number" value={value} step={step} min={0}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        className={`h-7 ${width} border border-gray-300 rounded px-1.5 bg-white text-right tabular-nums`} />
      {suffix && <span className="text-gray-400">{suffix}</span>}
    </label>
  );
}

/** Evenly-spaced down-sample to at most `max` items, so the scatter charts stay
 *  responsive on large selections. Fits / correlations still use the full set. */
function sample<T>(arr: T[], max: number): T[] {
  if (arr.length <= max) return arr;
  const step = arr.length / max, out: T[] = [];
  for (let i = 0; i < max; i++) out.push(arr[Math.floor(i * step)]);
  return out;
}

/** Min–max normalise to [0,1]; higherBetter=false inverts (so 1 = best). */
function normalize(vals: number[], higherBetter: boolean): number[] {
  const finite = vals.filter((v) => Number.isFinite(v));
  if (!finite.length) return vals.map(() => 0.5);
  const lo = Math.min(...finite), hi = Math.max(...finite);
  if (hi <= lo) return vals.map(() => 0.5);
  return vals.map((v) => { const t = (v - lo) / (hi - lo); return higherBetter ? t : 1 - t; });
}

interface IadcGroup {
  iadc: string; bitClass: "PDC" | "roller"; bitSize: string; n: number; pts: RopPoint[];
  avgRop: number; avgMeters: number; avgHours: number; avgDepth: number; medMse: number | null;
  avgDia: number | null;
}
/** Aggregate operating points by IADC code (the bit "type"), for the economics
 *  cost/m ranking and the selection advisor. */
function groupByIadc(points: RopPoint[]): IadcGroup[] {
  const m = new Map<string, RopPoint[]>();
  for (const p of points) { if (!p.iadc) continue; const a = m.get(p.iadc); if (a) a.push(p); else m.set(p.iadc, [p]); }
  const pick = <T,>(xs: (T | null)[]): T[] => xs.filter((x): x is T => x != null);
  const groups: IadcGroup[] = [];
  for (const [iadc, ps] of m) {
    const meters = pick(ps.map((p) => (p.meters != null && p.meters > 0 ? p.meters : null)));
    const hours = pick(ps.map((p) => (p.bitHour != null && p.bitHour > 0 ? p.bitHour : null)));
    const depths = pick(ps.map(runDepth)).filter((d) => d > 0);
    const mses = pick(ps.map((p) => (p.mse != null && p.mse > 0 ? p.mse : null)));
    // Majority class over the CLASSIFIED members only, so unclassified points
    // can't tip a PDC group to "roller" (and with it the priced bit tier).
    const classified = ps.filter((p) => p.bitClass != null).length;
    const pdc = ps.filter((p) => p.bitClass === "PDC").length;
    const sizeCount = new Map<string, number>();
    for (const p of ps) sizeCount.set(p.bitSize, (sizeCount.get(p.bitSize) ?? 0) + 1);
    const bitSize = [...sizeCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
    // Nothing classified ⇒ nothing to price. The majority test would answer
    // "roller" here (`0 > 0` is false), quietly charging the roller-cone tier in
    // the cost/m ranking to a group whose bit is entirely unknown — so the group
    // is left out of the economics instead of being guessed at. Unreachable while
    // entered points carry iadc:null, but the guard must hold if that changes.
    if (classified === 0) continue;
    groups.push({
      iadc, bitClass: pdc > classified / 2 ? "PDC" : "roller",
      bitSize, n: ps.length, pts: ps,
      avgRop: mean(ps.map((p) => p.rop)) ?? 0,
      avgMeters: mean(meters) ?? 0, avgHours: mean(hours) ?? 0,
      avgDepth: mean(depths) ?? 0, medMse: median(mses),
      avgDia: mean(pick(ps.map((p) => p.diaIn))),
    });
  }
  return groups;
}

/** Plain-language interpretation block (the study shipped a diagnosis with each chart). */
function Interp({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs rounded bg-blue-50 border border-blue-200 text-blue-900 px-3 py-2 leading-relaxed">
      <span className="font-semibold">Interpretation. </span>{children}
    </div>
  );
}

function CoverageNote({ have, total, extra }: { have: number; total: number; extra?: string }) {
  return (
    <span className="text-gray-400">
      {have} of {total} record{total === 1 ? "" : "s"} usable{extra ? ` · ${extra}` : ""}.
    </span>
  );
}

function SizeFilter({ value, onChange, bitSizes, total }: {
  value: string; onChange: (v: string) => void; bitSizes: string[]; total: number;
}) {
  return (
    <label className="flex items-center gap-1.5 text-gray-600">
      Bit size
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-7 border border-gray-300 rounded px-1.5 bg-white">
        <option value="">All ({total})</option>
        {bitSizes.map((b) => <option key={b} value={b}>{b}</option>)}
      </select>
    </label>
  );
}

const renderNoDot = () => <g />;   // hide markers on the fitted-curve overlay

// ── MSE: ROP–MSE power-law fit + founder drill-off + MSE distribution ────────

function MseView({ points, bitSizes }: { points: RopPoint[]; bitSizes: string[] }) {
  const [sizeFilter, setSizeFilter] = useState("");
  const [clsFilter, setClsFilter] = useState<"" | "PDC" | "roller">("");
  // Mechanical efficiency factor Em (spec §6.6): MSE_adj = MSE / Em, toggleable.
  const [emOn, setEmOn] = useState(false);
  const [em, setEm] = useState(0.35);
  const adj = emOn && em > 0 ? 1 / em : 1;

  const pts = useMemo(() => points.filter((p) =>
    (!sizeFilter || p.bitSize === sizeFilter) && (!clsFilter || p.bitClass === clsFilter)),
    [points, sizeFilter, clsFilter]);
  const withMse = useMemo(() => pts.filter((p) => p.mse != null && p.mse > 0), [pts]);
  const measured = withMse.filter((p) => !p.mseEstimated).length;

  const fit = useMemo(() => powerLawFit(withMse.map((p) => (p.mse as number) * adj), withMse.map((p) => p.rop)), [withMse, adj]);
  const fitCurve = useMemo(() => {
    if (!fit) return [];
    const xs = withMse.map((p) => (p.mse as number) * adj);
    const lo = Math.min(...xs), hi = Math.max(...xs);
    return Array.from({ length: 40 }, (_, i) => {
      const x = lo * Math.pow(hi / lo, i / 39);
      return { mse: x, rop: fit.a * Math.pow(x, -fit.b) };
    });
  }, [fit, withMse, adj]);
  // Drill-off at ~constant RPM (spec §6.7): densest RPM band, then ROP-vs-WOB.
  const fr = useMemo(() => founderAtConstantRpm(pts.map((p) => p.wob), pts.map((p) => p.rpm), pts.map((p) => p.rop)), [pts]);
  const founder = fr?.founder ?? null;

  // Down-sample only the *rendered* markers; the fit above uses every point.
  const shown = useMemo(() => sample(withMse, 2500), [withMse]);
  const measuredPts = useMemo(() => shown.filter((p) => !p.mseEstimated).map((p) => ({ ...p, mse: (p.mse as number) * adj })), [shown, adj]);
  const estimatedPts = useMemo(() => shown.filter((p) => p.mseEstimated).map((p) => ({ ...p, mse: (p.mse as number) * adj })), [shown, adj]);

  // MSE distribution (median psi + MPa) per bit size.
  const dist = useMemo(() => {
    const m = new Map<string, number[]>();
    for (const p of withMse) { const a = m.get(p.bitSize); if (a) a.push((p.mse as number) * adj); else m.set(p.bitSize, [(p.mse as number) * adj]); }
    return bitSizes.filter((b) => m.has(b)).map((b) => {
      const arr = m.get(b)!; const med = median(arr) ?? 0;
      return { size: b, n: arr.length, medPsi: Math.round(med), medMPa: psiToMPa(med) };
    });
  }, [withMse, bitSizes, adj]);

  if (!withMse.length) return <Empty>No bit records with a computable MSE for this selection. MSE needs WOB, RPM, ROP and a recognised bit diameter.</Empty>;
  const mseLabel = emOn ? "MSE/Em" : "MSE";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap text-xs">
        <SizeFilter value={sizeFilter} onChange={setSizeFilter} bitSizes={bitSizes} total={points.length} />
        <label className="flex items-center gap-1.5 text-gray-600">
          Bit class
          <select value={clsFilter} onChange={(e) => setClsFilter(e.target.value as "" | "PDC" | "roller")} className="h-7 border border-gray-300 rounded px-1.5 bg-white">
            <option value="">All</option>
            <option value="roller">roller cone</option>
            <option value="PDC">PDC</option>
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-gray-600 cursor-pointer" title="Mechanical efficiency factor: report MSE ÷ Em (Teale's adjusted MSE).">
          <input type="checkbox" checked={emOn} onChange={(e) => setEmOn(e.target.checked)} /> ÷ Em
        </label>
        {emOn && <NumInput label="Em" value={em} onChange={(v) => setEm(Math.min(1, v))} step={0.05} width="w-16" />}
        <CoverageNote have={withMse.length} total={pts.length} extra={`torque measured ${measured}, estimated ${withMse.length - measured}`} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="border border-gray-200 rounded p-2">
          <div className="text-sm font-medium text-gray-700 mb-1">ROP vs MSE — power-law fit</div>
          <ResponsiveContainer width="100%" height={320}>
            <ScatterChart margin={{ ...CHART_MARGIN, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
              <XAxis type="number" dataKey="mse" name="MSE" scale="log" domain={["auto", "auto"]} tick={{ fontSize: 10 }}
                tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(Math.round(v)))}
                label={{ value: `${mseLabel} (psi, log scale)`, position: "insideBottom", offset: -18, fontSize: 11 }} />
              <YAxis type="number" dataKey="rop" name="ROP" tick={{ fontSize: 11 }} domain={niceDomain()} allowDataOverflow
                label={{ value: "ROP (m/hr)", angle: -90, position: "insideLeft", fontSize: 11 }} />
              <ZAxis range={[26, 26]} />
              <Tooltip cursor={{ strokeDasharray: "3 3" }} content={<MseTip />} />
              <Scatter name="measured torque" data={measuredPts} fill="#1e40af" fillOpacity={0.5} />
              {!!estimatedPts.length && <Scatter name="estimated torque" data={estimatedPts} fill="#94a3b8" fillOpacity={0.35} />}
              {!!fitCurve.length && <Scatter name="fit" data={fitCurve} fill="none" line={{ stroke: "#dc2626", strokeWidth: 2 }} shape={renderNoDot} legendType="none" />}
              <Legend {...LEGEND_TOP} />
            </ScatterChart>
          </ResponsiveContainer>
          <div className="text-[11px] text-gray-500 px-1">
            {fit ? <>Fit ROP = {fit.a.toFixed(2)} · MSE<sup>−{fit.b.toFixed(3)}</sup> · R² {fit.r2.toFixed(2)} · n {fit.n}</> : "Not enough spread to fit."}
            {withMse.length > shown.length ? ` · showing ${shown.length} of ${withMse.length} points` : ""}
          </div>
        </div>

        <div className="border border-gray-200 rounded p-2">
          <div className="text-sm font-medium text-gray-700 mb-1">
            Founder / drill-off — ROP vs WOB
            {fr && <span className="font-normal text-gray-400"> · at ~constant RPM {Math.round(fr.rpmLo)}–{Math.round(fr.rpmHi)} ({fr.nBand} records)</span>}
          </div>
          {founder && founder.curve.length >= 2 ? (
            <>
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={founder.curve} margin={{ top: 8, right: 16, bottom: 28, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                  <XAxis type="number" dataKey="wob" tick={{ fontSize: 11 }} domain={["dataMin", "dataMax"]}
                    label={{ value: "WOB (klb)", position: "insideBottom", offset: -14, fontSize: 11 }} tickFormatter={fmt1} />
                  <YAxis type="number" tick={{ fontSize: 11 }} label={{ value: "mean ROP (m/hr)", angle: -90, position: "insideLeft", fontSize: 11 }} />
                  <Tooltip content={<FounderTip />} />
                  <Line type="monotone" dataKey="rop" stroke="#0d9488" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
              <div className="text-[11px] text-gray-600 px-1">
                {founder.founderWob != null
                  ? <>Founder onset ≈ <b>WOB {fmt1(founder.founderWob)} klb ({klbToTonnes(founder.founderWob).toFixed(1)} t)</b> — beyond it more weight stops adding ROP. Recommended WOB ≈ <b>{fmt1(founder.optimalWob ?? founder.founderWob)} klb ({klbToTonnes(founder.optimalWob ?? founder.founderWob).toFixed(1)} t)</b>, just below founder.</>
                  : <>No founder detected — ROP keeps responding to WOB across the recorded range (consider testing higher weight).</>}
              </div>
            </>
          ) : <Empty>Not enough WOB spread to build a drill-off response.</Empty>}
        </div>
      </div>

      <Interp>
        {mseInterpretation(fit ? fit.b : null)} MSE measures the energy spent per unit volume of rock removed — efficient drilling keeps it close to the rock strength, while spikes flag balling, vibration or founder. Reference field exponents by section: 0.49 (17½″), 0.92 (12¼″), 0.48 (8½″).
      </Interp>

      {dist.length > 1 && (
        <div className="border border-gray-200 rounded p-2">
          <div className="text-sm font-medium text-gray-700 mb-1">Median MSE by bit size</div>
          <table className="text-[11px] tabular-nums border-collapse">
            <thead><tr className="bg-gray-100">
              {["Bit size", "Records", "Median MSE (psi)", "Median MSE (MPa)"].map((h, i) => (
                <th key={h} className={`border border-gray-300 px-2 py-1 font-medium text-gray-700 ${i === 0 ? "text-left" : "text-right"}`}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {dist.map((r, i) => (
                <tr key={r.size} className={i % 2 ? "bg-teal-50/40" : "bg-white"}>
                  <td className="border border-gray-300 px-2 py-0.5 text-left font-medium">{r.size}"</td>
                  <td className="border border-gray-300 px-2 py-0.5 text-right">{r.n}</td>
                  <td className="border border-gray-300 px-2 py-0.5 text-right">{r.medPsi.toLocaleString()}</td>
                  <td className="border border-gray-300 px-2 py-0.5 text-right">{r.medMPa.toFixed(0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function mseInterpretation(b: number | null): string {
  if (b == null) return "Not enough spread in MSE/ROP to fit a power law for this selection.";
  if (b >= 0.8) return `Power-law exponent b ≈ ${b.toFixed(2)} (close to 1): drilling energy is efficiently converted to rock destruction.`;
  if (b >= 0.4) return `Power-law exponent b ≈ ${b.toFixed(2)} (moderate): a meaningful share of energy is lost to regrind, heat or bit wear rather than breaking rock.`;
  return `Power-law exponent b ≈ ${b.toFixed(2)} (low): much of the drilling energy is lost to regrind, vibration or bit damage instead of destroying rock.`;
}

function MseTip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as RopPoint & { mse?: number };
  if (p.wellCode == null) return null; // the fitted curve carries no record
  return (
    <div className="px-2 py-1 rounded bg-gray-900 text-white text-[11px] leading-tight shadow-lg">
      <div className="font-semibold">{p.name} · {p.bitSize}"{p.iadc ? ` · IADC ${p.iadc}` : ""}</div>
      <div>MSE {Math.round(p.mse as number).toLocaleString()} psi ({psiToMPa(p.mse as number).toFixed(0)} MPa){p.mseEstimated ? " · est. torque" : ""}</div>
      <div>ROP {p.rop} m/hr · WOB {fmt1(p.wob)} · RPM {Math.round(p.rpm)}</div>
    </div>
  );
}
function FounderTip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as { wob: number; rop: number; n: number };
  return (
    <div className="px-2 py-1 rounded bg-gray-900 text-white text-[11px] leading-tight shadow-lg">
      <div>WOB ≈ {fmt1(p.wob)} klb</div><div>mean ROP {p.rop.toFixed(1)} m/hr · {p.n} record{p.n === 1 ? "" : "s"}</div>
    </div>
  );
}

// ── Hydraulics: ROP vs HSI trend + cleaning diagnosis ────────────────────────

function HydraulicsView({ points, bitSizes }: { points: RopPoint[]; bitSizes: string[] }) {
  const [sizeFilter, setSizeFilter] = useState("");
  const pts = useMemo(() => (sizeFilter ? points.filter((p) => p.bitSize === sizeFilter) : points), [points, sizeFilter]);
  const withHsi = useMemo(() => pts.filter((p) => p.hsi != null && p.hsi > 0), [pts]);
  const reported = withHsi.filter((p) => p.hsiSource === "reported").length;

  const fit = useMemo(() => linearFit(withHsi.map((p) => p.hsi as number), withHsi.map((p) => p.rop)), [withHsi]);
  const rho = useMemo(() => spearman(withHsi.map((p) => p.hsi as number), withHsi.map((p) => p.rop)), [withHsi]);
  const trendLine = useMemo(() => {
    if (!fit) return [];
    const xs = withHsi.map((p) => p.hsi as number);
    const lo = Math.min(...xs), hi = Math.max(...xs);
    return [{ hsi: lo, rop: fit.slope * lo + fit.intercept }, { hsi: hi, rop: fit.slope * hi + fit.intercept }];
  }, [fit, withHsi]);
  const shownHsi = useMemo(() => sample(withHsi, 2500), [withHsi]); // rendered markers only
  // Coverage against the 2.5–5.0 hp/in² optimal-cleaning window (research §3.3):
  // below = under-cleaned, within = optimum, above = diminishing returns.
  const band = useMemo(() => {
    const n = withHsi.length || 1;
    const below = withHsi.filter((p) => (p.hsi as number) < 2.5).length;
    const above = withHsi.filter((p) => (p.hsi as number) > 5.0).length;
    const within = withHsi.length - below - above;
    const pct = (k: number) => Math.round((k / n) * 100);
    // Derive the largest bucket's % from the other two so the three always sum to 100.
    const belowPct = pct(below), abovePct = pct(above);
    return { below, within, above, belowPct, withinPct: 100 - belowPct - abovePct, abovePct };
  }, [withHsi]);

  if (!withHsi.length) return <Empty>No bit records with HSI for this selection. HSI needs a reported value, or nozzle sizes + flow rate + mud weight to compute it.</Empty>;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap text-xs">
        <SizeFilter value={sizeFilter} onChange={setSizeFilter} bitSizes={bitSizes} total={points.length} />
        <CoverageNote have={withHsi.length} total={pts.length} extra={`reported ${reported}, computed ${withHsi.length - reported}${withHsi.length > shownHsi.length ? `, plotting ${shownHsi.length}` : ""}`} />
      </div>

      <div className="border border-gray-200 rounded p-2">
        <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
          <div className="text-sm font-medium text-gray-700">ROP vs HSI (hydraulic horsepower per in²)</div>
          {/* Coverage against the 2.5–5.0 hp/in² optimal-cleaning window (§3.3). */}
          <div className="flex items-center gap-2 text-[11px] tabular-nums">
            <span className="text-gray-500" title="below 2.5 hp/in² — under-cleaned">&lt;2.5: <b>{band.below}</b> ({band.belowPct}%)</span>
            <span className="text-green-700" title="2.5–5.0 hp/in² — optimum cleaning window">optimum: <b>{band.within}</b> ({band.withinPct}%)</span>
            <span className="text-gray-500" title="above 5.0 hp/in² — diminishing returns">&gt;5.0: <b>{band.above}</b> ({band.abovePct}%)</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={360}>
          <ScatterChart margin={{ ...CHART_MARGIN, right: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
            <XAxis type="number" dataKey="hsi" name="HSI" tick={{ fontSize: 11 }} domain={niceDomain()} allowDataOverflow
              label={{ value: "HSI (hp/in²)", position: "insideBottom", offset: -18, fontSize: 11 }} />
            <YAxis type="number" dataKey="rop" name="ROP" tick={{ fontSize: 11 }} domain={niceDomain()} allowDataOverflow
              label={{ value: "ROP (m/hr)", angle: -90, position: "insideLeft", fontSize: 11 }} />
            <ZAxis range={[26, 26]} />
            <Tooltip cursor={{ strokeDasharray: "3 3" }} content={<HsiTip />} />
            {/* Optimal-cleaning window 2.5–5.0 hp/in² shaded behind the points (§3.3).
                ifOverflow="extendDomain" keeps the band visible — and pulls the axis to
                include it — even when the data doesn't span the whole 2.5–5.0 range. */}
            <ReferenceArea x1={2.5} x2={5.0} fill="#16a34a" fillOpacity={0.07} ifOverflow="extendDomain"
              label={{ value: "optimum 2.5–5.0", position: "insideTop", fontSize: 10, fill: "#15803d" }} />
            <ReferenceLine x={2.5} stroke="#16a34a" strokeDasharray="4 3" strokeOpacity={0.5} ifOverflow="extendDomain" />
            <ReferenceLine x={5.0} stroke="#16a34a" strokeDasharray="4 3" strokeOpacity={0.5} ifOverflow="extendDomain" />
            <Scatter name="bit records" data={shownHsi} fill="#0891b2" fillOpacity={0.5} />
            {!!trendLine.length && <Scatter name="trend" data={trendLine} fill="none" line={{ stroke: "#dc2626", strokeWidth: 2 }} shape={renderNoDot} legendType="none" />}
            <Legend {...LEGEND_TOP} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      <Interp>{hsiInterpretation(rho, fit ? fit.slope : 0)} {band.belowPct}% of runs sit below 2.5 hp/in² (under-optimized cleaning); {band.withinPct}% in the 2.5–5.0 optimum; {band.abovePct}% above 5.0 (little extra ROP). HSI gauges how well the bit face is cleaned of cuttings; it only lifts ROP when cuttings removal — not formation strength — is the limiter.</Interp>
    </div>
  );
}

function hsiInterpretation(rho: number | null, slope: number): string {
  void slope;
  if (rho == null) return "Not enough HSI/ROP pairs to assess the hydraulics–ROP relationship for this selection.";
  if (rho > 0.3) return `ROP rises with HSI (Spearman ρ = ${rho.toFixed(2)}): drilling is cleaning-limited — more hydraulic energy improves penetration, as in the reference 12¼″ section.`;
  if (rho < -0.3) return `ROP falls as HSI rises (Spearman ρ = ${rho.toFixed(2)}): hydraulics are not the limiter; formation strength or other factors dominate.`;
  return `ROP is roughly flat against HSI (Spearman ρ = ${rho.toFixed(2)}): cleaning is adequate or another factor (formation, WOB/RPM) limits ROP — as in the reference 17½″ and 8½″ sections.`;
}
/** Nozzle sizes (32nds″) → "6 × 14 + 1 × 12 (7 jets)", collapsing repeats. */
function fmtNozzles(nz: number[]): string {
  const counts = new Map<number, number>();
  for (const n of nz) counts.set(n, (counts.get(n) ?? 0) + 1);
  const groups = [...counts.entries()].sort((a, b) => b[0] - a[0]).map(([size, c]) => `${c} × ${size}`);
  return `${groups.join(" + ")} (${nz.length} jet${nz.length === 1 ? "" : "s"})`;
}

function HsiTip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as RopPoint;
  if (p.wellCode == null) return null;
  return (
    <div className="px-2 py-1 rounded bg-gray-900 text-white text-[11px] leading-tight shadow-lg">
      <div className="font-semibold">{p.name} · {p.bitSize}"{p.iadc ? ` · IADC ${p.iadc}` : ""}</div>
      <div>HSI {p.hsi} hp/in² ({p.hsiSource})</div>
      <div>ROP {p.rop} m/hr{p.flow != null ? ` · flow ${p.flow} gpm` : ""}{p.tfa != null ? ` · TFA ${p.tfa}″²` : ""}</div>
      {p.nozzles?.length ? <div className="text-gray-300">Nozzles (1/32″): {fmtNozzles(p.nozzles)}</div> : null}
    </div>
  );
}

// ── Economics: cost-per-metre by IADC type (live with rig rate / bit price) ──

// Reference price tiers (spec §7.5): 17½″-class bits cost markedly more than
// 12¼″/8½″ ones — 17½″ roller $11,200 / PDC $70,000; smaller roller $8,000 /
// PDC $50,000. Tier split at 14″.
const LARGE_BIT_IN = 14;
const PRICE_DEFAULTS = { rollerLg: 11200, pdcLg: 70000, rollerSm: 8000, pdcSm: 50000 };
type BitPrices = typeof PRICE_DEFAULTS;
function priceFor(cls: "PDC" | "roller", diaIn: number | null, p: BitPrices): number {
  const large = (diaIn ?? 0) >= LARGE_BIT_IN;
  return cls === "PDC" ? (large ? p.pdcLg : p.pdcSm) : (large ? p.rollerLg : p.rollerSm);
}

/** The four tiered bit-price inputs shared by Economics and the Advisor. */
function PriceInputs({ prices, onChange }: { prices: BitPrices; onChange: (p: BitPrices) => void }) {
  return (
    <>
      <NumInput label={`Roller ≥${LARGE_BIT_IN}″ $`} value={prices.rollerLg} onChange={(v) => onChange({ ...prices, rollerLg: v })} step={1000} />
      <NumInput label={`PDC ≥${LARGE_BIT_IN}″ $`} value={prices.pdcLg} onChange={(v) => onChange({ ...prices, pdcLg: v })} step={1000} />
      <NumInput label={`Roller <${LARGE_BIT_IN}″ $`} value={prices.rollerSm} onChange={(v) => onChange({ ...prices, rollerSm: v })} step={1000} />
      <NumInput label={`PDC <${LARGE_BIT_IN}″ $`} value={prices.pdcSm} onChange={(v) => onChange({ ...prices, pdcSm: v })} step={1000} />
    </>
  );
}

function EconomicsView({ points, bitSizes }: { points: RopPoint[]; bitSizes: string[] }) {
  const [sizeFilter, setSizeFilter] = useState("");
  const [rigDay, setRigDay] = useState(30000);
  const [tripSpeed, setTripSpeed] = useState(300);
  const [handling, setHandling] = useState(2);
  const [prices, setPrices] = useState<BitPrices>(PRICE_DEFAULTS);
  const [withTrip, setWithTrip] = useState(true);

  const pts = useMemo(() => (sizeFilter ? points.filter((p) => p.bitSize === sizeFilter) : points), [points, sizeFilter]);

  const rows = useMemo(() => {
    const rigHr = rigUsdPerHr(rigDay);
    return groupByIadc(pts)
      .filter((g) => g.avgMeters > 0 && g.avgHours > 0)
      .map((g) => {
        const bitUsd = priceFor(g.bitClass, g.avgDia, prices);
        const tripHr = withTrip ? tripHours({ depthM: g.avgDepth, tripSpeedMHr: tripSpeed, handlingHr: handling }) : 0;
        const costM = costPerMeter({ bitUsd, rigUsdPerHr: rigHr, drillHr: g.avgHours, tripHr, meterageM: g.avgMeters });
        const tripRop = tripAdjustedRop({ meterageM: g.avgMeters, drillHr: g.avgHours, tripHr });
        return { ...g, bitUsd, tripHr, costM: costM ?? Infinity, tripRop: tripRop ?? 0 };
      })
      .filter((r) => Number.isFinite(r.costM))
      .sort((a, b) => a.costM - b.costM);
  }, [pts, rigDay, tripSpeed, handling, prices, withTrip]);

  const codes = rows.map((r) => r.iadc);

  if (!rows.length) return <Empty>No IADC-coded bit runs with footage and drilling hours for this selection — cost/m needs both to compute.</Empty>;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap text-xs">
        <SizeFilter value={sizeFilter} onChange={setSizeFilter} bitSizes={bitSizes} total={points.length} />
        <NumInput label="Rig rate" value={rigDay} onChange={setRigDay} step={1000} suffix="USD/day" />
        <PriceInputs prices={prices} onChange={setPrices} />
        <NumInput label="Trip speed" value={tripSpeed} onChange={setTripSpeed} step={50} suffix="m/hr" width="w-20" />
        <NumInput label="Handling" value={handling} onChange={setHandling} step={1} suffix="hr/trip" width="w-16" />
        <label className="flex items-center gap-1.5 text-gray-600 cursor-pointer">
          <input type="checkbox" checked={withTrip} onChange={(e) => setWithTrip(e.target.checked)} /> include trip time
        </label>
      </div>

      <div className="border border-gray-200 rounded p-2">
        <div className="text-sm font-medium text-gray-700 mb-1">Cost per metre vs ROP, by IADC type{withTrip ? " (with trip)" : " (drilling only)"}</div>
        <ResponsiveContainer width="100%" height={Math.max(260, rows.length * 30)}>
          <BarChart data={rows} margin={{ ...CHART_MARGIN, right: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
            <XAxis dataKey="iadc" tick={{ fontSize: 11 }} label={{ value: "IADC type", position: "insideBottom", offset: -18, fontSize: 11 }} />
            <YAxis yAxisId="cost" tick={{ fontSize: 11 }} label={{ value: "USD/m", angle: -90, position: "insideLeft", fontSize: 11 }} />
            <YAxis yAxisId="rop" orientation="right" tick={{ fontSize: 11 }} label={{ value: "ROP m/hr", angle: 90, position: "insideRight", fontSize: 11 }} />
            <Tooltip content={<EconTip />} />
            <Legend {...LEGEND_TOP} />
            <Bar yAxisId="cost" dataKey="costM" name="cost/m (USD)" radius={[3, 3, 0, 0]}>
              {rows.map((r) => <Cell key={r.iadc} fill={colorForIadc(codes, r.iadc)} />)}
            </Bar>
            <Bar yAxisId="rop" dataKey="avgRop" name="avg ROP (m/hr)" fill="#9ca3af" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="border border-gray-200 rounded overflow-auto">
        <table className="text-[11px] tabular-nums border-collapse w-full">
          <thead><tr className="bg-gray-100">
            {["IADC", "Class", "Bit size", "Runs", "Avg ROP", "Trip-adj ROP", "Avg m/bit", "Avg hr", "Cost/m (USD)"].map((h, i) => (
              <th key={h} className={`border border-gray-300 px-2 py-1 font-medium text-gray-700 whitespace-nowrap ${i < 3 ? "text-left" : "text-right"}`}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.iadc} className={i % 2 ? "bg-teal-50/40" : "bg-white"}>
                <td className="border border-gray-300 px-2 py-0.5 text-left font-semibold" style={{ color: colorForIadc(codes, r.iadc) }}>{r.iadc}</td>
                <td className="border border-gray-300 px-2 py-0.5 text-left">{r.bitClass}</td>
                <td className="border border-gray-300 px-2 py-0.5 text-left">{r.bitSize}"</td>
                <td className="border border-gray-300 px-2 py-0.5 text-right">{r.n}</td>
                <td className="border border-gray-300 px-2 py-0.5 text-right">{r.avgRop.toFixed(2)}</td>
                <td className="border border-gray-300 px-2 py-0.5 text-right">{r.tripRop.toFixed(2)}</td>
                <td className="border border-gray-300 px-2 py-0.5 text-right">{r.avgMeters.toFixed(0)}</td>
                <td className="border border-gray-300 px-2 py-0.5 text-right">{r.avgHours.toFixed(0)}</td>
                <td className="border border-gray-300 px-2 py-0.5 text-right font-medium">{r.costM.toFixed(0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Interp>
        Cost/m = (bit price + rig rate × (drilling + trip hours)) ÷ metres drilled. A bit with a high instantaneous ROP but low footage forces more round trips, which can make it more expensive per metre than a slower bit that drills the whole section — toggle “include trip time” to see the effect. Lowest cost/m here: <b>IADC {rows[0].iadc}</b> at {rows[0].costM.toFixed(0)} USD/m. Bit prices (size-tiered at {LARGE_BIT_IN}″ — reference defaults: 17½″ roller $11,200 / PDC $70,000, smaller $8,000 / $50,000) and rig rate are your inputs; no bit cost is stored in the database.
      </Interp>
    </div>
  );
}
function EconTip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload as { iadc: string; bitClass: string; costM: number; avgRop: number; tripRop: number; avgMeters: number; n: number };
  return (
    <div className="px-2 py-1 rounded bg-gray-900 text-white text-[11px] leading-tight shadow-lg">
      <div className="font-semibold">IADC {r.iadc} · {r.bitClass}</div>
      <div>cost/m {r.costM.toFixed(0)} USD · ROP {r.avgRop.toFixed(2)} m/hr</div>
      <div>trip-adj ROP {r.tripRop.toFixed(2)} · {r.avgMeters.toFixed(0)} m/bit · {r.n} runs</div>
    </div>
  );
}

// ── Bit advisor: transparent weighted ranking of IADC types ──────────────────

function AdvisorView({ points, bitSizes }: { points: RopPoint[]; bitSizes: string[] }) {
  const [sizeFilter, setSizeFilter] = useState("");
  const [rigDay, setRigDay] = useState(30000);
  const [tripSpeed, setTripSpeed] = useState(300);
  const [prices, setPrices] = useState<BitPrices>(PRICE_DEFAULTS);
  const [sectionLen, setSectionLen] = useState(1000);
  // composite weights (percent) — cost/m, trip-adj ROP, ROP, meterage, MSE efficiency
  const [w, setW] = useState({ cost: 40, trip: 25, rop: 15, meter: 15, mse: 5 });

  const pts = useMemo(() => (sizeFilter ? points.filter((p) => p.bitSize === sizeFilter) : points), [points, sizeFilter]);

  const ranked = useMemo(() => {
    const rigHr = rigUsdPerHr(rigDay);
    const cand = groupByIadc(pts)
      .filter((g) => g.avgMeters > 0 && g.avgHours > 0)
      .map((g) => {
        const bitUsd = priceFor(g.bitClass, g.avgDia, prices);
        const tripHr = tripHours({ depthM: g.avgDepth, tripSpeedMHr: tripSpeed });
        const costM = costPerMeter({ bitUsd, rigUsdPerHr: rigHr, drillHr: g.avgHours, tripHr, meterageM: g.avgMeters }) ?? Infinity;
        const tripRop = tripAdjustedRop({ meterageM: g.avgMeters, drillHr: g.avgHours, tripHr }) ?? 0;
        const grid = buildGrid(g.pts); const win = grid ? bestCell(grid) : null;
        return { ...g, bitUsd, tripHr, costM, tripRop, win };
      })
      .filter((r) => Number.isFinite(r.costM));
    if (!cand.length) return [];
    const maxMse = Math.max(...cand.map((c) => c.medMse ?? 0), 1);
    const nCost = normalize(cand.map((c) => c.costM), false);
    const nTrip = normalize(cand.map((c) => c.tripRop), true);
    const nRop = normalize(cand.map((c) => c.avgRop), true);
    const nMeter = normalize(cand.map((c) => c.avgMeters), true);
    const nMse = normalize(cand.map((c) => c.medMse ?? maxMse), false);
    const wsum = w.cost + w.trip + w.rop + w.meter + w.mse || 1;
    return cand.map((c, i) => {
      const bits = Math.max(1, Math.ceil(sectionLen / c.avgMeters));
      return {
        ...c,
        score: (w.cost * nCost[i] + w.trip * nTrip[i] + w.rop * nRop[i] + w.meter * nMeter[i] + w.mse * nMse[i]) / wsum,
        bits,
        // Expected section time: each bit drills its average hours then trips.
        days: (bits * (c.avgHours + c.tripHr)) / 24,
        sectionCost: c.costM * sectionLen,
      };
    }).sort((a, b) => b.score - a.score);
  }, [pts, rigDay, tripSpeed, prices, sectionLen, w]);

  const codes = ranked.map((r) => r.iadc);
  const top = ranked[0];

  if (!ranked.length) return <Empty>No IADC-coded bit runs with footage and drilling hours for this selection to rank.</Empty>;

  const Weight = ({ k, label }: { k: keyof typeof w; label: string }) => (
    <label className="flex items-center gap-1.5 text-gray-600 whitespace-nowrap">
      {label}
      <input type="range" min={0} max={100} value={w[k]} onChange={(e) => setW({ ...w, [k]: Number(e.target.value) })} className="w-20" />
      <span className="tabular-nums w-7 text-right">{w[k]}%</span>
    </label>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap text-xs">
        <SizeFilter value={sizeFilter} onChange={setSizeFilter} bitSizes={bitSizes} total={points.length} />
        <NumInput label="Rig rate" value={rigDay} onChange={setRigDay} step={1000} suffix="USD/day" />
        <NumInput label="Trip speed" value={tripSpeed} onChange={setTripSpeed} step={50} suffix="m/hr" width="w-20" />
        <PriceInputs prices={prices} onChange={setPrices} />
        <NumInput label="Section length" value={sectionLen} onChange={setSectionLen} step={100} suffix="m" />
      </div>
      <div className="flex items-center gap-4 flex-wrap text-xs bg-gray-50 border border-gray-200 rounded px-3 py-2">
        <span className="font-semibold text-gray-600">Weights</span>
        <Weight k="cost" label="Cost/m" /><Weight k="trip" label="Trip-adj ROP" /><Weight k="rop" label="ROP" />
        <Weight k="meter" label="Meterage" /><Weight k="mse" label="MSE eff." />
      </div>

      <div className="border border-gray-200 rounded overflow-auto">
        <table className="text-[11px] tabular-nums border-collapse w-full">
          <thead><tr className="bg-gray-100">
            {["#", "IADC", "Class", "Score", "Cost/m", "Trip-adj ROP", "ROP", "m/bit", "Med MSE", "Op. window (WOB / RPM)", `Bits / ${sectionLen}m`, "Days", "Section cost"].map((h, i) => (
              <th key={h} className={`border border-gray-300 px-2 py-1 font-medium text-gray-700 whitespace-nowrap ${i === 1 || i === 2 || i === 9 ? "text-left" : "text-right"}`}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {ranked.map((r, i) => (
              <tr key={r.iadc} className={i === 0 ? "bg-amber-50" : i % 2 ? "bg-teal-50/40" : "bg-white"}>
                <td className="border border-gray-300 px-2 py-0.5 text-right text-gray-500">{i + 1}</td>
                <td className="border border-gray-300 px-2 py-0.5 text-left font-semibold" style={{ color: colorForIadc(codes, r.iadc) }}>{r.iadc}</td>
                <td className="border border-gray-300 px-2 py-0.5 text-left">{r.bitClass}</td>
                <td className="border border-gray-300 px-2 py-0.5 text-right font-semibold">{(r.score * 100).toFixed(0)}</td>
                <td className="border border-gray-300 px-2 py-0.5 text-right">{r.costM.toFixed(0)}</td>
                <td className="border border-gray-300 px-2 py-0.5 text-right">{r.tripRop.toFixed(2)}</td>
                <td className="border border-gray-300 px-2 py-0.5 text-right">{r.avgRop.toFixed(2)}</td>
                <td className="border border-gray-300 px-2 py-0.5 text-right">{r.avgMeters.toFixed(0)}</td>
                <td className="border border-gray-300 px-2 py-0.5 text-right">{r.medMse != null ? Math.round(r.medMse).toLocaleString() : "—"}</td>
                <td className="border border-gray-300 px-2 py-0.5 text-left">{r.win ? `${fmt1(r.win.wobLo)}–${fmt1(r.win.wobHi)} klb / ${Math.round(r.win.rpmLo)}–${Math.round(r.win.rpmHi)}` : "—"}</td>
                <td className="border border-gray-300 px-2 py-0.5 text-right">{r.bits}</td>
                <td className="border border-gray-300 px-2 py-0.5 text-right">{r.days.toFixed(1)}</td>
                <td className="border border-gray-300 px-2 py-0.5 text-right">{(r.sectionCost / 1000).toFixed(0)}k</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Interp>
        Each IADC type is scored 0–100 from a transparent weighted blend of cost/m, trip-adjusted ROP, instantaneous ROP, meterage per bit, and MSE efficiency (move the sliders to reweight). Recommended bit for this selection: <b>IADC {top.iadc}</b> ({top.bitClass}) — operating window {top.win ? <>WOB {wobRange(top.win.wobLo, top.win.wobHi)}, RPM {Math.round(top.win.rpmLo)}–{Math.round(top.win.rpmHi)}</> : "n/a"}; ≈ {top.bits} bit{top.bits === 1 ? "" : "s"}, ≈ {top.days.toFixed(1)} days and ≈ {(top.sectionCost / 1000).toFixed(0)}k USD to drill {sectionLen} m. Rankings reflect this dataset and your economic inputs, not a guarantee for a new well.
      </Interp>

      <details className="text-xs border border-gray-200 rounded px-3 py-2 text-gray-600">
        <summary className="cursor-pointer font-semibold text-gray-700">What the reference study found (Khangiran KG-52…62) — reference field results, not your data</summary>
        <ul className="list-disc ml-5 mt-1.5 space-y-0.5 leading-relaxed">
          <li><b>17½″</b>: 11X most economic ($293/m), then 13X ($554/m). Optimal windows — 11X: WOB 15–20 t / RPM 90–110; PDC: WOB 5–15 t / RPM 130–180.</li>
          <li><b>12¼″</b>: 32X / 51X / M323 cluster (~$318–333/m); M323 had the best trip-adjusted ROP (1.51 m/hr). PDC window: WOB 20–25 t / RPM 60–80.</li>
          <li><b>8½″</b>: M323 ($792/m), then 51X ($815/m). PDC window: WOB 10–15 or 20–25 t / RPM 120–160.</li>
          <li>ROP–MSE power-law exponents by section: 0.493 (17½″), 0.917 (12¼″), 0.476 (8½″) — b near 1 ⇒ energy efficiently converted to rock destruction.</li>
        </ul>
      </details>
    </div>
  );
}
