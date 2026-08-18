import { readFileSync, writeFileSync } from "node:fs";
const SCR = process.env.SCR;
const { registered, skipped } = JSON.parse(readFileSync(`${SCR}/calc-registry.json`, "utf8"));
const esc = (s) => String(s).replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
const q = (s) => JSON.stringify(s);
const one = (w) => String(w || "").replace(/\s+/g, " ").trim();

const HEAD = `/**
 * The wv*Calc aggregations this app computes, with their provenance.
 *
 * WellView builds these tables when a report prints and never stores them, so a
 * converted database contains none of the 110 the model declares. Each entry
 * below reproduces one of them from rows that ARE stored.
 *
 * HOW THESE WERE ESTABLISHED, and why the list is shorter than the model's:
 * each derivation was written against the real schema, run on the sample
 * database, and then handed to an INDEPENDENT check whose brief was to refute
 * it - re-deriving the totals by a different route (hand accumulation in JS
 * with no SQL join and no GROUP BY), testing the well and job scoping by
 * comparing against the unscoped result, and checking every column against
 * PRAGMA table_info. Only what survived that is registered here. What did not
 * is listed in UNDERIVED below, with the reason, so a missing block is a
 * recorded decision rather than an oversight.
 *
 * The model's HELP TEXT is the specification and decided several questions
 * outright - it states the exclusions ("Excludes all
 * <wvJobReportTimeLog.Inactive> records") and sometimes the equation itself
 * ("EQN: <wvJTLSumUnschedTypCalc.Duration>/<wvJob.DurationTimeLogTotalCalc>",
 * whose denominator excludes by a WORD in Code1, not by the Inactive flag -
 * the two differ on real data and only this table and wvJTLSumOpsCatCalc
 * declare that equation).
 *
 * Every number these produce is labelled \`derived\` all the way to the screen.
 * A computed figure must never be mistakable for one the database stored.
 */
import { registerCalc, type CalcDerivation } from "./calc.js";

export const CALC_DERIVATIONS: CalcDerivation[] = [`;

const L = [HEAD];
for (const r of registered) {
  const note = r.why === "corrected"
    ? "Registered with the CORRECTED query: verification found a real defect in the original."
    : r.why === "sql-ok"
      ? "Verification reported the query correct and reconciled its totals; the reservations it raised were about the write-up, not the SQL."
      : "Confirmed: the checker re-derived the totals independently and they matched.";
  L.push("  {");
  L.push(`    // ${note}`);
  const rec = one(r.reconciliation);
  if (rec) for (const chunk of (rec.slice(0, 300).match(/.{1,86}(\s|$)/g) || [])) L.push(`    // ${chunk.trim()}`);
  L.push(`    table: ${q(r.table)},`);
  L.push(`    sources: ${JSON.stringify(r.sources)},`);
  L.push(`    params: ${JSON.stringify(r.params)},`);
  if (r.unsupported?.length) {
    L.push("    unsupported: [");
    for (const u of r.unsupported) L.push(`      { field: ${q(u.field)}, reason: ${q(one(u.reason).slice(0, 220))} },`);
    L.push("    ],");
  }
  L.push(`    verifiedBy: ${q(rec.slice(0, 200) || "independent recomputation")},`);
  L.push("    sql: `");
  L.push(esc(r.sql.trim()));
  L.push("`,");
  L.push("  },");
}
L.push("];");
L.push("");
L.push(`/**
 * Deliberately NOT derived, and why. Blocks bound to these keep saying that
 * WellView computes them at print time - true, and checkable - rather than
 * showing a number nobody validated.
 */
export const UNDERIVED: { table: string; reason: string }[] = [`);
for (const [t, w] of skipped) L.push(`  { table: ${q(t)}, reason: ${q(one(w).slice(0, 240))} },`);
L.push("];");
L.push("");
L.push("registerCalc(...CALC_DERIVATIONS);");
writeFileSync("apps/api/src/wellview/calcDerivations.ts", L.join("\n") + "\n");
console.log(`wrote apps/api/src/wellview/calcDerivations.ts — ${registered.length} derivations, ${skipped.length} underived`);
