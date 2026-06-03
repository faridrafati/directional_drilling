/**
 * EIV side-track line plots — the overlay curves drawn alongside the borehole
 * image (old_fmi_code/Unit7.pas:619-669): average conductivity (mean of the
 * buttons), tri-axial acceleration (FCAX/Y/Z) and gamma ray (GR).
 *
 * The curves are grouped into THREE separate graphs so unrelated quantities
 * don't share a scale: Average Conductivity, Accelerations (X/Y/Z together),
 * and Gamma Ray. Each graph auto-scales to its own range and prints the min /
 * max x-axis values under it. All graphs share the heatmap's `zoomY` so depth
 * rows line up with the image to the left.
 *
 * Rendered only when the relevant aux curves exist on the model (model.aux),
 * i.e. for FMI files — absent for plain EIV PADn[m] logs.
 */
import { useEffect, useRef } from "react";
import type { EivModel } from "@dd/shared/las";

/** One drawable trace: which aux key, a label, and a CSS color. */
export interface TraceDef {
  key: string;
  label: string;
  color: string;
}

/** A graph = a titled group of one or more traces sharing one x-axis scale. */
export interface TraceGroup {
  id: string;
  title: string;
  traces: TraceDef[];
}

/** The three trace graphs, in display order (Unit7.pas:645-668). */
export const TRACE_GROUPS: TraceGroup[] = [
  { id: "cond", title: "Avg Conductivity", traces: [{ key: "CONDSUM", label: "Cond", color: "#6b7280" }] },
  {
    id: "accel", title: "Acceleration", traces: [
      { key: "FCAZ", label: "Z", color: "#dc2626" }, // red
      { key: "FCAY", label: "Y", color: "#16a34a" }, // green
      { key: "FCAX", label: "X", color: "#2563eb" }, // blue
    ],
  },
  { id: "gr", title: "Gamma Ray", traces: [{ key: "GR", label: "GR", color: "#9333ea" }] },
];

/** Finite min/max of an aux array, skipping the null sentinel. */
function range(arr: Float64Array, nullVal: number): [number, number] | null {
  let lo = Infinity, hi = -Infinity;
  for (const v of arr) {
    if (!Number.isFinite(v) || v === nullVal) continue;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  return lo <= hi ? [lo, hi] : null;
}

/** Combined finite range over every trace in a group (shared x scale). */
function groupRange(model: EivModel, traces: TraceDef[], nullVal: number): [number, number] | null {
  let lo = Infinity, hi = -Infinity;
  for (const t of traces) {
    const arr = model.aux?.[t.key];
    if (!arr) continue;
    const r = range(arr, nullVal);
    if (!r) continue;
    if (r[0] < lo) lo = r[0];
    if (r[1] > hi) hi = r[1];
  }
  return lo <= hi ? [lo, hi] : null;
}

/** The trace groups whose curves are present on a model (in display order). */
export function availableTraceGroups(model: EivModel): TraceGroup[] {
  if (!model.aux) return [];
  return TRACE_GROUPS
    .map((g) => ({ ...g, traces: g.traces.filter((t) => model.aux![t.key]) }))
    .filter((g) => g.traces.length > 0);
}

/** True when any trace graph has data to draw. */
export function availableTraces(model: EivModel): TraceDef[] {
  return availableTraceGroups(model).flatMap((g) => g.traces);
}

const fmt = (v: number) => (Number.isFinite(v) ? (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(1)) : "—");

/** One graph: the traces of a group on a shared x scale, with min/max labels. */
function TraceGraph({ model, group, zoomY, width }: {
  model: EivModel; group: TraceGroup; zoomY: number; width: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const h = model.depthCount;
  const nullVal = model.params.nullValue;
  const flip = h > 1 && model.depths[0] > model.depths[h - 1];
  const rng = groupRange(model, group.traces, nullVal);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || h <= 0 || !rng) return;
    canvas.width = width;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, width, h);
    const [lo, hi] = rng;
    const span = hi - lo || 1;
    for (const t of group.traces) {
      const arr = model.aux?.[t.key];
      if (!arr) continue;
      ctx.strokeStyle = t.color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      let started = false;
      for (let r = 0; r < h; r++) {
        const v = arr[r];
        if (!Number.isFinite(v) || v === nullVal) { started = false; continue; }
        const x = ((v - lo) / span) * (width - 2) + 1;
        const y = flip ? h - 1 - r : r;
        if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }, [model, group, h, width, nullVal, flip, rng]);

  return (
    <div className="shrink-0">
      {/* Title + legend (legend only when more than one trace). */}
      <div className="text-[10px] font-medium text-gray-600 text-center" style={{ width }}>{group.title}</div>
      {group.traces.length > 1 && (
        <div className="flex justify-center gap-1.5 text-[9px] mb-0.5" style={{ width }}>
          {group.traces.map((t) => (
            <span key={t.key} className="inline-flex items-center gap-0.5">
              <span className="inline-block w-2 h-0.5" style={{ backgroundColor: t.color }} />
              <span className="text-gray-500">{t.label}</span>
            </span>
          ))}
        </div>
      )}
      <canvas
        ref={canvasRef}
        style={{ width, height: h * zoomY, imageRendering: "auto", display: "block" }}
        className="border border-gray-200 bg-white"
      />
      {/* X-axis value labels: min (left) … max (right). */}
      <div className="flex justify-between text-[9px] text-gray-500 mt-0.5" style={{ width }}>
        <span>{rng ? fmt(rng[0]) : "—"}</span>
        <span>{rng ? fmt(rng[1]) : "—"}</span>
      </div>
    </div>
  );
}

interface Props {
  model: EivModel;
  /** Vertical scale, shared with the heatmap so rows align. */
  zoomY?: number;
  /** Per-graph width in CSS px (default 70). */
  graphWidth?: number;
  className?: string;
}

export function EivTraces({ model, zoomY = 1, graphWidth = 70, className }: Props) {
  const groups = availableTraceGroups(model);
  if (groups.length === 0) return null;
  return (
    <div className={className}>
      <div className="flex gap-2 items-start">
        {groups.map((g) => (
          <TraceGraph key={g.id} model={model} group={g} zoomY={zoomY} width={graphWidth} />
        ))}
      </div>
    </div>
  );
}
