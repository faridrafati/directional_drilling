/**
 * A mud check against the mud program.
 *
 * wvJobReportMudChk.OutOfRangeCalc says "Concatenation of all fields that are
 * out of range from the planned mud check <wvJobProgramMud>", and nothing in
 * this app referenced wvJobProgramMud at all — 13 program rows sat against 492
 * checks and the folder could not do the job its own help describes.
 *
 * The algorithm is Peloton's, recovered from its own calculation engine rather
 * than guessed: the DLL's string heap carries the method's literals in one
 * contiguous UTF-16 run. That test is first, because everything else rests on
 * it — if those literals are not there, the output format IS an invention and
 * this whole file should be deleted.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { mudLimits, mudOutOfRange, renderOutOfRange } from "./mudOutOfRange.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..", "..");
const SAMPLE = join(ROOT, "sqlite_DB", "wellview", "wv9.0_Sample.sqlite");
const DLL = join(ROOT, "WellView_files", "system", "bin", "Peloton.CalcEngine.WellView90.dll");
const d = describe.skipIf(!existsSync(SAMPLE));

let db: DatabaseSync;
beforeAll(() => { db = new DatabaseSync(SAMPLE, { readOnly: true }); });
afterAll(() => { db?.close(); });

const colsOf = (t: string) => new Map(
  (db.prepare(`SELECT * FROM "${t}" LIMIT 1`) as unknown as { columns(): { name: string }[] })
    .columns().map((c) => [c.name.toLowerCase(), c.name] as [string, string]));

const limits = () => mudLimits(colsOf("wvJobReportMudChk"), colsOf("wvJobProgramMud"));
const allChecks = () => db.prepare("SELECT IDRec, idwell FROM wvJobReportMudChk").all() as
  { IDRec: string; idwell: string }[];

describe.skipIf(!existsSync(DLL))("the vendor's own algorithm", () => {
  it("is in Peloton's calculation engine, in UTF-16", () => {
    // The claim this implementation stands on. An earlier pass reported that no
    // DLL contained the string; it had searched ASCII, and .NET stores literals
    // as UTF-16, so the search could not have found them.
    const b = readFileSync(DLL);
    const at = (s: string) => b.indexOf(Buffer.from(s, "utf16le"));

    expect(at("outofrangecalc"), "the field name").toBeGreaterThan(0);
    expect(at("Below"), "the under-limit wrapper").toBeGreaterThan(0);
    expect(at("Above"), "the over-limit wrapper").toBeGreaterThan(0);
    for (const s of ["min", "max", "kmin", "kmax", "nmin", "nmax"]) {
      expect(at(s), `${s} suffix`).toBeGreaterThan(0);
    }

    /*
     * They sit TOGETHER, which is what makes them one method's literal set
     * rather than a handful of coincidences scattered through the file. Short
     * words like "min" occur all over a 348 KB assembly, so the window around
     * `outofrangecalc` is decoded and read, rather than each word searched for
     * separately from the start of the file.
     */
    const anchor = at("outofrangecalc");
    const window = b.subarray(anchor - 200, anchor + 200);
    const words: string[] = [];
    let run: string[] = [];
    for (let i = 0; i + 1 < window.length; i += 2) {
      const c = window.readUInt16LE(i);
      if (c >= 32 && c < 127) run.push(String.fromCharCode(c));
      else { if (run.length >= 2) words.push(run.join("")); run = []; }
    }
    if (run.length >= 2) words.push(run.join(""));

    for (const w of ["Below", " (", "Above", "outofrangecalc", "max", "min", "kmax", "kmin", "nmax", "nmin"]) {
      expect(words, `"${w}" beside outofrangecalc`).toContain(w);
    }
    // …and in that order, which is the order the method builds its string in.
    const order = ["Below", "Above", "outofrangecalc", "max", "min"].map((w) => words.indexOf(w));
    expect(order, "the vendor's own ordering").toEqual([...order].sort((x, y) => x - y));
  });
});

