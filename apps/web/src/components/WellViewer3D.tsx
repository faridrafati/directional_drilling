/**
 * 3D wellbore viewer (React Three Fiber).
 *
 * Replaces old_delphi_code/Unit03.pas (Form03) — the GLScene-based 3D viewer.
 * Renders the station path as a tube, plus a clickable sphere at every
 * keypoint (KOP / EOC / Target / EOC#1 / KOP#2 / ...) so the user can
 * inspect each milestone's exact values in a side legend.
 *
 * Coordinate mapping (oilfield → Three.js):
 *   ew  →  +x
 *   tvd →  -y   (depth grows downward visually)
 *   ns  →  +z
 *
 * Auto-scales the camera based on the well's bounding box so the whole path
 * fits whatever its absolute size (a 200 m vertical pilot well or a 10 km
 * extended-reach well render alike).
 *
 * Interaction:
 *   - Each keypoint renders as a clickable colored sphere.
 *   - Clicking a sphere (or the wellhead / target endpoints) populates the
 *     right-hand legend with all of that point's values: MD, Inc, Azm, TVD,
 *     VSEC, NS, EW, DLS, TF, BR, TR, DMD.
 *   - Clicking empty space deselects (returns the legend to a key/usage hint).
 */
import { Suspense, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Grid, Text } from "@react-three/drei";
import * as THREE from "three";
import type { StationRow, KeypointRow } from "../api/client.js";
import { rad2deg } from "@dd/shared";

interface Props {
  stations: StationRow[];
  /** Algebraic milestone points (KOP/EOC/Target/...). Rendered as clickable spheres. */
  keypoints?: KeypointRow[];
}

/**
 * Common shape consumed by the side legend, used for both clickable
 * keypoints and the start/end implicit points.
 */
interface PickedPoint {
  kind: "wellhead" | "target" | "keypoint";
  label: string;       // e.g. "KOP (Hold-Curve 3D*)"
  comment: string;
  md: number; inc: number; azm: number; tvd: number; vsec: number;
  ns: number; ew: number; dls: number; tf: number;
  br: number; tr: number; dmd: number;
}

export function WellViewer3D({ stations, keypoints = [] }: Props) {
  const [selected, setSelected] = useState<PickedPoint | null>(null);

  if (stations.length < 2) {
    return (
      <div className="border border-gray-200 rounded bg-white h-[600px] grid place-items-center text-gray-400 text-sm">
        Calculate the trajectory to see the 3D view.
      </div>
    );
  }
  return (
    <div className="flex gap-3 h-[600px]">
      {/* 3D canvas */}
      <div className="flex-1 border border-gray-200 rounded bg-gradient-to-b from-sky-50 to-white overflow-hidden">
        <Canvas
          shadows
          camera={{ position: [50, 50, 50], fov: 45, near: 0.1, far: 100000 }}
          onPointerMissed={() => setSelected(null)}
        >
          <Suspense fallback={null}>
            <Scene
              stations={stations}
              keypoints={keypoints}
              onPick={setSelected}
              selectedKey={selected ? selectedKey(selected) : null}
            />
          </Suspense>
        </Canvas>
      </div>

      {/* Side legend */}
      <PointLegend point={selected} keypointCount={keypoints.length} />
    </div>
  );
}

/** Stable identity for the highlighted sphere (so we can render it bigger). */
function selectedKey(p: PickedPoint): string {
  return `${p.kind}:${p.md.toFixed(4)}:${p.ns.toFixed(4)}:${p.ew.toFixed(4)}`;
}

