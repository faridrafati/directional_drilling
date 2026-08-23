/**
 * A query criterion is read in the STORED unit, and the builder now says so.
 *
 * The guide is explicit: "Value 1 and Value 2 must be in base units." The app
 * obeys that and always has — nothing on this path converts what a user types.
 * What it never did was disclose it. The field picker showed "Casing Pressure"
 * and the box took a bare number, while every other screen in the app was
 * showing that field in psi.
 *
 * `wvJobReport.PresCas` is stored in kPa and displayed in psi in the US set. A
 * criterion of `> 2000` matches one well; the 2,000 psi the user meant is
 * 13,790 kPa and matches none. Both numbers are "right" — the app just never
 * said which one it wanted.
 *
 * Converting instead was considered and rejected. 16 fields would INVERT: °API
 * is reciprocal, so `> 30` becomes `kg/m³ > 876` and returns the heavy oils
 * rather than the light ones. Disclosure is correct under either reading of the
 * guide; conversion is only correct under one, and silently changes the meaning
 * of every saved query.
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

interface Field { field: string; label: string; unit?: string; units?: Record<string, { unit: string }> }

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

const fields = async (table: string) => {
  const res = await app.inject({
    url: `/entry/wellview/dbs/${DB}/query-fields?table=${table}`, headers: auth,
  });
  expect(res.statusCode).toBe(200);
  return (res.json() as { fields: Field[] }).fields;
};

d("the query builder can name the unit it is asking for", () => {
  it("sends the stored unit and what each set displays it as", async () => {
    const f = (await fields("wvJobReport")).find((x) => x.field.toLowerCase() === "prescas")!;
    expect(f, "wvJobReport.PresCas").toBeTruthy();
    // Stored in kPa…
    expect(f.unit).toBe("kPa");
    // …and shown in psi, which is the gap a user falls into.
    expect(f.units?.US?.unit).toBe("psi");
    expect(f.units!.US.unit).not.toBe(f.unit);
  });

  it("covers enough fields to be worth saying", async () => {
    // If almost nothing had a unit this would be decoration.
    //
    // The numbers are smaller than the data model's, and that is expected: the
    // model describes 124 fields for wvJobReport and this converted database
    // has 59 columns, 45 of which resolve to a model field. Across the whole
    // model 2,610 fields carry a base unit and 2,068 of those display as
    // something else in the US set — so the gap this closes is the common case,
    // not a corner.
    const all = await fields("wvJobReport");
    const withUnit = all.filter((f) => f.unit);
    const differing = withUnit.filter((f) => f.units?.US?.unit && f.units.US.unit !== f.unit);
    expect(withUnit.length).toBe(15);
    expect(differing.length).toBeGreaterThan(5);
    // NOT every unit-bearing field has a per-set map — 538 of the model's 2,610
    // do not, including latitude, longitude and anything already in days. Those
    // are shown the same way in every set, so the hint says "in days" with
    // nothing to contrast, which is correct rather than incomplete.
    expect(withUnit.some((f) => !f.units)).toBe(true);
    expect(withUnit.some((f) => f.units)).toBe(true);
  });

  it("STILL matches in base units, which is what the guide says", async () => {
    // This is a fence, not a feature: it passed before the change and must keep
    // passing after it. It exists to stop a later "helpful" server-side
    // conversion being added on the quiet.
    const run = async (value: string) => {
      const res = await app.inject({
        method: "POST",
        url: `/entry/wellview/dbs/${DB}/queries/run`,
        headers: auth,
        payload: { criteria: [{ table: "wvJobReport", field: "PresCas", op: ">", value }] },
      });
      expect(res.statusCode).toBe(200);
      return (res.json() as { wells: unknown[] }).wells.length;
    };
    // 2000 read as kPa finds wells; 13790 kPa (= 2000 psi) finds none.
    expect(await run("2000")).toBeGreaterThan(0);
    expect(await run("13790")).toBe(0);
  });

  it("leaves a field with no unit alone", async () => {
    // Most of the schema is text and dates. A "(undefined)" on those would be
    // worse than saying nothing.
    const f = (await fields("wvJob")).find((x) => x.field.toLowerCase() === "wvtyp")!;
    expect(f).toBeTruthy();
    expect(f.unit).toBeUndefined();
    expect(f.units).toBeUndefined();
  });
});
