/**
 * Field map page: upload .grd, browse grids, view the active grid with
 * contours, run volume calculations.
 *
 * Replaces the map-related forms (Form21, Form22, Form23, Form28, Form30).
 */
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/client.js";
import type { GridApiResponse, WellOverlay } from "../components/MapViewer2D.js";
import { useRecentMaps } from "../hooks/useRecent.js";

// Three.js + Recharts are heavy — lazy-load so the grids list shows instantly.
const MapViewer2D = lazy(() =>
  import("../components/MapViewer2D.js").then((m) => ({ default: m.MapViewer2D }))
);
const CrossSection = lazy(() =>
  import("../components/CrossSection.js").then((m) => ({ default: m.CrossSection }))
);
const FieldScene3D = lazy(() =>
  import("../components/FieldScene3D.js").then((m) => ({ default: m.FieldScene3D }))
);

interface GridSummary {
  id: string;
  name: string;
  filename: string;
  xmin: number; xmax: number; ymin: number; ymax: number;
  xinc: number; yinc: number; ncol: number; nrow: number;
  units: string; errorVal: number;
}

interface VolumeResult {
  volume: number;
  validCells: number;
  method: "sum" | "simpson";
  units: string;
}

interface WellWithPaths {
  id: string;
  name: string;
  ns: number | null;
  ew: number | null;
  msl: number | null;
  tvd: number | null;
  md: number | null;
  calculations: Array<{
    id: string;
    name: string;
    type: string;
    stations: Array<{ md: number; tvd: number; ns: number; ew: number; inc: number; azm: number }>;
  }>;
}

type ViewTab = "map" | "cross" | "3d";

