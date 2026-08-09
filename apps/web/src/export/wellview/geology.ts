/**
 * Reports 18 (Daily Geological), 19 (Formation Performance) and 20 (the
 * Geological Program), as generated PDFs.
 *
 * 18 is portrait letter like its sample — it is a day sheet, read top to bottom.
 * 19 and 20 are LANDSCAPE letter: 19's formation table carries ten columns and
 * 20's prognosis eleven, and on portrait both wrap into unreadability.
 *
 * The register is printed with a DIFFERENT column set on each, matching the
 * previews: 20 prints the prognosis alone, because its as-drilled columns are
 * empty by definition before a bit turns, and printing them would suggest the
 * programme had lost data rather than not yet acquired it.
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
import type {
  DrilledIntervalRow, FormationRow, GasShowRow, GeoLithologyRow, GeoLogRunRow,
  GeoMudCheckRow, GeoSampleRow, GeoTimeLogRow, OilShowRow,
  Report18Payload, Report19Payload, Report20Payload,
} from "../../entry/wellview.js";
import { FORMATION_PROFILE_ID } from "../../components/wellview/GeologyPreview.js";

const LETTER: [number, number] = [612, 792];
const LANDSCAPE_LETTER: [number, number] = [792, 612];

const slug = (s: string) => s.replace(/\W+/g, "_").replace(/^_+|_+$/g, "");

/* ── the register's three column sets ─────────────────────────────────────── */

const FORMATION_ALL: ReportColumn<FormationRow>[] = [
  { header: "Formation Name", width: "*", cell: (f) => f.name ?? "" },
  { header: "Element Type", width: 62, cell: (f) => f.elementType ?? "" },
  { header: "Lith Des", width: 56, cell: (f) => f.lithDes ?? "" },
  { header: "Prog Depth Top SS (m)", width: 62, align: "right", cell: (f) => headerValue(f.progDepthTopSs) },
  { header: "Prog Top TVD (mKB)", width: 62, align: "right", cell: (f) => headerValue(f.progTopTvd) },
  { header: "Drill Top MD (mKB)", width: 62, align: "right", cell: (f) => headerValue(f.drillTopMd) },
  { header: "Drill Top (TVD) (mKB)", width: 62, align: "right", cell: (f) => headerValue(f.drillTopTvd) },
];

const FORMATION_PERFORMANCE: ReportColumn<FormationRow>[] = [
  { header: "Formation Name", width: "*", cell: (f) => f.name ?? "" },
  { header: "Layer Name", width: 56, cell: (f) => f.layerName ?? "" },
  { header: "Drill Top MD (mKB)", width: 62, align: "right", cell: (f) => headerValue(f.drillTopMd) },
  { header: "Drill Btm MD (mKB)", width: 62, align: "right", cell: (f) => headerValue(f.drillBtmMd) },
  { header: "Final Top MD (mKB)", width: 62, align: "right", cell: (f) => headerValue(f.finalTopMd) },
  { header: "Final Btm MD (mKB)", width: 62, align: "right", cell: (f) => headerValue(f.finalBtmMd) },
  { header: "ROP (m/hr)", width: 50, align: "right", cell: (f) => headerValue(f.ropMHr) },
  { header: "P Frac (ppg)", width: 50, align: "right", cell: (f) => headerValue(f.pFracPpg) },
  { header: "P Pore (ppg)", width: 50, align: "right", cell: (f) => headerValue(f.pPorePpg) },
  { header: "T (°C)", width: 40, align: "right", cell: (f) => headerValue(f.temperatureC) },
];

