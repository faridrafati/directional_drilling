/**
 * The Tier 5 completion reports, as generated PDFs — 22, 23, 24, 25, 26, 27,
 * 28, 29 and 30.
 *
 * Six of the nine carry the shared schematic, captured the way every other SVG
 * in this suite is captured: from the element the preview drew, so the printed
 * picture is the one on screen. A well with nothing to draw prints its reason
 * instead and is NOT captured — demanding an SVG would fail the whole export
 * over a well nobody has entered a casing string for yet.
 *
 * Page sizes follow the samples: 22, 24, 26, 28, 29 and 30 are landscape (their
 * originals are rotated portrait boxes), 23 is portrait like the daily sheets,
 * and 25 and 27 are landscape for their charts and wide tables.
 */
import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import { pdfMake } from "../pdfmakeSetup.js";
import {
  PAGE_MARGINS, REPORT_STYLES,
  headerValue, identityLine, labelValueGrid, money, pageFrame,
  reportFooter, reportTable, sectionBar, titleBand,
  type ReportColumn,
} from "../reportChrome.js";
import { captureChart, legendRow } from "./chartCapture.js";
import { schematicId } from "../../components/wellview/WellboreSchematic.js";
import { FAILURE_CHART_ID, PRODUCTION_CHART_ID } from "../../components/wellview/ProductionPreview.js";
import type {
  FailureCostCell, PerforationBlock, ProductionRow,
  Report22Payload, Report23Payload, Report24Payload, Report25Payload, Report26Payload,
  Report27Payload, Report28Payload, Report29Payload, Report30Payload,
  SchematicPayload, TubingBlock,
} from "../../entry/wellview.js";

const LETTER: [number, number] = [612, 792];
const LANDSCAPE_LETTER: [number, number] = [792, 612];
const LANDSCAPE_LEGAL: [number, number] = [1008, 612];

const slug = (s: string) => s.replace(/\W+/g, "_").replace(/^_+|_+$/g, "");
const yesNo = (v: boolean | null) => (v === null ? "" : v ? "Yes" : "No");

/**
 * The schematic, captured — or its reason, printed.
 *
 * Never throws over an empty picture: a well with no casing string entered yet
 * is a normal state, and failing the export over it would make the report
 * unusable exactly when somebody is trying to see what IS entered.
 */
async function schematicContent(
  payload: SchematicPayload, reportType: string, fit: [number, number],
): Promise<Content[]> {
  if (payload.emptyReason) {
    return [{ text: payload.emptyReason, style: "cellLabel", italics: true, margin: [0, 3, 0, 3] }];
  }
  const shot = await captureChart(schematicId(reportType), "wellbore schematic");
  return [{ image: shot.raster.dataUrl, fit, alignment: "center", margin: [0, 3, 0, 0] }];
}

const TUBING_COLUMNS: ReportColumn<TubingBlock["components"][number]>[] = [
  { header: "Item Des", width: 96, cell: (c) => c.itemDes ?? "" },
  { header: "Jts", width: 26, align: "right", cell: (c) => headerValue(c.jts, "int") },
  { header: "Make", width: 62, cell: (c) => c.make ?? "" },
  { header: "Model", width: 62, cell: (c) => c.model ?? "" },
  { header: "OD (in)", width: 40, cell: (c) => c.odIn ?? "" },
  { header: "ID (in)", width: 44, align: "right", cell: (c) => headerValue(c.idIn, "in3") },
  { header: "Wt (kg/m)", width: 46, align: "right", cell: (c) => headerValue(c.massPerLenKgM) },
  { header: "Grade", width: 36, cell: (c) => c.grade ?? "" },
  { header: "Len (m)", width: 46, align: "right", cell: (c) => headerValue(c.lenM) },
  { header: "Top (mKB)", width: 50, align: "right", cell: (c) => headerValue(c.topMkb) },
  { header: "Btm (mKB)", width: 50, align: "right", cell: (c) => headerValue(c.btmMkb) },
  { header: "SN", width: "*", cell: (c) => c.serialNo ?? "" },
];

