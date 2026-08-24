/**
 * WellView sample database, resolved against the parsed report templates.
 *
 * The Templates tab shows the 181 original Peloton layouts read out of their
 * binary .afr files — until now as EMPTY layouts, because the .afr carries
 * structure, not data. This module supplies the data: the user's
 * `wv9.0 Sample.mdb` (converted to SQLite by scripts/wellview-db/) holds the
 * very wells those templates were built to print, and each parsed template
 * block already names its table and columns (`wvjob.dttmspud`, …). So a
 * template + a well id resolves to real rows, block by block.
 *
 * HONESTY RULES, same as everywhere else in this app:
 *  - A block whose table ends in `calc` is COMPUTED BY WELLVIEW AT PRINT TIME
 *    and is not stored in any database — reported as such, never faked.
 *  - A column the template names but the table lacks is listed as missing,
 *    not silently dropped.
 *  - Rows are capped, and the cap is reported next to the true count.
 *
 * READ-ONLY: the sample DB is opened readOnly; nothing here writes anything.
 *
 * Icons: rows of component tables (drillstring / casing / tubing / rods /
 * wellhead) are decorated with the matching WellView schematic icon when the
 * component description can be matched confidently — exact normalised name
 * first, then a small alias map for rig shorthand (D.C., STAB, H.W.D.P. …),
 * then a whole-word containment match. No confident match, no icon.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import type { FastifyInstance } from "fastify";
import { requireUser } from "../entry/auth.js";
import { columnLabel, modelField, modelTable, orderByFor, renderRecordDes } from "../wellview/model.js";
import { classifyOmitted, omittedSummary } from "../wellview/omitted.js";
import { computeCalc, calcMissingScope } from "../wellview/calc.js";
import {
  calcFieldsFor, computeRow, calcAggregatesFor, sumChildrenDetailed, calcLatestFor, latestChildren,
  calcNamedFor, namedChildren, calcOverAggregatesFor, overAggregates,
  calcLookupsFor, linkedValues,
} from "../wellview/calcFields.js";
import { timeLogClock, type TimeLogClockRow } from "../wellview/timeLogClock.js";
import { stackFieldsFor, stackRows, type StackRow } from "../wellview/stringStack.js";
// Importing the registry is what registers it; nothing else references the module.
import "../wellview/calcDerivations.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..", "..", "..");

const DB_CANDIDATES = [
  process.env.WELLVIEW_SAMPLE_DB,
  join(REPO, "sqlite_DB", "wellview", "wv9.0_Sample.sqlite"),
].filter((p): p is string => !!p);

const REPORTS_JSON = join(REPO, "apps", "web", "public", "wellview-templates", "reports.json");
const ICONS_MANIFEST = join(REPO, "apps", "web", "public", "wellview-icons", "manifest.json");

const ROW_CAP = 200;

// ── lazy singletons ───────────────────────────────────────────────────────────
let _db: DatabaseSync | null | undefined;
function db(): DatabaseSync | null {
  if (_db !== undefined) return _db;
  const path = DB_CANDIDATES.find((p) => existsSync(p));
  _db = path ? new DatabaseSync(path, { readOnly: true }) : null;
  // Wait out a concurrent writer instead of surfacing SQLITE_BUSY as a 500.
  _db?.exec("PRAGMA busy_timeout = 3000");
  return _db;
}
export const sampleDbPath = (): string | null =>
  DB_CANDIDATES.find((p) => existsSync(p)) ?? null;

interface TemplateField { column: string; label_interpreted?: string | null }
interface TemplateBlock { table: string | null; title: string | null; fields: TemplateField[] }
/** A row filter the template declares: table, field, value. */
export interface TemplateFilter {
  table: string; field: string; value: string;
  /** The model's caption for the field — "Job Type", not "wvtyp". */
  label?: string;
}
export interface Template {
  name: string; html: string; blocks: TemplateBlock[];
  /** The filters WellView applies before printing; see `readFilters`. */
  filters: TemplateFilter[];
}

/**
 * The template's row filters, taken from the shipped .afr and NOT from guesswork.
 *
 * The exporter writes `filters` as a list of string tuples, and its own code
 * distinguishes them by length: three or more elements is a filter, exactly two
 * is a record LINK declaration (afr_export.py splits them that way). Of the 93
 * three-element entries in the corpus, 73 are real — every one
 * `wvjob.wvtyp = <job type>` — and the other 20 carry a TABLE name where the
 * field should be, which is the decoder failing on those templates rather than a
 * filter on a column called "wvfluidanalysis". They are dropped here, by asking
 * the model whether the named field is really a field of the named table, so a
 * mis-parse can never become a WHERE clause.
 */
function readFilters(raw: unknown): TemplateFilter[] {
  if (!Array.isArray(raw)) return [];
  const out: TemplateFilter[] = [];
  for (const f of raw) {
    if (!Array.isArray(f) || f.length < 3) continue;
    const [table, field, value] = f.map((x) => String(x ?? ""));
    if (!table || !field || !value) continue;
    if (!modelField(table, field)) continue;
    out.push({
      table: table.toLowerCase(), field: field.toLowerCase(), value,
      label: modelTable(table) ? columnLabel(table, field) : undefined,
    });
  }
  return out;
}

let _templates: Map<string, Template> | null = null;
function templates(): Map<string, Template> {
  if (_templates) return _templates;
  const raw = JSON.parse(readFileSync(REPORTS_JSON, "utf-8"));
  _templates = new Map(
    (raw.reports as (Template & { filters?: unknown })[]).map((r) =>
      [r.html, { name: r.name, html: r.html, blocks: r.blocks, filters: readFilters(r.filters) }]),
  );
  return _templates;
}

