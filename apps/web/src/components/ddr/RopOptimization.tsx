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
  breakEvenRopMHr, breakEvenMeters,
  iqrFence, klbToTonnes, type IqrFence,
  buildRoadmap, cautionCutoffs, type RoadmapRun, type RoadmapRow, type Band,
  wearAvg, wearPer100m, quantile as quantileOf,
  apparentCcsFromMse, binghamFit, dExponent, dcExponent, familiesForUcs,
  aggressiveness, depthOfCutIn, drillingStrength, efficiencyRatio,
  bestComposite, ropBands, MIN_BAND_RUNS,
  bymFit, bymSurface, gridOver, nozzlePressureDrop, jetImpact,
  BYM_MIN_RUNS, BYM_MIN_SPREAD, type BymFit as BymFitResult,
  mhrToFthr,
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
  // The discrete IADC dull positions, for the wear view's damage-mode Pareto.
  // `dullCharLabel` is decoded server-side, where the IADC map lives.
  dullChar: string | null; dullCharLabel: string | null;
  dullLocation: string | null; dullBearing: string | null; dullGauge: string | null;
  // The torque MSE was computed from, and whether it was MEASURED. The
  // aggressiveness metric excludes estimated torque — see the wear/MSE views.
  torqueFtLbf: number | null; torqueMeasured: boolean;
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

type View = "summary" | "contour" | "voxel" | "roadmap" | "wear" | "strength" | "mse" | "hydraulics" | "economics" | "advisor" | "model" | "scatter" | "size" | "progress" | "table";
const VIEWS: { key: View; label: string }[] = [
  { key: "summary", label: "Summary" },
  { key: "contour", label: "Contour" },
  { key: "voxel", label: "3D ROP" },
  { key: "roadmap", label: "Roadmap" },
  { key: "wear", label: "Bit wear" },
  { key: "strength", label: "Strength" },
  { key: "mse", label: "MSE" },
  { key: "hydraulics", label: "Hydraulics" },
  { key: "economics", label: "Economics" },
  { key: "advisor", label: "Bit advisor" },
  { key: "model", label: "Model" },
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
            : view === "wear" ? <WearView points={points} bitSizes={bitSizes} />
            : view === "strength" ? <StrengthView points={points} bitSizes={bitSizes} />
            : view === "mse" ? <MseView points={points} bitSizes={bitSizes} />
            : view === "hydraulics" ? <HydraulicsView points={points} bitSizes={bitSizes} />
            : view === "economics" ? <EconomicsView points={points} bitSizes={bitSizes} />
            : view === "advisor" ? <AdvisorView points={points} bitSizes={bitSizes} />
            : view === "model" ? <ModelView points={points} bitSizes={bitSizes} />
            : view === "scatter" ? <ScatterView points={points} bitSizes={bitSizes} />
            : view === "size" ? <BySizeView points={points} bitSizes={bitSizes} />
            : view === "progress" ? <ProgressView points={points} />
            : <TableView points={points} onOpenReport={onOpenReport} />}
        </div>
      </div>
    </div>
  );
}

/* ══ STRENGTH — apparent rock strength and bit-type match ══════════════════════
 *
 * The tab's missing physical axis. Everything here is APPARENT: inferred from
 * what the bit felt, never measured on core, and every label says so. A CCS
 * derived from surface-torque MSE in a deviated well carries the drillstring's
 * friction as well as the rock's strength — trends are robust, absolute levels
 * are not (research §1 cross-cutting caveat d).
 */
