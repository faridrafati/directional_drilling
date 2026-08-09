/**
 * Reports 04 (Casing, Liner and Cement) and 05 (Casing Summary), as PDFs.
 *
 * Both from the same server payloads the previews render, through the shared
 * chrome. The tally is built by ONE column set used by both, mirroring the
 * single `stringBlock` the assembler uses — the tally is the part an engineer
 * reads, and it must not differ between the summary and the detail page.
 */
import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import { pdfMake } from "../pdfmakeSetup.js";
import {
  LETTER_PORTRAIT, PAGE_MARGINS, REPORT_STYLES,
  headerValue, identityLine, labelValueGrid, pageFrame,
  reportFooter, reportTable, sectionBar, titleBand,
  type ReportColumn,
} from "../reportChrome.js";
import { captureChart } from "./chartCapture.js";
import { schematicId } from "../../components/wellview/WellboreSchematic.js";
import type {
  CasingComponentRow, CasingStringBlock, Report04Payload, Report05Payload,
} from "../../entry/wellview.js";

/**
 * The tally, as the samples print it.
 *
 * "Item Des" is given a FIXED width rather than the flexible "*": as the flex
 * column it was squeezed to about 52 pt by the eleven fixed ones, and every
 * "Casing Joint(s)" wrapped onto a second line the sample does not have. The
 * slack now comes out of P Collapse, whose values are four digits at most.
 */
const TALLY_COLUMNS: ReportColumn<CasingComponentRow>[] = [
  { header: "Jts", width: 20, align: "right", cell: (c) => headerValue(c.jts, "int") },
  { header: "Item Des", width: 66, cell: (c) => c.itemDes ?? "" },
  { header: "OD (in)", width: 36, cell: (c) => c.odIn ?? "" },
  // Three decimals: a casing ID is quoted to a thousandth of an inch.
  { header: "ID (in)", width: 38, align: "right", cell: (c) => headerValue(c.idIn, "in3") },
  { header: "Wt (kg/m)", width: 40, align: "right", cell: (c) => headerValue(c.massPerLenKgM) },
  { header: "Grade", width: 30, cell: (c) => c.grade ?? "" },
  { header: "Top Thread", width: 42, cell: (c) => c.topThread ?? "" },
  { header: "Top (mKB)", width: 44, align: "right", cell: (c) => headerValue(c.topMkb) },
  { header: "Btm (mKB)", width: 44, align: "right", cell: (c) => headerValue(c.btmMkb) },
  { header: "Len (m)", width: 42, align: "right", cell: (c) => headerValue(c.lenM) },
  { header: "P Burst (psi)", width: 40, align: "right", cell: (c) => headerValue(c.pBurstPsi) },
  { header: "P Collapse (psi)", width: "*", align: "right", cell: (c) => headerValue(c.pCollapsePsi) },
];

/** One string: caption, properties, tally, roll-up. */
function stringBlock(block: CasingStringBlock): Content[] {
  return [
    sectionBar(block.caption),
    labelValueGrid([block.properties]),
    reportTable(TALLY_COLUMNS, block.components),
    labelValueGrid([block.totals]),
  ];
}

export function buildReport05Doc(payload: Report05Payload): TDocumentDefinitions {
  return {
    pageSize: { width: LETTER_PORTRAIT[0], height: LETTER_PORTRAIT[1] },
    pageOrientation: "portrait",
    pageMargins: PAGE_MARGINS,
    info: { title: `${payload.title} — ${payload.wellName}`, subject: `Casing summary for ${payload.wellName}` },
    background: () => pageFrame(LETTER_PORTRAIT),
    header: () => titleBand(payload.title),
    footer: reportFooter(payload.printedOn),
    content: [
      identityLine(payload.wellName),
      labelValueGrid(payload.header),
      ...payload.strings.flatMap(stringBlock),
    ],
    styles: { ...REPORT_STYLES },
    defaultStyle: { font: "Roboto", fontSize: 6.6 },
  };
}

