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
  ResponsiveContainer, ReferenceDot, Label, Legend,
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
  /** Controlled VSEC view azimuth (string-in-degrees, or null = natural).
   *  When given, the chart renders the toolbar input + Reset button bound
   *  to these. Without it, the chart manages its own internal state. */
  vsecAzmInputStr?: string | null;
  onVsecAzmInputChange?: (next: string | null) => void;
  /** When true (default), draw a smooth monotone Bezier through stations;
   *  when false, straight linear segments. Controlled from the page-level
   *  "Smooth lines" toggle so both 2D charts + the 3D viewer share the
   *  same on/off state. */
  smoothLines?: boolean;
}

/** Append a unit suffix in parens if non-empty. "TVD" + "ft" → "TVD (ft)". */
function withUnit(label: string, unit?: string): string {
  return unit && unit.trim() ? `${label} (${unit})` : label;
}

/**
 * Compact legend rendered at the BOTTOM of each 2D chart. Identifies the
 * three visual elements the user needs to interpret the plot:
 *   - blue line  = wellbore trajectory (the densified path)
 *   - green ▲   = START (wellhead at MD=0)
 *   - red ●      = END (last calculated station)
 *
 * Recharts' built-in <Legend /> auto-discovers <Line /> series from their
 * `name` prop but can't represent custom <ReferenceDot> shapes; we supply
 * an explicit payload so all three appear with matching icons.
 *
 * Rendered with white halos on the swatches so they read against any
 * print background; layout is centered+horizontal+small to stay out of
 * the data area.
 */
function ChartLegend() {
  const items = [
    { value: "Trajectory", color: "#1e40af", shape: "line" as const },
    { value: "Start",      color: "#16a34a", shape: "tri"  as const },
    { value: "End",        color: "#dc2626", shape: "dot"  as const },
  ];
  return (
    <Legend
      verticalAlign="bottom"
      height={26}
      iconSize={0}
      wrapperStyle={{ fontSize: 12, paddingTop: 6 }}
      content={() => (
        <div style={{
          display: "flex", justifyContent: "center", gap: 16,
          fontSize: 12, color: "#475569",
        }}>
          {items.map((it) => (
            <span key={it.value} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <svg width="18" height="14" style={{ flexShrink: 0 }}>
                {it.shape === "line" && (
                  <line x1="0" y1="7" x2="18" y2="7" stroke={it.color} strokeWidth="2.5" />
                )}
                {it.shape === "tri" && (
                  <polygon
                    points="9,12 3,3 15,3"
                    fill={it.color}
                    stroke="white"
                    strokeWidth="1"
                  />
                )}
                {it.shape === "dot" && (
                  <circle cx="9" cy="7" r="5" fill={it.color} stroke="white" strokeWidth="1" />
                )}
              </svg>
              <span>{it.value}</span>
            </span>
          ))}
        </div>
      )}
    />
  );
}

/**
 * Endpoint marker for the trajectory: green ▲ for the wellhead (start),
 * red ● for the last station (end). Adds a small text label so the user
 * can tell which is which without relying on color alone (color-blind
 * accessibility + black-and-white prints).
 *
 * Used inside Recharts' <ReferenceDot shape={...} /> — the wrapping
 * ReferenceDot positions us at the right (cx, cy) in pixel space; this
 * component just paints the SVG.
 *
 * Both marker types render:
 *   1. a white halo ring to lift them off the curve
 *   2. the colored fill shape
 *   3. a small label above the marker
 */
function StartEndMarker({
  cx, cy, kind, label,
}: { cx: number; cy: number; kind: "start" | "end"; label: string }) {
  const isStart = kind === "start";
  const fill = isStart ? "#16a34a" : "#dc2626";       // green-600 / red-600
  const r = 6;
  return (
    <g pointerEvents="none">
      {/* White halo so the marker reads on top of any gridline / curve. */}
      <circle cx={cx} cy={cy} r={r + 2.5} fill="white" stroke="white" strokeWidth={1.5} />
      {isStart ? (
        // Triangle pointing down — same visual language as a drillship
        // hanging the bit at the wellhead.
        <polygon
          points={`${cx},${cy + r} ${cx - r},${cy - r} ${cx + r},${cy - r}`}
          fill={fill}
          stroke="white"
          strokeWidth={1.2}
        />
      ) : (
        <circle cx={cx} cy={cy} r={r} fill={fill} stroke="white" strokeWidth={1.2} />
      )}
      {/* Label above the marker. Keep it tiny so it doesn't crowd the
          chart; the colour and shape are the primary visual cues. */}
      <text
        x={cx}
        y={cy - r - 6}
        textAnchor="middle"
        fontSize={11}
        fontWeight={600}
        fill={fill}
        stroke="white"
        strokeWidth={3}
        paintOrder="stroke"
      >
        {label}
      </text>
    </g>
  );
}

