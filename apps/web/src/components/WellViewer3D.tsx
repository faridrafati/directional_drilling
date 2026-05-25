/**
 * 3D wellbore viewer (React Three Fiber).
 *
 * Replaces old_delphi_code/Unit03.pas (Form03) — the GLScene-based 3D viewer.
 * Renders the station path as a tube + drops a ground grid + axis-coloured
 * cardinal markers + an orbit camera.
 *
 * Coordinate mapping (oilfield → Three.js):
 *   ew  →  +x
 *   tvd →  -y   (depth grows downward visually)
 *   ns  →  +z
 *
 * Auto-scales the camera based on the well's bounding box so the whole path
 * fits whatever its absolute size (a 200 m vertical pilot well or a 10 km
 * extended-reach well render alike).
 */
import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Grid, Text } from "@react-three/drei";
import * as THREE from "three";
import type { StationRow } from "../api/client.js";

interface Props {
  stations: StationRow[];
}

export function WellViewer3D({ stations }: Props) {
  if (stations.length < 2) {
    return (
      <div className="border border-gray-200 rounded bg-white h-[600px] grid place-items-center text-gray-400 text-sm">
        Calculate the trajectory to see the 3D view.
      </div>
    );
  }
  return (
    <div className="border border-gray-200 rounded bg-gradient-to-b from-sky-50 to-white h-[600px] overflow-hidden">
      <Canvas
        shadows
        camera={{ position: [50, 50, 50], fov: 45, near: 0.1, far: 100000 }}
      >
        <Suspense fallback={null}>
          <Scene stations={stations} />
        </Suspense>
      </Canvas>
    </div>
  );
}

function Scene({ stations }: { stations: StationRow[] }) {
  // Build points + bounding box.
  const { points, bbox, scale } = useMemo(() => {
    const pts = stations.map(
      (s) => new THREE.Vector3(s.ew, -s.tvd, s.ns)
    );
    const box = new THREE.Box3().setFromPoints(pts);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    // Normalise the geometry to ~100 units so the camera/grid spans are sensible.
    const k = 100 / maxDim;
    const scaled = pts.map((p) => p.multiplyScalar(k));
    const scaledBox = new THREE.Box3().setFromPoints(scaled);
    return { points: scaled, bbox: scaledBox, scale: k };
  }, [stations]);

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

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight
        position={[100, 200, 100]}
        intensity={0.8}
        castShadow
      />
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

      {/* Wellhead marker */}
      <mesh position={wellhead}>
        <sphereGeometry args={[1.2, 16, 16]} />
        <meshStandardMaterial color="#facc15" />
      </mesh>

      {/* Target marker */}
      <mesh position={tip}>
        <sphereGeometry args={[1.5, 16, 16]} />
        <meshStandardMaterial color="#dc2626" />
      </mesh>

      {/* Compass cardinals at the wellhead */}
      <CompassMarkers position={wellhead} radius={Math.max(20, bbox.getSize(new THREE.Vector3()).length() * 0.15)} />

      {/* Camera controls */}
      <OrbitControls
        target={center}
        enableDamping
        dampingFactor={0.1}
        maxDistance={1000}
      />

      {/* HUD overlay info via a billboard text */}
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

function CompassMarkers({ position, radius }: { position: THREE.Vector3; radius: number }) {
  const offsets = useMemo(
    () => [
      { dir: new THREE.Vector3(0, 0, 1), label: "N", color: "#10b981" },
      { dir: new THREE.Vector3(0, 0, -1), label: "S", color: "#10b981" },
      { dir: new THREE.Vector3(1, 0, 0), label: "E", color: "#3b82f6" },
      { dir: new THREE.Vector3(-1, 0, 0), label: "W", color: "#3b82f6" },
    ],
    []
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

function BillboardLabel({ position, text }: { position: [number, number, number] | THREE.Vector3; text: string }) {
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
