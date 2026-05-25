/**
 * Vertical Section + Plan View charts.
 *
 * Port of old_delphi_code/Unit10.pas (Form10) — `Chart1` (VSEC × TVD) and
 * `Chart2` (EW × NS), built with TeeChart in the original, recharts here.
 *
 * Conventions:
 *   - Vertical-section X axis = horizontal departure along the well's azimuth
 *     (we fall back to sqrt(ew² + ns²) when no `vsec` field is set, mirroring
 *     the Pascal default).
 *   - Y axis (TVD) is reversed so the well goes downward visually.
 *   - Plan view: EW on X, NS on Y, equal-aspect ratio.
 *
 * Hover behaviour: each chart has a right-hand `StationDetailsPanel` that
 * shows the full attribute set (MD, Inc, Azm, TVD, VSEC, NS, EW, DLS, TF,
 * BR, TR, DMD) for whichever station the cursor is over — matching the
 * 3D viewer's click-to-inspect panel so the user gets one consistent
 * inspector across all three views.
 */
import React, { useMemo, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceDot, Label,
} from "recharts";
import type { StationRow } from "../api/client.js";
import { StationDetailsPanel, type StationDetails } from "./StationDetailsPanel.js";

interface Props {
  stations: StationRow[];
  /** Length unit for the project, e.g. "ft" / "m" / "km". Shown in axis
   *  labels, headers, and tooltips. Default "ft". */
  lengthUnit?: string;
  /** Fired whenever the cursor's nearest station changes (null on leave).
   *  Used by the Charts tab to drive ONE shared details panel for both
   *  charts instead of one each. */
  onHover?: (point: StationDetails | null) => void;
  /** When false, suppress the chart's own right-hand details panel —
   *  expected when the parent renders a shared one. Default true. */
  showDetailsPanel?: boolean;
}

/** Append a unit suffix in parens if non-empty. "TVD" + "ft" → "TVD (ft)". */
function withUnit(label: string, unit?: string): string {
  return unit && unit.trim() ? `${label} (${unit})` : label;
}

/**
 * Compact "X = …, Y = …, [comment]" tooltip used by both charts. Recharts'
 * default Tooltip only renders the `dataKey` series, so the X-axis value is
 * dropped — useful for the side panel but unhelpful as a hover preview.
 * We render a custom card via Tooltip's `content` slot to show BOTH axes.
 */
function CustomTooltip({
  xLabel, yLabel, xKey, yKey, unit,
}: {
  xLabel: string; yLabel: string;
  xKey: string; yKey: string;
  unit: string;
}) {
  return function Renderer({ active, payload }: {
    active?: boolean;
    payload?: Array<{ payload?: Record<string, unknown> }>;
  }) {
    if (!active || !payload?.length) return null;
    const row = payload[0]?.payload as Record<string, unknown> | undefined;
    if (!row) return null;
    const x = typeof row[xKey] === "number" ? (row[xKey] as number).toFixed(2) : "—";
    const y = typeof row[yKey] === "number" ? (row[yKey] as number).toFixed(2) : "—";
    const comment = typeof row.comment === "string" ? row.comment : "";
    return (
      <div className="bg-white/95 border border-gray-300 rounded shadow px-2 py-1.5 text-xs">
        {comment && <div className="font-medium text-gray-800 mb-0.5">{comment}</div>}
        <div className="text-gray-700"><span className="text-gray-500">{xLabel}:</span> {x} {unit}</div>
        <div className="text-gray-700"><span className="text-gray-500">{yLabel}:</span> {y} {unit}</div>
      </div>
    );
  };
}

/** Convert a StationRow into the panel-ready shape. */
function toDetails(s: StationRow): StationDetails {
  return {
    label: s.comment || `MD ${s.md.toFixed(1)}`,
    comment: s.comment ?? "",
    kind: "station",
    md: s.md, inc: s.inc, azm: s.azm, tvd: s.tvd, vsec: s.vsec,
    ns: s.ns, ew: s.ew, dls: s.dls, tf: s.tf,
    br: s.br, tr: s.tr, dmd: s.dmd,
  };
}

