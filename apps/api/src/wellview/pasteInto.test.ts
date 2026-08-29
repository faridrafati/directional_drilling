/**
 * Paste into Current Record, and the *COPY* mark (§3.11).
 *
 * The guide gives two ways to paste and only one existed here:
 *
 *   "To paste as a new record, select the folder and choose Paste as New
 *    Record(s) from the menu. Each new record has the word *COPY* in its name.
 *    To paste into an existing record, select the record and choose Paste into
 *    Current Record from the menu."
 *
 * The copy route only ever INSERTs, so the workaround for the second is paste
 * new and delete old — which changes the record's IDRec and breaks everything
 * pointing at it.
 *
 * Everything here writes into a SYNTHETIC well and deletes it again. The last
 * test proves the sample database is as it was found.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import Fastify, { type FastifyInstance } from "fastify";
import { registerWellviewDbRoutes } from "../routes/wellviewDb.js";
import { markableNameColumn } from "./model.js";
import { issueToken } from "../entry/auth.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const SAMPLE = join(HERE, "..", "..", "..", "..", "sqlite_DB", "wellview", "wv9.0_Sample.sqlite");
const DB = "wv9.0_Sample";
const TEST_IDWELL = "TEST00000000000000000000PASTEINT";
const PARENT = "TESTPARENT0000000000000000PASTEA";
/** A tally: sequenced, with a free-text name field the *COPY* mark can land on. */
const TABLE = "wvCasComp";

const hasDb = existsSync(SAMPLE);
const d = describe.skipIf(!hasDb);

let app: FastifyInstance;
let auth: { Authorization: string };
let baseline = 0;

const open = (write = false) => new DatabaseSync(SAMPLE, write ? {} : { readOnly: true });
const countAll = () => {
  const raw = open();
  try { return (raw.prepare(`SELECT COUNT(*) c FROM "${TABLE}"`).get() as { c: number }).c; }
  finally { raw.close(); }
};
function scrub() {
  if (!hasDb) return;
  const raw = open(true);
  raw.exec("PRAGMA busy_timeout = 3000");
  try {
    for (const t of ["wvCasCompTally", TABLE]) {
      raw.prepare(`DELETE FROM "${t}" WHERE idwell = ?`).run(TEST_IDWELL);
    }
  } finally { raw.close(); }
}
const row = (idrec: string): Record<string, unknown> => {
  const raw = open();
  try { return raw.prepare(`SELECT * FROM "${TABLE}" WHERE IDRec = ?`).get(idrec) as Record<string, unknown>; }
  finally { raw.close(); }
};
const folder = () => {
  const raw = open();
  try {
    return raw.prepare(`SELECT IDRec AS id, sysSeq AS seq, COALESCE(Des,'') AS des FROM "${TABLE}"
      WHERE idwell = ? AND IDRecParent = ? ORDER BY sysSeq`).all(TEST_IDWELL, PARENT) as
      { id: string; seq: number; des: string }[];
  } finally { raw.close(); }
};

beforeAll(async () => {
  scrub();
  baseline = hasDb ? countAll() : 0;
  app = Fastify();
  await registerWellviewDbRoutes(app);
  await app.ready();
  const { token } = issueToken({ id: "test", username: "vitest", role: "admin" });
  auth = { Authorization: `Bearer ${token}` };
});
afterAll(async () => { await app?.close(); scrub(); });

const add = async (values: Record<string, unknown>) => {
  const res = await app.inject({
    method: "POST", url: `/entry/wellview/dbs/${DB}/records/${TABLE}`, headers: auth,
    payload: { idwell: TEST_IDWELL, parent: PARENT, values },
  });
  expect(res.statusCode, res.body).toBe(200);
  return (res.json() as { idrec: string }).idrec;
};
const copy = async (idrec: string, body: Record<string, unknown> = {}) => {
  const res = await app.inject({
    method: "POST", url: `/entry/wellview/dbs/${DB}/records/${TABLE}/${idrec}/copy`,
    headers: auth, payload: { idwell: TEST_IDWELL, parent: PARENT, ...body },
  });
  expect(res.statusCode, res.body).toBe(200);
  return res.json() as { idrec: string; copied: number; markedColumn?: string | null };
};
const pasteInto = (target: string, source: string) => app.inject({
  method: "POST", url: `/entry/wellview/dbs/${DB}/records/${TABLE}/${target}/paste-into`,
  headers: auth, payload: { source },
});

