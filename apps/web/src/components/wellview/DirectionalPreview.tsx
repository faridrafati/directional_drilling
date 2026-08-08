/**
 * On-screen preview of report 08 — Directional Plot, Plan vs Actual.
 *
 * Two live Recharts surfaces, each carrying both curves:
 *
 *   • VERTICAL SECTION — VS across, TVD down (the axis is REVERSED: depth grows
 *     downward, which is the whole convention of a drilling plot);
 *   • PLAN — EW across, NS up, looking straight down the hole.
 *
 * Both are LIVE charts, not pictures: the PDF export rasterizes these very
 * SVGs, so each is wrapped in a div carrying a stable id and the exporter throws
 * rather than printing a blank panel when one is not mounted.
 *
 * A station missing the offset a panel needs is dropped from THAT panel only —
 * `connectNulls` is off, so the curve breaks where the data does instead of
 * running a straight line through a gap the surveys never measured.
 */
import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { headerValue } from "../../export/reportChrome.js";
import type { PlotStation, Report08Payload } from "../../entry/wellview.js";
import {
  HeaderGrid, IdentityLine, PreviewFooter, PreviewSheet, PreviewTable, PreviewTitle,
  SectionBar, type PreviewColumn,
} from "./ReportPreview.js";

/** The exporter looks the plots up by these — keep them in step with `../export/wellview/directional.ts`. */
export const VS_CHART_ID = "wellview-vs-plot";
export const PLAN_CHART_ID = "wellview-plan-plot";

/** One plotted point. Each series carries its OWN array — see `series()`. */
interface XY { x: number; y: number }

/**
 * Recharts is given each line its own `data` array rather than one merged one.
 *
 * A merged array needs a single X key, and the plan and the actual do not share
 * X values — interleaving them into rows where each series fills only its own
 * keys leaves every row missing the axis key for the other series, so one curve
 * silently disappears. Per-series `data` is the supported way to plot two lines
 * whose X values differ.
 */
function series(points: PlotStation[], xKey: "vs" | "ew", yKey: "tvd" | "ns"): XY[] {
  return points
    .filter((p) => p[xKey] !== null && p[yKey] !== null)
    .map((p) => ({ x: p[xKey] as number, y: p[yKey] as number }));
}

/**
 * A domain both series fit inside, rounded outward to a round number.
 *
 * Left to `dataMin`/`dataMax` Recharts prints the extreme VALUE as the last
 * tick — "1319.7" beside 0, 350, 700 — which reads as a data label rather than
 * a scale. Rounding out gives ticks a surveyor would recognise.
 */
function niceDomain(values: number[]): [number, number] {
  if (values.length === 0) return [0, 1];
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  if (lo === hi) return [lo - 1, hi + 1];
  const step = Math.pow(10, Math.floor(Math.log10(hi - lo))) / 2;
  return [Math.floor(lo / step) * step, Math.ceil(hi / step) * step];
}

const STATION_COLUMNS: PreviewColumn<PlotStation & { source: string }>[] = [
  { header: "Source", width: "w-16", cell: (s) => s.source },
  { header: "MD (mKB)", width: "w-24", align: "right", cell: (s) => headerValue(s.md) },
  { header: "Inc (°)", width: "w-20", align: "right", cell: (s) => headerValue(s.inc) },
  { header: "Azi (°)", width: "w-20", align: "right", cell: (s) => headerValue(s.azi) },
  { header: "TVD (mKB)", width: "w-24", align: "right", cell: (s) => headerValue(s.tvd) },
  { header: "NS (m)", width: "w-24", align: "right", cell: (s) => headerValue(s.ns) },
  { header: "EW (m)", width: "w-24", align: "right", cell: (s) => headerValue(s.ew) },
  { header: "VS (m)", width: "w-24", align: "right", cell: (s) => headerValue(s.vs) },
  { header: "Note", cell: (s) => s.comment ?? s.date ?? "" },
];