function tubingContent(blocks: TubingBlock[]): Content[] {
  if (blocks.length === 0) {
    return [{ text: "No tubing string recorded.", style: "cellLabel", italics: true, margin: [0, 2, 0, 3] }];
  }
  return blocks.flatMap((t) => [
    sectionBar(t.caption),
    labelValueGrid([t.header]),
    reportTable(TUBING_COLUMNS, t.components),
  ]);
}

function perforationContent(blocks: PerforationBlock[]): Content[] {
  if (blocks.length === 0) {
    return [{ text: "No perforation recorded.", style: "cellLabel", italics: true, margin: [0, 2, 0, 3] }];
  }
  return blocks.flatMap((p) => [
    labelValueGrid(p.header),
    sectionBar("Perforation Statuses"),
    reportTable([
      { header: "Date", width: 62, cell: (st: PerforationBlock["statuses"][number]) => st.date ?? "" },
      { header: "Status", width: 72, cell: (st: PerforationBlock["statuses"][number]) => st.status ?? "" },
      { header: "Com", width: "*", cell: (st: PerforationBlock["statuses"][number]) => st.com ?? "" },
    ], p.statuses),
  ]);
}

function doc(
  size: [number, number],
  orientation: "portrait" | "landscape",
  title: string,
  subject: string,
  printedOn: string,
  content: Content[],
): TDocumentDefinitions {
  return {
    pageSize: { width: size[0], height: size[1] },
    pageOrientation: orientation,
    pageMargins: PAGE_MARGINS,
    info: { title, subject },
    background: () => pageFrame(size),
    header: () => titleBand(title),
    footer: reportFooter(printedOn),
    content,
    styles: { ...REPORT_STYLES },
    defaultStyle: { font: "Roboto", fontSize: 6.6 },
  };
}

/* ══ 22 ══════════════════════════════════════════════════════════════════════ */

