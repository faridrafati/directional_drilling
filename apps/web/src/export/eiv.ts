/**
 * Export helpers for the EIV ("Analyzing EMI Logs") view:
 *   - PNG   : the visible heatmaps composited side-by-side (full resolution)
 *   - PDF   : an analysis report — file metadata + per-pad statistics table +
 *             downsampled heatmap thumbnails (pdfmake, landscape A4)
 *   - Excel : a workbook with a Summary sheet and a Pad-statistics sheet
 *
 * The heavy libraries (pdfmake / xlsx) are imported lazily so they only load
 * when the user actually exports, keeping the Log-Analysis page chunk small.
 * Depth orientation matches the on-screen heatmap (deeper depth at the bottom).
 */
import type { TDocumentDefinitions, Content } from "pdfmake/interfaces";
import {
  matAt, pointForValue, colorForPoint,
  type EivModel, type EivImageMode,
} from "@dd/shared/las";

const MODE_LABEL: Record<EivImageMode, string> = {
  raw: "Raw", corrected: "Corrected", leveled: "Leveled",
};
const ALL_MODES: EivImageMode[] = ["raw", "corrected", "leveled"];

/** Base filename (no extension) for downloads. */
function baseName(model: EivModel): string {
  return (model.las.fileName ?? "emi-log").replace(/\.[^.]+$/, "");
}

/** Modes the user currently has ticked (falls back to Leveled if none). */
function visibleModes(show: Record<EivImageMode, boolean>): EivImageMode[] {
  const ms = ALL_MODES.filter((m) => show[m]);
  return ms.length ? ms : ["leveled"];
}

/** Whole-image depth flip flag (deeper-at-bottom), shared with the on-screen view. */
function isFlipped(model: EivModel): boolean {
  return model.depthCount > 1 && model.depths[0] > model.depths[model.depthCount - 1];
}

/** Trigger a browser download of a data URL. */
function downloadUrl(url: string, filename: string): void {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
}

/**
 * Render one mode's heatmap to an offscreen canvas. `rowStride` > 1 downsamples
 * the depth axis (every Nth output row) for compact PDF thumbnails.
 */
