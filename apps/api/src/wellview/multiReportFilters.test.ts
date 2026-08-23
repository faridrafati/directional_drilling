/**
 * Multi-well reports carry row filters, and now apply them.
 *
 * Every multi-well report ran as `SELECT … WHERE idwell IN (…)` and returned
 * the whole table, because `reports-multi.json` was built without the filters
 * its `.afm` files carry. Three differently-named templates therefore produced
 * identical output on a database holding 22 drilling jobs, 10
 * completion/workover and 1 abandonment.
 *
 * The filters were decoded by `scripts/wellview-db/build_afm_filters.mjs` — the
 * format is documented there, along with what is known and what is inferred.
 * Two inferences carry real risk and are pinned here so a change to either is
 * visible rather than silent:
 *
 *   THE WILDCARD. Two templates filter on the value "drill*". WellView's
 *   wildcard is `*`; SQL's is `%`. Untranslated it matches nothing and empties
 *   both reports.
 *
 *   THE CONJUNCTION. The file carries a flag whose meaning could not be
 *   established, so the rule was chosen by testing all three candidates against
 *   every shipped template and keeping the only one that never empties a report
 *   that returns rows today — OR within a table, AND across tables. SCVF is the
 *   clearest case: two filters on the same field, "scvf" and "vent flow", where
 *   no row can be both.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Fastify, { type FastifyInstance } from "fastify";
import { registerWellviewDbRoutes } from "../routes/wellviewDb.js";
import { issueToken } from "../entry/auth.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const SAMPLE = join(HERE, "..", "..", "..", "..", "sqlite_DB", "wellview", "wv9.0_Sample.sqlite");
const DB = "wv9.0_Sample";
const d = describe.skipIf(!existsSync(SAMPLE));

interface Block {
  table: string | null; rows: unknown[][]; rowCount: number; truncated: boolean;
  filtersApplied?: string[]; filtersSkipped?: string[];
}

let app: FastifyInstance;
let auth: { Authorization: string };
let wells: string[];
let templates: { html: string; name: string; folder?: string }[];

beforeAll(async () => {
  app = Fastify();
  await registerWellviewDbRoutes(app);
  await app.ready();
  const { token } = issueToken({ id: "test", username: "vitest", role: "admin" });
  auth = { Authorization: `Bearer ${token}` };
  const w = await app.inject({ url: `/entry/wellview/dbs/${DB}/wells`, headers: auth });
  wells = (w.json() as { wells: { idwell: string }[] }).wells.map((x) => x.idwell);
  const t = await app.inject({ url: `/entry/wellview/dbs/${DB}/reports-multi`, headers: auth });
  templates = (t.json() as { reports: typeof templates }).reports;
});
afterAll(async () => { await app?.close(); });

const run = async (name: string) => {
  const t = templates.find((x) => x.name === name)!;
  expect(t, name).toBeTruthy();
  const res = await app.inject({
    url: `/entry/wellview/dbs/${DB}/multi-report?html=${encodeURIComponent(t.html)}&wells=${wells.join(",")}`,
    headers: auth,
  });
  expect(res.statusCode).toBe(200);
  return (res.json() as { blocks: Block[] }).blocks;
};

const firstRows = (bs: Block[]) => bs.find((b) => b.table)?.rows.length ?? 0;

d("a multi-well template's own filters", () => {
  it("makes the three rig reports stop being identical", async () => {
    // 112 jobs: 28 drilling, 78 completion/workover, 4 other, 1 abandon, 1 null.
    const drilling = await run("Drilling Rigs with query");
    const completion = await run("Completion Rigs with query");
    const all = await run("Rigs with query");

    const nD = firstRows(drilling), nC = firstRows(completion), nA = firstRows(all);
    expect(nD, "Drilling Rigs").toBeGreaterThan(0);
    expect(nC, "Completion Rigs").toBeGreaterThan(0);
    expect(nA, "Rigs (unfiltered)").toBeGreaterThan(0);

    // The whole point: three names, three answers.
    expect(new Set([nD, nC, nA]).size).toBe(3);
    // Drilling and Completion are complements within the unfiltered set.
    expect(nD).toBeLessThan(nA);
    expect(nC).toBeLessThan(nA);
  });

  it("translates WellView's * wildcard, so drill* is not empty", async () => {
    // "drill*" untranslated matches nothing; both these templates would be blank.
    for (const name of ["Daily Drilling Summary 1", "Daily Drilling Summary 2"]) {
      const bs = await run(name);
      const filtered = bs.find((b) => b.filtersApplied?.length);
      expect(filtered, name).toBeTruthy();
      expect(filtered!.rows.length, name).toBeGreaterThan(0);
    }
  });

  it("ORs two filters on the same field, which AND cannot answer", async () => {
    // SCVF filters testtyp for "scvf" OR "vent flow". No row is both.
    const bs = await run("SCVF");
    const b = bs.find((x) => x.filtersApplied?.length)!;
    expect(b, "SCVF has a filtered block").toBeTruthy();
    expect(b.filtersApplied!.length).toBe(2);
    expect(b.rows.length).toBeGreaterThan(0);
  });

  it("counts what it returns, not what it would have returned unfiltered", async () => {
    // The COUNT carries the same filters as the SELECT. Without that a report
    // showing 28 rows announces 112 and calls a complete result truncated.
    for (const name of ["Drilling Rigs with query", "SCVF", "Packers"]) {
      const bs = await run(name);
      for (const b of bs) {
        if (!b.table || b.truncated) continue;
        expect(b.rowCount, `${name} / ${b.table}`).toBe(b.rows.length);
      }
    }
  });

  it("says what it could not apply instead of dropping it", async () => {
    // Geology/Formations carries a filter whose operator is not understood and
    // whose value is the string "NaN". It must still return its rows, and must
    // say the filter was skipped.
    const bs = await run("Formations");
    const withSkip = bs.filter((b) => b.filtersSkipped?.length);
    expect(withSkip.length, "a skip is reported").toBeGreaterThan(0);
    expect(firstRows(bs), "the report still works").toBeGreaterThan(0);
  });

  it("leaves an unfiltered template exactly as it was", async () => {
    // 39 of the 57 templates carry no filter at all and must be untouched.
    const bs = await run("Casing Summary");
    for (const b of bs) {
      expect(b.filtersApplied, b.table ?? "?").toBeUndefined();
    }
    expect(firstRows(bs)).toBeGreaterThan(0);
  });
});
