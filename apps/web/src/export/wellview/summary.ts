/**
 * Report 09 — Drilling Summary 1 — as a generated PDF.
 *
 * Landscape LEGAL, matching the sample (a 792 × 1224 box with /Rotate 90): four
 * panels and a three-row header band need the width, and on letter the two
 * breakdown columns collide.
 *
 * All four panels are rasterized from the LIVE Recharts surfaces the preview
 * renders — see `chartCapture.ts` for the capture-or-throw rule they share with
 * reports 08, 10 and 11.
 *
 * WHY THE FIGURES ARE PRINTED AS WELL AS PLOTTED
 * ---------------------------------------------
 * Each breakdown panel is followed by its own small table. A bar chart answers
 * "which is biggest"; a morning meeting also asks "by how much", and reading a
 * percentage off a rasterized axis is guesswork. The table is the same data the
 * bars are drawn from — one payload, so the two cannot disagree.
 */
import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import { pdfMake } from "../pdfmakeSetup.js";
import {
  PAGE_MARGINS, REPORT_STYLES,
  headerValue, identityLine, labelValueGrid, money, pageFrame,
  reportFooter, reportTable, sectionBar, titleBand,
  type ReportColumn,
} from "../reportChrome.js";
import { captureChart, legendRow, type CapturedChart } from "./chartCapture.js";
import type { BreakdownBar, ProgressPoint, Report09Payload } from "../../entry/wellview.js";
import {
  COST_PANEL_ID, NPT_PANEL_ID, PROGRESS_PANEL_ID, TIME_PANEL_ID,
} from "../../components/wellview/SummaryPreview.js";

const LANDSCAPE_LEGAL: [number, number] = [1224, 792];

/** A breakdown's own figures, beside its bars. */
function breakdownColumns(valueHeader: string, valueKind: "money" | "hours"): ReportColumn<BreakdownBar>[] {
  return [
    { header: "Des", width: "*", cell: (b) => b.label },
    {
      header: valueHeader, width: 78, align: "right",
      cell: (b) => (valueKind === "money" ? money(b.value) : headerValue(b.value)),
    },
    { header: "% of Total", width: 52, align: "right", cell: (b) => headerValue(b.percent) },
  ];
}

const PROGRESS_COLUMNS: ReportColumn<ProgressPoint>[] = [
  { header: "Job Day (days)", width: 56, align: "right", cell: (p) => headerValue(p.jobDay, "int") },
  { header: "Date", width: 66, cell: (p) => p.date },
  { header: "End Depth (mKB)", width: 72, align: "right", cell: (p) => headerValue(p.endDepth) },
  { header: "Cum Field Est To Date (Cost)", width: "*", align: "right", cell: (p) => money(p.cumFieldEst) },
];

/**
 * One panel: its band, its picture, its key, its figures.
 *
 * `chart` is null when the panel had nothing to draw — the preview renders a
 * sentence in that case rather than an empty axis, and so does this.
 */
function panel(
  title: string,
  chart: CapturedChart | null,
  emptyText: string,
  table: Content | null,
): Content {
  const stack: Content[] = [sectionBar(title)];
  if (chart) {
    stack.push({ image: chart.raster.dataUrl, fit: [560, 250], alignment: "center", margin: [0, 3, 0, 0] });
    const key = legendRow(chart.legend);
    if (key) stack.push(key);
  } else {
    stack.push({ text: emptyText, style: "cellLabel", italics: true, margin: [0, 3, 0, 3] });
  }
  if (table) stack.push(table);
  return { stack };
}

/**
 * Capture a panel only if the preview actually drew one.
 *
 * At 1.5× rather than the usual 2×: these four panels print side by side at
 * about half the page width, so 2× was resolution nobody could see, and the
 * four rasters together took the export past thirty seconds.
 */
async function optionalChart(id: string, label: string, drawn: boolean): Promise<CapturedChart | null> {
  return drawn ? captureChart(id, label, 1.5) : null;
}

export async function buildReport09Doc(payload: Report09Payload): Promise<TDocumentDefinitions> {
  const [time, cost, npt, progress] = await Promise.all([
    optionalChart(TIME_PANEL_ID, "time-breakdown panel", payload.timeByCode.length > 0),
    optionalChart(COST_PANEL_ID, "cost-breakdown panel", payload.costByDes.length > 0),
    optionalChart(NPT_PANEL_ID, "NPT panel", payload.nptByDes.length > 0),
    optionalChart(PROGRESS_PANEL_ID, "depth-and-cost panel", payload.progress.length > 0),
  ]);

  const content: Content[] = [
    identityLine(payload.wellName),
    labelValueGrid(payload.header),
    labelValueGrid([payload.jobRow]),
    // Two breakdowns side by side, as the sample stacks them down its right
    // column — on a landscape page that reads as two columns, not two rows.
    {
      columns: [
        {
          width: "*",
          stack: [panel(
            "Time Breakdown by Code 1 — Code 1 vs % Total Time (sorted)",
            time,
            "No time logged on this job's days.",
            payload.timeByCode.length
              ? reportTable(breakdownColumns("Hours (hr)", "hours"), payload.timeByCode)
              : null,
          )],
        },
        {
          width: "*",
          stack: [panel(
            "Cost Breakdown by Des — Field Est by cost description",
            cost,
            "No field estimate on this job's cost sheet.",
            payload.costByDes.length
              ? reportTable(breakdownColumns("Field Est (Cost)", "money"), payload.costByDes)
              : null,
          )],
        },
      ],
      columnGap: 10,
    },
    { text: "", pageBreak: "after" },
    {
      columns: [
        {
          width: "*",
          stack: [panel(
            "NPT by Des — Unscheduled Type vs % Total Time (sorted)",
            npt,
            "No unscheduled time recorded on this job's days.",
            payload.nptByDes.length
              ? reportTable(breakdownColumns("Lost Time (hr)", "hours"), payload.nptByDes)
              : null,
          )],
        },
        {
          width: "*",
          stack: [panel(
            "Depth and Cost vs Days",
            progress,
            "No day filed against this job yet.",
            payload.progress.length ? reportTable(PROGRESS_COLUMNS, payload.progress) : null,
          )],
        },
      ],
      columnGap: 10,
    },
    {
      text: "The sample also prints a directional wellbore schematic down its left column. It is not "
        + "drawn yet — the shared schematic component arrives with the geological and completion reports.",
      style: "cellLabel", italics: true, margin: [0, 4, 0, 0],
    },
  ];

  return {
    pageSize: { width: LANDSCAPE_LEGAL[0], height: LANDSCAPE_LEGAL[1] },
    pageOrientation: "landscape",
    pageMargins: PAGE_MARGINS,
    info: { title: `${payload.title} — ${payload.wellName}`, subject: `Drilling summary for ${payload.wellName}` },
    background: () => pageFrame(LANDSCAPE_LEGAL),
    header: () => titleBand(payload.title),
    footer: reportFooter(payload.printedOn),
    content,
    styles: { ...REPORT_STYLES },
    defaultStyle: { font: "Roboto", fontSize: 6.6 },
  };
}

const slug = (s: string) => s.replace(/\W+/g, "_").replace(/^_+|_+$/g, "");

export async function exportReport09Pdf(payload: Report09Payload): Promise<void> {
  pdfMake.createPdf(await buildReport09Doc(payload))
    .download(`${slug(payload.wellName)}_drilling_summary_1.pdf`);
}
