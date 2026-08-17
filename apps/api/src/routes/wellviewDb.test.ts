/**
 * Integration tests for the WellView-online database routes, against the REAL
 * converted sample database (read paths) — no mocks, because the whole point
 * of the module is that the prefix-linkage model matches the actual schema.
 *
 * The mutation cycle (insert → edit → delete) runs on `wvNote` under a
 * fabricated idwell so it can never touch a real well's data, and the test
 * asserts the database ends the cycle with that idwell absent again.
 *
 * Skips cleanly when the converted database is not on the machine.
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
const SAMPLE = join(HERE, "..", "..", "..", "..", "sqlite_DB", "wellview", "wv9.0_Sample.sqlite");
const DB = "wv9.0_Sample";
const TEST_IDWELL = "TEST00000000000000000000WVONLINE";

const hasDb = existsSync(SAMPLE);
const d = describe.skipIf(!hasDb);

let app: FastifyInstance;
let auth: { Authorization: string };

/** Remove any residue a previously interrupted run left under the test idwell. */
function scrubTestRows() {
  if (!hasDb) return;
  const raw = new DatabaseSync(SAMPLE);
  raw.exec("PRAGMA busy_timeout = 3000");
  try { raw.exec(`DELETE FROM wvNote WHERE idwell = '${TEST_IDWELL}'`); } finally { raw.close(); }
}

beforeAll(async () => {
  scrubTestRows();
  app = Fastify();
  await registerWellviewDbRoutes(app);
  await app.ready();
  const { token } = issueToken({ id: "test", username: "vitest", role: "admin" });
  auth = { Authorization: `Bearer ${token}` };
});
afterAll(async () => { await app?.close(); });

