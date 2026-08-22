/**
 * My Reports (§9.2) — reports the user designs — against the REAL sample
 * database.
 *
 * The point of the design is that a saved report goes through the SAME resolver
 * as the 182 shipped templates, so the tests that matter compare the two: a
 * saved report over the same table and fields must produce the same columns,
 * the same units and the same anchor behaviour as a Peloton one. If it did not,
 * the app would have two report renderers that quietly drifted.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Fastify, { type FastifyInstance } from "fastify";
import { DatabaseSync } from "node:sqlite";
import { PrismaClient } from "@prisma/client";
import { registerWellviewDbRoutes } from "./wellviewDb.js";
import { issueToken } from "../entry/auth.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const SAMPLE = join(HERE, "..", "..", "..", "..", "sqlite_DB", "wellview", "wv9.0_Sample.sqlite");
const DB = "wv9.0_Sample";
const TAG = "ZZ-TEST-REPORT";

const hasDb = existsSync(SAMPLE);
const d = describe.skipIf(!hasDb);

let app: FastifyInstance;
let auth: { Authorization: string };
let prisma: PrismaClient;
/** A well with jobs, daily reports and casing — enough to exercise an anchor. */
let WELL: string;

const scrub = async () => {
  await prisma.wellviewReport.deleteMany({ where: { name: { startsWith: TAG } } });
};

beforeAll(async () => {
  prisma = new PrismaClient();
  await scrub();
  app = Fastify();
  await registerWellviewDbRoutes(app, prisma);
  await app.ready();
  const { token } = issueToken({ id: "test", username: "vitest", role: "admin" });
  auth = { Authorization: `Bearer ${token}` };
  if (hasDb) {
    const raw = new DatabaseSync(SAMPLE, { readOnly: true });
    WELL = (raw.prepare(`SELECT idwell FROM wvJobReport GROUP BY idwell
      ORDER BY COUNT(*) DESC LIMIT 1`).get() as { idwell: string }).idwell;
    raw.close();
  }
});
afterEach(() => scrub());
afterAll(async () => { await scrub(); await app?.close(); await prisma.$disconnect(); });

const save = (body: unknown) =>
  app.inject({ method: "POST", url: `/entry/wellview/dbs/${DB}/reports`, headers: auth, payload: body as never });
const list = async () =>
  (await app.inject({ url: `/entry/wellview/dbs/${DB}/reports`, headers: auth })).json() as
    { reports: { id: string; name: string; definition: unknown }[] };
const data = (id: string, qs = "") =>
  app.inject({ url: `/entry/wellview/dbs/${DB}/reports/${id}/data?well=${WELL}${qs}`, headers: auth });

interface Block {
  table: string; title: string | null; exists: boolean;
  columns?: { column: string; label: string; unit?: string; derived?: boolean }[];
  rows?: unknown[][]; rowCount?: number;
}

