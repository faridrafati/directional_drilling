/**
 * EIV depth × circumference heatmap — port of Unit3.pas imagetwo / imagethree
 * / imagefour (+ draw). Renders one mode (raw / corrected / leveled) of the
 * mat[row][button][pad] tensor to an HTML5 canvas via ImageData.
 *
 * Column layout matches the Pascal: for each displayed pad (in padOrder) we
 * lay its `buttonsPerPad` buttons left-to-right; pads are concatenated. So
 * the image width = buttonsPerPad × (#displayed pads), height = depthCount.
 *
 * The canvas is drawn at native 1 px per (button, depth-row); the parent
 * scales it with CSS (imageRendering: pixelated) via the `zoomX`/`zoomY`
 * props — the same integer pixel-replication Unit13/14/16 did.
 */
import { useEffect, useRef } from "react";
import {
  type EivModel, type EivImageMode, matAt, pointForValue, colorForPoint,
} from "@dd/shared/las";

export interface EivInspect {
  row: number;        // output depth row
  depth: number;      // depth value
  pad: number;        // physical pad (1-based)
  button: number;     // 0-based
  value: number;      // resistivity reading
}

interface Props {
  model: EivModel;
  mode: EivImageMode;
  /** Physical pads to show, in display order (left→right). */
  displayPads: number[];
  zoomX?: number;
  zoomY?: number;
  /** Hover/inspect callback (Unit18 tooltip). */
  onInspect?: (info: EivInspect | null) => void;
  className?: string;
}

export function EivHeatmap({
  model, mode, displayPads, zoomX = 1, zoomY = 1, onInspect, className,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const buttons = model.las.buttonsPerPad;
  const width = buttons * displayPads.length;
  const height = model.depthCount;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width <= 0 || height <= 0) return;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = ctx.createImageData(width, height);
    const nullVal = model.params.nullValue;

    for (let p = 0; p < displayPads.length; p++) {
      const pad = displayPads[p];
      const stats = model.pads[pad];
      if (!stats) continue;
      for (let row = 0; row < height; row++) {
        for (let b = 0; b < buttons; b++) {
          const value = matAt(model, row, b, pad);
          const point = pointForValue(value, mode, stats, nullVal);
          const [r, g, bl] = colorForPoint(point);
          const x = p * buttons + b;
          const idx = (row * width + x) * 4;
          img.data[idx] = r;
          img.data[idx + 1] = g;
          img.data[idx + 2] = bl;
          img.data[idx + 3] = 255;
        }
      }
    }
    ctx.putImageData(img, 0, 0);
  }, [model, mode, displayPads, width, height, buttons]);

  const handleMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onInspect) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    // Map CSS pixels back to native canvas pixels.
    const cx = Math.floor(((e.clientX - rect.left) / rect.width) * width);
    const cy = Math.floor(((e.clientY - rect.top) / rect.height) * height);
    if (cx < 0 || cx >= width || cy < 0 || cy >= height) { onInspect(null); return; }
    const p = Math.floor(cx / buttons);
    const b = cx % buttons;
    const pad = displayPads[p];
    onInspect({
      row: cy,
      depth: model.depths[cy],
      pad,
      button: b,
      value: matAt(model, cy, b, pad),
    });
  };

  return (
    <canvas
      ref={canvasRef}
      className={className}
      onMouseMove={handleMove}
      onMouseLeave={() => onInspect?.(null)}
      style={{
        width: width * zoomX,
        height: height * zoomY,
        imageRendering: "pixelated",
        display: "block",
      }}
    />
  );
}
