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

/**
 * Render a complete, labelled figure: the visible heatmaps with a DEPTH axis
 * on the left (deeper at the bottom), pad-number headers on top, per-mode
 * titles, and a COLOUR-SCALE legend at the bottom. `rowStride` downsamples the
 * depth axis for compact output (PDF); pass 1 for a full-resolution PNG.
 */
function renderFigure(
  model: EivModel, modes: EivImageMode[], displayPads: number[], rowStride: number,
): HTMLCanvasElement {
  const buttons = model.las.buttonsPerPad;
  const padW = buttons * displayPads.length;
  const fullH = model.depthCount;
  const imgH = Math.max(1, Math.ceil(fullH / rowStride));
  const flip = isFlipped(model);
  const depthUnit = model.las.curves[0]?.unit?.trim();

  const mLeft = 70, mTop = 38, mBottom = 58, mRight = 14, gap = 16;
  const W = mLeft + modes.length * padW + (modes.length - 1) * gap + mRight;
  const H = mTop + imgH + mBottom;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, W, H);
  ctx.imageSmoothingEnabled = false;

  // Heatmaps + per-mode title + pad-number header.
  modes.forEach((mode, mi) => {
    const x = mLeft + mi * (padW + gap);
    ctx.drawImage(renderModeCanvas(model, mode, displayPads, rowStride), x, mTop);
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, mTop + 0.5, padW, imgH);
    ctx.fillStyle = "#374151";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(MODE_LABEL[mode], x + padW / 2, 10);
    ctx.fillStyle = "#6b7280";
    ctx.font = "10px sans-serif";
    displayPads.forEach((pad, p) => {
      ctx.fillText(String(pad), x + p * buttons + buttons / 2, mTop - 9);
    });
  });

  // Depth axis: header + major ticks/labels (deeper at the bottom).
  ctx.fillStyle = "#374151";
  ctx.font = "bold 12px sans-serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillText(depthUnit ? `Depth (${depthUnit})` : "Depth", mLeft - 6, 10);
  ctx.strokeStyle = "#9ca3af";
  ctx.beginPath();
  ctx.moveTo(mLeft - 0.5, mTop);
  ctx.lineTo(mLeft - 0.5, mTop + imgH);
  ctx.stroke();
  ctx.fillStyle = "#6b7280";
  ctx.font = "10px sans-serif";
  const majorN = Math.max(2, Math.min(250, Math.round(imgH / 80)));
  for (let i = 0; i <= majorN; i++) {
    const sy = Math.round((i / majorN) * (imgH - 1));
    const dataRow = Math.min(fullH - 1, Math.max(0, (flip ? imgH - 1 - sy : sy) * rowStride));
    const depth = model.depths[dataRow];
    const y = mTop + sy;
    ctx.beginPath();
    ctx.moveTo(mLeft - 6, y + 0.5);
    ctx.lineTo(mLeft, y + 0.5);
    ctx.stroke();
    if (Number.isFinite(depth)) ctx.fillText(depth.toFixed(1), mLeft - 9, y);
  }

  // Colour-scale legend: white→yellow→red→black ramp + NULL swatch.
  const legY = mTop + imgH + 20;
  const legW = Math.min(220, Math.max(120, W - mLeft - mRight - 70));
  const legH = 10;
  const grad = ctx.createLinearGradient(mLeft, 0, mLeft + legW, 0);
  grad.addColorStop(0, "rgb(255,255,255)");
  grad.addColorStop(1 / 3, "rgb(255,255,0)");
  grad.addColorStop(2 / 3, "rgb(255,0,0)");
  grad.addColorStop(1, "rgb(0,0,0)");
  ctx.fillStyle = "#6b7280";
  ctx.font = "10px sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("Colour: low → high (per-pad scaled)", mLeft, legY - 7);
  ctx.fillStyle = grad;
  ctx.fillRect(mLeft, legY, legW, legH);
  ctx.strokeStyle = "#cbd5e1";
  ctx.strokeRect(mLeft + 0.5, legY + 0.5, legW, legH);
  ctx.fillStyle = "#6b7280";
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillText("Low", mLeft, legY + legH + 3);
  ctx.textAlign = "right";
  ctx.fillText("High", mLeft + legW, legY + legH + 3);
  const nx = mLeft + legW + 18;
  ctx.fillStyle = "rgb(0,0,255)";
  ctx.fillRect(nx, legY, legH, legH);
  ctx.strokeStyle = "#cbd5e1";
  ctx.strokeRect(nx + 0.5, legY + 0.5, legH, legH);
  ctx.fillStyle = "#6b7280";
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText("NULL", nx + legH + 4, legY + legH / 2);

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

/** Full-resolution labelled figure (heatmaps + depth axis + colour scale) → PNG. */
export function exportEivPng(
  model: EivModel, show: Record<EivImageMode, boolean>, displayPads: number[],
): void {
  const canvas = renderFigure(model, visibleModes(show), displayPads, 1);
  downloadUrl(canvas.toDataURL("image/png"), `${baseName(model)}_eiv.png`);
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
  // pdfmake 0.2.x ships vfs_fonts.js as `module.exports = vfs` (the flat font
  // map directly), so the default export IS the vfs. Older builds nested it
  // under `.vfs` / `.pdfMake.vfs` — try those first, then fall back to the map.
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const f = fonts as any;
  (pdfMake as any).vfs =
    f.vfs ?? f.default?.vfs ?? f.default?.pdfMake?.vfs ?? f.pdfMake?.vfs ?? f.default ?? f;
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const modes = visibleModes(show);
  // One labelled figure (depth axis + colour scale), depth downsampled so it
  // stays a sane size and the axis labels stay legible in the PDF.
  const stride = Math.max(1, Math.ceil(model.depthCount / 900));
  const figure = renderFigure(model, modes, displayPads, stride).toDataURL("image/png");

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
      { image: figure, fit: [770, 450] as [number, number], alignment: "center" as const, margin: [0, 0, 0, 12] as [number, number, number, number] },
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
