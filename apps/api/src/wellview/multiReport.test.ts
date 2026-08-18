/**
 * Multi-well reports, over the real sample database.
 *
 * The risk unique to this surface is scope: one wrong predicate turns "the
 * three wells I picked" into "every well in the database", and the result still
 * looks like a report. So these check the well set is honoured exactly, that an
 * empty selection returns nothing rather than everything, and that each row can
 * be traced to a well.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { resolveMultiTemplate, type MultiTemplate } from "./multiReport.js";

type Listed = MultiTemplate & { master?: boolean };

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..", "..", "..");
const SAMPLE = join(REPO, "sqlite_DB", "wellview", "wv9.0_Sample.sqlite");
const JSON_PATH = join(REPO, "apps", "web", "public", "wellview-templates", "reports-multi.json");
const ready = existsSync(SAMPLE) && existsSync(JSON_PATH);
const d = describe.skipIf(!ready);

d("multi-well reports", () => {
  let db: DatabaseSync;
  let templates: Listed[];
  let wells: string[];

  beforeAll(() => {
    db = new DatabaseSync(SAMPLE, { readOnly: true });
    templates = JSON.parse(readFileSync(JSON_PATH, "utf-8")).reports as Listed[];
    wells = (db.prepare("SELECT idwell FROM wvWellHeader ORDER BY WellName LIMIT 3").all() as
      { idwell: string }[]).map((r) => r.idwell);
  });

  it("extracted every shipped .afm template", () => {
    expect(templates.length).toBe(57);
    // Three are Master Templates — the page layout every other .afm inherits.
    // They are kept and marked rather than dropped; the rest must all print
    // something, or the extraction silently lost a block.
    const runnable = templates.filter((t) => !t.master);
    expect(runnable.length).toBe(54);
    expect(runnable.every((t) => t.blocks.length > 0)).toBe(true);
    // The three that predate v3.0 are present and marked, not dropped.
    const legacy = templates.filter((t) => t.format_version === 2);
    expect(legacy.map((t) => t.name).sort()).toEqual(["Task Summary", "Tasks - Incomplete"]);
  });

  it("every template resolves against the sample database without throwing", () => {
    const failures: string[] = [];
    for (const t of templates) {
      try { resolveMultiTemplate(db, t, wells); }
      catch (e) { failures.push(`${t.name}: ${(e as Error).message}`); }
    }
    expect(failures).toEqual([]);
  });

  it("returns rows only for the wells asked for", () => {
    const tpl = templates.find((t) => t.name === "Job Summary")!;
    const one = resolveMultiTemplate(db, tpl, [wells[0]]);
    const three = resolveMultiTemplate(db, tpl, wells);
    const rowsOf = (r: ReturnType<typeof resolveMultiTemplate>) =>
      r.blocks.reduce((a, b) => a + b.rowCount, 0);
    expect(rowsOf(one)).toBeGreaterThan(0);
    // More wells cannot mean fewer rows, and must mean more here.
    expect(rowsOf(three)).toBeGreaterThan(rowsOf(one));

    // …and never every well in the database.
    const all = (db.prepare("SELECT COUNT(*) c FROM wvJob").get() as { c: number }).c;
    expect(rowsOf(three)).toBeLessThan(all);
  });

  it("an empty selection returns nothing, not everything", () => {
    // The failure that would be invisible: no wells picked, and the report
    // quietly summarises the whole database.
    const tpl = templates.find((t) => t.name === "Job Summary")!;
    const none = resolveMultiTemplate(db, tpl, []);
    expect(none.wells).toBe(0);
    expect(none.blocks.every((b) => b.rowCount === 0)).toBe(true);
    expect(none.blocks.every((b) => b.rows.length === 0)).toBe(true);
  });

  it("names the well on every row, so a list spanning wells can be read", () => {
    const tpl = templates.find((t) => t.name === "Bit Performance")!;
    const r = resolveMultiTemplate(db, tpl, wells);
    const b = r.blocks.find((x) => x.rowCount > 0);
    expect(b, "Bit Performance should return rows for these wells").toBeTruthy();
    const names = b!.columns.filter((c) => c.column === "__wellname" || /wellname/i.test(c.column));
    expect(names.length, "a well column must be present").toBeGreaterThan(0);
    const idx = b!.columns.findIndex((c) => c.column === names[0].column);
    expect(b!.rows.every((row) => row[idx] != null && String(row[idx]).length > 0)).toBe(true);
  });

  it("tells a print-time column apart from a template that predates the schema", () => {
    // Two different facts that both look like "column missing". Bit
    // Performance is a CURRENT template whose blank columns are wv*calc values
    // WellView computes when printing; Task Summary is a 2006 template whose
    // columns the schema has never had. Calling the first an old schema would
    // be a confident, plausible, wrong explanation.
    const bit = resolveMultiTemplate(db, templates.find((t) => t.name === "Bit Performance")!, wells);
    const bitBlock = bit.blocks.find((b) => b.missing.length > 0)!;
    expect(bitBlock.printTimeNote, "should be explained as print-time").toMatch(/computed by WellView/);
    expect(bitBlock.schemaDrift, "must NOT be blamed on an old schema").toBeUndefined();

    const task = resolveMultiTemplate(db, templates.find((t) => t.name === "Task Summary")!, wells);
    const drifted = task.blocks.filter((b) => b.schemaDrift);
    expect(drifted.length).toBeGreaterThan(0);
    expect(drifted[0].schemaDrift).toMatch(/earlier version of WellView/);
  });

  it("says so when a template predates the schema instead of printing a blank grid", () => {
    // Task Summary is a 2006 v2.0 template: its wvTask columns (status,
    // dttmrequest, requestbyname…) do not exist in WellView 9. An empty table
    // would read as "this asset has no tasks", which is a different claim.
    const tpl = templates.find((t) => t.name === "Task Summary")!;
    const r = resolveMultiTemplate(db, tpl, wells);
    const drifted = r.blocks.filter((b) => b.schemaDrift);
    expect(drifted.length).toBeGreaterThan(0);
    expect(drifted[0].schemaDrift).toMatch(/earlier version of WellView/);
    expect(drifted[0].missing.length).toBeGreaterThan(0);
  });
});
