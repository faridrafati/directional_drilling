/**
 * Report 21 — the Geological Schematic.
 *
 * The sample is a composite log: parallel depth-indexed tracks reading down one
 * shared scale — survey columns, the wellbore section, formation and lithology
 * bands, the mud in the hole, and the drilling parameters. The picture is only
 * meaningful because every track is on the SAME depth axis, which is why the
 * scale is computed once here and handed to each of them.
 *
 * The categorical tracks are drawn as SVG bands rather than as a chart: a
 * lithology or a mud system is an interval with a name, not a value, and a
 * chart axis would have to invent a number for it.
 */
import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { headerValue } from "../../export/reportChrome.js";
import type {
  ParameterPoint, Report21Payload, SchematicBand, SchematicStation,
} from "../../entry/wellview.js";
import {
  HeaderGrid, IdentityLine, PreviewFooter, PreviewSheet, PreviewTable, PreviewTitle,
  SectionBar, type PreviewColumn,
} from "./ReportPreview.js";
import { SchematicLegend, WellboreSchematic, schematicScale } from "./WellboreSchematic.js";

/** The exporter finds report 21's parameter plot by this. */
export const PARAM_TRACK_ID = "wellview-21-params";

const TRACK_HEIGHT = 460;

/** Muted fills for a categorical track, cycled by the value's own name. */
const BAND_FILLS = [
  "#e0f2fe", "#fef3c7", "#dcfce7", "#fae8ff", "#ffe4e6",
  "#e0e7ff", "#ccfbf1", "#ffedd5", "#f1f5f9", "#fef9c3",
];

/**
 * A categorical depth track.
 *
 * Colour is keyed on the LABEL, not on the row's position, so the same mud
 * system or lithology is the same colour everywhere it appears — a track where
 * "Limestone" changes colour every time it recurs is a decoration, not a log.
 */
function BandTrack({ title, bands, maxDepthMkb, width = 130 }: {
  title: string;
  bands: SchematicBand[];
  maxDepthMkb: number | null;
  width?: number;
}) {
  const scale = schematicScale(maxDepthMkb, TRACK_HEIGHT);
  const names = [...new Set(bands.map((b) => b.label ?? ""))];
  return (
    <div className="shrink-0">
      <div className="text-[9px] font-semibold uppercase tracking-wide text-gray-500 px-1 pb-0.5">
        {title}
      </div>
      <svg width={width} height={TRACK_HEIGHT} className="border border-gray-300 bg-white">
        {bands.map((b, i) => {
          const y1 = scale.yOf(b.topMkb);
          const y2 = scale.yOf(b.btmMkb);
          const h = Math.max(1, y2 - y1);
          return (
            <g key={i}>
              <rect
                x={0} y={y1} width={width} height={h}
                fill={BAND_FILLS[names.indexOf(b.label ?? "") % BAND_FILLS.length]}
                stroke="#d1d5db" strokeWidth={0.5}
              />
              {h > 10 && (
                <text x={3} y={y1 + Math.min(11, h / 2 + 3)} fontSize={7} fill="#374151">
                  {(b.label ?? "").slice(0, 18)}
                </text>
              )}
            </g>
          );
        })}
        {bands.length === 0 && (
          <text x={4} y={14} fontSize={7.5} fill="#9ca3af">nothing recorded</text>
        )}
      </svg>
    </div>
  );
}

const STATION_COLUMNS: PreviewColumn<SchematicStation>[] = [
  { header: "MD (mKB)", width: "w-28", align: "right", cell: (s) => headerValue(s.md) },
  { header: "TVD (mKB)", width: "w-28", align: "right", cell: (s) => headerValue(s.tvd) },
  { header: "Incl (°)", width: "w-24", align: "right", cell: (s) => headerValue(s.inc) },
  { header: "DLS (°/30m)", width: "w-28", align: "right", cell: (s) => headerValue(s.dls) },
];

export function Report21Preview({ payload }: { payload: Report21Payload }) {
  const params: ParameterPoint[] = payload.parameters;

  return (
    <PreviewSheet wide>
      <PreviewTitle>{payload.title}</PreviewTitle>
      <IdentityLine wellName={payload.wellName} />
      <HeaderGrid rows={payload.header} />
      {payload.caption && (
        <div className="text-[11px] text-gray-700 py-0.5">{payload.caption}</div>
      )}

      {/* The composite: every track on ONE depth scale, side by side. */}
      <SectionBar>Vertical schematic (actual)</SectionBar>
      <div className="border border-gray-400 border-t-0 bg-white p-2 flex gap-2 overflow-x-auto">
        <WellboreSchematic
          payload={payload.schematic} reportType="21"
          width={330} height={TRACK_HEIGHT} showFormations
        />
        <BandTrack title="Eval — Litho" bands={payload.lithology} maxDepthMkb={payload.schematic.maxDepthMkb} />
        <BandTrack title="Mud" bands={payload.mud} maxDepthMkb={payload.schematic.maxDepthMkb} />
      </div>
      <SchematicLegend />

      <SectionBar>Drill parameters against depth</SectionBar>
      {params.length === 0 ? (
        <div className="bg-white border border-gray-400 border-t-0 px-2 py-4 text-[11px] text-gray-400">
          No drilled interval carries a parameter reading.
        </div>
      ) : (
        <div id={PARAM_TRACK_ID} className="bg-white border border-gray-400 border-t-0 p-2">
          <ResponsiveContainer width="100%" height={340}>
            {/* Depth DOWN the Y axis, the readings across — the same orientation
                as the schematic beside it, so the two can be read together. */}
            <LineChart data={params} margin={{ top: 4, right: 16, bottom: 18, left: 0 }}>
              <CartesianGrid stroke="#e5e7eb" />
              <XAxis
                type="number" tick={{ fontSize: 10 }}
                label={{ value: "Reading", position: "insideBottom", offset: -2, fontSize: 10 }}
              />
              <YAxis
                type="number" dataKey="depthMkb" reversed tick={{ fontSize: 10 }} width={72}
                domain={["dataMin", "dataMax"]}
                label={{ value: "Depth (mKB)", angle: -90, position: "insideLeft", fontSize: 10 }}
              />
              <Tooltip formatter={(v: number | string) => headerValue(Number(v))} />
              <Legend verticalAlign="top" height={20} wrapperStyle={{ fontSize: 10 }} />
              <Line type="linear" dataKey="densPpg" name="Mud dens (ppg)" stroke="#0891b2" dot={false} connectNulls isAnimationActive={false} />
              <Line type="linear" dataKey="intRopMHr" name="Int ROP (m/hr)" stroke="#1d4ed8" dot={false} connectNulls isAnimationActive={false} />
              <Line type="linear" dataKey="rpm" name="Bit RPM" stroke="#b45309" dot={false} connectNulls isAnimationActive={false} />
              <Line type="linear" dataKey="wob1000Lbf" name="WOB (1000lbf)" stroke="#047857" dot={false} connectNulls isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="border border-t-0 border-gray-400 px-2 py-1 text-[11px] text-gray-500 leading-snug">
        Q Flow is left off this plot on purpose: at 700–1,100 gpm it is two orders of magnitude above
        WOB and ROP, and one shared axis would flatten the other three curves into the floor.
      </div>

      <SectionBar>Survey stations</SectionBar>
      <PreviewTable
        columns={STATION_COLUMNS}
        rows={payload.stations}
        emptyText="No survey on this well — stations are entered on the daily sheet."
      />

      <HeaderGrid rows={[payload.totals]} />
      <PreviewFooter printedOn={payload.printedOn} />
    </PreviewSheet>
  );
}
