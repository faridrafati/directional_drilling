/**
 * Reports 15 (Problem Cost by Accountable Party) and 17 (Safety Incidents), as
 * generated PDFs.
 *
 * Both are landscape letter — 17's nine columns and 15's pivot need the width,
 * and both samples are landscape (portrait boxes with /Rotate 90).
 *
 * Both open with the same well list, because a multi-well report has to say
 * which wells it covers: a reader otherwise cannot tell whether a well is absent
 * because it had no incidents or because it was never selected. Wells the
 * account may not see are stated, not silently dropped.
 */
import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import { pdfMake } from "../pdfmakeSetup.js";
import {
  PAGE_MARGINS, REPORT_STYLES,
  headerValue, labelValueGrid, money, pageFrame,
  reportFooter, reportTable, sectionBar, titleBand,
  type ReportColumn,
} from "../reportChrome.js";
import { captureChart, legendRow } from "./chartCapture.js";
import type {
  MultiWellEnvelope, ProblemCostCell, Report15Payload, Report17Payload,
  SafetyIncidentReportRow, WellRef,
} from "../../entry/wellview.js";
import { PROBLEM_COST_CHART_ID } from "../../components/wellview/MultiWellPreview.js";

const LANDSCAPE_LETTER: [number, number] = [792, 612];

const WELL_COLUMNS: ReportColumn<WellRef>[] = [
  { header: "Well Name", width: "*", cell: (w) => w.name },
  { header: "API Number", width: 96, cell: (w) => w.apiUwi ?? "" },
  { header: "Field Name", width: 66, cell: (w) => w.field ?? "" },
  { header: "County", width: 56, cell: (w) => w.county ?? "" },
  { header: "State", width: 56, cell: (w) => w.stateProvince ?? "" },
  { header: "License No.", width: 62, cell: (w) => w.licenseNo ?? "" },
  { header: "Ground Elevation (m)", width: 62, align: "right", cell: (w) => headerValue(w.groundElevation) },
  { header: "KB Elevation (m)", width: 62, align: "right", cell: (w) => headerValue(w.kbElevation) },
];

/** The well set, and anything the account could not be shown. */
function wellSetBlock(payload: MultiWellEnvelope): Content[] {
  const content: Content[] = [
    sectionBar("Wells"),
    reportTable(WELL_COLUMNS, payload.wells),
  ];
  if (payload.droppedWells > 0) {
    content.push({
      text: `${payload.droppedWells} requested well${payload.droppedWells === 1 ? " is" : "s are"} `
        + "not shown — this account is not assigned to them, so their rows are not in the figures below.",
      style: "cellValue", italics: true, margin: [0, 2, 0, 3],
    });
  }
  return content;
}

/* ══ report 15 ═══════════════════════════════════════════════════════════════ */

const CELL_COLUMNS: ReportColumn<ProblemCostCell>[] = [
  { header: "Accountable Party", width: 110, cell: (c) => c.party },
  { header: "Problem - Sub Type", width: "*", cell: (c) => c.kind },
  { header: "Problems", width: 48, align: "right", cell: (c) => headerValue(c.count, "int") },
  { header: "Est Cost (Cost)", width: 80, align: "right", cell: (c) => money(c.cost) },
  { header: "Est Lost Time (hr)", width: 70, align: "right", cell: (c) => headerValue(c.lostTimeHr) },
];

export async function buildReport15Doc(payload: Report15Payload): Promise<TDocumentDefinitions> {
  const content: Content[] = [...wellSetBlock(payload)];

  // The chart exists only when there was something to plot; the preview shows a
  // sentence instead, and so does this — rather than throwing over a panel that
  // was never meant to be drawn.
  if (payload.parties.length > 0) {
    const chart = await captureChart(PROBLEM_COST_CHART_ID, "problem-cost chart");
    content.push(
      sectionBar("Problem Cost by Accountable Party"),
      { image: chart.raster.dataUrl, fit: [740, 300], alignment: "center", margin: [0, 3, 0, 0] },
    );
    const key = legendRow(chart.legend);
    if (key) content.push(key);
  } else {
    content.push(
      sectionBar("Problem Cost by Accountable Party"),
      {
        text: "No interval problem recorded on these wells in this range.",
        style: "cellLabel", italics: true, margin: [0, 3, 0, 3],
      },
    );
  }

  content.push(
    sectionBar("Problems, by party and kind"),
    reportTable(CELL_COLUMNS, payload.cells),
    labelValueGrid([payload.totals]),
  );

  return {
    pageSize: { width: LANDSCAPE_LETTER[0], height: LANDSCAPE_LETTER[1] },
    pageOrientation: "landscape",
    pageMargins: PAGE_MARGINS,
    info: { title: payload.title, subject: `Problem cost across ${payload.wells.length} well(s)` },
    background: () => pageFrame(LANDSCAPE_LETTER),
    header: () => titleBand(payload.title),
    footer: reportFooter(payload.printedOn),
    content,
    styles: { ...REPORT_STYLES },
    defaultStyle: { font: "Roboto", fontSize: 6.6 },
  };
}

/* ══ report 17 ═══════════════════════════════════════════════════════════════ */

const yesNo = (v: boolean | null) => (v === null ? "" : v ? "Yes" : "No");

const INCIDENT_COLUMNS: ReportColumn<SafetyIncidentReportRow>[] = [
  { header: "Type", width: 62, cell: (i) => i.type ?? "" },
  { header: "SubTyp", width: 52, cell: (i) => i.subType ?? "" },
  { header: "Date", width: 52, cell: (i) => i.date },
  { header: "Severity", width: 44, cell: (i) => i.severity ?? "" },
  { header: "Cause", width: 82, cell: (i) => i.cause ?? "" },
  { header: "Lost time?", width: 40, cell: (i) => yesNo(i.lostTime) },
  { header: "Com", width: "*", cell: (i) => i.com ?? "" },
  { header: "Job Typ", width: 72, cell: (i) => i.jobType ?? "" },
  { header: "Well Name", width: 96, cell: (i) => i.wellName },
];

export function buildReport17Doc(payload: Report17Payload): TDocumentDefinitions {
  return {
    pageSize: { width: LANDSCAPE_LETTER[0], height: LANDSCAPE_LETTER[1] },
    pageOrientation: "landscape",
    pageMargins: PAGE_MARGINS,
    info: { title: payload.title, subject: `Safety incidents across ${payload.wells.length} well(s)` },
    background: () => pageFrame(LANDSCAPE_LETTER),
    header: () => titleBand(payload.title),
    footer: reportFooter(payload.printedOn),
    content: [
      ...wellSetBlock(payload),
      sectionBar("Safety Incidents"),
      reportTable(INCIDENT_COLUMNS, payload.incidents),
      labelValueGrid([payload.totals]),
    ],
    styles: { ...REPORT_STYLES },
    defaultStyle: { font: "Roboto", fontSize: 6.6 },
  };
}

const stamp = (payload: MultiWellEnvelope) =>
  payload.wells.length === 1
    ? payload.wells[0].name.replace(/\W+/g, "_").replace(/^_+|_+$/g, "")
    : `${payload.wells.length}_wells`;

export async function exportReport15Pdf(payload: Report15Payload): Promise<void> {
  pdfMake.createPdf(await buildReport15Doc(payload))
    .download(`${stamp(payload)}_problem_cost_by_party.pdf`);
}

export async function exportReport17Pdf(payload: Report17Payload): Promise<void> {
  pdfMake.createPdf(buildReport17Doc(payload))
    .download(`${stamp(payload)}_safety_incidents.pdf`);
}
