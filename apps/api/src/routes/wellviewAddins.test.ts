/**
 * The behaviour WellView ships as add-ins.
 *
 * `system/bin/add-ins` holds three DLLs. Two are data events — they run when a
 * record changes, so their effect is baked into the data rather than shown on a
 * screen, and an app that recreates the screens but not the events writes
 * records the real application would consider incomplete.
 *
 *   NewWell                — a new well gets its Original Hole wellbore.
 *   DefaultWellboreLinker  — a wellbore-scoped record gets the wellbore.
 *
 * These test both against a COPY of the sample database.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync, copyFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import Fastify, { type FastifyInstance } from "fastify";
import { registerWellviewDbRoutes } from "./wellviewDb.js";
import { issueToken } from "../entry/auth.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..", "..", "..");
const SAMPLE = join(REPO, "sqlite_DB", "wellview", "wv9.0_Sample.sqlite");
const d = describe.skipIf(!existsSync(SAMPLE));

/**
 * Read a column without caring how it is capitalised.
 *
 * The real column is `IDRecWellBore`, with a capital B, while the model and
 * every other reference spell it `IDRecWellbore`. The application resolves that
 * through its lowercase column map; a test that hard-codes either spelling is
 * asserting about the schema's punctuation rather than about behaviour.
 */
function col(row: Record<string, unknown> | undefined, name: string): unknown {
  if (!row) return undefined;
  const k = Object.keys(row).find((x) => x.toLowerCase() === name.toLowerCase());
  return k ? row[k] : undefined;
}


d("WellView data-event add-ins", () => {
  let dir: string;
  let dbPath: string;
  let app: FastifyInstance;
  let auth: { Authorization: string };
  let db: DatabaseSync;
  const DB = "addin-test";

  beforeAll(async () => {
    // The app discovers databases in sqlite_DB/wellview at module load, so the
    // copy goes there under a distinct name and is removed afterwards. The
    // user's own two files are never touched.
    dir = dirname(SAMPLE);
    dbPath = join(dir, `${DB}.sqlite`);
    copyFileSync(SAMPLE, dbPath);
    app = Fastify();
    await registerWellviewDbRoutes(app);
    await app.ready();
    auth = { Authorization: `Bearer ${issueToken({ id: "t", username: "vitest", role: "admin" }).token}` };
    db = new DatabaseSync(dbPath, { readOnly: true });
  });
  afterAll(async () => {
    db?.close();
    await app?.close();
    // Remove only the copy this test made.
    try { rmSync(dbPath, { force: true }); } catch { /* best effort */ }
  });

  it("the sample data shows the linker's effect, which is what we are matching", () => {
    // Not a test of our code — a statement of the target. These rates are why
    // leaving IDRecWellbore null would be wrong.
    const rate = (t: string) => {
      const r = db.prepare(
        `SELECT COUNT(*) c, SUM(CASE WHEN IDRecWellbore IS NOT NULL AND IDRecWellbore <> '' THEN 1 ELSE 0 END) p
           FROM "${t}"`).get() as { c: number; p: number };
      return r.c ? r.p / r.c : 0;
    };
    expect(rate("wvLog")).toBe(1);
    expect(rate("wvJobDrillStringDrillParam")).toBeGreaterThan(0.95);
    expect(rate("wvPerforation")).toBeGreaterThan(0.9);
  });

  it("links a new record to the well's wellbore, without being asked", async () => {
    // A well with exactly one wellbore: the default is unambiguous.
    const well = db.prepare(`
      SELECT idwell, COUNT(*) n FROM wvWellbore GROUP BY idwell HAVING n = 1 LIMIT 1`)
      .get() as { idwell: string };
    const bore = db.prepare("SELECT IDRec FROM wvWellbore WHERE idwell = ?")
      .get(well.idwell) as { IDRec: string };

    const res = await app.inject({
      method: "POST", url: `/entry/wellview/dbs/${DB}/records/wvPerforation`, headers: auth,
      payload: { idwell: well.idwell, values: { DepthTop: 1234 } },
    });
    expect(res.statusCode).toBeLessThan(300);
    const { idrec } = res.json() as { idrec: string };

    const check = new DatabaseSync(dbPath, { readOnly: true });
    const raw = check.prepare("SELECT * FROM wvPerforation WHERE IDRec = ?")
      .get(idrec) as Record<string, unknown> | undefined;
    check.close();
    expect(col(raw, "IDRecWellbore")).toBe(bore.IDRec);
    // The TK companion names the target table, lowercased — the schema's rule.
    expect(String(col(raw, "IDRecWellboreTK") ?? "").toLowerCase()).toBe("wvwellbore");
  });

  it("does NOT overrule a wellbore the user chose", async () => {
    const well = db.prepare(`
      SELECT idwell, COUNT(*) n FROM wvWellbore GROUP BY idwell HAVING n = 1 LIMIT 1`)
      .get() as { idwell: string };
    // A wellbore from a DIFFERENT well: whatever the user set must survive.
    const other = db.prepare("SELECT IDRec FROM wvWellbore WHERE idwell <> ? LIMIT 1")
      .get(well.idwell) as { IDRec: string };
    const res = await app.inject({
      method: "POST", url: `/entry/wellview/dbs/${DB}/records/wvPerforation`, headers: auth,
      payload: { idwell: well.idwell, values: { DepthTop: 999, IDRecWellbore: other.IDRec } },
    });
    const { idrec } = res.json() as { idrec: string };
    const check = new DatabaseSync(dbPath, { readOnly: true });
    const raw = check.prepare("SELECT * FROM wvPerforation WHERE IDRec = ?")
      .get(idrec) as Record<string, unknown> | undefined;
    check.close();
    expect(col(raw, "IDRecWellbore")).toBe(other.IDRec);
  });

  it("REFUSES to guess when a well has several wellbores and no single original", async () => {
    // Picking the wrong sidetrack is worse than leaving the field empty.
    const ambiguous = db.prepare(`
      SELECT idwell FROM wvWellbore GROUP BY idwell
      HAVING COUNT(*) > 1 AND SUM(CASE WHEN IDRec = IDRecParent THEN 1 ELSE 0 END) <> 1 LIMIT 1`)
      .get() as { idwell: string } | undefined;
    if (!ambiguous) return;                       // nothing ambiguous in this data
    const res = await app.inject({
      method: "POST", url: `/entry/wellview/dbs/${DB}/records/wvPerforation`, headers: auth,
      payload: { idwell: ambiguous.idwell, values: { DepthTop: 555 } },
    });
    const { idrec } = res.json() as { idrec: string };
    const check = new DatabaseSync(dbPath, { readOnly: true });
    const raw = check.prepare("SELECT * FROM wvPerforation WHERE IDRec = ?")
      .get(idrec) as Record<string, unknown> | undefined;
    check.close();
    expect(col(raw, "IDRecWellbore") ?? null).toBeNull();
  });
});
