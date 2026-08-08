/**
 * Typed client for the authenticated /entry/* API (rig-side report entry).
 *
 * Separate from api/client.ts because every call carries the bearer token and a
 * 401 has to drop the session rather than surface as a generic error. The token
 * lives in localStorage so a rig PC survives a browser restart mid-tour.
 */
const BASE = "/api/entry";
const STORAGE_KEY = "dd.entry.token";

let token: string | null = localStorage.getItem(STORAGE_KEY);
const listeners = new Set<(t: string | null) => void>();

export function getToken(): string | null { return token; }
export function setToken(next: string | null): void {
  token = next;
  if (next) localStorage.setItem(STORAGE_KEY, next);
  else localStorage.removeItem(STORAGE_KEY);
  for (const l of listeners) l(next);
}
/** Subscribe to sign-in / sign-out (also fires when a 401 expires the token). */
export function onTokenChange(fn: (t: string | null) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export class EntryError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (res.status === 401) {
    // Expired or revoked — drop straight back to the sign-in screen.
    setToken(null);
    throw new EntryError(401, "Your session has expired — please sign in again.");
  }
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json() as { error?: string };
      if (body?.error) message = body.error;
    } catch { /* non-JSON error body — keep the status line */ }
    throw new EntryError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const entryApi = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body ?? {}) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

// ── shapes returned by the API ──────────────────────────────────────────────
export interface EntryUser {
  id: string; username: string; fullName: string;
  role: "admin" | "companyman"; active: boolean; mustChangePassword: boolean;
}
export interface EntryRig { id: string; name: string; contractor: string | null }
export interface EntryWell {
  id: string; rigId: string; name: string; field: string | null;
  legacyWellCode: string | null; location: string | null; wellType: string | null;
  profile: string | null; reservoir: string | null; contractor: string | null;
  spudDate: string | null; rigReleasedDate: string | null;
  rtElevation: number | null; waterDepth: number | null;
  finalForecastDepth: number | null; forecastDays: number | null;
  // ── a.json `report_header`, the part that is constant for the whole well ──
  /** Operator the report is filed for, e.g. "POGC". */
  client: string | null;
  /** Coordinates as PRINTED — DMS text (26° 46' 39.11" N), never a number. */
  latitude: string | null; longitude: string | null;
  /** Free text beside the KB elevation, usually "Air Gap(m): 18". */
  elevationNote: string | null;
  /** Free text; on jack-ups the leg penetration, "Leg Pen.(m): FWD/STBD/PORT". */
  comment: string | null;
  active: boolean; rig: EntryRig;
  _count?: { reports: number; assignments?: number };
}
export interface ReportListItem {
  id: string; serialNo: number; reportDate: string; status: "draft" | "submitted";
  morningDepth: number | null; midnightDepth: number | null; previousDepth: number | null;
  updatedAt: string; submittedAt: string | null;
  user: { username: string; fullName: string };
}

export interface BitRun {
  order: number; bitNo: string | null; bitSerialNo: string | null; size: string | null;
  type: string | null; iadcCode: string | null; nozzles: string | null; tfa: number | null;
  // ── a.json drill_strings[].bit additions ──
  /** Bit manufacturer, e.g. "CST". */
  make: string | null;
  model: string | null;
  /** a.json bit_revs — total revolutions turned by this bit. */
  bitRevs: number | null;
  meterage: number | null; hours: number | null; wob: number | null; rpm: number | null;
  torque: string | null; dullGrade: string | null; reasonPulled: string | null;
  pumpType: string | null; pumpOutput: number | null; pumpPressure: number | null;
  annularVelocity: number | null; hsi: number | null; cmtDrilled: string | null;
  washAndRun: string | null; bitChangeIn: string | null; bitChangeOut: string | null;
}
/**
 * One item in a string's make-up — a.json `drill_strings[].components`.
 *
 * `cumLenM` is the running total as PRINTED, stored rather than derived: the
 * printed sheet is the record of truth.
 */
export interface DrillStringComponentRow {
  order: number; itemDes: string | null;
  /** Owning service company. */
  serv: string | null;
  sn: string | null; odIn: number | null; idIn: number | null; jts: number | null;
  lenM: number | null; cumLenM: number | null; com: string | null;
}
/**
 * One drill string — a.json `drill_strings`, one entry PER BHA run in the day.
 *
 * Replaces the old flat BHA list. A day can run two BHAs; with a flat list there
 * is no way to say which components made up which string, and the per-BHA header
 * figures below have nowhere to live. The four hour fields are THIS string's own,
 * not the day's totals.
 */
