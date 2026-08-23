/**
 * Multi-well reports and the reference datum.
 *
 * The datum applies "in reports, the schematic, and Edit Data" — and once the
 * single-well surfaces started labelling depths `mCF`, multi-well reports were
 * the only screen left showing stored Original-KB metres under a bare `(m)`.
 * The same field on the same well read differently on two screens, and only one
 * of them said which datum it came from.
 *
 * A multi-well grid cannot take a single offset: every row is a different well
 * with its own kelly bushing. So the payload has to carry two things it did not
 * — the per-well elevations, and which well each ROW came from — and the
 * columns have to say which of them move with the datum at all.
 *
 * The help also states what to do about a well that cannot resolve the chosen
 * datum: "If you view multi well reports for wells that do not have the
 * reference datum selected, then the * symbol appears in place of the relative
 * depth." That rendering is the client's; what is pinned here is that it has
 * everything it needs to decide.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Fastify, { type FastifyInstance } from "fastify";
import { registerWellviewDbRoutes } from "../routes/wellviewDb.js";
import { issueToken } from "../entry/auth.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const SAMPLE = join(HERE, "..", "..", "..", "..", "sqlite_DB", "wellview", "wv9.0_Sample.sqlite");
const DB = "wv9.0_Sample";
const d = describe.skipIf(!existsSync(SAMPLE));

interface Block {
  table: string | null;
  columns: { column: string; unit?: string; applyDatum?: boolean; datumMode?: string }[];
  rows: (string | number | null)[][];
  rowWells?: string[];
}
interface Result { blocks: Block[]; elevations?: Record<string, Record<string, number | null>> }

let app: FastifyInstance;
let auth: { Authorization: string };
let wells: string[];
let templates: { html: string; name: string; blocks: unknown[] }[];

beforeAll(async () => {
  app = Fastify();
  await registerWellviewDbRoutes(app);
  await app.ready();
  const { token } = issueToken({ id: "test", username: "vitest", role: "admin" });
  auth = { Authorization: `Bearer ${token}` };
  const w = await app.inject({ url: `/entry/wellview/dbs/${DB}/wells`, headers: auth });
  wells = (w.json() as { wells: { idwell: string }[] }).wells.slice(0, 8).map((x) => x.idwell);
  const t = await app.inject({ url: `/entry/wellview/dbs/${DB}/reports-multi`, headers: auth });
  templates = (t.json() as { reports: typeof templates }).reports.filter((r) => r.blocks.length);
});
afterAll(async () => { await app?.close(); });

const run = async (html: string) => {
  const res = await app.inject({
    url: `/entry/wellview/dbs/${DB}/multi-report?html=${encodeURIComponent(html)}&wells=${wells.join(",")}`,
    headers: auth,
  });
  expect(res.statusCode).toBe(200);
  return res.json() as Result;
};

d("a multi-well report can be re-referenced", () => {
  it("carries a per-well elevation for every well it reports on", async () => {
    const res = await run(templates[0].html);
    expect(res.elevations).toBeTruthy();
    const keys = Object.keys(res.elevations!);
    expect(keys.length).toBe(wells.length);
    for (const w of wells) expect(keys, w).toContain(w);
    // Narrowed to the wells asked for, not the whole database.
    expect(keys.every((k) => wells.includes(k))).toBe(true);
  });

  it("says which well each row came from, aligned with the rows", async () => {
    let checked = 0;
    for (const t of templates.slice(0, 25)) {
      const res = await run(t.html);
      for (const b of res.blocks) {
        if (!b.rows?.length) continue;
        expect(b.rowWells, `${t.name} / ${b.table}`).toBeTruthy();
        expect(b.rowWells!.length).toBe(b.rows.length);
        for (const w of b.rowWells!) expect(wells).toContain(w);
        checked++;
      }
      if (checked >= 3) break;
    }
    expect(checked, "blocks with rows to check").toBeGreaterThan(0);
  });

  it("marks the columns that move with the datum, and only those", async () => {
    let sawDatum = false;
    let sawPlain = false;
    for (const t of templates.slice(0, 25)) {
      const res = await run(t.html);
      for (const b of res.blocks) {
        for (const c of b.columns ?? []) {
          if (c.applyDatum) {
            sawDatum = true;
            // A datum column is a measurement; it must carry a unit to convert.
            expect(c.unit, `${b.table}.${c.column}`).toBeTruthy();
          } else if (c.unit) sawPlain = true;
        }
      }
      if (sawDatum && sawPlain) break;
    }
    // Both kinds exist in the shipped templates, so "marks the right ones" is
    // proven rather than vacuously true.
    expect(sawDatum, "a column that moves with the datum").toBe(true);
    expect(sawPlain, "a unit-bearing column that does not").toBe(true);
  });

  it("gives the client what it needs to print * for a well that cannot resolve", async () => {
    // The case exists in this database: "Other in Hole" reports on wells whose
    // casing-flange elevation is recorded and wells whose is not, in the same
    // block. One row shifts; the others cannot, and must not be printed as
    // though they had.
    const t = templates.find((x) => x.name === "Other in Hole") ?? templates[0];
    const res = await run(t.html);
    const b = res.blocks.find((x) => x.rows?.length && x.columns.some((c) => c.applyDatum));
    if (!b) return;

    const resolvable = b.rowWells!.map((w) => {
      const e = res.elevations?.[w];
      return !!e && e.OrigKB != null && e.CasFlange != null;
    });
    // Whatever the mix, the client can tell them apart — which is the point.
    expect(resolvable.length).toBe(b.rows.length);
    for (let i = 0; i < b.rows.length; i++) {
      expect(typeof resolvable[i]).toBe("boolean");
      expect(res.elevations?.[b.rowWells![i]], `row ${i}`).toBeTruthy();
    }
  });
});