export async function buildReport22Doc(p: Report22Payload): Promise<TDocumentDefinitions> {
  return doc(LANDSCAPE_LEGAL, "landscape", p.title, `Complete well summary for ${p.wellName}`, p.printedOn, [
    identityLine(p.wellName),
    labelValueGrid(p.identity),
    sectionBar(p.caption),
    ...(await schematicContent(p.schematic, "22", [640, 400])),
    sectionBar("Wellbore"),
    labelValueGrid([p.wellbore]),
    sectionBar("Hole Sections"),
    reportTable([
      { header: "Size (in)", width: 70, cell: (h: Report22Payload["holeSections"][number]) => h.sizeIn ?? "" },
      { header: "Act Top (mKB)", width: 80, align: "right", cell: (h: Report22Payload["holeSections"][number]) => headerValue(h.actTopMkb) },
      { header: "Act Btm (mKB)", width: "*", align: "right", cell: (h: Report22Payload["holeSections"][number]) => headerValue(h.actBtmMkb) },
    ], p.holeSections),
    sectionBar("Plug Back Total Depths"),
    reportTable([
      { header: "Date", width: 66, cell: (x: Report22Payload["plugBacks"][number]) => x.date ?? "" },
      { header: "Depth (mKB)", width: 70, align: "right", cell: (x: Report22Payload["plugBacks"][number]) => headerValue(x.depthMkb) },
      { header: "Method", width: 80, cell: (x: Report22Payload["plugBacks"][number]) => x.method ?? "" },
      { header: "Com", width: "*", cell: (x: Report22Payload["plugBacks"][number]) => x.com ?? "" },
    ], p.plugBacks),
    sectionBar("Formations"),
    reportTable([
      { header: "Formation Name", width: "*", cell: (f: Report22Payload["formations"][number]) => f.name ?? "" },
      { header: "Element Type", width: 76, cell: (f: Report22Payload["formations"][number]) => f.elementType ?? "" },
      { header: "H2S Conc (%)", width: 62, align: "right", cell: (f: Report22Payload["formations"][number]) => headerValue(f.h2sConcPct) },
      { header: "Final Top MD (mKB)", width: 80, align: "right", cell: (f: Report22Payload["formations"][number]) => headerValue(f.finalTopMd) },
      { header: "Final Top TVD (mKB)", width: 80, align: "right", cell: (f: Report22Payload["formations"][number]) => headerValue(f.finalTopTvd) },
    ], p.formations),
    sectionBar("Deviation Surveys"),
    reportTable([
      { header: "Date", width: 66, cell: (d: Report22Payload["deviationSurveys"][number]) => d.date ?? "" },
      { header: "Des", width: "*", cell: (d: Report22Payload["deviationSurveys"][number]) => d.des ?? "" },
      { header: "Prop?", width: 40, cell: (d: Report22Payload["deviationSurveys"][number]) => yesNo(d.proposed) },
      { header: "Definitive?", width: 56, cell: (d: Report22Payload["deviationSurveys"][number]) => yesNo(d.definitive) },
    ], p.deviationSurveys),
    sectionBar("Reservoirs"),
    reportTable([
      { header: "Res Name", width: "*", cell: (r: Report22Payload["reservoirs"][number]) => r.name ?? "" },
      { header: "Top (mKB)", width: 70, align: "right", cell: (r: Report22Payload["reservoirs"][number]) => headerValue(r.topMkb) },
      { header: "Btm (mKB)", width: 70, align: "right", cell: (r: Report22Payload["reservoirs"][number]) => headerValue(r.btmMkb) },
      { header: "Res Datum Depth (m)", width: 88, align: "right", cell: (r: Report22Payload["reservoirs"][number]) => headerValue(r.datumDepthM) },
    ], p.reservoirs),
    sectionBar("Casing Strings"),
    reportTable([
      { header: "String", width: "*", cell: (c: Report22Payload["casingStrings"][number]) => c.caption },
      { header: "Run Date", width: 66, cell: (c: Report22Payload["casingStrings"][number]) => c.runDate ?? "" },
      { header: "Centralizers", width: 120, cell: (c: Report22Payload["casingStrings"][number]) => c.centralizers ?? "" },
      { header: "Scratchers", width: 70, cell: (c: Report22Payload["casingStrings"][number]) => c.scratchers ?? "" },
      { header: "Drift Min (in)", width: 62, align: "right", cell: (c: Report22Payload["casingStrings"][number]) => headerValue(c.minDriftIn, "in3") },
    ], p.casingStrings),
    sectionBar("Tubing Strings"),
    ...tubingContent(p.tubingStrings),
    sectionBar("Perforations"),
    reportTable([
      { header: "Date", width: 66, cell: (x: Report22Payload["perforations"][number]) => x.date ?? "" },
      { header: "Zone", width: "*", cell: (x: Report22Payload["perforations"][number]) => x.zone ?? "" },
      { header: "Top (mKB)", width: 70, align: "right", cell: (x: Report22Payload["perforations"][number]) => headerValue(x.topMkb) },
      { header: "Btm (mKB)", width: 70, align: "right", cell: (x: Report22Payload["perforations"][number]) => headerValue(x.btmMkb) },
    ], p.perforations),
    labelValueGrid([p.totals]),
  ]);
}

/* ══ 23 ══════════════════════════════════════════════════════════════════════ */

