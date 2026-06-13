/**
 * A single well's 3D directional trajectory, rendered with @react-three/fiber
 * (the app's existing 3D stack). Axes: E/W → X, TVD → −Y (so depth goes down),
 * N/S → Z. The path is a tube through the survey stations; orbit/zoom via
 * OrbitControls. Small, self-contained, one Canvas per well.
 *
 * When `lithoColumn` (per-lithology intervals in TVD) is supplied — the maximized
 * view with "Lithology & formation" enabled — the geology is drawn as a CUBIC
 * EARTH BLOCK the well runs through: the four side walls are textured with a canvas
 * that bakes EVERY lithology interval's rock colour + pattern tile by depth (so
 * each lithology shows its own colour/pattern, exactly like the side column), and
 * each formation top is an OVERSIZED translucent slab protruding past the block,
 * labelled on its edge. Transparency is user-controlled so the wellbore reads
 * through. Hovering the path shows that survey station's data; clicking it opens
 * that day's daily report (via onOpenReport), mirroring the 2D plots.
 */
import { useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Line, GizmoHelper, GizmoViewport, Html } from "@react-three/drei";
import * as THREE from "three";

export interface Station3D {
  ns: number; ew: number; tvd: number; md: number | null;
  inc?: number | null; az?: number | null; dls?: number | null;
  date?: string | null; serialNo?: number | null; wellCode?: string;
}
export interface LithoBand3D { fromTvd: number; toTvd: number; color: string; pattern: string; comps?: { name: string; pct: number; color: string }[] }
export interface Formation3D { name: string | null; tvd: number; hue: number }

const fmt = (v: unknown) => v == null || v === "" ? "—" : typeof v === "number" ? (Number.isInteger(v) ? String(v) : v.toFixed(1)) : String(v);

/** Bake the lithology column (intervals in TVD) into a tall canvas: per interval,
 *  rock colour then its pattern tile multiply-blended on top — the same recipe the
 *  2D column uses. Wrapped around the core wall it reads as the layered earth. */
function buildWallCanvas(litho: LithoBand3D[], coreMin: number, coreMax: number, images: Map<string, HTMLImageElement>): HTMLCanvasElement | null {
  const W = 64, H = 1200;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d"); if (!ctx) return null;
  const span = Math.max(1, coreMax - coreMin);
  const yOf = (tvd: number) => ((tvd - coreMin) / span) * H;
  ctx.fillStyle = "#efeae3"; ctx.fillRect(0, 0, W, H);   // earth-ish base for any gaps
  for (const b of litho) {
    const y0 = yOf(b.fromTvd), y1 = Math.max(y0 + 1, yOf(b.toTvd));
    ctx.fillStyle = b.color; ctx.fillRect(0, y0, W, y1 - y0);
    const img = b.pattern ? images.get(b.pattern) : null;
    if (img && img.width) {
      const pat = ctx.createPattern(img, "repeat");
      if (pat) { ctx.save(); ctx.globalCompositeOperation = "multiply"; ctx.fillStyle = pat; ctx.fillRect(0, y0, W, y1 - y0); ctx.restore(); }
    }
  }
  return canvas;
}

