/**
 * Where a string starts on the schematic.
 *
 * WellView stores no top for a casing, tubing or rod string. The guide says
 * what to enter: "the string name, the date the string was run, and the set
 * depth or bottom of the string" — the top follows from the components, which
 * stack up from the shoe.
 *
 * The drawing had no top to work with and started every string at surface. That
 * is not a rounding error: a liner with a 3,627 m shoe and 1,609 m of pipe was
 * drawn with 2,018 m of steel that is not there, and a 120 m isolation string
 * at a 4,220 m shoe was drawn as 4.1 km of tubing. A schematic is what someone
 * reads to decide where a packer can set.
 *
 * WHAT IS DRAWN IS WHAT WAS RECORDED. One well in the sample has a partial
 * tally — all four of its casings, the conductor included, compute a top near
 * 421 m, and a conductor pipe cannot hang at 421 m. The gap is still shown,
 * because a visible gap invites the question and invented steel does not.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Fastify, { type FastifyInstance } from "fastify";
import { DatabaseSync } from "node:sqlite";
import { registerWellviewDbRoutes } from "../routes/wellviewDb.js";
import { issueToken } from "../entry/auth.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const SAMPLE = join(HERE, "..", "..", "..", "..", "sqlite_DB", "wellview", "wv9.0_Sample.sqlite");
const DB = "wv9.0_Sample";
const d = describe.skipIf(!existsSync(SAMPLE));

interface Row { IDRec?: string; Des?: string | null; DepthBtm?: number | null; DepthTopCalc?: number | null; steelLength?: number | null }
interface Schematic { casings: Row[]; tubings: Row[]; rods: Row[] }

let app: FastifyInstance;
let auth: { Authorization: string };
let wells: { idwell: string; WellName: string }[];

beforeAll(async () => {
  app = Fastify();
  await registerWellviewDbRoutes(app);
  await app.ready();
  const { token } = issueToken({ id: "test", username: "vitest", role: "admin" });
  auth = { Authorization: `Bearer ${token}` };
  const w = await app.inject({ url: `/entry/wellview/dbs/${DB}/wells`, headers: auth });
  wells = (w.json() as { wells: typeof wells }).wells;
});
afterAll(async () => { await app?.close(); });

const schematic = async (idwell: string) => {
  const res = await app.inject({ url: `/entry/wellview/dbs/${DB}/schematic?idwell=${idwell}`, headers: auth });
  expect(res.statusCode).toBe(200);
  return res.json() as Schematic;
};

d("a string's top is summed from its components", () => {
  it("hangs Sample 07's liner where its steel actually starts", async () => {
    const w = wells.find((x) => x.WellName.startsWith("Sample 07"))!;
    const s = await schematic(w.idwell);
    const liner = s.casings.find((c) => String(c.Des ?? "").trim() === "Liner")!;
    expect(liner, "Sample 07 has a Liner").toBeTruthy();
    // 3,627.1 m shoe over 1,609.3 m of pipe.
    expect(liner.DepthBtm!).toBeCloseTo(3627.12, 1);
    expect(liner.steelLength!).toBeCloseTo(1609.3, 0);
    expect(liner.DepthTopCalc!).toBeCloseTo(2017.8, 0);

    // …and a string with a complete tally still starts at surface.
    const surface = s.casings.find((c) => /Surface Casing/i.test(String(c.Des ?? "")))!;
    expect(surface.DepthTopCalc!).toBeLessThan(1);
  });

  it("agrees with the database, string for string", async () => {
    // The derivation is one subtraction, so what this checks is that it is
    // applied to the right rows — every string, not just the ones that move.
    const raw = new DatabaseSync(SAMPLE, { readOnly: true });
    const expected = new Map<string, { btm: number; len: number }>();
    for (const [s, c] of [["wvCas", "wvCasComp"], ["wvTub", "wvTubComp"], ["wvRod", "wvRodComp"]]) {
      for (const r of raw.prepare(`
        SELECT p.IDRec AS id, p.DepthBtm AS btm, SUM(CAST(k.Length AS REAL)) AS len
          FROM "${s}" p JOIN "${c}" k ON k.IDRecParent = p.IDRec
         WHERE p.DepthBtm IS NOT NULL AND k.Length IS NOT NULL
         GROUP BY p.IDRec`).all() as { id: string; btm: number; len: number }[]) {
        expected.set(r.id, { btm: r.btm, len: r.len });
      }
    }
    raw.close();
    expect(expected.size).toBeGreaterThan(150);

    let seen = 0;
    let below = 0;
    for (const w of wells) {
      const s = await schematic(w.idwell);
      for (const r of [...s.casings, ...s.tubings, ...s.rods]) {
        const e = expected.get(String(r.IDRec));
        if (!e) continue;
        seen++;
        expect(r.steelLength!, String(r.Des)).toBeCloseTo(e.len, 3);
        expect(r.DepthTopCalc!, String(r.Des)).toBeCloseTo(Math.max(0, e.btm - e.len), 3);
        if ((r.DepthTopCalc ?? 0) > 50) below++;
      }
    }
    expect(seen).toBeGreaterThan(150);
    // 30 strings genuinely start well below surface. Every one of them was
    // drawn from zero before this.
    expect(below).toBe(30);
  }, 120_000);

  it("never puts a string above surface, however the tally sums", async () => {
    // A tally longer than the hole is bad data — several joints double-counted,
    // or a shoe entered short. A string drawn from a negative depth would be a
    // worse answer than one drawn from zero, so it is clamped.
    for (const w of wells) {
      const s = await schematic(w.idwell);
      for (const r of [...s.casings, ...s.tubings, ...s.rods]) {
        if (r.DepthTopCalc == null) continue;
        expect(r.DepthTopCalc, String(r.Des)).toBeGreaterThanOrEqual(0);
        if (r.DepthBtm != null) expect(r.DepthTopCalc, String(r.Des)).toBeLessThanOrEqual(r.DepthBtm);
      }
    }
  }, 120_000);
});
