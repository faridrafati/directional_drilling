/**
 * EIV side-track line plots — port of the overlay curves the legacy GEOMANCY
 * tool drew alongside the borehole image (old_fmi_code/Unit7.pas:619-669):
 * conductivity (mean of the 192 buttons), tri-axial acceleration (FCAX/Y/Z) and
 * gamma ray (GR). Each enabled trace is auto-scaled to its own min/max across
 * the log and drawn as a colored polyline in a narrow track. The track shares
 * the heatmap's `zoomY` so depth rows line up with the image to its left.
 *
 * Rendered only when the relevant aux curves exist on the model (model.aux),
 * i.e. for FMI files — it is absent for plain EIV PADn[m] logs.
 */
import { useEffect, useRef } from "react";
import type { EivModel } from "@dd/shared/las";

/** One drawable trace: which aux key, a label, and a CSS color. */
export interface TraceDef {
  key: string;
  label: string;
  color: string;
}

/** The traces we know how to draw, in display order (Unit7.pas:645-668). */
export const TRACE_DEFS: TraceDef[] = [
  { key: "CONDSUM", label: "Cond", color: "#6b7280" }, // conductivity — grey
  { key: "FCAZ", label: "Acc Z", color: "#dc2626" },   // red
  { key: "FCAY", label: "Acc Y", color: "#16a34a" },   // green
  { key: "FCAX", label: "Acc X", color: "#2563eb" },   // blue
  { key: "GR", label: "GR", color: "#9333ea" },        // gamma — purple
];

interface Props {
  model: EivModel;
  /** Vertical scale, shared with the heatmap so rows align. */
  zoomY?: number;
  /** Track width in CSS px (default 90). */
  width?: number;
  /** Which trace keys to draw (defaults to every available trace). */
  enabled?: string[];
  className?: string;
}

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

/** The aux trace keys actually present on a model (in display order). */
export function availableTraces(model: EivModel): TraceDef[] {
  if (!model.aux) return [];
  return TRACE_DEFS.filter((d) => model.aux![d.key]);
}

export function EivTraces({ model, zoomY = 1, width = 90, enabled, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const h = model.depthCount;
  const nullVal = model.params.nullValue;
  const defs = availableTraces(model).filter((d) => !enabled || enabled.includes(d.key));

  // Same vertical flip the heatmap uses (deepest-first files render upside down).
  const flip = model.depthCount > 1 && model.depths[0] > model.depths[model.depthCount - 1];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || h <= 0 || defs.length === 0) return;
    canvas.width = width;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, width, h);

    for (const def of defs) {
      const arr = model.aux![def.key];
      const rng = range(arr, nullVal);
      if (!rng) continue;
      const [lo, hi] = rng;
      const span = hi - lo || 1;
      ctx.strokeStyle = def.color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      let started = false;
      for (let r = 0; r < h; r++) {
        const v = arr[r];
        if (!Number.isFinite(v) || v === nullVal) { started = false; continue; }
        const x = ((v - lo) / span) * (width - 2) + 1;
        const y = flip ? h - 1 - r : r;
        if (!started) { ctx.moveTo(x, y); started = true; }
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }, [model, defs, h, width, nullVal, flip]);

  if (defs.length === 0) return null;

  return (
    <div className={className}>
      {/* Legend */}
      <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[9px] mb-0.5" style={{ width: width * 1 }}>
        {defs.map((d) => (
          <span key={d.key} className="inline-flex items-center gap-0.5">
            <span className="inline-block w-2 h-0.5" style={{ backgroundColor: d.color }} />
            <span className="text-gray-500">{d.label}</span>
          </span>
        ))}
      </div>
      <canvas
        ref={canvasRef}
        style={{ width, height: h * zoomY, imageRendering: "auto", display: "block" }}
        className="border border-gray-200 bg-white"
      />
    </div>
  );
}