export function WellPathTrajectory3D({ stations, lithoColumn = [], formations = [], patternImages, opacity = 0.5, onOpenReport }: {
  stations: Station3D[];
  lithoColumn?: LithoBand3D[];
  formations?: Formation3D[];
  patternImages?: Map<string, HTMLImageElement>;
  opacity?: number;
  onOpenReport?: (wellCode: string, serialNo: number, date: string | null) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  // World points (E/W=X, TVD down = −Y, N/S=Z), centred + scaled to a unit-ish
  // box so the camera framing is stable regardless of the well's real extent.
  const geom = useMemo(() => {
    const valid = stations.filter((s) => Number.isFinite(s.ew) && Number.isFinite(s.ns) && Number.isFinite(s.tvd));
    const raw = valid.map((s) => new THREE.Vector3(s.ew, -s.tvd, s.ns));
    if (raw.length < 2) return null;
    const box = new THREE.Box3().setFromPoints(raw);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const k = 20 / maxDim; // fit into ~±10 units
    const pts = raw.map((p) => p.clone().sub(center).multiplyScalar(k));
    const surface = raw.reduce((a, b) => (b.y > a.y ? b : a), raw[0]).clone().sub(center).multiplyScalar(k);
    const yOfTvd = (tvd: number) => (-tvd - center.y) * k;
    const radius = Math.max(Math.max(size.x, size.z) * k, 2.2) * 0.85;

    // Core depth window = the SURVEYED interval (station TVD range), so the core
    // stays proportional to the well and frames cleanly; the wall shows only the
    // lithology the wellbore actually traverses (deeper/shallower log is clipped).
    const coreMin = -box.max.y, coreMax = -box.min.y;   // y = −tvd
    const yTopCore = yOfTvd(coreMin), yBotCore = yOfTvd(coreMax);
    const core = { cy: (yTopCore + yBotCore) / 2, h: Math.max(0.2, yTopCore - yBotCore), radius, coreMin, coreMax, yTop: yTopCore };

    // Formation tops that fall within the surveyed core window → oversized slabs.
    const labels = formations
      .filter((f) => Number.isFinite(f.tvd) && f.tvd >= coreMin - 1 && f.tvd <= coreMax + 1)
      .map((f) => ({ name: f.name, hue: f.hue, y: yOfTvd(f.tvd) }));
    // Shallowest / deepest lithology colour → the ground / bottom cap tints.
    return { pts, valid, surface, core, labels, endY: pts[pts.length - 1] };
  }, [stations, lithoColumn, formations]);

  // Invisible thick tube along the path → a generous hover/click pick target.
  const tube = useMemo(() => {
    if (!geom || geom.pts.length < 2) return null;
    const curve = new THREE.CatmullRomCurve3(geom.pts);
    return new THREE.TubeGeometry(curve, Math.max(16, geom.pts.length * 3), 0.22, 8, false);
  }, [geom]);
  useEffect(() => () => tube?.dispose(), [tube]);
  const sortedForms = useMemo(() => [...formations].sort((a, b) => a.tvd - b.tvd), [formations]);

  // Bake the lithology column into one wall texture (rebuilt when the column or the
  // loaded tiles change). Wrapped around the cylinder; depth maps top→shallow.
  const wallTex = useMemo(() => {
    if (!geom || !lithoColumn.length) return null;
    const canvas = buildWallCanvas(lithoColumn, geom.core.coreMin, geom.core.coreMax, patternImages ?? new Map());
    if (!canvas) return null;
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.repeat.set(4, 1);            // pattern repeats across each wall; depth maps once
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.generateMipmaps = false; tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return tex;
  }, [geom, lithoColumn, patternImages]);
  useEffect(() => () => { wallTex?.dispose(); }, [wallTex]);

  if (!geom) {
    return <div className="h-full grid place-items-center text-[10px] text-gray-400">Not enough 3D stations.</div>;
  }
  const { pts, valid, surface, core, labels, endY } = geom;
  const half = core.radius;                      // half side length of the square block
  // The four vertical walls of the cubic block (each textured with the litho column).
  const walls: [[number, number, number], [number, number, number]][] = [
    [[0, core.cy, half], [0, 0, 0]],             // +Z front
    [[0, core.cy, -half], [0, Math.PI, 0]],      // −Z back
    [[half, core.cy, 0], [0, Math.PI / 2, 0]],   // +X right
    [[-half, core.cy, 0], [0, -Math.PI / 2, 0]], // −X left
  ];
  // Nearest survey station to a picked world point (for hover/click on the path).
  const nearest = (p: THREE.Vector3) => {
    let best = -1, bd = Infinity;
    for (let i = 0; i < pts.length; i++) { const d = pts[i].distanceToSquared(p); if (d < bd) { bd = d; best = i; } }
    return best;
  };
  const hv = hover != null ? valid[hover] : null;
  // Formation + lithology at the hovered station's depth (TVD): the deepest
  // formation top at/above it, and the lithology band that contains it.
  const formationAt = (tvd: number) => { let n: string | null = null; for (const f of sortedForms) { if (f.tvd <= tvd + 0.01) n = f.name; else break; } return n; };
  const lithoAt = (tvd: number) => lithoColumn.find((b) => tvd >= b.fromTvd - 0.01 && tvd < b.toTvd + 0.01) ?? null;
  const hvForm = hv ? formationAt(hv.tvd) : null;
  const hvLith = hv ? lithoAt(hv.tvd) : null;

  return (
    <div className="relative h-full w-full">
      <Canvas camera={{ position: [26, 19, 26], fov: 40, near: 0.1, far: 1000 }} dpr={[1, 1.5]} className="bg-gray-50">
        <ambientLight intensity={0.9} />
        <directionalLight position={[10, 20, 10]} intensity={0.5} />

        {wallTex && (
          <>
            {/* Cubic earth block: four side walls carry the per-lithology colour +
                pattern column, at the user's transparency so the well shows through. */}
            {walls.map(([pos, rot], i) => (
              <mesh key={i} position={pos} rotation={rot} renderOrder={-2}>
                <planeGeometry args={[half * 2, core.h]} />
                <meshStandardMaterial map={wallTex} transparent opacity={opacity} depthWrite={false} side={THREE.DoubleSide} />
              </mesh>
            ))}
          </>
        )}

        {/* Oversized formation-top SLABS: thin horizontal shelves 10 % wider than the
            lithology block, so each formation top protrudes past the core and reads
            as a distinct surface. Tinted by the formation hue, at the user's opacity. */}
        {labels.map((f, i) => f.name != null && (
          <mesh key={`slab${i}`} position={[0, f.y, 0]} renderOrder={-1}>
            <boxGeometry args={[half * 2.2, Math.max(0.16, core.h * 0.01), half * 2.2]} />
            <meshStandardMaterial color={new THREE.Color().setHSL(f.hue / 360, 0.55, 0.5)} transparent opacity={opacity} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
        ))}

        {/* trajectory + end markers */}
        <Line points={pts} color="#1e3a8a" lineWidth={3} />
        <mesh position={surface}><sphereGeometry args={[0.4, 16, 16]} /><meshStandardMaterial color="#16a34a" /></mesh>
        <mesh position={endY}><sphereGeometry args={[0.35, 16, 16]} /><meshStandardMaterial color="#dc2626" /></mesh>

        {/* Invisible thick tube along the path = the hover / click pick target. */}
        {tube && onOpenReport && (
          <mesh
            geometry={tube}
            onPointerMove={(e) => { e.stopPropagation(); setHover(nearest(e.point)); }}
            onPointerOver={() => { document.body.style.cursor = "pointer"; }}
            onPointerOut={() => { document.body.style.cursor = ""; setHover(null); }}
            onClick={(e) => { e.stopPropagation(); const s = valid[nearest(e.point)]; if (s && s.serialNo != null && s.wellCode) onOpenReport(s.wellCode, s.serialNo, s.date ?? null); }}
          >
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        )}
        {/* Hover highlight + data readout at the nearest station. */}
        {hv && hover != null && (
          <>
            <mesh position={pts[hover]}><sphereGeometry args={[0.28, 12, 12]} /><meshBasicMaterial color="#0f172a" /></mesh>
            <Html position={pts[hover]} center zIndexRange={[40, 0]} style={{ pointerEvents: "none" }}>
              <div style={{ transform: "translateY(-30px)", background: "rgba(17,24,39,0.92)", color: "#fff", fontSize: 10, lineHeight: 1.4, padding: "3px 7px", borderRadius: 4, whiteSpace: "nowrap", boxShadow: "0 1px 3px rgba(0,0,0,0.45)" }}>
                <div style={{ fontWeight: 700 }}>{hv.date ?? ""}{hv.serialNo != null ? " · click to open report" : ""}</div>
                <div>MD {fmt(hv.md)} m · Inc {fmt(hv.inc)}° · Az {fmt(hv.az)}°</div>
                <div>TVD {fmt(hv.tvd)} · N/S {fmt(hv.ns)} · E/W {fmt(hv.ew)} · DLS {fmt(hv.dls)}</div>
                {hvForm && <div style={{ marginTop: 2, fontWeight: 700, color: "#93c5fd" }}>Formation: {hvForm}</div>}
                {hvLith && hvLith.comps && hvLith.comps.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "1px 7px" }}>
                    {hvLith.comps.map((c, j) => (
                      <span key={j} style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                        <span style={{ width: 8, height: 8, background: c.color, display: "inline-block", borderRadius: 2, border: "1px solid rgba(255,255,255,0.45)" }} />
                        {c.name} {fmt(c.pct)}%
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </Html>
          </>
        )}

        {/* Formation-top name chips on the protruding slab edge. */}
        {labels.map((f, i) => f.name && (
          <Html key={i} position={[half * 1.1, f.y, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
            <div style={{
              background: "rgba(255,255,255,0.92)", border: "1px solid #64748b",
              borderLeft: `4px solid hsl(${f.hue} 55% 55%)`, borderRadius: 3,
              padding: "1px 6px", fontSize: 10, fontWeight: 700, color: "#0f172a",
              whiteSpace: "nowrap", lineHeight: 1.3, boxShadow: "0 1px 2px rgba(0,0,0,0.25)",
            }}>{f.name}</div>
          </Html>
        ))}

        <OrbitControls enablePan enableZoom enableRotate makeDefault />
        <GizmoHelper alignment="bottom-right" margin={[40, 40]}>
          <GizmoViewport axisColors={["#dc2626", "#16a34a", "#2563eb"]} labelColor="white" />
        </GizmoHelper>
      </Canvas>
    </div>
  );
}
