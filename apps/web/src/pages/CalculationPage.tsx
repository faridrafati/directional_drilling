import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Fragment, useEffect, useMemo, useRef, useState, lazy, Suspense } from "react";
import { api, type CalculationDetail, type SegmentRow, type CalculateResult, type KeypointRow } from "../api/client.js";
import { rad2deg, deg2rad, ProfileType, profileTypeLabel } from "@dd/shared";
import { ProfilePickerModal } from "../components/ProfilePicker.js";
import { NumberCell, TextCell } from "../components/EditableCell.js";
import { type EditableKey } from "../components/editPolicy.js";
import { profileRoles, isEditableForRole } from "../components/profileRoles.js";
import { StationDetailsPanel, type StationDetails } from "../components/StationDetailsPanel.js";
import { useHistoryState, useUndoRedoHotkeys } from "../hooks/useHistoryState.js";
import { useRecentCalculations } from "../hooks/useRecent.js";

// Heavy components (Three.js, Recharts) are lazy-split so the Grid tab and
// the project list don't pay for them.
const WellViewer3D = lazy(() =>
  import("../components/WellViewer3D.js").then((m) => ({ default: m.WellViewer3D }))
);
const VerticalSectionChart = lazy(() =>
  import("../components/WellCharts.js").then((m) => ({ default: m.VerticalSectionChart }))
);
// Math helpers + UI control for the VSEC reference azimuth — kept in
// WellCharts so the chart toolbar and the grid/stations tables agree on
// the formula AND the input affordance.
import {
  naturalVsecAzm, resolveVsecAzm, projectVsec,
  VsecAzmHeaderButton,
} from "../components/WellCharts.js";
const PlanViewChart = lazy(() =>
  import("../components/WellCharts.js").then((m) => ({ default: m.PlanViewChart }))
);

type Tab = "grid" | "3d" | "charts" | "export";

/**
 * Normalize a degree value into [0, 360°) for display. Compass-style azm /
 * tool-face values are equivalent under 360°-wrap (337.38° == -22.62°), so
 * we standardise on the unsigned representation everywhere they appear.
 * 360 collapses to 0 per the user-facing convention.
 *
 * Pure function — safe to share across the editable Grid format/parse and
 * the read-only Calculated-Stations table.
 */
function normalizeDeg360(deg: number): number {
  if (!Number.isFinite(deg)) return deg;
  const x = deg - 360 * Math.floor(deg / 360);
  return x >= 360 ? 0 : x;
}

/**
 * Survey / Well-Design editor.
 * Tabs: Grid (edit segments) · 3D · Vertical Section · Plan View · Export
 */
