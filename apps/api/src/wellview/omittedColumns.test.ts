/**
 * A column a report drops says so, and says why.
 *
 * `resolveTemplateData` always computed which columns it could not fill and
 * always returned the list. `PrintReport` never rendered it. So a printed sheet
 * came out one column narrower than the desktop's with nothing on the page to
 * say a column had ever been there.
 *
 * The one label that did exist — "Not in this database", on the multi-well
 * screen — was wrong for every column it was ever shown under. The model says
 * what they are: of the 346 distinct columns the 182 shipped templates drop,
 * 251 carry `calculated: true` (WellView works the value out when the report
 * prints and stores it nowhere) and NOT ONE is a stored column this database
 * lacks. The remaining 88 are fields the model does not put on that table.
 *
 * Those first two numbers FALL as fields are taught — they were 350 and 262
 * when this landed, before "most recent child by date" filled five of them.
 *
 * This is the smallest item in Tier 3 and the one that matters most: it turns
 * every other blank column in the tier from silent into visible.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { resolveTemplateData } from "../routes/wellviewSample.js";
import { classifyOmitted, omittedSummary } from "./omitted.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..", "..");
const SAMPLE = join(ROOT, "sqlite_DB", "wellview", "wv9.0_Sample.sqlite");
const TEMPLATES = join(ROOT, "apps", "web", "public", "wellview-templates");
const d = describe.skipIf(!existsSync(SAMPLE));

interface Block {
  table: string | null;
  rows?: (string | number | null)[][];
  missing?: string[];
  omitted?: { column: string; label: string; calculated: boolean; note?: string }[];
  omittedNote?: string;
}

let db: DatabaseSync;
let wells: string[];
let ids: string[];

beforeAll(() => {
  db = new DatabaseSync(SAMPLE, { readOnly: true });
  wells = (db.prepare("SELECT idwell FROM wvWellHeader").all() as { idwell: string }[])
    .map((w) => w.idwell);
  ids = (JSON.parse(readFileSync(join(TEMPLATES, "reports.json"), "utf8"))
    .reports as { html: string }[]).map((r) => r.html);
});

let _blocks: { html: string; block: Block }[] | null = null;

/**
 * Every block of every shipped template, resolved against one well.
 *
 * Memoised: resolving 182 templates takes seconds and is deterministic, and six
 * tests want the same answer. Without this the file alone ran for eight minutes.
 */
function allBlocks(): { html: string; block: Block }[] {
  if (_blocks) return _blocks;
  const out: { html: string; block: Block }[] = [];
  for (const html of ids) {
    let r;
    try { r = resolveTemplateData(db, html, wells[0]); } catch { continue; }
    if (!r) continue;
    for (const b of r.blocks as Block[]) out.push({ html, block: b });
  }
  _blocks = out;
  return out;
}

