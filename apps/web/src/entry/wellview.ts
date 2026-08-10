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
  /** Report 20's "Geological Objective" — what the well is drilled to find out. */
  geologicalObjective: string | null;
  possCostSave: number | null;
  possTimeSaveHr: number | null;
  estProblemCost: number | null;
  estLostTimeHr: number | null;
}

/** Exactly what `PUT /entry/jobs/:id` accepts. */
/** Report 20's contact sheet — job-level, saved with the job. */
export interface JobContactRow {
  order: number; company: string | null; contactName: string | null;
  title: string | null; mobile: string | null; email: string | null; note: string | null;
}

export interface JobBody extends JobHeader {
  phases: JobPhaseRow[];
  afes: AfeRow[];
  costItems: CostItemRow[];
  /** Report 20's contact sheet — replace-all, nothing points into it. */
  contacts: JobContactRow[];
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
export interface WellboreRow { id: string | null; order: number; name: string | null; kind: string | null; koMdMkb: number | null; vsAzimuthDeg: number | null }
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
  /** The wellbore section the sample draws beside these blocks. */
  schematic: SchematicPayload;
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
  /** The wellbore section the sample draws beside these blocks. */
  schematic: SchematicPayload;
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
  /** The wellbore section the sample draws beside these blocks. */
  schematic: SchematicPayload;
}

// ── the multi-well reports (12–17) ──────────────────────────────────────────
/** The identity every multi-well report prints for each well in its set. */
export interface WellRef {
  id: string; name: string;
  apiUwi: string | null; licenseNo: string | null; field: string | null;
  county: string | null; country: string | null; stateProvince: string | null; wellType: string | null;
  groundElevation: number | null; kbElevation: number | null; spudDate: string | null;
}
export interface MultiWellEnvelope extends ReportEnvelope {
  wells: WellRef[];
  /** Requested wells the caller may not use — the page says so rather than hiding it. */
  droppedWells: number;
}

export interface ProblemCostCell {
  party: string; kind: string; cost: number; lostTimeHr: number | null; count: number;
}
export interface Report15Payload extends MultiWellEnvelope {
  parties: { party: string; cost: number; lostTimeHr: number | null; count: number }[];
  kinds: string[];
  cells: ProblemCostCell[];
  totals: HeaderRow;
}

export interface SafetyIncidentReportRow {
  type: string | null; subType: string | null; date: string; time: string | null;
  severity: string | null; cause: string | null;
  /** Tri-state: blank where nobody answered, which is not the same as "No". */
  lostTime: boolean | null;
  com: string | null; jobType: string | null; wellName: string;
}
export interface Report17Payload extends MultiWellEnvelope {
  incidents: SafetyIncidentReportRow[];
  totals: HeaderRow;
}

/* ── the well's completion sheet (Tier 5) ──────────────────────────────────── */
/**
 * A COMPLETION ZONE — what a perforation is shot into and production allocated
 * to. Separate from a reservoir: a zone can commingle two reservoirs, and a
 * reservoir can be completed in two zones.
 */
