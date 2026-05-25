/**
 * 3D field scene: grid surface mesh + well pipes.
 *
 * Replaces Form25 (MESHING) and Form35 (CUBES + Button2Click pipes) from the
 * Delphi original. The grid is rendered as a single THREE.BufferGeometry
 * (triangle pairs per cell) coloured by depth using the project's color ramp.
 * Wells are rendered as TubeGeometry through their station paths.
 *
 * Coordinate convention (Three.js scene units):
 *   x = (world ew - xmin) * horizontalScale
 *   z = (world ns - ymin) * horizontalScale       // grid Y axis → Three Z
 *   y = -(depth - depthMin) * horizontalScale * zScale
 *
 * horizontalScale normalises the longer horizontal dimension to 100 scene
 * units; depthScale = horizontalScale * zScale provides the vertical
 * exaggeration. Stations along a well use the same depth scale so they line
 * up with the surface mesh.
 */

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Grid, Text, Html } from "@react-three/drei";
import * as THREE from "three";
import { gridFromBytes, type GrdFile } from "@dd/grd";
import { sample, type Ramp } from "@dd/grd/colorramp";
import { extractContours, suggestLevels } from "@dd/grd/contour";
import type { GridApiResponse, WellOverlay } from "./MapViewer2D.js";

interface Props {
  grid: GridApiResponse;
  wells?: WellOverlay[];
  /** Vertical exaggeration (default 5×). */
  zScale?: number;
  ramp?: Ramp;
  /** Render iso-depth contour lines etched onto the surface. */
  showContours?: boolean;
  /** Number of evenly-spaced iso levels (default 10). */
  contourLevels?: number;
  /** Show the depth tooltip + marker on mouse hover (default false). */
  showHoverValues?: boolean;
}

/** Scene-space transform shared by the surface mesh and the wells. */
interface SceneTransform {
  xmin: number; ymin: number;     // grid xmin / grid ymin in world units
  horizontalScale: number;        // world-unit → scene-unit factor
  depthScale: number;             // = horizontalScale * zScale
  depthMin: number;               // depth value mapped to scene y=0
  sceneSpan: number;              // size of the horizontal scene footprint (≈100)
}