export function FieldMapPage() {
  const { id: fieldId } = useParams<{ id: string }>();
  const qc = useQueryClient();

  const grids = useQuery({
    queryKey: ["grids", fieldId],
    queryFn: () => api.get<GridSummary[]>(`/fields/${fieldId}/grids`),
    enabled: !!fieldId,
  });

  const [activeId, setActiveId] = useState<string | null>(null);
  const activeQuery = useQuery({
    queryKey: ["grid", activeId],
    queryFn: () => api.get<GridApiResponse>(`/grids/${activeId}`),
    enabled: !!activeId,
  });

  const [showContours, setShowContours] = useState(true);
  const [contourLevels, setContourLevels] = useState(10);
  const [showWells, setShowWells] = useState(true);
  const [showHoverValues, setShowHoverValues] = useState(false);
  const [view, setView] = useState<ViewTab>("map");

  // Track this field in the sidebar's "Recently opened" list.
  const recentMaps = useRecentMaps();
  useEffect(() => {
    if (!fieldId) return;
    // We don't have the field name in this scope (the wells query gives wells,
    // not the parent field), so fall back to the first grid's name as context
    // when available, else just show the field ID short-hash.
    const firstGrid = grids.data?.[0];
    const label = firstGrid ? `Field map · ${firstGrid.name}` : `Field map · ${fieldId.slice(0, 6)}`;
    recentMaps.record({ id: fieldId, label });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldId, grids.data]);

  // Cross-section endpoints in world coords.
  const [crossA, setCrossA] = useState<{ ns: number; ew: number } | null>(null);
  const [crossB, setCrossB] = useState<{ ns: number; ew: number } | null>(null);
  const [crossPickMode, setCrossPickMode] = useState<"A" | "B" | null>(null);

  const wells = useQuery({
    queryKey: ["wells-with-paths", fieldId],
    queryFn: () => api.get<WellWithPaths[]>(`/fields/${fieldId}/wells-with-paths`),
    enabled: !!fieldId,
  });

  // Flatten wells + their station paths into the MapViewer2D `WellOverlay` shape.
  // We pick the first calculation per well; for multi-calc wells this is a
  // reasonable default (the original behaved the same — it iterated over SE tables).
  const wellOverlays: WellOverlay[] = useMemo(() => {
    return (wells.data ?? [])
      .filter((w) => w.ew !== null && w.ns !== null)
      .map((w) => {
        const calc = w.calculations[0];
        // Station ns/ew are LOCAL to the wellhead (computed by the dispatcher);
        // we add the wellhead's world position to get absolute coords. TVD is
        // already measured from the wellhead, so we pass it through unchanged.
        const path = calc?.stations.map((s) => ({
          ew: (w.ew ?? 0) + s.ew,
          ns: (w.ns ?? 0) + s.ns,
          tvd: s.tvd,
        }));
        return {
          id: w.id, name: w.name,
          ns: w.ns!, ew: w.ew!,
          msl: w.msl ?? undefined,
          path,
        };
      });
  }, [wells.data]);

  const fileInput = useRef<HTMLInputElement>(null);
  const uploadMut = useMutation({
    mutationFn: async (file: File) => {
      const text = await file.text();
      const name = file.name.replace(/\.grd$/i, "");
      const url = `/api/fields/${fieldId}/grids?name=${encodeURIComponent(name)}&filename=${encodeURIComponent(file.name)}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: text,
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<GridSummary & { valueMin: number; valueMax: number }>;
    },
    onSuccess: (g) => {
      qc.invalidateQueries({ queryKey: ["grids", fieldId] });
      setActiveId(g.id);
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.del(`/grids/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["grids", fieldId] });
      if (activeQuery.data && deleteMut.variables === activeQuery.data.id) {
        setActiveId(null);
      }
    },
  });

  // Volume widget
  const [bottomId, setBottomId] = useState<string>("");
  const [topId, setTopId] = useState<string>("");
  const [method, setMethod] = useState<"sum" | "simpson">("sum");
  const volumeMut = useMutation({
    mutationFn: () =>
      api.post<VolumeResult>("/grids/volume", { bottomId, topId, method }),
  });

  return (
    <div className="p-4 sm:p-6 max-w-[1400px] mx-auto">
      <div className="mb-3">
        <Link to="/projects" className="text-sm text-blue-600 hover:underline">
          ← All projects
        </Link>
      </div>

      <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-gray-900">
        Field maps
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4 md:gap-6">
        {/* Sidebar — full-width above the map on mobile */}
        <aside className="space-y-3 md:space-y-4">
          <div className="bg-white border border-gray-200 rounded p-3">
            <h3 className="text-sm font-medium mb-2">Grids</h3>
            <ul className="text-sm divide-y divide-gray-100">
              {(grids.data ?? []).map((g) => (
                <li key={g.id} className="py-1 flex items-center justify-between">
                  <button
                    onClick={() => setActiveId(g.id)}
                    className={`text-left truncate ${
                      activeId === g.id
                        ? "text-blue-700 font-medium"
                        : "text-gray-700 hover:text-gray-900"
                    }`}
                  >
                    {g.name}
                    <div className="text-xs text-gray-400">
                      {g.ncol}×{g.nrow} · {g.units}
                    </div>
                  </button>
                  <button
                    onClick={() => deleteMut.mutate(g.id)}
                    className="text-xs text-red-500 hover:text-red-700"
                    title="Delete grid"
                  >
                    ×
                  </button>
                </li>
              ))}
              {grids.data?.length === 0 && (
                <li className="py-2 text-xs text-gray-400">No grids yet.</li>
              )}
            </ul>
            <div className="mt-3">
              <input
                ref={fileInput}
                type="file"
                accept=".grd"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadMut.mutate(f);
                  e.target.value = "";
                }}
              />
              <button
                onClick={() => fileInput.current?.click()}
                disabled={uploadMut.isPending}
                className="w-full px-3 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300"
              >
                {uploadMut.isPending ? "Uploading…" : "Upload .grd"}
              </button>
              {uploadMut.error && (
                <p className="mt-1 text-xs text-red-600">{String(uploadMut.error)}</p>
              )}
            </div>
          </div>

          {/* Display options */}
          {activeQuery.data && (
            <div className="bg-white border border-gray-200 rounded p-3 text-sm">
              <h3 className="font-medium mb-2">Display</h3>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={showContours}
                  onChange={(e) => setShowContours(e.target.checked)}
                />
                Show contours
              </label>
              <label className="flex items-center gap-2 mt-2">
                <input
                  type="checkbox"
                  checked={showWells}
                  onChange={(e) => setShowWells(e.target.checked)}
                />
                Show wells ({wellOverlays.length})
              </label>
              {view === "3d" && (
                <label className="flex items-center gap-2 mt-2">
                  <input
                    type="checkbox"
                    checked={showHoverValues}
                    onChange={(e) => setShowHoverValues(e.target.checked)}
                  />
                  Show depth on hover
                </label>
              )}
              <div className="mt-2">
                <label className="block text-xs text-gray-500 mb-1">
                  Contour count: {contourLevels}
                </label>
                <input
                  type="range"
                  min={2}
                  max={30}
                  step={1}
                  value={contourLevels}
                  onChange={(e) => setContourLevels(Number(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>
          )}

          {/* Cross-section controls */}
          {activeQuery.data && view === "map" && (
            <div className="bg-white border border-gray-200 rounded p-3 text-sm">
              <h3 className="font-medium mb-2">Cross-section</h3>
              <div className="flex gap-1 mb-2">
                <button
                  onClick={() => setCrossPickMode(crossPickMode === "A" ? null : "A")}
                  className={`flex-1 text-xs px-2 py-1 rounded ${
                    crossPickMode === "A" ? "bg-orange-600 text-white" : "bg-gray-100 hover:bg-gray-200"
                  }`}
                >
                  {crossA ? `A: (${crossA.ew.toFixed(0)}, ${crossA.ns.toFixed(0)})` : "Pick A"}
                </button>
                <button
                  onClick={() => setCrossPickMode(crossPickMode === "B" ? null : "B")}
                  className={`flex-1 text-xs px-2 py-1 rounded ${
                    crossPickMode === "B" ? "bg-orange-600 text-white" : "bg-gray-100 hover:bg-gray-200"
                  }`}
                >
                  {crossB ? `B: (${crossB.ew.toFixed(0)}, ${crossB.ns.toFixed(0)})` : "Pick B"}
                </button>
              </div>
              <button
                onClick={() => setView("cross")}
                disabled={!crossA || !crossB}
                className="w-full px-3 py-1.5 text-sm rounded bg-orange-600 text-white hover:bg-orange-700 disabled:bg-gray-300"
              >
                Show profile
              </button>
              {(crossA || crossB) && (
                <button
                  onClick={() => { setCrossA(null); setCrossB(null); setCrossPickMode(null); }}
                  className="w-full mt-2 text-xs text-gray-500 hover:text-gray-700"
                >
                  Clear
                </button>
              )}
            </div>
          )}

          {/* Volume widget */}
          {(grids.data ?? []).length >= 2 && (
            <div className="bg-white border border-gray-200 rounded p-3 text-sm">
              <h3 className="font-medium mb-2">Volume</h3>
              <label className="block text-xs text-gray-500 mb-1">Bottom horizon</label>
              <select
                className="w-full border border-gray-300 rounded px-2 py-1 mb-2"
                value={bottomId}
                onChange={(e) => setBottomId(e.target.value)}
              >
                <option value="">—</option>
                {grids.data?.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
              <label className="block text-xs text-gray-500 mb-1">Top horizon</label>
              <select
                className="w-full border border-gray-300 rounded px-2 py-1 mb-2"
                value={topId}
                onChange={(e) => setTopId(e.target.value)}
              >
                <option value="">—</option>
                {grids.data?.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
              <label className="block text-xs text-gray-500 mb-1">Method</label>
              <select
                className="w-full border border-gray-300 rounded px-2 py-1 mb-3"
                value={method}
                onChange={(e) => setMethod(e.target.value as "sum" | "simpson")}
              >
                <option value="sum">Sum (Σ × cell area)</option>
                <option value="simpson">Simpson 2×2</option>
              </select>
              <button
                onClick={() => volumeMut.mutate()}
                disabled={!bottomId || !topId || volumeMut.isPending}
                className="w-full px-3 py-1.5 text-sm rounded bg-green-700 text-white hover:bg-green-800 disabled:bg-gray-300"
              >
                {volumeMut.isPending ? "Calculating…" : "Compute volume"}
              </button>
              {volumeMut.data && (
                <div className="mt-3 text-xs">
                  <div>
                    <span className="text-gray-500">Volume:</span>{" "}
                    <span className="font-medium">
                      {volumeMut.data.volume.toExponential(3)}
                    </span>{" "}
                    {volumeMut.data.units}
                  </div>
                  <div className="text-gray-500">
                    {volumeMut.data.validCells.toLocaleString()} valid cells (
                    {volumeMut.data.method})
                  </div>
                </div>
              )}
              {volumeMut.error && (
                <p className="mt-2 text-xs text-red-600">{String(volumeMut.error)}</p>
              )}
            </div>
          )}
        </aside>

        {/* Map / cross / 3D */}
        <main>
          {!activeId && (
            <div className="bg-white border border-gray-200 rounded h-[600px] grid place-items-center text-sm text-gray-400">
              Select or upload a grid to view.
            </div>
          )}
          {activeId && activeQuery.isLoading && (
            <div className="text-gray-500 text-sm">Loading grid…</div>
          )}
          {activeQuery.data && (
            <>
              <div className="flex border-b border-gray-200 mb-3">
                {(["map", "cross", "3d"] as ViewTab[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setView(t)}
                    className={`px-4 py-2 text-sm border-b-2 ${
                      view === t
                        ? "border-blue-600 text-blue-700 font-medium"
                        : "border-transparent text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    {t === "map" ? "2D Map" : t === "cross" ? "Cross-section" : "3D View"}
                  </button>
                ))}
              </div>

              <Suspense fallback={<div className="text-sm text-gray-500">Loading viewer…</div>}>
                {view === "map" && (
                  <MapViewer2D
                    grid={activeQuery.data}
                    showContours={showContours}
                    contourLevels={contourLevels}
                    wells={wellOverlays}
                    showWells={showWells}
                    crossLine={crossA && crossB ? [crossA, crossB] : undefined}
                    onMapClick={
                      crossPickMode
                        ? (worldX, worldY) => {
                            const point = { ew: worldX, ns: worldY };
                            if (crossPickMode === "A") setCrossA(point);
                            else setCrossB(point);
                            setCrossPickMode(null);
                          }
                        : undefined
                    }
                  />
                )}

                {view === "cross" && crossA && crossB && (
                  <CrossSection grid={activeQuery.data} a={crossA} b={crossB} />
                )}
                {view === "cross" && (!crossA || !crossB) && (
                  <div className="bg-white border border-gray-200 rounded h-[400px] grid place-items-center text-sm text-gray-400">
                    Pick two points on the 2D map (A and B) to define a cross-section.
                  </div>
                )}

                {view === "3d" && (
                  <FieldScene3D
                    grid={activeQuery.data}
                    wells={wellOverlays}
                    zScale={5}
                    showContours={showContours}
                    contourLevels={contourLevels}
                    showHoverValues={showHoverValues}
                  />
                )}
              </Suspense>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
