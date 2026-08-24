/**
 * Where each piece of a casing or tubing string sits in the hole.
 *
 * "Casing Tally" and "Tubing Tally" are shipped templates and both render —
 * without the two columns that make a tally a tally. 776 casing joints and 617
 * tubing joints in the sample, each with a length, and nothing saying how far
 * down the hole any of them is.
 *
 * THE MODEL STATES THE EQUATIONS, contrary to the note that opened this item.
 * Only the tally rows' own two are bare prose; everything they hang from is
 * spelled out:
 *
 *   wvCasComp.LengthCumCalc  — "Cumulative length of string from bottom to top
 *                              of component. EQN: Cum of <length> for all
 *                              components up to and including the current one."
 *   wvCasComp.DepthBtmCalc   — "EQN: <wvcas.depthbtm> - <lengthcumcalc> of the
 *                              previously run components."
 *   wvCasComp.DepthTopCalc   — "EQN: <depthbtmcalc> - <length>."
 *   wvCasComp.LengthTallyCalc— "EQN: Cum of <wvcascomptally.length> for all
 *                              records that have <jointrun> flagged."
 *
 * WHICH END IS THE SHOE, measured rather than assumed. "Previously run" means
 * deeper, because a string is run shoe first — so the components with the
 * HIGHER sequence numbers are the deeper ones. The data agrees without
 * exception: of the 43 sample strings carrying a component whose description
 * names a shoe, the shoe is last in sequence on 43 and first on none. Every one
 * of those strings' component lengths also sums to exactly its own set depth,
 * which is the same statement from the other side.
 *
 * A JOINT THAT WAS NOT RUN GETS NO DEPTH. wvCasComp.LengthTallyCalc counts only
 * tally rows "that have <jointrun> flagged", and a joint that never went in the
 * hole cannot be at a depth in it. The tally row's own help does not repeat the
 * rule, but its sibling states it and the alternative is putting a joint
 * somewhere it never was. 8 of the sample's 776 casing joints are affected.
 *
 * TALLY DEPTHS ARE ANCHORED ON THEIR OWN COMPONENT, not on the string. 17 of
 * the 69 tallied components have a tally that does not sum to the length
 * recorded for the component — one of them by 1,233 m. Running the tally
 * straight down the string would let that discrepancy move every joint above
 * it; anchoring each component's tally to that component keeps the disagreement
 * where it belongs, visible as a gap inside one component rather than as a
 * quietly wrong depth on all of them.
 */
import { modelField } from "./model.js";

export interface StackQuery {
  prepare(sql: string): { all(...args: unknown[]): unknown[] };
}

export interface StackRow {
  /** Length of string from the shoe up to the top of this piece. */
  lengthcumcalc: number | null;
  /** Measured depth of this piece's bottom — components only. */
  depthbtmcalc?: number | null;
  depthtopcalc: number | null;
}

/** The four stacks this knows how to walk, and what each hangs from. */
interface StackSpec {
  /** The block table the values are FOR. */
  table: string;
  /** The string that carries the set depth. */
  stringTable: string;
  /** The component table, when `table` is a tally. */
  componentTable?: string;
  /** Tally rows honour JointRun; components have no such column. */
  gateOnJointRun: boolean;
}

const STACKS: StackSpec[] = [
  { table: "wvCasComp", stringTable: "wvCas", gateOnJointRun: false },
  { table: "wvTubComp", stringTable: "wvTub", gateOnJointRun: false },
  { table: "wvCasCompTally", stringTable: "wvCas", componentTable: "wvCasComp", gateOnJointRun: true },
  { table: "wvTubCompTally", stringTable: "wvTub", componentTable: "wvTubComp", gateOnJointRun: true },
];

/** The fields this produces for a table, or none. */
export function stackFieldsFor(table: string): string[] {
  const s = STACKS.find((x) => x.table.toLowerCase() === table.toLowerCase());
  if (!s) return [];
  const wanted = s.componentTable
    ? ["lengthcumcalc", "depthtopcalc"]
    : ["lengthcumcalc", "depthbtmcalc", "depthtopcalc"];
  // Only what the model actually declares on this table.
  return wanted.filter((f) => modelField(s.table, f));
}

/** Total across every table — pinned by the tests. */
export function stackFieldCount(): number {
  return STACKS.reduce((n, s) => n + stackFieldsFor(s.table).length, 0);
}

type Row = Record<string, unknown>;
const num = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * Walk the stack for a page of rows.
 *
 * Two queries per call regardless of page size — every sibling of every
 * affected parent, and the parent strings' set depths — then the arithmetic in
 * memory. The siblings are needed in full: a component's depth depends on what
 * is BELOW it, which the page may not contain.
 *
 * A row is ABSENT from the result when its answer is unknowable: no set depth
 * on the string, a missing length anywhere below it in the stack, or — for a
 * tally row — a joint that was not run. A blank cell is the honest form of
 * "this is not at a depth"; a number would not be.
 */
