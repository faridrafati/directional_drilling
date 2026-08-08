/**
 * Reports 13 (Drilling KPIs) and 16 (Phase Summary Pivot) — PDF and XLSX.
 *
 * These are the first reports in the suite with a spreadsheet export, and they
 * have one because their samples ARE spreadsheets: WellView prints them from an
 * Excel pivot, and handing a drilling engineer a picture of a pivot to retype is
 * the wrong answer. The XLSX carries the same rows the page shows, with the
 * filter block above them, so the file explains itself away from the app.
 *
 * NUMBERS GO INTO THE SHEET AS NUMBERS
 * ------------------------------------
 * The PDF formats — thousands separators, two decimals — and the sheet does not:
 * a cell holding the string "10,218,000.00" cannot be summed, sorted or charted,
 * which is the only reason to want a spreadsheet. Formatting is a column format
 * (`z`), applied to the cell, so Excel shows the same thing the page does while
 * the value stays a number. A blank stays genuinely empty, never 0.
 */
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import { pdfMake } from "../pdfmakeSetup.js";
import {
  PAGE_MARGINS, REPORT_STYLES,
  headerValue, money, pageFrame,
  reportFooter, reportTable, sectionBar, titleBand,
  type ReportColumn,
} from "../reportChrome.js";
import type {
  HeaderRow, KpiRow, MultiWellEnvelope, PhasePivotRow,
  Report13Payload, Report16Payload,
} from "../../entry/wellview.js";

const LANDSCAPE_LEGAL: [number, number] = [1008, 612];

/** Excel number formats, matching what the page prints. */
const FMT_MONEY = "#,##0.00";
const FMT_DECIMAL = "#,##0.00";
const FMT_INT = "#,##0";

/** The pivot's filter block, as pdfmake rows. */
function filterBlock(filters: HeaderRow): Content {
  return {
    table: {
      widths: [140, "*"],
      body: filters.map((f) => [
        { text: f.label, style: "cellLabel" },
        { text: headerValue(f.value, f.kind), style: "cellValue" },
      ]),
    },
    layout: {
      hLineWidth: () => 0.5, vLineWidth: () => 0.5,
      hLineColor: () => "#9ca3af", vLineColor: () => "#9ca3af",
      paddingTop: () => 1.5, paddingBottom: () => 1.5,
      paddingLeft: () => 3, paddingRight: () => 3,
    },
    margin: [0, 0, 0, 3],
  };
}

/**
 * The grid with its Grand Total appended as a real table row.
 *
 * Appended to the BODY rather than drawn separately so the total's columns line
 * up with the ones above it by construction — a separately laid-out footer
 * drifts the moment a column width changes.
 */
function gridWithTotal<T>(columns: ReportColumn<T>[], rows: T[], total: T): Content {
  const table = reportTable(columns, [...rows, total]) as {
    table: { body: unknown[][] }; layout: Record<string, unknown>;
  };
  const lastRow = table.table.body.length - 1;
  return {
    ...table,
    layout: {
      ...table.layout,
      fillColor: (rowIndex: number): string | null =>
        (rowIndex === 0 ? "#dedede" : rowIndex === lastRow ? "#eeeeee" : null),
    },
  } as Content;
}

const stamp = (payload: MultiWellEnvelope) =>
  payload.wells.length === 1
    ? payload.wells[0].name.replace(/\W+/g, "_").replace(/^_+|_+$/g, "")
    : `${payload.wells.length}_wells`;

/**
 * Write one sheet: the filter block, a blank spacer, then the grid.
 *
 * `formats` is applied per column so the numbers stay numbers. `null` cells are
 * written as `undefined`, which SheetJS leaves genuinely empty — writing 0
 * would turn "not recorded" into a measurement.
 */
