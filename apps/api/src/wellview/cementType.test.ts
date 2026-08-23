/**
 * The three kinds of cement, and why the schematic has to tell them apart.
 *
 * The guide: "There are three types of cement: Casing cement, Plugs, Squeezes …
 * WellView draws the applicable icon on the schematic using the type you select
 * for the record."
 *
 * The payload never asked for the type, so all three were drawn identically —
 * two hatched strips in the ANNULUS, cement behind pipe. A plug is not behind
 * pipe: it fills the bore, and the only reason to look at one on a schematic is
 * that it is in the way of a re-entry. Sample 04 has a 374 m abandonment plug
 * at 4,422.6–4,796.9 m that was drawn as though the hole through it were open.
 *
 * 36 of the sample's 113 cement records are a plug or a squeeze.
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

interface Stage {
  Des?: string | null; DepthTop?: number | null; DepthBtm?: number | null;
  CementTyp?: string | null; IDRecString?: string | null;
}
interface Schematic { cement: Stage[]; cementStages: Stage[] }

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

/** The kind, matched the way the drawing matches it. */
const kindOf = (s: Stage) => {
  const t = `${s.CementTyp ?? ""}`.toLowerCase();
  return t.includes("squeeze") ? "squeeze" : t.includes("plug") ? "plug" : "casing";
};

d("a cement stage says which kind it is", () => {
  it("carries the type through to every drawable stage", async () => {
    const counts = { casing: 0, plug: 0, squeeze: 0 };
    for (const w of wells) {
      for (const s of (await schematic(w.idwell)).cementStages ?? []) counts[kindOf(s)]++;
    }
    // 79 casing, 25 plug, 11 squeeze — every stage with both depths recorded.
    expect(counts).toEqual({ casing: 79, plug: 25, squeeze: 11 });
    // A third of them are the two kinds that were being drawn as the first.
    expect(counts.plug + counts.squeeze).toBe(36);
  }, 120_000);

  it("matches what the database holds, not a guess from the description", async () => {
    // The type is a stored column, and several rows are described in ways that
    // would mislead a name-based guess — a stage called "Perf Plug" belongs to a
    // PLUG record, but "Squeeze Perfs" belongs to a SQUEEZE.
    const raw = new DatabaseSync(SAMPLE, { readOnly: true });
    const expected = new Map<string, string>();
    for (const r of raw.prepare(`
      SELECT s.IDRec AS id, lower(COALESCE(c.CementTyp,'')) AS typ
        FROM wvCementStage s JOIN wvCement c ON c.IDRec = s.IDRecParent
       WHERE s.DepthTop IS NOT NULL AND s.DepthBtm IS NOT NULL`).all() as { id: string; typ: string }[]) {
      expected.set(r.id, r.typ);
    }
    raw.close();
    expect(expected.size).toBe(115);

    let seen = 0;
    for (const w of wells) {
      for (const s of (await schematic(w.idwell)).cementStages ?? []) {
        const want = expected.get(String((s as { IDRec?: string }).IDRec));
        if (want === undefined) continue;
        seen++;
        expect(`${s.CementTyp ?? ""}`.toLowerCase(), String(s.Des)).toBe(want);
      }
    }
    expect(seen).toBeGreaterThan(100);
  }, 120_000);

  it("finds Sample 04's abandonment plug, the one that mattered", async () => {
    const w = wells.find((x) => x.WellName.startsWith("Sample 04"))!;
    const stages = (await schematic(w.idwell)).cementStages ?? [];
    const plugs = stages.filter((s) => kindOf(s) === "plug");
    expect(plugs.length).toBe(3);
    // 374 m of cement across the hole, drawn as annular cement until now.
    const big = plugs.find((s) => (s.DepthBtm ?? 0) - (s.DepthTop ?? 0) > 300)!;
    expect(big).toBeTruthy();
    expect(big.DepthTop!).toBeCloseTo(4422.6, 0);
    expect(big.DepthBtm!).toBeCloseTo(4796.9, 0);
    // …and the well's casing cement is still casing cement.
    expect(stages.filter((s) => kindOf(s) === "casing").length).toBe(7);
    expect(stages.filter((s) => kindOf(s) === "squeeze").length).toBe(1);
  }, 120_000);
});