function Scene({
  stations, keypoints, onPick, selectedKey,
}: {
  stations: StationRow[];
  keypoints: KeypointRow[];
  onPick: (p: PickedPoint) => void;
  selectedKey: string | null;
}) {
  // Build points + bounding box for the densified path (always at least 2 points
  // when this component renders, so safe to index .max/.min on the box).
  const { points, kpPoints, bbox, scale } = useMemo(() => {
    const pts = stations.map(
      (s) => new THREE.Vector3(s.ew, -s.tvd, s.ns),
    );
    const box = new THREE.Box3().setFromPoints(pts);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    // Normalise the geometry to ~100 units so the camera/grid spans are sensible.
    const k = 100 / maxDim;
    const scaled = pts.map((p) => p.multiplyScalar(k));
    const scaledBox = new THREE.Box3().setFromPoints(scaled);
    // Same scaling for keypoints so they sit on the tube exactly.
    const kp = keypoints.map(
      (p) => new THREE.Vector3(p.ew * k, -p.tvd * k, p.ns * k),
    );
    return { points: scaled, kpPoints: kp, bbox: scaledBox, scale: k };
  }, [stations, keypoints]);

  const center = useMemo(() => bbox.getCenter(new THREE.Vector3()), [bbox]);
  const groundY = bbox.min.y;

  // Build a smooth curve through the densified stations.
  const curveGeometry = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(points, false, "catmullrom", 0.1);
    const tubularSegments = Math.max(64, points.length * 4);
    return new THREE.TubeGeometry(curve, tubularSegments, 0.4, 8, false);
  }, [points]);

  const wellhead = points[0];
  const tip = points[points.length - 1];
  // The "natural" radius of the wellhead/target endpoint spheres — used as
  // the base size for keypoints so they're visible but don't overlap.
  const kpRadius = 1.0;

  /** Build a PickedPoint payload from a station (used for wellhead/target). */
  const pickFromStation = (s: StationRow, kind: "wellhead" | "target", label: string): PickedPoint => ({
    kind, label,
    comment: s.comment ?? "",
    md: s.md, inc: s.inc, azm: s.azm, tvd: s.tvd, vsec: s.vsec,
    ns: s.ns, ew: s.ew, dls: s.dls, tf: s.tf,
    br: s.br, tr: s.tr, dmd: s.dmd,
  });
  /** Build a PickedPoint payload from a keypoint row. */
  const pickFromKp = (k: KeypointRow): PickedPoint => ({
    kind: "keypoint",
    label: k.comment ?? `Keypoint ${k.segmentOrder}.${k.roleIndex + 1}`,
    comment: k.comment ?? "",
    md: k.md, inc: k.inc, azm: k.azm, tvd: k.tvd, vsec: k.vsec,
    ns: k.ns, ew: k.ew, dls: k.dls, tf: k.tf,
    br: k.br, tr: k.tr, dmd: k.dmd,
  });

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[100, 200, 100]} intensity={0.8} castShadow />
      <hemisphereLight args={[0xb0d8ff, 0x80a0a0, 0.4]} />

      {/* Ground grid at the deepest point of the trajectory */}
      <Grid
        position={[center.x, groundY - 0.1, center.z]}
        args={[200, 200]}
        cellSize={5}
        cellThickness={0.5}
        cellColor="#94a3b8"
        sectionSize={25}
        sectionThickness={1}
        sectionColor="#64748b"
        fadeDistance={400}
        fadeStrength={1}
        infiniteGrid
      />

      {/* Wellbore tube */}
      <mesh geometry={curveGeometry} castShadow>
        <meshStandardMaterial color="#1e40af" metalness={0.3} roughness={0.4} />
      </mesh>

      {/* Wellhead (clickable) */}
      <ClickableMarker
        position={wellhead}
        radius={1.2}
        color="#facc15"
        isSelected={selectedKey === selectedKey_of("wellhead", stations[0])}
        onClick={() => onPick(pickFromStation(stations[0], "wellhead", "Wellhead"))}
      />

      {/* Target (clickable) */}
      <ClickableMarker
        position={tip}
        radius={1.5}
        color="#dc2626"
        isSelected={selectedKey === selectedKey_of("target", stations[stations.length - 1])}
        onClick={() => onPick(pickFromStation(stations[stations.length - 1], "target", "Target"))}
      />

      {/* Keypoint markers — KOP, EOC, EOC#1, KOP#2, Target, ... */}
      {kpPoints.map((p, i) => {
        const k = keypoints[i];
        const role = (k.comment ?? "").toLowerCase();
        // Color-code by role so the user can read the trajectory at a glance.
        const color =
          role.includes("kop") ? "#10b981" :              // emerald — KOP
          role.includes("eoc") ? "#f97316" :              // orange  — EOC
          role.includes("target") ? "#dc2626" :           // red     — Target
          "#8b5cf6";                                      // violet  — other (KOP#2 etc.)
        const isSel = selectedKey === `keypoint:${k.md.toFixed(4)}:${k.ns.toFixed(4)}:${k.ew.toFixed(4)}`;
        return (
          <ClickableMarker
            key={`${k.segmentOrder}-${k.roleIndex}`}
            position={p}
            radius={kpRadius}
            color={color}
            isSelected={isSel}
            label={k.comment ?? ""}
            onClick={() => onPick(pickFromKp(k))}
          />
        );
      })}

      {/* Compass cardinals at the wellhead */}
      <CompassMarkers
        position={wellhead}
        radius={Math.max(20, bbox.getSize(new THREE.Vector3()).length() * 0.15)}
      />

      {/* Camera controls */}
      <OrbitControls
        target={center}
        enableDamping
        dampingFactor={0.1}
        maxDistance={1000}
      />

      {/* Floating labels at the endpoints */}
      <BillboardLabel
        position={[wellhead.x, wellhead.y + 4, wellhead.z]}
        text="Wellhead"
      />
      <BillboardLabel position={[tip.x, tip.y - 4, tip.z]} text="Target" />

      {/* Render scale indicator */}
      <Text
        position={[bbox.max.x + 6, bbox.max.y, bbox.max.z]}
        fontSize={2}
        color="#475569"
        anchorX="left"
      >
        {`1 unit = ${(1 / scale).toFixed(1)} (project units)`}
      </Text>
    </>
  );
}

