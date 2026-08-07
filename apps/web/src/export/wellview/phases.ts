/**
 * Reports 10 (Phases — Plan vs Actual) and 11 (Phase Summary Graph), as PDFs.
 *
 * Both carry a chart, and both take it from the LIVE Recharts surface on screen
 * — rasterized through `svgRaster.ts` at 2× — exactly as the directional-plot
 * export does. Two consequences, both deliberate:
 *
 *   • the printed chart is the one the user is looking at, so the page can never
 *     show a different series set from the preview;
 *   • if the chart is not mounted this THROWS with a message meant for the user
 *     and no file is produced. A blank chart on a signed report is worse than an
 *     error, and the same rule already governs the directional plot.
 *
 * Recharts renders its legend as an HTML sibling of the SVG, so it is read with
 * `readChartLegend` and redrawn here as vector swatches — the printed key then
 * names the series the chart actually has.
 */
import type { CanvasElement, Content, TDocumentDefinitions } from "pdfmake/interfaces";
import { pdfMake } from "../pdfmakeSetup.js";
import {
  PAGE_MARGINS, REPORT_STYLES,
  headerValue, identityLine, labelValueGrid, money, pageFrame,
  reportFooter, reportTable, sectionBar, titleBand,
  type ReportColumn,
} from "../reportChrome.js";
import {
  rasterizeSvgElement, readChartLegend,
  type ChartLegendItem, type SvgRasterResult,
} from "../svgRaster.js";
import type { PhaseRow, Report10Payload, Report11Payload } from "../../entry/wellview.js";
import { PHASE_BAR_CHART_ID, PHASE_CHART_ID } from "../../components/wellview/PhasePreview.js";

/**
 * Page sizes, taken from the samples: report 10 is landscape LEGAL (its sample
 * is a 612 × 1008 portrait box with /Rotate 90) because its eighteen-column
 * table needs the width; report 11 is landscape letter.
 */
const LANDSCAPE_LEGAL: [number, number] = [1008, 612];
const LANDSCAPE_LETTER: [number, number] = [792, 612];

const PHASE_COLUMNS: ReportColumn<PhaseRow>[] = [
  { header: "Phase Type 1", width: 52, cell: (p) => p.phaseType1 ?? "" },
  { header: "Phase Type 2", width: 62, cell: (p) => p.phaseType2 ?? "" },
  { header: "Planned Start Depth (mKB)", width: 36, align: "right", cell: (p) => headerValue(p.plannedStartDepth) },
  { header: "Planned End Depth (mKB)", width: 36, align: "right", cell: (p) => headerValue(p.plannedEndDepth) },
  { header: "Dur ML (days)", width: 30, align: "right", cell: (p) => headerValue(p.durMlDays) },
  { header: "Pl Cum Days ML (days)", width: 30, align: "right", cell: (p) => headerValue(p.cumDurMlDays) },
  { header: "Planned Likely Phase Cost (Cost)", width: 48, align: "right", cell: (p) => money(p.plannedCost) },
  { header: "Pl Cum Cost ML (Cost)", width: 48, align: "right", cell: (p) => money(p.cumPlannedCost) },
  { header: "Plan Cost/Depth (Cost/m)", width: 36, align: "right", cell: (p) => headerValue(p.planCostPerDepth) },
  { header: "Actual Start Date", width: 62, cell: (p) => p.actualStartDate ?? "" },
  { header: "Actual End Date", width: 62, cell: (p) => p.actualEndDate ?? "" },
  { header: "Actual Dur (days)", width: 30, align: "right", cell: (p) => headerValue(p.actualDurDays) },
  { header: "Act Cum Dur (days)", width: 30, align: "right", cell: (p) => headerValue(p.cumActualDurDays) },
  { header: "Actual Start Depth (mKB)", width: 36, align: "right", cell: (p) => headerValue(p.actualStartDepth) },
  { header: "End Depth (mKB)", width: 36, align: "right", cell: (p) => headerValue(p.actualEndDepth) },
  { header: "Actual Phase Field Est (Cost)", width: 48, align: "right", cell: (p) => money(p.actualCost) },
  { header: "Actual Phase Cum Field Est (Cost)", width: 48, align: "right", cell: (p) => money(p.cumActualCost) },
  { header: "Cost/Depth (Cost/m)", width: "*", align: "right", cell: (p) => headerValue(p.costPerDepth) },
];

/** One plot as the report needs it: the picture, and what the picture means. */
interface CapturedChart {
  raster: SvgRasterResult;
  legend: ChartLegendItem[];
}

/**
 * Find the live chart by the id its preview stamps, and rasterize it.
 *
 * Throws with a user-facing message when it is not on screen — the caller lets
 * that surface rather than downloading a report with a hole in it.
 */
