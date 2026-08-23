/**
 * "The value on the child row that is most recent by date."
 *
 * A third calculated shape, after the row arithmetic and the child totals. It
 * is neither: nothing is added and nothing is evaluated — one child row is
 * chosen and one of its values is read. WellView states it in prose rather than
 * in an EQN clause, so the help text is the specification:
 *
 *     wvZone.CurrentStatusCalc — "Most recent status by date. EQN:
 *     <wvzonestatus.status>."
 *
 * `NUMERIC` blocked it (a status is a string) and `AGG_RE` matched only Sum/
 * Cum/Total, so every one of these printed blank. Five shipped templates ask
 * for one across nine field references — Zone History, Zones, Well Summary,
 * Flow Tests and Inspections.
 *
 * The fifth admitted field, wvJobDrillString.DtTmOutNoExcludeCalc, is asked for
 * by no shipped template on its own table: "BHA Detail" prints it on a
 * wvJobDrillStringDrillParam block, which is the parent-field-on-a-child-block
 * shape that this app does not resolve. It fills 167 of 175 rows in Edit Data
 * regardless, where the folder grid shows calculated fields.
 *
 * WHAT IS DELIBERATELY REFUSED is the point of the tests below. Help carrying a
 * condition or a second term describes a different calculation, and a plain
 * most-recent pick there would be confidently wrong rather than blank —
 * the failure this whole audit is about. wvPerforation.CurrentStatusCalc is the
 * one that costs something: its rule is "If <…depthtop> and <…depthbtm> are
 * populated, they are included", and two perforations in this sample carry
 * statuses over more than one depth interval, so their current status is not a
 * single value. It stays blank, and since a dropped column now says so, it
 * stays blank *visibly*.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { calcLatest, calcLatestFor, calcLatestCount, latestChildren } from "./calcFields.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..", "..");
const SAMPLE = join(ROOT, "sqlite_DB", "wellview", "wv9.0_Sample.sqlite");
const d = describe.skipIf(!existsSync(SAMPLE));

let db: DatabaseSync;
beforeAll(() => { db = new DatabaseSync(SAMPLE, { readOnly: true }); });
afterAll(() => { db?.close(); });

const idsOf = (table: string, idwell: string) =>
  (db.prepare(`SELECT IDRec FROM "${table}" WHERE idwell = ?`).all(idwell) as { IDRec: string }[])
    .map((r) => r.IDRec);
const wells = () =>
  (db.prepare("SELECT idwell FROM wvWellHeader").all() as { idwell: string }[]).map((w) => w.idwell);

d("a field that reads the most recent child", () => {
  it("admits exactly the five the model states plainly", () => {
    const all = [...calcLatest()].flatMap(([t, l]) => l.map((p) => `${t}.${p.field}`)).sort();
    expect(all).toEqual([
      "wvinspect.dttmlastinspectioncalc",
      "wvjobdrillstring.dttmoutnoexcludecalc",
      "wvperforation.dttmstatuscalc",
      "wvzone.currentstatuscalc",
      "wvzone.dttmstatuscalc",
    ]);
    expect(calcLatestCount()).toBe(5);
  });

  it("refuses the ones whose help carries a condition or a second term", () => {
    // 14 fields in the model say "most recent" or "latest". Nine describe
    // something a plain pick would get wrong, and each is named here so that a
    // later loosening of the rule has to argue with this list.
    const refused = [
      // "If <depthtop> and <depthbtm> are populated, they are included" —
      // a status can cover part of the interval, so there may be no single one.
      ["wvperforation", "currentstatuscalc"],
      // "excludes drilling parameters that have the…" — a filtered maximum.
      ["wvjobdrillstring", "dttmoutcalc"],
      // "Latest date from <a> or <b>" — two source tables.
      ["wvwellboresummarycalc", "dttmend"],
      // "+ <wvInspect.RecurFrequency>" — arithmetic on top of the pick.
      ["wvinspect", "dttmnextinspectioncalc"],
      // "concatenated with <wvWellbore.Des> if there is more than one" — a join.
      ["wvwellheader", "pbtdallcalc"],
      // The bit's runs hang off it by record LINK, not by table-name prefix.
      ["wvjobdrillbit", "dttmoutcalc"],
      ["wvjobdrillbit", "dttmoutnoexcludecalc"],
    ] as const;
    for (const [t, f] of refused) {
      expect(calcLatestFor(t).map((p) => p.field), `${t}.${f} must stay refused`).not.toContain(f);
    }
  });

  it("picks the latest status a zone actually has", () => {
    // Zone 14F8D336 has four statuses spanning 1990–1993. The answer is the
    // 1993 one; anything else means the ordering is wrong.
    const z = db.prepare(`SELECT z.IDRec, z.idwell FROM wvZone z
      JOIN wvZoneStatus s ON s.IDRecParent = z.IDRec
      GROUP BY z.IDRec HAVING COUNT(*) > 2 LIMIT 1`).get() as { IDRec: string; idwell: string };
    const statuses = db.prepare(
      "SELECT DtTm, Status FROM wvZoneStatus WHERE IDRecParent = ? ORDER BY DtTm")
      .all(z.IDRec) as { DtTm: string; Status: string }[];
    expect(statuses.length).toBeGreaterThan(2);
    const last = statuses[statuses.length - 1];

    const got = latestChildren(db, "wvZone", z.idwell, [z.IDRec]).get(z.IDRec);
    expect(got?.currentstatuscalc).toBe(last.Status);
    expect(got?.dttmstatuscalc).toBe(last.DtTm);
    // …and NOT the first, which is what an unordered pick would return.
    expect(got?.currentstatuscalc).not.toBe(statuses[0].Status);
  });

  it("agrees with SQL on every zone in the database", () => {
    // The whole table, not one row: the answer is checked against the same
    // question asked a different way.
    let checked = 0;
    for (const w of wells()) {
      const ids = idsOf("wvZone", w);
      if (!ids.length) continue;
      const got = latestChildren(db, "wvZone", w, ids);
      for (const id of ids) {
        const truth = db.prepare(`SELECT Status, DtTm FROM wvZoneStatus
          WHERE IDRecParent = ? AND DtTm IS NOT NULL AND DtTm <> ''
          ORDER BY DtTm DESC LIMIT 1`).get(id) as { Status: string; DtTm: string } | undefined;
        const mine = got.get(id);
        if (!truth) { expect(mine?.currentstatuscalc).toBeUndefined(); continue; }
        expect(mine?.currentstatuscalc, id).toBe(truth.Status);
        expect(mine?.dttmstatuscalc, id).toBe(truth.DtTm);
        checked++;
      }
    }
    expect(checked, "zones with a dated status").toBe(27);
  }, 120_000);

  it("leaves a perforation blank when no status of it carries a date", () => {
    // 33 of the 50 perforations that have statuses have no date on ANY of them.
    // "Most recent" cannot be answered there, and picking by row order would
    // put a fact on the page that nothing in the database supports.
    const undated = db.prepare(`SELECT IDRecParent p, idwell FROM wvPerforationStatus
      GROUP BY IDRecParent
      HAVING SUM(CASE WHEN DtTm IS NOT NULL AND DtTm <> '' THEN 1 ELSE 0 END) = 0`)
      .all() as { p: string; idwell: string }[];
    expect(undated.length).toBe(33);

    for (const u of undated.slice(0, 10)) {
      const got = latestChildren(db, "wvPerforation", u.idwell, [u.p]).get(u.p);
      expect(got?.dttmstatuscalc, `${u.p} has no dated status`).toBeUndefined();
    }
  });

  it("fills what it can and no more", () => {
    const count = (table: string) => {
      let rows = 0, filled = 0;
      for (const w of wells()) {
        const ids = idsOf(table, w);
        rows += ids.length;
        filled += latestChildren(db, table, w, ids).size;
      }
      return { rows, filled };
    };
    // Each of these was blank on every row before.
    expect(count("wvZone")).toEqual({ rows: 70, filled: 27 });
    expect(count("wvPerforation")).toEqual({ rows: 112, filled: 17 });
    expect(count("wvJobDrillString")).toEqual({ rows: 175, filled: 167 });
    expect(count("wvInspect")).toEqual({ rows: 2, filled: 2 });
  }, 120_000);

  it("is asked for by five shipped templates", () => {
    const reports = (JSON.parse(readFileSync(
      join(ROOT, "apps", "web", "public", "wellview-templates", "reports.json"), "utf8"))
      .reports as { name: string; blocks?: { table?: string; fields?: { column: string }[] }[] }[]);
    const admitted = new Set([...calcLatest()]
      .flatMap(([t, l]) => l.map((p) => `${t}.${p.field.toLowerCase()}`)));

    const filled = new Set<string>();
    let refs = 0;
    for (const r of reports) {
      for (const b of r.blocks ?? []) {
        for (const f of b.fields ?? []) {
          if (!admitted.has(`${(b.table ?? "").toLowerCase()}.${f.column.toLowerCase()}`)) continue;
          refs++; filled.add(r.name);
        }
      }
    }
    expect(filled.size, "templates gaining at least one column").toBe(5);
    expect(refs, "field references now filled").toBe(9);
    expect([...filled].sort()).toEqual([
      "Flow Tests", "Inspections", "Well Summary", "Zone History", "Zones",
    ]);

    // The perforation twin is NOT among them, and is expected not to be.
    let perfRefs = 0;
    for (const r of reports) {
      for (const b of r.blocks ?? []) {
        for (const f of b.fields ?? []) {
          if ((b.table ?? "").toLowerCase() === "wvperforation"
            && f.column.toLowerCase() === "currentstatuscalc") perfRefs++;
        }
      }
    }
    expect(perfRefs, "still blank, and now visibly so").toBe(6);
  });

  it("suppresses the answer when two children tie for most recent", () => {
    // A tie leaves "most recent" undefined. Rather than pick by row order, the
    // field stays absent. No tie exists in the sample, so this is proved on a
    // constructed one — the code path has to be exercised somewhere.
    const mem = new DatabaseSync(":memory:");
    mem.exec(`CREATE TABLE wvZone (idwell TEXT, IDRec TEXT);
              CREATE TABLE wvZoneStatus (idwell TEXT, IDRecParent TEXT, DtTm TEXT, Status TEXT);
              INSERT INTO wvZone VALUES ('w', 'z1'), ('w', 'z2');
              INSERT INTO wvZoneStatus VALUES
                ('w','z1','2020-01-01','OPEN'), ('w','z1','2020-01-01','CLOSED'),
                ('w','z2','2020-01-01','OPEN'), ('w','z2','2019-01-01','CLOSED');`);
    const got = latestChildren(mem, "wvZone", "w", ["z1", "z2"]);
    expect(got.get("z1")?.currentstatuscalc, "tied — no answer").toBeUndefined();
    expect(got.get("z2")?.currentstatuscalc, "not tied — the 2020 one").toBe("OPEN");
    mem.close();
  });
});