const FORMATION_PROGNOSIS: ReportColumn<FormationRow>[] = [
  { header: "Formation Name", width: "*", cell: (f) => f.name ?? "" },
  { header: "Lith Des", width: 56, cell: (f) => f.lithDes ?? "" },
  { header: "Element Type", width: 56, cell: (f) => f.elementType ?? "" },
  { header: "Prog Depth Top SS (m)", width: 60, align: "right", cell: (f) => headerValue(f.progDepthTopSs) },
  { header: "Prog Top TVD (mKB)", width: 60, align: "right", cell: (f) => headerValue(f.progTopTvd) },
  { header: "Prog Depth Btm SS (m)", width: 60, align: "right", cell: (f) => headerValue(f.progDepthBtmSs) },
  { header: "Prog Btm TVD (mKB)", width: 60, align: "right", cell: (f) => headerValue(f.progBtmTvd) },
  { header: "P Pore (ppg)", width: 48, align: "right", cell: (f) => headerValue(f.pPorePpg) },
  { header: "P Frac (ppg)", width: 48, align: "right", cell: (f) => headerValue(f.pFracPpg) },
  { header: "T (°C)", width: 40, align: "right", cell: (f) => headerValue(f.temperatureC) },
  { header: "H2S Conc (%)", width: 48, align: "right", cell: (f) => headerValue(f.h2sConcPct) },
];

/* ══ report 18 ═══════════════════════════════════════════════════════════════ */

const TIME_LOG: ReportColumn<GeoTimeLogRow>[] = [
  { header: "Start Time", width: 44, cell: (t) => t.startTime ?? "" },
  { header: "End Time", width: 44, cell: (t) => t.endTime ?? "" },
  { header: "Dur (hr)", width: 38, align: "right", cell: (t) => headerValue(t.durHr) },
  { header: "Cum Dur (hr)", width: 44, align: "right", cell: (t) => headerValue(t.cumDurHr) },
  { header: "Code 1", width: 34, cell: (t) => t.code1 ?? "" },
  { header: "Code 2", width: 44, cell: (t) => t.code2 ?? "" },
  { header: "Com", width: "*", cell: (t) => t.com ?? "" },
];

const MUD_CHECKS: ReportColumn<GeoMudCheckRow>[] = [
  { header: "Type", width: "*", cell: (m) => m.type ?? "" },
  { header: "Time", width: 40, cell: (m) => m.time ?? "" },
  { header: "Depth (mKB)", width: 54, align: "right", cell: (m) => headerValue(m.depthMkb) },
  { header: "Dens (ppg)", width: 48, align: "right", cell: (m) => headerValue(m.densPpg) },
  { header: "PV OR (cp)", width: 48, align: "right", cell: (m) => headerValue(m.pvCp) },
  { header: "YP Calc", width: 48, align: "right", cell: (m) => headerValue(m.ypPa) },
  { header: "Filtrate (mL/30min)", width: 58, align: "right", cell: (m) => headerValue(m.filtrateMl) },
  { header: "pH", width: 34, align: "right", cell: (m) => headerValue(m.ph) },
];

const SAMPLES: ReportColumn<GeoSampleRow>[] = [
  { header: "Top (mKB)", width: 54, align: "right", cell: (r) => headerValue(r.topMkb) },
  { header: "Btm (mKB)", width: 54, align: "right", cell: (r) => headerValue(r.btmMkb) },
  { header: "Vol Ca (%)", width: 48, align: "right", cell: (r) => headerValue(r.volCaPct) },
  { header: "Vol Mg (%)", width: 48, align: "right", cell: (r) => headerValue(r.volMgPct) },
  { header: "Com", width: "*", cell: (r) => r.com ?? "" },
];

const LITHOLOGY: ReportColumn<GeoLithologyRow>[] = [
  { header: "Top (mKB)", width: 54, align: "right", cell: (r) => headerValue(r.topMkb) },
  { header: "Btm (mKB)", width: 54, align: "right", cell: (r) => headerValue(r.btmMkb) },
  { header: "Des", width: "*", cell: (r) => r.des ?? "" },
  { header: "Vol (%)", width: 44, align: "right", cell: (r) => headerValue(r.volPct) },
  { header: "Type", width: 62, cell: (r) => r.type ?? "" },
  { header: "Type Code", width: 48, cell: (r) => r.typeCode ?? "" },
];

const OIL_SHOWS: ReportColumn<OilShowRow>[] = [
  { header: "Top (mKB)", width: 54, align: "right", cell: (r) => headerValue(r.topMkb) },
  { header: "Btm (mKB)", width: 54, align: "right", cell: (r) => headerValue(r.btmMkb) },
  { header: "Show Quality", width: 70, cell: (r) => r.showQuality ?? "" },
  { header: "Show Origin", width: 70, cell: (r) => r.showOrigin ?? "" },
  { header: "Show Type", width: "*", cell: (r) => r.showType ?? "" },
];

