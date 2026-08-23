/**
 * Folders that hang off a parent named in the DATA, not by the prefix rule.
 *
 * Most of WellView's schema nests by name — wvJobRig under wvJob — and the
 * subject tree walks that. A handful carry a `TblKeyParent` column instead,
 * holding the name of whichever table each row belongs to. Those tables are
 * nobody's prefix child AND have a parent of their own, so they were neither a
 * top-level folder nor anyone's child: the tree, which is the only navigation
 * Edit Data has, could not reach them at all.
 *
 * Nine safety-incident comments exist in the sample database and no screen in
 * this app could show them. `reports.json` references wvComment zero times, so
 * the report route could not reach them either.
 *
 * The ten wvLoc* survey tables are the same shape with no rows to speak for
 * them, so the model answers instead: `wvWellHeader.LegalSurveyTyp` names all
 * ten, and its help says "Define this field in order to access location
 * tables." Two sample wells have chosen one.
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
const d = describe.skipIf(!existsSync(SAMPLE));

interface Node { table: string; label: string; count: number; children: Node[] }

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

const tree = async (idwell?: string) => {
  const res = await app.inject({
    url: `/entry/wellview/dbs/${DB}/tree${idwell ? `?idwell=${idwell}` : ""}`, headers: auth,
  });
  expect(res.statusCode).toBe(200);
  return (res.json() as { tree: Node[] }).tree;
};

/** Every table the tree can reach, and the path to it. */
function reachable(nodes: Node[], path: string[] = [], out = new Map<string, string[]>()) {
  for (const n of nodes) {
    const here = [...path, n.table];
    out.set(n.table.toLowerCase(), here);
    reachable(n.children, here, out);
  }
  return out;
}

d("the subject tree reaches the folders that hold data", () => {
  it("finds Comments under the incident they belong to", async () => {
    const raw = new DatabaseSync(SAMPLE, { readOnly: true });
    const w = raw.prepare(`
      SELECT idwell, COUNT(*) n FROM wvComment GROUP BY idwell ORDER BY n DESC LIMIT 1`)
      .get() as { idwell: string; n: number };
    const total = (raw.prepare("SELECT COUNT(*) c FROM wvComment").get() as { c: number }).c;
    const parents = (raw.prepare("SELECT DISTINCT lower(TblKeyParent) v FROM wvComment").all() as { v: string }[])
      .map((r) => r.v);
    raw.close();

    expect(total).toBe(9);
    expect(parents).toEqual(["wvjobsafetyincident"]);

    const reach = reachable(await tree(w.idwell));
    const path = reach.get("wvcomment");
    expect(path, "wvComment is reachable from the tree").toBeTruthy();
    // …and under the table its rows actually name, not bolted onto the root.
    expect(path!.map((x) => x.toLowerCase())).toContain("wvjobsafetyincident");
  });

  it("shows a location folder only on a well that chose that survey system", async () => {
    const raw = new DatabaseSync(SAMPLE, { readOnly: true });
    const picked = raw.prepare(`
      SELECT idwell, lower(LegalSurveyTyp) v FROM wvWellHeader
       WHERE LegalSurveyTyp IS NOT NULL AND LegalSurveyTyp <> ''`).all() as { idwell: string; v: string }[];
    const none = (raw.prepare(`
      SELECT idwell FROM wvWellHeader WHERE LegalSurveyTyp IS NULL OR LegalSurveyTyp = '' LIMIT 1`)
      .get() as { idwell: string });
    raw.close();

    expect(picked.length, "two wells have chosen one").toBe(2);

    for (const p of picked) {
      const reach = reachable(await tree(p.idwell));
      expect(reach.get(p.v), `${p.v} on the well that chose it`).toBeTruthy();
      // The other nine stay out of the way.
      const others = [...reach.keys()].filter((k) => k.startsWith("wvloc") && k !== p.v);
      expect(others, "only the chosen survey system appears").toEqual([]);
    }

    // A well that has chosen none shows none.
    const bare = reachable(await tree(none.idwell));
    expect([...bare.keys()].filter((k) => k.startsWith("wvloc"))).toEqual([]);
  }, 60_000);

  it("returns the comment rows even though their parent is missing", async () => {
    // The nine comments name wvJobSafetyIncident records that are NOT in this
    // export — 0 of 9 resolve. So the tree counts five on this well while the
    // parent folder counts none, and the screen used to say the well had none.
    //
    // Both cannot be true. The rows exist, so the rows win: Edit Data asks for
    // them scoped by the WELL when the parent chain cannot be walked, and says
    // why. This pins that the data path returns them.
    const raw = new DatabaseSync(SAMPLE, { readOnly: true });
    const w = raw.prepare("SELECT idwell, COUNT(*) n FROM wvComment GROUP BY idwell ORDER BY n DESC LIMIT 1")
      .get() as { idwell: string; n: number };
    const resolvable = (raw.prepare(`
      SELECT COUNT(*) c FROM wvComment c
        JOIN wvJobSafetyIncident i ON i.IDRec = c.IDRecParent`).get() as { c: number }).c;
    raw.close();

    // The premise: not one comment's parent is in this database.
    expect(resolvable).toBe(0);

    const res = await app.inject({
      url: `/entry/wellview/dbs/${DB}/records/wvComment?idwell=${w.idwell}`, headers: auth,
    });
    expect(res.statusCode).toBe(200);
    const rows = (res.json() as { rows: unknown[] }).rows;
    expect(rows.length).toBe(w.n);
    expect(rows.length).toBeGreaterThan(0);
  });

  it("does not duplicate a folder that was already reachable", async () => {
    // Attaching by data must ADD, never double up: a table appearing twice in
    // the tree is its own bug, and the counts would disagree.
    const t = await tree();
    const seen = new Map<string, number>();
    const walk = (ns: Node[]) => {
      for (const n of ns) {
        seen.set(n.table.toLowerCase(), (seen.get(n.table.toLowerCase()) ?? 0) + 1);
        walk(n.children);
      }
    };
    walk(t);
    const dupes = [...seen].filter(([, n]) => n > 1).map(([k]) => k);
    expect(dupes).toEqual([]);
  });

  it("leaves Attachments alone, which has its own screen", async () => {
    // wvAttachment is the same shape and is deliberately excluded: it is
    // reached through the Attachments button, and a second route to it in the
    // tree would be two places to look for one thing.
    const reach = reachable(await tree());
    expect(reach.get("wvattachment")).toBeUndefined();
  });
});