export function stackRows(
  db: StackQuery,
  table: string,
  idwell: string,
  rowIds: string[],
): Map<string, StackRow> {
  const out = new Map<string, StackRow>();
  const spec = STACKS.find((x) => x.table.toLowerCase() === table.toLowerCase());
  if (!spec || !rowIds.length) return out;
  const ids = [...new Set(rowIds.filter(Boolean))];
  if (!ids.length) return out;
  const holes = ids.map(() => "?").join(", ");

  try {
    if (!spec.componentTable) {
      // ── components of a string ──────────────────────────────────────────
      const sibs = db.prepare(
        `SELECT c."IDRec", c."IDRecParent", c."sysSeq", c."Length", s."DepthBtm"
           FROM "${spec.table}" c
           JOIN "${spec.stringTable}" s ON s."IDRec" = c."IDRecParent"
          WHERE c.idwell = ? AND c."IDRecParent" IN (
                SELECT "IDRecParent" FROM "${spec.table}" WHERE "IDRec" IN (${holes}))
          ORDER BY c."IDRecParent", c."sysSeq", c."IDRec"`,
      ).all(idwell, ...ids) as Row[];
      for (const [, group] of byParent(sibs)) walkComponents(group, out);
      return out;
    }

    // ── tally joints inside a component ────────────────────────────────────
    // The components have to be stacked first: a joint's depth is measured from
    // the bottom of the component it belongs to.
    const comps = db.prepare(
      `SELECT c."IDRec", c."IDRecParent", c."sysSeq", c."Length", s."DepthBtm"
         FROM "${spec.componentTable}" c
         JOIN "${spec.stringTable}" s ON s."IDRec" = c."IDRecParent"
        WHERE c.idwell = ? AND c."IDRecParent" IN (
              SELECT c2."IDRecParent" FROM "${spec.componentTable}" c2
               WHERE c2."IDRec" IN (
                     SELECT "IDRecParent" FROM "${spec.table}" WHERE "IDRec" IN (${holes})))
        ORDER BY c."IDRecParent", c."sysSeq", c."IDRec"`,
    ).all(idwell, ...ids) as Row[];
    const compStack = new Map<string, StackRow>();
    for (const [, group] of byParent(comps)) walkComponents(group, compStack);

    const joints = db.prepare(
      `SELECT t."IDRec", t."IDRecParent", t."sysSeq", t."Length", t."JointRun"
         FROM "${spec.table}" t
        WHERE t.idwell = ? AND t."IDRecParent" IN (
              SELECT "IDRecParent" FROM "${spec.table}" WHERE "IDRec" IN (${holes}))
        ORDER BY t."IDRecParent", t."sysSeq", t."IDRec"`,
    ).all(idwell, ...ids) as Row[];

    for (const [compId, group] of byParent(joints)) {
      const anchor = compStack.get(compId)?.depthbtmcalc ?? null;
      walkJoints(group, anchor, spec.gateOnJointRun, out);
    }
  } catch {
    // A database without these tables: every field stays absent.
  }
  return out;
}

function byParent(rows: Row[]): Map<string, Row[]> {
  const m = new Map<string, Row[]>();
  for (const r of rows) {
    const k = String(r.IDRecParent ?? "");
    m.set(k, [...(m.get(k) ?? []), r]);
  }
  return m;
}

/**
 * One string's components, in sequence order — which runs TOP to BOTTOM.
 *
 * Accumulated from the far end, because every depth is measured up from the
 * shoe. A missing length stops the walk: everything above it rests on it, so
 * nothing above it can be placed.
 */
function walkComponents(group: Row[], out: Map<string, StackRow>): void {
  const depthBtm = num(group[0]?.DepthBtm);
  if (depthBtm == null) return;                 // nothing to measure from

  let below = 0;
  let broken = false;
  // Deepest first: the last in sequence is at the shoe.
  for (let i = group.length - 1; i >= 0; i--) {
    const r = group[i];
    const len = num(r.Length);
    if (broken || len == null) { broken = true; continue; }
    const btm = depthBtm - below;
    out.set(String(r.IDRec ?? ""), {
      lengthcumcalc: below + len,
      depthbtmcalc: btm,
      depthtopcalc: btm - len,
    });
    below += len;
  }
}

/**
 * One component's tally joints, measured up from that component's bottom.
 *
 * A joint that was not run is skipped entirely: it takes up no hole, so it
 * shifts nothing above it and it has no depth of its own.
 */
function walkJoints(
  group: Row[],
  anchor: number | null,
  gateOnJointRun: boolean,
  out: Map<string, StackRow>,
): void {
  let below = 0;
  let broken = false;
  for (let i = group.length - 1; i >= 0; i--) {
    const r = group[i];
    const run = !gateOnJointRun || Number(r.JointRun ?? 0) === 1;
    if (!run) continue;                          // never in the hole
    const len = num(r.Length);
    if (broken || len == null) { broken = true; continue; }
    const cum = below + len;
    out.set(String(r.IDRec ?? ""), {
      lengthcumcalc: cum,
      depthtopcalc: anchor == null ? null : anchor - cum,
    });
    below = cum;
  }
}