export function VerticalSectionChart({
  stations, lengthUnit = "ft", onHover, showDetailsPanel = true,
}: Props) {
  const data = useMemo(
    () =>
      stations.map((s, i) => ({
        i,
        vsec: s.vsec !== 0 ? s.vsec : Math.sqrt(s.ew * s.ew + s.ns * s.ns),
        tvd: s.tvd,
        comment: s.comment,
      })),
    [stations]
  );

  // Recharts emits state.activePayload[0].payload on every mouse move over
  // the plot area. We resolve the data index back to the source station
  // (our `data` rows carry an `i` field for this) and feed it to the
  // side panel (or hoist to the parent via onHover).
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const hovered: StationDetails | null = hoverIdx !== null && stations[hoverIdx]
    ? toDetails(stations[hoverIdx])
    : null;
  // Notify the parent on every hover transition (after render).
  React.useEffect(() => { onHover?.(hovered); }, [hovered, onHover]);

  if (data.length < 2) return <Empty label="Vertical Section" />;
  const tip = data[data.length - 1];
  const chartCard = (
    <div className="flex-1 bg-white border border-gray-200 rounded p-4 h-[500px] min-w-0">
      <h3 className="text-sm font-medium text-gray-700 mb-2">
        Vertical Section — {withUnit("VSEC", lengthUnit)} × {withUnit("TVD", lengthUnit)}
      </h3>
      <ResponsiveContainer width="100%" height="90%">
        <LineChart
          data={data}
          margin={{ top: 10, right: 30, left: 30, bottom: 30 }}
          onMouseMove={(state) => {
            const idx = (state?.activePayload?.[0]?.payload as { i?: number } | undefined)?.i;
            setHoverIdx(typeof idx === "number" ? idx : null);
          }}
          onMouseLeave={() => setHoverIdx(null)}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="vsec" type="number" stroke="#475569" fontSize={12}>
            <Label value={withUnit("Vertical Section", lengthUnit)} position="bottom" offset={10} fill="#475569" />
          </XAxis>
          <YAxis dataKey="tvd" type="number" reversed stroke="#475569" fontSize={12}>
            <Label
              value={withUnit("TVD", lengthUnit)}
              position="insideLeft"
              angle={-90}
              offset={-15}
              fill="#475569"
            />
          </YAxis>
          <Tooltip
            content={CustomTooltip({
              xLabel: "VSEC", yLabel: "TVD",
              xKey: "vsec", yKey: "tvd",
              unit: lengthUnit,
            })}
          />
          <Line
            type="monotone"
            dataKey="tvd"
            stroke="#1e40af"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          <ReferenceDot x={tip.vsec} y={tip.tvd} r={5} fill="#dc2626" stroke="#fff" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );

  // When the parent renders its own shared details panel, return just the
  // chart card — the parent handles the panel layout.
  if (!showDetailsPanel) return chartCard;

  return (
    <div className="flex gap-3">
      {chartCard}
      <StationDetailsPanel
        point={hovered}
        lengthUnit={lengthUnit}
        emptyState={<HoverHint chart="Vertical Section" lengthUnit={lengthUnit} stationCount={stations.length} />}
      />
    </div>
  );
}

export function PlanViewChart({
  stations, lengthUnit = "ft", onHover, showDetailsPanel = true,
}: Props) {
  const data = useMemo(
    () =>
      stations.map((s, i) => ({
        i,
        ew: s.ew,
        ns: s.ns,
        comment: s.comment,
      })),
    [stations]
  );

  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const hovered: StationDetails | null = hoverIdx !== null && stations[hoverIdx]
    ? toDetails(stations[hoverIdx])
    : null;
  React.useEffect(() => { onHover?.(hovered); }, [hovered, onHover]);

  if (data.length < 2) return <Empty label="Plan View" />;
  const tip = data[data.length - 1];
  const chartCard = (
    <div className="flex-1 bg-white border border-gray-200 rounded p-4 h-[500px] min-w-0">
      <h3 className="text-sm font-medium text-gray-700 mb-2">
        Plan View — {withUnit("EW", lengthUnit)} × {withUnit("NS", lengthUnit)}
      </h3>
      <ResponsiveContainer width="100%" height="90%">
        {/* LineChart (not ScatterChart) — same as Vertical Section. Recharts
            ScatterChart needs visible shapes to detect hover; with the
            shapes hidden the activePayload never fires. LineChart triggers
            hover anywhere along the X range, matching VSEC's behavior. */}
        <LineChart
          data={data}
          margin={{ top: 10, right: 30, left: 30, bottom: 30 }}
          onMouseMove={(state) => {
            const idx = (state?.activePayload?.[0]?.payload as { i?: number } | undefined)?.i;
            setHoverIdx(typeof idx === "number" ? idx : null);
          }}
          onMouseLeave={() => setHoverIdx(null)}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="ew" type="number" stroke="#475569" fontSize={12}>
            <Label value={withUnit("East-West", lengthUnit)} position="bottom" offset={10} fill="#475569" />
          </XAxis>
          <YAxis dataKey="ns" type="number" stroke="#475569" fontSize={12}>
            <Label
              value={withUnit("North-South", lengthUnit)}
              position="insideLeft"
              angle={-90}
              offset={-15}
              fill="#475569"
            />
          </YAxis>
          <Tooltip
            content={CustomTooltip({
              xLabel: "EW", yLabel: "NS",
              xKey: "ew", yKey: "ns",
              unit: lengthUnit,
            })}
          />
          <Line
            type="linear"
            dataKey="ns"
            stroke="#1e40af"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          <ReferenceDot x={tip.ew} y={tip.ns} r={5} fill="#dc2626" stroke="#fff" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );

  if (!showDetailsPanel) return chartCard;

  return (
    <div className="flex gap-3">
      {chartCard}
      <StationDetailsPanel
        point={hovered}
        lengthUnit={lengthUnit}
        emptyState={<HoverHint chart="Plan View" lengthUnit={lengthUnit} stationCount={stations.length} />}
      />
    </div>
  );
}

function HoverHint({
  chart, lengthUnit, stationCount,
}: { chart: string; lengthUnit: string; stationCount: number }) {
  return (
    <>
      <h3 className="text-sm font-semibold text-gray-900">{chart}</h3>
      <p className="text-gray-500">
        Hover anywhere on the chart to inspect a station's MD / Inc / Azm /
        TVD / VSEC / NS / EW / DLS / TF / BR / TR / DMD here.
      </p>
      <p className="pt-2 text-[11px] text-gray-400 italic">
        {stationCount} station{stationCount === 1 ? "" : "s"} on this trajectory.
        Distances in {lengthUnit}.
      </p>
    </>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded h-[500px] grid place-items-center text-sm text-gray-400">
      {label}: calculate the trajectory to see the chart.
    </div>
  );
}
