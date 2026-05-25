/**
 * Cross-section chart along an arbitrary A→B line on a grid.
 * Replaces old_delphi_code/Unit21.pas:cross + Form31 chart popup.
 */
import { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Label } from "recharts";
import { gridFromBytes, type GrdFile } from "@dd/grd";
import { sampleLine } from "@dd/grd/sample";
import type { GridApiResponse } from "./MapViewer2D.js";

interface Props {
  grid: GridApiResponse;
  a: { ns: number; ew: number };
  b: { ns: number; ew: number };
  steps?: number;
}

export function CrossSection({ grid: api, a, b, steps = 200 }: Props) {
  const grid: GrdFile = useMemo(() => {
    const bin = atob(api.data);
    const bytes = new Uint8Array(bin.length);
    for (let k = 0; k < bin.length; k++) bytes[k] = bin.charCodeAt(k);
    return gridFromBytes(
      {
        errorValue: api.errorVal, xmin: api.xmin, xmax: api.xmax, ymin: api.ymin, ymax: api.ymax,
        xinc: api.xinc, yinc: api.yinc, ncol: api.ncol, nrow: api.nrow, units: api.units,
      },
      bytes
    );
  }, [api]);

  const samples = useMemo(
    () => sampleLine(grid, { x: a.ew, y: a.ns }, { x: b.ew, y: b.ns }, steps),
    [grid, a, b, steps]
  );

  const data = useMemo(
    () =>
      samples
        .filter((s) => s.value !== null)
        .map((s) => ({ s: s.s, value: s.value as number })),
    [samples]
  );

  if (data.length < 2) {
    return (
      <div className="bg-white border border-gray-200 rounded h-[400px] grid place-items-center text-sm text-gray-400">
        Cross-section line crosses no valid grid cells. Pick a different line.
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded p-4 h-[420px]">
      <div className="text-sm font-medium text-gray-700 mb-2">
        Cross-section A → B
        <span className="ml-3 text-xs text-gray-500">
          {data.length} valid samples · distance{" "}
          {(samples[samples.length - 1].s - samples[0].s).toFixed(1)} {api.units}
        </span>
      </div>
      <ResponsiveContainer width="100%" height="88%">
        <LineChart data={data} margin={{ top: 10, right: 30, left: 30, bottom: 30 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="s" type="number" stroke="#475569" fontSize={12}>
            <Label
              value={`Distance from A (${api.units})`}
              position="bottom"
              offset={10}
              fill="#475569"
            />
          </XAxis>
          <YAxis dataKey="value" type="number" reversed stroke="#475569" fontSize={12}>
            <Label
              value={`Depth (${api.units})`}
              position="insideLeft"
              angle={-90}
              offset={-15}
              fill="#475569"
            />
          </YAxis>
          <Tooltip formatter={(v: number) => v.toFixed(2)} />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#ea580c"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