export async function buildReport04Doc(payload: Report04Payload): Promise<TDocumentDefinitions> {
  const content: Content[] = [
    identityLine(payload.wellName, payload.identityRight),
    labelValueGrid(payload.header),
  ];
  if (payload.runCaption) {
    content.push({ text: payload.runCaption, style: "cellValue", margin: [0, 0, 0, 3] });
  }
  content.push(
    sectionBar("Wellbore"),
    labelValueGrid([payload.wellbore]),
    sectionBar("Sections"),
    reportTable([
      { header: "Section Des", width: "*", cell: (h: typeof payload.sections[number]) => h.sectionDes ?? "" },
      { header: "Size (in)", width: 60, cell: (h: typeof payload.sections[number]) => h.sizeIn ?? "" },
      { header: "Act Top (mKB)", width: 70, align: "right", cell: (h: typeof payload.sections[number]) => headerValue(h.actTopMkb) },
      { header: "Act Btm (mKB)", width: 70, align: "right", cell: (h: typeof payload.sections[number]) => headerValue(h.actBtmMkb) },
    ], payload.sections),
    sectionBar("Wellhead"),
    reportTable([
      { header: "Des", width: "*", cell: (w: typeof payload.wellhead[number]) => w.des ?? "" },
      { header: "Make", width: 70, cell: (w: typeof payload.wellhead[number]) => w.make ?? "" },
      { header: "Model", width: 70, cell: (w: typeof payload.wellhead[number]) => w.model ?? "" },
      { header: "SN", width: 60, cell: (w: typeof payload.wellhead[number]) => w.sn ?? "" },
      { header: "WP Top (psi)", width: 60, align: "right", cell: (w: typeof payload.wellhead[number]) => headerValue(w.wpTopPsi) },
    ], payload.wellhead),
    sectionBar("Last Mud Check"),
    labelValueGrid([payload.lastMudCheck]),
    sectionBar("Casing"),
    ...stringBlock(payload.casing),
  );

  if (payload.cement) {
    content.push(sectionBar("Cement"), labelValueGrid(payload.cement.header));
    payload.cement.stages.forEach((st, i) => {
      content.push(sectionBar(`Cement Stage ${i + 1}`), labelValueGrid(st.header));
      st.fluids.forEach((f, j) => {
        content.push(
          sectionBar(`Cement Fluid ${j + 1}`),
          labelValueGrid(f.fluid),
          reportTable([
            { header: "Add", width: "*", cell: (a: typeof f.additives[number]) => a.additive ?? "" },
            { header: "Type", width: 160, cell: (a: typeof f.additives[number]) => a.additiveType ?? "" },
            { header: "Conc", width: 80, cell: (a: typeof f.additives[number]) => a.concentration ?? "" },
          ], f.additives),
        );
      });
    });
  } else {
    content.push(
      sectionBar("Cement"),
      { text: "No cement job recorded on this string.", style: "cellLabel", italics: true, margin: [0, 2, 0, 0] },
    );
  }

  // The schematic is an SVG like the charts, so it is captured the same way.
  if (!payload.schematic.emptyReason) {
    const shot = await captureChart(schematicId("04"), "wellbore schematic");
    content.push(
      sectionBar("Vertical schematic (actual)"),
      { image: shot.raster.dataUrl, fit: [520, 300], alignment: "center", margin: [0, 3, 0, 0] },
    );
  } else {
    content.push(sectionBar("Vertical schematic (actual)"), {
      text: payload.schematic.emptyReason, style: "cellLabel", italics: true, margin: [0, 3, 0, 3],
    });
  }

  return {
    pageSize: { width: LETTER_PORTRAIT[0], height: LETTER_PORTRAIT[1] },
    pageOrientation: "portrait",
    pageMargins: PAGE_MARGINS,
    info: { title: `${payload.title} — ${payload.wellName}`, subject: `Casing and cement for ${payload.wellName}` },
    background: () => pageFrame(LETTER_PORTRAIT),
    header: () => titleBand(payload.title),
    footer: reportFooter(payload.printedOn),
    content,
    styles: { ...REPORT_STYLES },
    defaultStyle: { font: "Roboto", fontSize: 6.6 },
  };
}

const slug = (s: string) => s.replace(/\W+/g, "_").replace(/^_+|_+$/g, "");

export async function exportReport04Pdf(payload: Report04Payload): Promise<void> {
  pdfMake.createPdf(await buildReport04Doc(payload))
    .download(`${[slug(payload.wellName), slug(payload.identityRight ?? ""), "casing_cement"].filter(Boolean).join("_")}.pdf`);
}

export async function exportReport05Pdf(payload: Report05Payload): Promise<void> {
  pdfMake.createPdf(buildReport05Doc(payload)).download(`${slug(payload.wellName)}_casing_summary.pdf`);
}