function writeSheet(
  filename: string,
  sheetName: string,
  filters: HeaderRow,
  header: string[],
  rows: (string | number | null)[][],
  formats: (string | null)[],
): void {
  const aoa: (string | number | undefined)[][] = [
    ...filters.map((f) => [f.label, f.value ?? undefined] as (string | number | undefined)[]),
    [],
    header,
    ...rows.map((r) => r.map((v) => (v === null ? undefined : v))),
  ];
  const sheet = XLSX.utils.aoa_to_sheet(aoa);

  // The sheet is: filter block, one blank line, the header, then the rows. So
  // the header is at `filters.length + 1` and the first DATA row is the next
  // one — starting a row later would leave the top well unformatted, which is
  // invisible whenever that well happens to have nothing recorded.
  const firstDataRow = filters.length + 2;
  for (let c = 0; c < formats.length; c += 1) {
    const fmt = formats[c];
    if (!fmt) continue;
    for (let r = firstDataRow; r < firstDataRow + rows.length; r += 1) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      if (cell && cell.t === "n") cell.z = fmt;
    }
  }
  sheet["!cols"] = header.map((h, i) => ({ wch: i === 0 ? 30 : Math.max(12, h.length + 2) }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName.slice(0, 31));
  const out = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  saveAs(new Blob([out], { type: "application/octet-stream" }), filename);
}

/* ══ report 13 ═══════════════════════════════════════════════════════════════ */

const KPI_COLUMNS: ReportColumn<KpiRow>[] = [
  { header: "Well Name", width: "*", cell: (r) => r.wellName },
  { header: "AFE+Supp Amt", width: 78, align: "right", cell: (r) => money(r.afeSuppAmt) },
  { header: "Field Est", width: 78, align: "right", cell: (r) => money(r.fieldEst) },
  { header: "AFE-Field Est", width: 78, align: "right", cell: (r) => money(r.afeLessFieldEst) },
  { header: "Cost/Depth", width: 58, align: "right", cell: (r) => headerValue(r.costPerDepth) },
  { header: "Drilled Total Depth (mKB)", width: 62, align: "right", cell: (r) => headerValue(r.drilledTotalDepth) },
  { header: "Total Time Log Hrs", width: 56, align: "right", cell: (r) => headerValue(r.totalTimeLogHr) },
  { header: "Total Problem Hrs", width: 56, align: "right", cell: (r) => headerValue(r.totalProblemHr) },
  { header: "% Problem Time", width: 52, align: "right", cell: (r) => headerValue(r.pctProblemTime) },
  { header: "Drilling Hrs", width: 52, align: "right", cell: (r) => headerValue(r.drillingHr) },
  { header: "Avg. ROP (m/hr)", width: 56, align: "right", cell: (r) => headerValue(r.avgRopMHr) },
  { header: "Personnel Hrs", width: 56, align: "right", cell: (r) => headerValue(r.personnelHr) },
];

export function buildReport13Doc(payload: Report13Payload): TDocumentDefinitions {
  return {
    pageSize: { width: LANDSCAPE_LEGAL[0], height: LANDSCAPE_LEGAL[1] },
    pageOrientation: "landscape",
    pageMargins: PAGE_MARGINS,
    info: { title: payload.title, subject: `Drilling KPIs across ${payload.wells.length} well(s)` },
    background: () => pageFrame(LANDSCAPE_LEGAL),
    header: () => titleBand(payload.title),
    footer: reportFooter(payload.printedOn),
    content: [
      sectionBar("Filters"),
      filterBlock(payload.filters),
      sectionBar("Data"),
      gridWithTotal(KPI_COLUMNS, payload.rows, payload.grandTotal),
      {
        text: "The Grand Total's ratios are re-derived from the summed numerator and denominator, "
          + "not averaged down the column.",
        style: "cellLabel", italics: true, margin: [0, 3, 0, 0],
      },
    ],
    styles: { ...REPORT_STYLES },
    defaultStyle: { font: "Roboto", fontSize: 6.6 },
  };
}

export async function exportReport13Pdf(payload: Report13Payload): Promise<void> {
  pdfMake.createPdf(buildReport13Doc(payload)).download(`${stamp(payload)}_drilling_kpis.pdf`);
}

