/**
 * Reports 02 (BHA Detail) and 03 (Bit Summary), as generated PDFs.
 *
 * Built from the same server payloads the previews render, through the shared
 * chrome. 02 is portrait letter, one page per run; 03 is LANDSCAPE letter — its
 * nineteen-column Bits table needs the width, and the sample is landscape too
 * (a portrait page with /Rotate 90).
 */
import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import { pdfMake } from "../pdfmakeSetup.js";
import {
  PAGE_MARGINS, REPORT_STYLES,
  headerValue, identityLine, labelValueGrid, money, pageFrame,
  reportFooter, reportTable, sectionBar, titleBand,
  type ReportColumn,
} from "../reportChrome.js";
import { captureChart } from "./chartCapture.js";
import { schematicId } from "../../components/wellview/WellboreSchematic.js";
import type {
  BhaComponentRow, BhaParamRow, BitSummaryRow, Report02Payload, Report03Payload,
} from "../../entry/wellview.js";

const LETTER: [number, number] = [612, 792];
/** Landscape letter, for report 03's wide table. */
/**
 * Report 03's bit table is 19 columns wide: 728 pt of fixed widths plus a star
 * column, and pdfmake adds ~8 pt of cell padding per column on top. That is
 * ~880 pt on a letter-landscape body of 748, so the last three columns were
 * drawn PAST the page edge — invisible in a viewer, and invisible to the text
 * extractor too, which finds the strings wherever they were laid out. Legal
 * landscape gives a 964 pt body, which is what reports 10, 13, 16 and 22
 * already use for the same reason.
 */
const LEGAL_LANDSCAPE: [number, number] = [1008, 612];

const COMPONENT_COLUMNS: ReportColumn<BhaComponentRow>[] = [
  { header: "Jts", width: 20, align: "right", cell: (c) => headerValue(c.jts, "int") },
  { header: "Item Des", width: "*", cell: (c) => c.itemDes ?? "" },
  { header: "OD (in)", width: 32, align: "right", cell: (c) => headerValue(c.odIn) },
  { header: "ID (in)", width: 32, align: "right", cell: (c) => headerValue(c.idIn) },
  { header: "Mass/Len (kg/m)", width: 42, align: "right", cell: (c) => headerValue(c.massPerLenKgM) },
  { header: "Grade", width: 34, cell: (c) => c.grade ?? "" },
  { header: "Drift (in)", width: 34, align: "right", cell: (c) => headerValue(c.driftIn) },
  { header: "Gauge (in)", width: 34, align: "right", cell: (c) => headerValue(c.gaugeIn) },
  { header: "Connections", width: 52, cell: (c) => c.connections ?? "" },
  { header: "Len (m)", width: 40, align: "right", cell: (c) => headerValue(c.lenM) },
  { header: "Cum Len (m)", width: 44, align: "right", cell: (c) => headerValue(c.cumLenM) },
];

const PARAM_COLUMNS: ReportColumn<BhaParamRow>[] = [
  { header: "Wellbore", width: "*", cell: (p) => p.wellbore ?? "" },
  { header: "Start Date", width: 46, cell: (p) => p.startDate ?? "" },
  { header: "End Date", width: 46, cell: (p) => p.endDate ?? "" },
  { header: "Drill Time (hr)", width: 38, align: "right", cell: (p) => headerValue(p.drillTimeHr) },
  { header: "Start (mKB)", width: 42, align: "right", cell: (p) => headerValue(p.startMkb) },
  { header: "End Depth (mKB)", width: 42, align: "right", cell: (p) => headerValue(p.endDepthMkb) },
  { header: "Int Depth (m)", width: 40, align: "right", cell: (p) => headerValue(p.intDepthM) },
  { header: "Int ROP (m/hr)", width: 40, align: "right", cell: (p) => headerValue(p.intRopMHr) },
  { header: "WOB (1000lbf)", width: 40, align: "right", cell: (p) => headerValue(p.wob1000Lbf) },
  { header: "RPM (rpm)", width: 34, align: "right", cell: (p) => headerValue(p.rpm) },
  { header: "Q Flow (gpm)", width: 38, align: "right", cell: (p) => headerValue(p.qFlowGpm) },
  { header: "SPP (psi)", width: 38, align: "right", cell: (p) => headerValue(p.sppPsi) },
];