export interface WellZoneRow {
  id: string | null; order: number; wellboreId: string | null;
  name: string | null; topMkb: number | null; btmMkb: number | null; status: string | null;
}
export interface ReservoirRow {
  order: number; name: string | null; topMkb: number | null; btmMkb: number | null;
  datumDepthM: number | null; fluidType: string | null;
}
export interface PerforationStatusRow {
  order: number; date: string | null; status: string | null; com: string | null;
}
export interface PerforationRow {
  order: number; zoneId: string | null; date: string | null; time: string | null;
  topMkb: number | null; btmMkb: number | null;
  company: string | null; conveyanceMethod: string | null;
  gunSizeIn: string | null; carrierMake: string | null;
  shotDensityPerM: number | null; chargeType: string | null; phasingDeg: number | null;
  orientation: string | null; orientationMethod: string | null;
  overUnderBalanced: string | null; pOverUnderPsi: number | null;
  flMdBeforeMkb: number | null; flMdAfterMkb: number | null;
  pSurfInitPsi: number | null; pFinalSurfPsi: number | null;
  referenceLog: string | null;
  statuses: PerforationStatusRow[];
}
export interface TubingComponentRow {
  order: number; itemDes: string | null; jts: number | null;
  make: string | null; model: string | null;
  odIn: string | null; idIn: number | null; massPerLenKgM: number | null;
  grade: string | null; lenM: number | null;
  topMkb: number | null; btmMkb: number | null; serialNo: string | null;
}
export interface TubingStringRow {
  order: number; wellboreId: string | null; description: string | null;
  runDate: string | null; stringLengthM: number | null; setDepthMkb: number | null;
  components: TubingComponentRow[];
}
export interface PlugBackRow {
  order: number; date: string | null; depthMkb: number | null;
  method: string | null; com: string | null;
}
export interface DeviationSurveyRow {
  order: number; date: string | null; des: string | null;
  proposed: boolean | null; definitive: boolean | null; company: string | null;
}
export interface ProductionPeriodRow {
  order: number; zoneId: string | null;
  startDate: string | null; endDate: string | null; activityType: string | null;
  prodTimeDays: number | null; downTimeDays: number | null;
  volOilBbl: number | null; volWaterBbl: number | null; volResGasMcf: number | null;
  qOilBblD: number | null; qWaterBblD: number | null; qResGasMcfD: number | null;
  waterGasRatioPct: number | null; com: string | null;
}
export interface EquipmentFailureRow {
  order: number; date: string | null; failureType: string | null;
  componentDes: string | null; cost: number | null;
  accountableParty: string | null; com: string | null;
}
export interface StimulationRow {
  order: number; zoneId: string | null; date: string | null; time: string | null;
  type: string | null; deliveryMode: string | null; company: string | null;
  volumeM3: number | null; com: string | null;
}
export interface CompletionSheet {
  zones: WellZoneRow[];
  reservoirs: ReservoirRow[];
  perforations: PerforationRow[];
  tubingStrings: TubingStringRow[];
  plugBacks: PlugBackRow[];
  deviationSurveys: DeviationSurveyRow[];
  productionPeriods: ProductionPeriodRow[];
  equipmentFailures: EquipmentFailureRow[];
  stimulations: StimulationRow[];
}

/* ── the shared wellbore schematic (02, 04, 09, 21, 24, 28, 29) ───────────── */
/** One drawn interval, in metres below KB. */
export interface SchematicInterval {
  topMkb: number; btmMkb: number;
  label: string | null;
  /** Outer diameter in INCHES where known — the drawing nests by this. */
  odIn: number | null;
  detail: string | null;
}
export interface SchematicPayload {
  maxDepthMkb: number | null;
  holeSections: SchematicInterval[];
  casingStrings: SchematicInterval[];
  cementIntervals: SchematicInterval[];
  formations: SchematicInterval[];
  /** Shoes are a mark at a depth: top and btm are the same number. */
  shoes: SchematicInterval[];
  /** The completion string inside the casing — tubing, TRSSV, packer. */
  completionItems: SchematicInterval[];
  /** Why the picture is empty, when it is — printed instead of a blank frame. */
  emptyReason: string | null;
}

/* ── Tier 5: the completion reports (22–30) ────────────────────────────────── */
export interface PerforationBlock {
  header: HeaderRow[];
  statuses: { date: string | null; status: string | null; com: string | null }[];
}
export interface TubingBlock {
  caption: string;
  header: HeaderRow;
  components: {
    itemDes: string | null; jts: number | null; make: string | null; model: string | null;
    odIn: string | null; idIn: number | null; massPerLenKgM: number | null;
    grade: string | null; lenM: number | null;
    topMkb: number | null; btmMkb: number | null; serialNo: string | null;
  }[];
}

export interface CasingBlock {
  caption: string;
  header: HeaderRow;
  components: {
    odIn: string | null; itemDes: string | null; btmMkb: number | null; jts: number | null;
    idIn: number | null; massPerLenKgM: number | null; grade: string | null; topThread: string | null;
  }[];
}

export interface CementBlock {
  caption: string;
  header: HeaderRow;
  stages: {
    stage: HeaderRow;
    fluids: {
      fluidType: string | null; cementClass: string | null; amountSacks: number | null;
      yieldLPerSack: number | null; mixWaterLPerSack: number | null;
      volumePumpedM3: number | null; fluidDescription: string | null;
    }[];
  }[];
}

export interface BhaBlock {
  caption: string;
  header: HeaderRow;
  figures: HeaderRow;
  /** The sample prints the make-up as ONE comma-joined line, not a table. */
  stringComponents: string;
}

export interface JobBlock {
  caption: string;
  header: HeaderRow;
  money: HeaderRow;
  summary: string | null;
  savings: HeaderRow;
  phases: {
    phaseType: string | null; plannedCost: number | null;
    plCumDaysMl: number | null; plannedEndDepthMkb: number | null;
  }[];
  contacts: {
    contactName: string | null; company: string | null; title: string | null;
    office: string | null; mobile: string | null;
  }[];
}