export interface DrillStringRow {
  order: number; name: string | null; bhaNo: number | null; depthInMkb: number | null;
  dateIn: string | null; objective: string | null; depthDrilledM: number | null;
  drillingTimeHr: number | null; circulatingTimeHr: number | null;
  rotatingTimeHr: number | null; slidingTimeHr: number | null; note: string | null;
  components: DrillStringComponentRow[];
}
export interface DrillPipe { order: number; size: string | null; grade: string | null; lengthM: number | null }
export interface ToolItem { kind: "jar" | "mwd" | "dhMotor"; type: string | null; size: string | null; serialNo: string | null; hours: number | null }
/**
 * Mud check — the DR.xls block and a.json `mud_information`, de-duplicated.
 *
 * The two standards overlap but neither is a superset, so both are kept: the
 * office sheet still prints its own fields, and the PEDC/POGC DDR adds the
 * sample depth, low-shear-rate viscosities and the three mud volumes.
 *
 * Four pairs measured the SAME quantity twice and were collapsed onto the a.json
 * name and unit — the duplicates (maxWeight, minWeight, densityPpg, tempF,
 * waterLoss, calcium) are gone:
 *
 * - `densityMinPpg` / `densityMaxPpg` replace maxWeight + minWeight (sg) and the
 *   single densityPpg. The RANGE beat the single value: 91% of the 62k archive
 *   checks record a min and a max, which one density field cannot express, while
 *   the reverse is lossless — a PEDC report giving one density fills both ends.
 *   The unit is a.json's ppg, so the two standards no longer disagree on scale.
 * - `tFlowlineC` replaces tempF — same measurement, °C instead of °F.
 * - `filtrateMl` replaces waterLoss — a.json filtrate_ml_30min.
 * - `hardnessCaPpm` replaces calcium — identical quantity AND unit (ppm).
 */
export interface MudProps {
  mudSystem: string | null;
  /** Mud-weight range in ppg; a single recorded density fills both ends. */
  densityMinPpg: number | null; densityMaxPpg: number | null;
  reportTime: string | null; funnelVisc: number | null; pv: number | null; yp: number | null;
  gelInitial: number | null; gel10min: number | null; fan600: number | null; fan300: number | null;
  ph: number | null; alkalinity: number | null; hpht: number | null;
  airFoam: number | null; oilPct: number | null; oilWaterRatio: string | null;
  eStability: number | null; kcl: number | null; mbt: number | null; pf: number | null;
  mf: number | null; chloride: number | null; solidsPct: number | null;
  // ── a.json mud_information additions ──
  depthMkb: number | null;
  /** Flowline temperature in °C (was tempF). */
  tFlowlineC: number | null;
  /** API filtrate, mL/30 min (was waterLoss). */
  filtrateMl: number | null;
  vis3rpm: number | null; vis6rpm: number | null;
  percentWater: number | null; lowGravitySolidsPct: number | null;
  /** Calcium hardness in ppm (was calcium — same unit). */
  hardnessCaPpm: number | null;
  mudLostBbl: number | null; activeMudVolBbl: number | null; volMudResBbl: number | null;
}
export interface SolidControlRow { unit: string; hours: number | null; underFlow: number | null; overFlow: number | null; feed: number | null; cons: number | null; fprs: number | null }
export interface ChemicalRow { order: number; material: string | null; unit: string | null; used: number | null; received: number | null; stock: number | null; outstanding: number | null; requested: number | null; sent: number | null }
/**
 * One casing string — a.json `casing_string`.
 *
 * NOTE: `depth` is a.json set_depth_mkb (the shoe), NOT the top. `topMkb` is
 * a.json top_mkb — the two are separate depths and must never be conflated.
 * `joints` is a DR.xls-only column with no a.json counterpart.
 */
export interface CasingRow {
  order: number; casing: string | null; depth: number | null; joints: number | null;
  // ── a.json casing_string additions ──
  /** a.json run_date, as printed. */
  runDate: string | null;
  topMkb: number | null; com: string | null;
}
/** One wellhead spool / housing — a.json `wellhead_component`. */
export interface WellheadRow {
  order: number; installDate: string | null; sizeIn: number | null; type: string | null;
  make: string | null; model: string | null; sn: string | null;
  wpPsi: number | null; com: string | null;
}
/** One slow-circulation rate — a.json `well_control_scr`, one row per pump / rate. */
export interface ScrRateRow {
  order: number; pumpNo: string | null; depthMkb: number | null; strokesSpm: number | null;
  effPct: number | null; pPsi: number | null; qFlowGpm: number | null;
}
/** One support vessel alongside — a.json `support_vessels` (offshore only). */
export interface SupportVesselRow {
  order: number; vesselName: string | null; vesselType: string | null;
  arrivalDate: string | null; departureDate: string | null; note: string | null;
}
/**
 * Formation integrity test — a.json `formation_integrity_test`.
 *
 * At most one FIT/LOT per report — an OBJECT in a.json, 1:1 like mud (not an
 * array), so the whole block is null on the many days with no test.
 */