const GAS_SHOWS: ReportColumn<GasShowRow>[] = [
  { header: "Top (mKB)", width: 54, align: "right", cell: (r) => headerValue(r.topMkb) },
  { header: "Btm (mKB)", width: 54, align: "right", cell: (r) => headerValue(r.btmMkb) },
  { header: "Show Type", width: "*", cell: (r) => r.showType ?? "" },
  { header: "Total Gas Avg (%)", width: 62, align: "right", cell: (r) => headerValue(r.totalGasAvgPct) },
  { header: "Total Gas Min (%)", width: 62, align: "right", cell: (r) => headerValue(r.totalGasMinPct) },
  { header: "Total Gas Max (%)", width: 62, align: "right", cell: (r) => headerValue(r.totalGasMaxPct) },
];

const LOG_RUNS: ReportColumn<GeoLogRunRow>[] = [
  { header: "Time", width: 40, cell: (r) => r.time ?? "" },
  { header: "Run #", width: 36, cell: (r) => r.runNo ?? "" },
  { header: "Type", width: 90, cell: (r) => r.type ?? "" },
  { header: "Top (mKB)", width: 54, align: "right", cell: (r) => headerValue(r.topMkb) },
  { header: "Btm (mKB)", width: 54, align: "right", cell: (r) => headerValue(r.btmMkb) },
  { header: "Logging Company", width: "*", cell: (r) => r.loggingCompany ?? "" },
];

export function buildReport18Doc(payload: Report18Payload): TDocumentDefinitions {
  const content: Content[] = [];
  if (payload.identityRight) {
    content.push({ text: payload.identityRight, style: "cellValue", alignment: "right" });
  }
  content.push(identityLine(payload.wellName));
  if (payload.depthLine) {
    content.push({ text: payload.depthLine, style: "cellValue", alignment: "right", margin: [0, 0, 0, 2] });
  }
  content.push(
    labelValueGrid(payload.header),
    sectionBar("Daily Summary"),
    labelValueGrid([payload.dailySummary]),
    labelValueGrid(payload.gas),
    labelValueGrid(payload.narrative),
    sectionBar("Time Log"),
    reportTable(TIME_LOG, payload.timeLog),
    sectionBar("Mud Checks"),
    reportTable(MUD_CHECKS, payload.mudChecks),
  );
  if (payload.mudCheckLimitation) {
    content.push({
      text: "A day holds one mud check in this application; where a rig runs a morning and an "
        + "evening check, only the recorded one appears.",
      style: "cellLabel", italics: true, margin: [0, 2, 0, 2],
    });
  }
  for (const b of payload.bhaBlocks) {
    content.push(
      sectionBar(b.caption),
      labelValueGrid([b.header]),
      reportTable([
        { header: "End Depth (mKB)", width: 56, align: "right", cell: (r: typeof b.intervals[number]) => headerValue(r.endDepthMkb) },
        { header: "TVD End (mKB)", width: 56, align: "right", cell: (r: typeof b.intervals[number]) => headerValue(r.tvdEndMkb) },
        { header: "Cum Depth (m)", width: 56, align: "right", cell: (r: typeof b.intervals[number]) => headerValue(r.cumDepthM) },
        { header: "Cum Drill Time (hr)", width: 62, align: "right", cell: (r: typeof b.intervals[number]) => headerValue(r.cumDrillTimeHr) },
        { header: "Int ROP (m/hr)", width: 54, align: "right", cell: (r: typeof b.intervals[number]) => headerValue(r.intRopMHr) },
        { header: "RPM (rpm)", width: 48, align: "right", cell: (r: typeof b.intervals[number]) => headerValue(r.rpm) },
        { header: "WOB (1000lbf)", width: 54, align: "right", cell: (r: typeof b.intervals[number]) => headerValue(r.wob1000Lbf) },
        { header: "Wellbore", width: "*", cell: (r: typeof b.intervals[number]) => r.wellbore ?? "" },
      ], b.intervals),
    );
  }
  content.push(
    sectionBar("All Formations"),
    reportTable(FORMATION_ALL, payload.formations),
    sectionBar("Sample Descriptions"),
    reportTable(SAMPLES, payload.sampleDescriptions),
    sectionBar("Lithology"),
    reportTable(LITHOLOGY, payload.lithology),
    sectionBar("Oil Shows"),
    reportTable(OIL_SHOWS, payload.oilShows),
    sectionBar("Gas Shows"),
    reportTable(GAS_SHOWS, payload.gasShows),
    sectionBar("Logs"),
    reportTable(LOG_RUNS, payload.logRuns),
  );

  return {
    pageSize: { width: LETTER[0], height: LETTER[1] },
    pageOrientation: "portrait",
    pageMargins: PAGE_MARGINS,
    info: { title: `${payload.title} — ${payload.wellName}`, subject: `Daily geological for ${payload.wellName}` },
    background: () => pageFrame(LETTER),
    header: () => titleBand(payload.title),
    footer: reportFooter(payload.printedOn),
    content,
    styles: { ...REPORT_STYLES },
    defaultStyle: { font: "Roboto", fontSize: 6.4 },
  };
}

