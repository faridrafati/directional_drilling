/**
 * Show Calculated Folders (§3.9).
 *
 * WellView builds its `wv*Calc` tables when a report prints and stores nothing:
 * ZERO of the model's 101 exist in either converted database. This app derives
 * 29 of them from rows that are stored — and they could be reached only by a
 * report template that binds one, which left four of the 29 computable here and
 * reachable by no route in the app at all.
 *
 * Read-only: nothing in these folders has a database column behind it.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import Fastify, { type FastifyInstance } from "fastify";
import { registerWellviewDbRoutes } from "../routes/wellviewDb.js";
import { derivableCalcTables, calcDerivation } from "./calc.js";
import "./calcDerivations.js";
import { issueToken } from "../entry/auth.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const SAMPLE = join(HERE, "..", "..", "..", "..", "sqlite_DB", "wellview", "wv9.0_Sample.sqlite");
const DB = "wv9.0_Sample";

const hasDb = existsSync(SAMPLE);
const d = describe.skipIf(!hasDb);

let app: FastifyInstance;
let auth: { Authorization: string };
let well: string;
let job: string;

type Node = {
  table: string; label: string; count: number | null;
  children: Node[]; derived?: true; needs?: string[];
};

beforeAll(async () => {
  app = Fastify();
  await registerWellviewDbRoutes(app);
  await app.ready();
  const { token } = issueToken({ id: "test", username: "vitest", role: "admin" });
  auth = { Authorization: `Bearer ${token}` };
  if (!hasDb) return;
  const raw = new DatabaseSync(SAMPLE, { readOnly: true });
  const r = raw.prepare(`SELECT idwell, IDRec FROM wvJob
    WHERE idwell IN (SELECT idwell FROM wvWellbore) LIMIT 1`).get() as { idwell: string; IDRec: string };
  well = r.idwell; job = r.IDRec;
  raw.close();
});
afterAll(async () => { await app?.close(); });

const tree = async (calc: boolean) => {
  const res = await app.inject({
    url: `/entry/wellview/dbs/${DB}/tree?idwell=${well}${calc ? "&calc=1" : ""}`, headers: auth,
  });
  expect(res.statusCode).toBe(200);
  return (res.json() as { tree: Node[] }).tree;
};
const folder = async (table: string, q: Record<string, string> = {}) => {
  const qs = new URLSearchParams({ idwell: well, ...q }).toString();
  const res = await app.inject({ url: `/entry/wellview/dbs/${DB}/records/${table}?${qs}`, headers: auth });
  expect(res.statusCode, res.body).toBe(200);
  return res.json() as {
    derived?: boolean; needs?: string[]; total: number | null;
    columns: { column: string; calculated?: boolean; readOnly?: boolean }[];
    rows: Record<string, unknown>[];
    unsupported?: { field: string; reason: string }[];
    verifiedBy?: string;
  };
};

d("calculated folders", () => {
  it("are hidden until they are asked for, as in the desktop", async () => {
    const plain = await tree(false);
    expect(plain.some((n) => n.derived)).toBe(false);
    const shown = await tree(true);
    expect(shown.some((n) => n.derived)).toBe(true);
  });

  it("offers every derivation this app can compute", async () => {
    const group = (await tree(true)).find((n) => n.derived)!;
    const offered = new Set(group.children.map((c) => c.table.toLowerCase()));
    for (const t of derivableCalcTables()) {
      expect(offered.has(t.toLowerCase()), `${t} is reachable`).toBe(true);
    }
    expect(group.children.length).toBe(derivableCalcTables().length);
  });

  it("reaches the four that no shipped template binds", async () => {
    /*
     * The point of the item. These are computed by this app and, until the
     * folder existed, printed by nothing and openable from nowhere.
     */
    const group = (await tree(true)).find((n) => n.derived)!;
    const names = new Set(group.children.map((c) => c.table.toLowerCase()));
    expect(names.has("wvjppintervalproblemcalc")).toBe(true);
    expect(names.has("wvjppjobsupcalc")).toBe(true);
  });

  it("counts what it can and says nothing where it cannot", async () => {
    const group = (await tree(true)).find((n) => n.derived)!;
    for (const c of group.children) {
      const needs = (calcDerivation(c.table)?.params ?? []).filter((p) => p !== "idwell");
      if (needs.length) {
        // A summary of one job cannot be counted before a job is chosen, and
        // "0" would read as an empty folder.
        expect(c.count, `${c.table} needs ${needs.join(",")}`).toBeNull();
        expect(c.needs).toEqual(needs);
      } else {
        expect(typeof c.count, `${c.table} is countable`).toBe("number");
        expect(c.needs).toBeUndefined();
      }
    }
  });

  it("opens a well-scoped folder with its derived rows, all read-only", async () => {
    const f = await folder("wvWellboreSummaryCalc");
    expect(f.derived).toBe(true);
    expect(f.rows.length).toBeGreaterThan(0);
    expect(f.total).toBe(f.rows.length);
    // Nothing here has a database column behind it, so nothing is editable.
    for (const c of f.columns) {
      expect(c.calculated, `${c.column} is marked computed`).toBe(true);
      expect(c.readOnly, `${c.column} is read-only`).toBe(true);
    }
    // The provenance travels with it.
    expect(f.verifiedBy).toBeTruthy();
    expect(Array.isArray(f.unsupported)).toBe(true);
  });

  it("says which selection a job summary is waiting for, rather than showing empty", async () => {
    const waiting = await folder("wvJTLSumCalc");
    expect(waiting.needs).toEqual(["idjob"]);
    expect(waiting.total, "not zero — there is nothing to count yet").toBeNull();
    expect(waiting.rows).toEqual([]);

    const chosen = await folder("wvJTLSumCalc", { job });
    expect(chosen.needs).toEqual([]);
    expect(chosen.total).toBe(chosen.rows.length);
    expect(typeof chosen.total).toBe("number");
  });

  it("still 404s on a table that is neither stored nor derivable", async () => {
    const res = await app.inject({
      url: `/entry/wellview/dbs/${DB}/records/wvNotARealTable?idwell=${well}`, headers: auth,
    });
    expect(res.statusCode).toBe(404);
  });

  it("computes the same figures the report path does", async () => {
    /*
     * One derivation, not two: the folder and a report block bound to the same
     * calc table must agree, or the app disagrees with itself.
     */
    const raw = new DatabaseSync(SAMPLE, { readOnly: true });
    const { computeCalc } = await import("./calc.js");
    const direct = computeCalc(raw, "wvWellboreSummaryCalc", { idwell: well });
    raw.close();
    const f = await folder("wvWellboreSummaryCalc");
    expect(f.rows.length).toBe(direct?.rowCount);
  });
});
