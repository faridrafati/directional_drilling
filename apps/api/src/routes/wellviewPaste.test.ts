/**
 * Paste Data from Clipboard (§3.9), against the REAL converted sample database.
 *
 * Every test here writes under a fabricated idwell so it can never touch a real
 * well's data, and asserts the database is clean again afterwards.
 *
 * The assertions that matter are about what the route REFUSES and what it does
 * when a row is bad. A bulk insert that half-succeeds leaves a 147-joint tally
 * that has to be unpicked by hand before it can be retried, and a column that
 * quietly goes nowhere is how a tally ends up missing its grades.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
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
const TEST_IDWELL = "TEST00000000000000000000WVPASTE0";

const hasDb = existsSync(SAMPLE);
const d = describe.skipIf(!hasDb);

let app: FastifyInstance;
let auth: { Authorization: string };

/** Remove anything a previous interrupted run left behind. */
function scrub() {
  if (!hasDb) return;
  const raw = new DatabaseSync(SAMPLE);
  raw.exec("PRAGMA busy_timeout = 3000");
  try {
    for (const t of ["wvTubComp", "wvCasComp", "wvNote"]) {
      try { raw.exec(`DELETE FROM ${t} WHERE idwell = '${TEST_IDWELL}'`); } catch { /* no such table */ }
    }
  } finally { raw.close(); }
}

const count = (table: string): number => {
  const raw = new DatabaseSync(SAMPLE, { readOnly: true });
  try {
    return (raw.prepare(`SELECT COUNT(*) n FROM ${table} WHERE idwell = ?`)
      .get(TEST_IDWELL) as { n: number }).n;
  } finally { raw.close(); }
};

beforeAll(async () => {
  scrub();
  app = Fastify();
  await registerWellviewDbRoutes(app);
  await app.ready();
  const { token } = issueToken({ id: "test", username: "vitest", role: "admin" });
  auth = { Authorization: `Bearer ${token}` };
});
afterEach(() => scrub());
afterAll(async () => { await app?.close(); scrub(); });

const paste = (table: string, body: unknown) =>
  app.inject({
    method: "POST", url: `/entry/wellview/dbs/${DB}/records/${table}/paste`,
    headers: auth, payload: body as never,
  });