export function exportReport13Xlsx(payload: Report13Payload): void {
  const header = [
    "Well Name", "AFE+Supp Amt", "Field Est", "AFE-Field Est", "Cost/Depth",
    "Drilled Total Depth (mKB)", "Total Time Log Hrs", "Total Problem Hrs",
    "% Problem Time", "Drilling Hrs", "Avg. ROP (m/hr)", "Personnel Hrs",
  ];
  const row = (r: KpiRow) => [
    r.wellName, r.afeSuppAmt, r.fieldEst, r.afeLessFieldEst, r.costPerDepth,
    r.drilledTotalDepth, r.totalTimeLogHr, r.totalProblemHr,
    r.pctProblemTime, r.drillingHr, r.avgRopMHr, r.personnelHr,
  ];
  writeSheet(
    `${stamp(payload)}_drilling_kpis.xlsx`,
    "Drilling KPIs",
    payload.filters,
    header,
    [...payload.rows.map(row), row(payload.grandTotal)],
    [null, FMT_MONEY, FMT_MONEY, FMT_MONEY, FMT_DECIMAL, FMT_DECIMAL,
      FMT_DECIMAL, FMT_DECIMAL, FMT_DECIMAL, FMT_DECIMAL, FMT_DECIMAL, FMT_DECIMAL],
  );
}

/* ══ report 16 ═══════════════════════════════════════════════════════════════ */

const PIVOT_COLUMNS: ReportColumn<PhasePivotRow>[] = [
  { header: "Job Category", width: 90, cell: (r) => r.jobCategory },
  { header: "Phase Type 1", width: 110, cell: (r) => r.phaseType1 },
  { header: "Phase Type 2", width: "*", cell: (r) => r.phaseType2 },
  { header: "Count", width: 44, align: "right", cell: (r) => headerValue(r.count, "int") },
  { header: "Avg", width: 56, align: "right", cell: (r) => headerValue(r.avg) },
  { header: "Min", width: 56, align: "right", cell: (r) => headerValue(r.min) },
  { header: "Max", width: 56, align: "right", cell: (r) => headerValue(r.max) },
  { header: "StdDev", width: 56, align: "right", cell: (r) => headerValue(r.stdDev) },
  { header: "Sum", width: 56, align: "right", cell: (r) => headerValue(r.sum) },
];

export function buildReport16Doc(payload: Report16Payload): TDocumentDefinitions {
  return {
    pageSize: { width: LANDSCAPE_LEGAL[0], height: LANDSCAPE_LEGAL[1] },
    pageOrientation: "landscape",
    pageMargins: PAGE_MARGINS,
    info: { title: payload.title, subject: `Phase summary across ${payload.wells.length} well(s)` },
    background: () => pageFrame(LANDSCAPE_LEGAL),
    header: () => titleBand(payload.title),
    footer: reportFooter(payload.printedOn),
    content: [
      sectionBar("Filters"),
      filterBlock(payload.filters),
      sectionBar("Phase duration (days), across the well set"),
      gridWithTotal(PIVOT_COLUMNS, payload.rows, payload.grandTotal),
      {
        text: "StdDev is the population deviation, and blank where a group has one phase. Count is "
          + "how many phases were MEASURED — a phase missing either date is not counted.",
        style: "cellLabel", italics: true, margin: [0, 3, 0, 0],
      },
    ],
    styles: { ...REPORT_STYLES },
    defaultStyle: { font: "Roboto", fontSize: 6.6 },
  };
}

export async function exportReport16Pdf(payload: Report16Payload): Promise<void> {
  pdfMake.createPdf(buildReport16Doc(payload)).download(`${stamp(payload)}_phase_summary_pivot.pdf`);
}

export function exportReport16Xlsx(payload: Report16Payload): void {
  const header = [
    "Job Category", "Phase Type 1", "Phase Type 2",
    "Count", "Avg", "Min", "Max", "StdDev", "Sum",
  ];
  const row = (r: PhasePivotRow) => [
    r.jobCategory, r.phaseType1, r.phaseType2,
    r.count, r.avg, r.min, r.max, r.stdDev, r.sum,
  ];
  writeSheet(
    `${stamp(payload)}_phase_summary_pivot.xlsx`,
    "Phase Summary",
    payload.filters,
    header,
    [...payload.rows.map(row), row(payload.grandTotal)],
    [null, null, null, FMT_INT, FMT_DECIMAL, FMT_DECIMAL, FMT_DECIMAL, FMT_DECIMAL, FMT_DECIMAL],
  );
}
