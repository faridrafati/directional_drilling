/**
 * The `.afmxl` Excel-report data extracts.
 *
 * WellView's Excel reports come in two files: an `.afmxl` naming the rows and
 * columns to pull, and an `.xlt` workbook that turns them into pivot tables and
 * charts. This produces the FIRST half — the same extract WellView would hand
 * to Excel, for the wells the user selected — and says plainly that the
 * workbook is not reproduced. Offering pivots that were never rebuilt would be
 * a worse outcome than an honest table with a CSV download.
 *
 * Eight of the 25 extracts read from wv*Calc tables (`wvJTLSumCalc`,
 * `wvJCostCumCalc`, `wvJPPCostCalc`…), which WellView computes at print time
 * and stores nowhere. Those work here because the app now computes them —
 * see `calc.ts`. Where a derivation needs a job or report scope the extract
 * cannot supply, that table is reported unavailable rather than left blank.
 */
import type { DatabaseSync } from "node:sqlite";
import { columnLabel, modelField, modelTable } from "./model.js";
import { computeCalc, calcDerivation } from "./calc.js";

export interface XlField {
  column: string;
  source_table: string;
  label_interpreted?: string | null;
}
export interface XlCriterion { table: string; field: string; value: string }
export interface XlTemplate {
  html: string;
  name: string;
  folder: string;
  table: string;
  title: string;
  fields: XlField[];
  criteria: XlCriterion[];
  filterUnread: boolean;
  empty: boolean;
  hasWorkbook: boolean;
}

export interface XlColumn {
  column: string;
  label: string;
  unit?: string;
  units?: Record<string, unknown>;
  fromWell?: boolean;
  /** Computed here because WellView computes it at print time. */
  computed?: boolean;
}

export interface XlResult {
  report: string;
  name: string;
  table: string;
  wells: number;
  columns: XlColumn[];
  rows: (string | number | null)[][];
  rowCount: number;
  truncated: boolean;
  missing: string[];
  /** Criteria actually applied. */
  applied: XlCriterion[];
  notes: string[];
}

const WELL = "wvwellheader";

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