export async function buildReport23Doc(p: Report23Payload): Promise<TDocumentDefinitions> {
  const content: Content[] = [];
  if (p.identityRight) {
    content.push({ text: p.identityRight, style: "cellValue", alignment: "right" });
  }
  content.push(
    identityLine(p.wellName),
    labelValueGrid(p.header),
    labelValueGrid([p.completionHeader]),
    sectionBar(p.caption),
    ...(await schematicContent(p.schematic, "23", [520, 320])),
    labelValueGrid(p.jobHeader),
    sectionBar("Daily Readings"),
    labelValueGrid([p.dailyReadings]),
    sectionBar("Daily Contacts"),
    reportTable([
      { header: "Job Contact", width: 120, cell: (c: Report23Payload["contacts"][number]) => c.jobContact ?? "" },
      { header: "Title", width: 110, cell: (c: Report23Payload["contacts"][number]) => c.title ?? "" },
      { header: "Mobile", width: "*", cell: (c: Report23Payload["contacts"][number]) => c.mobile ?? "" },
    ], p.contacts),
    sectionBar("Time Log"),
    reportTable([
      { header: "Start Time", width: 46, cell: (t: Report23Payload["timeLog"][number]) => t.startTime ?? "" },
      { header: "End Time", width: 46, cell: (t: Report23Payload["timeLog"][number]) => t.endTime ?? "" },
      { header: "Dur (hr)", width: 38, align: "right", cell: (t: Report23Payload["timeLog"][number]) => headerValue(t.durHr) },
      { header: "Code 1", width: 34, cell: (t: Report23Payload["timeLog"][number]) => t.code1 ?? "" },
      { header: "Code 2", width: 56, cell: (t: Report23Payload["timeLog"][number]) => t.code2 ?? "" },
      { header: "Com", width: "*", cell: (t: Report23Payload["timeLog"][number]) => t.com ?? "" },
    ], p.timeLog),
    sectionBar("Report Fluids Summary"),
    reportTable([
      { header: "Fluid", width: "*", cell: (f: Report23Payload["fluids"][number]) => f.fluid ?? "" },
      { header: "To well (bbl)", width: 70, align: "right", cell: (f: Report23Payload["fluids"][number]) => headerValue(f.toWellBbl) },
      { header: "From well (bbl)", width: 76, align: "right", cell: (f: Report23Payload["fluids"][number]) => headerValue(f.fromWellBbl) },
    ], p.fluids),
    sectionBar("Safety Checks"),
    reportTable([
      { header: "Time", width: 40, cell: (c: Report23Payload["safetyChecks"][number]) => c.time ?? "" },
      { header: "Des", width: "*", cell: (c: Report23Payload["safetyChecks"][number]) => c.des ?? "" },
      { header: "Type", width: 80, cell: (c: Report23Payload["safetyChecks"][number]) => c.type ?? "" },
    ], p.safetyChecks),
    sectionBar("Logs"),
    reportTable([
      { header: "Time", width: 40, cell: (l: Report23Payload["logs"][number]) => l.time ?? "" },
      { header: "Type", width: "*", cell: (l: Report23Payload["logs"][number]) => l.type ?? "" },
      { header: "Top (mKB)", width: 62, align: "right", cell: (l: Report23Payload["logs"][number]) => headerValue(l.topMkb) },
      { header: "Btm (mKB)", width: 62, align: "right", cell: (l: Report23Payload["logs"][number]) => headerValue(l.btmMkb) },
    ], p.logs),
    sectionBar("Perforations"),
    reportTable([
      { header: "Date", width: 62, cell: (x: Report23Payload["perforations"][number]) => x.date ?? "" },
      { header: "Zone", width: "*", cell: (x: Report23Payload["perforations"][number]) => x.zone ?? "" },
      { header: "Top (mKB)", width: 62, align: "right", cell: (x: Report23Payload["perforations"][number]) => headerValue(x.topMkb) },
      { header: "Btm (mKB)", width: 62, align: "right", cell: (x: Report23Payload["perforations"][number]) => headerValue(x.btmMkb) },
      { header: "Current Status", width: 66, cell: (x: Report23Payload["perforations"][number]) => x.status ?? "" },
    ], p.perforations),
    sectionBar("Stimulations & Treatments"),
    reportTable([
      { header: "Date", width: 62, cell: (x: Report23Payload["stimulations"][number]) => x.date ?? "" },
      { header: "Time", width: 40, cell: (x: Report23Payload["stimulations"][number]) => x.time ?? "" },
      { header: "Zone", width: "*", cell: (x: Report23Payload["stimulations"][number]) => x.zone ?? "" },
      { header: "Type", width: 62, cell: (x: Report23Payload["stimulations"][number]) => x.type ?? "" },
      { header: "Delivery Mode", width: 72, cell: (x: Report23Payload["stimulations"][number]) => x.deliveryMode ?? "" },
      { header: "Stim/Treat Company", width: 90, cell: (x: Report23Payload["stimulations"][number]) => x.company ?? "" },
    ], p.stimulations),
    {
      text: "The perforations and treatments listed are those done ON OR BEFORE this day.",
      style: "cellLabel", italics: true, margin: [0, 3, 0, 0],
    },
  );
  return doc(LETTER, "portrait", p.title, `Completion day for ${p.wellName}`, p.printedOn, content);
}

