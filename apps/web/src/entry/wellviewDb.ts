/**
 * Client for the WellView-online database API (/entry/wellview/dbs/*) — the
 * converted Peloton databases behind the Well Explorer, Edit Data window,
 * schematic and data auditor. Same authenticated transport as every /entry/*
 * call.
 */
import type { UnitFormat } from "@dd/shared";
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
  /** Per unit set: the unit to display in, and its decimals. */
  units?: Record<string, UnitFormat>;
  /** Measured from the reference datum, and how it responds to a change. */
  applyDatum?: boolean;
  datumMode?: "up" | "invariant";
  /** The form section this field belongs to ("Well Identifiers", "Elevations"…). */
  group?: string;
  /** Required by Chevron's Data Entry Audit rules — the desktop's yellow fields. */
  required?: boolean;
  /** A required GLOBAL METRIC — the desktop's cyan fields (§4.3). */
  globalMetric?: boolean;
  /** §5: a new record inherits this field from the previous one. */
  carryForward?: boolean;
  /** …and some inherit it STEPPED — run numbers +1, a report's end date +1 day. */
  carryForwardIncrement?: number;
  /** …and some inherit it from a DIFFERENT field: a report's start date comes
   *  from the previous report's end date. Written "wvTable.Field". */
  carryForwardFrom?: string;
  /** The model binds this field to a WellView Library list. The approved list
   *  itself is NOT available — custom/library/*.lib are encrypted — so the
   *  lookup offers the values this database uses and says as much. */
  library?: { table: string; field: string | null };
  /** The rule only warns; it does not block. */
  warnOnly?: boolean;
}
export interface WvRecords {
  table: string;
  label: string;
  /** Folder help from the data model (§3.11 Folder and Field Help). */
  help?: string;
  /** Section order for the entry form. */
  fieldGroups?: string[];
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
  /** "<table>.<column>" → the unit that detail value is stored in. */
  units?: Record<string, { unit?: string; units?: Record<string, UnitFormat> }>;
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
  /** The unit every depth on the diagram is stored in, and how to show it. */
  depth?: { unit?: string; units?: Record<string, UnitFormat> };
  /** The same for hole and pipe sizes, which read in inches as a fraction. */
  size?: { unit?: string; units?: Record<string, UnitFormat> };
}

/** A saved Query Template (§8.1) and one of its criteria. */
export interface WvQueryCriterion {
  table: string;
  field: string;
  op: string | null;
  value: string | null;
  /** §8.1 "Prompt for Value" — the user supplies it when the query runs. */
  prompts: boolean;
  tableLabel: string;
  fieldLabel: string;
  isDate: boolean;
}
export interface WvQuery {
  id: string;
  category: string;
  name: string;
  criteria: WvQueryCriterion[];
}
export interface WvQueryResult {
  wells: { idwell: string; name: string }[];
  /** Criteria that could not be applied, and why — never dropped silently. */
  skipped: { criterion: string; reason: string }[];
  ran: number;
  note?: string;
}

/** A survey station: the three measured values, and the computed rest. */
export interface WvSurveyStation {
  md: number; inclination: number; azimuth: number;
  tvd: number; ns: number; ew: number;
  departure: number;
  dls: number | null; vs: number | null;
  buildRate: number | null; turnRate: number | null;
  /** A stored override supplied one of these values. */
  overridden: boolean;
  /** No azimuth was recorded here; the previous bearing was carried. */
  azimuthAssumed: boolean;
}
export interface WvSurvey {
  survey: string;
  method: string;
  columns: { key: string; label: string; unit?: string; computed: boolean }[];
  stations: WvSurveyStation[];
  excludedBadStations: number;
  /** How many stations carry an assumed bearing (inclination-only survey). */
  assumedAzimuth: number;
  verticalSection: string | null;
  notes: string[];
}


/** A multi-well report template (`custom/reports multi/*.afm`). */
export interface WvMultiReport {
  html: string;
  name: string;
  folder: string;
  formatVersion: number;
  blocks: { table: string | null; title: string | null; fields: number }[];
}
export interface WvMultiBlock {
  table: string | null;
  title: string | null;
  exists: boolean;
  columns: { column: string; label: string; unit?: string; units?: Record<string, UnitFormat>; fromWell?: boolean }[];
  missing: string[];
  rows: (string | number | null)[][];
  rowCount: number;
  truncated: boolean;
  /** Set when the template predates this database's schema. */
  schemaDrift?: string;
  /** Set when columns are blank because WellView computes them at print time. */
  printTimeNote?: string;
}
export interface WvMultiResult {
  report: string;
  name: string;
  wells: number;
  blocks: WvMultiBlock[];
}


