/**
 * Previews of the two charted completion reports — 25 (Cost of Failure by Type)
 * and 27 (Production & Maintenance History).
 *
 * 25 is the same stacked shape as report 15, over failures instead of interval
 * problems, so it reuses that report's reading: an unclassified failure is its
 * own bar labelled "(blank)" rather than folded into "Other", because folding
 * it would claim somebody made a judgement they did not.
 *
 * 27 plots rate against time, which is the one plot in this suite whose X axis
 * is a DATE rather than a depth or a day count — production is read against the
 * calendar, not against the well.
 */
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { headerValue, money } from "../../export/reportChrome.js";
import type {
  FailureCostCell, ProductionRow, Report25Payload, Report27Payload,
} from "../../entry/wellview.js";
import {
  HeaderGrid, IdentityLine, PreviewFooter, PreviewSheet, PreviewTable, PreviewTitle,
  SectionBar, type PreviewColumn,
} from "./ReportPreview.js";
import { WellSetBlock } from "./MultiWellPreview.js";

/** The exporters find these charts by these ids. */
export const FAILURE_CHART_ID = "wellview-failure-cost";
export const PRODUCTION_CHART_ID = "wellview-production-curve";

/** One colour per failure type, stable across the stack. */
const STACK_COLOURS = [
  "#1d4ed8", "#b45309", "#047857", "#7c3aed", "#be123c",
  "#0891b2", "#a16207", "#4d7c0f", "#9333ea", "#dc2626",
];

/* ══ report 25 ═══════════════════════════════════════════════════════════════ */

const CELL_COLUMNS: PreviewColumn<FailureCostCell>[] = [
  { header: "Well", width: "w-48", cell: (c) => c.well },
  { header: "Failure Type", width: "w-32", cell: (c) => c.failureType },
  { header: "Failures", width: "w-24", align: "right", cell: (c) => headerValue(c.count, "int") },
  { header: "Cost", width: "w-32", align: "right", cell: (c) => money(c.cost) },
];

