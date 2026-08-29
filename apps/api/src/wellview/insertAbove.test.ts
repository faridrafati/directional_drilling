/**
 * Insert Records (§3.9).
 *
 * "When you are working with a string component or a tally, you can insert new
 * records instead of adding them to the end of the list. To insert a record
 * above the current record, select the existing record and click the button."
 *
 * Until now the ghost row was the only way to add one, and it appends. On a
 * casing tally that means a joint discovered to be missing from the middle of a
 * string can only be added at the bottom and then walked up one Move at a time
 * — 222 rows in the largest tally in this database.
 *
 * Everything is written into a SYNTHETIC well and deleted again, so the sample
 * database is left exactly as it was found. The last test proves that.
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
const TEST_IDWELL = "TEST000000000000000000INSERTABOV";
/** Two parents in the same well, so a shift confined to one can be proved. */
const PARENT_A = "TESTPARENTA00000000000000000000A";
const PARENT_B = "TESTPARENTB00000000000000000000B";
const TABLE = "wvCasCompTally";

const hasDb = existsSync(SAMPLE);
const d = describe.skipIf(!hasDb);

let app: FastifyInstance;
let auth: { Authorization: string };
let baseline = 0;

const open = (write = false) => new DatabaseSync(SAMPLE, write ? {} : { readOnly: true });
const countAll = () => {
  const raw = open();
  try { return (raw.prepare(`SELECT COUNT(*) c FROM "${TABLE}"`).get() as { c: number }).c; }
  finally { raw.close(); }
};
function scrub() {
  if (!hasDb) return;
  const raw = open(true);
  raw.exec("PRAGMA busy_timeout = 3000");
  try { raw.prepare(`DELETE FROM "${TABLE}" WHERE idwell = ?`).run(TEST_IDWELL); }
  finally { raw.close(); }
}
/** The folder as it reads on screen: IDRec in sysSeq order. */
function folder(parent: string): { id: string; seq: number; des: string }[] {
  const raw = open();
  try {
    return raw.prepare(`SELECT IDRec AS id, sysSeq AS seq, COALESCE(RefNo, '') AS des FROM "${TABLE}"
      WHERE idwell = ? AND IDRecParent = ? ORDER BY sysSeq`).all(TEST_IDWELL, parent) as
      { id: string; seq: number; des: string }[];
  } finally { raw.close(); }
}

beforeAll(async () => {
  scrub();
  baseline = hasDb ? countAll() : 0;
  app = Fastify();
  await registerWellviewDbRoutes(app);
  await app.ready();
  const { token } = issueToken({ id: "test", username: "vitest", role: "admin" });
  auth = { Authorization: `Bearer ${token}` };
});
afterAll(async () => { await app?.close(); scrub(); });

const add = async (parent: string, des: string, insertBefore?: string) => {
  const res = await app.inject({
    method: "POST",
    url: `/entry/wellview/dbs/${DB}/records/${TABLE}`,
    headers: auth,
    payload: { idwell: TEST_IDWELL, parent, values: { RefNo: des }, ...(insertBefore ? { insertBefore } : {}) },
  });
  return res;
};
const addOk = async (parent: string, des: string, insertBefore?: string) => {
  const res = await add(parent, des, insertBefore);
  expect(res.statusCode, res.body).toBe(200);
  return (res.json() as { idrec: string }).idrec;
};