d("a dropped column is explained rather than silently absent", () => {
  it("is not a rare case — 112 of 182 templates print one", () => {
    // These counts are a MEASUREMENT of how much this app cannot yet fill, so
    // they fall as fields become computable: 116 templates / 276 blocks / 350
    // columns when this landed; 112 / 271 / 339 after the shapes taught since:
    // most-recent-child, bit nozzles, bare sums, linked lookups. DOWN is progress;
    // up means a regression, which is why each is pinned exactly rather than as
    // a bound.
    const blocks = allBlocks();
    const withDrop = blocks.filter((b) => b.block.missing?.length);
    const tpls = new Set(withDrop.map((b) => b.html));
    const cols = new Set(withDrop.flatMap((b) => b.block.missing!.map((c) => `${b.block.table}.${c}`)));

    expect(blocks.length, "blocks across the shipped templates").toBe(738);
    expect(withDrop.length, "blocks dropping at least one column").toBe(271);
    expect(tpls.size, "templates dropping at least one column").toBe(112);
    expect(cols.size, "distinct table.column dropped").toBe(339);
  }, 300_000);

  it("explains every one of them — none can be dropped without a reason", () => {
    // The invariant that keeps the two lists honest: `omitted` is derived from
    // `missing`, so a column can never appear in the blank set and be left out
    // of the explanation.
    for (const { html, block } of allBlocks()) {
      const missing = block.missing ?? [];
      const omitted = block.omitted ?? [];
      expect(omitted.map((o) => o.column), `${html} / ${block.table}`).toEqual(missing);
      if (missing.length) expect(block.omittedNote, `${html} note`).toBeTruthy();
    }
  }, 300_000);

  it('proves "not in this database" was true of none of them', () => {
    // The claim the old label made, measured. If any dropped column were a
    // stored column the database lacks, it would show up here. The calculated
    // count falls as fields are taught: 262 when this landed, 258 after the
    // five "most recent child" fields.
    const model = JSON.parse(readFileSync(join(TEMPLATES, "datamodel.json"), "utf8"));
    const field = (t: string, c: string) => {
      const tk = Object.keys(model.tables).find((k) => k.toLowerCase() === t.toLowerCase());
      if (!tk) return null;
      const fs = model.tables[tk].fields;
      const fk = Object.keys(fs).find((k) => k.toLowerCase() === c.toLowerCase());
      return fk ? fs[fk] : null;
    };

    const seen = new Map<string, { table: string; column: string }>();
    for (const { block } of allBlocks()) {
      for (const c of block.missing ?? []) {
        seen.set(`${block.table}.${c}`.toLowerCase(), { table: block.table!, column: c });
      }
    }
    let calculated = 0, storedButAbsent = 0, notAFieldOfThatTable = 0;
    for (const { table, column } of seen.values()) {
      const f = field(table, column);
      if (f == null) notAFieldOfThatTable++;
      else if (f.calculated === true) calculated++;
      else storedButAbsent++;
    }
    expect(calculated, "WellView calculates these at print time").toBe(251);
    expect(storedButAbsent, "stored columns this database lacks").toBe(0);
    expect(notAFieldOfThatTable, "not a field of that table in the model").toBe(88);
  }, 300_000);

  it("names the calculated ones by their caption, not their column name", () => {
    // "AFE Number" is what the reader sees in the header; "afenumbercalc" is
    // not. A note that names the column tells them nothing about which of the
    // headings above it went blank.
    const om = classifyOmitted([{ column: "afenumbercalc", table: "wvJob" }]);
    expect(om[0].label).toBe("AFE Number");
    expect(om[0].calculated).toBe(true);
    // The model's help IS the equation, so it can be shown as the reason.
    expect(om[0].note).toContain("wvJobAFE.AFENumber");

    const note = omittedSummary(om)!;
    expect(note).toContain("AFE Number");
    expect(note).toContain("WellView calculates");
    expect(note).not.toContain("not in this database");
  });

  it("does not call an unknown column calculated", () => {
    // The 88 get a different sentence, because a different thing is true of
    // them and this app does not know which.
    const om = classifyOmitted([{ column: "platform", table: "wvJob" }]);
    expect(om[0].calculated).toBe(false);
    const note = omittedSummary(om)!;
    expect(note).toContain("not a field of this table");
    expect(note).not.toContain("WellView calculates");
  });

  it('never says "blank below" when nothing is drawn below', () => {
    // The sentence points at a table. A block that lost every column, or that
    // prints "No rows.", draws no table — so the line names the columns and
    // stops rather than pointing at something that is not there.
    const om = classifyOmitted([{ column: "afenumbercalc", table: "wvJob" }]);
    expect(omittedSummary(om, true)).toContain("blank below");
    expect(omittedSummary(om, false)).not.toContain("below");
    expect(omittedSummary(om, false)).toContain("AFE Number");

    // The API picks the right one per block. Both forms occur in the sample.
    // What matters is whether ROWS ARE DRAWN, not rowCount: a block can count
    // rows and still draw none, when every printed column is empty on all of
    // them (`allNull`). That case renders a sentence, not a table.
    const dropped = allBlocks().filter(({ block }) => (block.missing ?? []).length > 0);
    const draws = ({ block }: { block: Block }) => (block.rows?.length ?? 0) > 0;
    const withRows = dropped.filter(draws);
    const withoutRows = dropped.filter((b) => !draws(b));
    expect(withRows.length, "blocks that drop a column AND draw rows").toBeGreaterThan(0);
    expect(withoutRows.length, "blocks that drop a column and draw nothing").toBeGreaterThan(0);
    for (const { html, block } of withRows) {
      expect(block.omittedNote, `${html} draws rows`).toContain("blank below");
    }
    for (const { html, block } of withoutRows) {
      expect(block.omittedNote, `${html} draws nothing`).not.toContain("below");
    }
  }, 300_000);

  it("says nothing at all when nothing was dropped", () => {
    expect(omittedSummary([])).toBeUndefined();
    const clean = allBlocks().find(({ block }) => !(block.missing ?? []).length);
    expect(clean, "a block that drops nothing exists").toBeTruthy();
    expect(clean!.block.omitted ?? []).toEqual([]);
    expect(clean!.block.omittedNote).toBeUndefined();
  }, 300_000);

  it("Daily Drilling, the most-used sheet, drops 27 and names them all", () => {
    const r = resolveTemplateData(db, "Drilling/Daily Input/Daily Drilling.html", wells[0])!;
    const cols = new Set((r.blocks as Block[])
      .flatMap((b) => (b.missing ?? []).map((c) => `${b.table}.${c}`)));
    expect(cols.size).toBe(27);
    for (const b of r.blocks as Block[]) {
      if (!(b.missing ?? []).length) continue;
      expect(b.omittedNote).toBeTruthy();
      // Every dropped column is named in the line the sheet prints.
      for (const o of b.omitted!) {
        expect(b.omittedNote).toContain(o.calculated ? o.label : o.column);
      }
    }
  });
});
