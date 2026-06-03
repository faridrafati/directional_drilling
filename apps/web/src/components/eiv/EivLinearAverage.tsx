/**
 * EIV "Linear Average" track — port of the per-pad averaged wiggle drawn beside
 * the borehole image (old_fmi_code/Unit7.pas:576,647). For each displayed
 * pad it plots that pad's per-row mean resistivity as a vertical line curve,
 * auto-scaled to its own min/max, one narrow sub-track per pad. Shares the
 * heatmap's `zoomY` and `flip` so depth rows line up with the image and ruler.
 */
import { useEffect, useMemo, useRef, useState } from "react";
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
  // Compute once; reused by the renderer and the hover readout.
  const arr = useMemo(() => padRowAverages(model, pad), [model, pad]);

  const [tip, setTip] = useState<{ x: number; y: number; depth: number; v: number } | null>(null);
  const handleMove = (e: React.MouseEvent) => {
    const canvas = ref.current;
    if (!canvas || h <= 0) { setTip(null); return; }
    const rect = canvas.getBoundingClientRect();
    const cy = Math.floor(((e.clientY - rect.top) / rect.height) * h);
    if (cy < 0 || cy >= h) { setTip(null); return; }
    const row = flip ? h - 1 - cy : cy;
    setTip({ x: e.clientX - rect.left, y: e.clientY - rect.top, depth: model.depths[row], v: arr[row] });
  };

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || h <= 0) return;
    // Render at displayed height (h*zoomY) for a crisp full-resolution curve.
    const outH = Math.max(1, Math.round(h * zoomY));
    canvas.width = width;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, width, outH);
    const rng = range(arr, nullVal);
    if (!rng) return;
    const [lo, hi] = rng;
    const span = hi - lo || 1;
    const yOf = (r: number) => ((flip ? h - 1 - r : r) / Math.max(1, h - 1)) * (outH - 1);
    ctx.strokeStyle = "#2563eb"; // blue linear-average curve
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
  }, [arr, width, h, nullVal, flip, zoomY]);

  return (
    <div className="relative" style={{ width, height: h * zoomY }}>
      <canvas
        ref={ref}
        onMouseMove={handleMove}
        onMouseLeave={() => setTip(null)}
        style={{ width, height: h * zoomY, imageRendering: "auto", display: "block" }}
        className="border-r border-gray-200 bg-white"
      />
      {tip && (
        <div
          className="absolute z-20 pointer-events-none bg-gray-900/90 text-white text-[10px] rounded px-1.5 py-1 whitespace-nowrap shadow"
          style={{ left: tip.x + 12, top: tip.y + 12 }}
        >
          <div>Depth {Number.isFinite(tip.depth) ? tip.depth.toFixed(2) : "—"}</div>
          <div>Pad {pad}: {Number.isFinite(tip.v) && tip.v !== nullVal ? tip.v.toFixed(2) : "NULL"}</div>
        </div>
      )}
    </div>
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
