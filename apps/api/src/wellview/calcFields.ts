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

// ── aggregates over child rows ───────────────────────────────────────────────

/**
 * One "Sum of <child.field>" equation.
 *
 * WellView writes both "Sum of" and "Cum of" for this shape and they mean the
 * same thing here — the total over every child row. "Cum" carries its running
 * sense only when the reference is to the field's OWN table, an ordered
 * sibling total (`wvJobProgramPhase.CostMLCumCalc` is "Cum of
 * <wvjobprogramphase.costml>"), which is a different computation and is
 * refused rather than approximated. daysVsDepth.ts does that one where the
 * ordering is known.
 */
export interface CalcAggregate {
  table: string;
  field: string;
  label: string;
  eqn: string;
  /** The child table summed, as the model spells it. */
  childTable: string;
  /** The child's column, lowercased. */
  childField: string;
  /** True when the child column is itself calculated and computed here. */
  childCalculated: boolean;
}

let _aggregates: Map<string, CalcAggregate[]> | null = null;

/** "Sum of <a.b>" / "Cum of <a.b>" and nothing else. */
const AGG_RE = /^(?:sum|cum|total)\s+of\s+<([a-z0-9_]+)\.([a-z0-9_]+)>\s*\.?$/i;

/**
 * Child-table names the model gets wrong, resolved by hand.
 *
 * One entry, and it stays one entry. See the comment at the point of use for
 * why a general prefix rule was measured and rejected.
 */
const CHILD_ALIAS: Record<string, string> = {
  wvjobservicecontractevaldata: "wvjobservicecontracteval",
};

/**
 * The aggregates this module can compute, by lowercased parent table.
 *
 * Same discipline as the arithmetic: one shape, everything else refused. The
 * child must DESCEND from the parent by WellView's table-name prefix rule, both
 * ends must be numeric, and a child column that is itself calculated must be
 * one this module can produce — otherwise the total would always be blank and
 * the column would advertise a value it cannot fill.
 */
export function calcAggregates(): Map<string, CalcAggregate[]> {
  if (_aggregates) return _aggregates;
  const reg = new Map<string, CalcAggregate[]>();
  const tabs = allModelTables();
  const arith = calcFields();
  const computableArith = (tLc: string, fLc: string) =>
    (arith.get(tLc) ?? []).some((c) => c.field.toLowerCase() === fLc);

  for (const [tLc, t] of Object.entries(tabs)) {
    if (/calc$/.test(tLc)) continue;
    for (const [fLc, f] of Object.entries(t.fields)) {
      if (!f.calculated || !f.help) continue;
      if (!NUMERIC.has(f.type ?? "")) continue;
      /*
       * Some help texts state the aggregate WITHOUT the "EQN:" marker —
       * wvJobServiceContract.ScoreCalc is simply "Sum of
       * <wvJobServiceContractEvalData.Score>". eqnOf looks for the marker and
       * returns null, so the shape test below was never reached.
       *
       * The fallback is applied HERE and not inside eqnOf, so it cannot leak
       * into the arithmetic path. AGG_RE is anchored at both ends and the
       * descendant guard still runs, so a whole-help match cannot admit
       * anything the marked form would not. Measured: exactly 6 fields in the
       * model gain admission this way.
       */
      const whole = f.help.replace(/\s+/g, " ").trim();
      const eqn = eqnOf(f.help) ?? (AGG_RE.test(whole) ? whole : null);
      const m = eqn?.match(AGG_RE);
      if (!eqn || !m) continue;
      let childLc = m[1].toLowerCase();
      const colLc = m[2].toLowerCase();
      /*
       * ONE name in the model points at a table that does not exist.
       *
       * wvJobServiceContract.ScoreCalc and ScoreMaxCalc both name
       * wvJobServiceContractEvalData, which is in neither the model's 357
       * tables nor any converted database. The real child is
       * wvJobServiceContractEval, whose Score and ScoreMax are the stored
       * doubles the sum is over. A typo in Peloton's own model, and the
       * difference between 29 rated contracts and 29 blank ones.
       *
       * An explicit one-entry map, NOT a general rule. The obvious general
       * rule — resolve a dangling name to the longest model table that is a
       * strict prefix of it — was measured against all 13 dangling names in
       * the model: it produces exactly these same two entries and MIS-resolves
       * five others (wvJobServiceEvalData would become wvJob). It would buy
       * nothing and arm a future model change.
       */
      if (!tabs[childLc]) childLc = CHILD_ALIAS[childLc] ?? childLc;
      // Prefix-descendant, and not the table itself: a self-reference is the
      // running-total sense, not a child total.
      if (childLc === tLc || !childLc.startsWith(tLc) || !tabs[childLc]) continue;
      const cf = modelField(childLc, colLc);
      if (!cf || !NUMERIC.has(cf.type ?? "")) continue;
      if (cf.calculated && !computableArith(childLc, colLc)) continue;
      const list = reg.get(tLc) ?? [];
      list.push({
        table: t.table,
        field: fLc,
        label: f.label ?? fLc,
        // The RESOLVED name, so a tooltip never quotes a table that does not
        // exist while the query reads one that does.
        eqn: eqn.replace(new RegExp(`<${m[1]}\\.`, "i"), `<${tabs[childLc].table}.`),
        childTable: tabs[childLc].table,
        childField: colLc,
        childCalculated: !!cf.calculated,
      });
      reg.set(tLc, list);
    }
  }
  _aggregates = reg;
  return reg;
}