/**
 * The IDRecParent hops from `fromLc` up to ancestor `toLc`, or null.
 *
 * WellView's child→parent link is by table-name PREFIX, so a walk is a sequence
 * of longest-prefix steps. Returns null rather than a partial chain when any hop
 * lacks the columns to make the join — a half-built join would silently widen
 * the result instead of narrowing it.
 */
function chainUp(
  sch: Map<string, { name: string; cols: Map<string, string> }>,
  fromLc: string,
  toLc: string,
): { name: string; idrec: string; parentCol: string }[] | null {
  const hops: { name: string; idrec: string; parentCol: string }[] = [];
  let cur = fromLc;
  while (cur !== toLc) {
    const ct = sch.get(cur);
    const parentLc = prefixParent(sch, cur);
    const parentT = parentLc ? sch.get(parentLc) : null;
    const parentCol = ct?.cols.get("idrecparent");
    const idrec = parentT?.cols.get("idrec");
    if (!ct || !parentT || !parentCol || !idrec) return null;
    hops.push({ name: parentT.name, idrec, parentCol });
    cur = parentLc!;
  }
  return hops.length ? hops : null;
}

/** Actual table name (mixed case) by lowercase lookup, with its column set.
 *  Cached per database handle: this module resolves templates against the
 *  sample database AND any database the WellView-online explorer opens. */
const _schemaByDb = new WeakMap<DatabaseSync, Map<string, { name: string; cols: Map<string, string> }>>();
function schema(d: DatabaseSync) {
  const hit = _schemaByDb.get(d);
  if (hit) return hit;
  const out = new Map<string, { name: string; cols: Map<string, string> }>();
  const tables = d.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
  for (const { name } of tables) {
    const cols = new Map<string, string>();
    for (const c of d.prepare(`PRAGMA table_info("${name}")`).all() as { name: string }[]) {
      cols.set(c.name.toLowerCase(), c.name);
    }
    out.set(name.toLowerCase(), { name, cols });
  }
  _schemaByDb.set(d, out);
  return out;
}

// ── icon matching ─────────────────────────────────────────────────────────────
const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Rig shorthand seen in the sample data's component descriptions. */
const ICON_ALIASES: Record<string, string> = {
  "d c": "drill collar",
  dc: "drill collar",
  "drill collars": "drill collar",
  stab: "stabilizer",
  "h w d p": "drill pipe heavyweight",
  hwdp: "drill pipe heavyweight",
  "heavy weight drill pipe": "drill pipe heavyweight",
  "x o": "crossover",
  xo: "crossover",
  "x over": "crossover",
  monel: "monel drill collar",
  "drill pipe stands": "drill pipe",
  "drill pipe singles": "drill pipe",
  "tubing jts": "tubing",
  jar: "jars",
  bha: "drill collar",
  "sucker rod": "rod",
  "polish rod": "polished rod",
};

let _icons: { norm: string; png: string }[] | null = null;
/** Every non-blank icon, by normalised name — for resolving a STORED name. */
let _byName: Map<string, string> | null = null;

function loadIcons(): void {
  if (_icons && _byName) return;
  const raw = JSON.parse(readFileSync(ICONS_MANIFEST, "utf-8"));
  const all = raw.icons as { name: string; png: string; blank?: boolean }[];
  // Resolving an explicit name searches EVERYTHING: if a row says it wants the
  // wireframe variant, that is the icon it wants.
  _byName = new Map(all.filter((i) => !i.blank).map((i) => [normalise(i.name), i.png]));
  _icons = all
    // …but for the description GUESS below, the shaded render is the icon;
    // wireframe/cut-out variants are drawings of the same thing and would win
    // containment matches for the wrong reasons.
    .filter((i) => !i.blank && !/wireframe|cut.?out/i.test(i.name))
    .map((i) => ({ norm: normalise(i.name), png: i.png }));
}
function icons(): { norm: string; png: string }[] {
  loadIcons();
  return _icons!;
}

/**
 * The icon WellView itself recorded for a row.
 *
 * Nearly every component table carries an IconName, chosen by whoever entered
 * the record: 215 of 215 casing components in the sample, 1,579 of 1,581 drill
 * string components, 528 of 528 tubing. 129 of the 130 distinct names resolve
 * straight into the converted library, and the one that does not is literally
 * "Blank" — which means no icon, not a miss.
 *
 * Guessing from the description instead got 24% of rows right, put a WRONG
 * icon on 14%, and left 62% bare: a casing string is described "SURFACE" or
 * "PRODUCTION", and no text matcher will ever turn that into a casing icon.
 */
export function iconByName(name: string | null): string | null {
  if (!name) return null;
  const n = normalise(name);
  if (!n || n === "blank" || n === "none") return null;
  loadIcons();
  return _byName!.get(n) ?? null;
}

function iconFor(des: string | null): string | null {
  if (!des) return null;
  let n = normalise(des);
  if (!n) return null;
  n = ICON_ALIASES[n] ?? n;
  const all = icons();
  const exact = all.find((i) => i.norm === n);
  if (exact) return exact.png;
  // Whole-word containment, longest icon name wins: "casing shoe" should take
  // "Shoe - Casing"-style entries over a bare "Casing".
  const words = new Set(n.split(" "));
  let best: { png: string; len: number } | null = null;
  for (const i of all) {
    const iw = i.norm.split(" ");
    if (iw.every((w) => words.has(w)) && (!best || i.norm.length > best.len)) {
      best = { png: i.png, len: i.norm.length };
    }
  }
  return best?.png ?? null;
}

