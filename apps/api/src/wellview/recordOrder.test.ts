/**
 * A new record joins the END of its folder.
 *
 * WellView orders a SEQUENCED folder — a casing tally, a wellbore list, a
 * programme's phases — by `sysSeq`, because that order is a statement someone
 * made: a tally reads shoe-up or shoe-down because a person arranged it. This
 * app's insert route did not assign one, and SQLite sorts NULL FIRST, so an
 * added joint did not land at the bottom of the string. It jumped to the top,
 * above the shoe, and every report and the schematic then read the string in
 * the wrong order.
 *
 * It is invisible in the sample data because nothing there has a null `sysSeq`
 * — all 776 wvCasCompTally rows carry one. Every null would be this app's, and
 * the desktop would show it the same way.
 *
 * Writes happen under a fabricated idwell that cannot collide with a real well,
 * and the test asserts the database ends with that idwell gone again.
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
const TEST_IDWELL = "TEST00000000000000000000SEQORDER";
const TABLE = "wvWellbore";

const hasDb = existsSync(SAMPLE);
const d = describe.skipIf(!hasDb);

function scrub() {
  if (!hasDb) return;
  const raw = new DatabaseSync(SAMPLE);
  raw.exec("PRAGMA busy_timeout = 3000");
  try { raw.exec(`DELETE FROM "${TABLE}" WHERE idwell = '${TEST_IDWELL}'`); } finally { raw.close(); }
}

function rows() {
  const raw = new DatabaseSync(SAMPLE, { readOnly: true });
  try {
    return raw.prepare(`SELECT IDRec, Des, sysSeq FROM "${TABLE}" WHERE idwell = ? ORDER BY sysSeq ASC`)
      .all(TEST_IDWELL) as { IDRec: string; Des: string; sysSeq: number | null }[];
  } finally { raw.close(); }
}

let app: FastifyInstance;
let auth: { Authorization: string };

beforeAll(async () => {
  scrub();
  app = Fastify();
  await registerWellviewDbRoutes(app);
  await app.ready();
  const { token } = issueToken({ id: "test", username: "vitest", role: "admin" });
  auth = { Authorization: `Bearer ${token}` };
});
afterAll(async () => { scrub(); await app?.close(); });

d("a new record in a sequenced folder", () => {
  it("is given the next sysSeq, so it sorts last and not first", async () => {
    const add = (des: string) => app.inject({
      method: "POST",
      url: `/entry/wellview/dbs/${DB}/records/${TABLE}`,
      headers: auth,
      payload: { idwell: TEST_IDWELL, values: { Des: des } },
    });

    for (const des of ["first", "second", "third"]) {
      const res = await add(des);
      expect(res.statusCode, des).toBe(200);
    }

    const got = rows();
    expect(got.length).toBe(3);
    // Every one has a sequence — a single null would sort above everything.
    expect(got.map((r) => r.sysSeq)).toEqual([1, 2, 3]);
    // …and reading the folder in its own order gives them back as entered.
    expect(got.map((r) => r.Des)).toEqual(["first", "second", "third"]);
  });

  it("counts within the folder, not the table", async () => {
    // The existing wellbores of real wells run to sysSeq 1..n each. If the max
    // were taken across the table, the first row added to an empty folder would
    // come back with someone else's number — harmless to sort but wrong, and it
    // would drift further with every well.
    const got = rows();
    expect(got[0].sysSeq).toBe(1);

    const raw = new DatabaseSync(SAMPLE, { readOnly: true });
    const tableMax = (raw.prepare(`SELECT MAX(sysSeq) m FROM "${TABLE}"`).get() as { m: number }).m;
    raw.close();
    expect(tableMax).toBeGreaterThan(1);
    expect(got[0].sysSeq).not.toBe(tableMax + 1);
  });

  it("leaves the database as it found it", async () => {
    for (const r of rows()) {
      const res = await app.inject({
        method: "DELETE",
        url: `/entry/wellview/dbs/${DB}/records/${TABLE}/${r.IDRec}`,
        headers: auth,
      });
      expect(res.statusCode).toBe(200);
    }
    expect(rows()).toEqual([]);
  });
});