/** The aggregates of one table, or an empty list. */
export function calcAggregatesFor(table: string): CalcAggregate[] {
  return calcAggregates().get(table.toLowerCase()) ?? [];
}

/** Total across every table — pinned by the tests. */
export function calcAggregateCount(): number {
  let n = 0;
  for (const l of calcAggregates().values()) n += l.length;
  return n;
}

/** What `sumChildren` needs of a database handle: one prepared query. */
export interface AggQuery {
  prepare(sql: string): { all(...args: unknown[]): unknown[] };
}

/**
 * Total each aggregate over its child rows, for a whole page of parents at once.
 *
 * ONE query per aggregate, grouped by the parent id — not one per row. A grid of
 * 200 records would otherwise issue 200 queries per column, which is the kind of
 * thing that works on a sample database and falls over on a real one.
 *
 * A child column that is itself calculated cannot be summed in SQL, because it
 * has no column: those rows are read and the arithmetic evaluator runs over each
 * before adding it up.
 *
 * Returns a map of parent IDRec → { field → total }. A parent with no child rows
 * is ABSENT rather than zero: WellView leaves the cell blank, and a nil total
 * reads as "nothing was spent" rather than "nothing was entered".
 */
export function sumChildren(
  db: AggQuery,
  table: string,
  idwell: string,
  parentIds: string[],
): Map<string, Record<string, number>> {
  return sumChildrenDetailed(db, table, idwell, parentIds).totals;
}

/**
 * The same totals, plus HOW MANY child values each one is made of.
 *
 * The count is not bookkeeping. SQL's SUM ignores a null quietly, so two sums
 * over two separately-nullable columns of the same child can silently cover
 * different rows: a contractor evaluated on three criteria but scored on only
 * two yields Score over two rows and ScoreMax over three. Each total is a
 * correct answer to "sum of what is there"; their RATIO is not a rating of
 * anything, and the only way to know is to compare the counts.
 *
 * Nothing in the sample exercises it — Score and ScoreMax are both present on
 * all 91 evaluation rows — which is exactly why it is measured rather than
 * assumed.
 */
export function sumChildrenDetailed(
  db: AggQuery,
  table: string,
  idwell: string,
  parentIds: string[],
): { totals: Map<string, Record<string, number>>; counts: Map<string, Record<string, number>> } {
  const out = new Map<string, Record<string, number>>();
  const counts = new Map<string, Record<string, number>>();
  const aggs = calcAggregatesFor(table);
  if (!aggs.length || !parentIds.length) return { totals: out, counts };
  const ids = [...new Set(parentIds.filter(Boolean))];
  if (!ids.length) return { totals: out, counts };
  const holes = ids.map(() => "?").join(", ");

  for (const a of aggs) {
    const bump = (m: Map<string, Record<string, number>>, parent: string, v: number) => {
      const rec = m.get(parent) ?? {};
      rec[a.field] = (rec[a.field] ?? 0) + v;
      m.set(parent, rec);
    };
    const add = (parent: string, v: number) => {
      if (!Number.isFinite(v)) return;
      bump(out, parent, v);
    };
    try {
      if (!a.childCalculated) {
        for (const r of db.prepare(
          `SELECT "IDRecParent" AS p, SUM("${a.childField}") AS s, COUNT("${a.childField}") AS n
             FROM "${a.childTable}" WHERE idwell = ? AND "IDRecParent" IN (${holes})
            GROUP BY "IDRecParent"`).all(idwell, ...ids) as { p: string; s: number | null; n: number }[]) {
          if (r.s != null) { add(String(r.p), Number(r.s)); bump(counts, String(r.p), Number(r.n)); }
        }
      } else {
        // The child value is computed, so the rows have to be read and each one
        // evaluated before the total means anything.
        for (const r of db.prepare(
          `SELECT * FROM "${a.childTable}" WHERE idwell = ? AND "IDRecParent" IN (${holes})`)
          .all(idwell, ...ids) as Record<string, unknown>[]) {
          const v = computeRow(a.childTable, r)[a.childField];
          if (v != null) { add(String(r.IDRecParent ?? ""), v); bump(counts, String(r.IDRecParent ?? ""), 1); }
        }
      }
    } catch {
      // A table or column this database does not have: the field stays absent,
      // which is the same answer as "nothing to total".
    }
  }
  return { totals: out, counts };
}

/* ───────────────────────── most recent child by date ───────────────────────── */