export interface RodBlock {
  caption: string;
  header: HeaderRow;
  components: {
    itemDes: string | null; odNominalIn: string | null; massPerLenKgM: number | null;
    grade: string | null; joints: number | null; lenM: number | null;
    topMkb: number | null; btmMkb: number | null;
  }[];
}

export interface StimulationBlock {
  caption: string;
  header: HeaderRow;
  stages: {
    stageNo: number | null; stageType: string | null;
    topDepthMkb: number | null; bottomDepthMkb: number | null; cleanVolPumpedM3: number | null;
  }[];
}

export interface Report22Payload extends ReportEnvelope {
  identity: HeaderRow[];
  caption: string;
  schematic: SchematicPayload;
  wellbore: HeaderRow;
  holeSections: { sizeIn: string | null; actTopMkb: number | null; actBtmMkb: number | null }[];
  plugBacks: { date: string | null; depthMkb: number | null; method: string | null; com: string | null }[];
  formations: {
    name: string | null; geologicAge: string | null; elementType: string | null; h2sConcPct: number | null;
    finalTopMd: number | null; finalTopTvd: number | null;
  }[];
  deviationSurveys: { date: string | null; des: string | null; proposed: boolean | null; definitive: boolean | null }[];
  reservoirs: { name: string | null; topMkb: number | null; btmMkb: number | null; datumDepthM: number | null }[];
  casingStrings: CasingBlock[];
  cementJobs: CementBlock[];
  otherInHole: {
    odIn: string | null; des: string | null; topMkb: number | null; btmMkb: number | null;
    idIn: number | null; make: string | null; model: string | null;
  }[];
  wellheadMaster: HeaderRow | null;
  wellheadComponents: {
    make: string | null; model: string | null; section: string | null;
    topConnType: string | null; topSizeIn: number | null;
    btmConnType: string | null; btmSizeIn: number | null;
    des: string | null; wpPsi: number | null;
  }[];
  generalNotes: { date: string | null; com: string | null }[];
  jobs: JobBlock[];
  bhas: BhaBlock[];
  logs: { date: string | null; type: string | null; topMkb: number | null; btmMkb: number | null; company: string | null }[];
  cores: {
    coreNo: string | null; type: string | null; topMkb: number | null; btmMkb: number | null;
    recoveredM: number | null; wellbore: string | null;
  }[];
  leakOffTests: {
    testDate: string | null; lastCasingStringRun: string | null; pSurfAppliedPsi: number | null;
    depthMkb: number | null; fluidDensityPpg: number | null; leakedOff: boolean | null;
  }[];
  annotations: { depthMkb: number | null; annotation: string | null }[];
  productionFailures: {
    date: string | null; failureDes: string | null; failureType: string | null; cause: string | null;
    failedItem: string | null; resolvedDate: string | null; cost: number | null;
  }[];
  tubingStrings: TubingBlock[];
  perforations: { date: string | null; zone: string | null; topMkb: number | null; btmMkb: number | null }[];
  totals: HeaderRow;
}

export interface Report23Payload extends ReportEnvelope {
  identityRight: string | null;
  completionHeader: HeaderRow;
  caption: string;
  schematic: SchematicPayload;
  jobHeader: HeaderRow[];
  dailyReadings: HeaderRow;
  contacts: { jobContact: string | null; title: string | null; mobile: string | null }[];
  timeLog: {
    startTime: string | null; endTime: string | null; durHr: number | null;
    code1: string | null; code2: string | null; com: string | null;
  }[];
  fluids: { fluid: string | null; toWellBbl: number | null; fromWellBbl: number | null }[];
  safetyChecks: { time: string | null; des: string | null; type: string | null; com: string | null }[];
  logs: { time: string | null; type: string | null; topMkb: number | null; btmMkb: number | null }[];
  perforations: { date: string | null; zone: string | null; topMkb: number | null; btmMkb: number | null; status: string | null }[];
  stimulations: { date: string | null; time: string | null; zone: string | null; type: string | null; deliveryMode: string | null; company: string | null }[];
}

