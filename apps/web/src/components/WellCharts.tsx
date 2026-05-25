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
 */
import { useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceDot, Label, Scatter, ScatterChart,
} from "recharts";
import type { StationRow } from "../api/client.js";

interface Props {
  stations: StationRow[];
}

export function VerticalSectionChart({ stations }: Props) {
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
  if (data.length < 2) return <Empty label="Vertical Section" />;
  const tip = data[data.length - 1];
  return (
    <div className="bg-white border border-gray-200 rounded p-4 h-[500px]">
      <h3 className="text-sm font-medium text-gray-700 mb-2">Vertical Section (VSEC × TVD)</h3>
      <ResponsiveContainer width="100%" height="90%">
        <LineChart data={data} margin={{ top: 10, right: 30, left: 30, bottom: 30 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="vsec" type="number" stroke="#475569" fontSize={12}>
            <Label value="Vertical Section" position="bottom" offset={10} fill="#475569" />
          </XAxis>
          <YAxis dataKey="tvd" type="number" reversed stroke="#475569" fontSize={12}>
            <Label
              value="TVD"
              position="insideLeft"
              angle={-90}
              offset={-15}
              fill="#475569"
            />
          </YAxis>
          <Tooltip
            formatter={(v: number) => v.toFixed(2)}
            labelFormatter={(_, payload) => payload?.[0]?.payload?.comment ?? ""}
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
}

export function PlanViewChart({ stations }: Props) {
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
  if (data.length < 2) return <Empty label="Plan View" />;
  const tip = data[data.length - 1];
  return (
    <div className="bg-white border border-gray-200 rounded p-4 h-[500px]">
      <h3 className="text-sm font-medium text-gray-700 mb-2">Plan View (EW × NS)</h3>
      <ResponsiveContainer width="100%" height="90%">
        <ScatterChart margin={{ top: 10, right: 30, left: 30, bottom: 30 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="ew" type="number" stroke="#475569" fontSize={12}>
            <Label value="East-West" position="bottom" offset={10} fill="#475569" />
          </XAxis>
          <YAxis dataKey="ns" type="number" stroke="#475569" fontSize={12}>
            <Label
              value="North-South"
              position="insideLeft"
              angle={-90}
              offset={-15}
              fill="#475569"
            />
          </YAxis>
          <Tooltip
            formatter={(v: number) => v.toFixed(2)}
            labelFormatter={(_, payload) => payload?.[0]?.payload?.comment ?? ""}
          />
          <Scatter
            data={data}
            line={{ stroke: "#1e40af", strokeWidth: 2 }}
            lineType="joint"
            shape={() => <></>}
            isAnimationActive={false}
          />
          <ReferenceDot x={tip.ew} y={tip.ns} r={5} fill="#dc2626" stroke="#fff" />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded h-[500px] grid place-items-center text-sm text-gray-400">
      {label}: calculate the trajectory to see the chart.
    </div>
  );
}
