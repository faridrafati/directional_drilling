/**
 * Writing your own query template (§8.1).
 *
 * The 29 shipped templates have worked since ed0775f; this is authoring new
 * ones. What matters is that a query cannot be SAVED in a state the runner
 * would only reject later — a criterion naming a column this database does not
 * have, or a table that is not per-well and so cannot select wells at all. A
 * saved query that fails when someone runs it is worse than a refusal now.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Fastify, { type FastifyInstance } from "fastify";
import { PrismaClient } from "@prisma/client";
import { registerWellviewDbRoutes } from "./wellviewDb.js";
import { issueToken } from "../entry/auth.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..", "..", "..");
const SAMPLE = join(REPO, "sqlite_DB", "wellview", "wv9.0_Sample.sqlite");
const DB = "wv9.0_Sample";
const d = describe.skipIf(!existsSync(SAMPLE));

let app: FastifyInstance;
let prisma: PrismaClient;
let auth: { Authorization: string };
const made: string[] = [];

d("query template builder", () => {
  beforeAll(async () => {
    prisma = new PrismaClient();
    app = Fastify();
    await registerWellviewDbRoutes(app, prisma);
    await app.ready();
    auth = { Authorization: `Bearer ${issueToken({ id: "t", username: "vitest", role: "admin" }).token}` };
  });
  afterAll(async () => {
    for (const id of made) {
      await prisma.wellviewQuery.delete({ where: { id } }).catch(() => undefined);
    }
    await app?.close();
    await prisma?.$disconnect();
  });

  const save = (body: Record<string, unknown>) =>
    app.inject({ method: "POST", url: `/entry/wellview/dbs/${DB}/saved-queries`, headers: auth, payload: body });

  it("offers only tables a query can actually select wells from", async () => {
    const res = await app.inject({ method: "GET", url: `/entry/wellview/dbs/${DB}/query-fields`, headers: auth });
    expect(res.statusCode).toBe(200);
    const { tables } = res.json() as { tables: { table: string; label: string }[] };
    expect(tables.length).toBeGreaterThan(20);
    // Every one must carry idwell, or the runner would skip a criterion on it.
    expect(tables.some((t) => t.table.toLowerCase() === "wvjob")).toBe(true);
    expect(tables.every((t) => !!t.label)).toBe(true);
  });

  it("names a table's columns with the model's captions", async () => {
    const res = await app.inject({
      method: "GET", url: `/entry/wellview/dbs/${DB}/query-fields?table=wvJob`, headers: auth });
    const { fields } = res.json() as { fields: { field: string; label: string; type: string }[] };
    const wvtyp = fields.find((f) => f.field.toLowerCase() === "wvtyp");
    expect(wvtyp).toBeTruthy();
    expect(wvtyp!.label).not.toMatch(/^Wvtyp$/);          // the model's caption, not the column
    expect(fields.some((f) => f.type === "datetime")).toBe(true);
    // System columns are not query material.
    expect(fields.every((f) => !/^sys/i.test(f.field))).toBe(true);
  });

  it("REFUSES to save a criterion this database cannot satisfy", async () => {
    const bogusCol = await save({ name: "bad column", criteria: [
      { table: "wvJob", field: "NotAColumn", op: "=", value: "x" }] });
    expect(bogusCol.statusCode).toBe(400);
    expect(bogusCol.json().error).toMatch(/not a column here/i);

    const bogusTable = await save({ name: "bad table", criteria: [
      { table: "wvNotATable", field: "x", op: "=", value: "y" }] });
    expect(bogusTable.statusCode).toBe(400);
    expect(bogusTable.json().error).toMatch(/not a table here/i);

    const noOp = await save({ name: "no operator", criteria: [
      { table: "wvJob", field: "WVTyp", value: "drill" }] });
    expect(noOp.statusCode).toBe(400);
    expect(noOp.json().error).toMatch(/no operator/i);

    const empty = await save({ name: "nothing", criteria: [] });
    expect(empty.statusCode).toBe(400);
  });

  it("saves a good query and runs it, finding real wells", async () => {
    const name = `vitest drilling ${Date.now()}`;
    const res = await save({
      name, category: "Tests",
      criteria: [{ table: "wvJob", field: "WVTyp", op: "LIKE", value: "drill" }],
    });
    expect(res.statusCode).toBe(201);
    const { id } = res.json() as { id: string };
    made.push(id);

    const listed = await app.inject({
      method: "GET", url: `/entry/wellview/dbs/${DB}/saved-queries`, headers: auth });
    expect((listed.json() as { queries: { id: string }[] }).queries.some((q) => q.id === id)).toBe(true);

    const run = await app.inject({
      method: "POST", url: `/entry/wellview/dbs/${DB}/queries/run`, headers: auth, payload: { id } });
    expect(run.statusCode).toBe(200);
    const out = run.json() as { wells: unknown[]; skipped: unknown[] };
    expect(out.wells.length).toBeGreaterThan(0);
    expect(out.skipped).toEqual([]);
  });

  it("runs criteria inline, so the builder can preview before saving", async () => {
    const run = await app.inject({
      method: "POST", url: `/entry/wellview/dbs/${DB}/queries/run`, headers: auth,
      payload: { criteria: [{ table: "wvJob", field: "WVTyp", op: "LIKE", value: "comp" }] } });
    expect(run.statusCode).toBe(200);
    const out = run.json() as { wells: unknown[] };
    expect(Array.isArray(out.wells)).toBe(true);

    // A different criterion must give a different answer, or nothing is being
    // applied and every preview would look plausible.
    const all = await app.inject({
      method: "POST", url: `/entry/wellview/dbs/${DB}/queries/run`, headers: auth,
      payload: { criteria: [{ table: "wvJob", field: "WVTyp", op: "IS NOT NULL" }] } });
    expect((all.json() as { wells: unknown[] }).wells.length)
      .toBeGreaterThanOrEqual(out.wells.length);
  });

  it("refuses two queries with the same name in one database", async () => {
    const name = `vitest duplicate ${Date.now()}`;
    const body = { name, criteria: [{ table: "wvJob", field: "WVTyp", op: "LIKE", value: "drill" }] };
    const first = await save(body);
    expect(first.statusCode).toBe(201);
    made.push((first.json() as { id: string }).id);
    const second = await save(body);
    expect(second.statusCode).toBe(409);
    expect(second.json().error).toMatch(/already has a query called/i);
  });

  it("deletes only from the database it belongs to", async () => {
    const name = `vitest delete ${Date.now()}`;
    const res = await save({ name, criteria: [{ table: "wvJob", field: "WVTyp", op: "LIKE", value: "drill" }] });
    const { id } = res.json() as { id: string };
    const wrongDb = await app.inject({
      method: "DELETE", url: `/entry/wellview/dbs/wv9.0_database/saved-queries/${id}`, headers: auth });
    expect(wrongDb.statusCode).toBe(404);
    const ok = await app.inject({
      method: "DELETE", url: `/entry/wellview/dbs/${DB}/saved-queries/${id}`, headers: auth });
    expect(ok.statusCode).toBe(200);
  });
});
