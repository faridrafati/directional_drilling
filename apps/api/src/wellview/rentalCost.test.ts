/**
 * What a recurring cost line costs, and what it is FOR.
 *
 * The Recurring Costs folder showed tick boxes and a quantity. The description,
 * the vendor, the purchase order, the six accounting codes and the money itself
 * were all blank, because every one of them is a calculated field: WellView
 * reads them from the rental ITEM when a report prints and stores none of them.
 *
 * TWO SHAPES, and the lookup is the dangerous one. Its whole equation is a
 * single `<table.field>` — but so is that of 40 other fields in the model which
 * are AGGREGATES wearing a lookup's clothes. `wvCas.SzODNomCompMaxCalc` is
 * "Largest nominal OD of any component in the string. EQN: <wvcascomp.szodnom>."
 * Identical in shape to VendorCalc, and reading one component's OD would put an
 * arbitrary pipe size where the string's widest belongs. Nothing in the
 * equation separates them; the sentence around it does, so the sentence is what
 * is read.
 *
 * THE GATE THE MODEL'S OWN EQUATION OMITS. The stated cost equation adds the
 * daily and standby rates unconditionally, while UseDay and UseStandby are
 * booleans whose help says "Check ON if daily charge is to apply in this report
 * period". Following the equation literally charges a daily rate on lines where
 * someone explicitly did not tick it — 72 of the sample's 373 lines, moving the
 * total by 209,675.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import {
  calcLookups, calcLookupsFor, calcLookupCount, linkedValues,
  calcNamedFor, calcNamedCount, namedChildren,
} from "./calcFields.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..", "..");
const SAMPLE = join(ROOT, "sqlite_DB", "wellview", "wv9.0_Sample.sqlite");
const d = describe.skipIf(!existsSync(SAMPLE));

const RENTAL = "wvJobReportCostRental";

let db: DatabaseSync;
beforeAll(() => { db = new DatabaseSync(SAMPLE, { readOnly: true }); });
afterAll(() => { db?.close(); });

const wells = () => (db.prepare("SELECT DISTINCT idwell FROM wvJobReportCostRental").all() as
  { idwell: string }[]).map((w) => w.idwell);
const rowsOf = (idwell: string) => (db.prepare(
  "SELECT IDRec FROM wvJobReportCostRental WHERE idwell = ?").all(idwell) as
  { IDRec: string }[]).map((r) => r.IDRec);

d("a recurring cost line", () => {
  it("admits eleven lookups, all of them real ones", () => {
    const all = [...calcLookups()].flatMap(([t, l]) => l.map((a) => `${t}.${a.field}`)).sort();
    expect(all).toEqual([
      "wvjobreportcostrental.code1calc",
      "wvjobreportcostrental.code2calc",
      "wvjobreportcostrental.code3calc",
      "wvjobreportcostrental.code4calc",
      "wvjobreportcostrental.code5calc",
      "wvjobreportcostrental.code6calc",
      "wvjobreportcostrental.descalc",
      "wvjobreportcostrental.dttmendcalc",
      "wvjobreportcostrental.dttmstartcalc",
      "wvjobreportcostrental.ponocalc",
      "wvjobreportcostrental.vendorcalc",
    ]);
    expect(calcLookupCount()).toBe(11);
  });

  it("refuses the aggregates that wear a lookup's shape", () => {
    // 57 fields state an equation of exactly one <table.field>. Only 11 are
    // lookups. These four are the ones that would do visible damage: each
    // names a POPULATION and relies on its sentence to say which member to
    // take, which this registry can neither read nor honour.
    const impostors: [string, string, string][] = [
      // "Largest nominal OD of any component in the string."
      ["wvCas", "szodnomcompmaxcalc", "Largest"],
      ["wvTub", "szodnomcompmaxcalc", "Largest"],
      // "Earliest date/time for the bit on this string run."
      ["wvJobDrillString", "dttminnoexcludecalc", "Earliest"],
      // "Number of personnel on location this reporting period."
      ["wvJobReport", "headcountcalc", "Number of"],
    ];
    const model = JSON.parse(readFileSync(
      join(ROOT, "apps", "web", "public", "wellview-templates", "datamodel.json"), "utf8"));
    for (const [table, field, word] of impostors) {
      // The premise: its equation really is a bare lookup…
      const help = model.tables[table.toLowerCase()].fields[field].help as string;
      expect(help, `${table}.${field}`).toMatch(/EQN:\s*<[a-z0-9_]+\.[a-z0-9_]+>\s*\.?$/i);
      // …and its sentence really does name a choice.
      expect(help).toContain(word);
      // …so it is refused.
      expect(calcLookupsFor(table).map((l) => l.field), `${table}.${field}`).not.toContain(field);
    }
  });

  it("reads the vendor and description off the linked rental item", () => {
    let checked = 0;
    for (const w of wells()) {
      const ids = rowsOf(w);
      const got = linkedValues(db, RENTAL, w, ids);
      for (const id of ids) {
        const truth = db.prepare(`SELECT i.Des, i.Vendor, i.Code1 FROM wvJobReportCostRental r
          JOIN wvJobRentalItem i ON i.IDRec = r.IDRecJobRentalItem
          WHERE r.IDRec = ?`).get(id) as { Des: string | null; Vendor: string | null; Code1: string | null } | undefined;
        if (!truth) continue;
        const mine = got.get(id) ?? {};
        if (truth.Des) expect(mine.descalc, id).toBe(truth.Des);
        if (truth.Vendor) expect(mine.vendorcalc, id).toBe(truth.Vendor);
        if (truth.Code1) expect(mine.code1calc, id).toBe(truth.Code1);
        checked++;
      }
    }
    expect(checked, "cost lines with a resolvable rental item").toBe(373);
  }, 120_000);

  it("reads the report's own dates through the parent link, not a rental item", () => {
    const l = calcLookupsFor(RENTAL);
    const starts = l.find((x) => x.field === "dttmstartcalc")!;
    expect(starts.srcTable).toBe("wvJobReport");
    // The parent route: joined on IDRecParent, not on a record-link column.
    expect(starts.linkColumn).toBeNull();

    const one = db.prepare("SELECT IDRec, idwell, IDRecParent FROM wvJobReportCostRental LIMIT 1")
      .get() as { IDRec: string; idwell: string; IDRecParent: string };
    const truth = db.prepare("SELECT DtTmStart, DtTmEnd FROM wvJobReport WHERE IDRec = ?")
      .get(one.IDRecParent) as { DtTmStart: string; DtTmEnd: string };
    const got = linkedValues(db, RENTAL, one.idwell, [one.IDRec]).get(one.IDRec);
    expect(got?.dttmstartcalc).toBe(truth.DtTmStart);
    expect(got?.dttmendcalc).toBe(truth.DtTmEnd);
  });

  it("leaves a column blank where the linked item has nothing", () => {
    // PONo and Code4-6 resolve perfectly and are empty on every rental item in
    // this database. They are implemented because the route is identical and
    // free; they are not counted as impact, because nothing appears.
    const empty = db.prepare(`SELECT COUNT(*) c FROM wvJobReportCostRental r
      JOIN wvJobRentalItem i ON i.IDRec = r.IDRecJobRentalItem
      WHERE i.PONo IS NOT NULL AND i.PONo <> ''`).get() as { c: number };
    expect(empty.c).toBe(0);

    const w = wells()[0];
    const got = linkedValues(db, RENTAL, w, rowsOf(w));
    for (const [, rec] of got) {
      expect(rec.ponocalc, "absent, not an empty string").toBeUndefined();
    }
  });

  it("computes the line cost, and agrees with the reconciled query", () => {
    expect(calcNamedCount()).toBe(3);
    expect(calcNamedFor(RENTAL).map((n) => n.field)).toEqual(["costrentalcalc"]);

    let mine = 0, rows = 0;
    for (const w of wells()) {
      const ids = rowsOf(w);
      const got = namedChildren(db, RENTAL, w, ids);
      rows += ids.length;
      for (const [, rec] of got) mine += rec.costrentalcalc as number;
    }
    const truth = db.prepare(`SELECT SUM(
      ( COALESCE(i.RateDay,0)     * COALESCE(r.UseDay,0)
      + COALESCE(i.RateStandby,0) * COALESCE(r.UseStandby,0)
      + COALESCE(i.RateDepth,0)   * COALESCE(r.UseDepth,0)
      + COALESCE(i.RateHour,0)    * COALESCE(r.UseHour,0)
      + COALESCE(i.RateOther,0)   * COALESCE(r.UseOther,0)
      + COALESCE(r.CostOneTime,0) ) * COALESCE(r.Qty,1)) s
      FROM wvJobReportCostRental r
      JOIN wvJobRentalItem i ON i.IDRec = r.IDRecJobRentalItem AND i.idwell = r.idwell`)
      .get() as { s: number };

    expect(rows).toBe(373);
    expect(mine).toBeCloseTo(truth.s, 6);
  }, 120_000);

  it("does NOT charge a daily rate on a line that did not tick it", () => {
    // The model's stated equation adds RateDay and RateStandby unconditionally.
    // Following it literally would add 209,675 across 72 of the 373 lines.
    const gated = db.prepare(`SELECT SUM(
      ( COALESCE(i.RateDay,0)     * COALESCE(r.UseDay,0)
      + COALESCE(i.RateStandby,0) * COALESCE(r.UseStandby,0)
      + COALESCE(i.RateDepth,0)   * COALESCE(r.UseDepth,0)
      + COALESCE(i.RateHour,0)    * COALESCE(r.UseHour,0)
      + COALESCE(i.RateOther,0)   * COALESCE(r.UseOther,0)
      + COALESCE(r.CostOneTime,0) ) * COALESCE(r.Qty,1)) s
      FROM wvJobReportCostRental r
      JOIN wvJobRentalItem i ON i.IDRec = r.IDRecJobRentalItem AND i.idwell = r.idwell`)
      .get() as { s: number };
    const literal = db.prepare(`SELECT SUM(
      ( COALESCE(i.RateDay,0)
      + COALESCE(i.RateStandby,0)
      + COALESCE(i.RateDepth,0)   * COALESCE(r.UseDepth,0)
      + COALESCE(i.RateHour,0)    * COALESCE(r.UseHour,0)
      + COALESCE(i.RateOther,0)   * COALESCE(r.UseOther,0)
      + COALESCE(r.CostOneTime,0) ) * COALESCE(r.Qty,1)) s
      FROM wvJobReportCostRental r
      JOIN wvJobRentalItem i ON i.IDRec = r.IDRecJobRentalItem AND i.idwell = r.idwell`)
      .get() as { s: number };
    const differing = db.prepare(`SELECT COUNT(*) c FROM wvJobReportCostRental r
      JOIN wvJobRentalItem i ON i.IDRec = r.IDRecJobRentalItem AND i.idwell = r.idwell
      WHERE (COALESCE(r.UseDay,0) = 0 AND COALESCE(i.RateDay,0) <> 0)
         OR (COALESCE(r.UseStandby,0) = 0 AND COALESCE(i.RateStandby,0) <> 0)`)
      .get() as { c: number };

    expect(differing.c, "lines where the two readings differ").toBe(72);
    expect(literal.s - gated.s).toBeCloseTo(209675, 0);

    let mine = 0;
    for (const w of wells()) {
      for (const [, rec] of namedChildren(db, RENTAL, w, rowsOf(w))) {
        mine += rec.costrentalcalc as number;
      }
    }
    expect(mine, "the gated reading is the one used").toBeCloseTo(gated.s, 6);
  }, 120_000);

  it("keeps the hours arithmetic in the units it is stored in", () => {
    // RateHour's base unit is Cost/DAY and UseHour's is DAYS, so their product
    // is a cost. Converting either to the hours a user sees first puts the line
    // out by a factor of 24 — which is why this is computed in SQL over stored
    // values and never over anything a screen has formatted.
    const model = JSON.parse(readFileSync(
      join(ROOT, "apps", "web", "public", "wellview-templates", "datamodel.json"), "utf8"));
    expect(model.tables.wvjobrentalitem.fields.ratehour.baseUnit).toBe("Cost/day");
    expect(model.tables.wvjobreportcostrental.fields.usehour.baseUnit).toBe("days");
    expect(model.tables.wvjobreportcostrental.fields.costrentalcalc.baseUnit).toBe("Cost");
  });

  it("is asked for by one shipped template", () => {
    const reports = (JSON.parse(readFileSync(
      join(ROOT, "apps", "web", "public", "wellview-templates", "reports.json"), "utf8"))
      .reports as { name: string; blocks?: { table?: string; fields?: { column: string }[] }[] }[]);
    const fields = new Set([
      ...calcLookupsFor(RENTAL).map((l) => l.field),
      ...calcNamedFor(RENTAL).map((n) => n.field),
    ]);
    const names = new Set<string>();
    let refs = 0;
    for (const r of reports) {
      for (const b of r.blocks ?? []) {
        if ((b.table ?? "").toLowerCase() !== RENTAL.toLowerCase()) continue;
        for (const f of b.fields ?? []) {
          if (fields.has(f.column.toLowerCase())) { refs++; names.add(r.name); }
        }
      }
    }
    expect([...names]).toEqual(["Cost by Vendor"]);
    expect(refs).toBe(8);
  });
});
