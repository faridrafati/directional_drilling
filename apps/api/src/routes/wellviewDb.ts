/**
 * WellView Online — the database-facing half of the WellView web application.
 *
 * The desktop WellView (Peloton) is a shell around one relational schema:
 * every table carries `idwell`, records are identified by `IDRec`, and child
 * records point at their parent record through `IDRecParent`. The parent TABLE
 * is not stored anywhere — it is encoded in the table NAME: `wvJobReportTimeLog`
 * is a child of `wvJobReport`, which is a child of `wvJob`. That prefix rule
 * was verified against the converted sample database (128 child tables with
 * live rows all resolve; the three exceptions are `wvWellbore`, whose
 * IDRecParent is a SELF-reference for sidetracks, and `wvAttachment`/`wvComment`,
 * which attach to any record).
 *
 * This module serves, for each converted database in `sqlite_DB/wellview/`:
 *   • the Open Database list (the manual's chapter-1 dialog)
 *   • the Well Explorer list with selectable well-header columns and the
 *     Quick Query filter (manual §3.2–3.3)
 *   • the Edit Data subject-area tree with per-well record counts (§3.9)
 *   • records of any folder, and add / edit / duplicate / delete with the
 *     manual's cascade rule ("when deleting a record containing records in a
 *     subfolder, all of the records in the subfolder are also deleted")
 *   • the Data Audit rules of §10.2, each one skipped honestly when the
 *     schema lacks its columns rather than silently passing
 *   • the schematic payload (§3.8) and the template-data resolution shared
 *     with the sample-database browser.
 *
 * Mutations open the SQLite file writable — that file IS the database, exactly
 * as the .mdb was for desktop WellView. The conversion source `.mdb` files are
 * kept under WellView_files/db, so a database can always be regenerated.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import type { FastifyInstance, FastifyReply } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { requireUser, requireAdmin } from "../entry/auth.js";
import { resolveTemplateData, iconByName } from "./wellviewSample.js";
import { daysVsDepth, resolveTemplate, type DvdTemplate } from "../wellview/daysVsDepth.js";
import { calcFieldsFor, computeRow, calcAggregatesFor, sumChildren } from "../wellview/calcFields.js";
import { appFrame, WELL_FILE_EXTENSION } from "../wellview/appframe.js";
import { columnLabel, folderLabel, modelField, modelTable, renderRecordDes } from "../wellview/model.js";
import { computeSurvey } from "@dd/shared";
import { resolveMultiTemplate, type MultiTemplate } from "../wellview/multiReport.js";
import { resolveXlExtract, type XlTemplate } from "../wellview/xlExtract.js";
import { sniff, safeFilename, attachmentHeaders, MAX_ATTACHMENT_BYTES } from "../wellview/attachments.js";
import { exportWell, importWell, importPreflight, type WellExport } from "../wellview/transfer.js";
import { closingInventory, transferInventory } from "../wellview/inventory.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..", "..", "..");
const DB_DIR = join(REPO, "sqlite_DB", "wellview");
/** Rows one Paste Data may insert. The guide’s largest tally is 147 joints. */
const PASTE_ROW_CAP = 5000;
/** Rows a Custom SQL query may return before it is truncated (§8.1). */
const SQL_ROW_CAP = 2000;
const DVDC_JSON = join(REPO, "apps", "web", "public", "wellview-templates", "days-vs-depth.json");

/**
 * WellView's own Days vs Depth chart templates, as build_dvdc.mjs decoded them.
 *
 * Read once and cached. Missing is not an error: the app still charts, it just
 * has no shipped template to start from — the caller sees an empty list rather
 * than a 500, the same way an installation with no .dvdc files behaves.
 */
let _dvdc: DvdTemplate[] | null = null;
function dvdTemplates(): DvdTemplate[] {
  if (_dvdc) return _dvdc;
  try {
    const j = JSON.parse(readFileSync(DVDC_JSON, "utf8")) as { templates?: DvdTemplate[] };
    _dvdc = j.templates ?? [];
  } catch {
    _dvdc = [];
  }
  return _dvdc;
}

// ── database registry ─────────────────────────────────────────────────────────
interface Db {
  id: string;
  path: string;
  ro: DatabaseSync;
  rw: DatabaseSync | null;
}
const _dbs = new Map<string, Db>();

function listDbFiles(): { id: string; path: string }[] {
  if (!existsSync(DB_DIR)) return [];
  return readdirSync(DB_DIR)
    .filter((f) => f.endsWith(".sqlite"))
    .map((f) => ({ id: f.replace(/\.sqlite$/, ""), path: join(DB_DIR, f) }));
}

function db(id: string): Db | null {
  const hit = _dbs.get(id);
  if (hit) return hit;
  const file = listDbFiles().find((f) => f.id === id);
  if (!file) return null;
  const ro = new DatabaseSync(file.path, { readOnly: true });
  // A writer elsewhere (another process, a test worker) must mean "wait a
  // moment", not SQLITE_BUSY bubbling up as a 500.
  ro.exec("PRAGMA busy_timeout = 3000");
  const entry: Db = { id, path: file.path, ro, rw: null };
  _dbs.set(id, entry);
  return entry;
}


/**
 * The wellbore a new record belongs to, when the user has not said.
 *
 * WellView ships this as a data-event add-in —
 * `system/bin/add-ins/data events/Peloton.Addin.WellView.DefaultWellboreLinker.dll`
 * — and the effect is visible in the data: IDRecWellbore is populated on 98% of
 * drilling parameters, 100% of logs, 96% of perforations, 88% of phases. A
 * record created without it is one WellView would consider unlinked, and it
 * drops out of anything scoped by wellbore.
 *
 * The default is only taken where it is UNAMBIGUOUS: the well's single
 * wellbore (38 of the sample's 41 wells), or the Original Hole, which §10.4
 * marks by pointing IDRecParent at itself. A well with several sidetracks and
 * no original gets nothing rather than a guess — picking the wrong bore is
 * worse than leaving a field the user can fill.
 */
function defaultWellbore(d: Db, idwell: string): string | null {
  const wb = table(d, "wvWellbore");
  const idrec = wb?.colSet.get("idrec");
  if (!wb || !idrec || !wb.hasIdwell) return null;
  const rows = d.ro.prepare(
    `SELECT "${idrec}" AS id, "${wb.colSet.get("idrecparent") ?? idrec}" AS parent
       FROM "${wb.name}" WHERE "${wb.colSet.get("idwell")}" = ?`).all(idwell) as
    { id: string; parent: string | null }[];
  if (rows.length === 1) return rows[0].id;
  const original = rows.filter((r) => r.parent && r.parent === r.id);
  return original.length === 1 ? original[0].id : null;
}

/** The writable handle, opened only when a mutation actually happens. */
function writable(d: Db): DatabaseSync {
  if (!d.rw) {
    d.rw = new DatabaseSync(d.path);
    d.rw.exec("PRAGMA busy_timeout = 3000");
  }
  return d.rw;
}

// ── schema model (per database) ───────────────────────────────────────────────
interface TableInfo {
  name: string;                       // actual mixed-case name
  cols: string[];                     // actual column names in order
  colSet: Map<string, string>;        // lowercase → actual
  hasIdwell: boolean;
  hasParent: boolean;
  parent: string | null;              // parent TABLE name (prefix rule)
  children: string[];
}
const _schemas = new Map<string, Map<string, TableInfo>>();

function schema(d: Db): Map<string, TableInfo> {
  const hit = _schemas.get(d.id);
  if (hit) return hit;
  const out = new Map<string, TableInfo>();
  const names = (d.ro.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as
    { name: string }[]).map((r) => r.name);
  const byLc = new Map(names.map((n) => [n.toLowerCase(), n]));
  for (const name of names) {
    const cols = (d.ro.prepare(`PRAGMA table_info("${name}")`).all() as { name: string }[]).map((c) => c.name);
    const colSet = new Map(cols.map((c) => [c.toLowerCase(), c]));
    out.set(name.toLowerCase(), {
      name, cols, colSet,
      hasIdwell: colSet.has("idwell"),
      hasParent: colSet.has("idrecparent"),
      parent: null, children: [],
    });
  }
  for (const t of out.values()) {
    if (!t.hasParent) continue;
    const lc = t.name.toLowerCase();
    // Longest proper prefix that is itself a table = the parent table.
    for (let i = lc.length - 1; i > 2; i--) {
      const cand = lc.slice(0, i);
      if (byLc.has(cand)) {
        // wvWellbore's IDRecParent is a self-reference (sidetrack → parent bore),
        // not a link into another table — it stays a top-level subject area.
        if (cand === lc) continue;
        t.parent = byLc.get(cand)!;
        out.get(cand)!.children.push(t.name);
        break;
      }
    }
  }
  _schemas.set(d.id, out);
  return out;
}

const table = (d: Db, name: string): TableInfo | null => schema(d).get(name.toLowerCase()) ?? null;

/** System/bookkeeping columns, hidden unless the client asks (§3.9 "View System Fields"). */
const isSysCol = (c: string) => /^sys/i.test(c);
/** The server-managed KEYS — never writable from the client. */
const isKeyCol = (c: string) => ["idwell", "idrec", "idrecparent"].includes(c.toLowerCase());
/**
 * Record-LINK columns (IDRecWellBore, IDRecString, …): writable — the manual's
 * associated-data lookups depend on them. Each pairs with an optional `…TK`
 * companion that stores the TARGET TABLE name (observed in the data:
 * wvCement.IDRecStringTK = 'wvcas'), which is how ambiguous links like
 * "String" (casing or tubing?) stay unambiguous.
 */
const isTkCol = (c: string) => /^idrec.+tk$/i.test(c);
/**
 * The model states a field's lookup kind; `foreignidrec` IS the associated-data
 * link the manual describes. The name regex stays as the fallback for the two
 * tables the model does not describe (wvAttachment, wvComment).
 */
const isLinkCol = (t: TableInfo, c: string) => {
  const declared = modelField(t.name, c)?.lookupTyp;
  if (declared) return declared === "foreignidrec";
  return /^idrec./i.test(c) && !isKeyCol(c);
};
/**
 * wvWellbore.IDRecParent is a SELF-reference (sidetrack → parent bore), not a
 * child-table key — the manual's §10.4 "link the new wellbore to its parent
 * wellbore". On chain-top tables it is therefore an editable link, not a key.
 */
const isSelfParentLink = (t: TableInfo, c: string) =>
  c.toLowerCase() === "idrecparent" && t.hasParent && t.parent === null;

/** Fallback link targets when a column's TK data is empty, by column suffix. */
const LINK_TARGETS: Record<string, string[]> = {
  wellbore: ["wvWellbore"], parent: ["wvWellbore"],
  job: ["wvJob"], jobrun: ["wvJob"], jobpull: ["wvJob"],
  string: ["wvCas", "wvTub", "wvOtherStr"], nextcas: ["wvCas"],
  cas: ["wvCas"], tub: ["wvTub"],
  dirsrvyactual: ["wvWellboreDirSurvey"], dirsrvyprop: ["wvWellboreDirSurvey"],
  zone: ["wvZone"], bit: ["wvJobDrillBit"], log: ["wvLog"],
  problem: ["wvProblem"], elvhistory: ["wvElevationHistory"],
};

/** Candidate target tables for a link column: the TK values actually present
 *  in the data first, then the suffix fallback — resolved to real tables. */
function linkTargets(d: Db, t: TableInfo, col: string): string[] {
  const sch = schema(d);
  const resolve = (n: string) => sch.get(n.toLowerCase())?.name ?? null;
  const tk = t.colSet.get(`${col.toLowerCase()}tk`);
  const seen: string[] = [];
  if (tk) {
    try {
      const rows = d.ro.prepare(
        `SELECT DISTINCT lower("${tk}") v FROM "${t.name}" WHERE "${tk}" IS NOT NULL LIMIT 8`,
      ).all() as { v: string }[];
      for (const r of rows) {
        const hit = resolve(r.v);
        if (hit && !seen.includes(hit)) seen.push(hit);
      }
    } catch { /* fall through to the suffix map */ }
  }
  if (!seen.length) {
    const suffix = col.replace(/^idrec/i, "").replace(/tk$/i, "").toLowerCase();
    for (const cand of LINK_TARGETS[suffix] ?? [`wv${suffix}`]) {
      const hit = resolve(cand);
      if (hit && !seen.includes(hit)) seen.push(hit);
    }
  }
  return seen;
}

/**
 * Fill in the `…TK` companion of any link that arrived without one.
 *
 * WellView stores a record link as a PAIR — the GUID, and a `…TK` column naming
 * the target table — and it keeps them together: of 6,275 link values in the
 * sample database, 6,268 carry their TK, and the seven that do not are all one
 * polymorphic column. A GUID with no TK is resolvable here only because the
 * client searches every candidate table for it; the desktop uses the TK to know
 * where to look, so a row written without one is a row WellView cannot follow.
 *
 * Enforced at the write boundary rather than in whichever screen happened to
 * compose the record. Carry-forward was one way to lose it, but any future
 * caller that sets a link and forgets its companion is the same bug, and this is
 * the one place all of them pass through.
 *
 * The target is LOOKED UP, not guessed: `linkTargets` gives the candidate
 * tables and the GUID is found in exactly one of them. If it is in none — a
 * dangling link, or a table this database does not have — nothing is written.
 * An invented table name would be worse than the blank it replaces.
 */
function fillLinkTks(d: Db, t: TableInfo, values: Record<string, unknown>): void {
  for (const [col, v] of Object.entries(values)) {
    if (v == null || v === "" || isTkCol(col) || !isLinkCol(t, col)) continue;
    const tkCol = t.colSet.get(`${col.toLowerCase()}tk`);
    if (!tkCol || (values[tkCol] != null && values[tkCol] !== "")) continue;
    for (const target of linkTargets(d, t, col)) {
      const tt = table(d, target);
      if (!tt?.colSet.has("idrec")) continue;
      try {
        const hit = d.ro.prepare(
          `SELECT 1 FROM "${tt.name}" WHERE "${tt.colSet.get("idrec")}" = ? LIMIT 1`,
        ).get(String(v));
        if (hit) { values[tkCol] = tt.name.toLowerCase(); break; }
      } catch { /* a table that cannot be read simply is not the target */ }
    }
  }
}

/** Something readable to identify a record by — mirrors the client's captions. */
function captionOf(t: TableInfo, row: Record<string, unknown>): string {
  // The model states each table's record caption as a template of its own
  // fields — wvCasComp is "<des>, <SzODNom><SzODNom.unit>" — which is the
  // string the desktop puts on the record selector.
  const des = renderRecordDes(t.name, (col) => {
    const c = t.colSet.get(col.toLowerCase());
    const v = c ? row[c] : null;
    return v == null ? null : String(v);
  });
  if (des) return des.slice(0, 60);
  for (const k of ["dttmstart", "dttm", "dttmrun", "des", "wellname", "zonename", "com"]) {
    const c = t.colSet.get(k);
    const v = c ? row[c] : null;
    if (v != null && v !== "") return String(v).slice(0, 60);
  }
  const id = t.colSet.get("idrec");
  return id ? String(row[id] ?? "record").slice(0, 12) : "record";
}

// ── saved query templates (§8.1) ──────────────────────────────────────────────
interface QueryCriterion {
  table: string;
  field: string;
  op: string | null;
  value: string | null;
  prompts: boolean;
  /**
   * §8.1: "Add a condition to every line in the list of criteria, except the
   * first one." It joins this criterion to the one BEFORE it, so the first has
   * none. Absent means AND, which is what every shipped template implies.
   */
  conj?: "AND" | "OR";
}
interface QueryTemplate { id: string; category: string; name: string; criteria: QueryCriterion[] }

const QUERIES_JSON = join(REPO, "apps", "web", "public", "wellview-templates", "queries.json");
let _queries: QueryTemplate[] | null = null;
function queryTemplates(): QueryTemplate[] {
  if (_queries) return _queries;
  try {
    _queries = (JSON.parse(readFileSync(QUERIES_JSON, "utf-8")) as { queries: QueryTemplate[] }).queries;
  } catch {
    _queries = [];
  }
  return _queries;
}

/**
 * Turn a template's date value into the ISO stamp the databases store.
 *
 * WellView writes three shapes: its relative tokens (`<today>-1.5`, `<now>-1`,
 * where the offset is in DAYS), its legacy display format
 * (`01-Jan-00 12:00:00 AM`), and plain ISO. A value that matches none of them
 * returns null so the caller can report the criterion as skipped rather than
 * compare a date column against nonsense.
 */
export function resolveDateValue(raw: string, now = new Date()): string | null {
  const iso = (d: Date) => `${d.toISOString().slice(0, 19)}Z`;
  const s = raw.trim();

  /*
   * `<utcnow>` and `<utctoday>` are accepted alongside `<now>` and `<today>`.
   *
   * The guide documents all four as custom query tags, with worked examples
   * (`<utcnow>-10`, `<utctoday>-5`). Only two were matched, and a criterion that
   * did not match was dropped onto `skipped` WHILE THE REST OF THE QUERY STILL
   * RAN — so the user got a plausible list scoped by everything except the date
   * they asked for.
   *
   * They are aliases here rather than a separate branch because this function
   * already computes in UTC throughout: `setUTCHours` for the day boundary and
   * `toISOString` for the result. `<now>` and `<utcnow>` were never going to
   * differ; the only bug was refusing to read one of the spellings.
   */
  const rel = s.match(/^<(utctoday|utcnow|today|now)>\s*([+-]\s*[\d.]+)?$/i);
  if (rel) {
    const base = new Date(now);
    if (/today$/i.test(rel[1])) base.setUTCHours(0, 0, 0, 0);
    if (rel[2]) {
      const days = Number(rel[2].replace(/\s+/g, ""));
      if (!Number.isFinite(days)) return null;
      base.setTime(base.getTime() + days * 86_400_000);
    }
    return iso(base);
  }

  if (/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2})?/.test(s)) {
    const d = new Date(s.replace(" ", "T").replace(/Z?$/, "Z"));
    return Number.isNaN(d.getTime()) ? null : iso(d);
  }

  // 01-Jan-00 12:00:00 AM — two-digit years, WellView's own display format.
  const legacy = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2}|\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?$/i);
  if (legacy) {
    const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    const m = months.indexOf(legacy[2].toLowerCase());
    if (m < 0) return null;
    let year = Number(legacy[3]);
    if (legacy[3].length === 2) year += year < 50 ? 2000 : 1900;
    let hour = legacy[4] ? Number(legacy[4]) : 0;
    const ap = legacy[7]?.toUpperCase();
    if (ap === "PM" && hour < 12) hour += 12;
    if (ap === "AM" && hour === 12) hour = 0;
    const d = new Date(Date.UTC(year, m, Number(legacy[1]), hour,
      legacy[5] ? Number(legacy[5]) : 0, legacy[6] ? Number(legacy[6]) : 0));
    return Number.isNaN(d.getTime()) ? null : iso(d);
  }
  return null;
}

// ── subject-area tree ─────────────────────────────────────────────────────────
/** Top-level display order, per the manual's "start with the first subject area
 *  and work down the list". Unlisted top tables follow alphabetically. */
const SUBJECT_ORDER = [
  "wvWellHeader", "wvWellbore", "wvZone", "wvJob", "wvCas", "wvCement", "wvTub",
  "wvRod", "wvOtherInHole", "wvOtherStr", "wvPerforation", "wvStimTreat",
  "wvCore", "wvLog", "wvGeoEval", "wvProblem", "wvNote", "wvAttachment",
];
/** Bookkeeping tables that are not subject areas. */
const HIDDEN_TABLES = /^wv(sys|externaldata|units)/i;

interface TreeNode { table: string; label: string; count: number; children: TreeNode[] }

function buildTree(d: Db, idwell: string | null): TreeNode[] {
  const sch = schema(d);
  const count = (t: TableInfo): number => {
    try {
      if (idwell && t.hasIdwell) {
        return (d.ro.prepare(`SELECT COUNT(*) c FROM "${t.name}" WHERE idwell = ?`).get(idwell) as { c: number }).c;
      }
      return (d.ro.prepare(`SELECT COUNT(*) c FROM "${t.name}"`).get() as { c: number }).c;
    } catch { return 0; }
  };
  const node = (t: TableInfo): TreeNode => ({
    table: t.name,
    label: folderLabel(t.name, t.parent),
    count: count(t),
    children: t.children
      .map((c) => sch.get(c.toLowerCase())!)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(node),
  });
  const tops = [...sch.values()].filter(
    (t) => t.hasIdwell && (!t.hasParent || t.name.toLowerCase() === "wvwellbore") && !HIDDEN_TABLES.test(t.name),
  );
  const rank = (t: TableInfo) => {
    const i = SUBJECT_ORDER.findIndex((s) => s.toLowerCase() === t.name.toLowerCase());
    return i === -1 ? SUBJECT_ORDER.length : i;
  };
  tops.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  return tops.map(node);
}