export function FieldScene3D({
  grid: api, wells, zScale = 5, ramp = "spectrum",
  showContours = true, contourLevels = 10,
  showHoverValues = false,
}: Props) {
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

  const transform: SceneTransform = useMemo(() => {
    const horizontalScale =
      100 / Math.max(grid.xmax - grid.xmin, grid.ymax - grid.ymin);
    return {
      xmin: grid.xmin,
      ymin: grid.ymin,
      horizontalScale,
      depthScale: horizontalScale * zScale,
      depthMin: api.valueMin,
      sceneSpan: 100,
    };
  }, [grid, api.valueMin, zScale]);

  return (
    <div className="border border-gray-200 rounded bg-gradient-to-b from-sky-50 to-white h-[700px] overflow-hidden">
      <Canvas
        shadows
        camera={{ position: [80, 60, 80], fov: 45, near: 0.1, far: 5000 }}
      >
        <Suspense fallback={null}>
          <Scene
            grid={grid} api={api} wells={wells} transform={transform} ramp={ramp}
            showContours={showContours} contourLevels={contourLevels}
            showHoverValues={showHoverValues}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}

function Scene({
  grid, api, wells, transform, ramp, showContours, contourLevels, showHoverValues,
}: {
  grid: GrdFile;
  api: GridApiResponse;
  wells?: WellOverlay[];
  transform: SceneTransform;
  ramp: Ramp;
  showContours: boolean;
  contourLevels: number;
  showHoverValues: boolean;
}) {
  // Width of the scene in X/Z scene units, computed from the actual grid extent.
  const sceneW = (grid.xmax - grid.xmin) * transform.horizontalScale;
  const sceneD = (grid.ymax - grid.ymin) * transform.horizontalScale;
  // Deepest mesh y (positive depth becomes negative y).
  const depthSpan = (api.valueMax - api.valueMin) * transform.depthScale;

  // Hover state: where the cursor intersects the surface mesh, in scene coords.
  // Only updated when `showHoverValues` is on; cleared whenever it toggles off.
  const [hover, setHover] = useState<{
    pos: THREE.Vector3; ew: number; ns: number; depth: number;
  } | null>(null);

  useEffect(() => {
    if (!showHoverValues) setHover(null);
  }, [showHoverValues]);

  function handlePointerMove(e: ThreeEvent<PointerEvent>) {
    if (!showHoverValues) return;
    e.stopPropagation();
    const p = e.point;
    // Invert the scene transform to recover world coords.
    const ew = p.x / transform.horizontalScale + transform.xmin;
    const ns = p.z / transform.horizontalScale + transform.ymin;
    const depth = -p.y / transform.depthScale + transform.depthMin;
    setHover({ pos: p.clone(), ew, ns, depth });
  }
  function handlePointerOut() {
    if (!showHoverValues) return;
    setHover(null);
  }

  const center = useMemo(
    () => new THREE.Vector3(sceneW / 2, -depthSpan / 2, sceneD / 2),
    [sceneW, sceneD, depthSpan]
  );

  const surfaceMesh = useMemo(
    () => buildSurfaceMesh(grid, api.valueMin, api.valueMax, transform, ramp),
    [grid, api.valueMin, api.valueMax, transform, ramp]
  );

  // Iso-depth contour line segments etched on the surface (one LineSegments
  // mesh, all levels in one geometry for cheap rendering).
  const contourLines = useMemo(
    () =>
      showContours
        ? buildContourLines(grid, api.valueMin, api.valueMax, contourLevels, transform)
        : null,
    [grid, api.valueMin, api.valueMax, contourLevels, transform, showContours]
  );

  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[100, 200, 100]} intensity={0.9} castShadow />
      <hemisphereLight args={[0xb0d8ff, 0x80a0a0, 0.45]} />

      <Grid
        position={[center.x, -depthSpan - 1, center.z]}
        args={[Math.max(sceneW, sceneD) + 40, Math.max(sceneW, sceneD) + 40]}
        cellSize={5}
        cellThickness={0.5}
        cellColor="#94a3b8"
        sectionSize={25}
        sectionThickness={1}
        sectionColor="#64748b"
        fadeDistance={600}
      />

      {/* Surface */}
      <mesh
        geometry={surfaceMesh}
        castShadow receiveShadow
        onPointerMove={handlePointerMove}
        onPointerOut={handlePointerOut}
      >
        <meshStandardMaterial vertexColors side={THREE.DoubleSide} metalness={0.05} roughness={0.7} />
      </mesh>

      {/* Hover crosshair + value tooltip */}
      {hover && (
        <>
          <mesh position={hover.pos}>
            <sphereGeometry args={[transform.sceneSpan * 0.005, 12, 12]} />
            <meshBasicMaterial color="#ea580c" />
          </mesh>
          <Html
            position={hover.pos}
            style={{ pointerEvents: "none", transform: "translate(12px, -100%)" }}
          >
            <div
              className="text-xs bg-white/95 border border-gray-300 rounded shadow px-2 py-1 whitespace-nowrap"
              style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif", color: "#0f172a" }}
            >
              <div className="font-semibold">Depth: {hover.depth.toFixed(1)} {api.units}</div>
              <div className="text-gray-500">
                EW {hover.ew.toFixed(0)} · NS {hover.ns.toFixed(0)}
              </div>
            </div>
          </Html>
        </>
      )}

      {/* Contours — drawn as line segments lifted ε above the surface so they
          aren't hidden by z-fighting. polygonOffset on the surface mesh would
          be cleaner but isn't exposed by drei's StandardMaterial wrapper. */}
      {contourLines && (
        <lineSegments geometry={contourLines}>
          <lineBasicMaterial color="#0f172a" transparent opacity={0.55} />
        </lineSegments>
      )}

      {/* Wells */}
      {wells?.map((w) => (
        <WellPipe key={w.id} well={w} grid={grid} transform={transform} />
      ))}

      <CompassMarkers sceneW={sceneW} sceneD={sceneD} />

      <OrbitControls
        target={center}
        enableDamping
        dampingFactor={0.1}
        maxDistance={500}
        minDistance={5}
      />
    </>
  );
}