/**
 * "The value on the child row that is most recent by date."
 *
 * A third shape, kept separate from the arithmetic and from the totals because
 * it is neither: nothing is added and nothing is evaluated — one child row is
 * chosen and one of its values is read.
 *
 * WellView calls it out in prose rather than in an EQN clause, so the help text
 * is the specification: "Most recent status by date. EQN: <wvzonestatus.status>."
 *
 * WHICH DATE ORDERS THE CHILDREN. If the referenced field is itself a datetime,
 * it orders itself — "Latest date/time … <child.dttmend>" is the maximum of
 * that column and nothing else is involved. Otherwise the child's own `DtTm`
 * orders it, which is the column WellView puts on every history table for
 * exactly this purpose.
 *
 * WHAT IS REFUSED, and why each refusal matters:
 *
 *   - Any help carrying a CONDITION or a second term — "If <…depthtop> and
 *     <…depthbtm> are populated, they are included", "excludes drilling
 *     parameters that…", "Latest date from <a> or <b>", "… + <RecurFrequency>".
 *     Each changes the answer, and a plain most-recent pick would be confidently
 *     wrong rather than blank. wvPerforation.CurrentStatusCalc is the one that
 *     costs something: two perforations in the sample carry statuses over more
 *     than one depth interval, so their current status is not a single value.
 *   - A child that is not a prefix DESCENDANT. A bit's runs hang off it by
 *     record link, not by name, so wvJobDrillBit's "latest run" is a different
 *     lookup and is left alone.
 *   - A tie. Two children with the same date leave the answer undefined, so
 *     none is given rather than one picked by row order.
 *   - A child with no date at all. 33 of the 50 perforations that have statuses
 *     have no date on any of them; "most recent" cannot be answered there, and
 *     an arbitrary pick would read as a fact.
 */
export interface CalcLatest {
  table: string;
  field: string;
  label: string;
  /** The model's own sentence, for the tooltip. */
  eqn: string;
  /** The child table looked in, as the model spells it. */
  childTable: string;
  /** The child column whose value is taken, lowercased. */
  childField: string;
  /** The child column that orders the rows, lowercased. */
  orderBy: string;
}

let _latest: Map<string, CalcLatest[]> | null = null;

/** The phrasings WellView uses for this shape, and nothing looser. */
const LATEST_RE = /(most recent|latest)\b/i;
/**
 * A clause that makes the answer something other than a plain pick. Matched on
 * the WHOLE help text, so a qualifier anywhere disqualifies the field.
 */
const QUALIFIED_RE = /\bif\b|\bexclude|\bconcatenat|\bor\b|\+|\bmore than one\b/i;
/** Exactly one <table.field> reference, or this is not a single pick. */
const REF_RE = /<([a-z0-9_]+)\.([a-z0-9_]+)>/gi;

/** Fields computable as a most-recent child pick, by lowercased parent table. */
export function calcLatest(): Map<string, CalcLatest[]> {
  if (_latest) return _latest;
  const reg = new Map<string, CalcLatest[]>();
  const tabs = allModelTables();

  for (const [tLc, t] of Object.entries(tabs)) {
    if (/calc$/.test(tLc)) continue;
    for (const [fLc, f] of Object.entries(t.fields)) {
      if (!f.calculated || !f.help) continue;
      if (!LATEST_RE.test(f.help)) continue;
      if (QUALIFIED_RE.test(f.help)) continue;

      const refs = [...f.help.matchAll(REF_RE)];
      if (refs.length !== 1) continue;
      const childLc = refs[0][1].toLowerCase();
      const colLc = refs[0][2].toLowerCase();

      // Prefix descendant, never the table itself.
      if (childLc === tLc || !childLc.startsWith(tLc) || !tabs[childLc]) continue;

      const cf = modelField(childLc, colLc);
      if (!cf || cf.calculated) continue;

      // A datetime orders itself; anything else needs the child's own DtTm.
      const orderBy = cf.type === "datetime" ? colLc : "dttm";
      if (orderBy !== colLc && !modelField(childLc, "dttm")) continue;

      const list = reg.get(tLc) ?? [];
      list.push({
        table: t.table,
        field: fLc,
        label: f.label ?? fLc,
        eqn: f.help.replace(/\s+/g, " ").trim(),
        childTable: tabs[childLc].table,
        childField: colLc,
        orderBy,
      });
      reg.set(tLc, list);
    }
  }
  _latest = reg;
  return reg;
}

/** The most-recent picks of one table, or an empty list. */
export function calcLatestFor(table: string): CalcLatest[] {
  return calcLatest().get(table.toLowerCase()) ?? [];
}

/** Total across every table — pinned by the tests. */
export function calcLatestCount(): number {
  let n = 0;
  for (const l of calcLatest().values()) n += l.length;
  return n;
}

/**
 * Resolve each most-recent pick for a whole page of parents at once.
 *
 * ONE query per field, grouped by parent — the same discipline as sumChildren,
 * for the same reason: a per-row lookup falls over on a real database.
 *
 * A parent is ABSENT from the result rather than null when there is no answer:
 * no children, no dated child, or a tie for most recent. WellView leaves the
 * cell blank in each case and so does this.
 */