// ── record helpers ────────────────────────────────────────────────────────────
const newIdRec = () => randomUUID().replace(/-/g, "").toUpperCase();

/**
 * The ORDER BY a folder's records are read in.
 *
 * THE MODEL ALREADY SAYS. 264 of the 357 tables carry an `sqlOrderBy` — the
 * vendor's own statement of the order each folder is meant to read in — and it
 * was extracted by the builder, stored in datamodel.json, and then consulted
 * nowhere. Every table was ordered by a guess instead.
 *
 * The guess is wrong where it matters most. `wvWellboreDirSurveyData` declares
 * `md`, but it also carries `DtTm` on 1,586 of its 2,019 rows, so the heuristic
 * below reached for the date first and a 371-station survey came back 33.94,
 * 42.93, 244.53, 152.75, 97.80 — a depth list in no depth order at all. The
 * help says plainly: "The survey data records are arranged in order of the
 * Measured Depth (MD)."
 *
 * Validated rather than trusted. Each name is resolved against the table's real
 * columns and anything that does not resolve is dropped, so a model that names
 * a column this database does not have degrades to the heuristic instead of
 * producing SQL that throws. Only `asc`/`desc` are allowed after a name; of the
 * 264 declared orders, 90 are multi-column, 8 carry a DESC, and none contains
 * any other character.
 */
function orderClause(t: TableInfo): string | null {
  // A SEQUENCED folder is ordered by the user, and that order is the point —
  // a casing string reads shoe-up or shoe-down because someone arranged it. Its
  // stored sequence therefore beats anything the model or a date would say.
  if (modelTable(t.name)?.sequenced) {
    const seq = t.colSet.get("sysseq");
    if (seq) return `"${seq}"`;
  }

  const declared = modelTable(t.name)?.sqlOrderBy;
  if (declared) {
    const parts: string[] = [];
    for (const raw of declared.split(",")) {
      const m = raw.trim().match(/^([A-Za-z0-9_]+)(?:\s+(asc|desc))?$/i);
      if (!m) continue;
      const col = t.colSet.get(m[1].toLowerCase());
      if (!col) continue;
      parts.push(`"${col}"${m[2] ? ` ${m[2].toUpperCase()}` : ""}`);
    }
    if (parts.length) return parts.join(", ");
  }

  for (const k of ["dttm", "dttmstart", "dttmspud", "dttmrun", "sysseq", "seqno", "depthtop", "depth", "md"]) {
    const c = t.colSet.get(k);
    if (c) return `"${c}"`;
  }
  return null;
}

function shapeValue(v: unknown): string | number | null {
  if (v == null) return null;
  if (v instanceof Uint8Array) return `(binary · ${v.byteLength} bytes)`;
  if (typeof v === "bigint") return Number(v);
  return v as string | number;
}

/** Cascade delete: the record, then every child record in prefix-child tables. */
/**
 * Who can point AT each table: every (table, link column) whose target includes
 * it, indexed once per database.
 *
 * Built because the naive question — "does anything reference this record?" —
 * costs a scan of all 146 link columns in the schema, which measured at 1.6
 * seconds. Nobody waits that long to be told whether a delete is safe, and a
 * check that is too slow to run is a check that gets skipped.
 */
const _inbound = new Map<string, Map<string, { table: string; column: string }[]>>();
function inboundLinks(d: Db): Map<string, { table: string; column: string }[]> {
  const hit = _inbound.get(d.id);
  if (hit) return hit;
  const out = new Map<string, { table: string; column: string }[]>();
  for (const t of schema(d).values()) {
    for (const c of t.cols) {
      if (isTkCol(c) || isKeyCol(c) || !isLinkCol(t, c)) continue;
      for (const target of linkTargets(d, t, c)) {
        const key = target.toLowerCase();
        const list = out.get(key) ?? [];
        list.push({ table: t.name, column: c });
        out.set(key, list);
      }
    }
  }
  _inbound.set(d.id, out);
  return out;
}

/** A link column named so a user can find it: "Zone", not "<capl>". */
function linkFieldName(table: string, column: string): string {
  const label = columnLabel(table, column);
  if (label && !/^<.*>$/.test(label) && label.toLowerCase() !== "record") return label;
  return column.replace(/^idrec/i, "") || column;
}

/** The whole subtree a delete would remove: this record and every descendant. */
function deleteSubtree(d: Db, t: TableInfo, idrec: string): { table: TableInfo; ids: string[] }[] {
  const sch = schema(d);
  const out: { table: TableInfo; ids: string[] }[] = [{ table: t, ids: [idrec] }];
  const walk = (parent: TableInfo, parentIds: string[]) => {
    if (!parentIds.length) return;
    for (const childName of parent.children) {
      const child = sch.get(childName.toLowerCase());
      if (!child?.colSet.has("idrec") || !child.hasParent) continue;
      const idCol = child.colSet.get("idrec")!;
      const parCol = child.colSet.get("idrecparent")!;
      const marks = parentIds.map(() => "?").join(", ");
      const ids = (d.ro.prepare(
        `SELECT "${idCol}" AS id FROM "${child.name}" WHERE "${parCol}" IN (${marks})`,
      ).all(...parentIds) as { id: string }[]).map((r) => String(r.id));
      if (!ids.length) continue;
      out.push({ table: child, ids });
      walk(child, ids);
    }
  };
  walk(t, [idrec]);
  return out;
}

/**
 * What a delete would cost, before it happens.
 *
 * The help asks for both halves of this. "A warning message lists the
 * subfolders that are affected" — so the subtree is enumerated by table rather
 * than summarised as a number after the fact. And "You cannot delete a record
 * that has fields associated to it … You must first remove the associations
 * before you delete the record" — so anything still pointing at the record, or
 * at anything under it, is found and named.
 *
 * References from INSIDE the subtree do not count: a child pointing at its own
 * parent goes away with it, and refusing on that would make some records
 * undeletable.
 */
function deletePreflight(d: Db, t: TableInfo, idrec: string) {
  const subtree = deleteSubtree(d, t, idrec);
  const inSubtree = new Map<string, Set<string>>();
  for (const s of subtree) {
    inSubtree.set(s.table.name.toLowerCase(), new Set(s.ids));
  }

  const children = subtree.slice(1).map((s) => ({
    table: s.table.name, label: folderLabel(s.table.name, null), count: s.ids.length,
  }));

  const index = inboundLinks(d);
  const referencedBy: { table: string; label: string; column: string; count: number }[] = [];
  for (const s of subtree) {
    for (const src of index.get(s.table.name.toLowerCase()) ?? []) {
      const st = table(d, src.table);
      if (!st) continue;
      const idCol = st.colSet.get("idrec");
      const marks = s.ids.map(() => "?").join(", ");
      let rows: { id: unknown }[];
      try {
        rows = d.ro.prepare(
          `SELECT ${idCol ? `"${idCol}"` : "NULL"} AS id FROM "${st.name}" WHERE "${src.column}" IN (${marks})`,
        ).all(...s.ids) as { id: unknown }[];
      } catch { continue; }
      // A row that is itself being deleted is not a reason to refuse.
      const mine = inSubtree.get(st.name.toLowerCase());
      const outside = rows.filter((r) => !(mine && r.id != null && mine.has(String(r.id))));
      if (!outside.length) continue;
      const existing = referencedBy.find((x) => x.table === st.name && x.column === src.column);
      if (existing) existing.count += outside.length;
      else referencedBy.push({
        table: st.name, label: folderLabel(st.name, null),
        // The model's caption for a link field is often the literal "<capl>",
        // its placeholder for "show the linked record's own caption" — which
        // renders as "Record" and tells a user nothing about WHICH link is
        // holding on. The column name without its IDRec prefix does: "Zone".
        column: linkFieldName(st.name, src.column), count: outside.length,
      });
    }
  }

  return {
    records: subtree.reduce((n, s) => n + s.ids.length, 0),
    children,
    referencedBy,
    canDelete: referencedBy.length === 0,
  };
}

function deleteRecord(d: Db, t: TableInfo, idrec: string): number {
  const sch = schema(d);
  const w = writable(d);
  let removed = 0;
  for (const childName of t.children) {
    const child = sch.get(childName.toLowerCase())!;
    if (!child.colSet.has("idrec") || !child.hasParent) continue;
    const kids = w.prepare(`SELECT "${child.colSet.get("idrec")}" AS id FROM "${child.name}" WHERE "${child.colSet.get("idrecparent")}" = ?`)
      .all(idrec) as { id: string }[];
    for (const k of kids) removed += deleteRecord(d, child, k.id);
  }
  const idCol = t.colSet.get("idrec");
  if (idCol) {
    w.prepare(`DELETE FROM "${t.name}" WHERE "${idCol}" = ?`).run(idrec);
    removed += 1;
  }
  return removed;
}

// ── §10.2 data-audit rules ────────────────────────────────────────────────────
interface AuditRule {
  id: string;
  report: string;
  rule: string;
  table: string;
  /** SQL where-clause over alias t; may reference well-header alias h. */
  where: string;
  needs: string[];               // t.columns the rule reads — skipped if absent
  detail: string[];              // columns to show for each violation
}

const AUDIT_RULES: AuditRule[] = [
  {
    id: "hdr-tub-gt-cas", report: "Well Header Information", table: "wvWellHeader",
    rule: "Tubing head elevation is greater than the casing head elevation.",
    where: "t.ElvTubHead IS NOT NULL AND t.ElvCasFlange IS NOT NULL AND CAST(t.ElvTubHead AS REAL) > CAST(t.ElvCasFlange AS REAL)",
    needs: ["elvtubhead", "elvcasflange"], detail: ["ElvTubHead", "ElvCasFlange"],
  },
  {
    id: "hdr-head-gt-kb", report: "Well Header Information", table: "wvWellHeader",
    rule: "Tubing or casing head elevation is greater than original KB.",
    where: "t.ElvOrigKB IS NOT NULL AND ((t.ElvTubHead IS NOT NULL AND CAST(t.ElvTubHead AS REAL) > CAST(t.ElvOrigKB AS REAL)) OR (t.ElvCasFlange IS NOT NULL AND CAST(t.ElvCasFlange AS REAL) > CAST(t.ElvOrigKB AS REAL)))",
    needs: ["elvorigkb"], detail: ["ElvOrigKB", "ElvTubHead", "ElvCasFlange"],
  },
  {
    id: "hdr-planned-spud", report: "Well Header Information", table: "wvWellHeader",
    rule: "Well is flagged as Planned but has an original spud date recorded.",
    where: "t.DtTmSpud IS NOT NULL AND (t.CurrentWellStatus1 LIKE '%planned%' OR t.CurrentWellStatus2 LIKE '%planned%')",
    needs: ["dttmspud", "currentwellstatus1"], detail: ["CurrentWellStatus1", "DtTmSpud"],
  },
  {
    id: "hdr-spud-after-prod", report: "Well Header Information", table: "wvWellHeader",
    rule: "Original spud date is later than the first production date.",
    where: "t.DtTmSpud IS NOT NULL AND t.DtTmFirstProd IS NOT NULL AND t.DtTmSpud > t.DtTmFirstProd",
    needs: ["dttmspud", "dttmfirstprod"], detail: ["DtTmSpud", "DtTmFirstProd"],
  },
  {
    id: "zone-depths", report: "Zone Information", table: "wvZone",
    rule: "Bottom zone depth is shallower than the top depth.",
    where: "t.DepthTop IS NOT NULL AND t.DepthBtm IS NOT NULL AND CAST(t.DepthBtm AS REAL) < CAST(t.DepthTop AS REAL)",
    needs: ["depthtop", "depthbtm"], detail: ["ZoneName", "DepthTop", "DepthBtm"],
  },
  {
    id: "bore-kickoff", report: "Wellbore", table: "wvWellbore",
    rule: "Sidetrack wellbore is missing its kick-off depth or kick-off method.",
    // An original hole's IDRecParent is a SELF-reference — only a bore pointing
    // at a DIFFERENT bore is a sidetrack (verified against the sample data).
    where: "t.IDRecParent IS NOT NULL AND t.IDRecParent <> t.IDRec AND ((t.KickOffDepth IS NULL AND t.KickOffMethod IS NOT NULL) OR (t.KickOffDepth IS NOT NULL AND t.KickOffMethod IS NULL) OR (t.KickOffDepth IS NULL AND t.KickOffMethod IS NULL))",
    needs: ["idrecparent", "idrec", "kickoffdepth", "kickoffmethod"], detail: ["Des", "KickOffDepth", "KickOffMethod"],
  },
  {
    id: "bore-vsdir", report: "Wellbore", table: "wvWellbore",
    rule: "Directional wellbore has a survey but no vertical section direction.",
    where: "t.IDRecDirSrvyActual IS NOT NULL AND t.VSDir IS NULL",
    needs: ["idrecdirsrvyactual", "vsdir"], detail: ["Des", "VSDir"],
  },
  {
    id: "boresize-dates", report: "Wellbore Section", table: "wvWellboreSize",
    rule: "Wellbore section has a depth but no start or end date.",
    where: "t.DepthBtmActual IS NOT NULL AND (t.DtTmStart IS NULL OR t.DtTmEnd IS NULL)",
    needs: ["depthbtmactual", "dttmstart", "dttmend"], detail: ["Des", "DepthBtmActual", "DtTmStart", "DtTmEnd"],
  },
  {
    id: "job-dates", report: "Job", table: "wvJob",
    rule: "Job end date is earlier than the start date.",
    where: "t.DtTmStart IS NOT NULL AND t.DtTmEnd IS NOT NULL AND t.DtTmEnd < t.DtTmStart",
    needs: ["dttmstart", "dttmend"], detail: ["JobTyp1", "DtTmStart", "DtTmEnd"],
  },
  {
    id: "job-cost-final", report: "Job", table: "wvJob",
    rule: "Job ended more than six months ago with no final actual cost.",
    where: "t.DtTmEnd IS NOT NULL AND t.DtTmEnd < datetime('now', '-6 months') AND t.CostFinalActual IS NULL",
    needs: ["dttmend", "costfinalactual"], detail: ["JobTyp1", "DtTmEnd", "CostFinalActual"],
  },
  {
    // The one GLOBAL METRIC requirement the guide states outright, twice:
    // "Phases are a Global Metric required entry. There must be at least one
    // phase for each job." (§4.5 drilling, and again for completions.)
    id: "job-no-phase", report: "Job — Global Metric", table: "wvJob",
    rule: "Job has no phases; at least one phase per job is a Global Metric requirement.",
    where: "NOT EXISTS (SELECT 1 FROM wvJobProgramPhase p WHERE p.IDRecParent = t.IDRec)",
    needs: ["idrec"], detail: ["JobTyp1", "DtTmStart", "DtTmEnd"],
  },
  {
    id: "drillparam-24h", report: "Drilling Parameters", table: "wvJobDrillStringDrillParam",
    rule: "Drilling-parameter interval spans more than 24 hours.",
    where: "t.DtTmStart IS NOT NULL AND t.DtTmEnd IS NOT NULL AND (julianday(t.DtTmEnd) - julianday(t.DtTmStart)) > 1.0",
    needs: ["dttmstart", "dttmend"], detail: ["DtTmStart", "DtTmEnd"],
  },
  {
    id: "drillparam-depth", report: "Drilling Parameters", table: "wvJobDrillStringDrillParam",
    rule: "Drilling-parameter end depth is less than the start depth.",
    where: "t.DepthStart IS NOT NULL AND t.DepthEnd IS NOT NULL AND CAST(t.DepthEnd AS REAL) < CAST(t.DepthStart AS REAL)",
    needs: ["depthstart", "depthend"], detail: ["DepthStart", "DepthEnd"],
  },
  {
    id: "daily-24h", report: "Daily Operations", table: "wvJobReport",
    rule: "Daily operation spans more than 24 hours (report start to end).",
    where: "t.DtTmStart IS NOT NULL AND t.DtTmEnd IS NOT NULL AND (julianday(t.DtTmEnd) - julianday(t.DtTmStart)) > 1.0001",
    needs: ["dttmstart", "dttmend"], detail: ["DtTmStart", "DtTmEnd"],
  },
  {
    id: "daily-lti", report: "Daily Operations", table: "wvJobReport",
    rule: "Daily operation is missing days since last reportable incident.",
    where: "t.DurationSinceLTInc IS NULL",
    needs: ["durationsinceltinc"], detail: ["DtTmStart"],
  },
  {
    id: "cas-run-date", report: "Casing", table: "wvCas",
    rule: "Casing string is not proposed and has no run date.",
    where: "(t.ProposedRun IS NULL OR t.ProposedRun IN ('0','false','False')) AND t.DtTmRun IS NULL",
    needs: ["proposedrun", "dttmrun"], detail: ["Des", "DtTmRun"],
  },
  {
    id: "cas-id-gt-od", report: "Casing — Incorrect ID", table: "wvCasComp",
    rule: "Casing component ID is greater than its OD.",
    where: "t.SzIDNom IS NOT NULL AND t.SzODNom IS NOT NULL AND CAST(t.SzIDNom AS REAL) > CAST(t.SzODNom AS REAL)",
    needs: ["szidnom", "szodnom"], detail: ["Des", "SzIDNom", "SzODNom"],
  },
  {
    id: "tub-run-date", report: "Tubing", table: "wvTub",
    rule: "Tubing string is not proposed and has no run date.",
    where: "(t.ProposedRun IS NULL OR t.ProposedRun IN ('0','false','False')) AND t.DtTmRun IS NULL",
    needs: ["proposedrun", "dttmrun"], detail: ["Des", "DtTmRun"],
  },
  {
    id: "tub-id-gt-od", report: "Tubing — Incorrect ID", table: "wvTubComp",
    rule: "Tubing component ID is greater than its OD.",
    where: "t.SzIDNom IS NOT NULL AND t.SzODNom IS NOT NULL AND CAST(t.SzIDNom AS REAL) > CAST(t.SzODNom AS REAL)",
    needs: ["szidnom", "szodnom"], detail: ["Des", "SzIDNom", "SzODNom"],
  },
  {
    id: "oih-run", report: "Other in Hole", table: "wvOtherInHole",
    rule: "Other-in-hole item is not proposed and has no run date.",
    where: "(t.ProposedRun IS NULL OR t.ProposedRun IN ('0','false','False')) AND t.DtTmRun IS NULL",
    needs: ["proposedrun", "dttmrun"], detail: ["Des", "DtTmRun"],
  },
  {
    id: "oih-id-gt-od", report: "Other in Hole", table: "wvOtherInHole",
    rule: "Other-in-hole item ID is greater than its OD.",
    where: "t.SzIDNom IS NOT NULL AND t.SzODMax IS NOT NULL AND CAST(t.SzIDNom AS REAL) > CAST(t.SzODMax AS REAL)",
    needs: ["szidnom", "szodmax"], detail: ["Des", "SzIDNom", "SzODMax"],
  },
  {
    id: "cement-start", report: "Cement", table: "wvCement",
    rule: "Cement job is not planned and has no start date.",
    where: "(t.Proposed IS NULL OR t.Proposed IN ('0','false','False')) AND t.DtTmStart IS NULL",
    needs: ["proposed", "dttmstart"], detail: ["Des", "DtTmStart"],
  },
  {
    /**
     * §10.3's End of Well Checklist, Job Supplies: "Confirm that consumed and
     * returned quantities equal received quantities. This will cue an exception
     * on select audit reports." That last sentence is why this belongs here.
     */
    id: "supply-balance", report: "Job Supplies", table: "wvJobSupplyAmt",
    rule: "Job supply amounts do not balance: consumed plus returned is not what was received.",
    where: "t.Received IS NOT NULL AND ABS(COALESCE(CAST(t.Received AS REAL),0) - (COALESCE(CAST(t.Consumed AS REAL),0) + COALESCE(CAST(t.Returned AS REAL),0))) > 0.001",
    needs: ["received", "consumed", "returned"], detail: ["DtTm", "Received", "Consumed", "Returned"],
  },
  {
    /**
     * §10.2 Daily Fixed Costs: "tangible items with a cost greater than $5,000
     * that have been classified as an expense instead of capital."
     *
     * DECLARED BUT NOT RUNNABLE HERE, on purpose. This WellView schema has no
     * tangible classification anywhere — the whole model mentions capital or
     * expense exactly once, on wvJobAFE.CostTyp, and nothing marks an item
     * tangible. Chevron encodes that in their own cost coding, which is not in
     * these files. Declaring the rule with the columns it needs makes the
     * auditor report it as skipped, with the reason, on every run — which tells
     * the truth about the database instead of quietly running 24 rules of 25.
     */
    id: "cost-tangible-expense", report: "Daily Fixed Costs", table: "wvJobReportCostGen",
    rule: "Tangible item over 5,000 classified as expense rather than capital.",
    where: "t.Tangible = '1' AND CAST(t.Cost AS REAL) > 5000 AND t.CostTyp LIKE 'Expense%'",
    needs: ["tangible", "costtyp", "cost"], detail: ["Des", "Cost", "CostTyp"],
  },
  {
    /**
     * §10.2 Material Transfer / Physical Inventory: quantities that do not
     * balance, and records missing a receiving or transferred document number.
     * Also declared and not runnable — this schema's transfer detail carries a
     * single Qty, with no received/installed/transferred split and no separate
     * document numbers. See supply-balance above for the check this database
     * CAN make.
     */
    id: "mattrans-balance", report: "Material Transfer / Physical Inventory", table: "wvJobMaterialTransDetail",
    rule: "Physical inventory received, installed and transferred quantities do not balance.",
    where: "ABS(COALESCE(CAST(t.QtyReceived AS REAL),0) - COALESCE(CAST(t.QtyInstalled AS REAL),0) - COALESCE(CAST(t.QtyTransferred AS REAL),0)) > 0.001",
    needs: ["qtyreceived", "qtyinstalled", "qtytransferred"], detail: ["MaterialDes", "Qty"],
  },
  {
    id: "perf-depths", report: "Perforation Information", table: "wvPerforation",
    rule: "Actual perforation bottom depth is shallower than its top depth.",
    where: "(t.Proposed IS NULL OR t.Proposed IN ('0','false','False')) AND t.DepthTop IS NOT NULL AND t.DepthBtm IS NOT NULL AND CAST(t.DepthBtm AS REAL) < CAST(t.DepthTop AS REAL)",
    needs: ["proposed", "depthtop", "depthbtm"], detail: ["DepthTop", "DepthBtm"],
  },
];

