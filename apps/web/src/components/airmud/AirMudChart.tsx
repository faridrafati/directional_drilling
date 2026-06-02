/**
 * Air & Gas Drilling — "X-quantity vs depth" traverse chart.
 *
 * Generic port of the Delphi Form44 Chart1 / Chart2 (Unit44.pas `charting1` /
 * `charting2`): it plots one column of the densified `detail` profile on the X
 * axis against measured depth on the Y axis (reversed, so deeper is lower).
 *
 * Each profile row belongs to exactly one leg — the ANNULUS (surface → bit) or
 * the DRILL STRING interior (bit → surface) — so we draw two parametric line
 * segments whose off-leg key is null and `connectNulls={false}`, keeping the
 * "down" and "up" curves visually distinct (the Pascal colours ANL* vs STR*).
 *
 * One component drives every reporting view by varying `xKey`:
 *   • Pressure vs depth   xKey="press"   + ΔP vs depth  xKey="delP"   (Chart1)
 *   • Flow rate vs depth  xKey="gfrate"  + KE density   xKey="keDen"  (Chart2)
 * The KE-density view can independently show/hide the annulus and string legs
 * (Form44 CheckBox6 / CheckBox5).
 */
import { useMemo, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceDot, Label,
} from "recharts";
import type { AirMudRow } from "@dd/shared/air-mud";
import { type Quantity, type UnitSel, unitName, disp } from "../../units/airmudUnits.js";

/** Annulus leg = surface, blooie line, and every ANLS(n) row; the rest is string. */
function isAnnulus(part: string): boolean {
  return part === "SURFACE" || part === "BLOOEY" || part.startsWith("ANLS");
}

interface Pt {
  /** X value; nulled for a hidden leg so the axis domain ignores it. */
  x: number | null;
  annDepth: number | null;
  strDepth: number | null;
  /** Non-null only on the two deepest leg points, to draw the across-bit join. */
  bridge: number | null;
}

interface Props {
  detail: AirMudRow[];
  /** Active display-unit selection (depths and the X quantity are converted). */
  sel: UnitSel;
  /** Which profile column to put on the X axis. */
  xKey: keyof AirMudRow;
  /** Quantity class of the X column for unit conversion (omit = dimensionless). */
  xQuantity?: Quantity;
  /** Stored-base unit index of the X column (e.g. gas rate = ft³/min slot). */
  xStoredBase?: number;
  /** X-axis caption + tooltip label, e.g. "Pressure (psi)". */
  xLabel: string;
  /** Chart heading. */
  title: string;
  /** Legend names for the two legs. */
  annName?: string;
  strName?: string;
  /** Optional bit / bottom-hole marker (only meaningful on the pressure view). */
  bhp?: { depth: number; press: number } | null;
  /**
   * Join the annulus and string legs at the bit (deepest point of each), so the
   * traverse reads as one continuous loop. The near-horizontal link is the
   * bit-nozzle pressure drop (BHP → drill-string injection). Pressure view only.
   */
  connectLegs?: boolean;
}