d("a mud check compared against the mud program", () => {
  it("compares only quantities measured the same way", () => {
    const ls = limits();
    expect(ls.length, "comparable stems").toBeGreaterThan(0);
    for (const l of ls) {
      expect(l.minCol ?? l.maxCol, `${l.stem} has at least one limit`).toBeTruthy();
      expect(l.checkCol, `${l.stem} has a reading column`).toBeTruthy();
    }
    // The five the sample actually fills in.
    const stems = ls.map((l) => l.stem);
    for (const s of ["density", "filtrate", "ph", "plasticvis", "yieldpt"]) {
      expect(stems, s).toContain(s);
    }
  });

  it("flags 49 checks — 28 under the minimum, 21 over the maximum", () => {
    const ls = limits();
    const byWell = new Map<string, string[]>();
    for (const c of allChecks()) byWell.set(c.idwell, [...(byWell.get(c.idwell) ?? []), c.IDRec]);

    let matched = 0, flagged = 0, below = 0, above = 0, passed = 0;
    for (const [idwell, ids] of byWell) {
      for (const [, r] of mudOutOfRange(db, idwell, ids, ls)) {
        matched++;
        if (r.below.length) below++;
        if (r.above.length) above++;
        if (r.text) flagged++; else passed++;
      }
    }
    // 76 of 492 checks fall inside a program interval at all.
    expect(matched, "checks with a program row to compare against").toBe(76);
    expect(flagged, "checks with something out of range").toBe(49);
    expect(below).toBe(28);
    expect(above).toBe(21);
    expect(passed, "checked against a limit and met it").toBe(27);
  }, 120_000);

  it("treats a reading exactly on a limit as IN range", () => {
    // The vendor's own comparison, and not a detail: 18 density readings, 16 pH
    // and 8 filtrate sit exactly on a bound in this sample, so the convention
    // decides a large fraction of the answer.
    const onBound = db.prepare(`SELECT COUNT(*) c FROM wvJobReportMudChk k
      JOIN wvJobReport r ON r.IDRec = k.IDRecParent
      JOIN wvJobProgramMud p ON p.IDRecParent = r.IDRecParent
       AND k.Depth >= p.DepthStart AND k.Depth <= p.DepthEnd
      WHERE k.Density IS NOT NULL AND (k.Density = p.DensityMin OR k.Density = p.DensityMax)`)
      .get() as { c: number };
    expect(onBound.c).toBe(18);

    // A constructed pair either side of the boundary, so the rule is pinned
    // rather than inferred from a count.
    const mem = new DatabaseSync(":memory:");
    mem.exec(`
      CREATE TABLE wvJobReport (IDRec TEXT, IDRecParent TEXT, idwell TEXT);
      CREATE TABLE wvJobProgramMud (IDRec TEXT, IDRecParent TEXT, idwell TEXT,
        DepthStart REAL, DepthEnd REAL, DensityMin REAL, DensityMax REAL);
      CREATE TABLE wvJobReportMudChk (IDRec TEXT, IDRecParent TEXT, idwell TEXT,
        Depth REAL, Density REAL);
      INSERT INTO wvJobReport VALUES ('rep','job','w');
      INSERT INTO wvJobProgramMud VALUES ('pm','job','w', 0, 1000, 10, 12);
      INSERT INTO wvJobReportMudChk VALUES
        ('onMin','rep','w', 100, 10),   -- exactly the minimum
        ('onMax','rep','w', 100, 12),   -- exactly the maximum
        ('under','rep','w', 100, 9.9),
        ('over','rep','w',  100, 12.1);`);
    const ls = [{ stem: "density", checkCol: "Density", minCol: "DensityMin", maxCol: "DensityMax" }];
    const got = mudOutOfRange(mem, "w", ["onMin", "onMax", "under", "over"], ls);
    expect(got.get("onMin")!.text, "exactly the minimum is in range").toBeNull();
    expect(got.get("onMax")!.text, "exactly the maximum is in range").toBeNull();
    expect(got.get("under")!.text).toBe("Below (density)");
    expect(got.get("over")!.text).toBe("Above (density)");
    mem.close();
  });

  it("does not treat a missing limit as a limit of zero — or of infinity", () => {
    /*
     * The one deliberate divergence from WellView. Its engine initialises an
     * absent limit to double.MaxValue, so `value < minLimit` is true for every
     * reading and a one-sided stem reports "Below" on rows that are comfortably
     * in spec. Here an absent limit does not constrain that side.
     *
     * Inert on this sample — the only one-sided stems are Iron and NTU and
     * neither has a single reading — so it is proved on a constructed database.
     */
    const mem = new DatabaseSync(":memory:");
    mem.exec(`
      CREATE TABLE wvJobReport (IDRec TEXT, IDRecParent TEXT, idwell TEXT);
      CREATE TABLE wvJobProgramMud (IDRec TEXT, IDRecParent TEXT, idwell TEXT,
        DepthStart REAL, DepthEnd REAL, DensityMax REAL);
      CREATE TABLE wvJobReportMudChk (IDRec TEXT, IDRecParent TEXT, idwell TEXT,
        Depth REAL, Density REAL);
      INSERT INTO wvJobReport VALUES ('rep','job','w');
      INSERT INTO wvJobProgramMud VALUES ('pm','job','w', 0, 1000, 12);
      INSERT INTO wvJobReportMudChk VALUES
        ('fine','rep','w', 100, 11),
        ('high','rep','w', 100, 13);`);
    const ls = [{ stem: "density", checkCol: "Density", minCol: null, maxCol: "DensityMax" }];
    const got = mudOutOfRange(mem, "w", ["fine", "high"], ls);
    expect(got.get("fine")!.text, "no minimum means no lower limit").toBeNull();
    expect(got.get("high")!.text).toBe("Above (density)");
    mem.close();
  });

  it("keeps a field twice when two program intervals both cover the check", () => {
    // WellView prints "Above (density, density)" there, and so does this. A
    // duplicate is redundant, not wrong — unlike the missing-limit case above,
    // which is why one quirk is kept and the other is not.
    const mem = new DatabaseSync(":memory:");
    mem.exec(`
      CREATE TABLE wvJobReport (IDRec TEXT, IDRecParent TEXT, idwell TEXT);
      CREATE TABLE wvJobProgramMud (IDRec TEXT, IDRecParent TEXT, idwell TEXT,
        DepthStart REAL, DepthEnd REAL, DensityMin REAL, DensityMax REAL);
      CREATE TABLE wvJobReportMudChk (IDRec TEXT, IDRecParent TEXT, idwell TEXT,
        Depth REAL, Density REAL);
      INSERT INTO wvJobReport VALUES ('rep','job','w');
      INSERT INTO wvJobProgramMud VALUES
        ('a','job','w', 0, 222, 10, 12),
        ('b','job','w', 222, 1530, 10, 12);
      INSERT INTO wvJobReportMudChk VALUES ('k','rep','w', 222, 13);`);
    const ls = [{ stem: "density", checkCol: "Density", minCol: "DensityMin", maxCol: "DensityMax" }];
    expect(mudOutOfRange(mem, "w", ["k"], ls).get("k")!.text).toBe("Above (density, density)");
    mem.close();
  });

  it("keeps Below and Above apart, because they need opposite answers", () => {
    expect(renderOutOfRange({ below: ["density", "ph"], above: ["filtrate"] }))
      .toBe("Below (density, ph)\nAbove (filtrate)");
    expect(renderOutOfRange({ below: [], above: ["density"] })).toBe("Above (density)");
    expect(renderOutOfRange({ below: [], above: [] })).toBeNull();
  });

  it("says nothing at all for a check with no program to compare against", () => {
    // 416 of 492 checks sit outside every program interval. There was nothing
    // to be out of range OF, which is not the same as having passed.
    const ls = limits();
    const outside = db.prepare(`SELECT k.IDRec, k.idwell FROM wvJobReportMudChk k
      WHERE NOT EXISTS (
        SELECT 1 FROM wvJobReport r JOIN wvJobProgramMud p ON p.IDRecParent = r.IDRecParent
        WHERE r.IDRec = k.IDRecParent AND k.Depth >= p.DepthStart AND k.Depth <= p.DepthEnd)
      LIMIT 5`).all() as { IDRec: string; idwell: string }[];
    expect(outside.length).toBe(5);
    for (const c of outside) {
      expect(mudOutOfRange(db, c.idwell, [c.IDRec], ls).size, c.IDRec).toBe(0);
    }
  });

  it("no shipped template asks for it, so this is a folder fix", () => {
    for (const file of ["reports.json", "reports-multi.json"]) {
      const j = JSON.parse(readFileSync(
        join(ROOT, "apps", "web", "public", "wellview-templates", file), "utf8"));
      let refs = 0;
      for (const r of j.reports ?? []) {
        for (const b of r.blocks ?? []) {
          for (const f of b.fields ?? []) {
            if ((f.column ?? "").toLowerCase() === "outofrangecalc") refs++;
          }
        }
      }
      expect(refs, file).toBe(0);
    }
  });
});
