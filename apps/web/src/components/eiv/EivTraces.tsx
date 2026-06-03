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
import { useEffect, useRef, useState } from "react";
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

/** The trace graphs, in display order (Unit7.pas:645-668). */
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
  { id: "azi", title: "Azimuth", traces: [{ key: "P1AZ", label: "Az", color: "#ea580c" }] }, // orange
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

/** One graph: each trace in the group scaled to its OWN range (so curves with
 *  very different magnitudes — e.g. accel Z ≈ 9.8 vs X/Y ≈ ±1 — all stay
 *  visible), drawn over the depth axis, with per-trace min/max labels. */
function TraceGraph({ model, group, zoomY, width }: {
  model: EivModel; group: TraceGroup; zoomY: number; width: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const h = model.depthCount;
  const nullVal = model.params.nullValue;
  const flip = h > 1 && model.depths[0] > model.depths[h - 1];
  // Per-trace range so each curve fills the width independently.
  const ranges = group.traces.map((t) => {
    const arr = model.aux?.[t.key];
    return arr ? range(arr, nullVal) : null;
  });

  // Cursor-following readout (CSS px within the wrapper) + payload.
  const [tip, setTip] = useState<{ x: number; y: number; depth: number; vals: { label: string; color: string; v: number }[] } | null>(null);

  const handleMove = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas || h <= 0) { setTip(null); return; }
    const rect = canvas.getBoundingClientRect();
    const cy = Math.floor(((e.clientY - rect.top) / rect.height) * h);
    if (cy < 0 || cy >= h) { setTip(null); return; }
    const row = flip ? h - 1 - cy : cy;
    const vals = group.traces.map((t) => ({ label: t.label, color: t.color, v: model.aux?.[t.key]?.[row] ?? NaN }));
    setTip({ x: e.clientX - rect.left, y: e.clientY - rect.top, depth: model.depths[row], vals });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || h <= 0) return;
    // Render at the DISPLAYED height (h*zoomY) so the curve is drawn crisp at
    // full resolution rather than CSS-stretched from an h-pixel-tall buffer.
    const outH = Math.max(1, Math.round(h * zoomY));
    canvas.width = width;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, width, outH);
    const yOf = (r: number) => ((flip ? h - 1 - r : r) / Math.max(1, h - 1)) * (outH - 1);
    group.traces.forEach((t, ti) => {
      const arr = model.aux?.[t.key];
      const rng = ranges[ti];
      if (!arr || !rng) return;
      const [lo, hi] = rng;
      const span = hi - lo || 1;
      ctx.strokeStyle = t.color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      let started = false;
      for (let r = 0; r < h; r++) {
        const v = arr[r];
        if (!Number.isFinite(v) || v === nullVal) { started = false; continue; }
        const x = ((v - lo) / span) * (width - 2) + 1;
        const y = yOf(r);
        if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
      }
      ctx.stroke();
    });
  }, [model, group, h, width, nullVal, flip, zoomY, ranges]);

  // Overall min/max across the group's traces, for the footer labels.
  const footLo = Math.min(...ranges.filter(Boolean).map((r) => r![0]));
  const footHi = Math.max(...ranges.filter(Boolean).map((r) => r![1]));
  const hasRange = ranges.some(Boolean);

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
      <div className="relative" style={{ width, height: h * zoomY }}>
        <canvas
          ref={canvasRef}
          onMouseMove={handleMove}
          onMouseLeave={() => setTip(null)}
          style={{ width, height: h * zoomY, imageRendering: "auto", display: "block" }}
          className="border border-gray-200 bg-white"
        />
        {/* Cursor-following value readout (like the heatmap's point readout). */}
        {tip && (
          <div
            className="absolute z-20 pointer-events-none bg-gray-900/90 text-white text-[10px] rounded px-1.5 py-1 whitespace-nowrap shadow"
            style={{ left: tip.x + 12, top: tip.y + 12 }}
          >
            <div>Depth {Number.isFinite(tip.depth) ? tip.depth.toFixed(2) : "—"}</div>
            {tip.vals.map((t) => (
              <div key={t.label} className="flex items-center gap-1">
                <span className="inline-block w-2 h-0.5" style={{ backgroundColor: t.color }} />
                <span>{t.label}: {Number.isFinite(t.v) && t.v !== nullVal ? t.v.toFixed(2) : "NULL"}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* X-axis value labels: overall min (left) … max (right) of the group.
          (Each trace is auto-scaled to its own range; hover for exact values.) */}
      <div className="flex justify-between text-[9px] text-gray-500 mt-0.5" style={{ width }}>
        <span>{hasRange ? fmt(footLo) : "—"}</span>
        <span>{hasRange ? fmt(footHi) : "—"}</span>
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
