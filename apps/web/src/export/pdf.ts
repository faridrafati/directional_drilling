/**
 * PDF export for a calculation.
 *
 * Port of old_delphi_code/Unit10.pas RvSystem1Print/RvSystem1PrintHeader/Footer
 * — landscape A4 with field/well metadata in the header, page numbers in the
 * footer, and a multi-page stations table.
 */
import pdfMake from "pdfmake/build/pdfmake.js";
import pdfFonts from "pdfmake/build/vfs_fonts.js";
import type { TDocumentDefinitions, Content } from "pdfmake/interfaces";
import { rad2deg } from "@dd/shared";
import type { CalculationDetail } from "../api/client.js";

// pdfmake VFS bootstrap. In pdfmake 0.2.x, vfs_fonts.js is `module.exports =
// vfs` (the flat font map), so pdfFonts itself IS the vfs; older builds nested
// it under `.vfs` / `.pdfMake.vfs`. Try those, then fall back to the map.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(pdfMake as any).vfs = (pdfFonts as any).vfs ?? (pdfFonts as any).pdfMake?.vfs ?? pdfFonts;

/** Normalize a compass-style degree value into [0, 360°). 360° → 0°. */
function normDeg(deg: number): number {
  if (!Number.isFinite(deg)) return deg;
  const x = deg - 360 * Math.floor(deg / 360);
  return x >= 360 ? 0 : x;
}

export interface PdfMeta {
  projectName: string;
  countryName: string;
  fieldName: string;
  wellName: string;
}

export function exportCalculationPdf(calc: CalculationDetail, meta: PdfMeta): void {
  const rows = calc.stations.map((s) => [
    s.comment ?? "",
    s.md.toFixed(1),
    rad2deg(s.inc).toFixed(2),
    normDeg(rad2deg(s.azm)).toFixed(2),
    s.tvd.toFixed(1),
    s.vsec.toFixed(1),
    s.ns.toFixed(1),
    s.ew.toFixed(1),
    (Math.abs(rad2deg(s.dls)) * 100).toFixed(3),
    normDeg(rad2deg(s.tf)).toFixed(2),
    (rad2deg(s.br) * 100).toFixed(3),
    (rad2deg(s.tr) * 100).toFixed(3),
    s.dmd.toFixed(1),
  ]);

  const headerRow = [
    "Comment", "MD", "Incl", "Azm", "TVD", "VSEC",
    "NS", "EW", "DLS", "TF", "BR", "TR", "DMD",
  ];

  const doc: TDocumentDefinitions = {
    pageOrientation: "landscape",
    pageSize: "A4",
    pageMargins: [30, 70, 30, 50],
    header: (): Content => ({
      stack: [
        {
          columns: [
            { text: meta.fieldName.toUpperCase(), style: "title", alignment: "center" },
          ],
          margin: [0, 15, 0, 0],
        },
        {
          columns: [
            { text: `Country: ${meta.countryName}`, alignment: "left", margin: [30, 0, 0, 0] },
            { text: `Well: ${meta.wellName}`, alignment: "right", margin: [0, 0, 30, 0] },
          ],
          fontSize: 9,
          color: "#475569",
        },
      ],
    }),
    footer: (currentPage, pageCount): Content => ({
      columns: [
        {
          text: `Generated ${new Date().toLocaleString()}`,
          alignment: "left",
          margin: [30, 10, 0, 0],
          fontSize: 8,
          color: "#94a3b8",
        },
        {
          text: `Page ${currentPage} of ${pageCount}`,
          alignment: "right",
          margin: [0, 10, 30, 0],
          fontSize: 8,
          color: "#94a3b8",
        },
      ],
    }),
    content: [
      {
        text: `${calc.name} — ${calc.type}`,
        style: "subheader",
        margin: [0, 0, 0, 6],
      },
      {
        table: {
          headerRows: 1,
          widths: ["*", 40, 40, 40, 50, 50, 50, 50, 50, 40, 50, 50, 40],
          body: [
            headerRow.map((h) => ({ text: h, style: "tableHeader" })),
            ...rows,
          ],
        },
        layout: {
          fillColor: (rowIndex) =>
            rowIndex === 0 ? "#e0e7ff" : rowIndex % 2 === 0 ? "#f8fafc" : null,
          hLineColor: () => "#e5e7eb",
          vLineColor: () => "#e5e7eb",
        },
        fontSize: 8,
      },
    ],
    styles: {
      title: { fontSize: 16, bold: true, color: "#1e3a8a" },
      subheader: { fontSize: 12, bold: true, color: "#1f2937" },
      tableHeader: { bold: true, color: "#1e3a8a", fontSize: 8 },
    },
    defaultStyle: { font: "Roboto" },
  };

  const filename = `${meta.wellName.replace(/\W+/g, "_")}_${calc.name.replace(/\W+/g, "_")}.pdf`;
  pdfMake.createPdf(doc).download(filename);
}
