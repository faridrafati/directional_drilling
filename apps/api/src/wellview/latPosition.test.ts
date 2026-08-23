/**
 * Which side of the hole a string was run on.
 *
 * A dual completion is two strings side by side. The schematic payload never
 * carried `LatPosition`, so both were drawn on the same centreline, one over the
 * other — Sample 07's long string to 3,209.9 m and short string to 3,093.7 m,
 * run the same day and neither pulled, read as a single string.
 *
 * 16 tubing strings in 6 wells carry Left or Right, and every one of them is
 * still in the hole. The guide's Tubing Strings topic is what names the field.
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

interface Row { Des?: string | null; LatPosition?: string | null; DepthBtm?: number | null }
interface Schematic { tubings: Row[]; casings: Row[] }

let app: FastifyInstance;
let auth: { Authorization: string };
let wells: { idwell: string; WellName: string }[];

beforeAll(async () => {
  app = Fastify();
  await registerWellviewDbRoutes(app);
  await app.ready();
  const { token } = issueToken({ id: "test", username: "vitest", role: "admin" });
  auth = { Authorization: `Bearer ${token}` };
  const w = await app.inject({ url: `/entry/wellview/dbs/${DB}/wells`, headers: auth });
  wells = (w.json() as { wells: typeof wells }).wells;
});
afterAll(async () => { await app?.close(); });

const schematic = async (idwell: string) => {
  const res = await app.inject({ url: `/entry/wellview/dbs/${DB}/schematic?idwell=${idwell}`, headers: auth });
  expect(res.statusCode).toBe(200);
  return res.json() as Schematic;
};

/** The same fold the renderer uses: anything not left/right is centre. */
const side = (r: Row) => {
  const v = String(r.LatPosition ?? "").trim().toLowerCase();
  return v === "left" ? "left" : v === "right" ? "right" : "centre";
};

d("a tubing string says which side it was run on", () => {
  it("carries LatPosition for every off-centre string in the sample", async () => {
    const counts = { left: 0, right: 0, centre: 0 };
    for (const w of wells) {
      for (const t of (await schematic(w.idwell)).tubings ?? []) counts[side(t)]++;
    }
    // 8 left + 8 right across 6 wells; everything else is centre or absent.
    expect(counts.left).toBe(8);
    expect(counts.right).toBe(8);
    expect(counts.left + counts.right).toBe(16);
    expect(counts.centre).toBeGreaterThan(30);
  }, 120_000);

  it("matches the database, including the rows stored in lower case", async () => {
    // "Right" appears 6 times and "right" twice; "Left" 6 and "left" twice. A
    // case-sensitive comparison would silently centre four of the sixteen.
    const raw = new DatabaseSync(SAMPLE, { readOnly: true });
    const mixed = raw.prepare(`
      SELECT LatPosition v, COUNT(*) n FROM wvTub
       WHERE LatPosition IS NOT NULL AND lower(LatPosition) IN ('left','right')
       GROUP BY v`).all() as { v: string; n: number }[];
    raw.close();
    // Both spellings really are present, so the fold is proven, not assumed.
    expect(mixed.some((r) => r.v === "right")).toBe(true);
    expect(mixed.some((r) => r.v === "Right")).toBe(true);
    expect(mixed.reduce((n, r) => n + r.n, 0)).toBe(16);
  });

  it("finds Sample 07's pair, the one that read as a single string", async () => {
    const w = wells.find((x) => x.WellName.startsWith("Sample 07"))!;
    const tub = (await schematic(w.idwell)).tubings ?? [];
    const long = tub.find((t) => /Long string/i.test(String(t.Des ?? "")))!;
    const short = tub.find((t) => /Short String/i.test(String(t.Des ?? "")))!;
    expect(side(long)).toBe("right");
    expect(side(short)).toBe("left");
    expect(long.DepthBtm!).toBeCloseTo(3209.85, 1);
    expect(short.DepthBtm!).toBeCloseTo(3093.72, 1);
  });

  it("does not ask for it where nothing records it", async () => {
    // wvCas carries the column but every value in this database is "Center",
    // and wvOtherInHole's is empty — so casing is left alone rather than given
    // a field that could only ever say centre.
    for (const w of wells.slice(0, 8)) {
      for (const c of (await schematic(w.idwell)).casings ?? []) {
        expect(c.LatPosition, String(c.Des)).toBeUndefined();
      }
    }
  }, 120_000);
});
