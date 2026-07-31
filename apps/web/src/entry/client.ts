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
  meterage: number | null; hours: number | null; wob: number | null; rpm: number | null;
  torque: string | null; dullGrade: string | null; reasonPulled: string | null;
  pumpType: string | null; pumpOutput: number | null; pumpPressure: number | null;
  annularVelocity: number | null; hsi: number | null; cmtDrilled: string | null;
  washAndRun: string | null; bitChangeIn: string | null; bitChangeOut: string | null;
}
export interface BhaItem { order: number; assemblyNo: string | null; lengthM: number | null; specification: string | null }
export interface DrillPipe { order: number; size: string | null; grade: string | null; lengthM: number | null }
export interface ToolItem { kind: "jar" | "mwd" | "dhMotor"; type: string | null; size: string | null; serialNo: string | null; hours: number | null }
export interface MudProps {
  mudSystem: string | null; maxWeight: number | null; minWeight: number | null;
  reportTime: string | null; funnelVisc: number | null; pv: number | null; yp: number | null;
  gelInitial: number | null; gel10min: number | null; fan600: number | null; fan300: number | null;
  ph: number | null; alkalinity: number | null; waterLoss: number | null; hpht: number | null;
  airFoam: number | null; oilPct: number | null; oilWaterRatio: string | null;
  eStability: number | null; kcl: number | null; mbt: number | null; pf: number | null;
  mf: number | null; chloride: number | null; calcium: number | null;
  solidsPct: number | null; tempF: number | null;
}
export interface SolidControlRow { unit: string; hours: number | null; underFlow: number | null; overFlow: number | null; feed: number | null; cons: number | null; fprs: number | null }
export interface ChemicalRow { order: number; material: string | null; unit: string | null; used: number | null; received: number | null; stock: number | null; outstanding: number | null; requested: number | null; sent: number | null }
export interface CasingRow { order: number; casing: string | null; depth: number | null; joints: number | null }
export interface FormationTopRow { order: number; formation: string | null; depth: number | null; secondDepth: number | null; type: string | null }
export interface SurveyRow { order: number; md: number | null; inc: number | null; azi: number | null; tvd: number | null; ns: number | null; ew: number | null; dls: number | null }
export interface TimeRow { order: number; group: string | null; type: string | null; activity: string | null; hours: number | null }
export interface OperationRow { order: number; opCode: string | null; fromTime: string | null; toTime: string | null; remarks: string | null }

/** The editable body of a report — exactly what PUT /entry/reports/:id accepts. */
export interface ReportBody {
  morningDepth: number | null; midnightDepth: number | null; previousDepth: number | null;
  drillingTime: number | null; cumDrillingTime: number | null;
  holeSize: string | null; formation: string | null; lithology: string | null;
  lastCasing: string | null; linerLap: string | null; kop: string | null;
  wellSiteSupt: string | null; opnSupt: string | null; progEng: string | null;
  geologist: string | null; toolPusher1: string | null; toolPusher2: string | null;
  formationLoss: number | null; mudLossUnit: number | null; mudGains: number | null;
  description: string | null; windSpeedDir: string | null; waveVisible: string | null;
  freshWater: number | null; fuel: number | null;
  bitRuns: BitRun[]; bha: BhaItem[]; drillString: DrillPipe[]; tools: ToolItem[];
  mud: MudProps | null; solidControl: SolidControlRow[]; chemicals: ChemicalRow[];
  casing: CasingRow[]; formationTops: FormationTopRow[]; surveys: SurveyRow[];
  timeBreakdown: TimeRow[]; operations: OperationRow[];
}

export interface ReportDetail extends ReportBody {
  id: string; wellId: string; userId: string; serialNo: number; reportDate: string;
  status: "draft" | "submitted"; updatedAt: string; submittedAt: string | null;
  well: EntryWell; user: { id: string; username: string; fullName: string };
}