/* ══ 24 ══════════════════════════════════════════════════════════════════════ */

export async function buildReport24Doc(p: Report24Payload): Promise<TDocumentDefinitions> {
  return doc(LANDSCAPE_LETTER, "landscape", p.title, `Downhole profile for ${p.wellName}`, p.printedOn, [
    identityLine(p.wellName),
    labelValueGrid(p.header),
    labelValueGrid([p.completionHeader]),
    sectionBar(p.caption),
    ...(await schematicContent(p.schematic, "24", [560, 340])),
    sectionBar("Wellhead"),
    reportTable([
      { header: "Des", width: "*", cell: (w: Report24Payload["wellhead"][number]) => w.des ?? "" },
      { header: "Make", width: 76, cell: (w: Report24Payload["wellhead"][number]) => w.make ?? "" },
      { header: "Model", width: 76, cell: (w: Report24Payload["wellhead"][number]) => w.model ?? "" },
      { header: "SN", width: 76, cell: (w: Report24Payload["wellhead"][number]) => w.sn ?? "" },
      { header: "WP Top (psi)", width: 66, align: "right", cell: (w: Report24Payload["wellhead"][number]) => headerValue(w.wpTopPsi) },
    ], p.wellhead),
    sectionBar("Casing Strings"),
    reportTable([
      { header: "Csg Des", width: "*", cell: (c: Report24Payload["casingStrings"][number]) => c.description ?? "" },
      { header: "OD (in)", width: 50, cell: (c: Report24Payload["casingStrings"][number]) => c.odIn ?? "" },
      { header: "Wt/Len (kg/m)", width: 66, align: "right", cell: (c: Report24Payload["casingStrings"][number]) => headerValue(c.massPerLenKgM) },
      { header: "Grade", width: 44, cell: (c: Report24Payload["casingStrings"][number]) => c.grade ?? "" },
      { header: "Top Thread", width: 62, cell: (c: Report24Payload["casingStrings"][number]) => c.topThread ?? "" },
      { header: "Set Depth (mKB)", width: 76, align: "right", cell: (c: Report24Payload["casingStrings"][number]) => headerValue(c.setDepthMkb) },
    ], p.casingStrings),
    sectionBar("Perforations"),
    reportTable([
      { header: "Date", width: 66, cell: (x: Report24Payload["perforations"][number]) => x.date ?? "" },
      { header: "Top (mKB)", width: 70, align: "right", cell: (x: Report24Payload["perforations"][number]) => headerValue(x.topMkb) },
      { header: "Btm (mKB)", width: 70, align: "right", cell: (x: Report24Payload["perforations"][number]) => headerValue(x.btmMkb) },
      { header: "Zone", width: "*", cell: (x: Report24Payload["perforations"][number]) => x.zone ?? "" },
    ], p.perforations),
    sectionBar("Tubing Strings"),
    ...tubingContent(p.tubingStrings),
  ]);
}

/* ══ 25 ══════════════════════════════════════════════════════════════════════ */

const FAILURE_COLUMNS: ReportColumn<FailureCostCell>[] = [
  { header: "Well", width: "*", cell: (c) => c.well },
  { header: "Failure Type", width: 96, cell: (c) => c.failureType },
  { header: "Failures", width: 52, align: "right", cell: (c) => headerValue(c.count, "int") },
  { header: "Cost", width: 90, align: "right", cell: (c) => money(c.cost) },
];

