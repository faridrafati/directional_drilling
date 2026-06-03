/**
 * EIV — "Analyzing EMI Logs" page. Port of old_eiv_code/Source/Unit3.pas
 * (TForm1) main view, plus the Data Options (Unit2), pad-order (Unit8/21),
 * zoom (Unit13/14/16), point-inspect (Unit18) and export (Unit19) behaviour.
 *
 * Everything runs client-side: the user picks a .las file, we parse + build
 * the mat[row][button][pad] model in the browser, then render the three
 * depth × circumference heatmaps (Raw / Corrected / Leveled) on canvases.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  parseLas, buildModelAsync, defaultParams, mergeLasFiles,
  type EivModel, type EivParams, type EivImageMode, type ColorBand,
} from "@dd/shared/las";
import { EivHeatmap, type EivRegion } from "../components/eiv/EivHeatmap.js";
import { EivTraces, availableTraces } from "../components/eiv/EivTraces.js";
import { EivLinearAverage, hasLinearAverage } from "../components/eiv/EivLinearAverage.js";
import { DetailsModal } from "../components/eiv/EivDialogs.js";
import { exportEivPng, exportEivPdf, exportEivXlsx } from "../export/eiv.js";

const MODES: { id: EivImageMode; label: string; hint: string }[] = [
  { id: "raw", label: "Raw", hint: "Linear min→max per pad" },
  { id: "corrected", label: "Corrected", hint: "Extremes clipped to the error percentile" },
  { id: "leveled", label: "Leveled", hint: "Histogram-equalised colour bands" },
];

/** Left→right heatmap-column order: Detail (leveled), General (corrected), then
 *  Raw. (old_fmi_code Detail View / General View.) */
const COLUMN_ORDER: EivImageMode[] = ["leveled", "corrected", "raw"];

/** Height (px) of the pad-number header above each heatmap. The depth track
 *  reserves a matching spacer so the image rows line up across columns. */
const PAD_AXIS_H = 18;

/** "Special Coloring" defaults: 3 disabled band filters (old_fmi_code Unit3 Form3). */
const DEFAULT_BANDS: ColorBand[] = [
  { enabled: false, min: 0, max: 0, color: [0, 0, 255] },     // Filter 1 (Blue)
  { enabled: false, min: 0, max: 0, color: [0, 170, 0] },     // Filter 2 (Green)
  { enabled: false, min: 0, max: 0, color: [160, 32, 240] },  // Filter 3 (Purple)
];
const BAND_LABELS = ["Filter 1 (Blue)", "Filter 2 (Green)", "Filter 3 (Purple)"];