export interface Report24Payload extends ReportEnvelope {
  completionHeader: HeaderRow;
  caption: string;
  schematic: SchematicPayload;
  wellhead: { des: string | null; make: string | null; model: string | null; sn: string | null; wpTopPsi: number | null }[];
  casingStrings: {
    description: string | null; odIn: string | null; massPerLenKgM: number | null;
    grade: string | null; topThread: string | null; setDepthMkb: number | null;
  }[];
  perforations: { date: string | null; topMkb: number | null; btmMkb: number | null; zone: string | null }[];
  tubingStrings: TubingBlock[];
}

export interface FailureCostCell {
  well: string; failureType: string; cost: number; count: number;
}
export interface Report25Payload extends MultiWellEnvelope {
  wellTotals: { well: string; cost: number; count: number }[];
  failureTypes: string[];
  cells: FailureCostCell[];
  totals: HeaderRow;
}

export interface Report26Payload extends ReportEnvelope {
  completionHeader: HeaderRow;
  caption: string;
  schematic: SchematicPayload;
  perforations: PerforationBlock[];
  totals: HeaderRow;
}

export interface ProductionRow {
  startDate: string | null; endDate: string | null;
  activityType: string | null; zone: string | null;
  prodTimeDays: number | null; downTimeDays: number | null;
  volResGasMcf: number | null; volOilBbl: number | null; volWaterBbl: number | null;
  qResGasMcfD: number | null; qOilBblD: number | null; qWaterBblD: number | null;
  waterGasRatioPct: number | null;
}
export interface Report27Payload extends ReportEnvelope {
  filterLine: string | null;
  rows: ProductionRow[];
  curve: { endDate: string; qOilBblD: number | null; qWaterBblD: number | null; qResGasMcfD: number | null }[];
  totals: HeaderRow;
}

export interface Report28Payload extends ReportEnvelope {
  completionHeader: HeaderRow;
  caption: string;
  mostRecentJob: HeaderRow | null;
  totalDepthLine: string | null;
  schematic: SchematicPayload;
}

export interface Report29Payload extends ReportEnvelope {
  caption: string;
  actual: SchematicPayload;
  proposed: SchematicPayload;
  comparison: HeaderRow;
  noProposal: string | null;
}

export interface Report30Payload extends ReportEnvelope {
  identity: HeaderRow[];
  elevations: HeaderRow;
  directionsToWell: string | null;
  wellhead: { type: string | null; make: string | null; wpPsi: number | null; service: string | null }[];
  wellbores: { name: string | null; parent: string | null; profile: string | null; koMdMkb: number | null }[];
  casingStrings: {
    description: string | null; runDate: string | null; odIn: string | null; idIn: number | null;
    massPerLenKgM: number | null; grade: string | null; setDepthMkb: number | null;
  }[];
  cementJobs: {
    caption: string; company: string | null;
    stage: HeaderRow;
    fluids: { description: string | null; type: string | null; amountSacks: number | null; cementClass: string | null }[];
  }[];
  otherInHole: {
    des: string | null; topMkb: number | null; btmMkb: number | null;
    runDate: string | null; pullDate: string | null;
  }[];
  zones: {
    name: string | null; topMkb: number | null; btmMkb: number | null;
    status: string | null; statusDate: string | null;
  }[];
  perforations: {
    date: string | null; type: string | null; topMkb: number | null; btmMkb: number | null;
    zone: string | null; shotDensityPerM: number | null; phasingDeg: number | null; status: string | null;
  }[];
  stimulations: StimulationBlock[];
  logs: { date: string | null; topMkb: number | null; btmMkb: number | null; type: string | null; cased: boolean | null }[];
  tubingStrings: TubingBlock[];
  rodStrings: RodBlock[];
  rodPumps: HeaderRow[];
  swabs: {
    date: string | null; swabCompany: string | null; zone: string | null;
    totalVolBbl: number | null; totalOilBbl: number | null; totalBswBbl: number | null;
  }[];
  jobs: {
    startDate: string | null; endDate: string | null;
    jobType: string | null; jobSubType: string | null; summary: string | null;
  }[];
  attachments: { des: string | null; kind: string | null; date: string | null }[];
  totals: HeaderRow;
}

/* ── report 21 ─────────────────────────────────────────────────────────────── */
export interface SchematicBand { topMkb: number; btmMkb: number; label: string | null }
export interface SchematicStation {
  md: number | null; tvd: number | null; inc: number | null; dls: number | null;
}
export interface ParameterPoint {
  depthMkb: number;
  densPpg: number | null; intRopMHr: number | null;
  rpm: number | null; qFlowGpm: number | null; wob1000Lbf: number | null;
}
export interface Report21Payload extends ReportEnvelope {
  caption: string;
  schematic: SchematicPayload;
  stations: SchematicStation[];
  lithology: SchematicBand[];
  mud: SchematicBand[];
  parameters: ParameterPoint[];
  totals: HeaderRow;
}