export async function buildReport25Doc(p: Report25Payload): Promise<TDocumentDefinitions> {
  const content: Content[] = [
    sectionBar("Wells"),
    reportTable([
      { header: "Well Name", width: "*", cell: (w: Report25Payload["wells"][number]) => w.name },
      { header: "API Number", width: 110, cell: (w: Report25Payload["wells"][number]) => w.apiUwi ?? "" },
      { header: "Field Name", width: 80, cell: (w: Report25Payload["wells"][number]) => w.field ?? "" },
      { header: "State", width: 70, cell: (w: Report25Payload["wells"][number]) => w.stateProvince ?? "" },
    ], p.wells),
    sectionBar("Cost of Failure by Type"),
  ];
  if (p.wellTotals.length > 0) {
    const chart = await captureChart(FAILURE_CHART_ID, "failure-cost chart");
    content.push({ image: chart.raster.dataUrl, fit: [740, 300], alignment: "center", margin: [0, 3, 0, 0] });
    const key = legendRow(chart.legend);
    if (key) content.push(key);
  } else {
    content.push({
      text: "No equipment failure recorded on these wells.",
      style: "cellLabel", italics: true, margin: [0, 3, 0, 3],
    });
  }
  content.push(
    sectionBar("Failures, by well and type"),
    reportTable(FAILURE_COLUMNS, p.cells),
    labelValueGrid([p.totals]),
    {
      text: "An unclassified failure is its own bar, labelled “(blank)” as the sample labels it.",
      style: "cellLabel", italics: true, margin: [0, 3, 0, 0],
    },
  );
  return doc(LANDSCAPE_LETTER, "landscape", p.title, "Failure cost across the selected wells", p.printedOn, content);
}

/* ══ 26 ══════════════════════════════════════════════════════════════════════ */

export async function buildReport26Doc(p: Report26Payload): Promise<TDocumentDefinitions> {
  return doc(LANDSCAPE_LETTER, "landscape", p.title, `Perforations for ${p.wellName}`, p.printedOn, [
    identityLine(p.wellName),
    labelValueGrid(p.header),
    labelValueGrid([p.completionHeader]),
    sectionBar(p.caption),
    ...(await schematicContent(p.schematic, "26", [560, 340])),
    sectionBar("Perforations"),
    ...perforationContent(p.perforations),
    labelValueGrid([p.totals]),
  ]);
}

/* ══ 27 ══════════════════════════════════════════════════════════════════════ */

const PRODUCTION_COLUMNS: ReportColumn<ProductionRow>[] = [
  { header: "Start Date", width: 62, cell: (r) => r.startDate ?? "" },
  { header: "End Date", width: 62, cell: (r) => r.endDate ?? "" },
  { header: "Prod Time (days)", width: 56, align: "right", cell: (r) => headerValue(r.prodTimeDays) },
  { header: "DownTm (days)", width: 56, align: "right", cell: (r) => headerValue(r.downTimeDays) },
  { header: "Vol ResGas (MCF)", width: 66, align: "right", cell: (r) => headerValue(r.volResGasMcf) },
  { header: "Vol Oil (bbl)", width: 62, align: "right", cell: (r) => headerValue(r.volOilBbl) },
  { header: "Vol Water (bbl)", width: 66, align: "right", cell: (r) => headerValue(r.volWaterBbl) },
  { header: "Q Reservoir Gas (MCF/day)", width: 70, align: "right", cell: (r) => headerValue(r.qResGasMcfD) },
  { header: "Q Oil (bbl/day)", width: 62, align: "right", cell: (r) => headerValue(r.qOilBblD) },
  { header: "Q Water (bbl/day)", width: 66, align: "right", cell: (r) => headerValue(r.qWaterBblD) },
  { header: "Water Gas Ratio (%)", width: "*", align: "right", cell: (r) => headerValue(r.waterGasRatioPct) },
];

export async function buildReport27Doc(p: Report27Payload): Promise<TDocumentDefinitions> {
  const content: Content[] = [];
  if (p.filterLine) content.push({ text: p.filterLine, style: "cellValue", alignment: "right" });
  content.push(identityLine(p.wellName), labelValueGrid(p.header), sectionBar("Rate against time"));
  if (p.curve.length > 0) {
    const chart = await captureChart(PRODUCTION_CHART_ID, "production-rate curve");
    content.push({ image: chart.raster.dataUrl, fit: [740, 290], alignment: "center", margin: [0, 3, 0, 0] });
    const key = legendRow(chart.legend);
    if (key) content.push(key);
  } else {
    content.push({
      text: "No production period recorded.", style: "cellLabel", italics: true, margin: [0, 3, 0, 3],
    });
  }
  content.push(
    sectionBar("Summarized Production Data (Most Recent at Top)"),
    reportTable(PRODUCTION_COLUMNS, p.rows),
    labelValueGrid([p.totals]),
  );
  return doc(LANDSCAPE_LETTER, "landscape", p.title, `Production history for ${p.wellName}`, p.printedOn, content);
}

