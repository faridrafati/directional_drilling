/**
 * Tiny typed fetch wrapper for the Fastify API.
 * Vite proxies /api → http://localhost:4000 (see vite.config.ts).
 */

const BASE = "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

export interface ProjectSummary {
  id: string;
  name: string;
  units: string; // JSON-encoded
  createdAt: string;
  updatedAt: string;
}

export interface ProjectDetail extends ProjectSummary {
  countries: Array<{
    id: string;
    name: string;
    fields: Array<{
      id: string;
      name: string;
      wells: Array<{
        id: string;
        name: string;
        calculations: Array<{ id: string; name: string; type: string }>;
      }>;
    }>;
  }>;
}

export interface SegmentRow {
  id?: string;
  order: number;
  profileType: number;
  /** Pascal-style milestone role (KOP / EOC / Target / ...). Null for START. */
  milestoneRole: string | null;
  comment: string | null;
  md: number; inc: number; azm: number; tvd: number; vsec: number;
  ns: number; ew: number; dls: number; tf: number; br: number; tr: number; dmd: number;
  surveyTools: string | null;
}

export interface StationRow {
  id: string;
  /** Position in the densified trajectory (0..N-1). */
  order: number;
  /** Which input Segment this station belongs to (= Segment.order). */
  segmentOrder: number;
  comment: string | null;
  md: number; inc: number; azm: number; tvd: number; vsec: number;
  ns: number; ew: number; dls: number; tf: number; br: number; tr: number; dmd: number;
}

/** Exact algebraic milestone (KOP/EOC/Target/...) from the dispatcher. */
export interface KeypointRow {
  id: string;
  segmentOrder: number;
  roleIndex: number;
  comment: string | null;
  md: number; inc: number; azm: number; tvd: number; vsec: number;
  ns: number; ew: number; dls: number; tf: number; br: number; tr: number; dmd: number;
}

export interface CalculationDetail {
  id: string;
  name: string;
  type: "WellDesign" | "SurveyEditor";
  segments: SegmentRow[];
  stations: StationRow[];
  keypoints: KeypointRow[];
  well?: {
    id: string;
    name: string;
    field?: {
      id: string;
      name: string;
      country?: {
        id: string;
        name: string;
        project?: { id: string; name: string };
      };
    };
  };
}

export interface CalculateResult {
  ok: boolean;
  stationCount: number;
  errors: Array<{ segmentIndex: number; message: string }>;
}