export interface FitProps {
  testType: string | null; testDate: string | null; lastCasingStringRun: string | null;
  depthMkb: number | null; tvdMkb: number | null; appliedSurfacePressurePsi: number | null;
  fluidDensityPpg: number | null; volumePumpedBbl: number | null;
  leakOffPressurePsi: number | null; leakOffEqDensityPpg: number | null;
}
/**
 * Marine conditions — a.json `marine_conditions` (offshore only).
 *
 * This is the structured form of the DR.xls windSpeedDir/waveVisible free text,
 * which stays on EntryReport for the office sheet. Both are kept: the sheet
 * prints its own two strings, the DDR prints these broken-out numbers.
 */
export interface MarineProps {
  swellHtM: number | null; visibilityKm: number | null; windSpdKnots: number | null;
  tHighC: number | null; waveHtM: number | null;
  windDir: string | null; com: string | null;
}
/**
 * One formation top — a.json `formations`.
 *
 * The whole point of the block is prognosed-vs-actual, so keep the two depths
 * apart: `depth` is final_top_md_mkb (where the top ACTUALLY came in) while
 * `progTopMd` is prog_top_md_mkb (where it was PROGNOSED). Never conflate them.
 */
export interface FormationTopRow {
  order: number; formation: string | null; depth: number | null; secondDepth: number | null; type: string | null;
  // ── a.json formations additions ──
  progTopMd: number | null; finalTopTvd: number | null; thickM: number | null;
  drilledRopMHr: number | null;
  /** Comma-separated lithology codes, e.g. "Lst,Mrl,Clst,Gyp". */
  lithDes: string | null;
}
/** One line of a.json `supervisors_contact` — who to call, and their position. */
export interface SupervisorRow {
  order: number; jobContact: string | null; position: string | null;
  /** Reports 06 / 07 print this list as "Daily Contacts — Job Contact, Mobile". */
  mobile: string | null;
}
/** One line of a.json `onboard_companies`; `note` is the role (Client / Operator / …). */
export interface OnboardCompanyRow {
  order: number; company: string | null; count: number | null; note: string | null;
  /** Report 07's Personnel Log groups by this and totals the hours worked. */
  personnelType: string | null; totWorkTimeHr: number | null;
}
/**
 * One HSE drill — a.json `hse_drill_schedule`.
 *
 * A FIXED four-row set ("BOP Test", "H2S Drill", "Fire Drill", "Abandon Drill")
 * keyed by `type`, not by order: the sheet prints all four rows every day even
 * when they are blank, so the editor always renders four and never adds/removes.
 */
export interface HseDrillRow { type: string; date: string | null; daysToNextCheck: number | null }
/** One line of a.json `bulk_material`; `unitLabel` is the printed unit (MT, liter, m3). */
export interface BulkMaterialRow {
  order: number; supplyItemDes: string | null; unitLabel: string | null;
  consumed: number | null; received: number | null; returned: number | null; onLoc: number | null;
  note: string | null;
}
/** One survey station — a.json `directional_survey` (md_mkb … build_deg_30m). */
export interface SurveyRow {
  order: number; md: number | null; inc: number | null; azi: number | null; tvd: number | null;
  ns: number | null; ew: number | null; vs: number | null; dls: number | null; build: number | null;
}
/**
 * One drilled interval — a.json `drilling_parameters`.
 *
 * Every column is nullable: a trailing row carrying only circulating time and
 * no depths is normal (circulating without making hole).
 */
export interface DrillingParameterRow {
  order: number; startMkb: number | null; endDepthMkb: number | null;
  drillTimeHr: number | null; slideTimeHr: number | null; circTimeHr: number | null;
  intRopMHr: number | null; drillTq: number | null; rpm: number | null;
  qFlowGpm: number | null; sppPsi: number | null; wob1000Lbf: number | null;
}
export interface TimeRow { order: number; group: string | null; type: string | null; activity: string | null; hours: number | null }
export interface OperationRow {
  order: number; opCode: string | null; fromTime: string | null; toTime: string | null; remarks: string | null;
  // ── OIEC coding (advisory) + report 07's problem columns ──
  opLetter: string | null; opDetail: string | null; timeIndicator: string | null;
  opCode2: string | null;
  isProblem: boolean | null; probHr: number | null; problemRef: number | null;
}

