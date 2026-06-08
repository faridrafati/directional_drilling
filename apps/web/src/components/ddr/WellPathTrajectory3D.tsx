/**
 * A single well's 3D directional trajectory, rendered with @react-three/fiber
 * (the app's existing 3D stack). Axes: E/W → X, TVD → −Y (so depth goes down),
 * N/S → Z. The path is a tube through the survey stations; orbit/zoom via
 * OrbitControls. Small, self-contained, one Canvas per well (used inside the
 * per-well plot group of the Well Path graph).
 */
import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Line, GizmoHelper, GizmoViewport } from "@react-three/drei";
import * as THREE from "three";

export interface Station3D { ns: number; ew: number; tvd: number; md: number | null }

export function WellPathTrajectory3D({ stations }: { stations: Station3D[] }) {
  // World points (E/W=X, TVD down = −Y, N/S=Z), centred + scaled to a unit-ish
  // box so the camera framing is stable regardless of the well's real extent.
  const { points, surface } = useMemo(() => {
    const raw = stations
      .filter((s) => Number.isFinite(s.ew) && Number.isFinite(s.ns) && Number.isFinite(s.tvd))
      .map((s) => new THREE.Vector3(s.ew, -s.tvd, s.ns));
    if (raw.length < 2) return { points: [] as THREE.Vector3[], surface: new THREE.Vector3() };
    const box = new THREE.Box3().setFromPoints(raw);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const k = 20 / maxDim; // fit into ~±10 units
    const pts = raw.map((p) => p.clone().sub(center).multiplyScalar(k));
    // Surface (shallowest TVD = max −Y) marker, in the same scaled space.
    const top = raw.reduce((a, b) => (b.y > a.y ? b : a), raw[0]).clone().sub(center).multiplyScalar(k);
    return { points: pts, surface: top };
  }, [stations]);

  if (points.length < 2) {
    return <div className="h-full grid place-items-center text-[10px] text-gray-400">Not enough 3D stations.</div>;
  }

  return (
    <Canvas camera={{ position: [18, 14, 18], fov: 40, near: 0.1, far: 1000 }} dpr={[1, 1.5]} className="bg-gray-50">
      <ambientLight intensity={0.8} />
      <directionalLight position={[10, 20, 10]} intensity={0.5} />
      {/* trajectory tube/line */}
      <Line points={points} color="#1e40af" lineWidth={2} />
      {/* surface (well head) marker */}
      <mesh position={surface}>
        <sphereGeometry args={[0.4, 16, 16]} />
        <meshStandardMaterial color="#16a34a" />
      </mesh>
      {/* bottom (TD) marker */}
      <mesh position={points[points.length - 1]}>
        <sphereGeometry args={[0.35, 16, 16]} />
        <meshStandardMaterial color="#dc2626" />
      </mesh>
      <OrbitControls enablePan enableZoom enableRotate makeDefault />
      <GizmoHelper alignment="bottom-right" margin={[40, 40]}>
        <GizmoViewport axisColors={["#dc2626", "#16a34a", "#2563eb"]} labelColor="white" />
      </GizmoHelper>
    </Canvas>
  );
}
