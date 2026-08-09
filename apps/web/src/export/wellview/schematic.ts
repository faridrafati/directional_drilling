/**
 * Report 21 — the Geological Schematic, as a generated PDF.
 *
 * Landscape LEGAL to match the sample's rotated 612 × 792 box: a composite log
 * needs the width for its parallel tracks.
 *
 * The composite is captured as ONE raster rather than three. The tracks share a
 * depth scale, and capturing them separately would let the PDF place them at
 * three slightly different heights — which is exactly the failure a composite
 * log cannot survive, because reading across the tracks at a depth is the only
 * thing it is for.
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
import type { Report21Payload, SchematicStation } from "../../entry/wellview.js";
import { PARAM_TRACK_ID } from "../../components/wellview/SchematicPreview.js";

const LANDSCAPE_LEGAL: [number, number] = [1008, 612];

const STATION_COLUMNS: ReportColumn<SchematicStation>[] = [
  { header: "MD (mKB)", width: 76, align: "right", cell: (s) => headerValue(s.md) },
  { header: "TVD (mKB)", width: 76, align: "right", cell: (s) => headerValue(s.tvd) },
  { header: "Incl (°)", width: 64, align: "right", cell: (s) => headerValue(s.inc) },
  { header: "DLS (°/30m)", width: 76, align: "right", cell: (s) => headerValue(s.dls) },
  { header: "", width: "*", cell: () => "" },
];

/**
 * The whole track row — schematic, lithology and mud — as one picture.
 *
 * Found by the id the schematic component stamps, then walked UP to the flex
 * row that holds all three: capturing the schematic's own SVG alone would drop
 * the two tracks beside it, which are half the report.
 */
async function captureComposite(): Promise<{ dataUrl: string } | null> {
  const anchor = document.getElementById("wellview-schematic-21");
  const row = anchor?.parentElement;
  if (!row) return null;
  // `captureChart` finds an <svg> under an id, so the row is given one first.
  const previous = row.id;
  row.id = "wellview-21-composite";
  try {
    const shot = await captureChart("wellview-21-composite", "wellbore schematic");
    return { dataUrl: shot.raster.dataUrl };
  } finally {
    row.id = previous;
  }
}

export async function buildReport21Doc(payload: Report21Payload): Promise<TDocumentDefinitions> {
  const content: Content[] = [
    identityLine(payload.wellName),
    labelValueGrid(payload.header),
  ];
  if (payload.caption) {
    content.push({ text: payload.caption, style: "cellValue", margin: [0, 0, 0, 3] });
  }

  content.push(sectionBar("Vertical schematic (actual)"));
  if (payload.schematic.emptyReason) {
    content.push({
      text: payload.schematic.emptyReason,
      style: "cellLabel", italics: true, margin: [0, 3, 0, 3],
    });
  } else {
    const shot = await captureComposite();
    if (shot) {
      content.push({ image: shot.dataUrl, fit: [950, 380], alignment: "center", margin: [0, 3, 0, 0] });
    }
  }

  if (payload.parameters.length > 0) {
    const chart = await captureChart(PARAM_TRACK_ID, "drill-parameter track");
    content.push(
      sectionBar("Drill parameters against depth"),
      { image: chart.raster.dataUrl, fit: [950, 330], alignment: "center", margin: [0, 3, 0, 0] },
    );
    const key = legendRow(chart.legend);
    if (key) content.push(key);
    content.push({
      text: "Q Flow is left off this plot on purpose: at 700–1,100 gpm it is two orders of magnitude "
        + "above WOB and ROP, and one shared axis would flatten the other three curves into the floor.",
      style: "cellLabel", italics: true, margin: [0, 2, 0, 0],
    });
  }

  content.push(
    sectionBar("Survey stations"),
    reportTable(STATION_COLUMNS, payload.stations),
    labelValueGrid([payload.totals]),
  );

  return {
    pageSize: { width: LANDSCAPE_LEGAL[0], height: LANDSCAPE_LEGAL[1] },
    pageOrientation: "landscape",
    pageMargins: PAGE_MARGINS,
    info: { title: `${payload.title} — ${payload.wellName}`, subject: `Schematic for ${payload.wellName}` },
    background: () => pageFrame(LANDSCAPE_LEGAL),
    header: () => titleBand(payload.title),
    footer: reportFooter(payload.printedOn),
    content,
    styles: { ...REPORT_STYLES },
    defaultStyle: { font: "Roboto", fontSize: 6.6 },
  };
}

const slug = (s: string) => s.replace(/\W+/g, "_").replace(/^_+|_+$/g, "");

export async function exportReport21Pdf(payload: Report21Payload): Promise<void> {
  pdfMake.createPdf(await buildReport21Doc(payload))
    .download(`${slug(payload.wellName)}_schematic.pdf`);
}
