/**
 * The shared WELLBORE SCHEMATIC — one component, six reports.
 *
 * 02 and 04 draw it down a narrow left rail, 09 down a left column, 21 as the
 * centre of a composite log, and 24, 28 and 29 as the whole page. It is the
 * same picture at different sizes, so it is one component driven by one server
 * payload rather than five drawings that would drift apart.
 *
 * WHY SVG AND NOT RECHARTS
 * ------------------------
 * A schematic is not a chart: there is no series, no axis pair, and the shapes
 * nest by diameter rather than plotting a value. Recharts would have to be
 * fought the whole way. Hand-drawn SVG is also what makes the PDF path work —
 * `svgRaster.ts` rasterizes exactly this element, the way the charts are
 * captured, so the printed picture is the one on screen.
 *
 * WHAT IT DRAWS, AND WHAT IT REFUSES TO
 * -------------------------------------
 * Depth runs DOWN, linearly, over one scale shared by every track. Casing is
 * nested by outside diameter — widest at surface — so the picture reads as a
 * section rather than a stack of equal boxes. Nothing is invented: a string
 * without a depth never reached the payload, and a payload with nothing in it
 * renders its own reason instead of an empty frame, because "nothing entered"
 * must never look like "nothing there".
 */
import type { SchematicInterval, SchematicPayload } from "../../entry/wellview.js";

/** Ids the PDF exporters find the drawing by — one per report that draws one. */
export const schematicId = (reportType: string) => `wellview-schematic-${reportType}`;

const COLOURS = {
  hole: "#e7e2d8",
  holeEdge: "#a8a093",
  casing: "#9aa4b2",
  casingEdge: "#475569",
  completion: "#fbbf24",
  completionEdge: "#b45309",
  cement: "#b9c7d6",
  cementEdge: "#64748b",
  shoe: "#1f2937",
  formationEdge: "#d1d5db",
} as const;

/** Formation bands, cycled. Muted on purpose — the casing must read on top. */
const FORMATION_FILLS = [
  "#fef3c7", "#e0f2fe", "#dcfce7", "#fae8ff", "#ffe4e6",
  "#f1f5f9", "#fef9c3", "#e0e7ff", "#ccfbf1", "#ffedd5",
];

export interface SchematicScale {
  /** Pixels per metre, and where depth 0 sits. */
  yOf: (depthMkb: number) => number;
  height: number;
}

/**
 * A linear depth scale over the payload's own extent.
 *
 * Rounded OUT to a sensible interval so the axis reads as a scale rather than
 * stopping at whatever the deepest shoe happens to be.
 */
export function schematicScale(maxDepthMkb: number | null, height: number): SchematicScale {
  const deepest = maxDepthMkb && maxDepthMkb > 0 ? maxDepthMkb : 1;
  const step = Math.pow(10, Math.floor(Math.log10(deepest))) / 2;
  const bottom = Math.ceil(deepest / step) * step;
  return {
    height,
    yOf: (d: number) => (Math.max(0, Math.min(d, bottom)) / bottom) * height,
  };
}

/** Tick depths for the scale — at most eight, on round numbers. */
function ticks(maxDepthMkb: number | null): number[] {
  const deepest = maxDepthMkb && maxDepthMkb > 0 ? maxDepthMkb : 1;
  const step = Math.pow(10, Math.floor(Math.log10(deepest))) / 2;
  const bottom = Math.ceil(deepest / step) * step;
  const count = Math.min(8, Math.max(2, Math.round(bottom / step)));
  const interval = bottom / count;
  return Array.from({ length: count + 1 }, (_, i) => Math.round(i * interval));
}

/**
 * Half-width in pixels for an interval of a given diameter.
 *
 * Nested by OD against the widest thing on the picture, with a floor so a
 * 9 5/8" string inside a 36" conductor is still a visible band rather than a
 * line. A missing OD falls back to the narrowest width, which is the honest
 * answer: it is inside everything we can measure.
 */
function halfWidth(odIn: number | null, widestIn: number, maxHalf: number): number {
  const min = Math.max(3, maxHalf * 0.18);
  if (odIn === null || widestIn <= 0) return min;
  const frac = Math.max(0.18, Math.min(1, odIn / widestIn));
  return Math.max(min, maxHalf * frac);
}