export async function exportReport18Pdf(payload: Report18Payload): Promise<void> {
  pdfMake.createPdf(buildReport18Doc(payload))
    .download(`${slug(payload.wellName)}_daily_geological.pdf`);
}

/* ══ report 19 ═══════════════════════════════════════════════════════════════ */

const INTERVALS: ReportColumn<DrilledIntervalRow>[] = [
  { header: "Start (mKB)", width: 62, align: "right", cell: (r) => headerValue(r.startMkb) },
  { header: "End Depth (mKB)", width: 66, align: "right", cell: (r) => headerValue(r.endDepthMkb) },
  { header: "Int Depth (m)", width: 62, align: "right", cell: (r) => headerValue(r.intDepthM) },
  { header: "Drill Time (hr)", width: 62, align: "right", cell: (r) => headerValue(r.drillTimeHr) },
  { header: "Int ROP (m/hr)", width: 62, align: "right", cell: (r) => headerValue(r.intRopMHr) },
  { header: "Date", width: "*", cell: (r) => r.date },
];

export async function buildReport19Doc(payload: Report19Payload): Promise<TDocumentDefinitions> {
  const content: Content[] = [identityLine(payload.wellName)];

  for (const b of payload.wellboreBlocks) {
    content.push(
      sectionBar(b.caption),
      labelValueGrid([b.header]),
      sectionBar("Drilling Parameters"),
      reportTable(INTERVALS, b.intervals),
    );
  }
  content.push(
    sectionBar("Formations"),
    reportTable(FORMATION_PERFORMANCE, payload.formations),
  );

  // Captured only when the preview drew one — a well whose formations carry no
  // rate has no profile, and demanding an SVG would fail the export over it.
  if (payload.profile.length > 0) {
    const chart = await captureChart(FORMATION_PROFILE_ID, "ROP-against-depth profile");
    content.push(
      sectionBar("ROP against depth"),
      { image: chart.raster.dataUrl, fit: [700, 320], alignment: "center", margin: [0, 3, 0, 0] },
    );
    const key = legendRow(chart.legend);
    if (key) content.push(key);
  }
  content.push(labelValueGrid([payload.totals]));

  return {
    pageSize: { width: LANDSCAPE_LETTER[0], height: LANDSCAPE_LETTER[1] },
    pageOrientation: "landscape",
    pageMargins: PAGE_MARGINS,
    info: { title: `${payload.title} — ${payload.wellName}`, subject: `Formation performance for ${payload.wellName}` },
    background: () => pageFrame(LANDSCAPE_LETTER),
    header: () => titleBand(payload.title),
    footer: reportFooter(payload.printedOn),
    content,
    styles: { ...REPORT_STYLES },
    defaultStyle: { font: "Roboto", fontSize: 6.6 },
  };
}

export async function exportReport19Pdf(payload: Report19Payload): Promise<void> {
  pdfMake.createPdf(await buildReport19Doc(payload))
    .download(`${slug(payload.wellName)}_formation_performance.pdf`);
}

/* ══ report 20 ═══════════════════════════════════════════════════════════════ */