async function captureChart(containerId: string, label: string): Promise<CapturedChart> {
  const svg = document.getElementById(containerId)?.querySelector("svg");
  if (!svg) {
    throw new Error(
      `the ${label} is not on screen — let the preview finish drawing before exporting`,
    );
  }
  let raster: SvgRasterResult;
  try {
    raster = await rasterizeSvgElement(svg as SVGSVGElement, { scale: 2, background: "#ffffff" });
  } catch (err) {
    throw new Error(`could not capture the ${label} — ${err instanceof Error ? err.message : String(err)}`);
  }
  let legend: ChartLegendItem[] = [];
  // An unreadable legend costs the report a key, not the report.
  try { legend = readChartLegend(svg as SVGSVGElement); } catch { legend = []; }
  return { raster, legend };
}

const SWATCH_W = 14;
const SWATCH_H = 9;

/** The chart's own key, redrawn as vector shapes so it prints as it looks. */
function legendRow(items: ChartLegendItem[]): Content | null {
  if (items.length === 0) return null;
  const cells: Content[] = [];
  const widths: Array<number | string> = [];
  for (const item of items) {
    cells.push({ canvas: swatch(item) }, { text: item.label, style: "cellLabel" });
    widths.push(SWATCH_W, "auto");
  }
  return {
    table: { widths, body: [cells] },
    layout: {
      hLineWidth: () => 0, vLineWidth: () => 0,
      paddingTop: () => 0, paddingBottom: () => 0,
      paddingLeft: (i: number) => (i === 0 ? 0 : i % 2 === 0 ? 8 : 3),
      paddingRight: () => 0,
    },
    margin: [0, 4, 0, 0],
  };
}

function swatch(item: ChartLegendItem): CanvasElement[] {
  const cy = SWATCH_H / 2;
  switch (item.shape) {
    case "line":
      return [{ type: "line", x1: 0, y1: cy, x2: SWATCH_W, y2: cy, lineWidth: 2, lineColor: item.color }];
    case "square":
      return [{ type: "rect", x: 1, y: cy - 3.5, w: 7, h: 7, color: item.color }];
    default:
      return [{ type: "ellipse", x: SWATCH_W / 2, y: cy, r1: 3.5, r2: 3.5, color: item.color }];
  }
}

export async function buildReport10Doc(payload: Report10Payload): Promise<TDocumentDefinitions> {
  const chart = await captureChart(PHASE_CHART_ID, "phase depth-and-cost graph");
  const content: Content[] = [
    identityLine(payload.wellName),
    labelValueGrid([payload.jobHeader]),
    sectionBar("Phases"),
    reportTable(PHASE_COLUMNS, payload.phases),
    labelValueGrid([payload.totals]),
    sectionBar("Depth and cost against days"),
    { image: chart.raster.dataUrl, fit: [950, 224], alignment: "center", margin: [0, 3, 0, 0] },
  ];
  const key = legendRow(chart.legend);
  if (key) content.push(key);

  return {
    pageSize: { width: LANDSCAPE_LEGAL[0], height: LANDSCAPE_LEGAL[1] },
    pageOrientation: "landscape",
    pageMargins: PAGE_MARGINS,
    info: { title: `${payload.title} — ${payload.wellName}`, subject: `Phases for ${payload.wellName}` },
    background: () => pageFrame(LANDSCAPE_LEGAL),
    header: () => titleBand(payload.title),
    footer: reportFooter(payload.printedOn),
    content,
    styles: { ...REPORT_STYLES },
    defaultStyle: { font: "Roboto", fontSize: 6.4 },
  };
}

export async function buildReport11Doc(payload: Report11Payload): Promise<TDocumentDefinitions> {
  const chart = await captureChart(PHASE_BAR_CHART_ID, "phase summary graph");
  const content: Content[] = [
    identityLine(payload.wellName),
    labelValueGrid([payload.wellRow]),
    labelValueGrid([payload.jobRow]),
    labelValueGrid([payload.planRow]),
    sectionBar("Duration and cost by phase"),
    { image: chart.raster.dataUrl, fit: [740, 330], alignment: "center", margin: [0, 4, 0, 0] },
  ];
  const key = legendRow(chart.legend);
  if (key) content.push(key);

  return {
    pageSize: { width: LANDSCAPE_LETTER[0], height: LANDSCAPE_LETTER[1] },
    pageOrientation: "landscape",
    pageMargins: PAGE_MARGINS,
    info: { title: `${payload.title} — ${payload.wellName}`, subject: `Phase summary for ${payload.wellName}` },
    background: () => pageFrame(LANDSCAPE_LETTER),
    header: () => titleBand(payload.title),
    footer: reportFooter(payload.printedOn),
    content,
    styles: { ...REPORT_STYLES },
    defaultStyle: { font: "Roboto", fontSize: 6.4 },
  };
}

const slug = (s: string) => s.replace(/\W+/g, "_").replace(/^_+|_+$/g, "");

export async function exportReport10Pdf(payload: Report10Payload): Promise<void> {
  pdfMake.createPdf(await buildReport10Doc(payload))
    .download(`${slug(payload.wellName)}_phases_plan_vs_actual.pdf`);
}

export async function exportReport11Pdf(payload: Report11Payload): Promise<void> {
  pdfMake.createPdf(await buildReport11Doc(payload))
    .download(`${slug(payload.wellName)}_phase_summary_graph.pdf`);
}