function StrengthView({ points, bitSizes }: { points: RopPoint[]; bitSizes: string[] }) {
  const [sizeFilter, setSizeFilter] = useState("");
  const [selForm, setSelForm] = useState("");

  const pts = useMemo(
    () => (sizeFilter ? points.filter((p) => p.bitSize === sizeFilter) : points),
    [points, sizeFilter],
  );

  /** Per-formation apparent strength + Bingham fit, ordered by depth. */
  const rows = useMemo(() => {
    const byF = new Map<string, { label: string; ps: RopPoint[] }>();
    for (const p of pts) {
      const shown = p.topFormation ?? "—";
      const k = shown.trim().toLowerCase();
      const e = byF.get(k);
      if (e) e.ps.push(p); else byF.set(k, { label: shown, ps: [p] });
    }
    return [...byF.values()].map(({ label, ps }) => {
      const strength = apparentCcsFromMse(
        ps.map((p) => ({ msePsi: p.mse, measuredTorque: p.torqueMeasured })),
      );
      const bingham = binghamFit(ps.map((p) => ({
        ropFtHr: mhrToFthr(p.rop), rpm: p.rpm, wobKlb: p.wob, diaIn: p.diaIn,
      })));
      const ran = [...new Set(ps.map((p) => p.bitClass).filter((c): c is "PDC" | "roller" => c != null))];
      return {
        formation: label, n: ps.length,
        depth: median(ps.map(midDepth).filter((d): d is number => d != null)),
        strength, bingham, ran, ps,
      };
    }).sort((a, b) => (a.depth ?? Infinity) - (b.depth ?? Infinity));
  }, [pts]);

  const withStrength = rows.filter((r) => r.strength != null);
  const maxUcs = Math.max(...withStrength.map((r) => r.strength!.ucsBand[1]), 1);

  /** dc-exponent against depth, coloured per well. */
  const dcSeries = useMemo(() => {
    const byWell = new Map<string, { d: number; dc: number }[]>();
    for (const p of pts) {
      const depth = midDepth(p);
      const d = dExponent({
        ropFtHr: mhrToFthr(p.rop), rpm: p.rpm,
        wobLbf: p.wob * 1000, dIn: p.diaIn,
      });
      const dc = dcExponent(d, { mudPpg: p.mudWeight });
      if (depth == null || dc == null || !Number.isFinite(dc)) continue;
      const a = byWell.get(p.name);
      if (a) a.push({ d: depth, dc }); else byWell.set(p.name, [{ d: depth, dc }]);
    }
    return [...byWell.entries()].slice(0, 10);
  }, [pts]);

  const sel = rows.find((r) => r.formation === selForm) ?? withStrength[0] ?? rows[0];
  const binghamPts = useMemo(() => (sel?.ps ?? []).flatMap((p) => {
    if (p.diaIn == null || !(p.rpm > 0) || !(p.diaIn > 0) || !(p.wob > 0)) return [];
    return [{ wd: p.wob / p.diaIn, rn: mhrToFthr(p.rop) / p.rpm }];
  }), [sel]);

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
        <span className="text-gray-400 ml-auto">
          {withStrength.length} of {rows.length} formation{rows.length === 1 ? "" : "s"} carry enough
          run-level MSE for a strength estimate.
        </span>
      </div>

      {/* 1 ── strength ladder with bit-family suitability. */}
      <div className="border border-gray-200 rounded-lg bg-white p-3 overflow-x-auto">
        <div className="text-[11px] font-semibold text-gray-700 mb-2">
          Apparent strength ladder
          <span className="font-normal text-gray-400">
            {" "}· UCS band implied by MSE ÷ 3 and the published CCS:UCS range
          </span>
        </div>
        <table className="w-full text-[11px]" style={{ minWidth: 760 }}>
          <thead>
            <tr className="text-gray-500 text-left">
              <th className="py-1 pr-2 font-medium">Formation</th>
              <th className="py-1 pr-2 font-medium w-16">Depth</th>
              <th className="py-1 pr-2 font-medium" style={{ width: "34%" }}>Apparent UCS (psi)</th>
              <th className="py-1 pr-2 font-medium">Families the band admits</th>
              <th className="py-1 pr-2 font-medium">Actually run</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const st = r.strength;
              const mid = st ? (st.ucsBand[0] + st.ucsBand[1]) / 2 : null;
              const admits = mid != null ? familiesForUcs(mid) : [];
              const admitNames = admits.map((b) => b.family);
              const mismatch = r.ran.filter((c) =>
                c === "PDC" ? !admitNames.includes("PDC")
                  : !admitNames.some((f) => f.startsWith("Roller") || f === "TCI" || f === "Milled tooth"));
              return (
                <tr key={r.formation} className="border-t border-gray-100">
                  <td className="py-1 pr-2 text-gray-800 whitespace-nowrap">{r.formation}</td>
                  <td className="py-1 pr-2 tabular-nums text-gray-500">{intc(r.depth)}</td>
                  <td className="py-1 pr-2">
                    {st == null ? <span className="text-gray-300">insufficient MSE</span> : (
                      <div className="flex items-center gap-2">
                        <div className="relative h-3 flex-1 bg-gray-100 rounded">
                          <div className="absolute h-3 rounded bg-indigo-200 border border-indigo-400"
                            style={{
                              left: `${(st.ucsBand[0] / maxUcs) * 100}%`,
                              width: `${Math.max(1.5, ((st.ucsBand[1] - st.ucsBand[0]) / maxUcs) * 100)}%`,
                            }} />
                        </div>
                        <span className="tabular-nums text-gray-600 whitespace-nowrap"
                          title={`apparent CCS ${Math.round(st.ccsPsi).toLocaleString()} psi · ${psiToMPa(st.ccsPsi).toFixed(0)} MPa · n=${st.n}${st.fromMeasuredTorque ? " · measured torque" : " · estimated torque"}`}>
                          {Math.round(st.ucsBand[0]).toLocaleString()}–{Math.round(st.ucsBand[1]).toLocaleString()}
                          <span className="text-gray-400"> ({psiToMPa(st.ucsBand[1]).toFixed(0)} MPa)</span>
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="py-1 pr-2 text-gray-600">
                    {admitNames.length ? admitNames.join(", ") : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="py-1 pr-2">
                    {r.ran.length === 0 ? <span className="text-gray-300">—</span> : r.ran.map((c) => (
                      <span key={c}
                        className={`inline-block mr-1 px-1.5 py-0.5 rounded text-[10px] ${
                          mismatch.includes(c)
                            ? "bg-amber-100 text-amber-800 border border-amber-300"
                            : "bg-gray-100 text-gray-600"}`}
                        title={mismatch.includes(c) ? "outside the published band for this apparent strength" : ""}>
                        {c}{mismatch.includes(c) ? " ⚠" : ""}
                      </span>
                    ))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 2 ── Bingham panel. */}
      <div className="border border-gray-200 rounded-lg bg-white p-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[11px] font-semibold text-gray-700">Bingham drillability</span>
          <select value={sel?.formation ?? ""} onChange={(e) => setSelForm(e.target.value)}
            className="h-6 px-1 text-[11px] border border-gray-300 rounded bg-white">
            {rows.map((r) => <option key={r.formation} value={r.formation}>{r.formation}</option>)}
          </select>
          <span className="text-[10px] text-gray-400">
            {sel?.bingham
              ? `slope ${sel.bingham.slope.toFixed(4)} · threshold W/D ${sel.bingham.thresholdWD?.toFixed(2) ?? "—"} klb/in · R² ${sel.bingham.r2.toFixed(2)} · n ${sel.bingham.n}`
              : "insufficient WOB/RPM spread for a fit"}
          </span>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <ScatterChart margin={{ top: 6, right: 16, bottom: 24, left: 4 }}>
            <CartesianGrid stroke="#eee" />
            <XAxis type="number" dataKey="wd" name="W/D" tick={{ fontSize: 10 }}
              label={{ value: "WOB / diameter (klb/in)", position: "insideBottom", offset: -12, fontSize: 10 }} />
            <YAxis type="number" dataKey="rn" name="R/N" tick={{ fontSize: 10 }} width={64}
              label={{ value: "ROP / RPM (ft per rev-hr)", angle: -90, position: "insideLeft", fontSize: 10 }} />
            <Tooltip cursor={{ strokeDasharray: "3 3" }} />
            <Scatter data={binghamPts} fill="#4338ca" fillOpacity={0.55} />
            {sel?.bingham && (
              <ReferenceLine
                segment={[
                  { x: 0, y: sel.bingham.intercept },
                  { x: Math.max(...binghamPts.map((p) => p.wd), 1),
                    y: sel.bingham.intercept + sel.bingham.slope * Math.max(...binghamPts.map((p) => p.wd), 1) },
                ]}
                stroke="#4338ca" strokeDasharray="4 3" />
            )}
          </ScatterChart>
        </ResponsiveContainer>
        <div className="text-[10px] text-gray-500 mt-1">
          Slope is a <b>relative</b> drillability index — it falls as rock strengthens — never an
          absolute strength in psi. Ranking across formations:{" "}
          {rows.filter((r) => r.bingham).sort((a, b) => b.bingham!.slope - a.bingham!.slope)
            .slice(0, 6).map((r) => `${r.formation} ${r.bingham!.slope.toFixed(3)}`).join(" · ") || "—"}
        </div>
      </div>

      {/* 3 ── dc-exponent against depth. */}
      {dcSeries.length > 0 && (
        <div className="border border-gray-200 rounded-lg bg-white p-3">
          <div className="text-[11px] font-semibold text-gray-700 mb-1">
            Corrected d-exponent against depth
            <span className="font-normal text-gray-400"> · the compaction / strength trend</span>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <ScatterChart margin={{ top: 6, right: 16, bottom: 24, left: 4 }}>
              <CartesianGrid stroke="#eee" />
              <XAxis type="number" dataKey="dc" name="dc" tick={{ fontSize: 10 }}
                label={{ value: "dc-exponent", position: "insideBottom", offset: -12, fontSize: 10 }} />
              <YAxis type="number" dataKey="d" name="Depth" reversed tick={{ fontSize: 10 }} width={62}
                label={{ value: "Depth (m)", angle: -90, position: "insideLeft", fontSize: 10 }} />
              <Tooltip cursor={{ strokeDasharray: "3 3" }} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              {dcSeries.map(([well, data], i) => (
                <Scatter key={well} name={well} data={data}
                  fill={SIZE_COLORS[i % SIZE_COLORS.length]} fillOpacity={0.6} />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
          <div className="text-[10px] text-gray-500 mt-1">
            The correction properly uses equivalent circulating density; ECD is not recorded in these
            reports, so <b>mud weight stands in for it</b> — which understates the correction wherever
            annular losses are significant.
          </div>
        </div>
      )}

      <Interp>
        Apparent CCS is the <b>low quartile</b> of a formation's run-level MSE divided by three — the
        efficient-drilling anchor MSE ≈ 3 × CCS at mechanical efficiency 0.30–0.35. The low quartile
        rather than the mean because a formation's MSE distribution is inflated by every run that met
        dysfunction, and the mean would report the rock <i>plus</i> the trouble. The UCS band follows
        from the published CCS ≈ 1.8–2.3 × UCS range, and the family columns apply the OGJ suitability
        table — milled tooth below 9,000 psi, TCI from 9,000, PDC to about 22,000 and possibly beyond,
        impregnated above 15,000. An amber chip means a family was run outside its published band,
        which is a question rather than a verdict. Every figure here is <b>apparent</b>: surface-torque
        MSE carries drillstring friction as well as rock in a deviated well, so trends are robust and
        absolute levels are not. Source: OGJ 1994 dull-grading & CCS articles; SPE 2017 MSE/DS paper.
      </Interp>
    </div>
  );
}

/* ══ BIT WEAR — quantitative dull forensics ════════════════════════════════════
 *
 * The tab stored IADC dull grades and only ever printed them as text. They carry
 * a rate: the 8-point cutting-structure scale is LINEAR in remaining cutter
 * height (SPE/IADC 23939), so grade ÷ metres is a comparable number and
 * "which bit survives which formation" becomes a chart rather than an anecdote.
 *
 * The SPE/IADC 2022 "IADC Code Upgrade" forensics paper is the workflow this
 * serves: damage -> dysfunction -> practice change, from routine drilling data.
 */
type BitFamily = "PDC" | "roller" | "unclassified";
const famOf = (p: RopPoint): BitFamily => p.bitClass ?? "unclassified";
const FAMILIES: BitFamily[] = ["PDC", "roller", "unclassified"];
const FAM_COLOR: Record<BitFamily, string> = {
  PDC: "#1e40af", roller: "#b45309", unclassified: "#6b7280",
};

interface WearRow { formation: string; depth: number | null; cells: Map<BitFamily, { mean: number; n: number; hours: number; meters: number }> }

function WearView({ points, bitSizes }: { points: RopPoint[]; bitSizes: string[] }) {
  const [sizeFilter, setSizeFilter] = useState("");
  const pts = useMemo(
    () => (sizeFilter ? points.filter((p) => p.bitSize === sizeFilter) : points),
    [points, sizeFilter],
  );

  /** Every run that can produce a wear rate at all. */
  const graded = useMemo(() => pts.flatMap((p) => {
    const avg = wearAvg(p.dullInner, p.dullOuter);
    const per100 = wearPer100m(avg, p.meters);
    return avg == null || per100 == null ? [] : [{ p, avg, per100 }];
  }), [pts]);

  const heat = useMemo((): { rows: WearRow[]; max: number } => {
    const byF = new Map<string, { label: string; depth: number | null; runs: typeof graded }>();
    for (const g of graded) {
      const shown = g.p.topFormation ?? "—";
      const k = shown.trim().toLowerCase();
      const e = byF.get(k);
      if (e) e.runs.push(g);
      else byF.set(k, { label: shown, depth: midDepth(g.p), runs: [g] });
    }
    const cellMeans: number[] = [];
    const rows: WearRow[] = [...byF.values()].map((e) => {
      const cells = new Map<BitFamily, { mean: number; n: number; hours: number; meters: number }>();
      for (const fam of FAMILIES) {
        const rs = e.runs.filter((g) => famOf(g.p) === fam);
        if (!rs.length) continue;
        const m = mean(rs.map((g) => g.per100));
        if (m == null) continue;
        cellMeans.push(m);
        cells.set(fam, {
          mean: m, n: rs.length,
          hours: mean(rs.map((g) => g.p.bitHour ?? 0)) ?? 0,
          meters: mean(rs.map((g) => g.p.meters ?? 0)) ?? 0,
        });
      }
      return { formation: e.label, depth: e.depth, cells };
    }).filter((r) => r.cells.size > 0);
    rows.sort((a, b) => (a.depth ?? Infinity) - (b.depth ?? Infinity));
    // Scale to the 90th percentile, not the maximum.
    //
    // One formation in the real archive comes back at 31 grade points per 100 m
    // against a fleet median near 0.3. Scaling to that single cell pushed every
    // other value to the same end of the ramp: 0.00 and 1.78 rendered as the
    // identical colour, so the heatmap coloured nothing. Cells above the cap are
    // clamped and marked, which keeps the outlier visible without letting it
    // flatten the other forty rows.
    const cap = quantileOf(cellMeans, 0.9) ?? Math.max(...cellMeans, 1);
    return { rows, max: cap > 0 ? cap : 1 };
  }, [graded]);

  /** Damage-mode Pareto: which dull characteristic dominates, split by family. */
  const pareto = useMemo(() => {
    const m = new Map<string, { label: string; PDC: number; roller: number; unclassified: number; total: number }>();
    for (const p of pts) {
      if (!p.dullChar) continue;
      const label = p.dullCharLabel ?? p.dullChar;
      const e = m.get(label) ?? { label, PDC: 0, roller: 0, unclassified: 0, total: 0 };
      e[famOf(p)] += 1; e.total += 1;
      m.set(label, e);
    }
    return [...m.values()].sort((a, b) => b.total - a.total).slice(0, 12);
  }, [pts]);

  /** Wear vs ROP — the Dupriest sliding-distance hypothesis, tested. */
  const wearRop = useMemo(() => {
    const byFam = new Map<BitFamily, { rop: number; wear: number }[]>();
    for (const g of graded) {
      const fam = famOf(g.p);
      const a = byFam.get(fam);
      const pt = { rop: g.p.rop, wear: g.per100 };
      if (a) a.push(pt); else byFam.set(fam, [pt]);
    }
    const rho = spearman(graded.map((g) => g.p.rop), graded.map((g) => g.per100));
    return { byFam, rho, n: graded.length };
  }, [graded]);

  const gradedShare = pts.length ? graded.length / pts.length : 0;

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
        <span className="text-gray-400 ml-auto">
          <CoverageNote have={graded.length} total={pts.length}
            extra="a wear rate needs BOTH dull rows graded and positive footage" />
        </span>
      </div>

      {graded.length === 0 ? (
        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          No run in this selection carries both cutting-structure rows and footage, so no wear rate
          can be computed. In this archive most bit records are graded 0/0 — the fields are present
          but unfilled, which is a data-capture gap rather than a fleet of unworn bits.
        </div>
      ) : (
        <>
          {gradedShare < 0.25 && (
            <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Only {Math.round(gradedShare * 100)}% of runs here carry a usable dull grade. Read the
              panels below as indicative of that subset, not of the fleet.
            </div>
          )}

          {/* 1 ── wear-rate heatmap: formation × bit family. */}
          <div className="border border-gray-200 rounded-lg bg-white p-3 overflow-x-auto">
            <div className="text-[11px] font-semibold text-gray-700 mb-2">
              Wear rate by formation and bit family
              <span className="font-normal text-gray-400"> · mean grade points per 100 m — lower survives longer</span>
            </div>
            <table className="text-[11px]" style={{ minWidth: 460 }}>
              <thead>
                <tr className="text-gray-500 text-left">
                  <th className="py-1 pr-3 font-medium">Formation</th>
                  <th className="py-1 pr-3 font-medium">Depth</th>
                  {FAMILIES.map((f) => <th key={f} className="py-1 px-2 font-medium text-center">{f}</th>)}
                </tr>
              </thead>
              <tbody>
                {heat.rows.map((r) => (
                  <tr key={r.formation} className="border-t border-gray-100">
                    <td className="py-1 pr-3 text-gray-800 whitespace-nowrap">{r.formation}</td>
                    <td className="py-1 pr-3 tabular-nums text-gray-500">{intc(r.depth)}</td>
                    {FAMILIES.map((f) => {
                      const c = r.cells.get(f);
                      if (!c) return <td key={f} className="py-1 px-2 text-center text-gray-300">—</td>;
                      // Low wear is GOOD, so it takes the cool end of the ramp —
                      // the opposite of ROP, where high is good and takes the hot
                      // end. Reading `1 - t` here painted unworn bits red.
                      const raw = heat.max > 0 ? c.mean / heat.max : 0;
                      const t = Math.min(1, raw);
                      const over = raw > 1;
                      return (
                        <td key={f} className="py-1 px-1 text-center"
                          title={`${c.n} run(s) · mean ${c.hours.toFixed(1)} hr · ${c.meters.toFixed(0)} m`
                            + (over ? " · above the 90th-percentile colour cap" : "")}>
                          <span className="inline-block px-2 py-0.5 rounded tabular-nums"
                            style={{
                              background: ropColor(t),
                              color: t > 0.55 ? "#fff" : "#111",
                              outline: over ? "2px solid #b91c1c" : undefined,
                            }}>
                            {c.mean.toFixed(2)}{over ? "▲" : ""}
                          </span>
                          <span className="block text-[9px] text-gray-400">n={c.n}</span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 2 ── damage-mode Pareto. */}
          {pareto.length > 0 && (
            <div className="border border-gray-200 rounded-lg bg-white p-3">
              <div className="text-[11px] font-semibold text-gray-700 mb-1">
                Dominant damage mode
                <span className="font-normal text-gray-400"> · runs per IADC dull characteristic</span>
              </div>
              <ResponsiveContainer width="100%" height={Math.max(180, pareto.length * 26 + 40)}>
                <BarChart data={pareto} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
                  <CartesianGrid stroke="#eee" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="label" width={168} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  {FAMILIES.map((f) => (
                    <Bar key={f} dataKey={f} name={f} stackId="d" fill={FAM_COLOR[f]} maxBarSize={18} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* 3 ── wear vs ROP: the sliding-distance hypothesis, tested. */}
          <div className="border border-gray-200 rounded-lg bg-white p-3">
            <div className="text-[11px] font-semibold text-gray-700 mb-1">
              Wear rate against ROP
              <span className="font-normal text-gray-400">
                {" "}· Spearman ρ = {wearRop.rho == null ? "—" : wearRop.rho.toFixed(2)} over n = {wearRop.n}
              </span>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <ScatterChart margin={{ top: 6, right: 16, bottom: 24, left: 4 }}>
                <CartesianGrid stroke="#eee" />
                <XAxis type="number" dataKey="rop" name="ROP" unit=" m/hr" tick={{ fontSize: 10 }}
                  label={{ value: "ROP (m/hr)", position: "insideBottom", offset: -12, fontSize: 10 }} />
                <YAxis type="number" dataKey="wear" name="Wear" tick={{ fontSize: 10 }} width={62}
                  label={{ value: "grade / 100 m", angle: -90, position: "insideLeft", fontSize: 10 }} />
                <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                {FAMILIES.map((f) => {
                  const d = wearRop.byFam.get(f);
                  return d && d.length
                    ? <Scatter key={f} name={f} data={d} fill={FAM_COLOR[f]} fillOpacity={0.65} />
                    : null;
                })}
              </ScatterChart>
            </ResponsiveContainer>
            <p className="text-[10px] text-gray-500 mt-1 leading-relaxed">
              Dupriest's sliding-distance argument predicts a <b>negative</b> correlation absent
              dysfunction: a deeper cut per revolution means fewer revolutions, and so less sliding
              distance, per metre drilled — so a faster run should wear the bit <i>less per metre</i>
              even while wearing it more per hour.{" "}
              {wearRop.rho == null
                ? "Too few graded runs here to say."
                : wearRop.rho < -0.15
                  ? `ρ = ${wearRop.rho.toFixed(2)} here — consistent with it.`
                  : wearRop.rho > 0.15
                    ? `ρ = ${wearRop.rho.toFixed(2)} here — the opposite, which is what dysfunction looks like.`
                    : `ρ = ${wearRop.rho.toFixed(2)} here — no clear relationship either way.`}
            </p>
          </div>
        </>
      )}

      <Interp>
        Wear rates divide the IADC cutting-structure grade by hole made, which is meaningful only
        because that scale is <b>linear in remaining cutter height</b> (SPE/IADC 23939). A rate needs
        both dull rows graded — a run graded on the inner row alone is half-reported, not half-worn,
        so it is excluded rather than averaged. The heatmap answers "which family survives which
        formation"; the Pareto names the dominant damage mode to attack first, following the
        forensic pipeline damage → dysfunction → practice change. These are whole-run averages: they
        say how hard a run was on the bit, never <i>when</i> in the run the damage happened. Source:
        SPE/IADC 23939; SPE/IADC 2022 IADC Code Upgrade bit-forensics paper; Dupriest Fast Drill deck.
      </Interp>
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

// A band whose quartiles coincide is one value, not a range — "95–95" reads
// like a rendering mistake where "95" reads like what it is: every best run
// used the same setting.
const bandText = (b: Band | null, dp: number) => {
  if (!b) return "—";
  const lo = b.p25.toFixed(dp);
  const hi = b.p75.toFixed(dp);
  return lo === hi ? lo : `${lo}–${hi}`;
};

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
      <BenchmarkPanel points={points} />
    </div>
  );
}

// ── Benchmark: per-formation ROP percentile bands ────────────────────────────
// The offset-benchmarking question a mean cannot answer — is this well drilling
// this formation at P20 or P80? The SPREAD is the answer, so the bands are the
// chart and the selected well's runs sit on top of them as dots.

function BenchmarkPanel({ points }: { points: RopPoint[] }) {
  const [wellName, setWellName] = useState<string>("");

  // Grouped by NAME, not well code: the archive carries a separate code per
  // sidetrack and window (DH-013, DH-013ST1, DH-013WIN2 …), which as a picker
  // list is a dozen identical-looking rows. An engineer picking "Dehloran-013"
  // means the well, so the overlay covers all of its wellbores.
  const wells = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of points) {
      const n = p.name || p.wellCode;
      m.set(n, (m.get(n) ?? 0) + 1);
    }
    return [...m.entries()].map(([name, n]) => ({ name, n })).sort((a, b) => a.name.localeCompare(b.name));
  }, [points]);

  const bands = useMemo(
    () => ropBands(points.map((p) => ({ formation: p.topFormation, ropMHr: p.rop }))),
    [points],
  );

  // The selected well's own runs, grouped by the same folded formation key.
  const overlay = useMemo(() => {
    const m = new Map<string, number[]>();
    if (!wellName) return m;
    for (const p of points) {
      if ((p.name || p.wellCode) !== wellName || !(p.rop > 0)) continue;
      const k = p.topFormation?.trim() ? p.topFormation.trim().toLowerCase() : "\u0000none";
      const a = m.get(k); if (a) a.push(p.rop); else m.set(k, [p.rop]);
    }
    return m;
  }, [points, wellName]);

  // The no-formation bucket always stays visible past the row cap: it is often
  // the biggest single group, and dropping it would overstate how much of the
  // selection is actually formation-attributed.
  const shown = useMemo(() => {
    const named = bands.filter((b) => b.formation != null).slice(0, 18);
    const unknown = bands.find((b) => b.formation == null);
    return unknown ? [...named, unknown] : named;
  }, [bands]);
  const axisHi = useMemo(() => {
    let hi = 0;
    for (const b of shown) hi = Math.max(hi, b.p90);
    for (const vs of overlay.values()) for (const v of vs) hi = Math.max(hi, v);
    return hi > 0 ? hi * 1.05 : 1;
  }, [shown, overlay]);

  if (!shown.length) return null;
  const thin = shown.filter((b) => b.insufficient).length;
  const overlaid = [...overlay.values()].reduce((n, vs) => n + vs.length, 0);
  const unattributed = overlay.get("\u0000none")?.length ?? 0;

  return (
    <div className="space-y-2 pt-4 border-t border-gray-200">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="text-sm font-medium text-gray-700">ROP percentile bands by formation</div>
        <select value={wellName} onChange={(e) => setWellName(e.target.value)}
          className="h-7 px-2 text-xs border border-gray-300 rounded bg-white text-gray-700">
          <option value="">Overlay a well…</option>
          {wells.map((w) => <option key={w.name} value={w.name}>{w.name} ({w.n})</option>)}
        </select>
        <span className="text-[11px] text-gray-400">
          P10–P90 across every displayed run; the tick is P50. Bands need {MIN_BAND_RUNS}+ runs — thinner rows are greyed.
        </span>
        {wellName && (
          <span className="text-[11px] text-amber-700">
            {overlaid === 0
              ? `${wellName} has no runs with a usable ROP in this selection.`
              : unattributed === overlaid
                ? `All ${overlaid} of ${wellName}'s runs land in the no-formation row — none of its bit records name a top formation.`
                : `${overlaid} run${overlaid === 1 ? "" : "s"} overlaid${unattributed ? `, ${unattributed} of them unattributed` : ""}.`}
          </span>
        )}
      </div>

      <div className="space-y-1">
        {shown.map((b) => {
          const key = b.formation == null ? "\u0000none" : b.formation.trim().toLowerCase();
          const dots = overlay.get(key) ?? [];
          const pct = (v: number) => Math.min(100, Math.max(0, (v / axisHi) * 100));
          const unknown = b.formation == null;
          return (
            <div key={key} className="flex items-center gap-2 text-[11px]">
              <div className={`w-40 truncate ${b.insufficient || unknown ? "text-gray-400" : "text-gray-700"}`}
                title={unknown ? "These bit records carry no top formation" : b.formation!}>
                {unknown ? <i>no formation recorded</i> : b.formation}
              </div>
              <div className="relative flex-1 h-5 bg-gray-50 rounded border border-gray-100">
                <div className={`absolute top-1 h-3 rounded ${b.insufficient ? "bg-gray-200 border border-gray-300" : "bg-blue-100 border border-blue-300"}`}
                  style={{ left: `${pct(b.p10)}%`, width: `${Math.max(0.6, pct(b.p90) - pct(b.p10))}%` }}
                  title={`P10 ${fmt1(b.p10)} · P50 ${fmt1(b.p50)} · P90 ${fmt1(b.p90)} m/hr`} />
                <div className={`absolute top-0.5 w-0.5 h-4 ${b.insufficient ? "bg-gray-400" : "bg-blue-700"}`}
                  style={{ left: `${pct(b.p50)}%` }} />
                {dots.map((v, i) => (
                  <div key={i} className="absolute top-1.5 w-2 h-2 rounded-full bg-amber-500 border border-white"
                    style={{ left: `calc(${pct(v)}% - 4px)` }} title={`This well: ${fmt1(v)} m/hr`} />
                ))}
              </div>
              <div className={`w-40 tabular-nums whitespace-nowrap ${b.insufficient ? "text-gray-400" : "text-gray-600"}`}>
                {b.insufficient
                  ? <span title="Too few runs for a percentile band">insufficient runs (n = {b.n})</span>
                  : <>{fmt1(b.p10)}–{fmt1(b.p90)} <span className="text-gray-400">n = {b.n}</span></>}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-gray-500 leading-relaxed">
        Estimated from per-run averages, so a band describes how a formation drilled across whole bit runs, not what
        happened within one. Read position, not the number: a run at P80 of its own field is doing well whatever the
        absolute ROP. Prefer this to ratio KPIs — a ratio like NPT% <i>rises</i> when you drill faster with the same
        downtime, which is why SPE/IADC 2016 (“True Lies”) argues for reference frameworks instead.
        {thin ? ` ${thin} of ${shown.length} formations shown have fewer than ${MIN_BAND_RUNS} runs.` : ""}
        {bands.length > shown.length ? ` Showing the ${shown.length} busiest of ${bands.length} formations.` : ""}
      </p>
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

  // The technical-limit reference: each depth band drilled at the best rate any
  // displayed well achieved there. No single well drilled it — that is the point.
  // Two references, because one of them is honest and the other is useful.
  // The absolute best chains each band's single fastest interval, which is true
  // but so extreme it hugs the axis; the P10 asks what a top-decile band looks
  // like everywhere, which is a target a crew can actually aim at.
  const { composite, attainable } = useMemo(() => {
    if (series.length < 1) return { composite: [], attainable: [] };
    const tracks = series.map((s) => ({ key: s.code, points: s.data.map((d) => ({ day: d.day, depth: d.depth })) }));
    const shape = (c: { day: number; depth: number }[]) =>
      c.map((p) => ({ day: Number(p.day.toFixed(2)), depth: Math.round(p.depth), date: null, bitSize: "" }));
    return {
      composite: shape(bestComposite(tracks)),
      attainable: shape(bestComposite(tracks, { percentile: 0.1 })),
    };
  }, [series]);

  // What the fastest real well took to its own deepest point — the honest
  // yardstick for how much of a stretch the composite is.
  const fastestDays = useMemo(() => {
    let best = Infinity;
    for (const s of series) {
      const deepest = s.data.reduce((a, b) => (b.depth > a.depth ? b : a), s.data[0]);
      if (deepest && deepest.day > 0 && deepest.day < best) best = deepest.day;
    }
    return Number.isFinite(best) ? best : null;
  }, [series]);

  if (!series.some((s) => s.data.length >= 2)) return <Empty>Not enough dated bit runs to draw a learning curve.</Empty>;
  return (
    <div className="space-y-1.5">
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
          {attainable.length >= 2 && (
            <Line key="__attainable" type="monotone" dataKey="depth" data={attainable} name="P10 composite (attainable target)"
              stroke="#111827" strokeWidth={2} strokeDasharray="7 4" dot={false} activeDot={false} isAnimationActive={false} />
          )}
          {composite.length >= 2 && (
            <Line key="__composite" type="monotone" dataKey="depth" data={composite} name="Best composite (technical limit)"
              stroke="#9ca3af" strokeWidth={1.5} strokeDasharray="2 4" dot={false} activeDot={false} isAnimationActive={false} />
          )}
        </LineChart>
      </ResponsiveContainer>
      {composite.length >= 2 && (
        <p className="text-[11px] text-gray-500 leading-relaxed">
          Both references assemble a depth-time track band by band from the {series.length} wells shown, then clip to the
          earliest any well was actually at that depth. The grey <b>best composite</b> takes each band's single fastest
          interval — {Math.round(composite[composite.length - 1].depth)} m in{" "}
          {Math.round(composite[composite.length - 1].day)} days
          {fastestDays != null ? `, against the fastest well's ${Math.round(fastestDays)}` : ""} — which is a true lower
          bound and too far away to steer by, since it chains two dozen separate one-off best runs. The black{" "}
          <b>P10 composite</b> ({Math.round(attainable[attainable.length - 1]?.day ?? 0)} days) asks the useful question
          instead: what if every band went as well as this selection's own top-decile intervals? Aim at that one; the gap
          to it is opportunity, not failure. Judge against a curve rather than a ratio — NPT% and its relatives are
          perverse, since drilling faster with the same downtime <i>raises</i> them (SPE/IADC 2016, “True Lies”). Days come
          from bit-run dates only, so anything between two records — casing, logging, waiting — sits inside the interval
          it spans.
        </p>
      )}
    </div>
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
                  ? <>Founder onset ≈ <b>WOB {fmt1(founder.founderWob)} klb ({klbToTonnes(founder.founderWob).toFixed(1)} t)</b> — beyond it more weight stops adding ROP. Recommended WOB ≈ <b>{fmt1(founder.optimalWob ?? founder.founderWob)} klb ({klbToTonnes(founder.optimalWob ?? founder.founderWob).toFixed(1)} t)</b>, just below founder.{" "}
                    <span className="text-gray-500" title={LIMITER_TOOLTIP}>
                      Past founder the limit is <b>inefficiency</b> — bit balling, bottomhole balling or vibrations.
                    </span></>
                  : <>No founder in the recorded range — ROP keeps responding to WOB, so this selection is{" "}
                    <span className="text-gray-500" title={LIMITER_TOOLTIP}><b>energy-input limited</b></span>{" "}
                    rather than foundering (consider testing higher weight).</>}
              </div>
            </>
          ) : <Empty>Not enough WOB spread to build a drill-off response.</Empty>}
        </div>
      </div>

      <MseDiagnostics points={pts} />

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

/**
 * Dupriest's taxonomy, for the founder panel's tooltip.
 *
 * Every ROP limitation is either INEFFICIENCY — founder, with exactly three
 * causes — or an ENERGY-INPUT limit. ExxonMobil catalogued 40+ limiter
 * categories and only four are bit-related, which is why this tooltip exists:
 * the founder panel is about weight and rate, and a reader who takes it as
 * "the bit is the problem" has drawn the wrong conclusion most of the time.
 */
const LIMITER_TOOLTIP =
  "Dupriest (SPE 102210): every ROP limit is either inefficiency — bit balling, "
  + "bottomhole balling, or vibrations — or an energy-input limit: hole cleaning, "
  + "motor differential rating, top-drive or make-up torque, hole integrity, "
  + "surface equipment. ExxonMobil catalogued 40+ limiter categories and only four "
  + "are bit-related, so slow footage is usually not the bit's fault. All limiters "
  + "sit on the same ROP-vs-WOB line and exactly one is active at a time.";

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

/* ── WP5: efficiency ratio, aggressiveness, and the E–S cross-plot ─────────────
 *
 * Three normalised readings of the same runs, from SPE 92194 / 102210 and the
 * 2017 MSE/DS paper. All three are CROSS-RUN SCREENING — the published
 * dysfunction diagnostics need 1–3 ft depth density and 10-ft averaging already
 * loses the variations they read, so nothing here says "detection".
 */
function MseDiagnostics({ points }: { points: RopPoint[] }) {
  /** Apparent CCS per formation, so efficiency can be normalised by the rock. */
  const ccsByFormation = useMemo(() => {
    const byF = new Map<string, { msePsi: number | null; measuredTorque?: boolean }[]>();
    for (const p of points) {
      const k = p.topFormation?.trim() ? p.topFormation.trim().toLowerCase() : "\u0000none";
      const a = byF.get(k);
      const v = { msePsi: p.mse, measuredTorque: p.torqueMeasured };
      if (a) a.push(v); else byF.set(k, [v]);
    }
    const out = new Map<string, number>();
    for (const [k, vals] of byF) {
      const st = apparentCcsFromMse(vals);
      if (st) out.set(k, st.ccsPsi);
    }
    return out;
  }, [points]);

  /** Efficiency = 3·CCS / MSE against depth, capped so one noisy run cannot flatten it. */
  const CAP = 1.5;
  const efficiency = useMemo(() => points.flatMap((p) => {
    const depth = midDepth(p);
    const ccs = ccsByFormation.get((p.topFormation ?? "—").trim().toLowerCase());
    const e = efficiencyRatio(p.mse, ccs ?? null);
    if (depth == null || e == null) return [];
    return [{ depth, eff: Math.min(e, CAP), over: e > CAP, estimated: p.mseEstimated, formation: p.topFormation ?? "—" }];
  }), [points, ccsByFormation]);

  /** Aggressiveness — MEASURED torque only. */
  const mu = useMemo(() => {
    const rows = points.flatMap((p) => {
      if (!p.torqueMeasured) return [];
      const v = aggressiveness({ torqueFtLbf: p.torqueFtLbf, dIn: p.diaIn, wobLbf: p.wob * 1000 });
      return v == null ? [] : [{ make: p.make ?? "—", mu: v }];
    });
    const byMake = new Map<string, number[]>();
    for (const r of rows) { const a = byMake.get(r.make); if (a) a.push(r.mu); else byMake.set(r.make, [r.mu]); }
    return [...byMake.entries()]
      .map(([make, vs]) => ({
        make, n: vs.length,
        p25: quantileOf(vs, 0.25) ?? 0, med: median(vs) ?? 0, p75: quantileOf(vs, 0.75) ?? 0,
      }))
      .filter((r) => r.n >= 3)
      .sort((a, b) => b.med - a.med)
      .slice(0, 10);
  }, [points]);

  /** MSE against drilling strength — the Detournay & Defourny frame. */
  const es = useMemo(() => points.flatMap((p) => {
    if (p.mse == null || p.mse <= 0 || p.diaIn == null) return [];
    const doc = depthOfCutIn({ ropFtHr: mhrToFthr(p.rop), rpm: p.rpm });
    const S = drillingStrength({ wobLbf: p.wob * 1000, dIn: p.diaIn, docIn: doc });
    if (S == null || !Number.isFinite(S)) return [];
    return [{ s: Math.round(S), mse: p.mse, depth: midDepth(p) ?? 0, ratio: p.mse / S }];
  }), [points]);

  const esMax = es.length ? Math.max(...es.map((e) => Math.max(e.s, e.mse))) : 0;
  const muTotal = mu.reduce((a, r) => a + r.n, 0);

  return (
    <div className="space-y-3">
      {/* efficiency strip */}
      <div className="border border-gray-200 rounded-lg bg-white p-3">
        <div className="text-[11px] font-semibold text-gray-700 mb-1">
          Mechanical efficiency against depth
          <span className="font-normal text-gray-400">
            {" "}· 3 × apparent CCS ÷ MSE — about 1 is efficient · n = {efficiency.length}
            {efficiency.some((e) => e.over) && " · values above 1.5 are pinned at the cap"}
          </span>
        </div>
        {efficiency.length === 0 ? (
          <div className="text-[11px] text-gray-400 py-3">
            No run carries both an MSE and a formation with enough MSE to anchor a strength.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <ScatterChart margin={{ top: 6, right: 16, bottom: 24, left: 4 }}>
              <CartesianGrid stroke="#eee" />
              <XAxis type="number" dataKey="eff" domain={[0, CAP]} tick={{ fontSize: 10 }}
                label={{ value: "efficiency (3·CCS ÷ MSE)", position: "insideBottom", offset: -12, fontSize: 10 }} />
              <YAxis type="number" dataKey="depth" reversed tick={{ fontSize: 10 }} width={62}
                label={{ value: "Depth (m)", angle: -90, position: "insideLeft", fontSize: 10 }} />
              <Tooltip cursor={{ strokeDasharray: "3 3" }} />
              <ReferenceLine x={1} stroke="#047857" strokeDasharray="4 3"
                label={{ value: "anchor", fontSize: 9, position: "top" }} />
              <Legend verticalAlign="top" height={18} wrapperStyle={{ fontSize: 10 }} />
              <Scatter name="measured torque" data={efficiency.filter((e) => !e.estimated)} fill="#047857" fillOpacity={0.6} />
              <Scatter name="estimated torque" data={efficiency.filter((e) => e.estimated)} fill="#94a3b8" fillOpacity={0.45} />
            </ScatterChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* aggressiveness */}
      <div className="border border-gray-200 rounded-lg bg-white p-3">
        <div className="text-[11px] font-semibold text-gray-700 mb-1">
          Bit aggressiveness μ by make
          <span className="font-normal text-gray-400">
            {" "}· 36·T ÷ (D·W), measured torque only · n = {muTotal}
          </span>
        </div>
        {mu.length === 0 ? (
          <div className="text-[11px] text-gray-400 py-3">
            No run in this selection reports a measured torque. μ is deliberately not computed from
            an estimated torque: the estimate is itself μ × D × W ÷ 36, so it would hand back the
            assumed friction coefficient dressed up as a measurement.
          </div>
        ) : (
          <table className="text-[11px]">
            <thead>
              <tr className="text-gray-500 text-left">
                <th className="py-1 pr-3 font-medium">Make</th>
                <th className="py-1 pr-3 font-medium">n</th>
                <th className="py-1 pr-3 font-medium" style={{ width: 260 }}>μ (P25 – median – P75)</th>
                <th className="py-1 font-medium">median</th>
              </tr>
            </thead>
            <tbody>
              {mu.map((r) => {
                const hi = Math.max(...mu.map((x) => x.p75), 0.1);
                return (
                  <tr key={r.make} className="border-t border-gray-100">
                    <td className="py-1 pr-3 text-gray-800">{r.make}</td>
                    <td className="py-1 pr-3 tabular-nums text-gray-500">{r.n}</td>
                    <td className="py-1 pr-3">
                      <div className="relative h-3 bg-gray-100 rounded">
                        <div className="absolute h-3 rounded bg-teal-200 border border-teal-500"
                          style={{ left: `${(r.p25 / hi) * 100}%`, width: `${Math.max(1.5, ((r.p75 - r.p25) / hi) * 100)}%` }} />
                        <div className="absolute h-3 w-0.5 bg-teal-700" style={{ left: `${(r.med / hi) * 100}%` }} />
                      </div>
                    </td>
                    <td className="py-1 tabular-nums text-gray-700">{r.med.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {mu.some((r) => r.med > 1) && (
          <p className="text-[10px] text-amber-800 mt-1 leading-relaxed">
            A median μ above 1 is physically implausible — aggressiveness is a friction-like
            coefficient and published bit values sit between roughly 0.15 and 0.9. Where it exceeds
            that, suspect the recording rather than the bit: a torque logged in the wrong unit, or a
            WOB entered as tonnes where the column expects klb, both land here. Shown as recorded.
          </p>
        )}
      </div>

      {/* E–S cross-plot */}
      <div className="border border-gray-200 rounded-lg bg-white p-3">
        <div className="text-[11px] font-semibold text-gray-700 mb-1">
          MSE against drilling strength
          <span className="font-normal text-gray-400"> · cross-run screening · n = {es.length}</span>
        </div>
        {es.length === 0 ? (
          <div className="text-[11px] text-gray-400 py-3">No run carries MSE, WOB, RPM and a bit diameter together.</div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={300}>
              <ScatterChart margin={{ top: 6, right: 16, bottom: 24, left: 4 }}>
                <CartesianGrid stroke="#eee" />
                <XAxis type="number" dataKey="s" name="S" tick={{ fontSize: 10 }}
                  label={{ value: "drilling strength S (psi)", position: "insideBottom", offset: -12, fontSize: 10 }} />
                <YAxis type="number" dataKey="mse" name="MSE" tick={{ fontSize: 10 }} width={68}
                  label={{ value: "MSE (psi)", angle: -90, position: "insideLeft", fontSize: 10 }} />
                <ZAxis type="number" dataKey="depth" range={[20, 120]} name="depth" />
                <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                <ReferenceLine segment={[{ x: 0, y: 0 }, { x: esMax, y: esMax }]}
                  stroke="#111" strokeDasharray="5 4"
                  label={{ value: "MSE = S", fontSize: 9, position: "insideTopLeft" }} />
                <Scatter data={es} fill="#7c3aed" fillOpacity={0.5} />
              </ScatterChart>
            </ResponsiveContainer>
            <p className="text-[10px] text-gray-500 mt-1 leading-relaxed">
              Points hugging one line share a friction behaviour. Reading the published bands across
              runs: <b>MSE and MSE/S rising together</b> points at vibration-type trouble;{" "}
              <b>MSE rising while MSE/S falls</b> at balling or wear. Ratios of 1–1.5 are efficient
              and ≫ 5 severe. This is <b>screening across runs</b>, not detection within one — the
              published diagnostic needs 1–3 ft depth density and these are whole-run averages.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

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

      <BreakEvenPanel rows={rows} rigUsdPerHr={rigUsdPerHr(rigDay)} />

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

/* ── break-even against the best offset (WP3) ──────────────────────────────────
 *
 * PetroWiki/SPE calls break-even "the most important aspect" of bit economic
 * evaluation. The reference is the cheapest IADC group on screen; every other
 * group is asked the two planning questions:
 *
 *   how fast must it drill, over its own meterage, to match that cost per metre?
 *   how far must it drill, at its own ROP, to match it?
 *
 * Both invert the identity the table above computes forward, so nothing new is
 * modelled here — it is the same arithmetic solved for a different unknown.
 */
interface EconRow {
  iadc: string; bitClass: "PDC" | "roller"; bitSize: string; n: number;
  avgRop: number; avgMeters: number; avgHours: number; bitUsd: number;
  tripHr: number; costM: number;
}

function BreakEvenPanel({ rows, rigUsdPerHr: rigHr }: { rows: EconRow[]; rigUsdPerHr: number }) {
  const [refMode, setRefMode] = useState<"best" | "manual">("best");
  const [manualCost, setManualCost] = useState(0);

  const best = rows[0];   // rows arrive sorted by cost/m ascending
  const refCost = refMode === "manual" && manualCost > 0 ? manualCost : best?.costM ?? 0;

  const MAX_ROWS = 12;
  const table = useMemo(() => rows.map((r) => {
    const beRop = breakEvenRopMHr({
      refCostPerM: refCost, bitUsd: r.bitUsd, rigUsdPerHr: rigHr,
      tripHr: r.tripHr, meters: r.avgMeters,
    });
    const beMeters = breakEvenMeters({
      refCostPerM: refCost, bitUsd: r.bitUsd, rigUsdPerHr: rigHr,
      tripHr: r.tripHr, ropMHr: r.avgRop,
    });
    return { r, beRop, beMeters, beats: r.costM <= refCost + 1e-9 };
  }), [rows, refCost, rigHr]);

  // Most groups genuinely cannot reach the reference: on four real fields the
  // cost/m spread runs 258 to 36,323 $/m, a factor of 140, because a bit that
  // drilled five metres has an astronomic cost per metre however fast it went.
  // Listing all forty-five rows filled the panel with the word "unreachable"
  // sixty-eight times and buried the dozen that CAN be compared — so the table
  // shows the contenders and the rest is stated as the one-line fact it is.
  const shown = table.slice(0, MAX_ROWS);
  const hidden = table.slice(MAX_ROWS);
  const hiddenUnreachable = hidden.filter((t) => t.beRop == null && t.beMeters == null).length;

  /** Cost/m as a function of footage, at each group's own average ROP. */
  const curves = useMemo(() => {
    if (!rows.length) return { data: [] as Record<string, number>[], keys: [] as string[] };
    const maxM = Math.max(...rows.map((r) => r.avgMeters)) * 2 || 1000;
    const keys = rows.slice(0, 6).map((r) => r.iadc);
    const data: Record<string, number>[] = [];
    for (let k = 1; k <= 40; k += 1) {
      const meters = (maxM * k) / 40;
      const row: Record<string, number> = { meters: Math.round(meters) };
      for (const r of rows.slice(0, 6)) {
        const c = costPerMeter({
          bitUsd: r.bitUsd, rigUsdPerHr: rigHr,
          drillHr: r.avgRop > 0 ? meters / r.avgRop : 0,
          tripHr: r.tripHr, meterageM: meters,
        });
        if (c != null && Number.isFinite(c)) row[r.iadc] = Number(c.toFixed(1));
      }
      data.push(row);
    }
    return { data, keys };
  }, [rows, rigHr]);

  if (!rows.length) return null;

  return (
    <div className="border border-gray-200 rounded-lg bg-white p-3 space-y-3">
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span className="text-[11px] font-semibold text-gray-700">Break-even vs best offset</span>
        <label className="flex items-center gap-1.5 text-gray-600">
          <input type="radio" checked={refMode === "best"} onChange={() => setRefMode("best")} />
          best on screen ({best?.iadc} · {best?.costM.toFixed(0)} $/m)
        </label>
        <label className="flex items-center gap-1.5 text-gray-600">
          <input type="radio" checked={refMode === "manual"} onChange={() => setRefMode("manual")} />
          target
          <input type="number" value={manualCost} min={0} step={10}
            onChange={(e) => { setManualCost(Math.max(0, Number(e.target.value) || 0)); setRefMode("manual"); }}
            className="h-6 w-24 px-1 border border-gray-300 rounded tabular-nums" />
          $/m
        </label>
      </div>

      <div className="overflow-x-auto">
        <table className="text-[11px] border-collapse">
          <thead className="text-gray-600">
            <tr>
              <th className="border border-gray-300 px-2 py-0.5 text-left">IADC</th>
              <th className="border border-gray-300 px-2 py-0.5 text-right">Cost/m</th>
              <th className="border border-gray-300 px-2 py-0.5 text-right">Break-even ROP<br /><span className="font-normal text-gray-400">at {`its own metres`}</span></th>
              <th className="border border-gray-300 px-2 py-0.5 text-right">Break-even metres<br /><span className="font-normal text-gray-400">at its own ROP</span></th>
              <th className="border border-gray-300 px-2 py-0.5 text-right">Actual ROP</th>
              <th className="border border-gray-300 px-2 py-0.5 text-right">Actual metres</th>
            </tr>
          </thead>
          <tbody>
            {shown.map(({ r, beRop, beMeters, beats }) => (
              <tr key={r.iadc} className={beats ? "bg-emerald-50" : ""}>
                <td className="border border-gray-300 px-2 py-0.5">
                  {r.iadc} <span className="text-gray-400">{r.bitClass}</span>
                  {beats && <span className="ml-1 text-emerald-700">already beats it</span>}
                </td>
                <td className="border border-gray-300 px-2 py-0.5 text-right tabular-nums">{r.costM.toFixed(0)}</td>
                <td className="border border-gray-300 px-2 py-0.5 text-right tabular-nums">
                  {beRop == null
                    ? <span className="text-gray-400" title="the bit price and trip alone exceed what the reference pays for this footage">unreachable</span>
                    : `${beRop.toFixed(1)} m/hr`}
                </td>
                <td className="border border-gray-300 px-2 py-0.5 text-right tabular-nums">
                  {beMeters == null
                    ? <span className="text-gray-400" title="at this ROP the rig outruns the reference — no footage breaks even">unreachable</span>
                    : `${Math.round(beMeters).toLocaleString()} m`}
                </td>
                <td className="border border-gray-300 px-2 py-0.5 text-right tabular-nums text-gray-500">{r.avgRop.toFixed(1)}</td>
                <td className="border border-gray-300 px-2 py-0.5 text-right tabular-nums text-gray-500">{r.avgMeters.toFixed(0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hidden.length > 0 && (
        <p className="text-[10px] text-gray-500">
          {hidden.length} further group{hidden.length === 1 ? "" : "s"} cost{hidden.length === 1 ? "s" : ""}{" "}
          {hidden[0].r.costM.toFixed(0)}–{hidden[hidden.length - 1].r.costM.toFixed(0)} $/m and{" "}
          {hiddenUnreachable === hidden.length ? "none" : `${hidden.length - hiddenUnreachable} of them`}{" "}
          can reach the reference at any rate. A cost per metre in the thousands almost always means
          a run that made very little hole, not a slow bit — check its meterage in the table above
          before reading it as a bit-selection result.
        </p>
      )}

      {curves.data.length > 0 && (
        <div>
          <div className="text-[10px] text-gray-500 mb-1">
            Cost per metre against footage, each group at its own average ROP. Where a curve crosses
            the dashed reference IS its break-even footage.
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={curves.data} margin={{ top: 4, right: 16, bottom: 20, left: 4 }}>
              <CartesianGrid stroke="#eee" />
              <XAxis dataKey="meters" type="number" tick={{ fontSize: 10 }}
                label={{ value: "Footage (m)", position: "insideBottom", offset: -10, fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} width={62}
                label={{ value: "$/m", angle: -90, position: "insideLeft", fontSize: 10 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <ReferenceLine y={refCost} stroke="#111" strokeDasharray="5 4"
                label={{ value: `reference ${refCost.toFixed(0)} $/m`, fontSize: 9, position: "insideTopRight" }} />
              {curves.keys.map((k, i) => (
                <Line key={k} type="monotone" dataKey={k} name={k} dot={false}
                  stroke={SIZE_COLORS[i % SIZE_COLORS.length]} strokeWidth={1.5} isAnimationActive={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <p className="text-[10px] text-gray-500 leading-relaxed">
        Break-even inverts the cost identity: <b>required ROP</b> asks how fast a bit must drill over
        its own meterage to match the reference, <b>required metres</b> how far it must drill at its
        own ROP. "Unreachable" is a real answer — the bit price and trip alone already cost more than
        the reference pays for that footage. The known blind spot: ranking offsets by cost per metre
        cannot surface a bit type <i>never run</i> in the offsets, which is why the strength-based
        screen in the Strength view is the complement rather than a rival. Source: PetroWiki
        <i> Drill bit economics</i>; OGJ 1994 on the offset-record failure mode.
      </p>
    </div>
  );
}

function AdvisorView({ points, bitSizes }: { points: RopPoint[]; bitSizes: string[] }) {
  const [sizeFilter, setSizeFilter] = useState("");
  const [rigDay, setRigDay] = useState(30000);
  const [tripSpeed, setTripSpeed] = useState(300);
  const [prices, setPrices] = useState<BitPrices>(PRICE_DEFAULTS);
  const [sectionLen, setSectionLen] = useState(1000);
  // composite weights (percent) — cost/m, trip-adj ROP, ROP, meterage, MSE
  // efficiency, and bit-wear rate.
  //
  // `wear` defaults to ZERO on purpose: adding a criterion that silently
  // reshuffles a ranking somebody already trusts is worse than not adding it.
  // Turn it up to let survivability count. Lower wear is better, so it is
  // normalised the same direction as cost.
  const [w, setW] = useState({ cost: 40, trip: 25, rop: 15, meter: 15, mse: 5, wear: 0 });

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
        // Median wear rate over the group's runs that carry BOTH dull rows.
        const wearRates = g.pts
          .map((p) => wearPer100m(wearAvg(p.dullInner, p.dullOuter), p.meters))
          .filter((v): v is number => v != null);
        return { ...g, bitUsd, tripHr, costM, tripRop, win, medWear: median(wearRates), wearN: wearRates.length };
      })
      .filter((r) => Number.isFinite(r.costM));
    if (!cand.length) return [];
    const maxMse = Math.max(...cand.map((c) => c.medMse ?? 0), 1);
    const nCost = normalize(cand.map((c) => c.costM), false);
    const nTrip = normalize(cand.map((c) => c.tripRop), true);
    const nRop = normalize(cand.map((c) => c.avgRop), true);
    const nMeter = normalize(cand.map((c) => c.avgMeters), true);
    const nMse = normalize(cand.map((c) => c.medMse ?? maxMse), false);
    // A group with no graded dull sits at the WORST observed rate rather than at
    // zero: "never graded" must not read as "never wore out" and win the ranking
    // by default.
    const maxWear = Math.max(...cand.map((c) => c.medWear ?? 0), 0);
    const nWear = normalize(cand.map((c) => c.medWear ?? maxWear), false);
    const wsum = w.cost + w.trip + w.rop + w.meter + w.mse + w.wear || 1;
    return cand.map((c, i) => {
      const bits = Math.max(1, Math.ceil(sectionLen / c.avgMeters));
      return {
        ...c,
        score: (w.cost * nCost[i] + w.trip * nTrip[i] + w.rop * nRop[i]
          + w.meter * nMeter[i] + w.mse * nMse[i] + w.wear * nWear[i]) / wsum,
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
        <Weight k="meter" label="Meterage" /><Weight k="mse" label="MSE eff." /><Weight k="wear" label="Wear rate" />
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

/* ══ MODEL — constrained Bourgoyne & Young fit ═══════════════════════════════
 *
 * EXPERIMENTAL, and labelled so on screen. Every other view in this tab reports
 * what happened. This one is the only one that answers "what would happen if I
 * changed something" — which is exactly why it is the one that can be
 * confidently wrong.
 *
 * The model is fitted per formation from ordinary run averages, with f3
 * (undercompaction) and f4 (overbalance) pruned because the archive has neither
 * pore pressure nor ECD. It refuses outright below 15 runs or without real
 * spread in BOTH weight and speed, because a coefficient nobody varied is not
 * estimated, it is invented.
 *
 * On this archive it usually comes back clamped — a5 pinned at its lower bound
 * says run-average ROP barely responds to weight once bits, wells and crews are
 * mixed together. The view says that in plain words rather than drawing a
 * confident surface over it.
 */

const FT_PER_M_UI = 3.28084;

/** One archive point reduced to the model's variables, or null if it can't be. */
function toBymRun(p: RopPoint) {
  if (!(p.rop > 0) || !(p.wob > 0) || !(p.rpm > 0)) return null;
  if (p.diaIn == null || !(p.diaIn > 0)) return null;
  const depthM = midDepth(p);
  if (depthM == null) return null;
  // Jet impact is OPTIONAL, not required. Only about half the archive records
  // nozzles, and dropping every run without them would cost 57% of the data and
  // half the fittable formations. A null here tells the fit to decide whether f8
  // is worth keeping for this selection at all.
  let jetLbf: number | null = null;
  if (p.tfa != null && p.flow != null && p.mudWeight != null) {
    const dPb = nozzlePressureDrop({ tfaIn2: p.tfa, qGpm: p.flow, rhoPpg: p.mudWeight });
    const j = dPb == null ? null : jetImpact({ qGpm: p.flow, rhoPpg: p.mudWeight, dPbPsi: dPb });
    if (j != null && j > 0) jetLbf = j;
  }
  // The IADC inner-row grade is measured at PULL, so it is the wear at the end
  // of the run, not during it. Halving it approximates the run average under
  // linear wear — the same linearity assumption the IADC scale itself rests on.
  // Runs with no dull grade get 0 rather than being dropped: absent wear
  // evidence is not evidence of a worn bit.
  const wear = p.dullInner != null ? Math.min(1, p.dullInner / 8) / 2 : 0;
  return {
    depthFt: depthM * FT_PER_M_UI,
    wPerDb: p.wob / p.diaIn,          // the archive records WOB in klb
    rpm: p.rpm,
    wear,
    jetLbf,
    ropFtHr: mhrToFthr(p.rop),
  };
}

function ModelView({ points, bitSizes }: { points: RopPoint[]; bitSizes: string[] }) {
  const [sizeFilter, setSizeFilter] = useState("");
  const [selForm, setSelForm] = useState("");
  const [rigDay, setRigDay] = useState(45_000);

  const pts = useMemo(
    () => (sizeFilter ? points.filter((p) => p.bitSize === sizeFilter) : points),
    [points, sizeFilter],
  );

  /** Per-formation model inputs, plus what had to be dropped to build them. */
  const groups = useMemo(() => {
    const byF = new Map<string, { label: string; runs: ReturnType<typeof toBymRun>[]; total: number }>();
    for (const p of pts) {
      if (!p.topFormation?.trim()) continue;      // a fit needs a named formation
      const label = p.topFormation.trim();
      const k = label.toLowerCase();
      const e = byF.get(k) ?? { label, runs: [], total: 0 };
      e.total += 1;
      const r = toBymRun(p);
      if (r) e.runs.push(r);
      byF.set(k, e);
    }
    return [...byF.values()]
      .map((g) => ({ ...g, runs: g.runs.filter((r): r is NonNullable<typeof r> => r != null) }))
      .sort((a, b) => b.runs.length - a.runs.length);
  }, [pts]);

  const chosen = useMemo(
    () => groups.find((g) => g.label.toLowerCase() === selForm.toLowerCase()) ?? groups[0] ?? null,
    [groups, selForm],
  );

  const fit = useMemo(() => (chosen ? bymFit(chosen.runs) : null), [chosen]);
  const ok = fit != null && !("ok" in fit) ? (fit as BymFitResult) : null;

  // The response surface at this formation's own median depth, wear and
  // hydraulics — changing WOB and RPM only, which is what a driller can change.
  const surface = useMemo(() => {
    if (!ok || !chosen) return null;
    const med = (get: (r: (typeof chosen.runs)[number]) => number) =>
      median(chosen.runs.map(get)) ?? 0;
    const jets = chosen.runs.map((r) => r.jetLbf).filter((v): v is number => v != null);
    const at = {
      depthFt: med((r) => r.depthFt), wear: med((r) => r.wear),
      jetLbf: ok.usedJet ? median(jets) : null,
    };
    const wob = gridOver(chosen.runs.map((r) => r.wPerDb), 12);
    const rpm = gridOver(chosen.runs.map((r) => r.rpm), 12);
    // Cost per foot at a fixed rig rate, ignoring the bit: the model has no
    // opinion about how a parameter change wears the bit, so pretending it does
    // would be inventing the one number that decides the answer.
    const costOf = (ropFtHr: number) => (ropFtHr > 0 ? rigUsdPerHr(rigDay) / ropFtHr : null);
    const cells = bymSurface(ok.coeffs, at, { wob, rpm }, costOf);
    const usable = cells.filter((c) => c.ropFtHr != null);
    const bestRop = usable.reduce<typeof usable[number] | null>((a, c) => (a == null || c.ropFtHr! > a.ropFtHr! ? c : a), null);
    const bestCost = usable.reduce<typeof usable[number] | null>(
      (a, c) => (c.costPerFt == null ? a : a == null || c.costPerFt < a.costPerFt! ? c : a), null);
    return { at, wob, rpm, cells, bestRop, bestCost };
  }, [ok, chosen, rigDay]);

  const scatter = useMemo(() => {
    if (!ok) return { data: [], lim: 1 };
    const data = ok.points.map((p) => ({
      actual: p.actual / FT_PER_M_UI, predicted: p.predicted / FT_PER_M_UI,
    }));
    const lim = Math.max(...data.flatMap((d) => [d.actual, d.predicted]), 1);
    return { data, lim };
  }, [ok]);

  const dropped = chosen ? chosen.total - chosen.runs.length : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-semibold tracking-wide uppercase">
          Experimental
        </span>
        <SizeFilter value={sizeFilter} onChange={setSizeFilter} bitSizes={bitSizes} total={points.length} />
        <select value={chosen?.label ?? ""} onChange={(e) => setSelForm(e.target.value)}
          className="h-7 px-2 text-xs border border-gray-300 rounded bg-white text-gray-700">
          {groups.map((g) => (
            <option key={g.label} value={g.label}>{g.label} ({g.runs.length})</option>
          ))}
        </select>
        <NumInput label="Rig rate" value={rigDay} onChange={setRigDay} step={1000} suffix="USD/day" />
      </div>

      {!chosen ? (
        <Empty>No named formation in this selection carries the weight, speed, depth and hydraulics the model needs.</Empty>
      ) : fit != null && "ok" in fit ? (
        <Refusal fit={fit} formation={chosen.label} total={chosen.total} usable={chosen.runs.length} />
      ) : ok == null ? (
        <Empty>The fit did not converge on {chosen.label}.</Empty>
      ) : (
        <>
          <div className={`rounded border px-3 py-2 text-[11px] leading-relaxed ${
            ok.reliability === "unreliable" ? "border-red-200 bg-red-50 text-red-900"
              : ok.reliability === "weak" ? "border-amber-200 bg-amber-50 text-amber-900"
              : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>
            <b>{ok.reliability === "unreliable" ? "Unreliable fit" : ok.reliability === "weak" ? "Weak fit" : "Usable fit"}</b>
            {" — "}median error {Math.round(100 * ok.medianAre)}% on {ok.n} runs
            {ok.atBounds.length > 0 && <>, with <b>{ok.atBounds.join(", ")}</b> resting on a published bound</>}.
            {ok.atBounds.length > 0 && (
              <> A coefficient on a bound is a wall, not an estimate: the data wanted to go where the physics envelope
                forbids, and the number shown is where it was stopped.
                {ok.atBounds.includes("a5") && <> Here <b>a5</b> — the weight-on-bit exponent — pinned at its floor,
                  which says run-average ROP in {chosen.label} barely responds to weight once bits, wells and crews are
                  mixed together.</>}
              </>
            )}
            {ok.reliability !== "usable" && <> Read the surface below as a ranking of operating points, never as a
              prediction or a setpoint.</>}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <div className="text-sm font-medium text-gray-700">Fitted vs actual ROP</div>
              <ResponsiveContainer width="100%" height={330}>
                <ScatterChart margin={CHART_MARGIN}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                  <XAxis type="number" dataKey="actual" domain={[0, Math.ceil(scatter.lim)]} tick={{ fontSize: 11 }}
                    label={{ value: "Actual ROP (m/hr)", position: "insideBottom", offset: -18, fontSize: 11 }} />
                  <YAxis type="number" dataKey="predicted" domain={[0, Math.ceil(scatter.lim)]} tick={{ fontSize: 11 }}
                    label={{ value: "Fitted ROP (m/hr)", angle: -90, position: "insideLeft", fontSize: 11 }} />
                  <Tooltip content={<FitTip />} />
                  <Scatter data={scatter.data} fill="#1e40af" fillOpacity={0.5} isAnimationActive={false} />
                  <Scatter data={[{ actual: 0, predicted: 0 }, { actual: scatter.lim, predicted: scatter.lim }]}
                    line={{ stroke: "#9ca3af", strokeDasharray: "4 3" }} shape={() => <g />} isAnimationActive={false} legendType="none" />
                </ScatterChart>
              </ResponsiveContainer>
              <p className="text-[11px] text-gray-500">
                Points on the dashed line are perfectly fitted. Spread above it is the model over-predicting — the runs
                where something the model cannot see (a trip, a bit change, hole trouble) cost time the coefficients
                cannot explain. n = {ok.n}.
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="text-sm font-medium text-gray-700">WOB × RPM response surface</div>
              {surface && <SurfaceGrid surface={surface} />}
              <p className="text-[11px] text-gray-500 leading-relaxed">
                Evaluated at {chosen.label}'s own median depth ({intc(surface ? surface.at.depthFt / FT_PER_M_UI : null)} m),
                wear and jet impact, so only weight and speed move — the two a driller can actually turn. The grid spans
                the parameters this formation was actually drilled at; there is no extrapolation beyond them. Hover any
                cell for its predicted ROP and rig-time cost per metre at {intc(rigDay)} USD/day.
                {ok.usedJet ? "" : " Jet impact is not in this fit, so hydraulics do not move the surface at all."}
            {" "}◆ marks the fastest cell and ★ the cheapest, and on rig time alone they are always the same cell —
                cost is rate ÷ ROP, so it can only be monotone in ROP. Separating them would need a bit-wear response to
                weight and speed, which this model does not have and this view will not invent: whether the fastest
                setpoint is also the cheapest depends entirely on what it does to the bit.
              </p>
            </div>
          </div>

          <details className="text-[11px] text-gray-600">
            <summary className="cursor-pointer text-gray-500 hover:text-gray-700">Fitted coefficients & what was dropped</summary>
            <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1 tabular-nums">
              {([["a1", "formation strength"], ["a2", "compaction"], ["a5", "weight on bit"],
                 ["a6", "rotary speed"], ["a7", "tooth wear"], ["a8", "jet impact"]] as const).map(([k, what]) => (
                <div key={k} className={ok.atBounds.includes(k) ? "text-red-700 font-medium" : ""}>
                  <b>{k}</b> {ok.coeffs[k].toPrecision(3)}
                  <span className="text-gray-400"> · {what}{ok.atBounds.includes(k) ? " · at bound" : ""}</span>
                </div>
              ))}
            </div>
            <ul className="mt-2 space-y-0.5 list-disc list-inside">
              <li>f3 (undercompaction) and f4 (overbalance) are always pruned: the archive carries neither pore pressure nor ECD.</li>
              <li>
                f8 (jet impact) {ok.usedJet
                  ? <>is fitted — {Math.round(100 * ok.jetCoverage)}% of these runs carry nozzle, flow and mud-weight records.</>
                  : <>is pruned too: only {Math.round(100 * ok.jetCoverage)}% of these runs record nozzles, and fitting a jet
                    term on that minority would not add information, it would fit the same model to a biased subset. a8 is
                    held at zero and its effect is absorbed into a1.</>}
              </li>
              <li>WOB spread P90/P10 = {ok.spread.wob?.toFixed(1)}×, RPM = {ok.spread.rpm?.toFixed(1)}× (both must clear {BYM_MIN_SPREAD}×).</li>
              <li>{dropped} of {chosen.total} {chosen.label} runs dropped for missing nozzle/flow/mud-weight hydraulics or depth.</li>
              <li>Fitted by bounded multi-start pattern search on mean absolute <i>relative</i> error, not R² — R² on ROP is
                dominated by the fast runs, and the slow ones are where the money is.</li>
            </ul>
          </details>
        </>
      )}
    </div>
  );
}

/** Why the model declined to fit — always specific, never a shrug. */
function Refusal({ fit, formation, total, usable }: {
  fit: { reason: string; n?: number; spread?: number | null };
  formation: string; total: number; usable: number;
}) {
  return (
    <div className="rounded border border-gray-200 bg-gray-50 px-3 py-3 text-[12px] text-gray-700 leading-relaxed">
      <b>No fit for {formation}.</b>{" "}
      {fit.reason === "too-few-runs" ? (
        <>Only {usable} of its {total} runs carry every variable the model needs — it takes {BYM_MIN_RUNS}.
          Below that, six coefficients would be fitted through too few points to constrain them.</>
      ) : (
        <>Weight and speed need a P90/P10 spread of {BYM_MIN_SPREAD}× before the model can tell them apart; this
          selection has {fit.spread?.toFixed(2) ?? "—"}× on {fit.reason === "no-wob-spread" ? "weight" : "speed"}.
          The search would still return a coefficient — whichever bound it drifted to — with a respectable-looking
          error, and the surface would then recommend changing a parameter nobody here ever varied.</>
      )}
    </div>
  );
}

function FitTip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as { actual: number; predicted: number };
  const err = p.actual > 0 ? (100 * (p.predicted - p.actual)) / p.actual : null;
  return (
    <div className="px-2 py-1 rounded bg-gray-900 text-white text-[11px] leading-tight shadow-lg">
      <div>Actual: {fmt1(p.actual)} m/hr</div>
      <div>Fitted: {fmt1(p.predicted)} m/hr</div>
      {err != null && <div className="text-gray-300">{err > 0 ? "+" : ""}{err.toFixed(0)}%</div>}
    </div>
  );
}

/** The WOB × RPM grid, coloured by ROP, with the fastest and cheapest cells marked. */
function SurfaceGrid({ surface }: {
  surface: {
    wob: number[]; rpm: number[];
    cells: { wPerDb: number; rpm: number; ropFtHr: number | null; costPerFt: number | null }[];
    bestRop: { wPerDb: number; rpm: number } | null;
    bestCost: { wPerDb: number; rpm: number } | null;
  };
}) {
  const rops = surface.cells.map((c) => c.ropFtHr).filter((v): v is number => v != null);
  if (!rops.length) return <Empty>Nothing in the observed parameter range is predictable.</Empty>;
  const lo = Math.min(...rops), hi = Math.max(...rops);
  const at = (w: number, r: number) => surface.cells.find((c) => c.wPerDb === w && c.rpm === r);
  const same = (a: { wPerDb: number; rpm: number } | null, w: number, r: number) =>
    a != null && a.wPerDb === w && a.rpm === r;

  return (
    <div className="overflow-x-auto">
      <table className="text-[10px] border-separate" style={{ borderSpacing: 1 }}>
        <thead>
          <tr>
            <th className="text-right pr-1 font-normal text-gray-400">klb/in ↓ rpm →</th>
            {surface.rpm.map((r) => (
              <th key={r} className="font-normal text-gray-500 px-0.5">{Math.round(r)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...surface.wob].reverse().map((w) => (
            <tr key={w}>
              <td className="text-right pr-1 text-gray-500 tabular-nums">{w.toFixed(2)}</td>
              {surface.rpm.map((r) => {
                const c = at(w, r);
                const rop = c?.ropFtHr ?? null;
                const t = rop == null ? 0 : (rop - lo) / (hi - lo || 1);
                // When rig time is the only cost, the cheapest cell IS the
                // fastest one — cost is rate ÷ ROP, monotone in ROP. Drawing two
                // separate markers would dress one finding up as two, so the
                // coincidence is shown as one glyph and named in the caption.
                const isRop = same(surface.bestRop, w, r);
                const isCost = same(surface.bestCost, w, r);
                const mark = isRop && isCost ? "◆★" : isCost ? "★" : isRop ? "◆" : "";
                return (
                  <td key={r} className="w-6 h-5 text-center align-middle"
                    style={{ background: rop == null ? "#f3f4f6" : ropColor(t), color: t > 0.6 ? "#fff" : "#111827" }}
                    title={rop == null ? "outside the model's domain"
                      : `${(rop / FT_PER_M_UI).toFixed(1)} m/hr at ${w.toFixed(2)} klb/in, ${Math.round(r)} rpm${
                          c?.costPerFt != null ? ` · ${Math.round(c.costPerFt * FT_PER_M_UI)} USD/m rig time` : ""}`}>
                    {mark}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
