/**
 * 2D field-map viewer.
 *
 * Replaces old_delphi_code/Unit21.pas (Form21) + Unit28.pas (Form28).
 * Renders a parsed grid as a colored raster on HTML5 Canvas, with an
 * optional contour overlay (marching squares) and a colour-bar legend.
 *
 * Coordinate convention: the canvas displays the grid with column 0 at the
 * left edge and row 0 at the top (north → up if YINC is positive, which the
 * .grd YINC sign indicates per Pascal Form21.FormCreate). We do NOT rotate
 * or flip — the user can pick "flip Y" in the UI if the source uses inverted
 * Y axis (mirrors Pascal's `intro[8,mapno2]` portrait/landscape pick).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { gridFromBytes, type GrdFile, type GrdLengthUnit } from "@dd/grd";
import { sample, rampStops, type Ramp } from "@dd/grd/colorramp";
import { extractContours, suggestLevels } from "@dd/grd/contour";

export interface GridApiResponse {
  id: string;
  name: string;
  filename: string;
  xmin: number; xmax: number;
  ymin: number; ymax: number;
  xinc: number; yinc: number;
  ncol: number; nrow: number;
  units: GrdLengthUnit;
  errorVal: number;
  valueMin: number;
  valueMax: number;
  data: string; // base64 Float32Array
}

export interface WellOverlay {
  id: string;
  name: string;
  /** Surface location in world coords (same system as the grid xmin/xmax). */
  ns: number;
  ew: number;
  /** Mean sea level / Kelly bushing depth (positive downward from reference). */
  msl?: number;
  /** Optional trajectory points in world coords. `tvd` is measured from the
   *  wellhead, positive downward, matching the survey-station convention. */
  path?: Array<{ ns: number; ew: number; tvd: number }>;
}

interface Props {
  grid: GridApiResponse;
  ramp?: Ramp;
  contourLevels?: number;
  showContours?: boolean;
  wells?: WellOverlay[];
  showWells?: boolean;
  /** Two-point line picker for cross-section. Coords in world units. */
  crossLine?: [{ ns: number; ew: number }, { ns: number; ew: number }];
  onMapClick?: (worldX: number, worldY: number) => void;
}

const MAX_PIXEL_WIDTH = 900;

