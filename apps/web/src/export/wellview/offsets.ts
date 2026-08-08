/**
 * Reports 12 (Daily Drilling Summary 2) and 14 (Drilling Offsets), as PDFs.
 *
 * 12 is portrait letter, like its sample: its blocks are read top to bottom, one
 * well after another, and a landscape page would put two half-empty columns
 * beside each other. Each block starts a fresh page after the first, which is
 * how the sample stacks them and what makes a fleet summary usable — you hand a
 * page to the person who owns that well.
 *
 * 14 is landscape letter and five pages, one plot each, matching its sample's
 * page count. Every plot is rasterized from the LIVE Recharts surface — see
 * `chartCapture.ts` for the capture-or-throw rule the charted reports share.
 * A plot with nothing to draw prints its reason instead, and is not captured:
 * throwing over a panel that was never meant to exist would block the export
 * over a well that simply has no mud checks.
 */
import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import { pdfMake } from "../pdfmakeSetup.js";
import {
  PAGE_MARGINS, REPORT_STYLES,
  headerValue, labelValueGrid, pageFrame,
  reportFooter, reportTable, sectionBar, titleBand,
  type ReportColumn,
} from "../reportChrome.js";
import { captureChart, legendRow, type CapturedChart } from "./chartCapture.js";
import type {
  MultiTimeLogRow, MultiWellEnvelope, OffsetPlot,
  Report12Payload, Report14Payload,
} from "../../entry/wellview.js";
import { offsetPlotId } from "../../components/wellview/OffsetPreview.js";

const LETTER: [number, number] = [612, 792];
const LANDSCAPE_LETTER: [number, number] = [792, 612];

const stamp = (payload: MultiWellEnvelope) =>
  payload.wells.length === 1
    ? payload.wells[0].name.replace(/\W+/g, "_").replace(/^_+|_+$/g, "")
    : `${payload.wells.length}_wells`;

/* ══ report 12 ═══════════════════════════════════════════════════════════════ */

const TIME_LOG_COLUMNS: ReportColumn<MultiTimeLogRow>[] = [
  { header: "Start Date", width: 78, cell: (t) => t.startDate },
  { header: "Dur (hr)", width: 38, align: "right", cell: (t) => headerValue(t.durHr) },
  { header: "Cum Dur (hr)", width: 44, align: "right", cell: (t) => headerValue(t.cumDurHr) },
  { header: "End Date", width: 78, cell: (t) => t.endDate },
  { header: "Code 1", width: 34, cell: (t) => t.code1 ?? "" },
  { header: "Code 2", width: 48, cell: (t) => t.code2 ?? "" },
  { header: "Com", width: "*", cell: (t) => t.com ?? "" },
];

export function buildReport12Doc(payload: Report12Payload): TDocumentDefinitions {
  const content: Content[] = [];

  content.push({
    text: payload.asOf
      ? `Each well's newest day on or before ${payload.asOf}.`
      : "Each well's newest day. The blocks are not on the same date.",
    style: "cellLabel", italics: true, margin: [0, 0, 0, 4],
  });

  payload.blocks.forEach((block, i) => {
    // One well per page after the first: a fleet summary is handed out a page
    // at a time, to the person who owns that well.
    const head: Content = i === 0
      ? sectionBar(block.rigName ?? "Rig")
      : { ...(sectionBar(block.rigName ?? "Rig") as object), pageBreak: "before" } as Content;

    // One identity statement, not two: the sample heads each block with a
    // single "Well Name: … API/UWI: … License #: …" line, and printing an
    // identity line above a grid that repeats it says the name twice.
    content.push(head, labelValueGrid([block.identity]));

    if (block.noDay) {
      content.push({ text: block.noDay, style: "cellValue", italics: true, margin: [0, 2, 0, 4] });
      return;
    }

    content.push(
      labelValueGrid(block.figures),
      labelValueGrid([[{ label: "Daily Contacts", value: block.dailyContacts }]]),
      labelValueGrid([[{ label: "Operations Summary", value: block.operationsSummary }]]),
      labelValueGrid([[{ label: "Operations Next Report Period", value: block.operationsNextPeriod }]]),
      sectionBar("Time Log"),
      reportTable(TIME_LOG_COLUMNS, block.timeLog),
    );
  });

  return {
    pageSize: { width: LETTER[0], height: LETTER[1] },
    pageOrientation: "portrait",
    pageMargins: PAGE_MARGINS,
    info: { title: payload.title, subject: `Daily summary across ${payload.wells.length} well(s)` },
    background: () => pageFrame(LETTER),
    header: () => titleBand(payload.title),
    footer: reportFooter(payload.printedOn),
    content,
    styles: { ...REPORT_STYLES },
    defaultStyle: { font: "Roboto", fontSize: 6.6 },
  };
}

export async function exportReport12Pdf(payload: Report12Payload): Promise<void> {
  pdfMake.createPdf(buildReport12Doc(payload))
    .download(`${stamp(payload)}_daily_drilling_summary_2.pdf`);
}

/* ══ report 14 ═══════════════════════════════════════════════════════════════ */

export async function buildReport14Doc(payload: Report14Payload): Promise<TDocumentDefinitions> {
  // Only the plots that actually drew something are captured. A plot with an
  // `emptyReason` has no SVG on screen, and demanding one would fail the whole
  // export over a well that merely has no mud checks.
  const captured = await Promise.all(payload.plots.map(async (p): Promise<CapturedChart | null> =>
    (p.emptyReason ? null : captureChart(offsetPlotId(p.key), `${p.title} plot`))));

  const content: Content[] = [];
  payload.plots.forEach((plot: OffsetPlot, i) => {
    const bar = sectionBar(plot.title);
    content.push(i === 0 ? bar : { ...(bar as object), pageBreak: "before" } as Content);

    const chart = captured[i];
    if (!chart) {
      content.push({
        text: plot.emptyReason ?? "Nothing to plot.",
        style: "cellLabel", italics: true, margin: [0, 3, 0, 3],
      });
      return;
    }
    content.push({ image: chart.raster.dataUrl, fit: [740, 400], alignment: "center", margin: [0, 3, 0, 0] });
    const key = legendRow(chart.legend);
    if (key) content.push(key);
    content.push({
      text: `${plot.xLabel} across, ${plot.yLabel} down.`,
      style: "cellLabel", italics: true, margin: [0, 2, 0, 0],
    });
  });
  content.push(labelValueGrid([payload.totals]));

  return {
    pageSize: { width: LANDSCAPE_LETTER[0], height: LANDSCAPE_LETTER[1] },
    pageOrientation: "landscape",
    pageMargins: PAGE_MARGINS,
    info: { title: payload.title, subject: `Drilling offsets across ${payload.wells.length} well(s)` },
    background: () => pageFrame(LANDSCAPE_LETTER),
    header: () => titleBand(payload.title),
    footer: reportFooter(payload.printedOn),
    content,
    styles: { ...REPORT_STYLES },
    defaultStyle: { font: "Roboto", fontSize: 6.6 },
  };
}

export async function exportReport14Pdf(payload: Report14Payload): Promise<void> {
  pdfMake.createPdf(await buildReport14Doc(payload))
    .download(`${stamp(payload)}_drilling_offsets.pdf`);
}
