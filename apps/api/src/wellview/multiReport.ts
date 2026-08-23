/**
 * Multi-well reports (`custom/reports multi/*.afm`), the other half of
 * WellView's reporting.
 *
 * Where an `.afr` prints ONE well, an `.afm` prints one table across a SET of
 * wells picked in the Well Explorer — every bit run on the asset, every drilling
 * problem this year, cost by vendor across a campaign. The container is the same
 * v3.0 format, so the same reader extracts it; what differs is the shape and the
 * scoping.
 *
 * TWO THINGS ARE PARTICULAR TO THE MULTI FORM.
 *
 * A field may name a column that lives on the WELL rather than on the block's
 * own table — `wellname` on a `wvJob` block — because in a list spanning wells
 * the well's name is what identifies the row. Those resolve through
 * wvWellHeader on idwell.
 *
 * And every row must say which well it came from whether or not the template
 * asked: a mixed list of bit runs with no well column is unreadable. So the
 * well name is prepended when the template does not already print it.
 */
import type { DatabaseSync } from "node:sqlite";
import { columnLabel, modelField, modelTable } from "./model.js";

export interface MultiTemplateField {
  column: string;
  /** v2.0 templates name the table a column is read from. */
  source_table?: string;
  label_interpreted?: string | null;
}
export interface MultiTemplateBlock {
  table: string | null;
  title: string | null;
  fields: MultiTemplateField[];
}
/** One filter a template carries, decoded from its .afm by build_afm_filters.mjs. */
export interface MultiFilter {
  table: string;
  field: string;
  op: "LIKE" | "NOT LIKE" | "IS NULL" | "IS NOT NULL";
  /** Null for the null tests. WellView's wildcard is `*`, not `%`. */
  value: string | null;
}
export interface MultiTemplate {
  html: string;
  name: string;
  folder?: string;
  format_version?: number;
  /** Row filters from the template. Absent means the template has none. */
  filters?: MultiFilter[];
  /** Filters that could not be read, with the reason — reported, never applied. */
  filtersSkipped?: string[];
  blocks: MultiTemplateBlock[];
}

export interface MultiColumn {
  column: string;
  label: string;
  unit?: string;
  units?: Record<string, unknown>;
  /**
   * Measured from the reference datum, and how it responds.
   *
   * Carried for the same reason the unit is: without them the client cannot
   * shift, so a multi-well report printed stored Original-KB metres while the
   * single-well report of the same field on the same well printed `mCF` — two
   * different datums on two screens, and only one of them saying so.
   */
  applyDatum?: boolean;
  datumMode?: "depth" | "up" | "invariant";
  /** Read from wvWellHeader rather than the block's own table. */
  fromWell?: boolean;
}

export interface MultiBlockResult {
  table: string | null;
  title: string | null;
  exists: boolean;
  /** Filters applied to this block, in the words the screen can print. */
  filtersApplied?: string[];
  /** …and the ones that were not, with why. */
  filtersSkipped?: string[];
  columns: MultiColumn[];
  /** Which well each row came from, aligned with `rows`. Its datum key. */
  rowWells?: string[];
  /** Columns the template prints that this database does not have. */
  missing: string[];
  rows: (string | number | null)[][];
  rowCount: number;
  truncated: boolean;
  /** Set when the template predates the current schema — see below. */
  schemaDrift?: string;
  /** Set when columns are missing because WellView computes them at print time. */
  printTimeNote?: string;
}

const WELL_TABLE = "wvwellheader";

function schemaOf(d: DatabaseSync) {
  const out = new Map<string, { name: string; cols: Map<string, string> }>();
  for (const { name } of d.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]) {
    const cols = new Map<string, string>();
    for (const c of d.prepare(`PRAGMA table_info("${name}")`).all() as { name: string }[]) {
      cols.set(c.name.toLowerCase(), c.name);
    }
    out.set(name.toLowerCase(), { name, cols });
  }
  return out;
}

