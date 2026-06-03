/**
 * EIV "Linear Average" track — port of the per-pad averaged wiggle drawn beside
 * the borehole image (old_fmi_code/Unit7.pas:576,647). For each displayed
 * pad it plots that pad's per-row mean resistivity as a vertical line curve,
 * auto-scaled to its own min/max, one narrow sub-track per pad. Shares the
 * heatmap's `zoomY` and `flip` so depth rows line up with the image and ruler.
 */
import { useEffect, useRef } from "react";
import { type EivModel, padRowAverages } from "@dd/shared/las";

interface Props {
  model: EivModel;
  displayPads: number[];
  /** Vertical scale, shared with the heatmap so rows align. */
  zoomY?: number;
  /** Per-pad sub-track width in CSS px (default 46). */
  padWidth?: number;
  className?: string;
}

/** Finite min/max of an array, skipping the null sentinel. */
function range(arr: Float64Array, nullVal: number): [number, number] | null {
  let lo = Infinity, hi = -Infinity;
  for (const v of arr) {
    if (!Number.isFinite(v) || v === nullVal) continue;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  return lo <= hi ? [lo, hi] : null;
}

/** A single pad's averaged wiggle, drawn to its own canvas. */
function PadWiggle({ model, pad, zoomY, width }: { model: EivModel; pad: number; zoomY: number; width: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const h = model.depthCount;
  const nullVal = model.params.nullValue;
  const flip = h > 1 && model.depths[0] > model.depths[h - 1];

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || h <= 0) return;
    canvas.width = width;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, width, h);
    const arr = padRowAverages(model, pad);
    const rng = range(arr, nullVal);
    if (!rng) return;
    const [lo, hi] = rng;
    const span = hi - lo || 1;
    ctx.strokeStyle = "#2563eb"; // blue linear-average curve
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
  }, [model, pad, width, h, nullVal, flip]);

  return (
    <canvas
      ref={ref}
      style={{ width, height: h * zoomY, imageRendering: "auto", display: "block" }}
      className="border-r border-gray-200 bg-white"
    />
  );
}

export function EivLinearAverage({ model, displayPads, zoomY = 1, padWidth = 46, className }: Props) {
  if (displayPads.length === 0 || model.las.buttonsPerPad === 0) return null;
  return (
    <div className={className}>
      <div className="flex border-l border-gray-200">
        {displayPads.map((pad) => (
          <PadWiggle key={pad} model={model} pad={pad} zoomY={zoomY} width={padWidth} />
        ))}
      </div>
    </div>
  );
}

/** Whether the Linear Average track has anything to draw for this model. */
export function hasLinearAverage(model: EivModel): boolean {
  return model.las.padCount > 0 && model.las.buttonsPerPad > 0;
}
