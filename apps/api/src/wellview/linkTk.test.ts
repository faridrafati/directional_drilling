/**
 * A record link is a PAIR, and both halves get written.
 *
 * WellView stores an associated-data link as a GUID plus a `…TK` column naming
 * the target TABLE — `wvCement.IDRecStringTK = 'wvcas'` — which is how an
 * ambiguous link like "String" (casing or tubing?) stays unambiguous. It keeps
 * them together: of 6,275 link values in the sample database 6,268 carry their
 * TK, and the seven that do not are all one polymorphic column.
 *
 * This app could write the other kind. The Edit Data screen kept the pair in
 * step when a user PICKED a link by hand, but carry-forward seeded the GUID
 * alone — and the model declares no TK field, so none could ever have carried
 * itself. The result was a row resolvable in this app only because it searches
 * every candidate table for the GUID, and not resolvable at all in the desktop,
 * which uses the TK to know where to look.
 *
 * The fix is at the write boundary rather than in the screen that happened to
 * compose the record, so these tests go at the routes. Writes happen under a
 * fabricated idwell and the test asserts it is gone again at the end.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Fastify, { type FastifyInstance } from "fastify";
import { DatabaseSync } from "node:sqlite";
import { registerWellviewDbRoutes } from "../routes/wellviewDb.js";
import { issueToken } from "../entry/auth.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const SAMPLE = join(HERE, "..", "..", "..", "..", "sqlite_DB", "wellview", "wv9.0_Sample.sqlite");
const DB = "wv9.0_Sample";
const TEST_IDWELL = "TEST0000000000000000000000LINKTK";
const TABLE = "wvDepthAnnotation";

const hasDb = existsSync(SAMPLE);
const d = describe.skipIf(!hasDb);

function scrub() {
  if (!hasDb) return;
  const raw = new DatabaseSync(SAMPLE);
  raw.exec("PRAGMA busy_timeout = 3000");
  try { raw.exec(`DELETE FROM "${TABLE}" WHERE idwell = '${TEST_IDWELL}'`); } finally { raw.close(); }
}

let app: FastifyInstance;
let auth: { Authorization: string };
/** A real job to point at. wvDepthAnnotation also has a wellbore link, but
 *  the DefaultWellboreLinker fills that one in on every insert, so the JOB
 *  link is the one that isolates the behaviour under test. */
let job: { IDRec: string };

beforeAll(async () => {
  scrub();
  app = Fastify();
  await registerWellviewDbRoutes(app);
  await app.ready();
  const { token } = issueToken({ id: "test", username: "vitest", role: "admin" });
  auth = { Authorization: `Bearer ${token}` };
  const raw = new DatabaseSync(SAMPLE, { readOnly: true });
  job = raw.prepare("SELECT IDRec FROM wvJob LIMIT 1").get() as typeof job;
  raw.close();
});
afterAll(async () => { scrub(); await app?.close(); });

/** The row as the database actually holds it. */
function stored(idrec: string) {
  const raw = new DatabaseSync(SAMPLE, { readOnly: true });
  try {
    return raw.prepare(`SELECT * FROM "${TABLE}" WHERE IDRec = ?`).get(idrec) as Record<string, unknown>;
  } finally { raw.close(); }
}

d("a link written without its TK companion", () => {
  const created: string[] = [];

  it("is completed by looking the GUID up, not by guessing from the column name", async () => {
    // wvDepthAnnotation has IDRecJob and IDRecJobTK. Send only the GUID —
    // which is exactly what carry-forward used to do.
    const res = await app.inject({
      method: "POST",
      url: `/entry/wellview/dbs/${DB}/records/${TABLE}`,
      headers: auth,
      payload: { idwell: TEST_IDWELL, values: { Annotation: "tk test", IDRecJob: job.IDRec } },
    });
    expect(res.statusCode).toBe(200);
    const { idrec } = res.json() as { idrec: string };
    created.push(idrec);

    const row = stored(idrec);
    expect(row.IDRecJob).toBe(job.IDRec);
    // Looked up: the GUID was found in wvJob, so that is the name stored,
    // lowercased as the data has it everywhere else.
    expect(row.IDRecJobTK).toBe("wvjob");
  });

  it("leaves a TK the caller sent alone", async () => {
    // Only a BLANK companion is filled. A caller that knows its target — the
    // link picker does — must not have its answer second-guessed.
    const res = await app.inject({
      method: "POST",
      url: `/entry/wellview/dbs/${DB}/records/${TABLE}`,
      headers: auth,
      payload: {
        idwell: TEST_IDWELL,
        values: { Annotation: "explicit tk", IDRecJob: job.IDRec, IDRecJobTK: "wvjob" },
      },
    });
    expect(res.statusCode).toBe(200);
    const { idrec } = res.json() as { idrec: string };
    created.push(idrec);
    expect(stored(idrec).IDRecJobTK).toBe("wvjob");
  });

  it("writes nothing when the GUID points at no record at all", async () => {
    // A dangling link is already a problem; inventing a table name for it would
    // turn an obvious blank into a plausible lie.
    const res = await app.inject({
      method: "POST",
      url: `/entry/wellview/dbs/${DB}/records/${TABLE}`,
      headers: auth,
      payload: {
        idwell: TEST_IDWELL,
        values: { Annotation: "dangling", IDRecJob: "DEADBEEF00000000000000000000DEAD" },
      },
    });
    expect(res.statusCode).toBe(200);
    const { idrec } = res.json() as { idrec: string };
    created.push(idrec);
    const row = stored(idrec);
    expect(row.IDRecJob).toBe("DEADBEEF00000000000000000000DEAD");
    expect(row.IDRecJobTK ?? null).toBeNull();
  });

  it("is completed on an edit too, not only on a create", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/entry/wellview/dbs/${DB}/records/${TABLE}`,
      headers: auth,
      payload: { idwell: TEST_IDWELL, values: { Annotation: "patch test" } },
    });
    const { idrec } = res.json() as { idrec: string };
    created.push(idrec);
    expect(stored(idrec).IDRecJobTK ?? null).toBeNull();

    const patched = await app.inject({
      method: "PATCH",
      url: `/entry/wellview/dbs/${DB}/records/${TABLE}/${idrec}`,
      headers: auth,
      payload: { values: { IDRecJob: job.IDRec } },
    });
    expect(patched.statusCode).toBe(200);
    expect(stored(idrec).IDRecJobTK).toBe("wvjob");
  });

  it("leaves the database as it found it", async () => {
    for (const idrec of created) {
      const res = await app.inject({
        method: "DELETE",
        url: `/entry/wellview/dbs/${DB}/records/${TABLE}/${idrec}`,
        headers: auth,
      });
      expect(res.statusCode).toBe(200);
    }
    const raw = new DatabaseSync(SAMPLE, { readOnly: true });
    const left = raw.prepare(`SELECT COUNT(*) n FROM "${TABLE}" WHERE idwell = ?`)
      .get(TEST_IDWELL) as { n: number };
    raw.close();
    expect(left.n).toBe(0);
  });
});