d("Paste Data from Clipboard", () => {
  it("rejects without a token, and with nothing to paste", async () => {
    const anon = await app.inject({
      method: "POST", url: `/entry/wellview/dbs/${DB}/records/wvTubComp/paste`,
      payload: { idwell: TEST_IDWELL, rows: [{ Des: "x" }] },
    });
    expect(anon.statusCode).toBe(401);
    expect((await paste("wvTubComp", { idwell: TEST_IDWELL, rows: [] })).statusCode).toBe(400);
  });

  it("inserts a block of rows and keeps their order", async () => {
    const rows = Array.from({ length: 25 }, (_, i) => ({
      Des: `Joint ${i + 1}`, Length: 9.5 + i / 100, SzODNom: 0.114,
    }));
    const res = await paste("wvTubComp", { idwell: TEST_IDWELL, rows });
    expect(res.statusCode).toBe(201);
    const body = res.json() as { inserted: number; columns: string[]; rejected: unknown[] };
    expect(body.inserted).toBe(25);
    expect(count("wvTubComp")).toBe(25);

    // A tally is an ordered folder: the pasted order is the order in the hole.
    const raw = new DatabaseSync(SAMPLE, { readOnly: true });
    const got = raw.prepare(
      `SELECT Des, sysSeq FROM wvTubComp WHERE idwell = ? ORDER BY sysSeq`)
      .all(TEST_IDWELL) as { Des: string; sysSeq: number }[];
    raw.close();
    expect(got.map((r) => r.Des)).toEqual(rows.map((r) => r.Des));
    expect(got.map((r) => r.sysSeq)).toEqual(got.map((_, i) => i + 1));
  });

  it("continues the sequence after rows already in the folder", async () => {
    await paste("wvTubComp", { idwell: TEST_IDWELL, rows: [{ Des: "A" }, { Des: "B" }] });
    await paste("wvTubComp", { idwell: TEST_IDWELL, rows: [{ Des: "C" }] });
    const raw = new DatabaseSync(SAMPLE, { readOnly: true });
    const got = raw.prepare(`SELECT Des, sysSeq FROM wvTubComp WHERE idwell = ? ORDER BY sysSeq`)
      .all(TEST_IDWELL) as { Des: string; sysSeq: number }[];
    raw.close();
    expect(got.map((r) => r.Des)).toEqual(["A", "B", "C"]);
    expect(got.map((r) => r.sysSeq)).toEqual([1, 2, 3]);
  });

  it("names the columns it will not write instead of dropping them", async () => {
    const res = await paste("wvTubComp", {
      idwell: TEST_IDWELL,
      rows: [{ Des: "kept", IDRec: "nope", sysModUser: "nope", NotAColumn: "nope" }],
    });
    expect(res.statusCode).toBe(201);
    const body = res.json() as { columns: string[]; rejected: { column: string; why: string }[] };
    expect(body.columns).toEqual(["Des"]);
    const why = Object.fromEntries(body.rejected.map((r) => [r.column, r.why]));
    expect(why.IDRec).toMatch(/key/i);
    expect(why.sysModUser).toMatch(/system/i);
    expect(why.NotAColumn).toMatch(/not a column/i);

    // The record key it refused must not have been honoured.
    const raw = new DatabaseSync(SAMPLE, { readOnly: true });
    const r = raw.prepare("SELECT IDRec FROM wvTubComp WHERE idwell = ?").get(TEST_IDWELL) as { IDRec: string };
    raw.close();
    expect(r.IDRec).not.toBe("nope");
    expect(r.IDRec).toMatch(/^[0-9A-F]{32}$/i);
  });

  it("refuses a paste of only unwritable columns rather than inserting blanks", async () => {
    const res = await paste("wvTubComp", { idwell: TEST_IDWELL, rows: [{ IDRec: "x", sysTag: "y" }] });
    expect(res.statusCode).toBe(400);
    expect(count("wvTubComp")).toBe(0);
  });

  it("rolls the WHOLE paste back when one row cannot be written", async () => {
    // A half-written tally is worse than none: it has to be unpicked by hand
    // before the paste can be retried.
    const rows: Record<string, unknown>[] = Array.from({ length: 10 }, (_, i) => ({ Des: `ok ${i}` }));
    rows[7].Length = { not: "a scalar" };            // node:sqlite refuses this
    const res = await paste("wvTubComp", { idwell: TEST_IDWELL, rows });
    expect(res.statusCode).toBe(400);
    expect((res.json() as { error: string }).error).toMatch(/rolled back/i);
    expect(count("wvTubComp"), "rows survived a rolled-back paste").toBe(0);
  });

  it("caps a runaway paste", async () => {
    const rows = Array.from({ length: 5001 }, () => ({ Des: "x" }));
    const res = await paste("wvTubComp", { idwell: TEST_IDWELL, rows });
    expect(res.statusCode).toBe(400);
    expect((res.json() as { error: string }).error).toMatch(/too many rows/i);
    expect(count("wvTubComp")).toBe(0);
  });

  it("requires a well, and refuses an unknown table", async () => {
    expect((await paste("wvTubComp", { rows: [{ Des: "x" }] })).statusCode).toBe(400);
    expect((await paste("wvNotATable", { idwell: TEST_IDWELL, rows: [{ Des: "x" }] })).statusCode).toBe(404);
  });

  it("handles the guide's 147-joint tally in one call", async () => {
    const rows = Array.from({ length: 147 }, (_, i) => ({
      Des: `Joint ${i + 1}`, Length: 9.45, SzODNom: 0.0889, Grade: "L-80",
    }));
    const res = await paste("wvTubComp", { idwell: TEST_IDWELL, rows });
    expect(res.statusCode).toBe(201);
    expect(count("wvTubComp")).toBe(147);
  });
});