/**
 * The chain of tables from `from` up to `to`, by the prefix rule.
 *
 * WellView names a child table with its parent's name as a prefix — wvJobRig
 * under wvJob, wvJobReportTimeLog under wvJobReport under wvJob — and the
 * parent of a table is the LONGEST proper prefix that is itself a table.
 *
 * This is needed because a template's filter names a table that is often not
 * the block's own. "Drilling Rigs with query" prints wvJobRig rows and filters
 * on wvJob.wvTyp: the filter is a fact about the JOB each rig record hangs off.
 * Matching filters to blocks by name alone applied none of them.
 *
 * Returns the tables between the two, nearest first, or null when `to` is not
 * an ancestor of `from` — in which case the filter is not about this block and
 * is left for whichever block it does belong to.
 */
function chainUp(sch: Map<string, { name: string; cols: Map<string, string> }>,
  from: string, to: string): string[] | null {
  const chain: string[] = [];
  let cur = from.toLowerCase();
  const target = to.toLowerCase();
  for (let guard = 0; guard < 8; guard++) {
    if (cur === target) return chain;
    let parent: string | null = null;
    for (let n = cur.length - 1; n > 2; n--) {
      const cand = cur.slice(0, n);
      if (sch.has(cand)) { parent = cand; break; }
    }
    if (!parent) return null;
    chain.push(parent);
    cur = parent;
  }
  return null;
}

/**
 * Run one multi-well template block over a set of wells.
 *
 * Wells are bound as parameters, never interpolated, and the set is capped by
 * the caller. An empty set returns no rows rather than every well in the
 * database — "no wells selected" must not silently mean "all of them".
 */