d("pasting into an existing record", () => {
  it("replaces the fields and keeps the record's identity", async () => {
    scrub();
    const a = await add({ Des: "source item", SzODNom: 244.5 });
    const b = await add({ Des: "target item", SzODNom: 177.8 });
    const wasB = row(b);

    const res = await pasteInto(b, a);
    expect(res.statusCode, res.body).toBe(200);

    const now = row(b);
    expect(now.Des, "the field values are the source's").toBe("source item");
    expect(now.SzODNom).toBe(244.5);
    // …and the identity is the target's own, which is the entire point: an
    // IDRec that changed would break every link pointing at this record.
    expect(now.IDRec).toBe(wasB.IDRec);
    expect(now.idwell).toBe(wasB.idwell);
    expect(now.IDRecParent).toBe(wasB.IDRecParent);
    expect(now.sysSeq, "its position in the folder").toBe(wasB.sysSeq);
    expect(row(a).Des, "the source is untouched").toBe("source item");
    scrub();
  });

  it("leaves the subfolder records alone", async () => {
    // The child-table choice belongs to the COPY, where a new record is made.
    // Re-parenting somebody else's children is a different act.
    scrub();
    const a = await add({ Des: "source" });
    const b = await add({ Des: "target" });
    const raw = open(true);
    raw.exec("PRAGMA busy_timeout = 3000");
    for (const [i, parent] of [[1, a], [2, b]] as const) {
      raw.prepare(`INSERT INTO wvCasCompTally (idwell, IDRecParent, IDRec, RefNo, sysSeq)
        VALUES (?, ?, ?, ?, ?)`).run(TEST_IDWELL, parent, `TALLY${i}0000000000000000000PASTE`, `j${i}`, i);
    }
    raw.close();

    expect((await pasteInto(b, a)).statusCode).toBe(200);
    const kids = open();
    const under = (p: string) => (kids.prepare(
      "SELECT COUNT(*) c FROM wvCasCompTally WHERE IDRecParent = ?").get(p) as { c: number }).c;
    expect(under(a), "the source keeps its own").toBe(1);
    expect(under(b), "and the target keeps its own — none were copied").toBe(1);
    kids.close();
    scrub();
  });

  it("refuses to paste a record into itself", async () => {
    scrub();
    const a = await add({ Des: "only one" });
    const res = await pasteInto(a, a);
    expect(res.statusCode).toBe(400);
    scrub();
  });

  it("refuses a source that no longer exists", async () => {
    scrub();
    const a = await add({ Des: "target" });
    const res = await pasteInto(a, "0000000000000000000000000000FFFF");
    expect(res.statusCode).toBe(404);
    scrub();
  });
});

d("pasting across wells", () => {
  /*
   * A LINK GUID IS ONLY MEANINGFUL IN ITS OWN WELL.
   *
   * Copying one across wells stores a pointer at a record on a different well —
   * a value the desktop resolves to the wrong thing or to nothing. The target's
   * own link is at least valid where it is, so it stands, and the reply NAMES
   * what was left alone.
   */
  const CAS = "wvCas";
  const WELL_B = "TEST00000000000000000000PASTEIN2";
  const BORE_A = "BORE00000000000000000000000000A0";
  const BORE_B = "BORE00000000000000000000000000B0";
  const seed = (idwell: string, idrec: string, des: string, bore: string) => {
    const raw = open(true);
    raw.exec("PRAGMA busy_timeout = 3000");
    raw.prepare(`INSERT INTO "${CAS}" (idwell, IDRec, Des, DepthBtm, IDRecWellBore, IDRecWellBoreTK)
      VALUES (?, ?, ?, ?, ?, 'wvwellbore')`).run(idwell, idrec, des, 1234, bore);
    raw.close();
  };
  const casRow = (idrec: string) => {
    const raw = open();
    try { return raw.prepare(`SELECT * FROM "${CAS}" WHERE IDRec = ?`).get(idrec) as Record<string, unknown>; }
    finally { raw.close(); }
  };
  const wipe = () => {
    const raw = open(true);
    raw.exec("PRAGMA busy_timeout = 3000");
    for (const w of [TEST_IDWELL, WELL_B]) raw.prepare(`DELETE FROM "${CAS}" WHERE idwell = ?`).run(w);
    raw.close();
  };

  it("keeps a link that would otherwise point at another well's record", async () => {
    wipe();
    const A = "CASA0000000000000000000000PASTEA";
    const B = "CASB0000000000000000000000PASTEB";
    seed(TEST_IDWELL, A, "source string", BORE_A);
    seed(WELL_B, B, "target string", BORE_B);

    const res = await app.inject({
      method: "POST", url: `/entry/wellview/dbs/${DB}/records/${CAS}/${B}/paste-into`,
      headers: auth, payload: { source: A },
    });
    expect(res.statusCode, res.body).toBe(200);
    const body = res.json() as { skipped: { column: string; label: string }[] };

    const now = casRow(B);
    expect(now.Des, "the ordinary fields did cross").toBe("source string");
    expect(now.IDRecWellBore, "the link did not").toBe(BORE_B);
    expect(now.idwell, "and the record stayed on its own well").toBe(WELL_B);
    expect(body.skipped.map((x) => x.column.toLowerCase()))
      .toContain("idrecwellbore");
    wipe();
  });

  it("copies links within one well, where they mean something", async () => {
    wipe();
    const A = "CASA0000000000000000000000PASTEA";
    const B = "CASB0000000000000000000000PASTEB";
    seed(TEST_IDWELL, A, "source string", BORE_A);
    seed(TEST_IDWELL, B, "target string", BORE_B);
    const res = await app.inject({
      method: "POST", url: `/entry/wellview/dbs/${DB}/records/${CAS}/${B}/paste-into`,
      headers: auth, payload: { source: A },
    });
    expect(res.statusCode, res.body).toBe(200);
    expect((res.json() as { skipped: unknown[] }).skipped).toEqual([]);
    expect(casRow(B).IDRecWellBore).toBe(BORE_A);
    wipe();
  });

  it("leaves wvCas exactly as it found it", () => {
    wipe();
    const raw = open();
    for (const w of [TEST_IDWELL, WELL_B]) {
      const n = (raw.prepare(`SELECT COUNT(*) c FROM "${CAS}" WHERE idwell = ?`).get(w) as { c: number }).c;
      expect(n).toBe(0);
    }
    raw.close();
  });
});

