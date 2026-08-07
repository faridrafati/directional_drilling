/**
 * Reports 06 (Daily Drilling) and 07 (Detail), as generated PDFs.
 *
 * One builder for both, from the same server payload the preview renders and
 * through the shared chrome in `../reportChrome.ts` — so nothing can be true on
 * screen and different on the page. `payload.detail` switches 07 on.
 *
 * Page size follows the samples: 06 is portrait letter, 07 is portrait LEGAL
 * (612 × 1008 pt), which is what its extra columns need. Both keep the sample's
 * two-column body — wide left, narrow sidebar — as a pdfmake `columns` node.
 */
import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import { pdfMake } from "../pdfmakeSetup.js";
import {
  PAGE_MARGINS, REPORT_STYLES,
  headerValue, identityLine, labelValueGrid, money, pageFrame,
  reportFooter, reportTable, sectionBar, titleBand,
  type ReportColumn,
} from "../reportChrome.js";
import type {
  DailyPayload, DrillingParamRow, TimeLogRow,
} from "../../entry/wellview.js";

/** Portrait letter for 06; portrait legal for 07 — as the samples are. */
const LETTER: [number, number] = [612, 792];
const LEGAL: [number, number] = [612, 1008];

const TIME_LOG_06: ReportColumn<TimeLogRow>[] = [
  { header: "Start Time", width: 34, cell: (r) => r.startTime ?? "" },
  { header: "End Time", width: 34, cell: (r) => r.endTime ?? "" },
  { header: "Dur (hr)", width: 28, align: "right", cell: (r) => headerValue(r.durHr) },
  { header: "Cum Dur (hr)", width: 32, align: "right", cell: (r) => headerValue(r.cumDurHr) },
  { header: "Code 1", width: 26, cell: (r) => r.code1 ?? "" },
  { header: "Code 2", width: 34, cell: (r) => r.code2 ?? "" },
  { header: "Com", width: "*", cell: (r) => r.com ?? "" },
];

const TIME_LOG_07: ReportColumn<TimeLogRow>[] = [
  { header: "Start Time", width: 30, cell: (r) => r.startTime ?? "" },
  { header: "Dur (hr)", width: 24, align: "right", cell: (r) => headerValue(r.durHr) },
  { header: "Cum Dur (hr)", width: 28, align: "right", cell: (r) => headerValue(r.cumDurHr) },
  { header: "End Time", width: 30, cell: (r) => r.endTime ?? "" },
  { header: "Code 1", width: 24, cell: (r) => r.code1 ?? "" },
  { header: "Code 2", width: 30, cell: (r) => r.code2 ?? "" },
  { header: "Problem ?", width: 24, cell: (r) => (r.isProblem ? "Yes" : "") },
  { header: "Prob Hrs (hr)", width: 26, align: "right", cell: (r) => headerValue(r.probHr) },
  { header: "Prob Ref #", width: 24, align: "right", cell: (r) => headerValue(r.probRef, "int") },
  { header: "Com", width: "*", cell: (r) => r.com ?? "" },
];

const paramColumns = (detail: boolean): ReportColumn<DrillingParamRow>[] => {
  const base: ReportColumn<DrillingParamRow>[] = [
    { header: "Wellbore", width: "*", cell: (r) => r.wellbore ?? "" },
    { header: "Start (mKB)", width: 40, align: "right", cell: (r) => headerValue(r.startMkb) },
    { header: "End Depth (mKB)", width: 40, align: "right", cell: (r) => headerValue(r.endDepthMkb) },
    { header: "Cum Depth (m)", width: 40, align: "right", cell: (r) => headerValue(r.cumDepthM) },
    { header: "Cum Drill Time (hr)", width: 38, align: "right", cell: (r) => headerValue(r.cumDrillTimeHr) },
    { header: "Int ROP (m/hr)", width: 38, align: "right", cell: (r) => headerValue(r.intRopMHr) },
    { header: "Q Flow (gpm)", width: 36, align: "right", cell: (r) => headerValue(r.qFlowGpm) },
    { header: "WOB (1000lbf)", width: 36, align: "right", cell: (r) => headerValue(r.wob1000Lbf) },
    { header: "RPM (rpm)", width: 32, align: "right", cell: (r) => headerValue(r.rpm) },
    { header: "SPP (psi)", width: 34, align: "right", cell: (r) => headerValue(r.sppPsi) },
    { header: "Drill Str Wt (1000lbf)", width: 38, align: "right", cell: (r) => headerValue(r.drillStrWtKlbf) },
    { header: "PU Str Wt (1000lbf)", width: 38, align: "right", cell: (r) => headerValue(r.puStrWtKlbf) },
    { header: "Drill Tq", width: 32, align: "right", cell: (r) => headerValue(r.drillTq) },
  ];
  if (!detail) return base;
  return [
    ...base,
    { header: "SO Str Wt (1000lbf)", width: 38, align: "right", cell: (r) => headerValue(r.soStrWtKlbf) },
    { header: "Off Bottom Torque", width: 38, align: "right", cell: (r) => headerValue(r.offBottomTorque) },
  ];
};