// ── schematic payload ─────────────────────────────────────────────────────────
/** One string drawn on the schematic: casing, tubing, rods, other-in-hole. */
function stringRows(d: Db, tname: string, idwell: string, extra: string[] = []): Record<string, unknown>[] {
  const t = table(d, tname);
  if (!t) return [];
  const want = ["IDRec", "Des", "DepthBtm", "DepthTop", "DtTmRun", "DtTmPull", "ProposedRun", "IDRecWellBore", ...extra]
    .map((c) => t.colSet.get(c.toLowerCase()))
    .filter((c): c is string => !!c);
  if (!want.length) return [];
  return (d.ro.prepare(`SELECT ${want.map((c) => `"${c}"`).join(", ")} FROM "${t.name}" WHERE idwell = ?`)
    .all(idwell) as Record<string, unknown>[]).map((r) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(r)) out[k] = shapeValue(v);
    return out;
  });
}

/** Max component OD per parent string, for honest widths on the drawing. */
function maxOdByParent(d: Db, compTable: string, idwell: string): Map<string, number> {
  const t = table(d, compTable);
  const out = new Map<string, number>();
  if (!t) return out;
  const od = t.colSet.get("szodnom") ?? t.colSet.get("szodmax");
  const par = t.colSet.get("idrecparent");
  if (!od || !par) return out;
  const rows = d.ro.prepare(
    `SELECT "${par}" p, MAX(CAST("${od}" AS REAL)) m FROM "${t.name}" WHERE idwell = ? AND "${od}" IS NOT NULL GROUP BY "${par}"`,
  ).all(idwell) as { p: string; m: number }[];
  for (const r of rows) out.set(r.p, r.m);
  return out;
}

// ── routes ────────────────────────────────────────────────────────────────────
function need(reply: FastifyReply, id: string): Db | null {
  const d = db(id);
  if (!d) void reply.code(404).send({ error: `no database named ${id}` });
  return d;
}

/**
 * The multi-well templates, read once from the generated JSON.
 *
 * Built by `scripts/wellview-afr/afm_export.py` from `custom/reports multi`.
 * Three of the 57 are the older v2.0 container; they are included and marked
 * rather than dropped, because a template that exists but predates the current
 * schema is a different fact from one that does not exist.
 */
let _multi: MultiTemplate[] | null = null;
function multiTemplates(): MultiTemplate[] {
  if (_multi) return _multi;
  try {
    const path = join(REPO, "apps", "web", "public", "wellview-templates", "reports-multi.json");
    _multi = (JSON.parse(readFileSync(path, "utf-8")).reports ?? []) as MultiTemplate[];
  } catch {
    _multi = [];
  }
  return _multi;
}

/**
 * The Excel-report data extracts (`custom/reports multi/*.afmxl`).
 *
 * Built by `scripts/wellview-afr/afmxl_export.py`. These carry the extract
 * only; the paired .xlt workbook is not reproduced, and the app says so.
 */
let _xl: XlTemplate[] | null = null;
function xlTemplates(): XlTemplate[] {
  if (_xl) return _xl;
  try {
    const path = join(REPO, "apps", "web", "public", "wellview-templates", "reports-xl.json");
    _xl = (JSON.parse(readFileSync(path, "utf-8")).reports ?? []) as XlTemplate[];
  } catch {
    _xl = [];
  }
  return _xl;
}


/**
 * WHO MAY USE THE WELLVIEW DATABASES.
 *
 * `requireUser` authenticates; it does not authorise. Every other well-scoped
 * area of this API narrows a company man to their assigned wells through
 * `mayUseWell` (see entry/access.ts), and this module did not — so any signed-in
 * user could read every record of every well in every converted database, edit
 * them, and (since 99b6e0c) export a whole well in one request.
 *
 * Per-well scoping is not buildable here yet, and the gap is not an oversight
 * in the check but a missing correspondence: assignments are made against this
 * application's own `EntryWell` records, while a WellView well is identified by
 * an `idwell` GUID inside an imported .sqlite that knows nothing about them.
 * There is no column joining the two. Inventing one would be a product
 * decision, not a bug fix.
 *
 * So the module is closed by default to the role that already governs
 * office-side work — the guide's own line is that creating a well is
 * "restricted to certain office personnel only". A deployment that genuinely
 * wants rig-side users in here can set WELLVIEW_DB_ALLOW_NON_ADMIN=true, which
 * restores the previous behaviour; the point is that the open state is now
 * chosen rather than inherited.
 */
const WELLVIEW_GUARD = process.env.WELLVIEW_DB_ALLOW_NON_ADMIN === "true"
  ? requireUser
  : requireAdmin;

