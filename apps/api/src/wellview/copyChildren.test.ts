/**
 * Copying a record, and choosing what comes with it.
 *
 * This route had no test at all, and it drags a whole subtree: duplicating one
 * casing string carries 222 tally rows, a well-test transient carries 2,389
 * gauge readings, and there was no way to say no.
 *
 * The app described that as "exactly as the manual says". It is the manual for
 * the wrong version. 9.0's What's New: "In WellView 8.0/8.1, when you copied a
 * record, all the child records were included in the copy… You could not
 * exclude any child records from the copy, such as the drill parameters. Now
 * when you copy the record, a window allows you to choose the child tables that
 * you want to copy."
 *
 * Everything here copies INTO a synthetic well and deletes it again, so the
 * sample database is left exactly as it was found. The last test proves that.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import Fastify, { type FastifyInstance } from "fastify";
import { registerWellviewDbRoutes } from "../routes/wellviewDb.js";
import { issueToken } from "../entry/auth.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const SAMPLE = join(HERE, "..", "..", "..", "..", "sqlite_DB", "wellview", "wv9.0_Sample.sqlite");
const DB = "wv9.0_Sample";
const TEST_IDWELL = "TEST0000000000000000000COPYCHILD";
/** Every table a drill-string copy can reach, deepest first for the scrub. */
const TOUCHED = [
  "wvJobDrillStringCompTally",
  "wvJobDrillStringDrillParam",
  "wvJobDrillStringComp",
  "wvJobDrillStringBitNozzle",
  "wvJobDrillString",
];

const hasDb = existsSync(SAMPLE);
const d = describe.skipIf(!hasDb);

let app: FastifyInstance;
let auth: { Authorization: string };
let source: { IDRec: string; idwell: string };
/** Row counts before anything was written, so the scrub can be proved. */
const baseline = new Map<string, number>();

function counts(): Map<string, number> {
  const raw = new DatabaseSync(SAMPLE, { readOnly: true });
  const out = new Map<string, number>();
  try {
    for (const t of TOUCHED) out.set(t, (raw.prepare(`SELECT COUNT(*) c FROM "${t}"`).get() as { c: number }).c);
  } finally { raw.close(); }
  return out;
}

/** Remove anything under the synthetic well, children before parents. */
function scrub() {
  if (!hasDb) return;
  const raw = new DatabaseSync(SAMPLE);
  raw.exec("PRAGMA busy_timeout = 3000");
  try {
    for (const t of TOUCHED) raw.prepare(`DELETE FROM "${t}" WHERE idwell = ?`).run(TEST_IDWELL);
  } finally { raw.close(); }
}

beforeAll(async () => {
  scrub();
  for (const [k, v] of counts()) baseline.set(k, v);
  app = Fastify();
  await registerWellviewDbRoutes(app);
  await app.ready();
  const { token } = issueToken({ id: "test", username: "vitest", role: "admin" });
  auth = { Authorization: `Bearer ${token}` };

  const raw = new DatabaseSync(SAMPLE, { readOnly: true });
  // One that carries all three kinds of child AND a grandchild, so the pruning
  // cases have something real to prune.
  source = raw.prepare(`SELECT s.IDRec, s.idwell FROM wvJobDrillString s
    WHERE EXISTS (SELECT 1 FROM wvJobDrillStringComp c WHERE c.IDRecParent = s.IDRec)
      AND EXISTS (SELECT 1 FROM wvJobDrillStringDrillParam p WHERE p.IDRecParent = s.IDRec)
      AND EXISTS (SELECT 1 FROM wvJobDrillStringBitNozzle n WHERE n.IDRecParent = s.IDRec)
      AND EXISTS (SELECT 1 FROM wvJobDrillStringCompTally t
                  JOIN wvJobDrillStringComp c2 ON c2.IDRec = t.IDRecParent
                  WHERE c2.IDRecParent = s.IDRec)
    LIMIT 1`).get() as { IDRec: string; idwell: string };
  raw.close();
});

afterAll(async () => { await app?.close(); scrub(); });

const copy = async (body: Record<string, unknown>) => {
  const res = await app.inject({
    method: "POST",
    url: `/entry/wellview/dbs/${DB}/records/wvJobDrillString/${source.IDRec}/copy`,
    headers: auth,
    payload: { idwell: TEST_IDWELL, ...body },
  });
  expect(res.statusCode).toBe(200);
  return res.json() as { idrec: string; copied: number };
};
const under = (t: string) => {
  const raw = new DatabaseSync(SAMPLE, { readOnly: true });
  try { return (raw.prepare(`SELECT COUNT(*) c FROM "${t}" WHERE idwell = ?`).get(TEST_IDWELL) as { c: number }).c; }
  finally { raw.close(); }
};