export function latestChildren(
  db: AggQuery,
  table: string,
  idwell: string,
  parentIds: string[],
): Map<string, Record<string, string | number>> {
  const out = new Map<string, Record<string, string | number>>();
  const picks = calcLatestFor(table);
  if (!picks.length || !parentIds.length) return out;
  const ids = [...new Set(parentIds.filter(Boolean))];
  if (!ids.length) return out;
  const holes = ids.map(() => "?").join(", ");

  for (const p of picks) {
    try {
      /*
       * The candidates are read and resolved here rather than in SQL. A
       * GROUP BY with MAX() would hand back the winning date but not reliably
       * the row it came from, and detecting a TIE — which has to suppress the
       * answer — takes the rows themselves.
       */
      const rows = db.prepare(
        `SELECT "IDRecParent" AS p, "${p.orderBy}" AS d, "${p.childField}" AS v
           FROM "${p.childTable}"
          WHERE idwell = ? AND "IDRecParent" IN (${holes})
            AND "${p.orderBy}" IS NOT NULL AND "${p.orderBy}" <> ''`,
      ).all(idwell, ...ids) as { p: string; d: string; v: string | number | null }[];

      const best = new Map<string, { d: string; v: string | number | null; tied: boolean }>();
      for (const r of rows) {
        const key = String(r.p ?? "");
        const cur = best.get(key);
        if (!cur || r.d > cur.d) best.set(key, { d: r.d, v: r.v, tied: false });
        else if (r.d === cur.d && r.v !== cur.v) cur.tied = true;
      }
      for (const [parent, b] of best) {
        if (b.tied || b.v == null || b.v === "") continue;
        const rec = out.get(parent) ?? {};
        rec[p.field] = b.v;
        out.set(parent, rec);
      }
    } catch {
      // A table or column this database does not have: the field stays absent,
      // which is the same answer as "no status was recorded".
    }
  }
  return out;
}

/** Reset the most-recent cache — tests only. */
export function _resetLatest(): void { _latest = null; }

/* ─────────────────────── named formulas over child rows ─────────────────────── */

/**
 * Two equations written out by hand, each bound to one field.
 *
 * A bit's total flow area is "Sum of [pi*((<…dia>)/2)^2]" and its nozzle list is
 * "Concatenated <…dia>." — neither survives `tokenise`, which has no literals,
 * no functions and no exponent, and neither matches AGG_RE. Nine shipped
 * templates print one, thirteen references in all, and every one was blank.
 *
 * WHY THESE ARE HAND-WRITTEN RATHER THAN PARSED. Both shapes are singletons: a
 * scan of all 357 tables finds exactly one field whose equation multiplies by
 * pi under a sum, and one whose equation is a bare concatenation of a child
 * column. Teaching `tokenise` about `pi`, `^` and `[…]` would widen what the
 * evaluator silently accepts across all 1,810 calculated fields without
 * widening what has been checked — the exact thing this module's header exists
 * to refuse. Two named entries cost two tests; a general parser costs an audit.
 *
 * EACH ENTRY IS PINNED TO THE MODEL'S EXACT HELP STRING. If Peloton changes the
 * equation, the entry stops matching and the field goes back to blank rather
 * than quietly continuing to run arithmetic the model no longer states.
 */
export interface CalcNamed {
  table: string;
  field: string;
  label: string;
  /** The model's own sentence, for the tooltip. */
  eqn: string;
  /** The child table read, as the model spells it. */
  childTable: string;
  /** The child column read, lowercased. */
  childField: string;
  /**
   * A stored column on the PARENT that replaces the computation outright.
   *
   * Not a fallback and not a cross-check — the model states a precedence:
   * "If <wvjobdrillstring.bitTFA> is entered, it overrides this calculation."
   * On the ten sample strings that carry both, the entered value and the
   * nozzle sum disagree by ratios from 0.749 to 3.241 with no constant
   * between them, which is why precedence is the whole answer and averaging,
   * warning or "correcting" either number would all be wrong.
   *
   * ONE TENSION, LEFT VISIBLE. The stored column's own help reads "TFA for
   * bits without nozzles", which can be read as an instruction to enter it
   * only when there are none — under which those ten strings should show the
   * nozzle sum instead. The two sentences are followed here in the order the
   * model gives them: the calculated field's own help states the rule for the
   * calculated field, and it says override. It decides 10 of the 150 filled
   * rows, and on one of them (bit "RR6") the two readings differ by a factor
   * of 3.2, so this is a reading and not a certainty.
   */
  overrideWith?: string;
  /** How the values combine into the answer. */
  kind: "areaOfCircles" | "list" | "rentalLineCost";
  /** The unit an individual child value carries, for a list-valued result. */
  itemOf?: { table: string; field: string };
}