/** Component-ish tables get icon decoration; everything else does not. */
const COMPONENT_TABLE = /comp$|comptally$|drillstringcomp/i;

// ── row shaping ───────────────────────────────────────────────────────────────
function shapeValue(v: unknown): string | number | null {
  if (v == null) return null;
  if (v instanceof Uint8Array) return `(binary · ${v.byteLength} bytes)`;
  if (typeof v === "bigint") return Number(v);
  return v as string | number;
}

/*
 * The order a block's rows are read in now comes from `orderByFor`, which is
 * the same rule Edit Data uses. The list this file used to keep consulted no
 * metadata at all: it missed every SEQUENCED folder — the user's own
 * arrangement — and every table whose order the model states outright.
 */

/**
 * Replace the GUIDs of record-LINK columns with the linked record's caption.
 *
 * A report printing `wvJobRig.IDRecJobContact` was showing a raw 32-hex key.
 * WellView prints the linked record instead, so each link value is resolved
 * through the target table's own record-caption template. The target table
 * comes from the row's `…TK` companion where present (it stores the table
 * name), else from the model's declared link targets.
 *
 * Resolution is BATCHED — one query per (target table) per block, not per row.
 */
function resolveLinkCaptions(
  d: DatabaseSync,
  sch: ReturnType<typeof schema>,
  t: { name: string; cols: Map<string, string> },
  rows: Record<string, unknown>[],
  printed: { actual: string }[],
): Map<string, string> {
  const captions = new Map<string, string>();          // `${tableLc}|${idrec}` → caption
  const wanted = new Map<string, Set<string>>();        // tableLc → idrecs

  for (const p of printed) {
    if (!/^idrec./i.test(p.actual) || /tk$/i.test(p.actual)) continue;
    if (["idrec", "idrecparent"].includes(p.actual.toLowerCase())) continue;
    const tkCol = t.cols.get(`${p.actual.toLowerCase()}tk`);
    const targets = modelField(t.name, p.actual)?.lookupTyp === "foreignidrec"
      ? LINK_TARGET_FALLBACK(p.actual, sch) : LINK_TARGET_FALLBACK(p.actual, sch);
    for (const row of rows) {
      const id = row[p.actual];
      if (id == null || id === "") continue;
      const tk = tkCol ? row[tkCol] : null;
      const targetLc = (tk ? String(tk) : targets[0] ?? "").toLowerCase();
      if (!targetLc || !sch.has(targetLc)) continue;
      (wanted.get(targetLc) ?? wanted.set(targetLc, new Set()).get(targetLc)!).add(String(id));
    }
  }

  for (const [targetLc, ids] of wanted) {
    const target = sch.get(targetLc)!;
    const idCol = target.cols.get("idrec");
    if (!idCol || ids.size === 0) continue;
    const list = [...ids];
    try {
      const found = d.prepare(
        `SELECT * FROM "${target.name}" WHERE "${idCol}" IN (${list.map(() => "?").join(",")})`,
      ).all(...list) as Record<string, unknown>[];
      for (const r of found) {
        const cap = renderRecordDes(target.name, (col) => {
          const c = target.cols.get(col.toLowerCase());
          const v = c ? r[c] : null;
          return v == null ? null : String(v);
        });
        if (cap) captions.set(`${targetLc}|${String(r[idCol])}`, cap);
      }
    } catch { /* target table unreadable — leave the key as-is */ }
  }
  return captions;
}

/**
 * Candidate target tables for a link column when the row carries no `…TK`.
 *
 * The column name states the target with a qualifier appended —
 * `IDRecJobContactContractor` points at `wvJobContact` — so the suffix is
 * shrunk from the right until it names a table that exists.
 */
const LINK_TARGET_FALLBACK = (col: string, sch?: ReturnType<typeof schema>): string[] => {
  const suffix = col.replace(/^idrec/i, "").replace(/tk$/i, "").toLowerCase();
  const map: Record<string, string[]> = {
    wellbore: ["wvWellbore"], job: ["wvJob"], jobrun: ["wvJob"], jobpull: ["wvJob"],
    string: ["wvCas", "wvTub", "wvOtherStr"], cas: ["wvCas"], tub: ["wvTub"],
    nextcas: ["wvCas"], zone: ["wvZone"], bit: ["wvJobDrillBit"], log: ["wvLog"],
    dirsrvyactual: ["wvWellboreDirSurvey"], dirsrvyprop: ["wvWellboreDirSurvey"],
    jobcontact: ["wvJobContact"], problem: ["wvProblem"],
  };
  if (map[suffix]) return map[suffix];
  if (sch) {
    for (let i = suffix.length; i >= 2; i--) {
      const cand = `wv${suffix.slice(0, i)}`;
      if (sch.has(cand)) return [sch.get(cand)!.name];
    }
  }
  return [`wv${suffix}`];
};

/**
 * A block's heading. The .afr often leaves it blank, which used to print the
 * bare table name twice ("wvWellbore / wvWellbore"); the data model supplies
 * the caption WellView itself would have printed.
 */
function blockTitle(b: TemplateBlock): string | null {
  if (b.title) return b.title;
  const m = b.table ? modelTable(b.table) : undefined;
  return m?.label ?? b.title;
}

/** The longest proper table-name prefix that is itself a table — WellView's
 *  parent rule, needed here to scope blocks to an anchor record. */
function prefixParent(sch: ReturnType<typeof schema>, tnameLc: string): string | null {
  for (let i = tnameLc.length - 1; i > 2; i--) {
    const cand = tnameLc.slice(0, i);
    if (sch.has(cand) && cand !== tnameLc) return cand;
  }
  return null;
}

