/**
 * Right-side details panel showing every column of a single station /
 * keypoint. Used by both the 3D viewer (on click) and the 2D charts
 * (on hover) so the user gets one consistent inspector across views.
 *
 * Length-typed labels carry the project unit in parens (e.g. "MD (ft)").
 * Angle / rate values include their unit inline so the dt stays compact.
 */
import { rad2deg } from "@dd/shared";

/** Normalize a degree value into [0, 360°) for compass-style display.
 *  Matches `normalizeDeg360` in CalculationPage so the hover panel and the
 *  table show the same azm. */
function normalizeDeg360(deg: number): number {
  if (!Number.isFinite(deg)) return deg;
  const x = deg - 360 * Math.floor(deg / 360);
  return x >= 360 ? 0 : x;
}

export interface StationDetails {
  /** Headline shown at the top of the panel (profile name, role, etc.). */
  label?: string;
  /** Optional subline shown below the headline (e.g. comment). */
  comment?: string;
  /** Optional small uppercase tag on the right of the headline (e.g. "keypoint"). */
  kind?: string;
  md: number;
  inc: number;
  azm: number;
  tvd: number;
  vsec: number;
  ns: number;
  ew: number;
  dls: number;
  tf: number;
  br: number;
  tr: number;
  dmd: number;
}

interface Props {
  point: StationDetails | null;
  /** Project's length unit suffix (defaults to "ft"). */
  lengthUnit?: string;
  /** What to render when no point is selected. */
  emptyState?: React.ReactNode;
  /** Optional Tailwind width override (default "w-72"). */
  widthClass?: string;
}

export function StationDetailsPanel({
  point,
  lengthUnit = "ft",
  emptyState,
  widthClass = "w-72",
}: Props) {
  if (!point) {
    return (
      <div className={`${widthClass} shrink-0 border border-gray-200 rounded bg-white p-4 text-xs text-gray-600 space-y-2 overflow-y-auto`}>
        {emptyState ?? <DefaultEmpty lengthUnit={lengthUnit} />}
      </div>
    );
  }

  // Angles / rates carry their unit inline so the column stays tight; length
  // values get a paren-suffixed unit (MD (ft), TVD (ft), …).
  const len = ` (${lengthUnit})`;
  return (
    <div className={`${widthClass} shrink-0 border border-gray-200 rounded bg-white p-4 text-xs space-y-2 overflow-y-auto`}>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900 truncate">
          {point.label || "Station"}
        </h3>
        {point.kind && (
          <span className="text-[10px] uppercase tracking-wide text-gray-400 shrink-0">
            {point.kind}
          </span>
        )}
      </div>
      {point.comment && point.comment !== point.label && (
        <p className="text-gray-500 italic">{point.comment}</p>
      )}
      <dl className="grid grid-cols-2 gap-x-2 gap-y-1 pt-2">
        <Cell label={`MD${len}`}   value={point.md.toFixed(3)} />
        <Cell label={`DMD${len}`}  value={point.dmd.toFixed(3)} />
        <Cell label="Inc (°)"      value={rad2deg(point.inc).toFixed(2)} />
        <Cell label="Azm (°)"      value={normalizeDeg360(rad2deg(point.azm)).toFixed(2)} />
        <Cell label={`TVD${len}`}  value={point.tvd.toFixed(3)} />
        <Cell label={`VSEC${len}`} value={point.vsec.toFixed(3)} />
        <Cell label={`NS${len}`}   value={point.ns.toFixed(3)} />
        <Cell label={`EW${len}`}   value={point.ew.toFixed(3)} />
        <Cell label="DLS (°/L)"    value={(Math.abs(rad2deg(point.dls)) * 100).toFixed(3)} />
        <Cell label="TF (°)"       value={normalizeDeg360(rad2deg(point.tf)).toFixed(2)} />
        <Cell label="BR (°/L)"     value={(rad2deg(point.br) * 100).toFixed(3)} />
        <Cell label="TR (°/L)"     value={(rad2deg(point.tr) * 100).toFixed(3)} />
      </dl>
    </div>
  );
}

function DefaultEmpty({ lengthUnit }: { lengthUnit: string }) {
  return (
    <>
      <h3 className="text-sm font-semibold text-gray-900">Station details</h3>
      <p className="text-gray-500">
        Hover the chart (or click a marker in the 3D view) to inspect a
        station here.
      </p>
      <p className="pt-2 text-[11px] text-gray-400 italic">
        Distances in {lengthUnit}.
      </p>
    </>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-mono text-gray-900 text-right">{value}</dd>
    </>
  );
}
