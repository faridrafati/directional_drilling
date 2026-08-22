/**
 * Calculated FIELDS on stored tables — WellView's green cells.
 *
 * The model marks 1,810 fields `calculated`. 944 of them live on wv*Calc
 * tables, which `calc.ts` already builds; the other 866 sit on ordinary stored
 * tables and have no column in a converted database at all, because WellView
 * works them out when a report prints. Until now the app simply dropped them,
 * which is why a report block could print a column of nothing and Edit Data
 * never showed a green field.
 *
 * WHAT THIS DOES AND, MORE IMPORTANTLY, WHAT IT REFUSES
 * ----------------------------------------------------
 * 604 of the 866 state an equation in their own help text — "EQN: <a> - <b>".
 * That is a specification, but it is prose written for a human, and most of it
 * cannot be executed safely: "Sum of <child.field> for all sections", "Maximum
 * <x>", conditionals with join predicates. Guessing at those would put wrong
 * numbers on a page that looks checked, which is worse than a blank.
 *
 * So this handles exactly one shape and rejects everything else:
 *
 *   - the equation is ONLY field references, + - * / ( ) and a full stop
 *   - every reference names a field of the SAME table as the target
 *   - every reference AND the target are numeric (double or integer)
 *   - any reference that is itself calculated must also be computable here
 *
 * 90 fields have that shape; 20 survive every check, across 9 tables — rate of
 * penetration, depth drilled, drag up and down, zone and formation thickness,
 * the KB-to-datum differences, and the AFE cost variances.
 *
 * The other 70 are refused, and the two reasons are worth knowing:
 *
 *   - 14 fail the NUMERIC guard, which is not defensive dressing. Without it
 *     `wvWellHeader.OtherToCasCalc` executes its own stated equation,
 *     `<wvwellheader.IDRecElvHistory> - <wvwellheader.ElvCasFlange>` — an
 *     elevation subtracted from a record GUID — and produces a number. Three
 *     others would have done arithmetic on datetimes.
 *
 *   - 71 fail the CHAIN rule: their inputs are themselves calculated, and
 *     aggregates rather than arithmetic (`wvJob.CostTotalCalc` is "Sum of
 *     <wvJobReport.CostTotalCalc>"). Admitting them would advertise a column
 *     that is always blank. This is also where the leverage is: teaching the
 *     evaluator the "Sum of <child.field>" form would unlock most of them.
 *
 * A null input yields a null result, never zero: WellView leaves the cell
 * blank, and a zero would read as a measurement.
 */
import { modelField, modelTable, modelLoaded, allModelTables } from "./model.js";

/** Physical types this module is willing to do arithmetic on. */
const NUMERIC = new Set(["double", "integer"]);

/** One parsed, executable field equation. */
export interface CalcField {
  /** Table the field belongs to, as the model spells it. */
  table: string;
  /** The calculated field's own name. */
  field: string;
  /** The model's caption, for a column heading. */
  label: string;
  /** The equation as the model states it, for the tooltip. */
  eqn: string;
  /** Column names this needs from the row, lowercased. */
  needs: string[];
  /** Evaluate against one row; null when any input is missing. */
  compute: (row: Record<string, unknown>) => number | null;
}

// ── a very small expression language ─────────────────────────────────────────

type Tok =
  | { k: "ref"; table: string; field: string }
  | { k: "op"; v: "+" | "-" | "*" | "/" }
  | { k: "("; }
  | { k: ")"; };

/**
 * Tokenise "…<a.b> - <c.d>…", refusing anything that is not the shape above.
 *
 * Returns null on the first unexpected character rather than skipping it — a
 * tokeniser that ignores what it does not understand silently changes the
 * equation it is executing.
 */
function tokenise(eqn: string): Tok[] | null {
  const out: Tok[] = [];
  let i = 0;
  const s = eqn.trim().replace(/\.\s*$/, "");
  while (i < s.length) {
    const c = s[i];
    if (c === " " || c === "\t") { i++; continue; }
    if (c === "(") { out.push({ k: "(" }); i++; continue; }
    if (c === ")") { out.push({ k: ")" }); i++; continue; }
    if (c === "+" || c === "-" || c === "*" || c === "/") {
      out.push({ k: "op", v: c }); i++; continue;
    }
    if (c === "<") {
      const close = s.indexOf(">", i);
      if (close < 0) return null;
      const inner = s.slice(i + 1, close);
      const dot = inner.indexOf(".");
      if (dot <= 0) return null;
      out.push({ k: "ref", table: inner.slice(0, dot), field: inner.slice(dot + 1) });
      i = close + 1;
      continue;
    }
    return null;                                     // anything else: refuse
  }
  return out.length ? out : null;
}