d("inserting a record above another", () => {
  it("puts the new record where the guide says, and moves the rest down", async () => {
    scrub();
    await addOk(PARENT_A, "one");
    await addOk(PARENT_A, "two");
    await addOk(PARENT_A, "three");
    expect(folder(PARENT_A).map((r) => r.des)).toEqual(["one", "two", "three"]);

    const two = folder(PARENT_A)[1].id;
    await addOk(PARENT_A, "inserted", two);
    expect(folder(PARENT_A).map((r) => r.des)).toEqual(["one", "inserted", "two", "three"]);

    // Every record still has a sequence number of its own; a shift that left
    // two rows sharing one would put the folder in an order SQLite decides.
    const seqs = folder(PARENT_A).map((r) => r.seq);
    expect(new Set(seqs).size, "no duplicate sysSeq").toBe(seqs.length);
    expect([...seqs].sort((a, b) => a - b)).toEqual(seqs);
    scrub();
  });

  it("inserts above the first record", async () => {
    scrub();
    await addOk(PARENT_A, "one");
    await addOk(PARENT_A, "two");
    const first = folder(PARENT_A)[0].id;
    await addOk(PARENT_A, "new top", first);
    expect(folder(PARENT_A).map((r) => r.des)).toEqual(["new top", "one", "two"]);
    scrub();
  });

  it("still appends when no position is asked for", async () => {
    // The behaviour every existing caller depends on, unchanged.
    scrub();
    await addOk(PARENT_A, "one");
    await addOk(PARENT_A, "two");
    await addOk(PARENT_A, "three");
    expect(folder(PARENT_A).map((r) => r.des)).toEqual(["one", "two", "three"]);
    scrub();
  });

  it("renumbers only the folder the record is in", async () => {
    /*
     * The scope is read off the TARGET ROW, not off the request. A caller that
     * names a record but omits `parent` would otherwise shift every tally row
     * in the well — every joint of every string.
     */
    scrub();
    await addOk(PARENT_A, "A1");
    await addOk(PARENT_A, "A2");
    await addOk(PARENT_B, "B1");
    await addOk(PARENT_B, "B2");
    const beforeB = folder(PARENT_B).map((r) => [r.des, r.seq] as const);

    const a1 = folder(PARENT_A)[0].id;
    const res = await app.inject({
      method: "POST",
      url: `/entry/wellview/dbs/${DB}/records/${TABLE}`,
      headers: auth,
      // NO parent given — the server must take it from the target record.
      payload: { idwell: TEST_IDWELL, values: { RefNo: "A0" }, insertBefore: a1 },
    });
    expect(res.statusCode, res.body).toBe(200);
    expect(folder(PARENT_A).map((r) => r.des)).toEqual(["A0", "A1", "A2"]);
    expect(folder(PARENT_B).map((r) => [r.des, r.seq] as const),
      "the other string's tally is untouched").toEqual(beforeB);
    scrub();
  });

  it("numbers a folder that has none, in the order it already reads", async () => {
    /*
     * THE CASE THE BROWSER CAUGHT AND THE UNIT TESTS DID NOT.
     *
     * 2,574 of the 24,644 rows in this database's sequenced tables carry a NULL
     * sysSeq — 562 of the 595 bit nozzles. With every number null, SQL compares
     * NULL to a number as NULL, the shift matches nothing, and the "inserted"
     * record silently lands at the END. That is what the first browser run of
     * this command did.
     */
    scrub();
    const ids = [
      await addOk(PARENT_A, "n1"),
      await addOk(PARENT_A, "n2"),
      await addOk(PARENT_A, "n3"),
    ];
    // Wipe the numbers, reproducing how the vendor's own rows arrived.
    const w = open(true);
    w.exec("PRAGMA busy_timeout = 3000");
    w.prepare(`UPDATE "${TABLE}" SET sysSeq = NULL WHERE idwell = ?`).run(TEST_IDWELL);
    w.close();
    expect(folder(PARENT_A).every((r) => r.seq == null), "all null to start").toBe(true);

    const res = await add(PARENT_A, "wedged in", ids[1]);
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json().renumbered, "the folder was numbered first").toBe(3);

    const now = folder(PARENT_A);
    expect(now.map((r) => r.des), "and the record went where it was asked to")
      .toEqual(["n1", "wedged in", "n2", "n3"]);
    expect(now.every((r) => typeof r.seq === "number"), "every record has a number now").toBe(true);
    scrub();
  });

  it("refuses a record in a different folder", async () => {
    scrub();
    await addOk(PARENT_A, "A1");
    await addOk(PARENT_B, "B1");
    const b1 = folder(PARENT_B)[0].id;
    const res = await add(PARENT_A, "wrong", b1);
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/different folder/i);
    expect(folder(PARENT_A).length, "nothing was written").toBe(1);
    scrub();
  });

  it("refuses a folder that has no order of its own", async () => {
    /*
     * `orderColumn` sorts an unsequenced folder by its own fields, so "above"
     * would renumber a column nobody sees the folder through and the record
     * would appear wherever its date or depth put it.
     */
    const raw = open();
    const job = raw.prepare("SELECT idwell, IDRec FROM wvJob LIMIT 1").get() as
      { idwell: string; IDRec: string };
    raw.close();
    const res = await app.inject({
      method: "POST",
      url: `/entry/wellview/dbs/${DB}/records/wvJob`,
      headers: auth,
      payload: { idwell: job.idwell, values: {}, insertBefore: job.IDRec },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/not a sequenced folder|no order of their own/i);
  });

  it("refuses a record that does not exist", async () => {
    const res = await add(PARENT_A, "x", "0000000000000000000000000000FFFF");
    expect(res.statusCode).toBe(404);
  });

  it("leaves the sample database exactly as it found it", () => {
    scrub();
    expect(countAll()).toBe(baseline);
    const raw = open();
    const residue = (raw.prepare(`SELECT COUNT(*) c FROM "${TABLE}" WHERE idwell = ?`)
      .get(TEST_IDWELL) as { c: number }).c;
    raw.close();
    expect(residue).toBe(0);
  });
});