/* ══ 28 ══════════════════════════════════════════════════════════════════════ */

export async function buildReport28Doc(p: Report28Payload): Promise<TDocumentDefinitions> {
  const content: Content[] = [
    identityLine(p.wellName),
    labelValueGrid(p.header),
    labelValueGrid([p.completionHeader]),
    sectionBar("Most Recent Job"),
  ];
  content.push(p.mostRecentJob
    ? labelValueGrid([p.mostRecentJob])
    : { text: "No job on this well.", style: "cellLabel", italics: true, margin: [0, 2, 0, 3] });
  content.push(
    sectionBar([p.totalDepthLine, p.caption].filter(Boolean).join("   ·   ")),
    ...(await schematicContent(p.schematic, "28", [600, 380])),
  );
  return doc(LANDSCAPE_LETTER, "landscape", p.title, `Current schematic for ${p.wellName}`, p.printedOn, content);
}

/* ══ 29 ══════════════════════════════════════════════════════════════════════ */

export async function buildReport29Doc(p: Report29Payload): Promise<TDocumentDefinitions> {
  // Two pictures, side by side, each captured from its own element — the same
  // reason the preview draws two: they are different wells until TD.
  const proposed = await schematicContent(p.proposed, "29-proposed", [350, 340]);
  const actual = await schematicContent(p.actual, "29", [350, 340]);
  return doc(LANDSCAPE_LETTER, "landscape", p.title, `Proposed against actual for ${p.wellName}`, p.printedOn, [
    identityLine(p.wellName),
    labelValueGrid(p.header),
    sectionBar(p.caption),
    {
      columns: [
        { width: "*", stack: [sectionBar("Proposed"), ...proposed] },
        { width: "*", stack: [sectionBar("Actual"), ...actual] },
      ],
      columnGap: 10,
    },
    labelValueGrid([p.comparison]),
    {
      text: "The proposed side carries the prognosis and the plan's total depth, not a casing scheme: "
        + "this application does not store a designed casing programme.",
      style: "cellLabel", italics: true, margin: [0, 3, 0, 0],
    },
  ]);
}

/* ══ 30 ══════════════════════════════════════════════════════════════════════ */

