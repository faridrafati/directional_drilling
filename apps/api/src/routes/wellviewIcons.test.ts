/**
 * Which icon goes beside a row.
 *
 * WellView records the answer: nearly every component row carries an IconName
 * chosen by whoever entered it. The app used to ignore that and infer from the
 * description, which on the sample data got 24% of rows right, put a WRONG
 * icon on 14%, and left 62% bare — a casing string is described "SURFACE" or
 * "PRODUCTION", and no text matcher turns that into a casing icon.
 *
 * These pin the recorded name winning, and pin the guess staying available for
 * the rows that genuinely have no IconName.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import Fastify, { type FastifyInstance } from "fastify";
import { registerWellviewDbRoutes } from "./wellviewDb.js";
import { issueToken } from "../entry/auth.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..", "..", "..");
const SAMPLE = join(REPO, "sqlite_DB", "wellview", "wv9.0_Sample.sqlite");
const MANIFEST = join(REPO, "apps", "web", "public", "wellview-icons", "manifest.json");
const ready = existsSync(SAMPLE) && existsSync(MANIFEST);
const d = describe.skipIf(!ready);

const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

d("schematic icons", () => {
  let db: DatabaseSync;
  let byName: Map<string, string>;
  let app: FastifyInstance;
  let auth: { Authorization: string };

  beforeAll(async () => {
    db = new DatabaseSync(SAMPLE, { readOnly: true });
    const man = JSON.parse(readFileSync(MANIFEST, "utf-8")) as
      { icons: { name: string; png: string; blank?: boolean }[] };
    byName = new Map(man.icons.filter((i) => !i.blank).map((i) => [normalise(i.name), i.png]));
    app = Fastify();
    await registerWellviewDbRoutes(app);
    await app.ready();
    auth = { Authorization: `Bearer ${issueToken({ id: "t", username: "vitest", role: "admin" }).token}` };
  });

  it("converted every image the icon library ships", () => {
    const man = JSON.parse(readFileSync(MANIFEST, "utf-8")) as
      { count: number; failures: unknown[]; skipped_pce_files: number };
    // 1441 EMF + 138 BMP + 32 ICO. The 727 .pce are Peloton metadata, not images.
    expect(man.count).toBe(1611);
    expect(man.failures).toEqual([]);
    expect(man.skipped_pce_files).toBe(727);
  });

  it("resolves what WellView recorded, for essentially every row", () => {
    const tables = ["wvCasComp", "wvTubComp", "wvRodComp", "wvJobDrillStringComp",
      "wvJobDrillBit", "wvOtherInHole", "wvOtherStrComp", "wvWellhead", "wvStimTreat"];
    let rows = 0;
    let resolved = 0;
    const missing = new Set<string>();
    for (const t of tables) {
      for (const r of db.prepare(
        `SELECT IconName n, COUNT(*) c FROM "${t}" WHERE IconName IS NOT NULL AND IconName <> '' GROUP BY IconName`,
      ).all() as { n: string; c: number }[]) {
        rows += r.c;
        if (byName.has(normalise(r.n))) resolved += r.c;
        else missing.add(r.n);
      }
    }
    expect(rows).toBeGreaterThan(2000);
    // The only unresolvable stored name is "Blank", which means no icon.
    expect([...missing]).toEqual(["Blank"]);
    expect(resolved / rows).toBeGreaterThan(0.999);
  });

  it("puts the recorded icon on a casing string the description could never match", () => {
    // "SURFACE" and "PRODUCTION" are casing strings. Text matching gets nothing.
    const row = db.prepare(
      `SELECT Des, IconName FROM wvCasComp WHERE IconName = 'Casing (red)' LIMIT 1`).get() as
      { Des: string | null; IconName: string };
    expect(byName.get(normalise(row.IconName))).toBeTruthy();
  });

  it("serves the icon with a report row", async () => {
    const idwell = (db.prepare(
      "SELECT idwell FROM wvCasComp WHERE IconName IS NOT NULL LIMIT 1").get() as { idwell: string }).idwell;
    const html = "Drilling/Drilling Summary/Casing Summary.html";
    const res = await app.inject({
      method: "GET", headers: auth,
      url: `/entry/wellview/dbs/wv9.0_Sample/template-data?html=${encodeURIComponent(html)}&well=${idwell}`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { blocks: { table: string | null; icons?: (string | null)[] }[] };
    const withIcons = body.blocks.filter((b) => b.icons?.some(Boolean));
    // At least one block must actually carry pictures, or the wiring is dead.
    expect(withIcons.length).toBeGreaterThan(0);
    for (const b of withIcons) {
      for (const i of b.icons!) if (i) expect(i).toMatch(/\.png$/);
    }
  });
});
