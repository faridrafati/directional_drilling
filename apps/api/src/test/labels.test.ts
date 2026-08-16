/**
 * Table headers must read as WellView reads them.
 *
 * WHY THIS EXISTS
 * ---------------
 * Report and grid headers used to print the .afr's capitalised column name —
 * "Idrecparent", "Wellboreida", "Profiletyp" — because the only caption source
 * was a name heuristic over the column string. Captions now come from
 * WellView's own data model (`Peloton.WellView.mdl.xml` → datamodel.json).
 *
 * The invariant pinned here is not "captions look nice" (unfalsifiable) but
 * "every caption the API serves for a modelled field IS the model's caption".
 * A heuristic creeping back in breaks that exactly.
 *
 * Skips cleanly when the converted database or the data model is absent.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Fastify, { type FastifyInstance } from "fastify";
import { registerWellviewDbRoutes } from "../routes/wellviewDb.js";
import { issueToken } from "../entry/auth.js";
import { columnLabel, folderLabel, modelField, modelLoaded, modelTable } from "../wellview/model.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..", "..", "..");
const SAMPLE = join(REPO, "sqlite_DB", "wellview", "wv9.0_Sample.sqlite");
const DATAMODEL = join(REPO, "apps", "web", "public", "wellview-templates", "datamodel.json");
const DB = "wv9.0_Sample";

const ready = existsSync(SAMPLE) && modelLoaded();
const d = describe.skipIf(!ready);

let app: FastifyInstance;
let auth: { Authorization: string };

beforeAll(async () => {
  app = Fastify();
  await registerWellviewDbRoutes(app);
  await app.ready();
  auth = { Authorization: `Bearer ${issueToken({ id: "t", username: "vitest", role: "admin" }).token}` };
});
afterAll(async () => { await app?.close(); });

d("column captions come from WellView's data model", () => {
  it("captions the columns from the report that exposed the bug", () => {
    // Was: "Idrecparent", "Wellboreida", "Profiletyp", table shown as "wvWellbore".
    expect(columnLabel("wvWellbore", "idrecparent", ["wvWellbore"])).toBe("Parent Wellbore");
    // …and without link context too: a self-parent names its own table.
    expect(columnLabel("wvWellbore", "idrecparent")).toBe("Parent Wellbore");
    expect(columnLabel("wvWellbore", "wellboreida")).toBe("Wellbore API/UWI");
    expect(columnLabel("wvWellbore", "profiletyp")).toBe("Profile Type");
    expect(columnLabel("wvWellbore", "des")).toBe("Wellbore Name");
    // A folder holds many records, so it carries the model's plural caption.
    expect(folderLabel("wvWellbore", null)).toBe("Wellbores");
    expect(folderLabel("wvCasComp", "wvCas")).toBe("Casing Components");
    // Folders the hand-written map never covered now read properly too.
    expect(folderLabel("wvWellTestPresTrav", null)).toBe("Pressure Survey Tests");
    expect(folderLabel("wvCoreSideWall", null)).toBe("Sidewall Cores");
  });

  it("never leaks a caption placeholder, across every table in the model", () => {
    const model = JSON.parse(readFileSync(DATAMODEL, "utf8")) as
      { tables: Record<string, { fields: Record<string, unknown> }> };
    const leaks: string[] = [];
    for (const [tn, t] of Object.entries(model.tables)) {
      for (const col of Object.keys(t.fields)) {
        // Resolved with no link target — the worst case for the <capl> substitution.
        const label = columnLabel(tn, col);
        if (/[<>]/.test(label)) leaks.push(`${tn}.${col} = ${label}`);
      }
    }
    expect(leaks, leaks.slice(0, 20).join("\n")).toEqual([]);
  });

  it("serves the model's caption for every modelled column of every subject area", async () => {
    const tree = ((await app.inject({ url: `/entry/wellview/dbs/${DB}/tree`, headers: auth })).json() as
      { tree: { table: string; children: unknown[] }[] }).tree;
    const tables: string[] = [];
    const walk = (nodes: { table: string; children: { table: string; children: unknown[] }[] }[]) => {
      for (const n of nodes) { tables.push(n.table); walk(n.children as never); }
    };
    walk(tree as never);
    expect(tables.length).toBeGreaterThan(150);

    const bad: string[] = [];
    for (const t of tables) {
      const body = (await app.inject({ url: `/entry/wellview/dbs/${DB}/records/${t}?system=1`, headers: auth }))
        .json() as { label: string; columns: { column: string; label: string }[] };

      const mt = modelTable(t);
      if (mt) {
        // A folder may keep the training guide's wording; anything else is the
        // model's plural caption.
        const manualOverrides = ["Well Header (General)", "Daily Operations", "Daily Costs",
          "Drill Strings / BHA", "BHA Components", "Unscheduled Events", "AFE / WBS"];
        const expected = mt.labelPlural || mt.label;
        if (body.label !== expected && !manualOverrides.includes(body.label)) {
          bad.push(`folder ${t}: "${body.label}" != model "${expected}"`);
        }
      }
      for (const c of body.columns) {
        if (!c.label) { bad.push(`${t}.${c.column} has no caption`); continue; }
        if (/[<>]/.test(c.label)) { bad.push(`${t}.${c.column} = ${c.label} (placeholder)`); continue; }
        const mf = modelField(t, c.column);
        if (mf && !mf.label.includes("<capl>") && c.label !== mf.label) {
          bad.push(`${t}.${c.column} = "${c.label}" but the model says "${mf.label}"`);
        }
      }
    }
    expect(bad, bad.slice(0, 25).join("\n")).toEqual([]);
  }, 120_000);

  it("captions the fields the report templates print, not the .afr's column text", async () => {
    const wells = ((await app.inject({ url: `/entry/wellview/dbs/${DB}/wells`, headers: auth })).json() as
      { wells: { idwell: string }[] }).wells;
    const reports = JSON.parse(readFileSync(
      join(REPO, "apps", "web", "public", "wellview-templates", "reports.json"), "utf8")) as
      { reports: { html: string }[] };

    const bad: string[] = [];
    let checked = 0;
    for (const r of reports.reports.filter((_, i) => i % 9 === 0)) {
      const res = await app.inject({
        url: `/entry/wellview/dbs/${DB}/template-data?html=${encodeURIComponent(r.html)}&well=${wells[0].idwell}`,
        headers: auth,
      });
      if (res.statusCode !== 200) continue;
      const body = res.json() as {
        blocks: { table: string | null; title: string | null; columns?: { column: string; label: string }[] }[];
      };
      for (const b of body.blocks) {
        // A block with a table always gets a heading — never the bare table name twice.
        if (b.table && !b.title) bad.push(`${r.html}: block on ${b.table} has no heading`);
        for (const c of b.columns ?? []) {
          checked++;
          if (/[<>]/.test(c.label)) { bad.push(`${b.table}.${c.column} = ${c.label} (placeholder)`); continue; }
          const mf = b.table ? modelField(b.table, c.column) : undefined;
          if (mf && !mf.label.includes("<capl>") && c.label !== mf.label) {
            bad.push(`${b.table}.${c.column} = "${c.label}" but the model says "${mf.label}"`);
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(200);
    expect(bad, bad.slice(0, 25).join("\n")).toEqual([]);
  }, 120_000);

  it("declares physical types so the grid can pick an editor", async () => {
    const cols = ((await app.inject({ url: `/entry/wellview/dbs/${DB}/records/wvWellHeader`, headers: auth }))
      .json() as { columns: { column: string; type?: string }[] }).columns;
    expect(cols.filter((c) => c.type).length).toBeGreaterThan(cols.length / 2);
    expect(cols.find((c) => c.column === "DtTmSpud")?.type).toBe("datetime");
    expect(cols.find((c) => c.column === "Operated")?.type).toBe("boolean");
    expect(cols.find((c) => c.column === "ElvOrigKB")?.type).toBe("double");
  });

  /**
   * A report printing a record-LINK column showed its 32-hex key. WellView
   * prints the record instead, so the resolver renders the linked record's
   * caption — "Rig Supervisor" reads "John Aslakson", not a GUID.
   */
  it("prints the linked record in a report, never its key", async () => {
    const wells = ((await app.inject({ url: `/entry/wellview/dbs/${DB}/wells`, headers: auth })).json() as
      { wells: { idwell: string; WellName: string }[] }).wells;
    const reports = JSON.parse(readFileSync(
      join(REPO, "apps", "web", "public", "wellview-templates", "reports.json"), "utf8")) as
      { reports: { html: string }[] };

    const guids: string[] = [];
    let linkCellsSeen = 0;
    for (const w of wells.slice(0, 6)) {
      for (const r of reports.reports.filter((_, i) => i % 11 === 0)) {
        const res = await app.inject({
          url: `/entry/wellview/dbs/${DB}/template-data?html=${encodeURIComponent(r.html)}&well=${w.idwell}`,
          headers: auth,
        });
        if (res.statusCode !== 200) continue;
        const body = res.json() as {
          blocks: { table: string | null; columns?: { column: string }[]; rows?: (string | number | null)[][] }[];
        };
        for (const b of body.blocks) {
          const linkIx = (b.columns ?? [])
            .map((c, i) => ({ c, i }))
            .filter(({ c }) => /^idrec./i.test(c.column) && !/tk$/i.test(c.column)
              && !["idrec", "idrecparent"].includes(c.column.toLowerCase()));
          for (const row of b.rows ?? []) {
            for (const { i } of linkIx) {
              const v = row[i];
              if (v == null || v === "") continue;
              linkCellsSeen++;
              if (/^[0-9A-F]{32}$/i.test(String(v))) guids.push(`${b.table}.${b.columns![i].column} = ${v}`);
            }
          }
        }
      }
    }
    expect(linkCellsSeen).toBeGreaterThan(0);
    expect(guids, guids.slice(0, 10).join("\n")).toEqual([]);
  }, 120_000);

  /**
   * §4.3: "Well information fields in yellow are required." Which ones is not a
   * judgement call — Chevron ships the list as INI beside the application
   * (Data Entry Audit / SimpleFieldDataEntryAuditRules.ini).
   */
  it("marks the fields Chevron's own rules require", async () => {
    const cas = (await app.inject({ url: `/entry/wellview/dbs/${DB}/records/wvCas`, headers: auth }))
      .json() as { columns: { column: string; required?: boolean }[] };
    const required = cas.columns.filter((c) => c.required).map((c) => c.column.toLowerCase()).sort();
    expect(required).toEqual(["depthbtm", "des", "dttmrun"]);

    const hdr = (await app.inject({ url: `/entry/wellview/dbs/${DB}/records/wvWellHeader`, headers: auth }))
      .json() as { columns: { column: string; required?: boolean }[] };
    expect(hdr.columns.filter((c) => c.required).map((c) => c.column.toLowerCase()).sort())
      .toEqual(["wellida", "wellname"]);
  });

  /**
   * §4.3's third cue: "fields in cyan are required global metrics". Nothing
   * shipped states which those are, so the list was read off the guide's own
   * screenshots and curated with provenance — these are spot checks that the
   * flags reach the client on the fields those figures show.
   */
  it("marks the required global metrics the guide's figures show", async () => {
    const job = (await app.inject({ url: `/entry/wellview/dbs/${DB}/records/wvJob`, headers: auth }))
      .json() as { columns: { column: string; globalMetric?: boolean; required?: boolean }[] };
    const gm = job.columns.filter((c) => c.globalMetric).map((c) => c.column.toLowerCase()).sort();
    // Job Setup input report, figures p097_093 / p100_094.
    expect(gm).toEqual(["dttmend", "dttmspud", "dttmstart", "dttmstartplan", "jobtyp", "wvtyp"]);

    const bore = (await app.inject({ url: `/entry/wellview/dbs/${DB}/records/wvWellbore`, headers: auth }))
      .json() as { columns: { column: string; globalMetric?: boolean }[] };
    expect(bore.columns.find((c) => c.column === "ProfileTyp")?.globalMetric).toBe(true);

    const hdr = (await app.inject({ url: `/entry/wellview/dbs/${DB}/records/wvWellHeader`, headers: auth }))
      .json() as { columns: { column: string; globalMetric?: boolean }[] };
    expect(hdr.columns.filter((c) => c.globalMetric).map((c) => c.column).sort())
      .toEqual(["ElvMudLine", "WaterDepth"]);

    // The two flags come from independent sources and legitimately overlap:
    // Chevron's INI requires Job Category, Primary Job Type and Start Date, and
    // the guide's figure additionally paints them cyan. Both agree they are
    // mandatory; cyan just says WHY. The client shows cyan when both are set.
    const both = job.columns.filter((c) => c.globalMetric && c.required)
      .map((c) => c.column.toLowerCase()).sort();
    expect(both).toEqual(["dttmstart", "jobtyp", "wvtyp"]);
  });

  /** "Phases are a Global Metric required entry. There must be at least one
   *  phase for each job." — the guide states it twice; the auditor enforces it. */
  it("audits the job-phase global-metric rule", async () => {
    const res = (await app.inject({ url: `/entry/wellview/dbs/${DB}/audit`, headers: auth }))
      .json() as { findings: { ruleId: string; rule: string }[]; skipped: { ruleId: string }[] };
    expect(res.skipped.map((s) => s.ruleId)).not.toContain("job-no-phase");
    const hits = res.findings.filter((f) => f.ruleId === "job-no-phase");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].rule).toMatch(/Global Metric/i);
  }, 60_000);

  /** The entry form's sections, as the guide's Well Header exercise prints them. */
  it("groups a table's fields into WellView's form sections", async () => {
    const hdr = (await app.inject({ url: `/entry/wellview/dbs/${DB}/records/wvWellHeader`, headers: auth }))
      .json() as { fieldGroups?: string[]; columns: { column: string; group?: string }[] };
    expect(hdr.fieldGroups?.slice(0, 4))
      .toEqual(["Well Identifiers", "Well License", "Well Classification", "Elevations"]);
    expect(hdr.columns.find((c) => c.column === "WellName")?.group).toBe("Well Identifiers");
    expect(hdr.columns.find((c) => c.column === "ElvOrigKB")?.group).toBe("Elevations");
    // most user fields land in a section
    const placed = hdr.columns.filter((c) => c.group).length;
    expect(placed).toBeGreaterThan(hdr.columns.length / 2);
  });

  /**
   * The model marks 1,810 fields calculated (WellView's print-time TVD, NS/EW,
   * dogleg …). None of them are STORED — the converted databases do not carry
   * the columns at all, which is the same fact the app already reports for the
   * wv*calc tables. The read-only guard exists so a database that does carry
   * them cannot be edited into disagreeing with WellView.
   */
  it("knows which fields WellView computes, and none are stored here", async () => {
    const model = JSON.parse(readFileSync(DATAMODEL, "utf8")) as
      { tables: Record<string, { fields: Record<string, { calculated?: boolean }> }> };
    const calcCount = Object.values(model.tables)
      .reduce((n, t) => n + Object.values(t.fields).filter((f) => f.calculated).length, 0);
    expect(calcCount).toBeGreaterThan(1000);

    const survey = (await app.inject({
      url: `/entry/wellview/dbs/${DB}/records/wvWellboreDirSurveyData?system=1`, headers: auth,
    })).json() as { columns: { column: string; calculated?: boolean }[] };
    // Stored columns are the inputs (md, inclination, azimuth), not the results.
    expect(survey.columns.some((c) => c.column.toLowerCase() === "inclination")).toBe(true);
    expect(survey.columns.filter((c) => c.calculated)).toEqual([]);
  });
});
