/**
 * The fields that need a multi-line editor, and why it is data loss not comfort.
 *
 * Edit Data rendered every text cell as `<input type=text>`. That does not
 * merely truncate a long value on screen — the HTML value-sanitization
 * algorithm STRIPS carriage returns and line feeds from an input's value.
 * Measured in Chromium: "line one\r\nline two\nline three" comes back out as
 * "line oneline twoline three". So opening one of these cells and typing a
 * single character welds the paragraphs together, and the save writes the
 * flattened string back over the original.
 *
 * This pins the DATA the client's fix keys off: the model's own `stringlong`
 * type, which the API has always forwarded and which the cell editor had no
 * branch for. The rendering itself is checked in the browser, not here.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import Fastify, { type FastifyInstance } from "fastify";
import { registerWellviewDbRoutes } from "../routes/wellviewDb.js";
import { issueToken } from "../entry/auth.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..", "..");
const SAMPLE = join(ROOT, "sqlite_DB", "wellview", "wv9.0_Sample.sqlite");
const DB = "wv9.0_Sample";
const d = describe.skipIf(!existsSync(SAMPLE));

let app: FastifyInstance;
let auth: { Authorization: string };
let db: DatabaseSync;

beforeAll(async () => {
  app = Fastify();
  await registerWellviewDbRoutes(app);
  await app.ready();
  const { token } = issueToken({ id: "test", username: "vitest", role: "admin" });
  auth = { Authorization: `Bearer ${token}` };
  db = new DatabaseSync(SAMPLE, { readOnly: true });
});
afterAll(async () => { await app?.close(); db?.close(); });

d("long text fields", () => {
  it("are declared by the model, so the editor needs no heuristic", () => {
    const model = JSON.parse(readFileSync(
      join(ROOT, "apps", "web", "public", "wellview-templates", "datamodel.json"), "utf8"));
    let stringlong = 0, string = 0;
    for (const t of Object.values(model.tables) as { fields: Record<string, { type?: string }> }[]) {
      for (const f of Object.values(t.fields)) {
        if (f.type === "stringlong") stringlong++;
        else if (f.type === "string") string++;
      }
    }
    // The branch is driven by `stringlong` and must NOT be widened to `string`:
    // two thousand fields becoming textareas would make horizontal mode
    // unreadable, and none of them holds a paragraph.
    expect(stringlong).toBe(165);
    expect(string).toBeGreaterThan(2000);
  });

  it("reach the client with their type, which is what the fix keys off", async () => {
    const res = await app.inject({
      url: `/entry/wellview/dbs/${DB}/query-fields?table=wvJobReportTimeLog`, headers: auth,
    });
    expect(res.statusCode).toBe(200);
    const { fields } = res.json() as { fields: { field: string; type?: string }[] };
    const com = fields.find((f) => f.field.toLowerCase() === "com");
    expect(com, "the time log has a Comment column").toBeTruthy();
    expect(com!.type).toBe("stringlong");
  });

  it("really do hold newlines this database would lose", () => {
    // The measurement that makes this data loss rather than ergonomics.
    const model = JSON.parse(readFileSync(
      join(ROOT, "apps", "web", "public", "wellview-templates", "datamodel.json"), "utf8"));
    const longCols: { table: string; col: string }[] = [];
    for (const [tk, t] of Object.entries(model.tables) as [string, { fields: Record<string, { type?: string }> }][]) {
      for (const [fk, f] of Object.entries(t.fields)) {
        if (f.type === "stringlong") longCols.push({ table: tk, col: fk });
      }
    }
    let withNewlines = 0;
    const perTable = new Map<string, number>();
    for (const { table, col } of longCols) {
      try {
        const r = db.prepare(
          `SELECT COUNT(*) c FROM "${table}" WHERE "${col}" LIKE '%' || char(10) || '%'
             OR "${col}" LIKE '%' || char(13) || '%'`).get() as { c: number };
        if (r.c) { withNewlines += r.c; perTable.set(table, (perTable.get(table) ?? 0) + r.c); }
      } catch { /* the converted database does not carry this column */ }
    }
    expect(withNewlines, "stored values carrying a line break").toBeGreaterThan(800);
    // The most-edited folder in the product is also the worst affected.
    expect(perTable.get("wvjobreporttimelog") ?? 0).toBeGreaterThan(500);
  }, 120_000);

  it("include the longest value in the database", () => {
    const r = db.prepare("SELECT MAX(LENGTH(Com)) n FROM wvJobReportTimeLog").get() as { n: number };
    expect(r.n).toBe(1819);
    // …which a 7rem single-line input showed about thirty characters of.
  });
});

/**
 * The 100-CHARACTER RULE — 9.0's own, and the last hole in the branch above.
 *
 * Edit Data Enhancements: "Text fields that are 100 characters or more can now
 * function as a comments field that opens to a larger edit window." The model
 * states that length as `physicalsize`, and the data-model builder used to drop
 * it, so nothing downstream could tell a 10-character code from a 255-character
 * note.
 */
describe("the comments-field rule", () => {
  const model = JSON.parse(readFileSync(
    join(ROOT, "apps", "web", "public", "wellview-templates", "datamodel.json"), "utf8"),
  ) as { tables: Record<string, { fields: Record<string, { type?: string; size?: number }> }> };

  /** The same predicate the grid uses, kept here so the rule has one statement. */
  const isCommentsField = (f: { type?: string; size?: number }) =>
    f.type === "stringlong" || (f.type === "string" && (f.size ?? 0) >= 100);

  it("carries the declared length of every text field", () => {
    let sized = 0;
    let strings = 0;
    for (const t of Object.values(model.tables)) {
      for (const f of Object.values(t.fields)) {
        if (f.type !== "string") continue;
        strings++;
        if (typeof f.size === "number" && f.size > 0) sized++;
      }
    }
    expect(strings).toBeGreaterThan(2000);
    // Every one of them: a missing length would silently read as "short".
    expect(sized).toBe(strings);
  });

  it("takes in the one newline-holding column that is not stringlong", () => {
    /*
     * 25 columns in the sample hold a value with a newline in it. 24 are
     * stringlong and were already safe. The twenty-fifth is this one — a
     * `string` of 255 — and an <input type=text> strips the newline out of it.
     */
    const f = model.tables["wvproblem"].fields.actiontaken;
    expect(f.type).toBe("string");
    expect(f.size).toBe(255);
    expect(isCommentsField(f)).toBe(true);
  });

  it("does not swallow every short field with it", () => {
    // A 50-character name in a textarea makes horizontal mode unreadable for
    // no gain, so the rule is the guide's number and not "all text".
    const all = Object.values(model.tables)
      .flatMap((t) => Object.values(t.fields))
      .filter((f) => f.type === "string");
    const wide = all.filter(isCommentsField);
    expect(wide.length).toBeGreaterThan(150);
    expect(wide.length).toBeLessThan(all.length / 4);
    // A named short one, for a case anybody can check by hand.
    const operator = model.tables["wvwellheader"].fields.operator;
    expect(operator.size).toBe(50);
    expect(isCommentsField(operator)).toBe(false);

    /*
     * And a consequence of following the guide's number rather than taste:
     * wvWellHeader.WellName is declared as exactly 100, so it IS a comments
     * field. Recorded rather than special-cased — "100 characters or more" is
     * the rule the vendor states, and a one-row textarea reads the same as an
     * input until it is focused.
     */
    expect(model.tables["wvwellheader"].fields.wellname.size).toBe(100);
    expect(isCommentsField(model.tables["wvwellheader"].fields.wellname)).toBe(true);
  });
});