type Node =
  | { k: "ref"; col: string }
  | { k: "bin"; op: "+" | "-" | "*" | "/"; l: Node; r: Node };

/**
 * Recursive descent over the tokens, with the usual precedence.
 *
 * Deliberately has no unary minus, no numeric literals and no functions: none
 * of the 90 accepted equations uses one, and adding them would widen what this
 * silently accepts without widening what it has been checked against.
 */
function parse(toks: Tok[]): Node | null {
  let p = 0;
  const peek = () => toks[p];

  const primary = (): Node | null => {
    const t = peek();
    if (!t) return null;
    if (t.k === "ref") { p++; return { k: "ref", col: t.field.toLowerCase() }; }
    if (t.k === "(") {
      p++;
      const inner = expr();
      if (!inner || peek()?.k !== ")") return null;
      p++;
      return inner;
    }
    return null;
  };

  const term = (): Node | null => {
    let left = primary();
    if (!left) return null;
    for (;;) {
      const t = peek();
      if (t?.k !== "op" || (t.v !== "*" && t.v !== "/")) return left;
      p++;
      const right = primary();
      if (!right) return null;
      left = { k: "bin", op: t.v, l: left, r: right };
    }
  };

  const expr = (): Node | null => {
    let left = term();
    if (!left) return null;
    for (;;) {
      const t = peek();
      if (t?.k !== "op" || (t.v !== "+" && t.v !== "-")) return left;
      p++;
      const right = term();
      if (!right) return null;
      left = { k: "bin", op: t.v, l: left, r: right };
    }
  };

  const root = expr();
  return root && p === toks.length ? root : null;
}

/** Evaluate, propagating null: a missing input makes the whole result blank. */
function evaluate(n: Node, row: Record<string, unknown>): number | null {
  if (n.k === "ref") {
    const v = row[n.col];
    if (v == null || v === "") return null;
    const x = Number(v);
    return Number.isFinite(x) ? x : null;
  }
  const l = evaluate(n.l, row);
  if (l === null) return null;
  const r = evaluate(n.r, row);
  if (r === null) return null;
  switch (n.op) {
    case "+": return l + r;
    case "-": return l - r;
    case "*": return l * r;
    // Division by zero is not an error in a spreadsheet sense — it is a blank.
    case "/": return r === 0 ? null : l / r;
  }
}

// ── the registry ─────────────────────────────────────────────────────────────

let _registry: Map<string, CalcField[]> | null = null;

/** The equation stated in a field's help text, if it states one. */
function eqnOf(help: string | undefined): string | null {
  if (!help) return null;
  const m = help.match(/EQN\s*:?\s*([\s\S]*)$/i);
  const e = m?.[1]?.replace(/\s+/g, " ").trim();
  return e || null;
}

/**
 * Every field this module can compute, by lowercased table name.
 *
 * Built once from the model. A field is admitted only if it survives every
 * check; the count is asserted in the tests so that a model change which
 * silently widens or narrows the set has to be looked at.
 */
