/**
 * On-screen preview of report 09 — Drilling Summary 1.
 *
 * Four live Recharts panels, laid out as the sample lays them out: three
 * horizontal breakdowns down the right, and the depth-and-cost progress curve
 * beneath them.
 *
 * The three breakdowns are HORIZONTAL bars (`layout="vertical"` in Recharts'
 * naming, which means the value axis is the X one). That is not a style choice:
 * their categories are long text — "Directional Drilling Services", "Casing/
 * Tubing Crew and Tools" — and on a vertical bar chart those labels have to be
 * rotated to fit, which is exactly what the sample avoids by turning the bars.
 *
 * Every panel is captured by the PDF export from the SVG rendered here, so each
 * carries a stable id and the exporter throws rather than printing a hole.
 */
import {
  Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { headerValue, money } from "../../export/reportChrome.js";
import type { BreakdownBar, Report09Payload } from "../../entry/wellview.js";
import {
  HeaderGrid, IdentityLine, PreviewFooter, PreviewSheet, PreviewTitle, SectionBar,
} from "./ReportPreview.js";

/** Ids the exporter finds the four panels by. */
export const TIME_PANEL_ID = "wellview-summary-time";
export const COST_PANEL_ID = "wellview-summary-cost";
export const NPT_PANEL_ID = "wellview-summary-npt";
export const PROGRESS_PANEL_ID = "wellview-summary-progress";

/**
 * A category axis label has to fit the gutter. Truncating in the RENDERER
 * rather than the assembler keeps the payload honest — the PDF, the tooltip and
 * any future export all still carry the full name.
 */
const short = (s: string, max = 26) => (s.length <= max ? s : `${s.slice(0, max - 1)}…`);

/** Height grows with the bar count so a 20-row breakdown is not 20 hairlines. */
const panelHeight = (rows: number) => Math.max(140, Math.min(420, rows * 18 + 56));

function EmptyPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-400 border-t-0 px-2 py-4 text-[11px] text-gray-400">
      {children}
    </div>
  );
}

/** One horizontal breakdown panel — the shape all three of them share. */
function BreakdownPanel({ id, bars, axisLabel, valueKind, empty }: {
  id: string;
  bars: BreakdownBar[];
  axisLabel: string;
  /** "percent" plots the share; "value" plots the raw quantity. */
  valueKind: "percent" | "value";
  empty: string;
}) {
  if (bars.length === 0) return <EmptyPanel>{empty}</EmptyPanel>;
  const data = bars.map((b) => ({
    ...b,
    shortLabel: short(b.label),
    plotted: valueKind === "percent" ? (b.percent ?? 0) : b.value,
  }));
  return (
    <div id={id} className="bg-white border border-gray-400 border-t-0 p-2">
      <ResponsiveContainer width="100%" height={panelHeight(bars.length)}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 16, left: 4 }}>
          <CartesianGrid stroke="#e5e7eb" horizontal={false} />
          <XAxis
            type="number" tick={{ fontSize: 9 }}
            label={{ value: axisLabel, position: "insideBottom", offset: -8, fontSize: 10 }}
          />
          <YAxis
            type="category" dataKey="shortLabel" tick={{ fontSize: 9 }} width={168} interval={0}
          />
          {/* The tooltip names the category in FULL — the axis has only the gutter. */}
          <Tooltip
            formatter={(v: number | string) => (valueKind === "percent" ? `${headerValue(Number(v))} %` : money(Number(v)))}
            labelFormatter={(_l, p) => (p?.[0]?.payload as { label?: string } | undefined)?.label ?? ""}
          />
          <Bar dataKey="plotted" name={axisLabel} fill="#1d4ed8" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Report09Preview({ payload }: { payload: Report09Payload }) {
  return (
    <PreviewSheet wide>
      <PreviewTitle>{payload.title}</PreviewTitle>
      <IdentityLine wellName={payload.wellName} />
      <HeaderGrid rows={payload.header} />
      <HeaderGrid rows={[payload.jobRow]} />

      <SectionBar>Time Breakdown by Code 1 — Code 1 vs % Total Time (sorted)</SectionBar>
      <BreakdownPanel
        id={TIME_PANEL_ID} bars={payload.timeByCode} axisLabel="% Total Time (%)"
        valueKind="percent"
        empty="No time logged on this job's days — the panel needs the daily time breakdown, coded by its Main Operation letter."
      />

      <SectionBar>Cost Breakdown by Des — Field Est by cost description</SectionBar>
      <BreakdownPanel
        id={COST_PANEL_ID} bars={payload.costByDes} axisLabel="Field Est (Cost)"
        valueKind="value"
        empty="No field estimate on this job's cost sheet."
      />

      <SectionBar>NPT by Des — Unscheduled Type vs % Total Time (sorted)</SectionBar>
      <BreakdownPanel
        id={NPT_PANEL_ID} bars={payload.nptByDes} axisLabel="% Total Time (%)"
        valueKind="percent"
        empty="No unscheduled time recorded — the panel adds up the daily Interval Problems' estimated lost time, by problem type."
      />

      <SectionBar>Depth and Cost vs Days</SectionBar>
      {payload.progress.length === 0 ? (
        <EmptyPanel>No day filed against this job yet.</EmptyPanel>
      ) : (
        <div id={PROGRESS_PANEL_ID} className="bg-white border border-gray-400 border-t-0 p-2">
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={payload.progress} margin={{ top: 4, right: 12, bottom: 18, left: 0 }}>
              <CartesianGrid stroke="#e5e7eb" />
              <XAxis
                type="number" dataKey="jobDay" tick={{ fontSize: 10 }}
                domain={["dataMin", "dataMax"]}
                label={{ value: "Job Day (days)", position: "insideBottom", offset: -2, fontSize: 10 }}
              />
              {/* Depth grows downward, as on every other plot in this suite. */}
              <YAxis
                yAxisId="depth" reversed tick={{ fontSize: 10 }} width={64}
                label={{ value: "End Depth (mKB)", angle: -90, position: "insideLeft", fontSize: 10 }}
              />
              <YAxis
                yAxisId="cost" orientation="right" tick={{ fontSize: 10 }} width={78}
                label={{ value: "Cum Field Est To Date (Cost)", angle: 90, position: "insideRight", fontSize: 10 }}
              />
              <Tooltip
                formatter={(v: number | string) => headerValue(Number(v))}
                labelFormatter={(l, p) => {
                  const d = (p?.[0]?.payload as { date?: string } | undefined)?.date;
                  return d ? `Day ${l} · ${d}` : `Day ${l}`;
                }}
              />
              {/* Above the plot: Recharts positions an `insideBottom` axis label
                  against the chart box rather than the plot area, so a bottom
                  legend and "Job Day (days)" land on the same line. */}
              <Legend verticalAlign="top" height={20} wrapperStyle={{ fontSize: 10 }} />
              <Line
                yAxisId="depth" type="linear" dataKey="endDepth" name="Job Day vs End Depth"
                stroke="#1d4ed8" dot={{ r: 2 }} connectNulls={false} isAnimationActive={false}
              />
              <Line
                yAxisId="cost" type="linear" dataKey="cumFieldEst" name="Job Day vs Cum Field Est To Date"
                stroke="#b45309" dot={{ r: 2 }} connectNulls={false} isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="border border-t-0 border-gray-400 px-2 py-1 text-[11px] text-gray-500 italic">
        The sample also prints a directional wellbore schematic down its left column. It is not drawn
        yet — the shared schematic component arrives with the geological and completion reports.
      </div>

      <PreviewFooter printedOn={payload.printedOn} />
    </PreviewSheet>
  );
}