export function CalculationPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["calculation", id],
    queryFn: () => api.get<CalculationDetail>(`/calculations/${id}`),
    enabled: !!id,
  });

  const [segments, setSegments, history] = useHistoryState<SegmentRow[]>([]);
  const [tab, setTab] = useState<Tab>("grid");

  // Auto-save lifecycle: track whether the in-memory state diverges from the
  // last server snapshot. Reload from server resets history and the dirty flag.
  const lastSavedRef = useRef<SegmentRow[]>([]);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (data) {
      const next = data.segments.length === 0 ? [defaultStartRow()] : data.segments;
      history.reset(next);                    // wipes undo/redo, sets value
      lastSavedRef.current = next;
      setSavedAt(new Date());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // Track this calc in the sidebar's "Recently opened" list.
  const recentCalcs = useRecentCalculations();
  useEffect(() => {
    if (!data || !id) return;
    const wellName = data.well?.name ?? "";
    const projectName = data.well?.field?.country?.project?.name ?? "";
    recentCalcs.record({
      id,
      label: wellName ? `${wellName} · ${data.name}` : data.name,
      context: projectName,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.id]);

  useUndoRedoHotkeys(history);

  const isDirty = useMemo(
    () => segments !== lastSavedRef.current,
    [segments]
  );

  // null = closed.  { kind: "edit", order } = changing an existing row's profile.
  // { kind: "create" } = "+ Add profile" was clicked — pick a profile first, THEN add.
  type PickerMode =
    | null
    | { kind: "edit"; order: number }
    | { kind: "create" };
  const [picker, setPicker] = useState<PickerMode>(null);

  const saveMut = useMutation({
    mutationFn: () => api.post(`/calculations/${id}/segments`, { segments }),
    // No optimistic wipe: the server smart-diffs which orders are stale (see
    // /segments POST). For pure appends (the common case after picking a
    // profile), all existing rows' keypoints are kept, so the user keeps
    // seeing their last-Calculate values. For edits, the server clears only
    // the changed-or-after orders on the refetch that follows onSuccess.
    onSuccess: () => {
      lastSavedRef.current = segments;
      setSavedAt(new Date());
      qc.invalidateQueries({ queryKey: ["calculation", id] });
    },
  });

  // Debounced autosave: 1.5 s after the last edit, push to the API.
  useEffect(() => {
    if (!data || !isDirty) return;
    const t = setTimeout(() => saveMut.mutate(), 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segments, isDirty]);

  // Per-segment azimuth-branch picks. Keyed by the profile group's
  // segmentOrder (= the LAST row's order). Persisted to localStorage so a
  // user's branch choices for each profile survive reloads. Empty map
  // means branch 1 for every group.
  const azmStorageKey = id ? `azm-choices:${id}` : "";
  const [azimuthChoices, setAzimuthChoices] = useState<Record<number, 1 | 2>>(() => {
    if (!azmStorageKey) return {};
    try {
      const raw = localStorage.getItem(azmStorageKey);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const out: Record<number, 1 | 2> = {};
        for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
          if ((v === 1 || v === 2) && /^\d+$/.test(k)) out[Number(k)] = v;
        }
        return out;
      }
      return {};
    } catch { return {}; }
  });
  useEffect(() => {
    if (azmStorageKey) localStorage.setItem(azmStorageKey, JSON.stringify(azimuthChoices));
  }, [azmStorageKey, azimuthChoices]);

  const calculateMut = useMutation({
    mutationFn: async () => {
      await api.post(`/calculations/${id}/segments`, { segments });
      return api.post<CalculateResult>(`/calculations/${id}/calculate`, { azimuthChoices });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["calculation", id] }),
  });

  // The azimuth-pick modal is suppressed for the rest of the current
  // "Calculate session" once the user has picked OR explicitly dismissed
  // it — otherwise re-Calculating with the chosen branch would re-detect
  // the same ambiguity and immediately re-pop the modal (loop). Cleared
  // every time the user clicks the toolbar's Calculate button.
  const [azmModalDismissed, setAzmModalDismissed] = useState(false);
  const triggerCalculate = () => {
    setAzmModalDismissed(false);
    calculateMut.mutate();
  };

  const stations = data?.stations ?? [];
  const lastResult = calculateMut.data;

  // Auto-dismiss the "Calculated N stations" banner so it doesn't linger
  // forever — but ONLY on success. When there are errors, the banner stays
  // visible until the user explicitly dismisses it (Pascal MIXED.exe behaves
  // the same way for its error showmessage popups) so they don't miss the
  // diagnostic. The ✕ button works either way.
  const [bannerVisible, setBannerVisible] = useState(false);
  useEffect(() => {
    if (!lastResult) {
      setBannerVisible(false);
      return;
    }
    setBannerVisible(true);
    const hasErrors = !lastResult.ok || lastResult.errors.length > 0;
    if (hasErrors) return; // stay visible until manually dismissed
    const t = setTimeout(() => setBannerVisible(false), 4000);
    return () => clearTimeout(t);
  }, [lastResult]);

  // ─── Smooth lines preference (applies to 2D charts + 3D viewer) ───
  // When ON: 2D charts use Recharts `type="monotone"` (smooth Bezier between
  // stations) and the 3D viewer uses a CatmullRom spline through points.
  // When OFF: both render straight polyline segments between stations —
  // useful for verifying densified-station MD precision or when the
  // smoothing visually hides a real kink in the trajectory. Persisted in
  // localStorage so the user's choice survives page reloads.
  const [smoothLines, setSmoothLines] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem("dd:smoothLines");
      return raw === null ? true : raw === "true";
    } catch { return true; }
  });
  useEffect(() => {
    try { localStorage.setItem("dd:smoothLines", String(smoothLines)); } catch { /* noop */ }
  }, [smoothLines]);

  // ─── VSEC view-azimuth (shared between the chart + the grid/stations tables) ───
  // null = use the natural azm (wellhead → last-station bearing); any string
  // means the user typed an override in the VSEC chart's toolbar. Persisting
  // it here lets the editable grid and Calculated Stations table reproject
  // their VSEC columns whenever the chart toolbar changes.
  const [vsecAzmInputStr, setVsecAzmInputStr] = useState<string | null>(null);
  const naturalAzmRad = useMemo(() => naturalVsecAzm(stations), [stations]);
  const vsecRefAzm = resolveVsecAzm(vsecAzmInputStr, naturalAzmRad);
  // Helper that any table consumer can use to project a row's (ns, ew) into
  // the chosen reference direction. Origin is always stations[0] (wellhead).
  const projectVsecAt = useMemo(() => {
    const origin = stations.length > 0
      ? { ns: stations[0].ns, ew: stations[0].ew }
      : { ns: 0, ew: 0 };
    return (ns: number, ew: number) => projectVsec(ns, ew, origin, vsecRefAzm);
  }, [stations, vsecRefAzm]);

  /**
   * Map from a segment's order to its profile-group number ("0" for the
   * START row, "1", "2", … for each consecutive same-profileType run after
   * it). The StationsTable joins stations + keypoints by segmentOrder
   * (= the LAST row of each group) so we map order → groupNum directly.
   */
  const groupLabelByOrder = useMemo(() => {
    const map = new Map<number, string>();
    let groupNum = 0;
    let lastType: number | null = null;
    for (let i = 0; i < segments.length; i++) {
      const t = segments[i].profileType;
      if (i > 0 && t !== lastType) groupNum++;
      map.set(segments[i].order, String(i === 0 ? 0 : groupNum));
      lastType = t;
    }
    return map;
  }, [segments]);

  // Parse the project's units JSON (stored as { length, angle, dls }) so we
  // can label chart axes / tooltips / 3D scale indicator with the right unit
  // suffix. The Project.units field is JSON-encoded (Pascal/SQLite has no
  // native JSON type) so it's parsed per render.
  const lengthUnit = (() => {
    const raw = data?.well?.field?.country?.project?.units;
    if (!raw) return "ft";
    try {
      const parsed = JSON.parse(raw) as { length?: string };
      return parsed.length || "ft";
    } catch {
      return "ft";
    }
  })();

  if (isLoading) return <div className="p-6 text-gray-500">Loading…</div>;
  if (error || !data) return <div className="p-6 text-red-600">Calculation not found.</div>;

  function updateCell<K extends keyof SegmentRow>(index: number, key: K, value: SegmentRow[K]) {
    setSegments((prev) => prev.map((s, i) => (i === index ? { ...s, [key]: value } : s)));
  }
  // "+ Add profile" no longer creates a row directly — it opens the profile picker
  // in "create" mode so the user must choose a profile first. The new row is
  // appended in `applyProfile()` once a selection is made.
  function addRow() {
    setPicker({ kind: "create" });
  }
  /**
   * Remove a row AND its sibling rows from the same profile group.
   * A "group" is a maximal run of consecutive segments sharing the same
   * profileType (excluding START). Deleting any row in a group deletes them
   * all — they were created together by one profile selection.
   */
  function removeRow(index: number) {
    if (index === 0) return;
    setSegments((prev) => {
      const target = prev[index];
      if (!target) return prev;
      // Find group bounds.
      let lo = index, hi = index;
      while (lo > 1 && prev[lo - 1].profileType === target.profileType) lo--;
      while (hi < prev.length - 1 && prev[hi + 1].profileType === target.profileType) hi++;
      return prev.filter((_, i) => i < lo || i > hi);
    });
  }
  function applyProfile(profileType: number) {
    if (!picker) return;
    if (picker.kind === "edit") {
      // Change the profile of an existing group: find the group containing
      // this order, drop it, then append new role-rows in its place.
      const { order } = picker;
      setSegments((prev) => {
        const idx = prev.findIndex((s) => s.order === order);
        if (idx < 0) return prev;
        const oldType = prev[idx].profileType;
        let lo = idx, hi = idx;
        while (lo > 1 && prev[lo - 1].profileType === oldType) lo--;
        while (hi < prev.length - 1 && prev[hi + 1].profileType === oldType) hi++;
        const baseOrder = prev[lo].order;
        const newRows = profileRoles(profileType).map((role, k) => ({
          ...defaultTargetRow(baseOrder + k),
          profileType,
          milestoneRole: role,
          comment: role,
        }));
        const updated = [...prev.slice(0, lo), ...newRows, ...prev.slice(hi + 1)];
        // Renumber `order` so it stays contiguous after the splice.
        return updated.map((s, i) => ({ ...s, order: i }));
      });
    } else {
      // Create — append one row per role for this profile.
      setSegments((prev) => {
        const lastOrder = prev[prev.length - 1]?.order ?? 0;
        const newRows = profileRoles(profileType).map((role, k) => ({
          ...defaultTargetRow(lastOrder + 1 + k),
          profileType,
          milestoneRole: role,
          comment: role,
        }));
        return [...prev, ...newRows];
      });
    }
    setPicker(null);
  }

  async function handlePdfExport() {
    if (!data) return;
    // Dynamic import — pdfmake (~500 kB) doesn't load until the user clicks.
    const { exportCalculationPdf } = await import("../export/pdf.js");
    exportCalculationPdf(data, {
      projectName: data.well?.field?.country?.project?.name ?? "Untitled",
      countryName: data.well?.field?.country?.name ?? "?",
      fieldName: data.well?.field?.name ?? "?",
      wellName: data.well?.name ?? "?",
    });
  }
  async function handleXlsxExport() {
    if (!data) return;
    const { exportCalculationXlsx } = await import("../export/xlsx.js");
    exportCalculationXlsx(data, data.well?.name ?? data.name);
  }

  /**
   * Print the current Charts / 3D View tab as a PDF.
   *
   * Strategy: toggle a body-level `printing` class so the print-only CSS
   * in index.css hides everything except `.print-target` (the wrapper we
   * placed around the WellViewer3D / ChartsView). Then invoke the browser
   * print dialog — the user picks "Save as PDF" (or "Microsoft Print to
   * PDF" on Windows) to get a downloadable file.
   *
   * The `afterprint` listener cleans up the class whether the user
   * actually printed or hit Cancel. We also clear it before re-applying
   * to guard against double-clicks.
   *
   * Why not pdfmake here? Capturing a live React Three Fiber Canvas (3D
   * view) reliably into a PNG requires waiting for the next requestAnimationFrame
   * and reading back from WebGL with preserveDrawingBuffer=true — neither
   * is currently wired. The browser's print engine already handles the
   * 3D canvas + Recharts SVGs natively, so this gives a higher-fidelity
   * result with much less code.
   */
  function handlePrintCurrentTab() {
    document.body.classList.remove("printing");
    document.body.classList.add("printing");
    const cleanup = () => {
      document.body.classList.remove("printing");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    // Give the browser one paint to apply .printing CSS before opening the
    // dialog; otherwise some browsers snapshot the pre-print layout.
    requestAnimationFrame(() => window.print());
  }

  return (
    <div className="p-4 sm:p-6 max-w-[1400px] mx-auto">
      <div className="mb-3">
        <Link to="/projects" className="text-sm text-blue-600 hover:underline">
          ← All projects
        </Link>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4">
        <div className="min-w-0">
          <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 truncate">
            {data.name}
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            {data.type}
            {data.well && (
              <>
                {" · "}
                <span className="hidden sm:inline">
                  {data.well.field?.country?.project?.name} /{" "}
                  {data.well.field?.country?.name} / {data.well.field?.name} /{" "}
                </span>
                <span className="text-gray-700 font-medium">{data.well.name}</span>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SaveStatus
            isDirty={isDirty}
            isSaving={saveMut.isPending}
            savedAt={savedAt}
            error={saveMut.error ? String(saveMut.error) : null}
          />
          {(tab === "3d" || tab === "charts") && (
            <>
              <label
                className="inline-flex items-center gap-1.5 text-sm text-gray-700 select-none px-2 h-10 sm:h-9 rounded-md bg-gray-100 hover:bg-gray-200 cursor-pointer"
                title="When on, the path is rendered as a smooth curve through stations (Recharts monotone + 3D Catmull-Rom). When off, straight polyline segments."
              >
                <input
                  type="checkbox"
                  checked={smoothLines}
                  onChange={(e) => setSmoothLines(e.target.checked)}
                  className="cursor-pointer"
                />
                Smooth lines
              </label>
              <button
                onClick={handlePrintCurrentTab}
                className="px-3 h-10 sm:h-9 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 inline-flex items-center gap-1.5"
                title="Open the browser print dialog. Choose 'Save as PDF' to export the current view."
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 6 2 18 2 18 9" />
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                  <rect x="6" y="14" width="12" height="8" />
                </svg>
                Print as PDF
              </button>
            </>
          )}
          {tab === "grid" && (
            <>
              <div className="flex gap-1">
                <button
                  onClick={history.undo}
                  disabled={!history.canUndo}
                  title="Undo (Ctrl+Z)"
                  aria-label="Undo"
                  className="w-10 h-10 sm:w-9 sm:h-9 inline-flex items-center justify-center rounded-md bg-gray-100 hover:bg-gray-200 active:bg-gray-300 disabled:opacity-40"
                >
                  ↶
                </button>
                <button
                  onClick={history.redo}
                  disabled={!history.canRedo}
                  title="Redo (Ctrl+Shift+Z)"
                  aria-label="Redo"
                  className="w-10 h-10 sm:w-9 sm:h-9 inline-flex items-center justify-center rounded-md bg-gray-100 hover:bg-gray-200 active:bg-gray-300 disabled:opacity-40"
                >
                  ↷
                </button>
              </div>
              <button
                onClick={addRow}
                className="px-3 h-10 sm:h-9 text-sm rounded-md bg-gray-100 hover:bg-gray-200 active:bg-gray-300"
              >
                + Add profile
              </button>
            </>
          )}
          <button
            onClick={triggerCalculate}
            disabled={calculateMut.isPending}
            className="px-4 h-10 sm:h-9 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 disabled:bg-gray-300 font-medium min-w-[110px]"
          >
            {calculateMut.isPending ? "Calculating…" : "Calculate"}
          </button>
        </div>
      </div>

      <Tabs current={tab} onChange={setTab} />

      {lastResult && bannerVisible && tab === "grid" && (
        <div
          className={`mb-4 p-3 rounded text-sm relative transition-opacity duration-500 ${
            lastResult.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
          }`}
        >
          <button
            type="button"
            onClick={() => setBannerVisible(false)}
            className="absolute top-1 right-2 text-xs opacity-60 hover:opacity-100"
            aria-label="Dismiss"
            title="Dismiss"
          >
            ✕
          </button>
          {lastResult.ok
            ? `Calculated ${lastResult.stationCount} stations.`
            : `Calculated ${lastResult.stationCount} stations with errors:`}
          {lastResult.errors.length > 0 && (
            <ul className="mt-1 ml-4 list-disc">
              {lastResult.errors.map((e, i) => {
                // Show "Segment 3.2" — group.position — matching the grid's
                // 1-1 / 1-2 / 2-1 / ... row labels. When the failure is
                // about an input the user actually owns (e.g. DLS), point
                // to the row that holds that input rather than the
                // dispatcher's target row — so for HCH the alert reads
                // "3.2" (the DLS row) not "3.3" (the Target row).
                //
                // Older API responses (without groupNumber) fall back to
                // the raw sorted-index for compatibility.
                let label: string;
                if (typeof e.groupNumber === "number"
                    && typeof e.groupPosition === "number") {
                  let pos = e.groupPosition;
                  const failingTyp = segments[e.segmentIndex]?.profileType;
                  if (
                    failingTyp != null
                    && typeof e.groupSize === "number"
                    && /\bDLS\b/i.test(e.message)
                  ) {
                    // Walk the group's rows; pick the first one whose
                    // profileRoles editable mask includes "dls".
                    const firstRow = e.segmentIndex - e.groupSize + 1;
                    for (let k = 0; k < e.groupSize; k++) {
                      const seg = segments[firstRow + k];
                      const roles = profileRoles(failingTyp);
                      const role = roles[k] ?? null;
                      if (
                        seg
                        && role
                        && isEditableForRole(failingTyp, role, "dls")
                      ) {
                        pos = k + 1; // 1-based for display
                        break;
                      }
                    }
                  }
                  label = `Segment ${e.groupNumber}.${pos}`;
                } else {
                  label = `Segment ${e.segmentIndex}`;
                }
                return <li key={i}>{label}: {e.message}</li>;
              })}
            </ul>
          )}
        </div>
      )}

      {tab === "grid" && (
        <>
          <SegmentGrid
            segments={segments}
            keypoints={data?.keypoints ?? []}
            stations={stations}
            onCell={updateCell}
            onRemove={removeRow}
            onPickProfile={(order) => setPicker({ kind: "edit", order })}
            lengthUnit={lengthUnit}
            projectVsec={projectVsecAt}
            vsecAzmInputStr={vsecAzmInputStr}
            onVsecAzmInputChange={setVsecAzmInputStr}
            naturalAzm={naturalAzmRad}
          />
          {stations.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-medium mb-2">
                Calculated Stations ({stations.length})
                {(data?.keypoints?.length ?? 0) > 0 && (
                  <span className="text-sm text-amber-700 font-normal ml-2">
                    + {data?.keypoints?.length ?? 0} key points ★
                  </span>
                )}
              </h3>
              <StationsTable
                stations={stations}
                keypoints={data?.keypoints ?? []}
                lengthUnit={lengthUnit}
                groupLabelByOrder={groupLabelByOrder}
                projectVsec={projectVsecAt}
                vsecAzmInputStr={vsecAzmInputStr}
                onVsecAzmInputChange={setVsecAzmInputStr}
                naturalAzm={naturalAzmRad}
              />
            </div>
          )}
        </>
      )}

      <Suspense fallback={<div className="p-4 text-sm text-gray-500">Loading viewer…</div>}>
        {tab === "3d" && (
          <div className="print-target">
            <WellViewer3D
              stations={stations}
              keypoints={data?.keypoints ?? []}
              lengthUnit={lengthUnit}
              smoothLines={smoothLines}
            />
          </div>
        )}
        {tab === "charts" && (
          <div className="print-target">
            <ChartsView
              stations={stations}
              keypoints={data?.keypoints ?? []}
              lengthUnit={lengthUnit}
              vsecAzmInputStr={vsecAzmInputStr}
              onVsecAzmInputChange={setVsecAzmInputStr}
              smoothLines={smoothLines}
              meta={{
                country: data?.well?.field?.country?.name ?? "?",
                field: data?.well?.field?.name ?? "?",
                well: data?.well?.name ?? "?",
                calcName: data?.name ?? "",
              }}
            />
          </div>
        )}
      </Suspense>
      {tab === "export" && (
        <div className="bg-white border border-gray-200 rounded p-6 space-y-4">
          <p className="text-sm text-gray-600">
            Export the {stations.length} calculated stations.
          </p>
          <div className="flex gap-3">
            <button
              onClick={handlePdfExport}
              disabled={stations.length === 0}
              className="px-4 py-2 text-sm rounded bg-red-600 text-white hover:bg-red-700 disabled:bg-gray-300"
            >
              Download PDF
            </button>
            <button
              onClick={handleXlsxExport}
              disabled={stations.length === 0}
              className="px-4 py-2 text-sm rounded bg-green-700 text-white hover:bg-green-800 disabled:bg-gray-300"
            >
              Download Excel (.xlsx)
            </button>
          </div>
          {stations.length === 0 && (
            <p className="text-xs text-gray-400">Calculate the trajectory first.</p>
          )}
        </div>
      )}

      {picker !== null && (
        <ProfilePickerModal
          mode={picker.kind}
          onSelect={(t) => applyProfile(t)}
          onCancel={() => setPicker(null)}
        />
      )}

      {/* Azimuth-pick modal — Pascal Form07. Pops after a Calculate that
          returned 2 distinct azm candidates for one or more profile groups.
          The user picks branch 1 vs 2 PER profile group; only the curves
          the user actually flagged get re-built. Dismissed until the next
          toolbar Calculate so the picked branches don't keep re-popping
          the modal in a loop. */}
      {!azmModalDismissed && lastResult?.azmCandidates?.length ? (
        <AzmChoiceModal
          candidates={lastResult.azmCandidates}
          currentChoices={azimuthChoices}
          onApply={(picks) => {
            setAzmModalDismissed(true);
            setAzimuthChoices((prev) => ({ ...prev, ...picks }));
            calculateMut.mutate();
          }}
          onCancel={() => setAzmModalDismissed(true)}
        />
      ) : null}
    </div>
  );
}

/**
 * Pascal Form07 modal — lets the user pick branch 1 vs 2 PER profile
 * group when the dispatcher finds two feasible target azimuths for any
 * of them. Each ambiguous group gets its own radio pair so the user can
 * mix branches across the trajectory (e.g. HCH group #2 on branch 1 +
 * HC3D group #4 on branch 2). Apply pushes the per-group picks into the
 * parent's `azimuthChoices` map and re-runs Calculate.
 */
function AzmChoiceModal({
  candidates, currentChoices, onApply, onCancel,
}: {
  candidates: NonNullable<CalculateResult["azmCandidates"]>;
  currentChoices: Record<number, 1 | 2>;
  onApply: (picks: Record<number, 1 | 2>) => void;
  onCancel: () => void;
}) {
  // Draft picks indexed by the group's segmentOrder. Initially mirrors the
  // dispatcher's `chosen` value so the radios reflect the current branch.
  const [picks, setPicks] = useState<Record<number, 1 | 2>>(() => {
    const out: Record<number, 1 | 2> = {};
    for (const c of candidates) {
      out[c.segmentOrder] = currentChoices[c.segmentOrder] ?? c.chosen;
    }
    return out;
  });
  const setOne = (segmentOrder: number, b: 1 | 2) =>
    setPicks((prev) => ({ ...prev, [segmentOrder]: b }));

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">
            Pick azimuth branch per profile
          </h3>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 -m-1 p-1 rounded"
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="px-4 py-4 text-sm space-y-3">
          <p className="text-xs text-gray-500">
            Each profile group below has two feasible target azimuths.
            Pick which branch to commit to for each one independently.
            Only the selected branches are re-calculated.
          </p>

          <div className="border border-gray-200 rounded text-xs overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-2 py-1.5 text-left">Group</th>
                  <th className="px-2 py-1.5 text-left">Profile</th>
                  <th className="px-2 py-1.5 text-center">Branch 1</th>
                  <th className="px-2 py-1.5 text-center">Branch 2</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((c) => {
                  const pick = picks[c.segmentOrder] ?? c.chosen;
                  return (
                    <tr key={c.segmentOrder} className="border-t border-gray-100">
                      <td className="px-2 py-1.5 font-mono text-gray-500">#{c.segmentOrder}</td>
                      <td className="px-2 py-1.5">{c.profileLabel}</td>
                      <td className={`px-2 py-1.5 text-center font-mono ${pick === 1 ? "bg-blue-50" : ""}`}>
                        <label className="inline-flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name={`azm-${c.segmentOrder}`}
                            checked={pick === 1}
                            onChange={() => setOne(c.segmentOrder, 1)}
                          />
                          <span className={pick === 1 ? "font-semibold text-blue-700" : "text-gray-700"}>
                            {c.candidate1Deg.toFixed(2)}°
                          </span>
                        </label>
                      </td>
                      <td className={`px-2 py-1.5 text-center font-mono ${pick === 2 ? "bg-blue-50" : ""}`}>
                        <label className="inline-flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name={`azm-${c.segmentOrder}`}
                            checked={pick === 2}
                            onChange={() => setOne(c.segmentOrder, 2)}
                          />
                          <span className={pick === 2 ? "font-semibold text-blue-700" : "text-gray-700"}>
                            {c.candidate2Deg.toFixed(2)}°
                          </span>
                        </label>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="px-4 py-3 border-t border-gray-200 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-sm rounded bg-gray-100 hover:bg-gray-200"
          >
            Keep current
          </button>
          <button
            onClick={() => onApply(picks)}
            className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
          >
            Apply &amp; recalculate
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Charts tab wrapper. Renders both VSEC and Plan View charts side-by-side
 * sharing ONE hover-driven details panel — the panel updates whichever
 * chart the cursor is currently over.
 *
 * Each chart still owns its small floating tooltip near the cursor; the
 * shared panel is the deep-dive inspector with the full Pascal column set.
 */
function ChartsView({
  stations, keypoints, lengthUnit, vsecAzmInputStr, onVsecAzmInputChange,
  smoothLines, meta,
}: {
  stations: NonNullable<CalculationDetail["stations"]>;
  keypoints: KeypointRow[];
  lengthUnit: string;
  vsecAzmInputStr: string | null;
  onVsecAzmInputChange: (next: string | null) => void;
  smoothLines: boolean;
  /** Metadata for the printed header. Country / Field / Well names. */
  meta: { country: string; field: string; well: string; calcName: string };
}) {
  const [hovered, setHovered] = useState<StationDetails | null>(null);

  return (
    <>
      {/* On-screen layout: charts side-by-side with the hover panel on the
          right. Print-friendly classes (`print-charts-row`, `print-chart-card`)
          let the @media print CSS rearrange the layout into a 1-row landscape
          / 2-row portrait grid without affecting the screen view. */}
      <div className="flex flex-col xl:flex-row gap-3">
        {/* Print-only header — well / field metadata sits above the charts
            in the printed PDF. Hidden on screen via .print-only. */}
        <div className="print-only print-header">
          <h1>{meta.field.toUpperCase()} — {meta.calcName}</h1>
          <div className="print-meta">
            Country: {meta.country} &nbsp;·&nbsp; Well: {meta.well} &nbsp;·&nbsp;
            Generated {new Date().toLocaleString()}
          </div>
        </div>
        <div className="flex-1 grid grid-cols-1 xl:grid-cols-2 gap-4 min-w-0 print-charts-row">
          <div className="print-chart-card">
            <VerticalSectionChart
              stations={stations}
              keypoints={keypoints}
              lengthUnit={lengthUnit}
              onHover={setHovered}
              showDetailsPanel={false}
              vsecAzmInputStr={vsecAzmInputStr}
              onVsecAzmInputChange={onVsecAzmInputChange}
              smoothLines={smoothLines}
            />
          </div>
          <div className="print-chart-card">
            <PlanViewChart
              stations={stations}
              keypoints={keypoints}
              lengthUnit={lengthUnit}
              onHover={setHovered}
              showDetailsPanel={false}
              smoothLines={smoothLines}
            />
          </div>
        </div>
        <div className="print-hidden">
          <StationDetailsPanel
            point={hovered}
            lengthUnit={lengthUnit}
            widthClass="w-72 xl:w-64"
          />
        </div>
      </div>

      {/* Print-only stations table — paginated automatically by the browser
          across pages; the @media print rules in index.css repeat the
          header on each page and prevent rows from being split mid-page. */}
      <div className="print-only">
        <h2 style={{ fontSize: "11pt", color: "#1e3a8a", margin: "6mm 0 2mm 0" }}>
          Calculated Stations ({stations.length})
        </h2>
        <PrintStationsTable stations={stations} lengthUnit={lengthUnit} />
      </div>
    </>
  );
}

/**
 * Plain HTML table styled by .print-stations-table CSS for the print PDF.
 * Mirrors the on-screen StationsTable columns + units so the engineer gets
 * the same view in their printed report. We render it as a separate
 * lightweight component (no hover, no VSEC reprojection, no virtualisation)
 * because it never appears on screen — only when the browser is in
 * print mode and the print-only block becomes visible.
 */
function PrintStationsTable({
  stations, lengthUnit,
}: {
  stations: NonNullable<CalculationDetail["stations"]>;
  lengthUnit: string;
}) {
  const headers = [
    "#", "Comment", `MD (${lengthUnit})`, "Inc (°)", "Azm (°)",
    `TVD (${lengthUnit})`, `VSEC (${lengthUnit})`,
    `NS (${lengthUnit})`, `EW (${lengthUnit})`,
    "DLS (°/100ft)", "TF (°)", "BR (°/100ft)", "TR (°/100ft)",
    `DMD (${lengthUnit})`,
  ];
  return (
    <table className="print-stations-table">
      <thead>
        <tr>{headers.map((h) => <th key={h}>{h}</th>)}</tr>
      </thead>
      <tbody>
        {stations.map((s, i) => (
          <tr key={s.id ?? i}>
            <td>{i}</td>
            <td>{s.comment ?? ""}</td>
            <td>{s.md.toFixed(1)}</td>
            <td>{rad2deg(s.inc).toFixed(2)}</td>
            <td>{normalizeDeg360(rad2deg(s.azm)).toFixed(2)}</td>
            <td>{s.tvd.toFixed(1)}</td>
            <td>{s.vsec.toFixed(1)}</td>
            <td>{s.ns.toFixed(1)}</td>
            <td>{s.ew.toFixed(1)}</td>
            <td>{(Math.abs(rad2deg(s.dls)) * 100).toFixed(3)}</td>
            <td>{normalizeDeg360(rad2deg(s.tf)).toFixed(2)}</td>
            <td>{(rad2deg(s.br) * 100).toFixed(3)}</td>
            <td>{(rad2deg(s.tr) * 100).toFixed(3)}</td>
            <td>{s.dmd.toFixed(1)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Tabs({ current, onChange }: { current: Tab; onChange: (t: Tab) => void }) {
  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "grid", label: "Grid" },
    { id: "3d", label: "3D View" },
    // Vertical Section + Plan View live on a single "Charts" tab so users
    // can see both 2D projections of the trajectory side-by-side.
    { id: "charts", label: "Charts" },
    { id: "export", label: "Export" },
  ];
  return (
    <div className="flex border-b border-gray-200 mb-4 overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`px-4 py-3 sm:py-2 text-sm border-b-2 whitespace-nowrap transition-colors ${
            current === t.id
              ? "border-blue-600 text-blue-700 font-medium"
              : "border-transparent text-gray-600 hover:text-gray-900"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function defaultStartRow(): SegmentRow {
  return {
    order: 0, profileType: ProfileType.START,
    milestoneRole: null, comment: "START STATION",
    md: 0, inc: 0, azm: 0, tvd: 0, vsec: 0,
    ns: 0, ew: 0, dls: 0, tf: 0, br: 0, tr: 0, dmd: 0,
    surveyTools: null,
  };
}

/** A blank role row — filled in by applyProfile() with the actual profile & role. */
function defaultTargetRow(order: number): SegmentRow {
  return {
    order,
    profileType: ProfileType.HOLD_NS,
    milestoneRole: "Target",
    comment: "Target",
    md: 0, inc: 0, azm: 0, tvd: 0, vsec: 0,
    ns: 0, ew: 0, dls: 0, tf: 0, br: 0, tr: 0, dmd: 0,
    surveyTools: null,
  };
}

function SaveStatus({
  isDirty, isSaving, savedAt, error,
}: {
  isDirty: boolean; isSaving: boolean; savedAt: Date | null; error: string | null;
}) {
  let label: string;
  let cls: string;
  if (error) {
    label = `Save failed: ${error.slice(0, 60)}`;
    cls = "text-red-600";
  } else if (isSaving) {
    label = "Saving…";
    cls = "text-amber-600";
  } else if (isDirty) {
    label = "Unsaved changes";
    cls = "text-amber-600";
  } else if (savedAt) {
    label = `Saved ${formatRelative(savedAt)}`;
    cls = "text-gray-500";
  } else {
    label = "";
    cls = "text-gray-500";
  }
  return <span className={`text-xs ${cls}`}>{label}</span>;
}

function formatRelative(d: Date): string {
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  return d.toLocaleTimeString();
}

interface SegmentGridProps {
  segments: SegmentRow[];
  /** Exact algebraic milestones from the dispatcher (KOP/EOC/Target/…).
   *  Each row of a profile group reads the keypoint at its position. */
  keypoints: KeypointRow[];
  /** Densified stations — used to source the START row's post-pass
   *  computed values (TF, VSEC, BR, TR) that the segment record itself
   *  doesn't carry. stations[0] IS the START's computed state. */
  stations: NonNullable<CalculationDetail["stations"]>;
  onCell: <K extends keyof SegmentRow>(index: number, key: K, value: SegmentRow[K]) => void;
  onRemove: (index: number) => void;
  onPickProfile: (order: number) => void;
  /** Project-scoped length unit shown next to length-typed column headers. */
  lengthUnit: string;
  /** Reproject (ns, ew) onto the user's chosen VSEC reference azimuth.
   *  Overrides the segment row's stored vsec so it stays in sync with
   *  the VSEC chart's toolbar. */
  projectVsec: (ns: number, ew: number) => number;
  /** Current VSEC azimuth string ("90", "102.5", …) or null = natural. */
  vsecAzmInputStr: string | null;
  /** Setter the popup calls when the user clicks Apply. */
  onVsecAzmInputChange: (next: string | null) => void;
  /** Natural azimuth (radians) — shown to the user inside the popup. */
  naturalAzm: number;
}

function SegmentGrid({
  segments, keypoints, stations, onCell, onRemove, onPickProfile, lengthUnit, projectVsec,
  vsecAzmInputStr, onVsecAzmInputChange, naturalAzm,
}: SegmentGridProps) {
  /**
   * For each segment row, the exact algebraic milestone that should populate
   * its read-only cells. The dispatcher returns one keypoint per role within
   * each profile group, indexed by `segmentOrder` (the LAST row's order) and
   * `roleIndex` (0..N-1). KOP / EOC / Target etc. come from each builder's
   * analytic equations — NOT by sampling the densified path — so values are
   * exact (e.g. HC3D KOP at MD = TVD/cos θ1 to full float precision).
   *
   * Pre-calculate, keypoints[] is empty → cells stay at zero.
   */
  const milestoneByRowIndex = useMemo(() => {
    // Map row → record-with-computed-columns. The grid renders read-only
    // cells from this when present; falls back to the segment's own data
    // otherwise.
    //
    // Two sources:
    //   - START row (index 0) → stations[0] (the dispatcher copied the
    //     start verbatim and then ran VSEC/TF/BR/TR post-passes on it).
    //     Without this, the grid would show tf=0 / vsec=0 since those
    //     fields aren't persisted on the Segment record.
    //   - Profile rows → the keypoint at the matching (segmentOrder,
    //     roleIndex). Exact algebraic milestones from each builder.
    const map = new Map<number, KeypointRow | NonNullable<CalculationDetail["stations"]>[number]>();
    if (segments.length === 0) return map;

    // 1) START gets stations[0] — same fields, post-pass already filled.
    if (segments[0].profileType === 0 && stations.length > 0) {
      map.set(0, stations[0]);
    }

    // 2) Profile rows get keypoints by (segmentOrder, roleIndex).
    const kpBy = new Map<number, KeypointRow[]>();
    for (const kp of keypoints) {
      const arr = kpBy.get(kp.segmentOrder);
      if (arr) arr.push(kp);
      else kpBy.set(kp.segmentOrder, [kp]);
    }
    for (const arr of kpBy.values()) arr.sort((a, b) => a.roleIndex - b.roleIndex);

    let i = segments[0].profileType === 0 ? 1 : 0;
    while (i < segments.length) {
      const typ = segments[i].profileType;
      let j = i;
      while (j < segments.length && segments[j].profileType === typ) j++;
      const groupSize = j - i;
      const groupKps = kpBy.get(segments[j - 1].order) ?? [];
      for (let k = 0; k < groupSize; k++) {
        const kp = groupKps[k];
        if (kp) map.set(i + k, kp);
      }
      i = j;
    }
    return map;
  }, [segments, keypoints, stations]);

  // Full Pascal column set (Unit02.pas:54-100 column convention):
  //   MD, Inc, Azm, TVD, VSEC, NS, EW, DLS, TF, BR, TR, DMD
  // VSEC and TF are read-only (computed by the dispatcher's post-passes).
  // BR/TR are only editable on multi-curve combo profiles (codes 60..103)
  // — see editPolicy.ts — but we always SHOW them so the user can see what
  // was computed and so the grid never has columns appear/disappear under
  // them mid-edit.
  const columns: Array<{ key: EditableKey; label: string; unit?: "deg" | "deg/L" | "len" }> = useMemo(() => [
    { key: "comment", label: "Comment" },
    { key: "md", label: "MD", unit: "len" },
    { key: "inc", label: "Inc", unit: "deg" },
    { key: "azm", label: "Azm", unit: "deg" },
    { key: "tvd", label: "TVD", unit: "len" },
    { key: "vsec", label: "VSEC", unit: "len" },
    { key: "ns", label: "NS", unit: "len" },
    { key: "ew", label: "EW", unit: "len" },
    { key: "dls", label: "DLS", unit: "deg/L" },
    { key: "tf", label: "TF", unit: "deg" },
    { key: "br", label: "BR", unit: "deg/L" },
    { key: "tr", label: "TR", unit: "deg/L" },
    { key: "dmd", label: "DMD", unit: "len" },
  ], []);

  /**
   * Group index per row (0,0,0, 1,1, 2, 3,3,3, …). Used to alternate a subtle
   * background tint between profile groups so each group reads as its own
   * visual block. Recomputed only when the profile-type sequence changes.
   */
  const groupIndexByRow = useMemo(() => {
    const arr: number[] = [];
    let g = 0;
    for (let i = 0; i < segments.length; i++) {
      if (i > 0 && segments[i - 1].profileType !== segments[i].profileType) g++;
      arr.push(g);
    }
    return arr;
  }, [segments]);

  /**
   * Profile-group label for each row: `${groupIdx}-${posInGroup}` like
   * "1-1", "1-2", "2-1". The START row is its own group #0 and gets a
   * bare "0" since it has no role-position. Pascal numbered rows
   * sequentially (1, 2, 3 …) — this scheme makes it obvious which rows
   * belong together as one profile.
   */
  const rowLabelByIndex = useMemo(() => {
    const labels: string[] = [];
    let groupNum = 0;            // 0 = START
    let posInGroup = 0;          // 1-based within a group
    let lastType: number | null = null;
    for (let i = 0; i < segments.length; i++) {
      const t = segments[i].profileType;
      if (i === 0) {
        labels.push("0");
        lastType = t;
        continue;
      }
      if (t !== lastType) { groupNum++; posInGroup = 1; }
      else                { posInGroup++; }
      labels.push(`${groupNum}-${posInGroup}`);
      lastType = t;
    }
    return labels;
  }, [segments]);

  const inputCls =
    "w-20 px-1 py-0.5 border border-transparent hover:border-gray-300 " +
    "focus:border-blue-500 focus:outline-none rounded";
  // Tighter width for rate/angle columns whose values fit in fewer chars
  // (TF, DLS, BR, TR all display as e.g. "12.345" — 6 chars max).
  const inputClsNarrow =
    "w-14 px-1 py-0.5 border border-transparent hover:border-gray-300 " +
    "focus:border-blue-500 focus:outline-none rounded";
  const isNarrowCol = (key: EditableKey) =>
    key === "tf" || key === "dls" || key === "br" || key === "tr";

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
      <div className="overflow-x-auto relative">
        {/* Subtle scroll-hint shadows on small screens */}
        <div className="pointer-events-none sm:hidden absolute inset-y-0 right-0 w-4 bg-gradient-to-l from-white to-transparent z-20" />
      <table className="min-w-full text-xs border-collapse">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200 text-gray-700">
            <th className="sticky left-0 z-10 bg-gray-50 px-2 py-2 text-left w-10 border-r border-gray-200">#</th>
            <th className="sticky left-10 z-10 bg-gray-50 px-2 py-2 text-left w-28 border-r border-gray-200">Profile</th>
            {columns.map((c) => {
              const narrow = isNarrowCol(c.key);
              const suffix =
                c.unit === "deg"   ? " (°)" :
                c.unit === "deg/L" ? " (°/L)" :
                c.unit === "len"   ? ` (${lengthUnit})` :
                "";
              return (
                <th
                  key={String(c.key)}
                  className={`${narrow ? "px-1" : "px-2"} py-2 text-left font-medium whitespace-nowrap${
                    narrow ? " text-[11px]" : ""
                  }`}
                >
                  {c.label}{suffix}
                  {/* VSEC column shows an ⓘ button that opens a popup for
                      changing the projection azimuth — reprojects every
                      VSEC cell across the page on Apply. */}
                  {c.key === "vsec" && (
                    <VsecAzmHeaderButton
                      inputStr={vsecAzmInputStr}
                      naturalAzm={naturalAzm}
                      onChange={onVsecAzmInputChange}
                    />
                  )}
                </th>
              );
            })}
            <th className="px-2 py-2 w-8"></th>
          </tr>
        </thead>
        <tbody>
          {segments.map((s, i) => {
            // Group detection: a row is the FIRST of its profile group when the
            // previous row has a different profileType. LAST when the next does.
            // The profile picker button + group-level delete live on the first
            // and last row respectively.
            const isFirstOfGroup =
              i === 0 || segments[i - 1].profileType !== s.profileType;
            const isLastOfGroup =
              i === segments.length - 1 ||
              segments[i + 1].profileType !== s.profileType;
            const profileLabel = profileTypeLabel(s.profileType);

            // After Calculate, EVERY row of a group gets its own milestone
            // station via milestoneByRowIndex (KOP / EOC / Target etc.).
            // Pre-calculate, this is undefined → cells stay at zero.
            const computedStation = milestoneByRowIndex.get(i);

            // Visual chunking: each profile group reads as its own boxed
            // rectangle. Stronger than a typical zebra-stripe because the user
            // needs to tell at a glance which rows belong together.
            //   - Thick (4 px) slate-600 borders bracket each group top/bottom.
            //   - Adjacent groups alternate slate-100 ↔ white background so
            //     each block visually fills its own band.
            //   - Within-group rows get only a hairline divider.
            //   - Cells inherit groupBg via `bg-inherit` so sticky columns
            //     show the same band as the rest of the row.
            const groupIdx = groupIndexByRow[i] ?? 0;
            const groupBg = i === 0
              ? "bg-gray-200"
              : groupIdx % 2 === 0
                ? "bg-white"
                : "bg-slate-100";
            const groupBorder =
              (isFirstOfGroup && i !== 0 ? " border-t-4 border-t-slate-600" : "") +
              (isLastOfGroup ? " border-b-4 border-b-slate-600" : " border-b border-gray-100");

            return (
              <Fragment key={i}>
                <tr
                  className={`hover:bg-blue-50/60 ${groupBg}${groupBorder}`}
                >
                  <td className="sticky left-0 z-10 bg-inherit px-2 py-1.5 text-gray-400 font-mono border-r border-gray-200">
                    {rowLabelByIndex[i] ?? s.order}
                  </td>
                  <td className="sticky left-10 z-10 bg-inherit px-2 py-1.5 border-r border-gray-200 whitespace-nowrap">
                    {i === 0 ? (
                      <span className="text-gray-500 text-xs font-medium">START</span>
                    ) : isFirstOfGroup ? (
                      <button
                        onClick={() => onPickProfile(s.order)}
                        className="text-blue-600 hover:underline font-medium text-xs"
                        title={`Change profile (currently ${profileLabel})`}
                      >
                        {profileLabel}
                      </button>
                    ) : (
                      <span className="text-gray-400 text-[11px] italic pl-2">
                        ↳ {s.milestoneRole ?? ""}
                      </span>
                    )}
                  </td>
                  {columns.map((c) => {
                    const editable =
                      c.key === "comment" ||
                      isEditableForRole(s.profileType, s.milestoneRole ?? null, c.key);

                    if (c.key === "comment") {
                      return (
                        <td key="comment" className="px-2 py-1">
                          <TextCell
                            value={(s.comment ?? "") as string}
                            onCommit={(v) => onCell(i, "comment", v as never)}
                            className={inputCls}
                          />
                        </td>
                      );
                    }
                    // Read-only cells display the computed value from this
                    // row's milestone station (different milestone per row).
                    const rawFromSegment = s[c.key];
                    const rawFromStation =
                      computedStation && c.key in computedStation
                        ? (computedStation as unknown as Record<string, unknown>)[c.key]
                        : undefined;
                    let raw: SegmentRow[keyof SegmentRow] | number | undefined =
                      !editable && typeof rawFromStation === "number"
                        ? rawFromStation
                        : rawFromSegment;
                    // VSEC depends on the user-chosen view azimuth in the
                    // Charts tab. Reproject the row's (ns, ew) here so the
                    // grid value follows the chart's toolbar live.
                    if (c.key === "vsec") {
                      const sourceNs = (computedStation?.ns ?? s.ns) as number;
                      const sourceEw = (computedStation?.ew ?? s.ew) as number;
                      raw = projectVsec(sourceNs, sourceEw);
                    }
                    const numeric = typeof raw === "number" ? raw : 0;
                    const isAngleDeg = c.unit === "deg";
                    const isDlsDeg = c.unit === "deg/L";
                    // DLS is shown as a magnitude only — the dispatcher may have
                    // chosen a negative sign internally (drop curve / branch flip)
                    // but the user-facing convention matches Pascal:
                    //   wlpt2[1].dls := abs(wlpta2[1].dls).
                    // BR/TR keep their sign because direction is meaningful there
                    // (negative BR = drop, negative TR = left turn).
                    const isDlsCell = c.key === "dls";
                    // Azimuth + toolface are directional compass angles —
                    // display them in [0, 360°). 360° collapses to 0°. This
                    // prevents the alternate-branch 337.38° from showing as
                    // its (mathematically equivalent) -22.62° representation.
                    // Inc / BR / TR keep their signed display: inc is a polar
                    // angle bounded to [0, π]; BR/TR signs encode build-vs-drop
                    // and right-vs-left, which the user needs to see.
                    const isCompassAngle = c.key === "azm" || c.key === "tf";

                    const format = (n: number) => {
                      if (isDlsCell) return (Math.abs(rad2deg(n)) * 100).toFixed(3);
                      if (isCompassAngle) return normalizeDeg360(rad2deg(n)).toFixed(2);
                      if (isAngleDeg) return rad2deg(n).toFixed(2);
                      if (isDlsDeg) return (rad2deg(n) * 100).toFixed(3);
                      return n.toFixed(3);
                    };
                    const parse = (str: string) => {
                      const cleaned = str.trim();
                      if (cleaned === "" || cleaned === "-" || cleaned === ".") return null;
                      const n = Number(cleaned);
                      if (!isFinite(n)) return null;
                      if (isCompassAngle) return deg2rad(normalizeDeg360(n));
                      return isAngleDeg
                        ? deg2rad(n)
                        : isDlsDeg
                          ? deg2rad(n / 100)
                          : n;
                    };
                    return (
                      <td key={String(c.key)} className={`${isNarrowCol(c.key) ? "px-1" : "px-2"} py-1`}>
                        <NumberCell
                          value={numeric}
                          format={format}
                          parse={parse}
                          onCommit={(n) => onCell(i, c.key, n as never)}
                          readOnly={!editable}
                          className={isNarrowCol(c.key) ? inputClsNarrow : inputCls}
                        />
                      </td>
                    );
                  })}
                  <td className="px-2 py-1">
                    {i > 0 && isLastOfGroup && (
                      <button
                        onClick={() => onRemove(i)}
                        className="text-red-500 hover:text-red-700"
                        title={`Remove ${profileLabel} (${
                          profileRoles(s.profileType).length
                        } rows)`}
                      >
                        ×
                      </button>
                    )}
                  </td>
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}

/**
 * Combined Stations + Keypoints table.
 *
 * Merges the densified path stations with the exact algebraic keypoints
 * (KOP / EOC / Target) into one MD-sorted view. Keypoints are highlighted
 * with a coloured background so they stand out from the regular sampled
 * stations around them, e.g.:
 *
 *     500    Vertical      MD=500.0
 *     585.79 KOP (HC3D*)   MD=585.79   ← exact key point (highlighted)
 *     600    CURVE         MD=600.0
 *     …
 *     6500   CURVE         MD=6500.0
 *     6534.6 EOC (Target)  MD=6534.6   ← exact key point (highlighted)
 */
function StationsTable({
  stations,
  keypoints,
  lengthUnit,
  groupLabelByOrder,
  projectVsec,
  vsecAzmInputStr,
  onVsecAzmInputChange,
  naturalAzm,
}: {
  stations: NonNullable<CalculationDetail["stations"]>;
  keypoints: KeypointRow[];
  lengthUnit: string;
  /** segmentOrder → group-number string ("0", "1", "2", …). When the order
   *  isn't in the map the row falls back to its raw segmentOrder. */
  groupLabelByOrder: Map<number, string>;
  /** Reproject (ns, ew) onto the user's chosen VSEC reference azimuth.
   *  Lets this table follow the VSEC chart's toolbar live. */
  projectVsec: (ns: number, ew: number) => number;
  /** Drives the VSEC header's ⓘ-button popup. */
  vsecAzmInputStr: string | null;
  onVsecAzmInputChange: (next: string | null) => void;
  naturalAzm: number;
}) {
  type Row = {
    key: string;
    isKeypoint: boolean;
    label: string;
    comment: string;
    md: number; inc: number; azm: number; tvd: number; vsec: number;
    ew: number; ns: number; dls: number; tf: number;
    br: number; tr: number; dmd: number;
  };

  const rows = useMemo<Row[]>(() => {
    // De-duplicate: when a station shares the same MD as a keypoint, drop the
    // station — the keypoint has the correct DLS/DMD/role-label.
    //
    // Background: the dispatcher's builders sample the path up to and including
    // the target MD. The Pascal HC3DTFT explicitly sets `wlpt.DLS:=0` on the
    // final EOC-Target sample (Unit02.pas:1162), which loses the curve's actual
    // DLS at that point. The keypoint correctly carries the curve DLS.
    const EPS = 1e-3;
    const kpMds = keypoints.map((k) => k.md).sort((a, b) => a - b);
    const isDuplicateOfKeypoint = (md: number): boolean => {
      // Binary search would be tidier; linear is fine for typical sizes.
      for (const m of kpMds) {
        if (Math.abs(m - md) < EPS) return true;
        if (m > md + EPS) break;
      }
      return false;
    };

    // Build a "group-position-section" prefix from segmentOrder so the #
    // column reads "1-1-1, 1-1-2, …, 1-2-1, …" — each densified station
    // shows WHICH leg of WHICH profile it belongs to.
    //
    //   G = profile-group ordinal (matches the editable grid's "1-, 2-, 3-")
    //   P = which keypoint slot we're walking TOWARDS (1 = KOP, 2 = EOC, …)
    //   S = station counter WITHIN that leg (1, 2, 3 …)
    //
    // Keypoints themselves keep the 2-level label "G-P" so the table reads
    //   1-1-1, 1-1-2, …, 1-1  (KOP keypoint),
    //   1-2-1, 1-2-2, …, 1-2  (EOC keypoint),
    //   1-3-1, 1-3-2, …, 1-3  (Target keypoint).
    const groupFor = (segOrder: number) =>
      groupLabelByOrder.get(segOrder) ?? String(segOrder);

    // Group keypoints by segmentOrder + sort by MD so each group's
    // keypoints are in walking order. We then assign each densified
    // station to "the next keypoint slot it precedes (or equals)".
    const kpsByGroup = new Map<number, KeypointRow[]>();
    for (const k of keypoints) {
      const arr = kpsByGroup.get(k.segmentOrder) ?? [];
      arr.push(k);
      kpsByGroup.set(k.segmentOrder, arr);
    }
    for (const arr of kpsByGroup.values()) {
      arr.sort((a, b) => a.md - b.md);
    }

    // Counter per (segmentOrder, section) so labels stay sequential within
    // each leg. Walked in MD order below, which matches the dispatcher's
    // emitted station order.
    const sectionCounters = new Map<string, number>();

    const stationRows: Row[] = stations
      .filter((s) => !isDuplicateOfKeypoint(s.md))
      .map((s) => {
        const groupKps = kpsByGroup.get(s.segmentOrder) ?? [];
        // Section = 1-based index of the FIRST keypoint whose md ≥ station.md
        // (i.e. the keypoint this station is walking TOWARDS). If we somehow
        // overshoot all keypoints, cap at the last slot.
        let section = groupKps.length || 1;
        for (let i = 0; i < groupKps.length; i++) {
          if (s.md <= groupKps[i].md + EPS) {
            section = i + 1;
            break;
          }
        }
        const sectionKey = `${s.segmentOrder}:${section}`;
        const counter = (sectionCounters.get(sectionKey) ?? 0) + 1;
        sectionCounters.set(sectionKey, counter);
        const groupPrefix = groupFor(s.segmentOrder);
        // The START row is segmentOrder=0 → groupLabelByOrder gives "0";
        // keep it bare instead of "0-1-1" because there's no profile yet.
        const label = s.segmentOrder === 0
          ? groupPrefix
          : `${groupPrefix}-${section}-${counter}`;
        return {
          key: `s-${s.id}`,
          isKeypoint: false,
          label,
          comment: s.comment ?? "",
          md: s.md, inc: s.inc, azm: s.azm, tvd: s.tvd,
          // Reproject onto the current VSEC reference azimuth so this table
          // follows the chart toolbar live — bypasses the dispatcher's
          // persisted s.vsec which was computed with the natural azm.
          vsec: projectVsec(s.ns, s.ew),
          ew: s.ew, ns: s.ns, dls: s.dls, tf: s.tf,
          br: s.br, tr: s.tr, dmd: s.dmd,
        };
      });
    const keypointRows: Row[] = keypoints.map((k) => ({
      key: `k-${k.id}`,
      isKeypoint: true,
      label: `${groupFor(k.segmentOrder)}-${k.roleIndex + 1}`,
      comment: k.comment ?? "",
      md: k.md, inc: k.inc, azm: k.azm, tvd: k.tvd,
      vsec: projectVsec(k.ns, k.ew),
      ew: k.ew, ns: k.ns, dls: k.dls, tf: k.tf,
      br: k.br, tr: k.tr, dmd: k.dmd,
    }));
    // Merge + sort by MD. (For equal MDs we'd still want keypoints last, but
    // de-dup already removed colliding stations.)
    const merged = [...stationRows, ...keypointRows].sort((a, b) => {
      if (a.md !== b.md) return a.md - b.md;
      return (a.isKeypoint ? 1 : 0) - (b.isKeypoint ? 1 : 0);
    });
    // Pascal Unit02.pas:5427 (the wlpt3 densified path):
    //   wlpt3[jj].dmd := wlpt3[jj].md − wlpt3[jj-1].md
    // i.e. DMD on a densified row is the STEP from the previous row, not the
    // keypoint's stored full-curve length. We compute it here so keypoints
    // (which carry full dmd for the editable grid + BR/TR post-pass) still
    // show as the small step when listed in the densified table.
    for (let i = 0; i < merged.length; i++) {
      merged[i].dmd = i === 0 ? 0 : merged[i].md - merged[i - 1].md;
    }
    return merged;
  }, [stations, keypoints, projectVsec]);

  return (
    <div className="overflow-x-auto bg-white border border-gray-200 rounded max-h-96 overflow-y-auto">
      <table className="min-w-full text-xs">
        <thead className="sticky top-0 bg-gray-50">
          <tr className="border-b border-gray-200">
            {([
              { label: "#" },
              { label: "Comment" },
              { label: `MD (${lengthUnit})` },
              { label: "Inc (°)" },
              { label: "Azm (°)" },
              { label: `TVD (${lengthUnit})` },
              { label: `VSEC (${lengthUnit})`, vsecIcon: true },
              { label: `NS (${lengthUnit})` },
              { label: `EW (${lengthUnit})` },
              { label: "DLS (°/L)", narrow: true },
              { label: "TF (°)",    narrow: true },
              { label: "BR (°/L)",  narrow: true },
              { label: "TR (°/L)",  narrow: true },
              { label: `DMD (${lengthUnit})` },
            ] as Array<{ label: string; narrow?: boolean; vsecIcon?: boolean }>).map((h) => (
              <th
                key={h.label}
                className={`px-${h.narrow ? "1" : "2"} py-1 text-left whitespace-nowrap${
                  h.narrow ? " text-[11px]" : ""
                }`}
              >
                {h.label}
                {h.vsecIcon && (
                  <VsecAzmHeaderButton
                    inputStr={vsecAzmInputStr}
                    naturalAzm={naturalAzm}
                    onChange={onVsecAzmInputChange}
                  />
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.key}
              className={`border-b border-gray-100 last:border-0 ${
                r.isKeypoint ? "bg-yellow-50 font-medium text-gray-900" : ""
              }`}
            >
              <td className={`px-2 py-1 font-mono ${r.isKeypoint ? "text-amber-700" : "text-gray-400"}`}>
                {r.isKeypoint ? "★ " : ""}{r.label}
              </td>
              <td className="px-2 py-1">{r.comment}</td>
              <td className="px-2 py-1">{r.md.toFixed(3)}</td>
              <td className="px-2 py-1">{rad2deg(r.inc).toFixed(2)}</td>
              <td className="px-2 py-1">{normalizeDeg360(rad2deg(r.azm)).toFixed(2)}</td>
              <td className="px-2 py-1">{r.tvd.toFixed(3)}</td>
              <td className="px-2 py-1">{r.vsec.toFixed(3)}</td>
              <td className="px-2 py-1">{r.ns.toFixed(3)}</td>
              <td className="px-2 py-1">{r.ew.toFixed(3)}</td>
              <td className="px-1 py-1 w-16">{(Math.abs(rad2deg(r.dls)) * 100).toFixed(3)}</td>
              <td className="px-1 py-1 w-14">{normalizeDeg360(rad2deg(r.tf)).toFixed(2)}</td>
              <td className="px-1 py-1 w-16">{(rad2deg(r.br) * 100).toFixed(3)}</td>
              <td className="px-1 py-1 w-16">{(rad2deg(r.tr) * 100).toFixed(3)}</td>
              <td className="px-2 py-1">{r.dmd.toFixed(3)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