export function calcFields(): Map<string, CalcField[]> {
  if (_registry) return _registry;
  const reg = new Map<string, CalcField[]>();
  const m = allModelTables();

  // First pass: which calculated fields are candidates at all. A reference to
  // another calculated field is only allowed if that one is a candidate too,
  // so the second pass can drop chains that end somewhere uncomputable.
  const candidate = new Map<string, { table: string; field: string; eqn: string; toks: Tok[] }>();
  for (const [tLc, t] of Object.entries(m)) {
    if (/calc$/.test(tLc)) continue;                 // wv*Calc tables: calc.ts
    for (const [fLc, f] of Object.entries(t.fields)) {
      if (!f.calculated) continue;
      const eqn = eqnOf(f.help);
      if (!eqn) continue;
      const toks = tokenise(eqn);
      if (!toks) continue;
      // Same table only: a cross-table reference needs a join this does not do.
      if (!toks.every((x) => x.k !== "ref" || x.table.toLowerCase() === tLc)) continue;
      if (!NUMERIC.has(f.type ?? "")) continue;
      // The model keys fields lowercased and does not keep the source casing;
      // these fields have no column in the database, so the key IS the name.
      candidate.set(`${tLc}.${fLc}`, { table: t.table, field: fLc, eqn, toks });
    }
  }

  for (const [key, c] of candidate) {
    const tLc = key.slice(0, key.indexOf("."));
    const refs = c.toks.filter((x): x is Extract<Tok, { k: "ref" }> => x.k === "ref");
    // Every input must be numeric, and a calculated input must itself be one
    // of these — otherwise the value would always be null and the column would
    // advertise something this can never fill.
    const ok = refs.every((r) => {
      const mf = modelField(r.table, r.field);
      if (!mf || !NUMERIC.has(mf.type ?? "")) return false;
      if (mf.calculated) return candidate.has(`${r.table.toLowerCase()}.${r.field.toLowerCase()}`);
      return true;
    });
    if (!ok) continue;
    const ast = parse(c.toks);
    if (!ast) continue;
    const mf = modelField(c.table, c.field);
    const entry: CalcField = {
      table: c.table,
      field: c.field,
      label: mf?.label ?? c.field,
      eqn: c.eqn,
      needs: [...new Set(refs.map((r) => r.field.toLowerCase()))],
      compute: (row) => evaluate(ast, row),
    };
    const list = reg.get(tLc) ?? [];
    list.push(entry);
    reg.set(tLc, list);
  }
  _registry = reg;
  return reg;
}

/** The computable calculated fields of one table, or an empty list. */
export function calcFieldsFor(table: string): CalcField[] {
  return calcFields().get(table.toLowerCase()) ?? [];
}

/** Total across every table — the number the tests pin. */
export function calcFieldCount(): number {
  let n = 0;
  for (const list of calcFields().values()) n += list.length;
  return n;
}

/**
 * Fill a row's computable calculated fields in place, keyed by field name.
 *
 * The row must already carry the columns each equation needs; `needs` says
 * which. Values that cannot be computed are left absent rather than set to
 * null, so a caller can tell "not computed here" from "computed as blank".
 */
export function computeRow(
  table: string,
  row: Record<string, unknown>,
  into: Record<string, number | null> = {},
): Record<string, number | null> {
  const work = lowerKeys(row);
  for (const cf of orderedFor(table)) {
    const v = cf.compute(work);
    // Feed the result back in: ROPCalc is "<DepthDrilledCalc> / <TmDrill>" and
    // DepthDrilledCalc is itself derived, so evaluating them independently
    // leaves ROP permanently blank — a column that advertises a value it can
    // never produce, which is worse than not offering it.
    work[cf.field.toLowerCase()] = v;
    if (v !== null) into[cf.field] = v;
  }
  return into;
}

/**
 * A table's computable fields in dependency order.
 *
 * A plain topological sort: a field goes after every field it reads. The model
 * has no cycles here, but one would simply leave the remaining fields at the
 * end, where they evaluate to null rather than looping.
 */
const _ordered = new Map<string, CalcField[]>();
function orderedFor(table: string): CalcField[] {
  const key = table.toLowerCase();
  const hit = _ordered.get(key);
  if (hit) return hit;
  const list = calcFieldsFor(table);
  const byName = new Map(list.map((c) => [c.field.toLowerCase(), c]));
  const out: CalcField[] = [];
  const state = new Map<string, "visiting" | "done">();
  const visit = (cf: CalcField) => {
    const n = cf.field.toLowerCase();
    if (state.get(n)) return;                 // done, or already on the stack
    state.set(n, "visiting");
    for (const need of cf.needs) {
      const dep = byName.get(need);
      if (dep && dep !== cf) visit(dep);
    }
    state.set(n, "done");
    out.push(cf);
  };
  for (const cf of list) visit(cf);
  _ordered.set(key, out);
  return out;
}

/** A table's computable fields, in the order `computeRow` evaluates them. */
export function calcFieldsOrdered(table: string): CalcField[] {
  return orderedFor(table);
}

/** A row keyed by lowercase column name, since SQLite preserves the schema's case. */
function lowerKeys(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) out[k.toLowerCase()] = v;
  return out;
}

/** Reset the cache — tests only. */
export function _resetCalcFields(): void { _registry = null; _ordered.clear(); }

/** Whether the model even loaded; callers skip the whole feature if not. */
export function calcFieldsAvailable(): boolean {
  return modelLoaded();
}

export { modelTable };
