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
const PlanViewChart = lazy(() =>
  import("../components/WellCharts.js").then((m) => ({ default: m.PlanViewChart }))
);

type Tab = "grid" | "3d" | "charts" | "export";

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
  // { kind: "create" } = "+ Add row" was clicked — pick a profile first, THEN add.
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

  // Azimuth solution preference for ambiguous starred profiles. Persisted to
  // localStorage per-calc so it survives reloads.
  const azmStorageKey = id ? `azm-choice:${id}` : "";
  const [azimuthChoice, setAzimuthChoice] = useState<1 | 2>(() => {
    if (!azmStorageKey) return 1;
    const v = localStorage.getItem(azmStorageKey);
    return v === "2" ? 2 : 1;
  });
  useEffect(() => {
    if (azmStorageKey) localStorage.setItem(azmStorageKey, String(azimuthChoice));
  }, [azmStorageKey, azimuthChoice]);

  const calculateMut = useMutation({
    mutationFn: async () => {
      await api.post(`/calculations/${id}/segments`, { segments });
      return api.post<CalculateResult>(`/calculations/${id}/calculate`, { azimuthChoice });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["calculation", id] }),
  });

  const stations = data?.stations ?? [];
  const lastResult = calculateMut.data;

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
  // "+ Add row" no longer creates a row directly — it opens the profile picker
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
                + Add row
              </button>
              <select
                value={azimuthChoice}
                onChange={(e) => setAzimuthChoice(e.target.value === "2" ? 2 : 1)}
                title="When a starred profile has two azimuth solutions, prefer this branch."
                className="h-10 sm:h-9 px-2 text-xs rounded-md border border-gray-300 bg-white"
              >
                <option value="1">Azm: Branch 1</option>
                <option value="2">Azm: Branch 2</option>
              </select>
            </>
          )}
          <button
            onClick={() => calculateMut.mutate()}
            disabled={calculateMut.isPending}
            className="px-4 h-10 sm:h-9 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 disabled:bg-gray-300 font-medium min-w-[110px]"
          >
            {calculateMut.isPending ? "Calculating…" : "Calculate"}
          </button>
        </div>
      </div>

      <Tabs current={tab} onChange={setTab} />

      {lastResult && tab === "grid" && (
        <div
          className={`mb-4 p-3 rounded text-sm ${
            lastResult.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
          }`}
        >
          {lastResult.ok
            ? `Calculated ${lastResult.stationCount} stations.`
            : `Calculated ${lastResult.stationCount} stations with errors:`}
          {lastResult.errors.length > 0 && (
            <ul className="mt-1 ml-4 list-disc">
              {lastResult.errors.map((e, i) => (
                <li key={i}>Segment {e.segmentIndex}: {e.message}</li>
              ))}
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
              />
            </div>
          )}
        </>
      )}

      <Suspense fallback={<div className="p-4 text-sm text-gray-500">Loading viewer…</div>}>
        {tab === "3d" && (
          <WellViewer3D
            stations={stations}
            keypoints={data?.keypoints ?? []}
            lengthUnit={lengthUnit}
          />
        )}
        {tab === "charts" && (
          <ChartsView stations={stations} lengthUnit={lengthUnit} />
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
  stations, lengthUnit,
}: {
  stations: NonNullable<CalculationDetail["stations"]>;
  lengthUnit: string;
}) {
  const [hovered, setHovered] = useState<StationDetails | null>(null);

  return (
    <div className="flex flex-col xl:flex-row gap-3">
      <div className="flex-1 grid grid-cols-1 xl:grid-cols-2 gap-4 min-w-0">
        <VerticalSectionChart
          stations={stations}
          lengthUnit={lengthUnit}
          onHover={setHovered}
          showDetailsPanel={false}
        />
        <PlanViewChart
          stations={stations}
          lengthUnit={lengthUnit}
          onHover={setHovered}
          showDetailsPanel={false}
        />
      </div>
      <StationDetailsPanel point={hovered} lengthUnit={lengthUnit} widthClass="w-72 xl:w-64" />
    </div>
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
}

function SegmentGrid({ segments, keypoints, stations, onCell, onRemove, onPickProfile, lengthUnit }: SegmentGridProps) {
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
                    const raw =
                      !editable && typeof rawFromStation === "number"
                        ? rawFromStation
                        : rawFromSegment;
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

                    const format = (n: number) => {
                      if (isDlsCell) return (Math.abs(rad2deg(n)) * 100).toFixed(3);
                      if (isAngleDeg) return rad2deg(n).toFixed(2);
                      if (isDlsDeg) return (rad2deg(n) * 100).toFixed(3);
                      return n.toFixed(3);
                    };
                    const parse = (str: string) => {
                      const cleaned = str.trim();
                      if (cleaned === "" || cleaned === "-" || cleaned === ".") return null;
                      const n = Number(cleaned);
                      if (!isFinite(n)) return null;
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
}: {
  stations: NonNullable<CalculationDetail["stations"]>;
  keypoints: KeypointRow[];
  lengthUnit: string;
  /** segmentOrder → group-number string ("0", "1", "2", …). When the order
   *  isn't in the map the row falls back to its raw segmentOrder. */
  groupLabelByOrder: Map<number, string>;
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

    // Build a "group-N" prefix from segmentOrder so the # column reads
    // "1-1, 1-2, 2-1, …" exactly like the editable grid above. The raw
    // segmentOrder is the LAST row of each profile group, so we resolve it
    // through `groupLabelByOrder` (built from segments[]). Stations get
    // bare "G" (no role position — they're between roles); keypoints get
    // "G-roleIndex+1" so KOP/EOC/Target keep their position-in-group.
    const groupFor = (segOrder: number) =>
      groupLabelByOrder.get(segOrder) ?? String(segOrder);

    const stationRows: Row[] = stations
      .filter((s) => !isDuplicateOfKeypoint(s.md))
      .map((s) => ({
        key: `s-${s.id}`,
        isKeypoint: false,
        label: groupFor(s.segmentOrder),
        comment: s.comment ?? "",
        md: s.md, inc: s.inc, azm: s.azm, tvd: s.tvd, vsec: s.vsec,
        ew: s.ew, ns: s.ns, dls: s.dls, tf: s.tf,
        br: s.br, tr: s.tr, dmd: s.dmd,
      }));
    const keypointRows: Row[] = keypoints.map((k) => ({
      key: `k-${k.id}`,
      isKeypoint: true,
      label: `${groupFor(k.segmentOrder)}-${k.roleIndex + 1}`,
      comment: k.comment ?? "",
      md: k.md, inc: k.inc, azm: k.azm, tvd: k.tvd, vsec: k.vsec,
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
  }, [stations, keypoints]);

  return (
    <div className="overflow-x-auto bg-white border border-gray-200 rounded max-h-96 overflow-y-auto">
      <table className="min-w-full text-xs">
        <thead className="sticky top-0 bg-gray-50">
          <tr className="border-b border-gray-200">
            {[
              { label: "#" },
              { label: "Comment" },
              { label: `MD (${lengthUnit})` },
              { label: "Inc (°)" },
              { label: "Azm (°)" },
              { label: `TVD (${lengthUnit})` },
              { label: `VSEC (${lengthUnit})` },
              { label: `NS (${lengthUnit})` },
              { label: `EW (${lengthUnit})` },
              { label: "DLS (°/L)", narrow: true },
              { label: "TF (°)",    narrow: true },
              { label: "BR (°/L)",  narrow: true },
              { label: "TR (°/L)",  narrow: true },
              { label: `DMD (${lengthUnit})` },
            ].map((h) => (
              <th
                key={h.label}
                className={`px-${h.narrow ? "1" : "2"} py-1 text-left whitespace-nowrap${
                  h.narrow ? " text-[11px]" : ""
                }`}
              >
                {h.label}
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
              <td className="px-2 py-1">{rad2deg(r.azm).toFixed(2)}</td>
              <td className="px-2 py-1">{r.tvd.toFixed(3)}</td>
              <td className="px-2 py-1">{r.vsec.toFixed(3)}</td>
              <td className="px-2 py-1">{r.ns.toFixed(3)}</td>
              <td className="px-2 py-1">{r.ew.toFixed(3)}</td>
              <td className="px-1 py-1 w-16">{(Math.abs(rad2deg(r.dls)) * 100).toFixed(3)}</td>
              <td className="px-1 py-1 w-14">{rad2deg(r.tf).toFixed(2)}</td>
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