export function LogAnalysisPage() {
  const [las, setLas] = useState<ReturnType<typeof parseLas> | null>(null);
  const [params, setParams] = useState<EivParams | null>(null);
  const [model, setModel] = useState<EivModel | null>(null);
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);
  // Progress of the read → parse → tensor → levels pipeline (0..1 + a label).
  // Drives the progress bar under the status line. null = idle / no job.
  const [progress, setProgress] = useState<{ value: number; label: string } | null>(null);

  // Which heatmaps are shown — toggled by the left-panel "Graphs" checkboxes
  // (CheckBox1/2/3 in Unit3). Default to the Leveled view only so the page
  // opens with ONE graph; the user ticks Raw / Corrected to compare.
  const [show, setShow] = useState<Record<EivImageMode, boolean>>({
    raw: false, corrected: false, leveled: true,
  });
  const [zoomX, setZoomX] = useState(3);
  const [zoomY, setZoomY] = useState(1);
  // Compass-orient the image by pad-1 azimuth (FMI files only; Unit7.pas:609).
  const [oriented, setOriented] = useState(false);
  // Show the aux side-track line plots (conductivity / accel / GR) — FMI only.
  const [showTraces, setShowTraces] = useState(true);
  // Per-pad Linear Average wiggle track (Guide of Image now lives under the
  // Histograms tab in the Details modal).
  const [showLinearAverage, setShowLinearAverage] = useState(false);
  const [dialog, setDialog] = useState<null | "details" | "options" | "export" | "merge">(null);
  // Special Coloring band filters (Unit3 Form3) — live-applied to the heatmap.
  const [bands, setBands] = useState<ColorBand[]>(DEFAULT_BANDS);
  const [zoomRegion, setZoomRegion] = useState<EivRegion | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // Pads currently displayed (defaults to params.padOrder).
  const displayPads = params?.padOrder ?? [];
  // Pad-1 azimuth per output row (FMI only) — drives compass orientation.
  const azimuthCol = model?.aux?.P1AZ;
  // Whether this file has the FMI aux curves the trace/compass features need.
  const hasAux = !!model && availableTraces(model).length > 0;

  // Status is shown as a transient toast that auto-dismisses (errors linger a
  // little longer). Re-arms on every new message; the progress bar carries the
  // live phase feedback during a long compute.
  useEffect(() => {
    if (!status) return;
    const isError = /^(error|no pad)/i.test(status);
    const t = setTimeout(() => setStatus(""), isError ? 8000 : 4000);
    return () => clearTimeout(t);
  }, [status]);

  async function onFile(file: File) {
    setBusy(true);
    setStatus(`Reading ${file.name} (${(file.size / 1e6).toFixed(1)} MB)…`);
    setProgress({ value: 0, label: "Reading file…" });
    try {
      const text = await file.text();
      await loadLasText(text, file.name);
    } catch (e) {
      setStatus(`Error: ${String(e)}`);
      setProgress(null);
      setBusy(false);
    }
  }

  /**
   * Parse already-read LAS text, build the model and show it. Shared by the
   * file-open path and the merge dialog's "Open in viewer" action. Assumes the
   * caller set busy=true; always clears busy/progress when done.
   */
  async function loadLasText(text: string, name: string) {
    try {
      setStatus("Parsing LAS…");
      setProgress({ value: 0.05, label: "Parsing LAS…" });
      // Let the "Parsing" frame paint before the synchronous parse blocks.
      await new Promise((r) => setTimeout(r, 0));
      const parsed = parseLas(text, name);
      if (parsed.padCount === 0 || parsed.buttonsPerPad === 0) {
        setStatus("No imaging-button curves found (PADn[m] or FMI FC[A-D]r[m]) — is this a multi-pad EMI/FMI LAS?");
        setLas(parsed); setParams(null); setModel(null);
        return;
      }
      const p = defaultParams(parsed);
      setLas(parsed);
      setParams(p);
      setStatus("Computing levels…");
      // buildModelAsync yields between chunks, calling onProgress so the bar
      // advances through the tensor (0–0.55) and per-pad stats (0.55–1) phases.
      const m = await buildModelAsync(parsed, p, (frac, label) =>
        setProgress({ value: frac, label }),
      );
      setModel(m);
      setStatus(
        `${parsed.fileName}: ${parsed.padCount} pads × ${parsed.buttonsPerPad} buttons, ` +
        `${parsed.data.length.toLocaleString()} samples.`,
      );
    } catch (e) {
      setStatus(`Error: ${String(e)}`);
    } finally {
      setProgress(null);
      setBusy(false);
    }
  }

  /** Re-run the pipeline after a parameter change (Unit3 Button1 "draw"). */
  async function recompute(next: EivParams) {
    if (!las) return;
    setParams(next);
    setBusy(true);
    setStatus("Recomputing…");
    setProgress({ value: 0, label: "Recomputing…" });
    try {
      const m = await buildModelAsync(las, next, (frac, label) =>
        setProgress({ value: frac, label }),
      );
      setModel(m);
      setStatus("Done.");
    } catch (e) {
      setStatus(`Error: ${String(e)}`);
    } finally {
      setProgress(null);
      setBusy(false);
    }
  }

  return (
    <div className="h-full flex flex-col p-4 sm:p-6">
     <div className="w-full max-w-[1500px] mx-auto flex flex-col flex-1 min-h-0">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap shrink-0">
        <div>
          <h2 className="text-xl sm:text-2xl font-semibold text-gray-900">
            EMI Log Analysis
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Multi-pad caliper/resistivity casing-inspection logs (LAS 2.0).
            Port of the EIV tool.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <input
            ref={fileInput}
            type="file"
            accept=".las,.txt"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }}
          />
          <button
            onClick={() => fileInput.current?.click()}
            disabled={busy}
            className="px-4 h-10 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300"
          >
            {busy ? "Working…" : "Open .las file"}
          </button>
          <button
            onClick={() => setDialog("merge")}
            disabled={busy}
            className="px-3 h-10 text-sm rounded-md bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400"
            title="Merge a hi-res FMI button file with a lo-res auxiliary file by depth"
          >
            Merge…
          </button>
          {model && params && (
            <button
              onClick={() => setDialog("options")}
              className="px-3 h-10 text-sm rounded-md bg-gray-100 hover:bg-gray-200"
              title="Graphs, data options & pad order"
            >
              Options
            </button>
          )}
          {las && (
            <button
              onClick={() => setDialog("details")}
              className="px-3 h-10 text-sm rounded-md bg-gray-100 hover:bg-gray-200"
              title="LAS header, data tables & histograms"
            >
              Details
            </button>
          )}
          {model && (
            <button
              onClick={() => setDialog("export")}
              className="px-3 h-10 text-sm rounded-md bg-green-700 text-white hover:bg-green-800"
              title="Export as PNG image, PDF report or Excel workbook"
            >
              Export
            </button>
          )}
        </div>
      </div>

      {model && params && dialog === "options" && (
        <Popup title="Options" onClose={() => setDialog(null)}>
          <div className="space-y-4">
            {/* Graphs — which heatmaps to show (toggles live). */}
            <section>
              <h4 className="font-medium text-sm">Graphs</h4>
              <p className="text-[11px] text-gray-400 mb-1">Tick which images to show</p>
              {MODES.map((m) => (
                <label key={m.id} className="flex items-center gap-2 text-sm" title={m.hint}>
                  <input
                    type="checkbox"
                    checked={show[m.id]}
                    onChange={(e) => setShow({ ...show, [m.id]: e.target.checked })}
                  />
                  {m.label}
                </label>
              ))}
              {/* FMI-only display options — shown when the file has aux curves. */}
              {hasAux && (
                <>
                  <label className="flex items-center gap-2 text-sm mt-1" title="Show conductivity / acceleration / gamma-ray side tracks (Unit7)">
                    <input type="checkbox" checked={showTraces} onChange={(e) => setShowTraces(e.target.checked)} />
                    Overlay traces
                  </label>
                  {azimuthCol && (
                    <label className="flex items-center gap-2 text-sm" title="Rotate the image by pad-1 azimuth so it is compass-oriented (Unit7.pas:609)">
                      <input type="checkbox" checked={oriented} onChange={(e) => setOriented(e.target.checked)} />
                      Oriented (compass)
                    </label>
                  )}
                </>
              )}
              {/* Per-pad guide track (any multi-pad file). */}
              <label className="flex items-center gap-2 text-sm mt-1" title="Per-pad averaged resistivity wiggle (Linear Average, Unit7.pas:576)">
                <input type="checkbox" checked={showLinearAverage} onChange={(e) => setShowLinearAverage(e.target.checked)} />
                Linear Average
              </label>
              <button
                onClick={() => {
                  setShow({ raw: false, corrected: true, leveled: true });
                  setShowLinearAverage(true);
                }}
                className="mt-2 text-xs text-blue-600 hover:underline"
                title="Image view: Detail + General + Linear Average"
              >
                Image view
              </button>
            </section>
            <hr className="border-gray-100" />
            {/* Data options — needs a redraw (Apply closes the popup). */}
            <section>
              <h4 className="font-medium text-sm mb-2">Data options</h4>
              <DataOptions
                params={params}
                busy={busy}
                onApply={(p) => { setDialog(null); recompute(p); }}
              />
            </section>
            <hr className="border-gray-100" />
            {/* Pad order — reorders the heatmap columns live. */}
            <section>
              <h4 className="font-medium text-sm">
                Pad order ({params.padOrder.length}/{model.las.padCount})
              </h4>
              <PadSelector
                padCount={model.las.padCount}
                order={params.padOrder}
                onChange={(order) => setParams({ ...params, padOrder: order })}
              />
            </section>
            <hr className="border-gray-100" />
            {/* Special Coloring — highlight resistivity bands (live). */}
            <section>
              <h4 className="font-medium text-sm mb-2">
                Special Coloring{bands.some((b) => b.enabled) ? " (active)" : ""}
              </h4>
              <SpecialColoringDialog bands={bands} onChange={setBands} model={model} />
            </section>
          </div>
        </Popup>
      )}
      {model && params && dialog === "export" && (
        <Popup title="Export" onClose={() => setDialog(null)}>
          <p className="text-[11px] text-gray-400 mb-3">
            Exports the currently shown graphs and pad order.
          </p>
          <div className="space-y-2">
            <ExportChoice
              label="PNG image"
              hint="The visible heatmaps, full resolution"
              onClick={() => { setDialog(null); exportEivPng(model, show, displayPads, showTraces && hasAux); }}
            />
            <ExportChoice
              label="PDF report"
              hint="Metadata + per-pad statistics + heatmap thumbnails"
              onClick={() => { setDialog(null); void exportEivPdf(model, show, displayPads, showTraces && hasAux); }}
            />
            <ExportChoice
              label="Excel workbook"
              hint="Summary + per-pad statistics sheets (.xlsx)"
              onClick={() => { setDialog(null); void exportEivXlsx(model, displayPads); }}
            />
          </div>
        </Popup>
      )}
      {dialog === "merge" && (
        <Popup title="Merge two LAS files" onClose={() => setDialog(null)}>
          <MergeDialog
            busy={busy}
            onOpen={async (text, name) => {
              setDialog(null);
              setBusy(true);
              setStatus("Merging…");
              setProgress({ value: 0.02, label: "Merging…" });
              await new Promise((r) => setTimeout(r, 0));
              await loadLasText(text, name);
            }}
            onError={(msg) => setStatus(`Error: ${msg}`)}
          />
        </Popup>
      )}
      {las && dialog === "details" && (
        <DetailsModal las={las} model={model} onClose={() => setDialog(null)} />
      )}
      {model && zoomRegion && (
        <ZoomModal
          model={model}
          region={zoomRegion}
          displayPads={displayPads}
          show={show}
          bands={bands}
          onClose={() => setZoomRegion(null)}
        />
      )}

      {/* Read / parse / compute progress bar (Unit3 ProgressBar1). */}
      {progress && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span>{progress.label}</span>
            <span className="tabular-nums">{Math.round(progress.value * 100)}%</span>
          </div>
          <div className="h-2 w-full bg-gray-200 rounded overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-[width] duration-150 ease-out"
              style={{ width: `${Math.max(2, Math.round(progress.value * 100))}%` }}
            />
          </div>
        </div>
      )}

      {!las && (
        <div className="bg-white border-2 border-dashed border-gray-200 rounded-lg p-12 text-center">
          <div className="text-4xl mb-2">📊</div>
          <h3 className="text-base font-medium text-gray-900 mb-1">Open an EMI log</h3>
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            Choose a multi-pad <code>.las</code> file (curves named PAD1[0], PAD1[1] …).
            The trace renders entirely in your browser — nothing is uploaded.
          </p>
        </div>
      )}

      {model && params && (
        <main className="flex-1 min-h-0 flex flex-col overflow-hidden bg-white border border-gray-200 rounded p-3">
          {/* Frozen toolbar just above the graph: zoom + colour scale. */}
          <div className="flex items-center flex-wrap gap-x-5 gap-y-2 mb-3 text-xs text-gray-600 shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="text-gray-500">Zoom X</span>
              <ZoomStepper value={zoomX} onChange={setZoomX} />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-gray-500">Zoom Y</span>
              <ZoomStepper value={zoomY} onChange={setZoomY} />
            </div>
            <ColorScaleBar model={model} />
            <span className="text-gray-400">
              Hover for the readout · drag a box to zoom a depth × pad range.
            </span>
          </div>

          {/* Freeze-pane viewport: scrolls internally. The depth column stays
              frozen on the left and the pad-number headers stay frozen on top
              (position: sticky) so they remain visible as you scroll. */}
          <div className="flex-1 min-h-0 overflow-auto">
            <div className="flex gap-4 items-start w-max">
              <DepthTrack model={model} zoomY={zoomY} />
              {/* Heatmap columns in image-view order: Detail (leveled) | General
                  (corrected) | Raw. Only the ticked ones render. */}
              {MODES.slice().sort((a, b) => COLUMN_ORDER.indexOf(a.id) - COLUMN_ORDER.indexOf(b.id))
                .filter((m) => show[m.id]).map((m) => (
                <div key={m.id} className="shrink-0">
                  {/* Frozen header (mode label + pad numbers) stays on top. */}
                  <div className="sticky top-0 z-10 bg-white">
                    <div className="text-xs font-medium text-gray-700 mb-1 text-center">
                      {m.label}{oriented && azimuthCol ? " · compass" : ""}
                    </div>
                    {oriented && azimuthCol
                      ? <CompassAxis width={model.las.buttonsPerPad * displayPads.length * zoomX} />
                      : <PadAxis displayPads={displayPads} buttons={model.las.buttonsPerPad} zoomX={zoomX} />}
                  </div>
                  <EivHeatmap
                    model={model}
                    mode={m.id}
                    displayPads={displayPads}
                    zoomX={zoomX}
                    zoomY={zoomY}
                    azimuth={oriented ? azimuthCol : undefined}
                    bands={bands}
                    onSelectRegion={setZoomRegion}
                    className="border-x border-b border-gray-300"
                  />
                </div>
              ))}
              {/* Linear Average — per-pad averaged wiggle. */}
              {showLinearAverage && hasLinearAverage(model) && (
                <div className="shrink-0">
                  <div className="sticky top-0 z-10 bg-white">
                    <div className="text-xs font-medium text-gray-700 mb-1 text-center">Linear Average</div>
                    <div style={{ height: PAD_AXIS_H }} />
                  </div>
                  <EivLinearAverage model={model} displayPads={displayPads} zoomY={zoomY} />
                </div>
              )}
              {/* Aux overlay traces (FMI files only) — conductivity / accel / GR. */}
              {showTraces && availableTraces(model).length > 0 && (
                <div className="shrink-0">
                  <div className="sticky top-0 z-10 bg-white">
                    <div className="text-xs font-medium text-gray-700 mb-1 text-center">Traces</div>
                  </div>
                  <EivTraces model={model} zoomY={zoomY} />
                </div>
              )}
            </div>
          </div>
        </main>
      )}
     </div>

      {/* Transient status toast — auto-dismisses (see the effect above). */}
      {status && (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm animate-[fadeIn_120ms_ease-out]">
          <div className="flex items-start gap-2 bg-gray-900/90 text-white text-sm rounded-lg px-3 py-2 shadow-lg">
            <span className="flex-1">{status}</span>
            <button
              onClick={() => setStatus("")}
              className="text-gray-400 hover:text-white leading-none"
              title="Dismiss"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Data Options dialog (Unit2/Form6) — shown in a top-bar popup; Apply redraws. */
function DataOptions({
  params, onApply, busy,
}: { params: EivParams; onApply: (p: EivParams) => void; busy: boolean }) {
  const [draft, setDraft] = useState(params);
  // Keep draft in sync when params change externally (e.g. pad order).
  const dirty = JSON.stringify(draft) !== JSON.stringify(params);
  return (
    <div className="text-sm space-y-2">
      <NumField label="Colour sections" value={draft.colorSections}
        onChange={(v) => setDraft({ ...draft, colorSections: v })} min={2} max={50} />
      <NumField label="Error %" value={draft.errorPercent} step={0.1}
        onChange={(v) => setDraft({ ...draft, errorPercent: v })} min={0} max={50} />
      <NumField label="Rows / pixel" value={draft.rowsPerPixel}
        onChange={(v) => setDraft({ ...draft, rowsPerPixel: v })} min={1} max={500} />
      <NumField label="Histogram bins" value={draft.histogramBins}
        onChange={(v) => setDraft({ ...draft, histogramBins: v })} min={2} max={500} />
      <button
        onClick={() => onApply(draft)}
        disabled={busy || (!dirty && JSON.stringify(draft) === JSON.stringify(params))}
        className="w-full px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300"
      >
        Apply &amp; redraw
      </button>
    </div>
  );
}

/**
 * Pad order / selection (Unit8 "Pad sequence" + Unit21). The `order` array IS
 * the left→right display order of the heatmap columns, so reordering it
 * reorders the pads on screen.
 *
 * Interactions:
 *   • Drag a chip in the ordered list to move it (native HTML5 DnD).
 *   • ◀ / ▶ nudge a chip one slot (keyboard/touch fallback).
 *   • × removes a pad from the display; click a hidden pad to append it.
 *   • All / Reverse / Sort shortcuts.
 */
function PadSelector({
  padCount, order, onChange,
}: { padCount: number; order: number[]; onChange: (o: number[]) => void }) {
  const all = Array.from({ length: padCount }, (_, i) => i + 1);
  const hidden = all.filter((p) => !order.includes(p));
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length || from === to) return;
    const next = [...order];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };
  const remove = (pad: number) => onChange(order.filter((p) => p !== pad));

  return (
    <div className="text-sm">
      <p className="text-[11px] text-gray-400 mb-2">Drag to reorder · ◀ ▶ to nudge · × to hide</p>

      {/* Ordered, draggable list — one row per displayed pad. */}
      <ul className="space-y-1">
        {order.map((pad, idx) => (
          <li
            key={pad}
            draggable
            onDragStart={() => setDragIdx(idx)}
            onDragOver={(e) => { e.preventDefault(); setOverIdx(idx); }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragIdx !== null) move(dragIdx, idx);
              setDragIdx(null); setOverIdx(null);
            }}
            onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
            className={`flex items-center gap-1.5 px-1.5 py-1 rounded border cursor-grab active:cursor-grabbing ${
              overIdx === idx && dragIdx !== null && dragIdx !== idx
                ? "border-blue-400 bg-blue-50"
                : "border-gray-200 bg-gray-50"
            }`}
            title={`Position ${idx + 1} → Pad ${pad}`}
          >
            <span className="text-gray-300 select-none">⠿</span>
            <span className="w-5 text-[10px] text-gray-400 tabular-nums">{idx + 1}.</span>
            <span className="flex-1 font-medium text-gray-800">Pad {pad}</span>
            <button onClick={() => move(idx, idx - 1)} disabled={idx === 0}
              className="w-5 h-5 rounded hover:bg-gray-200 disabled:opacity-30" title="Move up">◀</button>
            <button onClick={() => move(idx, idx + 1)} disabled={idx === order.length - 1}
              className="w-5 h-5 rounded hover:bg-gray-200 disabled:opacity-30" title="Move down">▶</button>
            <button onClick={() => remove(pad)}
              className="w-5 h-5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50" title="Hide pad">×</button>
          </li>
        ))}
      </ul>

      {/* Hidden pads — click to append to the display order. */}
      {hidden.length > 0 && (
        <div className="mt-2">
          <div className="text-[11px] text-gray-400 mb-1">Hidden — click to add</div>
          <div className="flex flex-wrap gap-1">
            {hidden.map((pad) => (
              <button
                key={pad}
                onClick={() => onChange([...order, pad])}
                className="w-7 h-7 rounded text-xs border border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100"
                title={`Add Pad ${pad}`}
              >
                {pad}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 mt-2 text-xs">
        <button onClick={() => onChange(all)} className="text-blue-600 hover:underline">All</button>
        <button onClick={() => onChange([...order].reverse())} className="text-blue-600 hover:underline">Reverse</button>
        <button onClick={() => onChange([...order].sort((a, b) => a - b))} className="text-blue-600 hover:underline">Sort</button>
      </div>
    </div>
  );
}

/**
 * Depth ruler with MAJOR (labelled, long tick) and MINOR (short tick,
 * unlabelled) gridlines on the Y axis. Major spacing targets ~70 px and each
 * major interval is split into `MINOR_PER` minor divisions. Orientation
 * matches EivHeatmap (deeper depth at the bottom when data is deepest-first).
 */
const MINOR_PER = 5;
function DepthTrack({ model, zoomY }: { model: EivModel; zoomY: number }) {
  const n = model.depthCount;
  const heightPx = Math.max(1, n * zoomY);
  const flip = n > 1 && model.depths[0] > model.depths[n - 1];
  // Number of major intervals (≈ every 70 px), clamped to a sane range.
  const majorN = Math.max(2, Math.min(20, Math.round(heightPx / 70)));
  const totalMinor = majorN * MINOR_PER;
  const rowAt = (frac: number) => Math.min(n - 1, Math.max(0, Math.round(frac * (n - 1))));
  const topOf = (r: number) => (flip ? n - 1 - r : r) * zoomY;
  const marks = Array.from({ length: totalMinor + 1 }, (_, i) => i);
  return (
    // Frozen on the LEFT (sticky) so the depth axis stays visible while
    // scrolling pads horizontally.
    <div className="shrink-0 sticky left-0 z-20 bg-white text-right" style={{ width: 72 }}>
      {/* Top-left CORNER: frozen on top AND left (above everything). */}
      <div className="sticky top-0 z-30 bg-white">
        <div className="text-xs font-medium text-gray-700 mb-1">Depth</div>
        {/* Spacer aligns the ruler top with the heatmap image (below pad nums). */}
        <div style={{ height: PAD_AXIS_H }} />
      </div>
      <div className="relative border-r border-gray-300" style={{ height: heightPx }}>
        {marks.map((i) => {
          const isMajor = i % MINOR_PER === 0;
          const r = rowAt(i / totalMinor);
          const top = topOf(r);
          return (
            <div key={i} className="absolute right-0" style={{ top }}>
              {/* Horizontal tick at the axis: long+darker for major. */}
              <div
                className={`absolute right-0 -translate-y-1/2 border-t ${
                  isMajor ? "w-2.5 border-gray-400" : "w-1.5 border-gray-300"
                }`}
              />
              {isMajor && (
                <div className="absolute right-3.5 -translate-y-1/2 text-[10px] text-gray-500 whitespace-nowrap">
                  {model.depths[r]?.toFixed(1)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Depth ruler for the zoom modal — like DepthTrack but scoped to the zoomed
 * region [region.y0, region.y1) and aligned to the zoom heatmaps (same `flip`,
 * height = rows × zoomY). A spacer matches the modal's mode-label header so the
 * first tick lines up with the image top.
 */
function ZoomDepthTrack({ model, region, zoomY }: { model: EivModel; region: EivRegion; zoomY: number }) {
  const y0 = Math.max(0, region.y0);
  const y1 = Math.min(model.depthCount, region.y1);
  const rows = Math.max(1, y1 - y0);
  const heightPx = rows * zoomY;
  const flip = model.depthCount > 1 && model.depths[0] > model.depths[model.depthCount - 1];
  const majorN = Math.max(2, Math.min(20, Math.round(heightPx / 70)));
  // Data row for a fraction (0=top) of the region, honouring flip.
  const rowAt = (frac: number) => {
    const within = Math.round(frac * (rows - 1));
    return flip ? y1 - 1 - within : y0 + within;
  };
  const marks = Array.from({ length: majorN + 1 }, (_, i) => i);
  return (
    <div className="shrink-0 text-right" style={{ width: 64 }}>
      {/* Spacer to match the "mode label" row above each zoom heatmap. */}
      <div className="text-xs font-medium text-transparent mb-1">.</div>
      <div className="relative border-r border-gray-300" style={{ height: heightPx }}>
        {marks.map((i) => {
          const frac = i / majorN;
          const r = rowAt(frac);
          return (
            <div key={i} className="absolute right-0" style={{ top: frac * (heightPx - 1) }}>
              <div className="absolute right-0 -translate-y-1/2 w-2.5 border-t border-gray-400" />
              <div className="absolute right-3.5 -translate-y-1/2 text-[10px] text-gray-500 whitespace-nowrap">
                {model.depths[r]?.toFixed(1)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Pad-number header shown ON TOP of a heatmap (one cell per displayed pad). */
function PadAxis({ displayPads, buttons, zoomX }: { displayPads: number[]; buttons: number; zoomX: number }) {
  return (
    <div
      className="flex border border-gray-300 bg-gray-50"
      style={{ width: buttons * displayPads.length * zoomX, height: PAD_AXIS_H }}
    >
      {displayPads.map((pad) => (
        <div
          key={pad}
          className="text-[10px] font-medium text-gray-600 text-center border-r border-gray-200 last:border-r-0"
          style={{ width: buttons * zoomX, lineHeight: `${PAD_AXIS_H}px` }}
        >
          {pad}
        </div>
      ))}
    </div>
  );
}

/**
 * Compass/azimuth header shown ON TOP of a heatmap when it is compass-oriented
 * (the image is rotated by pad-1 azimuth, so the x-axis is now 0–360° around
 * the borehole). Marks N / E / S / W at 0/90/180/270°.
 */
function CompassAxis({ width }: { width: number }) {
  const marks = [
    { f: 0, label: "N" }, { f: 0.25, label: "E" }, { f: 0.5, label: "S" },
    { f: 0.75, label: "W" }, { f: 1, label: "N" },
  ];
  return (
    <div className="relative border border-gray-300 bg-gray-50" style={{ width, height: PAD_AXIS_H }}>
      {marks.map((m, i) => (
        <div
          key={i}
          className="absolute text-[10px] font-medium text-gray-600 -translate-x-1/2"
          style={{ left: m.f * width, lineHeight: `${PAD_AXIS_H}px` }}
        >
          {m.label}
        </div>
      ))}
    </div>
  );
}

/** Minimised colour-scale legend shown inline above the graph, annotated with
 *  the overall data min/max. (Colour scaling is per-pad; this shows the range
 *  spanned across all pads so the ramp has concrete numbers.) */
function ColorScaleBar({ model }: { model: EivModel }) {
  // Mirror the white→yellow→red→black ramp.
  const grad = "linear-gradient(to right, rgb(255,255,255), rgb(255,255,0), rgb(255,0,0), rgb(0,0,0))";
  let lo = Infinity, hi = -Infinity;
  for (let p = 1; p <= model.las.padCount; p++) {
    const s = model.pads[p];
    if (!s || s.count === 0) continue;
    if (s.min < lo) lo = s.min;
    if (s.max > hi) hi = s.max;
  }
  const have = lo <= hi;
  const f = (v: number) => (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(1));
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
      <span className="tabular-nums">{have ? f(lo) : "Low"}</span>
      <div className="h-2.5 w-24 rounded border border-gray-200" style={{ background: grad }} />
      <span className="tabular-nums">{have ? f(hi) : "High"}</span>
      <span
        className="inline-block w-2.5 h-2.5 rounded-sm ml-1.5"
        style={{ background: "rgb(0,0,255)" }}
      />
      <span>NULL</span>
    </div>
  );
}

/**
 * "Special Coloring" controls (old_fmi_code/Unit3 Form3): three band filters,
 * each = enable checkbox + Min/Max value. Any reading inside an enabled band's
 * range is painted that band's colour, overriding the WYRB ramp. Edits apply
 * live (the heatmap re-renders on the `bands` prop).
 *
 * User-friendliness: the data's overall resistivity range is shown, and turning
 * a filter ON for the first time seeds a sensible Min/Max (a third of the range)
 * so it highlights something immediately instead of nothing (0..0).
 */
function SpecialColoringDialog({
  bands, onChange, model,
}: { bands: ColorBand[]; onChange: (b: ColorBand[]) => void; model: EivModel }) {
  // Overall data range across all pads (for hints + seeding defaults).
  let dMin = Infinity, dMax = -Infinity;
  for (let p = 1; p <= model.las.padCount; p++) {
    const s = model.pads[p];
    if (!s || s.count === 0) continue;
    if (s.min < dMin) dMin = s.min;
    if (s.max > dMax) dMax = s.max;
  }
  const haveRange = dMin <= dMax;
  const round = (v: number) => Math.round(v * 10) / 10;

  const update = (i: number, patch: Partial<ColorBand>) =>
    onChange(bands.map((b, j) => (j === i ? { ...b, ...patch } : b)));

  // Toggle a filter; on first enable with an empty (0..0) range, seed a band.
  const toggle = (i: number, enabled: boolean) => {
    const b = bands[i];
    if (enabled && haveRange && b.min === 0 && b.max === 0) {
      // Three equal thirds of the data range, one per filter.
      const lo = dMin + ((dMax - dMin) * i) / 3;
      const hi = dMin + ((dMax - dMin) * (i + 1)) / 3;
      update(i, { enabled, min: round(lo), max: round(hi) });
    } else {
      update(i, { enabled });
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-gray-400">
        Paint readings whose value falls between Min and Max a solid colour, on top of
        the normal image. Turn one on to highlight a resistivity band.
        {haveRange && <> Data range: <span className="tabular-nums">{round(dMin)}–{round(dMax)}</span>.</>}
      </p>
      {bands.map((b, i) => (
        <div key={i} className={`border rounded p-2 ${b.enabled ? "border-gray-300 bg-gray-50" : "border-gray-200"}`}>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={b.enabled} onChange={(e) => toggle(i, e.target.checked)} />
            <span
              className="inline-block w-3 h-3 rounded-sm border border-gray-300"
              style={{ backgroundColor: `rgb(${b.color[0]},${b.color[1]},${b.color[2]})` }}
            />
            {BAND_LABELS[i] ?? `Filter ${i + 1}`}
          </label>
          {b.enabled && (
            <div className="grid grid-cols-2 gap-2 text-xs mt-1.5">
              <NumField label="Min" value={b.min} onChange={(v) => update(i, { min: v })} step={0.1} />
              <NumField label="Max" value={b.max} onChange={(v) => update(i, { max: v })} step={0.1} />
            </div>
          )}
        </div>
      ))}
      {bands.some((b) => b.enabled) && (
        <button
          onClick={() => onChange(DEFAULT_BANDS)}
          className="text-xs text-blue-600 hover:underline"
        >
          Clear all
        </button>
      )}
    </div>
  );
}

function NumField({
  label, value, onChange, min, max, step = 1,
}: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number }) {
  return (
    <label className="flex items-center justify-between gap-2">
      <span className="text-gray-500">{label}</span>
      <input
        type="number"
        value={value}
        min={min} max={max} step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-20 border border-gray-300 rounded px-2 py-1 text-right"
      />
    </label>
  );
}

/**
 * Zoom ladder including fractional zoom-OUT (1/8 … 1/2) and zoom-IN (1 … 30).
 * Needed because a tall depth range (tens of thousands of rows) is unusable at
 * 1× — the user must be able to shrink the Y axis to 1/2, 1/3, etc. to fit.
 */
const ZOOM_LADDER = [
  1 / 8, 1 / 6, 1 / 5, 1 / 4, 1 / 3, 1 / 2,
  1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 30,
];
function fmtZoom(v: number): string {
  return v < 1 ? `1/${Math.round(1 / v)}` : `${v}×`;
}
function ZoomStepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  // Snap the current value to the nearest ladder index.
  let idx = 0, best = Infinity;
  ZOOM_LADDER.forEach((z, i) => { const d = Math.abs(z - value); if (d < best) { best = d; idx = i; } });
  const dec = () => onChange(ZOOM_LADDER[Math.max(0, idx - 1)]);
  const inc = () => onChange(ZOOM_LADDER[Math.min(ZOOM_LADDER.length - 1, idx + 1)]);
  return (
    <div className="flex items-center gap-1">
      <button onClick={dec} disabled={idx === 0}
        className="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-30" title="Zoom out">−</button>
      <span className="w-10 text-center tabular-nums">{fmtZoom(value)}</span>
      <button onClick={inc} disabled={idx === ZOOM_LADDER.length - 1}
        className="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-30" title="Zoom in">+</button>
    </div>
  );
}

/**
 * Lightweight popup shell (title bar + close + scrollable body), used by the
 * top-bar "Data options" and "Pad order" buttons. Click the backdrop to close.
 */
function Popup({
  title, onClose, children,
}: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 pt-20"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-sm max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-2 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          <button
            onClick={onClose}
            className="w-6 h-6 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 leading-none"
            title="Close"
          >
            ×
          </button>
        </div>
        <div className="p-3 overflow-auto">{children}</div>
      </div>
    </div>
  );
}

/**
 * Zoom window (Unit13) — shows the rubber-band-selected depth × pad-button
 * range from the main heatmaps, enlarged. A zoom stepper scales it further;
 * the depth range of the selection is shown in the header.
 */
function ZoomModal({
  model, region, displayPads, show, bands, onClose,
}: {
  model: EivModel;
  region: EivRegion;
  displayPads: number[];
  show: Record<EivImageMode, boolean>;
  bands?: ColorBand[];
  onClose: () => void;
}) {
  const [zx, setZx] = useState(6);
  const [zy, setZy] = useState(3);
  const modes = MODES.filter((m) => show[m.id]);
  const dTop = model.depths[region.y0]?.toFixed(2);
  const dBot = model.depths[Math.min(model.depthCount - 1, region.y1 - 1)]?.toFixed(2);
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-[95vw] max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-2 border-b border-gray-200 flex items-center justify-between gap-4">
          <h3 className="text-sm font-semibold text-gray-900">
            Zoom — depth {dTop} … {dBot}
          </h3>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1">X
              <ZoomStepper value={zx} onChange={setZx} />
            </span>
            <span className="flex items-center gap-1">Y
              <ZoomStepper value={zy} onChange={setZy} />
            </span>
            <button onClick={onClose} className="px-2 py-1 rounded bg-gray-100 hover:bg-gray-200">Close</button>
          </div>
        </div>
        <div className="p-3 overflow-auto">
          <div className="flex gap-4 items-start">
            <ZoomDepthTrack model={model} region={region} zoomY={zy} />
            {modes.map((m) => (
              <div key={m.id} className="shrink-0">
                <div className="text-xs font-medium text-gray-700 mb-1 text-center">{m.label}</div>
                <EivHeatmap
                  model={model}
                  mode={m.id}
                  displayPads={displayPads}
                  region={region}
                  zoomX={zx}
                  zoomY={zy}
                  bands={bands}
                  className="border border-gray-300"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** A single choice row inside the Export popup. */
/**
 * Merge two LAS files (Unit10.pas) — pick a hi-res FMI button file and a lo-res
 * auxiliary file, then either download the merged LAS or open it in the viewer.
 */
function MergeDialog({
  busy, onOpen, onError,
}: {
  busy: boolean;
  onOpen: (mergedText: string, name: string) => void;
  onError: (msg: string) => void;
}) {
  const [hi, setHi] = useState<File | null>(null);
  const [lo, setLo] = useState<File | null>(null);
  const [working, setWorking] = useState(false);

  async function build(): Promise<{ text: string; name: string } | null> {
    if (!hi || !lo) { onError("Pick both a hi-res and a lo-res file."); return null; }
    setWorking(true);
    try {
      const [hiText, loText] = await Promise.all([hi.text(), lo.text()]);
      const text = mergeLasFiles(hiText, loText);
      const name = hi.name.replace(/\.las$/i, "") + "_merged.las";
      return { text, name };
    } catch (e) {
      onError(String(e));
      return null;
    } finally {
      setWorking(false);
    }
  }

  async function download() {
    const r = await build();
    if (!r) return;
    const url = URL.createObjectURL(new Blob([r.text], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url; a.download = r.name; a.click();
    URL.revokeObjectURL(url);
  }

  async function open() {
    const r = await build();
    if (r) onOpen(r.text, r.name);
  }

  const disabled = busy || working || !hi || !lo;
  return (
    <div className="space-y-3">
      <p className="text-[11px] text-gray-400">
        Combines a high-resolution FMI button file (TDEP + FC[A-D]r[m] + fast channels)
        with a low-resolution auxiliary file (GR / P1AZ / DEVI / TENS …) by depth.
      </p>
      <FilePick label="Hi-res FMI file" file={hi} onPick={setHi} />
      <FilePick label="Lo-res auxiliary file" file={lo} onPick={setLo} />
      <div className="flex gap-2 pt-1">
        <button
          onClick={download}
          disabled={disabled}
          className="flex-1 px-3 h-9 text-sm rounded bg-green-700 text-white hover:bg-green-800 disabled:bg-gray-300"
        >
          {working ? "Merging…" : "Download merged .las"}
        </button>
        <button
          onClick={open}
          disabled={disabled}
          className="flex-1 px-3 h-9 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300"
        >
          Open in viewer
        </button>
      </div>
    </div>
  );
}

/** A labelled file picker showing the chosen file name. */
function FilePick({
  label, file, onPick,
}: { label: string; file: File | null; onPick: (f: File) => void }) {
  return (
    <label className="block">
      <span className="text-[11px] text-gray-500 block mb-0.5">{label}</span>
      <input
        type="file"
        accept=".las,.txt"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); }}
        className="block w-full text-xs text-gray-600 file:mr-2 file:px-2 file:py-1 file:rounded file:border-0 file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
      />
      {file && <span className="text-[11px] text-gray-400">{file.name}</span>}
    </label>
  );
}

function ExportChoice({ label, hint, onClick }: { label: string; hint: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-3 py-2 rounded border border-gray-200 hover:border-blue-300 hover:bg-blue-50"
    >
      <div className="text-sm font-medium text-gray-800">{label}</div>
      <div className="text-[11px] text-gray-400">{hint}</div>
    </button>
  );
}
