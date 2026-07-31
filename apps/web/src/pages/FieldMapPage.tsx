/**
 * Field map page: upload .grd, browse grids, view the active grid with
 * contours, run volume calculations.
 *
 * Replaces the map-related forms (Form21, Form22, Form23, Form28, Form30).
 */
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/client.js";
import type { GridApiResponse, WellOverlay } from "../components/MapViewer2D.js";
import { useRecentMaps } from "../hooks/useRecent.js";
import { clipPolygon } from "@dd/grd/polygonClip";
import { gridFromBytes, gridToBytes } from "@dd/grd";

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
  const navigate = useNavigate();

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

  // Field-map editing tools (Unit21.pas: well-locator click + polygon clip).
  // `mapTool` is the active map-click handler. Only one tool can be active
  // at a time.
  const [mapTool, setMapTool] = useState<"none" | "place-well" | "polygon-clip">("none");
  const [pendingWellAt, setPendingWellAt] = useState<{ ns: number; ew: number } | null>(null);
  const [pendingWellName, setPendingWellName] = useState("");

  // Local-only polygon clip: render-time overlay that masks out cells outside
  // the polygon. Doesn't persist — user can clear it. The Pascal stored it as
  // a `draw[ii,jj]=false` mask in memory too.
  const [clipPolygonVerts, setClipPolygonVerts] = useState<
    Array<{ ns: number; ew: number }> | null
  >(null);

  // Mutation: create a new well at the clicked coords. Invalidates the wells
  // query so the new pushpin shows up immediately.
  const placeWellMut = useMutation({
    mutationFn: (input: { fieldId: string; name: string; ns: number; ew: number }) =>
      api.post("/wells", input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wells-with-paths", fieldId] });
      setPendingWellAt(null);
      setPendingWellName("");
      setMapTool("none");
    },
  });

  /**
   * Build the grid we actually feed to MapViewer2D. When the user has drawn
   * a polygon-clip, we apply `clipPolygon` to mask cells outside the polygon.
   * The result is a brand-new GrdFile in memory; we re-encode its data back
   * to base64 so the MapViewer2D's existing `gridFromBytes(api.data)` path
   * keeps working without changes.
   */
  const displayGrid: GridApiResponse | undefined = useMemo(() => {
    if (!activeQuery.data) return undefined;
    if (!clipPolygonVerts || clipPolygonVerts.length < 3) return activeQuery.data;
    // Decode the raw bytes, clip, re-encode.
    const apiData = activeQuery.data;
    const bin = atob(apiData.data);
    const bytes = new Uint8Array(bin.length);
    for (let k = 0; k < bin.length; k++) bytes[k] = bin.charCodeAt(k);
    const decoded = gridFromBytes(
      {
        errorValue: apiData.errorVal,
        xmin: apiData.xmin, xmax: apiData.xmax,
        ymin: apiData.ymin, ymax: apiData.ymax,
        xinc: apiData.xinc, yinc: apiData.yinc,
        ncol: apiData.ncol, nrow: apiData.nrow,
        units: apiData.units,
      },
      bytes,
    );
    const clipped = clipPolygon(
      decoded,
      clipPolygonVerts.map((v) => ({ x: v.ew, y: v.ns })),
    );
    const reBytes = gridToBytes(clipped);
    let reBase64 = "";
    const chunk = 8192;
    for (let i = 0; i < reBytes.length; i += chunk) {
      reBase64 += String.fromCharCode.apply(null, Array.from(reBytes.subarray(i, i + chunk)));
    }
    return { ...apiData, data: btoa(reBase64) };
  }, [activeQuery.data, clipPolygonVerts]);

  const wells = useQuery({
    queryKey: ["wells-with-paths", fieldId],
    queryFn: () => api.get<WellWithPaths[]>(`/fields/${fieldId}/wells-with-paths`),
    enabled: !!fieldId,
  });

  // Flatten wells + ALL their calculations' station paths into the
  // MapViewer2D `WellOverlay` shape. Each calculation becomes one typed
  // trajectory so the planned Well Design and the actual Survey overlay
  // on the same map, distinguished by colour (blue = design, amber = survey).
  const wellOverlays: WellOverlay[] = useMemo(() => {
    return (wells.data ?? [])
      .filter((w) => w.ew !== null && w.ns !== null)
      .map((w) => {
        // Station ns/ew are LOCAL to the wellhead (computed by the dispatcher);
        // we add the wellhead's world position to get absolute coords. TVD is
        // already measured from the wellhead, so we pass it through unchanged.
        const paths = w.calculations
          .filter((c) => c.stations.length > 1)
          .map((c) => ({
            calcId: c.id,
            calcName: c.name,
            type: c.type,
            points: c.stations.map((s) => ({
              ew: (w.ew ?? 0) + s.ew,
              ns: (w.ns ?? 0) + s.ns,
              tvd: s.tvd,
            })),
          }));
        return {
          id: w.id, name: w.name,
          ns: w.ns!, ew: w.ew!,
          msl: w.msl ?? undefined,
          paths,
        };
      });
  }, [wells.data]);

  // When the user clicks a well marker on the map (display mode), decide
  // where to navigate. Zero calcs → no-op; one → straight to it; many →
  // pop a small chooser so they pick design vs survey.
  const [wellChooser, setWellChooser] = useState<WellWithPaths | null>(null);
  const handleWellClick = (wellId: string) => {
    const w = wells.data?.find((x) => x.id === wellId);
    if (!w) return;
    if (w.calculations.length === 1) {
      navigate(`/calculations/${w.calculations[0].id}`);
    } else if (w.calculations.length > 1) {
      setWellChooser(w);
    }
    // 0 calcs: nothing to open.
  };

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

      <div className="border-l-[3px] border-amber-500 pl-3 mb-4">
        <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 tracking-tight">
          Field maps
        </h2>
      </div>

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
                className="w-full px-3 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors duration-150 disabled:bg-gray-300"
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
              {showWells && (
                <div className="mt-2 pl-6 space-y-1 text-xs text-gray-500">
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block w-4 h-0.5 bg-blue-700" /> Well Design
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block w-4 h-0.5 bg-amber-500" /> Survey
                  </div>
                  <div className="text-[11px] text-gray-400 italic">
                    Click a well marker to open its calculation.
                  </div>
                </div>
              )}
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

          {/* Map editing tools (well placement + polygon clip) */}
          {activeQuery.data && view === "map" && (
            <div className="bg-white border border-gray-200 rounded p-3 text-sm">
              <h3 className="font-medium mb-2">Map tools</h3>
              <div className="flex gap-1 mb-2">
                <button
                  onClick={() => {
                    setMapTool(mapTool === "place-well" ? "none" : "place-well");
                    setCrossPickMode(null);
                  }}
                  className={`flex-1 text-xs px-2 py-1 rounded ${
                    mapTool === "place-well" ? "bg-emerald-600 text-white" : "bg-gray-100 hover:bg-gray-200"
                  }`}
                  title="Click the map to place a new well at that point"
                >
                  Place well
                </button>
                <button
                  onClick={() => {
                    setMapTool(mapTool === "polygon-clip" ? "none" : "polygon-clip");
                    setCrossPickMode(null);
                  }}
                  className={`flex-1 text-xs px-2 py-1 rounded ${
                    mapTool === "polygon-clip" ? "bg-violet-600 text-white" : "bg-gray-100 hover:bg-gray-200"
                  }`}
                  title="Click ≥3 points then double-click to clip the grid to that polygon"
                >
                  Clip polygon
                </button>
              </div>
              {clipPolygonVerts && clipPolygonVerts.length >= 3 && (
                <button
                  onClick={() => setClipPolygonVerts(null)}
                  className="w-full text-xs text-violet-700 hover:text-violet-900 underline"
                >
                  Clear active clip ({clipPolygonVerts.length} vertices)
                </button>
              )}
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
                className="w-full px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors duration-150 disabled:bg-gray-300"
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
                    className={`px-4 py-2 text-sm border-b-2 transition-colors duration-150 ${
                      view === t
                        ? "border-blue-600 text-blue-700 font-medium"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    {t === "map" ? "2D Map" : t === "cross" ? "Cross-section" : "3D View"}
                  </button>
                ))}
              </div>

              <Suspense fallback={<div className="text-sm text-gray-500">Loading viewer…</div>}>
                {view === "map" && (
                  <MapViewer2D
                    grid={displayGrid ?? activeQuery.data}
                    showContours={showContours}
                    contourLevels={contourLevels}
                    wells={wellOverlays}
                    showWells={showWells}
                    crossLine={crossA && crossB ? [crossA, crossB] : undefined}
                    tool={
                      mapTool === "place-well"
                        ? "place-well"
                        : mapTool === "polygon-clip"
                          ? "polygon-clip"
                          : crossPickMode
                            ? "cross-section"
                            : "none"
                    }
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
                    onPlaceWell={(ns, ew) => setPendingWellAt({ ns, ew })}
                    onPolygonClip={(verts) => {
                      setClipPolygonVerts(verts);
                      setMapTool("none");
                    }}
                    onWellClick={mapTool === "none" && !crossPickMode ? handleWellClick : undefined}
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

      {/* Well chooser: opens when a clicked well has more than one
          calculation, so the user picks which Design / Survey to open. */}
      {wellChooser && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => setWellChooser(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl p-5 w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold mb-1">{wellChooser.name}</h3>
            <p className="text-xs text-gray-500 mb-3">
              This well has {wellChooser.calculations.length} calculations. Open which one?
            </p>
            <ul className="space-y-1.5">
              {wellChooser.calculations.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => { setWellChooser(null); navigate(`/calculations/${c.id}`); }}
                    className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-md hover:bg-gray-100"
                  >
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        c.type === "WellDesign"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {c.type === "WellDesign" ? "Design" : "Survey"}
                    </span>
                    <span className="text-sm text-gray-800 truncate">{c.name}</span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex justify-end mt-4">
              <button
                onClick={() => setWellChooser(null)}
                className="px-3 py-1.5 text-sm rounded bg-gray-200 hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Place-well modal: opens when the user clicks the map in "place-well"
          mode. Lets them name the well before POSTing /wells. */}
      {pendingWellAt && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => setPendingWellAt(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl p-5 w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold mb-2">Place new well</h3>
            <p className="text-xs text-gray-500 mb-3">
              At NS={pendingWellAt.ns.toFixed(1)}, EW={pendingWellAt.ew.toFixed(1)}
            </p>
            <label className="block text-xs text-gray-600 mb-1">Well name</label>
            <input
              autoFocus
              type="text"
              value={pendingWellName}
              onChange={(e) => setPendingWellName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && pendingWellName.trim() && fieldId) {
                  placeWellMut.mutate({
                    fieldId, name: pendingWellName.trim(),
                    ns: pendingWellAt.ns, ew: pendingWellAt.ew,
                  });
                } else if (e.key === "Escape") {
                  setPendingWellAt(null);
                  setPendingWellName("");
                }
              }}
              placeholder="e.g. Well-12"
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
            />
            <div className="flex gap-2 mt-4 justify-end">
              <button
                onClick={() => {
                  setPendingWellAt(null);
                  setPendingWellName("");
                }}
                className="px-3 py-1.5 text-sm rounded bg-gray-200 hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                disabled={!pendingWellName.trim() || placeWellMut.isPending || !fieldId}
                onClick={() => {
                  if (!fieldId) return;
                  placeWellMut.mutate({
                    fieldId, name: pendingWellName.trim(),
                    ns: pendingWellAt.ns, ew: pendingWellAt.ew,
                  });
                }}
                className="px-3 py-1.5 text-sm rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-gray-300"
              >
                {placeWellMut.isPending ? "Saving…" : "Create well"}
              </button>
            </div>
            {placeWellMut.error && (
              <div className="mt-2 text-xs text-red-600">
                {String(placeWellMut.error)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
