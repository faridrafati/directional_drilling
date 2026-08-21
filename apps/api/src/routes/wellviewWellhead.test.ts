/**
 * The wellhead route, against the REAL converted sample database.
 *
 * The assertions here are the ones that matter for the panel being honest
 * rather than merely populated: that the assembly's recorded IconName resolves
 * to a file that actually exists in the converted icon library (a broken image
 * on a wellhead reads as "no data" to a user), that the parent chain
 * head → component → outlet is followed by IDRecParent and not by guesswork,
 * and that every value carrying a unit exposes its base unit and per-set
 * formats so the client converts instead of printing metres labelled as feet.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Fastify, { type FastifyInstance } from "fastify";
import { DatabaseSync } from "node:sqlite";
import { registerWellviewDbRoutes } from "./wellviewDb.js";
import { issueToken } from "../entry/auth.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..", "..");
const SAMPLE = join(ROOT, "sqlite_DB", "wellview", "wv9.0_Sample.sqlite");
const ICONS = join(ROOT, "apps", "web", "public", "wellview-icons");
const DB = "wv9.0_Sample";
/** The sample's richest wellhead: one assembly, 4 components, 13 outlets. */
const IDWELL = "462C2607F3BA4FE9846197C58352207B";

const hasDb = existsSync(SAMPLE);
const d = describe.skipIf(!hasDb);

interface Field { column: string; label: string; value: string | number; type?: string; unit?: string; units?: Record<string, { unit: string }> }
interface Head {
  idrec: string; icon: string | null; iconName: string | null; job: string | null; fields: Field[];
  components: { idrec: string; des: string | null; fields: Field[]; outlets: { idrec: string; fields: Field[] }[] }[];
}

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

const get = async (idwell: string) =>
  app.inject({ url: `/entry/wellview/dbs/${DB}/wellheads?idwell=${idwell}`, headers: auth });