/** An Excel-report data extract (`custom/reports multi/*.afmxl`). */
export interface WvXlReport {
  html: string; name: string; folder: string; table: string; title: string;
  fields: number; hasWorkbook: boolean; filtered: boolean; filterUnread: boolean;
}
export interface WvXlResult {
  report: string; name: string; table: string; wells: number;
  columns: { column: string; label: string; unit?: string; units?: Record<string, UnitFormat>;
             fromWell?: boolean; computed?: boolean }[];
  rows: (string | number | null)[][];
  rowCount: number;
  truncated: boolean;
  missing: string[];
  applied: { table: string; field: string; value: string }[];
  notes: string[];
}


/** A file stored inside the WellView database (wvAttachment). */
export interface WvAttachment {
  idrec: string;
  idwell: string | null;
  parent: string | null;
  parentTable: string | null;
  des: string | null;
  typ1: string | null;
  typ2: string | null;
  dttm: string | null;
  com: string | null;
  /** Where the file came from when it was attached — provenance, not a link. */
  sourceUrl: string | null;
  extension: string | null;
  bytes: number;
  mime: string;
  kind: string;
  /** True only for raster images the server is willing to render in place. */
  inline: boolean;
}

/** A well's reference elevations, for Tools > Reference Datum. */
export interface WvElevations {
  idwell: string;
  elevations: Partial<Record<"OrigKB" | "Ground" | "MudLine" | "CasFlange" | "TubHead", number | null>>;
  unit?: string;
}


/** A product's closing balance on a well (Mud Inventory Transfer, §5.1). */
export interface WvInventoryItem {
  idrec: string; des: string | null; typ: string | null;
  unitLabel: string | null; unitSz: number | null;
  vendor: string | null; cost: number | null;
  received: number; consumed: number; returned: number; balance: number;
  kind: "mud" | "supply";
  transferable: boolean; reason?: string;
}


/** One line of a query template: a column, an operator and a value (§8.1). */
export interface WvCriterion {
  table: string; field: string; op: string;
  /** null when the criterion prompts for a value, matching the shipped shape. */
  value?: string | null;
  prompts?: boolean;
}
export interface WvSavedQuery {
  id: string; name: string; category: string;
  /**
   * The SAME shape as a shipped template's criteria, so the prompt panel
   * renders a saved query exactly as it renders a Peloton one.
   */
  criteria: WvQueryCriterion[];
  createdBy: string; updatedAt: string;
}


/** A saved schematic view (§8.3): a name over the display settings. */
export interface WvSchematicTemplate {
  id: string; name: string;
  settings: { layers?: Record<string, boolean>; smartScaling?: boolean; showProposed?: boolean };
  createdBy: string;
}

/** One labelled value from a wellhead record, with its unit. */
export interface WvWellheadField {
  column: string; label: string; value: string | number;
  /** The model's physicaltype — decides how the value is rendered. */
  type?: "string" | "stringlong" | "double" | "datetime" | "boolean" | "integer" | "blob";
  unit?: string; units?: Record<string, UnitFormat>;
}
export interface WvWellheadOutlet { idrec: string; fields: WvWellheadField[] }
export interface WvWellheadComp {
  idrec: string; des: string | null;
  fields: WvWellheadField[]; outlets: WvWellheadOutlet[];
}
export interface WvWellhead {
  idrec: string;
  /** The assembly picture WellView recorded, already resolved to a file. */
  icon: string | null;
  iconName: string | null;
  /** The job this head was installed on, named rather than a GUID. */
  job: string | null;
  fields: WvWellheadField[];
  components: WvWellheadComp[];
}

/** One point on a days-vs-depth series. */
export interface WvDvdPoint { x: number; y: number; label?: string }
/** An axis: the model's caption, its base unit, and the per-set formats. */
export interface WvDvdAxis {
  field: string; label: string; unit?: string; units?: Record<string, UnitFormat>;
  /** Measured from the reference datum — the depth axes are, days and cost are not. */
  applyDatum?: boolean;
  datumMode?: "depth" | "up" | "invariant";
}
export interface WvDvdSeries {
  caption: string; x: WvDvdAxis; y: WvDvdAxis;
  /** "plan" comes from the phase program, "actual" from the daily reports. */
  kind: "plan" | "actual";
  points: WvDvdPoint[];
}
export interface WvDaysVsDepth {
  supported: boolean;
  jobs: { idrec: string; label: string; phases: number; reports: number }[];
  job: { idrec: string; label: string } | null;
  templates: { id: string; name: string; folder: string }[];
  template: { id: string; name: string } | null;
  series: WvDvdSeries[];
  /** Series the template asked for that this job has no data for. */
  unavailable: string[];
}

const enc = encodeURIComponent;

