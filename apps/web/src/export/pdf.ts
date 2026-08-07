/**
 * PDF export for a calculation.
 *
 * Port of old_delphi_code/Unit10.pas RvSystem1Print/RvSystem1PrintHeader/Footer
 * — landscape A4 with field/well metadata in the header, page numbers in the
 * footer, and a multi-page stations table.
 *
 * The table itself comes from `stationTable.ts`, shared with the Directional
 * Plot report (`directionalPlot.ts`) so both exports print the same columns,
 * units and rounding. pdfmake + its VFS bootstrap come from `pdfmakeSetup.ts`.
 */
import type { TDocumentDefinitions, Content } from "pdfmake/interfaces";
import { pdfMake } from "./pdfmakeSetup.js";
import { stationTableContent, STATION_TABLE_STYLES } from "./stationTable.js";
import type { CalculationDetail } from "../api/client.js";

export interface PdfMeta {
  projectName: string;
  countryName: string;
  fieldName: string;
  wellName: string;
  /** Project length unit for the column headers ("ft", "m", …). Optional:
   *  omit it and the headers print without unit suffixes. */
  lengthUnit?: string;
  /** Project's declared DLS unit ("deg/100ft" | "deg/30m") — never derived. */
  dlsUnit?: string;
}

export function exportCalculationPdf(calc: CalculationDetail, meta: PdfMeta): void {
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
      stationTableContent(calc.stations, meta.lengthUnit, meta.dlsUnit),
    ],
    styles: {
      ...STATION_TABLE_STYLES,
      title: { fontSize: 16, bold: true, color: "#1e3a8a" },
      subheader: { fontSize: 12, bold: true, color: "#1f2937" },
    },
    defaultStyle: { font: "Roboto" },
  };

  const filename = `${meta.wellName.replace(/\W+/g, "_")}_${calc.name.replace(/\W+/g, "_")}.pdf`;
  pdfMake.createPdf(doc).download(filename);
}