/** World → scene transformation (single source of truth). */
function toScene(
  ew: number, ns: number, depth: number, t: SceneTransform
): THREE.Vector3 {
  return new THREE.Vector3(
    (ew - t.xmin) * t.horizontalScale,
    -(depth - t.depthMin) * t.depthScale,
    (ns - t.ymin) * t.horizontalScale
  );
}

function WellPipe({
  well, grid, transform,
}: {
  well: WellOverlay; grid: GrdFile; transform: SceneTransform;
}) {
  void grid;

  // The wellhead is at the well's MSL (defaults to 0 = sea level / reference
  // datum). Stations carry their own TVD measured from this wellhead, so
  // absolute depth at each station = wellheadMsl + station.tvd.
  const wellheadMsl = well.msl ?? 0;
  const wellheadPos = useMemo(
    () => toScene(well.ew, well.ns, wellheadMsl, transform),
    [well, wellheadMsl, transform]
  );

  // Build the full curved trajectory by mapping each station's (ew, ns, tvd)
  // through toScene. This is the fix — previously every station was projected
  // onto the formation surface, collapsing the path to a flat 2D ribbon.
  const tube = useMemo(() => {
    if (!well.path || well.path.length < 2) return null;
    const pts = well.path.map((p) =>
      toScene(p.ew, p.ns, wellheadMsl + p.tvd, transform)
    );
    const curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.05);
    // Tube radius scales with the scene's horizontal span so it stays visible
    // on both small 1 km grids and large 30 km fields.
    const radius = transform.sceneSpan * 0.004;
    return new THREE.TubeGeometry(curve, Math.max(64, pts.length * 4), radius, 8, false);
  }, [well.path, wellheadMsl, transform]);

  // Target marker at the deepest station.
  const targetPos = useMemo(() => {
    if (!well.path || well.path.length === 0) return null;
    const last = well.path[well.path.length - 1];
    return toScene(last.ew, last.ns, wellheadMsl + last.tvd, transform);
  }, [well.path, wellheadMsl, transform]);

  const markerR = transform.sceneSpan * 0.012;

  return (
    <>
      {tube && (
        <mesh geometry={tube}>
          <meshStandardMaterial color="#0f172a" metalness={0.4} roughness={0.5} />
        </mesh>
      )}
      <mesh position={wellheadPos}>
        <sphereGeometry args={[markerR, 16, 16]} />
        <meshStandardMaterial color="#facc15" />
      </mesh>
      {targetPos && (
        <mesh position={targetPos}>
          <sphereGeometry args={[markerR * 1.2, 16, 16]} />
          <meshStandardMaterial color="#dc2626" />
        </mesh>
      )}
      <BillboardLabel
        position={[wellheadPos.x, wellheadPos.y + markerR * 3, wellheadPos.z]}
        text={well.name}
      />
    </>
  );
}

function CompassMarkers({ sceneW, sceneD }: { sceneW: number; sceneD: number }) {
  const cx = sceneW / 2;
  const cz = sceneD / 2;
  const r = Math.max(sceneW, sceneD) / 2 + 6;
  return (
    <>
      {[
        { dx: 0, dz: 1, label: "N", color: "#10b981" },
        { dx: 0, dz: -1, label: "S", color: "#10b981" },
        { dx: 1, dz: 0, label: "E", color: "#3b82f6" },
        { dx: -1, dz: 0, label: "W", color: "#3b82f6" },
      ].map((m) => (
        <Text
          key={m.label}
          position={[cx + m.dx * r, 0, cz + m.dz * r]}
          fontSize={4}
          color={m.color}
          anchorX="center"
          anchorY="middle"
        >
          {m.label}
        </Text>
      ))}
    </>
  );
}