/**
 * Pick an engineering-friendly "nice" tick step covering `range` in roughly
 * `targetMajorCount` major intervals. Snaps to 1 / 2 / 5 × 10ⁿ — the same
 * mental scale every engineer uses for graph-paper gridlines.
 *
 *   range=4200, target=6  → rough = 700  → nice 500
 *   range=350,  target=6  → rough = 58   → nice 50
 *   range=12,   target=6  → rough = 2    → nice 2
 */
function niceStep(range: number, targetMajorCount = 6): number {
  if (!Number.isFinite(range) || range <= 0) return 1;
  const rough = range / targetMajorCount;
  const pow10 = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / pow10; // 1 ≤ norm < 10
  let mult: number;
  if (norm < 1.5) mult = 1;
  else if (norm < 3)  mult = 2;
  else if (norm < 7)  mult = 5;
  else                mult = 10;
  return mult * pow10;
}

/**
 * Engineering grid — major (darker, dashed) + minor (lighter, solid) lines.
 *
 * Recharts' built-in <CartesianGrid /> only draws at axis-tick positions
 * and at one density. We stack TWO instances and feed each its own
 * positions via `horizontal/verticalCoordinatesGenerator`. Major spacing
 * is auto-picked from the axis domain via niceStep(); minor spacing is
 * major / 5 — the universal graph-paper convention.
 *
 * Why this is needed: an engineer reading the printed Vertical Section
 * needs to interpolate distances between gridlines. A single-density grid
 * either makes the chart visually noisy (too fine) or unreadable (too
 * coarse). The two-density grid mirrors what's on technical drafting
 * paper (and what Pascal MIXED.exe's TeeChart used by default).
 */
function EngineeringGrid() {
  // Both generators use the same niceStep logic. The minor generator
  // returns every minor tick; the major generator returns every 5th
  // (i.e. only positions that are multiples of the major step).
  const minorH = (props: { yAxis?: { scale?: (v: number) => number; domain?: () => [number, number] } }): number[] => {
    return computeGridPositions(props.yAxis, /*minor*/ true);
  };
  const majorH = (props: { yAxis?: { scale?: (v: number) => number; domain?: () => [number, number] } }): number[] => {
    return computeGridPositions(props.yAxis, /*minor*/ false);
  };
  const minorV = (props: { xAxis?: { scale?: (v: number) => number; domain?: () => [number, number] } }): number[] => {
    return computeGridPositions(props.xAxis, /*minor*/ true);
  };
  const majorV = (props: { xAxis?: { scale?: (v: number) => number; domain?: () => [number, number] } }): number[] => {
    return computeGridPositions(props.xAxis, /*minor*/ false);
  };
  return (
    <>
      {/* Minor — fine, solid, very light */}
      <CartesianGrid
        stroke="#eef2f7"
        strokeWidth={0.5}
        horizontalCoordinatesGenerator={minorH as never}
        verticalCoordinatesGenerator={minorV as never}
      />
      {/* Major — bolder, dashed, mid-gray */}
      <CartesianGrid
        stroke="#94a3b8"
        strokeWidth={0.7}
        strokeDasharray="3 4"
        horizontalCoordinatesGenerator={majorH as never}
        verticalCoordinatesGenerator={majorV as never}
      />
    </>
  );
}

/**
 * Translate every "nice" tick value within an axis's domain into a pixel
 * position via the d3 scale Recharts exposes on the axis object. Returns
 * minor (step = majorStep/5) or major (step = majorStep) positions.
 *
 * Robust to missing scale/domain (early renders) — returns [] so the grid
 * just draws nothing rather than crashing.
 */