export const wvDbApi = {
  databases: () => entryApi.get<WvDatabase[]>("/wellview/dbs"),

  /** The drilling curve: WellView's Days vs Depth / Cost chart for a job. */
  daysVsDepth: (db: string, idwell: string, job?: string, template?: string) =>
    entryApi.get<WvDaysVsDepth>(
      `/wellview/dbs/${enc(db)}/days-vs-depth?idwell=${enc(idwell)}`
      + (job ? `&job=${enc(job)}` : "") + (template ? `&template=${enc(template)}` : "")),

  /** The well's wellhead assemblies, their components and outlets. */
  wellheads: (db: string, idwell: string) =>
    entryApi.get<{ supported: boolean; wellheads: WvWellhead[] }>(
      `/wellview/dbs/${enc(db)}/wellheads?idwell=${enc(idwell)}`),

  /** Saved schematic views. Not per-database: they name element kinds. */
  schematicTemplates: (db: string) =>
    entryApi.get<{ templates: WvSchematicTemplate[] }>(
      `/wellview/dbs/${enc(db)}/schematic-templates`),

  saveSchematicTemplate: (db: string, body: { id?: string; name: string; settings: unknown }) =>
    entryApi.post<{ id: string; name: string }>(
      `/wellview/dbs/${enc(db)}/schematic-templates`, body),

  deleteSchematicTemplate: (db: string, id: string) =>
    entryApi.del<{ deleted: string }>(`/wellview/dbs/${enc(db)}/schematic-templates/${enc(id)}`),

  /** Query templates written in the app, for this database. */
  savedQueries: (db: string) =>
    entryApi.get<{ queries: WvSavedQuery[] }>(`/wellview/dbs/${enc(db)}/saved-queries`),

  saveQuery: (db: string, body: { id?: string; name: string; category?: string; criteria: WvCriterion[] }) =>
    entryApi.post<{ id: string; name: string }>(`/wellview/dbs/${enc(db)}/saved-queries`, body),

  deleteQuery: (db: string, id: string) =>
    entryApi.del<{ deleted: string }>(`/wellview/dbs/${enc(db)}/saved-queries/${enc(id)}`),

  /** The tables and columns a query may be built from. */
  queryTables: (db: string) =>
    entryApi.get<{ tables: { table: string; label: string }[] }>(
      `/wellview/dbs/${enc(db)}/query-fields`),

  queryFields: (db: string, table: string) =>
    entryApi.get<{ table: string; fields: { field: string; label: string; type: string; unit?: string }[] }>(
      `/wellview/dbs/${enc(db)}/query-fields?table=${enc(table)}`),

  /** Run criteria that have not been saved — the builder's preview. */
  runCriteria: (db: string, criteria: WvCriterion[]) =>
    entryApi.post<{ wells: Record<string, string | number | null>[]; skipped: { criterion: string; reason: string }[] }>(
      `/wellview/dbs/${enc(db)}/queries/run`, { criteria }),

  /** Closing mud-additive and job-supply balances for a well. */
  inventory: (db: string, idwell: string) =>
    entryApi.get<{ idwell: string; items: WvInventoryItem[]; transferable: number }>(
      `/wellview/dbs/${enc(db)}/inventory?idwell=${enc(idwell)}`),

  transferInventory: (db: string, body: {
    fromWell: string; toWell: string; toJob: string; dtTm: string; items: string[];
  }) => entryApi.post<{
    transferred: { des: string | null; kind: string; quantity: number; unit: string | null }[];
    skipped: { des: string | null; reason: string }[];
    reusedProducts: number; createdProducts: number;
  }>(`/wellview/dbs/${enc(db)}/inventory-transfer`, body),

  /** Download a well as a portable JSON document. */
  exportWell: (db: string, idwell: string) =>
    entryApi.blob(`/wellview/dbs/${enc(db)}/export?idwell=${enc(idwell)}`),

  importPreflight: (db: string, payload: unknown) =>
    entryApi.post<{ ok: boolean; reason?: string; missingTables: string[]; missingColumns: string[] }>(
      `/wellview/dbs/${enc(db)}/import/preflight`, payload),

  importWell: (db: string, payload: unknown) =>
    entryApi.post<{
      idwell: string; wellName: string | null;
      inserted: { tables: number; rows: number };
      missingTables: string[]; missingColumns: string[]; emptyTables: number;
    }>(`/wellview/dbs/${enc(db)}/import`, payload),

  /** The elevations a well can be re-referenced to. */
  elevations: (db: string, idwell: string) =>
    entryApi.get<WvElevations>(`/wellview/dbs/${enc(db)}/elevations?idwell=${enc(idwell)}`),

  /** Attachment metadata for a well, or for one record of one table. */
  attachments: (db: string, q: { idwell?: string; table?: string; idrec?: string }) => {
    const p = new URLSearchParams();
    if (q.idwell) p.set("idwell", q.idwell);
    if (q.table) p.set("table", q.table);
    if (q.idrec) p.set("idrec", q.idrec);
    return entryApi.get<{ supported: boolean; attachments: WvAttachment[] }>(
      `/wellview/dbs/${enc(db)}/attachments?${p.toString()}`);
  },

  /** The bytes, fetched with the bearer token (see entryApi.blob). */
  attachmentBlob: (db: string, idrec: string) =>
    entryApi.blob(`/wellview/dbs/${enc(db)}/attachments/${enc(idrec)}/content`),

  uploadAttachment: (db: string, form: FormData) =>
    entryApi.postForm<{ idrec: string; bytes: number; mime: string; kind: string; inline: boolean }>(
      `/wellview/dbs/${enc(db)}/attachments`, form),

  /** The multi-well templates this database can run. */
  multiReports: (db: string) =>
    entryApi.get<{ reports: WvMultiReport[] }>(`/wellview/dbs/${enc(db)}/reports-multi`),

  /** Run one across an explicit set of wells — never an implicit "all". */
  multiReport: (db: string, html: string, wells: string[]) =>
    entryApi.get<WvMultiResult>(
      `/wellview/dbs/${enc(db)}/multi-report?html=${enc(html)}&wells=${enc(wells.join(","))}`),

  /** The Excel-report extracts (data half only — the .xlt workbook is not rebuilt). */
  xlReports: (db: string) =>
    entryApi.get<{ reports: WvXlReport[] }>(`/wellview/dbs/${enc(db)}/reports-xl`),

  xlExtract: (db: string, html: string, wells: string[]) =>
    entryApi.get<WvXlResult>(
      `/wellview/dbs/${enc(db)}/xl-extract?html=${enc(html)}&wells=${enc(wells.join(","))}`),

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

  /** A record's ancestor chain, subject-area root first — lets Edit Data open
   *  on a record found in a report with every parent folder positioned. */
  recordPath: (db: string, table: string, idrec: string) =>
    entryApi.get<{ path: { table: string; idrec: string }[] }>(
      `/wellview/dbs/${enc(db)}/record-path?table=${enc(table)}&idrec=${enc(idrec)}`),

  /**
   * Distinct values a column actually holds in this database — Quick Query's
   * Look-for lookup, and the library lookup in Edit Data.
   */
  columnValues: (db: string, table: string, column: string) =>
    entryApi.get<{ table: string; column: string; values: string[] }>(
      `/wellview/dbs/${enc(db)}/column-values?table=${enc(table)}&column=${enc(column)}`),

  /** The well-header case, which is what Quick Query asks for. */
  headerValues: (db: string, column: string) =>
    entryApi.get<{ values: string[] }>(
      `/wellview/dbs/${enc(db)}/column-values?table=wvWellHeader&column=${enc(column)}`),

  /** Deep-copy a record (subfolder records included) into a well/parent. */
  copyRecord: (db: string, table: string, idrec: string, target?: { idwell?: string; parent?: string }) =>
    entryApi.post<{ idrec: string; copied: number }>(
      `/wellview/dbs/${enc(db)}/records/${enc(table)}/${enc(idrec)}/copy`, target ?? {}),

  /**
   * Rewrite a sequenced folder's order (§3.9). The whole order is sent, so
   * Move up/down, Add Records to Top and Invert Components are all one call.
   */
  reorder: (db: string, table: string, body: { idwell?: string; parent?: string; order: string[] }) =>
    entryApi.post<{ reordered: number }>(
      `/wellview/dbs/${enc(db)}/records/${enc(table)}/reorder`, body),

  /** A directional survey with the values WellView computes at print time. */
  survey: (db: string, surveyId: string) =>
    entryApi.get<WvSurvey>(`/wellview/dbs/${enc(db)}/survey?survey=${enc(surveyId)}`),

  /** The saved Query Templates shipped with WellView (§8.1). */
  queries: (db: string) =>
    entryApi.get<{ queries: WvQuery[] }>(`/wellview/dbs/${enc(db)}/queries`),

  /** Run one, supplying any prompted values keyed by criterion index. */
  runQuery: (db: string, id: string, values: Record<string, string>) =>
    entryApi.post<WvQueryResult>(`/wellview/dbs/${enc(db)}/queries/run`, { id, values }),

  /** Delete an entire well — every table's rows for the idwell. */
  deleteWell: (db: string, idwell: string) =>
    entryApi.del<{ removed: number }>(`/wellview/dbs/${enc(db)}/wells/${enc(idwell)}`),
};