/* ── reports 18 / 19 / 20 ──────────────────────────────────────────────────── */
/** One formation, as any of the geology reports prints it. */
export interface FormationRow {
  name: string | null; lithDes: string | null; elementType: string | null; layerName: string | null;
  progDepthTopSs: number | null; progTopTvd: number | null;
  progDepthBtmSs: number | null; progBtmTvd: number | null;
  drillTopMd: number | null; drillTopTvd: number | null;
  drillBtmMd: number | null; drillBtmTvd: number | null;
  finalTopMd: number | null; finalBtmMd: number | null;
  ropMHr: number | null; pPorePpg: number | null; pFracPpg: number | null;
  temperatureC: number | null; h2sConcPct: number | null;
}
export interface GeoTimeLogRow {
  startTime: string | null; endTime: string | null;
  durHr: number | null; cumDurHr: number | null;
  code1: string | null; code2: string | null; com: string | null;
}
export interface GeoMudCheckRow {
  type: string | null; time: string | null; depthMkb: number | null; densPpg: number | null;
  pvCp: number | null; ypPa: number | null; filtrateMl: number | null; ph: number | null;
}
export interface GeoBhaBlock {
  caption: string;
  header: HeaderRow;
  intervals: {
    endDepthMkb: number | null; tvdEndMkb: number | null;
    cumDepthM: number | null; cumDrillTimeHr: number | null;
    intRopMHr: number | null; rpm: number | null; wob1000Lbf: number | null;
    wellbore: string | null;
  }[];
}
export interface GeoSampleRow {
  topMkb: number | null; btmMkb: number | null;
  volCaPct: number | null; volMgPct: number | null; com: string | null;
}
export interface GeoLithologyRow {
  topMkb: number | null; btmMkb: number | null; des: string | null;
  volPct: number | null; type: string | null; typeCode: string | null;
}
export interface OilShowRow {
  topMkb: number | null; btmMkb: number | null;
  showQuality: string | null; showOrigin: string | null; showType: string | null;
}
export interface GasShowRow {
  topMkb: number | null; btmMkb: number | null; showType: string | null;
  totalGasAvgPct: number | null; totalGasMinPct: number | null; totalGasMaxPct: number | null;
}
export interface GeoLogRunRow {
  time: string | null; runNo: string | null; type: string | null;
  topMkb: number | null; btmMkb: number | null; loggingCompany: string | null;
}
export interface Report18Payload extends ReportEnvelope {
  identityRight: string | null;
  depthLine: string | null;
  dailySummary: HeaderRow;
  gas: HeaderRow[];
  narrative: HeaderRow[];
  timeLog: GeoTimeLogRow[];
  mudChecks: GeoMudCheckRow[];
  bhaBlocks: GeoBhaBlock[];
  formations: FormationRow[];
  sampleDescriptions: GeoSampleRow[];
  lithology: GeoLithologyRow[];
  oilShows: OilShowRow[];
  gasShows: GasShowRow[];
  logRuns: GeoLogRunRow[];
  /** True where the day has a mud check but the model can hold only one. */
  mudCheckLimitation: boolean;
}

export interface DrilledIntervalRow {
  startMkb: number | null; endDepthMkb: number | null;
  intDepthM: number | null; drillTimeHr: number | null;
  intRopMHr: number | null; date: string;
}
export interface Report19Payload extends ReportEnvelope {
  wellboreBlocks: { caption: string; header: HeaderRow; intervals: DrilledIntervalRow[] }[];
  formations: FormationRow[];
  profile: { depth: number; ropMHr: number | null; name: string | null }[];
  totals: HeaderRow;
}

export interface Report20Payload extends ReportEnvelope {
  wellbores: {
    name: string | null; profileType: string | null;
    parentWellbore: string | null; proposedSurvey: string | null;
  }[];
  formations: FormationRow[];
  jobs: HeaderRow[];
  geologicalObjective: string | null;
  samplingRequirements: {
    topDes: string | null; topMkb: number | null;
    btmDes: string | null; btmMkb: number | null;
    wellbore: string | null; rqdBy: string | null; sampledBy: string | null; com: string | null;
  }[];
  contacts: {
    company: string | null; contactName: string | null; title: string | null;
    mobile: string | null; email: string | null; note: string | null;
  }[];
}

