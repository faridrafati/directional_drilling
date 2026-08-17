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
import { requireUser } from "../entry/auth.js";
import { resolveTemplateData } from "./wellviewSample.js";
import { columnLabel, folderLabel, modelField, modelTable, renderRecordDes } from "../wellview/model.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..", "..", "..");
const DB_DIR = join(REPO, "sqlite_DB", "wellview");

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

  const rel = s.match(/^<(today|now)>\s*([+-]\s*[\d.]+)?$/i);
  if (rel) {
    const base = new Date(now);
    if (rel[1].toLowerCase() === "today") base.setUTCHours(0, 0, 0, 0);
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

/** The column to order a folder's records by — dates first, then sequence/depth. */
function orderColumn(t: TableInfo): string | null {
  for (const k of ["dttm", "dttmstart", "dttmspud", "dttmrun", "sysseq", "seqno", "depthtop", "depth", "md"]) {
    const c = t.colSet.get(k);
    if (c) return c;
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

export async function registerWellviewDbRoutes(app: FastifyInstance): Promise<void> {
  /** The Open Database window. */
  app.get("/entry/wellview/dbs", { preHandler: requireUser }, async () => {
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
    { preHandler: requireUser },
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
    { preHandler: requireUser },
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
      if (lookin && req.query.lookfor) {
        where = `WHERE "${lookin}" LIKE ?`;
        args.push(`%${req.query.lookfor}%`);
      }
      const rows = d.ro.prepare(`SELECT ${sel} FROM "${t.name}" ${where} ORDER BY "${t.colSet.get("wellname")}"`)
        .all(...args) as Record<string, unknown>[];
      return {
        columns: wanted.map((c) => ({ column: c, label: columnLabel(t.name, c) })),
        wells: rows.map((r) => {
          const out: Record<string, string | number | null> = {};
          for (const [k, v] of Object.entries(r)) out[k] = shapeValue(v);
          return out;
        }),
      };
    },
  );

  /** The Edit Data subject-area tree, with per-well record counts. */
  app.get<{ Params: { db: string }; Querystring: { idwell?: string } }>(
    "/entry/wellview/dbs/:db/tree",
    { preHandler: requireUser },
    async (req, reply) => {
      const d = need(reply, req.params.db);
      if (!d) return;
      return { tree: buildTree(d, req.query.idwell || null) };
    },
  );

  /** Records of one folder, scoped to a well and (for subfolders) a parent record. */
  app.get<{ Params: { db: string; table: string }; Querystring: { idwell?: string; parent?: string; system?: string } }>(
    "/entry/wellview/dbs/:db/records/:table",
    { preHandler: requireUser },
    async (req, reply) => {
      const d = need(reply, req.params.db);
      if (!d) return;
      const t = table(d, req.params.table);
      if (!t) return reply.code(404).send({ error: `no table ${req.params.table}` });
      const showSys = req.query.system === "1";
      const cols = t.cols.filter((c) => showSys || !isSysCol(c));
      const where: string[] = [];
      const args: string[] = [];
      if (req.query.idwell && t.hasIdwell) { where.push(`"${t.colSet.get("idwell")}" = ?`); args.push(req.query.idwell); }
      if (req.query.parent && t.hasParent) { where.push(`"${t.colSet.get("idrecparent")}" = ?`); args.push(req.query.parent); }
      const ord = orderColumn(t);
      const rows = d.ro.prepare(
        `SELECT ${cols.map((c) => `"${c}"`).join(", ")} FROM "${t.name}"` +
        (where.length ? ` WHERE ${where.join(" AND ")}` : "") +
        (ord ? ` ORDER BY "${ord}"` : "") +
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
            /** The form section this field sits in, per WellView's own model. */
            group: mf?.group,
            /** Chevron's Data Entry Audit rules — the desktop's yellow fields. */
            required: mf?.required,
            /** Required global metric — the desktop's cyan fields. */
            globalMetric: mf?.globalMetric,
            /** The model binds this field to a Library list (§3.9 Lookup List
             *  Library). The list itself is not readable — the .lib files are
             *  encrypted — so the client offers values in use and says so. */
            library: mf?.lookupTyp === "library" && mf.libTable
              ? { table: mf.libTable, field: mf.libField ?? null }
              : undefined,
            warnOnly: mf?.warnOnly,
            link,
          };
        }),
        rows: rows.map((r) => {
          const out: Record<string, string | number | null> = {};
          for (const [k, v] of Object.entries(r)) out[k] = shapeValue(v);
          return out;
        }),
      };
    },
  );

  /** Add a record (§3.9 "Add a New Record"): IDRec generated, links filled in. */
  app.post<{ Params: { db: string; table: string }; Body: { idwell?: string; parent?: string; values?: Record<string, unknown> } }>(
    "/entry/wellview/dbs/:db/records/:table",
    { preHandler: requireUser },
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
    { preHandler: requireUser },
    async (req, reply) => {
      const d = need(reply, req.params.db);
      if (!d) return;
      const t = table(d, req.params.table);
      if (!t) return reply.code(404).send({ error: `no table ${req.params.table}` });
      const keyCol = t.colSet.get("idrec") ?? (t.name.toLowerCase() === "wvwellheader" ? t.colSet.get("idwell") : null);
      if (!keyCol) return reply.code(400).send({ error: `${t.name} has no record key` });
      const sets: string[] = [];
      const args: (string | number | null)[] = [];
      for (const [k, v] of Object.entries(req.body?.values ?? {})) {
        const actual = t.colSet.get(k.toLowerCase());
        if (!actual || isSysCol(actual) || (isKeyCol(actual) && !isSelfParentLink(t, actual))) continue;
        if (modelField(t.name, actual)?.calculated) continue;   // green = not editable
        sets.push(`"${actual}" = ?`);
        args.push((v === "" ? null : v) as string | number | null);
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

  /** Delete a record and, per the manual, everything in its subfolders. */
  app.delete<{ Params: { db: string; table: string; idrec: string } }>(
    "/entry/wellview/dbs/:db/records/:table/:idrec",
    { preHandler: requireUser },
    async (req, reply) => {
      const d = need(reply, req.params.db);
      if (!d) return;
      const t = table(d, req.params.table);
      if (!t) return reply.code(404).send({ error: `no table ${req.params.table}` });
      if (!t.colSet.has("idrec")) return reply.code(400).send({ error: `${t.name} rows have no IDRec` });
      return { removed: deleteRecord(d, t, req.params.idrec) };
    },
  );

  /**
   * Candidate records for a link column's target table, with readable captions
   * — what the manual's associated-data lookup shows instead of GUIDs.
   */
  app.get<{ Params: { db: string }; Querystring: { table?: string; idwell?: string } }>(
    "/entry/wellview/dbs/:db/link-candidates",
    { preHandler: requireUser },
    async (req, reply) => {
      const d = need(reply, req.params.db);
      if (!d) return;
      const t = table(d, String(req.query.table ?? ""));
      if (!t) return reply.code(404).send({ error: `no table ${req.query.table}` });
      const idCol = t.colSet.get("idrec");
      if (!idCol) return reply.code(400).send({ error: `${t.name} rows have no IDRec` });
      const where = req.query.idwell && t.hasIdwell ? "WHERE idwell = ?" : "";
      const args = where ? [String(req.query.idwell)] : [];
      const ord = orderColumn(t);
      const rows = d.ro.prepare(
        `SELECT * FROM "${t.name}" ${where}${ord ? ` ORDER BY "${ord}"` : ""} LIMIT 300`,
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
    { preHandler: requireUser },
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
    { preHandler: requireUser },
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
    { preHandler: requireUser },
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
    { preHandler: requireUser },
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

  /** The saved Query Templates (§8.1), with the model's captions for prompting. */
  app.get("/entry/wellview/dbs/:db/queries", { preHandler: requireUser }, async () => {
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
    Body: { id?: string; values?: Record<string, string> };
  }>(
    "/entry/wellview/dbs/:db/queries/run",
    { preHandler: requireUser },
    async (req, reply) => {
      const d = need(reply, req.params.db);
      if (!d) return;
      const q = queryTemplates().find((x) => x.id === req.body?.id);
      if (!q) return reply.code(404).send({ error: `no query ${req.body?.id}` });
      const hdr = table(d, "wvWellHeader");
      if (!hdr) return reply.code(404).send({ error: "wvWellHeader missing" });

      const supplied = req.body?.values ?? {};
      const skipped: { criterion: string; reason: string }[] = [];
      /** table → the WHERE fragments that must hold on ONE of its rows. */
      const byTable = new Map<string, { preds: string[]; args: (string | number)[] }>();

      q.criteria.forEach((c, i) => {
        const label = `${c.table}.${c.field} ${c.op ?? ""}`.trim();
        const t = table(d, c.table);
        if (!t) { skipped.push({ criterion: label, reason: `table ${c.table} not in this database` }); return; }
        const col = t.colSet.get(c.field);
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
      });

      if (byTable.size === 0) {
        return { wells: [], skipped, ran: 0, note: "No criterion could be applied to this database." };
      }

      const wheres: string[] = [];
      const args: (string | number)[] = [];
      for (const [tname, e] of byTable) {
        wheres.push(
          `EXISTS (SELECT 1 FROM "${tname}" x WHERE x.idwell = h.idwell AND ${e.preds.join(" AND ")})`);
        args.push(...e.args);
      }
      const nameCol = hdr.colSet.get("wellname") ?? "WellName";
      const rows = d.ro.prepare(
        `SELECT h.idwell AS idwell, h."${nameCol}" AS name FROM "${hdr.name}" h
         WHERE ${wheres.join(" AND ")} ORDER BY 2 LIMIT 1000`,
      ).all(...args) as { idwell: string; name: string | null }[];

      return {
        wells: rows.map((r) => ({ idwell: r.idwell, name: r.name ?? r.idwell })),
        skipped,
        ran: byTable.size,
      };
    },
  );

  /** §10.2 Data Audit across selected wells (or all). */
  app.get<{ Params: { db: string }; Querystring: { wells?: string } }>(
    "/entry/wellview/dbs/:db/audit",
    { preHandler: requireUser },
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
      return { findings, skipped, rulesRun: AUDIT_RULES.length - skipped.length };
    },
  );

  /** Everything the schematic view draws, in one honest payload. */
  app.get<{ Params: { db: string }; Querystring: { idwell?: string } }>(
    "/entry/wellview/dbs/:db/schematic",
    { preHandler: requireUser },
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
      const zones = stringRows(d, "wvZone", idwell, ["DepthTop", "ZoneName"]);
      for (const set of [casings, tubings, rods, other]) collect(set, ["DtTmRun", "DtTmPull"]);
      collect(perfs, ["DtTm"]);
      collect(cement, ["DtTmStart"]);
      collect(sizes, ["DtTmStart", "DtTmEnd"]);
      return {
        wellbores: bores, sizes, casings, tubings, rods, otherInHole: other,
        perforations: perfs, cement, zones,
        dates: [...dates].sort(),
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
    { preHandler: requireUser },
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
