/**
 * Find (§3.9 Finding Data).
 *
 * "Some Edit Data folders contain a large number of records. You can use the
 * Find command to quickly access specific data within the folder."
 *
 * That sentence is the whole argument for doing this in SQL. A read is capped
 * at 500 rows and this database holds a single folder of 2,389 — the well test
 * transient's gauge data — so a find written over the rows the grid had loaded
 * would search the first 500 and silently miss the other 1,889. The rows most
 * in need of finding are exactly the ones it would not reach.
 *
 * Everything here reads. Nothing is written, so there is nothing to scrub.
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

const hasDb = existsSync(SAMPLE);
const d = describe.skipIf(!hasDb);

let app: FastifyInstance;
let auth: { Authorization: string };
/** The 2,389-row folder: one well test transient's pressure gauge readings. */
let big: { idwell: string; parent: string };

type Rows = {
  rows: Record<string, unknown>[];
  total: number;
  folderTotal: number;
  find?: string;
  truncated: boolean;
};

beforeAll(async () => {
  app = Fastify();
  await registerWellviewDbRoutes(app);
  await app.ready();
  const { token } = issueToken({ id: "test", username: "vitest", role: "admin" });
  auth = { Authorization: `Bearer ${token}` };
  if (!hasDb) return;
  const raw = new DatabaseSync(SAMPLE, { readOnly: true });
  const r = raw.prepare(`SELECT idwell, IDRecParent AS p, COUNT(*) c
    FROM wvWellTestTransGaugeData GROUP BY 1, 2 ORDER BY c DESC LIMIT 1`)
    .get() as { idwell: string; p: string; c: number };
  big = { idwell: r.idwell, parent: r.p };
  raw.close();
});
afterAll(async () => { await app?.close(); });

const get = async (table: string, q: Record<string, string>) => {
  const qs = new URLSearchParams(q).toString();
  const res = await app.inject({
    url: `/entry/wellview/dbs/${DB}/records/${table}?${qs}`, headers: auth,
  });
  expect(res.statusCode).toBe(200);
  return res.json() as Rows;
};

d("finding data in a folder", () => {
  const TABLE = "wvWellTestTransGaugeData";

  it("reaches records the grid never loaded", async () => {
    const plain = await get(TABLE, { idwell: big.idwell, parent: big.parent });
    expect(plain.total).toBe(2389);
    expect(plain.rows.length).toBe(500);
    expect(plain.truncated).toBe(true);

    /*
     * The readings run over two days and the folder is ordered by time, so
     * every row of the second day sits past the cap: 1,261 readings precede
     * the first of them. A find over the loaded rows would return NOTHING.
     */
    expect(plain.rows.some((r) => String(r.DtTm ?? "").startsWith("2003-09-13"))).toBe(false);

    const found = await get(TABLE, { idwell: big.idwell, parent: big.parent, find: "2003-09-13" });
    expect(found.total, "matches in the folder").toBe(1128);
    expect(found.rows.every((r) => String(r.DtTm ?? "").startsWith("2003-09-13"))).toBe(true);
    expect(found.rows.length).toBe(500);
  });

  it("keeps the folder's own size apart from the number that matched", async () => {
    // "9 records" on a filtered folder is a false statement ABOUT THE FOLDER,
    // so the response carries both numbers and the screen prints both.
    const found = await get(TABLE, { idwell: big.idwell, parent: big.parent, find: "2003-09-13" });
    expect(found.total).toBe(1128);
    expect(found.folderTotal, "the folder, unfiltered").toBe(2389);
    expect(found.find).toBe("2003-09-13");
    expect(found.truncated, "500 of the 1,128 matches").toBe(true);
  });

  it("says nothing about a find when there is none", async () => {
    const plain = await get(TABLE, { idwell: big.idwell, parent: big.parent });
    expect(plain.find).toBeUndefined();
    expect(plain.folderTotal).toBe(plain.total);
  });

  it("matches without regard to case", async () => {
    const lower = await get("wvWellHeader", { find: "sample" });
    const upper = await get("wvWellHeader", { find: "SAMPLE" });
    expect(lower.total).toBeGreaterThan(0);
    expect(upper.total).toBe(lower.total);
  });

  it("does not search the keys or the record links", async () => {
    /*
     * They hold 32-character hex GUIDs. Searching them would let a two-letter
     * term match hundreds of rows that have nothing to do with it — and the
     * parent key is on EVERY row in the folder, so it would match all of them.
     */
    const plain = await get(TABLE, { idwell: big.idwell, parent: big.parent });
    const byParent = await get(TABLE, { idwell: big.idwell, parent: big.parent, find: big.parent });
    expect(byParent.total, "the parent GUID is on every row and must match none").toBe(0);

    const oneId = String(plain.rows[0].IDRec);
    const byId = await get(TABLE, { idwell: big.idwell, parent: big.parent, find: oneId });
    expect(byId.total, "a record's own GUID is not searchable text").toBe(0);
  });

  it("treats LIKE's own wildcards as text the user typed", async () => {
    // Unescaped, "%" would match every row and "_" nearly as many — a search
    // box that answers "everything" to a punctuation mark.
    const all = await get(TABLE, { idwell: big.idwell, parent: big.parent });
    for (const term of ["%", "_", "%%"]) {
      const r = await get(TABLE, { idwell: big.idwell, parent: big.parent, find: term });
      expect(r.total, `"${term}" is a literal`).toBeLessThan(all.total);
    }
  });

  it("finds a value in any displayed field, not only the first", async () => {
    // The guide's example is finding a code in the AFE Cost Breakdown — a value
    // in one column among many, not the record's name.
    const raw = new DatabaseSync(SAMPLE, { readOnly: true });
    const row = raw.prepare(`SELECT idwell, IDRecParent AS p, Temp FROM wvWellTestTransGaugeData
      WHERE Temp IS NOT NULL AND idwell = ? AND IDRecParent = ? LIMIT 1`)
      .get(big.idwell, big.parent) as { Temp: number };
    const expected = Number((raw.prepare(`SELECT COUNT(*) c FROM wvWellTestTransGaugeData
      WHERE idwell = ? AND IDRecParent = ? AND CAST(Temp AS TEXT) LIKE ?`)
      .get(big.idwell, big.parent, `%${row.Temp}%`) as { c: number }).c);
    raw.close();
    const found = await get(TABLE, {
      idwell: big.idwell, parent: big.parent, find: String(row.Temp),
    });
    expect(found.total).toBe(expected);
    expect(found.total).toBeGreaterThan(0);
  });
});
