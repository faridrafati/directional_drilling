/**
 * The fillable daily drilling report — the rig-side twin of DrReportForm.tsx.
 *
 * The office's read-only view puts the whole DR.xls sheet on one page. For DATA
 * ENTRY that is a wall of inputs, so each part of the sheet is its own subform,
 * picked from the strip of tabs: Well / Operations · Bit runs · Drilling
 * parameters (a.json per-interval WOB/RPM/flow/SPP) · Drill strings (a.json
 * drill_string: a header per BHA + its components) ·
 * Drill string & tools · Mud properties · Solid control · Chemicals ·
 * Casing · Formation tops · Surveys · Time breakdown · Operations log · Summary ·
 * Crew & companies · HSE & bulk · Wellhead & SCR · FIT/LOT · Marine & vessels.
 *
 * All subforms share ONE draft object, so switching between them never loses
 * anything typed, and Save posts the complete sheet in a single PUT (the API
 * replaces the child rows wholesale, which keeps a save atomic and idempotent).
 * Each tab shows how many entries it holds, so the company man can see at a
 * glance what is still empty before submitting.
 *
 * The well-level band (field, rig, spud date, RTE…) stays above the tabs on
 * every subform: it is read-only context from the well record an admin
 * registered, typed once rather than every day.
 *
 * NOTE: every subform below is a module-level component. Declaring one inside
 * ReportEditor would create a new component type per render and React would
 * remount the inputs, dropping focus after each keystroke.
 */
import { useEffect, useMemo, useState } from "react";
import {
  entryApi, type ReportBody, type ReportDetail, type ToolItem, type SolidControlRow,
  type HseDrillRow,
} from "../../entry/client.js";
import { Section, TextField, NumField, StaticField, RowTable, type Col } from "./fields.js";

const TOOL_KINDS: { kind: ToolItem["kind"]; label: string }[] = [
  { kind: "jar", label: "Jar" },
  { kind: "mwd", label: "MWD" },
  { kind: "dhMotor", label: "DH motor" },
];
const SC_UNITS = ["Clay Jactor", "Mud Cleaner", "Shaker"];
/**
 * a.json `hse_drill_schedule` — a FIXED four-row set, keyed by type and printed
 * even when blank, exactly like the tool kinds and the solid-control units.
 */
const HSE_TYPES = ["BOP Test", "H2S Drill", "Fire Drill", "Abandon Drill"];

/** Strip the server-only fields — what's left is exactly what PUT accepts. */
function toBody(r: ReportDetail): ReportBody {
  return {
    morningDepth: r.morningDepth, midnightDepth: r.midnightDepth, previousDepth: r.previousDepth,
    endDepthTvd: r.endDepthTvd,
    drillingTime: r.drillingTime, cumDrillingTime: r.cumDrillingTime,
    cumTimeLogDays: r.cumTimeLogDays, daysLti: r.daysLti, headCount: r.headCount, hazards: r.hazards,
    holeSize: r.holeSize, formation: r.formation, lithology: r.lithology,
    lastCasing: r.lastCasing, linerLap: r.linerLap, kop: r.kop,
    wellSiteSupt: r.wellSiteSupt, opnSupt: r.opnSupt, progEng: r.progEng,
    geologist: r.geologist, toolPusher1: r.toolPusher1, toolPusher2: r.toolPusher2,
    formationLoss: r.formationLoss, mudLossUnit: r.mudLossUnit, mudGains: r.mudGains,
    // a.json `operations`: at_report_time / summary / next_report_period. The
    // middle one IS the existing `description` — it is not duplicated here.
    opsAtReportTime: r.opsAtReportTime, opsNextPeriod: r.opsNextPeriod,
    // ── reports 06 / 07 header cells ──
    weather: r.weather, roadCondition: r.roadCondition, holeCondition: r.holeCondition,
    temperatureC: r.temperatureC, startDepthTvd: r.startDepthTvd, remarks: r.remarks, daysRi: r.daysRi,
    description: r.description, windSpeedDir: r.windSpeedDir, waveVisible: r.waveVisible,
    freshWater: r.freshWater, fuel: r.fuel,
    bitRuns: r.bitRuns ?? [], drillStrings: r.drillStrings ?? [], drillString: r.drillString ?? [],
    drillingParameters: r.drillingParameters ?? [],
    // The three tool rows and three solid-control units are always on the sheet,
    // present or not in the stored data.
    tools: TOOL_KINDS.map(({ kind }) =>
      r.tools?.find((t) => t.kind === kind) ?? { kind, type: null, size: null, serialNo: null, hours: null }),
    mud: r.mud ?? null,
    solidControl: SC_UNITS.map((unit) =>
      r.solidControl?.find((s) => s.unit === unit) ?? { unit, hours: null, underFlow: null, overFlow: null, feed: null, cons: null, fprs: null }),
    chemicals: r.chemicals ?? [], casing: r.casing ?? [], formationTops: r.formationTops ?? [],
    surveys: r.surveys ?? [], timeBreakdown: r.timeBreakdown ?? [], operations: r.operations ?? [],
    supervisors: r.supervisors ?? [], companies: r.companies ?? [],
    // Same fixed-shape treatment as tools / solidControl: all four drills exist
    // on the sheet whether or not the day stored any of them.
    hseDrills: HSE_TYPES.map((type) =>
      r.hseDrills?.find((h) => h.type === type) ?? { type, date: null, daysToNextCheck: null }),
    bulkMaterials: r.bulkMaterials ?? [],
    // ── reports 06 / 07 ──
    mudVolumes: r.mudVolumes ?? [],
    safetyChecks: r.safetyChecks ?? [],
    safetyIncidents: r.safetyIncidents ?? [],
    intervalProblems: r.intervalProblems ?? [],
    // a.json wellhead_component / well_control_scr / support_vessels are arrays;
    // formation_integrity_test and marine_conditions are single OBJECTS, so they
    // carry over exactly like `mud` — one block per day, or none at all.
    wellheads: r.wellheads ?? [], scrRates: r.scrRates ?? [], supportVessels: r.supportVessels ?? [],
    fit: r.fit ?? null, marine: r.marine ?? null,
    // ── report 18's geological sheet ──
    avgBackgroundGasPct: r.avgBackgroundGasPct, maxBackgroundGasPct: r.maxBackgroundGasPct,
    avgConnectionGasPct: r.avgConnectionGasPct, maxConnectionGasPct: r.maxConnectionGasPct,
    avgTripGasPct: r.avgTripGasPct, maxTripGasPct: r.maxTripGasPct,
    avgDrillGasPct: r.avgDrillGasPct, maxDrillGasPct: r.maxDrillGasPct,
    geoActivityAtReportTime: r.geoActivityAtReportTime,
    geoOpsThisPeriod: r.geoOpsThisPeriod, geoOpsNextPeriod: r.geoOpsNextPeriod,
    sampleDescriptions: r.sampleDescriptions ?? [],
    lithologyLog: r.lithologyLog ?? [],
    shows: r.shows ?? [],
    logRuns: r.logRuns ?? [],
  };
}

/** True when a row / object holds anything the user actually typed. */
const filled = (row: object, skip: string[] = ["order"]) =>
  Object.entries(row).some(([k, v]) => !skip.includes(k) && v !== null && v !== "");
const filledRows = (rows: object[], skip?: string[]) => rows.filter((r) => filled(r, skip)).length;

// ── drill strings (a.json drill_string: a header per BHA + its components) ────
// Structural aliases rather than imported names: the row shapes belong to the
// client's ReportBody, and taking them from it keeps this file honest if a
// column is added there.
type DrillStringRow = ReportBody["drillStrings"][number];
type DrillStringComponentRow = DrillStringRow["components"][number];

/**
 * Keys that are never null and so would make `filled` true forever: the row
 * index, the nested array (an array is never null), and the keys the GET serves
 * from Prisma — a saved-then-blanked string must be prunable, exactly as the
 * 1:1 mud / FIT / marine blocks are.
 */
const DS_SKIP = ["order", "components", "id", "reportId"];
const DS_ITEM_SKIP = ["order", "id", "drillStringId"];
const componentFilled = (c: DrillStringComponentRow) => filled(c, DS_ITEM_SKIP);
/**
 * A drill string counts as filled when ANY header field is typed OR it carries
 * at least one filled component — a string whose header is still blank but
 * whose component table is half-typed is real work and must not be pruned.
 */
const drillStringFilled = (s: DrillStringRow) =>
  filled(s, DS_SKIP) || s.components.some(componentFilled);

/**
 * Drop the rows the user never typed into before posting.
 *
 * The tables keep a blank row on screen so a subform doesn't look empty
 * (`minRows`), and touching any cell materialises the whole visible set — so
 * without this a save would persist all-null bit runs / operations. The fixed
 * tool, solid-control and HSE-drill rows are exempt: they are part of the
 * sheet's shape and are keyed by kind / unit / type.
 */
function prune(body: ReportBody): ReportBody {
  // The 1:1 blocks arrive from the GET carrying Prisma's own `id`/`reportId`,
  // which are non-null strings — counting them would make `filled` true forever,
  // so a block the user blanked would keep re-saving as an all-null row (and its
  // tab would keep its ✓). Skip the server-side keys and judge the data only.
  const OWN = ["id", "reportId"];
  const mudFilled = body.mud && filled(body.mud, OWN);
  // The FIT and marine blocks are 1:1 like the mud: an untouched block posts as
  // null rather than as an all-null row the office would have to read past.
  const fitFilled = body.fit && filled(body.fit, OWN);
  const marineFilled = body.marine && filled(body.marine, OWN);
  return {
    ...body,
    bitRuns: body.bitRuns.filter((r) => filled(r)),
    // Two levels: prune each string's blank component rows first (the table keeps
    // spare ones on screen), then drop the strings that are empty either way.
    drillStrings: body.drillStrings
      .map((s) => ({ ...s, components: s.components.filter(componentFilled) }))
      .filter(drillStringFilled),
    drillString: body.drillString.filter((r) => filled(r)),
    drillingParameters: body.drillingParameters.filter((r) => filled(r)),
    chemicals: body.chemicals.filter((r) => filled(r)),
    casing: body.casing.filter((r) => filled(r)),
    formationTops: body.formationTops.filter((r) => filled(r)),
    surveys: body.surveys.filter((r) => filled(r)),
    timeBreakdown: body.timeBreakdown.filter((r) => filled(r)),
    operations: body.operations.filter((r) => filled(r, ["order", "isProblem"])),
    supervisors: body.supervisors.filter((r) => filled(r)),
    companies: body.companies.filter((r) => filled(r)),
    bulkMaterials: body.bulkMaterials.filter((r) => filled(r)),
    mudVolumes: body.mudVolumes.filter((r) => filled(r)),
    safetyChecks: body.safetyChecks.filter((r) => filled(r)),
    // `isProblem`/`lostTime` are booleans: `false` is neither null nor "", so a
    // spare row would look filled forever. They are skipped, like `order`.
    safetyIncidents: body.safetyIncidents.filter((r) => filled(r, ["order", "lostTime"])),
    intervalProblems: body.intervalProblems.filter((r) => filled(r)),
    wellheads: body.wellheads.filter((r) => filled(r)),
    scrRates: body.scrRates.filter((r) => filled(r)),
    supportVessels: body.supportVessels.filter((r) => filled(r)),
    // hseDrills is deliberately NOT filtered — a.json prints all four rows even
    // when blank, and they are keyed by `type`, not by having been typed into.
    mud: mudFilled ? body.mud : null,
    fit: fitFilled ? body.fit : null,
    marine: marineFilled ? body.marine : null,
  };
}

/**
 * The mud check, after the four duplicate pairs were collapsed onto a.json's
 * name and unit: the mud-weight RANGE is densityMin/MaxPpg in ppg (the old sg
 * maxWeight/minWeight and the single densityPpg are gone), flowline temperature
 * is tFlowlineC in °C (not tempF), water loss is filtrateMl and calcium is
 * hardnessCaPpm. A report quoting one density fills BOTH ends of the range.
 */
const EMPTY_MUD: NonNullable<ReportBody["mud"]> = {
  mudSystem: null, reportTime: null, funnelVisc: null,
  pv: null, yp: null, gelInitial: null, gel10min: null, fan600: null, fan300: null,
  ph: null, alkalinity: null, hpht: null, airFoam: null, oilPct: null,
  oilWaterRatio: null, eStability: null, kcl: null, mbt: null, pf: null, mf: null,
  chloride: null, solidsPct: null,
  // a.json mud_information — kept alongside the DR.xls fields, not instead of them
  depthMkb: null, densityMinPpg: null, densityMaxPpg: null, tFlowlineC: null, filtrateMl: null,
  vis3rpm: null, vis6rpm: null, percentWater: null, lowGravitySolidsPct: null,
  hardnessCaPpm: null, mudLostBbl: null, activeMudVolBbl: null, volMudResBbl: null,
};

/** A component row the user hasn't typed into yet. */
const emptyComponent = (): DrillStringComponentRow => ({
  order: 0, itemDes: null, serv: null, sn: null, odIn: null, idIn: null,
  jts: null, lenM: null, cumLenM: null, com: null,
});
/** A whole new string — header blank, no components until one is added. */
const emptyDrillString = (): DrillStringRow => ({
  order: 0, name: null, bhaNo: null, depthInMkb: null, dateIn: null, objective: null,
  depthDrilledM: null, drillingTimeHr: null, circulatingTimeHr: null,
  rotatingTimeHr: null, slidingTimeHr: null, note: null, components: [],
});

