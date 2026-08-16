/**
 * Exhaustive functional sweep (temporary, driven from the session):
 * every endpoint × every input the UI can produce, against the real sample DB.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { registerWellviewDbRoutes } from "../routes/wellviewDb.js";
import { registerWellviewSampleRoutes } from "../routes/wellviewSample.js";
import { issueToken } from "../entry/auth.js";
import { readFileSync } from "node:fs";

const DB = "wv9.0_Sample";
let app: FastifyInstance;
let auth: { Authorization: string };

beforeAll(async () => {
  app = Fastify();
  await registerWellviewDbRoutes(app);
  await registerWellviewSampleRoutes(app);
  await app.ready();
  auth = { Authorization: `Bearer ${issueToken({ id: "t", username: "sweep", role: "admin" }).token}` };
});
afterAll(async () => { await app?.close(); });

describe("exhaustive sweep", () => {
  it("resolves ALL 181 templates for the 3 richest wells with zero 500s", async () => {
    const wells = ((await app.inject({ url: `/entry/wellview/dbs/${DB}/wells`, headers: auth })).json() as
      { wells: { idwell: string }[] }).wells;
    const reports = JSON.parse(readFileSync(
      "/home/farid/directional_drilling/apps/web/public/wellview-templates/reports.json", "utf8")) as
      { reports: { html: string }[] };
    // 3 wells spread across the list + the default
    const picks = [wells[0], wells[10], wells[41]].filter(Boolean);
    const failures: string[] = [];
    for (const w of picks) {
      for (const r of reports.reports) {
        const res = await app.inject({
          url: `/entry/wellview/dbs/${DB}/template-data?html=${encodeURIComponent(r.html)}&well=${w.idwell}`,
          headers: auth,
        });
        if (res.statusCode !== 200) failures.push(`${res.statusCode} ${r.html} (${w.idwell.slice(0, 6)}): ${res.body.slice(0, 120)}`);
      }
    }
    expect(failures, failures.join("\n")).toEqual([]);
  }, 120_000);

  it("schematic payload succeeds for every well", async () => {
    const wells = ((await app.inject({ url: `/entry/wellview/dbs/${DB}/wells`, headers: auth })).json() as
      { wells: { idwell: string }[] }).wells;
    const failures: string[] = [];
    for (const w of wells) {
      const res = await app.inject({ url: `/entry/wellview/dbs/${DB}/schematic?idwell=${w.idwell}`, headers: auth });
      if (res.statusCode !== 200) failures.push(`${res.statusCode} ${w.idwell}`);
    }
    expect(failures).toEqual([]);
  }, 60_000);

  it("records GET succeeds for EVERY table in the tree, for two wells (with and without system cols)", async () => {
    const wells = ((await app.inject({ url: `/entry/wellview/dbs/${DB}/wells`, headers: auth })).json() as
      { wells: { idwell: string }[] }).wells;
    const tree = ((await app.inject({ url: `/entry/wellview/dbs/${DB}/tree`, headers: auth })).json() as
      { tree: { table: string; children: unknown[] }[] }).tree;
    const tables: string[] = [];
    const walk = (nodes: { table: string; children: { table: string; children: unknown[] }[] }[]) => {
      for (const n of nodes) { tables.push(n.table); walk(n.children as never); }
    };
    walk(tree as never);
    const failures: string[] = [];
    for (const w of [wells[0], wells[20]]) {
      for (const t of tables) {
        for (const sys of ["", "&system=1"]) {
          const res = await app.inject({
            url: `/entry/wellview/dbs/${DB}/records/${t}?idwell=${w.idwell}${sys}`, headers: auth,
          });
          if (res.statusCode !== 200) failures.push(`${res.statusCode} ${t}${sys}: ${res.body.slice(0, 100)}`);
        }
      }
    }
    expect(failures, failures.slice(0, 10).join("\n")).toEqual([]);
    expect(tables.length).toBeGreaterThan(150);
  }, 120_000);

  it("both databases open and list wells", async () => {
    const dbs = (await app.inject({ url: "/entry/wellview/dbs", headers: auth })).json() as
      { id: string; wells: number }[];
    expect(dbs.length).toBeGreaterThanOrEqual(2);
    for (const d of dbs) {
      const res = await app.inject({ url: `/entry/wellview/dbs/${d.id}/wells`, headers: auth });
      expect(res.statusCode, d.id).toBe(200);
      const tre = await app.inject({ url: `/entry/wellview/dbs/${d.id}/tree`, headers: auth });
      expect(tre.statusCode, d.id).toBe(200);
      const aud = await app.inject({ url: `/entry/wellview/dbs/${d.id}/audit`, headers: auth });
      expect(aud.statusCode, d.id).toBe(200);
    }
  }, 60_000);

  it("quick query works on every header column type (spot: 12 columns)", async () => {
    const cols = (await app.inject({ url: `/entry/wellview/dbs/${DB}/header-columns`, headers: auth })).json() as
      { column: string }[];
    for (const c of cols.slice(0, 12)) {
      const res = await app.inject({
        url: `/entry/wellview/dbs/${DB}/wells?lookin=${c.column}&lookfor=e`, headers: auth,
      });
      expect(res.statusCode, c.column).toBe(200);
    }
  });
});
