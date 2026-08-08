/**
 * Client types for the WellView report suite — the job / AFE / cost entry API
 * and the report assemblers.
 *
 * These mirror `apps/api/src/routes/wellview.ts` and `apps/api/src/reports/*`
 * field for field. They ride on the same `entryApi` transport (and so the same
 * bearer token) as the daily editor.
 */
import { entryApi } from "./client.js";

// ── code tables ─────────────────────────────────────────────────────────────
export interface WvMainOperation {
  code: string; name: string; order: number;
  matrixLabel: string | null; onMatrix: boolean; riglessOnly: boolean; note: string | null;
}
export interface WvOperationDetail {
  code: string; num: number; name: string;
  definition: string | null; onMatrix: boolean; note: string | null;
}
export interface WvCodeTables {
  mainOperations: WvMainOperation[];
  operationDetails: WvOperationDetail[];
  /** letter → the detail numbers Tab. 7-1 marks for it. */
  validDetails: Record<string, number[]>;
  timeIndicators: { code: string; name: string; definition: string | null; order: number }[];
  reportCodes: { code: string; name: string; order: number }[];
  workingPhases: {
    code: string; name: string; purpose: string | null;
    startsAt: string | null; endsAt: string | null; order: number;
  }[];
}

// ── job sheet ───────────────────────────────────────────────────────────────
export interface JobPhasePlanRow {
  startDepth: number | null;
  endDepth: number | null;
  durMostLikelyDays: number | null;
  costMostLikely: number | null;
}
export interface JobPhaseRow {
  /** Client-minted for a new row, so a cost row can point at it before saving. */
  id: string | null;
  order: number;
  phaseType1: string | null;
  phaseType2: string | null;
  actualStartDate: string | null;
  actualEndDate: string | null;
  actualStartDepth: number | null;
  actualEndDepth: number | null;
  workingPhaseCode: string | null;
  plan: JobPhasePlanRow | null;
}
export interface AfeSupplementRow {
  id: string | null; order: number;
  number: string | null; amount: number | null; approvedDate: string | null;
}
export interface AfeLineRow {
  id: string | null; order: number;
  costCodeId: string | null; description: string | null; amount: number | null;
}
export interface AfeRow {
  id: string | null; order: number;
  afeNumber: string | null; description: string | null;
  amount: number | null; approvedDate: string | null;
  supplements: AfeSupplementRow[];
  lines: AfeLineRow[];
}
export interface CostItemRow {
  id: string | null; order: number;
  phaseId: string | null; costCodeId: string | null;
  afeLineId: string | null; supplementId: string | null;
  description: string | null;
  afeAmount: number | null; suppAmount: number | null;
  fieldEstimate: number | null; finalInvoice: number | null;
  category: string | null; costDate: string | null;
}

/** The job header — everything that is not a child table. */
export interface JobHeader {
  order: number;
  name: string | null;
  category: string | null;
  primaryJobType: string | null;
  secondaryJobType: string | null;
  status1: string | null;
  plannedStartDate: string | null;
  startDate: string | null;
  minPlannedEndDate: string | null;
  mostLikelyPlannedEndDate: string | null;
  maxPlannedEndDate: string | null;
  endDate: string | null;
  targetDepth: number | null;
  targetFormation: string | null;
  summary: string | null;
  possCostSave: number | null;
  possTimeSaveHr: number | null;
  estProblemCost: number | null;
  estLostTimeHr: number | null;
}

/** Exactly what `PUT /entry/jobs/:id` accepts. */
export interface JobBody extends JobHeader {
  phases: JobPhaseRow[];
  afes: AfeRow[];
  costItems: CostItemRow[];
}

export interface JobDetail extends JobBody {
  id: string;
  wellId: string;
  well?: { id: string; name: string; field: string | null; rig?: { name: string } };
}

export interface JobListItem {
  id: string; wellId: string; order: number;
  name: string | null; category: string | null; primaryJobType: string | null;
  status1: string | null; startDate: string | null; endDate: string | null;
  afes: { id: string; afeNumber: string | null; order: number }[];
  _count: { phases: number; costItems: number; reports: number };
}