export function Report08Preview({ payload }: { payload: Report08Payload }) {
  const planVs = series(payload.plan, "vs", "tvd");
  const actualVs = series(payload.actual, "vs", "tvd");
  const planNs = series(payload.plan, "ew", "ns");
  const actualNs = series(payload.actual, "ew", "ns");
  // Both curves share one scale per panel, so a short actual beside a long plan
  // reads as short rather than being stretched to fill the axis.
  const vsX = niceDomain([...planVs, ...actualVs].map((p) => p.x));
  const vsY = niceDomain([...planVs, ...actualVs].map((p) => p.y));
  const planX = niceDomain([...planNs, ...actualNs].map((p) => p.x));
  const planY = niceDomain([...planNs, ...actualNs].map((p) => p.y));
  const stations = [
    ...payload.plan.map((p) => ({ ...p, source: "Plan" })),
    ...payload.actual.map((p) => ({ ...p, source: "Actual" })),
  ];

  return (
    <PreviewSheet wide>
      <PreviewTitle>{payload.title}</PreviewTitle>
      <IdentityLine wellName={payload.wellName} />
      <HeaderGrid rows={payload.header} />

      {payload.planMissing && (
        <div className="border border-t-0 border-gray-400 bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
          No directional plan is recorded for this well, so only the actual curve is drawn. Enter the
          plan listing under Well data → Well registers → Directional plan to compare against it.
        </div>
      )}

      <SectionBar>Vertical Section</SectionBar>
      <div id={VS_CHART_ID} className="bg-white border border-gray-400 border-t-0 p-2">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart margin={{ top: 4, right: 16, bottom: 18, left: 0 }}>
            <CartesianGrid stroke="#e5e7eb" />
            <XAxis
              type="number" dataKey="x" tick={{ fontSize: 10 }} domain={vsX}
              label={{ value: "VS (m)", position: "insideBottom", offset: -2, fontSize: 10 }}
            />
            {/* Depth grows DOWNWARD. */}
            <YAxis
              reversed type="number" dataKey="y" tick={{ fontSize: 10 }} width={64} domain={vsY}
              label={{ value: "TVD (mKB)", angle: -90, position: "insideLeft", fontSize: 10 }}
            />
            <Tooltip formatter={(v: number | string) => headerValue(Number(v))} />
            <Legend verticalAlign="top" height={20} wrapperStyle={{ fontSize: 10 }} />
            <Line
              data={planVs} type="linear" dataKey="y" name="Plan" stroke="#60a5fa"
              strokeDasharray="5 3" dot={{ r: 2 }} isAnimationActive={false}
            />
            <Line
              data={actualVs} type="linear" dataKey="y" name="Actual" stroke="#1d4ed8"
              strokeWidth={2} dot={{ r: 2.5 }} isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <SectionBar>Plan</SectionBar>
      <div id={PLAN_CHART_ID} className="bg-white border border-gray-400 border-t-0 p-2">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart margin={{ top: 4, right: 16, bottom: 18, left: 0 }}>
            <CartesianGrid stroke="#e5e7eb" />
            <XAxis
              type="number" dataKey="x" tick={{ fontSize: 10 }} domain={planX}
              label={{ value: "EW (m)", position: "insideBottom", offset: -2, fontSize: 10 }}
            />
            {/* NOT reversed: a plan view is looked at from above, north up. */}
            <YAxis
              type="number" dataKey="y" tick={{ fontSize: 10 }} width={64} domain={planY}
              label={{ value: "NS (m)", angle: -90, position: "insideLeft", fontSize: 10 }}
            />
            <Tooltip formatter={(v: number | string) => headerValue(Number(v))} />
            <Legend verticalAlign="top" height={20} wrapperStyle={{ fontSize: 10 }} />
            <Line
              data={planNs} type="linear" dataKey="y" name="Plan" stroke="#60a5fa"
              strokeDasharray="5 3" dot={{ r: 2 }} isAnimationActive={false}
            />
            <Line
              data={actualNs} type="linear" dataKey="y" name="Actual" stroke="#1d4ed8"
              strokeWidth={2} dot={{ r: 2.5 }} isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <HeaderGrid rows={[payload.extents]} />

      <SectionBar>Stations</SectionBar>
      <PreviewTable
        columns={STATION_COLUMNS}
        rows={stations}
        emptyText="No station on this well — enter the plan under Well registers, and the surveys on the daily sheets."
      />

      <PreviewFooter printedOn={payload.printedOn} />
    </PreviewSheet>
  );
}