export function resolveXlExtract(
  d: DatabaseSync,
  tpl: XlTemplate,
  idwells: string[],
  rowCap = 5000,
): XlResult {
  const notes: string[] = [];
  if (tpl.hasWorkbook) {
    notes.push("This is the data extract only. The paired Excel workbook — its pivot tables, "
      + "charts and formatting — is not reproduced here.");
  }
  if (tpl.filterUnread) {
    notes.push("This template carries a row filter this reader could not decode, so it has NOT "
      + "been applied: you may be seeing more rows than WellView would show.");
  }

  const base: XlResult = {
    report: tpl.html, name: tpl.name, table: tpl.table, wells: idwells.length,
    columns: [], rows: [], rowCount: 0, truncated: false, missing: [],
    applied: [], notes,
  };
  if (tpl.empty || !tpl.fields.length || idwells.length === 0) return base;

  const tname = tpl.table.toLowerCase();

  // A calc root is COMPUTED, not read.
  //
  // Most of these derivations are scoped to a job or a daily report, not a
  // well — a "Job Time Log Summary" is per job by definition. An extract over a
  // set of wells therefore has to run the derivation once per job (or per
  // report) of each well and concatenate, which is exactly what a multi-well
  // extract of a per-job table means. Passing only the well would make
  // computeCalc skip, and eight of these extracts would return nothing at all.
  if (/calc$/.test(tname)) {
    const der = calcDerivation(tpl.table);
    const rows: Record<string, unknown>[] = [];
    let columns: XlColumn[] = [];
    let unavailable = 0;

    const scopesFor = (idwell: string): { idwell: string; idjob?: string; idreport?: string }[] => {
      if (!der) return [{ idwell }];
      try {
        if (der.params.includes("idreport")) {
          return (d.prepare(
            `SELECT r.IDRec AS id FROM wvJobReport r WHERE r.idwell = ?`).all(idwell) as { id: string }[])
            .map((x) => ({ idwell, idreport: x.id }));
        }
        if (der.params.includes("idjob")) {
          return (d.prepare(
            `SELECT j.IDRec AS id FROM wvJob j WHERE j.idwell = ?`).all(idwell) as { id: string }[])
            .map((x) => ({ idwell, idjob: x.id }));
        }
      } catch { /* fall through to the plain well scope */ }
      return [{ idwell }];
    };

    for (const idwell of idwells) {
      const name = wellNameOf(d, idwell);
      const scopes = scopesFor(idwell);
      let any = false;
      for (const scope of scopes) {
        if (rows.length >= rowCap) break;
        const got = computeCalc(d, tpl.table, scope, rowCap);
        if (!got?.rowCount) continue;
        any = true;
        if (!columns.length) columns = got.columns.map((c) => ({ ...c, computed: true }));
        for (const r of got.rows) rows.push({ __wellname: name, ...r });
      }
      if (!any) unavailable++;
    }
    if (unavailable) {
      notes.push(`${unavailable} of ${idwells.length} wells produced no rows for this computed `
        + "table — they have no jobs or reports it applies to.");
    }
    if (!columns.length) return { ...base, notes };
    const cols: XlColumn[] = [{ column: "__wellname", label: "Well Name" }, ...columns];
    const keys = cols.map((c) => c.column);
    return {
      ...base,
      columns: cols,
      rows: rows.slice(0, rowCap).map((r) => keys.map((k) => (r[k] ?? null) as string | number | null)),
      rowCount: rows.length,
      truncated: rows.length > rowCap,
      notes,
    };
  }

  const sch = schemaOf(d);
  const t = sch.get(tname);
  const well = sch.get(WELL);
  if (!t || !t.cols.has("idwell")) {
    notes.push(`${tpl.table} is not a table in this database.`);
    return { ...base, notes };
  }

  const resolved = tpl.fields.map((f) => {
    const lc = f.column.toLowerCase();
    const src = (f.source_table || tname).toLowerCase();
    if (src === WELL && well?.cols.has(lc)) return { f, actual: well.cols.get(lc)!, from: "w" };
    if (t.cols.has(lc)) return { f, actual: t.cols.get(lc)!, from: "t0" };
    if (well?.cols.has(lc)) return { f, actual: well.cols.get(lc)!, from: "w" };
    return { f, actual: null, from: "" };
  });
  const present = resolved.filter((r) => r.actual);
  const missing = resolved.filter((r) => !r.actual).map((r) => r.f.column);
  if (!present.length) {
    notes.push("None of this extract's columns exist in this database.");
    return { ...base, missing, notes };
  }

  const wellJoin = well
    ? ` LEFT JOIN "${well.name}" w ON w."${well.cols.get("idwell")}" = t0."${t.cols.get("idwell")}"`
    : "";
  const preds = [`t0."${t.cols.get("idwell")}" IN (${idwells.map(() => "?").join(", ")})`];
  const args: string[] = [...idwells];

  // Only criteria naming a column this database actually has are applied; the
  // rest are reported, never silently dropped.
  const applied: XlCriterion[] = [];
  for (const c of tpl.criteria) {
    const col = c.table.toLowerCase() === tname ? t.cols.get(c.field.toLowerCase()) : undefined;
    if (!col) { notes.push(`Filter on ${c.table}.${c.field} could not be applied — not a column here.`); continue; }
    // WellView's own filter here is a case-insensitive prefix match ("drill"
    // selects "Drilling"), which is why the shipped values are abbreviations.
    preds.push(`lower(t0."${col}") LIKE ?`);
    args.push(`${c.value.toLowerCase()}%`);
    applied.push(c);
  }

  const printsWell = present.some((r) => r.from === "w" && r.actual!.toLowerCase() === "wellname");
  const lead = !printsWell && well?.cols.has("wellname")
    ? [`w."${well.cols.get("wellname")}" AS __wellname`] : [];
  const sel = present.map((r) => `${r.from}."${r.actual}"`);
  const where = ` WHERE ${preds.join(" AND ")}`;

  let raw: Record<string, unknown>[] = [];
  let total = 0;
  try {
    total = (d.prepare(`SELECT COUNT(*) c FROM "${t.name}" t0${wellJoin}${where}`).get(...args) as { c: number }).c;
    raw = d.prepare(
      `SELECT ${[...lead, ...sel].join(", ")} FROM "${t.name}" t0${wellJoin}${where} LIMIT ${rowCap}`,
    ).all(...args) as Record<string, unknown>[];
  } catch {
    notes.push("This extract could not be run against this database.");
    return { ...base, missing, applied, notes };
  }

  const columns: XlColumn[] = [];
  if (lead.length) columns.push({ column: "__wellname", label: columnLabel(WELL, "wellname"), fromWell: true });
  for (const r of present) {
    const owner = r.from === "w" ? WELL : t.name;
    const mf = modelField(owner, r.actual!);
    columns.push({
      column: r.actual!,
      label: modelTable(owner) ? columnLabel(owner, r.actual!) : (r.f.label_interpreted || r.f.column),
      unit: mf?.baseUnit,
      units: mf?.units as Record<string, unknown> | undefined,
      fromWell: r.from === "w" || undefined,
    });
  }
  const keys = columns.map((c) => c.column);
  return {
    ...base,
    columns,
    rows: raw.map((row) => keys.map((k) => (row[k] ?? null) as string | number | null)),
    rowCount: total,
    truncated: total > raw.length,
    missing,
    applied,
    notes,
  };
}

function wellNameOf(d: DatabaseSync, idwell: string): string {
  try {
    const r = d.prepare("SELECT WellName FROM wvWellHeader WHERE idwell = ?").get(idwell) as { WellName?: string };
    return r?.WellName ?? idwell;
  } catch { return idwell; }
}