export interface CostCode {
  id: string | null;
  code1: string | null;
  code2: string | null;
  description: string | null;
  projectScope: string | null;
  active: boolean;
}

// ── report payloads ─────────────────────────────────────────────────────────
export interface HeaderCell {
  label: string;
  value: string | number | null;
  kind?: "money" | "decimal" | "int" | "in3" | "text";
  span?: number;
}
export type HeaderRow = HeaderCell[];

export interface ReportEnvelope {
  type: string;
  title: string;
  wellName: string;
  identityRight?: string | null;
  headerVariant: "standard" | "dailyDrilling" | "wellJob" | "plot" | "summary" | "none";
  header: HeaderRow[];
  printedOn: string;
}

export interface CostSummaryRow {
  description: string | null;
  code1: string | null;
  code2: string | null;
  afeAmount: number | null;
  suppAmount: number | null;
  fieldEstimate: number | null;
  finalInvoice: number | null;
  variance: number | null;
}

export interface Report01Payload extends ReportEnvelope {
  job: HeaderRow;
  totals: HeaderRow;
  summary: string | null;
  costRows: CostSummaryRow[];
}

// ── reports 06 / 07 ─────────────────────────────────────────────────────────
export interface TimeLogRow {
  startTime: string | null; endTime: string | null;
  durHr: number | null; cumDurHr: number | null;
  code1: string | null; code2: string | null;
  isProblem: boolean; probHr: number | null; probRef: number | null;
  com: string | null;
}
export interface MudCheckBlock { caption: string; fields: HeaderRow[] }
export interface DrillStringBlock {
  caption: string;
  fields: HeaderRow;
  components: string | null;
  comment: string | null;
  tally: {
    itemDes: string | null; jts: number | null; odIn: number | null;
    idIn: number | null; lenM: number | null; topThread: string | null;
  }[];
}
export interface DrillingParamRow {
  wellbore: string | null;
  startMkb: number | null; endDepthMkb: number | null; cumDepthM: number | null;
  drillTimeHr: number | null; cumDrillTimeHr: number | null; intRopMHr: number | null;
  qFlowGpm: number | null; wob1000Lbf: number | null; rpm: number | null; sppPsi: number | null;
  drillStrWtKlbf: number | null; puStrWtKlbf: number | null; soStrWtKlbf: number | null;
  drillTq: number | null; offBottomTorque: number | null;
}
export interface PumpBlock { caption: string; fields: HeaderRow[] }

export interface DailyPayload extends ReportEnvelope {
  titleFields: HeaderRow;
  operations: HeaderRow[];
  timeLog: TimeLogRow[];
  timeLogTotalHr: number | null;
  mudChecks: MudCheckBlock[];
  drillStrings: DrillStringBlock[];
  drillingParameters: DrillingParamRow[];
  contacts: { jobContact: string | null; mobile: string | null }[];
  rigs: HeaderRow[];
  pumps: PumpBlock[];
  mudAdditives: { des: string | null; fieldEstPerUnit: number | null; consumed: number | null }[];
  safetyChecks: { time: string | null; type: string | null; des: string | null }[];
  wellbores: { name: string | null; koMdMkb: number | null }[];
  /** Present only on report 07. */
  detail?: {
    counters: HeaderRow[];
    personnelLog: { type: string | null; count: number | null; totWorkTimeHr: number | null }[];
    safetyCheckSummary: { type: string; lastDate: string | null; nextDate: string | null }[];
    mudVolumes: {
      action: string | null; toWellBbl: number | null; fromWellBbl: number | null;
      cumToWellBbl: number | null; cumFromWellBbl: number | null;
    }[];
    hydraulics: HeaderRow[];
    surveys: { mdMkb: number | null; inc: number | null; azm: number | null; tvdMkb: number | null }[];
    lastFormations: { name: string | null; progTopMd: number | null; drillTopMd: number | null }[];
    lastCasing: { description: string | null; runDate: string | null; setDepthMkb: number | null }[];
    kicks: {
      kickDate: string | null; kickDepthMkb: number | null; controlDate: string | null;
      controlDepthMkb: number | null; kickClass: string | null; killNotes: string | null;
    }[];
    lostCirculation: {
      startDate: string | null; topDepthMkb: number | null; bottomDepthMkb: number | null;
      opsInProg: string | null; volLostTotBbl: number | null; endDate: string | null;
    }[];
    problems: {
      problemType: string | null; problemSubType: string | null; startDate: string | null;
      startDepthMkb: number | null; endDepthMkb: number | null; accountableParty: string | null;
      estCost: number | null; estLostTimeHr: number | null; comment: string | null;
    }[];
    lessons: {
      lessonType: string | null; startDate: string | null; endDate: string | null;
      startDepthMkb: number | null; endDepthMkb: number | null;
      estCostSaving: number | null; estTimeSavingHr: number | null; comment: string | null;
    }[];
    incidents: {
      time: string | null; category: string | null; type: string | null; subType: string | null;
      cause: string | null; lostTime: boolean | null; severity: string | null;
    }[];
  };
}