export function MapViewer2D({
  grid: api,
  ramp = "spectrum",
  contourLevels = 10,
  showContours = true,
  wells,
  showWells = true,
  crossLine,
  onMapClick,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<{ col: number; row: number; v: number } | null>(null);

  // Decode base64 once.
  const grid: GrdFile = useMemo(() => {
    const bin = atob(api.data);
    const bytes = new Uint8Array(bin.length);
    for (let k = 0; k < bin.length; k++) bytes[k] = bin.charCodeAt(k);
    return gridFromBytes(
      {
        errorValue: api.errorVal, xmin: api.xmin, xmax: api.xmax, ymin: api.ymin, ymax: api.ymax,
        xinc: api.xinc, yinc: api.yinc, ncol: api.ncol, nrow: api.nrow, units: api.units,
      },
      bytes
    );
  }, [api]);

  const pxScale = Math.min(MAX_PIXEL_WIDTH / grid.ncol, MAX_PIXEL_WIDTH / grid.nrow);
  const w = Math.round(grid.ncol * pxScale);
  const h = Math.round(grid.nrow * pxScale);

  // Render raster
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    const img = ctx.createImageData(w, h);
    const { ncol, nrow, errorValue } = grid;
    const { valueMin: min, valueMax: max } = api;
    const span = max - min || 1;

    for (let py = 0; py < h; py++) {
      const row = Math.min(nrow - 1, Math.floor((py / h) * nrow));
      for (let px = 0; px < w; px++) {
        const col = Math.min(ncol - 1, Math.floor((px / w) * ncol));
        const v = grid.data[col * nrow + row];
        const idx = (py * w + px) * 4;
        if (v === errorValue) {
          img.data[idx]     = 255;
          img.data[idx + 1] = 255;
          img.data[idx + 2] = 255;
          img.data[idx + 3] = 0;
        } else {
          const t = (v - min) / span;
          const rgb = sample(ramp, t);
          img.data[idx]     = rgb.r;
          img.data[idx + 1] = rgb.g;
          img.data[idx + 2] = rgb.b;
          img.data[idx + 3] = 255;
        }
      }
    }
    ctx.putImageData(img, 0, 0);
  }, [grid, ramp, w, h, api.valueMin, api.valueMax]);

  // Convert world-coord (ew, ns) to pixel coords. ew → x, ns → y (inverted
  // because canvas Y grows downward but the .grd Y axis grows northward).
  function worldToPx(worldX: number, worldY: number): [number, number] {
    const px = ((worldX - api.xmin) / (api.xmax - api.xmin)) * w;
    const py = h - ((worldY - api.ymin) / (api.ymax - api.ymin)) * h;
    return [px, py];
  }
  function pxToWorld(px: number, py: number): [number, number] {
    const wx = api.xmin + (px / w) * (api.xmax - api.xmin);
    const wy = api.ymin + ((h - py) / h) * (api.ymax - api.ymin);
    return [wx, wy];
  }

  // Render contours + wells + cross-section line on the overlay canvas
  useEffect(() => {
    const canvas = overlayRef.current;
    if (!canvas) return;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, w, h);

    // Contours first (lowest layer of the overlay)
    if (showContours) {
      const levels = suggestLevels(api.valueMin, api.valueMax, contourLevels);
      const isos = extractContours(grid, levels);
      const sx = w / grid.ncol;
      const sy = h / grid.nrow;
      ctx.lineWidth = 0.8;
      ctx.font = "11px sans-serif";
      ctx.fillStyle = "rgba(15,23,42,0.85)";
      ctx.strokeStyle = "rgba(15,23,42,0.45)";
      for (const iso of isos) {
        ctx.beginPath();
        for (const seg of iso.segments) {
          ctx.moveTo(seg.x1 * sx, seg.y1 * sy);
          ctx.lineTo(seg.x2 * sx, seg.y2 * sy);
        }
        ctx.stroke();
        const step = Math.max(1, Math.floor(iso.segments.length / 6));
        for (let k = 0; k < iso.segments.length; k += step) {
          const s = iso.segments[k];
          const mx = ((s.x1 + s.x2) / 2) * sx;
          const my = ((s.y1 + s.y2) / 2) * sy;
          ctx.fillText(iso.level.toFixed(0), mx, my);
        }
      }
    }

    // Wells overlay
    if (showWells && wells && wells.length > 0) {
      ctx.font = "11px sans-serif";
      for (const well of wells) {
        const [wx, wy] = worldToPx(well.ew, well.ns);
        // Path (if any)
        if (well.path && well.path.length > 1) {
          ctx.strokeStyle = "rgba(15, 64, 175, 0.9)";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          for (let i = 0; i < well.path.length; i++) {
            const [pxh, pyh] = worldToPx(well.path[i].ew, well.path[i].ns);
            if (i === 0) ctx.moveTo(pxh, pyh);
            else ctx.lineTo(pxh, pyh);
          }
          ctx.stroke();
        }
        // Surface triangle marker (Pascal pt/pt2 polygon, simplified).
        ctx.fillStyle = "rgba(220, 38, 38, 0.95)";
        ctx.strokeStyle = "rgba(15,23,42,0.9)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(wx, wy - 9);
        ctx.lineTo(wx - 6, wy + 4);
        ctx.lineTo(wx + 6, wy + 4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Label above
        ctx.fillStyle = "rgba(15,23,42,0.95)";
        const tw = ctx.measureText(well.name).width;
        ctx.fillText(well.name, wx - tw / 2, wy - 12);
      }
    }

    // Cross-section line
    if (crossLine) {
      const [a, b] = crossLine;
      const [ax, ay] = worldToPx(a.ew, a.ns);
      const [bx, by] = worldToPx(b.ew, b.ns);
      ctx.strokeStyle = "rgba(234, 88, 12, 0.95)";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
      ctx.fillStyle = "rgba(234, 88, 12, 0.95)";
      ctx.fillText("A", ax + 4, ay - 4);
      ctx.fillText("B", bx + 4, by - 4);
    }
  }, [grid, showContours, contourLevels, api.valueMin, api.valueMax, w, h, wells, showWells, crossLine]);

  function onMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const col = Math.floor((px / w) * grid.ncol);
    const row = Math.floor((py / h) * grid.nrow);
    if (col < 0 || col >= grid.ncol || row < 0 || row >= grid.nrow) {
      setHover(null);
      return;
    }
    const v = grid.data[col * grid.nrow + row];
    setHover({ col, row, v: v === grid.errorValue ? NaN : v });
  }

  function onClick(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!onMapClick) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const [wx, wy] = pxToWorld(px, py);
    onMapClick(wx, wy);
  }

  return (
    <div className="flex gap-4">
      <div className="bg-white border border-gray-200 rounded p-2 inline-block relative">
        <canvas
          ref={canvasRef}
          style={{ display: "block", cursor: onMapClick ? "crosshair" : "default" }}
          onMouseMove={onMouseMove}
          onMouseLeave={() => setHover(null)}
          onClick={onClick}
        />
        <canvas
          ref={overlayRef}
          style={{ position: "absolute", left: 8, top: 8, pointerEvents: "none" }}
        />
      </div>

      <Legend min={api.valueMin} max={api.valueMax} ramp={ramp} unit={api.units} />

      {hover && (
        <div className="text-xs bg-white border border-gray-200 rounded p-3 self-start">
          <div className="font-medium mb-1">Cursor</div>
          <div>col: {hover.col}, row: {hover.row}</div>
          <div>
            x = {(api.xmin + hover.col * api.xinc).toFixed(1)} {api.units}
          </div>
          <div>
            y = {(api.ymin + hover.row * api.yinc).toFixed(1)} {api.units}
          </div>
          <div className="mt-1 font-medium">
            value:{" "}
            {isNaN(hover.v) ? <span className="text-gray-400">null</span> : hover.v.toFixed(2)}
          </div>
        </div>
      )}
    </div>
  );
}

function Legend({ min, max, ramp, unit }: { min: number; max: number; ramp: Ramp; unit: string }) {
  const stops = rampStops(ramp);
  const grad = `linear-gradient(to bottom, ${stops
    .slice()
    .reverse()
    .map((s) => `rgb(${s.r}, ${s.g}, ${s.b})`)
    .join(", ")})`;

  const ticks = 6;
  const labels = Array.from({ length: ticks }, (_, i) => max - (i * (max - min)) / (ticks - 1));

  return (
    <div className="flex items-stretch gap-2">
      <div className="w-6 rounded border border-gray-200" style={{ background: grad }} />
      <div className="flex flex-col justify-between text-xs text-gray-700 py-0.5">
        {labels.map((v, i) => (
          <div key={i}>
            {v.toFixed(0)} <span className="text-gray-400">{unit}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
