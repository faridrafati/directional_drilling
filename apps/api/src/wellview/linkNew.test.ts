/**
 * `<new>` in the link picker (§3.11 Looking up Associated Data).
 *
 * "If the record is not created yet, click <new> to create a new record" — and,
 * from the Zones example in 9.0's own overview, "Click <new> to go to the Zones
 * tables and add a new record. The link to the new record is automatically
 * added to the current table."
 *
 * Without it, linking a perforation to a zone that has not been entered means
 * leaving the record, opening Zones, adding one, and coming back — and the
 * picker's own empty state said exactly that: "No records yet in that folder
 * for this well. Enter one there first."
 *
 * This file tests the SERVER's half: which targets can be created from a
 * picker, and that a created record is a real, linkable row.
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
const TEST_IDWELL = "TEST000000000000000000000LINKNEW";

const hasDb = existsSync(SAMPLE);
const d = describe.skipIf(!hasDb);

let app: FastifyInstance;
let auth: { Authorization: string };
let well: string;

const open = (write = false) => new DatabaseSync(SAMPLE, write ? {} : { readOnly: true });
function scrub() {
  if (!hasDb) return;
  const raw = open(true);
  raw.exec("PRAGMA busy_timeout = 3000");
  try { raw.prepare("DELETE FROM wvZone WHERE idwell = ?").run(TEST_IDWELL); }
  finally { raw.close(); }
}

beforeAll(async () => {
  scrub();
  app = Fastify();
  await registerWellviewDbRoutes(app);
  await app.ready();
  const { token } = issueToken({ id: "test", username: "vitest", role: "admin" });
  auth = { Authorization: `Bearer ${token}` };
  if (!hasDb) return;
  const raw = open();
  well = (raw.prepare("SELECT idwell FROM wvZone LIMIT 1").get() as { idwell: string }).idwell;
  raw.close();
});
afterAll(async () => { await app?.close(); scrub(); });

const picker = async (table: string, source?: string) => {
  const q = new URLSearchParams({ table, idwell: well, ...(source ? { source } : {}) });
  const res = await app.inject({ url: `/entry/wellview/dbs/${DB}/link-candidates?${q}`, headers: auth });
  expect(res.statusCode, res.body).toBe(200);
  return res.json() as { canCreate?: boolean; label?: string; candidates: unknown[] };
};

d("what a link picker may create", () => {
  it("offers a new record for a folder that needs only the well", async () => {
    // A zone belongs to the well and to nothing else, so the picker has
    // everything it needs to make one.
    const p = await picker("wvZone", "wvPerforation");
    expect(p.canCreate).toBe(true);
    expect(p.label).toBeTruthy();
  });

  it("offers one for a wellbore, whose parent column is a self-reference", async () => {
    /*
     * wvWellbore HAS an IDRecParent and it names the parent BORE of a sidetrack
     * (§10.4), not a folder it hangs under — so a wellbore needs nothing but
     * the well. 17 of the 44 in this database carry a null parent, which is
     * exactly what a new one looks like. Gating on the column's presence
     * refused <new> on the commonest link in the schema, which the browser
     * showed before this test existed.
     */
    const p = await picker("wvWellbore", "wvPerforation");
    expect(p.canCreate).toBe(true);
  });

  it("refuses one for a folder that hangs off a parent record", async () => {
    /*
     * The picker knows the well and the column, not WHICH casing string or
     * which job the new row would sit under. A row written with a null parent
     * is one nothing can reach — the app already has nine such rows from the
     * vendor's own export and they took a special case to make visible.
     */
    const p = await picker("wvCasComp", "wvCasCompTally");
    expect(p.canCreate).toBe(false);
  });

  it("creates a record the picker can then offer", async () => {
    scrub();
    const before = await picker("wvZone");
    const res = await app.inject({
      method: "POST", url: `/entry/wellview/dbs/${DB}/records/wvZone`,
      headers: auth, payload: { idwell: TEST_IDWELL, values: {} },
    });
    expect(res.statusCode, res.body).toBe(200);
    const { idrec } = res.json() as { idrec: string };
    expect(idrec).toBeTruthy();

    // It is a real row, on the well it was made for, and empty — which is what
    // <new> promises and no more.
    const raw = open();
    const row = raw.prepare("SELECT * FROM wvZone WHERE IDRec = ?").get(idrec) as Record<string, unknown>;
    raw.close();
    expect(row.idwell).toBe(TEST_IDWELL);

    // …and the picker for THAT well now offers it, so the link can be made.
    const q = new URLSearchParams({ table: "wvZone", idwell: TEST_IDWELL });
    const after = await app.inject({
      url: `/entry/wellview/dbs/${DB}/link-candidates?${q}`, headers: auth,
    });
    const list = (after.json() as { candidates: { idrec: string }[] }).candidates;
    expect(list.some((c) => c.idrec === idrec)).toBe(true);
    // The other well's picker is untouched.
    expect((await picker("wvZone")).candidates.length).toBe(before.candidates.length);
    scrub();
  });

  it("leaves the sample database exactly as it found it", () => {
    scrub();
    const raw = open();
    const n = (raw.prepare("SELECT COUNT(*) c FROM wvZone WHERE idwell = ?")
      .get(TEST_IDWELL) as { c: number }).c;
    raw.close();
    expect(n).toBe(0);
  });
});