// ── well- and rig-level registers ───────────────────────────────────────────
export interface WellboreRow { id: string | null; order: number; name: string | null; kind: string | null; koMdMkb: number | null }
export interface LessonRow {
  order: number; lessonType: string | null; startDate: string | null; endDate: string | null;
  startDepthMkb: number | null; endDepthMkb: number | null;
  estCostSaving: number | null; estTimeSavingHr: number | null; comment: string | null;
}
export interface KickRow {
  order: number; kickDate: string | null; kickTime: string | null; kickDepthMkb: number | null;
  controlDate: string | null; controlTime: string | null; controlDepthMkb: number | null;
  kickClass: string | null; killNotes: string | null;
}
export interface LostCirculationRow {
  order: number; startDate: string | null; topDepthMkb: number | null; bottomDepthMkb: number | null;
  opsInProg: string | null; volLostTotBbl: number | null; endDate: string | null;
}
export interface MudPumpRow {
  id: string | null; order: number; pumpNo: string | null; manufacturer: string | null;
  model: string | null; ratingHp: number | null; rodDiaIn: number | null; strokeIn: number | null;
  linerSizeIn: string | null; volPerStkBbl: number | null;
}
export interface BhaRunRow {
  id: string;
  /** Read-only here — the daily save owns the number and the name. */
  bhaNo: number | null;
  name: string | null;
  wellboreId: string | null;
  depthOutMkb: number | null;
  dateOut: string | null;
  timeOut: string | null;
  comment: string | null;
  sensors: { order: number; sensorType: string | null; distFromBitM: number | null; note: string | null }[];
}
/** One station of the directional PLAN — the actual comes from the daily surveys. */
export interface PlanStationRow {
  order: number; md: number | null; inc: number | null; azi: number | null;
  tvd: number | null; ns: number | null; ew: number | null; vs: number | null;
  dls: number | null; comment: string | null;
}
export interface WellRegisters {
  wellbores: WellboreRow[];
  bhaRuns: BhaRunRow[];
  lessons: LessonRow[];
  kicks: KickRow[];
  lostCirculation: LostCirculationRow[];
  mudPumps: MudPumpRow[];
  planStations: PlanStationRow[];
  rigId: string;
}