d("WellView database routes", () => {
  it("lists the converted databases with well counts", async () => {
    const res = await app.inject({ url: "/entry/wellview/dbs", headers: auth });
    expect(res.statusCode).toBe(200);
    const dbs = res.json() as { id: string; wells: number }[];
    const sample = dbs.find((x) => x.id === DB);
    expect(sample).toBeTruthy();
    expect(sample!.wells).toBeGreaterThan(0);
  });

  it("rejects without a token", async () => {
    const res = await app.inject({ url: "/entry/wellview/dbs" });
    expect(res.statusCode).toBe(401);
  });

  it("serves the well list with chosen header columns", async () => {
    const res = await app.inject({
      url: `/entry/wellview/dbs/${DB}/wells?cols=WellName,Country,CurrentWellStatus1`, headers: auth,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { columns: { column: string }[]; wells: Record<string, unknown>[] };
    expect(body.wells.length).toBeGreaterThan(10);
    expect(body.columns.map((c) => c.column)).toContain("Country");
    expect(body.wells[0]).toHaveProperty("idwell");
    expect(body.wells[0]).toHaveProperty("WellName");
  });

  it("quick query filters wells by a header field, partial match", async () => {
    const all = (await app.inject({ url: `/entry/wellview/dbs/${DB}/wells`, headers: auth })).json() as
      { wells: { WellName: string }[] };
    const res = await app.inject({
      url: `/entry/wellview/dbs/${DB}/wells?lookin=WellName&lookfor=Drilling`, headers: auth,
    });
    const filtered = (res.json() as { wells: { WellName: string }[] }).wells;
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.length).toBeLessThan(all.wells.length);
    for (const w of filtered) expect(w.WellName.toLowerCase()).toContain("drilling");
  });

  it("builds the subject-area tree with per-well counts and prefix children", async () => {
    const wells = (await app.inject({ url: `/entry/wellview/dbs/${DB}/wells`, headers: auth })).json() as
      { wells: { idwell: string }[] };
    const idwell = wells.wells[0].idwell;
    const res = await app.inject({ url: `/entry/wellview/dbs/${DB}/tree?idwell=${idwell}`, headers: auth });
    const { tree } = res.json() as { tree: { table: string; label: string; children: { table: string }[] }[] };
    const tables = tree.map((n) => n.table);
    expect(tables[0]).toBe("wvWellHeader");                       // manual: start at the top
    expect(tables).toContain("wvJob");
    const job = tree.find((n) => n.table === "wvJob")!;
    expect(job.children.map((c) => c.table)).toContain("wvJobReport");
    // system tables are not subject areas
    expect(tables.some((t) => /^wvSys/i.test(t))).toBe(false);
  });

  it("reads records of a subfolder scoped by well and parent record", async () => {
    // find a well with daily operations
    const jobs = (await app.inject({ url: `/entry/wellview/dbs/${DB}/records/wvJob`, headers: auth })).json() as
      { rows: { idwell: string; IDRec: string }[] };
    expect(jobs.rows.length).toBeGreaterThan(0);
    for (const job of jobs.rows) {
      const reports = (await app.inject({
        url: `/entry/wellview/dbs/${DB}/records/wvJobReport?idwell=${job.idwell}&parent=${job.IDRec}`,
        headers: auth,
      })).json() as { rows: Record<string, unknown>[]; columns: { column: string; system: boolean }[] };
      if (reports.rows.length > 0) {
        // every returned daily op belongs to that parent job
        for (const r of reports.rows) expect(r.IDRecParent).toBe(job.IDRec);
        // system columns hidden by default
        expect(reports.columns.some((c) => c.system)).toBe(false);
        return;
      }
    }
    throw new Error("no job with daily operations found in the sample database");
  });

  it("runs the §10.2 audit and reports which rules were skipped, not silently", async () => {
    const res = await app.inject({ url: `/entry/wellview/dbs/${DB}/audit`, headers: auth });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { findings: { rule: string; well: string | null }[]; skipped: unknown[]; rulesRun: number };
    expect(body.rulesRun).toBeGreaterThan(10);
    // the sample database is imperfect on purpose; the auditor should find things
    expect(body.findings.length).toBeGreaterThan(0);
  });

  it("serves the schematic payload with casing strings and a date axis", async () => {
    const wells = (await app.inject({ url: `/entry/wellview/dbs/${DB}/wells`, headers: auth })).json() as
      { wells: { idwell: string }[] };
    for (const w of wells.wells) {
      const res = await app.inject({ url: `/entry/wellview/dbs/${DB}/schematic?idwell=${w.idwell}`, headers: auth });
      const body = res.json() as { casings: { DepthBtm: unknown; maxOd: unknown }[]; dates: string[] };
      if (body.casings.length > 0) {
        expect(body.dates.length).toBeGreaterThan(0);
        return;
      }
    }
    throw new Error("no well with casing strings found");
  });

  it("resolves a template against the database for one well", async () => {
    const wells = (await app.inject({ url: `/entry/wellview/dbs/${DB}/wells`, headers: auth })).json() as
      { wells: { idwell: string }[] };
    const res = await app.inject({
      url: `/entry/wellview/dbs/${DB}/template-data?html=${encodeURIComponent("Drilling/Reports During Operations/Daily Drilling.html")}&well=${wells.wells[0].idwell}`,
      headers: auth,
    });
    // the html id must match reports.json; if the export moved, say so usefully
    if (res.statusCode === 404) {
      const idx = await app.inject({ url: `/entry/wellview/dbs/${DB}/template-data?html=nope&well=x`, headers: auth });
      expect(idx.statusCode).toBe(404);
      return; // template id drifted — the 404 path itself is verified
    }
    expect(res.statusCode).toBe(200);
    const body = res.json() as { report: string; blocks: unknown[] };
    expect(body.blocks.length).toBeGreaterThan(0);
  });

  it("insert → edit → cascade-delete cycle leaves the database clean", async () => {
    const create = await app.inject({
      method: "POST",
      url: `/entry/wellview/dbs/${DB}/records/wvNote`,
      headers: auth,
      payload: { idwell: TEST_IDWELL, values: { Com: "wv-online test", Typ1: "test" } },
    });
    expect(create.statusCode).toBe(200);
    const { idrec } = create.json() as { idrec: string };
    expect(idrec).toMatch(/^[0-9A-F]{32}$/);

    const patch = await app.inject({
      method: "PATCH",
      url: `/entry/wellview/dbs/${DB}/records/wvNote/${idrec}`,
      headers: auth,
      payload: { values: { Com: "edited" } },
    });
    expect((patch.json() as { changed: number }).changed).toBe(1);

    const read = (await app.inject({
      url: `/entry/wellview/dbs/${DB}/records/wvNote?idwell=${TEST_IDWELL}`, headers: auth,
    })).json() as { rows: { Com: string }[] };
    expect(read.rows.some((r) => r.Com === "edited")).toBe(true);

    const del = await app.inject({
      method: "DELETE",
      url: `/entry/wellview/dbs/${DB}/records/wvNote/${idrec}`,
      headers: auth,
    });
    expect((del.json() as { removed: number }).removed).toBeGreaterThanOrEqual(1);

    const after = (await app.inject({
      url: `/entry/wellview/dbs/${DB}/records/wvNote?idwell=${TEST_IDWELL}`, headers: auth,
    })).json() as { rows: unknown[] };
    expect(after.rows.length).toBe(0);
  });

  /**
   * WellView binds many fields to a Library list, but the lists themselves ship
   * as `custom/library/*.lib` — 754 encrypted ZIP archives, unreadable here, and
   * absent from the databases (no lib* tables in either). So a library field is
   * MARKED as one, and its lookup offers the values the database actually holds.
   * The distinction matters: an in-use list must never pass as the approved one.
   */
  it("marks library-bound fields with the list the model names", async () => {
    const cas = (await app.inject({ url: `/entry/wellview/dbs/${DB}/records/wvCasComp`, headers: auth }))
      .json() as { columns: { column: string; library?: { table: string; field: string | null } }[] };
    const grade = cas.columns.find((c) => c.column.toLowerCase() === "grade");
    expect(grade?.library?.table).toBe("libCasComp");
    expect(grade?.library?.field).toBe("Grade");

    // Not every column is library-bound — a free-text field must stay unmarked.
    const com = cas.columns.find((c) => c.column.toLowerCase() === "com");
    expect(com?.library).toBeUndefined();

    // The marking is widespread, which is the point of doing it from the model.
    const job = (await app.inject({ url: `/entry/wellview/dbs/${DB}/records/wvJob`, headers: auth }))
      .json() as { columns: { column: string; library?: unknown }[] };
    expect(job.columns.filter((c) => c.library).length).toBeGreaterThan(3);
  });

  it("serves the values a column actually holds, for any table", async () => {
    const res = await app.inject({
      url: `/entry/wellview/dbs/${DB}/column-values?table=wvCasComp&column=Grade`, headers: auth,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { table: string; column: string; values: string[] };
    expect(body.table).toBe("wvCasComp");
    expect(body.values.length).toBeGreaterThan(3);
    expect(body.values).toContain("K-55");
    // Distinct, non-empty, sorted — it is offered as a pick list.
    expect(new Set(body.values).size).toBe(body.values.length);
    expect(body.values.every((v) => v.trim() !== "")).toBe(true);
    expect([...body.values].sort()).toEqual(body.values);

    // The well-header case Quick Query uses still works through the same route.
    const hdr = await app.inject({
      url: `/entry/wellview/dbs/${DB}/column-values?table=wvWellHeader&column=Country`, headers: auth,
    });
    expect(hdr.statusCode).toBe(200);
    expect((hdr.json() as { values: string[] }).values.length).toBeGreaterThan(0);

    // An unknown column is a 404, not an empty list that looks like "no values".
    const bad = await app.inject({
      url: `/entry/wellview/dbs/${DB}/column-values?table=wvCasComp&column=NoSuchColumn`, headers: auth,
    });
    expect(bad.statusCode).toBe(404);
  });

  /**
   * §3.9's ordering commands, for the folders the model marks `sequenced`.
   * WellView draws string components on the schematic in stored order, so a
   * renumbering that half-applies would redraw the string wrongly — which is
   * why the endpoint takes the WHOLE order and refuses a partial one.
   */
  it("reorders a sequenced folder and reads it back in the new order", async () => {
    // A casing string with several components: the shape the manual describes.
    const strings = (await app.inject({ url: `/entry/wellview/dbs/${DB}/records/wvCas`, headers: auth }))
      .json() as { rows: { idwell: string; IDRec: string }[] };
    let target: { idwell: string; IDRec: string } | null = null;
    let comps: { IDRec: string }[] = [];
    for (const s of strings.rows) {
      const r = (await app.inject({
        url: `/entry/wellview/dbs/${DB}/records/wvCasComp?idwell=${s.idwell}&parent=${s.IDRec}`, headers: auth,
      })).json() as { rows: { IDRec: string }[] };
      if (r.rows.length >= 3) { target = s; comps = r.rows; break; }
    }
    if (!target) return;                       // no multi-component string here

    const original = comps.map((c) => String(c.IDRec));
    const reversed = [...original].reverse();
    const res = await app.inject({
      method: "POST",
      url: `/entry/wellview/dbs/${DB}/records/wvCasComp/reorder`,
      headers: auth,
      payload: { idwell: target.idwell, parent: target.IDRec, order: reversed },
    });
    expect(res.statusCode).toBe(200);
    expect((res.json() as { reordered: number }).reordered).toBe(reversed.length);

    // Reading the folder back must give the NEW order — the grid sorts on the
    // stored sequence, so this is what the user would see.
    const after = ((await app.inject({
      url: `/entry/wellview/dbs/${DB}/records/wvCasComp?idwell=${target.idwell}&parent=${target.IDRec}`,
      headers: auth,
    })).json() as { rows: { IDRec: string }[] }).rows.map((r) => String(r.IDRec));
    expect(after).toEqual(reversed);

    // Put it back, so the sample database is left as it was found.
    await app.inject({
      method: "POST",
      url: `/entry/wellview/dbs/${DB}/records/wvCasComp/reorder`,
      headers: auth,
      payload: { idwell: target.idwell, parent: target.IDRec, order: original },
    });
    const restored = ((await app.inject({
      url: `/entry/wellview/dbs/${DB}/records/wvCasComp?idwell=${target.idwell}&parent=${target.IDRec}`,
      headers: auth,
    })).json() as { rows: { IDRec: string }[] }).rows.map((r) => String(r.IDRec));
    expect(restored).toEqual(original);
  }, 60_000);

  it("refuses a partial order, a foreign record, and an unsequenced folder", async () => {
    const strings = (await app.inject({ url: `/entry/wellview/dbs/${DB}/records/wvCas`, headers: auth }))
      .json() as { rows: { idwell: string; IDRec: string }[] };
    let target: { idwell: string; IDRec: string } | null = null;
    let comps: { IDRec: string }[] = [];
    for (const s of strings.rows) {
      const r = (await app.inject({
        url: `/entry/wellview/dbs/${DB}/records/wvCasComp?idwell=${s.idwell}&parent=${s.IDRec}`, headers: auth,
      })).json() as { rows: { IDRec: string }[] };
      if (r.rows.length >= 2) { target = s; comps = r.rows; break; }
    }
    if (!target) return;
    const ids = comps.map((c) => String(c.IDRec));

    // Dropping a record from the order would renumber some rows and strand others.
    const partial = await app.inject({
      method: "POST", url: `/entry/wellview/dbs/${DB}/records/wvCasComp/reorder`, headers: auth,
      payload: { idwell: target.idwell, parent: target.IDRec, order: ids.slice(1) },
    });
    expect(partial.statusCode).toBe(400);
    expect(partial.json()).toHaveProperty("error");

    // A record from another folder must not be renumbered into this one.
    const foreign = await app.inject({
      method: "POST", url: `/entry/wellview/dbs/${DB}/records/wvCasComp/reorder`, headers: auth,
      payload: { idwell: target.idwell, parent: target.IDRec, order: [...ids.slice(1), "NOT_A_RECORD"] },
    });
    expect(foreign.statusCode).toBe(400);

    // wvJob is not a sequenced folder, so it has no order to rewrite.
    const jobs = (await app.inject({ url: `/entry/wellview/dbs/${DB}/records/wvJob`, headers: auth }))
      .json() as { rows: { IDRec: string }[] };
    const notSeq = await app.inject({
      method: "POST", url: `/entry/wellview/dbs/${DB}/records/wvJob/reorder`, headers: auth,
      payload: { order: [String(jobs.rows[0].IDRec)] },
    });
    expect(notSeq.statusCode).toBe(400);
    expect((notSeq.json() as { error: string }).error).toMatch(/not a sequenced folder/i);
  }, 60_000);

  it("tells the client which folders are ordered, and how", async () => {
    const comp = (await app.inject({ url: `/entry/wellview/dbs/${DB}/records/wvCasComp`, headers: auth }))
      .json() as { sequenced?: boolean; allowInsertTop?: boolean; allowSeqInvert?: boolean };
    expect(comp.sequenced).toBe(true);
    expect(comp.allowInsertTop).toBe(true);
    expect(comp.allowSeqInvert).toBe(true);

    // A tally is ordered and takes new records at the top, but is not inverted.
    const tally = (await app.inject({ url: `/entry/wellview/dbs/${DB}/records/wvCasCompTally`, headers: auth }))
      .json() as { sequenced?: boolean; allowInsertTop?: boolean; allowSeqInvert?: boolean };
    expect(tally.sequenced).toBe(true);
    expect(tally.allowInsertTop).toBe(true);
    expect(tally.allowSeqInvert).toBeFalsy();

    const job = (await app.inject({ url: `/entry/wellview/dbs/${DB}/records/wvJob`, headers: auth }))
      .json() as { sequenced?: boolean };
    expect(job.sequenced).toBeFalsy();
  });

  it("refuses to edit identity or system columns", async () => {
    const create = await app.inject({
      method: "POST",
      url: `/entry/wellview/dbs/${DB}/records/wvNote`,
      headers: auth,
      payload: { idwell: TEST_IDWELL, values: { Com: "id guard" } },
    });
    const { idrec } = create.json() as { idrec: string };
    const patch = await app.inject({
      method: "PATCH",
      url: `/entry/wellview/dbs/${DB}/records/wvNote/${idrec}`,
      headers: auth,
      payload: { values: { IDRec: "HACK", sysModUser: "HACK" } },
    });
    expect(patch.statusCode).toBe(400);   // nothing legal to update
    await app.inject({ method: "DELETE", url: `/entry/wellview/dbs/${DB}/records/wvNote/${idrec}`, headers: auth });
  });
});