/**
 * Resolve one parsed template against a WellView database for one well:
 * every block in template order, its interpreted captions, its rows, and the
 * honest states (computed-at-print-time, missing columns, capped counts).
 * Shared by the sample-database browser and the WellView-online explorer.
 * Returns null when no template matches `html`.
 *
 * `anchor` is the manual's report-toolbar subject-area selector ("pick a Job,
 * then a Daily Operation report"): a table + record. Blocks DESCENDING from the
 * anchor table are joined up their IDRecParent chain to that record; blocks that
 * are ANCESTORS of it (the job block on a daily report) are pinned to the
 * anchor's own ancestor record. Unrelated blocks stay well-scoped, untouched.
 */
export function resolveTemplateData(
  d: DatabaseSync,
  /** A shipped template id, or a report definition the user designed. */
  html: string | Template,
  well: string,
  anchor?: { table: string; idrec: string } | null,
): {
  report: string;
  well: { idwell: string; name: string };
  /** The row filters the template declares (§9.2), so the page can say so. */
  filters: TemplateFilter[];
  blocks: unknown[];
} | null {
  /*
   * A shipped template by id, OR a report the user designed (§9.2 "My
   * Reports"), passed in directly.
   *
   * Deliberately the same function either way. A user's report and one of
   * Peloton's 182 then behave identically — the same unit conversion, link
   * captions, calculated fields, anchor scoping and row filters — because they
   * ARE the same code path. Rendering user reports separately would guarantee
   * the two drifted.
   */
  const tpl = typeof html === "string" ? templates().get(html) : html;
  if (!tpl) return null;

  const sch = schema(d);

  // The anchor record's own ancestor chain: tableLc → that level's IDRec.
  const anchorIds = new Map<string, string>();
  if (anchor) {
    const ancLc = anchor.table.toLowerCase();
    let curT = sch.get(ancLc);
    let curId: string | null = anchor.idrec;
    while (curT && curId) {
      anchorIds.set(curT.name.toLowerCase(), curId);
      const parentLc = prefixParent(sch, curT.name.toLowerCase());
      const parentCol = curT.cols.get("idrecparent");
      if (!parentLc || !parentCol) break;
      const row = d.prepare(`SELECT "${parentCol}" p FROM "${curT.name}" WHERE "${curT.cols.get("idrec")}" = ?`)
        .get(curId) as { p: string | null } | undefined;
      curId = row?.p ?? null;
      curT = sch.get(parentLc);
    }
  }

  const blocks = tpl.blocks.map((b) => {
    const tname = (b.table ?? "").toLowerCase();
    if (!tname) return { table: b.table, title: blockTitle(b), exists: false, computed: false };
    const t = sch.get(tname);
    if (!t) {
      // wv*calc tables are WellView print-time computations — there is nothing
      // to READ. Most of them are aggregations over rows that ARE stored, so
      // where the derivation has been worked out and its totals reconciled, it
      // is computed here and the block says plainly that the numbers were
      // derived. Everything else keeps the honest "WellView builds this at
      // print time" note; every other miss is simply not in this database.
      const isCalc = /calc$/.test(tname);
      const derived = isCalc
        ? computeCalc(d, b.table!, {
            idwell: well,
            idjob: anchorIds.get("wvjob") ?? null,
            idreport: anchorIds.get("wvjobreport") ?? null,
            idphase: anchorIds.get("wvjobprogramphase") ?? null,
          })
        : null;
      if (derived) {
        // The template names which columns to print, and in what order; a
        // derived block honours that just as a stored one does.
        const byName = new Map(derived.columns.map((c) => [c.column.toLowerCase(), c]));
        const asked = b.fields.map((f) => byName.get(f.column.toLowerCase())).filter((c) => c != null);
        const columns = asked.length ? asked : derived.columns;
        const keys = columns.map((c) => c!.column);
        const derivedMissing = b.fields
          .filter((f) => !byName.has(f.column.toLowerCase()))
          .map((f) => f.column);
        const derivedOmitted = classifyOmitted(
          derivedMissing.map((c) => ({ column: c, table: derived.table })));
        return {
          table: derived.table,
          title: blockTitle(b),
          exists: true,
          computed: true,
          derived: true,
          columns,
          // Rows travel as ARRAYS aligned to `columns`, exactly as a stored
          // block's do — the client renders both through the same path.
          rows: derived.rows.map((r) => keys.map((k) => (r[k] ?? null) as string | number | null)),
          rowCount: derived.rowCount,
          missing: derivedMissing,
          omitted: derivedOmitted,
          omittedNote: omittedSummary(derivedOmitted, derived.rows.length > 0),
          unsupported: derived.unsupported,
          verifiedBy: derived.verifiedBy,
        };
      }
      // Derivable, but the report toolbar has not been given the job or day
      // this summary is OF. Name it, so the block is a prompt and not a wall.
      const needs = isCalc
        ? calcMissingScope(b.table!, {
            idwell: well,
            idjob: anchorIds.get("wvjob") ?? null,
            idreport: anchorIds.get("wvjobreport") ?? null,
            idphase: anchorIds.get("wvjobprogramphase") ?? null,
          }).filter((p) => p !== "idwell")
        : [];
      return {
        table: b.table,
        title: blockTitle(b),
        exists: false,
        computed: isCalc,
        ...(needs.length ? { needsScope: needs } : {}),
      };
    }
    const contentOnly = (b as { contentOnly?: boolean }).contentOnly === true;
    const wanted = b.fields.map((f) => ({
      column: f.column,
      // WellView's own caption for the field, not the .afr's capitalised
      // column name ("Wellboreida"). The template label is only a fallback.
      label: modelField(b.table ?? "", f.column)
        ? columnLabel(b.table!, f.column)
        : (f.label_interpreted || f.column),
      actual: t.cols.get(f.column.toLowerCase()) ?? null,
    }));
    const present = wanted.filter((w) => w.actual != null);
    /*
     * A template column with no stored column is not always absent: 866 of the
     * model's calculated fields live on stored tables and WellView works them
     * out at print time. 120 of the 182 templates print at least one, and until
     * now every one of them vanished from the page with no note at all.
     *
     * calcFieldsFor returns only the ones this app can compute from the model's
     * own equation, safely. Everything else stays in `missing` and is still
     * reported missing: a blank column with an explanation is honest, a blank
     * column without one is not.
     */
    const computable = new Map(calcFieldsFor(t.name).map((c) => [c.field.toLowerCase(), c]));
    // Totals over child rows are computed the same way but need the database,
    // so they are resolved per block after the rows are read.
    const aggregable = new Map(calcAggregatesFor(t.name).map((a) => [a.field.toLowerCase(), a]));
    // …and "the value on the most recent child by date", which is a pick over
    // the children rather than a total, so it needs the database in the same
    // way and is resolved alongside them.
    const pickable = new Map(calcLatestFor(t.name).map((a) => [a.field.toLowerCase(), a]));
    // …and the two hand-written formulas, which read the children too.
    const nameable = new Map(calcNamedFor(t.name).map((a) => [a.field.toLowerCase(), a]));
    // …and arithmetic over those totals, which can only run once they exist.
    const overable = new Map(calcOverAggregatesFor(t.name).map((a) => [a.field.toLowerCase(), a]));
    // …and a value read from one linked record.
    const lookable = new Map(calcLookupsFor(t.name).map((a) => [a.field.toLowerCase(), a]));
    // …and the Time Log's three clock fields, which are one hand-written
    // derivation over an ordered running total. See timeLogClock.ts.
    const clockable = t.name.toLowerCase() === "wvjobreporttimelog"
      ? new Set(["dttmstartcalc", "dttmendcalc", "sumofdurationcalc"])
      : new Set<string>();
    // …and where each piece of a casing or tubing string sits in the hole.
    const stackable = new Set(stackFieldsFor(t.name));
    const derivable = (c: string) =>
      computable.has(c.toLowerCase()) || aggregable.has(c.toLowerCase())
      || pickable.has(c.toLowerCase()) || nameable.has(c.toLowerCase())
      || overable.has(c.toLowerCase()) || lookable.has(c.toLowerCase())
      || clockable.has(c.toLowerCase()) || stackable.has(c.toLowerCase());
    const derivedCols = wanted.filter((w) => w.actual == null && derivable(w.column));
    const missing = wanted.filter((w) => w.actual == null && !derivable(w.column))
      .map((w) => w.column);
    // …and WHY each is blank. Derived from `missing`, so a column can never be
    // dropped from the page and left out of the explanation.
    const omittedCols = classifyOmitted(missing.map((c) => ({ column: c, table: t.name })));
    // A block whose ONLY columns are derivable still has nothing to select
    // from, so it is treated as empty rather than queried for zero columns.
    if (present.length === 0) {
      return {
        table: t.name, title: blockTitle(b), exists: true, computed: false, contentOnly,
        columns: [], missing, omitted: omittedCols, omittedNote: omittedSummary(omittedCols, false),
        rowCount: 0, rows: [],
      };
    }

    const hasIdwell = t.cols.has("idwell");
    const applied: TemplateFilter[] = [];
    const unapplied: (TemplateFilter & { why: string })[] = [];
    const preds: string[] = hasIdwell ? [`t0."${t.cols.get("idwell")}" = ?`] : [];
    const args: string[] = hasIdwell ? [well] : [];
    let joins = "";

    // Anchor scoping (report-toolbar subject-area selectors).
    if (anchor && anchorIds.size) {
      const ancLc = anchor.table.toLowerCase();
      if (anchorIds.has(tname)) {
        // Block IS the anchor level or one of its ancestors: pin to that record.
        const idCol = t.cols.get("idrec");
        if (idCol) { preds.push(`t0."${idCol}" = ?`); args.push(anchorIds.get(tname)!); }
      } else if (tname.startsWith(ancLc)) {
        // Block descends from the anchor: join IDRecParent up to it.
        const chain: { name: string; idrec: string; parentCol: string }[] = [];
        let cur = tname;
        let ok = true;
        while (cur !== ancLc) {
          const ct = sch.get(cur);
          const parentLc = prefixParent(sch, cur);
          const parentCol = ct?.cols.get("idrecparent");
          const parentT = parentLc ? sch.get(parentLc) : null;
          if (!ct || !parentCol || !parentT || !parentT.cols.get("idrec")) { ok = false; break; }
          chain.push({ name: parentT.name, idrec: parentT.cols.get("idrec")!, parentCol });
          cur = parentLc!;
        }
        if (ok && chain.length) {
          let prev = "t0";
          chain.forEach((hop, i) => {
            const alias = `a${i + 1}`;
            const prevTable = i === 0 ? t : sch.get(chain[i - 1].name.toLowerCase())!;
            const prevParentCol = i === 0 ? t.cols.get("idrecparent") : prevTable.cols.get("idrecparent");
            joins += ` JOIN "${hop.name}" ${alias} ON ${alias}."${hop.idrec}" = ${prev}."${prevParentCol}"`;
            prev = alias;
          });
          preds.push(`${prev}."${sch.get(ancLc)!.cols.get("idrec")}" = ?`);
          args.push(anchor.idrec);
        }
      }
    }

    /*
     * The template's own row filters (§9.2 "Filter and Sort Records").
     *
     * 73 of the shipped templates declare one — always a job type — and until
     * now none of them were applied, so a drilling report opened on a
     * completion job printed the completion's rows under a drilling heading.
     * That is worse than printing nothing: the page looks like an answer.
     *
     * The match is a case-insensitive PREFIX, which is not a guess: the shipped
     * values are "drill", "dril", "drill*" and "Completion", and the database
     * holds "Drilling" and "Completion/Workover". Equality selects nothing.
     *
     * A filter reaches a block when the block IS the filtered table or DESCENDS
     * from it by the IDRecParent chain — the same walk the anchor uses. One that
     * reaches neither is reported, never silently ignored.
     */
    // One counter for the whole block: a template with two filters on the same
    // block otherwise allocates f1 twice and SQLite rejects the ambiguous name.
    let fAlias = 0;
    for (const flt of tpl.filters) {
      const ft = sch.get(flt.table);
      const fcol = ft?.cols.get(flt.field);
      if (!ft || !fcol) { unapplied.push({ ...flt, why: "not a column in this database" }); continue; }
      const like = `${flt.value.replace(/\*+$/, "").toLowerCase()}%`;
      if (tname === flt.table) {
        preds.push(`lower(t0."${fcol}") LIKE ?`);
        args.push(like);
        applied.push(flt);
      } else if (tname.startsWith(flt.table)) {
        const hops = chainUp(sch, tname, flt.table);
        if (!hops) { unapplied.push({ ...flt, why: "no parent chain from this block" }); continue; }
        let prev = "t0";
        for (const hop of hops) {
          const alias = `f${++fAlias}`;
          joins += ` JOIN "${hop.name}" ${alias} ON ${alias}."${hop.idrec}" = ${prev}."${hop.parentCol}"`;
          prev = alias;
        }
        preds.push(`lower(${prev}."${fcol}") LIKE ?`);
        args.push(like);
        applied.push(flt);
      } else {
        unapplied.push({ ...flt, why: "this block is not under the filtered table" });
      }
    }

    const where = preds.length ? ` WHERE ${preds.join(" AND ")}` : "";
    const total = (d.prepare(`SELECT COUNT(*) c FROM "${t.name}" t0${joins}${where}`).get(...args) as { c: number }).c;
    const ord = orderByFor(t.name, t.cols, "t0");
    const sel = present.map((p) => `t0."${p.actual}"`).join(", ");
    const desCol = t.cols.get("des");
    const withDes = desCol && COMPONENT_TABLE.test(t.name) && !present.some((p) => p.actual === desCol)
      ? `${sel}, t0."${desCol}"` : sel;
    // The icon WellView recorded for the row travels too, whether or not the
    // template prints it: it is what decides the picture beside the row.
    const iconCol = t.cols.get("iconname");
    const withIcon = iconCol && COMPONENT_TABLE.test(t.name) && !present.some((p) => p.actual === iconCol)
      ? `${withDes}, t0."${iconCol}"` : withDes;
    // The record id travels with every row so the report can hand a specific
    // record to Edit Data — the manual's "double-click a field on the report".
    const idCol = t.cols.get("idrec");
    const withId = idCol && !present.some((p) => p.actual === idCol)
      ? `${withIcon}, t0."${idCol}" AS __idrec` : withIcon;
    // …and so do the …TK companions of any printed link column: they name the
    // table the link points at, which is what turns its key into a caption.
    const tkCols = present
      .map((p) => t.cols.get(`${p.actual!.toLowerCase()}tk`))
      .filter((c): c is string => !!c && !present.some((p) => p.actual === c));
    const withTk = tkCols.length
      ? `${withId}, ${[...new Set(tkCols)].map((c) => `t0."${c}"`).join(", ")}` : withId;
    // …and the inputs each derived column's equation needs, which the template
    // never asked for: a print-time field is computed from columns the report
    // does not itself print.
    // Only the ARITHMETIC fields read columns off this row; a child total reads
    // the child table instead, so asking it for `needs` finds nothing at all.
    const needCols = [...new Set(derivedCols.flatMap((w) =>
      computable.get(w.column.toLowerCase())?.needs ?? []))]
      .map((n) => t.cols.get(n))
      .filter((c): c is string => !!c && !present.some((p) => p.actual === c));
    const withNeeds = needCols.length
      ? `${withTk}, ${[...new Set(needCols)].map((c) => `t0."${c}"`).join(", ")}` : withTk;
    const rows = d.prepare(
      `SELECT ${withNeeds} FROM "${t.name}" t0${joins}${where}${ord ? ` ORDER BY ${ord}` : ""} LIMIT ${ROW_CAP}`,
    ).all(...args) as Record<string, unknown>[];

    const decorate = desCol != null && COMPONENT_TABLE.test(t.name);
    // A link column prints the record it points at, not its key.
    const linkCaptions = resolveLinkCaptions(
      d, sch, t, rows, present.map((p) => ({ actual: p.actual! })));
    /*
     * Child totals for this block, in one query per aggregate.
     *
     * The record id is read as `__idrec` first: when the template does not
     * itself print IDRec the SELECT aliases it, so looking only under the real
     * column name finds nothing and every total comes back null — which is
     * exactly what a first attempt here did, on a block whose SQL sums were
     * plainly non-zero.
     */
    const idColName = t.cols.get("idrec");
    const idOfRow = (x: Record<string, unknown>) =>
      String(x.__idrec ?? (idColName ? x[idColName] : "") ?? "");
    const blockSums = idColName && hasIdwell
      ? sumChildrenDetailed(d, t.name, well, rows.map(idOfRow))
      : { totals: new Map<string, Record<string, number>>(),
          counts: new Map<string, Record<string, number>>() };
    const blockTotals = blockSums.totals;
    const blockPicks = idColName && hasIdwell
      ? latestChildren(d, t.name, well, rows.map(idOfRow))
      : new Map<string, Record<string, string | number>>();
    const blockNamed = idColName && hasIdwell
      ? namedChildren(d, t.name, well, rows.map(idOfRow))
      : new Map<string, Record<string, number | number[]>>();
    const blockLooked = idColName && hasIdwell
      ? linkedValues(d, t.name, well, rows.map(idOfRow))
      : new Map<string, Record<string, string | number>>();
    /*
     * The daily Time Log's clock, which is scoped to ONE report.
     *
     * It cannot be computed well-wide: every entry's start is the report's own
     * start plus the durations before it, so without knowing which report the
     * block is showing there is no anchor. The toolbar's Day selection is that
     * anchor, and when there is none the three columns stay blank and say so —
     * which is honest, because the answer genuinely depends on it.
     */
    const idreport = anchorIds.get("wvjobreport") ?? null;
    const blockClock = t.name.toLowerCase() === "wvjobreporttimelog" && idreport
      ? timeLogClock(d, well, idreport)
      : new Map<string, TimeLogClockRow>();
    const blockStack = idColName && hasIdwell && stackable.size
      ? stackRows(d, t.name, well, rows.map(idOfRow))
      : new Map<string, StackRow>();
    const shaped = rows.map((r) => [
      ...present.map((p) => {
        const raw = shapeValue(r[p.actual!]);
        if (raw == null || !/^idrec./i.test(p.actual!) || /tk$/i.test(p.actual!)) return raw;
        const tkCol = t.cols.get(`${p.actual!.toLowerCase()}tk`);
        const tk = tkCol ? r[tkCol] : null;
        const targetLc = (tk ? String(tk) : LINK_TARGET_FALLBACK(p.actual!, sch)[0] ?? "").toLowerCase();
        return linkCaptions.get(`${targetLc}|${String(raw)}`) ?? raw;
      }),
      // The derived columns, in the same order they were declared above.
      // computeRow evaluates the arithmetic in DEPENDENCY order and feeds each
      // result back in, which is what lets ROPCalc read the DepthDrilledCalc
      // that has no column of its own; child totals come from `blockTotals`,
      // read once for the whole block rather than per row. A row whose inputs
      // are incomplete yields null — a blank cell, never a zero.
      ...(() => {
        const computedRow = computeRow(t.name, r);
        const mine = blockTotals.get(idOfRow(r)) ?? {};
        const picked = blockPicks.get(idOfRow(r)) ?? {};
        const named = blockNamed.get(idOfRow(r)) ?? {};
        // Arithmetic over this row's own child totals — evaluated AFTER them,
        // which is the whole reason it cannot live with the row arithmetic.
        const overAgg = overAggregates(
          t.name, mine, blockSums.counts.get(idOfRow(r)) ?? {});
        const looked = blockLooked.get(idOfRow(r)) ?? {};
        const clocked = blockClock.get(idOfRow(r)) ?? {};
        const stacked = blockStack.get(idOfRow(r)) ?? {};
        return derivedCols.map((w) => {
          const lc = w.column.toLowerCase();
          const arith = computable.get(lc);
          if (arith) return computedRow[arith.field] ?? null;
          const agg = aggregable.get(lc);
          if (agg) return mine[agg.field] ?? null;
          const pick = pickable.get(lc);
          if (pick) return picked[pick.field] ?? null;
          const nm = nameable.get(lc);
          if (nm) return named[nm.field] ?? null;
          const oa = overable.get(lc);
          if (oa) return overAgg[oa.field] ?? null;
          const lk = lookable.get(lc);
          if (lk) return looked[lk.field] ?? null;
          if (clockable.has(lc)) {
            return (clocked as Record<string, string | number | null>)[lc] ?? null;
          }
          if (stackable.has(lc)) {
            return (stacked as Record<string, number | null | undefined>)[lc] ?? null;
          }
          return null;
        });
      })(),
    ]);
    // Rows whose every printed cell is null render as a page of dashes —
    // noise dressed as data. Collapse them into one honest sentence and let
    // the client say so; the count still tells the truth.
    const allNull = shaped.length > 0 && shaped.every((r) => r.every((v) => v == null));
    return {
      table: t.name,
      title: blockTitle(b),
      exists: true,
      computed: false,
      columns: [
        ...present.map((p) => ({
          column: p.column,
          label: p.label,
          // The client renders in the user's unit set, so it needs the base
          // unit and the per-set target the model names.
          unit: modelField(t.name, p.column)?.baseUnit,
          units: modelField(t.name, p.column)?.units,
        })),
        // Columns WellView computes at print time, worked out here from the
        // model's own equation. Flagged so the page can mark them as derived
        // rather than let them pass for stored measurements.
        ...derivedCols.map((w) => {
          const lc = w.column.toLowerCase();
          if (clockable.has(lc) || stackable.has(lc)) {
            // The Time Log's clock fields: their labels and units come from the
            // model like any other, but they have no registry entry because
            // they are one derivation producing three values together.
            const mf = modelField(t.name, w.column);
            return {
              column: w.column,
              label: mf?.label ?? w.label,
              unit: mf?.baseUnit,
              units: mf?.units,
              derived: true as const,
              eqn: mf?.help ?? "",
            };
          }
          const cf = computable.get(lc) ?? aggregable.get(lc) ?? pickable.get(lc)
            ?? nameable.get(lc) ?? overable.get(lc) ?? lookable.get(lc)!;
          const nm = nameable.get(lc);
          /*
           * A LIST-VALUED column must not declare a unit of its own.
           *
           * The client converts any cell whose column carries a `unit` and whose
           * text reads as a number. A one-nozzle list is a bare number and would
           * be converted twice; a three-nozzle list is not and would print raw
           * metres. So the unit travels as an ITEM spec instead, and the client
           * maps it over the array. The sample cannot expose this — every string
           * in it has at least two nozzles — which is exactly why it is written
           * down rather than left to testing.
           */
          if (nm?.kind === "list") {
            const item = nm.itemOf ? modelField(nm.itemOf.table, nm.itemOf.field) : undefined;
            return {
              column: cf.field,
              label: cf.label,
              list: true as const,
              itemUnit: item?.baseUnit,
              itemUnits: item?.units,
              derived: true as const,
              eqn: cf.eqn,
            };
          }
          return {
            column: cf.field,
            label: cf.label,
            unit: modelField(t.name, cf.field)?.baseUnit,
            units: modelField(t.name, cf.field)?.units,
            derived: true as const,
            eqn: cf.eqn,
          };
        }),
      ],
      missing,
      /** …and why each one is blank, so the page can say so. */
      omitted: omittedCols,
      /** One line the report page prints under the block. */
      omittedNote: omittedSummary(omittedCols, !allNull && total > 0),
      /** The template's row filters honoured for this block (§9.2). */
      filtersApplied: applied.length ? applied : undefined,
      /** …and the ones that could not be, each with a reason. */
      filtersSkipped: unapplied.length ? unapplied : undefined,
      rowCount: total,
      truncated: total > rows.length,
      allNull,
      rows: allNull ? [] : shaped,
      /** Record id per row, so a click can open THAT record in Edit Data. */
      rowIds: allNull || !idCol ? undefined
        : rows.map((r) => {
          const v = r.__idrec ?? r[idCol];
          return v == null ? null : String(v);
        }),
      // The recorded icon wins; the description guess is only for the rows
      // and the tables that have no IconName at all.
      icons: decorate && !allNull
        ? rows.map((r) => iconByName(r[iconCol ?? ""] as string | null)
            ?? iconFor(r[desCol!] as string | null))
        : undefined,
    };
  });

  const hdr = sch.get("wvwellheader");
  const wellRow = hdr
    ? d.prepare(`SELECT "${hdr.cols.get("wellname") ?? "WellName"}" AS wellname FROM "${hdr.name}" WHERE idwell = ?`).get(well) as
      { wellname: string | null } | undefined
    : undefined;
  return {
    report: tpl.name,
    well: { idwell: well, name: wellRow?.wellname ?? well },
    /**
     * The filters the template declares, so the page can say what it is showing
     * rather than leave the reader to assume it is everything.
     */
    filters: tpl.filters,
    blocks,
  };
}