export async function registerWellviewDbRoutes(
  app: FastifyInstance,
  prisma?: PrismaClient,
): Promise<void> {
  /** The Open Database window. */
  /**
   * WellView’s own manifest: which build of the product this app was built
   * against.
   *
   * Every piece of shipped material — the 182 report templates, the data
   * model, the unit table, the icon library — comes from ONE package, and
   * they are not interchangeable between versions. Stating the build is how a
   * user handed a different export can tell that the templates no longer match
   * the data. Null when the vendor tree is absent, which a clean checkout is.
   */
  app.get("/entry/wellview/about", { preHandler: WELLVIEW_GUARD }, async () => {
    const a = appFrame();
    return a ? {
      appName: a.appName, version: a.version, packageId: a.packageId,
      subtitle: a.subtitle,
      singleTools: a.singleTools, multiTools: a.multiTools,
    } : { appName: null, version: null, packageId: null, subtitle: null,
      singleTools: [], multiTools: [] };
  });

  app.get("/entry/wellview/dbs", { preHandler: WELLVIEW_GUARD }, async () => {
    return listDbFiles().map((f) => {
      const d = db(f.id)!;
      let wells = 0;
      try {
        wells = (d.ro.prepare("SELECT COUNT(*) c FROM wvWellHeader").get() as { c: number }).c;
      } catch { /* not a WellView database */ }
      return { id: f.id, file: `${f.id}.sqlite`, wells, sizeBytes: statSync(f.path).size };
    });
  });

  /** Well-header columns, for the column chooser / group-by / quick-query pickers. */
  app.get<{ Params: { db: string } }>(
    "/entry/wellview/dbs/:db/header-columns",
    { preHandler: WELLVIEW_GUARD },
    async (req, reply) => {
      const d = need(reply, req.params.db);
      if (!d) return;
      const t = table(d, "wvWellHeader");
      if (!t) return reply.code(404).send({ error: "wvWellHeader missing" });
      return t.cols
        .filter((c) => !isSysCol(c) && c.toLowerCase() !== "idwell")
        .map((c) => ({ column: c, label: columnLabel(t.name, c) }));
    },
  );

  /**
   * The Well Explorer list. `cols` picks well-header columns (§3.2 Well List
   * Properties); `lookin`+`lookfor` is the Quick Query (§3.3), matching full
   * or partial values just as the manual describes.
   */
  app.get<{ Params: { db: string }; Querystring: { cols?: string; lookin?: string; lookfor?: string } }>(
    "/entry/wellview/dbs/:db/wells",
    { preHandler: WELLVIEW_GUARD },
    async (req, reply) => {
      const d = need(reply, req.params.db);
      if (!d) return;
      const t = table(d, "wvWellHeader");
      if (!t) return reply.code(404).send({ error: "wvWellHeader missing" });
      const wanted = (req.query.cols ?? "WellName,WellIDA")
        .split(",")
        .map((c) => t.colSet.get(c.trim().toLowerCase()))
        .filter((c): c is string => !!c);
      if (!wanted.includes(t.colSet.get("wellname")!)) wanted.unshift(t.colSet.get("wellname")!);
      const sel = ["idwell", ...wanted].map((c) => `"${c}"`).join(", ");
      let where = "";
      const args: string[] = [];
      const lookin = req.query.lookin ? t.colSet.get(req.query.lookin.toLowerCase()) : null;
      /*
       * SPACES SEPARATE CRITERIA, they are not part of the text.
       *
       * §"What's New in WellView 9.0": "You can now search applicable fields for
       * multiple criteria in quick queries. Enter the words separated by a
       * space. Each well, site, or rig meeting each search criteria appears in
       * the results." Its worked example searches Well Name for "1 sample" and
       * prints thirteen wells.
       *
       * Matching the whole string returned NONE of them — no well is called
       * "…1 sample…". Every word is its own LIKE, ANDed, which returns the
       * help's list.
       */
      const words = (req.query.lookfor ?? "").trim().split(/\s+/).filter(Boolean);
      if (lookin && words.length) {
        where = `WHERE ${words.map(() => `"${lookin}" LIKE ?`).join(" AND ")}`;
        for (const w of words) args.push(`%${w}%`);
      }
      const rows = d.ro.prepare(`SELECT ${sel} FROM "${t.name}" ${where} ORDER BY "${t.colSet.get("wellname")}"`)
        .all(...args) as Record<string, unknown>[];
      /*
       * The elevations every row needs to be re-referenced.
       *
       * The well LIST is the one grid where each row is a different well, so a
       * single datum offset cannot serve it — the shift is per row. Read here in
       * one pass rather than one request per well.
       */
       const elvCols: [string, string][] = ([
         ["OrigKB", "elvorigkb"], ["Ground", "elvground"], ["MudLine", "elvmudline"],
         ["CasFlange", "elvcasflange"], ["TubHead", "elvtubhead"],
       ] as [string, string][]).filter(([, c]) => t.colSet.get(c));
       const elvBy = new Map<string, Record<string, number | null>>();
       if (elvCols.length) {
         const sel2 = ["idwell", ...elvCols.map(([, c]) => t.colSet.get(c)!)]
           .map((c) => `"${c}"`).join(", ");
         for (const r of d.ro.prepare(`SELECT ${sel2} FROM "${t.name}"`).all() as Record<string, unknown>[]) {
           const e: Record<string, number | null> = {};
           for (const [key, c] of elvCols) {
             const v = r[t.colSet.get(c)!];
             e[key] = typeof v === "number" && Number.isFinite(v) ? v : null;
           }
           elvBy.set(String(r.idwell), e);
         }
       }

      return {
        columns: wanted.map((c) => {
          const mf = modelField(t.name, c);
          return {
            column: c,
            label: columnLabel(t.name, c),
            // Without these the list prints stored metres whatever unit set the
            // user chose, and Copy Well List puts those metres on the clipboard
            // under a heading that says feet.
            unit: mf?.baseUnit,
            units: mf?.units as Record<string, unknown> | undefined,
            applyDatum: mf?.applyDatum,
            datumMode: mf?.datumMode,
          };
        }),
        wells: rows.map((r) => {
          const out: Record<string, string | number | null> = {};
          for (const [k, v] of Object.entries(r)) out[k] = shapeValue(v);
          return out;
        }),
        /** Per-well elevations, keyed by idwell, for the datum shift. */
        elevations: Object.fromEntries(elvBy),
      };
    },
  );

  /** The Edit Data subject-area tree, with per-well record counts. */
  app.get<{ Params: { db: string }; Querystring: { idwell?: string } }>(
    "/entry/wellview/dbs/:db/tree",
    { preHandler: WELLVIEW_GUARD },
    async (req, reply) => {
      const d = need(reply, req.params.db);
      if (!d) return;
      return { tree: buildTree(d, req.query.idwell || null) };
    },
  );

  /** Records of one folder, scoped to a well and (for subfolders) a parent record. */
  app.get<{ Params: { db: string; table: string }; Querystring: { idwell?: string; parent?: string; system?: string } }>(
    "/entry/wellview/dbs/:db/records/:table",
    { preHandler: WELLVIEW_GUARD },
    async (req, reply) => {
      const d = need(reply, req.params.db);
      if (!d) return;
      const t = table(d, req.params.table);
      if (!t) return reply.code(404).send({ error: `no table ${req.params.table}` });
      const showSys = req.query.system === "1";
      const cols = t.cols.filter((c) => showSys || !isSysCol(c));
      // The model-calculated fields this table can carry, appended after the
      // stored columns; they have no column of their own in the database.
      // Two kinds: arithmetic over the row itself, and totals over child rows.
      const computed = [
        ...calcFieldsFor(t.name).map((c) => ({ field: c.field, label: c.label, eqn: c.eqn })),
        ...calcAggregatesFor(t.name).map((a) => ({ field: a.field, label: a.label, eqn: a.eqn })),
      ];
      const where: string[] = [];
      const args: string[] = [];
      if (req.query.idwell && t.hasIdwell) { where.push(`"${t.colSet.get("idwell")}" = ?`); args.push(req.query.idwell); }
      if (req.query.parent && t.hasParent) { where.push(`"${t.colSet.get("idrecparent")}" = ?`); args.push(req.query.parent); }
      const ord = orderClause(t);
      const rows = d.ro.prepare(
        `SELECT ${cols.map((c) => `"${c}"`).join(", ")} FROM "${t.name}"` +
        (where.length ? ` WHERE ${where.join(" AND ")}` : "") +
        (ord ? ` ORDER BY ${ord}` : "") +
        " LIMIT 500",
      ).all(...args) as Record<string, unknown>[];
      const mt = modelTable(t.name);
      return {
        table: t.name,
        label: folderLabel(t.name, t.parent),
        help: mt?.help,
        /** Section order for the entry form (§4.3's Well Header sections). */
        fieldGroups: mt?.fieldGroups,
        /** Ordered folders (tallies, string components) offer the manual's
         *  Move up/down, Add Records to Top and Invert Components commands. */
        sequenced: mt?.sequenced,
        allowInsertTop: mt?.allowInsertTop,
        allowSeqInvert: mt?.allowSeqInvert,
        parentTable: t.parent,
        columns: cols.map((c) => {
          const link = isSelfParentLink(t, c)
            ? { tkColumn: t.colSet.get(`${c.toLowerCase()}tk`) ?? null, targets: [t.name] }
            : isLinkCol(t, c) && !isTkCol(c)
              ? { tkColumn: t.colSet.get(`${c.toLowerCase()}tk`) ?? null, targets: linkTargets(d, t, c) }
              : undefined;
          const mf = modelField(t.name, c);
          return {
            column: c,
            // A TK companion is captioned from the link it belongs to, so it
            // reads "Actual Deviation Survey — table", not "Actual Record".
            label: columnLabel(t.name, c,
              link?.targets ?? (isTkCol(c) ? linkTargets(d, t, c.replace(/tk$/i, "")) : undefined)),
            id: isKeyCol(c) && !isSelfParentLink(t, c),
            system: isSysCol(c),
            // TK companions are managed alongside their link column, not shown.
            tk: isTkCol(c) || undefined,
            /** Field help (§3.11) — what the desktop shows under the grid. */
            help: mf?.help,
            /** WellView computes this at print time: the desktop's GREEN,
             *  non-editable fields. Never offered as an input here. */
            calculated: mf?.calculated,
            /** Hidden by default; revealed by "Show All Fields". */
            hiddenByDefault: mf?.hidden,
            type: mf?.type,
            unit: mf?.baseUnit,
            applyDatum: mf?.applyDatum || undefined,
            datumMode: mf?.datumMode,
            /** Per unit set, the unit to show it in and its decimals — the
             *  client converts at the render boundary (Tools > Units). */
            units: mf?.units,
            /** The form section this field sits in, per WellView's own model. */
            group: mf?.group,
            /** Chevron's Data Entry Audit rules — the desktop's yellow fields. */
            required: mf?.required,
            /** Required global metric — the desktop's cyan fields. */
            globalMetric: mf?.globalMetric,
            /** §5 "Set up Day Two": a new record inherits this field from the
             *  previous one, some of them stepped by a fixed increment. */
            carryForward: mf?.carryForward,
            carryForwardIncrement: mf?.carryForwardIncrement,
            carryForwardFrom: mf?.carryForwardFrom,
            /** The model binds this field to a Library list (§3.9 Lookup List
             *  Library). The list itself is not readable — the .lib files are
             *  encrypted — so the client offers values in use and says so. */
            library: mf?.lookupTyp === "library" && mf.libTable
              ? { table: mf.libTable, field: mf.libField ?? null }
              : undefined,
            /** The APPROVED values, where the model states them (22 fields). */
            modelList: mf?.modelList,
            warnOnly: mf?.warnOnly,
            link,
          };
        }),
        /**
         * The model-calculated fields this table's rows can carry (§3.9's green
         * cells). They have no column in the database — WellView works them out
         * when a report prints — so they are appended here, after the stored
         * ones, and marked `computed` so the client can render them read-only
         * and say where they came from.
         */
        computedColumns: computed.map((c) => {
          const mf = modelField(t.name, c.field);
          return {
            column: c.field,
            label: c.label,
            calculated: true,
            /** Computed HERE, from this row, by the model's own equation. */
            computed: true,
            eqn: c.eqn,
            help: mf?.help,
            type: mf?.type,
            unit: mf?.baseUnit,
            applyDatum: mf?.applyDatum || undefined,
            datumMode: mf?.datumMode,
            units: mf?.units,
            group: mf?.group,
          };
        }),
        rows: (() => {
          /*
           * Child totals for the whole page in ONE query per aggregate, keyed
           * by the parent's IDRec — not a query per row, which is fine on a
           * sample database and not fine on a real one.
           */
          const idCol = t.colSet.get("idrec");
          const totals = idCol && req.query.idwell
            ? sumChildren(d.ro, t.name, req.query.idwell, rows.map((r) => String(r[idCol] ?? "")))
            : new Map<string, Record<string, number>>();
          return rows.map((r) => {
            const out: Record<string, string | number | null> = {};
            for (const [k, v] of Object.entries(r)) out[k] = shapeValue(v);
            // A field that cannot be computed for THIS row stays absent, so the
            // grid shows a blank rather than a zero nobody measured.
            for (const [k, v] of Object.entries(computeRow(t.name, r))) out[k] = v;
            for (const [k, v] of Object.entries(totals.get(String(r[idCol ?? ""] ?? "")) ?? {})) out[k] = v;
            return out;
          });
        })(),
      };
    },
  );

/**
   * Paste Data from Clipboard (§3.9) — a block of spreadsheet rows into a folder.
   *
   * The guide teaches this as the way tallies are entered: "Enter the tubing
   * string information by cutting and pasting from the applied Excel
   * spreadsheet" — 147 joints in that exercise alone — and the casing tally and
   * survey loads the same way. Only the outbound half existed, so every one of
   * those was row-by-row typing.
   *
   * The client sends rows of ALREADY-MAPPED values: it owns the column-mapping
   * dialog and the "Start at row" setting the guide describes, and it converts
   * what the user pasted out of their unit set before sending, exactly as the
   * grid does on a single edit. This route's job is the part that must not be
   * got wrong — the same write rules as a single insert, applied to many rows,
   * in ONE transaction.
   *
   * All or nothing: a half-finished paste of a 147-joint tally leaves a folder
   * that has to be cleaned up by hand before it can be retried, which is worse
   * than a refusal.
   */
  app.post<{
    Params: { db: string; table: string };
    Body: { idwell?: string; parent?: string; rows?: Record<string, unknown>[]; startSeq?: number };
  }>(
    "/entry/wellview/dbs/:db/records/:table/paste",
    { preHandler: WELLVIEW_GUARD },
    async (req, reply) => {
      const d = need(reply, req.params.db);
      if (!d) return;
      const t = table(d, req.params.table);
      if (!t) return reply.code(404).send({ error: `no table ${req.params.table}` });
      const rows = req.body?.rows ?? [];
      if (!rows.length) return reply.code(400).send({ error: "no rows to paste" });
      if (rows.length > PASTE_ROW_CAP) {
        return reply.code(400).send({
          error: `too many rows at once (${rows.length}); the limit is ${PASTE_ROW_CAP}`,
        });
      }
      const idwell = req.body?.idwell ?? null;
      if (t.hasIdwell && !idwell) return reply.code(400).send({ error: "idwell is required" });

      // Which of the named columns this table will actually accept. Reported
      // back rather than silently dropped: a column that quietly went nowhere
      // is how a tally ends up missing its grades.
      const named = [...new Set(rows.flatMap((r) => Object.keys(r)))];
      const accepted = new Map<string, string>();
      const rejected: { column: string; why: string }[] = [];
      for (const k of named) {
        const actual = t.colSet.get(k.toLowerCase());
        if (!actual) { rejected.push({ column: k, why: "not a column in this table" }); continue; }
        if (modelField(t.name, actual)?.calculated) {
          rejected.push({ column: k, why: "calculated by WellView at print time" });
          continue;
        }
        if (isSysCol(actual)) { rejected.push({ column: k, why: "a system column" }); continue; }
        if (isKeyCol(actual) && !isSelfParentLink(t, actual)) {
          rejected.push({ column: k, why: "a record key" });
          continue;
        }
        accepted.set(k, actual);
      }
      if (!accepted.size) {
        return reply.code(400).send({ error: "none of those columns can be written here", rejected });
      }

      const user = req.entryUser?.username ?? "web";
      const now = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
      const seqCol = modelTable(t.name)?.sequenced ? t.colSet.get("sysseq") : null;
      // A tally is an ORDERED folder, and the order of the pasted block is the
      // order the joints go in the hole. Continue after whatever is there.
      let seq = req.body?.startSeq ?? 0;
      if (seqCol && !req.body?.startSeq) {
        const where: string[] = [];
        const args: string[] = [];
        if (t.hasIdwell && idwell) { where.push(`"${t.colSet.get("idwell")}" = ?`); args.push(idwell); }
        if (t.hasParent && req.body?.parent) { where.push(`"${t.colSet.get("idrecparent")}" = ?`); args.push(req.body.parent); }
        const max = d.ro.prepare(
          `SELECT MAX("${seqCol}") AS m FROM "${t.name}"${where.length ? ` WHERE ${where.join(" AND ")}` : ""}`,
        ).get(...args) as { m: number | null };
        seq = Number(max?.m ?? 0);
      }
      const wbCol = t.colSet.get("idrecwellbore");
      const defaultBore = wbCol && idwell ? defaultWellbore(d, idwell) : null;

      const built = rows.map((r) => {
        const values: Record<string, unknown> = {};
        for (const [k, actual] of accepted) {
          if (k in r) values[actual] = r[k] === "" ? null : r[k];
        }
        if (t.colSet.has("idrec")) values[t.colSet.get("idrec")!] = newIdRec();
        if (t.hasIdwell && idwell) values[t.colSet.get("idwell")!] = idwell;
        if (t.hasParent && req.body?.parent) values[t.colSet.get("idrecparent")!] = req.body.parent;
        if (seqCol) values[seqCol] = ++seq;
        for (const [k, v] of [["syscreatedate", now], ["syscreateuser", user],
          ["sysmoddate", now], ["sysmoduser", user]] as const) {
          const c = t.colSet.get(k);
          if (c) values[c] = v;
        }
        // The DefaultWellboreLinker add-in, as on a single insert.
        if (wbCol && !values[wbCol] && defaultBore) {
          values[wbCol] = defaultBore;
          const tk = t.colSet.get("idrecwellboretk");
          if (tk) values[tk] = "wvwellbore";
        }
        return values;
      });

      const cols = [...new Set(built.flatMap((v) => Object.keys(v)))];
      const db = writable(d);
      const stmt = db.prepare(
        `INSERT INTO "${t.name}" (${cols.map((c) => `"${c}"`).join(", ")})
         VALUES (${cols.map(() => "?").join(", ")})`,
      );
      db.exec("BEGIN");
      try {
        for (const v of built) stmt.run(...cols.map((c) => (v[c] ?? null) as string | number | null));
        db.exec("COMMIT");
      } catch (e) {
        db.exec("ROLLBACK");
        return reply.code(400).send({
          error: `the paste was rolled back: ${e instanceof Error ? e.message : String(e)}`,
          rejected,
        });
      }
      return reply.code(201).send({
        inserted: built.length,
        columns: [...accepted.keys()],
        rejected,
      });
    },
  );


  /** Add a record (§3.9 "Add a New Record"): IDRec generated, links filled in. */
  app.post<{ Params: { db: string; table: string }; Body: { idwell?: string; parent?: string; values?: Record<string, unknown> } }>(
    "/entry/wellview/dbs/:db/records/:table",
    { preHandler: WELLVIEW_GUARD },
    async (req, reply) => {
      const d = need(reply, req.params.db);
      if (!d) return;
      const t = table(d, req.params.table);
      if (!t) return reply.code(404).send({ error: `no table ${req.params.table}` });
      const values: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(req.body?.values ?? {})) {
        const actual = t.colSet.get(k.toLowerCase());
        // Calculated fields are WellView's print-time computations — the
        // desktop greys them out, and accepting one here would store a value
        // the real application would overwrite.
        if (modelField(t.name, actual ?? "")?.calculated) continue;
        if (actual && !isSysCol(actual) && (!isKeyCol(actual) || isSelfParentLink(t, actual))) values[actual] = v;
      }
      const idrec = t.colSet.has("idrec") ? newIdRec() : null;
      if (idrec) values[t.colSet.get("idrec")!] = idrec;
      let idwell = req.body?.idwell ?? null;
      let mintedWell = false;
      if (t.hasIdwell) {
        // Inserting a well-header row IS creating a new well (manual ch. 4) —
        // the header is keyed by idwell alone, so a fresh one is minted here.
        if (!idwell && t.name.toLowerCase() === "wvwellheader") { idwell = newIdRec(); mintedWell = true; }
        if (!idwell) return reply.code(400).send({ error: "idwell is required" });
        values[t.colSet.get("idwell")!] = idwell;
      }
      if (t.hasParent && req.body?.parent) values[t.colSet.get("idrecparent")!] = req.body.parent;
      const user = (req as unknown as { entryUser?: { username?: string } }).entryUser?.username ?? "web";
      const now = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
      for (const [k, v] of [["syscreatedate", now], ["syscreateuser", user], ["sysmoddate", now], ["sysmoduser", user]] as const) {
        const c = t.colSet.get(k);
        if (c) values[c] = v;
      }
      // The DefaultWellboreLinker add-in's job: a wellbore-scoped record gets
      // the well's wellbore when the user has not chosen one. Before `cols` is
      // taken, so the column joins the INSERT.
      const wbCol = t.colSet.get("idrecwellbore");
      if (wbCol && !values[wbCol] && idwell) {
        const wbId = defaultWellbore(d, idwell);
        if (wbId) {
          values[wbCol] = wbId;
          // …and its TK companion, which names the target table lowercased.
          const tk = t.colSet.get("idrecwellboretk");
          if (tk) values[tk] = "wvwellbore";
        }
      }
      // Any link the caller set keeps its TK companion, whatever composed it.
      fillLinkTks(d, t, values);

      /*
       * A NEW RECORD GOES AT THE END OF ITS FOLDER, and that takes an explicit
       * sequence number.
       *
       * `orderColumn` sorts a sequenced folder by `sysSeq` ascending, and SQLite
       * sorts NULL FIRST — so a row inserted without one does not land at the
       * bottom, it jumps to the top. On a casing tally that puts a newly added
       * joint above the shoe, and the string reads in the wrong order from that
       * moment on, in every report and on the schematic.
       *
       * Nothing in either converted database has a null `sysSeq` (776 of 776
       * wvCasCompTally rows carry one), so every such row would be this app's,
       * and the desktop would show it the same way.
       *
       * The scope is the folder, not the table: MAX within this well and this
       * parent. Same rule the paste route already uses for a pasted block —
       * a single Add is that block with one row in it.
       */
      const seqColIns = t.colSet.get("sysseq");
      if (seqColIns && values[seqColIns] == null) {
        const where: string[] = [];
        const args: string[] = [];
        const idwCol = t.colSet.get("idwell");
        if (idwCol && idwell) { where.push(`"${idwCol}" = ?`); args.push(idwell); }
        const parCol = t.colSet.get("idrecparent");
        if (parCol && req.body?.parent) { where.push(`"${parCol}" = ?`); args.push(req.body.parent); }
        const max = d.ro.prepare(
          `SELECT MAX("${seqColIns}") AS m FROM "${t.name}"${where.length ? ` WHERE ${where.join(" AND ")}` : ""}`,
        ).get(...args) as { m: number | null };
        values[seqColIns] = Number(max?.m ?? 0) + 1;
      }

      const cols = Object.keys(values);

      if (!cols.length) return reply.code(400).send({ error: "nothing to insert" });
      writable(d).prepare(
        `INSERT INTO "${t.name}" (${cols.map((c) => `"${c}"`).join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`,
      ).run(...cols.map((c) => values[c] as string | number | null));

      // Ch. 4: creating the well auto-creates its Original Hole wellbore, so
      // wellbore-linked folders have something to link to from the first day.
      if (mintedWell) {
        const wb = table(d, "wvWellbore");
        if (wb?.colSet.has("idrec")) {
          const wbId = newIdRec();
          const wbValues: Record<string, unknown> = {
            [wb.colSet.get("idwell")!]: idwell,
            [wb.colSet.get("idrec")!]: wbId,
          };
          const des = wb.colSet.get("des");
          if (des) wbValues[des] = "Original Hole";
          // self-reference marks the original hole (§10.4)
          const par = wb.colSet.get("idrecparent");
          if (par) wbValues[par] = wbId;
          for (const [k, v] of [["syscreatedate", now], ["syscreateuser", user], ["sysmoddate", now], ["sysmoduser", user]] as const) {
            const c = wb.colSet.get(k);
            if (c) wbValues[c] = v;
          }
          const wcols = Object.keys(wbValues);
          writable(d).prepare(
            `INSERT INTO "${wb.name}" (${wcols.map((c) => `"${c}"`).join(", ")}) VALUES (${wcols.map(() => "?").join(", ")})`,
          ).run(...wcols.map((c) => wbValues[c] as string | number | null));
        }
      }
      return { idrec, idwell: t.hasIdwell ? idwell : null };
    },
  );

  /** Edit fields of a record. */
  app.patch<{ Params: { db: string; table: string; idrec: string }; Body: { values?: Record<string, unknown> } }>(
    "/entry/wellview/dbs/:db/records/:table/:idrec",
    { preHandler: WELLVIEW_GUARD },
    async (req, reply) => {
      const d = need(reply, req.params.db);
      if (!d) return;
      const t = table(d, req.params.table);
      if (!t) return reply.code(404).send({ error: `no table ${req.params.table}` });
      const keyCol = t.colSet.get("idrec") ?? (t.name.toLowerCase() === "wvwellheader" ? t.colSet.get("idwell") : null);
      if (!keyCol) return reply.code(400).send({ error: `${t.name} has no record key` });
      const patch: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(req.body?.values ?? {})) {
        const actual = t.colSet.get(k.toLowerCase());
        if (!actual || isSysCol(actual) || (isKeyCol(actual) && !isSelfParentLink(t, actual))) continue;
        if (modelField(t.name, actual)?.calculated) continue;   // green = not editable
        patch[actual] = v === "" ? null : v;
      }
      // Re-pointing a link on an existing row has the same pair to keep in step
      // as creating one. Only fills a blank companion; a TK the caller sent
      // explicitly is left exactly as it came.
      fillLinkTks(d, t, patch);

      const sets: string[] = [];
      const args: (string | number | null)[] = [];
      for (const [col, v] of Object.entries(patch)) {
        sets.push(`"${col}" = ?`);
        args.push(v as string | number | null);
      }
      if (!sets.length) return reply.code(400).send({ error: "nothing to update" });
      const user = (req as unknown as { entryUser?: { username?: string } }).entryUser?.username ?? "web";
      const now = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
      for (const [k, v] of [["sysmoddate", now], ["sysmoduser", user]] as const) {
        const c = t.colSet.get(k);
        if (c) { sets.push(`"${c}" = ?`); args.push(v); }
      }
      const res = writable(d).prepare(`UPDATE "${t.name}" SET ${sets.join(", ")} WHERE "${keyCol}" = ?`)
        .run(...args, req.params.idrec);
      return { changed: Number(res.changes) };
    },
  );

  /**
   * Rewrite the order of a sequenced folder (§3.9 Change the Order of Records,
   * Add Records to the Top, Invert Components).
   *
   * The client sends the whole intended order rather than a move instruction, so
   * every command — up, down, to-top, invert — is the same operation here and
   * the stored sequence cannot drift out of step with what is on screen. Only
   * records of the given parent may appear, and every one of them must: a
   * partial order would renumber some rows and leave others stranded.
   */
  app.post<{
    Params: { db: string; table: string };
    Body: { idwell?: string; parent?: string; order?: string[] };
  }>(
    "/entry/wellview/dbs/:db/records/:table/reorder",
    { preHandler: WELLVIEW_GUARD },
    async (req, reply) => {
      const d = need(reply, req.params.db);
      if (!d) return;
      const t = table(d, req.params.table);
      if (!t) return reply.code(404).send({ error: `no table ${req.params.table}` });
      if (!modelTable(t.name)?.sequenced) {
        return reply.code(400).send({ error: `${t.name} is not a sequenced folder` });
      }
      const seqCol = t.colSet.get("sysseq");
      const idCol = t.colSet.get("idrec");
      if (!seqCol || !idCol) return reply.code(400).send({ error: `${t.name} has no sequence column` });

      const order = req.body?.order ?? [];
      if (!order.length) return reply.code(400).send({ error: "order is required" });

      // The rows this folder actually holds, under the same scope the grid used.
      const where: string[] = [];
      const args: string[] = [];
      if (req.body?.idwell && t.hasIdwell) { where.push(`"${t.colSet.get("idwell")}" = ?`); args.push(req.body.idwell); }
      if (req.body?.parent && t.hasParent) { where.push(`"${t.colSet.get("idrecparent")}" = ?`); args.push(req.body.parent); }
      const existing = (d.ro.prepare(
        `SELECT "${idCol}" AS id FROM "${t.name}"${where.length ? ` WHERE ${where.join(" AND ")}` : ""}`,
      ).all(...args) as { id: string }[]).map((r) => String(r.id));

      const known = new Set(existing);
      const unknown = order.filter((id) => !known.has(id));
      if (unknown.length) {
        return reply.code(400).send({ error: `not in this folder: ${unknown.slice(0, 3).join(", ")}` });
      }
      if (order.length !== existing.length) {
        return reply.code(400).send({
          error: `the order must list all ${existing.length} records; ${order.length} given`,
        });
      }

      const w = writable(d);
      const stmt = w.prepare(`UPDATE "${t.name}" SET "${seqCol}" = ? WHERE "${idCol}" = ?`);
      w.exec("BEGIN");
      try {
        order.forEach((id, i) => stmt.run(i + 1, id));
        w.exec("COMMIT");
      } catch (e) {
        w.exec("ROLLBACK");
        throw e;
      }
      return { reordered: order.length };
    },
  );

  /** Delete a record and, per the manual, everything in its subfolders. */
  /**
   * What deleting this record would cost — asked before the confirm, not after.
   *
   * The help: "A warning message lists the subfolders that are affected." The
   * app used to show a fixed sentence that named nothing and report the count
   * once the rows were already gone, which is the wrong order for a decision
   * that cannot be undone.
   */
  app.get<{ Params: { db: string; table: string; idrec: string } }>(
    "/entry/wellview/dbs/:db/records/:table/:idrec/delete-preflight",
    { preHandler: WELLVIEW_GUARD },
    async (req, reply) => {
      const d = need(reply, req.params.db);
      if (!d) return;
      const t = table(d, req.params.table);
      if (!t) return reply.code(404).send({ error: `no table ${req.params.table}` });
      if (!t.colSet.has("idrec")) return reply.code(400).send({ error: `${t.name} rows have no IDRec` });
      return deletePreflight(d, t, req.params.idrec);
    },
  );

  app.delete<{ Params: { db: string; table: string; idrec: string } }>(
    "/entry/wellview/dbs/:db/records/:table/:idrec",
    { preHandler: WELLVIEW_GUARD },
    async (req, reply) => {
      const d = need(reply, req.params.db);
      if (!d) return;
      const t = table(d, req.params.table);
      if (!t) return reply.code(404).send({ error: `no table ${req.params.table}` });
      if (!t.colSet.has("idrec")) return reply.code(400).send({ error: `${t.name} rows have no IDRec` });
      /*
       * "You cannot delete a record that has fields associated to it … You must
       * first remove the associations before you delete the record."
       *
       * Refused rather than cascaded. The alternative is 34 wvPerforation rows
       * left pointing at a zone that no longer exists — links this app can no
       * longer caption and the desktop cannot follow — and no way back, because
       * there is no undo. A refusal costs a user one step; the cascade costs
       * them data they cannot see is gone.
       */
      const pre = deletePreflight(d, t, req.params.idrec);
      if (!pre.canDelete) {
        return reply.code(409).send({
          error: "still referenced",
          referencedBy: pre.referencedBy,
          records: pre.records,
        });
      }
      return { removed: deleteRecord(d, t, req.params.idrec), records: pre.records };
    },
  );

  /**
   * Candidate records for a link column's target table, with readable captions
   * — what the manual's associated-data lookup shows instead of GUIDs.
   */
  app.get<{ Params: { db: string }; Querystring: { table?: string; idwell?: string } }>(
    "/entry/wellview/dbs/:db/link-candidates",
    { preHandler: WELLVIEW_GUARD },
    async (req, reply) => {
      const d = need(reply, req.params.db);
      if (!d) return;
      const t = table(d, String(req.query.table ?? ""));
      if (!t) return reply.code(404).send({ error: `no table ${req.query.table}` });
      const idCol = t.colSet.get("idrec");
      if (!idCol) return reply.code(400).send({ error: `${t.name} rows have no IDRec` });
      const where = req.query.idwell && t.hasIdwell ? "WHERE idwell = ?" : "";
      const args = where ? [String(req.query.idwell)] : [];
      const ord = orderClause(t);
      const rows = d.ro.prepare(
        `SELECT * FROM "${t.name}" ${where}${ord ? ` ORDER BY ${ord}` : ""} LIMIT 300`,
      ).all(...args) as Record<string, unknown>[];
      return {
        table: t.name,
        candidates: rows.map((r) => ({ idrec: String(r[idCol]), caption: captionOf(t, r) })),
      };
    },
  );

  /**
   * The ancestor chain of one record, subject-area root first.
   *
   * Opening Edit Data on a record found in a report means selecting the right
   * record at every level above it — the manual's "double-click a field on the
   * report to open the Edit Data window" only works if the parent folders are
   * positioned on the same job and day. Walking IDRecParent up the prefix chain
   * is what makes that possible.
   */
  app.get<{ Params: { db: string }; Querystring: { table?: string; idrec?: string } }>(
    "/entry/wellview/dbs/:db/record-path",
    { preHandler: WELLVIEW_GUARD },
    async (req, reply) => {
      const d = need(reply, req.params.db);
      if (!d) return;
      const start = table(d, String(req.query.table ?? ""));
      if (!start) return reply.code(404).send({ error: `no table ${req.query.table}` });
      const path: { table: string; idrec: string }[] = [];
      let t: TableInfo | null = start;
      let id: string | null = String(req.query.idrec ?? "");
      const seen = new Set<string>();
      while (t && id) {
        if (seen.has(`${t.name}:${id}`)) break;          // cycle guard
        seen.add(`${t.name}:${id}`);
        path.unshift({ table: t.name, idrec: id });
        const parentCol = t.colSet.get("idrecparent");
        const idCol = t.colSet.get("idrec");
        // A self-parent (wvWellbore sidetrack) is not a step up the folder tree.
        if (!t.parent || !parentCol || !idCol) break;
        const row = d.ro.prepare(`SELECT "${parentCol}" p FROM "${t.name}" WHERE "${idCol}" = ?`)
          .get(id) as { p: string | null } | undefined;
        id = row?.p ?? null;
        t = table(d, t.parent);
      }
      return { path };
    },
  );

  /**
   * A directional survey with the values WellView computes at print time.
   *
   * The database stores only what the tool measured — MD, inclination, azimuth.
   * TVD, N/S, E/W, dogleg and vertical section are `calculated` fields with no
   * columns at all, so they are integrated here by minimum curvature rather
   * than left blank. Stored per-station overrides win; stations flagged bad are
   * excluded. Everything comes back in the model's base units, and each value
   * is labelled `computed` so the client never presents it as stored.
   */
  app.get<{ Params: { db: string }; Querystring: { survey?: string; idwell?: string } }>(
    "/entry/wellview/dbs/:db/survey",
    { preHandler: WELLVIEW_GUARD },
    async (req, reply) => {
      const d = need(reply, req.params.db);
      if (!d) return;
      const data = table(d, "wvWellboreDirSurveyData");
      const head = table(d, "wvWellboreDirSurvey");
      if (!data || !head) return reply.code(404).send({ error: "survey tables not in this database" });
      const idrec = String(req.query.survey ?? "");
      if (!idrec) return reply.code(400).send({ error: "survey (IDRec of the survey) is required" });

      const col = (t: TableInfo, c: string) => t.colSet.get(c);
      const numOf = (v: unknown): number | null => {
        if (v == null || v === "") return null;
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
      };

      const rows = d.ro.prepare(
        `SELECT * FROM "${data.name}" WHERE "${col(data, "idrecparent")}" = ?`).all(idrec) as Record<string, unknown>[];

      const stations = rows.map((r) => ({
        md: numOf(r[col(data, "md") ?? ""]) ?? NaN,
        inclination: numOf(r[col(data, "inclination") ?? ""]) ?? NaN,
        azimuth: numOf(r[col(data, "azimuth") ?? ""]) ?? NaN,
        dontUse: String(r[col(data, "dontuse") ?? ""] ?? "") === "1",
        tvdOverride: numOf(r[col(data, "tvdoverride") ?? ""]),
        nsOverride: numOf(r[col(data, "nsoverride") ?? ""]),
        ewOverride: numOf(r[col(data, "ewoverride") ?? ""]),
        dlsOverride: numOf(r[col(data, "dlsoverride") ?? ""]),
        vsOverride: numOf(r[col(data, "vsoverride") ?? ""]),
      }));

      // The survey header's tie-in, and the wellbore's vertical-section frame.
      const hRow = d.ro.prepare(
        `SELECT * FROM "${head.name}" WHERE "${col(head, "idrec")}" = ?`).get(idrec) as Record<string, unknown> | undefined;
      const tieIn = hRow ? {
        md: numOf(hRow[col(head, "mdtiein") ?? ""]),
        tvd: numOf(hRow[col(head, "tvdtiein") ?? ""]),
        ns: numOf(hRow[col(head, "nstiein") ?? ""]),
        ew: numOf(hRow[col(head, "ewtiein") ?? ""]),
        inclination: numOf(hRow[col(head, "inclinationtiein") ?? ""]),
        azimuth: numOf(hRow[col(head, "azimuthtiein") ?? ""]),
      } : null;

      const bore = table(d, "wvWellbore");
      let vs: { vsDirection: number | null; vsOriginNs: number | null; vsOriginEw: number | null } =
        { vsDirection: null, vsOriginNs: null, vsOriginEw: null };
      if (bore && hRow) {
        // The wellbore that names this survey as its actual one owns the frame.
        const bRow = d.ro.prepare(
          `SELECT * FROM "${bore.name}" WHERE "${col(bore, "idrecdirsrvyactual")}" = ? LIMIT 1`)
          .get(idrec) as Record<string, unknown> | undefined;
        if (bRow) {
          vs = {
            vsDirection: numOf(bRow[col(bore, "vsdir") ?? ""]),
            vsOriginNs: numOf(bRow[col(bore, "vsoriginns") ?? ""]),
            vsOriginEw: numOf(bRow[col(bore, "vsoriginew") ?? ""]),
          };
        }
      }

      const results = computeSurvey(stations, { tieIn, ...vs });
      const dropped = stations.length - results.length;
      // Inclination-only stations are legal and are kept, with the previous
      // bearing carried. Their TVD is sound; their NS/EW rest on that carry,
      // so the count is reported rather than left for the reader to notice.
      const assumedAzimuth = results.filter((r) => r.azimuthAssumed).length;
      return {
        survey: idrec,
        method: "minimum curvature",
        /** What each computed column is called and what it is measured in. */
        columns: [
          { key: "md", label: columnLabel(data.name, "md"), unit: modelField(data.name, "md")?.baseUnit, units: modelField(data.name, "md")?.units, computed: false, applyDatum: modelField(data.name, "md")?.applyDatum || undefined },
          { key: "inclination", label: columnLabel(data.name, "inclination"), unit: modelField(data.name, "inclination")?.baseUnit, units: modelField(data.name, "inclination")?.units, computed: false, applyDatum: modelField(data.name, "inclination")?.applyDatum || undefined },
          { key: "azimuth", label: columnLabel(data.name, "azimuth"), unit: modelField(data.name, "azimuth")?.baseUnit, units: modelField(data.name, "azimuth")?.units, computed: false, applyDatum: modelField(data.name, "azimuth")?.applyDatum || undefined },
          { key: "tvd", label: columnLabel(data.name, "tvdcalc"), unit: modelField(data.name, "tvdcalc")?.baseUnit, units: modelField(data.name, "tvdcalc")?.units, computed: true, applyDatum: modelField(data.name, "tvdcalc")?.applyDatum || undefined },
          { key: "ns", label: columnLabel(data.name, "nscalc"), unit: modelField(data.name, "nscalc")?.baseUnit, units: modelField(data.name, "nscalc")?.units, computed: true, applyDatum: modelField(data.name, "nscalc")?.applyDatum || undefined },
          { key: "ew", label: columnLabel(data.name, "ewcalc"), unit: modelField(data.name, "ewcalc")?.baseUnit, units: modelField(data.name, "ewcalc")?.units, computed: true, applyDatum: modelField(data.name, "ewcalc")?.applyDatum || undefined },
          { key: "vs", label: columnLabel(data.name, "vscalc"), unit: modelField(data.name, "vscalc")?.baseUnit, units: modelField(data.name, "vscalc")?.units, computed: true, applyDatum: modelField(data.name, "vscalc")?.applyDatum || undefined },
          { key: "departure", label: columnLabel(data.name, "departcalc"), unit: modelField(data.name, "departcalc")?.baseUnit, units: modelField(data.name, "departcalc")?.units, computed: true, applyDatum: modelField(data.name, "departcalc")?.applyDatum || undefined },
          { key: "dls", label: columnLabel(data.name, "dlscalc"), unit: modelField(data.name, "dlscalc")?.baseUnit, units: modelField(data.name, "dlscalc")?.units, computed: true, applyDatum: modelField(data.name, "dlscalc")?.applyDatum || undefined },
          { key: "buildRate", label: columnLabel(data.name, "buildratecalc"), unit: modelField(data.name, "buildratecalc")?.baseUnit, units: modelField(data.name, "buildratecalc")?.units, computed: true, applyDatum: modelField(data.name, "buildratecalc")?.applyDatum || undefined },
          { key: "turnRate", label: columnLabel(data.name, "turnratecalc"), unit: modelField(data.name, "turnratecalc")?.baseUnit, units: modelField(data.name, "turnratecalc")?.units, computed: true, applyDatum: modelField(data.name, "turnratecalc")?.applyDatum || undefined },
        ],
        stations: results,
        /** Stated, not hidden: what was left out and what is not attempted. */
        excludedBadStations: dropped,
        assumedAzimuth,
        verticalSection: vs.vsDirection == null
          ? "no vertical section direction on the wellbore — VS not computed"
          : null,
        notes: [
          "TVD, NS, EW, VS, departure, dogleg and the rates are computed here — WellView computes them at print time and stores none of them.",
          "Declination and convergence are not applied: azimuths are used exactly as stored.",
          "Unwrapped Displace is not computed — its definition is not stated in anything available.",
          ...(assumedAzimuth
            ? [`${assumedAzimuth} of ${results.length} stations carry no azimuth (an inclination-only survey). `
               + "Their TVD, dogleg and build rate are unaffected, but NS, EW and VS assume the hole held the "
               + "last stated bearing."]
            : []),
        ],
      };
    },
  );

  /**
   * Distinct values a column actually holds in this database.
   *
   * Serves two callers: Quick Query's Look-for lookup (§3.3), and the library
   * lookup in Edit Data. For the latter this is NOT the approved library —
   * WellView keeps those in custom/library/*.lib, which are encrypted ZIPs and
   * unreadable here — so the client captions it as values in use and never as
   * the sanctioned list.
   */
  app.get<{ Params: { db: string }; Querystring: { table?: string; column?: string } }>(
    "/entry/wellview/dbs/:db/column-values",
    { preHandler: WELLVIEW_GUARD },
    async (req, reply) => {
      const d = need(reply, req.params.db);
      if (!d) return;
      // Defaults to the well header, which is what Quick Query's Look-for asks
      // for; any table works, which is what the library-field lookup needs.
      const t = table(d, String(req.query.table ?? "wvWellHeader"));
      if (!t) return reply.code(404).send({ error: `no table ${req.query.table}` });
      const col = t.colSet.get(String(req.query.column ?? "").toLowerCase());
      if (!col) return reply.code(404).send({ error: `no column ${req.query.column} on ${t.name}` });
      // Values in use across the WHOLE database, not just one well: a grade
      // typed on another well is still a value this database uses.
      const rows = d.ro.prepare(
        `SELECT DISTINCT "${col}" v FROM "${t.name}" WHERE "${col}" IS NOT NULL AND "${col}" <> '' ORDER BY 1 LIMIT 500`,
      ).all() as { v: unknown }[];
      return { table: t.name, column: col, values: rows.map((r) => String(r.v)) };
    },
  );

  /**
   * Deep-copy a record INCLUDING its subfolder records (manual: Copy Record /
   * Paste Record and Duplicate Record both carry the subfolders). The copy can
   * land in another well (targetIdwell) or under another parent record.
   */
  app.post<{
    Params: { db: string; table: string; idrec: string };
    Body: { idwell?: string; parent?: string };
  }>(
    "/entry/wellview/dbs/:db/records/:table/:idrec/copy",
    { preHandler: WELLVIEW_GUARD },
    async (req, reply) => {
      const d = need(reply, req.params.db);
      if (!d) return;
      const t = table(d, req.params.table);
      if (!t) return reply.code(404).send({ error: `no table ${req.params.table}` });
      const idCol = t.colSet.get("idrec");
      if (!idCol) return reply.code(400).send({ error: `${t.name} rows have no IDRec` });
      const src = d.ro.prepare(`SELECT * FROM "${t.name}" WHERE "${idCol}" = ?`).get(req.params.idrec) as
        Record<string, unknown> | undefined;
      if (!src) return reply.code(404).send({ error: "record not found" });

      const user = (req as unknown as { entryUser?: { username?: string } }).entryUser?.username ?? "web";
      const now = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
      const sch = schema(d);
      const w = writable(d);
      let copied = 0;

      const copyRec = (tt: TableInfo, row: Record<string, unknown>, idwell: string | null, parent: string | null): string => {
        const values: Record<string, unknown> = { ...row };
        const newId = newIdRec();
        values[tt.colSet.get("idrec")!] = newId;
        if (tt.hasIdwell && idwell) values[tt.colSet.get("idwell")!] = idwell;
        if (tt.hasParent) values[tt.colSet.get("idrecparent")!] = parent;
        for (const [k, v] of [["syscreatedate", now], ["syscreateuser", user], ["sysmoddate", now], ["sysmoduser", user]] as const) {
          const c = tt.colSet.get(k);
          if (c) values[c] = v;
        }
        const cols = Object.keys(values);
        w.prepare(
          `INSERT INTO "${tt.name}" (${cols.map((c) => `"${c}"`).join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`,
        ).run(...cols.map((c) => values[c] as string | number | null));
        copied++;
        // subfolder records travel with the record, exactly as the manual says
        for (const childName of tt.children) {
          const child = sch.get(childName.toLowerCase())!;
          if (!child.colSet.has("idrec") || !child.hasParent) continue;
          const kids = d.ro.prepare(
            `SELECT * FROM "${child.name}" WHERE "${child.colSet.get("idrecparent")}" = ?`,
          ).all(String(row[tt.colSet.get("idrec")!])) as Record<string, unknown>[];
          for (const kid of kids) copyRec(child, kid, idwell, newId);
        }
        return newId;
      };

      const targetIdwell = req.body?.idwell ?? (t.hasIdwell ? String(src[t.colSet.get("idwell")!]) : null);
      const targetParent = req.body?.parent ?? (t.hasParent ? (src[t.colSet.get("idrecparent")!] as string | null) : null);
      const idrec = copyRec(t, src, targetIdwell, targetParent);
      return { idrec, copied };
    },
  );

  /**
   * Delete a WHOLE well: its rows in every idwell-carrying table. This is the
   * manual's warning made explicit — "the Delete command will delete the entire
   * well from the database, not just the link to it."
   */
  app.delete<{ Params: { db: string; idwell: string } }>(
    "/entry/wellview/dbs/:db/wells/:idwell",
    { preHandler: WELLVIEW_GUARD },
    async (req, reply) => {
      const d = need(reply, req.params.db);
      if (!d) return;
      const w = writable(d);
      let removed = 0;
      for (const t of schema(d).values()) {
        if (!t.hasIdwell) continue;
        const res = w.prepare(`DELETE FROM "${t.name}" WHERE "${t.colSet.get("idwell")}" = ?`).run(req.params.idwell);
        removed += Number(res.changes);
      }
      return { removed };
    },
  );

  /**
   * The multi-well report templates (`custom/reports multi/*.afm`).
   *
   * WellView's other reporting mode: one table printed across a SET of wells
   * rather than one well's whole report. Listed separately from the single-well
   * templates because they are chosen and run differently.
   */
  app.get("/entry/wellview/dbs/:db/reports-multi", { preHandler: WELLVIEW_GUARD }, async () => {
    return {
      reports: multiTemplates().map((t) => ({
        html: t.html,
        name: t.name,
        folder: t.folder ?? "",
        formatVersion: t.format_version ?? 3,
        blocks: t.blocks.map((b) => ({ table: b.table, title: b.title, fields: b.fields.length })),
      })),
    };
  });

  /**
   * Run a multi-well template over the wells the user selected.
   *
   * `wells` is an explicit list. An empty list returns no rows — "nothing
   * selected" must never quietly mean "every well in the database", which on a
   * real asset would be a very expensive way to be wrong.
   */
  app.get<{ Params: { db: string }; Querystring: { html?: string; wells?: string } }>(
    "/entry/wellview/dbs/:db/multi-report",
    { preHandler: WELLVIEW_GUARD },
    async (req, reply) => {
      const d = need(reply, req.params.db);
      if (!d) return;
      const html = String(req.query.html ?? "");
      if (!html) return reply.code(400).send({ error: "html (template id) is required" });
      const tpl = multiTemplates().find((t) => t.html === html);
      if (!tpl) return reply.code(404).send({ error: `no multi-well template with html=${html}` });
      const wells = String(req.query.wells ?? "").split(",").map((w) => w.trim()).filter(Boolean);
      // A bounded set: the query binds one parameter per well.
      if (wells.length > 500) return reply.code(400).send({ error: "at most 500 wells at a time" });
      return resolveMultiTemplate(d.ro, tpl, wells);
    },
  );

  /**
   * Attachments on a well, or on one record of one table.
   *
   * Metadata only — the blob is fetched separately, because a listing that
   * inlined 3.6 MB of wellhead photographs would be unusable. Size and type
   * come from the BYTES, never from AttachBlobSz or AttachExtension: the first
   * is NULL on 9 of the sample database's 17 rows whose blob is real, and the
   * second is absent or wrong on several.
   */
  app.get<{ Params: { db: string }; Querystring: { idwell?: string; table?: string; idrec?: string } }>(
    "/entry/wellview/dbs/:db/attachments",
    { preHandler: WELLVIEW_GUARD },
    async (req, reply) => {
      const d = need(reply, req.params.db);
      if (!d) return;
      const t = table(d, "wvAttachment");
      if (!t) return { attachments: [], supported: false };

      const preds: string[] = [];
      const args: string[] = [];
      if (req.query.idwell) { preds.push(`"${t.colSet.get("idwell")}" = ?`); args.push(req.query.idwell); }
      // A record's own attachments: WellView keys them by the parent record AND
      // the parent's table name, lowercased, in TblKeyParent.
      if (req.query.idrec) {
        // The parent RECORD is the requirement; the parent TABLE only
        // disambiguates. 8 of the sample's 17 rows name a parent record and
        // leave TblKeyParent NULL — older imports — so requiring both hides
        // them from the record they are actually attached to. Still refuses a
        // row explicitly labelled for a different table, which matters because
        // an IDRec can collide across tables.
        preds.push(`"${t.colSet.get("idrecparent")}" = ?`);
        args.push(req.query.idrec);
        if (req.query.table) {
          preds.push(`("${t.colSet.get("tblkeyparent")}" IS NULL OR lower("${t.colSet.get("tblkeyparent")}") = ?)`);
          args.push(req.query.table.toLowerCase());
        }
      } else if (req.query.table) {
        preds.push(`lower("${t.colSet.get("tblkeyparent")}") = ?`);
        args.push(req.query.table.toLowerCase());
      }
      const where = preds.length ? ` WHERE ${preds.join(" AND ")}` : "";

      // Read the blob's LENGTH and only its first bytes. Selecting the blobs
      // themselves to measure and sniff them pulled 3.9 MB into memory to
      // produce a listing that shows none of it.
      const blobCol = t.colSet.get("attachblob");
      const extra = blobCol
        ? `, length("${blobCol}") AS __bytes, substr("${blobCol}", 1, 64) AS __head`
        : "";
      const rows = d.ro.prepare(
        `SELECT *${extra} FROM "${t.name}"${where}`).all(...args) as Record<string, unknown>[];
      const col = (c: string) => t.colSet.get(c) ?? c;
      return {
        supported: true,
        attachments: rows.map((r) => {
          const head = r.__head as Uint8Array | null;
          const bytes = Number(r.__bytes ?? 0);
          const s = sniff(head);
          return {
            idrec: String(r[col("idrec")] ?? ""),
            idwell: r[col("idwell")] ?? null,
            parent: r[col("idrecparent")] ?? null,
            parentTable: r[col("tblkeyparent")] ?? null,
            des: r[col("des")] ?? null,
            typ1: r[col("typ1")] ?? null,
            typ2: r[col("typ2")] ?? null,
            dttm: r[col("dttm")] ?? null,
            com: r[col("com")] ?? null,
            /** Where the file came from originally — a local path on someone's
             *  desktop in 2004. Shown as provenance, never fetched. */
            sourceUrl: r[col("attachurl")] ?? null,
            extension: r[col("attachextension")] ?? null,
            bytes,
            mime: s.mime,
            kind: s.label,
            inline: s.inline,
          };
        }),
      };
    },
  );

  /**
   * The bytes of one attachment.
   *
   * Rendered inline ONLY when the magic number says it is one of a short list
   * of raster image formats; everything else, including anything unrecognised
   * and anything SVG-shaped, is sent as a download. See attachments.ts — this
   * is the route where a file someone else uploaded is served back from this
   * application's own origin, which is where stored XSS would live.
   */
  app.get<{ Params: { db: string; idrec: string } }>(
    "/entry/wellview/dbs/:db/attachments/:idrec/content",
    { preHandler: WELLVIEW_GUARD },
    async (req, reply) => {
      const d = need(reply, req.params.db);
      if (!d) return;
      const t = table(d, "wvAttachment");
      if (!t) return reply.code(404).send({ error: "no attachments in this database" });
      const row = d.ro.prepare(
        `SELECT * FROM "${t.name}" WHERE "${t.colSet.get("idrec")}" = ?`,
      ).get(req.params.idrec) as Record<string, unknown> | undefined;
      if (!row) return reply.code(404).send({ error: "no such attachment" });

      const blob = row[t.colSet.get("attachblob") ?? "AttachBlob"] as Uint8Array | null;
      if (!blob?.length) return reply.code(404).send({ error: "this attachment holds no data" });

      const s = sniff(blob);
      const name = safeFilename(
        (row[t.colSet.get("des") ?? "Des"] as string) ?? null,
        (row[t.colSet.get("attachextension") ?? "AttachExtension"] as string) ?? null,
        s.mime,
      );
      reply.headers(attachmentHeaders(s, name, blob.length));
      return reply.send(Buffer.from(blob));
    },
  );

  /**
   * Add an attachment.
   *
   * Multipart, one file. The blob is bound as a parameter like every other
   * write here; the declared filename and type are recorded as the user's
   * description but are NEVER used to decide how the file is served back —
   * that always comes from the bytes.
   */
  app.post<{ Params: { db: string } }>(
    "/entry/wellview/dbs/:db/attachments",
    { preHandler: WELLVIEW_GUARD },
    async (req, reply) => {
      const d = need(reply, req.params.db);
      if (!d) return;
      const t = table(d, "wvAttachment");
      if (!t) return reply.code(404).send({ error: "this database has no wvAttachment table" });
      if (!req.isMultipart()) return reply.code(400).send({ error: "send the file as multipart/form-data" });

      const file = await req.file();
      if (!file) return reply.code(400).send({ error: "no file in the request" });
      const buf = await file.toBuffer();
      // @fastify/multipart flags a file that hit its limit rather than throwing.
      if (file.file.truncated || buf.length > MAX_ATTACHMENT_BYTES) {
        return reply.code(413).send({ error: `attachments are limited to ${MAX_ATTACHMENT_BYTES / (1024 * 1024)} MB` });
      }
      if (!buf.length) return reply.code(400).send({ error: "the file is empty" });

      const field = (n: string): string | null => {
        const f = (file.fields as Record<string, unknown>)[n] as { value?: unknown } | undefined;
        const v = f && typeof f === "object" && "value" in f ? f.value : undefined;
        return typeof v === "string" && v.trim() ? v.trim() : null;
      };
      const idwell = field("idwell");
      if (!idwell) return reply.code(400).send({ error: "idwell is required" });

      const idrec = newIdRec();
      const col = (c: string) => t.colSet.get(c);
      const values: Record<string, unknown> = {};
      const put = (c: string, v: unknown) => { const a = col(c); if (a && v != null) values[a] = v; };
      put("idrec", idrec);
      put("idwell", idwell);
      put("idrecparent", field("parent"));
      put("tblkeyparent", field("table")?.toLowerCase() ?? null);
      put("des", field("des") ?? file.filename ?? "Attachment");
      put("typ1", field("typ1"));
      put("typ2", field("typ2"));
      put("com", field("com"));
      put("dttm", new Date().toISOString().slice(0, 19) + "Z");
      // Recorded from the upload for provenance; the served type is sniffed.
      put("attachextension", (file.filename?.split(".").pop() ?? "").toLowerCase().slice(0, 8) || null);
      put("attachblobsz", buf.length);
      put("attachblob", buf);

      const cols = Object.keys(values);
      const sql = `INSERT INTO "${t.name}" (${cols.map((c) => `"${c}"`).join(", ")})
                   VALUES (${cols.map(() => "?").join(", ")})`;
      writable(d).prepare(sql).run(...cols.map((c) => values[c] as never));

      const s = sniff(buf);
      return reply.code(201).send({
        idrec, bytes: buf.length, mime: s.mime, kind: s.label, inline: s.inline,
      });
    },
  );

  /**
   * A well's reference elevations (Tools > Reference Datum).
   *
   * ElvOrigKB's own help settles what the stored depths mean: "Original KB
   * Elevation. All depths stored in the database relative to this elevation."
   * Everything else here is a point the user may re-reference TO, and a well
   * that lacks one cannot be re-referenced to it — which the client says,
   * rather than shifting by zero and looking like it worked.
   */
  app.get<{ Params: { db: string }; Querystring: { idwell?: string } }>(
    "/entry/wellview/dbs/:db/elevations",
    { preHandler: WELLVIEW_GUARD },
    async (req, reply) => {
      const d = need(reply, req.params.db);
      if (!d) return;
      const idwell = String(req.query.idwell ?? "");
      if (!idwell) return reply.code(400).send({ error: "idwell is required" });
      const t = table(d, "wvWellHeader");
      if (!t) return reply.code(404).send({ error: "no well header in this database" });

      const pick = (c: string) => t.colSet.get(c);
      const wanted: [string, string][] = [
        ["OrigKB", "elvorigkb"], ["Ground", "elvground"], ["MudLine", "elvmudline"],
        ["CasFlange", "elvcasflange"], ["TubHead", "elvtubhead"],
      ];
      const cols = wanted.filter(([, c]) => pick(c));
      const elevations: Record<string, number | null> = {};
      if (cols.length) {
        const row = d.ro.prepare(
          `SELECT ${cols.map(([, c]) => `"${pick(c)}"`).join(", ")}
             FROM "${t.name}" WHERE "${t.colSet.get("idwell")}" = ?`,
        ).get(idwell) as Record<string, unknown> | undefined;
        for (const [key, c] of cols) {
          const v = row?.[pick(c)!];
          const n = v == null || v === "" ? null : Number(v);
          elevations[key] = n != null && Number.isFinite(n) ? n : null;
        }
      }
      return {
        idwell,
        elevations,
        /** Elevations are heights, in the model's base length unit. */
        unit: modelField("wvWellHeader", "elvorigkb")?.baseUnit,
      };
    },
  );

  /**
   * Export a well — every row in every table that carries its idwell.
   *
   * Sent as a download rather than a JSON body: a real well is thousands of
   * rows and, with attachments, megabytes of base64.
   */
  app.get<{ Params: { db: string }; Querystring: { idwell?: string } }>(
    "/entry/wellview/dbs/:db/export",
    { preHandler: WELLVIEW_GUARD },
    async (req, reply) => {
      const d = need(reply, req.params.db);
      if (!d) return;
      const idwell = String(req.query.idwell ?? "");
      if (!idwell) return reply.code(400).send({ error: "idwell is required" });
      const payload = exportWell(d.ro, req.params.db, idwell);
      if (!payload) return reply.code(404).send({ error: `no well ${idwell} in ${req.params.db}` });
      const name = (payload.source.wellName ?? idwell).replace(/[^\w.-]+/g, "_").slice(0, 60);
      reply.header("Content-Type", "application/json; charset=utf-8");
      /*
       * NOT ".wvd", though that is what WellView calls a well file
       * (peloton.appframe.ini: datafileextension=wvd).
       *
       * A .wvd is Peloton’s own container. This is a JSON document of this
       * app’s making — the same data, a different format, and WellView cannot
       * open it. Borrowing the extension would claim an interoperability that
       * does not exist, which is worse than an unfamiliar suffix.
       */
      reply.header("Content-Disposition",
        `attachment; filename="${name}.${WELL_FILE_EXTENSION}"`);
      return reply.send(JSON.stringify(payload));
    },
  );

  /** What an import would do — checked before anything is written. */
  app.post<{ Params: { db: string }; Body: WellExport }>(
    "/entry/wellview/dbs/:db/import/preflight",
    { preHandler: WELLVIEW_GUARD },
    async (req, reply) => {
      const d = need(reply, req.params.db);
      if (!d) return;
      return importPreflight(d.ro, req.body);
    },
  );

  /**
   * Import a well.
   *
   * IDRec is preserved so every association survives, which is exactly why a
   * database that already holds the well is refused rather than merged.
   */
  app.post<{ Params: { db: string }; Body: WellExport }>(
    "/entry/wellview/dbs/:db/import",
    { preHandler: WELLVIEW_GUARD },
    async (req, reply) => {
      const d = need(reply, req.params.db);
      if (!d) return;
      try {
        return importWell(writable(d), req.body);
      } catch (e) {
        return reply.code(409).send({ error: (e as Error).message });
      }
    },
  );

  /** What a well has left on the pad — its closing mud/supply balances (§5.1). */
  app.get<{ Params: { db: string }; Querystring: { idwell?: string } }>(
    "/entry/wellview/dbs/:db/inventory",
    { preHandler: WELLVIEW_GUARD },
    async (req, reply) => {
      const d = need(reply, req.params.db);
      if (!d) return;
      const idwell = String(req.query.idwell ?? "");
      if (!idwell) return reply.code(400).send({ error: "idwell is required" });
      const items = closingInventory(d.ro, idwell);
      return {
        idwell,
        items,
        transferable: items.filter((i) => i.transferable).length,
      };
    },
  );

  /**
   * Mud Inventory Transfer: carry a previous well's closing balances onto a
   * job in this one, as stock received on the date given.
   */
  app.post<{
    Params: { db: string };
    Body: { fromWell?: string; toWell?: string; toJob?: string; dtTm?: string; items?: string[] };
  }>(
    "/entry/wellview/dbs/:db/inventory-transfer",
    { preHandler: WELLVIEW_GUARD },
    async (req, reply) => {
      const d = need(reply, req.params.db);
      if (!d) return;
      const { fromWell, toWell, toJob, dtTm, items } = req.body ?? {};
      if (!fromWell || !toWell || !toJob) {
        return reply.code(400).send({ error: "fromWell, toWell and toJob are required" });
      }
      if (fromWell === toWell) {
        return reply.code(400).send({ error: "the source and destination wells are the same" });
      }
      if (!items?.length) return reply.code(400).send({ error: "nothing selected to transfer" });
      try {
        return transferInventory(writable(d), {
          fromWell, toWell, toJob,
          // The guide is explicit that the date decides which report it lands on.
          dtTm: dtTm || `${new Date().toISOString().slice(0, 19)}Z`,
          items, newIdRec,
        });
      } catch (e) {
        return reply.code(409).send({ error: (e as Error).message });
      }
    },
  );

  /**
   * Query templates a user wrote (§8.1), alongside the 29 shipped ones.
   *
   * Kept in the application's own database rather than beside the converted
   * .sqlite: authoring a query should never write into the WellView data. A
   * criterion names a table and a column, and those differ between converted
   * databases, so a saved query belongs to the database it was written for.
   */
  app.get<{ Params: { db: string } }>(
    "/entry/wellview/dbs/:db/saved-queries",
    { preHandler: WELLVIEW_GUARD },
    async (req, reply) => {
      if (!prisma) return { queries: [] };
      const d = need(reply, req.params.db);
      if (!d) return;
      const rows = await prisma.wellviewQuery.findMany({
        where: { database: req.params.db },
        orderBy: [{ category: "asc" }, { name: "asc" }],
      });
      return {
        queries: rows.map((r) => ({
          id: r.id, name: r.name, category: r.category ?? "Saved",
          // Enriched exactly as the shipped templates are, so the prompt panel
          // renders a saved query the same way it renders a Peloton one.
          criteria: (JSON.parse(r.criteria) as QueryCriterion[]).map((c) => ({
            ...c,
            value: c.value ?? null,
            prompts: c.prompts === true,
            conj: c.conj === "OR" ? "OR" : undefined,
            op: c.op ?? null,
            tableLabel: folderLabel(c.table, null),
            fieldLabel: columnLabel(c.table, c.field),
            isDate: modelField(c.table, c.field)?.type === "datetime",
          })),
          createdBy: r.createdBy, updatedAt: r.updatedAt.toISOString(),
        })),
      };
    },
  );

  app.post<{
    Params: { db: string };
    Body: { id?: string; name?: string; category?: string; criteria?: QueryCriterion[] };
  }>(
    "/entry/wellview/dbs/:db/saved-queries",
    { preHandler: WELLVIEW_GUARD },
    async (req, reply) => {
      if (!prisma) return reply.code(503).send({ error: "saved queries need the application database" });
      const d = need(reply, req.params.db);
      if (!d) return;
      const name = (req.body?.name ?? "").trim();
      const criteria = req.body?.criteria ?? [];
      if (!name) return reply.code(400).send({ error: "a name is required" });
      if (!criteria.length) return reply.code(400).send({ error: "a query needs at least one criterion" });

      // Refuse a criterion this database cannot satisfy, rather than saving a
      // query that will only reveal itself as broken when someone runs it.
      const bad: string[] = [];
      for (const c of criteria) {
        const t = table(d, c.table);
        if (!t) { bad.push(`${c.table} is not a table here`); continue; }
        if (!t.colSet.get(c.field.toLowerCase())) bad.push(`${c.table}.${c.field} is not a column here`);
        else if (!t.hasIdwell) bad.push(`${c.table} is not per-well, so it cannot select wells`);
        if (!c.op) bad.push(`${c.table}.${c.field} has no operator`);
      }
      if (bad.length) return reply.code(400).send({ error: bad.join("; ") });

      const data = {
        database: req.params.db, name,
        category: req.body?.category?.trim() || null,
        criteria: JSON.stringify(criteria),
        createdBy: req.entryUser?.username ?? "unknown",
      };
      try {
        const saved = req.body?.id
          ? await prisma.wellviewQuery.update({ where: { id: req.body.id }, data })
          : await prisma.wellviewQuery.create({ data });
        return reply.code(req.body?.id ? 200 : 201).send({ id: saved.id, name: saved.name });
      } catch (e) {
        // The unique key is (database, name): a clash is a real answer, not a 500.
        if (String((e as { code?: string }).code) === "P2002") {
          return reply.code(409).send({ error: `this database already has a query called "${name}"` });
        }
        throw e;
      }
    },
  );

  app.delete<{ Params: { db: string; id: string } }>(
    "/entry/wellview/dbs/:db/saved-queries/:id",
    { preHandler: WELLVIEW_GUARD },
    async (req, reply) => {
      if (!prisma) return reply.code(503).send({ error: "saved queries need the application database" });
      const found = await prisma.wellviewQuery.findUnique({ where: { id: req.params.id } });
      if (!found || found.database !== req.params.db) {
        return reply.code(404).send({ error: "no such saved query in this database" });
      }
      await prisma.wellviewQuery.delete({ where: { id: req.params.id } });
      return { deleted: req.params.id };
    },
  );

  /**
   * The tables and columns a query may be built from.
   *
   * Only per-well tables can select wells, so only those are offered — the
   * builder cannot be used to compose a criterion the runner would then skip.
   */
  app.get<{ Params: { db: string }; Querystring: { table?: string } }>(
    "/entry/wellview/dbs/:db/query-fields",
    { preHandler: WELLVIEW_GUARD },
    async (req, reply) => {
      const d = need(reply, req.params.db);
      if (!d) return;
      if (!req.query.table) {
        const out = [...schema(d).values()]
          .filter((t) => t.hasIdwell && !HIDDEN_TABLES.test(t.name.toLowerCase()))
          .map((t) => ({ table: t.name, label: folderLabel(t.name, null) }))
          .sort((a, b) => a.label.localeCompare(b.label));
        return { tables: out };
      }
      const t = table(d, req.query.table);
      if (!t) return reply.code(404).send({ error: `no table ${req.query.table}` });
      return {
        table: t.name,
        fields: t.cols
          .filter((c) => !isSysCol(c))
          .map((c) => {
            const mf = modelField(t.name, c);
            return {
              field: c,
              label: columnLabel(t.name, c),
              type: mf?.type ?? "string",
              unit: mf?.baseUnit,
              /*
               * Whether this field moves with Tools > Reference Datum, which
               * decides whether it can be QUERIED at all. Every depth is stored
               * against the original KB, so a criterion typed while another
               * datum is selected means one thing to the user and another to
               * the database. The builder needs to know which fields those are.
               */
              applyDatum: mf?.applyDatum || undefined,
            };
          })
          .sort((a, b) => a.label.localeCompare(b.label)),
      };
    },
  );

  /**
   * Saved schematic views (§8.3 Schematic Templates).
   *
   * "Users can set up a standard list of settings in the schematic templates,
   * which provide various layouts to describe different data." Chevron's own
   * ship under custom/schematics — those folders are EMPTY in this export, so
   * there is no binary format to decode and these are the app's own templates:
   * a name over the settings the schematic already has.
   *
   * Not keyed by database. A template names element KINDS, not columns.
   */
  app.get("/entry/wellview/dbs/:db/schematic-templates", { preHandler: WELLVIEW_GUARD }, async () => {
    if (!prisma) return { templates: [] };
    const rows = await prisma.wellviewSchematicTemplate.findMany({ orderBy: { name: "asc" } });
    return {
      templates: rows.map((r) => ({
        id: r.id, name: r.name,
        settings: JSON.parse(r.settings) as Record<string, unknown>,
        createdBy: r.createdBy,
      })),
    };
  });

  app.post<{ Params: { db: string }; Body: { id?: string; name?: string; settings?: unknown } }>(
    "/entry/wellview/dbs/:db/schematic-templates",
    { preHandler: WELLVIEW_GUARD },
    async (req, reply) => {
      if (!prisma) return reply.code(503).send({ error: "saved templates need the application database" });
      const name = (req.body?.name ?? "").trim();
      if (!name) return reply.code(400).send({ error: "a name is required" });
      if (!req.body?.settings || typeof req.body.settings !== "object") {
        return reply.code(400).send({ error: "settings are required" });
      }
      const data = {
        name,
        settings: JSON.stringify(req.body.settings),
        createdBy: req.entryUser?.username ?? "unknown",
      };
      try {
        const saved = req.body?.id
          ? await prisma.wellviewSchematicTemplate.update({ where: { id: req.body.id }, data })
          : await prisma.wellviewSchematicTemplate.create({ data });
        return reply.code(req.body?.id ? 200 : 201).send({ id: saved.id, name: saved.name });
      } catch (e) {
        if (String((e as { code?: string }).code) === "P2002") {
          return reply.code(409).send({ error: `there is already a schematic template called "${name}"` });
        }
        throw e;
      }
    },
  );

  app.delete<{ Params: { db: string; id: string } }>(
    "/entry/wellview/dbs/:db/schematic-templates/:id",
    { preHandler: WELLVIEW_GUARD },
    async (req, reply) => {
      if (!prisma) return reply.code(503).send({ error: "saved templates need the application database" });
      const found = await prisma.wellviewSchematicTemplate.findUnique({ where: { id: req.params.id } });
      if (!found) return reply.code(404).send({ error: "no such schematic template" });
      await prisma.wellviewSchematicTemplate.delete({ where: { id: req.params.id } });
      return { deleted: req.params.id };
    },
  );

  /**
   * Days vs Depth / Cost — the drilling curve, from WellView's own templates.
   *
   * Peloton.DaysVsDepth.dll draws this from .dvdc templates; the three shipped
   * ones decode to 19 series and are built to JSON by build_dvdc.mjs. Every
   * series is a CALCULATED field, so `daysVsDepth` computes it from the base
   * tables following the model's stated EQNs.
   *
   * Scoped to a JOB, because that is what day 0 means. With no job named, the
   * first job that actually has a curve is used, and the rest are listed so the
   * caller can offer them.
   */
  app.get<{ Params: { db: string }; Querystring: { idwell?: string; job?: string; template?: string } }>(
    "/entry/wellview/dbs/:db/days-vs-depth",
    { preHandler: WELLVIEW_GUARD },
    async (req, reply) => {
      const d = need(reply, req.params.db);
      if (!d) return;
      const idwell = String(req.query.idwell ?? "");
      if (!idwell) return reply.code(400).send({ error: "idwell is required" });
      if (!table(d, "wvJob") || !table(d, "wvJobProgramPhase")) {
        return { supported: false, jobs: [], templates: [], series: [] };
      }

      const templates = dvdTemplates();
      const jobs = daysVsDepth(d.ro, idwell, req.query.job || undefined);
      const tpl = templates.find((t) => t.id === req.query.template) ?? templates[0] ?? null;
      /*
       * Default to the job that actually HAS a curve, not the newest one.
       * A well's most recent job is often a completion or a workover with cost
       * but no drilling: defaulting to it opens the chart on a near-empty axis
       * and reads as "this well has no data". The picker still lists them all,
       * newest first, so the choice stays the user's.
       */
      const job = req.query.job
        ? jobs[0] ?? null
        : jobs.reduce<(typeof jobs)[number] | null>((best, j) => {
          const score = (x: typeof j) => tpl
            ? resolveTemplate(x, tpl, () => ({ label: "" })).series
              .reduce((a, se) => a + se.points.length, 0)
            : x.phases.length + x.reports.length;
          return !best || score(j) > score(best) ? j : best;
        }, null);

      /** The model's own caption and unit for an axis. */
      const label = (tbl: string, field: string) => {
        const mf = modelField(tbl, field);
        return { label: mf?.label ?? field, unit: mf?.baseUnit ?? undefined,
          units: mf?.units as Record<string, unknown> | undefined,
          // The depth axes shift with Tools > Reference Datum; days and cost do not.
          applyDatum: mf?.applyDatum, datumMode: mf?.datumMode };
      };

      const resolved = job && tpl ? resolveTemplate(job, tpl, label) : { series: [], empty: [] };
      return {
        supported: true,
        // Listed for the picker; only the selected job is computed in full.
        jobs: (req.query.job ? daysVsDepth(d.ro, idwell) : jobs)
          .map((j) => ({ idrec: j.idrec, label: j.label,
            phases: j.phases.length, reports: j.reports.length })),
        job: job ? { idrec: job.idrec, label: job.label } : null,
        templates: templates.map((t) => ({ id: t.id, name: t.name, folder: t.folder })),
        template: tpl ? { id: tpl.id, name: tpl.name } : null,
        series: resolved.series,
        /** Series the template asked for that this job has no data for. */
        unavailable: resolved.empty,
      };
    },
  );

  /**
   * The wellhead: its assembly picture, its rating, and what it is made of.
   *
   * WellView draws this with Peloton.Visualizer.WellView.Wellhead.dll, and the
   * data says what that drawing can honestly be. The ASSEMBLY carries the
   * picture — wvWellhead.IconName holds "Wellhead 01".."Wellhead 08" and a
   * steel-plate variant, all of which resolve into the converted icon library.
   * The COMPONENTS carry no icon and no sequence column, and Sect is null on 23
   * of the sample's 35, so there is nothing to compose a stack drawing from:
   * they are a specification list — make, model, serial, bore, working
   * pressures, connection sizes and ring gaskets — and are presented as one.
   *
   * Anything else would be an invented arrangement of real equipment, which on
   * a pressure-containing assembly is exactly the wrong thing to guess at.
   */
  /** "Completion / Recompletion — 2009-04-15", or null when there is no job. */
  function wellheadJobLabel(d: Db, idrecJob: string | null): string | null {
    if (!idrecJob) return null;
    const job = table(d, "wvJob");
    if (!job) return null;
    const row = d.ro.prepare(`SELECT * FROM "${job.name}" WHERE "${job.colSet.get("idrec")}" = ?`)
      .get(idrecJob) as Record<string, unknown> | undefined;
    if (!row) return null;
    const pick = (c: string) => row[job.colSet.get(c) ?? c];
    const parts = [pick("jobtyp"), pick("jobsubtyp")].filter(Boolean).join(" / ");
    const when = String(pick("dttmstart") ?? "").slice(0, 10);
    return [parts || null, when || null].filter(Boolean).join(" — ") || null;
  }

  app.get<{ Params: { db: string }; Querystring: { idwell?: string } }>(
    "/entry/wellview/dbs/:db/wellheads",
    { preHandler: WELLVIEW_GUARD },
    async (req, reply) => {
      const d = need(reply, req.params.db);
      if (!d) return;
      const idwell = String(req.query.idwell ?? "");
      if (!idwell) return reply.code(400).send({ error: "idwell is required" });
      const head = table(d, "wvWellhead");
      if (!head) return { wellheads: [], supported: false };
      const jobLabel = (id: string | null) => wellheadJobLabel(d, id);
      const comp = table(d, "wvWellheadComp");
      const outlet = table(d, "wvWellheadCompOutlet");

      const heads = d.ro.prepare(
        `SELECT * FROM "${head.name}" WHERE "${head.colSet.get("idwell")}" = ?`).all(idwell) as Record<string, unknown>[];

      /**
       * Model caption + unit for every column a panel shows.
       *
       * Link columns are dropped as well as key ones: a bare 32-hex GUID is not
       * a specification, and IDRecJob is resolved to the job's own name below
       * instead. IconName goes too — it is the caption under the picture, not a
       * line of the rating.
       */
      const skip = (k: string) =>
        isSysCol(k) || isKeyCol(k) || /^idrec/i.test(k) || /tk$/i.test(k) ||
        k.toLowerCase() === "iconname" || k.toLowerCase() === "wvtyp";
      const describe = (tbl: string, row: Record<string, unknown>) =>
        Object.entries(row)
          .filter(([k, v]) => v != null && v !== "" && !skip(k))
          .map(([k, v]) => {
            const mf = modelField(tbl, k);
            return {
              column: k,
              label: modelTable(tbl) ? columnLabel(tbl, k) : k,
              value: v as string | number,
              // The model's physicaltype, so a boolean renders as Yes/No rather
              // than as the 0 the database stores, and a timestamp as a date.
              type: mf?.type,
              unit: mf?.baseUnit,
              units: mf?.units as Record<string, unknown> | undefined,
            };
          });

      return {
        supported: true,
        wellheads: heads.map((h) => {
          const id = String(h[head.colSet.get("idrec") ?? "IDRec"] ?? "");
          const comps = comp
            ? (d.ro.prepare(`SELECT * FROM "${comp.name}" WHERE "${comp.colSet.get("idrecparent")}" = ?`)
                .all(id) as Record<string, unknown>[])
            : [];
          return {
            idrec: id,
            /** The assembly picture WellView recorded for this head. */
            icon: iconByName((h[head.colSet.get("iconname") ?? "IconName"] as string) ?? null),
            iconName: h[head.colSet.get("iconname") ?? "IconName"] ?? null,
            /** The job this head was installed on, by name rather than by GUID. */
            job: jobLabel(h[head.colSet.get("idrecjob") ?? "IDRecJob"] as string | null),
            fields: describe(head.name, h),
            components: comps.map((c) => {
              const cid = String(c[comp!.colSet.get("idrec") ?? "IDRec"] ?? "");
              const outs = outlet
                ? (d.ro.prepare(`SELECT * FROM "${outlet.name}" WHERE "${outlet.colSet.get("idrecparent")}" = ?`)
                    .all(cid) as Record<string, unknown>[])
                : [];
              return {
                idrec: cid,
                des: (c[comp!.colSet.get("des") ?? "Des"] as string) ?? null,
                fields: describe(comp!.name, c),
                outlets: outs.map((o) => ({
                  idrec: String(o[outlet!.colSet.get("idrec") ?? "IDRec"] ?? ""),
                  fields: describe(outlet!.name, o),
                })),
              };
            }),
          };
        }),
      };
    },
  );

  /** The Excel-report extracts this database can run. */
  app.get("/entry/wellview/dbs/:db/reports-xl", { preHandler: WELLVIEW_GUARD }, async () => {
    return {
      reports: xlTemplates().filter((t) => !t.empty).map((t) => ({
        html: t.html, name: t.name, folder: t.folder, table: t.table, title: t.title,
        fields: t.fields.length, hasWorkbook: t.hasWorkbook,
        filtered: t.criteria.length > 0, filterUnread: t.filterUnread,
      })),
    };
  });

  /**
   * Run one Excel-report extract over the selected wells.
   *
   * Same rule as the multi-well reports: an explicit well list, and an empty
   * one returns nothing rather than the whole database.
   */
  app.get<{ Params: { db: string }; Querystring: { html?: string; wells?: string } }>(
    "/entry/wellview/dbs/:db/xl-extract",
    { preHandler: WELLVIEW_GUARD },
    async (req, reply) => {
      const d = need(reply, req.params.db);
      if (!d) return;
      const html = String(req.query.html ?? "");
      if (!html) return reply.code(400).send({ error: "html (template id) is required" });
      const tpl = xlTemplates().find((t) => t.html === html);
      if (!tpl) return reply.code(404).send({ error: `no Excel extract with html=${html}` });
      const wells = String(req.query.wells ?? "").split(",").map((w) => w.trim()).filter(Boolean);
      if (wells.length > 500) return reply.code(400).send({ error: "at most 500 wells at a time" });
      return resolveXlExtract(d.ro, tpl, wells);
    },
  );

  /** The saved Query Templates (§8.1), with the model's captions for prompting. */
  app.get("/entry/wellview/dbs/:db/queries", { preHandler: WELLVIEW_GUARD }, async () => {
    return {
      queries: queryTemplates().map((q) => ({
        ...q,
        criteria: q.criteria.map((c) => ({
          ...c,
          tableLabel: folderLabel(c.table, null),
          fieldLabel: columnLabel(c.table, c.field),
          /** A date field wants a date input, not a text box. */
          isDate: modelField(c.table, c.field)?.type === "datetime",
        })),
      })),
    };
  });

  /**
   * Run a query template and return the wells it finds.
   *
   * SEMANTICS, and a deliberate divergence from the desktop. Criteria on the
   * SAME table must hold on the SAME row — that is what makes a date range mean
   * one report inside the window rather than any two reports either side of it.
   * Across tables the well must satisfy every group (AND).
   *
   * The manual (§8.1) says WellView's own criteria builder degrades a cross-table
   * And into an Or, and tells the user to write Custom SQL to get a real And. But
   * these templates are plainly written expecting And — "Drilling Report Today"
   * means a drilling job AND a report filed today, and Or would return nearly
   * every well. Reproducing the quirk would be faithful to a limitation rather
   * than to the query, so the And is honoured and the divergence stated here.
   */
  app.post<{
    Params: { db: string };
    Body: { id?: string; criteria?: QueryCriterion[]; values?: Record<string, string> };
  }>(
    "/entry/wellview/dbs/:db/queries/run",
    { preHandler: WELLVIEW_GUARD },
    async (req, reply) => {
      const d = need(reply, req.params.db);
      if (!d) return;
      // A run may name a shipped template, name a SAVED one, or carry its
      // criteria inline — the last is what the builder previews with, before
      // anything is saved.
      let q: { id: string; name: string; criteria: QueryCriterion[] } | undefined;
      if (req.body?.criteria?.length) {
        q = { id: "(unsaved)", name: "Unsaved query", criteria: req.body.criteria };
      } else {
        q = queryTemplates().find((x) => x.id === req.body?.id);
        if (!q && prisma && req.body?.id) {
          const saved = await prisma.wellviewQuery.findUnique({ where: { id: req.body.id } });
          if (saved) {
            q = { id: saved.id, name: saved.name, criteria: JSON.parse(saved.criteria) as QueryCriterion[] };
          }
        }
      }
      if (!q) return reply.code(404).send({ error: `no query ${req.body?.id}` });
      const hdr = table(d, "wvWellHeader");
      if (!hdr) return reply.code(404).send({ error: "wvWellHeader missing" });

      const supplied = req.body?.values ?? {};
      const skipped: { criterion: string; reason: string }[] = [];
      /*
       * §8.1's And / Or, read as a sum of products.
       *
       * "Add a condition to every line in the list of criteria, except the
       * first one" — so a conjunction joins a criterion to the one BEFORE it.
       * An Or starts a new group; within a group the criteria are ANDed. A well
       * matches if ANY group matches, which is what "find wells that meet at
       * least one of the criteria" means.
       *
       * Grouping happens before anything is resolved, so a criterion that has
       * to be skipped removes itself from ITS group and cannot silently widen
       * another.
       */
      const groups: QueryCriterion[][] = [];
      q.criteria.forEach((c, i) => {
        if (i === 0 || c.conj !== "OR") {
          if (!groups.length) groups.push([]);
          groups[groups.length - 1].push(c);
        } else {
          groups.push([c]);
        }
      });

      /** table → the WHERE fragments that must hold on ONE of its rows. */
      let byTable = new Map<string, { preds: string[]; args: (string | number)[] }>();
      const groupWheres: string[] = [];
      const groupArgs: (string | number)[] = [];
      /**
       * How many criteria were actually applied.
       *
       * Counted as they go in, NOT from byTable at the end: closeGroup empties
       * that map, so reading its size after the loop reports nothing applied on
       * a query that ran perfectly well.
       */
      let applied = 0;

      const closeGroup = () => {
        if (!byTable.size) return;
        const parts: string[] = [];
        for (const [tname, e] of byTable) {
          parts.push(
            `EXISTS (SELECT 1 FROM "${tname}" x WHERE x.idwell = h.idwell AND ${e.preds.join(" AND ")})`);
          groupArgs.push(...e.args);
        }
        groupWheres.push(parts.length > 1 ? `(${parts.join(" AND ")})` : parts[0]);
        byTable = new Map();
      };

      let index = -1;
      groups.forEach((group) => {
      group.forEach((c) => {
        index++;
        const i = index;
        const label = `${c.table}.${c.field} ${c.op ?? ""}`.trim();
        const t = table(d, c.table);
        if (!t) { skipped.push({ criterion: label, reason: `table ${c.table} not in this database` }); return; }
        // colSet is keyed lowercase. The 29 shipped templates spell their
        // fields lowercase already; a criterion built in the app carries the
        // column's real name ("WVTyp"), so both have to resolve.
        const col = t.colSet.get(c.field.toLowerCase());
        if (!col) { skipped.push({ criterion: label, reason: `column ${c.field} not in ${t.name}` }); return; }
        if (!c.op) { skipped.push({ criterion: label, reason: "no operator in the template" }); return; }
        if (!t.hasIdwell) { skipped.push({ criterion: label, reason: `${t.name} is not per-well` }); return; }

        const entry = byTable.get(t.name) ?? { preds: [], args: [] };
        if (c.op === "IS NULL" || c.op === "IS NOT NULL") {
          entry.preds.push(`x."${col}" ${c.op}`);
        } else {
          const raw = c.prompts ? supplied[String(i)] : c.value;
          if (raw == null || raw === "") {
            skipped.push({ criterion: label, reason: "no value supplied" });
            return;
          }
          const isDate = modelField(c.table, c.field)?.type === "datetime";
          const value = isDate ? resolveDateValue(raw) : raw;
          if (isDate && value === null) {
            skipped.push({ criterion: label, reason: `could not read "${raw}" as a date` });
            return;
          }
          if (c.op === "LIKE" || c.op === "NOT LIKE") {
            // §3.3: a partial string matches partially.
            entry.preds.push(`x."${col}" ${c.op} ? COLLATE NOCASE`);
            entry.args.push(`%${value}%`);
          } else {
            entry.preds.push(`x."${col}" ${c.op} ?`);
            entry.args.push(value as string);
          }
        }
        byTable.set(t.name, entry);
        applied++;
      });
      closeGroup();
      });

      if (!groupWheres.length) {
        return { wells: [], skipped, ran: 0, note: "No criterion could be applied to this database." };
      }

      // Groups are ORed; each group's own criteria were ANDed inside closeGroup.
      const wheres = [groupWheres.length > 1 ? groupWheres.join(" OR ") : groupWheres[0]];
      const args: (string | number)[] = groupArgs;
      const nameCol = hdr.colSet.get("wellname") ?? "WellName";
      const rows = d.ro.prepare(
        `SELECT h.idwell AS idwell, h."${nameCol}" AS name FROM "${hdr.name}" h
         WHERE ${wheres.join(" AND ")} ORDER BY 2 LIMIT 1000`,
      ).all(...args) as { idwell: string; name: string | null }[];

      return {
        wells: rows.map((r) => ({ idwell: r.idwell, name: r.name ?? r.idwell })),
        skipped,
        ran: applied,
        /** How the criteria grouped: one entry per OR group (§8.1). */
        orGroups: groupWheres.length,
      };
    },
  );

