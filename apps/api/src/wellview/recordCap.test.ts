/**
 * A folder read is capped at 500 rows, and now says so.
 *
 * The cap has always been there. What was missing was any way for the caller to
 * know it had been hit: the response carried no total, so the screen printed
 * "500 records" as a fact on a folder holding 2,389, and Copy Data put those 500
 * on the clipboard with nothing to say the rest existed.
 *
 * Two folders in the sample exceed it under a single parent —
 * `wvWellTestTransGaugeData` at 2,389 and `wvGeoEvalLith` at 629.
 *
 * The report path next door has always been honest about the same thing
 * ("first N of M rows"); this makes the folder path match.
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

interface Records { rows: unknown[]; total?: number; truncated?: boolean }

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

const records = async (table: string, q = "") => {
  const res = await app.inject({ url: `/entry/wellview/dbs/${DB}/records/${table}${q}`, headers: auth });
  expect(res.statusCode).toBe(200);
  return res.json() as Records;
};

/** The biggest single parent in a table, and how many rows hang off it. */
function biggestParent(table: string) {
  const raw = new DatabaseSync(SAMPLE, { readOnly: true });
  try {
    const r = raw.prepare(
      `SELECT idwell, IDRecParent AS p, COUNT(*) n FROM "${table}"
        WHERE IDRecParent IS NOT NULL GROUP BY IDRecParent ORDER BY n DESC LIMIT 1`,
    ).get() as { idwell: string; p: string; n: number };
    return r;
  } finally { raw.close(); }
}

d("a capped folder read", () => {
  it("reports the real size of the two folders that exceed the cap", async () => {
    for (const [table, expected] of [["wvWellTestTransGaugeData", 2389], ["wvGeoEvalLith", 629]] as const) {
      const b = biggestParent(table);
      expect(b.n, table).toBe(expected);
      const got = await records(table, `?idwell=${b.idwell}&parent=${b.p}`);
      expect(got.rows.length, table).toBe(500);
      expect(got.truncated, table).toBe(true);
      expect(got.total, table).toBe(expected);
    }
  });

  it("says nothing special about a folder that fits", async () => {
    // `truncated` false and `total` equal to what was sent — so a caller can
    // print `total` unconditionally without a special case.
    const got = await records("wvCas");
    expect(got.rows.length).toBeLessThan(500);
    expect(got.truncated).toBe(false);
    expect(got.total).toBe(got.rows.length);
  });

  it("counts the folder, not the table", async () => {
    // The COUNT carries the same WHERE as the SELECT. Without that it would
    // report the whole table's size against one parent's rows — a number that
    // is wrong in the same direction as the bug being fixed.
    const b = biggestParent("wvWellTestTransGaugeData");
    const raw = new DatabaseSync(SAMPLE, { readOnly: true });
    const whole = (raw.prepare("SELECT COUNT(*) c FROM wvWellTestTransGaugeData").get() as { c: number }).c;
    raw.close();

    const got = await records("wvWellTestTransGaugeData", `?idwell=${b.idwell}&parent=${b.p}`);
    expect(whole).toBeGreaterThan(got.total!);
    expect(got.total).toBe(b.n);
  });
});
