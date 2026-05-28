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
import React, { useMemo, useState, useCallback, useRef, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceDot, ReferenceArea, Label, Legend,
} from "recharts";
import type { StationRow, KeypointRow } from "../api/client.js";
import { StationDetailsPanel, type StationDetails } from "./StationDetailsPanel.js";

/**
 * Zoom + per-axis-scale state for a 2D chart. Returns:
 *   - `xDomain` / `yDomain` to spread onto <XAxis>/<YAxis> `domain=`
 *   - mouse handlers (spread onto <LineChart>)
 *   - `<selectionArea>` — a <ReferenceArea> showing the live drag rectangle
 *   - `scaleAxis(axis, factor)` — zoom one axis in/out around its centre
 *   - `reset()` and `isZoomed`
 *
 * Two gestures:
 *   • LEFT-drag a box → zoom into that region.
 *   • RIGHT-drag      → pan the view (the grabbed point sticks to the cursor).
 *
 * Both rely on Recharts' mouse-state `offset` (the plot rectangle in px) +
 * `chartX` / `chartY` (cursor px) to convert pixels ↔ data, so they work
 * for either axis and respect the reversed-Y vertical-section axis.
 */
type Domain = [number, number] | null;
function useChartZoom(
  xKey: string,
  yKey: string,
  data: ReadonlyArray<Record<string, unknown>>,
  yReversed = false,
) {
  const [xDomain, setXDomain] = useState<Domain>(null);
  const [yDomain, setYDomain] = useState<Domain>(null);
  // Live drag rectangle in DATA coords (null when not box-zooming).
  const [dragA, setDragA] = useState<{ x: number; y: number } | null>(null);
  const [dragB, setDragB] = useState<{ x: number; y: number } | null>(null);

  // Natural extents — used as the base for per-axis scaling and as the
  // domain when not explicitly zoomed.
  const extents = useMemo(() => {
    if (data.length === 0) return { x: [0, 1] as [number, number], y: [0, 1] as [number, number] };
    let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
    for (const d of data) {
      const x = Number(d[xKey]), y = Number(d[yKey]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      if (x < xMin) xMin = x; if (x > xMax) xMax = x;
      if (y < yMin) yMin = y; if (y > yMax) yMax = y;
    }
    return { x: [xMin, xMax] as [number, number], y: [yMin, yMax] as [number, number] };
  }, [data, xKey, yKey]);

  // Live refs so the native DOM listeners (attached once) always read the
  // latest domain/extents without re-subscribing on every render.
  const domRef = useRef({ x: extents.x, y: extents.y });
  domRef.current = { x: xDomain ?? extents.x, y: yDomain ?? extents.y };
  const extentsRef = useRef(extents);
  extentsRef.current = extents;
  const yRevRef = useRef(yReversed);
  yRevRef.current = yReversed;

  // The wrapper div we attach native mouse listeners to. Recharts' own mouse
  // state never includes the plot `offset`, so we read the plot rectangle
  // straight from the rendered `.recharts-cartesian-grid` group and convert
  // client pixels → data ourselves. This works for BOTH mouse buttons and
  // both axes, which Recharts' handlers can't reliably do.
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    // Plot rect in CLIENT coords, taken from the grid group (spans exactly
    // the plotting area). Falls back to the SVG surface if needed.
    const plotRect = (): DOMRect | null => {
      const grid = wrap.querySelector(".recharts-cartesian-grid");
      let r = grid ? (grid as SVGGElement).getBoundingClientRect() : null;
      if (!r || r.width < 2 || r.height < 2) {
        const surf = wrap.querySelector(".recharts-surface");
        r = surf ? (surf as SVGElement).getBoundingClientRect() : null;
      }
      return r && r.width >= 2 && r.height >= 2 ? r : null;
    };

    // Convert a client (x,y) to data coords via the plot rect + current domain.
    const toData = (clientX: number, clientY: number, rect: DOMRect) => {
      const [dx0, dx1] = domRef.current.x;
      const [dy0, dy1] = domRef.current.y;
      const fx = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      const fy = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
      const x = dx0 + fx * (dx1 - dx0);
      const y = yRevRef.current ? dy0 + fy * (dy1 - dy0) : dy1 - fy * (dy1 - dy0);
      return { x, y, fx, fy };
    };

    // Mutable gesture state for the lifetime of one drag.
    let mode: "none" | "zoom" | "pan" = "none";
    let rect: DOMRect | null = null;
    let pan: { gx: number; gy: number; spanX: number; spanY: number } | null = null;

    const onDown = (e: MouseEvent) => {
      // Ignore clicks on the overlay buttons (they live outside the plot).
      rect = plotRect();
      if (!rect) return;
      // Only react to presses inside the plot area.
      if (e.clientX < rect.left || e.clientX > rect.right ||
          e.clientY < rect.top || e.clientY > rect.bottom) return;
      e.preventDefault();
      const d = toData(e.clientX, e.clientY, rect);
      if (e.button === 2) {
        // RIGHT → pan (same as the 3D view's right-drag).
        mode = "pan";
        pan = {
          gx: d.x, gy: d.y,
          spanX: domRef.current.x[1] - domRef.current.x[0],
          spanY: domRef.current.y[1] - domRef.current.y[0],
        };
      } else if (e.button === 0) {
        // LEFT → box-zoom.
        mode = "zoom";
        setDragA({ x: d.x, y: d.y });
        setDragB({ x: d.x, y: d.y });
      }
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    };

    const onMove = (e: MouseEvent) => {
      if (mode === "none" || !rect) return;
      if (mode === "pan" && pan) {
        const fx = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
        const fy = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
        // Keep span fixed; shift domain so the grabbed point stays under cursor.
        const newX0 = pan.gx - fx * pan.spanX;
        const newY0 = yRevRef.current
          ? pan.gy - fy * pan.spanY
          : pan.gy - (1 - fy) * pan.spanY;
        setXDomain([newX0, newX0 + pan.spanX]);
        setYDomain([newY0, newY0 + pan.spanY]);
      } else if (mode === "zoom") {
        const d = toData(e.clientX, e.clientY, rect);
        setDragB({ x: d.x, y: d.y });
      }
    };

    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      if (mode === "zoom") commitZoom();
      mode = "none"; rect = null; pan = null;
    };

    const commitZoom = () => {
      setDragA((a) => {
        setDragB((b) => {
          if (a && b) {
            const ext = extentsRef.current;
            const xSpan = ext.x[1] - ext.x[0] || 1;
            const ySpan = ext.y[1] - ext.y[0] || 1;
            const dx = Math.abs(a.x - b.x), dy = Math.abs(a.y - b.y);
            if (dx > xSpan * 0.02 || dy > ySpan * 0.02) {
              const x1 = Math.min(a.x, b.x), x2 = Math.max(a.x, b.x);
              const y1 = Math.min(a.y, b.y), y2 = Math.max(a.y, b.y);
              if (Number.isFinite(x1) && x2 - x1 > xSpan * 1e-4) setXDomain([x1, x2]);
              if (Number.isFinite(y1) && y2 - y1 > ySpan * 1e-4) setYDomain([y1, y2]);
            }
          }
          return null; // clear dragB
        });
        return null;   // clear dragA
      });
    };

    wrap.addEventListener("mousedown", onDown);
    return () => {
      wrap.removeEventListener("mousedown", onDown);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  // Zoom one axis in (factor<1) or out (factor>1) around its current centre.
  const scaleAxis = useCallback((axis: "x" | "y", factor: number) => {
    const cur = axis === "x" ? (domRef.current.x) : (domRef.current.y);
    const mid = (cur[0] + cur[1]) / 2;
    let half = ((cur[1] - cur[0]) / 2) * factor;
    const naturalHalf = axis === "x"
      ? (extents.x[1] - extents.x[0]) / 2 || 1
      : (extents.y[1] - extents.y[0]) / 2 || 1;
    half = Math.max(naturalHalf * 1e-3, Math.min(naturalHalf * 50, Math.abs(half)));
    const next: [number, number] = [mid - half, mid + half];
    if (axis === "x") setXDomain(next); else setYDomain(next);
  }, [extents]);

  const reset = useCallback(() => {
    setXDomain(null); setYDomain(null); setDragA(null); setDragB(null);
  }, []);

  const isZoomed = xDomain !== null || yDomain !== null;

  // The live box-zoom selection rectangle (only while left-dragging).
  const selectionArea = dragA && dragB
    ? { x1: dragA.x, x2: dragB.x, y1: dragA.y, y2: dragB.y }
    : null;

  // Effective (currently-visible) domain — the zoom override, else the data
  // extents. EngineeringGrid uses these to compute gridline value arrays.
  const effX = xDomain ?? extents.x;
  const effY = yDomain ?? extents.y;

  return {
    wrapRef, xDomain, yDomain, extents, scaleAxis, reset, isZoomed,
    selectionArea, effX, effY,
  };
}

/**
 * Nice tick VALUES (data units) across [lo, hi]. Major = niceStep, minor =
 * niceStep/5 — the engineering graph-paper convention. Returned as a plain
 * number[] for Recharts' horizontalValues / verticalValues props.
 */
function gridTickValues(lo: number, hi: number, minor: boolean): number[] {
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [];
  const a = Math.min(lo, hi), b = Math.max(lo, hi);
  const range = b - a;
  if (range <= 0) return [];
  const major = niceStep(range, 6);
  const step = minor ? major / 5 : major;
  if (step <= 0) return [];
  const out: number[] = [];
  const start = Math.ceil(a / step) * step;
  for (let v = start; v <= b + step * 1e-6 && out.length < 500; v += step) {
    out.push(Number(v.toFixed(6)));
  }
  return out;
}

/**
 * Compact per-axis zoom controls. Rendered INLINE in the chart header (not
 * absolutely positioned) so it never overlaps the title or the VSEC
 * view-azimuth control.
 */
function ZoomControls({
  onScaleX, onScaleY, onReset, isZoomed,
}: {
  onScaleX: (factor: number) => void;
  onScaleY: (factor: number) => void;
  onReset: () => void;
  isZoomed: boolean;
}) {
  const IN = 0.6, OUT = 1.6; // zoom-in shrinks the domain; zoom-out grows it
  return (
    <div className="flex items-center gap-0.5 text-[11px] shrink-0">
      <span className="text-gray-400 px-0.5">X</span>
      <ZoomBtn onClick={() => onScaleX(IN)} title="Zoom in X">+</ZoomBtn>
      <ZoomBtn onClick={() => onScaleX(OUT)} title="Zoom out X">−</ZoomBtn>
      <span className="text-gray-400 px-0.5 ml-0.5">Y</span>
      <ZoomBtn onClick={() => onScaleY(IN)} title="Zoom in Y">+</ZoomBtn>
      <ZoomBtn onClick={() => onScaleY(OUT)} title="Zoom out Y">−</ZoomBtn>
      <button
        onClick={onReset}
        disabled={!isZoomed}
        className="ml-1 px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-40"
        title="Reset to true scale"
      >
        Reset
      </button>
    </div>
  );
}
function ZoomBtn({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="w-5 h-5 rounded bg-gray-100 hover:bg-gray-200 leading-none text-gray-700"
    >
      {children}
    </button>
  );
}

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
  /** Algebraic milestone keypoints (KOP / EOC / Target / EOC#1 / KOP#2 / ...)
   *  from the dispatcher's solver output. Each renders as a labelled orange
   *  diamond on the chart so the engineer can read off the exact MD / NS /
   *  EW where each profile segment changes. */
  keypoints?: KeypointRow[];
}

