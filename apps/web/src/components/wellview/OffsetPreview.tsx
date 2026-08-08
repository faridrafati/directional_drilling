/**
 * On-screen previews of reports 12 (Daily Drilling Summary 2) and 14 (Drilling
 * Offsets).
 *
 * 12 is a stack of condensed per-well blocks — report 06 for a fleet, with
 * everything that does not survive being read six times over stripped out. A
 * well with no day still gets a block, saying so: a missing well reads as "not
 * drilling", an absent one reads as nothing, and the difference matters when the
 * list is what you check against.
 *
 * 14 is five plots of the same well set, one series per well. All five are LIVE
 * Recharts surfaces the PDF export rasterizes, so each carries a stable id built
 * from its plot key.
 */
import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { headerValue } from "../../export/reportChrome.js";
import type {
  MultiTimeLogRow, OffsetPlot, Report12Payload, Report14Payload, WellDayBlock,
} from "../../entry/wellview.js";
import {
  HeaderGrid, PreviewFooter, PreviewSheet, PreviewTable, PreviewTitle,
  SectionBar, type PreviewColumn,
} from "./ReportPreview.js";
import { WellSetBlock } from "./MultiWellPreview.js";

/** The exporter finds each offset plot by this — one id per plot key. */
export const offsetPlotId = (key: OffsetPlot["key"]) => `wellview-offset-${key}`;

/* ══ report 12 ═══════════════════════════════════════════════════════════════ */

const TIME_LOG_COLUMNS: PreviewColumn<MultiTimeLogRow>[] = [
  { header: "Start Date", width: "w-36", cell: (t) => t.startDate },
  { header: "Dur (hr)", width: "w-20", align: "right", cell: (t) => headerValue(t.durHr) },
  { header: "Cum Dur (hr)", width: "w-24", align: "right", cell: (t) => headerValue(t.cumDurHr) },
  { header: "End Date", width: "w-36", cell: (t) => t.endDate },
  { header: "Code 1", width: "w-20", cell: (t) => t.code1 ?? "" },
  { header: "Code 2", width: "w-24", cell: (t) => t.code2 ?? "" },
  { header: "Com", cell: (t) => t.com ?? "" },
];

function DayBlock({ block }: { block: WellDayBlock }) {
  return (
    <div className="mb-3">
      <SectionBar>{block.rigName ?? "Rig"}</SectionBar>
      <HeaderGrid rows={[block.identity]} />
      {block.noDay ? (
        <div className="border border-t-0 border-gray-400 px-2 py-2 text-[11px] text-gray-500">
          {block.noDay}
        </div>
      ) : (
        <>
          <HeaderGrid rows={block.figures} />
          <HeaderGrid rows={[[{ label: "Daily Contacts", value: block.dailyContacts }]]} />
          <HeaderGrid rows={[[{ label: "Operations Summary", value: block.operationsSummary }]]} />
          <HeaderGrid rows={[[{ label: "Operations Next Report Period", value: block.operationsNextPeriod }]]} />
          <SectionBar>Time Log</SectionBar>
          <PreviewTable
            columns={TIME_LOG_COLUMNS}
            rows={block.timeLog}
            emptyText="No interval logged on this day."
          />
        </>
      )}
    </div>
  );
}

export function Report12Preview({ payload }: { payload: Report12Payload }) {
  return (
    <PreviewSheet wide>
      <PreviewTitle>{payload.title}</PreviewTitle>
      <div className="text-[11px] text-gray-500 mb-2">
        {payload.asOf
          ? `Each well's newest day on or before ${payload.asOf}.`
          : "Each well's newest day. Wells are not on the same date — a fleet summary answers "
            + "“where is each of my wells”, and a well that filed nothing yesterday still has a "
            + "last known position."}
      </div>
      {payload.droppedWells > 0 && (
        <div className="border border-gray-400 bg-amber-50 px-2 py-1 mb-2 text-[11px] text-amber-800">
          {payload.droppedWells} requested well{payload.droppedWells === 1 ? " is" : "s are"} not
          shown — this account is not assigned to {payload.droppedWells === 1 ? "it" : "them"}.
        </div>
      )}
      {payload.blocks.map((b) => <DayBlock key={b.wellId} block={b} />)}
      <PreviewFooter printedOn={payload.printedOn} />
    </PreviewSheet>
  );
}

