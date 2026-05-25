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

/**
 * Which tool is currently active for map clicks.
 *
 *   "none"           — clicks do nothing (display-only).
 *   "cross-section"  — pick 2 points to define an A→B cross-section line.
 *                      Each click calls `onMapClick(x, y)`.
 *   "place-well"     — single click drops a well at the world coords; fires
 *                      `onPlaceWell(ns, ew)`. Ported from Unit21.pas:1158-1271.
 *   "polygon-clip"   — accumulate vertices; double-click (or Finish button)
 *                      to close the polygon and fire `onPolygonClip(vertices)`.
 *                      Ported from Unit21.pas:1280-1361.
 */
export type MapTool = "none" | "cross-section" | "place-well" | "polygon-clip";

interface Props {
  grid: GridApiResponse;
  ramp?: Ramp;
  contourLevels?: number;
  showContours?: boolean;
  wells?: WellOverlay[];
  showWells?: boolean;
  /** Two-point line picker for cross-section. Coords in world units. */
  crossLine?: [{ ns: number; ew: number }, { ns: number; ew: number }];
  /** Active map tool. Defaults to "cross-section" if onMapClick is given, else "none". */
  tool?: MapTool;
  onMapClick?: (worldX: number, worldY: number) => void;
  /** Fired when the user clicks while `tool === "place-well"`. */
  onPlaceWell?: (ns: number, ew: number) => void;
  /** Fired when the user finishes a polygon (≥3 vertices) while `tool === "polygon-clip"`. */
  onPolygonClip?: (vertices: Array<{ ns: number; ew: number }>) => void;
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
  tool = "cross-section",
  onMapClick,
  onPlaceWell,
  onPolygonClip,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<{ col: number; row: number; v: number } | null>(null);
  // Accumulating polygon vertices for the clip tool. Each click adds one;
  // double-click closes the polygon and fires onPolygonClip.
  const [polygon, setPolygon] = useState<Array<{ ns: number; ew: number }>>([]);

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

    // Polygon-clip outline while building.
    if (tool === "polygon-clip" && polygon.length > 0) {
      ctx.strokeStyle = "rgba(124, 58, 237, 0.95)"; // violet-600
      ctx.fillStyle = "rgba(124, 58, 237, 0.15)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      const [x0, y0] = worldToPx(polygon[0].ew, polygon[0].ns);
      ctx.moveTo(x0, y0);
      for (let p = 1; p < polygon.length; p++) {
        const [px2, py2] = worldToPx(polygon[p].ew, polygon[p].ns);
        ctx.lineTo(px2, py2);
      }
      if (polygon.length >= 3) {
        ctx.closePath();
        ctx.fill();
      }
      ctx.stroke();
      // Vertex markers
      ctx.fillStyle = "rgba(124, 58, 237, 1)";
      for (const v of polygon) {
        const [vx, vy] = worldToPx(v.ew, v.ns);
        ctx.beginPath();
        ctx.arc(vx, vy, 3, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
  }, [grid, showContours, contourLevels, api.valueMin, api.valueMax, w, h, wells, showWells, crossLine, tool, polygon]);

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
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const [worldX, worldY] = pxToWorld(px, py);
    if (tool === "place-well") {
      // worldX is along the EW axis (longitude), worldY is along NS.
      onPlaceWell?.(worldY, worldX);
      return;
    }
    if (tool === "polygon-clip") {
      // Add another vertex; UI shows the polygon outline live.
      setPolygon((prev) => [...prev, { ns: worldY, ew: worldX }]);
      return;
    }
    // Default: cross-section style point pick.
    onMapClick?.(worldX, worldY);
  }

  function onDoubleClick(_e: React.MouseEvent<HTMLCanvasElement>) {
    if (tool === "polygon-clip" && polygon.length >= 3) {
      onPolygonClip?.(polygon);
      setPolygon([]);
    }
  }

  function finishPolygon() {
    if (polygon.length >= 3) {
      onPolygonClip?.(polygon);
      setPolygon([]);
    }
  }
  function cancelPolygon() {
    setPolygon([]);
  }

  const cursor = tool === "none" ? "default" : "crosshair";

  return (
    <div className="flex gap-4">
      <div className="bg-white border border-gray-200 rounded p-2 inline-block relative">
        <canvas
          ref={canvasRef}
          style={{ display: "block", cursor }}
          onMouseMove={onMouseMove}
          onMouseLeave={() => setHover(null)}
          onClick={onClick}
          onDoubleClick={onDoubleClick}
        />
        <canvas
          ref={overlayRef}
          style={{ position: "absolute", left: 8, top: 8, pointerEvents: "none" }}
        />
        {tool === "polygon-clip" && polygon.length > 0 && (
          <div className="absolute top-2 left-2 bg-white/95 border border-violet-300 rounded px-2 py-1 text-xs flex items-center gap-2 shadow">
            <span className="font-medium text-violet-700">
              {polygon.length} vertex{polygon.length === 1 ? "" : "es"}
            </span>
            <button
              onClick={finishPolygon}
              disabled={polygon.length < 3}
              className="px-2 py-0.5 rounded bg-violet-600 text-white text-xs hover:bg-violet-700 disabled:opacity-40"
            >
              Finish ({polygon.length < 3 ? `need ≥ 3` : "double-click ok"})
            </button>
            <button
              onClick={cancelPolygon}
              className="px-2 py-0.5 rounded bg-gray-200 text-gray-700 text-xs hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        )}
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
    <div className="flex flex-col items-start text-xs">
      <div className="font-medium text-gray-700 mb-1">Depth ({unit})</div>
      <div className="flex items-stretch gap-2">
        <div className="w-6 rounded border border-gray-200" style={{ background: grad }} />
        <div className="flex flex-col justify-between text-gray-700 py-0.5">
          {labels.map((v, i) => (
            <div key={i}>
              {v.toFixed(0)} <span className="text-gray-400">{unit}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