function computeGridPositions(
  axis: { scale?: (v: number) => number; domain?: () => [number, number] } | undefined,
  minor: boolean,
): number[] {
  if (!axis || typeof axis.scale !== "function" || typeof axis.domain !== "function") {
    return [];
  }
  const [d0, d1] = axis.domain();
  if (!Number.isFinite(d0) || !Number.isFinite(d1)) return [];
  const lo = Math.min(d0, d1);
  const hi = Math.max(d0, d1);
  const range = hi - lo;
  if (range === 0) return [];
  const majorStep = niceStep(range, 6);
  const step = minor ? majorStep / 5 : majorStep;
  // Cap total lines to a sane upper bound so a tiny step (e.g. user
  // zoomed into a millimetre-scale section) doesn't draw thousands.
  const maxLines = 400;
  const count = Math.min(maxLines, Math.ceil(range / step) + 2);
  const start = Math.ceil(lo / step) * step;
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const v = start + i * step;
    if (v > hi + 1e-9) break;
    out.push(axis.scale(v));
  }
  return out;
}

/**
 * Natural VSEC azimuth = bearing from the FIRST station to the LAST station
 * in the horizontal plane. Used as the default when the user hasn't picked
 * a custom view azimuth.
 *
 *   atan2(ΔEW, ΔNS) ⇒ azm in radians, clockwise from north
 */
export function naturalVsecAzm(stations: { ns: number; ew: number }[]): number {
  if (stations.length < 2) return 0;
  const first = stations[0];
  const last = stations[stations.length - 1];
  const dn = last.ns - first.ns;
  const de = last.ew - first.ew;
  if (dn === 0 && de === 0) return 0;
  return Math.atan2(de, dn);
}

/**
 * Parse the user's VSEC azimuth input (string in degrees, or null = natural).
 * Returns the final reference azimuth in radians.
 */
export function resolveVsecAzm(inputStr: string | null, naturalAzm: number): number {
  if (inputStr === null) return naturalAzm;
  const cleaned = inputStr.trim();
  if (!cleaned) return naturalAzm;
  const deg = Number(cleaned);
  if (!Number.isFinite(deg)) return naturalAzm;
  return (deg * Math.PI) / 180;
}

/**
 * Recompute VSEC for a station's (NS, EW) using a chosen reference azimuth.
 * Mirrors Pascal Unit02.pas:2592 and the dispatcher's computeVsecPostPass.
 */
export function projectVsec(
  ns: number, ew: number,
  origin: { ns: number; ew: number },
  refAzm: number,
): number {
  return (ns - origin.ns) * Math.cos(refAzm)
       + (ew - origin.ew) * Math.sin(refAzm);
}

/**
 * Header button + popup for setting the VSEC view azimuth from any table's
 * "VSEC" column header. Shows a small "ⓘ" icon; clicking it opens a modal
 * with a draft input, Apply/Cancel, and Reset. Confirming with Apply
 * commits the new azimuth, which triggers a re-projection of every VSEC
 * value across the grid + Stations table + chart.
 */