/** Append a unit suffix in parens if non-empty. "TVD" + "ft" → "TVD (ft)". */
function withUnit(label: string, unit?: string): string {
  return unit && unit.trim() ? `${label} (${unit})` : label;
}

/**
 * Compact legend rendered at the BOTTOM of each 2D chart. Identifies the
 * visual elements the user needs to interpret the plot:
 *   - blue line  = wellbore trajectory (the densified path)
 *   - green ▲   = START (wellhead at MD=0)
 *   - red ●      = END (last calculated station)
 *   - orange ◆  = KEYPOINT (KOP / EOC / Target — algebraic milestone)
 *
 * Recharts' built-in <Legend /> auto-discovers <Line /> series from their
 * `name` prop but can't represent the custom <ReferenceDot> shapes; we
 * supply an explicit payload so all four appear with matching icons.
 *
 * Rendered with white halos on the swatches so they read against any
 * print background; layout is centered+horizontal+small to stay out of
 * the data area.
 *
 * `showKeypoint` is suppressed (default `true`) when the caller has zero
 * keypoints to draw — keeps the legend honest on plain surveys with no
 * algebraic milestones.
 */
function ChartLegend({ showKeypoint = true }: { showKeypoint?: boolean }) {
  const items = [
    { value: "Trajectory", color: "#1e40af", shape: "line" as const },
    { value: "Start",      color: "#16a34a", shape: "tri"  as const },
    { value: "End",        color: "#dc2626", shape: "dot"  as const },
    ...(showKeypoint
      ? [{ value: "Keypoint", color: "#f59e0b", shape: "diamond" as const }]
      : []),
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
                {it.shape === "diamond" && (
                  <polygon
                    points="9,2 16,7 9,12 2,7"
                    fill={it.color}
                    stroke="white"
                    strokeWidth="1"
                  />
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
 * Algebraic milestone marker — orange diamond ◆ with a short label.
 * Used for every KOP / EOC / Target / EOC#1 / KOP#2 keypoint the
 * dispatcher emits. Smaller than the start/end markers so it doesn't
 * dominate the trajectory; label sits above the diamond.
 *
 * Label is the role name extracted from the keypoint's comment via
 * shortKeypointLabel() — "KOP", "EOC", "Target", "EOC #2", etc. Truncated
 * to ≤ 10 chars so a chain of close-by keypoints doesn't overlap.
 */
function KeypointMarker({
  cx, cy, label,
}: { cx: number; cy: number; label: string }) {
  const fill = "#f59e0b"; // amber-500
  const r = 4.5;
  return (
    <g pointerEvents="none">
      {/* White halo */}
      <circle cx={cx} cy={cy} r={r + 1.5} fill="white" stroke="white" strokeWidth={1} />
      {/* Diamond ◆ */}
      <polygon
        points={`${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`}
        fill={fill}
        stroke="white"
        strokeWidth={1}
      />
      <text
        x={cx + r + 2}
        y={cy - r - 1}
        textAnchor="start"
        fontSize={10}
        fontWeight={600}
        fill="#92400e" /* amber-800 */
        stroke="white"
        strokeWidth={2.5}
        paintOrder="stroke"
      >
        {label}
      </text>
    </g>
  );
}

/**
 * Strip a keypoint's verbose comment ("KOP (Hold-Curve 3D*)") down to its
 * role name ("KOP") so the chart label stays readable. Falls back to the
 * raw comment truncated when no recognised role prefix appears.
 */
function shortKeypointLabel(comment: string | null | undefined): string {
  if (!comment) return "•";
  // Recognised Pascal role prefixes — see profileRoles.ts for the full
  // list. We grep for the keyword optionally followed by " #N".
  const m = comment.match(/^(KOP|EOC|Target|Survey Station)(\s*#\d+)?/i);
  if (m) return m[0].replace(/\s+/g, " ");
  return comment.length > 10 ? comment.slice(0, 9) + "…" : comment;
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
/**
 * Returns the major + minor <CartesianGrid> elements as a Fragment.
 *
 * IMPORTANT: this is a plain FUNCTION, invoked as `{engineeringGrid(...)}`
 * directly inside <LineChart> — NOT a `<Component/>`. Recharts locates its
 * sub-elements (CartesianGrid, XAxis, Line, …) by scanning the chart's
 * children and matching `type.displayName`. Its scanner flattens Fragments
 * but does NOT recurse into custom components, so a `<EngineeringGrid/>`
 * wrapper hides the grids from Recharts entirely (which is why earlier
 * attempts drew nothing). Returning a Fragment from a function call keeps
 * the CartesianGrids as direct, discoverable children.
 *
 * Recharts maps `horizontalValues` (Y data values → horizontal lines) and
 * `verticalValues` (X data values → vertical lines) through its own axis
 * scale, so we only supply the nice tick values.
 */
function engineeringGrid(gridX: [number, number], gridY: [number, number]) {
  const majorX = gridTickValues(gridX[0], gridX[1], false);
  const minorX = gridTickValues(gridX[0], gridX[1], true);
  const majorY = gridTickValues(gridY[0], gridY[1], false);
  const minorY = gridTickValues(gridY[0], gridY[1], true);
  return (
    <>
      {/* Minor — fine, solid, very light (drawn first, under the majors). */}
      <CartesianGrid
        stroke="#eef2f7"
        strokeWidth={1}
        horizontalValues={minorY}
        verticalValues={minorX}
      />
      {/* Major — solid, slightly darker (Excel-style clean grid). */}
      <CartesianGrid
        stroke="#cbd5e1"
        strokeWidth={1}
        horizontalValues={majorY}
        verticalValues={majorX}
      />
    </>
  );
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
  keypoints = [],
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

  // Project every keypoint onto the current view azimuth so it lands on
  // the trajectory curve in this view (otherwise the marker would float
  // beside it when the user picks a non-natural VSEC angle).
  const kpProjected = useMemo(() => {
    if (stations.length === 0 || keypoints.length === 0) return [];
    const origin = stations[0];
    const cos = Math.cos(refAzm), sin = Math.sin(refAzm);
    return keypoints.map((k) => ({
      vsec: (k.ns - origin.ns) * cos + (k.ew - origin.ew) * sin,
      tvd: k.tvd,
      label: shortKeypointLabel(k.comment),
      key: `${k.segmentOrder}-${k.roleIndex}-${k.md}`,
    }));
  }, [keypoints, stations, refAzm]);

  // Recharts emits state.activePayload[0].payload on every mouse move over
  // the plot area. We resolve the data index back to the source station
  // (our `data` rows carry an `i` field for this) and feed it to the
  // side panel (or hoist to the parent via onHover).
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  // Drag-box zoom + per-axis scale + right-drag pan. VSEC's Y axis is
  // reversed (TVD grows downward), so tell the hook.
  const vsecZoom = useChartZoom("vsec", "tvd", data, /*yReversed*/ true);
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
  const zoom = vsecZoom;
  const chartCard = (
    <div
      className="flex-1 bg-white border border-gray-200 rounded p-4 h-[500px] min-w-0 relative select-none"
      // Suppress the browser right-click menu so RIGHT-drag can pan the
      // chart instead of popping copy / paste / print.
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Header: title (left), view-azm + zoom controls (right). All inline so
          nothing overlaps. Wraps on very narrow widths. */}
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <h3 className="text-sm font-medium text-gray-700 truncate min-w-0">
          Vertical Section — {withUnit("VSEC", lengthUnit)} × {withUnit("TVD", lengthUnit)}
        </h3>
        <div className="flex items-center gap-2 shrink-0">
          <VsecAzmControl
            inputStr={azmInputStr}
            naturalAzm={naturalAzm}
            onChange={setAzmInputStr}
            label="View azm:"
          />
          <ZoomControls
            onScaleX={(f) => zoom.scaleAxis("x", f)}
            onScaleY={(f) => zoom.scaleAxis("y", f)}
            onReset={zoom.reset}
            isZoomed={zoom.isZoomed}
          />
        </div>
      </div>
      <div ref={zoom.wrapRef} className="h-[86%] relative">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 10, right: 30, left: 30, bottom: 30 }}
          onMouseMove={(state) => {
            const idx = (state?.activePayload?.[0]?.payload as { i?: number } | undefined)?.i;
            setHoverIdx(typeof idx === "number" ? idx : null);
          }}
          onMouseLeave={() => setHoverIdx(null)}
        >
          {engineeringGrid(zoom.effX, zoom.effY)}
          <XAxis
            dataKey="vsec" type="number" stroke="#475569" fontSize={12}
            domain={zoom.xDomain ?? ["auto", "auto"]}
            allowDataOverflow={zoom.xDomain !== null}
          >
            <Label value={withUnit("Vertical Section", lengthUnit)} position="bottom" offset={10} fill="#475569" />
          </XAxis>
          <YAxis
            dataKey="tvd" type="number" reversed stroke="#475569" fontSize={12}
            domain={zoom.yDomain ?? ["auto", "auto"]}
            allowDataOverflow={zoom.yDomain !== null}
          >
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
          <ChartLegend showKeypoint={kpProjected.length > 0} />
          <Line
            type={smoothLines ? "monotone" : "linear"}
            dataKey="tvd"
            name="Trajectory"
            stroke="#1e40af"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          {/* Keypoints — orange ◆ at every KOP/EOC/Target. Rendered BEFORE
              the start/end markers so the wellhead and last-station markers
              sit on top in case a keypoint coincides with either. */}
          {kpProjected.map((k) => (
            <ReferenceDot
              key={k.key}
              x={k.vsec}
              y={k.tvd}
              ifOverflow="visible"
              isFront
              shape={(props: { cx?: number; cy?: number }) => (
                <KeypointMarker cx={props.cx ?? 0} cy={props.cy ?? 0} label={k.label} />
              )}
            />
          ))}
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
          {/* Live drag-box zoom selection rectangle. */}
          {vsecZoom.selectionArea && (
            <ReferenceArea
              x1={vsecZoom.selectionArea.x1}
              x2={vsecZoom.selectionArea.x2}
              y1={vsecZoom.selectionArea.y1}
              y2={vsecZoom.selectionArea.y2}
              strokeOpacity={0.3}
              fill="#3b82f6"
              fillOpacity={0.1}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
      </div>
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
  keypoints = [],
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
  const planZoom = useChartZoom("ew", "ns", data);
  const hovered: StationDetails | null = hoverIdx !== null && stations[hoverIdx]
    ? toDetails(stations[hoverIdx])
    : null;
  React.useEffect(() => { onHover?.(hovered); }, [hovered, onHover]);

  if (data.length < 2) return <Empty label="Plan View" />;
  const tip = data[data.length - 1];
  const chartCard = (
    <div
      className="flex-1 bg-white border border-gray-200 rounded p-4 h-[500px] min-w-0 relative select-none"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <h3 className="text-sm font-medium text-gray-700 truncate min-w-0">
          Plan View — {withUnit("EW", lengthUnit)} × {withUnit("NS", lengthUnit)}
        </h3>
        <ZoomControls
          onScaleX={(f) => planZoom.scaleAxis("x", f)}
          onScaleY={(f) => planZoom.scaleAxis("y", f)}
          onReset={planZoom.reset}
          isZoomed={planZoom.isZoomed}
        />
      </div>
      <div ref={planZoom.wrapRef} className="h-[90%] relative">
      <ResponsiveContainer width="100%" height="100%">
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
          {engineeringGrid(planZoom.effX, planZoom.effY)}
          <XAxis
            dataKey="ew" type="number" stroke="#475569" fontSize={12}
            domain={planZoom.xDomain ?? ["auto", "auto"]}
            allowDataOverflow={planZoom.xDomain !== null}
          >
            <Label value={withUnit("East-West", lengthUnit)} position="bottom" offset={10} fill="#475569" />
          </XAxis>
          <YAxis
            dataKey="ns" type="number" stroke="#475569" fontSize={12}
            domain={planZoom.yDomain ?? ["auto", "auto"]}
            allowDataOverflow={planZoom.yDomain !== null}
          >
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
          <ChartLegend showKeypoint={keypoints.length > 0} />
          <Line
            type={smoothLines ? "monotone" : "linear"}
            dataKey="ns"
            name="Trajectory"
            stroke="#1e40af"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          {/* Keypoints — orange ◆ at every KOP/EOC/Target. */}
          {keypoints.map((k) => (
            <ReferenceDot
              key={`${k.segmentOrder}-${k.roleIndex}-${k.md}`}
              x={k.ew}
              y={k.ns}
              ifOverflow="visible"
              isFront
              shape={(props: { cx?: number; cy?: number }) => (
                <KeypointMarker
                  cx={props.cx ?? 0}
                  cy={props.cy ?? 0}
                  label={shortKeypointLabel(k.comment)}
                />
              )}
            />
          ))}
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
          {/* Live drag-box zoom selection rectangle. */}
          {planZoom.selectionArea && (
            <ReferenceArea
              x1={planZoom.selectionArea.x1}
              x2={planZoom.selectionArea.x2}
              y1={planZoom.selectionArea.y1}
              y2={planZoom.selectionArea.y2}
              strokeOpacity={0.3}
              fill="#3b82f6"
              fillOpacity={0.1}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
      </div>
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