/** Stable selection key — duplicates selectedKey() but for raw inputs. */
function selectedKey_of(kind: "wellhead" | "target", s: StationRow): string {
  return `${kind}:${s.md.toFixed(4)}:${s.ns.toFixed(4)}:${s.ew.toFixed(4)}`;
}

/**
 * Sphere that:
 *   - calls `onClick` (e.stopPropagation prevents OrbitControls from grabbing it)
 *   - swells slightly when hovered (cursor → pointer)
 *   - swells more when selected, with an outline-ring effect via a second mesh
 *   - shows a billboard label when hovered or selected (kept off by default
 *     to avoid clutter in dense profiles like D3DS_HOLD2 with 4 keypoints)
 */
function ClickableMarker({
  position, radius, color, isSelected, label, onClick,
}: {
  position: THREE.Vector3;
  radius: number;
  color: string;
  isSelected: boolean;
  label?: string;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const displayRadius = isSelected ? radius * 1.6 : hovered ? radius * 1.25 : radius;

  return (
    <group position={position}>
      {/* Selection ring — slightly larger, transparent, only when selected */}
      {isSelected && (
        <mesh>
          <sphereGeometry args={[displayRadius * 1.25, 24, 24]} />
          <meshBasicMaterial color={color} transparent opacity={0.25} />
        </mesh>
      )}
      <mesh
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = "pointer"; }}
        onPointerOut={(e) => { e.stopPropagation(); setHovered(false); document.body.style.cursor = ""; }}
        onClick={(e) => { e.stopPropagation(); onClick(); }}
      >
        <sphereGeometry args={[displayRadius, 20, 20]} />
        <meshStandardMaterial color={color} emissive={isSelected ? color : "#000000"} emissiveIntensity={isSelected ? 0.35 : 0} />
      </mesh>
      {(hovered || isSelected) && label && (
        <BillboardLabel position={[0, displayRadius + 1, 0]} text={label} />
      )}
    </group>
  );
}

