/**
 * Two subject areas the schematic never drew, and one it drew wrongly.
 *
 * OTHER STRINGS (wvOtherStr) were not in the payload at all. Thirteen in the
 * sample across four wells, twelve still downhole — including a Basket Bridge
 * Plug at 4,262 m and a Dropped TCP Gun at 4,326 m in a well whose deepest
 * casing shoe is shallower than both. For a re-entry or a fishing job those are
 * exactly the records the picture exists to show.
 *
 * DEPTH ANNOTATIONS (wvDepthAnnotation) are the only table in the model whose
 * sole documented purpose is to put text on this drawing, and nothing read it.
 *
 * PROPOSED equipment was misclassified. `isProposed` required the run date to
 * be ABSENT, which reads the two columns backwards: when the flag is set,
 * DtTmRun is the date the equipment is proposed to run ON. Two tubing strings —
 * both literally named "Proposed Production Tubing" — therefore fell through to
 * the in-hole test and were drawn as ordinary steel, unmarked. One of them has
 * no pull date, so it was solid on every date after 2000-04-09.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import Fastify, { type FastifyInstance } from "fastify";
import { registerWellviewDbRoutes } from "../routes/wellviewDb.js";
import { issueToken } from "../entry/auth.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const SAMPLE = join(HERE, "..", "..", "..", "..", "sqlite_DB", "wellview", "wv9.0_Sample.sqlite");
const DB = "wv9.0_Sample";
const d = describe.skipIf(!existsSync(SAMPLE));

interface Row { [k: string]: unknown }
let app: FastifyInstance;
let auth: { Authorization: string };
let db: DatabaseSync;

beforeAll(async () => {
  app = Fastify();
  await registerWellviewDbRoutes(app);
  await app.ready();
  const { token } = issueToken({ id: "test", username: "vitest", role: "admin" });
  auth = { Authorization: `Bearer ${token}` };
  db = new DatabaseSync(SAMPLE, { readOnly: true });
});
afterAll(async () => { await app?.close(); db?.close(); });

const schematic = async (idwell: string) => {
  const res = await app.inject({
    url: `/entry/wellview/dbs/${DB}/schematic?idwell=${idwell}`, headers: auth,
  });
  expect(res.statusCode).toBe(200);
  return res.json() as { otherStr?: Row[]; annotations?: Row[]; tubings?: Row[]; dates?: string[] };
};
const wellOf = (name: string) =>
  (db.prepare("SELECT idwell AS w FROM wvWellHeader WHERE WellName = ?").get(name) as { w: string }).w;

d("the schematic payload", () => {
  it("carries the strings left in the hole, with tops from their components", async () => {
    const w = wellOf("Sample 04 - Offshore");
    const s = await schematic(w);
    expect(s.otherStr, "wvOtherStr reaches the client").toBeTruthy();
    const byDes = new Map(s.otherStr!.map((r) => [String(r.Des ?? ""), r]));

    // wvOtherStr has no DepthTop column at all; the top is walked up from the
    // components, exactly as casing and tubing already do.
    const plug = byDes.get("Basket Bridge Plug");
    expect(plug, "the plug is in the payload").toBeTruthy();
    expect(Number(plug!.DepthBtm)).toBeCloseTo(4262.02, 1);
    expect(Number(plug!.DepthTopCalc), "its top was walked up from its components")
      .toBeCloseTo(4260.5, 0);
    expect(plug!.DepthTop, "wvOtherStr has no stored DepthTop at all").toBeUndefined();

    const gun = byDes.get("Dropped TCP Gun");
    expect(Number(gun!.DepthBtm)).toBeCloseTo(4326.64, 1);

    /*
     * The audit says these sit "below the deepest casing in their well". They
     * do not — the production casing on this well runs to 4,446.7 m and both
     * are inside it. What IS true is that they sit below everything the
     * completion put in the hole: deeper than the deepest tubing (4,220.0 m)
     * and deeper than the deepest perforation (4,259.9 m). That is what makes
     * them obstructions to a re-entry, and it is the honest version.
     */
    const deepest = (t: string) => (db.prepare(
      `SELECT MAX(DepthBtm) m FROM "${t}" WHERE idwell = ?`).get(w) as { m: number }).m;
    expect(deepest("wvCas")).toBeGreaterThan(Number(plug!.DepthBtm));
    for (const item of [plug!, gun!]) {
      expect(Number(item.DepthBtm)).toBeGreaterThan(deepest("wvTub"));
      expect(Number(item.DepthBtm)).toBeGreaterThan(deepest("wvPerforation"));
    }
  });

  it("carries the annotations, the one table meant for this drawing", async () => {
    const w = wellOf("Sample 11 - Full Data");
    const s = await schematic(w);
    expect(s.annotations, "wvDepthAnnotation reaches the client").toBeTruthy();
    expect(s.annotations!.length).toBe(1);
    const a = s.annotations![0];
    expect(String(a.Annotation)).toBe("Casing set 12' off bottom");
    expect(Number(a.Depth)).toBeCloseTo(457.2, 1);
  });

  it("the two annotations in the sample sit at the same depth", () => {
    // Which is why equal depths are stacked from the first release rather than
    // overprinted — two rows is not enough to tune a layout, but it is enough
    // to know the collision is real.
    const rows = db.prepare("SELECT Depth FROM wvDepthAnnotation").all() as { Depth: number }[];
    expect(rows.length).toBe(2);
    expect(Math.abs(rows[0].Depth - rows[1].Depth)).toBeLessThan(0.001);
  });

  it("marks a proposed string by its FLAG, not by a missing date", () => {
    // The misclassification, measured. These rows carry the proposed flag AND a
    // run date, so the old rule ("proposed only when there is no run date")
    // called them actual steel.
    const wrong = db.prepare(`SELECT Des, DtTmRun, DtTmPull FROM wvTub
      WHERE ProposedRun = 1 AND DtTmRun IS NOT NULL`).all() as
      { Des: string; DtTmRun: string; DtTmPull: string | null }[];
    expect(wrong.length).toBe(2);
    for (const r of wrong) expect(r.Des).toMatch(/Proposed/i);
    // One of them is never pulled, so it was drawn as steel on every later date.
    expect(wrong.some((r) => r.DtTmPull == null)).toBe(true);

    // wvOtherStr carries the same trap, which is why it had to be fixed before
    // that table was drawn at all.
    const os = db.prepare(`SELECT COUNT(*) c FROM wvOtherStr
      WHERE ProposedRun = 1 AND DtTmRun IS NOT NULL`).get() as { c: number };
    expect(os.c).toBe(1);
  });

  it("still returns a proposed string, so the Proposed toggle can reach it", async () => {
    // Hidden by default is right; unreachable is not. The rows must be in the
    // payload for the toggle to have anything to show.
    const w = wellOf("Sample 02 - Drilling operations");
    const s = await schematic(w);
    const prop = (s.tubings ?? []).filter((t) => String(t.ProposedRun ?? "") === "1");
    expect(prop.length).toBeGreaterThan(0);
    expect(String(prop[0].Des)).toMatch(/Proposed/i);
  });
});
