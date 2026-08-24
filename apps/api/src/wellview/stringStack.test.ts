/**
 * Where each piece of a casing or tubing string sits in the hole.
 *
 * "Casing Tally" and "Tubing Tally" both render, and both rendered without the
 * two columns that make a tally a tally: 776 casing joints and 617 tubing
 * joints, each with a length and nothing saying how far down it is.
 *
 * The note that opened this item said these fields "carry prose help with no
 * EQN". That is true of the tally rows' own two and false of everything they
 * hang from — the component-level equations are stated outright, including the
 * rule that a joint only counts if it was actually run. Those are asserted
 * below, because the implementation is only as good as its licence.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { stackRows, stackFieldsFor, stackFieldCount } from "./stringStack.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..", "..");
const SAMPLE = join(ROOT, "sqlite_DB", "wellview", "wv9.0_Sample.sqlite");
const d = describe.skipIf(!existsSync(SAMPLE));

let db: DatabaseSync;
beforeAll(() => { db = new DatabaseSync(SAMPLE, { readOnly: true }); });
afterAll(() => { db?.close(); });

const model = () => JSON.parse(readFileSync(
  join(ROOT, "apps", "web", "public", "wellview-templates", "datamodel.json"), "utf8"));

d("a string's pieces, from the shoe up", () => {
  it("is licensed by equations the model states outright", () => {
    const m = model();
    const help = (t: string, f: string) => m.tables[t].fields[f].help as string;

    expect(help("wvcascomp", "lengthcumcalc"))
      .toContain("Cum of <wvcascomp.length> for all components up to and including the current one");
    expect(help("wvcascomp", "depthbtmcalc"))
      .toContain("<wvcas.depthbtm>-<wvcascomp.lengthcumcalc> of the previously run components");
    expect(help("wvcascomp", "depthtopcalc"))
      .toContain("<wvcascomp.depthbtmcalc> - <wvcascomp.length>");
    // The JointRun rule, stated on the sibling field rather than on the tally.
    expect(help("wvcascomp", "lengthtallycalc"))
      .toContain("for all records that have <wvcascomptally.jointrun> flagged");

    expect(stackFieldsFor("wvCasComp").sort())
      .toEqual(["depthbtmcalc", "depthtopcalc", "lengthcumcalc"]);
    expect(stackFieldsFor("wvCasCompTally").sort()).toEqual(["depthtopcalc", "lengthcumcalc"]);
    expect(stackFieldsFor("wvJobDrillStringCompTally"), "a drill string has no set depth").toEqual([]);
    expect(stackFieldCount()).toBe(10);
  });

  it("puts the shoe at the bottom, which is where the data puts it", () => {
    // "Previously run" means deeper — a string goes in shoe first — so the
    // higher sequence numbers are the deeper pieces. Measured, not assumed.
    let shoeLast = 0, shoeFirst = 0, checked = 0;
    for (const s of db.prepare("SELECT IDRec FROM wvCas").all() as { IDRec: string }[]) {
      const comps = db.prepare(
        "SELECT Des FROM wvCasComp WHERE IDRecParent = ? ORDER BY sysSeq, IDRec")
        .all(s.IDRec) as { Des: string | null }[];
      if (comps.length < 2) continue;
      const i = comps.findIndex((c) => /shoe/i.test(c.Des ?? ""));
      if (i < 0) continue;
      checked++;
      if (i === comps.length - 1) shoeLast++;
      if (i === 0) shoeFirst++;
    }
    expect(checked).toBe(43);
    expect(shoeLast, "the shoe is last in sequence").toBe(43);
    expect(shoeFirst).toBe(0);
  });

  it("lands the deepest component's bottom exactly on the set depth", () => {
    const strings = db.prepare(`SELECT s.IDRec, s.idwell, s.DepthBtm FROM wvCas s
      WHERE s.DepthBtm IS NOT NULL
        AND (SELECT COUNT(*) FROM wvCasComp c WHERE c.IDRecParent = s.IDRec) > 1`)
      .all() as { IDRec: string; idwell: string; DepthBtm: number }[];
    expect(strings.length).toBeGreaterThan(20);

    let checked = 0;
    for (const s of strings) {
      const comps = db.prepare(
        "SELECT IDRec, Length FROM wvCasComp WHERE IDRecParent = ? ORDER BY sysSeq, IDRec")
        .all(s.IDRec) as { IDRec: string; Length: number | null }[];
      if (comps.some((c) => c.Length == null)) continue;
      const got = stackRows(db, "wvCasComp", s.idwell, comps.map((c) => c.IDRec));
      const deepest = got.get(comps[comps.length - 1].IDRec);
      if (!deepest) continue;
      checked++;
      expect(deepest.depthbtmcalc, s.IDRec).toBeCloseTo(s.DepthBtm, 6);

      // …and the shallowest component's top is the string's own top.
      const total = comps.reduce((a, c) => a + (c.Length ?? 0), 0);
      expect(got.get(comps[0].IDRec)!.depthtopcalc, s.IDRec)
        .toBeCloseTo(s.DepthBtm - total, 6);
      // The cumulative at the top IS the whole string.
      expect(got.get(comps[0].IDRec)!.lengthcumcalc, s.IDRec).toBeCloseTo(total, 6);
    }
    expect(checked, "strings fully stacked").toBeGreaterThan(20);
  }, 120_000);

  it("stacks each component's pieces without gaps", () => {
    const s = db.prepare(`SELECT s.IDRec, s.idwell, s.DepthBtm FROM wvCas s
      WHERE s.DepthBtm IS NOT NULL
        AND (SELECT COUNT(*) FROM wvCasComp c WHERE c.IDRecParent = s.IDRec) >= 4
        AND NOT EXISTS (SELECT 1 FROM wvCasComp c WHERE c.IDRecParent = s.IDRec AND c.Length IS NULL)
      LIMIT 1`).get() as { IDRec: string; idwell: string; DepthBtm: number };
    const comps = db.prepare(
      "SELECT IDRec, Length FROM wvCasComp WHERE IDRecParent = ? ORDER BY sysSeq, IDRec")
      .all(s.IDRec) as { IDRec: string; Length: number }[];
    const got = stackRows(db, "wvCasComp", s.idwell, comps.map((c) => c.IDRec));

    // Each piece's bottom is the next one's top, all the way down.
    for (let i = 0; i < comps.length - 1; i++) {
      expect(got.get(comps[i].IDRec)!.depthbtmcalc, `piece ${i}`)
        .toBeCloseTo(got.get(comps[i + 1].IDRec)!.depthtopcalc!, 6);
    }
    // …and each piece is as long as it says it is.
    for (const c of comps) {
      const r = got.get(c.IDRec)!;
      expect(r.depthbtmcalc! - r.depthtopcalc!, c.IDRec).toBeCloseTo(c.Length, 6);
    }
  });

  it("gives a joint that was never run no depth at all", () => {
    // wvCasComp.LengthTallyCalc counts only rows "that have <jointrun>
    // flagged". A joint that did not go in the hole cannot be at a depth in it,
    // and it must not shift the ones above it either.
    const notRun = db.prepare(`SELECT t.IDRec, t.idwell, t.IDRecParent
      FROM wvCasCompTally t WHERE COALESCE(t.JointRun,0) = 0`)
      .all() as { IDRec: string; idwell: string; IDRecParent: string }[];
    expect(notRun.length, "joints tallied but not run").toBe(8);

    for (const j of notRun) {
      const sibs = db.prepare(
        "SELECT IDRec FROM wvCasCompTally WHERE IDRecParent = ?").all(j.IDRecParent) as
        { IDRec: string }[];
      const got = stackRows(db, "wvCasCompTally", j.idwell, sibs.map((x) => x.IDRec));
      expect(got.has(j.IDRec), `${j.IDRec} was not run`).toBe(false);
    }
  });

  it("anchors a tally on its own component, not on the whole string", () => {
    /*
     * 17 of the 69 tallied components have a tally that does not sum to the
     * length recorded for the component — one of them by 1,233 m. Running the
     * tally straight down the string would let that discrepancy move every
     * joint above it. Anchored per component, the disagreement stays inside the
     * component it belongs to.
     */
    const mismatched = db.prepare(`SELECT c.IDRec, c.idwell, c.Length,
        (SELECT SUM(t.Length) FROM wvCasCompTally t
          WHERE t.IDRecParent = c.IDRec AND t.JointRun = 1) tallySum
      FROM wvCasComp c
      WHERE tallySum IS NOT NULL AND c.Length IS NOT NULL
        AND ABS(tallySum - c.Length) > 1`)
      .all() as { IDRec: string; idwell: string; Length: number; tallySum: number }[];
    expect(mismatched.length, "components whose tally disagrees with them").toBeGreaterThan(5);

    const c = mismatched[0];
    const compStack = stackRows(db, "wvCasComp", c.idwell, [c.IDRec]).get(c.IDRec);
    expect(compStack?.depthbtmcalc, "the component still has a bottom").toBeTruthy();

    const joints = db.prepare(
      "SELECT IDRec FROM wvCasCompTally WHERE IDRecParent = ? ORDER BY sysSeq, IDRec")
      .all(c.IDRec) as { IDRec: string }[];
    const got = stackRows(db, "wvCasCompTally", c.idwell, joints.map((j) => j.IDRec));
    const deepest = [...joints].reverse().map((j) => got.get(j.IDRec)).find(Boolean);
    // The deepest joint's top is one joint above the COMPONENT's bottom —
    // the component's own depth is unaffected by its tally disagreeing.
    expect(deepest!.depthtopcalc).toBeLessThan(compStack!.depthbtmcalc!);
    expect(compStack!.depthbtmcalc! - deepest!.depthtopcalc!).toBeCloseTo(deepest!.lengthcumcalc!, 6);
  });

  it("says nothing above a missing length, rather than treating it as zero", () => {
    // Everything above a piece rests on it. A zero would move every depth above
    // it up by the missing amount, and each one would still look measured.
    const mem = new DatabaseSync(":memory:");
    mem.exec(`
      CREATE TABLE wvCas (IDRec TEXT, idwell TEXT, DepthBtm REAL);
      CREATE TABLE wvCasComp (IDRec TEXT, IDRecParent TEXT, idwell TEXT, sysSeq INT, Length REAL);
      INSERT INTO wvCas VALUES ('s','w', 1000);
      INSERT INTO wvCasComp VALUES
        ('top','s','w',1, 100),
        ('mid','s','w',2, NULL),
        ('btm','s','w',3, 10);`);
    const got = stackRows(mem, "wvCasComp", "w", ["top", "mid", "btm"]);
    expect(got.get("btm")!.depthbtmcalc).toBe(1000);
    expect(got.get("btm")!.depthtopcalc).toBe(990);
    expect(got.has("mid"), "the piece with no length").toBe(false);
    expect(got.has("top"), "and everything resting on it").toBe(false);
    mem.close();
  });

  it("says nothing when the string has no set depth", () => {
    const mem = new DatabaseSync(":memory:");
    mem.exec(`
      CREATE TABLE wvCas (IDRec TEXT, idwell TEXT, DepthBtm REAL);
      CREATE TABLE wvCasComp (IDRec TEXT, IDRecParent TEXT, idwell TEXT, sysSeq INT, Length REAL);
      INSERT INTO wvCas VALUES ('s','w', NULL);
      INSERT INTO wvCasComp VALUES ('a','s','w',1, 100), ('b','s','w',2, 10);`);
    expect(stackRows(mem, "wvCasComp", "w", ["a", "b"]).size).toBe(0);
    mem.close();
  });

  it("fills the tallies the shipped templates print", () => {
    const count = (table: string, parent: string) => {
      let rows = 0, filled = 0;
      const wells = db.prepare(`SELECT DISTINCT idwell FROM "${table}"`).all() as { idwell: string }[];
      for (const w of wells) {
        const ids = (db.prepare(`SELECT IDRec FROM "${table}" WHERE idwell = ?`).all(w.idwell) as
          { IDRec: string }[]).map((r) => r.IDRec);
        rows += ids.length;
        filled += stackRows(db, table, w.idwell, ids).size;
      }
      void parent;
      return { rows, filled };
    };
    const cas = count("wvCasCompTally", "wvCasComp");
    const tub = count("wvTubCompTally", "wvTubComp");
    expect(cas.rows).toBe(776);
    expect(tub.rows).toBe(617);
    expect(cas.filled, "casing joints placed in the hole").toBeGreaterThan(700);
    expect(tub.filled, "tubing joints placed in the hole").toBeGreaterThan(500);
  }, 180_000);
});