export function Report25Preview({ payload }: { payload: Report25Payload }) {
  // Pivoted into Recharts' stacked shape: one row per well, one key per type.
  // A type that did not occur on a well is left undefined rather than 0 — a
  // zero-height segment still claims a legend entry and a tooltip line.
  const data = payload.wellTotals.map((w) => {
    const row: Record<string, string | number> = { well: w.well };
    for (const c of payload.cells) if (c.well === w.well) row[c.failureType] = c.cost;
    return row;
  });

  return (
    <PreviewSheet wide>
      <PreviewTitle>{payload.title}</PreviewTitle>
      <WellSetBlock wells={payload.wells} dropped={payload.droppedWells} />

      <SectionBar>Cost of Failure by Type</SectionBar>
      {payload.wellTotals.length === 0 ? (
        <div className="bg-white border border-gray-400 border-t-0 px-2 py-4 text-[11px] text-gray-400">
          No equipment failure recorded on these wells. Failures are entered under
          Well data → Completion.
        </div>
      ) : (
        <div id={FAILURE_CHART_ID} className="bg-white border border-gray-400 border-t-0 p-2">
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={data} margin={{ top: 4, right: 12, bottom: 18, left: 0 }}>
              <CartesianGrid stroke="#e5e7eb" vertical={false} />
              <XAxis
                dataKey="well" tick={{ fontSize: 10 }} interval={0}
                label={{ value: "Well", position: "insideBottom", offset: -2, fontSize: 10 }}
              />
              <YAxis
                tick={{ fontSize: 10 }} width={78}
                label={{ value: "Cost of failure", angle: -90, position: "insideLeft", fontSize: 10 }}
              />
              <Tooltip formatter={(v: number | string) => money(Number(v))} />
              <Legend verticalAlign="top" height={payload.failureTypes.length > 4 ? 38 : 20} wrapperStyle={{ fontSize: 10 }} />
              {payload.failureTypes.map((t, i) => (
                <Bar
                  key={t} dataKey={t} name={t} stackId="cost"
                  fill={STACK_COLOURS[i % STACK_COLOURS.length]} maxBarSize={110}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <SectionBar>Failures, by well and type</SectionBar>
      <PreviewTable columns={CELL_COLUMNS} rows={payload.cells} emptyText="Nothing to pivot." />
      <HeaderGrid rows={[payload.totals]} />
      <div className="border border-t-0 border-gray-400 px-2 py-1 text-[11px] text-gray-500 leading-snug">
        An unclassified failure is its own bar, labelled &ldquo;(blank)&rdquo; as the sample labels
        it — folding it into &ldquo;Other&rdquo; would claim somebody made a judgement they did not.
      </div>
      <PreviewFooter printedOn={payload.printedOn} />
    </PreviewSheet>
  );
}

/* ══ report 27 ═══════════════════════════════════════════════════════════════ */

const PRODUCTION_COLUMNS: PreviewColumn<ProductionRow>[] = [
  { header: "Start Date", width: "w-28", cell: (r) => r.startDate ?? "" },
  { header: "End Date", width: "w-28", cell: (r) => r.endDate ?? "" },
  { header: "Prod Time (days)", width: "w-28", align: "right", cell: (r) => headerValue(r.prodTimeDays) },
  { header: "DownTm (days)", width: "w-28", align: "right", cell: (r) => headerValue(r.downTimeDays) },
  { header: "Vol ResGas (MCF)", width: "w-32", align: "right", cell: (r) => headerValue(r.volResGasMcf) },
  { header: "Vol Oil (bbl)", width: "w-28", align: "right", cell: (r) => headerValue(r.volOilBbl) },
  { header: "Vol Water (bbl)", width: "w-32", align: "right", cell: (r) => headerValue(r.volWaterBbl) },
  { header: "Q Reservoir Gas (MCF/day)", width: "w-32", align: "right", cell: (r) => headerValue(r.qResGasMcfD) },
  { header: "Q Oil (bbl/day)", width: "w-28", align: "right", cell: (r) => headerValue(r.qOilBblD) },
  { header: "Q Water (bbl/day)", width: "w-32", align: "right", cell: (r) => headerValue(r.qWaterBblD) },
  { header: "Water Gas Ratio (%)", width: "w-28", align: "right", cell: (r) => headerValue(r.waterGasRatioPct) },
];

export function Report27Preview({ payload }: { payload: Report27Payload }) {
  return (
    <PreviewSheet wide>
      <PreviewTitle>{payload.title}</PreviewTitle>
      {payload.filterLine && (
        <div className="text-right text-[11px] text-gray-700 mb-0.5">{payload.filterLine}</div>
      )}
      <IdentityLine wellName={payload.wellName} />
      <HeaderGrid rows={payload.header} />

      <SectionBar>Rate against time</SectionBar>
      {payload.curve.length === 0 ? (
        <div className="bg-white border border-gray-400 border-t-0 px-2 py-4 text-[11px] text-gray-400">
          No production period recorded — enter them under Well data → Completion.
        </div>
      ) : (
        <div id={PRODUCTION_CHART_ID} className="bg-white border border-gray-400 border-t-0 p-2">
          <ResponsiveContainer width="100%" height={320}>
            {/* The one plot in this suite whose X axis is a DATE: production is
                read against the calendar, not against the well. */}
            <LineChart data={payload.curve} margin={{ top: 4, right: 12, bottom: 18, left: 0 }}>
              <CartesianGrid stroke="#e5e7eb" />
              <XAxis
                dataKey="endDate" tick={{ fontSize: 9 }} interval="preserveStartEnd"
                label={{ value: "Period end date", position: "insideBottom", offset: -2, fontSize: 10 }}
              />
              <YAxis
                yAxisId="liquid" tick={{ fontSize: 10 }} width={72}
                label={{ value: "Rate oil / water (bbl/day)", angle: -90, position: "insideLeft", fontSize: 10 }}
              />
              {/* Gas gets its OWN axis: in MCF/day it is an order of magnitude
                  from the liquid rates, and one shared scale would flatten the
                  oil decline this report exists to show. */}
              <YAxis
                yAxisId="gas" orientation="right" tick={{ fontSize: 10 }} width={72}
                label={{ value: "Rate reservoir gas (MCF/day)", angle: 90, position: "insideRight", fontSize: 10 }}
              />
              <Tooltip formatter={(v: number | string) => headerValue(Number(v))} />
              <Legend verticalAlign="top" height={20} wrapperStyle={{ fontSize: 10 }} />
              <Line yAxisId="liquid" type="linear" dataKey="qOilBblD" name="Rate oil" stroke="#047857" dot={{ r: 2 }} isAnimationActive={false} />
              <Line yAxisId="liquid" type="linear" dataKey="qWaterBblD" name="Rate water" stroke="#0891b2" dot={{ r: 2 }} isAnimationActive={false} />
              <Line yAxisId="gas" type="linear" dataKey="qResGasMcfD" name="Rate reservoir gas" stroke="#b45309" dot={{ r: 2 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <SectionBar>Summarized Production Data (Most Recent at Top)</SectionBar>
      <PreviewTable
        columns={PRODUCTION_COLUMNS}
        rows={payload.rows}
        emptyText="No production period recorded."
      />
      <HeaderGrid rows={[payload.totals]} />
      <PreviewFooter printedOn={payload.printedOn} />
    </PreviewSheet>
  );
}
