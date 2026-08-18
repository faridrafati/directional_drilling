/**
 * WellView's print-time computations (`wv*Calc`), computed here instead.
 *
 * WellView does not store these tables: it builds them when a report prints.
 * The converted databases therefore contain none of the 110 the model declares,
 * and a report block bound to one has nothing to read. Most of them are plain
 * AGGREGATIONS over tables that ARE stored — cumulative cost, time-log duration
 * by operation code, daily fluid totals, per-phase rollups — so the honest fix
 * is to compute them from the stored rows rather than leave the block empty.
 *
 * A derivation is only registered once its SQL has been run against a real
 * database and its totals reconciled a second way. Anything that cannot be
 * produced from this schema is NOT registered, and the block keeps saying so —
 * a half-right summary of somebody's cost is worse than an honest blank.
 *
 * Every result is labelled `derived: true` all the way to the screen. A number
 * this app computed must never be mistakable for one the database stored.
 */
import type { DatabaseSync } from "node:sqlite";
import { modelTable, modelField, columnLabel } from "./model.js";

/** A field of the calc table that this schema cannot supply, and why. */
export interface UnsupportedField {
  field: string;
  reason: string;
}

export interface CalcDerivation {
  /** The wv*Calc table this produces, in the model's casing. */
  table: string;
  /** Tables the SQL reads; all must exist or the derivation is skipped. */
  sources: string[];
  /**
   * The NAMED bind parameters the SQL takes — `:idwell`, `:idjob`, `:idreport`,
   * `:idphase`. Named rather than positional because these queries use a value
   * more than once (a CTE and the subquery that divides by its total), and a
   * positional rewrite would have to repeat it in the right order every time.
   * `idwell` is always available; the rest come from the report's anchor.
   */
  params: CalcParam[];
  /** SQLite SQL whose output aliases are the calc table's own field names. */
  sql?: string;
  /**
   * For a table that is a PROJECTION of a computation this app already has,
   * rather than an aggregation expressible in SQL. The directional survey is
   * the case in point: its minimum-curvature integration lives in
   * `packages/shared/src/math/survey.ts`, is tested there, and handles the
   * override carry-forward and inclination-only stations. Re-expressing that in
   * a query would be a second implementation to keep right.
   */
  compute?: (d: DatabaseSync, anchor: CalcAnchor) => Record<string, unknown>[];
  /** Fields of the calc table this query deliberately does not fill. */
  unsupported?: UnsupportedField[];
  /** How the figures were checked, for the record. */
  verifiedBy?: string;
}

export type CalcParam = "idwell" | "idjob" | "idreport" | "idphase";

export interface CalcAnchor {
  idwell: string;
  idjob?: string | null;
  idreport?: string | null;
  idphase?: string | null;
}

export interface CalcColumn {
  column: string;
  label: string;
  unit?: string;
  units?: Record<string, unknown>;
  /** Always true here: every column of a calc table is computed. */
  computed: true;
}

export interface CalcResult {
  table: string;
  columns: CalcColumn[];
  rows: Record<string, unknown>[];
  rowCount: number;
  /** Fields the model declares that this derivation does not produce. */
  unsupported: UnsupportedField[];
  verifiedBy?: string;
}

/** Registered derivations, keyed by lowercased table name. */
const REGISTRY = new Map<string, CalcDerivation>();

export function registerCalc(...ds: CalcDerivation[]): void {
  for (const d of ds) REGISTRY.set(d.table.toLowerCase(), d);
}

export const calcDerivation = (table: string): CalcDerivation | undefined =>
  REGISTRY.get(table.toLowerCase());

export const derivableCalcTables = (): string[] =>
  [...REGISTRY.values()].map((d) => d.table).sort();

/**
 * Which scope a derivable table is still missing.
 *
 * A time-log summary is per JOB and a daily cost summary per REPORT, so with
 * no job picked in the report toolbar there is nothing to summarise. That is
 * not the same as "WellView computes this and we cannot", and telling the two
 * apart is the difference between a dead block and one the user can fill by
 * choosing a job — so the block says which selection it is waiting for.
 */
export function calcMissingScope(table: string, anchor: CalcAnchor): CalcParam[] {
  const d = calcDerivation(table);
  if (!d) return [];
  return d.params.filter((p) => {
    const v = p === "idwell" ? anchor.idwell
      : p === "idjob" ? anchor.idjob
      : p === "idreport" ? anchor.idreport
      : anchor.idphase;
    return v == null || v === "";
  });
}

/**
 * Run a calc table's derivation.
 *
 * Returns null when there is no derivation, when a source table is missing from
 * this particular database, or when the anchor lacks a parameter the SQL needs.
 * The caller then reports the block as WellView-computed-at-print-time, exactly
 * as before — never a silently empty table.
 */
export function computeCalc(
  d: DatabaseSync,
  table: string,
  anchor: CalcAnchor,
  rowCap = 500,
): CalcResult | null {
  const derivation = calcDerivation(table);
  if (!derivation) return null;

  // Source tables are checked per database: the two sample databases do not
  // carry the same tables, and a missing one must skip, not throw.
  const present = new Set(
    (d.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[])
      .map((r) => r.name.toLowerCase()),
  );
  const missing = derivation.sources.filter((s) => !present.has(s.toLowerCase()));
  if (missing.length) return null;

  const args: Record<string, string> = {};
  for (const p of derivation.params) {
    const v = p === "idwell" ? anchor.idwell
      : p === "idjob" ? anchor.idjob
      : p === "idreport" ? anchor.idreport
      : anchor.idphase;
    // A missing scope must SKIP. Binding it as NULL would still return rows —
    // a summary of nothing, indistinguishable on screen from a summary.
    if (v == null || v === "") return null;
    args[p] = v;
  }

  let rows: Record<string, unknown>[];
  try {
    rows = derivation.compute
      ? derivation.compute(d, anchor).slice(0, rowCap)
      : d.prepare(`${derivation.sql} LIMIT ${rowCap}`).all(args) as Record<string, unknown>[];
  } catch {
    // A derivation that does not run against this database is not a crash:
    // fall back to the honest "computed by WellView at print time" block.
    return null;
  }

  const keys = rows.length ? Object.keys(rows[0]) : columnsOf(derivation);
  return {
    table: derivation.table,
    columns: keys.map((k) => {
      const f = modelField(derivation.table, k);
      return {
        column: k,
        label: f ? columnLabel(derivation.table, k) : k,
        unit: f?.baseUnit,
        units: f?.units as Record<string, unknown> | undefined,
        computed: true as const,
      };
    }),
    rows,
    rowCount: rows.length,
    unsupported: derivation.unsupported ?? [],
    verifiedBy: derivation.verifiedBy,
  };
}

/** Output aliases, read off the SELECT list when a query returns no rows. */
function columnsOf(d: CalcDerivation): string[] {
  const t = modelTable(d.table);
  return t ? Object.keys(t.fields) : [];
}