function CompassMarkers({ position, radius }: { position: THREE.Vector3; radius: number }) {
  const offsets = useMemo(
    () => [
      { dir: new THREE.Vector3(0, 0, 1), label: "N", color: "#10b981" },
      { dir: new THREE.Vector3(0, 0, -1), label: "S", color: "#10b981" },
      { dir: new THREE.Vector3(1, 0, 0), label: "E", color: "#3b82f6" },
      { dir: new THREE.Vector3(-1, 0, 0), label: "W", color: "#3b82f6" },
    ],
    [],
  );
  return (
    <>
      {offsets.map((o) => (
        <Text
          key={o.label}
          position={position.clone().add(o.dir.multiplyScalar(radius))}
          fontSize={3}
          color={o.color}
          anchorX="center"
          anchorY="middle"
        >
          {o.label}
        </Text>
      ))}
    </>
  );
}

function BillboardLabel({
  position, text,
}: { position: [number, number, number] | THREE.Vector3; text: string }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ camera }) => {
    ref.current?.lookAt(camera.position);
  });
  return (
    <group ref={ref} position={position as THREE.Vector3}>
      <Text fontSize={2.4} color="#0f172a" outlineWidth={0.05} outlineColor="white">
        {text}
      </Text>
    </group>
  );
}

/**
 * Right-side legend panel that shows the selected point's full attribute set.
 * Shown alongside the 3D canvas; the parent flex layout sizes it to ~280 px.
 */
function PointLegend({
  point, keypointCount,
}: { point: PickedPoint | null; keypointCount: number }) {
  if (!point) {
    return (
      <div className="w-72 shrink-0 border border-gray-200 rounded bg-white p-4 text-xs text-gray-600 space-y-3 overflow-y-auto">
        <h3 className="text-sm font-semibold text-gray-900">Key points</h3>
        <p className="text-gray-500">
          Click any marker on the wellbore to see its values here.
        </p>
        <div className="space-y-1.5 pt-2 border-t border-gray-200">
          <LegendKey color="#facc15" label="Wellhead (origin)" />
          <LegendKey color="#10b981" label="KOP (start of curve)" />
          <LegendKey color="#f97316" label="EOC (end of curve)" />
          <LegendKey color="#8b5cf6" label="KOP #2 / intermediate" />
          <LegendKey color="#dc2626" label="Target" />
        </div>
        <p className="pt-2 text-[11px] text-gray-400 italic">
          {keypointCount} milestone point{keypointCount === 1 ? "" : "s"} on this trajectory.
        </p>
      </div>
    );
  }

  return (
    <div className="w-72 shrink-0 border border-gray-200 rounded bg-white p-4 text-xs space-y-2 overflow-y-auto">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-gray-900">{point.label || point.kind}</h3>
        <span className="text-[10px] uppercase tracking-wide text-gray-400">{point.kind}</span>
      </div>
      {point.comment && point.comment !== point.label && (
        <p className="text-gray-500 italic">{point.comment}</p>
      )}
      <dl className="grid grid-cols-2 gap-x-2 gap-y-1 pt-2">
        <Cell label="MD"   value={point.md.toFixed(3)} />
        <Cell label="DMD"  value={point.dmd.toFixed(3)} />
        <Cell label="Inc"  value={`${rad2deg(point.inc).toFixed(2)}°`} />
        <Cell label="Azm"  value={`${rad2deg(point.azm).toFixed(2)}°`} />
        <Cell label="TVD"  value={point.tvd.toFixed(3)} />
        <Cell label="VSEC" value={point.vsec.toFixed(3)} />
        <Cell label="NS"   value={point.ns.toFixed(3)} />
        <Cell label="EW"   value={point.ew.toFixed(3)} />
        <Cell label="DLS"  value={`${(Math.abs(rad2deg(point.dls)) * 100).toFixed(3)}°/L`} />
        <Cell label="TF"   value={`${rad2deg(point.tf).toFixed(2)}°`} />
        <Cell label="BR"   value={`${(rad2deg(point.br) * 100).toFixed(3)}°/L`} />
        <Cell label="TR"   value={`${(rad2deg(point.tr) * 100).toFixed(3)}°/L`} />
      </dl>
    </div>
  );
}

function LegendKey({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="inline-block w-3 h-3 rounded-full border border-gray-300" style={{ background: color }} />
      <span className="text-gray-700">{label}</span>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-mono text-gray-900 text-right">{value}</dd>
    </>
  );
}