export function resolveMultiTemplate(
  d: DatabaseSync,
  tpl: MultiTemplate,
  idwells: string[],
  rowCap = 500,
): { report: string; name: string; wells: number; blocks: MultiBlockResult[] } {
  const sch = schemaOf(d);
  const well = sch.get(WELL_TABLE);
  /*
   * The template's row filters, and the ones that could not be read.
   *
   * Per BLOCK, not per template: a filter names its own table, so a template
   * whose blocks are wvJob, wvJobReport and wvJobReportTimeLog can carry a
   * filter that narrows one of them and leaves the others whole. That makes a
   * report internally uneven, which is what the file says and not this app's
   * choice to smooth over.
   */
  const filters = tpl.filters ?? [];
  const skippedFilters = tpl.filtersSkipped ?? [];

  const blocks = tpl.blocks.map((b): MultiBlockResult => {
    const tname = (b.table ?? "").toLowerCase();
    const t = tname ? sch.get(tname) : undefined;
    if (!t) {
      return { table: b.table, title: b.title, exists: false, columns: [], missing: [],
               rows: [], rowCount: 0, truncated: false };
    }

    const hasIdwell = t.cols.has("idwell");

    /**
     * A field's source table need not be the block's.
     *
     * "Bit Performance" is a wvJobDrillString block that prints the bit's size,
     * make and model from wvJobDrillBit, and the well's name from wvWellHeader.
     * Three routes reach those, in order of certainty: the block's own columns;
     * the well header, joined on idwell; and a RECORD LINK — a column on the
     * block table whose `…TK` companion names the source table, which is how
     * this schema stores every association (wvJobDrillString.IDRecBit, with
     * IDRecBitTK = 'wvjobdrillbit'). Anything not reachable that way is
     * reported missing rather than guessed at.
     */
    const linkTo = (target: string): { col: string; table: string } | null => {
      const other = sch.get(target);
      if (!other?.cols.has("idrec")) return null;
      for (const [lc, actual] of t.cols) {
        if (!lc.startsWith("idrec") || lc === "idrecparent" || lc.endsWith("tk")) continue;
        const tk = t.cols.get(`${lc}tk`);
        if (!tk) continue;
        try {
          const hit = d.prepare(
            `SELECT 1 FROM "${t.name}" WHERE lower("${tk}") = ? LIMIT 1`).get(target) as unknown;
          if (hit) return { col: actual, table: other.name };
        } catch { /* a column that will not compare is simply not the link */ }
      }
      return null;
    };
    const links = new Map<string, { col: string; table: string; alias: string } | null>();
    const resolveLink = (target: string) => {
      if (links.has(target)) return links.get(target)!;
      const found = linkTo(target);
      const v = found ? { ...found, alias: `l${links.size}` } : null;
      links.set(target, v);
      return v;
    };

    const resolved = b.fields.map((f) => {
      const lc = f.column.toLowerCase();
      const src = (f.source_table ?? "").toLowerCase();
      if (src === WELL_TABLE && well?.cols.has(lc)) {
        return { field: f, actual: well.cols.get(lc)!, from: "well" as const, alias: "w" };
      }
      if ((!src || src === tname) && t.cols.has(lc)) {
        return { field: f, actual: t.cols.get(lc)!, from: "block" as const, alias: "t0" };
      }
      if (src && src !== tname) {
        const other = sch.get(src);
        if (other?.cols.has(lc)) {
          const link = resolveLink(src);
          if (link) return { field: f, actual: other.cols.get(lc)!, from: "link" as const, alias: link.alias };
        }
      }
      if (t.cols.has(lc)) return { field: f, actual: t.cols.get(lc)!, from: "block" as const, alias: "t0" };
      if (well?.cols.has(lc)) return { field: f, actual: well.cols.get(lc)!, from: "well" as const, alias: "w" };
      return { field: f, actual: null, from: "none" as const, alias: "" };
    });

    const present = resolved.filter((r) => r.actual != null);
    const missing = resolved.filter((r) => r.actual == null).map((r) => r.field.column);

    /**
     * WHY a column is missing, which is two different facts.
     *
     * A column the model KNOWS and marks `calculated` is one WellView computes
     * when the report prints and never stores — the same situation the
     * single-well reports report, and nothing to do with this template's age.
     * A column the model has never heard of is a template written against an
     * older schema. Calling the first case "an earlier schema" would be a
     * plausible, confident, wrong explanation, so they are counted apart.
     */
    const unknown: string[] = [];
    let computed = 0;
    for (const r of resolved) {
      if (r.actual != null) continue;
      const owner = (r.field.source_table ?? tname) || tname;
      const mf = modelField(owner, r.field.column);
      if (mf?.calculated) computed++;
      else unknown.push(r.field.column);
    }
    const drift = unknown.length && unknown.length >= Math.max(3, resolved.length / 2)
      ? `${unknown.length} of ${resolved.length} columns this template prints are not in this `
        + `database's schema at all — it was written against an earlier version of WellView.`
      : undefined;
    const printTime = computed > 0
      ? `${computed} column${computed === 1 ? " is" : "s are"} computed by WellView when the report `
        + `prints and stored nowhere, so ${computed === 1 ? "it is" : "they are"} blank here.`
      : undefined;

    if (!hasIdwell || present.length === 0 || idwells.length === 0) {
      return {
        table: t.name, title: b.title, exists: true,
        columns: [], missing, rows: [], rowCount: 0, truncated: false, schemaDrift: drift, printTimeNote: printTime,
      };
    }

    const wellJoin = well
      ? ` LEFT JOIN "${well.name}" w ON w."${well.cols.get("idwell")}" = t0."${t.cols.get("idwell")}"`
      : "";
    // One LEFT JOIN per linked table actually used, so a row with no link still
    // appears with blanks rather than dropping out of the report.
    const linkJoins = [...links.values()].filter((l): l is NonNullable<typeof l> => !!l)
      .filter((l) => present.some((r) => r.alias === l.alias))
      .map((l) => ` LEFT JOIN "${l.table}" ${l.alias} ON ${l.alias}."${sch.get(l.table.toLowerCase())!.cols.get("idrec")}" = t0."${l.col}"`)
      .join("");

    // The well's own name leads every row unless the template already prints
    // it: without it a list spanning wells cannot be read.
    const printsWellName = present.some((r) => r.from === "well"
      && r.actual!.toLowerCase() === "wellname");
    const lead = !printsWellName && well?.cols.has("wellname")
      ? [`w."${well.cols.get("wellname")}" AS __wellname`] : [];
    /*
     * WHICH WELL each row came from, as plumbing rather than a column.
     *
     * One header spans many wells, so there is no single datum offset the
     * client can apply — the shift has to be looked up per row, and that needs
     * the row's idwell.
     *
     * Kept OUT of `lead`, which is not just a SELECT list: `lead.length` is
     * what decides whether the well name becomes a printed column, so adding
     * anything to it would print a name column on templates that already have
     * one. It travels beside the rows instead, in `rowWells`.
     */
    const idwellSel = `t0."${t.cols.get("idwell")}" AS __idwell`;

    /*
     * THE TEMPLATE'S OWN ROW FILTERS.
     *
     * Every multi-well report used to run as `WHERE idwell IN (…)` and return
     * the whole table, so "Drilling Rigs with query", "Completion Rigs with
     * query" and "Rigs with query" produced identical output on a database
     * holding 22 drilling jobs and 10 completion ones.
     *
     * CONJUNCTION IS A HEURISTIC AND MUST BE READ AS ONE. The .afm carries a
     * second int32 per record that takes 0 and 2, and its meaning could not be
     * established: 2 appears on records with no value and on two that have one.
     * So the rule here was chosen by testing all three candidates against every
     * shipped template and keeping the only one that never empties a report
     * which returns rows today:
     *
     *   AND everything      empties 2 (SCVF, Drill String Equipment)
     *   OR within a field   empties 1 (Drill String Equipment)
     *   OR within a table   empties 0        <- this one
     *
     * SCVF is the clearest case: two filters on the same field, "scvf" and
     * "vent flow". No row is both, so AND cannot be what was meant.
     */
    /*
     * A filter applies to this block when it names the block's own table OR any
     * table above it. 15 of the 24 shipped filters name an ancestor, not the
     * block — "Drilling Rigs with query" prints wvJobRig and filters wvJob.
     */
    const forThis = (filters ?? [])
      .map((f) => ({ f, chain: chainUp(sch, t.name, f.table) }))
      .filter((x): x is { f: MultiFilter; chain: string[] } => x.chain !== null);
    const filterArgs: string[] = [];
    const filterApplied: string[] = [];
    const filterSkipped: string[] = [...(skippedFilters ?? [])];
    const filterOrs: string[] = [];
    let fx = 0;
    for (const { f, chain } of forThis) {
      const owner = chain.length ? sch.get(chain[chain.length - 1]) : t;
      const col = owner?.cols.get(f.field.toLowerCase());
      if (!owner || !col) {
        filterSkipped.push(`${f.table}.${f.field} — not a column in this database`);
        continue;
      }
      // The alias the predicate is written against: t0 when the filter is on
      // this block's own table, otherwise the last hop of the chain.
      const a = chain.length ? `f${fx}_${chain.length - 1}` : "t0";
      let pred: string;
      if (f.op === "IS NULL") {
        // "Still in the hole": WellView writes an empty string as often as a
        // null, and a report that showed pulled equipment would be wrong.
        pred = `(${a}."${col}" IS NULL OR ${a}."${col}" = '')`;
        filterApplied.push(`${f.field} is empty`);
      } else if (f.op === "IS NOT NULL") {
        pred = `(${a}."${col}" IS NOT NULL AND ${a}."${col}" <> '')`;
        filterApplied.push(`${f.field} is set`);
      } else {
        // WellView's wildcard is `*`; SQL's is `%`. Untranslated, the shipped
        // value "drill*" matches nothing and empties two reports.
        pred = `${a}."${col}" ${f.op} ? COLLATE NOCASE`;
        filterArgs.push(`%${String(f.value ?? "").replace(/\*/g, "%")}%`.replace(/%%+/g, "%"));
        filterApplied.push(`${f.field} ${f.op.toLowerCase()} "${f.value}"`);
      }

      if (!chain.length) { filterOrs.push(pred); fx++; continue; }
      // Walk up: t0 -> its parent -> … -> the filter's table, then test there.
      let joins = "";
      let prev = "t0";
      chain.forEach((name, k) => {
        const ct = sch.get(name)!;
        const al = `f${fx}_${k}`;
        joins += k === 0
          ? ` FROM "${ct.name}" ${al}`
          : ` JOIN "${ct.name}" ${al} ON ${al}."IDRec" = ${prev}."IDRecParent"`;
        prev = al;
      });
      filterOrs.push(`EXISTS (SELECT 1${joins} WHERE f${fx}_0."IDRec" = t0."IDRecParent" AND ${pred})`);
      fx++;
    }
    const filterWhere = filterOrs.length
      ? ` AND (${filterOrs.join(" OR ")})`
      : "";

    const sel = present.map((r) => `${r.alias}."${r.actual}"`);
    const placeholders = idwells.map(() => "?").join(", ");
    const sql = `SELECT ${[...lead, idwellSel, ...sel].join(", ")}
                   FROM "${t.name}" t0${wellJoin}${linkJoins}
                  WHERE t0."${t.cols.get("idwell")}" IN (${placeholders})${filterWhere}`;

    let raw: Record<string, unknown>[] = [];
    let total = 0;
    try {
      /*
       * THE COUNT CARRIES THE SAME FILTERS AS THE SELECT.
       *
       * It does not need the joins — those are all LEFT and cannot change how
       * many rows t0 has — but it absolutely needs the filters, which are on t0
       * and do. Without them `rowCount` reports the unfiltered size beside a
       * filtered list, so a report showing 28 rows announces 112 and "truncated"
       * turns on for a result that is complete. That is the same class of lie
       * this whole change is closing, pointed the other way.
       */
      total = (d.prepare(
        `SELECT COUNT(*) c FROM "${t.name}" t0`
        + ` WHERE t0."${t.cols.get("idwell")}" IN (${placeholders})${filterWhere}`,
      ).get(...idwells, ...filterArgs) as { c: number }).c;
      raw = d.prepare(`${sql} LIMIT ${rowCap}`).all(...idwells, ...filterArgs) as Record<string, unknown>[];
    } catch {
      return { table: t.name, title: b.title, exists: true, columns: [], missing,
               rows: [], rowCount: 0, truncated: false, schemaDrift: drift, printTimeNote: printTime };
    }

    const columns: MultiColumn[] = [];
    if (lead.length) {
      columns.push({ column: "__wellname", label: columnLabel(WELL_TABLE, "wellname"), fromWell: true });
    }
    for (const r of present) {
      const owner = r.from === "well" ? WELL_TABLE
        : r.from === "link" ? (r.field.source_table ?? t.name) : t.name;
      const mf = modelField(owner, r.actual!);
      columns.push({
        column: r.actual!,
        label: modelTable(owner) ? columnLabel(owner, r.actual!)
          : (r.field.label_interpreted || r.field.column),
        unit: mf?.baseUnit,
        units: mf?.units as Record<string, unknown> | undefined,
        applyDatum: mf?.applyDatum || undefined,
        datumMode: mf?.datumMode,
        fromWell: r.from === "well" || undefined,
      });
    }

    const keys = columns.map((c) => c.column);
    return {
      table: t.name,
      title: b.title,
      exists: true,
      filtersApplied: filterApplied.length ? filterApplied : undefined,
      filtersSkipped: filterSkipped.length ? filterSkipped : undefined,
      columns,
      missing,
      rows: raw.map((row) => keys.map((k) => (row[k] ?? null) as string | number | null)),
      /** Row i belongs to well rowWells[i] — the key to its datum offset. */
      rowWells: raw.map((row) => String(row.__idwell ?? "")),
      rowCount: total,
      truncated: total > raw.length,
      schemaDrift: drift,
      printTimeNote: printTime,
    };
  });

  return { report: tpl.html, name: tpl.name, wells: idwells.length, blocks };
}
