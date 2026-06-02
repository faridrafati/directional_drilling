/**
 * EIV depth × circumference heatmap — port of Unit3.pas imagetwo / imagethree
 * / imagefour (+ draw), with the Unit18 floating point-readout and the
 * Unit13/Image2MouseDown-Up rubber-band "zoom to a range" selection.
 *
 * Column layout matches the Pascal: each displayed pad lays its
 * `buttonsPerPad` buttons left→right; pads are concatenated. Native image
 * width = buttonsPerPad × #pads, height = depthCount, scaled by zoomX/zoomY
 * (pixelated).
 *
 * `region` clips rendering to a native-pixel sub-rectangle so a zoom window
 * can show just the selected depth × pad-button range at a larger scale.
 */
import { useEffect, useRef, useState } from "react";
import {
  type EivModel, type EivImageMode, matAt, pointForValue, colorForPoint,
} from "@dd/shared/las";

export interface EivInspect {
  row: number; depth: number; pad: number; button: number; value: number;
}
/** Native-pixel sub-rectangle: x in [x0,x1), y (depth row) in [y0,y1). */
export interface EivRegion { x0: number; y0: number; x1: number; y1: number }

interface Props {
  model: EivModel;
  mode: EivImageMode;
  displayPads: number[];
  zoomX?: number;
  zoomY?: number;
  /** Restrict rendering to this native-pixel window (zoom view). */
  region?: EivRegion;
  /** Hover readout (Unit18). Also drives the floating tooltip. */
  onInspect?: (info: EivInspect | null) => void;
  /** Enable left-drag rubber-band selection → fires with the picked region. */
  onSelectRegion?: (region: EivRegion) => void;
  /** Show the floating tooltip near the cursor (default true). */
  floatingTooltip?: boolean;
  /**
   * Optional per-output-row pad-1 azimuth (degrees). When supplied, each
   * scanline is rotated horizontally so the image is compass-oriented
   * (old_fmi_code/Unit7.pas:609-611). Omit (the default) for an unrotated image.
   */
  azimuth?: Float64Array;
  className?: string;
}

