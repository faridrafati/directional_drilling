/**
 * Client for the WellView-online database API (/entry/wellview/dbs/*) — the
 * converted Peloton databases behind the Well Explorer, Edit Data window,
 * schematic and data auditor. Same authenticated transport as every /entry/*
 * call.
 */
import { entryApi } from "./client.js";

export interface WvDatabase { id: string; file: string; wells: number; sizeBytes: number }

export interface WvHeaderColumn { column: string; label: string }

export interface WvWellList {
  columns: WvHeaderColumn[];
  wells: Record<string, string | number | null>[];   // always includes idwell + WellName
}

export interface WvTreeNode {
  table: string;
  label: string;
  count: number;
  children: WvTreeNode[];
}

/** The physical types WellView's data model declares for a field. */
export type WvFieldType = "string" | "stringlong" | "double" | "datetime" | "boolean" | "integer" | "blob";

export interface WvRecordColumn {
  column: string;
  label: string;
  id: boolean;
  system: boolean;
  /** TK companion of a link column — managed with it, never shown. */
  tk?: boolean;
  /** Record-link column: candidate target tables + the TK column to keep in step. */
  link?: { tkColumn: string | null; targets: string[] };
  /** Field help from WellView's data model (§3.11). */
  help?: string;
  /** Computed by WellView at print time — the desktop's green, locked fields. */
  calculated?: boolean;
  /** Hidden until "Show All Fields". */
  hiddenByDefault?: boolean;
  type?: WvFieldType;
  unit?: string;
}
export interface WvRecords {
  table: string;
  label: string;
  /** Folder help from the data model (§3.11 Folder and Field Help). */
  help?: string;
  /** Ordered folders (tallies, string components) — the manual's Move up/down,
   *  Add Records to Top and Invert Components commands apply to these. */
  sequenced?: boolean;
  allowInsertTop?: boolean;
  allowSeqInvert?: boolean;
  parentTable: string | null;
  columns: WvRecordColumn[];
  rows: Record<string, string | number | null>[];
}

export interface WvAuditFinding {
  ruleId: string;
  report: string;
  rule: string;
  table: string;
  idwell: string;
  well: string | null;
  idrec: string | null;
  detail: Record<string, string | number | null>;
}
export interface WvAuditResult {
  findings: WvAuditFinding[];
  skipped: { ruleId: string; reason: string }[];
  rulesRun: number;
}

/** One string/item on the schematic; keys mirror the wv table columns. */
export type WvSchematicRow = Record<string, string | number | null> & { IDRec?: string };
export interface WvSchematic {
  wellbores: WvSchematicRow[];
  sizes: WvSchematicRow[];
  casings: (WvSchematicRow & { maxOd: number | null })[];
  tubings: (WvSchematicRow & { maxOd: number | null })[];
  rods: WvSchematicRow[];
  otherInHole: WvSchematicRow[];
  perforations: WvSchematicRow[];
  cement: WvSchematicRow[];
  zones: WvSchematicRow[];
  dates: string[];
}

const enc = encodeURIComponent;

export const wvDbApi = {
  databases: () => entryApi.get<WvDatabase[]>("/wellview/dbs"),

  headerColumns: (db: string) =>
    entryApi.get<WvHeaderColumn[]>(`/wellview/dbs/${enc(db)}/header-columns`),

  wells: (db: string, opts?: { cols?: string[]; lookin?: string; lookfor?: string }) => {
    const q = new URLSearchParams();
    if (opts?.cols?.length) q.set("cols", opts.cols.join(","));
    if (opts?.lookin && opts?.lookfor) { q.set("lookin", opts.lookin); q.set("lookfor", opts.lookfor); }
    const qs = q.toString();
    return entryApi.get<WvWellList>(`/wellview/dbs/${enc(db)}/wells${qs ? `?${qs}` : ""}`);
  },

  tree: (db: string, idwell?: string) =>
    entryApi.get<{ tree: WvTreeNode[] }>(
      `/wellview/dbs/${enc(db)}/tree${idwell ? `?idwell=${enc(idwell)}` : ""}`),

  records: (db: string, table: string, opts?: { idwell?: string; parent?: string; system?: boolean }) => {
    const q = new URLSearchParams();
    if (opts?.idwell) q.set("idwell", opts.idwell);
    if (opts?.parent) q.set("parent", opts.parent);
    if (opts?.system) q.set("system", "1");
    const qs = q.toString();
    return entryApi.get<WvRecords>(`/wellview/dbs/${enc(db)}/records/${enc(table)}${qs ? `?${qs}` : ""}`);
  },

  insert: (db: string, table: string, body: { idwell?: string; parent?: string; values: Record<string, unknown> }) =>
    entryApi.post<{ idrec: string | null; idwell: string | null }>(`/wellview/dbs/${enc(db)}/records/${enc(table)}`, body),

  update: (db: string, table: string, idrec: string, values: Record<string, unknown>) =>
    entryApi.patch<{ changed: number }>(`/wellview/dbs/${enc(db)}/records/${enc(table)}/${enc(idrec)}`, { values }),

  remove: (db: string, table: string, idrec: string) =>
    entryApi.del<{ removed: number }>(`/wellview/dbs/${enc(db)}/records/${enc(table)}/${enc(idrec)}`),

  audit: (db: string, wells?: string[]) =>
    entryApi.get<WvAuditResult>(
      `/wellview/dbs/${enc(db)}/audit${wells?.length ? `?wells=${enc(wells.join(","))}` : ""}`),

  schematic: (db: string, idwell: string) =>
    entryApi.get<WvSchematic>(`/wellview/dbs/${enc(db)}/schematic?idwell=${enc(idwell)}`),

  templateDataPath: (db: string, html: string, well: string, anchor?: { table: string; idrec: string } | null) =>
    `/wellview/dbs/${enc(db)}/template-data?html=${enc(html)}&well=${enc(well)}` +
    (anchor ? `&anchor=${enc(`${anchor.table}:${anchor.idrec}`)}` : ""),

  /** Candidate records (id + readable caption) for a link column's target table. */
  linkCandidates: (db: string, table: string, idwell?: string) =>
    entryApi.get<{ table: string; candidates: { idrec: string; caption: string }[] }>(
      `/wellview/dbs/${enc(db)}/link-candidates?table=${enc(table)}${idwell ? `&idwell=${enc(idwell)}` : ""}`),

  /** Distinct stored values of a well-header column — the Quick Query lookup. */
  headerValues: (db: string, column: string) =>
    entryApi.get<{ values: string[] }>(`/wellview/dbs/${enc(db)}/header-values?column=${enc(column)}`),

  /** Deep-copy a record (subfolder records included) into a well/parent. */
  copyRecord: (db: string, table: string, idrec: string, target?: { idwell?: string; parent?: string }) =>
    entryApi.post<{ idrec: string; copied: number }>(
      `/wellview/dbs/${enc(db)}/records/${enc(table)}/${enc(idrec)}/copy`, target ?? {}),

  /** Delete an entire well — every table's rows for the idwell. */
  deleteWell: (db: string, idwell: string) =>
    entryApi.del<{ removed: number }>(`/wellview/dbs/${enc(db)}/wells/${enc(idwell)}`),
};
