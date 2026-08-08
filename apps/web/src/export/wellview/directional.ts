/**
 * Report 08 — Directional Plot, Plan vs Actual — as a generated PDF.
 *
 * Landscape letter, matching the sample (a portrait box with /Rotate 90). Both
 * plots are taken from the LIVE Recharts surfaces the preview renders, through
 * `svgRaster.ts`, exactly as reports 10 and 11 do: the printed plot is the one
 * the user is looking at, and a missing chart throws a user-facing error rather
 * than emitting a page with a hole in it.
 *
 * The two panels sit SIDE BY SIDE, as the sample does — vertical section left,
 * plan view inset right — and the station table follows on its own page, so a
 * long survey listing can never push the plots off theirs.
 */
import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import { pdfMake } from "../pdfmakeSetup.js";
import {
  PAGE_MARGINS, REPORT_STYLES,
  headerValue, identityLine, labelValueGrid, pageFrame,
  reportFooter, reportTable, sectionBar, titleBand,
  type ReportColumn,
} from "../reportChrome.js";
import { captureChart, legendRow } from "./chartCapture.js";
import type { PlotStation, Report08Payload } from "../../entry/wellview.js";
import { PLAN_CHART_ID, VS_CHART_ID } from "../../components/wellview/DirectionalPreview.js";

const LANDSCAPE_LETTER: [number, number] = [792, 612];

type StationRow = PlotStation & { source: string };

const STATION_COLUMNS: ReportColumn<StationRow>[] = [
  { header: "Source", width: 34, cell: (s) => s.source },
  { header: "MD (mKB)", width: 56, align: "right", cell: (s) => headerValue(s.md) },
  { header: "Inc (°)", width: 44, align: "right", cell: (s) => headerValue(s.inc) },
  { header: "Azi (°)", width: 44, align: "right", cell: (s) => headerValue(s.azi) },
  { header: "TVD (mKB)", width: 56, align: "right", cell: (s) => headerValue(s.tvd) },
  { header: "NS (m)", width: 56, align: "right", cell: (s) => headerValue(s.ns) },
  { header: "EW (m)", width: 56, align: "right", cell: (s) => headerValue(s.ew) },
  { header: "VS (m)", width: 56, align: "right", cell: (s) => headerValue(s.vs) },
  { header: "Note", width: "*", cell: (s) => s.comment ?? s.date ?? "" },
];

export async function buildReport08Doc(payload: Report08Payload): Promise<TDocumentDefinitions> {
  const [vs, plan] = await Promise.all([
    captureChart(VS_CHART_ID, "vertical-section plot"),
    captureChart(PLAN_CHART_ID, "plan-view plot"),
  ]);

  const stations: StationRow[] = [
    ...payload.plan.map((p) => ({ ...p, source: "Plan" })),
    ...payload.actual.map((p) => ({ ...p, source: "Actual" })),
  ];

  const content: Content[] = [
    identityLine(payload.wellName),
    labelValueGrid(payload.header),
  ];

  if (payload.planMissing) {
    content.push({
      text: "No directional plan is recorded for this well — only the actual curve is drawn.",
      style: "cellValue", italics: true, margin: [0, 2, 0, 3],
    });
  }

  // Side by side, each with its own key beneath, so a reader never has to carry
  // a legend across the page to read the other plot.
  content.push({
    columns: [
      {
        width: "*",
        stack: [
          sectionBar("Vertical Section"),
          { image: vs.raster.dataUrl, fit: [366, 268], alignment: "center", margin: [0, 3, 0, 0] },
          ...(legendRow(vs.legend) ? [legendRow(vs.legend) as Content] : []),
        ],
      },
      {
        width: "*",
        stack: [
          sectionBar("Plan"),
          { image: plan.raster.dataUrl, fit: [366, 268], alignment: "center", margin: [0, 3, 0, 0] },
          ...(legendRow(plan.legend) ? [legendRow(plan.legend) as Content] : []),
        ],
      },
    ],
    columnGap: 8,
  });

  content.push(
    labelValueGrid([payload.extents]),
    // The listing gets its own page: a 200-station survey must never be able to
    // shove the plots onto page 2.
    { text: "", pageBreak: "after" },
    sectionBar("Stations"),
    reportTable(STATION_COLUMNS, stations),
  );

  return {
    pageSize: { width: LANDSCAPE_LETTER[0], height: LANDSCAPE_LETTER[1] },
    pageOrientation: "landscape",
    pageMargins: PAGE_MARGINS,
    info: { title: `${payload.title} — ${payload.wellName}`, subject: `Directional plot for ${payload.wellName}` },
    background: () => pageFrame(LANDSCAPE_LETTER),
    header: () => titleBand(payload.title),
    footer: reportFooter(payload.printedOn),
    content,
    styles: { ...REPORT_STYLES },
    defaultStyle: { font: "Roboto", fontSize: 6.6 },
  };
}

const slug = (s: string) => s.replace(/\W+/g, "_").replace(/^_+|_+$/g, "");

export async function exportReport08Pdf(payload: Report08Payload): Promise<void> {
  pdfMake.createPdf(await buildReport08Doc(payload))
    .download(`${slug(payload.wellName)}_directional_plot.pdf`);
}