// ── reports 02 / 03 ─────────────────────────────────────────────────────────
export interface BhaComponentRow {
  jts: number | null; itemDes: string | null; odIn: number | null; idIn: number | null;
  massPerLenKgM: number | null; grade: string | null; driftIn: number | null;
  gaugeIn: number | null; connections: string | null; lenM: number | null; cumLenM: number | null;
}
export interface BhaParamRow {
  wellbore: string | null; startDate: string | null; endDate: string | null;
  drillTimeHr: number | null; startMkb: number | null; endDepthMkb: number | null;
  intDepthM: number | null; intRopMHr: number | null;
  wob1000Lbf: number | null; rpm: number | null; qFlowGpm: number | null; sppPsi: number | null;
}
export interface Report02Payload extends ReportEnvelope {
  runCaption: string;
  runHeader: HeaderRow;
  bitRow: HeaderRow;
  stringRow: HeaderRow;
  nozzles: string | null;
  comment: string | null;
  components: BhaComponentRow[];
  bitTypes: {
    bitType: string | null; make: string | null; model: string | null;
    serialNumber: string | null; iadcCodes: string | null;
    itemCost: number | null; lengthM: number | null;
  }[];
  drillingParameters: BhaParamRow[];
  bitNozzles: number[];
  sensors: { sensorType: string | null; distFromBitM: number | null; note: string | null }[];
  mudChecks: {
    date: string | null; depthMkb: number | null; type: string | null;
    densPpg: number | null; pvCp: number | null; ypLbf100ft2: number | null;
    ph: number | null; sandPct: number | null; solidsPct: number | null;
  }[];
  schematicOmitted: true;
}
export interface BitSummaryRow {
  bhaNo: number | null; bitRun: string | null; sizeIn: string | null;
  make: string | null; model: string | null; serialNo: string | null;
  iadcCodes: string | null; tfaIn2: number | null; nozzles: string | null;
  depthInMkb: number | null; depthOutMkb: number | null; drilledM: number | null;
  drillTimeHr: number | null; bhaRopMHr: number | null;
  wobMax: number | null; wobMin: number | null; rpmMax: number | null; rpmMin: number | null;
  bitDull: string | null;
}
export interface Report03Payload extends ReportEnvelope { bits: BitSummaryRow[] }

// ── reports 10 / 11 ─────────────────────────────────────────────────────────
export interface PhaseRow {
  phaseType1: string | null; phaseType2: string | null;
  plannedStartDepth: number | null; plannedEndDepth: number | null;
  durMlDays: number | null; cumDurMlDays: number | null;
  plannedCost: number | null; cumPlannedCost: number | null;
  planCostPerDepth: number | null;
  actualStartDate: string | null; actualEndDate: string | null;
  actualDurDays: number | null; cumActualDurDays: number | null;
  actualStartDepth: number | null; actualEndDepth: number | null;
  actualCost: number | null; cumActualCost: number | null;
  costPerDepth: number | null;
}
export interface PhaseChartPoint {
  days: number | null; planDays: number | null;
  actualEndDepth: number | null; actualCumCost: number | null;
  plannedCumCost: number | null; plannedEndDepth: number | null;
  label: string;
}
export interface Report10Payload extends ReportEnvelope {
  jobHeader: HeaderRow;
  phases: PhaseRow[];
  totals: HeaderRow;
  chart: PhaseChartPoint[];
}
export interface Report11Payload extends ReportEnvelope {
  wellRow: HeaderRow;
  jobRow: HeaderRow;
  planRow: HeaderRow;
  bars: {
    label: string;
    shortLabel: string;
    plannedDurDays: number | null; actualDurDays: number | null;
    plannedCost: number | null; actualCost: number | null;
  }[];
}

