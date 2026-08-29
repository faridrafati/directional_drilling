/**
 * Ctrl+F2 — "Looking up Database Entries".
 *
 * The guide: "To view all entries that have been previously entered into a
 * field, press Ctrl + F2. The database lookup list is not well specific; it
 * contains all of the entries in the database for a specific field."
 *
 * That is a different thing from the approved library. The library is what a
 * value is ALLOWED to be; this is what people have actually typed, offered so
 * the next person types the same. 603 free-text fields in the model had no
 * lookup of any kind, and the route that serves them already existed and
 * already ignored idwell — which is exactly the "not well specific" the guide
 * describes. Only the client gate was shut.
 *
 * The two things this pins are the ones a lookup can get wrong: the SCOPE
 * (whole database, not the open well) and the CAP (a list that stops at 500
 * and says nothing reads as complete).
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
const d = describe.skipIf(!existsSync(SAMPLE));

let app: FastifyInstance;
let auth: { Authorization: string };
let db: DatabaseSync;

beforeAll(async () => {
  app = Fastify();
  await registerWellviewDbRoutes(app);
  await app.ready();
  const { token } = issueToken({ id: "t", username: "vitest", role: "admin" });
  auth = { Authorization: `Bearer ${token}` };
  db = new DatabaseSync(SAMPLE, { readOnly: true });
});
afterAll(async () => { await app?.close(); db?.close(); });

const values = async (table: string, column: string) => {
  const res = await app.inject({
    url: `/entry/wellview/dbs/${DB}/column-values?table=${table}&column=${column}`, headers: auth,
  });
  expect(res.statusCode).toBe(200);
  return res.json() as { values: string[]; truncated?: boolean };
};

d("the database lookup list", () => {
  it("is not well specific, which is the whole point of it", async () => {
    // The guide's own example is a value typed on well A appearing when you
    // are entering well C. So the list must exceed what any single well holds.
    const r = await values("wvJobDrillString", "BitNo");
    const distinctAll = (db.prepare(
      "SELECT COUNT(DISTINCT BitNo) c FROM wvJobDrillString WHERE BitNo IS NOT NULL AND BitNo <> ''")
      .get() as { c: number }).c;
    expect(r.values.length).toBe(distinctAll);

    const busiestWell = (db.prepare(`SELECT COUNT(DISTINCT BitNo) c FROM wvJobDrillString
      WHERE BitNo IS NOT NULL AND BitNo <> '' GROUP BY idwell ORDER BY c DESC LIMIT 1`)
      .get() as { c: number }).c;
    expect(r.values.length).toBeGreaterThan(busiestWell);
  });

  it("says when it stopped short instead of implying completeness", async () => {
    // Find a column with more than 500 distinct values if the sample has one;
    // either way the flag must be present and honest.
    const wide = db.prepare(`SELECT COUNT(DISTINCT Com) c FROM wvJobReportTimeLog
      WHERE Com IS NOT NULL AND Com <> ''`).get() as { c: number };
    const r = await values("wvJobReportTimeLog", "Com");
    if (wide.c > 500) {
      expect(r.truncated).toBe(true);
      expect(r.values.length).toBe(500);
    } else {
      expect(r.truncated).toBe(false);
      expect(r.values.length).toBe(wide.c);
    }
  });

  it("returns values, not nulls or blanks", async () => {
    const r = await values("wvCasComp", "Des");
    expect(r.values.length).toBeGreaterThan(0);
    for (const v of r.values) {
      expect(typeof v).toBe("string");
      expect(v.trim()).not.toBe("");
    }
    // Sorted, so the filter box in the popover has something predictable.
    expect([...r.values].sort()).toEqual(r.values);
  });

  it("refuses a column that does not exist rather than returning nothing", async () => {
    const res = await app.inject({
      url: `/entry/wellview/dbs/${DB}/column-values?table=wvCasComp&column=NotAColumn`, headers: auth,
    });
    expect(res.statusCode).toBe(404);
  });

  it("has 603 free-text fields to serve, which had no lookup at all", () => {
    // The measurement behind the item: string fields with no library, no
    // approved model list, and no link — the ones Ctrl+F2 exists for.
    const model = JSON.parse(
      require("node:fs").readFileSync(
        join(HERE, "..", "..", "..", "..", "apps", "web", "public",
          "wellview-templates", "datamodel.json"), "utf8"),
    ) as { tables: Record<string, { fields: Record<string, {
      type?: string; calculated?: boolean; lookupTyp?: string; modelList?: unknown }> }> };
    let free = 0;
    for (const [, t] of Object.entries(model.tables)) {
      for (const [fk, f] of Object.entries(t.fields)) {
        if (f.calculated) continue;
        if (f.type !== "string" && f.type !== "stringlong") continue;
        if (f.lookupTyp === "library" || f.lookupTyp === "foreignidrec") continue;
        if (f.modelList) continue;
        if (/^idrec/i.test(fk) || /tk$/i.test(fk)) continue;
        free++;
      }
    }
    // Not pinned to the exact number — the point is that it is in the hundreds
    // and every one of them was previously unreachable.
    expect(free).toBeGreaterThan(500);
  });
});