/** The exact help text each entry is licensed by. A change here revokes it. */
const NAMED: (Omit<CalcNamed, "label"> & { helpIs: string })[] = [
  {
    table: "wvJobDrillString",
    field: "bittfacalc",
    eqn: "Sum of [pi*((<wvjobdrillstringbitnozzle.dia>)/2)^2]",
    helpIs: "Total fluid circulating area for the bit for this string. EQN: Sum of "
      + "[pi*((<wvjobdrillstringbitnozzle.dia>)/2)^2]. If <wvjobdrillstring.bitTFA> "
      + "is entered, it overrides this calculation.",
    childTable: "wvJobDrillStringBitNozzle",
    childField: "dia",
    overrideWith: "bittfa",
    kind: "areaOfCircles",
  },
  {
    table: "wvJobDrillString",
    field: "bitnozzlecalc",
    eqn: "Concatenated <wvjobdrillstringbitnozzle.dia>",
    helpIs: "Bit nozzles run. EQN: Concatenated <wvjobdrillstringbitnozzle.dia>.",
    childTable: "wvJobDrillStringBitNozzle",
    childField: "dia",
    kind: "list",
    itemOf: { table: "wvJobDrillStringBitNozzle", field: "dia" },
  },
  {
    table: "wvJobReportCostRental",
    field: "costrentalcalc",
    eqn: "[(rateday) + (ratestandby) + (ratedepth * usedepth) + (ratehour * usehour) "
      + "+ (rateother * useother) + costonetime] * qty",
    helpIs: "Calculated Rental Cost. EQN: { [(<wvjobrentalitem.rateday>) + "
      + "(<wvjobrentalitem.ratestandby>) + (<wvjobrentalitem.ratedepth> * "
      + "<wvjobreportcostrental.usedepth>) + (<wvjobrentalitem.ratehour> * "
      + "<wvjobreportcostrental.usehour>) + (<wvjobrentalitem.rateother> * "
      + "<wvjobreportcostrental.useother>) + <wvjobreportcostrental.costonetime>] "
      + "*<wvjobreportcostrental.qty> }",
    childTable: "wvJobRentalItem",
    childField: "rateday",
    kind: "rentalLineCost",
  },
];

let _named: Map<string, CalcNamed[]> | null = null;

/** The named formulas, by lowercased parent table. */
export function calcNamed(): Map<string, CalcNamed[]> {
  if (_named) return _named;
  const reg = new Map<string, CalcNamed[]>();
  for (const n of NAMED) {
    const f = modelField(n.table, n.field);
    // The licence check: the model must still say what this entry implements.
    if (!f?.calculated) continue;
    if ((f.help ?? "").replace(/\s+/g, " ").trim() !== n.helpIs) continue;
    if (!modelField(n.childTable, n.childField)) continue;
    const key = n.table.toLowerCase();
    const { helpIs: _drop, ...rest } = n;
    reg.set(key, [...(reg.get(key) ?? []), { ...rest, label: f.label ?? n.field }]);
  }
  _named = reg;
  return reg;
}

/** The named formulas of one table, or an empty list. */
export function calcNamedFor(table: string): CalcNamed[] {
  return calcNamed().get(table.toLowerCase()) ?? [];
}

/** Total across every table — pinned by the tests. */
export function calcNamedCount(): number {
  let n = 0;
  for (const l of calcNamed().values()) n += l.length;
  return n;
}

/**
 * Resolve each named formula for a whole page of parents at once.
 *
 * ONE query per entry plus ONE for the override column, both grouped by parent
 * — the same discipline as sumChildren and latestChildren, for the same reason.
 *
 * The override is read HERE rather than off the caller's row on purpose. No
 * template in any of the three template files selects `BitTFA`, so a caller
 * that relied on its own SELECT would silently never see it: the override would
 * read as handled and never fire, and ten strings would print a nozzle sum
 * where WellView prints the entered value — one of them out by a factor of 3.2.
 *
 * A parent with no answer is ABSENT rather than null or zero. A 0.00 in² total
 * flow area reads as a measured, plugged bit.
 */