/** Report 07's "Drilling Mud Volumes" — what MOVED, not the pit state. */
export interface MudVolumeRow {
  order: number; action: string | null; toWellBbl: number | null; fromWellBbl: number | null;
}
/** Report 06's "Safety Checks" sidebar — one row per check on the day. */
export interface SafetyCheckRow {
  order: number; time: string | null; type: string | null; des: string | null;
}
/** Report 07 page 2's "Safety Incidents". */
export interface SafetyIncidentRow {
  order: number; time: string | null; category: string | null; type: string | null;
  subType: string | null; cause: string | null; lostTime: boolean | null; severity: string | null;
}
/** Report 07 page 2's "Interval Problems"; the time log references these by row. */
export interface IntervalProblemRow {
  order: number; problemType: string | null; problemSubType: string | null;
  startDate: string | null; startTime: string | null;
  startDepthMkb: number | null; endDepthMkb: number | null; accountableParty: string | null;
  estCost: number | null; estLostTimeHr: number | null; comment: string | null;
}

/** The editable body of a report — exactly what PUT /entry/reports/:id accepts. */
export interface ReportBody {
  morningDepth: number | null; midnightDepth: number | null; previousDepth: number | null;
  /** a.json end_depth_tvd_mkb — the day's end depth on the TVD scale. */
  endDepthTvd: number | null;
  drillingTime: number | null; cumDrillingTime: number | null;
  /**
   * a.json report_header per-day counters. `cumTimeLogDays` is elapsed DAYS on
   * the well — a different quantity from `cumDrillingTime` (hours), never merge
   * the two. `hazards` is the free-text safety note ("STOP CARD: 12").
   */
  cumTimeLogDays: number | null; daysLti: number | null; headCount: number | null;
  hazards: string | null;
  holeSize: string | null; formation: string | null; lithology: string | null;
  lastCasing: string | null; linerLap: string | null; kop: string | null;
  wellSiteSupt: string | null; opnSupt: string | null; progEng: string | null;
  geologist: string | null; toolPusher1: string | null; toolPusher2: string | null;
  formationLoss: number | null; mudLossUnit: number | null; mudGains: number | null;
  /** a.json operations.summary — the 24-hour narrative. */
  description: string | null;
  /** a.json operations.at_report_time, e.g. 'RIH 24" H.S. BHA at 21m.' */
  opsAtReportTime: string | null;
  /** a.json operations.next_report_period — what is planned for the next 24 hrs. */
  opsNextPeriod: string | null;
  windSpeedDir: string | null; waveVisible: string | null;
  freshWater: number | null; fuel: number | null;
  bitRuns: BitRun[]; drillStrings: DrillStringRow[]; drillString: DrillPipe[]; tools: ToolItem[];
  drillingParameters: DrillingParameterRow[];
  mud: MudProps | null; solidControl: SolidControlRow[]; chemicals: ChemicalRow[];
  casing: CasingRow[]; formationTops: FormationTopRow[]; surveys: SurveyRow[];
  timeBreakdown: TimeRow[]; operations: OperationRow[];
  supervisors: SupervisorRow[]; companies: OnboardCompanyRow[];
  hseDrills: HseDrillRow[]; bulkMaterials: BulkMaterialRow[];
  // ── reports 06 / 07 ──
  mudVolumes: MudVolumeRow[]; safetyChecks: SafetyCheckRow[];
  safetyIncidents: SafetyIncidentRow[]; intervalProblems: IntervalProblemRow[];
  /** Weather, road and hole condition as reports 06 / 07 print them. */
  weather: string | null; roadCondition: string | null; holeCondition: string | null;
  temperatureC: number | null;
  /** Start depth on the TVD scale; `endDepthTvd` above is its other half. */
  startDepthTvd: number | null;
  /** Report 07's own "Remarks", distinct from the 24-hour summary. */
  remarks: string | null;
  /** Days since the last recordable incident (`daysLti` is lost-time). */
  daysRi: number | null;
  wellheads: WellheadRow[]; scrRates: ScrRateRow[]; supportVessels: SupportVesselRow[];
  fit: FitProps | null; marine: MarineProps | null;
}

export interface ReportDetail extends ReportBody {
  id: string; wellId: string; userId: string; serialNo: number; reportDate: string;
  status: "draft" | "submitted"; updatedAt: string; submittedAt: string | null;
  well: EntryWell; user: { id: string; username: string; fullName: string };
}