function BillboardLabel({
  position, text,
}: {
  position: [number, number, number]; text: string;
}) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ camera }) => {
    ref.current?.lookAt(camera.position);
  });
  return (
    <group ref={ref} position={position}>
      <Text fontSize={2.2} color="#0f172a" outlineWidth={0.05} outlineColor="white">
        {text}
      </Text>
    </group>
  );
}

/**
 * Build a single BufferGeometry whose vertices are the grid cells (two
 * triangles per quad), with per-vertex colors driven by depth.
 *
 * Large grids are bin-downsampled so we don't push millions of triangles to
 * the GPU; aim for ≤ ~256 cells per axis.
 */
function buildSurfaceMesh(
  grid: GrdFile,
  valueMin: number,
  valueMax: number,
  t: SceneTransform,
  ramp: Ramp
): THREE.BufferGeometry {
  const cap = 256;
  const skip = Math.max(1, Math.ceil(Math.max(grid.ncol, grid.nrow) / cap));
  const cols = Math.max(2, Math.floor(grid.ncol / skip));
  const rows = Math.max(2, Math.floor(grid.nrow / skip));

  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const span = valueMax - valueMin || 1;

  const vertIndex = new Int32Array(cols * rows).fill(-1);

  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const c = Math.min(grid.ncol - 1, Math.round((i / (cols - 1)) * (grid.ncol - 1)));
      const r = Math.min(grid.nrow - 1, Math.round((j / (rows - 1)) * (grid.nrow - 1)));
      const v = grid.data[c * grid.nrow + r];
      if (v === grid.errorValue) continue;

      // World coords of this sample, then convert to scene coords via toScene().
      const worldX = grid.xmin + (c * (grid.xmax - grid.xmin)) / (grid.ncol - 1);
      const worldY = grid.ymax - (r * (grid.ymax - grid.ymin)) / (grid.nrow - 1);
      const p = toScene(worldX, worldY, v, t);

      vertIndex[i * rows + j] = positions.length / 3;
      positions.push(p.x, p.y, p.z);
      const tt = (v - valueMin) / span;
      const rgb = sample(ramp, tt);
      colors.push(rgb.r / 255, rgb.g / 255, rgb.b / 255);
    }
  }

  for (let i = 0; i < cols - 1; i++) {
    for (let j = 0; j < rows - 1; j++) {
      const a = vertIndex[i * rows + j];
      const b = vertIndex[(i + 1) * rows + j];
      const c = vertIndex[(i + 1) * rows + (j + 1)];
      const d = vertIndex[i * rows + (j + 1)];
      if (a < 0 || b < 0 || c < 0 || d < 0) continue;
      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

/**
 * Build all iso-depth contour segments as a single LineSegments geometry.
 *
 * The marching-squares extractor returns segments in grid-cell coordinates
 * (col/row, fractional at edge crossings) at a known iso `level`. We turn
 * each segment into a pair of Vector3s in scene coords; the y of each
 * endpoint is the iso level (since by definition the surface crosses that
 * level there). A small ε offset along -y lifts the line just above the
 * surface to avoid z-fighting.
 */
function buildContourLines(
  grid: GrdFile,
  valueMin: number,
  valueMax: number,
  count: number,
  t: SceneTransform
): THREE.BufferGeometry {
  const levels = suggestLevels(valueMin, valueMax, count);
  const isos = extractContours(grid, levels);

  // Convert cell (col, row) → world (ew, ns) once.
  const worldX = (col: number) =>
    grid.xmin + (col * (grid.xmax - grid.xmin)) / (grid.ncol - 1);
  const worldY = (row: number) =>
    grid.ymax - (row * (grid.ymax - grid.ymin)) / (grid.nrow - 1);

  // Tiny upward lift in scene units so lines aren't hidden inside the mesh.
  const lift = t.sceneSpan * 0.0005;

  const positions: number[] = [];
  for (const iso of isos) {
    for (const seg of iso.segments) {
      const a = toScene(worldX(seg.x1), worldY(seg.y1), iso.level, t);
      const b = toScene(worldX(seg.x2), worldY(seg.y2), iso.level, t);
      positions.push(a.x, a.y + lift, a.z, b.x, b.y + lift, b.z);
    }
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return geom;
}