d("copying a record", () => {
  it("says what it would carry, per child table, for THIS record", async () => {
    const res = await app.inject({
      url: `/entry/wellview/dbs/${DB}/records/wvJobDrillString/${source.IDRec}/copy-preview`,
      headers: auth,
    });
    expect(res.statusCode).toBe(200);
    const p = res.json() as {
      children: { table: string; label: string; count: number; depth: number }[]; total: number;
    };
    const byTable = new Map(p.children.map((c) => [c.table.toLowerCase(), c]));
    for (const t of ["wvjobdrillstringcomp", "wvjobdrillstringdrillparam", "wvjobdrillstringbitnozzle"]) {
      expect(byTable.has(t), `${t} is offered`).toBe(true);
      expect(byTable.get(t)!.count).toBeGreaterThan(0);
    }
    // Counts are this record's, not the folder's.
    const raw = new DatabaseSync(SAMPLE, { readOnly: true });
    const real = (raw.prepare(
      "SELECT COUNT(*) c FROM wvJobDrillStringComp WHERE IDRecParent = ?").get(source.IDRec) as { c: number }).c;
    raw.close();
    expect(byTable.get("wvjobdrillstringcomp")!.count).toBe(real);
    expect(p.total).toBe(p.children.reduce((n, c) => n + c.count, 0));
  });

  it("takes everything when nothing is chosen, which is what it always did", async () => {
    const before = TOUCHED.map((t) => [t, under(t)] as const);
    const r = await copy({});
    expect(r.copied).toBeGreaterThan(1);
    for (const [t, n] of before) {
      expect(under(t), `${t} gained rows`).toBeGreaterThan(n);
    }
    scrub();
  });

  it("takes only the chosen children", async () => {
    scrub();
    await copy({ childTables: ["wvJobDrillStringBitNozzle"] });
    expect(under("wvJobDrillString"), "the record itself").toBe(1);
    expect(under("wvJobDrillStringBitNozzle"), "the chosen child").toBeGreaterThan(0);
    expect(under("wvJobDrillStringComp"), "not chosen").toBe(0);
    expect(under("wvJobDrillStringDrillParam"), "not chosen").toBe(0);
    scrub();
  });

  it("prunes the whole subtree under a table that was not chosen", async () => {
    /*
     * The tally hangs off the COMPONENT, not off the string. Choosing the tally
     * without the components must copy neither — a grandchild whose parent was
     * not copied has nothing to hang off, and copying it anyway would strand
     * it. This is the case a per-level filter gets wrong.
     */
    scrub();
    await copy({ childTables: ["wvJobDrillStringCompTally"] });
    expect(under("wvJobDrillString"), "the record itself").toBe(1);
    expect(under("wvJobDrillStringComp"), "its parent was not chosen").toBe(0);
    const raw = new DatabaseSync(SAMPLE, { readOnly: true });
    const stranded = (raw.prepare(`SELECT COUNT(*) c FROM wvJobDrillStringCompTally
      WHERE idwell = ?`).get(TEST_IDWELL) as { c: number }).c;
    raw.close();
    expect(stranded, "nothing may be copied without its parent").toBe(0);
    scrub();
  });

  it("copies a grandchild when its parent is chosen too", async () => {
    // The other half: the pruning must not be a blanket refusal of depth.
    scrub();
    await copy({ childTables: ["wvJobDrillStringComp", "wvJobDrillStringCompTally"] });
    expect(under("wvJobDrillStringComp")).toBeGreaterThan(0);
    const raw = new DatabaseSync(SAMPLE, { readOnly: true });
    const tallies = (raw.prepare(`SELECT COUNT(*) c FROM wvJobDrillStringCompTally
      WHERE idwell = ?`).get(TEST_IDWELL) as { c: number }).c;
    const stranded = (raw.prepare(`SELECT COUNT(*) c FROM wvJobDrillStringCompTally x
      WHERE x.idwell = ? AND NOT EXISTS (
        SELECT 1 FROM wvJobDrillStringComp p WHERE p.IDRec = x.IDRecParent)`)
      .get(TEST_IDWELL) as { c: number }).c;
    raw.close();
    expect(tallies, "the grandchild travelled").toBeGreaterThan(0);
    expect(stranded, "and every one of them has its parent").toBe(0);
    scrub();
  });

  it("takes the record alone when the list is empty", async () => {
    scrub();
    const r = await copy({ childTables: [] });
    expect(r.copied).toBe(1);
    expect(under("wvJobDrillString")).toBe(1);
    for (const t of TOUCHED.filter((x) => x !== "wvJobDrillString")) expect(under(t)).toBe(0);
    scrub();
  });

  it("leaves the sample database exactly as it found it", () => {
    scrub();
    const now = counts();
    for (const [t, n] of baseline) {
      expect(now.get(t), `${t} row count`).toBe(n);
    }
    // …and nothing at all under the synthetic well.
    for (const t of TOUCHED) expect(under(t), `${t} residue`).toBe(0);
  });
});
