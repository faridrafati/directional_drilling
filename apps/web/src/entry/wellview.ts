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
  kind?: "money" | "decimal" | "int" | "text";
  span?: number;
}
export type HeaderRow = HeaderCell[];

export interface ReportEnvelope {
  type: string;
  title: string;
  wellName: string;
  identityRight?: string | null;
  headerVariant: "standard" | "dailyDrilling" | "wellJob" | "none";
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

export interface CatalogEntry {
  type: string;
  title: string;
  category: "Daily" | "Engineering" | "Cost & Multi-well" | "Geology" | "Completion";
  params: ("well" | "job" | "date" | "dateRange" | "bhaRun" | "wells")[];
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
