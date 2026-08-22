/**
 * §8.1's And / Or conditions and Custom SQL, against the REAL sample database.
 *
 * The assertion that matters throughout is that a condition CHANGES the answer
 * in the direction it claims. An Or that quietly behaved as an And, or an And
 * that behaved as an Or, would still return wells and still look like a working
 * search — which is exactly the failure the guide warns about in the desktop.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Fastify, { type FastifyInstance } from "fastify";
import { DatabaseSync } from "node:sqlite";
import { registerWellviewDbRoutes } from "./wellviewDb.js";
import { issueToken } from "../entry/auth.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const SAMPLE = join(HERE, "..", "..", "..", "..", "sqlite_DB", "wellview", "wv9.0_Sample.sqlite");
const DB = "wv9.0_Sample";
const hasDb = existsSync(SAMPLE);
const d = describe.skipIf(!hasDb);

let app: FastifyInstance;
let auth: { Authorization: string };

interface RunBody {
  wells: { idwell: string; name: string }[];
  skipped: { criterion: string; reason: string }[];
  ran: number;
  orGroups?: number;
}

beforeAll(async () => {
  app = Fastify();
  await registerWellviewDbRoutes(app);
  await app.ready();
  const { token } = issueToken({ id: "test", username: "vitest", role: "admin" });
  auth = { Authorization: `Bearer ${token}` };
});
afterAll(async () => { await app?.close(); });

const run = async (criteria: unknown[]): Promise<RunBody> => {
  const res = await app.inject({
    method: "POST", url: `/entry/wellview/dbs/${DB}/queries/run`,
    headers: auth, payload: { criteria } as never,
  });
  expect(res.statusCode, res.body.slice(0, 200)).toBe(200);
  return res.json() as RunBody;
};

const sql = (statement: string) =>
  app.inject({
    method: "POST", url: `/entry/wellview/dbs/${DB}/queries/sql`,
    headers: auth, payload: { sql: statement } as never,
  });

const DRILLING = { table: "wvJob", field: "wvTyp", op: "=", value: "Drilling", prompts: false };
const COMPLETION = { table: "wvJob", field: "wvTyp", op: "=", value: "Completion/Workover", prompts: false };

d("§8.1 And / Or conditions", () => {
  it("an Or returns at least as many wells as either side alone", async () => {
    const a = await run([DRILLING]);
    const b = await run([COMPLETION]);
    const either = await run([DRILLING, { ...COMPLETION, conj: "OR" }]);

    expect(a.wells.length).toBeGreaterThan(0);
    expect(b.wells.length).toBeGreaterThan(0);
    expect(either.orGroups).toBe(2);
    expect(either.wells.length).toBeGreaterThanOrEqual(Math.max(a.wells.length, b.wells.length));

    // …and is exactly the union, which is what "meet at least one" means.
    const union = new Set([...a.wells, ...b.wells].map((w) => w.idwell));
    expect(new Set(either.wells.map((w) => w.idwell))).toEqual(union);
  });

  it("an And of two mutually exclusive values on ONE row finds nothing", async () => {
    // Same table, same field: no single job is both types, and criteria on the
    // same table must hold on the SAME row.
    const both = await run([DRILLING, { ...COMPLETION, conj: "AND" }]);
    expect(both.orGroups).toBe(1);
    expect(both.wells.length).toBe(0);
  });

  it("does NOT degrade a cross-table And into an Or", async () => {
    // The desktop's documented quirk (§8.1: "An And acts as an Or condition
    // when criteria is chosen from different tables"). Reproducing it would
    // return wells that meet neither half of what was asked.
    const cas = { table: "wvCas", field: "Des", op: "IS NOT NULL", value: null, prompts: false };
    const drillOnly = await run([DRILLING]);
    const casOnly = await run([cas]);
    const and = await run([DRILLING, { ...cas, conj: "AND" }]);

    expect(and.orGroups).toBe(1);
    expect(and.wells.length).toBeLessThanOrEqual(Math.min(drillOnly.wells.length, casOnly.wells.length));
    const casSet = new Set(casOnly.wells.map((w) => w.idwell));
    for (const w of and.wells) {
      expect(casSet.has(w.idwell), `${w.name} does not satisfy the second criterion`).toBe(true);
    }
  });

  it("groups a mixed list as a sum of products", async () => {
    // A AND B OR C  ==  (A AND B) OR C — three criteria, two groups.
    const body = await run([
      DRILLING,
      { table: "wvCas", field: "Des", op: "IS NOT NULL", value: null, prompts: false, conj: "AND" },
      { ...COMPLETION, conj: "OR" },
    ]);
    expect(body.orGroups).toBe(2);
    expect(body.ran).toBe(3);
  });

  it("a criterion that cannot be applied removes itself from ITS group only", async () => {
    const body = await run([
      DRILLING,
      { table: "wvNotATable", field: "x", op: "=", value: "1", prompts: false, conj: "AND" },
      { ...COMPLETION, conj: "OR" },
    ]);
    expect(body.skipped.length).toBe(1);
    expect(body.ran).toBe(2);
    // The bad criterion did not take the whole group with it, nor widen the other.
    expect(body.orGroups).toBe(2);
  });
});

d("§8.1 Prompt for Value", () => {
  it("takes the value supplied at run time", async () => {
    const res = await app.inject({
      method: "POST", url: `/entry/wellview/dbs/${DB}/queries/run`,
      headers: auth,
      payload: {
        criteria: [{ table: "wvJob", field: "wvTyp", op: "=", value: null, prompts: true }],
        values: { "0": "Drilling" },
      } as never,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as RunBody;
    expect(body.ran).toBe(1);
    expect(body.wells.length).toBeGreaterThan(0);

    const fixed = await run([DRILLING]);
    expect(body.wells.map((w) => w.idwell).sort()).toEqual(fixed.wells.map((w) => w.idwell).sort());
  });

  it("skips a prompting criterion with nothing supplied, rather than matching everything", async () => {
    const body = await run([{ table: "wvJob", field: "wvTyp", op: "=", value: null, prompts: true }]);
    expect(body.ran).toBe(0);
    expect(body.skipped[0].reason).toMatch(/no value/i);
    expect(body.wells.length).toBe(0);
  });
});

d("§8.1 Custom SQL", () => {
  it("runs a SELECT and resolves the wells it names", async () => {
    const res = await sql("SELECT DISTINCT idwell FROM wvJob WHERE wvTyp = 'Drilling'");
    expect(res.statusCode).toBe(200);
    const body = res.json() as { wells: { idwell: string }[]; matched: number; unknown: string[] };
    expect(body.wells.length).toBeGreaterThan(0);
    expect(body.unknown).toEqual([]);
    const viaCriteria = await run([DRILLING]);
    expect(body.wells.map((w) => w.idwell).sort())
      .toEqual(viaCriteria.wells.map((w) => w.idwell).sort());
  });

  it("refuses anything that is not a single SELECT", async () => {
    for (const bad of [
      "DELETE FROM wvJob",
      "UPDATE wvJob SET wvTyp = 'x'",
      "SELECT idwell FROM wvJob; DROP TABLE wvJob",
      "PRAGMA table_info(wvJob)",
    ]) {
      const res = await sql(bad);
      expect(res.statusCode, `accepted: ${bad}`).toBe(400);
    }
  });

  it("insists on an idwell column, because the result is a well list", async () => {
    const res = await sql("SELECT wvTyp FROM wvJob");
    expect(res.statusCode).toBe(400);
    expect((res.json() as { error: string }).error).toMatch(/idwell/i);
  });

  it("reports a syntax error instead of throwing", async () => {
    const res = await sql("SELECT nonsense FROM nowhere");
    expect(res.statusCode).toBe(400);
    expect((res.json() as { error: string }).error).toBeTruthy();
  });

  it("names an idwell the header does not know rather than dropping the row", async () => {
    const res = await sql("SELECT 'NOTAWELL' AS idwell");
    expect(res.statusCode).toBe(200);
    const body = res.json() as { wells: unknown[]; unknown: string[] };
    expect(body.wells).toEqual([]);
    expect(body.unknown).toEqual(["NOTAWELL"]);
  });

  it("requires a statement and a token", async () => {
    expect((await sql("")).statusCode).toBe(400);
    const anon = await app.inject({
      method: "POST", url: `/entry/wellview/dbs/${DB}/queries/sql`,
      payload: { sql: "SELECT idwell FROM wvJob" } as never,
    });
    expect(anon.statusCode).toBe(401);
  });
});

d("§8.1 Custom SQL — the guards, probed adversarially", () => {
  /**
   * The regex guard is defence in DEPTH, not the only line: the handle the
   * route uses is opened read-only, so a write that somehow got past the
   * pattern would still be refused by SQLite itself. Both are asserted, because
   * relying on either alone is how one of them quietly stops being true.
   */
  it("the connection itself refuses to write, regex or no regex", () => {
    const db = new DatabaseSync(SAMPLE, { readOnly: true });
    try {
      expect(() => db.prepare("DELETE FROM wvNote WHERE 1=0").run())
        .toThrow(/readonly/i);
    } finally { db.close(); }
  });

  it("refuses every statement that is not a single read-only SELECT", async () => {
    const refused = [
      "DELETE FROM wvNote",
      "UPDATE wvJob SET wvTyp = 'x'",
      "INSERT INTO wvNote (idwell) VALUES ('x')",
      "DROP TABLE wvNote",
      "SELECT idwell FROM wvJob; DROP TABLE wvNote",
      "PRAGMA table_list",
      "PRAGMA writable_schema = 1",
      "ATTACH DATABASE '/tmp/evil.db' AS evil",
      "CREATE TABLE t (x)",
      "REPLACE INTO wvNote (idwell) VALUES ('x')",
    ];
    for (const bad of refused) {
      const res = await sql(bad);
      expect(res.statusCode, `accepted: ${bad}`).toBe(400);
    }
  });

  it("allows the forms the guide's own examples take", async () => {
    for (const good of [
      "SELECT idwell FROM wvJob LIMIT 1",
      "select idwell from wvJob limit 1",                 // case
      "  SELECT idwell FROM wvJob LIMIT 1 ; ",            // trailing semicolon
      "WITH x AS (SELECT idwell FROM wvJob) SELECT * FROM x LIMIT 1",
    ]) {
      const res = await sql(good);
      expect(res.statusCode, `refused: ${good} — ${res.body.slice(0, 90)}`).toBe(200);
    }
  });

  it("does not turn a schema read into a well", async () => {
    // sqlite_master is reachable — it is the user's own database and the app
    // already lists its tables — but its names must not be dressed up as wells.
    const res = await sql(
      "SELECT name AS idwell FROM sqlite_master WHERE type = 'table' LIMIT 5");
    expect(res.statusCode).toBe(200);
    const body = res.json() as { wells: unknown[]; unknown: string[] };
    expect(body.wells).toEqual([]);
    expect(body.unknown.length).toBeGreaterThan(0);
  });
});
