/**
 * On-screen previews of reports 10 (Phases — Plan vs Actual) and 11 (Phase
 * Summary Graph).
 *
 * Both carry a chart, and both charts are LIVE Recharts surfaces rather than
 * pictures: the PDF export rasterizes the very SVG on screen, the way the
 * directional-plot export already does. That is why each chart is wrapped in a
 * div carrying a stable id — the exporter finds it by that id, and throws a
 * user-facing error rather than emitting a blank page if it is not mounted.
 */
import {
  Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import { headerValue, money } from "../../export/reportChrome.js";
import type { PhaseRow, Report10Payload, Report11Payload } from "../../entry/wellview.js";
import {
  HeaderGrid, IdentityLine, PreviewFooter, PreviewSheet, PreviewTable, PreviewTitle,
  SectionBar, type PreviewColumn,
} from "./ReportPreview.js";

/** The exporter looks the charts up by these — keep them in step with `../export/wellview/phases.ts`. */
export const PHASE_CHART_ID = "wellview-phase-chart";
export const PHASE_BAR_CHART_ID = "wellview-phase-bars";

const PHASE_COLUMNS: PreviewColumn<PhaseRow>[] = [
  { header: "Phase Type 1", width: "w-32", cell: (p) => p.phaseType1 ?? "" },
  { header: "Phase Type 2", width: "w-40", cell: (p) => p.phaseType2 ?? "" },
  { header: "Planned Start Depth (mKB)", width: "w-24", align: "right", cell: (p) => headerValue(p.plannedStartDepth) },
  { header: "Planned End Depth (mKB)", width: "w-24", align: "right", cell: (p) => headerValue(p.plannedEndDepth) },
  { header: "Dur ML (days)", width: "w-20", align: "right", cell: (p) => headerValue(p.durMlDays) },
  { header: "Pl Cum Days ML (days)", width: "w-20", align: "right", cell: (p) => headerValue(p.cumDurMlDays) },
  { header: "Planned Likely Phase Cost (Cost)", width: "w-28", align: "right", cell: (p) => money(p.plannedCost) },
  { header: "Pl Cum Cost ML (Cost)", width: "w-28", align: "right", cell: (p) => money(p.cumPlannedCost) },
  { header: "Plan Cost/Depth (Cost/m)", width: "w-24", align: "right", cell: (p) => headerValue(p.planCostPerDepth) },
  { header: "Actual Start Date", width: "w-32", cell: (p) => p.actualStartDate ?? "" },
  { header: "Actual End Date", width: "w-32", cell: (p) => p.actualEndDate ?? "" },
  { header: "Actual Dur (days)", width: "w-20", align: "right", cell: (p) => headerValue(p.actualDurDays) },
  { header: "Act Cum Dur (days)", width: "w-20", align: "right", cell: (p) => headerValue(p.cumActualDurDays) },
  { header: "Actual Start Depth (mKB)", width: "w-24", align: "right", cell: (p) => headerValue(p.actualStartDepth) },
  { header: "End Depth (mKB)", width: "w-24", align: "right", cell: (p) => headerValue(p.actualEndDepth) },
  { header: "Actual Phase Field Est (Cost)", width: "w-28", align: "right", cell: (p) => money(p.actualCost) },
  { header: "Actual Phase Cum Field Est (Cost)", width: "w-28", align: "right", cell: (p) => money(p.cumActualCost) },
  { header: "Cost/Depth (Cost/m)", width: "w-24", align: "right", cell: (p) => headerValue(p.costPerDepth) },
];

export function Report10Preview({ payload }: { payload: Report10Payload }) {
  // Both day axes must span the same range or the two curves would be drawn on
  // different scales and read as if the plan and the actual met where they do
  // not. The end of whichever ran longer sets it.
  const maxDays = payload.chart.reduce(
    (m, p) => Math.max(m, p.days ?? 0, p.planDays ?? 0, p.planDaysMin ?? 0, p.planDaysMax ?? 0), 0,
  ) || 1;
  // The envelope is only drawn when a plan actually carries a range; a plan with
  // a most-likely value alone keeps the original four-series chart.
  const hasEnvelope = payload.chart.some(
    (p) => p.planDaysMin != null || p.planDaysMax != null
      || p.plannedCumCostMin != null || p.plannedCumCostMax != null,
  );
  return (
    <PreviewSheet>
      <PreviewTitle>{payload.title}</PreviewTitle>
      <IdentityLine wellName={payload.wellName} />
      <HeaderGrid rows={[payload.jobHeader]} />

      <SectionBar>Phases</SectionBar>
      <PreviewTable
        columns={PHASE_COLUMNS}
        rows={payload.phases}
        emptyText="No phase recorded on this job — add them under Well data → Phases."
      />
      <HeaderGrid rows={[payload.totals]} />

      <SectionBar>Depth and cost against days</SectionBar>
      <div id={PHASE_CHART_ID} className="bg-white border border-gray-400 border-t-0 p-2">
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={payload.chart} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
            <CartesianGrid stroke="#e5e7eb" />
            {/* TWO day axes over one shared range: the actual series are plotted
                against elapsed days, the planned ones against PLANNED days.
                Sharing a single axis silently drew the plan at the actual's
                positions, which makes a late job look on schedule. */}
            <XAxis
              xAxisId="actual" type="number" dataKey="days" domain={[0, maxDays]}
              tick={{ fontSize: 10 }} label={{ value: "Days", position: "insideBottom", offset: -2, fontSize: 10 }}
            />
            <XAxis xAxisId="plan" type="number" dataKey="planDays" domain={[0, maxDays]} hide />
            {/* The min and max plans reach each depth on their OWN day, so each
                bound needs its own day axis for the same reason the likely plan
                does — sharing one would draw the band at the wrong days. */}
            <XAxis xAxisId="planMin" type="number" dataKey="planDaysMin" domain={[0, maxDays]} hide />
            <XAxis xAxisId="planMax" type="number" dataKey="planDaysMax" domain={[0, maxDays]} hide />
            {/* Depth grows DOWNWARD on a drilling plot — the reversed axis is
                the whole convention, not a styling choice. */}
            <YAxis
              yAxisId="depth" reversed tick={{ fontSize: 10 }} width={62}
              label={{ value: "Depth (mKB)", angle: -90, position: "insideLeft", fontSize: 10 }}
            />
            <YAxis
              yAxisId="cost" orientation="right" tick={{ fontSize: 10 }} width={72}
              label={{ value: "Cost", angle: 90, position: "insideRight", fontSize: 10 }}
            />
            <Tooltip formatter={(v: number | string) => headerValue(Number(v))} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Line xAxisId="actual" yAxisId="depth" type="linear" dataKey="actualEndDepth" name="Actual days vs end depth" stroke="#1d4ed8" dot={{ r: 2 }} />
            <Line xAxisId="plan" yAxisId="depth" type="linear" dataKey="plannedEndDepth" name="Planned days vs planned end depth" stroke="#60a5fa" strokeDasharray="4 3" dot={{ r: 2 }} />
            <Line xAxisId="actual" yAxisId="cost" type="linear" dataKey="actualCumCost" name="Actual cum field est" stroke="#b45309" dot={{ r: 2 }} />
            <Line xAxisId="plan" yAxisId="cost" type="linear" dataKey="plannedCumCost" name="Planned cum phase cost" stroke="#fbbf24" strokeDasharray="4 3" dot={{ r: 2 }} />
            {/* §4.5: "review the minimum, maximum and ML curves for depth and
                cost versus days". The min/max bounds carry the colours Chevron's
                own Days-vs-Depth templates assign them — min red, max magenta —
                drawn thin so the likely case stays the readable line. */}
            {hasEnvelope && (
              <>
                <Line xAxisId="planMin" yAxisId="depth" type="linear" dataKey="plannedEndDepth"
                  name="Planned min days vs planned end depth" stroke="#ff3333" strokeWidth={1}
                  strokeDasharray="2 3" dot={false} connectNulls />
                <Line xAxisId="planMax" yAxisId="depth" type="linear" dataKey="plannedEndDepth"
                  name="Planned max days vs planned end depth" stroke="#ff00ff" strokeWidth={1}
                  strokeDasharray="2 3" dot={false} connectNulls />
                <Line xAxisId="planMin" yAxisId="cost" type="linear" dataKey="plannedCumCostMin"
                  name="Planned min cum phase cost" stroke="#ff3333" strokeWidth={1}
                  strokeDasharray="1 3" dot={false} connectNulls />
                <Line xAxisId="planMax" yAxisId="cost" type="linear" dataKey="plannedCumCostMax"
                  name="Planned max cum phase cost" stroke="#ff00ff" strokeWidth={1}
                  strokeDasharray="1 3" dot={false} connectNulls />
              </>
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <PreviewFooter printedOn={payload.printedOn} />
    </PreviewSheet>
  );
}

export function Report11Preview({ payload }: { payload: Report11Payload }) {
  return (
    <PreviewSheet>
      <PreviewTitle>{payload.title}</PreviewTitle>
      <IdentityLine wellName={payload.wellName} />
      <HeaderGrid rows={[payload.wellRow]} />
      <HeaderGrid rows={[payload.jobRow]} />
      <HeaderGrid rows={[payload.planRow]} />

      <SectionBar>Duration and cost by phase</SectionBar>
      <div id={PHASE_BAR_CHART_ID} className="bg-white border border-gray-400 border-t-0 p-2">
        <ResponsiveContainer width="100%" height={360}>
          {/* No manual bottom margin: Recharts already reserves space for the
              angled tick labels and for the legend, and adding one on top
              pushed the legend up THROUGH the labels. */}
          <BarChart data={payload.bars} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="#e5e7eb" vertical={false} />
            <XAxis
              dataKey="shortLabel" tick={{ fontSize: 9 }} interval={0}
              angle={-30} textAnchor="end" height={92}
            />
            <YAxis
              yAxisId="days" tick={{ fontSize: 10 }} width={56}
              label={{ value: "Duration (days)", angle: -90, position: "insideLeft", fontSize: 10 }}
            />
            <YAxis
              yAxisId="cost" orientation="right" tick={{ fontSize: 10 }} width={72}
              label={{ value: "Cost", angle: 90, position: "insideRight", fontSize: 10 }}
            />
            {/* The tooltip names the phase in full; the axis has room only for
                its second type. */}
            <Tooltip
              formatter={(v: number | string) => headerValue(Number(v))}
              labelFormatter={(_l, p) => (p?.[0]?.payload as { label?: string } | undefined)?.label ?? ""}
            />
            <Legend verticalAlign="bottom" height={24} wrapperStyle={{ fontSize: 10 }} />
            <Bar yAxisId="days" dataKey="plannedDurDays" name="Planned likely duration" fill="#93c5fd" />
            <Bar yAxisId="days" dataKey="actualDurDays" name="Actual duration" fill="#1d4ed8" />
            <Bar yAxisId="cost" dataKey="plannedCost" name="Planned likely cost" fill="#fcd34d" />
            <Bar yAxisId="cost" dataKey="actualCost" name="Actual field est" fill="#b45309" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <PreviewFooter printedOn={payload.printedOn} />
    </PreviewSheet>
  );
}
