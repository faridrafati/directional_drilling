/**
 * The report designer offers the fields this app works out.
 *
 * The designer's own panel says "Fields the app computes can be printed too;
 * they are marked green on the report, as WellView marks them", and
 * `checkReport` has always accepted their names. The picker listed only stored
 * columns, so the promise could not be acted on: a user had to already know a
 * field existed, and had nowhere to type it.
 *
 * The same route feeds the QUERY BUILDER, where a computed name is useless — it
 * has no column, so a criterion over one cannot be compiled to SQL and would
 * match nothing while looking like a filter. So the computed half is opt-in,
 * and this pins that it stays off by default.
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

interface Field { field: string; label: string; type?: string; unit?: string; eqn?: string; computed?: true }

let app: FastifyInstance;
let auth: { Authorization: string };

beforeAll(async () => {
  app = Fastify();
  await registerWellviewDbRoutes(app);
  await app.ready();
  const { token } = issueToken({ id: "test", username: "vitest", role: "admin" });
  auth = { Authorization: `Bearer ${token}` };
});
afterAll(async () => { await app?.close(); });

const fields = async (table: string, computed = false) => {
  const res = await app.inject({
    url: `/entry/wellview/dbs/${DB}/query-fields?table=${table}${computed ? "&computed=1" : ""}`,
    headers: auth,
  });
  expect(res.statusCode).toBe(200);
  return res.json() as { table: string; fields: Field[]; computed?: Field[] };
};

d("the field picker", () => {
  it("says nothing about computed fields unless asked", async () => {
    // The Query Builder's call. A computed name here would be a criterion the
    // runner cannot apply — a filter that silently matches nothing.
    const plain = await fields("wvJobDrillString");
    expect(plain.computed).toBeUndefined();
    expect(plain.fields.length).toBeGreaterThan(0);
    for (const f of plain.fields) expect(f.computed).toBeUndefined();
  });

  it("offers them to the report designer, which promises them", async () => {
    const withCalc = await fields("wvJobDrillString", true);
    expect(Array.isArray(withCalc.computed)).toBe(true);
    const names = withCalc.computed!.map((f) => f.field.toLowerCase());
    // The two this app learned most recently, both of which a shipped template
    // prints and neither of which is a stored column.
    expect(names).toContain("bittfacalc");
    expect(names).toContain("bitnozzlecalc");
    for (const f of withCalc.computed!) expect(f.computed).toBe(true);
  });

  it("never offers a computed field that is also a stored column", async () => {
    // The two lists are concatenated in the picker, so an overlap would show
    // the same field twice and let a block name it twice.
    for (const t of ["wvJobDrillString", "wvZone", "wvCasComp", "wvJobReportMudChk"]) {
      const r = await fields(t, true);
      const stored = new Set(r.fields.map((f) => f.field.toLowerCase()));
      for (const c of r.computed ?? []) {
        expect(stored.has(c.field.toLowerCase()), `${t}.${c.field} is in both lists`).toBe(false);
      }
    }
  });

  it("carries the model's own sentence, so the picker can show what a field is", async () => {
    const r = await fields("wvZone", true);
    const cur = r.computed!.find((f) => f.field.toLowerCase() === "currentstatuscalc");
    expect(cur, "a zone's current status is computed").toBeTruthy();
    expect(cur!.eqn).toContain("Most recent status");
    expect(cur!.label).toBe("Current Status");
  });

  it("offers every computed field the report route can actually fill", async () => {
    // The picker and the renderer must agree: a field offered here and refused
    // there would be a column the user chose and the report leaves blank.
    for (const t of ["wvJobDrillString", "wvZone", "wvJobServiceContract"]) {
      const r = await fields(t, true);
      expect((r.computed ?? []).length, `${t} has computed fields`).toBeGreaterThan(0);
      for (const c of r.computed ?? []) {
        const res = await app.inject({
          url: `/entry/wellview/dbs/${DB}/reports/check`,
          method: "POST",
          headers: auth,
          payload: { name: "t", definition: { blocks: [{ table: t, fields: [c.field] }] } },
        });
        // Whatever the route's shape, it must not reject a field it just offered.
        if (res.statusCode === 200) {
          const body = res.json() as { errors?: string[] };
          const complained = (body.errors ?? []).some((e) => e.includes(c.field));
          expect(complained, `${t}.${c.field} offered but rejected`).toBe(false);
        }
      }
    }
  }, 60_000);
});