/**
 * a.json `formation_integrity_test` and `marine_conditions` are OBJECTS, not
 * arrays — one block per report, exactly like the mud. These are the "nothing
 * recorded yet" shapes their subforms edit into before the block exists.
 */
const EMPTY_FIT: NonNullable<ReportBody["fit"]> = {
  testType: null, testDate: null, lastCasingStringRun: null, depthMkb: null, tvdMkb: null,
  appliedSurfacePressurePsi: null, fluidDensityPpg: null, volumePumpedBbl: null,
  leakOffPressurePsi: null, leakOffEqDensityPpg: null,
};

const EMPTY_MARINE: NonNullable<ReportBody["marine"]> = {
  swellHtM: null, visibilityKm: null, windDir: null, windSpdKnots: null,
  tHighC: null, waveHtM: null, com: null,
};

// ── shared prop shapes for the subforms ─────────────────────────────────────
type SetField = <K extends keyof ReportBody>(key: K, value: ReportBody[K]) => void;
interface SubformProps {
  draft: ReportBody;
  set: SetField;
  disabled: boolean;
}

/** The subforms, in the order the sheet is normally worked through. */
const SECTIONS = [
  // a.json puts the three narrative lines at the very top of the sheet, above
  // the header grid — so the day starts by saying what is going on, and the
  // numbers follow. NOTE: its middle field and the "summary" tab below edit the
  // SAME `description` column; that is a.json's `operations.summary` appearing
  // in both places, not two fields.
  { id: "narrative", label: "Operations narrative", count: (d: ReportBody) => filled({
      at: d.opsAtReportTime, sum: d.description, next: d.opsNextPeriod,
    }, []) ? 1 : 0, unit: "" },
  { id: "well", label: "Well / Operations", count: (d: ReportBody) => filled({
      morningDepth: d.morningDepth, midnightDepth: d.midnightDepth, previousDepth: d.previousDepth,
      endDepthTvd: d.endDepthTvd,
      drillingTime: d.drillingTime, cumDrillingTime: d.cumDrillingTime, holeSize: d.holeSize,
      formation: d.formation, lithology: d.lithology, lastCasing: d.lastCasing, linerLap: d.linerLap,
      kop: d.kop, wellSiteSupt: d.wellSiteSupt, opnSupt: d.opnSupt, progEng: d.progEng,
      geologist: d.geologist, toolPusher1: d.toolPusher1, toolPusher2: d.toolPusher2,
      // The rig-status block lives on this tab too, so it has to count towards the ✓.
      cumTimeLogDays: d.cumTimeLogDays, daysLti: d.daysLti, headCount: d.headCount, hazards: d.hazards,
    }, []) ? 1 : 0, unit: "" },
  { id: "bit", label: "Bit runs", count: (d: ReportBody) => filledRows(d.bitRuns), unit: "row" },
  // Straight after the bit: a drilled interval belongs next to the bit that drilled it.
  { id: "params", label: "Drilling parameters", count: (d: ReportBody) => filledRows(d.drillingParameters), unit: "row" },
  // The tab id stays "bha" so every other tab keeps the position the crew knows;
  // what it edits is now the drill-string blocks (header + components).
  { id: "bha", label: "Drill strings", count: (d: ReportBody) => d.drillStrings.filter(drillStringFilled).length, unit: "row" },
  { id: "string", label: "Drill string & tools", count: (d: ReportBody) => filledRows(d.drillString) + filledRows(d.tools, ["kind"]), unit: "row" },
  { id: "mud", label: "Mud properties", count: (d: ReportBody) => (d.mud && filled(d.mud, []) ? 1 : 0) + (filled({ a: d.formationLoss, b: d.mudLossUnit, c: d.mudGains }, []) ? 1 : 0), unit: "" },
  { id: "solid", label: "Solid control", count: (d: ReportBody) => filledRows(d.solidControl, ["unit"]), unit: "row" },
  { id: "chem", label: "Chemicals", count: (d: ReportBody) => filledRows(d.chemicals), unit: "row" },
  { id: "casing", label: "Casing", count: (d: ReportBody) => filledRows(d.casing), unit: "row" },
  { id: "tops", label: "Formation tops", count: (d: ReportBody) => filledRows(d.formationTops), unit: "row" },
  { id: "survey", label: "Surveys", count: (d: ReportBody) => filledRows(d.surveys), unit: "row" },
  { id: "time", label: "Time breakdown", count: (d: ReportBody) => filledRows(d.timeBreakdown), unit: "row" },
  { id: "ops", label: "Operations log", count: (d: ReportBody) => filledRows(d.operations), unit: "row" },
  { id: "summary", label: "Summary & weather", count: (d: ReportBody) => filled({
      description: d.description, windSpeedDir: d.windSpeedDir, waveVisible: d.waveVisible,
      freshWater: d.freshWater, fuel: d.fuel,
    }, []) ? 1 : 0, unit: "" },
  // The two people-and-stores tabs sit at the END: they are filled once a day at
  // most, and putting them mid-list would break the daily drilling flow above.
  { id: "crew", label: "Crew & companies", count: (d: ReportBody) =>
      filledRows(d.supervisors) + filledRows(d.companies), unit: "row" },
  { id: "hse", label: "HSE & bulk", count: (d: ReportBody) =>
      d.hseDrills.filter((h) => (h.date != null && h.date !== "") || h.daysToNextCheck != null).length
      + filledRows(d.bulkMaterials), unit: "row" },
  // The last three are filled RARELY — the wellhead when a spool goes on, the FIT
  // right after a shoe is drilled out, marine only offshore. They are appended
  // here so the daily flow above keeps the tab positions the crew already knows.
  { id: "wellhead", label: "Wellhead & SCR", count: (d: ReportBody) =>
      filledRows(d.wellheads) + filledRows(d.scrRates), unit: "row" },
  // `filled` skips Prisma's id/reportId here too, or a saved-then-blanked block
  // would keep its ✓ forever.
  { id: "fit", label: "FIT / LOT", count: (d: ReportBody) => (d.fit && filled(d.fit, ["id", "reportId"]) ? 1 : 0), unit: "" },
  // unit "row": the count sums the vessel rows, and the badge only prints a
  // number for "row" units — with "" it would collapse four vessels to a bare ✓.
  { id: "marine", label: "Marine & vessels", count: (d: ReportBody) =>
      (d.marine && filled(d.marine, ["id", "reportId"]) ? 1 : 0) + filledRows(d.supportVessels), unit: "row" },
  // Reports 06 and 07 print these; the DR.xls sheet had nowhere for them.
  { id: "events", label: "Events & HSE", count: (d: ReportBody) =>
      filledRows(d.intervalProblems) + filledRows(d.safetyChecks)
      + filledRows(d.safetyIncidents, ["order", "lostTime"]) + filledRows(d.mudVolumes), unit: "row" },
  // Report 18's own sheet. Written by the WELLSITE GEOLOGIST, not the driller —
  // which is why it is one tab rather than columns scattered through the others,
  // and why its narrative fields sit beside the gas readings instead of in
  // "Summary & weather".
  { id: "geology", label: "Geology", count: (d: ReportBody) =>
      filledRows(d.sampleDescriptions) + filledRows(d.lithologyLog)
      + filledRows(d.shows, ["order", "kind"]) + filledRows(d.logRuns)
      + (filled({
        a: d.avgBackgroundGasPct, b: d.maxBackgroundGasPct,
        c: d.avgConnectionGasPct, e: d.maxConnectionGasPct,
        f: d.avgTripGasPct, g: d.maxTripGasPct,
        h: d.avgDrillGasPct, i: d.maxDrillGasPct,
        j: d.geoActivityAtReportTime, k: d.geoOpsThisPeriod, l: d.geoOpsNextPeriod,
      }, []) ? 1 : 0), unit: "row" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

export function ReportEditor({ report, isAdmin, onChanged }: {
  report: ReportDetail;
  isAdmin: boolean;
  onChanged: (r: ReportDetail) => void;
}) {
  const [draft, setDraft] = useState<ReportBody>(() => toBody(report));
  const [section, setSection] = useState<SectionId>("well");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<null | "save" | "submit" | "reopen">(null);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  // Switching to another day (or a reopen) replaces the draft wholesale.
  useEffect(() => { setDraft(toBody(report)); setDirty(false); setError(null); setSavedAt(null); }, [report.id, report.status, report.updatedAt]);

  const locked = report.status === "submitted" && !isAdmin;
  const set: SetField = (key, value) => { setDraft((d) => ({ ...d, [key]: value })); setDirty(true); };
  const setMud = <K extends keyof NonNullable<ReportBody["mud"]>>(key: K, value: NonNullable<ReportBody["mud"]>[K]) => {
    setDraft((d) => ({ ...d, mud: { ...(d.mud ?? EMPTY_MUD), [key]: value } })); setDirty(true);
  };
  // Same 1:1 shape as the mud: the block is created on the first keystroke and
  // pruned back to null on save if it is still blank.
  const setFit = <K extends keyof NonNullable<ReportBody["fit"]>>(key: K, value: NonNullable<ReportBody["fit"]>[K]) => {
    setDraft((d) => ({ ...d, fit: { ...(d.fit ?? EMPTY_FIT), [key]: value } })); setDirty(true);
  };
  const setMarine = <K extends keyof NonNullable<ReportBody["marine"]>>(key: K, value: NonNullable<ReportBody["marine"]>[K]) => {
    setDraft((d) => ({ ...d, marine: { ...(d.marine ?? EMPTY_MARINE), [key]: value } })); setDirty(true);
  };
  const setTool = (kind: ToolItem["kind"], key: keyof ToolItem, value: string | number | null) => {
    setDraft((d) => ({ ...d, tools: d.tools.map((t) => (t.kind === kind ? { ...t, [key]: value } : t)) })); setDirty(true);
  };
  const setSc = (unit: string, key: keyof SolidControlRow, value: number | null) => {
    setDraft((d) => ({ ...d, solidControl: d.solidControl.map((s) => (s.unit === unit ? { ...s, [key]: value } : s)) })); setDirty(true);
  };
  const setHse = (type: string, key: keyof HseDrillRow, value: string | number | null) => {
    setDraft((d) => ({ ...d, hseDrills: d.hseDrills.map((h) => (h.type === type ? { ...h, [key]: value } : h)) })); setDirty(true);
  };

  // METERAGE is derived exactly as the office form derives it (midnight − previous).
  const meterage = useMemo(() => {
    const { midnightDepth: a, previousDepth: b } = draft;
    return a != null && b != null ? Number((a - b).toFixed(2)) : null;
  }, [draft.midnightDepth, draft.previousDepth]);

  // AVG ROP (a.json avg_rop_m_hr) is derived from the same two figures rather
  // than stored, so it can never drift from the depths or the drilling hours.
  // No drilling time (or a zero-hour day: tripping, waiting) means no rate.
  const avgRop = useMemo(() => {
    const t = draft.drillingTime;
    return t != null && t > 0 && meterage != null ? meterage / t : null;
  }, [meterage, draft.drillingTime]);

  async function save(): Promise<ReportDetail | null> {
    setBusy("save"); setError(null);
    try {
      const r = await entryApi.put<ReportDetail>(`/reports/${report.id}`, prune(draft));
      setDirty(false);
      setSavedAt(new Date().toLocaleTimeString());
      onChanged(r);
      return r;
    } catch (e) { setError(String((e as Error).message)); return null; }
    finally { setBusy(null); }
  }

  async function submit() {
    if (dirty && !(await save())) return;   // never submit a sheet that failed to save
    setBusy("submit"); setError(null);
    try { onChanged(await entryApi.post<ReportDetail>(`/reports/${report.id}/submit`)); }
    catch (e) { setError(String((e as Error).message)); }
    finally { setBusy(null); }
  }

  async function reopen() {
    setBusy("reopen"); setError(null);
    try { onChanged(await entryApi.post<ReportDetail>(`/reports/${report.id}/reopen`)); }
    catch (e) { setError(String((e as Error).message)); }
    finally { setBusy(null); }
  }

  const w = report.well;
  const d = locked;
  const idx = SECTIONS.findIndex((s) => s.id === section);
  const props: SubformProps = { draft, set, disabled: d };

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden text-gray-800">
      {/* Title bar + actions — stacked on a phone, one flowing line from sm: up */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between sm:flex-wrap gap-2 sm:gap-3 px-3 py-2 sm:py-1.5 bg-blue-700 text-white">
        <div className="font-semibold text-sm leading-snug min-w-0 sm:truncate">
          {w.name} — Daily Drilling Report
          <span className="font-normal opacity-80"> · #{report.serialNo} · {report.reportDate}</span>
        </div>
        <div className="flex items-center flex-wrap gap-2">
          {report.status === "submitted"
            ? <span className="text-[11px] sm:text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/90 uppercase tracking-wide">Submitted</span>
            : <span className="text-[11px] sm:text-[10px] px-1.5 py-0.5 rounded bg-amber-400/90 text-amber-950 uppercase tracking-wide">Draft</span>}
          {dirty && <span className="text-[11px] sm:text-[10px] opacity-90">unsaved changes</span>}
          {!dirty && savedAt && <span className="text-[11px] sm:text-[10px] opacity-90">saved {savedAt}</span>}
          {!locked && (
            <button onClick={save} disabled={!!busy}
              className="h-11 sm:h-7 px-4 sm:px-3 text-sm sm:text-xs rounded-md bg-white/15 hover:bg-white/25 transition-colors duration-150 disabled:opacity-50">
              {busy === "save" ? "Saving…" : "Save"}
            </button>
          )}
          {report.status === "draft" && (
            <button onClick={submit} disabled={!!busy}
              className="h-11 sm:h-7 px-4 sm:px-3 text-sm sm:text-xs rounded-md bg-emerald-500 hover:bg-emerald-600 transition-colors duration-150 disabled:opacity-50">
              {busy === "submit" ? "Submitting…" : "Submit"}
            </button>
          )}
          {report.status === "submitted" && isAdmin && (
            <button onClick={reopen} disabled={!!busy}
              className="h-11 sm:h-7 px-4 sm:px-3 text-sm sm:text-xs rounded-md bg-white/15 hover:bg-white/25 transition-colors duration-150 disabled:opacity-50">
              {busy === "reopen" ? "Reopening…" : "Reopen"}
            </button>
          )}
        </div>
      </div>

      {error && <div className="px-3 py-1.5 text-xs text-red-700 bg-red-50 border-b border-red-200">{error}</div>}
      {locked && (
        <div className="px-3 py-1.5 text-xs text-emerald-800 bg-emerald-50 border-b border-emerald-200">
          Submitted {report.submittedAt ? new Date(report.submittedAt).toLocaleString() : ""} — read-only. Ask an admin to reopen it for corrections.
        </div>
      )}

      {/* Well-level band — from the well record, not typed daily */}
      <div className="border-b border-gray-300 bg-gray-50/70">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          <StaticField label="Date" value={report.reportDate} />
          <StaticField label="Field" value={w.field} />
          <StaticField label="Well no." value={w.legacyWellCode ?? w.name} />
          <StaticField label="Loc" value={w.location} />
          <StaticField label="Op. type" value={w.wellType} />
          <StaticField label="Well prof." value={w.profile} />
        </div>
        {/* Two extra cells only — the coordinates are combined, as R.T.E / W.depth
            already is, so the band still falls into two readable columns at 375px. */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 border-t border-gray-200">
          <StaticField label="Rig no." value={w.rig?.name} />
          <StaticField label="Client" value={w.client} />
          <StaticField label="Spud date" value={w.spudDate} />
          <StaticField label="Release date" value={w.rigReleasedDate} />
          <StaticField label="Resv" value={w.reservoir} />
          <StaticField label="R.T.E / W.depth" value={`${w.rtElevation ?? "—"} / ${w.waterDepth ?? "—"}`} />
          <StaticField label="Lat / Long" value={w.latitude || w.longitude ? `${w.latitude ?? "—"} / ${w.longitude ?? "—"}` : null} />
        </div>
        {/* Air gap and leg penetration are long free text — a full-width line
            rather than a truncating cell, and only when the well carries them. */}
        {(w.elevationNote || w.comment) && (
          <div className="border-t border-gray-200 px-2 py-1.5 sm:py-1 text-[12px] sm:text-[10px] text-gray-600 leading-snug">
            {[w.elevationNote, w.comment].filter(Boolean).join("  ·  ")}
          </div>
        )}
      </div>

      {/* Subform picker wrap into a screen-eating block on a phone, so
          below sm: they are one snap-scrolling row instead; they wrap from sm: up. */}
      <div className="flex flex-nowrap overflow-x-auto snap-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:overflow-visible gap-2 sm:gap-1 px-2 py-2 sm:py-1.5 border-b border-gray-200 bg-gray-50">
        {SECTIONS.map((s) => {
          const n = s.count(draft);
          const active = s.id === section;
          return (
            <button key={s.id} onClick={() => setSection(s.id)}
              className={`shrink-0 snap-start whitespace-nowrap h-11 sm:h-7 px-3 sm:px-2.5 text-[13px] sm:text-[11px] rounded-md border transition-colors duration-150 ${
                active ? "bg-blue-600 border-blue-600 text-white"
                       : "bg-white border-gray-300 text-gray-600 hover:bg-gray-100"}`}>
              {s.label}
              {n > 0 && (
                <span className={`ml-1.5 px-1 rounded text-[11px] sm:text-[9px] tabular-nums ${
                  active ? "bg-white/25" : "bg-emerald-100 text-emerald-700"}`}>
                  {s.unit === "row" ? n : "✓"}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* The active subform */}
      <div className="min-h-[220px]">
        {section === "narrative" && <OperationsNarrative {...props} />}
        {section === "well" && <WellOperations {...props} well={w} meterage={meterage} avgRop={avgRop} />}
        {section === "bit" && <BitRuns {...props} />}
        {section === "params" && <DrillingParameters {...props} />}
        {section === "bha" && <DrillStrings {...props} />}
        {section === "string" && <DrillStringAndTools {...props} setTool={setTool} />}
        {section === "mud" && <MudSubform {...props} setMud={setMud} />}
        {section === "solid" && <SolidControlSubform {...props} setSc={setSc} />}
        {section === "chem" && <Chemicals {...props} />}
        {section === "casing" && <CasingSubform {...props} />}
        {section === "tops" && <FormationTops {...props} />}
        {section === "survey" && <Surveys {...props} />}
        {section === "time" && <TimeBreakdown {...props} />}
        {section === "ops" && <OperationsLog {...props} />}
        {section === "events" && <EventsAndHse {...props} />}
        {section === "summary" && <SummaryWeather {...props} />}
        {section === "crew" && <CrewAndCompanies {...props} />}
        {section === "hse" && <HseAndBulk {...props} setHse={setHse} />}
        {section === "wellhead" && <WellheadAndScr {...props} />}
        {section === "fit" && <FitSubform {...props} setFit={setFit} />}
        {section === "marine" && <MarineAndVessels {...props} setMarine={setMarine} />}
        {section === "geology" && <GeologySubform {...props} />}
      </div>

      {/* Step through the subforms + the persistent Save / Submit */}
      <div className="px-3 py-3 sm:py-2 border-t border-gray-200 bg-gray-50 flex flex-col sm:flex-row sm:items-center sm:justify-between sm:flex-wrap gap-3">
        <div className="flex items-center justify-between sm:justify-start gap-2">
          <button disabled={idx === 0} onClick={() => setSection(SECTIONS[idx - 1].id)}
            className="h-11 sm:h-8 px-4 sm:px-3 text-sm sm:text-xs rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors duration-150 disabled:opacity-40">← Previous</button>
          <span className="text-[13px] sm:text-[11px] text-gray-500 tabular-nums">{idx + 1} / {SECTIONS.length}</span>
          <button disabled={idx === SECTIONS.length - 1} onClick={() => setSection(SECTIONS[idx + 1].id)}
            className="h-11 sm:h-8 px-4 sm:px-3 text-sm sm:text-xs rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors duration-150 disabled:opacity-40">Next →</button>
        </div>
        {!locked && (
          <div className="flex flex-wrap gap-2">
            {/* min-h rather than a fixed h- so a wrapped label grows the button
                instead of spilling out of it on a narrow phone. */}
            <button onClick={save} disabled={!!busy}
              className="flex-1 sm:flex-none min-h-[44px] sm:min-h-0 sm:h-8 py-2 sm:py-0 px-4 text-sm sm:text-xs leading-tight rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors duration-150 disabled:bg-gray-300">
              {busy === "save" ? "Saving…" : "Save report"}
            </button>
            {report.status === "draft" && (
              <button onClick={submit} disabled={!!busy}
                className="flex-1 sm:flex-none min-h-[44px] sm:min-h-0 sm:h-8 py-2 sm:py-0 px-4 text-sm sm:text-xs leading-tight rounded-md bg-emerald-600 text-white hover:bg-emerald-700 transition-colors duration-150 disabled:bg-gray-300">
                {busy === "submit" ? "Submitting…" : "Submit for the office"}
              </button>
            )}
          </div>
        )}
      </div>
      <div className="px-3 py-2 sm:py-1.5 border-t border-gray-200 text-[12px] sm:text-[11px] text-gray-500">
        Filed by {report.user.fullName} ({report.user.username}) · last saved {new Date(report.updatedAt).toLocaleString()}
        {dirty && <span className="text-amber-700"> · unsaved changes on this sheet</span>}
      </div>
    </div>
  );
}

// ══ subforms ═══════════════════════════════════════════════════════════════
// Each one owns a single part of the sheet; they all write into the same draft.

/**
 * A read-only row for a figure the sheet DERIVES (meterage, average ROP).
 *
 * Same rhythm as NumField so the column reads as one list, but there is no
 * input: these are recomputed from the depths and hours on every keystroke and
 * are never stored, so they cannot drift from the numbers they come from.
 */
function DerivedField({ label, value, unit, caption }: {
  label: string; value: string | number | null; unit: string; caption: string;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-stretch border-b border-gray-100">
      <div className="shrink-0 bg-gray-50 px-2 pt-1.5 pb-0.5 text-[11px] uppercase tracking-wide text-gray-500 sm:w-[44%] sm:px-1.5 sm:py-0.5 sm:text-[10px] sm:border-r sm:border-gray-100">{label}</div>
      <div className="flex-1 min-w-0 px-2 pb-1.5 sm:px-1.5 sm:py-0.5 text-[15px] sm:text-[11px] font-semibold tabular-nums">
        {value ?? "—"}
        <span className="text-[11px] sm:text-[9px] font-normal text-gray-400"> {unit} {caption}</span>
      </div>
    </div>
  );
}

/**
 * a.json `operations` — the three narrative lines that head the sheet: what the
 * rig is doing right now, what it did over the 24 hours, what comes next.
 *
 * The middle one is bound to `description`, the SAME column the "Summary &
 * weather" tab edits — a.json's `operations.summary` and the DR.xls summary box
 * are one field, so typing in either place updates the other. That is
 * deliberate; it is not a duplicated column.
 */
function OperationsNarrative({ draft, set, disabled }: SubformProps) {
  return (
    <>
      <Section right={<span className="font-normal normal-case text-[11px] sm:text-[9px] opacity-70">midnight to midnight</span>}>Operations narrative</Section>
      <TextField label="At report time" multiline value={draft.opsAtReportTime} disabled={disabled}
        onChange={(v) => set("opsAtReportTime", v)} placeholder='RIH 24" H.S. BHA at 21m.' />
      <TextField label="Summary (24 hr)" multiline value={draft.description} disabled={disabled}
        onChange={(v) => set("description", v)}
        placeholder="The day's narrative — what was drilled, what happened." />
      <TextField label="Next report period" multiline value={draft.opsNextPeriod} disabled={disabled}
        onChange={(v) => set("opsNextPeriod", v)} placeholder="Continue drilling 12-1/4in hole to casing point." />
      <p className="px-2 py-2 text-xs sm:text-[10px] text-gray-400 leading-snug">
        The 24-hour summary is the same text as the one on the "Summary &amp; weather" tab — one field,
        shown in both places.
      </p>
    </>
  );
}

function WellOperations({ draft, set, disabled, well, meterage, avgRop }: SubformProps & {
  well: ReportDetail["well"]; meterage: number | null; avgRop: number | null;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2">
      <div className="md:border-r border-gray-200">
        <Section>Depths &amp; progress</Section>
        {/* Same label-above-on-phone rhythm as TextField / NumField. */}
        <div className="flex flex-col sm:flex-row sm:items-stretch border-b border-gray-100 bg-gray-50/40">
          <div className="shrink-0 px-2 pt-1.5 pb-0.5 text-[11px] uppercase tracking-wide text-gray-500 sm:w-[44%] sm:px-1.5 sm:py-0.5 sm:text-[10px] sm:border-r sm:border-gray-100">Contractor · Proj. TD · Rig days</div>
          <div className="flex-1 min-w-0 px-2 pb-1.5 sm:px-1.5 sm:py-0.5 text-[13px] sm:text-[11px] truncate">
            {well.contractor ?? "—"} · {well.finalForecastDepth ?? "—"} m · {well.forecastDays ?? "—"} d
          </div>
        </div>
        <NumField label="Morning depth" unit="m" value={draft.morningDepth} onChange={(v) => set("morningDepth", v)} disabled={disabled} />
        <NumField label="Midnight depth" unit="m" value={draft.midnightDepth} onChange={(v) => set("midnightDepth", v)} disabled={disabled} />
        {/* The day's end depth on the other scale — kept beside the measured one. */}
        <NumField label="End depth (TVD)" unit="mKB" value={draft.endDepthTvd} onChange={(v) => set("endDepthTvd", v)} disabled={disabled} />
        <NumField label="Previous depth" unit="m" value={draft.previousDepth} onChange={(v) => set("previousDepth", v)} disabled={disabled} />
        <DerivedField label="Meterage" value={meterage} unit="m" caption="(midnight − previous)" />
        <DerivedField label="Avg ROP" value={avgRop?.toFixed(1) ?? null} unit="m/hr" caption="(progress ÷ drilling hours)" />
        <NumField label="Drilling time" unit="h" value={draft.drillingTime} onChange={(v) => set("drillingTime", v)} disabled={disabled} />
        <NumField label="Cum. drlg time" unit="h" value={draft.cumDrillingTime} onChange={(v) => set("cumDrillingTime", v)} disabled={disabled} />
        <TextField label="Hole size" value={draft.holeSize} onChange={(v) => set("holeSize", v)} disabled={disabled} placeholder='12-1/4"' />
        <TextField label="Formation" value={draft.formation} onChange={(v) => set("formation", v)} disabled={disabled} placeholder="Asmari @ 2310" />
        <TextField label="Lithology" value={draft.lithology} onChange={(v) => set("lithology", v)} disabled={disabled} />
        <TextField label="Last casing" value={draft.lastCasing} onChange={(v) => set("lastCasing", v)} disabled={disabled} placeholder='13-3/8" @ 2105' />
        <TextField label="Liner lap" value={draft.linerLap} onChange={(v) => set("linerLap", v)} disabled={disabled} />
        <TextField label="KOP (w/ st.pt.)" value={draft.kop} onChange={(v) => set("kop", v)} disabled={disabled} />
      </div>
      <div>
        <Section>Rig crew</Section>
        <TextField label="Wellsite supt." value={draft.wellSiteSupt} onChange={(v) => set("wellSiteSupt", v)} disabled={disabled} />
        <TextField label="Opn. supt." value={draft.opnSupt} onChange={(v) => set("opnSupt", v)} disabled={disabled} />
        <TextField label="Prog. eng." value={draft.progEng} onChange={(v) => set("progEng", v)} disabled={disabled} />
        <TextField label="Geologist" value={draft.geologist} onChange={(v) => set("geologist", v)} disabled={disabled} />
        <TextField label="Tool pusher 1" value={draft.toolPusher1} onChange={(v) => set("toolPusher1", v)} disabled={disabled} />
        <TextField label="Tool pusher 2" value={draft.toolPusher2} onChange={(v) => set("toolPusher2", v)} disabled={disabled} />

        <Section>Rig status</Section>
        <NumField label="Cum. time log" unit="days" value={draft.cumTimeLogDays} onChange={(v) => set("cumTimeLogDays", v)} disabled={disabled} />
        <p className="px-2 pt-1 pb-1.5 sm:pt-0.5 text-xs sm:text-[10px] text-gray-400 leading-snug">
          Elapsed DAYS on the well (e.g. 3.13) — not drilling hours. Cumulative drilling time is the
          separate figure on the left, in hours.
        </p>
        <NumField label="Days since LTI" unit="days" value={draft.daysLti} onChange={(v) => set("daysLti", v)} disabled={disabled} />
        <NumField label="Head count" unit="POB" value={draft.headCount} onChange={(v) => set("headCount", v)} disabled={disabled} />
        <TextField label="Hazards" value={draft.hazards} onChange={(v) => set("hazards", v)} disabled={disabled} placeholder="STOP CARD: 12" />

        <p className="px-2 py-2 text-xs sm:text-[10px] text-gray-400 leading-snug">
          Depths drive the meterage and average ROP on the office side; the crew names print on the
          DR sheet header.
        </p>
      </div>
    </div>
  );
}

function BitRuns({ draft, set, disabled }: SubformProps) {
  return (
    <>
      <Section right={<span className="font-normal normal-case text-[11px] sm:text-[9px] opacity-70">one row per bit run — a bit-change day has two</span>}>Bit</Section>
      <RowTable
        cols={[
          { key: "bitNo", label: "Bit no.", width: "w-16" },
          { key: "bitSerialNo", label: "Ser. no.", width: "w-24" },
          { key: "size", label: "Size", width: "w-20" },
          { key: "type", label: "Type", width: "w-20" },
          // Who made the bit and which product it is — the IADC code classifies
          // the cutting structure, it does not identify the bit.
          { key: "make", label: "Make", width: "w-24", title: "Bit manufacturer, e.g. Smith / Baker Hughes" },
          { key: "model", label: "Model", width: "w-24", title: "Manufacturer's bit model" },
          { key: "iadcCode", label: "IADC", width: "w-20" },
          { key: "nozzles", label: "Nozzles", width: "w-20" },
          { key: "tfa", label: "TFA", type: "num", width: "w-16" },
          { key: "meterage", label: "Meterage", type: "num", width: "w-20" },
          { key: "hours", label: "Hours", type: "num", width: "w-16" },
          { key: "bitRevs", label: "Bit revs", type: "num", width: "w-24", title: "Total revolutions turned on the run" },
          { key: "wob", label: "WOB (klb)", type: "num", width: "w-20" },
          { key: "rpm", label: "RPM", type: "num", width: "w-16" },
          { key: "torque", label: "Torque on/off", width: "w-24" },
          { key: "dullGrade", label: "Dull (IADC)", width: "w-32" },
          { key: "reasonPulled", label: "Reason pulled", width: "w-24" },
          { key: "pumpType", label: "Pump type", width: "w-24" },
          { key: "pumpOutput", label: "Output (gpm)", type: "num", width: "w-24" },
          { key: "pumpPressure", label: "Pressure", type: "num", width: "w-20" },
          { key: "annularVelocity", label: "Ann. vel.", type: "num", width: "w-20" },
          { key: "hsi", label: "HSI", type: "num", width: "w-16" },
          { key: "cmtDrilled", label: "CMT drl (m-h)", width: "w-24" },
          { key: "washAndRun", label: "W&R (m-h)", width: "w-24" },
          { key: "bitChangeIn", label: "Change in", width: "w-20" },
          { key: "bitChangeOut", label: "Change out", width: "w-20" },
        ] as Col<ReportBody["bitRuns"][number]>[]}
        rows={draft.bitRuns} onChange={(v) => set("bitRuns", v)} disabled={disabled} minRows={1}
        addLabel="bit run"
        blank={() => ({
          order: 0, bitNo: null, bitSerialNo: null, size: null, type: null,
          make: null, model: null, bitRevs: null, iadcCode: null,
          nozzles: null, tfa: null, meterage: null, hours: null, wob: null, rpm: null,
          torque: null, dullGrade: null, reasonPulled: null, pumpType: null, pumpOutput: null,
          pumpPressure: null, annularVelocity: null, hsi: null, cmtDrilled: null,
          washAndRun: null, bitChangeIn: null, bitChangeOut: null,
        })}
      />
      <p className="px-2 pb-2 text-xs sm:text-[10px] text-gray-400">
        Bit ROP is derived by the office from meterage ÷ hours, so leave it out here.
      </p>
    </>
  );
}

/**
 * a.json `drilling_parameters` — the interval-by-interval record of how the hole
 * was made: depths in, times, and the parameters held over that interval.
 * Sits next to the bit runs because the two describe the same drilling.
 */
function DrillingParameters({ draft, set, disabled }: SubformProps) {
  const drilled = draft.drillingParameters.reduce((a, r) => a + (r.drillTimeHr ?? 0), 0);
  return (
    <>
      <Section right={<span className="font-normal normal-case text-[11px] sm:text-[9px] opacity-70">
        {drilled > 0 ? `${drilled.toFixed(1)} h drilling` : "one row per drilled interval"}
      </span>}>Drilling parameters</Section>
      <RowTable
        cols={[
          { key: "startMkb", label: "Start (mKB)", type: "num", width: "w-24" },
          { key: "endDepthMkb", label: "End (mKB)", type: "num", width: "w-24" },
          { key: "drillTimeHr", label: "Drill (hr)", type: "num", width: "w-20" },
          { key: "slideTimeHr", label: "Slide (hr)", type: "num", width: "w-20" },
          { key: "circTimeHr", label: "Circ (hr)", type: "num", width: "w-20" },
          { key: "intRopMHr", label: "Int. ROP (m/hr)", type: "num", width: "w-24" },
          { key: "drillTq", label: "Torque", type: "num", width: "w-20" },
          { key: "rpm", label: "RPM", type: "num", width: "w-16" },
          { key: "qFlowGpm", label: "Flow (gpm)", type: "num", width: "w-24" },
          { key: "sppPsi", label: "SPP (psi)", type: "num", width: "w-20" },
          { key: "wob1000Lbf", label: "WOB (1000 lbf)", type: "num", width: "w-24" },
        ] as Col<ReportBody["drillingParameters"][number]>[]}
        rows={draft.drillingParameters} onChange={(v) => set("drillingParameters", v)} disabled={disabled} minRows={1}
        addLabel="interval"
        blank={() => ({
          order: 0, startMkb: null, endDepthMkb: null, drillTimeHr: null, slideTimeHr: null,
          circTimeHr: null, intRopMHr: null, drillTq: null, rpm: null, qFlowGpm: null,
          sppPsi: null, wob1000Lbf: null,
        })}
      />
      <p className="px-2 pb-2 text-xs sm:text-[10px] text-gray-400 leading-snug">
        A last row carrying only circulating time and no depths is normal — that is circulating without making hole.
      </p>
    </>
  );
}

/** The component columns, in the order they print on the drill-string sheet. */
const DS_COMPONENT_COLS: Col<DrillStringComponentRow>[] = [
  { key: "itemDes", label: "Item des", title: "Bit, motor, MWD, stabiliser, drill collar, HWDP, drill pipe…" },
  { key: "serv", label: "Serv", width: "w-24", title: "Service company that supplied the item" },
  { key: "sn", label: "SN", width: "w-28", title: "Serial number" },
  { key: "odIn", label: "OD (in)", type: "num", width: "w-20" },
  { key: "idIn", label: "ID (in)", type: "num", width: "w-20" },
  { key: "jts", label: "Jts", type: "int", width: "w-16", title: "Joints — a whole number" },
  { key: "lenM", label: "Len (m)", type: "num", width: "w-24", title: "Length of this item" },
  { key: "cumLenM", label: "Cum len (m)", type: "num", width: "w-28", title: "Running total from the bit up" },
  { key: "com", label: "Com" },
];

/**
 * The arithmetic the printed sheet asserts: the components' own lengths must add
 * up to the last cumulative length in the column. When they don't, one of the
 * two was mistyped — flagged in amber rather than corrected, because only the
 * driller knows which number is the wrong one.
 */
function StringLengthCheck({ components }: { components: DrillStringComponentRow[] }) {
  const rows = components.filter(componentFilled);
  const sum = rows.reduce((a, c) => a + (c.lenM ?? 0), 0);
  const cum = [...rows].reverse().find((c) => c.cumLenM != null)?.cumLenM ?? null;
  // 5 cm of slack: the lengths are tallied to the centimetre, so anything under
  // that is rounding, not a typo.
  const off = sum > 0 && cum != null && Math.abs(sum - cum) > 0.05;
  // Three states, not two: with no item lengths typed there is nothing to check,
  // and saying "agrees" there is a green all-clear on an assembly whose per-item
  // lengths are entirely missing — the opposite of what the check is for.
  const detail = cum == null
    ? "no cum len typed yet"
    : sum === 0
      ? `last cum len ${cum.toFixed(2)} m — no item lengths typed, nothing to check`
      : `last cum len ${cum.toFixed(2)} m${off ? ` — off by ${Math.abs(sum - cum).toFixed(2)} m` : " — agrees"}`;
  return (
    <div className="flex flex-col sm:flex-row sm:items-stretch border-b border-gray-100">
      <div className="shrink-0 bg-gray-50 px-2 pt-1.5 pb-0.5 text-[11px] uppercase tracking-wide text-gray-500 sm:w-[44%] sm:px-1.5 sm:py-0.5 sm:text-[10px] sm:border-r sm:border-gray-100">
        Length check
      </div>
      <div className={`flex-1 min-w-0 px-2 pb-1.5 sm:px-1.5 sm:py-0.5 text-[15px] sm:text-[11px] font-semibold tabular-nums ${off ? "text-amber-700" : ""}`}>
        {sum > 0 ? `${sum.toFixed(2)} m` : "—"}
        <span className={`text-[11px] sm:text-[9px] font-normal ${off ? "text-amber-700" : "text-gray-400"}`}> Σ len · {detail}</span>
      </div>
    </div>
  );
}

/**
 * One drill string: the header that names and dates the run, then the itemised
 * assembly. Module scope like every other helper here — declared inside the
 * subform it would remount on each keystroke and drop focus.
 */
function DrillStringBlock({ string: s, index, disabled, onPatch, onRemove }: {
  string: DrillStringRow;
  index: number;
  disabled: boolean;
  onPatch: (patch: Partial<DrillStringRow>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="border-b-4 border-gray-100 last:border-b-0">
      <Section right={!disabled && (
        <button type="button" onClick={onRemove}
          className="min-h-[32px] sm:min-h-0 px-2 py-0.5 text-[11px] sm:text-[10px] normal-case font-normal rounded border border-gray-300 bg-white text-gray-600 hover:text-red-600 hover:border-red-300 hover:bg-red-50 transition-colors duration-150">
          Remove string
        </button>
      )}>
        {s.name?.trim() ? s.name : `Drill string ${index + 1}`}
        {s.bhaNo != null ? ` · BHA #${s.bhaNo}` : ""}
      </Section>
      <div className="grid grid-cols-1 md:grid-cols-2">
        <div className="md:border-r border-gray-200">
          <TextField label="Name" value={s.name} onChange={(v) => onPatch({ name: v })} disabled={disabled} placeholder='12-1/4" directional BHA' />
          {/* BHA # is a whole number in the database — rounded here so a stray
              decimal can't 400 the whole sheet on save. */}
          <NumField label="BHA #" step="1" value={s.bhaNo} disabled={disabled}
            onChange={(v) => onPatch({ bhaNo: v == null ? null : Math.round(v) })} />
          <NumField label="Depth in" unit="mKB" value={s.depthInMkb} onChange={(v) => onPatch({ depthInMkb: v })} disabled={disabled} />
          <TextField label="Date in" value={s.dateIn} onChange={(v) => onPatch({ dateIn: v })} disabled={disabled} placeholder="4/30/2026" />
          <TextField label="Objective" value={s.objective} onChange={(v) => onPatch({ objective: v })} disabled={disabled} placeholder="Drill 12-1/4in hole to casing point" />
          <NumField label="Depth drilled" unit="m" value={s.depthDrilledM} onChange={(v) => onPatch({ depthDrilledM: v })} disabled={disabled} />
        </div>
        <div>
          <NumField label="Drilling time" unit="hr" value={s.drillingTimeHr} onChange={(v) => onPatch({ drillingTimeHr: v })} disabled={disabled} />
          <NumField label="Circulating time" unit="hr" value={s.circulatingTimeHr} onChange={(v) => onPatch({ circulatingTimeHr: v })} disabled={disabled} />
          <NumField label="Rotating time" unit="hr" value={s.rotatingTimeHr} onChange={(v) => onPatch({ rotatingTimeHr: v })} disabled={disabled} />
          <NumField label="Sliding time" unit="hr" value={s.slidingTimeHr} onChange={(v) => onPatch({ slidingTimeHr: v })} disabled={disabled} />
          <TextField label="Note" multiline value={s.note} onChange={(v) => onPatch({ note: v })} disabled={disabled} />
        </div>
      </div>
      <RowTable
        cols={DS_COMPONENT_COLS}
        rows={s.components}
        onChange={(rows) => onPatch({ components: rows })}
        disabled={disabled} minRows={3} addLabel="component" blank={emptyComponent}
      />
      <StringLengthCheck components={s.components} />
    </div>
  );
}

/**
 * a.json `drill_string` — one block per assembly run in the day, each with its
 * own header and its own itemised components, bit first.
 *
 * A bit change means a second block, not more rows in the first: the header
 * (depth in, date in, objective, the four time tallies) belongs to ONE run, and
 * flattening two runs into one table loses which items were in the hole when.
 */
function DrillStrings({ draft, set, disabled }: SubformProps) {
  // Same trick as RowTable's minRows: a blank string is shown so the tab never
  // looks empty, and it only becomes real data once something is typed into it
  // (prune drops it again if it is still blank at save).
  const shown = draft.drillStrings.length > 0 ? draft.drillStrings : [emptyDrillString()];
  const write = (list: DrillStringRow[]) => set("drillStrings", list.map((s, i) => ({ ...s, order: i })));
  return (
    <>
      {shown.map((s, i) => (
        <DrillStringBlock key={i} string={s} index={i} disabled={disabled}
          onPatch={(patch) => write(shown.map((x, j) => (j === i ? { ...x, ...patch } : x)))}
          onRemove={() => write(shown.filter((_, j) => j !== i))} />
      ))}
      {!disabled && (
        <button type="button" onClick={() => write([...shown, emptyDrillString()])}
          className="mt-2 mb-2 mx-2 sm:mx-1 min-h-[44px] sm:min-h-[28px] px-3 text-sm sm:text-[11px] rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors duration-150">
          + Add drill string
        </button>
      )}
      <p className="px-2 pb-2 text-xs sm:text-[10px] text-gray-400 leading-snug">
        List each assembly as it is run, bit first. Cum len is the running total from the bit up, so the
        last one is the string length — the check line above compares it against the sum of the item lengths.
      </p>
    </>
  );
}

function DrillStringAndTools({ draft, set, setTool, disabled }: SubformProps & {
  setTool: (kind: ToolItem["kind"], key: keyof ToolItem, value: string | number | null) => void;
}) {
  // Matches the INPUT rhythm of the fields.tsx primitives: 44px/16px on a phone,
  // dense from sm: up. This table is fixed-shape (3 tools), so it scrolls
  // sideways on a phone rather than becoming cards like RowTable.
  const cell =
    "w-full min-w-0 bg-transparent border-0 text-base min-h-[44px] px-2 py-2 " +
    "sm:text-[13px] sm:min-h-[32px] sm:px-1.5 sm:py-1 focus:outline-none focus:bg-blue-50";
  return (
    <>
      <Section>Drill string</Section>
      <RowTable
        cols={[
          { key: "size", label: "D/P size" },
          { key: "grade", label: "D/P grade" },
          { key: "lengthM", label: "Length (m)", type: "num" },
        ] as Col<ReportBody["drillString"][number]>[]}
        rows={draft.drillString} onChange={(v) => set("drillString", v)} disabled={disabled} minRows={2}
        addLabel="pipe section" blank={() => ({ order: 0, size: null, grade: null, lengthM: null })}
      />
      <Section>Drilling tools</Section>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] sm:min-w-0 text-[13px] border-collapse">
          <thead>
            <tr>{["Tool", "Type", "Size", "Serial no.", "Hours"].map((h) => (
              <th key={h} className="bg-gray-50 border border-gray-200 px-2 sm:px-1.5 py-1.5 sm:py-1 text-left text-[11px] sm:text-[10px] font-medium uppercase tracking-wide text-gray-500 whitespace-nowrap">{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {TOOL_KINDS.map(({ kind, label }) => {
              const t = draft.tools.find((x) => x.kind === kind)!;
              return (
                <tr key={kind}>
                  <td className="border border-gray-200 bg-gray-50 px-2 sm:px-1.5 py-2 sm:py-0.5 text-[12px] sm:text-[10px] uppercase text-gray-600 font-medium whitespace-nowrap">{label}</td>
                  <td className="border border-gray-200 p-0"><input disabled={disabled} className={cell} value={t.type ?? ""} onChange={(e) => setTool(kind, "type", e.target.value || null)} /></td>
                  <td className="border border-gray-200 p-0"><input disabled={disabled} className={cell} value={t.size ?? ""} onChange={(e) => setTool(kind, "size", e.target.value || null)} /></td>
                  <td className="border border-gray-200 p-0"><input disabled={disabled} className={cell} value={t.serialNo ?? ""} onChange={(e) => setTool(kind, "serialNo", e.target.value || null)} /></td>
                  <td className="border border-gray-200 p-0"><input type="number" inputMode="decimal" step="any" disabled={disabled} className={`${cell} tabular-nums`} value={t.hours ?? ""} onChange={(e) => setTool(kind, "hours", e.target.value === "" ? null : Number(e.target.value))} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="px-2 py-2 text-xs sm:text-[10px] text-gray-400">Leave a tool row blank when it isn't in the string.</p>
    </>
  );
}

function MudSubform({ draft, set, setMud, disabled }: SubformProps & {
  setMud: <K extends keyof NonNullable<ReportBody["mud"]>>(key: K, value: NonNullable<ReportBody["mud"]>[K]) => void;
}) {
  const m = draft.mud ?? EMPTY_MUD;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2">
      <div className="md:border-r border-gray-200">
        <Section>Mud properties</Section>
        <TextField label="Mud system" value={m.mudSystem} onChange={(v) => setMud("mudSystem", v)} disabled={disabled} placeholder="KCl-Polymer" />
        <TextField label="Rep. time" value={m.reportTime} onChange={(v) => setMud("reportTime", v)} disabled={disabled} placeholder="06:00" />
        {/* The check's own depth / mud-weight range / flowline temperature head the
            block. The weight is ONE range in ppg: a report quoting a single
            density fills both ends with it. */}
        <NumField label="Check depth" unit="mKB" value={m.depthMkb} onChange={(v) => setMud("depthMkb", v)} disabled={disabled} />
        <NumField label="MW min" unit="ppg" value={m.densityMinPpg} onChange={(v) => setMud("densityMinPpg", v)} disabled={disabled} />
        <NumField label="MW max" unit="ppg" value={m.densityMaxPpg} onChange={(v) => setMud("densityMaxPpg", v)} disabled={disabled} />
        <NumField label="T flowline" unit="°C" value={m.tFlowlineC} onChange={(v) => setMud("tFlowlineC", v)} disabled={disabled} />
        <NumField label="Funnel visc" unit="s/qt" value={m.funnelVisc} onChange={(v) => setMud("funnelVisc", v)} disabled={disabled} />
        <NumField label="PV" unit="cp" value={m.pv} onChange={(v) => setMud("pv", v)} disabled={disabled} />
        <NumField label="YP" unit="lbf/100ft²" value={m.yp} onChange={(v) => setMud("yp", v)} disabled={disabled} />
        <NumField label="Gel initial" unit="lbf/100ft²" value={m.gelInitial} onChange={(v) => setMud("gelInitial", v)} disabled={disabled} />
        <NumField label="Gel 10 min" unit="lbf/100ft²" value={m.gel10min} onChange={(v) => setMud("gel10min", v)} disabled={disabled} />
        <NumField label="Fan 600" value={m.fan600} onChange={(v) => setMud("fan600", v)} disabled={disabled} />
        <NumField label="Fan 300" value={m.fan300} onChange={(v) => setMud("fan300", v)} disabled={disabled} />
        <NumField label="Vis 3 rpm" value={m.vis3rpm} onChange={(v) => setMud("vis3rpm", v)} disabled={disabled} />
        <NumField label="Vis 6 rpm" value={m.vis6rpm} onChange={(v) => setMud("vis6rpm", v)} disabled={disabled} />
        <NumField label="pH" value={m.ph} onChange={(v) => setMud("ph", v)} disabled={disabled} />
        <NumField label="ALK" value={m.alkalinity} onChange={(v) => setMud("alkalinity", v)} disabled={disabled} />
        {/* Filtrate IS the water loss — one field, under a.json's name and unit. */}
        <NumField label="Filtrate" unit="ml/30min" value={m.filtrateMl} onChange={(v) => setMud("filtrateMl", v)} disabled={disabled} />
      </div>
      <div>
        <Section>Mud chemistry</Section>
        <NumField label="HPHT" value={m.hpht} onChange={(v) => setMud("hpht", v)} disabled={disabled} />
        <NumField label="Air / foam" unit="CFM" value={m.airFoam} onChange={(v) => setMud("airFoam", v)} disabled={disabled} />
        <NumField label="Oil %" value={m.oilPct} onChange={(v) => setMud("oilPct", v)} disabled={disabled} />
        <NumField label="Water %" value={m.percentWater} onChange={(v) => setMud("percentWater", v)} disabled={disabled} />
        <TextField label="O:W ratio" value={m.oilWaterRatio} onChange={(v) => setMud("oilWaterRatio", v)} disabled={disabled} placeholder="70/30" />
        <NumField label="E-stability" unit="V" value={m.eStability} onChange={(v) => setMud("eStability", v)} disabled={disabled} />
        <NumField label="KCl" unit="lb/bbl" value={m.kcl} onChange={(v) => setMud("kcl", v)} disabled={disabled} />
        <NumField label="MBT" unit="lb/bbl" value={m.mbt} onChange={(v) => setMud("mbt", v)} disabled={disabled} />
        <NumField label="PF" value={m.pf} onChange={(v) => setMud("pf", v)} disabled={disabled} />
        <NumField label="MF" value={m.mf} onChange={(v) => setMud("mf", v)} disabled={disabled} />
        <NumField label="Chloride" unit="mg/l" value={m.chloride} onChange={(v) => setMud("chloride", v)} disabled={disabled} />
        {/* Hardness (Ca) IS the calcium reading, in the same ppm; the flowline
            temperature above is the day's mud temperature, in °C. */}
        <NumField label="Hardness (Ca)" unit="ppm" value={m.hardnessCaPpm} onChange={(v) => setMud("hardnessCaPpm", v)} disabled={disabled} />
        <NumField label="Retort solids" unit="%" value={m.solidsPct} onChange={(v) => setMud("solidsPct", v)} disabled={disabled} />
        <NumField label="Low-gravity solids" unit="%" value={m.lowGravitySolidsPct} onChange={(v) => setMud("lowGravitySolidsPct", v)} disabled={disabled} />

        <Section>Mud volume balance</Section>
        <NumField label="Formation loss" unit="bbl" value={draft.formationLoss} onChange={(v) => set("formationLoss", v)} disabled={disabled} />
        <NumField label="Loss @ units" unit="bbl" value={draft.mudLossUnit} onChange={(v) => set("mudLossUnit", v)} disabled={disabled} />
        <NumField label="Mud gains" unit="bbl" value={draft.mudGains} onChange={(v) => set("mudGains", v)} disabled={disabled} />
        <NumField label="Mud lost to hole" unit="bbl" value={m.mudLostBbl} onChange={(v) => setMud("mudLostBbl", v)} disabled={disabled} />
        <NumField label="Active volume" unit="bbl" value={m.activeMudVolBbl} onChange={(v) => setMud("activeMudVolBbl", v)} disabled={disabled} />
        <NumField label="Reserve volume" unit="bbl" value={m.volMudResBbl} onChange={(v) => setMud("volMudResBbl", v)} disabled={disabled} />
      </div>
    </div>
  );
}

function SolidControlSubform({ draft, setSc, disabled }: SubformProps & {
  setSc: (unit: string, key: keyof SolidControlRow, value: number | null) => void;
}) {
  const keys: (keyof SolidControlRow)[] = ["hours", "underFlow", "overFlow", "feed", "cons", "fprs"];
  return (
    <>
      <Section>Solid control</Section>
      {/* Seven fixed columns: scrolls sideways on a phone rather than crushing
          the number inputs below the 44px / 16px minimums. */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] sm:min-w-0 text-[13px] border-collapse">
          <thead>
            <tr>{["Unit", "HRS", "U.F.", "O.F.", "FEED", "CONS", "F.PRS."].map((h) => (
              <th key={h} className="bg-gray-50 border border-gray-200 px-2 sm:px-1.5 py-1.5 sm:py-1 text-left text-[11px] sm:text-[10px] font-medium uppercase tracking-wide text-gray-500 whitespace-nowrap">{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {SC_UNITS.map((unit) => {
              const r = draft.solidControl.find((s) => s.unit === unit)!;
              return (
                <tr key={unit}>
                  <td className="border border-gray-200 bg-gray-50 px-2 sm:px-1.5 py-2 sm:py-0.5 text-[12px] sm:text-[10px] uppercase text-gray-600 font-medium whitespace-nowrap">{unit}</td>
                  {keys.map((k) => (
                    <td key={k} className="border border-gray-200 p-0">
                      <input type="number" inputMode="decimal" step="any" disabled={disabled}
                        className="w-full min-w-0 bg-transparent border-0 tabular-nums text-base min-h-[44px] px-2 py-2 sm:text-[13px] sm:min-h-[32px] sm:px-1.5 sm:py-1 focus:outline-none focus:bg-blue-50"
                        value={(r[k] as number | null) ?? ""}
                        onChange={(e) => setSc(unit, k, e.target.value === "" ? null : Number(e.target.value))} />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="px-2 py-2 text-xs sm:text-[10px] text-gray-400">
        The three units are fixed on the DR sheet — leave a row blank when the unit didn't run.
      </p>
    </>
  );
}

function Chemicals({ draft, set, disabled }: SubformProps) {
  return (
    <>
      <Section>Chemical materials</Section>
      <RowTable
        cols={[
          { key: "material", label: "Material" },
          { key: "unit", label: "Unit", width: "w-20" },
          { key: "used", label: "Used", type: "num", width: "w-20" },
          { key: "received", label: "Rec.", type: "num", width: "w-20" },
          { key: "stock", label: "Stock", type: "num", width: "w-20" },
          { key: "outstanding", label: "O/S", type: "num", width: "w-20" },
          { key: "requested", label: "Req", type: "num", width: "w-20" },
          { key: "sent", label: "Sent", type: "num", width: "w-20" },
        ] as Col<ReportBody["chemicals"][number]>[]}
        rows={draft.chemicals} onChange={(v) => set("chemicals", v)} disabled={disabled} minRows={3}
        addLabel="material"
        blank={() => ({ order: 0, material: null, unit: null, used: null, received: null, stock: null, outstanding: null, requested: null, sent: null })}
      />
    </>
  );
}

function CasingSubform({ draft, set, disabled }: SubformProps) {
  return (
    <>
      <Section>Casing / liner run</Section>
      <RowTable
        cols={[
          { key: "casing", label: "Casing" },
          { key: "runDate", label: "Run date", width: "w-28", title: "The date the string was run, as it prints on the sheet" },
          { key: "topMkb", label: "Top (mKB)", type: "num", width: "w-28", title: "Top of the string — 0 for a casing, the hanger depth for a liner" },
          // a.json set_depth_mkb — the shoe. This is the existing `depth` column,
          // relabelled: a string has a top AND a set depth, so "Depth" alone was
          // ambiguous once the top column arrived.
          { key: "depth", label: "Set depth (mKB)", type: "num", width: "w-28", title: "Shoe depth" },
          { key: "joints", label: "Joints", type: "num", width: "w-24" },
          { key: "com", label: "Com" },
        ] as Col<ReportBody["casing"][number]>[]}
        rows={draft.casing} onChange={(v) => set("casing", v)} disabled={disabled} minRows={1}
        addLabel="casing run"
        blank={() => ({ order: 0, casing: null, runDate: null, topMkb: null, depth: null, joints: null, com: null })}
      />
      <p className="px-2 pb-2 text-xs sm:text-[10px] text-gray-400">Only the strings run on this day — the office carries the deepest one forward as "last casing".</p>
    </>
  );
}

/**
 * a.json `formations` — prognosed top against the top that actually came in.
 *
 * The two depths are the whole point of the block, so they sit side by side:
 * `progTopMd` is what the drilling programme forecast, and the existing `depth`
 * column IS `final_top_md_mkb`, where the formation was really picked. Never
 * write one into the other.
 */
function FormationTops({ draft, set, disabled }: SubformProps) {
  return (
    <>
      <Section right={<span className="font-normal normal-case text-[11px] sm:text-[9px] opacity-70">prognosed vs actual</span>}>Formation tops</Section>
      <RowTable
        cols={[
          { key: "formation", label: "Formation" },
          { key: "progTopMd", label: "Prog. top MD (mKB)", type: "num", width: "w-28", title: "Prognosed top from the drilling programme" },
          { key: "depth", label: "Final top MD (mKB)", type: "num", width: "w-28", title: "Where the top actually came in" },
          { key: "finalTopTvd", label: "Final top TVD (mKB)", type: "num", width: "w-28" },
          { key: "thickM", label: "Thick (m)", type: "num", width: "w-24" },
          { key: "drilledRopMHr", label: "Drilled ROP (m/hr)", type: "num", width: "w-28" },
          { key: "lithDes", label: "Lith. des", width: "w-32", title: "Comma-separated lithology codes, e.g. Lst,Mrl,Clst,Gyp" },
          { key: "secondDepth", label: "Second depth", type: "num", width: "w-28" },
          { key: "type", label: "Type", width: "w-32" },
        ] as Col<ReportBody["formationTops"][number]>[]}
        rows={draft.formationTops} onChange={(v) => set("formationTops", v)} disabled={disabled} minRows={1}
        addLabel="formation top"
        blank={() => ({
          order: 0, formation: null, progTopMd: null, depth: null, finalTopTvd: null,
          thickM: null, drilledRopMHr: null, lithDes: null, secondDepth: null, type: null,
        })}
      />
    </>
  );
}

function Surveys({ draft, set, disabled }: SubformProps) {
  return (
    <>
      <Section right={<span className="font-normal normal-case text-[11px] sm:text-[9px] opacity-70">deepest station last</span>}>Last survey data</Section>
      <RowTable
        cols={[
          { key: "md", label: "MD (mKB)", type: "num" },
          { key: "inc", label: "Incl (°)", type: "num" },
          { key: "azi", label: "Azm (°)", type: "num" },
          { key: "tvd", label: "TVD (mKB)", type: "num" },
          { key: "ns", label: "NS (m)", type: "num", signed: true },
          { key: "ew", label: "EW (m)", type: "num", signed: true },
          { key: "vs", label: "VS (m)", type: "num", signed: true, title: "Vertical section — negative behind the VS reference azimuth" },
          { key: "dls", label: "DLS (°/30m)", type: "num" },
          { key: "build", label: "Build (°/30m)", type: "num", signed: true },
        ] as Col<ReportBody["surveys"][number]>[]}
        rows={draft.surveys} onChange={(v) => set("surveys", v)} disabled={disabled} minRows={2}
        addLabel="survey station"
        blank={() => ({ order: 0, md: null, inc: null, azi: null, tvd: null, ns: null, ew: null, vs: null, dls: null, build: null })}
      />
    </>
  );
}

function TimeBreakdown({ draft, set, disabled }: SubformProps) {
  const total = draft.timeBreakdown.reduce((a, t) => a + (t.hours ?? 0), 0);
  const off = Math.abs(total - 24) > 0.01 && total > 0;
  return (
    <>
      <Section right={<span className={`font-normal normal-case text-[11px] sm:text-[9px] ${off ? "text-amber-700" : "opacity-70"}`}>
        {total.toFixed(1)} h of 24{off ? " — doesn't add up to the day" : ""}
      </span>}>Time breakdown</Section>
      <RowTable
        cols={[
          { key: "group", label: "Group" },
          { key: "type", label: "Type" },
          { key: "activity", label: "Activity" },
          { key: "hours", label: "Hours", type: "num", width: "w-24" },
        ] as Col<ReportBody["timeBreakdown"][number]>[]}
        rows={draft.timeBreakdown} onChange={(v) => set("timeBreakdown", v)} disabled={disabled} minRows={3}
        addLabel="activity" blank={() => ({ order: 0, group: null, type: null, activity: null, hours: null })}
      />
    </>
  );
}

function OperationsLog({ draft, set, disabled }: SubformProps) {
  return (
    <>
      <Section right={<span className="font-normal normal-case text-[11px] sm:text-[9px] opacity-70">midnight to midnight</span>}>Operations log</Section>
      <RowTable
        cols={[
          { key: "fromTime", label: "From", width: "w-20", placeholder: "00:00" },
          { key: "toTime", label: "To", width: "w-20", placeholder: "01:45" },
          { key: "opCode", label: "Op code", width: "w-20", title: "The composite code as printed, e.g. E3-P" },
          { key: "opLetter", label: "Letter", width: "w-16", title: "Main operation A–U (advisory — an unlisted code still saves)" },
          { key: "opDetail", label: "Detail", width: "w-16", title: "Operation detail 01–33" },
          { key: "timeIndicator", label: "P/U/T/X/N", width: "w-16", title: "Time-classification indicator" },
          { key: "opCode2", label: "Code 2", width: "w-20", title: "The alpha code printed beside the numeric one, e.g. CSG" },
          { key: "isProblem", label: "Problem?", type: "bool", width: "w-16" },
          { key: "probHr", label: "Prob hrs", type: "num", width: "w-20" },
          { key: "problemRef", label: "Prob ref #", type: "int", width: "w-20",
            title: "Which Interval Problem row this belongs to — 1 is the first row on the Events tab" },
          { key: "remarks", label: "Remarks" },
        ] as Col<ReportBody["operations"][number]>[]}
        rows={draft.operations} onChange={(v) => set("operations", v)} disabled={disabled} minRows={3}
        addLabel="operation" testId="op"
        blank={() => ({
          order: 0, opCode: null, opLetter: null, opDetail: null, timeIndicator: null,
          opCode2: null, isProblem: null, probHr: null, problemRef: null,
          fromTime: null, toTime: null, remarks: null,
        })}
      />
      <p className="px-2 py-2 text-xs sm:text-[10px] text-gray-400 leading-snug">
        Durations are not typed: the report derives each row&rsquo;s hours from its own From and To,
        and the cumulative column from the rows above it. A row whose two times are equal counts as
        no duration at all rather than as zero hours.
      </p>
    </>
  );
}

/**
 * Events & HSE — what reports 06 and 07 print that the DR.xls sheet never had a
 * place for: the day's problems, its safety checks and incidents, and the mud
 * that moved.
 *
 * The problems come first because the operations log points AT them: a log row's
 * "Prob ref #" is the 1-based position of a row in this table.
 */
/**
 * The wellsite GEOLOGIST's sheet — report 18.
 *
 * One tab rather than columns scattered through the driller's, because it is
 * written by a different person about different things. The gas readings sit
 * beside the geologist's narrative for the same reason: they are what that
 * narrative is usually about.
 *
 * Shows are ONE table with a Kind column, not two. Every field but the gas
 * readings is common to an oil show and a gas show, and splitting them would
 * make a geologist decide which grid to open before they know what they have.
 */
function GeologySubform({ draft, set, disabled }: SubformProps) {
  const gas = (label: string, avg: keyof ReportBody, max: keyof ReportBody) => (
    <div className="grid grid-cols-2" key={label}>
      <NumField label={`Avg ${label} gas (%)`} disabled={disabled}
        value={draft[avg] as number | null} onChange={(v) => set(avg, v)} />
      <NumField label={`Max ${label} gas (%)`} disabled={disabled}
        value={draft[max] as number | null} onChange={(v) => set(max, v)} />
    </div>
  );

  return (
    <>
      <Section right={<span className="font-normal normal-case text-[11px] sm:text-[9px] opacity-70">report 18 · the mud logger's readings</span>}>
        Gas
      </Section>
      {gas("background", "avgBackgroundGasPct", "maxBackgroundGasPct")}
      {gas("connection", "avgConnectionGasPct", "maxConnectionGasPct")}
      {gas("trip", "avgTripGasPct", "maxTripGasPct")}
      {gas("drill", "avgDrillGasPct", "maxDrillGasPct")}
      <p className="px-2 py-2 text-xs sm:text-[10px] text-gray-400 leading-snug">
        Four kinds of gas, each with an average and a maximum. A 2% background with a 40% connection
        peak is a different well from one reading 2% flat, and one &ldquo;gas&rdquo; figure cannot say
        which you have.
      </p>

      <Section>Geological narrative</Section>
      <TextField label="Geological activity at report time" multiline disabled={disabled}
        value={draft.geoActivityAtReportTime} onChange={(v) => set("geoActivityAtReportTime", v)} />
      <TextField label="Geological ops this report period" multiline disabled={disabled}
        value={draft.geoOpsThisPeriod} onChange={(v) => set("geoOpsThisPeriod", v)} />
      <TextField label="Geological ops next report period" multiline disabled={disabled}
        value={draft.geoOpsNextPeriod} onChange={(v) => set("geoOpsNextPeriod", v)} />
      <p className="px-2 py-2 text-xs sm:text-[10px] text-gray-400 leading-snug">
        The geologist&rsquo;s own narrative. The driller&rsquo;s three &mdash; operations at report
        time, the 24-hour summary and the plan ahead &mdash; stay on Operations narrative and Summary
        &amp; weather; report 18 prints only these.
      </p>

      <Section>Sample descriptions</Section>
      <RowTable
        cols={[
          { key: "topMkb", label: "Top (mKB)", type: "num", width: "w-28" },
          { key: "btmMkb", label: "Btm (mKB)", type: "num", width: "w-28" },
          { key: "volCaPct", label: "Vol Ca (%)", type: "num", width: "w-24" },
          { key: "volMgPct", label: "Vol Mg (%)", type: "num", width: "w-24" },
          { key: "com", label: "Com" },
        ] as Col<ReportBody["sampleDescriptions"][number]>[]}
        rows={draft.sampleDescriptions} onChange={(v) => set("sampleDescriptions", v)}
        disabled={disabled} minRows={2} addLabel="sample" testId="sample"
        blank={() => ({ order: 0, topMkb: null, btmMkb: null, volCaPct: null, volMgPct: null, com: null })}
      />

      <Section>Lithology</Section>
      <RowTable
        cols={[
          { key: "topMkb", label: "Top (mKB)", type: "num", width: "w-28" },
          { key: "btmMkb", label: "Btm (mKB)", type: "num", width: "w-28" },
          { key: "des", label: "Des", width: "w-48", placeholder: "Lst, arg, mdm hd" },
          { key: "volPct", label: "Vol (%)", type: "num", width: "w-24",
            title: "Percent of the interval this lithology makes up" },
          { key: "type", label: "Type", type: "select", width: "w-32",
            options: ["Sandstone", "Shale", "Limestone", "Dolomite", "Anhydrite", "Salt", "Marl", "Claystone", "Coal"]
              .map((v) => ({ value: v, label: v })) },
          { key: "typeCode", label: "Type code", width: "w-24", placeholder: "Lst" },
        ] as Col<ReportBody["lithologyLog"][number]>[]}
        rows={draft.lithologyLog} onChange={(v) => set("lithologyLog", v)}
        disabled={disabled} minRows={2} addLabel="interval" testId="litho"
        blank={() => ({ order: 0, topMkb: null, btmMkb: null, des: null, volPct: null, type: null, typeCode: null })}
      />
      <p className="px-2 py-2 text-xs sm:text-[10px] text-gray-400 leading-snug">
        The mud logger&rsquo;s interval log, which is not the free-text lithology on Well /
        Operations &mdash; that one is the driller&rsquo;s summary of the day, this is what the
        cuttings actually were, metre by metre. Report 21 draws its lithology track from these.
      </p>

      <Section right={<span className="font-normal normal-case text-[11px] sm:text-[9px] opacity-70">oil and gas, one table</span>}>
        Shows
      </Section>
      <RowTable
        cols={[
          { key: "kind", label: "Kind", type: "select", width: "w-20",
            options: [{ value: "Oil", label: "Oil" }, { value: "Gas", label: "Gas" }],
            title: "Report 18 prints oil and gas shows as two blocks; this column is what splits them" },
          { key: "topMkb", label: "Top (mKB)", type: "num", width: "w-28" },
          { key: "btmMkb", label: "Btm (mKB)", type: "num", width: "w-28" },
          { key: "showType", label: "Show type", width: "w-32", placeholder: "Fluorescence" },
          { key: "showQuality", label: "Show quality", type: "select", width: "w-28",
            options: ["Poor", "Fair", "Good", "Excellent"].map((v) => ({ value: v, label: v })),
            title: "Oil shows" },
          { key: "showOrigin", label: "Show origin", width: "w-28", placeholder: "Cut", title: "Oil shows" },
          { key: "totalGasAvgPct", label: "Total gas avg (%)", type: "num", width: "w-24", title: "Gas shows" },
          { key: "totalGasMinPct", label: "Total gas min (%)", type: "num", width: "w-24", title: "Gas shows" },
          { key: "totalGasMaxPct", label: "Total gas max (%)", type: "num", width: "w-24", title: "Gas shows" },
        ] as Col<ReportBody["shows"][number]>[]}
        rows={draft.shows} onChange={(v) => set("shows", v)}
        disabled={disabled} minRows={2} addLabel="show" testId="show"
        blank={() => ({
          order: 0, kind: null, topMkb: null, btmMkb: null,
          showQuality: null, showOrigin: null, showType: null,
          totalGasAvgPct: null, totalGasMinPct: null, totalGasMaxPct: null,
        })}
      />

      <Section>Logs</Section>
      <RowTable
        cols={[
          { key: "time", label: "Time", width: "w-20", placeholder: "14:30" },
          { key: "runNo", label: "Run #", width: "w-20" },
          { key: "type", label: "Type", width: "w-40", placeholder: "Triple Combo" },
          { key: "topMkb", label: "Top (mKB)", type: "num", width: "w-28" },
          { key: "btmMkb", label: "Btm (mKB)", type: "num", width: "w-28" },
          { key: "loggingCompany", label: "Logging company", width: "w-40" },
        ] as Col<ReportBody["logRuns"][number]>[]}
        rows={draft.logRuns} onChange={(v) => set("logRuns", v)}
        disabled={disabled} minRows={1} addLabel="log run" testId="logrun"
        blank={() => ({ order: 0, time: null, runNo: null, type: null, topMkb: null, btmMkb: null, loggingCompany: null })}
      />
    </>
  );
}

function EventsAndHse({ draft, set, disabled }: SubformProps) {
  return (
    <>
      <Section right={<span className="font-normal normal-case text-[11px] sm:text-[9px] opacity-70">report 07 · the operations log references these by row number</span>}>
        Interval problems
      </Section>
      <RowTable
        cols={[
          { key: "problemType", label: "Problem type", type: "select", width: "w-40",
            options: ["Equipment Trouble", "Hole Trouble", "Rig Failure", "Logistical", "Weather", "Well Control", "Other"]
              .map((v) => ({ value: v, label: v })) },
          { key: "problemSubType", label: "Sub type", width: "w-32" },
          { key: "startDate", label: "Start date", width: "w-28", placeholder: "1405/02/11" },
          { key: "startTime", label: "Start time", width: "w-20", placeholder: "18:15" },
          { key: "startDepthMkb", label: "Start depth (mKB)", type: "num", width: "w-24" },
          { key: "endDepthMkb", label: "End depth (mKB)", type: "num", width: "w-24" },
          { key: "accountableParty", label: "Accountable party", width: "w-32",
            title: "Who the cost is charged to — report 15 pivots problem cost on this" },
          { key: "estCost", label: "Est cost", type: "num", width: "w-24" },
          { key: "estLostTimeHr", label: "Est lost time (hr)", type: "num", width: "w-24" },
          { key: "comment", label: "Comment" },
        ] as Col<ReportBody["intervalProblems"][number]>[]}
        rows={draft.intervalProblems} onChange={(v) => set("intervalProblems", v)}
        disabled={disabled} minRows={2} addLabel="problem" testId="problem"
        blank={() => ({
          order: 0, problemType: null, problemSubType: null, startDate: null, startTime: null,
          startDepthMkb: null, endDepthMkb: null, accountableParty: null,
          estCost: null, estLostTimeHr: null, comment: null,
        })}
      />

      <Section right={<span className="font-normal normal-case text-[11px] sm:text-[9px] opacity-70">report 06 sidebar</span>}>
        Safety checks
      </Section>
      <RowTable
        cols={[
          { key: "time", label: "Time", width: "w-20", placeholder: "02:15" },
          { key: "type", label: "Type", type: "select", width: "w-36",
            options: ["Safety Meeting", "BOP Drill", "Choke Drill", "H2S Drill", "Fire Drill", "Abandon Drill"]
              .map((v) => ({ value: v, label: v })) },
          { key: "des", label: "Description" },
        ] as Col<ReportBody["safetyChecks"][number]>[]}
        rows={draft.safetyChecks} onChange={(v) => set("safetyChecks", v)}
        disabled={disabled} minRows={2} addLabel="check" testId="check"
        blank={() => ({ order: 0, time: null, type: null, des: null })}
      />
      <p className="px-2 py-1.5 text-xs sm:text-[10px] text-gray-400 leading-snug">
        These are the checks that happened TODAY. The recurring drill schedule — BOP test, H2S, fire,
        abandon — stays on the HSE &amp; bulk tab; report 07 prints that as its Safety Check Summary.
      </p>

      <Section right={<span className="font-normal normal-case text-[11px] sm:text-[9px] opacity-70">report 07 page 2</span>}>
        Safety incidents
      </Section>
      <RowTable
        cols={[
          { key: "time", label: "Time", width: "w-20", placeholder: "18:20" },
          { key: "category", label: "Category", type: "select", width: "w-28",
            options: ["Near Miss", "Unsafe Activity", "First Aid", "Illness", "Incident", "Accident"]
              .map((v) => ({ value: v, label: v })),
            title: "Report 17 prints this as its \"Type\" column" },
          { key: "type", label: "Type", width: "w-28" },
          { key: "subType", label: "Sub type", width: "w-28" },
          { key: "cause", label: "Cause" },
          { key: "lostTime", label: "Lost time?", type: "bool", width: "w-20" },
          { key: "severity", label: "Severity", width: "w-24" },
          { key: "com", label: "Com",
            title: "What happened, in full — report 17 is essentially this column" },
        ] as Col<ReportBody["safetyIncidents"][number]>[]}
        rows={draft.safetyIncidents} onChange={(v) => set("safetyIncidents", v)}
        disabled={disabled} minRows={2} addLabel="incident" testId="incident"
        blank={() => ({
          order: 0, time: null, category: null, type: null, subType: null,
          cause: null, lostTime: null, severity: null, com: null,
        })}
      />

      <Section right={<span className="font-normal normal-case text-[11px] sm:text-[9px] opacity-70">report 07 · what MOVED, not the pit state</span>}>
        Drilling mud volumes
      </Section>
      <RowTable
        cols={[
          { key: "action", label: "Action", title: "e.g. Mixed new mud, Transferred to reserve" },
          { key: "toWellBbl", label: "To well (bbl)", type: "num", width: "w-28" },
          { key: "fromWellBbl", label: "From well (bbl)", type: "num", width: "w-28" },
        ] as Col<ReportBody["mudVolumes"][number]>[]}
        rows={draft.mudVolumes} onChange={(v) => set("mudVolumes", v)}
        disabled={disabled} minRows={2} addLabel="movement" testId="mudvol"
        blank={() => ({ order: 0, action: null, toWellBbl: null, fromWellBbl: null })}
      />
      <p className="px-2 py-2 text-xs sm:text-[10px] text-gray-400 leading-snug">
        The running totals the report prints are derived down this table — only the movements are typed.
        The active, reserve and lost volumes are the pit STATE and stay on the mud tab.
      </p>
    </>
  );
}

function SummaryWeather({ draft, set, disabled }: SubformProps) {
  return (
    <>
      <Section>Summary</Section>
      <textarea rows={8} disabled={disabled} value={draft.description ?? ""}
        onChange={(e) => set("description", e.target.value || null)}
        placeholder="The day's narrative — what was drilled, what happened, what is planned next."
        className="w-full px-3 sm:px-2 py-2 sm:py-1.5 text-base sm:text-[13px] leading-relaxed sm:leading-normal border-0 focus:outline-none focus:bg-blue-50 focus:ring-1 focus:ring-inset focus:ring-blue-400 resize-y" />
      <Section>Weather &amp; consumables</Section>
      <div className="grid grid-cols-1 md:grid-cols-2">
        <div className="md:border-r border-gray-200">
          <TextField label="Wind speed/dir" value={draft.windSpeedDir} onChange={(v) => set("windSpeedDir", v)} disabled={disabled} placeholder="12 kt NW" />
          <TextField label="Wave / vis" value={draft.waveVisible} onChange={(v) => set("waveVisible", v)} disabled={disabled} />
          <TextField label="Weather" value={draft.weather} onChange={(v) => set("weather", v)} disabled={disabled} placeholder="Clear" />
          <NumField label="Temperature" unit="°C" value={draft.temperatureC} onChange={(v) => set("temperatureC", v)} disabled={disabled} signed />
        </div>
        <div>
          <NumField label="Fresh water" unit="bbl" value={draft.freshWater} onChange={(v) => set("freshWater", v)} disabled={disabled} />
          <NumField label="Fuel" unit="L" value={draft.fuel} onChange={(v) => set("fuel", v)} disabled={disabled} />
          <TextField label="Road condition" value={draft.roadCondition} onChange={(v) => set("roadCondition", v)} disabled={disabled} placeholder="Dry" />
          <TextField label="Hole condition" value={draft.holeCondition} onChange={(v) => set("holeCondition", v)} disabled={disabled} placeholder="Good" />
        </div>
      </div>
    </>
  );
}

/**
 * a.json `supervisors_contact` + `onboard_companies` — who to ring, and who is
 * on board. The company counts add up to the day's POB, so the total is derived
 * here rather than typed a second time (the head-count field on the Well tab is
 * the rig's own figure and is left alone).
 */
function CrewAndCompanies({ draft, set, disabled }: SubformProps) {
  const pob = draft.companies.reduce((a, c) => a + (c.count ?? 0), 0);
  return (
    <>
      <Section right={<span className="font-normal normal-case text-[11px] sm:text-[9px] opacity-70">who to call from the rig</span>}>Supervisors contact</Section>
      <RowTable
        cols={[
          { key: "jobContact", label: "Job contact" },
          { key: "position", label: "Position" },
          { key: "mobile", label: "Mobile", width: "w-36", title: "Reports 06 and 07 print this as the Daily Contacts list" },
        ] as Col<ReportBody["supervisors"][number]>[]}
        rows={draft.supervisors} onChange={(v) => set("supervisors", v)} disabled={disabled} minRows={2}
        addLabel="contact" blank={() => ({ order: 0, jobContact: null, position: null, mobile: null })}
      />
      <Section>On-board companies</Section>
      <RowTable
        cols={[
          { key: "company", label: "Company" },
          { key: "count", label: "Count", type: "int", width: "w-20", title: "Persons from this company (whole number)" },
          { key: "note", label: "Note", title: "Role, e.g. Client / Operator / Drilling Unit Service" },
          { key: "personnelType", label: "Personnel type", type: "select", width: "w-32",
            options: ["Contractor", "Service", "Operator"].map((v) => ({ value: v, label: v })),
            title: "Report 07's Personnel Log groups the day's people by this" },
          { key: "totWorkTimeHr", label: "Tot work time (hr)", type: "num", width: "w-24" },
        ] as Col<ReportBody["companies"][number]>[]}
        rows={draft.companies} onChange={(v) => set("companies", v)} disabled={disabled} minRows={3}
        addLabel="company"
        blank={() => ({ order: 0, company: null, count: null, note: null, personnelType: null, totWorkTimeHr: null })}
      />
      <DerivedField label="Total POB" value={pob > 0 ? pob : null} unit="persons" caption="(sum of the company counts)" />
      <p className="px-2 py-2 text-xs sm:text-[10px] text-gray-400 leading-snug">
        Counts are whole people — the total here is what the sheet prints as personnel on board.
      </p>
    </>
  );
}

/**
 * a.json `hse_drill_schedule` + `bulk_material`.
 *
 * The drill schedule is a FIXED four-row set keyed by type, rendered like the
 * solid-control table (label cell, then the inputs) because the rows are part of
 * the sheet's shape: they print blank when the drill wasn't held, and a blank
 * one is a real statement, not a missing row.
 */
function HseAndBulk({ draft, set, setHse, disabled }: SubformProps & {
  setHse: (type: string, key: keyof HseDrillRow, value: string | number | null) => void;
}) {
  const cell =
    "w-full min-w-0 bg-transparent border-0 text-base min-h-[44px] px-2 py-2 " +
    "sm:text-[13px] sm:min-h-[32px] sm:px-1.5 sm:py-1 focus:outline-none focus:bg-blue-50";
  return (
    <>
      <Section>HSE drill schedule</Section>
      {/* Three fixed columns — scrolls sideways on a phone rather than crushing
          the inputs below the 44px / 16px minimums. */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[28rem] sm:min-w-0 text-[13px] border-collapse">
          <thead>
            <tr>{["Drill", "Date", "Days to next check"].map((h) => (
              <th key={h} className="bg-gray-50 border border-gray-200 px-2 sm:px-1.5 py-1.5 sm:py-1 text-left text-[11px] sm:text-[10px] font-medium uppercase tracking-wide text-gray-500 whitespace-nowrap">{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {HSE_TYPES.map((type) => {
              const h = draft.hseDrills.find((x) => x.type === type)!;
              return (
                <tr key={type}>
                  <td className="border border-gray-200 bg-gray-50 px-2 sm:px-1.5 py-2 sm:py-0.5 text-[12px] sm:text-[10px] uppercase text-gray-600 font-medium whitespace-nowrap">{type}</td>
                  <td className="border border-gray-200 p-0">
                    <input disabled={disabled} className={cell} placeholder="4/30/2026"
                      value={h.date ?? ""} onChange={(e) => setHse(type, "date", e.target.value || null)} />
                  </td>
                  <td className="border border-gray-200 p-0">
                    <input type="number" inputMode="decimal" step="any" disabled={disabled} className={`${cell} tabular-nums`}
                      value={h.daysToNextCheck ?? ""}
                      onChange={(e) => setHse(type, "daysToNextCheck", e.target.value === "" ? null : Number(e.target.value))} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="px-2 py-2 text-xs sm:text-[10px] text-gray-400 leading-snug">
        The four drills are fixed on the sheet — leave a row blank when the drill wasn't due. The date is
        the last one held; days to next check counts down from it.
      </p>
      <Section>Bulk material</Section>
      <RowTable
        cols={[
          { key: "supplyItemDes", label: "Supply item" },
          { key: "unitLabel", label: "Unit", width: "w-20", title: "MT, liter, m3" },
          { key: "consumed", label: "Consumed", type: "num", width: "w-24" },
          { key: "received", label: "Received", type: "num", width: "w-24" },
          { key: "returned", label: "Returned", type: "num", width: "w-24" },
          { key: "onLoc", label: "On loc", type: "num", width: "w-24" },
          { key: "note", label: "Note" },
        ] as Col<ReportBody["bulkMaterials"][number]>[]}
        rows={draft.bulkMaterials} onChange={(v) => set("bulkMaterials", v)} disabled={disabled} minRows={3}
        addLabel="bulk item"
        blank={() => ({
          order: 0, supplyItemDes: null, unitLabel: null, consumed: null, received: null,
          returned: null, onLoc: null, note: null,
        })}
      />
    </>
  );
}

/**
 * a.json `wellhead_component` + `well_control_scr`.
 *
 * Two unrelated tables share a tab because both are written the same way: the
 * wellhead grows a row each time a spool or a head is landed, and the slow
 * circulation rates are re-taken at the same milestones (a new section, a new
 * mud weight). Neither is a daily entry, so neither earns a tab of its own.
 */
function WellheadAndScr({ draft, set, disabled }: SubformProps) {
  return (
    <>
      <Section right={<span className="font-normal normal-case text-[11px] sm:text-[9px] opacity-70">one row per component landed</span>}>Wellhead component</Section>
      <RowTable
        cols={[
          { key: "installDate", label: "Install date", width: "w-28", title: "As printed on the sheet, e.g. 4/30/2026" },
          { key: "sizeIn", label: "Size (in)", type: "num", width: "w-24" },
          { key: "type", label: "Type", width: "w-32", title: "Casing head, casing spool, tubing head, BOP…" },
          { key: "make", label: "Make", width: "w-28" },
          { key: "model", label: "Model", width: "w-28" },
          { key: "sn", label: "SN", width: "w-28", title: "Serial number — report 04 prints it, and it is what ties a spool to its certificate" },
          { key: "wpPsi", label: "WP (psi)", type: "num", width: "w-28", title: "Working pressure" },
          { key: "com", label: "Com" },
        ] as Col<ReportBody["wellheads"][number]>[]}
        rows={draft.wellheads} onChange={(v) => set("wellheads", v)} disabled={disabled} minRows={2}
        addLabel="wellhead component"
        blank={() => ({ order: 0, installDate: null, sizeIn: null, type: null, make: null, model: null, sn: null, wpPsi: null, com: null })}
      />
      <Section right={<span className="font-normal normal-case text-[11px] sm:text-[9px] opacity-70">slow circulation rates</span>}>Well control — SCR</Section>
      <RowTable
        cols={[
          { key: "pumpNo", label: "Pump #", width: "w-20" },
          { key: "depthMkb", label: "Depth (mKB)", type: "num", width: "w-28", title: "Depth the rate was taken at" },
          { key: "strokesSpm", label: "Strokes (spm)", type: "num", width: "w-28" },
          { key: "effPct", label: "Eff (%)", type: "num", width: "w-24", title: "Volumetric efficiency" },
          { key: "pPsi", label: "P (psi)", type: "num", width: "w-24", title: "Circulating pressure at that rate" },
          { key: "qFlowGpm", label: "Q flow (gpm)", type: "num", width: "w-28" },
        ] as Col<ReportBody["scrRates"][number]>[]}
        rows={draft.scrRates} onChange={(v) => set("scrRates", v)} disabled={disabled} minRows={2}
        addLabel="SCR rate"
        blank={() => ({ order: 0, pumpNo: null, depthMkb: null, strokesSpm: null, effPct: null, pPsi: null, qFlowGpm: null })}
      />
      <p className="px-2 py-2 text-xs sm:text-[10px] text-gray-400 leading-snug">
        One SCR row per pump and rate — the pressures are what a kill sheet is worked from, so record the
        depth they were taken at, not the depth at midnight.
      </p>
    </>
  );
}

/**
 * a.json `formation_integrity_test` — an OBJECT, not a list: one test block per
 * report, filled on the day the shoe is tested and blank on every other day.
 *
 * Rendered as a label/value block rather than a table for exactly that reason —
 * it is one reading, the way the mud check is, and it prints on the sheet as two
 * rows of labelled values.
 */
function FitSubform({ draft, setFit, disabled }: SubformProps & {
  setFit: <K extends keyof NonNullable<ReportBody["fit"]>>(key: K, value: NonNullable<ReportBody["fit"]>[K]) => void;
}) {
  const f = draft.fit ?? EMPTY_FIT;
  return (
    <>
      <Section right={<span className="font-normal normal-case text-[11px] sm:text-[9px] opacity-70">one test — leave blank on days with none</span>}>Formation integrity test</Section>
      <div className="grid grid-cols-1 md:grid-cols-2">
        <div className="md:border-r border-gray-200">
          <TextField label="Test type" value={f.testType} onChange={(v) => setFit("testType", v)} disabled={disabled} placeholder="FIT / LOT" />
          <TextField label="Test date" value={f.testDate} onChange={(v) => setFit("testDate", v)} disabled={disabled} placeholder="4/30/2026" />
          <TextField label="Last casing string run" value={f.lastCasingStringRun} onChange={(v) => setFit("lastCasingStringRun", v)} disabled={disabled} placeholder='13-3/8" @ 2105' />
          <NumField label="Depth" unit="mKB" value={f.depthMkb} onChange={(v) => setFit("depthMkb", v)} disabled={disabled} />
          <NumField label="TVD" unit="mKB" value={f.tvdMkb} onChange={(v) => setFit("tvdMkb", v)} disabled={disabled} />
        </div>
        <div>
          <NumField label="Applied surface pressure" unit="psi" value={f.appliedSurfacePressurePsi} onChange={(v) => setFit("appliedSurfacePressurePsi", v)} disabled={disabled} />
          <NumField label="Fluid density" unit="lb/gal" value={f.fluidDensityPpg} onChange={(v) => setFit("fluidDensityPpg", v)} disabled={disabled} />
          <NumField label="Volume pumped" unit="bbl" value={f.volumePumpedBbl} onChange={(v) => setFit("volumePumpedBbl", v)} disabled={disabled} />
          <NumField label="Leak-off pressure" unit="psi" value={f.leakOffPressurePsi} onChange={(v) => setFit("leakOffPressurePsi", v)} disabled={disabled} />
          <NumField label="Leak-off equivalent density" unit="lb/gal" value={f.leakOffEqDensityPpg} onChange={(v) => setFit("leakOffEqDensityPpg", v)} disabled={disabled} />
        </div>
      </div>
      <p className="px-2 py-2 text-xs sm:text-[10px] text-gray-400 leading-snug">
        The test is recorded on the day it is performed and left blank afterwards — it is not carried
        forward. The equivalent density is what the office uses as the section's fracture gradient.
      </p>
    </>
  );
}

/**
 * a.json `marine_conditions` (an OBJECT, like the FIT block) + `support_vessels`.
 *
 * Offshore-only: on a land rig the whole tab stays blank and nothing is posted.
 * These are the TYPED weather values — the "Wind speed/dir" and "Wave / vis"
 * boxes on the Summary tab are the DR.xls free-text equivalents of the same
 * readings, kept because the office sheet prints them as written.
 */
function MarineAndVessels({ draft, set, setMarine, disabled }: SubformProps & {
  setMarine: <K extends keyof NonNullable<ReportBody["marine"]>>(key: K, value: NonNullable<ReportBody["marine"]>[K]) => void;
}) {
  const m = draft.marine ?? EMPTY_MARINE;
  return (
    <>
      <Section right={<span className="font-normal normal-case text-[11px] sm:text-[9px] opacity-70">offshore only</span>}>Marine conditions</Section>
      <div className="grid grid-cols-1 md:grid-cols-2">
        <div className="md:border-r border-gray-200">
          <NumField label="Swell ht" unit="m" value={m.swellHtM} onChange={(v) => setMarine("swellHtM", v)} disabled={disabled} />
          <NumField label="Wave ht" unit="m" value={m.waveHtM} onChange={(v) => setMarine("waveHtM", v)} disabled={disabled} />
          <NumField label="Visibility" unit="km" value={m.visibilityKm} onChange={(v) => setMarine("visibilityKm", v)} disabled={disabled} />
          <NumField label="T high" unit="°C" signed value={m.tHighC} onChange={(v) => setMarine("tHighC", v)} disabled={disabled} />
        </div>
        <div>
          <TextField label="Wind dir" value={m.windDir} onChange={(v) => setMarine("windDir", v)} disabled={disabled} placeholder="NW" />
          <NumField label="Wind spd" unit="knots" value={m.windSpdKnots} onChange={(v) => setMarine("windSpdKnots", v)} disabled={disabled} />
          <TextField label="Com" multiline value={m.com} onChange={(v) => setMarine("com", v)} disabled={disabled} />
        </div>
      </div>
      <p className="px-2 py-2 text-xs sm:text-[10px] text-gray-400 leading-snug">
        These are the typed values. The DR.xls "Wind speed/dir" and "Wave / vis" boxes on the
        Summary &amp; weather tab are the office sheet's free-text equivalents of the same readings — fill
        whichever the office asks for, or both.
      </p>
      <Section right={<span className="font-normal normal-case text-[11px] sm:text-[9px] opacity-70">alongside or on standby</span>}>Support vessels</Section>
      <RowTable
        cols={[
          { key: "vesselName", label: "Vessel name" },
          { key: "vesselType", label: "Type", width: "w-32", title: "Supply, anchor handler, standby, crew boat…" },
          { key: "arrivalDate", label: "Arrival", width: "w-28", title: "As printed on the sheet" },
          { key: "departureDate", label: "Departure", width: "w-28" },
          { key: "note", label: "Note" },
        ] as Col<ReportBody["supportVessels"][number]>[]}
        rows={draft.supportVessels} onChange={(v) => set("supportVessels", v)} disabled={disabled} minRows={2}
        addLabel="vessel"
        blank={() => ({ order: 0, vesselName: null, vesselType: null, arrivalDate: null, departureDate: null, note: null })}
      />
    </>
  );
}
