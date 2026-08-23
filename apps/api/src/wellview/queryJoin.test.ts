/**
 * Two criteria on a parent and its child must meet on ONE record.
 *
 * Every table used to get its own `EXISTS … WHERE x.idwell = h.idwell`,
 * correlated on the WELL and nothing else. So the shipped "Rig Contractor"
 * template — `wvJob.wvTyp NOT LIKE 'drill'` and `wvJobRig.Contractor LIKE …` —
 * asked only for a well that has some non-drilling job and, separately, some rig
 * record naming that contractor, on any job at all including the drilling one.
 *
 * Measured on the sample: for "Precision" it returned 8 wells and none of the
 * eight is a well where that contractor ran a non-drilling job. For "Ensign",
 * 5 wells of which 1 was right. 9 of the 29 shipped query templates put criteria
 * on a parent and a child.
 *
 * The vendor names this in What's New: "a query of tubing and tubing components
 * should be properly joined without needing Custom SQL".
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

let app: FastifyInstance;
let auth: { Authorization: string };

beforeAll(async () => {
  app = Fastify();
  await registerWellviewDbRoutes(app);
  await app.ready();
  const { token } = issueToken({ id: "test", username: "vitest", role: "admin" });
  auth = { Authorization: `Bearer ${token}` };
});
afterAll(async () => { await app?.close(); });

interface Crit { table: string; field: string; op: string; value?: string | null; conj?: "AND" | "OR" }
const run = async (criteria: Crit[]) => {
  const res = await app.inject({
    method: "POST",
    url: `/entry/wellview/dbs/${DB}/queries/run`,
    headers: auth,
    payload: { criteria },
  });
  expect(res.statusCode, JSON.stringify(res.json())).toBe(200);
  return res.json() as { wells: { idwell: string; WellName?: string }[]; skipped: unknown[] };
};

d("a parent and its child are joined, not merely co-present", () => {
  it("answers the shipped Rig Contractor query correctly", async () => {
    // wvJobRig's parent is wvJob by the prefix rule, so these two criteria are
    // one statement about one job — not two statements about one well.
    const got = await run([
      { table: "wvJob", field: "wvTyp", op: "NOT LIKE", value: "drill" },
      { table: "wvJobRig", field: "Contractor", op: "LIKE", value: "Precision" },
    ]);

    // The truth, straight from SQL: no well in this database has a non-drilling
    // job run by Precision.
    const raw = new DatabaseSync(SAMPLE, { readOnly: true });
    const truth = raw.prepare(`
      SELECT DISTINCT h.idwell FROM wvWellHeader h
       WHERE EXISTS (SELECT 1 FROM wvJob a
                      WHERE a.idwell = h.idwell AND a.wvTyp NOT LIKE '%drill%' COLLATE NOCASE
                        AND EXISTS (SELECT 1 FROM wvJobRig b
                                     WHERE b.IDRecParent = a.IDRec
                                       AND b.Contractor LIKE '%Precision%' COLLATE NOCASE))`)
      .all() as { idwell: string }[];
    raw.close();

    expect(truth.length).toBe(0);
    expect(got.wells.length, "8 wells were returned before this fix").toBe(0);
  });

  it("still finds the well where the pair really does meet", async () => {
    // Cenalta is the one contractor in the sample that did run a non-drilling
    // job, so a fix that simply returned nothing would pass the test above and
    // fail here.
    const got = await run([
      { table: "wvJob", field: "wvTyp", op: "NOT LIKE", value: "drill" },
      { table: "wvJobRig", field: "Contractor", op: "LIKE", value: "Cenalta" },
    ]);
    expect(got.wells.length).toBe(1);
  });

  it("leaves unrelated tables independent", async () => {
    // wvCas and wvPerforation have no prefix relation, so "a well with this
    // casing AND this perforation" is two facts about the WELL and must stay
    // two separate EXISTS. Narrowing these would be a new bug.
    const both = await run([
      { table: "wvCas", field: "Des", op: "LIKE", value: "Production" },
      { table: "wvPerforation", field: "ShotDensity", op: ">", value: "10" },
    ]);
    const cas = await run([{ table: "wvCas", field: "Des", op: "LIKE", value: "Production" }]);
    const perf = await run([{ table: "wvPerforation", field: "ShotDensity", op: ">", value: "10" }]);
    const casIds = new Set(cas.wells.map((w) => w.idwell));
    const perfIds = new Set(perf.wells.map((w) => w.idwell));
    const intersect = [...casIds].filter((x) => perfIds.has(x));
    expect(both.wells.length).toBe(intersect.length);
    expect(both.wells.length).toBeGreaterThan(0);
  });

  it("is not sensitive to the order the criteria arrive in", async () => {
    // The aliases are handed out in emit order and nesting reorders the tables,
    // so a swapped-argument bug would still run and still return a plausible
    // list. Child-first must give the same answer as parent-first.
    const parentFirst = await run([
      { table: "wvJob", field: "wvTyp", op: "NOT LIKE", value: "drill" },
      { table: "wvJobRig", field: "Contractor", op: "LIKE", value: "Cenalta" },
    ]);
    const childFirst = await run([
      { table: "wvJobRig", field: "Contractor", op: "LIKE", value: "Cenalta" },
      { table: "wvJob", field: "wvTyp", op: "NOT LIKE", value: "drill" },
    ]);
    expect(childFirst.wells.map((w) => w.idwell).sort())
      .toEqual(parentFirst.wells.map((w) => w.idwell).sort());
  });

  it("joins two criteria on the same table without nesting them", async () => {
    // Both on wvJob: one EXISTS, two predicates. Nesting a table inside itself
    // would be an infinite regress, and ANDing them across rows would answer a
    // different question.
    const got = await run([
      { table: "wvJob", field: "wvTyp", op: "LIKE", value: "Drilling" },
      { table: "wvJob", field: "Objective", op: "IS NOT NULL" },
    ]);
    const raw = new DatabaseSync(SAMPLE, { readOnly: true });
    const truth = raw.prepare(`
      SELECT DISTINCT h.idwell FROM wvWellHeader h
       WHERE EXISTS (SELECT 1 FROM wvJob a WHERE a.idwell = h.idwell
                       AND a.wvTyp LIKE '%Drilling%' COLLATE NOCASE AND a.Objective IS NOT NULL)`)
      .all() as { idwell: string }[];
    raw.close();
    expect(got.wells.length).toBe(truth.length);
    expect(got.wells.length).toBeGreaterThan(0);
  });
});