export function buildReport20Doc(payload: Report20Payload): TDocumentDefinitions {
  const content: Content[] = [
    identityLine(payload.wellName),
    labelValueGrid(payload.header),
    sectionBar("Wellbores"),
    reportTable([
      { header: "Wellbore Name", width: 110, cell: (w: typeof payload.wellbores[number]) => w.name ?? "" },
      { header: "Profile Type", width: 90, cell: (w: typeof payload.wellbores[number]) => w.profileType ?? "" },
      { header: "Parent Wellbore", width: 90, cell: (w: typeof payload.wellbores[number]) => w.parentWellbore ?? "" },
      { header: "Proposed Deviation Survey", width: "*", cell: (w: typeof payload.wellbores[number]) => w.proposedSurvey ?? "" },
    ], payload.wellbores),
    sectionBar("Formations"),
    reportTable(FORMATION_PROGNOSIS, payload.formations),
    sectionBar("Jobs"),
    ...(payload.jobs.length ? [labelValueGrid(payload.jobs)] : [{
      text: "No job on this well.", style: "cellLabel", italics: true, margin: [0, 2, 0, 3],
    } as Content]),
    sectionBar("Geological Objective"),
    {
      text: payload.geologicalObjective ?? " ",
      style: "cellValue", margin: [3, 3, 3, 4],
    },
    sectionBar("Geological Sampling Requirements"),
    reportTable([
      { header: "Top Des", width: 84, cell: (r: typeof payload.samplingRequirements[number]) => r.topDes ?? "" },
      { header: "Top (mKB)", width: 56, align: "right", cell: (r: typeof payload.samplingRequirements[number]) => headerValue(r.topMkb) },
      { header: "Btm Des", width: 84, cell: (r: typeof payload.samplingRequirements[number]) => r.btmDes ?? "" },
      { header: "Btm (mKB)", width: 56, align: "right", cell: (r: typeof payload.samplingRequirements[number]) => headerValue(r.btmMkb) },
      { header: "Wellbore", width: 80, cell: (r: typeof payload.samplingRequirements[number]) => r.wellbore ?? "" },
      { header: "Rqd By", width: 84, cell: (r: typeof payload.samplingRequirements[number]) => r.rqdBy ?? "" },
      { header: "Sampled By", width: 84, cell: (r: typeof payload.samplingRequirements[number]) => r.sampledBy ?? "" },
      { header: "Com", width: "*", cell: (r: typeof payload.samplingRequirements[number]) => r.com ?? "" },
    ], payload.samplingRequirements),
    sectionBar("Job Contacts"),
    reportTable([
      { header: "Company", width: 90, cell: (c: typeof payload.contacts[number]) => c.company ?? "" },
      { header: "Contact Name", width: 84, cell: (c: typeof payload.contacts[number]) => c.contactName ?? "" },
      { header: "Title", width: 100, cell: (c: typeof payload.contacts[number]) => c.title ?? "" },
      { header: "Mobile", width: 76, cell: (c: typeof payload.contacts[number]) => c.mobile ?? "" },
      { header: "E-mail", width: 120, cell: (c: typeof payload.contacts[number]) => c.email ?? "" },
      { header: "Note", width: "*", cell: (c: typeof payload.contacts[number]) => c.note ?? "" },
    ], payload.contacts),
  ];

  return {
    pageSize: { width: LANDSCAPE_LETTER[0], height: LANDSCAPE_LETTER[1] },
    pageOrientation: "landscape",
    pageMargins: PAGE_MARGINS,
    info: { title: `${payload.title} — ${payload.wellName}`, subject: `Geological program for ${payload.wellName}` },
    background: () => pageFrame(LANDSCAPE_LETTER),
    header: () => titleBand(payload.title),
    footer: reportFooter(payload.printedOn),
    content,
    styles: { ...REPORT_STYLES },
    defaultStyle: { font: "Roboto", fontSize: 6.6 },
  };
}

export async function exportReport20Pdf(payload: Report20Payload): Promise<void> {
  pdfMake.createPdf(buildReport20Doc(payload))
    .download(`${slug(payload.wellName)}_geological_program.pdf`);
}
