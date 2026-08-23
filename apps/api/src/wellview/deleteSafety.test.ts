/**
 * Deleting a record: what it costs, and when it must be refused.
 *
 * The help asks for two things this had neither of.
 *
 *   "A warning message lists the subfolders that are affected."
 * The app showed a fixed sentence naming nothing, and reported the count after
 * the rows were already gone. A casing string carries 222 tally rows and there
 * is no undo, so the order matters.
 *
 *   "You cannot delete a record that has fields associated to it. For example,
 *    if you associate a zone to a perforation and then you try to delete the
 *    zone, a message warns you. You must first remove the associations before
 *    you delete the record."
 * The delete path did no reference check at all. 34 wvPerforation rows join a
 * live wvZone on IDRecZone; deleting that zone left 34 GUIDs pointing at
 * nothing, which this app can no longer caption and the desktop cannot follow.
 *
 * The example in the help is the exact case tested below.
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
const TEST_IDWELL = "TEST000000000000000000000DELSAFE";

const hasDb = existsSync(SAMPLE);
const d = describe.skipIf(!hasDb);

interface Preflight {
  records: number;
  children: { table: string; label: string; count: number }[];
  referencedBy: { table: string; label: string; column: string; count: number }[];
  canDelete: boolean;
}

let app: FastifyInstance;
let auth: { Authorization: string };
/** A zone a perforation points at — the help's own example. */
let linkedZone: string;

function scrub() {
  if (!hasDb) return;
  const raw = new DatabaseSync(SAMPLE);
  raw.exec("PRAGMA busy_timeout = 3000");
  try {
    for (const t of ["wvZoneStatus", "wvZone"]) {
      try { raw.exec(`DELETE FROM "${t}" WHERE idwell = '${TEST_IDWELL}'`); } catch { /* no such table */ }
    }
  } finally { raw.close(); }
}

beforeAll(async () => {
  scrub();
  app = Fastify();
  await registerWellviewDbRoutes(app);
  await app.ready();
  const { token } = issueToken({ id: "test", username: "vitest", role: "admin" });
  auth = { Authorization: `Bearer ${token}` };
  const raw = new DatabaseSync(SAMPLE, { readOnly: true });
  linkedZone = (raw.prepare(
    "SELECT z.IDRec AS id FROM wvZone z JOIN wvPerforation p ON p.IDRecZone = z.IDRec LIMIT 1",
  ).get() as { id: string }).id;
  raw.close();
});
afterAll(async () => { scrub(); await app?.close(); });

const preflight = async (table: string, idrec: string) => {
  const res = await app.inject({
    url: `/entry/wellview/dbs/${DB}/records/${table}/${idrec}/delete-preflight`, headers: auth,
  });
  expect(res.statusCode).toBe(200);
  return res.json() as Preflight;
};

d("before a delete happens", () => {
  it("names the subfolders it would take with it", async () => {
    const pre = await preflight("wvZone", linkedZone);
    // Named by folder, as the help asks — not a bare number, and not after.
    for (const c of pre.children) {
      expect(c.label).toBeTruthy();
      expect(c.label).not.toMatch(/^</);
      expect(c.count).toBeGreaterThan(0);
    }
    // The total counts the record itself plus everything under it.
    expect(pre.records).toBe(1 + pre.children.reduce((n, c) => n + c.count, 0));
  });

  it("refuses a record something still points at, and says what", async () => {
    const pre = await preflight("wvZone", linkedZone);
    expect(pre.canDelete).toBe(false);
    const perf = pre.referencedBy.find((r) => r.table.toLowerCase() === "wvperforation");
    expect(perf, "the help's own example").toBeTruthy();
    expect(perf!.count).toBeGreaterThan(0);
    // Named usefully: the model's caption for a link field is often the literal
    // "<capl>", which renders as "Record" and identifies nothing.
    expect(perf!.column).toBe("Zone");
    expect(perf!.label).toBeTruthy();
  });

  it("and the delete itself refuses too, not only the preflight", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/entry/wellview/dbs/${DB}/records/wvZone/${linkedZone}`,
      headers: auth,
    });
    expect(res.statusCode).toBe(409);
    expect((res.json() as { error: string }).error).toMatch(/referenced/i);

    // …and the zone is still there. A refusal that half-deleted would be worse
    // than no check at all.
    const raw = new DatabaseSync(SAMPLE, { readOnly: true });
    const still = raw.prepare("SELECT COUNT(*) n FROM wvZone WHERE IDRec = ?").get(linkedZone) as { n: number };
    raw.close();
    expect(still.n).toBe(1);
  });

  it("allows a record nothing points at, and still counts its subtree", async () => {
    // A zone of our own, with a status row under it and nothing linking to it.
    const zone = await app.inject({
      method: "POST",
      url: `/entry/wellview/dbs/${DB}/records/wvZone`,
      headers: auth,
      payload: { idwell: TEST_IDWELL, values: { ZoneName: "delete-safety test" } },
    });
    expect(zone.statusCode).toBe(200);
    const zoneId = (zone.json() as { idrec: string }).idrec;

    const status = await app.inject({
      method: "POST",
      url: `/entry/wellview/dbs/${DB}/records/wvZoneStatus`,
      headers: auth,
      payload: { idwell: TEST_IDWELL, parent: zoneId, values: { Status: "Open" } },
    });
    expect(status.statusCode).toBe(200);

    const pre = await preflight("wvZone", zoneId);
    expect(pre.canDelete).toBe(true);
    expect(pre.referencedBy).toEqual([]);
    expect(pre.records).toBe(2);
    expect(pre.children.map((c) => c.table.toLowerCase())).toContain("wvzonestatus");

    const del = await app.inject({
      method: "DELETE",
      url: `/entry/wellview/dbs/${DB}/records/wvZone/${zoneId}`,
      headers: auth,
    });
    expect(del.statusCode).toBe(200);
    expect((del.json() as { removed: number }).removed).toBe(2);

    const raw = new DatabaseSync(SAMPLE, { readOnly: true });
    const left = raw.prepare("SELECT COUNT(*) n FROM wvZone WHERE idwell = ?").get(TEST_IDWELL) as { n: number };
    raw.close();
    expect(left.n).toBe(0);
  });
});