/**
   * Custom SQL Queries (§8.1) — "users can also build their own searches using
   * a direct SQL query".
   *
   * The guide offers this because its own criteria builder degrades a
   * cross-table And into an Or and tells the user to write SQL to get a real
   * And. This app honours the And, so the escape hatch is not needed for that —
   * but a direct query is still the only way to express something the criteria
   * grid cannot, and the guide teaches it, so it is here.
   *
   * WHAT IT WILL NOT RUN, and why each guard is there rather than trusted to
   * the reader being sensible:
   *
   *   - Anything but a single SELECT (or a WITH that leads to one). The
   *     connection is the READ-ONLY handle, so a write would fail anyway, but
   *     failing early says why instead of surfacing a driver error.
   *   - More than one statement. `;` ends it; a trailing empty fragment is
   *     allowed so a pasted statement with a final semicolon still runs.
   *   - Anything that does not yield an `idwell` column: the result IS a well
   *     list, and a query returning something else has misunderstood the field
   *     rather than found nothing.
   *
   * Rows are capped and the wells resolved against the header, so an idwell
   * that matches no well is reported rather than shown as a blank row.
   */
  app.post<{ Params: { db: string }; Body: { sql?: string } }>(
    "/entry/wellview/dbs/:db/queries/sql",
    { preHandler: WELLVIEW_GUARD },
    async (req, reply) => {
      const d = need(reply, req.params.db);
      if (!d) return;
      const raw = String(req.body?.sql ?? "").trim();
      if (!raw) return reply.code(400).send({ error: "a SQL statement is required" });

      const statements = raw.split(";").map((x) => x.trim()).filter(Boolean);
      if (statements.length > 1) {
        return reply.code(400).send({ error: "only one statement at a time" });
      }
      const sql = statements[0];
      if (!/^\s*(select|with)\b/i.test(sql)) {
        return reply.code(400).send({ error: "only a SELECT can be run here" });
      }

      const hdr = table(d, "wvWellHeader");
      if (!hdr) return reply.code(404).send({ error: "wvWellHeader missing" });

      let rows: Record<string, unknown>[];
      try {
        rows = d.ro.prepare(`SELECT * FROM (${sql}) LIMIT ${SQL_ROW_CAP + 1}`)
          .all() as Record<string, unknown>[];
      } catch (e) {
        return reply.code(400).send({ error: e instanceof Error ? e.message : String(e) });
      }
      const truncated = rows.length > SQL_ROW_CAP;
      if (truncated) rows.length = SQL_ROW_CAP;

      const key = rows.length
        ? Object.keys(rows[0]).find((k) => k.toLowerCase() === "idwell")
        : "idwell";
      if (rows.length && !key) {
        return reply.code(400).send({
          error: "the statement must return an idwell column — the result is a list of wells",
          columns: Object.keys(rows[0]),
        });
      }

      const ids = [...new Set(rows.map((r) => String(r[key!] ?? "")).filter(Boolean))];
      const nameCol = hdr.colSet.get("wellname") ?? "WellName";
      const wells = ids.length
        ? (d.ro.prepare(
          `SELECT idwell, "${nameCol}" AS name FROM "${hdr.name}"
            WHERE idwell IN (${ids.map(() => "?").join(", ")}) ORDER BY 2`)
          .all(...ids) as { idwell: string; name: string | null }[])
          .map((r) => ({ idwell: r.idwell, name: r.name ?? r.idwell }))
        : [];
      // An id the header does not know is a real answer about the data, not a
      // row to quietly drop.
      const known = new Set(wells.map((w) => w.idwell));
      const unknown = ids.filter((i) => !known.has(i));

      return { wells, matched: ids.length, unknown, truncated, rows: rows.length };
    },
  );