export function EivHeatmap({
  model, mode, displayPads, zoomX = 1, zoomY = 1, region,
  onInspect, onSelectRegion, floatingTooltip = true, azimuth, className,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const buttons = model.las.buttonsPerPad;
  const fullW = buttons * displayPads.length;
  const fullH = model.depthCount;

  // Render window (native px). Defaults to the whole image.
  const x0 = region ? Math.max(0, region.x0) : 0;
  const y0 = region ? Math.max(0, region.y0) : 0;
  const x1 = region ? Math.min(fullW, region.x1) : fullW;
  const y1 = region ? Math.min(fullH, region.y1) : fullH;
  const w = Math.max(0, x1 - x0);
  const h = Math.max(0, y1 - y0);

  // Depth orientation. LAS multi-pad logs are commonly stored deepest-first
  // (negative STEP: row 0 = STRT = deepest). Well-log convention puts the
  // NUMERICALLY LARGER depth at the BOTTOM, so flip the vertical mapping when
  // row 0 is deeper than the last row. (Ascending files render unchanged.)
  const flip = model.depthCount > 1 && model.depths[0] > model.depths[model.depthCount - 1];
  /** Data row gy → screen scanline (0 = top), honouring `flip`. */
  const screenRow = (gy: number) => (flip ? y1 - 1 - gy : gy - y0);

  // Cursor-following tooltip state (CSS px within the wrapper) + payload.
  const [tip, setTip] = useState<{ x: number; y: number; info: EivInspect } | null>(null);
  // Rubber-band selection rectangle (CSS px within the wrapper).
  const [sel, setSel] = useState<{ ax: number; ay: number; bx: number; by: number } | null>(null);
  const dragging = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || w <= 0 || h <= 0) return;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = ctx.createImageData(w, h);
    const nullVal = model.params.nullValue;

    // Per-row azimuth rotation (Unit7.pas:609-611): shift the source column by
    // a fraction of the full circumference. Wraps around the whole image width.
    const oriented = azimuth != null && fullW > 0;
    for (let gy = y0; gy < y1; gy++) {
      const shift = oriented && Number.isFinite(azimuth![gy])
        ? ((Math.round((azimuth![gy] / 360) * fullW) % fullW) + fullW) % fullW
        : 0;
      for (let gx = x0; gx < x1; gx++) {
        // Screen column gx samples source column (gx+shift) mod fullW.
        const sx = oriented ? (gx + shift) % fullW : gx;
        const p = Math.floor(sx / buttons);
        const b = sx % buttons;
        const pad = displayPads[p];
        const stats = pad != null ? model.pads[pad] : undefined;
        let r = 0, g = 0, bl = 255;
        if (stats) {
          const value = matAt(model, gy, b, pad);
          [r, g, bl] = colorForPoint(pointForValue(value, mode, stats, nullVal));
        }
        const idx = (screenRow(gy) * w + (gx - x0)) * 4;
        img.data[idx] = r; img.data[idx + 1] = g; img.data[idx + 2] = bl; img.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }, [model, mode, displayPads, buttons, x0, y0, x1, y1, w, h, flip, azimuth, fullW]);

  /** CSS-pixel cursor → native global (gx, gy) within the rendered window. */
  function toNative(e: React.MouseEvent): { gx: number; gy: number } | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const cx = Math.floor(((e.clientX - rect.left) / rect.width) * w);
    const cy = Math.floor(((e.clientY - rect.top) / rect.height) * h);
    if (cx < 0 || cx >= w || cy < 0 || cy >= h) return null;
    return { gx: x0 + cx, gy: flip ? y0 + (h - 1 - cy) : y0 + cy };
  }

  function inspectAt(gx: number, gy: number): EivInspect | null {
    // Apply the same per-row azimuth shift the renderer used, so the readout
    // names the button actually drawn under the cursor.
    let sx = gx;
    if (azimuth != null && fullW > 0 && Number.isFinite(azimuth[gy])) {
      const shift = ((Math.round((azimuth[gy] / 360) * fullW) % fullW) + fullW) % fullW;
      sx = (gx + shift) % fullW;
    }
    const p = Math.floor(sx / buttons);
    const b = sx % buttons;
    const pad = displayPads[p];
    if (pad == null) return null;
    return { row: gy, depth: model.depths[gy], pad, button: b, value: matAt(model, gy, b, pad) };
  }

  const handleMove = (e: React.MouseEvent) => {
    const n = toNative(e);
    if (!n) { onInspect?.(null); setTip(null); return; }
    const info = inspectAt(n.gx, n.gy);
    onInspect?.(info);
    if (dragging.current) {
      const rect = canvasRef.current!.getBoundingClientRect();
      setSel((s) => s ? { ...s, bx: e.clientX - rect.left, by: e.clientY - rect.top } : s);
    }
    if (floatingTooltip && info) {
      const rect = canvasRef.current!.getBoundingClientRect();
      setTip({ x: e.clientX - rect.left, y: e.clientY - rect.top, info });
    }
  };

  const handleDown = (e: React.MouseEvent) => {
    if (!onSelectRegion || e.button !== 0) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    dragging.current = true;
    setSel({ ax: e.clientX - rect.left, ay: e.clientY - rect.top, bx: e.clientX - rect.left, by: e.clientY - rect.top });
  };

  const handleUp = (e: React.MouseEvent) => {
    if (!dragging.current || !onSelectRegion) { dragging.current = false; return; }
    dragging.current = false;
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const s = sel;
    setSel(null);
    if (!s) return;
    // Map both corners (CSS) → native global pixels, then normalise.
    const toG = (cssX: number, cssY: number) => {
      const cx = Math.floor((cssX / rect.width) * w);
      const cy = Math.floor((cssY / rect.height) * h);
      const ccx = Math.min(w - 1, Math.max(0, cx));
      const ccy = Math.min(h - 1, Math.max(0, cy));
      return { gx: x0 + ccx, gy: flip ? y0 + (h - 1 - ccy) : y0 + ccy };
    };
    const a = toG(s.ax, s.ay);
    const b = toG(e.clientX - rect.left, e.clientY - rect.top);
    const rx0 = Math.min(a.gx, b.gx), rx1 = Math.max(a.gx, b.gx) + 1;
    const ry0 = Math.min(a.gy, b.gy), ry1 = Math.max(a.gy, b.gy) + 1;
    // Ignore trivial clicks (need a real box).
    if (rx1 - rx0 < 2 || ry1 - ry0 < 2) return;
    onSelectRegion({ x0: rx0, y0: ry0, x1: rx1, y1: ry1 });
  };

  return (
    <div className="relative" style={{ width: w * zoomX, height: h * zoomY }}>
      <canvas
        ref={canvasRef}
        className={className}
        onMouseMove={handleMove}
        onMouseDown={handleDown}
        onMouseUp={handleUp}
        onMouseLeave={() => { onInspect?.(null); setTip(null); if (dragging.current) { dragging.current = false; setSel(null); } }}
        style={{
          width: w * zoomX, height: h * zoomY,
          imageRendering: "pixelated", display: "block",
          cursor: onSelectRegion ? "crosshair" : "default",
        }}
      />
      {/* Rubber-band selection box. */}
      {sel && (
        <div
          className="absolute border border-blue-500 bg-blue-400/20 pointer-events-none"
          style={{
            left: Math.min(sel.ax, sel.bx),
            top: Math.min(sel.ay, sel.by),
            width: Math.abs(sel.bx - sel.ax),
            height: Math.abs(sel.by - sel.ay),
          }}
        />
      )}
      {/* Floating point readout near the cursor (Unit18). */}
      {tip && (
        <div
          className="absolute z-20 pointer-events-none bg-gray-900/90 text-white text-[10px] rounded px-1.5 py-1 whitespace-nowrap shadow"
          style={{ left: tip.x + 12, top: tip.y + 12 }}
        >
          <div>Depth {tip.info.depth.toFixed(2)}</div>
          <div>Pad {tip.info.pad} · Button {tip.info.button}</div>
          <div>{Number.isFinite(tip.info.value) ? tip.info.value.toFixed(3) : "NULL"}</div>
        </div>
      )}
    </div>
  );
}
