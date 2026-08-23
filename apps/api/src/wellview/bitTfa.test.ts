/**
 * A bit's total flow area, and the nozzles it was run with.
 *
 * Two equations `tokenise` cannot read — "Sum of [pi*((<…dia>)/2)^2]" has a
 * literal, a function and an exponent; "Concatenated <…dia>." is not arithmetic
 * at all — so both printed blank on nine shipped templates, thirteen references
 * in all.
 *
 * THE PRECEDENCE IS THE WHOLE ANSWER. The model does not merely mention the
 * stored column, it states a rule: "If <wvjobdrillstring.bitTFA> is entered, it
 * overrides this calculation." On the ten sample strings carrying both, the
 * entered value and the nozzle sum disagree by ratios from 0.749 to 3.241 with
 * no constant between them — they are not two measurements of one quantity, and
 * averaging them, warning about them or "correcting" either would all be wrong.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { calcNamed, calcNamedFor, calcNamedCount, namedChildren } from "./calcFields.js";
import { formatUnitList } from "@dd/shared";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..", "..");
const SAMPLE = join(ROOT, "sqlite_DB", "wellview", "wv9.0_Sample.sqlite");
const d = describe.skipIf(!existsSync(SAMPLE));

let db: DatabaseSync;
beforeAll(() => { db = new DatabaseSync(SAMPLE, { readOnly: true }); });
afterAll(() => { db?.close(); });

const wells = () =>
  (db.prepare("SELECT idwell FROM wvWellHeader").all() as { idwell: string }[]).map((w) => w.idwell);
const stringsOf = (idwell: string) =>
  (db.prepare("SELECT IDRec FROM wvJobDrillString WHERE idwell = ?").all(idwell) as { IDRec: string }[])
    .map((r) => r.IDRec);

d("a bit's total flow area", () => {
  it("registers exactly the two hand-written formulas", () => {
    const all = [...calcNamed()].flatMap(([t, l]) => l.map((n) => `${t}.${n.field}`)).sort();
    expect(all).toEqual(["wvjobdrillstring.bitnozzlecalc", "wvjobdrillstring.bittfacalc"]);
    expect(calcNamedCount()).toBe(2);
  });

  it("is licensed by the model's exact help, so a changed equation revokes it", () => {
    // The safety property that makes hand-written formulas defensible: if
    // Peloton restates the equation, the entry stops matching and the field
    // goes back to blank rather than quietly running arithmetic the model no
    // longer states.
    const model = JSON.parse(readFileSync(
      join(ROOT, "apps", "web", "public", "wellview-templates", "datamodel.json"), "utf8"));
    const help = (t: string, f: string) => {
      const tk = Object.keys(model.tables).find((k) => k.toLowerCase() === t.toLowerCase())!;
      const fk = Object.keys(model.tables[tk].fields).find((k) => k.toLowerCase() === f)!;
      return model.tables[tk].fields[fk].help as string;
    };
    expect(help("wvJobDrillString", "bittfacalc")).toContain("Sum of [pi*((<wvjobdrillstringbitnozzle.dia>)/2)^2]");
    // …including the precedence sentence this implementation turns on.
    expect(help("wvJobDrillString", "bittfacalc"))
      .toContain("If <wvjobdrillstring.bitTFA> is entered, it overrides this calculation");
    expect(help("wvJobDrillString", "bitnozzlecalc")).toBe("Bit nozzles run. EQN: Concatenated <wvjobdrillstringbitnozzle.dia>.");
  });

  it("sums the circles, in the base unit the model declares", () => {
    // Three 20/32" nozzles. 20/32" = 0.015875 m exactly, so the area is
    // 3 · π · (0.0079375)² = 5.9380e-4 m², which is 0.9204 in².
    const one = db.prepare(`SELECT n.IDRecParent p, s.idwell FROM wvJobDrillStringBitNozzle n
      JOIN wvJobDrillString s ON s.IDRec = n.IDRecParent
      WHERE s.BitTFA IS NULL AND n.Dia IS NOT NULL
      GROUP BY n.IDRecParent HAVING COUNT(*) = 3 LIMIT 1`).get() as { p: string; idwell: string };
    const dias = (db.prepare("SELECT Dia FROM wvJobDrillStringBitNozzle WHERE IDRecParent = ? AND Dia IS NOT NULL")
      .all(one.p) as { Dia: number }[]).map((r) => r.Dia);
    const expected = dias.reduce((a, x) => a + Math.PI * (x / 2) ** 2, 0);

    const got = namedChildren(db, "wvJobDrillString", one.idwell, [one.p]).get(one.p);
    expect(got?.bittfacalc).toBeCloseTo(expected, 12);
    // Base m², not in² and not 32nds. A TFA read as 32nds would be ~1.6 million
    // times too large and would still look like a plausible number on the page.
    expect(got?.bittfacalc as number).toBeLessThan(0.01);
  });

  it("lets an entered BitTFA override the nozzles, which is what the model says", () => {
    const both = db.prepare(`SELECT s.IDRec, s.idwell, s.BitTFA t FROM wvJobDrillString s
      WHERE s.BitTFA IS NOT NULL
        AND EXISTS (SELECT 1 FROM wvJobDrillStringBitNozzle n
                    WHERE n.IDRecParent = s.IDRec AND n.Dia IS NOT NULL)`)
      .all() as { IDRec: string; idwell: string; t: number }[];
    expect(both.length, "strings carrying both").toBe(10);

    let disagreed = 0;
    const ratios: number[] = [];
    for (const b of both) {
      const dias = (db.prepare("SELECT Dia FROM wvJobDrillStringBitNozzle WHERE IDRecParent = ? AND Dia IS NOT NULL")
        .all(b.IDRec) as { Dia: number }[]).map((r) => r.Dia);
      const nozzleSum = dias.reduce((a, x) => a + Math.PI * (x / 2) ** 2, 0);
      const got = namedChildren(db, "wvJobDrillString", b.idwell, [b.IDRec]).get(b.IDRec);
      // The ENTERED value, every time.
      expect(got?.bittfacalc, b.IDRec).toBeCloseTo(b.t, 12);
      if (Math.abs(nozzleSum - b.t) > 1e-9) { disagreed++; ratios.push(b.t / nozzleSum); }
    }
    // They are not two measurements of one quantity: all ten disagree, and the
    // ratios spread far too widely to be a unit error.
    expect(disagreed).toBe(10);
    expect(Math.min(...ratios)).toBeLessThan(0.8);
    expect(Math.max(...ratios)).toBeGreaterThan(3);
  });

  it("uses the entered value on a bit that has no nozzles at all", () => {
    // "TFA for bits without nozzles" is what the stored column is FOR, and this
    // is the audit's stated free win: 12 strings have BitTFA and no nozzle rows.
    const bare = db.prepare(`SELECT s.IDRec, s.idwell, s.BitTFA t FROM wvJobDrillString s
      WHERE s.BitTFA IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM wvJobDrillStringBitNozzle n
                        WHERE n.IDRecParent = s.IDRec AND n.Dia IS NOT NULL) LIMIT 5`)
      .all() as { IDRec: string; idwell: string; t: number }[];
    expect(bare.length).toBeGreaterThan(0);
    for (const b of bare) {
      const got = namedChildren(db, "wvJobDrillString", b.idwell, [b.IDRec]).get(b.IDRec);
      expect(got?.bittfacalc, b.IDRec).toBeCloseTo(b.t, 12);
      // No nozzles means no list, not an empty one.
      expect(got?.bitnozzlecalc).toBeUndefined();
    }
  });

  it("returns nothing — not zero — when the nozzle diameters are blank", () => {
    // Four strings have nozzle ROWS whose Dia are all null. A reduce seeded at
    // zero would print 0.00 in², which reads as a measured, plugged bit.
    const empty = db.prepare(`SELECT n.IDRecParent p, s.idwell FROM wvJobDrillStringBitNozzle n
      JOIN wvJobDrillString s ON s.IDRec = n.IDRecParent
      WHERE s.BitTFA IS NULL
      GROUP BY n.IDRecParent HAVING SUM(CASE WHEN n.Dia IS NOT NULL THEN 1 ELSE 0 END) = 0`)
      .all() as { p: string; idwell: string }[];
    expect(empty.length).toBeGreaterThan(0);
    for (const e of empty) {
      const got = namedChildren(db, "wvJobDrillString", e.idwell, [e.p]).get(e.p);
      expect(got?.bittfacalc, e.p).toBeUndefined();
      expect(got?.bitnozzlecalc, e.p).toBeUndefined();
    }
  });

  it("ships the nozzle list as numbers, not as a string it had to pick a unit for", () => {
    // The list is unit-set dependent — "20-20-20" in 32nds, "15.9-15.9-15.9" in
    // millimetres — and the API has no unit set. Composing it here would emit
    // base metres, "0.015875-0.015875-0.015875", on every screen. The values
    // travel and the client formats them, exactly as every other measured
    // column already works.
    const one = db.prepare(`SELECT n.IDRecParent p, s.idwell FROM wvJobDrillStringBitNozzle n
      JOIN wvJobDrillString s ON s.IDRec = n.IDRecParent
      WHERE n.Dia IS NOT NULL GROUP BY n.IDRecParent HAVING COUNT(*) >= 3 LIMIT 1`)
      .get() as { p: string; idwell: string };
    const got = namedChildren(db, "wvJobDrillString", one.idwell, [one.p]).get(one.p);
    expect(Array.isArray(got?.bitnozzlecalc)).toBe(true);
    const list = got!.bitnozzlecalc as number[];
    expect(list.length).toBeGreaterThanOrEqual(3);
    for (const v of list) {
      expect(typeof v).toBe("number");
      // Base metres: a 20/32" nozzle is 0.015875, never 20 and never 15.875.
      expect(v).toBeGreaterThan(0);
      expect(v).toBeLessThan(0.1);
    }
  });

  it("does not use the nozzle Type, which no row in this database has", () => {
    // The audit says "595 nozzle rows carry Dia and Typ". Typ is null on every
    // one of them, so an enriched "16 × PDC" list is not available; neither
    // equation references it either.
    const typs = db.prepare("SELECT COUNT(*) c FROM wvJobDrillStringBitNozzle WHERE Typ IS NOT NULL AND Typ <> ''")
      .get() as { c: number };
    expect(typs.c).toBe(0);
    for (const n of calcNamedFor("wvJobDrillString")) expect(n.childField).toBe("dia");
  });

  it("fills 150 of the 175 drill strings", () => {
    let rows = 0, tfa = 0, list = 0;
    for (const w of wells()) {
      const ids = stringsOf(w);
      rows += ids.length;
      const got = namedChildren(db, "wvJobDrillString", w, ids);
      for (const [, rec] of got) {
        if (rec.bittfacalc != null) tfa++;
        if (rec.bitnozzlecalc != null) list++;
      }
    }
    expect(rows).toBe(175);
    expect(tfa, "strings gaining a total flow area").toBe(150);
    expect(list, "strings gaining a nozzle list").toBe(138);
  }, 120_000);

  it("orders the nozzles deterministically, and does not claim that is WellView's order", () => {
    // The model marks the nozzle table sequenced, so sysSeq is the licensed
    // key — but it is null on 562 of the 595 rows and only 11 of 142 strings
    // populate it. For almost every string the sort is a no-op and the scan
    // order would win, which is visible: 60 of 138 strings run mixed sizes.
    const raw = db.prepare("SELECT COUNT(*) c FROM wvJobDrillStringBitNozzle WHERE sysSeq IS NULL")
      .get() as { c: number };
    expect(raw.c).toBe(562);
    const mixed = db.prepare(`SELECT COUNT(*) c FROM (
      SELECT IDRecParent FROM wvJobDrillStringBitNozzle WHERE Dia IS NOT NULL
      GROUP BY IDRecParent HAVING COUNT(DISTINCT Dia) > 1)`).get() as { c: number };
    expect(mixed.c).toBe(60);

    // The same string must come back the same way every time it is asked.
    const one = db.prepare(`SELECT n.IDRecParent p, s.idwell FROM wvJobDrillStringBitNozzle n
      JOIN wvJobDrillString s ON s.IDRec = n.IDRecParent
      WHERE n.Dia IS NOT NULL AND s.BitTFA IS NULL
      GROUP BY n.IDRecParent HAVING COUNT(DISTINCT n.Dia) > 1 LIMIT 1`)
      .get() as { p: string; idwell: string };
    expect(one, "a mixed-size string with no override").toBeTruthy();
    const first = namedChildren(db, "wvJobDrillString", one.idwell, [one.p]).get(one.p)!
      .bitnozzlecalc as number[];
    for (let i = 0; i < 4; i++) {
      const again = namedChildren(db, "wvJobDrillString", one.idwell, [one.p]).get(one.p)!
        .bitnozzlecalc as number[];
      expect(again).toEqual(first);
    }
    // …and the sum does not depend on the order at all, so the TFA is safe
    // from this uncertainty even though the printed list is not.
    const sum = first.reduce((a, d) => a + Math.PI * (d / 2) ** 2, 0);
    const shuffled = [...first].reverse().reduce((a, d) => a + Math.PI * (d / 2) ** 2, 0);
    expect(sum).toBeCloseTo(shuffled, 15);
  });

  it("says how many nozzles did not fit rather than dropping them quietly", () => {
    // One string carries 160 nozzle rows, which render to 479 characters. A cut
    // is unavoidable; a silent one would misreport the bit.
    const big = db.prepare(`SELECT n.IDRecParent p, s.idwell, COUNT(*) c
      FROM wvJobDrillStringBitNozzle n JOIN wvJobDrillString s ON s.IDRec = n.IDRecParent
      WHERE n.Dia IS NOT NULL GROUP BY n.IDRecParent ORDER BY c DESC LIMIT 1`)
      .get() as { p: string; idwell: string; c: number };
    expect(big.c).toBe(160);
    const list = namedChildren(db, "wvJobDrillString", big.idwell, [big.p]).get(big.p)!
      .bitnozzlecalc as number[];
    expect(list.length).toBe(160);

    const shown = formatUnitList(list, { unit: "m" }, "US");
    expect(shown.length).toBeLessThanOrEqual(100);
    expect(shown).toMatch(/\+\d+ more$/);
    // The number named must be the number actually left out.
    const kept = shown.replace(/ \+\d+ more$/, "").split("-").length;
    const omitted = Number(shown.match(/\+(\d+) more$/)![1]);
    expect(kept + omitted).toBe(160);

    // A short list is untouched — no cap, no suffix.
    expect(formatUnitList(list.slice(0, 3), { unit: "m" }, "US")).not.toContain("more");
  });

  it("is asked for by nine shipped templates", () => {
    const count = (file: string) => {
      const reports = (JSON.parse(readFileSync(
        join(ROOT, "apps", "web", "public", "wellview-templates", file), "utf8"))
        .reports as { name: string; blocks?: { table?: string; fields?: { column: string }[] }[] }[]);
      const names = new Set<string>();
      let refs = 0;
      for (const r of reports) {
        for (const b of r.blocks ?? []) {
          if ((b.table ?? "").toLowerCase() !== "wvjobdrillstring") continue;
          for (const f of b.fields ?? []) {
            if (!["bittfacalc", "bitnozzlecalc"].includes(f.column.toLowerCase())) continue;
            refs++; names.add(r.name);
          }
        }
      }
      return { refs, names };
    };
    const single = count("reports.json");
    const multi = count("reports-multi.json");
    expect(single.refs, "references in the shipped single-well templates").toBe(12);
    expect(single.names.size).toBe(8);
    // The multi-well "Bit Performance" asks too, but multiReport.ts has no
    // calculated-field path at all — that is its own item, and until then the
    // column keeps saying it is one WellView computes at print time.
    expect(multi.refs).toBe(1);
  });
});