// ── My Reports (§9.2) ──────────────────────────────────────────────────────

  /**
   * A report the user designed, in the shape the resolver already understands.
   *
   * WHAT THIS IS AND IS NOT. §9.2's editor is a page designer: blocks dragged
   * and sized on a fixed page, master templates, fonts, colours, margins. This
   * app renders a report as responsive HTML and leaves paper to the print view,
   * so those settings would have nothing to act on. What it DOES offer is the
   * part that decides what a report says — the anchor, the blocks, the subject
   * area of each, and the fields it prints, in order — and it runs them through
   * the SAME resolver as the 182 shipped templates, so a user's report gets the
   * same units, link captions, calculated fields and filters.
   */
  interface SavedReportDef {
    /** Subject area the report splits on (§9.2 "Set Anchor Properties"). */
    anchor?: string | null;
    blocks: { table: string; title?: string | null; fields: string[] }[];
  }

  /** Validate a definition against THIS database, naming what is wrong. */
  function checkReport(d: Db, def: SavedReportDef): string[] {
    const bad: string[] = [];
    if (!def.blocks?.length) bad.push("a report needs at least one block");
    for (const b of def.blocks ?? []) {
      const t = table(d, b.table);
      if (!t) { bad.push(`${b.table} is not a table in this database`); continue; }
      if (!b.fields?.length) { bad.push(`${b.table} has no fields selected`); continue; }
      for (const f of b.fields) {
        // A field may be a stored column OR one the calc engine computes, which
        // has no column at all — refusing those would reject exactly the fields
        // WellView is best known for printing.
        if (t.colSet.has(f.toLowerCase())) continue;
        if (calcFieldsFor(t.name).some((c) => c.field.toLowerCase() === f.toLowerCase())) continue;
        if (calcAggregatesFor(t.name).some((c) => c.field.toLowerCase() === f.toLowerCase())) continue;
        bad.push(`${b.table}.${f} is neither a column here nor a field this app can compute`);
      }
    }
    if (def.anchor && !table(d, def.anchor)) bad.push(`${def.anchor} is not a table in this database`);
    return bad;
  }

  app.get<{ Params: { db: string } }>(
    "/entry/wellview/dbs/:db/reports",
    { preHandler: WELLVIEW_GUARD },
    async (req) => {
      if (!prisma) return { reports: [], note: "saved reports need the application database" };
      const rows = await prisma.wellviewReport.findMany({
        where: { database: req.params.db },
        orderBy: [{ category: "asc" }, { name: "asc" }],
      });
      return {
        reports: rows.map((r) => ({
          id: r.id, name: r.name, category: r.category ?? "My Reports",
          definition: JSON.parse(r.definition) as SavedReportDef,
          createdBy: r.createdBy, updatedAt: r.updatedAt.toISOString(),
        })),
      };
    },
  );

  app.post<{
    Params: { db: string };
    Body: { id?: string; name?: string; category?: string; definition?: SavedReportDef };
  }>(
    "/entry/wellview/dbs/:db/reports",
    { preHandler: WELLVIEW_GUARD },
    async (req, reply) => {
      if (!prisma) return reply.code(503).send({ error: "saved reports need the application database" });
      const d = need(reply, req.params.db);
      if (!d) return;
      const name = (req.body?.name ?? "").trim();
      if (!name) return reply.code(400).send({ error: "a name is required" });
      const def = req.body?.definition;
      if (!def?.blocks) return reply.code(400).send({ error: "a definition with blocks is required" });

      // Checked against the database it is written for, at SAVE time, exactly as
      // a saved query is: a report that cannot resolve is worth refusing before
      // it is stored rather than after someone opens it.
      const bad = checkReport(d, def);
      if (bad.length) return reply.code(400).send({ error: bad[0], problems: bad });

      const data = {
        database: req.params.db,
        name,
        category: (req.body?.category ?? "").trim() || null,
        definition: JSON.stringify(def),
        createdBy: req.entryUser?.username ?? "unknown",
      };
      try {
        const saved = req.body?.id
          ? await prisma.wellviewReport.update({ where: { id: req.body.id }, data })
          : await prisma.wellviewReport.create({ data });
        return reply.code(req.body?.id ? 200 : 201).send({ id: saved.id, name: saved.name });
      } catch (e) {
        if (String((e as { code?: string }).code) === "P2002") {
          return reply.code(409).send({ error: `there is already a report called "${name}"` });
        }
        throw e;
      }
    },
  );

  app.delete<{ Params: { db: string; id: string } }>(
    "/entry/wellview/dbs/:db/reports/:id",
    { preHandler: WELLVIEW_GUARD },
    async (req, reply) => {
      if (!prisma) return reply.code(503).send({ error: "saved reports need the application database" });
      const found = await prisma.wellviewReport.findUnique({ where: { id: req.params.id } });
      if (!found) return reply.code(404).send({ error: "no such report" });
      await prisma.wellviewReport.delete({ where: { id: req.params.id } });
      return { deleted: req.params.id };
    },
  );

  /** Resolve a SAVED report against a well — the same path a shipped one takes. */
  app.get<{ Params: { db: string; id: string }; Querystring: { well?: string; anchor?: string } }>(
    "/entry/wellview/dbs/:db/reports/:id/data",
    { preHandler: WELLVIEW_GUARD },
    async (req, reply) => {
      if (!prisma) return reply.code(503).send({ error: "saved reports need the application database" });
      const d = need(reply, req.params.db);
      if (!d) return;
      const well = String(req.query.well ?? "");
      if (!well) return reply.code(400).send({ error: "well (idwell) is required" });
      const row = await prisma.wellviewReport.findUnique({ where: { id: req.params.id } });
      if (!row) return reply.code(404).send({ error: "no such report" });
      const def = JSON.parse(row.definition) as SavedReportDef;

      let anchor: { table: string; idrec: string } | null = null;
      if (req.query.anchor) {
        const ix = req.query.anchor.indexOf(":");
        if (ix > 0) anchor = { table: req.query.anchor.slice(0, ix), idrec: req.query.anchor.slice(ix + 1) };
      }
      const resolved = resolveTemplateData(d.ro, {
        name: row.name,
        html: `saved:${row.id}`,
        blocks: def.blocks.map((b) => ({
          table: b.table,
          title: b.title ?? null,
          fields: b.fields.map((f) => ({ column: f })),
        })),
        // A user's report carries no decoded .afr filters; its scoping is the
        // anchor, which the viewer already drives.
        filters: [],
      }, well, anchor);
      if (!resolved) return reply.code(500).send({ error: "the report could not be resolved" });
      return { ...resolved, saved: { id: row.id, name: row.name, anchor: def.anchor ?? null } };
    },
  );


  /** §10.2 Data Audit across selected wells (or all). */
  app.get<{ Params: { db: string }; Querystring: { wells?: string } }>(
    "/entry/wellview/dbs/:db/audit",
    { preHandler: WELLVIEW_GUARD },
    async (req, reply) => {
      const d = need(reply, req.params.db);
      if (!d) return;
      const hdr = table(d, "wvWellHeader");
      if (!hdr) return reply.code(404).send({ error: "wvWellHeader missing" });
      const wellIds = (req.query.wells ?? "").split(",").map((s) => s.trim()).filter(Boolean);
      const findings: {
        ruleId: string; report: string; rule: string; table: string;
        idwell: string; well: string | null; idrec: string | null; detail: Record<string, string | number | null>;
      }[] = [];
      const skipped: { ruleId: string; reason: string }[] = [];
      for (const r of AUDIT_RULES) {
        const t = table(d, r.table);
        if (!t) { skipped.push({ ruleId: r.id, reason: `table ${r.table} absent` }); continue; }
        const missing = r.needs.filter((c) => !t.colSet.has(c));
        if (missing.length) { skipped.push({ ruleId: r.id, reason: `columns absent: ${missing.join(", ")}` }); continue; }
        const detailCols = r.detail.map((c) => t.colSet.get(c.toLowerCase())).filter((c): c is string => !!c);
        const idrecSel = t.colSet.has("idrec") ? `t."${t.colSet.get("idrec")}"` : "NULL";
        const scope = wellIds.length ? ` AND t.idwell IN (${wellIds.map(() => "?").join(",")})` : "";
        try {
          const rows = d.ro.prepare(
            `SELECT t.idwell AS _idwell, ${idrecSel} AS _idrec, h."${hdr.colSet.get("wellname")}" AS _well` +
            (detailCols.length ? ", " + detailCols.map((c) => `t."${c}"`).join(", ") : "") +
            ` FROM "${t.name}" t LEFT JOIN "${hdr.name}" h ON h.idwell = t.idwell WHERE (${r.where})${scope} LIMIT 200`,
          ).all(...wellIds) as Record<string, unknown>[];
          for (const row of rows) {
            const detail: Record<string, string | number | null> = {};
            for (const c of detailCols) detail[c] = shapeValue(row[c]);
            findings.push({
              ruleId: r.id, report: r.report, rule: r.rule, table: t.name,
              idwell: String(row._idwell), well: (row._well as string) ?? null,
              idrec: row._idrec == null ? null : String(row._idrec), detail,
            });
          }
        } catch (e) {
          skipped.push({ ruleId: r.id, reason: e instanceof Error ? e.message : String(e) });
        }
      }
      // The detail values are raw column values in base units. Say which unit
      // each one is, so the auditor reads in the same units as every other
      // screen rather than quietly showing metres to someone working in feet.
      const units: Record<string, { unit?: string; units?: Record<string, unknown> }> = {};
      for (const f of findings) {
        for (const col of Object.keys(f.detail)) {
          const key = `${f.table}.${col}`;
          if (key in units) continue;
          const mf = modelField(f.table, col);
          if (mf?.baseUnit) units[key] = { unit: mf.baseUnit, units: mf.units };
        }
      }
      return { findings, skipped, units, rulesRun: AUDIT_RULES.length - skipped.length };
    },
  );

  /** Everything the schematic view draws, in one honest payload. */
  app.get<{ Params: { db: string }; Querystring: { idwell?: string } }>(
    "/entry/wellview/dbs/:db/schematic",
    { preHandler: WELLVIEW_GUARD },
    async (req, reply) => {
      const d = need(reply, req.params.db);
      if (!d) return;
      const idwell = req.query.idwell ?? "";
      if (!idwell) return reply.code(400).send({ error: "idwell is required" });
      const casOd = maxOdByParent(d, "wvCasComp", idwell);
      const tubOd = maxOdByParent(d, "wvTubComp", idwell);
      const withOd = (rows: Record<string, unknown>[], od: Map<string, number>) =>
        rows.map((r) => ({ ...r, maxOd: od.get(String(r.IDRec)) ?? null }));
      const bores = stringRows(d, "wvWellbore", idwell, ["KickOffDepth", "IDRecParent", "ProfileTyp"]);
      const sizes = stringRows(d, "wvWellboreSize", idwell, ["DepthTopActual", "DepthBtmActual", "Sz", "DtTmStart", "DtTmEnd", "IDRecParent"]);
      const dates = new Set<string>();
      const collect = (rows: Record<string, unknown>[], keys: string[]) => {
        for (const r of rows) for (const k of keys) {
          const v = r[k];
          if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) dates.add(v.slice(0, 10));
        }
      };
      const casings = withOd(stringRows(d, "wvCas", idwell), casOd);
      const tubings = withOd(stringRows(d, "wvTub", idwell), tubOd);
      const rods = stringRows(d, "wvRod", idwell);
      const other = stringRows(d, "wvOtherInHole", idwell, ["SzODMax", "IconName"]);
      const perfs = stringRows(d, "wvPerforation", idwell, ["DepthTop", "DtTm", "Proposed", "Typ"]);
      const cement = stringRows(d, "wvCement", idwell, ["IDRecString", "DtTmStart", "Proposed"]);
      /*
       * Cement STAGES, which are where the depths live (§7.2 "Cement
       * Information Not Visible — in the Cement Stages folder, make sure that
       * the Top Depth and Bottom Depth information is entered").
       *
       * wvCement itself carries no depth column at all, so a schematic drawn
       * from it can only show a token strip of a fixed height — which is what
       * this did, hanging 60 px above each shoe regardless of what was pumped.
       * Every one of the sample's 115 stages has both depths.
       *
       * DepthDrillOut and DtTmDrillOut come too: §7.2's "Cement Plug Still
       * Visible" says a plug drilled out should stop being drawn below that
       * depth, which the renderer cannot honour without being told.
       */
      const cementStages = (() => {
        const st = table(d, "wvCementStage");
        const cem = table(d, "wvCement");
        if (!st || !cem) return [];
        const col = (t: NonNullable<ReturnType<typeof table>>, c: string) => t.colSet.get(c.toLowerCase());
        const want: [string, string][] = [
          ["IDRec", "idrec"], ["IDRecParent", "idrecparent"], ["Des", "des"],
          ["DepthTop", "depthtop"], ["DepthBtm", "depthbtm"],
          ["DepthDrillOut", "depthdrillout"], ["DtTmDrillOut", "dttmdrillout"],
          ["DepthTagged", "depthtagged"], ["BtmPlug", "btmplug"],
        ];
        const sel = want.map(([alias, c]) => {
          const actual = col(st, c);
          return actual ? `s."${actual}" AS "${alias}"` : `NULL AS "${alias}"`;
        });
        const cs = col(cem, "idrecstring"), cd = col(cem, "dttmstart"), cp = col(cem, "proposed");
        sel.push(cs ? `c."${cs}" AS "IDRecString"` : `NULL AS "IDRecString"`);
        sel.push(cd ? `c."${cd}" AS "DtTmStart"` : `NULL AS "DtTmStart"`);
        sel.push(cp ? `c."${cp}" AS "Proposed"` : `NULL AS "Proposed"`);
        try {
          return (d.ro.prepare(
            `SELECT ${sel.join(", ")} FROM "${st.name}" s
             JOIN "${cem.name}" c ON c."${col(cem, "idrec")}" = s."${col(st, "idrecparent")}"
                                 AND c.idwell = s.idwell
             WHERE s.idwell = ?`).all(idwell) as Record<string, unknown>[])
            .map((r) => {
              const out: Record<string, unknown> = {};
              for (const [k, v] of Object.entries(r)) out[k] = shapeValue(v);
              return out;
            });
        } catch {
          return [];
        }
      })();
      const zones = stringRows(d, "wvZone", idwell, ["DepthTop", "ZoneName"]);

      /*
       * The drill string in the hole, and its bit (§7.2 "Drilling OD Not
       * Visible", "Bit Not Visible").
       *
       * wvJobDrillString has NO depth column of its own — the string's position
       * comes from the drilling parameters recorded against it, exactly as the
       * days-vs-depth curve does. So the depth range is MIN(DepthStart) to
       * MAX(DepthEnd) over its params, and a string with no params is not drawn
       * rather than drawn at zero.
       *
       * The width is the largest component OD (SzODNom, falling back to
       * SzODMax): 1,579 of the sample's 1,581 components carry one, which is
       * what the guide's "enter the OD for each applicable record" is about.
       */
      const drillStrings = (() => {
        const ds = table(d, "wvJobDrillString");
        const dp = table(d, "wvJobDrillStringDrillParam");
        if (!ds || !dp) return [];
        const dsIdRec = ds.colSet.get("idrec");
        const dpParent = dp.colSet.get("idrecparent");
        const dStart = dp.colSet.get("depthstart"), dEnd = dp.colSet.get("depthend");
        if (!dsIdRec || !dpParent || !dEnd) return [];
        const od = maxOdByParent(d, "wvJobDrillStringComp", idwell);
        /*
         * The bit is keyed BY ITS OWN IDRec and reached through the string's
         * IDRecBit — not by IDRecParent, which points at the JOB.
         *
         * That follows from WellView's own linkage rule: a child's parent is
         * the longest table-name PREFIX that exists, and "wvJobDrillString" is
         * not a prefix of "wvJobDrillBit" — "wvJob" is. Reading it as a child
         * of the string finds nothing at all (0 of 169), which is exactly what
         * a first attempt here did.
         */
        const bitT = table(d, "wvJobDrillBit");
        const bitBy = new Map<string, Record<string, unknown>>();
        if (bitT) {
          for (const b of d.ro.prepare(
            `SELECT * FROM "${bitT.name}" WHERE idwell = ?`).all(idwell) as Record<string, unknown>[]) {
            bitBy.set(String(b[bitT.colSet.get("idrec") ?? "IDRec"] ?? ""), b);
          }
        }
        const pick = (r: Record<string, unknown>, t: NonNullable<ReturnType<typeof table>>, c: string) => {
          const a = t.colSet.get(c.toLowerCase());
          return a ? shapeValue(r[a]) : null;
        };
        try {
          const rows = d.ro.prepare(`SELECT * FROM "${ds.name}" WHERE idwell = ?`)
            .all(idwell) as Record<string, unknown>[];
          const out: Record<string, unknown>[] = [];
          for (const r of rows) {
            const id = String(r[dsIdRec] ?? "");
            const span = d.ro.prepare(
              `SELECT MIN(${dStart ? `"${dStart}"` : `"${dEnd}"`}) AS top, MAX("${dEnd}") AS btm,
                      MIN(DtTmStart) AS t0, MAX(DtTmEnd) AS t1
                 FROM "${dp.name}" WHERE idwell = ? AND "${dpParent}" = ?`)
              .get(idwell, id) as { top: number | null; btm: number | null; t0: string | null; t1: string | null };
            if (span?.btm == null) continue;             // no params: not in the hole
            const bit = bitBy.get(String(pick(r, ds, "idrecbit") ?? ""));
            out.push({
              IDRec: id,
              Des: pick(r, ds, "des") ?? pick(r, ds, "stringno"),
              DepthTop: span.top,
              DepthBtm: span.btm,
              DtTmRun: span.t0,
              DtTmPull: span.t1,
              maxOd: od.get(id) ?? null,
              Proposed: pick(r, ds, "proposed"),
              // wvJobDrillString carries NO wellbore column, so the wellbore
              // filter cannot narrow drill strings; the client shows them for
              // every bore rather than pretending to a link that is not there.
              bit: bit && bitT ? {
                IDRec: pick(bit, bitT, "idrec"),
                Des: [pick(bit, bitT, "make"), pick(bit, bitT, "model")].filter(Boolean).join(" ") || null,
                Sz: pick(bit, bitT, "szoddrill"),
                Length: pick(bit, bitT, "length"),
                IconName: pick(bit, bitT, "iconname"),
                Typ: pick(bit, bitT, "typ"),
              } : null,
            });
          }
          return out;
        } catch {
          return [];
        }
      })();

      /*
       * The deviation survey each wellbore is LINKED to (§7.2 "Deviation Survey
       * Not Visible — the deviation survey is not linked to the wellbore").
       *
       * 41 of the sample's 44 wellbores carry IDRecDirSrvyActual. The schematic
       * cannot draw a well path from it — this is a vertical depth diagram, not
       * a plan view — but it CAN say which survey applies and offer its TVD, so
       * a depth track reads true depth instead of measured depth, and so a
       * wellbore with no survey linked says so instead of looking complete.
       */
      const surveyLinks = (() => {
        const wb = table(d, "wvWellbore");
        const link = wb?.colSet.get("idrecdirsrvyactual");
        if (!wb || !link) return [];
        const srv = table(d, "wvWellboreDirSurvey");
        const names = new Map<string, string>();
        if (srv) {
          for (const r of d.ro.prepare(`SELECT * FROM "${srv.name}" WHERE idwell = ?`)
            .all(idwell) as Record<string, unknown>[]) {
            names.set(String(r[srv.colSet.get("idrec") ?? "IDRec"] ?? ""),
              String(r[srv.colSet.get("des") ?? "Des"] ?? "") || "survey");
          }
        }
        return (d.ro.prepare(
          `SELECT "${wb.colSet.get("idrec")}" AS idrec, "${link}" AS srv FROM "${wb.name}" WHERE idwell = ?`)
          .all(idwell) as Record<string, unknown>[])
          .map((r) => ({
            wellbore: String(r.idrec ?? ""),
            survey: r.srv ? String(r.srv) : null,
            surveyName: r.srv ? names.get(String(r.srv)) ?? null : null,
          }));
      })();
      for (const set of [casings, tubings, rods, other]) collect(set, ["DtTmRun", "DtTmPull"]);
      collect(perfs, ["DtTm"]);
      collect(cement, ["DtTmStart"]);
      collect(cementStages, ["DtTmStart", "DtTmDrillOut"]);
      collect(drillStrings, ["DtTmRun", "DtTmPull"]);
      collect(sizes, ["DtTmStart", "DtTmEnd"]);
      // Every depth on the diagram — the axis, the shoe labels, the tooltips —
      // is one measured depth in the model's base unit, so one spec converts
      // the whole drawing. It is read from a real depth field rather than
      // assumed, so a model that ever changed its base unit would follow.
      const depthField = modelField("wvCas", "mdbtm") ?? modelField("wvPerforation", "depthtop");
      // Hole and pipe sizes are a length too, but a different one: stored in
      // metres and read in inches, as a fraction.
      const sizeField = modelField("wvWellboreSize", "sz") ?? modelField("wvCasComp", "szodnom");
      return {
        wellbores: bores, sizes, casings, tubings, rods, otherInHole: other,
        perforations: perfs, cement, cementStages, zones,
        drillStrings, surveyLinks,
        dates: [...dates].sort(),
        // `applyDatum` is part of the spec, not decoration: `toDisplay` shifts
        // nothing without it, so a schematic sent without it silently draws
        // Original-KB depths while the report beside it is re-referenced.
        depth: { unit: depthField?.baseUnit, units: depthField?.units,
          applyDatum: depthField?.applyDatum, datumMode: depthField?.datumMode },
        size: { unit: sizeField?.baseUnit, units: sizeField?.units },
      };
    },
  );

  /**
   * A report template resolved against THIS database for one well (§3.8).
   * `anchor=<table>:<idrec>` scopes it the way the desktop report toolbar's
   * subject-area list boxes do — pick a Job, then a Daily Operation report.
   */
  app.get<{ Params: { db: string }; Querystring: { html?: string; well?: string; anchor?: string } }>(
    "/entry/wellview/dbs/:db/template-data",
    { preHandler: WELLVIEW_GUARD },
    async (req, reply) => {
      const d = need(reply, req.params.db);
      if (!d) return;
      const html = String(req.query.html ?? "");
      const well = String(req.query.well ?? "");
      if (!html) return reply.code(400).send({ error: "html (template id) is required" });
      if (!well) return reply.code(400).send({ error: "well (idwell) is required" });
      let anchor: { table: string; idrec: string } | null = null;
      if (req.query.anchor) {
        const ix = req.query.anchor.indexOf(":");
        if (ix > 0) anchor = { table: req.query.anchor.slice(0, ix), idrec: req.query.anchor.slice(ix + 1) };
      }
      const resolved = resolveTemplateData(d.ro, html, well, anchor);
      if (!resolved) return reply.code(404).send({ error: `no template with html=${html}` });
      return resolved;
    },
  );
}
