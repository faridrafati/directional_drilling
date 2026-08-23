/**
 * The order a folder's records come back in — as the MODEL declares it.
 *
 * Distinct from `recordOrder.test.ts` next door, which pins that a NEW record
 * is given the next `sysSeq` so it lands at the end of its folder. This one is
 * about the order an EXISTING folder is read in.
 *
 * The data model states it — `sqlOrderBy` on 264 of the 357 tables — and the
 * app was ignoring all 264. `build_datamodel.mjs` extracted the attribute,
 * datamodel.json stored it, and nothing ever read it, so every folder was
 * ordered by a heuristic guess instead.
 *
 * The guess failed worst where it mattered most. `wvWellboreDirSurveyData`
 * declares `md`, but it also carries `DtTm` on 1,586 of its 2,019 rows, so the
 * heuristic reached for the date and a 371-station survey came back
 * 33.94, 42.93, 244.53, 152.75, 97.80 — a depth list in no depth order. The
 * help is explicit: "The survey data records are arranged in order of the
 * Measured Depth (MD)."
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Fastify, { type FastifyInstance } from "fastify";
import { DatabaseSync } from "node:sqlite";
import { registerWellviewDbRoutes } from "../routes/wellviewDb.js";
import { issueToken } from "../entry/auth.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..", "..", "..");
const SAMPLE = join(REPO, "sqlite_DB", "wellview", "wv9.0_Sample.sqlite");
const MODEL = join(REPO, "apps", "web", "public", "wellview-templates", "datamodel.json");
const DB = "wv9.0_Sample";

const hasAll = existsSync(SAMPLE) && existsSync(MODEL);
const d = describe.skipIf(!hasAll);

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

interface Records { columns: { column: string }[]; rows: Record<string, unknown>[] }
const records = async (table: string, q: string) => {
  const res = await app.inject({ url: `/entry/wellview/dbs/${DB}/records/${table}?${q}`, headers: auth });
  expect(res.statusCode).toBe(200);
  return res.json() as Records;
};

d("a folder reads in the order the model declares", () => {
  it("puts survey stations in measured-depth order", async () => {
    const raw = new DatabaseSync(SAMPLE, { readOnly: true });
    // The richest survey in the sample, and the one that read as nonsense.
    const parent = raw.prepare(`
      SELECT IDRecParent AS p, COUNT(*) n FROM wvWellboreDirSurveyData
       WHERE IDRecParent IS NOT NULL GROUP BY IDRecParent ORDER BY n DESC LIMIT 1`)
      .get() as { p: string; n: number };
    const idwell = (raw.prepare("SELECT idwell FROM wvWellboreDirSurvey WHERE IDRec = ?")
      .get(parent.p) as { idwell: string }).idwell;
    raw.close();
    expect(parent.n).toBeGreaterThan(100);

    const { rows } = await records("wvWellboreDirSurveyData", `idwell=${idwell}&parent=${parent.p}`);
    expect(rows.length).toBeGreaterThan(100);
    const md = rows.map((r) => Number(r.MD)).filter((n) => Number.isFinite(n));
    expect(md.length).toBe(rows.length);
    // Non-decreasing, which is the whole claim. Before this it was not even
    // close — the first five were 33.94, 42.93, 244.53, 152.75, 97.80.
    for (let i = 1; i < md.length; i++) {
      expect(md[i], `station ${i}: ${md[i - 1]} then ${md[i]}`).toBeGreaterThanOrEqual(md[i - 1]);
    }
  });

  it("still orders a folder the USER arranged by its sequence", async () => {
    // A sequenced folder is ordered by hand and that order is the point — a
    // casing string reads shoe-up or shoe-down because someone arranged it.
    //
    // The precedence between that and the model's declared order is UNTESTED
    // because it is unreachable: 52 tables are `sequenced`, 264 declare an
    // `sqlOrderBy`, and the two sets do not intersect. The branch ordering is
    // kept anyway — the user's arrangement should win if the model ever does
    // declare one — but this asserts only what the shipped model can exercise.
    const dm = JSON.parse(readFileSync(MODEL, "utf8"));
    const seq = Object.entries<any>(dm.tables).filter(([, T]) => T.sequenced);
    expect(seq.length).toBe(52);
    expect(seq.filter(([, T]) => T.sqlOrderBy).length, "sequenced AND declared").toBe(0);

    const raw = new DatabaseSync(SAMPLE, { readOnly: true });
    const present = new Map((raw.prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as { name: string }[]).map((r) => [r.name.toLowerCase(), r.name]));
    let checked = 0;
    for (const [t] of seq) {
      const real = present.get(t);
      if (!real) continue;
      const cols = (raw.prepare("SELECT name FROM pragma_table_info(?)").all(real) as { name: string }[])
        .map((c) => c.name.toLowerCase());
      if (!cols.includes("sysseq") || !cols.includes("idrecparent") || !cols.includes("idrec")) continue;
      const parent = raw.prepare(
        `SELECT idwell, IDRecParent AS p, COUNT(*) n FROM "${real}"
          WHERE IDRecParent IS NOT NULL GROUP BY IDRecParent ORDER BY n DESC LIMIT 1`,
      ).get() as { idwell: string; p: string; n: number } | undefined;
      if (!parent || parent.n < 3) continue;

      // sysSeq is a system column and the payload omits it by default, so the
      // ORDER is compared rather than the value: the record ids the route
      // returns must be the ids the database gives when sorted by sysSeq.
      const want = (raw.prepare(
        `SELECT IDRec AS id FROM "${real}" WHERE IDRecParent = ? ORDER BY sysSeq LIMIT 500`,
      ).all(parent.p) as { id: string }[]).map((r) => String(r.id));

      const { rows } = await records(real, `idwell=${parent.idwell}&parent=${parent.p}`);
      const got = rows.map((r) => String(r.IDRec));
      expect(got, real).toEqual(want);
      checked++;
      if (checked >= 3) break;
    }
    raw.close();
    expect(checked, "sequenced folders with enough rows to check").toBeGreaterThan(0);
  });

  it("drops a declared column this database does not have, rather than failing", async () => {
    // The model describes WellView; a converted database may not carry every
    // column it names. An order that cannot be built must degrade to the
    // heuristic, never to SQL that throws — so every table must still read.
    const dm = JSON.parse(readFileSync(MODEL, "utf8"));
    const raw = new DatabaseSync(SAMPLE, { readOnly: true });
    const present = new Set((raw.prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as { name: string }[]).map((r) => r.name.toLowerCase()));
    const declared = Object.keys(dm.tables).filter((t) => dm.tables[t].sqlOrderBy && present.has(t));
    raw.close();
    expect(declared.length).toBeGreaterThan(150);

    // Reading every one of them is the real assertion: a bad ORDER BY throws.
    let read = 0;
    for (const t of declared) {
      const res = await app.inject({ url: `/entry/wellview/dbs/${DB}/records/${t}`, headers: auth });
      expect(res.statusCode, t).toBe(200);
      read++;
    }
    expect(read).toBe(declared.length);
  }, 120_000);
});
