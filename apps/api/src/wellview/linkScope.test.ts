/**
 * A link between siblings is scoped to their shared parent.
 *
 * A stimulation stage picks one of the fluids defined for THAT stimulation —
 * the help is explicit: "You must define all of the fluid records before you
 * can define the stimulation or treatment stages." The candidate list was
 * scoped to the WELL, so a stage on one stim was offered every fluid on the
 * well, and most of those fluids share a caption with another, so the wrong one
 * was not even distinguishable from the right one.
 *
 * The rule is read off the schema rather than from a list of tables: when the
 * source and the target share a prefix parent they are siblings, and the link
 * can only point within one parent record. It is gated strictly on that —
 * wvCement.IDRecString points across the tree and must keep the well-wide list.
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

let app: FastifyInstance;
let auth: { Authorization: string };
let db: DatabaseSync;

beforeAll(async () => {
  app = Fastify();
  await registerWellviewDbRoutes(app);
  await app.ready();
  const { token } = issueToken({ id: "t", username: "vitest", role: "admin" });
  auth = { Authorization: `Bearer ${token}` };
  db = new DatabaseSync(SAMPLE, { readOnly: true });
});
afterAll(async () => { await app?.close(); db?.close(); });

const candidates = async (q: Record<string, string>) => {
  const res = await app.inject({
    url: `/entry/wellview/dbs/${DB}/link-candidates?${new URLSearchParams(q)}`, headers: auth,
  });
  expect(res.statusCode).toBe(200);
  return res.json() as { scoped: boolean; candidates: { idrec: string; caption: string }[] };
};

d("link candidates", () => {
  it("offers only the fluids of THIS stimulation", async () => {
    // A well with several stims, so the well-wide list is visibly wrong.
    const stim = db.prepare(`SELECT s.IDRec, s.idwell FROM wvStimTreat s
      WHERE (SELECT COUNT(*) FROM wvStimTreatFluid f WHERE f.IDRecParent = s.IDRec) > 0
      LIMIT 1`).get() as { IDRec: string; idwell: string };
    expect(stim, "a stimulation with fluids").toBeTruthy();

    const onWell = (db.prepare(
      "SELECT COUNT(*) c FROM wvStimTreatFluid WHERE idwell = ?").get(stim.idwell) as { c: number }).c;
    const onStim = (db.prepare(
      "SELECT COUNT(*) c FROM wvStimTreatFluid WHERE IDRecParent = ?").get(stim.IDRec) as { c: number }).c;
    expect(onWell, "fluids on the whole well").toBeGreaterThan(onStim);

    const wide = await candidates({ table: "wvStimTreatFluid", idwell: stim.idwell });
    expect(wide.scoped).toBe(false);
    expect(wide.candidates.length).toBe(onWell);

    const narrow = await candidates({
      table: "wvStimTreatFluid", idwell: stim.idwell,
      source: "wvStimTreatStg", parent: stim.IDRec,
    });
    expect(narrow.scoped).toBe(true);
    expect(narrow.candidates.length).toBe(onStim);
    // …and every one it offers really does belong to this stimulation.
    const legal = new Set((db.prepare(
      "SELECT IDRec FROM wvStimTreatFluid WHERE IDRecParent = ?").all(stim.IDRec) as { IDRec: string }[])
      .map((r) => r.IDRec));
    for (const c of narrow.candidates) expect(legal.has(c.idrec)).toBe(true);
  });

  it("does not narrow a link that points across the tree", async () => {
    // wvCement.IDRecString names a casing string, which is not a sibling of a
    // cement job. Scoping it by a shared parent would empty the picker.
    // wvCement has no IDRecParent at all — it hangs off the job by IDRecJob —
    // which is itself why its link cannot be sibling-scoped.
    const cem = db.prepare("SELECT IDRec, idwell FROM wvCement LIMIT 1")
      .get() as { IDRec: string; idwell: string } | undefined;
    if (!cem) return;
    const r = await candidates({
      table: "wvCas", idwell: cem.idwell, source: "wvCement", parent: cem.IDRec,
    });
    expect(r.scoped, "wvCas is not a sibling of wvCement").toBe(false);
    expect(r.candidates.length).toBeGreaterThan(0);
  });

  it("falls back to the well when the record has no parent", async () => {
    const stim = db.prepare("SELECT idwell FROM wvStimTreatFluid LIMIT 1").get() as { idwell: string };
    const r = await candidates({
      table: "wvStimTreatFluid", idwell: stim.idwell, source: "wvStimTreatStg",
    });
    // No `parent` supplied: an empty picker would strand a link with no way to
    // repair it, so the well-wide list stands.
    expect(r.scoped).toBe(false);
    expect(r.candidates.length).toBeGreaterThan(0);
  });

  it("the captions really are ambiguous without scoping", () => {
    // Which is why the well-wide list was not merely long but unusable.
    const dupes = db.prepare(`SELECT COUNT(*) c FROM (
      SELECT idwell, FluidName FROM wvStimTreatFluid WHERE FluidName IS NOT NULL
      GROUP BY idwell, FluidName HAVING COUNT(*) > 1)`).get() as { c: number };
    expect(dupes.c).toBeGreaterThan(0);
  });
});