export function buildReport30Doc(p: Report30Payload): TDocumentDefinitions {
  return doc(LANDSCAPE_LETTER, "landscape", p.title, `Well summary for ${p.wellName}`, p.printedOn, [
    identityLine(p.wellName),
    labelValueGrid(p.identity),
    labelValueGrid([p.elevations]),
    sectionBar("Directions To Well"),
    { text: p.directionsToWell ?? " ", style: "cellValue", margin: [3, 3, 3, 4] },
    sectionBar("Wellheads"),
    reportTable([
      { header: "Type", width: 110, cell: (w: Report30Payload["wellhead"][number]) => w.type ?? "" },
      { header: "Make", width: 90, cell: (w: Report30Payload["wellhead"][number]) => w.make ?? "" },
      { header: "WP (psi)", width: 66, align: "right", cell: (w: Report30Payload["wellhead"][number]) => headerValue(w.wpPsi) },
      { header: "Service", width: "*", cell: (w: Report30Payload["wellhead"][number]) => w.service ?? "" },
    ], p.wellhead),
    sectionBar("Wellbores"),
    reportTable([
      { header: "Wellbore Name", width: 120, cell: (w: Report30Payload["wellbores"][number]) => w.name ?? "" },
      { header: "Parent Wellbore", width: 100, cell: (w: Report30Payload["wellbores"][number]) => w.parent ?? "" },
      { header: "Profile", width: 90, cell: (w: Report30Payload["wellbores"][number]) => w.profile ?? "" },
      { header: "KO MD (mKB)", width: "*", align: "right", cell: (w: Report30Payload["wellbores"][number]) => headerValue(w.koMdMkb) },
    ], p.wellbores),
    sectionBar("Casing Strings"),
    reportTable([
      { header: "Csg Des", width: "*", cell: (c: Report30Payload["casingStrings"][number]) => c.description ?? "" },
      { header: "Run Date", width: 66, cell: (c: Report30Payload["casingStrings"][number]) => c.runDate ?? "" },
      { header: "OD (in)", width: 50, cell: (c: Report30Payload["casingStrings"][number]) => c.odIn ?? "" },
      { header: "ID (in)", width: 50, align: "right", cell: (c: Report30Payload["casingStrings"][number]) => headerValue(c.idIn, "in3") },
      { header: "Wt/Len (kg/m)", width: 66, align: "right", cell: (c: Report30Payload["casingStrings"][number]) => headerValue(c.massPerLenKgM) },
      { header: "Grade", width: 44, cell: (c: Report30Payload["casingStrings"][number]) => c.grade ?? "" },
      { header: "Set Depth (mKB)", width: 76, align: "right", cell: (c: Report30Payload["casingStrings"][number]) => headerValue(c.setDepthMkb) },
    ], p.casingStrings),
    sectionBar("Cement"),
    ...(p.cementJobs.length === 0
      ? [{ text: "No cement job recorded.", style: "cellLabel", italics: true, margin: [0, 2, 0, 3] } as Content]
      : p.cementJobs.flatMap((j) => [
        sectionBar(j.caption),
        labelValueGrid([j.stage]),
        reportTable([
          { header: "Fluid Description", width: "*", cell: (f: Report30Payload["cementJobs"][number]["fluids"][number]) => f.description ?? "" },
          { header: "Fluid Type", width: 76, cell: (f: Report30Payload["cementJobs"][number]["fluids"][number]) => f.type ?? "" },
          { header: "Amount (sacks)", width: 76, align: "right", cell: (f: Report30Payload["cementJobs"][number]["fluids"][number]) => headerValue(f.amountSacks) },
          { header: "Class", width: 50, cell: (f: Report30Payload["cementJobs"][number]["fluids"][number]) => f.cementClass ?? "" },
        ], j.fluids),
      ])),
    labelValueGrid([p.totals]),
  ]);
}

/* ── the download entry points ────────────────────────────────────────────── */

const dl = (name: string) => (payload: { wellName: string }) =>
  `${slug(payload.wellName)}_${name}.pdf`;

export async function exportReport22Pdf(p: Report22Payload) { pdfMake.createPdf(await buildReport22Doc(p)).download(dl("complete_well_summary")(p)); }
export async function exportReport23Pdf(p: Report23Payload) { pdfMake.createPdf(await buildReport23Doc(p)).download(dl("daily_completion_workover")(p)); }
export async function exportReport24Pdf(p: Report24Payload) { pdfMake.createPdf(await buildReport24Doc(p)).download(dl("downhole_well_profile")(p)); }
export async function exportReport25Pdf(p: Report25Payload) {
  const stamp = p.wells.length === 1 ? slug(p.wells[0].name) : `${p.wells.length}_wells`;
  pdfMake.createPdf(await buildReport25Doc(p)).download(`${stamp}_cost_of_failure_by_type.pdf`);
}
export async function exportReport26Pdf(p: Report26Payload) { pdfMake.createPdf(await buildReport26Doc(p)).download(dl("perforations")(p)); }
export async function exportReport27Pdf(p: Report27Payload) { pdfMake.createPdf(await buildReport27Doc(p)).download(dl("production_maintenance_history")(p)); }
export async function exportReport28Pdf(p: Report28Payload) { pdfMake.createPdf(await buildReport28Doc(p)).download(dl("schematic_current")(p)); }
export async function exportReport29Pdf(p: Report29Payload) { pdfMake.createPdf(await buildReport29Doc(p)).download(dl("schematic_proposed_vs_actual")(p)); }
export async function exportReport30Pdf(p: Report30Payload) { pdfMake.createPdf(buildReport30Doc(p)).download(dl("well_summary")(p)); }