export function namedChildren(
  db: AggQuery,
  table: string,
  idwell: string,
  parentIds: string[],
): Map<string, Record<string, number | number[]>> {
  const out = new Map<string, Record<string, number | number[]>>();
  const named = calcNamedFor(table);
  if (!named.length || !parentIds.length) return out;
  const ids = [...new Set(parentIds.filter(Boolean))];
  if (!ids.length) return out;
  const holes = ids.map(() => "?").join(", ");
  const put = (parent: string, field: string, v: number | number[]) => {
    const rec = out.get(parent) ?? {};
    rec[field] = v;
    out.set(parent, rec);
  };

  for (const n of named) {
    try {
      if (n.kind === "rentalLineCost") {
        /*
         * WHAT A RECURRING COST LINE COSTS.
         *
         * The rates live on the rental ITEM; what was used lives on the cost
         * LINE. The model states the arithmetic, and one term of it is wrong.
         *
         * THE GATE THE EQUATION OMITS. The stated equation adds `rateday` and
         * `ratestandby` unconditionally, but UseDay and UseStandby are booleans
         * whose own help reads "Check ON if daily charge is to apply in this
         * report period". Charging a daily rate on a line where someone
         * explicitly did not tick it is not a rounding difference: on this
         * sample it moves the total from 5,928,206 to 6,137,881 across 72 of
         * 373 lines. Every existing implementation in this repository gates
         * them, one of them with a hand-reconciled total, and this matches that
         * form exactly rather than restating it.
         *
         * UNITS WORK ONLY ON THE STORED VALUES, which is why this is SQL over
         * base units and not arithmetic over anything a screen has touched:
         * RateHour's base unit is Cost/DAY and UseHour's is DAYS, so their
         * product is a cost. Convert either to the hours a user sees first and
         * the line is out by a factor of 24.
         */
        for (const r of db.prepare(
          `SELECT r."IDRec" AS p,
                  ( COALESCE(i."RateDay",0)     * COALESCE(r."UseDay",0)
                  + COALESCE(i."RateStandby",0) * COALESCE(r."UseStandby",0)
                  + COALESCE(i."RateDepth",0)   * COALESCE(r."UseDepth",0)
                  + COALESCE(i."RateHour",0)    * COALESCE(r."UseHour",0)
                  + COALESCE(i."RateOther",0)   * COALESCE(r."UseOther",0)
                  + COALESCE(r."CostOneTime",0) ) * COALESCE(r."Qty",1) AS v
             FROM "${n.table}" r
             JOIN "${n.childTable}" i
               ON i."IDRec" = r."IDRecJobRentalItem" AND i.idwell = r.idwell
            WHERE r.idwell = ? AND r."IDRec" IN (${holes})`,
        ).all(idwell, ...ids) as { p: string; v: number | null }[]) {
          const v = Number(r.v);
          if (Number.isFinite(v)) put(String(r.p ?? ""), n.field, v);
        }
        continue;
      }

      /*
       * The child values, in a DETERMINISTIC order — which is not the same as
       * the right order, and the difference is worth stating.
       *
       * The model marks wvJobDrillStringBitNozzle sequenced, so sysSeq is the
       * licensed key. But sysSeq is null on 562 of the sample's 595 nozzle rows
       * and only 11 of 142 strings populate it at all, so for almost every
       * string the sort is a no-op and whatever the scan returns wins. That
       * matters: 60 of 138 strings run mixed nozzle sizes, so a reordering is
       * visible on the page as a different list.
       *
       * IDRec breaks the tie, matching daysVsDepth.ts. What WellView itself
       * orders these by is not stated anywhere this app can read — no more than
       * the separator is — so this is a stable choice, not a recovered fact.
       */
      const rows = db.prepare(
        `SELECT "IDRecParent" AS p, "${n.childField}" AS v FROM "${n.childTable}"
           WHERE idwell = ? AND "IDRecParent" IN (${holes}) AND "${n.childField}" IS NOT NULL
           ORDER BY COALESCE("sysSeq", 999999), "IDRec"`,
      ).all(idwell, ...ids) as { p: string; v: number | null }[];

      const byParent = new Map<string, number[]>();
      for (const r of rows) {
        const v = Number(r.v);
        if (!Number.isFinite(v)) continue;
        const key = String(r.p ?? "");
        byParent.set(key, [...(byParent.get(key) ?? []), v]);
      }

      for (const [parent, vals] of byParent) {
        if (!vals.length) continue;
        if (n.kind === "list") { put(parent, n.field, vals); continue; }
        // areaOfCircles: Σ π(d/2)². The diameters are base metres, so the sum
        // is base m², which is what the model declares this field to be.
        put(parent, n.field, vals.reduce((a, d) => a + Math.PI * (d / 2) ** 2, 0));
      }

      // …and the entered value wins wherever there is one.
      if (n.overrideWith) {
        for (const r of db.prepare(
          `SELECT "IDRec" AS p, "${n.overrideWith}" AS v FROM "${n.table}"
             WHERE idwell = ? AND "IDRec" IN (${holes}) AND "${n.overrideWith}" IS NOT NULL`,
        ).all(idwell, ...ids) as { p: string; v: number | null }[]) {
          const v = Number(r.v);
          if (Number.isFinite(v)) put(String(r.p ?? ""), n.field, v);
        }
      }
    } catch {
      // A table or column this database does not have: the field stays absent,
      // which is the same answer as "no nozzles were recorded".
    }
  }
  return out;
}

/** Reset the named-formula cache — tests only. */
export function _resetNamed(): void { _named = null; }

/* ────────────────────── arithmetic over a table's own totals ────────────────────── */

/**
 * "A contractor's score divided by the maximum it could have scored."
 *
 * A fifth shape, and the one the module's own header named as the leverage:
 * 71 fields were refused because "their inputs are themselves calculated, and
 * aggregates rather than arithmetic". Now that the aggregates exist, the
 * arithmetic over them can run — but only after they have been computed, which
 * is why this cannot live in `calcFields`. computeRow evaluates against the
 * stored row and returns before any child has been read, so a field admitted
 * there would advertise a value it could never produce.
 *
 * Admitted only when EVERY reference names a field of the SAME table that is
 * itself in `calcAggregates`. Measured against the whole model: 8 fields — the
 * three AFE-vs-actual cost variances on wvJob, the AFE total on wvJobAFE, three
 * stimulation volumes, and the contractor score percentage.
 *
 * THE PARTIAL-SUM GUARD. Two totals over two separately-nullable columns of the
 * same child can cover different rows, because SQL's SUM ignores a null
 * quietly. A contractor evaluated on three criteria but scored on only two
 * gives Score over two rows and ScoreMax over three; each total is a correct
 * answer to "sum of what is there", and their ratio is a rating of nothing —
 * 17/30 reads as 57% where the honest reading of what was scored is 85%. So
 * when the inputs to one expression were drawn from different numbers of rows,
 * this produces nothing at all. The sample cannot exercise it, which is why the
 * guard is unit-tested on a constructed database rather than assumed.
 */
export interface CalcOverAgg {
  table: string;
  field: string;
  label: string;
  eqn: string;
  /** The aggregate fields this expression reads, lowercased. */
  needs: string[];
  ast: Node;
}

let _overAgg: Map<string, CalcOverAgg[]> | null = null;