/* ── the well's geology sheet (reports 18–21) ─────────────────────────────── */
/**
 * One formation, prognosed AND as drilled. The two sets of columns are separate
 * on purpose: report 19 exists to print them beside each other, and a prognosis
 * that vanishes when the top is drilled cannot be compared with anything.
 */
export interface WellFormationRow {
  order: number;
  name: string | null; lithDes: string | null; elementType: string | null; layerName: string | null;
  progDepthTopSs: number | null; progTopTvd: number | null;
  progDepthBtmSs: number | null; progBtmTvd: number | null;
  drillTopMd: number | null; drillTopTvd: number | null;
  drillBtmMd: number | null; drillBtmTvd: number | null;
  finalTopMd: number | null; finalBtmMd: number | null;
  ropMHr: number | null;
  pPorePpg: number | null; pFracPpg: number | null;
  temperatureC: number | null; h2sConcPct: number | null;
}
export interface SamplingRequirementRow {
  order: number; wellboreId: string | null;
  topDes: string | null; topMkb: number | null;
  btmDes: string | null; btmMkb: number | null;
  rqdBy: string | null; sampledBy: string | null; com: string | null;
}
export interface GeologySheet {
  formations: WellFormationRow[];
  samplingRequirements: SamplingRequirementRow[];
}
export interface MultiTimeLogRow {
  startDate: string; endDate: string;
  durHr: number | null; cumDurHr: number | null;
  code1: string | null; code2: string | null; com: string | null;
}
export interface WellDayBlock {
  wellId: string;
  rigName: string | null;
  identity: HeaderRow;
  figures: HeaderRow[];
  dailyContacts: string | null;
  operationsSummary: string | null;
  operationsNextPeriod: string | null;
  timeLog: MultiTimeLogRow[];
  /** Set when the well filed no day; the block prints this instead. */
  noDay: string | null;
}
export interface Report12Payload extends MultiWellEnvelope {
  /** The cap the blocks were chosen under, when one was given. */
  asOf: string | null;
  blocks: WellDayBlock[];
}

export interface OffsetPoint { x: number; y: number }
export interface OffsetSeries { wellId: string; wellName: string; points: OffsetPoint[] }
export interface OffsetPlot {
  key: "daysDepth" | "spudDepth" | "daysCost" | "depthCost" | "mudDepth";
  title: string; xLabel: string; yLabel: string;
  /** True where the Y axis grows DOWNWARD — every depth axis in this suite. */
  yReversed: boolean;
  series: OffsetSeries[];
  emptyReason: string | null;
}
export interface Report14Payload extends MultiWellEnvelope {
  plots: OffsetPlot[];
  totals: HeaderRow;
}

export interface KpiRow {
  wellName: string;
  afeSuppAmt: number | null; fieldEst: number | null; afeLessFieldEst: number | null;
  costPerDepth: number | null; drilledTotalDepth: number | null;
  totalTimeLogHr: number | null; totalProblemHr: number | null; pctProblemTime: number | null;
  drillingHr: number | null; avgRopMHr: number | null; personnelHr: number | null;
}
export interface Report13Payload extends MultiWellEnvelope {
  filters: HeaderRow;
  rows: KpiRow[];
  grandTotal: KpiRow;
}

export interface PhasePivotRow {
  jobCategory: string; phaseType1: string; phaseType2: string;
  count: number; avg: number | null; min: number | null; max: number | null;
  /** Population standard deviation; null for a single observation. */
  stdDev: number | null;
  sum: number | null;
}
export interface Report16Payload extends MultiWellEnvelope {
  filters: HeaderRow;
  rows: PhasePivotRow[];
  grandTotal: PhasePivotRow;
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
  params: ("well" | "job" | "date" | "dateRange" | "asOf" | "bhaRun" | "casingString" | "wells")[];
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
  geology: (wellId: string) => entryApi.get<GeologySheet>(`/wells/${wellId}/geology`),
  completion: (wellId: string) => entryApi.get<CompletionSheet>(`/wells/${wellId}/completion`),
  saveCompletion: (wellId: string, body: CompletionSheet) =>
    entryApi.put<void>(`/wells/${wellId}/completion`, body),
  saveGeology: (wellId: string, body: GeologySheet) =>
    entryApi.put<void>(`/wells/${wellId}/geology`, body),
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