// ── reports 04 / 05 ─────────────────────────────────────────────────────────
export interface CasingComponentRow {
  jts: number | null; itemDes: string | null; odIn: string | null; idIn: number | null;
  massPerLenKgM: number | null; grade: string | null; topThread: string | null;
  topMkb: number | null; btmMkb: number | null; lenM: number | null;
  pBurstPsi: number | null; pCollapsePsi: number | null;
}
export interface CasingStringBlock {
  caption: string;
  properties: HeaderRow;
  components: CasingComponentRow[];
  totals: HeaderRow;
}
export interface Report05Payload extends ReportEnvelope { strings: CasingStringBlock[] }
export interface CementFluidBlock {
  fluid: HeaderRow[];
  additives: { additive: string | null; additiveType: string | null; concentration: string | null }[];
}
export interface Report04Payload extends ReportEnvelope {
  runCaption: string;
  wellbore: HeaderRow;
  sections: { sectionDes: string | null; sizeIn: string | null; actTopMkb: number | null; actBtmMkb: number | null }[];
  wellhead: { des: string | null; make: string | null; model: string | null; sn: string | null; wpTopPsi: number | null }[];
  lastMudCheck: HeaderRow;
  casing: CasingStringBlock;
  cement: {
    header: HeaderRow[];
    stages: { header: HeaderRow[]; fluids: CementFluidBlock[] }[];
  } | null;
  schematicOmitted: true;
}
/* ── the casing / cement entry sheet (what PUT /wells/:id/casing accepts) ──── */
export interface HoleSectionRow {
  order: number; wellboreId: string | null; sectionDes: string | null; sizeIn: string | null;
  actTopMkb: number | null; actBtmMkb: number | null;
}
export interface CasingTallyRow {
  order: number; jts: number | null; itemDes: string | null; odIn: string | null;
  idIn: number | null; massPerLenKgM: number | null; grade: string | null; topThread: string | null;
  topMkb: number | null; btmMkb: number | null; lenM: number | null;
  pBurstPsi: number | null; pCollapsePsi: number | null;
}
export interface CementAdditiveRow {
  order: number; additive: string | null; additiveType: string | null; concentration: string | null;
}
export interface CementFluidRow {
  order: number; fluidType: string | null; fluidDescription: string | null; amountSacks: number | null;
  cementClass: string | null; volumePumpedM3: number | null;
  estimatedTopMkb: number | null; estimatedBtmMkb: number | null;
  yieldLPerSack: number | null; mixWaterLPerSack: number | null; freeWaterPct: number | null;
  densityPpg: number | null; plasticViscosityCp: number | null;
  thickeningTimeHr: number | null; compressiveStrengthPsi: number | null;
  additives: CementAdditiveRow[];
}
export interface CementStageRow {
  order: number;
  topDepthMkb: number | null; bottomDepthMkb: number | null;
  /** Tri-state: null is "nobody answered", which report 04 prints as a blank. */
  fullReturn: boolean | null;
  volCementM3: number | null; topPlug: boolean | null; bottomPlug: boolean | null;
  qPumpInitM3Min: number | null; qPumpFinalM3Min: number | null; avgPumpRateM3Min: number | null;
  finalPumpPressurePsi: number | null; plugBumpPressurePsi: number | null;
  pipeReciprocated: boolean | null; strokeM: number | null; reciprocationRateSpm: number | null;
  pipeRotated: boolean | null; pipeRpm: number | null;
  taggedDepthMkb: number | null; tagMethod: string | null;
  depthPlugDrilledOutMkb: number | null; drillOutDiameterIn: string | null; drillOutDate: string | null;
  fluids: CementFluidRow[];
}
export interface CementJobRow {
  order: number; wellboreId: string | null; description: string | null;
  startDate: string | null; endDate: string | null;
  evaluationMethod: string | null; evaluationResults: string | null; comment: string | null;
  stages: CementStageRow[];
}
export interface CasingStringRow {
  id: string | null; order: number; wellboreId: string | null;
  description: string | null; runDate: string | null;
  setDepthMkb: number | null; setTensionKn: number | null;
  stringNominalOdIn: string | null; stringMinDriftIn: number | null;
  centralizers: string | null; scratchers: string | null;
  components: CasingTallyRow[];
  cementJobs: CementJobRow[];
}
export interface CasingSheet {
  holeSections: HoleSectionRow[];
  strings: CasingStringRow[];
}

// ── reports 08 / 09 ─────────────────────────────────────────────────────────
/** One point on a directional curve. Nulls are gaps, never zeros. */
export interface PlotStation {
  md: number | null; inc: number | null; azi: number | null; tvd: number | null;
  ns: number | null; ew: number | null; vs: number | null;
  /** The plan carries one — "KOP", "Target A". */
  comment?: string | null;
  /** The actual carries one: the day the station was shot. */
  date?: string | null;
}
export interface Report08Payload extends ReportEnvelope {
  header: HeaderRow[];
  plan: PlotStation[];
  actual: PlotStation[];
  extents: HeaderRow;
  /** True when the well has no plan — the page draws the actual alone and says so. */
  planMissing: boolean;
}

