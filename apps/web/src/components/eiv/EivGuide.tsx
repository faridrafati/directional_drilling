/**
 * EIV "Guide of Image" track — port of GEOMANCY's per-pad colour-scale guide
 * (old_fmi_code/Unit7.pas:344-351, 427-451). For each displayed pad it draws a
 * vertical white→yellow→red→black ramp annotated with that pad's resistivity
 * values, plus an inline stats box: No. of Data / Abs Min / Abs Max / Min after
 * Cut off. Vertical extent matches the heatmap (depthCount × zoomY) and honours
 * the same deepest-first `flip` as the depth ruler.
 */
import { useEffect, useRef } from "react";
import { type EivModel, colorForPoint } from "@dd/shared/las";

interface Props {
  model: EivModel;
  displayPads: number[];
  zoomY?: number;
  /** Width (CSS px) of each pad's ramp strip (default 18). */
  rampWidth?: number;
  className?: string;
}

const fmt = (v: number) => (Number.isFinite(v) ? v.toFixed(0) : "—");

/** One pad's vertical WYRB ramp (high resistivity at top → low at bottom). */
function PadRamp({ height, width, flip }: { height: number; width: number; flip: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || height <= 0) return;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = ctx.createImageData(width, height);
    for (let y = 0; y < height; y++) {
      // Top = high colour-point (768, dark) → bottom = low (1, white); flip
      // mirrors the depth axis so "high resistivity" sits where the image puts it.
      const t = y / Math.max(1, height - 1);
      const point = flip ? 1 + t * 767 : 768 - t * 767;
      const [r, g, b] = colorForPoint(point);
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        img.data[idx] = r; img.data[idx + 1] = g; img.data[idx + 2] = b; img.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }, [height, width, flip]);
  return <canvas ref={ref} style={{ width, height, display: "block" }} className="border border-gray-300" />;
}

/** A single pad's guide: value-labelled ramp + stats box. */
function PadGuide({ model, pad, heightPx, rampWidth, flip }: {
  model: EivModel; pad: number; heightPx: number; rampWidth: number; flip: boolean;
}) {
  const s = model.pads[pad];
  if (!s) return null;
  // Ramp value labels: top = high (clipHigh/max), bottom = low (clipLow/min).
  const hiVal = Number.isFinite(s.clipHigh) ? s.clipHigh : s.max;
  const loVal = Number.isFinite(s.clipLow) ? s.clipLow : s.min;
  const ticks = 4;
  const labels = Array.from({ length: ticks + 1 }, (_, i) => {
    const frac = i / ticks; // 0 = top
    const v = hiVal - frac * (hiVal - loVal);
    return { top: frac * heightPx, v };
  });
  return (
    <div className="shrink-0 mr-3">
      <div className="text-[10px] font-medium text-gray-600 text-center mb-0.5">Pad {pad}</div>
      <div className="flex">
        <PadRamp height={heightPx} width={rampWidth} flip={flip} />
        <div className="relative ml-1 text-[9px] text-gray-500" style={{ width: 42, height: heightPx }}>
          {labels.map((l, i) => (
            <div key={i} className="absolute -translate-y-1/2 whitespace-nowrap" style={{ top: l.top }}>
              {fmt(l.v)}
            </div>
          ))}
        </div>
      </div>
      {/* Per-pad stats box (Unit7.pas:344-351). */}
      <div className="mt-1 text-[9px] text-gray-600 leading-tight border border-gray-200 rounded px-1 py-0.5 bg-gray-50">
        <div>N: {s.count.toLocaleString()}</div>
        <div>Min: {fmt(s.min)}</div>
        <div>Max: {fmt(s.max)}</div>
        <div>Cut: {fmt(s.clipLow)}</div>
      </div>
    </div>
  );
}

export function EivGuide({ model, displayPads, zoomY = 1, rampWidth = 18, className }: Props) {
  if (displayPads.length === 0) return null;
  const heightPx = Math.max(1, model.depthCount * zoomY);
  const flip = model.depthCount > 1 && model.depths[0] > model.depths[model.depthCount - 1];
  return (
    <div className={className}>
      <div className="flex">
        {displayPads.map((pad) => (
          <PadGuide key={pad} model={model} pad={pad} heightPx={heightPx} rampWidth={rampWidth} flip={flip} />
        ))}
      </div>
    </div>
  );
}
