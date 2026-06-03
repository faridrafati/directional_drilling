/**
 * Secondary EIV dialogs, ported from the Delphi forms:
 *   LAS header tab   ← Unit5  (Form2) — section combo + raw section text
 *   Data tables tab  ← Unit10 (Form9) — per-pad min/max/clip/levels grid
 *   Histograms tab   ← Unit22 (Form22) + Unit3.histogram — per-pad bars
 *
 * They are presented together in a single tabbed `DetailsModal` (one top-bar
 * "Details" button). All read from the already-parsed LasFile / EivModel —
 * no recompute.
 */
import { useState } from "react";
import type { EivModel, LasFile } from "@dd/shared/las";
import { EivGuide } from "./EivGuide.js";

function ModalShell({
  title, onClose, children, wide,
}: { title: React.ReactNode; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className={`bg-white rounded-lg shadow-xl w-full ${wide ? "max-w-4xl" : "max-w-2xl"} max-h-[85vh] flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-2 border-b border-gray-200 flex items-center justify-between gap-4">
          {title}
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none shrink-0" aria-label="Close">×</button>
        </div>
        <div className="p-4 overflow-auto">{children}</div>
      </div>
    </div>
  );
}

const DETAIL_TABS = [
  { id: "header", label: "LAS header", needsModel: false },
  { id: "tables", label: "Data tables", needsModel: true },
  { id: "histogram", label: "Histograms", needsModel: true },
] as const;
type DetailTab = typeof DETAIL_TABS[number]["id"];

/**
 * One modal, three tabs (LAS header / Data tables / Histograms). The data-tab
 * pair only appears once a model exists; with a header-only file (no PAD
 * curves) just the LAS-header tab shows.
 */
export function DetailsModal({
  las, model, onClose, initialTab,
}: { las: LasFile; model: EivModel | null; onClose: () => void; initialTab?: DetailTab }) {
  const tabs = DETAIL_TABS.filter((t) => !t.needsModel || model);
  const [tab, setTab] = useState<DetailTab>(
    initialTab && tabs.some((t) => t.id === initialTab) ? initialTab : tabs[0].id,
  );
  return (
    <ModalShell
      wide
      onClose={onClose}
      title={
        <div className="flex items-center gap-1 flex-wrap">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 text-sm rounded-t border-b-2 -mb-px ${
                tab === t.id
                  ? "border-blue-600 text-blue-700 font-medium"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      }
    >
      {tab === "header" && <LasHeaderBody las={las} />}
      {tab === "tables" && model && <DataTablesBody model={model} />}
      {tab === "histogram" && model && <HistogramBody model={model} />}
    </ModalShell>
  );
}

/** Unit5 — pick a LAS section, see its raw lines. */
function LasHeaderBody({ las }: { las: LasFile }) {
  const [section, setSection] = useState(las.sectionOrder[0] ?? "");
  const lines = las.sections[section] ?? [];
  return (
    <>
      <div className="flex items-center gap-2 mb-3 text-sm">
        <span className="text-gray-500">Section</span>
        <select
          value={section}
          onChange={(e) => setSection(e.target.value)}
          className="border border-gray-300 rounded px-2 py-1 bg-white"
        >
          {las.sectionOrder.map((s) => (
            <option key={s} value={s}>~{s}</option>
          ))}
        </select>
        <span className="text-gray-400 text-xs">{lines.length} lines</span>
      </div>
      <pre className="text-[11px] leading-relaxed bg-gray-50 border border-gray-200 rounded p-3 overflow-auto max-h-[55vh] whitespace-pre font-mono">
        {lines.length ? lines.join("\n") : "(empty)"}
      </pre>
    </>
  );
}

/** Unit10 — per-pad statistics table. */
function DataTablesBody({ model }: { model: EivModel }) {
  const pads = Array.from({ length: model.las.padCount }, (_, i) => i + 1);
  const fmt = (v: number) => (Number.isFinite(v) ? v.toFixed(2) : "—");
  return (
    <>
      <table className="text-xs border-collapse w-full">
        <thead>
          <tr className="bg-gray-50">
            <th className="border border-gray-200 px-2 py-1 text-left">Pad</th>
            <th className="border border-gray-200 px-2 py-1 text-right">Min</th>
            <th className="border border-gray-200 px-2 py-1 text-right">Max</th>
            <th className="border border-gray-200 px-2 py-1 text-right">Clip low</th>
            <th className="border border-gray-200 px-2 py-1 text-right">Clip high</th>
            <th className="border border-gray-200 px-2 py-1 text-right">Hist peak</th>
            <th className="border border-gray-200 px-2 py-1 text-left">Levels (high→low)</th>
          </tr>
        </thead>
        <tbody>
          {pads.map((pad) => {
            const s = model.pads[pad];
            if (!s) return null;
            return (
              <tr key={pad}>
                <td className="border border-gray-200 px-2 py-1 font-medium">{pad}</td>
                <td className="border border-gray-200 px-2 py-1 text-right tabular-nums">{fmt(s.min)}</td>
                <td className="border border-gray-200 px-2 py-1 text-right tabular-nums">{fmt(s.max)}</td>
                <td className="border border-gray-200 px-2 py-1 text-right tabular-nums">{fmt(s.clipLow)}</td>
                <td className="border border-gray-200 px-2 py-1 text-right tabular-nums">{fmt(s.clipHigh)}</td>
                <td className="border border-gray-200 px-2 py-1 text-right tabular-nums">{s.histogramPeak}</td>
                <td className="border border-gray-200 px-2 py-1 tabular-nums text-gray-600">
                  {s.levels.map((v) => v.toFixed(0)).join(", ")}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-[11px] text-gray-400 mt-2">
        {model.depthCount.toLocaleString()} depth rows ·
        {" "}{model.las.buttonsPerPad} buttons/pad ·
        rows/pixel {model.params.rowsPerPixel} · error {model.params.errorPercent}%
      </p>
    </>
  );
}

/** Unit22 — per-pad histogram bars (uses the counts computed in maxmin). */
function HistogramBody({ model }: { model: EivModel }) {
  const pads = Array.from({ length: model.las.padCount }, (_, i) => i + 1);
  const [pad, setPad] = useState(pads[0] ?? 1);
  const s = model.pads[pad];
  const peak = s?.histogramPeak || 1;
  return (
    <>
      <div className="flex items-center gap-2 mb-3 text-sm">
        <span className="text-gray-500">Pad</span>
        <select value={pad} onChange={(e) => setPad(Number(e.target.value))} className="border border-gray-300 rounded px-2 py-1 bg-white">
          {pads.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <span className="text-gray-400 text-xs">
          min {s?.min.toFixed(1)} · max {s?.max.toFixed(1)} · {s?.histogram.length} bins
        </span>
      </div>
      {/* Bars: bin 0 = near max (top of the value range, left here). */}
      <div className="flex items-end gap-[1px] h-48 border-b border-l border-gray-300 p-1 overflow-x-auto">
        {(s?.histogram ?? []).map((count, i) => (
          <div
            key={i}
            className="bg-blue-500/80 shrink-0"
            style={{ width: 4, height: `${(count / peak) * 100}%` }}
            title={`bin ${i}: ${count}`}
          />
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-gray-500 mt-0.5">
        <span>max ({s?.max.toFixed(0)})</span>
        <span>min ({s?.min.toFixed(0)})</span>
      </div>

      {/* Guide of Image — per-pad colour scale + stats, beside the histogram
          (old_fmi_code/Unit7.pas:427). Compact (zoomY scales the ramp height). */}
      <div className="mt-4 border-t border-gray-100 pt-3">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Guide of Image</h4>
        <div className="overflow-x-auto">
          <EivGuide model={model} displayPads={pads} zoomY={120 / Math.max(1, model.depthCount)} />
        </div>
      </div>
    </>
  );
}
