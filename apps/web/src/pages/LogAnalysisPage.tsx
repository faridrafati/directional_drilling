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
  parseLas, buildModelAsync, defaultParams,
  type EivModel, type EivParams, type EivImageMode,
} from "@dd/shared/las";
import { EivHeatmap, type EivRegion } from "../components/eiv/EivHeatmap.js";
import { LasHeaderModal, DataTablesModal, HistogramModal } from "../components/eiv/EivDialogs.js";

const MODES: { id: EivImageMode; label: string; hint: string }[] = [
  { id: "raw", label: "Raw", hint: "Linear min→max per pad" },
  { id: "corrected", label: "Corrected", hint: "Extremes clipped to the error percentile" },
  { id: "leveled", label: "Leveled", hint: "Histogram-equalised colour bands" },
];

/** Height (px) of the pad-number header above each heatmap. The depth track
 *  reserves a matching spacer so the image rows line up across columns. */
const PAD_AXIS_H = 18;

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
  const [dialog, setDialog] = useState<
    null | "header" | "tables" | "histogram" | "options"
  >(null);
  const [zoomRegion, setZoomRegion] = useState<EivRegion | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // Pads currently displayed (defaults to params.padOrder).
  const displayPads = params?.padOrder ?? [];

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
      setStatus("Parsing LAS…");
      setProgress({ value: 0.05, label: "Parsing LAS…" });
      // Let the "Parsing" frame paint before the synchronous parse blocks.
      await new Promise((r) => setTimeout(r, 0));
      const parsed = parseLas(text, file.name);
      if (parsed.padCount === 0 || parsed.buttonsPerPad === 0) {
        setStatus("No PADn[m] curves found — is this an EMI multi-pad LAS?");
        setLas(parsed); setParams(null); setModel(null);
        setProgress(null);
        setBusy(false);
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
    <div className="p-4 sm:p-6 max-w-[1500px] mx-auto">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
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
              onClick={() => setDialog("header")}
              className="px-3 h-10 text-sm rounded-md bg-gray-100 hover:bg-gray-200"
              title="View the raw LAS header sections"
            >
              LAS header
            </button>
          )}
          {model && (
            <>
              <button
                onClick={() => setDialog("tables")}
                className="px-3 h-10 text-sm rounded-md bg-gray-100 hover:bg-gray-200"
                title="Per-pad min/max/clip/levels table"
              >
                Data tables
              </button>
              <button
                onClick={() => setDialog("histogram")}
                className="px-3 h-10 text-sm rounded-md bg-gray-100 hover:bg-gray-200"
                title="Per-pad histograms"
              >
                Histograms
              </button>
              <button
                onClick={() => exportComposite(model, show, displayPads, zoomX, zoomY)}
                className="px-3 h-10 text-sm rounded-md bg-green-700 text-white hover:bg-green-800"
              >
                Export PNG
              </button>
            </>
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
          </div>
        </Popup>
      )}
      {las && dialog === "header" && (
        <LasHeaderModal las={las} onClose={() => setDialog(null)} />
      )}
      {model && dialog === "tables" && (
        <DataTablesModal model={model} onClose={() => setDialog(null)} />
      )}
      {model && dialog === "histogram" && (
        <HistogramModal model={model} onClose={() => setDialog(null)} />
      )}
      {model && zoomRegion && (
        <ZoomModal
          model={model}
          region={zoomRegion}
          displayPads={displayPads}
          show={show}
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
        <main className="overflow-auto bg-white border border-gray-200 rounded p-3">
          {/* Minimised toolbar just above the graph: zoom + colour scale. */}
          <div className="flex items-center flex-wrap gap-x-5 gap-y-2 mb-3 text-xs text-gray-600">
            <div className="flex items-center gap-1.5">
              <span className="text-gray-500">Zoom X</span>
              <ZoomStepper value={zoomX} onChange={setZoomX} />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-gray-500">Zoom Y</span>
              <ZoomStepper value={zoomY} onChange={setZoomY} />
            </div>
            <ColorScaleBar />
            <span className="text-gray-400">
              Hover for the readout · drag a box to zoom a depth × pad range.
            </span>
          </div>

          <div className="flex gap-4 items-start">
            <DepthTrack model={model} zoomY={zoomY} />
            {MODES.filter((m) => show[m.id]).map((m) => (
              <div key={m.id} className="shrink-0">
                <div className="text-xs font-medium text-gray-700 mb-1 text-center">
                  {m.label}
                </div>
                {/* Pad numbers on top (header above the image). */}
                <PadAxis displayPads={displayPads} buttons={model.las.buttonsPerPad} zoomX={zoomX} />
                <EivHeatmap
                  model={model}
                  mode={m.id}
                  displayPads={displayPads}
                  zoomX={zoomX}
                  zoomY={zoomY}
                  onSelectRegion={setZoomRegion}
                  className="border-x border-b border-gray-300"
                />
              </div>
            ))}
          </div>
        </main>
      )}

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
    <div className="shrink-0 text-right" style={{ width: 72 }}>
      <div className="text-xs font-medium text-gray-700 mb-1">Depth</div>
      {/* Spacer aligns the ruler top with the heatmap image (below pad nums). */}
      <div style={{ height: PAD_AXIS_H }} />
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