/** A labelled free-text row, e.g. the string's component list. */
function labelledText(label: string, text: string | null): Content {
  return {
    table: {
      widths: ["*"],
      body: [[{ text: label, style: "cellLabel" }], [{ text: text ?? "", style: "cellValue" }]],
    },
    layout: {
      hLineWidth: () => 0.5, vLineWidth: () => 0.5,
      hLineColor: () => "#9ca3af", vLineColor: () => "#9ca3af",
      paddingTop: () => 1, paddingBottom: () => 1, paddingLeft: () => 3, paddingRight: () => 3,
    },
    margin: [0, 0, 0, 4],
  };
}

/** The sample's block caption — a grey strip above a label/value grid. */
function blockCaption(text: string): Content {
  return {
    table: { widths: ["*"], body: [[{ text, style: "tableHeader" }]] },
    layout: {
      hLineWidth: () => 0.5, vLineWidth: () => 0.5,
      hLineColor: () => "#9ca3af", vLineColor: () => "#9ca3af",
      fillColor: () => "#f3f4f6",
      paddingTop: () => 1.5, paddingBottom: () => 1.5, paddingLeft: () => 3, paddingRight: () => 3,
    },
  };
}

export function buildDailyDoc(payload: DailyPayload): TDocumentDefinitions {
  const d = payload.detail;
  const page = d ? LEGAL : LETTER;

  // The left column carries the log and the tables; the sidebar carries the
  // reference blocks. Same split as the sample, and the same reason: the log is
  // the only part that wants the page width.
  const left: Content[] = [
    sectionBar(payload.timeLogTotalHr !== null
      ? `Time Log — ${headerValue(payload.timeLogTotalHr)} hr of 24`
      : "Time Log"),
    reportTable(d ? TIME_LOG_07 : TIME_LOG_06, payload.timeLog),
    sectionBar("Mud Checks"),
    ...payload.mudChecks.flatMap((c): Content[] => [blockCaption(c.caption), labelValueGrid(c.fields)]),
    sectionBar("Drill Strings"),
    ...payload.drillStrings.flatMap((s): Content[] => [
      blockCaption(s.caption),
      labelValueGrid([s.fields]),
      ...(d
        ? [
          blockCaption("Drill String Components"),
          reportTable([
            { header: "Item Des", width: "*", cell: (c: typeof s.tally[number]) => c.itemDes ?? "" },
            { header: "Jts", width: 24, align: "right", cell: (c: typeof s.tally[number]) => headerValue(c.jts, "int") },
            { header: "OD (in)", width: 34, align: "right", cell: (c: typeof s.tally[number]) => headerValue(c.odIn) },
            { header: "ID (in)", width: 34, align: "right", cell: (c: typeof s.tally[number]) => headerValue(c.idIn) },
            { header: "Len (m)", width: 40, align: "right", cell: (c: typeof s.tally[number]) => headerValue(c.lenM) },
            { header: "Top Thread", width: 44, cell: (c: typeof s.tally[number]) => c.topThread ?? "" },
          ], s.tally),
        ]
        : [labelledText("String Components", s.components)]),
      labelledText("Comment", s.comment),
    ]),
    sectionBar("Drilling Parameters"),
    reportTable(paramColumns(!!d), payload.drillingParameters),
  ];

  if (d) {
    left.push(
      sectionBar("Drilling Mud Volumes"),
      reportTable([
        { header: "Action", width: "*", cell: (v: typeof d.mudVolumes[number]) => v.action ?? "" },
        { header: "To well (bbl)", width: 48, align: "right", cell: (v: typeof d.mudVolumes[number]) => headerValue(v.toWellBbl) },
        { header: "From well (bbl)", width: 48, align: "right", cell: (v: typeof d.mudVolumes[number]) => headerValue(v.fromWellBbl) },
        { header: "Cum to Well (bbl)", width: 48, align: "right", cell: (v: typeof d.mudVolumes[number]) => headerValue(v.cumToWellBbl) },
        { header: "Cum from Well (bbl)", width: 48, align: "right", cell: (v: typeof d.mudVolumes[number]) => headerValue(v.cumFromWellBbl) },
      ], d.mudVolumes),
      sectionBar("Hydraulic Calculations"),
      labelValueGrid(d.hydraulics),
      sectionBar("Kicks"),
      reportTable([
        { header: "Kick Date", width: 48, cell: (k: typeof d.kicks[number]) => k.kickDate ?? "" },
        { header: "Kick Depth (mKB)", width: 48, align: "right", cell: (k: typeof d.kicks[number]) => headerValue(k.kickDepthMkb) },
        { header: "Control Date", width: 48, cell: (k: typeof d.kicks[number]) => k.controlDate ?? "" },
        { header: "Control Depth (mKB)", width: 48, align: "right", cell: (k: typeof d.kicks[number]) => headerValue(k.controlDepthMkb) },
        { header: "Kick Class", width: 40, cell: (k: typeof d.kicks[number]) => k.kickClass ?? "" },
        { header: "Kill Notes", width: "*", cell: (k: typeof d.kicks[number]) => k.killNotes ?? "" },
      ], d.kicks),
      sectionBar("Lost Circulation"),
      reportTable([
        { header: "Start Date", width: 48, cell: (l: typeof d.lostCirculation[number]) => l.startDate ?? "" },
        { header: "Top Depth (mKB)", width: 48, align: "right", cell: (l: typeof d.lostCirculation[number]) => headerValue(l.topDepthMkb) },
        { header: "Bottom Depth (mKB)", width: 48, align: "right", cell: (l: typeof d.lostCirculation[number]) => headerValue(l.bottomDepthMkb) },
        { header: "Ops In Prog", width: "*", cell: (l: typeof d.lostCirculation[number]) => l.opsInProg ?? "" },
        { header: "Vol Lost Tot (bbl)", width: 48, align: "right", cell: (l: typeof d.lostCirculation[number]) => headerValue(l.volLostTotBbl) },
        { header: "End Date", width: 48, cell: (l: typeof d.lostCirculation[number]) => l.endDate ?? "" },
      ], d.lostCirculation),
    );
  }

  const side: Content[] = [];
  if (d) side.push(sectionBar("Counters"), labelValueGrid(d.counters));
  side.push(
    sectionBar("Daily Contacts"),
    reportTable([
      { header: "Job Contact", width: "*", cell: (c: typeof payload.contacts[number]) => c.jobContact ?? "" },
      { header: "Mobile", width: 60, cell: (c: typeof payload.contacts[number]) => c.mobile ?? "" },
    ], payload.contacts),
  );
  if (d) {
    side.push(
      sectionBar("Personnel Log"),
      reportTable([
        { header: "Type", width: "*", cell: (p: typeof d.personnelLog[number]) => p.type ?? "" },
        { header: "Count", width: 30, align: "right", cell: (p: typeof d.personnelLog[number]) => headerValue(p.count, "int") },
        { header: "Tot Work Time (hr)", width: 42, align: "right", cell: (p: typeof d.personnelLog[number]) => headerValue(p.totWorkTimeHr) },
      ], d.personnelLog),
      sectionBar("Safety Check Summary"),
      reportTable([
        { header: "Type", width: "*", cell: (s: typeof d.safetyCheckSummary[number]) => s.type },
        { header: "Last Date", width: 48, cell: (s: typeof d.safetyCheckSummary[number]) => s.lastDate ?? "" },
        { header: "Next Date", width: 48, cell: (s: typeof d.safetyCheckSummary[number]) => s.nextDate ?? "" },
      ], d.safetyCheckSummary),
    );
  }
  side.push(
    sectionBar("Rigs"),
    labelValueGrid(payload.rigs),
    sectionBar(d ? "Mud Pumps" : "Pumps"),
    ...payload.pumps.flatMap((p): Content[] => [blockCaption(p.caption), labelValueGrid(p.fields)]),
    sectionBar("Mud Additive Amounts"),
    reportTable([
      { header: "Des", width: "*", cell: (a: typeof payload.mudAdditives[number]) => a.des ?? "" },
      { header: "Field Est (Cost/unit)", width: 48, align: "right", cell: (a: typeof payload.mudAdditives[number]) => money(a.fieldEstPerUnit) },
      { header: "Consumed", width: 40, align: "right", cell: (a: typeof payload.mudAdditives[number]) => headerValue(a.consumed) },
    ], payload.mudAdditives),
  );
  if (!d) {
    side.push(
      sectionBar("Safety Checks"),
      reportTable([
        { header: "Time", width: 28, cell: (s: typeof payload.safetyChecks[number]) => s.time ?? "" },
        { header: "Type", width: 52, cell: (s: typeof payload.safetyChecks[number]) => s.type ?? "" },
        { header: "Des", width: "*", cell: (s: typeof payload.safetyChecks[number]) => s.des ?? "" },
      ], payload.safetyChecks),
      sectionBar("Wellbores"),
      reportTable([
        { header: "Wellbore Name", width: "*", cell: (w: typeof payload.wellbores[number]) => w.name ?? "" },
        { header: "KO MD (mKB)", width: 48, align: "right", cell: (w: typeof payload.wellbores[number]) => headerValue(w.koMdMkb) },
      ], payload.wellbores),
    );
  } else {
    side.push(
      sectionBar("Survey Data"),
      reportTable([
        { header: "MD (mKB)", width: "*", align: "right", cell: (s: typeof d.surveys[number]) => headerValue(s.mdMkb) },
        { header: "Incl (°)", width: 34, align: "right", cell: (s: typeof d.surveys[number]) => headerValue(s.inc) },
        { header: "Azm (°)", width: 34, align: "right", cell: (s: typeof d.surveys[number]) => headerValue(s.azm) },
        { header: "TVD (mKB)", width: 44, align: "right", cell: (s: typeof d.surveys[number]) => headerValue(s.tvdMkb) },
      ], d.surveys),
      sectionBar("Last 5 Formations"),
      reportTable([
        { header: "Formation Name", width: "*", cell: (f: typeof d.lastFormations[number]) => f.name ?? "" },
        { header: "Prog Top MD (mKB)", width: 48, align: "right", cell: (f: typeof d.lastFormations[number]) => headerValue(f.progTopMd) },
        { header: "Drill Top MD (mKB)", width: 48, align: "right", cell: (f: typeof d.lastFormations[number]) => headerValue(f.drillTopMd) },
      ], d.lastFormations),
      sectionBar("Last Casing String"),
      reportTable([
        { header: "Casing Description", width: "*", cell: (c: typeof d.lastCasing[number]) => c.description ?? "" },
        { header: "Run Date", width: 48, cell: (c: typeof d.lastCasing[number]) => c.runDate ?? "" },
        { header: "Set Depth (mKB)", width: 48, align: "right", cell: (c: typeof d.lastCasing[number]) => headerValue(c.setDepthMkb) },
      ], d.lastCasing),
    );
  }

  const content: Content[] = [
    identityLine(payload.wellName),
    labelValueGrid([payload.titleFields]),
    labelValueGrid(payload.header),
    labelValueGrid(payload.operations),
    { columns: [{ width: "*", stack: left }, { width: d ? 210 : 190, stack: side }], columnGap: 6 },
  ];

  if (d) {
    // Page 2, exactly as the sample splits it.
    content.push(
      { text: "", pageBreak: "before" },
      sectionBar("Interval Problems"),
      reportTable([
        { header: "Problem Type", width: 70, cell: (p: typeof d.problems[number]) => p.problemType ?? "" },
        { header: "Problem Sub Type", width: 62, cell: (p: typeof d.problems[number]) => p.problemSubType ?? "" },
        { header: "Start Date", width: 48, cell: (p: typeof d.problems[number]) => p.startDate ?? "" },
        { header: "Start Depth (mKB)", width: 50, align: "right", cell: (p: typeof d.problems[number]) => headerValue(p.startDepthMkb) },
        { header: "End Depth (mKB)", width: 50, align: "right", cell: (p: typeof d.problems[number]) => headerValue(p.endDepthMkb) },
        { header: "Accountable Party", width: 62, cell: (p: typeof d.problems[number]) => p.accountableParty ?? "" },
        { header: "Est Cost (Cost)", width: 52, align: "right", cell: (p: typeof d.problems[number]) => money(p.estCost) },
        { header: "Est Lost Time (hr)", width: 44, align: "right", cell: (p: typeof d.problems[number]) => headerValue(p.estLostTimeHr) },
        { header: "Comment", width: "*", cell: (p: typeof d.problems[number]) => p.comment ?? "" },
      ], d.problems),
      sectionBar("Interval Lessons"),
      reportTable([
        { header: "Lesson Type", width: 62, cell: (l: typeof d.lessons[number]) => l.lessonType ?? "" },
        { header: "Start Date", width: 48, cell: (l: typeof d.lessons[number]) => l.startDate ?? "" },
        { header: "End Date", width: 48, cell: (l: typeof d.lessons[number]) => l.endDate ?? "" },
        { header: "Start Depth (mKB)", width: 50, align: "right", cell: (l: typeof d.lessons[number]) => headerValue(l.startDepthMkb) },
        { header: "End Depth (mKB)", width: 50, align: "right", cell: (l: typeof d.lessons[number]) => headerValue(l.endDepthMkb) },
        { header: "Est Cost Saving (Cost)", width: 56, align: "right", cell: (l: typeof d.lessons[number]) => money(l.estCostSaving) },
        { header: "Est Time Saving (hr)", width: 46, align: "right", cell: (l: typeof d.lessons[number]) => headerValue(l.estTimeSavingHr) },
        { header: "Comment", width: "*", cell: (l: typeof d.lessons[number]) => l.comment ?? "" },
      ], d.lessons),
      sectionBar("Safety Incidents"),
      reportTable([
        { header: "Time", width: 34, cell: (s: typeof d.incidents[number]) => s.time ?? "" },
        { header: "Category", width: 56, cell: (s: typeof d.incidents[number]) => s.category ?? "" },
        { header: "Type", width: 56, cell: (s: typeof d.incidents[number]) => s.type ?? "" },
        { header: "SubTyp", width: 56, cell: (s: typeof d.incidents[number]) => s.subType ?? "" },
        { header: "Cause", width: "*", cell: (s: typeof d.incidents[number]) => s.cause ?? "" },
        { header: "Lost time?", width: 40, cell: (s: typeof d.incidents[number]) => (s.lostTime === null ? "" : s.lostTime ? "Yes" : "No") },
        { header: "Severity", width: 46, cell: (s: typeof d.incidents[number]) => s.severity ?? "" },
      ], d.incidents),
    );
  }

  return {
    pageSize: { width: page[0], height: page[1] },
    pageOrientation: "portrait",
    pageMargins: PAGE_MARGINS,
    info: {
      title: `${payload.title} — ${payload.wellName}`,
      subject: `Daily drilling report for ${payload.wellName}`,
    },
    background: () => pageFrame(page),
    header: () => titleBand(payload.title),
    footer: reportFooter(payload.printedOn),
    content,
    styles: { ...REPORT_STYLES },
    defaultStyle: { font: "Roboto", fontSize: 6.6 },
  };
}

/** `WELL_DATE_daily_drilling.pdf`, with anything non-word collapsed. */
function fileName(payload: DailyPayload): string {
  const slug = (s: string) => s.replace(/\W+/g, "_").replace(/^_+|_+$/g, "");
  const date = payload.titleFields.find((c) => /Report/.test(c.label))?.value ?? "";
  return `${[slug(payload.wellName), slug(String(date)), payload.type === "07" ? "daily_drilling_detail" : "daily_drilling"]
    .filter(Boolean).join("_")}.pdf`;
}

export async function exportDailyPdf(payload: DailyPayload): Promise<void> {
  pdfMake.createPdf(buildDailyDoc(payload)).download(fileName(payload));
}