export function DepthTraverseChart({
  detail, sel, xKey, xQuantity, xStoredBase = 0, xLabel, title,
  annName = "Annulus (down)", strName = "Drill string (up)",
  bhp, connectLegs = false,
}: Props) {
  // Legend-click show/hide, keyed by the line's dataKey ("annDepth" / "strDepth").
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const toggle = (key?: unknown) => {
    if (typeof key !== "string") return;
    setHidden((h) => ({ ...h, [key]: !h[key] }));
  };

  const data = useMemo<Pt[]>(() => {
    const pts: Pt[] = detail
      .filter((r) => Number.isFinite(Number(r[xKey])) && Number.isFinite(r.depth))
      .map((r) => {
        const ann = isAnnulus(r.part);
        const x = xQuantity ? disp(xQuantity, sel, Number(r[xKey]), xStoredBase) : Number(r[xKey]);
        const d = disp("length", sel, r.depth);
        return {
          x,
          annDepth: ann ? d : null,
          strDepth: ann ? null : d,
          bridge: null,
        };
      });
    if (connectLegs) {
      // Flag the deepest annulus point and the deepest string point (both at TD:
      // the annulus BHP and the bit-nozzle / string-injection pressure). A line
      // through just those two spans the bit, closing the surface→bit→surface loop.
      let annI = -1, strI = -1, annD = -Infinity, strD = -Infinity;
      pts.forEach((p, i) => {
        if (p.annDepth != null && p.annDepth > annD) { annD = p.annDepth; annI = i; }
        if (p.strDepth != null && p.strDepth > strD) { strD = p.strDepth; strI = i; }
      });
      if (annI >= 0) pts[annI].bridge = pts[annI].annDepth;
      if (strI >= 0) pts[strI].bridge = pts[strI].strDepth;
    }
    return pts;
  }, [detail, xKey, xQuantity, xStoredBase, sel, connectLegs]);

  // Feed the chart a view where any hidden leg's X is null, so the X-axis "auto"
  // domain (and the Y-axis) rescale to just the visible series on legend toggle.
  const view = useMemo<Pt[]>(() => {
    const annOff = !!hidden.annDepth;
    const strOff = !!hidden.strDepth;
    if (annOff && strOff) return data; // both off: keep axes, legend stays clickable
    return data.map((p) => {
      const annVis = p.annDepth != null && !annOff;
      const strVis = p.strDepth != null && !strOff;
      return annVis || strVis ? p : { ...p, x: null };
    });
  }, [data, hidden]);

  if (data.length < 3) {
    return (
      <div className="h-[460px] grid place-items-center text-sm text-gray-400 bg-white border border-gray-200 rounded">
        Calculate to see the profile.
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded p-4 h-[460px]">
      <h3 className="text-sm font-medium text-gray-700 mb-2">{title}</h3>
      <div className="h-[88%]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={view} margin={{ top: 8, right: 24, left: 18, bottom: 28 }}>
            <CartesianGrid stroke="#eef2f7" />
            <XAxis
              dataKey="x"
              type="number"
              domain={["auto", "auto"]}
              stroke="#475569"
              fontSize={12}
              tickFormatter={(v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            >
              <Label value={xLabel} position="bottom" offset={8} fill="#475569" />
            </XAxis>
            <YAxis
              type="number"
              reversed
              domain={[0, "auto"]}
              stroke="#475569"
              fontSize={12}
              tickFormatter={(v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            >
              <Label value={`Depth (${unitName("length", sel)})`} position="insideLeft" angle={-90} offset={0} fill="#475569" />
            </YAxis>
            <Tooltip content={(p) => <TraverseTooltip {...p} xLabel={xLabel} depthUnit={unitName("length", sel)} />} />
            <Legend
              verticalAlign="top"
              height={24}
              iconType="plainline"
              wrapperStyle={{ fontSize: 12, cursor: "pointer" }}
              onClick={(o) => toggle((o as { dataKey?: unknown }).dataKey)}
              formatter={(value, entry) => {
                const off = !!hidden[String((entry as { dataKey?: unknown })?.dataKey ?? "")];
                return (
                  <span
                    style={{
                      color: off ? "#9ca3af" : "#374151",
                      textDecoration: off ? "line-through" : "none",
                    }}
                  >
                    {value}
                  </span>
                );
              }}
            />
            <Line
              type="monotone"
              dataKey="annDepth"
              name={annName}
              stroke="#1e40af"
              strokeWidth={2}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
              hide={!!hidden.annDepth}
            />
            <Line
              type="monotone"
              dataKey="strDepth"
              name={strName}
              stroke="#16a34a"
              strokeWidth={2}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
              hide={!!hidden.strDepth}
            />
            {connectLegs && !hidden.annDepth && !hidden.strDepth && (
              <Line
                type="linear"
                dataKey="bridge"
                name="Across bit (nozzle ΔP)"
                stroke="#dc2626"
                strokeWidth={1.5}
                strokeDasharray="5 3"
                dot={false}
                connectNulls
                isAnimationActive={false}
                legendType="none"
              />
            )}
            {bhp && Number.isFinite(bhp.press) && !hidden.annDepth && (
              <ReferenceDot
                x={xQuantity ? disp(xQuantity, sel, bhp.press, xStoredBase) : bhp.press}
                y={disp("length", sel, bhp.depth)}
                ifOverflow="visible"
                isFront
                shape={(p: { cx?: number; cy?: number }) => (
                  <g pointerEvents="none">
                    <circle cx={p.cx ?? 0} cy={p.cy ?? 0} r={6} fill="white" stroke="white" strokeWidth={2} />
                    <circle cx={p.cx ?? 0} cy={p.cy ?? 0} r={4.5} fill="#dc2626" stroke="white" strokeWidth={1} />
                    <text
                      x={(p.cx ?? 0) + 8}
                      y={(p.cy ?? 0) - 6}
                      fontSize={11}
                      fontWeight={600}
                      fill="#b91c1c"
                      stroke="white"
                      strokeWidth={2.5}
                      paintOrder="stroke"
                    >
                      BHP
                    </text>
                  </g>
                )}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function TraverseTooltip({ active, payload, xLabel, depthUnit }: {
  active?: boolean;
  // Loosened to match recharts' Payload<ValueType, NameType> (name/value may be numeric).
  payload?: Array<{ name?: string | number; value?: number | string | Array<number | string>; payload?: Pt; color?: string }>;
  xLabel: string;
  depthUnit: string;
}) {
  if (!active || !payload?.length) return null;
  const row = payload.find((p) => p.value != null);
  if (!row?.payload) return null;
  const depth = row.payload.annDepth ?? row.payload.strDepth;
  return (
    <div className="bg-white/95 border border-gray-300 rounded shadow px-2 py-1.5 text-xs">
      <div className="font-medium" style={{ color: row.color }}>{row.name}</div>
      <div className="text-gray-700">
        <span className="text-gray-500">{xLabel}:</span>{" "}
        {typeof row.payload.x === "number"
          ? row.payload.x.toLocaleString(undefined, { maximumFractionDigits: 2 })
          : "—"}
      </div>
      <div className="text-gray-700"><span className="text-gray-500">Depth:</span> {Number(depth).toFixed(0)} {depthUnit}</div>
    </div>
  );
}