export async function registerWellviewSampleRoutes(app: FastifyInstance): Promise<void> {
  app.get("/entry/wellview/sample/status", { preHandler: requireUser }, async () => {
    const d = db();
    return {
      available: d != null,
      path: sampleDbPath(),
      searched: DB_CANDIDATES,
      hint: d == null
        ? "Convert the Access database first: node scripts/wellview-db/mdb_to_sqlite.mjs \"WellView_files/db\" sqlite_DB/wellview"
        : null,
    };
  });

  app.get("/entry/wellview/sample/wells", { preHandler: requireUser }, async (_req, reply) => {
    const d = db();
    if (!d) return reply.code(503).send({ error: "sample database not on this machine" });
    // Weighted by the tables the templates lean on most, so the default pick is
    // the well with the most to show.
    const wells = d.prepare("SELECT idwell AS idwell, WellName AS wellname FROM wvWellHeader").all() as
      { idwell: string; wellname: string | null }[];
    const volume = d.prepare(`
      SELECT w.idwell,
        (SELECT COUNT(*) FROM wvJobReportTimeLog t WHERE t.idwell = w.idwell)
        + (SELECT COUNT(*) FROM wvJobReportCostGen c WHERE c.idwell = w.idwell)
        + (SELECT COUNT(*) FROM wvJobDrillStringComp s WHERE s.idwell = w.idwell)
        + (SELECT COUNT(*) FROM wvWellboreDirSurveyData v WHERE v.idwell = w.idwell)
        + (SELECT COUNT(*) FROM wvTubComp tc WHERE tc.idwell = w.idwell)
        + (SELECT COUNT(*) FROM wvCasComp cc WHERE cc.idwell = w.idwell) AS n
      FROM wvWellHeader w
    `).all() as { idwell: string; n: number }[];
    const byId = new Map(volume.map((v) => [v.idwell, v.n]));
    return wells
      .map((w) => ({ idwell: w.idwell, name: w.wellname ?? w.idwell, rows: byId.get(w.idwell) ?? 0 }))
      .sort((a, b) => b.rows - a.rows);
  });

  app.get<{ Querystring: { html?: string; well?: string } }>(
    "/entry/wellview/sample/template-data",
    { preHandler: requireUser },
    async (req, reply) => {
      const d = db();
      if (!d) return reply.code(503).send({ error: "sample database not on this machine" });
      const html = String(req.query.html ?? "");
      const well = String(req.query.well ?? "");
      if (!well) return reply.code(400).send({ error: "well (idwell) is required" });
      const resolved = resolveTemplateData(d, html, well);
      if (!resolved) return reply.code(404).send({ error: `no template with html=${html}` });
      return resolved;
    },
  );
}
