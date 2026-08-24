/**
 * A service contractor's score, and the percentage of the maximum it reached.
 *
 * Two defects in one field. First, the equation carries no "EQN:" marker —
 * wvJobServiceContract.ScoreCalc is simply "Sum of
 * <wvJobServiceContractEvalData.Score>" — so `eqnOf` returned null and the
 * shape test was never reached. Second, and stranger: the table it names does
 * not exist. wvJobServiceContractEvalData is in neither the model's 357 tables
 * nor any converted database. The real child is wvJobServiceContractEval, whose
 * Score and ScoreMax are the stored doubles the sum is over. A typo in
 * Peloton's own model, and the difference between 29 rated contracts and 29
 * blank ones.
 *
 * The percentage is a third shape again: arithmetic whose inputs are the
 * table's OWN child totals. It cannot live with the row arithmetic, because
 * that runs against the stored row and returns before any child has been read —
 * a field admitted there would advertise a value it could never produce.
 *
 * THE PARTIAL-SUM GUARD is the substance of the percentage. SQL's SUM ignores a
 * null quietly, so two sums over two separately-nullable columns of the same
 * child can cover different rows. A contractor evaluated on three criteria but
 * scored on only two gives Score over two rows and ScoreMax over three; each
 * total is a correct answer to "sum of what is there", and their ratio is a
 * rating of nothing. The sample cannot produce this — Score and ScoreMax are
 * both present on all 91 evaluation rows — so it is proved on a constructed
 * database instead.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import {
  calcAggregatesFor, calcAggregateCount, sumChildren, sumChildrenDetailed,
  calcOverAggregates, calcOverAggregateCount, overAggregates,
} from "./calcFields.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..", "..");
const SAMPLE = join(ROOT, "sqlite_DB", "wellview", "wv9.0_Sample.sqlite");
const d = describe.skipIf(!existsSync(SAMPLE));

let db: DatabaseSync;
beforeAll(() => { db = new DatabaseSync(SAMPLE, { readOnly: true }); });
afterAll(() => { db?.close(); });

d("a contractor's evaluation score", () => {
  it("proves the model names a table that does not exist", () => {
    const model = JSON.parse(readFileSync(
      join(ROOT, "apps", "web", "public", "wellview-templates", "datamodel.json"), "utf8"));
    const tables = Object.keys(model.tables).map((k) => k.toLowerCase());
    expect(tables).not.toContain("wvjobservicecontractevaldata");
    expect(tables).toContain("wvjobservicecontracteval");

    const inDb = (n: string) => (db.prepare(
      "SELECT COUNT(*) c FROM sqlite_master WHERE type='table' AND lower(name) = ?")
      .get(n) as { c: number }).c;
    expect(inDb("wvjobservicecontractevaldata")).toBe(0);
    expect(inDb("wvjobservicecontracteval")).toBe(1);

    // …and the help really does have no EQN marker, which is the other half.
    const f = model.tables.wvjobservicecontract.fields.scorecalc;
    expect(f.help).toBe("Sum of <wvJobServiceContractEvalData.Score>");
    expect(f.help).not.toContain("EQN");
  });

  it("resolves the typo and names the REAL table in the tooltip", () => {
    const aggs = calcAggregatesFor("wvJobServiceContract");
    expect(aggs.map((a) => a.field).sort()).toEqual(["scorecalc", "scoremaxcalc"]);
    for (const a of aggs) {
      expect(a.childTable).toBe("wvJobServiceContractEval");
      // The page must never quote a table that exists nowhere while the query
      // reads one that does.
      expect(a.eqn).toContain("wvJobServiceContractEval.");
      expect(a.eqn).not.toContain("EvalData");
    }
  });

  it("admits exactly six fields through the bare 'Sum of' form", () => {
    // The fallback is applied at the aggregate call site, not inside eqnOf, so
    // it cannot leak into the arithmetic path. AGG_RE is anchored at both ends
    // and the descendant guard still runs, so a whole-help match cannot admit
    // anything the marked form would not.
    expect(calcAggregateCount()).toBe(39);
    const all = new Set<string>();
    for (const t of ["wvJobServiceContract", "wvWellTestTrans"]) {
      for (const a of calcAggregatesFor(t)) all.add(`${t.toLowerCase()}.${a.field}`);
    }
    expect([...all].sort()).toEqual([
      "wvjobservicecontract.scorecalc",
      "wvjobservicecontract.scoremaxcalc",
      "wvwelltesttrans.volumecondtotalcalc",
      "wvwelltesttrans.volumegastotalcalc",
      "wvwelltesttrans.volumeoiltotalcalc",
      "wvwelltesttrans.volumewatertotalcalc",
    ]);
  });

  it("totals every contract, and agrees with SQL on each one", () => {
    const wells = (db.prepare("SELECT DISTINCT idwell FROM wvJobServiceContract").all() as
      { idwell: string }[]).map((w) => w.idwell);
    let checked = 0;
    for (const w of wells) {
      const ids = (db.prepare("SELECT IDRec FROM wvJobServiceContract WHERE idwell = ?").all(w) as
        { IDRec: string }[]).map((r) => r.IDRec);
      const got = sumChildren(db, "wvJobServiceContract", w, ids);
      for (const id of ids) {
        const truth = db.prepare(`SELECT SUM(Score) s, SUM(ScoreMax) m
          FROM wvJobServiceContractEval WHERE IDRecParent = ?`).get(id) as
          { s: number | null; m: number | null };
        if (truth.s == null) { expect(got.get(id)?.scorecalc).toBeUndefined(); continue; }
        expect(got.get(id)?.scorecalc, id).toBeCloseTo(truth.s, 9);
        expect(got.get(id)?.scoremaxcalc, id).toBeCloseTo(truth.m!, 9);
        checked++;
      }
    }
    expect(checked, "contracts that gain a score").toBe(29);
  });

  it("computes the percentage as a PROPORTION, never pre-multiplied by 100", () => {
    // baseUnit is Proportion and the unit table converts Proportion → % with a
    // factor of 0.01, so the display layer does the ×100. A value multiplied
    // here would render 88.6% as 8860%.
    const model = JSON.parse(readFileSync(
      join(ROOT, "apps", "web", "public", "wellview-templates", "datamodel.json"), "utf8"));
    expect(model.tables.wvjobservicecontract.fields.percentscorecalc.baseUnit).toBe("Proportion");

    const one = db.prepare(`SELECT p.IDRec, p.idwell FROM wvJobServiceContract p
      WHERE EXISTS (SELECT 1 FROM wvJobServiceContractEval e WHERE e.IDRecParent = p.IDRec)
      LIMIT 1`).get() as { IDRec: string; idwell: string };
    const sums = sumChildrenDetailed(db, "wvJobServiceContract", one.idwell, [one.IDRec]);
    const got = overAggregates("wvJobServiceContract",
      sums.totals.get(one.IDRec) ?? {}, sums.counts.get(one.IDRec) ?? {});
    const truth = db.prepare(`SELECT SUM(Score) s, SUM(ScoreMax) m
      FROM wvJobServiceContractEval WHERE IDRecParent = ?`).get(one.IDRec) as { s: number; m: number };

    expect(got.percentscorecalc).toBeCloseTo(truth.s / truth.m, 12);
    expect(got.percentscorecalc).toBeLessThanOrEqual(1);
    expect(got.percentscorecalc).toBeGreaterThan(0);
  });

  it("registers exactly five over-aggregate fields", () => {
    const all = [...calcOverAggregates()]
      .flatMap(([t, l]) => l.map((a) => `${t}.${a.field}`)).sort();
    expect(all).toEqual([
      "wvjobafe.afetotalcalc",
      "wvjobservicecontract.percentscorecalc",
      "wvstimtreat.volcleanslurrytotalcalc",
      "wvstimtreat.volnetcalc",
      "wvstimtreat.volnetslurrycalc",
    ]);
    expect(calcOverAggregateCount()).toBe(5);
  });

  it("produces NOTHING when the two sums cover different rows", () => {
    // The case the sample cannot show. Three criteria, ScoreMax on all three,
    // Score on only two: SUM(Score)=17 over 2 rows against SUM(ScoreMax)=30
    // over 3. 17/30 renders as 57% on a scorecard that looks checked, where
    // the honest reading of what was actually scored is 85%. Neither number is
    // a rating, so neither is offered.
    const mem = new DatabaseSync(":memory:");
    mem.exec(`
      CREATE TABLE wvJobServiceContract (idwell TEXT, IDRec TEXT);
      CREATE TABLE wvJobServiceContractEval (idwell TEXT, IDRecParent TEXT, Score REAL, ScoreMax REAL);
      INSERT INTO wvJobServiceContract VALUES ('w','whole'), ('w','partial'), ('w','none');
      INSERT INTO wvJobServiceContractEval VALUES
        ('w','whole',8,10), ('w','whole',9,10), ('w','whole',7,10),
        ('w','partial',8,10), ('w','partial',9,10), ('w','partial',NULL,10);`);

    const sums = sumChildrenDetailed(mem, "wvJobServiceContract", "w", ["whole", "partial", "none"]);

    // The complete one is rated.
    const whole = overAggregates("wvJobServiceContract",
      sums.totals.get("whole") ?? {}, sums.counts.get("whole") ?? {});
    expect(sums.totals.get("whole")).toEqual({ scorecalc: 24, scoremaxcalc: 30 });
    expect(whole.percentscorecalc).toBeCloseTo(0.8, 12);

    // The half-scored one shows its two honest totals and NO percentage.
    expect(sums.totals.get("partial")).toEqual({ scorecalc: 17, scoremaxcalc: 30 });
    expect(sums.counts.get("partial")).toEqual({ scorecalc: 2, scoremaxcalc: 3 });
    const partial = overAggregates("wvJobServiceContract",
      sums.totals.get("partial") ?? {}, sums.counts.get("partial") ?? {});
    expect(partial.percentscorecalc, "17/30 is not a rating of anything").toBeUndefined();

    // A contract with no evaluations at all is absent, not zero.
    expect(sums.totals.get("none")).toBeUndefined();
    const none = overAggregates("wvJobServiceContract", {}, {});
    expect(none.percentscorecalc).toBeUndefined();
    mem.close();
  });

  it("does not divide by zero when nothing could be scored", () => {
    const mem = new DatabaseSync(":memory:");
    mem.exec(`
      CREATE TABLE wvJobServiceContract (idwell TEXT, IDRec TEXT);
      CREATE TABLE wvJobServiceContractEval (idwell TEXT, IDRecParent TEXT, Score REAL, ScoreMax REAL);
      INSERT INTO wvJobServiceContract VALUES ('w','z');
      INSERT INTO wvJobServiceContractEval VALUES ('w','z',0,0);`);
    const sums = sumChildrenDetailed(mem, "wvJobServiceContract", "w", ["z"]);
    const got = overAggregates("wvJobServiceContract",
      sums.totals.get("z") ?? {}, sums.counts.get("z") ?? {});
    expect(got.percentscorecalc, "0/0 is not 0 and not NaN").toBeUndefined();
    mem.close();
  });

  it("does not resolve any OTHER dangling table name", () => {
    // The alias is one entry and stays one entry. A generic "longest model
    // table that is a strict prefix" rule was measured against all the model's
    // dangling names: it yields these same two fields and mis-resolves five
    // others — wvJobServiceEvalData would become wvJob.
    const mem = new DatabaseSync(":memory:");
    mem.exec(`CREATE TABLE wvJobServiceContractEval (idwell TEXT, IDRecParent TEXT, Score REAL, ScoreMax REAL);`);
    mem.close();
    // wvJobServiceContractEval.percentscorecalc names TWO dangling tables and
    // is per-row arithmetic, not an aggregate: it must stay refused.
    expect(calcAggregatesFor("wvJobServiceContractEval").map((a) => a.field)).toEqual([]);
    const over = [...calcOverAggregates()].flatMap(([t, l]) => l.map((a) => `${t}.${a.field}`));
    expect(over).not.toContain("wvjobservicecontracteval.percentscorecalc");
  });
});