d("the *COPY* mark", () => {
  it("marks a copy in its name, as the guide says", async () => {
    scrub();
    const a = await add({ Des: "9 5/8 Casing" });
    const res = await copy(a, { mark: true });
    expect(res.markedColumn?.toLowerCase()).toBe("des");
    expect(row(res.idrec).Des).toBe("9 5/8 Casing *COPY*");
    // The record copied from is not renamed.
    expect(row(a).Des).toBe("9 5/8 Casing");
    scrub();
  });

  it("does not stack the mark when a copy is copied", async () => {
    scrub();
    const a = await add({ Des: "Shoe" });
    const one = await copy(a, { mark: true });
    const two = await copy(one.idrec, { mark: true });
    expect(row(two.idrec).Des).toBe("Shoe *COPY*");
    scrub();
  });

  it("leaves the name alone when nothing asked for a mark", async () => {
    // Every existing caller, unchanged.
    scrub();
    const a = await add({ Des: "Unmarked" });
    const res = await copy(a);
    expect(res.markedColumn).toBeUndefined();
    expect(row(res.idrec).Des).toBe("Unmarked");
    scrub();
  });

  it("marks nothing where a record's name cannot hold a word", () => {
    /*
     * The model says what a record's NAME is, and 78 of the 229 tables that
     * declare one are named by a date, a depth or a link. Writing "*COPY*" into
     * those would not mark the record, it would corrupt the field.
     */
    expect(markableNameColumn("wvNote"), "named <DtTm>").toBeNull();
    expect(markableNameColumn("wvWellboreDirSurveyData"), "named <MD>").toBeNull();
    expect(markableNameColumn("wvCasComp")?.toLowerCase(), "named <des>, <SzODNom>").toBe("des");
    expect(markableNameColumn("wvWellHeader")?.toLowerCase()).toBe("wellname");
  });

  it("gives the copy a place of its own in a sequenced folder", async () => {
    /*
     * `{ ...row }` carried the source's sysSeq across, so duplicating a
     * component produced two records claiming the same position and the order
     * between them became whatever SQLite returned.
     */
    scrub();
    await add({ Des: "one" });
    const two = await add({ Des: "two" });
    await add({ Des: "three" });
    const res = await copy(two, { mark: true });

    const seqs = folder().map((r) => r.seq);
    expect(new Set(seqs).size, "no two records share a sequence number").toBe(seqs.length);
    expect(row(res.idrec).sysSeq, "the copy goes to the end of the folder")
      .toBe(Math.max(...seqs));
    expect(folder().map((r) => r.des)).toEqual(["one", "two", "three", "two *COPY*"]);
    scrub();
  });
});

d("the sample database", () => {
  it("is exactly as it was found", () => {
    scrub();
    expect(countAll()).toBe(baseline);
    const raw = open();
    for (const t of ["wvCasComp", "wvCasCompTally"]) {
      const n = (raw.prepare(`SELECT COUNT(*) c FROM "${t}" WHERE idwell = ?`)
        .get(TEST_IDWELL) as { c: number }).c;
      expect(n, `${t} residue`).toBe(0);
    }
    raw.close();
  });
});