d("My Reports (§9.2)", () => {
  it("refuses a report that names something this database has not got", async () => {
    const bad = await save({
      name: `${TAG} bad`,
      definition: { blocks: [{ table: "wvNotATable", fields: ["x"] }] },
    });
    expect(bad.statusCode).toBe(400);

    const badField = await save({
      name: `${TAG} bad2`,
      definition: { blocks: [{ table: "wvJob", fields: ["NotAColumn"] }] },
    });
    expect(badField.statusCode).toBe(400);
    expect((badField.json() as { error: string }).error).toMatch(/neither a column/i);

    const noBlocks = await save({ name: `${TAG} empty`, definition: { blocks: [] } });
    expect(noBlocks.statusCode).toBe(400);
    expect((await list()).reports.filter((r) => r.name.startsWith(TAG))).toEqual([]);
  });

  it("accepts a field the app COMPUTES, which has no column at all", async () => {
    // Refusing these would reject exactly the fields WellView is known for.
    const res = await save({
      name: `${TAG} calc`,
      definition: { blocks: [{ table: "wvJobDrillStringDrillParam", fields: ["DepthStart", "ropcalc"] }] },
    });
    expect(res.statusCode, res.body).toBe(201);
  });

  it("saves, lists, edits in place and deletes", async () => {
    const created = await save({
      name: `${TAG} one`, category: "Testing",
      definition: { blocks: [{ table: "wvJob", title: "Jobs", fields: ["JobTyp", "DtTmStart"] }] },
    });
    expect(created.statusCode).toBe(201);
    const { id } = created.json() as { id: string };

    const mine = (await list()).reports.filter((r) => r.name.startsWith(TAG));
    expect(mine.length).toBe(1);

    // Editing in place keeps the id — a save that always created would make
    // "edit" impossible, which is what the schematic templates used to do.
    const edited = await save({
      id, name: `${TAG} one`,
      definition: { blocks: [{ table: "wvJob", title: "Jobs", fields: ["JobTyp"] }] },
    });
    expect(edited.statusCode).toBe(200);
    expect((edited.json() as { id: string }).id).toBe(id);
    expect((await list()).reports.filter((r) => r.name.startsWith(TAG)).length).toBe(1);

    const gone = await app.inject({
      method: "DELETE", url: `/entry/wellview/dbs/${DB}/reports/${id}`, headers: auth });
    expect(gone.statusCode).toBe(200);
    expect((await list()).reports.filter((r) => r.name.startsWith(TAG))).toEqual([]);
  });

  it("refuses a duplicate name rather than shadowing the first", async () => {
    await save({ name: `${TAG} dup`, definition: { blocks: [{ table: "wvJob", fields: ["JobTyp"] }] } });
    const again = await save({
      name: `${TAG} dup`, definition: { blocks: [{ table: "wvJob", fields: ["JobTyp"] }] } });
    expect(again.statusCode).toBe(409);
  });

  it("resolves through the SAME path as a shipped template", async () => {
    const created = await save({
      name: `${TAG} render`,
      definition: {
        blocks: [{ table: "wvJobReport", title: "Daily Operations",
          fields: ["DtTmStart", "Remarks"] }],
      },
    });
    const { id } = created.json() as { id: string };
    const res = await data(id);
    expect(res.statusCode, res.body.slice(0, 200)).toBe(200);
    const body = res.json() as { report: string; blocks: Block[]; well: { idwell: string } };
    expect(body.well.idwell).toBe(WELL);
    expect(body.blocks.length).toBe(1);
    const b = body.blocks[0];
    expect(b.exists).toBe(true);
    expect(b.rowCount).toBeGreaterThan(0);
    // The model's caption, not the raw column name — the same enrichment a
    // Peloton template gets, because it is the same code.
    expect(b.columns?.map((c) => c.label)).not.toContain("DtTmStart");
    expect(b.columns?.length).toBe(2);
  });

  it("carries units and computed fields exactly as a shipped template does", async () => {
    const created = await save({
      name: `${TAG} units`,
      definition: {
        blocks: [{ table: "wvJobDrillStringDrillParam",
          fields: ["DepthStart", "DepthEnd", "ropcalc"] }],
      },
    });
    const { id } = created.json() as { id: string };
    const body = (await data(id)).json() as { blocks: Block[] };
    const cols = body.blocks[0].columns ?? [];
    // A measured column carries its base unit so the client can convert.
    expect(cols.find((c) => c.column.toLowerCase() === "depthstart")?.unit).toBe("m");
    // …and a computed one is flagged, so the page can mark it as derived.
    const rop = cols.find((c) => c.column.toLowerCase() === "ropcalc");
    expect(rop?.derived).toBe(true);
    const ix = cols.indexOf(rop!);
    expect((body.blocks[0].rows ?? []).some((r) => r[ix] != null)).toBe(true);
  });

  it("honours an anchor, so a Daily Operation report is one day", async () => {
    const created = await save({
      name: `${TAG} anchored`,
      definition: {
        anchor: "wvJobReport",
        blocks: [{ table: "wvJobReport", fields: ["DtTmStart"] }],
      },
    });
    const { id } = created.json() as { id: string };
    const all = (await data(id)).json() as { blocks: Block[] };
    expect(all.blocks[0].rowCount).toBeGreaterThan(1);

    const raw = new DatabaseSync(SAMPLE, { readOnly: true });
    const one = (raw.prepare("SELECT IDRec FROM wvJobReport WHERE idwell = ? LIMIT 1")
      .get(WELL) as { IDRec: string }).IDRec;
    raw.close();
    const scoped = (await data(id, `&anchor=wvJobReport:${one}`)).json() as { blocks: Block[] };
    expect(scoped.blocks[0].rowCount).toBe(1);
  });

  it("needs a well, and refuses an unknown report", async () => {
    const created = await save({
      name: `${TAG} w`, definition: { blocks: [{ table: "wvJob", fields: ["JobTyp"] }] } });
    const { id } = created.json() as { id: string };
    expect((await app.inject({
      url: `/entry/wellview/dbs/${DB}/reports/${id}/data`, headers: auth })).statusCode).toBe(400);
    expect((await app.inject({
      url: `/entry/wellview/dbs/${DB}/reports/nosuchid/data?well=${WELL}`, headers: auth })).statusCode).toBe(404);
  });

  it("rejects without a token", async () => {
    expect((await app.inject({ url: `/entry/wellview/dbs/${DB}/reports` })).statusCode).toBe(401);
    expect((await app.inject({
      method: "POST", url: `/entry/wellview/dbs/${DB}/reports`,
      payload: { name: "x", definition: { blocks: [] } } as never })).statusCode).toBe(401);
  });
});