/* ══ report 14 ═══════════════════════════════════════════════════════════════ */

/** One colour per well, stable across all five plots so a curve is followable. */
const WELL_COLOURS = [
  "#1d4ed8", "#b45309", "#047857", "#7c3aed", "#be123c",
  "#0891b2", "#a16207", "#4d7c0f", "#9333ea", "#dc2626",
];

/** Round a span outward, so ticks read as a scale rather than as data labels. */
function niceDomain(values: number[]): [number, number] {
  if (values.length === 0) return [0, 1];
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  if (lo === hi) return [lo === 0 ? 0 : lo * 0.9, hi === 0 ? 1 : hi * 1.1];
  const step = Math.pow(10, Math.floor(Math.log10(hi - lo))) / 2;
  return [Math.floor(lo / step) * step, Math.ceil(hi / step) * step];
}

function Plot({ plot, wellIndex }: {
  plot: OffsetPlot;
  wellIndex: (wellId: string) => number;
}) {
  if (plot.emptyReason) {
    return (
      <>
        <SectionBar>{plot.title}</SectionBar>
        <div className="bg-white border border-gray-400 border-t-0 px-2 py-4 text-[11px] text-gray-400">
          {plot.emptyReason}
        </div>
      </>
    );
  }
  const all = plot.series.flatMap((s) => s.points);
  const xDomain = niceDomain(all.map((p) => p.x));
  const yDomain = niceDomain(all.map((p) => p.y));

  return (
    <>
      <SectionBar>{plot.title}</SectionBar>
      <div id={offsetPlotId(plot.key)} className="bg-white border border-gray-400 border-t-0 p-2">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart margin={{ top: 4, right: 16, bottom: 18, left: 0 }}>
            <CartesianGrid stroke="#e5e7eb" />
            <XAxis
              type="number" dataKey="x" tick={{ fontSize: 10 }} domain={xDomain}
              label={{ value: plot.xLabel, position: "insideBottom", offset: -2, fontSize: 10 }}
            />
            <YAxis
              type="number" dataKey="y" tick={{ fontSize: 10 }} width={76}
              domain={yDomain} reversed={plot.yReversed}
              label={{ value: plot.yLabel, angle: -90, position: "insideLeft", fontSize: 10 }}
            />
            <Tooltip formatter={(v: number | string) => headerValue(Number(v))} />
            {/* Above the plot: Recharts positions an `insideBottom` axis label
                against the chart box, so a bottom legend lands on the caption. */}
            <Legend verticalAlign="top" height={20} wrapperStyle={{ fontSize: 10 }} />
            {plot.series.map((s) => (
              <Line
                key={s.wellId} data={s.points} type="linear" dataKey="y" name={s.wellName}
                stroke={WELL_COLOURS[wellIndex(s.wellId) % WELL_COLOURS.length]}
                dot={{ r: 2 }} isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

export function Report14Preview({ payload }: { payload: Report14Payload }) {
  // The colour is keyed on the WELL, not on the series' position in a plot: a
  // well missing from plot 2 would otherwise shift every colour after it, and
  // the same well would be blue on one page and orange on the next.
  const order = new Map(payload.wells.map((w, i) => [w.id, i]));
  const wellIndex = (id: string) => order.get(id) ?? 0;

  return (
    <PreviewSheet wide>
      <PreviewTitle>{payload.title}</PreviewTitle>
      <WellSetBlock wells={payload.wells} dropped={payload.droppedWells} />
      {payload.plots.map((p) => <Plot key={p.key} plot={p} wellIndex={wellIndex} />)}
      <HeaderGrid rows={[payload.totals]} />
      <PreviewFooter printedOn={payload.printedOn} />
    </PreviewSheet>
  );
}