export async function buildReport02Doc(payload: Report02Payload): Promise<TDocumentDefinitions> {
  const content: Content[] = [
    identityLine(payload.wellName, payload.identityRight),
  ];
  if (payload.runCaption) {
    content.push({ text: payload.runCaption, style: "cellValue", margin: [0, 0, 0, 3] });
  }
  content.push(
    labelValueGrid([payload.runHeader]),
    labelValueGrid([payload.bitRow]),
    labelValueGrid([payload.stringRow]),
    labelValueGrid([[{ label: "Nozzles (1/32\")", value: payload.nozzles }]]),
    labelValueGrid([[{ label: "Comment", value: payload.comment }]]),
    sectionBar("Drill String Components"),
    reportTable(COMPONENT_COLUMNS, payload.components),
    sectionBar("Bit"),
    reportTable([
      { header: "Bit Type", width: "*", cell: (b: typeof payload.bitTypes[number]) => b.bitType ?? "" },
      { header: "Make", width: 56, cell: (b: typeof payload.bitTypes[number]) => b.make ?? "" },
      { header: "Model", width: 56, cell: (b: typeof payload.bitTypes[number]) => b.model ?? "" },
      { header: "Serial Number", width: 56, cell: (b: typeof payload.bitTypes[number]) => b.serialNumber ?? "" },
      { header: "IADC Codes", width: 44, cell: (b: typeof payload.bitTypes[number]) => b.iadcCodes ?? "" },
      { header: "Item Cost (Cost)", width: 52, align: "right", cell: (b: typeof payload.bitTypes[number]) => money(b.itemCost) },
      { header: "Length (m)", width: 44, align: "right", cell: (b: typeof payload.bitTypes[number]) => headerValue(b.lengthM) },
    ], payload.bitTypes),
    sectionBar("Drilling Parameters"),
    reportTable(PARAM_COLUMNS, payload.drillingParameters),
    sectionBar("Bit Nozzles"),
    reportTable([{ header: "Size (1/32\")", width: "*", align: "right", cell: (n: number) => headerValue(n, "int") }],
      payload.bitNozzles),
    sectionBar("Sensors"),
    reportTable([
      { header: "Sensor Type", width: "*", cell: (s: typeof payload.sensors[number]) => s.sensorType ?? "" },
      { header: "Sensor-Bit (m)", width: 52, align: "right", cell: (s: typeof payload.sensors[number]) => headerValue(s.distFromBitM) },
      { header: "Note", width: 200, cell: (s: typeof payload.sensors[number]) => s.note ?? "" },
    ], payload.sensors),
    sectionBar("Mud Checks"),
    reportTable([
      { header: "Date", width: 48, cell: (m: typeof payload.mudChecks[number]) => m.date ?? "" },
      { header: "Depth (mKB)", width: 44, align: "right", cell: (m: typeof payload.mudChecks[number]) => headerValue(m.depthMkb) },
      { header: "Type", width: "*", cell: (m: typeof payload.mudChecks[number]) => m.type ?? "" },
      { header: "Dens (ppg)", width: 40, align: "right", cell: (m: typeof payload.mudChecks[number]) => headerValue(m.densPpg) },
      { header: "PV Calc (cp)", width: 40, align: "right", cell: (m: typeof payload.mudChecks[number]) => headerValue(m.pvCp) },
      { header: "YP Calc (lbf/100ft²)", width: 46, align: "right", cell: (m: typeof payload.mudChecks[number]) => headerValue(m.ypLbf100ft2) },
      { header: "pH", width: 30, align: "right", cell: (m: typeof payload.mudChecks[number]) => headerValue(m.ph) },
      { header: "Sand (%)", width: 34, align: "right", cell: (m: typeof payload.mudChecks[number]) => headerValue(m.sandPct) },
      { header: "Solids (%)", width: 36, align: "right", cell: (m: typeof payload.mudChecks[number]) => headerValue(m.solidsPct) },
    ], payload.mudChecks),
  );

  // The schematic is an SVG like the charts, so it is captured the same way —
  // the printed picture is the one on screen, and a missing one throws rather
  // than leaving the page's left rail silently blank.
  if (!payload.schematic.emptyReason) {
    const shot = await captureChart(schematicId("02"), "wellbore schematic");
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
    pageSize: { width: LETTER[0], height: LETTER[1] },
    pageOrientation: "portrait",
    pageMargins: PAGE_MARGINS,
    info: { title: `${payload.title} — ${payload.wellName}`, subject: `BHA detail for ${payload.wellName}` },
    background: () => pageFrame(LETTER),
    header: () => titleBand(payload.title),
    footer: reportFooter(payload.printedOn),
    content,
    styles: { ...REPORT_STYLES },
    defaultStyle: { font: "Roboto", fontSize: 6.6 },
  };
}