/** One bar of a report-09 breakdown panel. */
export interface BreakdownBar {
  label: string;
  value: number;
  percent: number | null;
}
export interface ProgressPoint {
  jobDay: number;
  date: string;
  endDepth: number | null;
  cumFieldEst: number | null;
}
export interface Report09Payload extends ReportEnvelope {
  header: HeaderRow[];
  jobRow: HeaderRow;
  timeByCode: BreakdownBar[];
  costByDes: BreakdownBar[];
  nptByDes: BreakdownBar[];
  progress: ProgressPoint[];
  totalHours: number | null;
  schematicOmitted: true;
}

export interface CasingStringListItem {
  id: string; description: string | null; setDepthMkb: number | null; runDate: string | null;
}

export interface BhaRunListItem {
  id: string; bhaNo: number | null; name: string | null;
  depthInMkb: number | null; depthOutMkb: number | null;
}

export interface CatalogEntry {
  type: string;
  title: string;
  category: "Daily" | "Engineering" | "Cost & Multi-well" | "Geology" | "Completion";
  params: ("well" | "job" | "date" | "dateRange" | "bhaRun" | "casingString" | "wells")[];
  exports: ("pdf" | "xlsx")[];
  available: boolean;
  blurb: string;
}

// ── calls ───────────────────────────────────────────────────────────────────
export const wellviewApi = {
  codes: () => entryApi.get<WvCodeTables>("/wellview/codes"),
  catalog: () => entryApi.get<CatalogEntry[]>("/report-data/catalog"),
  jobsForWell: (wellId: string) => entryApi.get<JobListItem[]>(`/wells/${wellId}/jobs`),
  job: (id: string) => entryApi.get<JobDetail>(`/jobs/${id}`),
  createJob: (wellId: string, name?: string) => entryApi.post<JobDetail>("/jobs", { wellId, name }),
  saveJob: (id: string, body: JobBody) => entryApi.put<JobDetail>(`/jobs/${id}`, body),
  deleteJob: (id: string) => entryApi.del<void>(`/jobs/${id}`),
  attachReports: (id: string) => entryApi.post<{ attached: number }>(`/jobs/${id}/attach-reports`),
  casing: (wellId: string) => entryApi.get<CasingSheet>(`/wells/${wellId}/casing`),
  saveCasing: (wellId: string, body: CasingSheet) =>
    entryApi.put<void>(`/wells/${wellId}/casing`, body),
  casingStrings: (wellId: string) => entryApi.get<CasingStringListItem[]>(`/wells/${wellId}/casing-strings`),
  bhaRuns: (wellId: string) => entryApi.get<BhaRunListItem[]>(`/wells/${wellId}/bha-runs`),
  registers: (wellId: string) => entryApi.get<WellRegisters>(`/wells/${wellId}/registers`),
  saveRegisters: (wellId: string, body: Omit<WellRegisters, "mudPumps" | "rigId">) =>
    entryApi.put<void>(`/wells/${wellId}/registers`, body),
  saveMudPumps: (rigId: string, pumps: MudPumpRow[]) =>
    entryApi.put<MudPumpRow[]>(`/rigs/${rigId}/mud-pumps`, { pumps }),
  costCodes: () => entryApi.get<CostCode[]>("/cost-codes"),
  saveCostCodes: (codes: CostCode[]) => entryApi.put<CostCode[]>("/cost-codes", { codes }),
  reportData: <T>(type: string, params: Record<string, string>) =>
    entryApi.get<T>(`/report-data/${type}?${new URLSearchParams(params).toString()}`),
};

/**
 * A client-side cuid for a row the user just added.
 *
 * The id columns are `String @id @default(cuid())`, so a supplied id is
 * perfectly valid — and minting it here is what lets a cost row reference a
 * phase or an AFE line created in the SAME save, instead of forcing the user to
 * save, reload and come back.
 */
export function newRowId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  const time = Date.now().toString(36);
  return `c${prefix}${time}${rand}`;
}