/** Fields computable as arithmetic over this table's own child totals. */
export function calcOverAggregates(): Map<string, CalcOverAgg[]> {
  if (_overAgg) return _overAgg;
  const reg = new Map<string, CalcOverAgg[]>();
  const tabs = allModelTables();

  for (const [tLc, t] of Object.entries(tabs)) {
    if (/calc$/.test(tLc)) continue;
    const aggs = new Set(calcAggregatesFor(tLc).map((a) => a.field.toLowerCase()));
    if (!aggs.size) continue;
    for (const [fLc, f] of Object.entries(t.fields)) {
      if (!f.calculated || !f.help) continue;
      if (!NUMERIC.has(f.type ?? "")) continue;
      const eqn = eqnOf(f.help);
      if (!eqn) continue;
      const toks = tokenise(eqn);
      if (!toks) continue;
      const refs = toks.filter((k): k is Extract<Tok, { k: "ref" }> => k.k === "ref");
      if (!refs.length) continue;
      // Every reference must be one of THIS table's own totals — no stored
      // columns, no other tables, no arithmetic fields.
      if (!refs.every((r) => r.table.toLowerCase() === tLc && aggs.has(r.field.toLowerCase()))) continue;
      const ast = parse(toks);
      if (!ast) continue;
      const list = reg.get(tLc) ?? [];
      list.push({
        table: t.table,
        field: fLc,
        label: f.label ?? fLc,
        eqn,
        needs: [...new Set(refs.map((r) => r.field.toLowerCase()))],
        ast,
      });
      reg.set(tLc, list);
    }
  }
  _overAgg = reg;
  return reg;
}

/** The over-aggregate fields of one table, or an empty list. */
export function calcOverAggregatesFor(table: string): CalcOverAgg[] {
  return calcOverAggregates().get(table.toLowerCase()) ?? [];
}

/** Total across every table — pinned by the tests. */
export function calcOverAggregateCount(): number {
  let n = 0;
  for (const l of calcOverAggregates().values()) n += l.length;
  return n;
}

/**
 * Evaluate the over-aggregate fields for one parent, given its totals.
 *
 * @param totals that parent's child totals, keyed by aggregate field name.
 * @param counts how many child values each total was made of. When the inputs
 * to one expression disagree, the expression produces nothing — see the
 * partial-sum guard above.
 */
export function overAggregates(
  table: string,
  totals: Record<string, number>,
  counts: Record<string, number>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of calcOverAggregatesFor(table)) {
    const have = c.needs.every((n) => totals[n] != null);
    if (!have) continue;
    const ns = c.needs.map((n) => counts[n]).filter((n) => n != null);
    // Drawn from different numbers of rows: the arithmetic is defined, the
    // answer is not.
    if (ns.length > 1 && new Set(ns).size > 1) continue;
    // `evaluate` keys a ref by its lowercased field name, which is exactly how
    // sumChildren keys its totals.
    const v = evaluate(c.ast, totals);
    if (v != null && Number.isFinite(v)) out[c.field] = v;
  }
  return out;
}

/** Reset the over-aggregate cache — tests only. */
export function _resetOverAggregates(): void { _overAgg = null; }

/* ────────────────────────── a value read across a link ────────────────────────── */

/**
 * "The description, vendor and PO of the rental item this cost line is FOR."
 *
 * A sixth shape, and the simplest one: the whole equation is a single
 * `<table.field>` naming another table. Nothing is added, ordered or chosen —
 * one linked record is read.
 *
 * It is also the most dangerous shape in the model, which is why the guards
 * below are longer than the code. 57 fields state an equation of exactly this
 * form and only a minority are lookups; the rest are AGGREGATES wearing a
 * lookup's clothes. `wvCas.SzODNomCompMaxCalc` is "Largest nominal OD of any
 * component in the string. EQN: <wvcascomp.szodnom>." — identical in shape to
 * `wvJobReportCostRental.VendorCalc`, and reading one component's OD would put
 * an arbitrary pipe size where the string's widest belongs.
 *
 * Nothing in the EQN distinguishes them. The SENTENCE around it does, so the
 * sentence is what is read: a help text carrying a superlative, an ordinal or a
 * counting word is refused outright. That is a blunt instrument and it is meant
 * to be — it errs towards leaving a column blank, which this app can say, and
 * away from filling it with the wrong row, which it cannot.
 *
 * HOW THE LINK IS FOUND. Either the owning table carries exactly one record-link
 * column whose declared targets include the source table, or the source table is
 * the owning table's parent by WellView's prefix rule. Two candidates, or none,
 * refuses: a guess about which link to follow is a guess about which record the
 * value came from.
 */
export interface CalcLookup {
  table: string;
  field: string;
  label: string;
  eqn: string;
  /** The table read, as the model spells it. */
  srcTable: string;
  /** The column read there, lowercased. */
  srcField: string;
  /**
   * The column on THIS table holding the source record's id, or null when the
   * source is this table's parent and the join is on IDRecParent.
   */
  linkColumn: string | null;
}

/**
 * Words that turn a lookup into a choice.
 *
 * Any of these in the field's help means the equation names a POPULATION and
 * the sentence names which member of it to take. This registry can do neither,
 * so it declines rather than reading whichever row the database hands back.
 */