const BIT_COLUMNS: ReportColumn<BitSummaryRow>[] = [
  { header: "BHA #", width: 22, align: "right", cell: (b) => headerValue(b.bhaNo, "int") },
  { header: "Bit Run", width: 26, cell: (b) => b.bitRun ?? "" },
  { header: "Size (in)", width: 32, cell: (b) => b.sizeIn ?? "" },
  { header: "Make", width: 52, cell: (b) => b.make ?? "" },
  { header: "Model", width: 48, cell: (b) => b.model ?? "" },
  { header: "SN", width: 40, cell: (b) => b.serialNo ?? "" },
  { header: "IADC Codes", width: 36, cell: (b) => b.iadcCodes ?? "" },
  { header: "TFA (incl Noz) (in²)", width: 38, align: "right", cell: (b) => headerValue(b.tfaIn2) },
  { header: "Nozzles (1/32\")", width: "*", cell: (b) => b.nozzles ?? "" },
  { header: "Depth In (mKB)", width: 44, align: "right", cell: (b) => headerValue(b.depthInMkb) },
  { header: "Depth Out (mKB)", width: 44, align: "right", cell: (b) => headerValue(b.depthOutMkb) },
  { header: "Drilled (m)", width: 42, align: "right", cell: (b) => headerValue(b.drilledM) },
  { header: "Drill Time (hr)", width: 38, align: "right", cell: (b) => headerValue(b.drillTimeHr) },
  { header: "BHA ROP (m/hr)", width: 38, align: "right", cell: (b) => headerValue(b.bhaRopMHr) },
  { header: "WOB Max (1000lbf)", width: 38, align: "right", cell: (b) => headerValue(b.wobMax) },
  { header: "WOB Min (1000lbf)", width: 38, align: "right", cell: (b) => headerValue(b.wobMin) },
  { header: "Max RPM (rpm)", width: 34, align: "right", cell: (b) => headerValue(b.rpmMax) },
  { header: "Min RPM (rpm)", width: 34, align: "right", cell: (b) => headerValue(b.rpmMin) },
  { header: "Bit Dull", width: 84, cell: (b) => b.bitDull ?? "" },
];

export function buildReport03Doc(payload: Report03Payload): TDocumentDefinitions {
  return {
    pageSize: { width: LEGAL_LANDSCAPE[0], height: LEGAL_LANDSCAPE[1] },
    pageOrientation: "landscape",
    pageMargins: PAGE_MARGINS,
    info: { title: `${payload.title} — ${payload.wellName}`, subject: `Bit summary for ${payload.wellName}` },
    background: () => pageFrame(LEGAL_LANDSCAPE),
    header: () => titleBand(payload.title),
    footer: reportFooter(payload.printedOn),
    content: [
      identityLine(payload.wellName, payload.identityRight),
      labelValueGrid(payload.header),
      sectionBar("Bits"),
      reportTable(BIT_COLUMNS, payload.bits),
    ],
    styles: { ...REPORT_STYLES },
    defaultStyle: { font: "Roboto", fontSize: 6.6 },
  };
}

const slug = (s: string) => s.replace(/\W+/g, "_").replace(/^_+|_+$/g, "");

export async function exportReport02Pdf(payload: Report02Payload): Promise<void> {
  const bha = /BHA#:\s*(\d+)/.exec(payload.identityRight ?? "")?.[1] ?? "";
  pdfMake.createPdf(await buildReport02Doc(payload))
    .download(`${[slug(payload.wellName), bha ? `bha_${bha}` : "", "bha_detail"].filter(Boolean).join("_")}.pdf`);
}

export async function exportReport03Pdf(payload: Report03Payload): Promise<void> {
  pdfMake.createPdf(buildReport03Doc(payload))
    .download(`${[slug(payload.wellName), "bit_summary"].filter(Boolean).join("_")}.pdf`);
}