export function VsecAzmHeaderButton({
  inputStr, naturalAzm, onChange,
}: {
  inputStr: string | null;
  naturalAzm: number;
  onChange: (next: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className="ml-1 inline-flex w-4 h-4 items-center justify-center rounded-full bg-blue-100 hover:bg-blue-200 text-blue-700 text-[10px] font-bold align-middle"
        title="Change VSEC reference azimuth"
        aria-label="Change VSEC reference azimuth"
      >
        i
      </button>
      {open && (
        <VsecAzmModal
          inputStr={inputStr}
          naturalAzm={naturalAzm}
          onApply={(next) => { onChange(next); setOpen(false); }}
          onCancel={() => setOpen(false)}
        />
      )}
    </>
  );
}

/**
 * The actual modal. Owns a DRAFT input so the user can type freely and
 * only commit on Apply (clicking outside / Escape / Cancel discards).
 */
function VsecAzmModal({
  inputStr, naturalAzm, onApply, onCancel,
}: {
  inputStr: string | null;
  naturalAzm: number;
  onApply: (next: string | null) => void;
  onCancel: () => void;
}) {
  const naturalAzmDeg = (naturalAzm * 180 / Math.PI + 360) % 360;
  const startValue = inputStr ?? naturalAzmDeg.toFixed(2);
  const [draft, setDraft] = useState(startValue);
  const [usingNatural, setUsingNatural] = useState(inputStr === null);

  // Esc → cancel, Enter → apply.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
      else if (e.key === "Enter") onApply(usingNatural ? null : draft);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [draft, usingNatural, onApply, onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">VSEC reference azimuth</h3>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 -m-1 p-1 rounded"
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="px-4 py-4 space-y-3 text-sm">
          {/* The paragraph needs explicit whitespace-normal + break-words so
              long words / arrow characters wrap inside the modal width
              instead of overflowing. */}
          <p className="text-xs text-gray-500 leading-relaxed whitespace-normal break-words">
            VSEC is the projection of each station&apos;s (NS, EW) onto a
            reference bearing. <span className="font-mono">0° = N</span>,
            {" "}<span className="font-mono">90° = E</span>. Default =
            wellhead-to-last-station bearing.
          </p>

          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={usingNatural}
              onChange={(e) => setUsingNatural(e.target.checked)}
            />
            <span>Use natural azimuth ({naturalAzmDeg.toFixed(2)}°)</span>
          </label>

          <div className="flex items-center gap-2">
            <label htmlFor="vsec-azm-modal-input" className="text-xs text-gray-700">
              Custom azm:
            </label>
            <input
              id="vsec-azm-modal-input"
              type="number"
              step="0.01"
              value={draft}
              disabled={usingNatural}
              onChange={(e) => setDraft(e.target.value)}
              onFocus={(e) => e.currentTarget.select()}
              autoFocus
              className="flex-1 px-2 py-1 border border-gray-300 rounded text-right font-mono text-sm disabled:bg-gray-100 disabled:text-gray-400"
            />
            <span className="text-gray-400">°</span>
          </div>
        </div>

        <div className="px-4 py-3 border-t border-gray-200 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-sm rounded bg-gray-100 hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={() => onApply(usingNatural ? null : draft)}
            className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Compact controlled input for the VSEC view azimuth. Shared by the
 * VerticalSectionChart's title bar and the Grid tab's header so users can
 * change the projection from either place. Layout is a single line with
 * `View azm:` label, numeric input, `°` glyph, and an optional Reset
 * button that appears only when the user has overridden the default.
 */
export function VsecAzmControl({
  inputStr, naturalAzm, onChange, label = "VSEC view azm:",
}: {
  inputStr: string | null;
  naturalAzm: number;
  onChange: (next: string | null) => void;
  label?: string;
}) {
  const naturalAzmDeg = (naturalAzm * 180 / Math.PI + 360) % 360;
  return (
    <div className="inline-flex items-center gap-1.5 text-xs whitespace-nowrap shrink-0">
      <label htmlFor="vsec-azm-input" className="text-gray-500">{label}</label>
      <input
        id="vsec-azm-input"
        type="number"
        step="1"
        value={inputStr ?? naturalAzmDeg.toFixed(2)}
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => {
          // Prime the input with the natural azm on first focus so the
          // user has a starting value to nudge.
          if (inputStr === null) onChange(naturalAzmDeg.toFixed(2));
          e.currentTarget.select();
        }}
        className="w-20 px-1.5 py-0.5 border border-gray-300 rounded text-right font-mono"
        title="Reference azimuth in degrees (0 = N, 90 = E). Default = wellhead→target bearing."
      />
      <span className="text-gray-400">°</span>
      {inputStr !== null && (
        <button
          onClick={() => onChange(null)}
          className="ml-1 px-1.5 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 text-[11px]"
          title={`Reset to natural azimuth (${naturalAzmDeg.toFixed(2)}°)`}
        >
          Reset
        </button>
      )}
    </div>
  );
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
  vsecAzmInputStr, onVsecAzmInputChange, smoothLines = true,
}: Props) {
  // The vertical section is the projection of each station's horizontal
  // offset (NS, EW) onto a reference direction. Pascal Form23 lets the
  // user pick that direction as a "VSEC azimuth"; by default it's the
  // wellhead → last-station bearing (so VSEC matches the planned wellbore
  // axis). Override it from this chart's toolbar to view the trajectory
  // along any other azimuth (e.g. lease line, anti-collision corridor).
  const naturalAzm = useMemo(() => naturalVsecAzm(stations), [stations]);

  // The toolbar input is "controlled" when the parent passes
  // vsecAzmInputStr/onVsecAzmInputChange (so the grid + stations tables can
  // share the same azm), and "uncontrolled" otherwise.
  const [localStr, setLocalStr] = useState<string | null>(null);
  const azmInputStr = vsecAzmInputStr !== undefined ? vsecAzmInputStr : localStr;
  const setAzmInputStr = (v: string | null) => {
    if (onVsecAzmInputChange) onVsecAzmInputChange(v);
    else setLocalStr(v);
  };

  const refAzm = resolveVsecAzm(azmInputStr, naturalAzm);

  const data = useMemo(() => {
    if (stations.length === 0) return [];
    const origin = stations[0];
    const cos = Math.cos(refAzm), sin = Math.sin(refAzm);
    return stations.map((s, i) => ({
      i,
      vsec: (s.ns - origin.ns) * cos + (s.ew - origin.ew) * sin,
      tvd: s.tvd,
      comment: s.comment,
    }));
  }, [stations, refAzm]);

  // Recharts emits state.activePayload[0].payload on every mouse move over
  // the plot area. We resolve the data index back to the source station
  // (our `data` rows carry an `i` field for this) and feed it to the
  // side panel (or hoist to the parent via onHover).
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  // When the user picks a custom view angle, override the station's stored
  // VSEC in the details panel too — otherwise the side panel and the chart
  // would disagree.
  const hovered: StationDetails | null = hoverIdx !== null && stations[hoverIdx]
    ? { ...toDetails(stations[hoverIdx]), vsec: data[hoverIdx]?.vsec ?? stations[hoverIdx].vsec }
    : null;
  // Notify the parent on every hover transition (after render).
  React.useEffect(() => { onHover?.(hovered); }, [hovered, onHover]);

  if (data.length < 2) return <Empty label="Vertical Section" />;
  const tip = data[data.length - 1];
  const chartCard = (
    <div className="flex-1 bg-white border border-gray-200 rounded p-4 h-[500px] min-w-0">
      {/* Title + view-angle controls on ONE line (no flex-wrap). The title
          shrinks via min-w-0 + truncate if needed; the input + reset stay
          intact on the right. */}
      <div className="flex items-center justify-between gap-3 mb-2">
        <h3 className="text-sm font-medium text-gray-700 truncate min-w-0">
          Vertical Section — {withUnit("VSEC", lengthUnit)} × {withUnit("TVD", lengthUnit)}
        </h3>
        <VsecAzmControl
          inputStr={azmInputStr}
          naturalAzm={naturalAzm}
          onChange={setAzmInputStr}
          label="View azm:"
        />
      </div>
      <ResponsiveContainer width="100%" height="86%">
        <LineChart
          data={data}
          margin={{ top: 10, right: 30, left: 30, bottom: 30 }}
          onMouseMove={(state) => {
            const idx = (state?.activePayload?.[0]?.payload as { i?: number } | undefined)?.i;
            setHoverIdx(typeof idx === "number" ? idx : null);
          }}
          onMouseLeave={() => setHoverIdx(null)}
        >
          <EngineeringGrid />
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
          <ChartLegend />
          <Line
            type={smoothLines ? "monotone" : "linear"}
            dataKey="tvd"
            name="Trajectory"
            stroke="#1e40af"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          {/* START — green ▲ pointing down at the wellhead */}
          <ReferenceDot
            x={data[0].vsec}
            y={data[0].tvd}
            ifOverflow="visible"
            isFront
            shape={(props: { cx?: number; cy?: number }) => (
              <StartEndMarker cx={props.cx ?? 0} cy={props.cy ?? 0} kind="start" label="Start" />
            )}
          />
          {/* END — red ● at the last station */}
          <ReferenceDot
            x={tip.vsec}
            y={tip.tvd}
            ifOverflow="visible"
            isFront
            shape={(props: { cx?: number; cy?: number }) => (
              <StartEndMarker cx={props.cx ?? 0} cy={props.cy ?? 0} kind="end" label="End" />
            )}
          />
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
  smoothLines = true,
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
          <EngineeringGrid />
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
          <ChartLegend />
          <Line
            type={smoothLines ? "monotone" : "linear"}
            dataKey="ns"
            name="Trajectory"
            stroke="#1e40af"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          {/* START — green ▲ at the wellhead (origin) */}
          <ReferenceDot
            x={data[0].ew}
            y={data[0].ns}
            ifOverflow="visible"
            isFront
            shape={(props: { cx?: number; cy?: number }) => (
              <StartEndMarker cx={props.cx ?? 0} cy={props.cy ?? 0} kind="start" label="Start" />
            )}
          />
          {/* END — red ● at the last station */}
          <ReferenceDot
            x={tip.ew}
            y={tip.ns}
            ifOverflow="visible"
            isFront
            shape={(props: { cx?: number; cy?: number }) => (
              <StartEndMarker cx={props.cx ?? 0} cy={props.cy ?? 0} kind="end" label="End" />
            )}
          />
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