const CHOOSING_WORD =
  /\b(min|max|minimum|maximum|largest|smallest|longest|shortest|deepest|shallowest|highest|lowest|earliest|latest|first|last|most recent|current|total|sum|cum|cumulative|average|mean|count|number of|all |any )\b/i;

/** The whole equation is one reference and nothing else. */
const ONE_REF = /^<([a-z0-9_]+)\.([a-z0-9_]+)>\s*\.?$/i;

let _lookup: Map<string, CalcLookup[]> | null = null;

/** Fields readable as a single value across one link, by lowercased table. */
export function calcLookups(): Map<string, CalcLookup[]> {
  if (_lookup) return _lookup;
  const reg = new Map<string, CalcLookup[]>();
  const tabs = allModelTables();

  for (const [tLc, t] of Object.entries(tabs)) {
    if (/calc$/.test(tLc)) continue;
    // The table's parent by WellView's prefix rule, for the parent route.
    const parentLc = Object.keys(tabs)
      .filter((k) => k !== tLc && tLc.startsWith(k))
      .sort((a, b) => b.length - a.length)[0];

    for (const [fLc, f] of Object.entries(t.fields)) {
      if (!f.calculated || !f.help) continue;
      if (CHOOSING_WORD.test(f.help)) continue;
      const eqn = eqnOf(f.help);
      const m = eqn?.match(ONE_REF);
      if (!eqn || !m) continue;
      const srcLc = m[1].toLowerCase();
      const colLc = m[2].toLowerCase();
      if (srcLc === tLc || !tabs[srcLc]) continue;

      const sf = modelField(srcLc, colLc);
      // A calculated source would need its own resolution first; refuse rather
      // than advertise a column that can only ever be blank.
      if (!sf || sf.calculated) continue;

      let linkColumn: string | null = null;
      if (srcLc === parentLc) {
        linkColumn = null;                                   // join on IDRecParent
      } else {
        const links = Object.entries(t.fields).filter(([lk, lf]) =>
          !lf.calculated
          && /^foreignidrec$/i.test(lf.lookupTyp ?? "")
          && (lf.linkTargets ?? []).some((x) => x.toLowerCase() === srcLc)
          && !/tk$/i.test(lk));
        if (links.length !== 1) continue;                    // ambiguous, or none
        linkColumn = links[0][0];
      }

      const list = reg.get(tLc) ?? [];
      list.push({
        table: t.table,
        field: fLc,
        label: f.label ?? fLc,
        eqn,
        srcTable: tabs[srcLc].table,
        srcField: colLc,
        linkColumn,
      });
      reg.set(tLc, list);
    }
  }
  _lookup = reg;
  return reg;
}

/** The lookups of one table, or an empty list. */
export function calcLookupsFor(table: string): CalcLookup[] {
  return calcLookups().get(table.toLowerCase()) ?? [];
}

/** Total across every table — pinned by the tests. */
export function calcLookupCount(): number {
  let n = 0;
  for (const l of calcLookups().values()) n += l.length;
  return n;
}

/**
 * Read each lookup for a whole page of rows at once.
 *
 * ONE query per (link column, source table) pair, not one per row — the same
 * discipline as sumChildren and latestChildren.
 *
 * A row whose link is empty, or whose linked record is gone, is ABSENT from the
 * result rather than null: the value is unknown, not blank.
 */
export function linkedValues(
  db: AggQuery,
  table: string,
  idwell: string,
  rowIds: string[],
): Map<string, Record<string, string | number>> {
  const out = new Map<string, Record<string, string | number>>();
  const looks = calcLookupsFor(table);
  if (!looks.length || !rowIds.length) return out;
  const ids = [...new Set(rowIds.filter(Boolean))];
  if (!ids.length) return out;
  const holes = ids.map(() => "?").join(", ");

  // Group by the join they share, so one query serves every field read across
  // the same link.
  const byLink = new Map<string, CalcLookup[]>();
  for (const l of looks) {
    const key = `${l.linkColumn ?? "IDRecParent"}|${l.srcTable}`;
    byLink.set(key, [...(byLink.get(key) ?? []), l]);
  }

  for (const group of byLink.values()) {
    const { linkColumn, srcTable } = group[0];
    const join = linkColumn ?? "IDRecParent";
    const cols = [...new Set(group.map((l) => l.srcField))];
    try {
      for (const r of db.prepare(
        `SELECT t0."IDRec" AS __id, ${cols.map((c) => `s."${c}" AS "${c}"`).join(", ")}
           FROM "${table}" t0
           JOIN "${srcTable}" s ON s."IDRec" = t0."${join}"
          WHERE t0.idwell = ? AND t0."IDRec" IN (${holes})`,
      ).all(idwell, ...ids) as Record<string, unknown>[]) {
        const key = String(r.__id ?? "");
        for (const l of group) {
          const v = r[l.srcField];
          if (v == null || v === "") continue;
          const rec = out.get(key) ?? {};
          rec[l.field] = v as string | number;
          out.set(key, rec);
        }
      }
    } catch {
      // A table or column this database does not have: the fields stay absent.
    }
  }
  return out;
}

/** Reset the lookup cache — tests only. */
export function _resetLookups(): void { _lookup = null; }

/** Reset the aggregate cache — tests only. */
export function _resetAggregates(): void { _aggregates = null; }
