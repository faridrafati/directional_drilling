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
export interface MultiTemplate {
  html: string;
  name: string;
  folder?: string;
  format_version?: number;
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

    const sel = present.map((r) => `${r.alias}."${r.actual}"`);
    const placeholders = idwells.map(() => "?").join(", ");
    const sql = `SELECT ${[...lead, idwellSel, ...sel].join(", ")}
                   FROM "${t.name}" t0${wellJoin}${linkJoins}
                  WHERE t0."${t.cols.get("idwell")}" IN (${placeholders})`;

    let raw: Record<string, unknown>[] = [];
    let total = 0;
    try {
      total = (d.prepare(
        `SELECT COUNT(*) c FROM "${t.name}" t0 WHERE t0."${t.cols.get("idwell")}" IN (${placeholders})`,
      ).get(...idwells) as { c: number }).c;
      raw = d.prepare(`${sql} LIMIT ${rowCap}`).all(...idwells) as Record<string, unknown>[];
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