/** Minimised colour-scale legend shown inline above the graph. */
function ColorScaleBar() {
  // Mirror the white→yellow→red→black ramp.
  const grad = "linear-gradient(to right, rgb(255,255,255), rgb(255,255,0), rgb(255,0,0), rgb(0,0,0))";
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
      <span>Low</span>
      <div className="h-2.5 w-24 rounded border border-gray-200" style={{ background: grad }} />
      <span>High</span>
      <span
        className="inline-block w-2.5 h-2.5 rounded-sm ml-1.5"
        style={{ background: "rgb(0,0,255)" }}
      />
      <span>NULL</span>
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
  model, region, displayPads, show, onClose,
}: {
  model: EivModel;
  region: EivRegion;
  displayPads: number[];
  show: Record<EivImageMode, boolean>;
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

/**
 * Export the visible heatmaps side-by-side into one PNG (Unit19). Re-renders
 * each enabled mode to an offscreen canvas and composites them with a small
 * gap, then triggers a download.
 */
async function exportComposite(
  model: EivModel,
  show: Record<EivImageMode, boolean>,
  displayPads: number[],
  zoomX: number, zoomY: number,
) {
  const { matAt, pointForValue, colorForPoint } = await import("@dd/shared/las");
  const buttons = model.las.buttonsPerPad;
  const w = buttons * displayPads.length;
  const h = model.depthCount;
  // Same depth orientation as the on-screen heatmap (deeper at the bottom).
  const flip = h > 1 && model.depths[0] > model.depths[h - 1];
  const modes = (["raw", "corrected", "leveled"] as EivImageMode[]).filter((m) => show[m]);
  const gap = 8;
  const out = document.createElement("canvas");
  out.width = modes.length * w + (modes.length - 1) * gap;
  out.height = h;
  const octx = out.getContext("2d");
  if (!octx) return;
  octx.fillStyle = "#fff";
  octx.fillRect(0, 0, out.width, out.height);

  modes.forEach((mode, mi) => {
    const img = octx.createImageData(w, h);
    for (let p = 0; p < displayPads.length; p++) {
      const pad = displayPads[p];
      const stats = model.pads[pad];
      if (!stats) continue;
      for (let row = 0; row < h; row++) {
        for (let b = 0; b < buttons; b++) {
          const point = pointForValue(matAt(model, row, b, pad), mode, stats, model.params.nullValue);
          const [r, g, bl] = colorForPoint(point);
          const x = p * buttons + b;
          const idx = ((flip ? h - 1 - row : row) * w + x) * 4;
          img.data[idx] = r; img.data[idx + 1] = g; img.data[idx + 2] = bl; img.data[idx + 3] = 255;
        }
      }
    }
    // Blit via a temp canvas so we can place at the right offset.
    const tmp = document.createElement("canvas");
    tmp.width = w; tmp.height = h;
    tmp.getContext("2d")!.putImageData(img, 0, 0);
    octx.drawImage(tmp, mi * (w + gap), 0);
  });

  void zoomX; void zoomY; // export at native resolution
  const url = out.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(model.las.fileName ?? "emi-log").replace(/\.[^.]+$/, "")}_eiv.png`;
  a.click();
}