export function WellboreSchematic({ payload, width = 260, height = 420, reportType, showFormations = true }: {
  payload: SchematicPayload;
  width?: number;
  height?: number;
  /** Stamps the id the PDF exporter captures this by. */
  reportType: string;
  /** 02's rail has no room for formation bands; 21 and 28 want them. */
  showFormations?: boolean;
}) {
  if (payload.emptyReason) {
    return (
      <div
        id={schematicId(reportType)}
        className="bg-white border border-gray-400 border-t-0 px-2 py-6 text-[11px] text-gray-400 leading-snug"
      >
        {payload.emptyReason}
      </div>
    );
  }

  const scale = schematicScale(payload.maxDepthMkb, height);
  const depthTicks = ticks(payload.maxDepthMkb);

  // The axis takes the left gutter, the formations the right, the hole the
  // middle. The centre line is where the well is.
  const axisW = 44;
  const formationW = showFormations ? Math.min(96, Math.max(60, width * 0.3)) : 0;
  const boreLeft = axisW;
  const boreRight = width - formationW - 6;
  const centre = (boreLeft + boreRight) / 2;
  const maxHalf = Math.max(8, (boreRight - boreLeft) / 2 - 2);

  const widestIn = Math.max(
    1,
    ...payload.holeSections.map((h) => h.odIn ?? 0),
    ...payload.casingStrings.map((c) => c.odIn ?? 0),
  );

  const band = (i: SchematicInterval, half: number, fill: string, stroke: string, key: string) => {
    const y1 = scale.yOf(i.topMkb);
    const y2 = scale.yOf(i.btmMkb);
    return (
      <rect
        key={key} x={centre - half} y={y1} width={half * 2} height={Math.max(1, y2 - y1)}
        fill={fill} stroke={stroke} strokeWidth={0.6}
      />
    );
  };

  return (
    <div id={schematicId(reportType)} className="bg-white border border-gray-400 border-t-0 p-2">
      <svg width={width} height={height + 16} viewBox={`0 0 ${width} ${height + 16}`} role="img"
        aria-label="Wellbore schematic">
        {/* formation bands go down FIRST, so casing and cement read on top */}
        {showFormations && payload.formations.map((f, i) => {
          const y1 = scale.yOf(f.topMkb);
          const y2 = scale.yOf(f.btmMkb);
          return (
            <g key={`fm-${i}`}>
              <rect
                x={boreRight + 6} y={y1} width={Math.max(0, formationW - 6)} height={Math.max(1, y2 - y1)}
                fill={FORMATION_FILLS[i % FORMATION_FILLS.length]}
                stroke={COLOURS.formationEdge} strokeWidth={0.5}
              />
              {y2 - y1 > 9 && (
                <text
                  x={boreRight + 9} y={y1 + Math.min(11, (y2 - y1) / 2 + 3)}
                  fontSize={7} fill="#374151"
                >
                  {(f.label ?? "").slice(0, 16)}
                </text>
              )}
            </g>
          );
        })}

        {/* the open hole each section made */}
        {payload.holeSections.map((h, i) =>
          band(h, halfWidth(h.odIn, widestIn, maxHalf), COLOURS.hole, COLOURS.holeEdge, `hole-${i}`))}

        {/* cement in the annulus — drawn just inside the hole, outside the pipe */}
        {payload.cementIntervals.map((c, i) =>
          band(c, halfWidth(c.odIn, widestIn, maxHalf) * 0.92, COLOURS.cement, COLOURS.cementEdge, `cmt-${i}`))}

        {/* casing, nested by OD — widest at surface */}
        {payload.casingStrings.map((c, i) =>
          band(c, halfWidth(c.odIn, widestIn, maxHalf) * 0.74, COLOURS.casing, COLOURS.casingEdge, `csg-${i}`))}

        {/* the completion string, INSIDE the casing and in its own colour: a
            reader has to be able to tell tubing from the pipe it hangs in */}
        {payload.completionItems.map((c, i) => {
          const half = Math.max(2.5, halfWidth(c.odIn, widestIn, maxHalf) * 0.4);
          const y1 = scale.yOf(c.topMkb);
          const y2 = scale.yOf(c.btmMkb);
          const h = Math.max(1.5, y2 - y1);
          return (
            <g key={`comp-${i}`}>
              <rect
                x={centre - half} y={y1} width={half * 2} height={h}
                fill={COLOURS.completion} stroke={COLOURS.completionEdge} strokeWidth={0.6}
              />
              {/* Short items (a valve, a nipple) are the ones worth naming; a
                  2,300 m tubing run needs no label to be recognised. */}
              {h < 26 && (
                <text x={centre + half + 4} y={y1 + 5} fontSize={6} fill="#78350f">
                  {(c.label ?? "").slice(0, 24)}
                </text>
              )}
            </g>
          );
        })}

        {/* shoes: a mark at a depth, never a band */}
        {payload.shoes.map((s, i) => {
          const y = scale.yOf(s.topMkb);
          const half = halfWidth(s.odIn, widestIn, maxHalf) * 0.74;
          return (
            <g key={`shoe-${i}`}>
              <path
                d={`M ${centre - half} ${y} l ${-4} ${-7} l 8 0 z M ${centre + half} ${y} l 4 ${-7} l -8 0 z`}
                fill={COLOURS.shoe}
              />
              <text x={centre + half + 6} y={y - 1} fontSize={6.5} fill="#111827">
                {s.label ?? ""}
              </text>
            </g>
          );
        })}

        {/* the depth axis */}
        <line x1={axisW - 4} y1={0} x2={axisW - 4} y2={height} stroke="#9ca3af" strokeWidth={0.7} />
        {depthTicks.map((d) => (
          <g key={`t-${d}`}>
            <line x1={axisW - 8} y1={scale.yOf(d)} x2={axisW - 4} y2={scale.yOf(d)} stroke="#9ca3af" strokeWidth={0.7} />
            <text x={axisW - 10} y={scale.yOf(d) + 3} fontSize={7} textAnchor="end" fill="#4b5563">
              {d.toLocaleString("en-US")}
            </text>
          </g>
        ))}
        <text x={2} y={height + 12} fontSize={7} fill="#6b7280">mKB</text>
      </svg>
    </div>
  );
}

/** A one-line key, so the bands are readable without the source. */
export function SchematicLegend() {
  const items: [string, string][] = [
    ["Open hole", COLOURS.hole],
    ["Cement", COLOURS.cement],
    ["Casing", COLOURS.casing],
    ["Completion", COLOURS.completion],
    ["Shoe", COLOURS.shoe],
  ];
  return (
    <div className="border border-t-0 border-gray-400 px-2 py-1 flex flex-wrap gap-3 text-[10px] text-gray-600">
      {items.map(([label, colour]) => (
        <span key={label} className="inline-flex items-center gap-1">
          <span className="inline-block w-3 h-2 border border-gray-400" style={{ background: colour }} />
          {label}
        </span>
      ))}
      <span className="text-gray-400">Depth runs down, to one scale; casing nests by outside diameter.</span>
    </div>
  );
}