d("WellView wellhead route", () => {
  it("requires a well", async () => {
    const res = await app.inject({ url: `/entry/wellview/dbs/${DB}/wellheads`, headers: auth });
    expect(res.statusCode).toBe(400);
  });

  it("rejects without a token", async () => {
    const res = await app.inject({ url: `/entry/wellview/dbs/${DB}/wellheads?idwell=${IDWELL}` });
    expect(res.statusCode).toBe(401);
  });

  it("returns the well's assemblies with their specification", async () => {
    const res = await get(IDWELL);
    expect(res.statusCode).toBe(200);
    const { supported, wellheads } = res.json() as { supported: boolean; wellheads: Head[] };
    expect(supported).toBe(true);
    expect(wellheads.length).toBe(1);
    for (const h of wellheads) {
      expect(h.idrec).toMatch(/^[0-9A-F]{32}$/i);
      expect(h.fields.length).toBeGreaterThan(0);
      // Captions come from the model, not from the column name.
      expect(h.fields.every((f) => f.label && f.column)).toBe(true);
    }
  });

  it("resolves every recorded IconName to an icon file that exists", async () => {
    const raw = new DatabaseSync(SAMPLE, { readOnly: true });
    const wells = raw.prepare("SELECT DISTINCT idwell FROM wvWellhead").all() as { idwell: string }[];
    raw.close();
    let named = 0;
    for (const w of wells) {
      const { wellheads } = (await get(w.idwell)).json() as { wellheads: Head[] };
      for (const h of wellheads) {
        if (!h.iconName) continue;
        named++;
        expect(h.icon, `IconName "${h.iconName}" did not resolve`).toBeTruthy();
        expect(existsSync(join(ICONS, h.icon!)), `${h.icon} is missing from the icon library`).toBe(true);
      }
    }
    // Every wellhead in the sample carries a name; none may silently fall through.
    expect(named).toBe(17);
  });

  it("follows IDRecParent for components and outlets, matching the database exactly", async () => {
    const raw = new DatabaseSync(SAMPLE, { readOnly: true });
    const { wellheads } = (await get(IDWELL)).json() as { wellheads: Head[] };
    for (const h of wellheads) {
      const want = raw.prepare("SELECT COUNT(*) n FROM wvWellheadComp WHERE IDRecParent = ?")
        .get(h.idrec) as { n: number };
      expect(h.components.length).toBe(want.n);
      for (const c of h.components) {
        const wantOut = raw.prepare("SELECT COUNT(*) n FROM wvWellheadCompOutlet WHERE IDRecParent = ?")
          .get(c.idrec) as { n: number };
        expect(c.outlets.length).toBe(wantOut.n);
      }
    }
    raw.close();
    expect(wellheads.flatMap((h) => h.components).some((c) => c.outlets.length > 0)).toBe(true);
  });

  it("carries the base unit and the per-set formats on every measured field", async () => {
    const { wellheads } = (await get(IDWELL)).json() as { wellheads: Head[] };
    const all = wellheads.flatMap((h) => [
      ...h.fields, ...h.components.flatMap((c) => [...c.fields, ...c.outlets.flatMap((o) => o.fields)]),
    ]);
    const measured = all.filter((f) => f.unit);
    expect(measured.length).toBeGreaterThan(0);
    // A pressure the user reads in psi must not arrive as a bare kPa number.
    for (const f of measured) expect(f.units, `${f.column} has a unit but no display formats`).toBeTruthy();
    expect(measured.some((f) => f.unit === "kPa")).toBe(true);
    expect(measured.some((f) => f.unit === "m")).toBe(true);
  });

  it("omits system and key columns, and never returns an empty value", async () => {
    const { wellheads } = (await get(IDWELL)).json() as { wellheads: Head[] };
    const all = wellheads.flatMap((h) => [...h.fields, ...h.components.flatMap((c) => c.fields)]);
    // A bare GUID is not a specification: link columns must not reach the panel.
    expect(all.some((f) => /^sys/i.test(f.column) || /^idrec/i.test(f.column)
      || /tk$/i.test(f.column) || f.column === "idwell")).toBe(false);
    expect(all.some((f) => f.value === null || f.value === "")).toBe(false);
  });

  it("names the job a head was installed on instead of returning its GUID", async () => {
    const raw = new DatabaseSync(SAMPLE, { readOnly: true });
    const linked = raw.prepare("SELECT COUNT(*) n FROM wvWellhead WHERE IDRecJob IS NOT NULL")
      .get() as { n: number };
    const wells = raw.prepare("SELECT DISTINCT idwell FROM wvWellhead").all() as { idwell: string }[];
    raw.close();
    let named = 0;
    for (const w of wells) {
      const { wellheads } = (await get(w.idwell)).json() as { wellheads: Head[] };
      for (const h of wellheads.filter((x) => x.job)) {
        named++;
        expect(h.job).not.toMatch(/^[0-9A-F]{32}$/i);
      }
    }
    // Every head that names a job must resolve it — a dropped link is a silent
    // hole in the record, not an empty field.
    expect(named).toBe(linked.n);
    expect(named).toBeGreaterThan(0);
  });

  it("carries the model's physical type so 0 does not print where No belongs", async () => {
    const { wellheads } = (await get(IDWELL)).json() as { wellheads: Head[] };
    const all = wellheads.flatMap((h) => [
      ...h.fields, ...h.components.flatMap((c) => [...c.fields, ...c.outlets.flatMap((o) => o.fields)]),
    ]);
    // "Proposed Wellhead?" and the valve flags are booleans stored as 0/1.
    const bools = all.filter((f) => f.type === "boolean");
    expect(bools.length).toBeGreaterThan(0);
    expect(bools.every((f) => f.value === 0 || f.value === 1)).toBe(true);
    // Dates arrive as full timestamps and are trimmed for display, not here.
    const dates = all.filter((f) => f.type === "datetime");
    expect(dates.length).toBeGreaterThan(0);
    for (const f of dates) expect(String(f.value)).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("returns an empty list, not an error, for a well with no wellhead", async () => {
    const res = await get("00000000000000000000000000000000");
    expect(res.statusCode).toBe(200);
    expect((res.json() as { wellheads: Head[] }).wellheads).toEqual([]);
  });
});