function renderModeCanvas(
  model: EivModel, mode: EivImageMode, displayPads: number[], rowStride = 1,
): HTMLCanvasElement {
  const buttons = model.las.buttonsPerPad;
  const w = buttons * displayPads.length;
  const fullH = model.depthCount;
  const h = Math.max(1, Math.ceil(fullH / rowStride));
  const flip = isFlipped(model);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(w, h);
  const nullVal = model.params.nullValue;
  for (let p = 0; p < displayPads.length; p++) {
    const pad = displayPads[p];
    const stats = model.pads[pad];
    if (!stats) continue;
    for (let yy = 0; yy < h; yy++) {
      const row = Math.min(fullH - 1, yy * rowStride);
      const sy = flip ? h - 1 - yy : yy;
      for (let b = 0; b < buttons; b++) {
        const [r, g, bl] = colorForPoint(
          pointForValue(matAt(model, row, b, pad), mode, stats, nullVal),
        );
        const idx = (sy * w + (p * buttons + b)) * 4;
        img.data[idx] = r; img.data[idx + 1] = g; img.data[idx + 2] = bl; img.data[idx + 3] = 255;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/** Depth window [min,max] over valid output rows. */
function depthRange(model: EivModel): { min: number; max: number } {
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < model.depthCount; i++) {
    const d = model.depths[i];
    if (Number.isFinite(d)) { if (d < min) min = d; if (d > max) max = d; }
  }
  if (!Number.isFinite(min)) { min = 0; max = 0; }
  return { min, max };
}

/** Ordered [label, value] metadata pairs shown in both PDF and Excel. */
function metaPairs(model: EivModel): [string, string][] {
  const { min, max } = depthRange(model);
  const p = model.params;
  return [
    ["File", model.las.fileName ?? "—"],
    ["Pads", String(model.las.padCount)],
    ["Buttons / pad", String(model.las.buttonsPerPad)],
    ["Input samples", model.las.data.length.toLocaleString()],
    ["Output rows", model.depthCount.toLocaleString()],
    ["Depth range", `${min.toFixed(2)} – ${max.toFixed(2)}`],
    ["Step", model.las.well.step ? model.las.well.step.toFixed(5) : "—"],
    ["Rows / pixel", String(p.rowsPerPixel)],
    ["Error %", String(p.errorPercent)],
    ["Colour sections", String(p.colorSections)],
    ["Histogram bins", String(p.histogramBins)],
    ["Pad order", p.padOrder.join(", ")],
  ];
}

const fmt = (v: number) => (Number.isFinite(v) ? v.toFixed(2) : "—");

// ── PNG ─────────────────────────────────────────────────────────────────────

/** Composite the visible heatmaps side-by-side into one PNG and download it. */
export function exportEivPng(
  model: EivModel, show: Record<EivImageMode, boolean>, displayPads: number[],
): void {
  const modes = visibleModes(show);
  const buttons = model.las.buttonsPerPad;
  const w = buttons * displayPads.length;
  const h = model.depthCount;
  const gap = 8;
  const out = document.createElement("canvas");
  out.width = modes.length * w + (modes.length - 1) * gap;
  out.height = h;
  const octx = out.getContext("2d");
  if (!octx) return;
  octx.fillStyle = "#fff";
  octx.fillRect(0, 0, out.width, out.height);
  modes.forEach((mode, mi) => {
    octx.drawImage(renderModeCanvas(model, mode, displayPads), mi * (w + gap), 0);
  });
  downloadUrl(out.toDataURL("image/png"), `${baseName(model)}_eiv.png`);
}

// ── PDF ───────────────────────────────────────────────────────────────────--

/** Build a landscape-A4 analysis report and download it. */
export async function exportEivPdf(
  model: EivModel, show: Record<EivImageMode, boolean>, displayPads: number[],
): Promise<void> {
  const [{ default: pdfMake }, fonts] = await Promise.all([
    import("pdfmake/build/pdfmake.js"),
    import("pdfmake/build/vfs_fonts.js"),
  ]);
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const f = fonts as any;
  (pdfMake as any).vfs =
    f.vfs ?? f.default?.vfs ?? f.default?.pdfMake?.vfs ?? f.pdfMake?.vfs;
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const modes = visibleModes(show);
  // Downsample the depth axis so thumbnails stay a sane size in the PDF.
  const stride = Math.max(1, Math.ceil(model.depthCount / 800));
  const thumbs = modes.map((mode) => ({
    width: "auto" as const,
    stack: [
      { text: MODE_LABEL[mode], alignment: "center" as const, fontSize: 9, bold: true, margin: [0, 0, 0, 3] as [number, number, number, number] },
      { image: renderModeCanvas(model, mode, displayPads, stride).toDataURL("image/png"), fit: [170, 470] as [number, number] },
    ],
  }));

  const statHeader = ["Pad", "Min", "Max", "Clip low", "Clip high", "Hist peak", "Levels (resistivity order)"];
  const statRows = displayPads
    .map((pad) => {
      const s = model.pads[pad];
      if (!s) return null;
      return [
        String(pad), fmt(s.min), fmt(s.max), fmt(s.clipLow), fmt(s.clipHigh),
        String(s.histogramPeak), s.levels.map((v) => v.toFixed(0)).join(", "),
      ];
    })
    .filter((r): r is string[] => r != null);

  const doc: TDocumentDefinitions = {
    pageOrientation: "landscape" as const,
    pageSize: "A4" as const,
    pageMargins: [30, 60, 30, 40] as [number, number, number, number],
    header: () => ({
      text: `EMI Log Analysis — ${model.las.fileName ?? "log"}`,
      style: "title", alignment: "center" as const, margin: [0, 18, 0, 0] as [number, number, number, number],
    }),
    footer: (currentPage: number, pageCount: number) => ({
      columns: [
        { text: `Generated ${new Date().toLocaleString()}`, alignment: "left" as const, margin: [30, 8, 0, 0] as [number, number, number, number], fontSize: 8, color: "#94a3b8" },
        { text: `Page ${currentPage} of ${pageCount}`, alignment: "right" as const, margin: [0, 8, 30, 0] as [number, number, number, number], fontSize: 8, color: "#94a3b8" },
      ],
    }),
    content: [
      { text: "File & parameters", style: "subheader", margin: [0, 0, 0, 4] },
      {
        table: {
          widths: ["auto", "*", "auto", "*"],
          body: metaPairsTwoColumn(metaPairs(model)),
        },
        layout: "noBorders" as const,
        fontSize: 9,
        margin: [0, 0, 0, 12] as [number, number, number, number],
      },
      { text: "Heatmaps", style: "subheader", margin: [0, 0, 0, 4] },
      { columns: thumbs, columnGap: 12, margin: [0, 0, 0, 12] as [number, number, number, number] },
      { text: "Per-pad statistics", style: "subheader", margin: [0, 0, 0, 4], pageBreak: "before" as const },
      {
        table: {
          headerRows: 1,
          widths: ["auto", "auto", "auto", "auto", "auto", "auto", "*"],
          body: [statHeader.map((h) => ({ text: h, style: "tableHeader" })), ...statRows],
        },
        layout: {
          fillColor: (rowIndex: number) => (rowIndex === 0 ? "#e0e7ff" : rowIndex % 2 === 0 ? "#f8fafc" : null),
          hLineColor: () => "#e5e7eb",
          vLineColor: () => "#e5e7eb",
        },
        fontSize: 8,
      },
    ],
    styles: {
      title: { fontSize: 14, bold: true, color: "#1e3a8a" },
      subheader: { fontSize: 12, bold: true, color: "#1f2937" },
      tableHeader: { bold: true, color: "#1e3a8a", fontSize: 8 },
    },
    defaultStyle: { font: "Roboto" },
  };

  pdfMake.createPdf(doc).download(`${baseName(model)}_eiv.pdf`);
}

/** Lay key/value metadata pairs two-per-row for a compact PDF block. */
function metaPairsTwoColumn(pairs: [string, string][]): Content[][] {
  const body: Content[][] = [];
  for (let i = 0; i < pairs.length; i += 2) {
    const [k1, v1] = pairs[i];
    const second = pairs[i + 1];
    body.push([
      { text: k1, bold: true, color: "#475569" }, { text: v1 },
      second ? { text: second[0], bold: true, color: "#475569" } : { text: "" },
      second ? { text: second[1] } : { text: "" },
    ]);
  }
  return body;
}

// ── Excel ─────────────────────────────────────────────────────────────────--

/** Workbook: a Summary sheet and a Pad-statistics sheet. */
export async function exportEivXlsx(model: EivModel, displayPads: number[]): Promise<void> {
  const [xlsxMod, fsMod] = await Promise.all([import("xlsx"), import("file-saver")]);
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const XLSX: typeof import("xlsx") = (xlsxMod as any).utils ? xlsxMod : (xlsxMod as any).default;
  const saveAs: (data: Blob, filename: string) => void =
    (fsMod as any).saveAs ?? (fsMod as any).default?.saveAs ?? (fsMod as any).default;
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const wb = XLSX.utils.book_new();

  // Summary sheet — metadata key/value pairs.
  const summaryAoa = [["Property", "Value"], ...metaPairs(model)];
  const summary = XLSX.utils.aoa_to_sheet(summaryAoa);
  summary["!cols"] = [{ wch: 18 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, summary, "Summary");

  // Pad-statistics sheet — one row per displayed pad; levels spread to columns.
  const maxLevels = displayPads.reduce(
    (m, pad) => Math.max(m, model.pads[pad]?.levels.length ?? 0), 0,
  );
  const levelCols = Array.from({ length: maxLevels }, (_, i) => `L${i + 1}`);
  const statHeader = ["Pad", "Min", "Max", "Clip low", "Clip high", "Hist peak", ...levelCols];
  const statRows = displayPads
    .map((pad) => {
      const s = model.pads[pad];
      if (!s) return null;
      return [pad, s.min, s.max, s.clipLow, s.clipHigh, s.histogramPeak, ...s.levels];
    })
    .filter((r): r is number[] => r != null);
  const stats = XLSX.utils.aoa_to_sheet([statHeader, ...statRows]);
  stats["!cols"] = statHeader.map((_h, i) => ({ wch: i === 0 ? 6 : 11 }));
  XLSX.utils.book_append_sheet(wb, stats, "Pad statistics");

  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  saveAs(new Blob([out], { type: "application/octet-stream" }), `${baseName(model)}_eiv.xlsx`);
}
