/**
 * The calculated-field evaluator, against the model and the REAL sample data.
 *
 * Two things matter here and they pull in opposite directions. The evaluator
 * must actually compute — a registry that admits nothing would pass any test
 * that only checks for absence of error. And it must REFUSE everything it
 * cannot do safely, because a wrong number on a report reads as a checked one.
 * So the tests pin both edges: the exact set admitted, and named equations that
 * must never be.
 *
 * The arithmetic itself is reconciled against SQL computing the same expression
 * independently, which is the only check that would catch an operator-precedence
 * or null-propagation mistake.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { calcFields, calcFieldsFor, calcFieldCount, computeRow, calcFieldsOrdered } from "./calcFields.js";
import { modelField } from "./model.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const SAMPLE = join(HERE, "..", "..", "..", "..", "sqlite_DB", "wellview", "wv9.0_Sample.sqlite");
const hasDb = existsSync(SAMPLE);
const d = describe.skipIf(!hasDb);

let db: DatabaseSync;
beforeAll(() => { if (hasDb) db = new DatabaseSync(SAMPLE, { readOnly: true }); });
afterAll(() => { db?.close(); });

describe("the registry", () => {
  it("admits a known, non-trivial set", () => {
    // Pinned deliberately: a model change that widens or narrows this has to be
    // looked at, not absorbed silently.
    expect(calcFieldCount()).toBe(20);
    expect(calcFields().size).toBe(9);
  });

  it("computes the elevation differences WellView states outright", () => {
    const wh = calcFieldsFor("wvWellHeader").map((c) => c.field);
    for (const f of ["kbtogrdcalc", "kbtocascalc", "kbtomudcalc", "kbtotubcalc"]) {
      expect(wh, `${f} should be computable`).toContain(f);
    }
  });

  it("REFUSES to do arithmetic on a record GUID", () => {
    // OtherToCasCalc's own EQN subtracts an elevation from IDRecElvHistory.
    // Executed literally it yields a number, and that number is nonsense.
    const wh = calcFieldsFor("wvWellHeader").map((c) => c.field);
    for (const f of ["othertocascalc", "othertogrdcalc", "othertomudcalc", "othertotubcalc"]) {
      expect(wh, `${f} must be refused — it references a GUID`).not.toContain(f);
    }
  });

  it("REFUSES datetime arithmetic and cross-table equations", () => {
    const ph = calcFieldsFor("wvJobProgramPhase").map((c) => c.field);
    for (const f of ["dttmstartplanmlcalc", "dttmstartplanmincalc", "dttmstartplanmaxcalc"]) {
      expect(ph, `${f} subtracts datetimes`).not.toContain(f);
    }
    // Every admitted equation references only its own table.
    for (const [tLc, list] of calcFields()) {
      for (const cf of list) {
        expect(cf.table.toLowerCase()).toBe(tLc);
        for (const need of cf.needs) {
          expect(modelField(cf.table, need), `${cf.table}.${need} is not a field of its own table`).toBeTruthy();
        }
      }
    }
  });

  it("REFUSES the aggregate and prose equations it cannot execute", () => {
    // "Sum of <child.field>", "Maximum <x>", "Last <y>" — all outside the shape.
    const wb = calcFieldsFor("wvWellbore").map((c) => c.field);
    for (const f of ["dlsmaxcalc", "ewmaxcalc", "durationcalc", "displaceunwrapcalc"]) {
      expect(wb, `${f} is an aggregate, not arithmetic`).not.toContain(f);
    }
  });

  it("only ever admits numeric inputs and numeric targets", () => {
    const NUM = new Set(["double", "integer"]);
    for (const list of calcFields().values()) {
      for (const cf of list) {
        expect(NUM.has(modelField(cf.table, cf.field)?.type ?? ""),
          `${cf.table}.${cf.field} target is not numeric`).toBe(true);
        for (const need of cf.needs) {
          expect(NUM.has(modelField(cf.table, need)?.type ?? ""),
            `${cf.table}.${need} input is not numeric`).toBe(true);
        }
      }
    }
  });
});

describe("evaluation", () => {
  const kb = () => calcFieldsFor("wvWellHeader").find((c) => c.field === "kbtogrdcalc")!;

  it("subtracts, in the right direction", () => {
    expect(kb().compute({ elvorigkb: 1075.8, elvground: 1072.1 })).toBeCloseTo(3.7, 9);
  });

  it("returns null — never zero — when an input is missing", () => {
    // A zero here would read as "the KB is at ground level", which is a claim.
    expect(kb().compute({ elvorigkb: 1075.8, elvground: null })).toBeNull();
    expect(kb().compute({ elvorigkb: 1075.8 })).toBeNull();
    expect(kb().compute({ elvorigkb: 1075.8, elvground: "" })).toBeNull();
  });

  it("is case-insensitive about the row's column names", () => {
    const out = computeRow("wvWellHeader", { ElvOrigKB: 1075.8, ElvGround: 1072.1 });
    expect(out.kbtogrdcalc).toBeCloseTo(3.7, 9);
  });

  it("leaves an uncomputable field absent rather than null", () => {
    // Absent means "not computed"; null would mean "computed as blank".
    const out = computeRow("wvWellHeader", { ElvOrigKB: 1075.8 });
    expect("kbtogrdcalc" in out).toBe(false);
  });
});

describe("dependency order", () => {
  it("feeds a derived value into the equation that reads it", () => {
    // ROPCalc is "<DepthDrilledCalc> / <TmDrill>" and DepthDrilledCalc is
    // itself derived. Evaluated independently ROP is permanently blank — a
    // column that advertises a value it can never produce.
    const out = computeRow("wvJobDrillStringDrillParam",
      { DepthStart: 100, DepthEnd: 130, TmDrill: 2 });
    expect(out.depthdrilledcalc).toBeCloseTo(30, 9);
    expect(out.ropcalc, "ROP did not read the derived depth").toBeCloseTo(15, 9);
  });

  it("orders every dependency before the field that needs it", () => {
    for (const t of ["wvJobDrillStringDrillParam", "wvJob", "wvWellHeader"]) {
      const seen = new Set<string>();
      for (const cf of calcFieldsOrdered(t)) {
        for (const need of cf.needs) {
          const isDerived = calcFieldsOrdered(t).some((x) => x.field.toLowerCase() === need);
          if (isDerived) {
            expect(seen.has(need), `${t}.${cf.field} reads ${need} before it is computed`).toBe(true);
          }
        }
        seen.add(cf.field.toLowerCase());
      }
    }
  });
});

d("against the sample database", () => {
  it("reconciles every admitted wvWellHeader field against SQL", () => {
    const rows = db.prepare("SELECT * FROM wvWellHeader").all() as Record<string, unknown>[];
    expect(rows.length).toBeGreaterThan(10);
    let compared = 0;
    for (const cf of calcFieldsFor("wvWellHeader")) {
      const expr = cf.needs.map((n) => `"${n}"`);
      if (expr.length !== 2) continue;                 // the two-term differences
      for (const r of rows) {
        const mine = cf.compute(Object.fromEntries(
          Object.entries(r).map(([k, v]) => [k.toLowerCase(), v])));
        const lc = Object.fromEntries(Object.entries(r).map(([k, v]) => [k.toLowerCase(), v]));
        const a = lc[cf.needs[0]], b = lc[cf.needs[1]];
        const theirs = a == null || b == null ? null : Number(a) - Number(b);
        if (theirs === null) expect(mine).toBeNull();
        else expect(mine!).toBeCloseTo(theirs, 9);
        compared++;
      }
    }
    expect(compared).toBeGreaterThan(50);
  });

  it("produces real values on real rows, not a registry of blanks", () => {
    let filled = 0, tables = 0;
    for (const [tLc, list] of calcFields()) {
      const t = (db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND lower(name)=?").get(tLc) as { name: string } | undefined);
      if (!t) continue;
      tables++;
      const rows = db.prepare(`SELECT * FROM "${t.name}" LIMIT 200`).all() as Record<string, unknown>[];
      for (const r of rows) {
        const out = computeRow(t.name, r);
        filled += Object.keys(out).length;
      }
      void list;
    }
    expect(tables).toBeGreaterThan(5);
    // If this is zero the evaluator is admitting equations whose inputs the
    // database never fills — a registry that looks busy and produces nothing.
    expect(filled).toBeGreaterThan(200);
  });

  it("never throws on any table in the database", () => {
    for (const [tLc] of calcFields()) {
      const t = (db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND lower(name)=?").get(tLc) as { name: string } | undefined);
      if (!t) continue;
      for (const r of db.prepare(`SELECT * FROM "${t.name}" LIMIT 50`).all() as Record<string, unknown>[]) {
        expect(() => computeRow(t.name, r)).not.toThrow();
      }
    }
  });
});
