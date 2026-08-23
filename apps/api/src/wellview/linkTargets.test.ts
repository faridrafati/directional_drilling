/**
 * Which tables a record link may point at.
 *
 * The app guessed, from a hand-written map of 14 name suffixes with a
 * `wv` + suffix fallback. Sixteen columns fell through it — there is no table
 * called `wvitem`, `wvgauge` or `wvfaileditem` — so the candidate list came back
 * empty, the picker offered nothing, and the empty state told the user to
 * "enter the linked folder first" when the folders were already full. The
 * fallback could not recover either: it seeds from TK values, which only a
 * successful pick can create.
 *
 * The model has said all along. A `foreignidrec` field carries one
 * `<afmfieldlookuplist idrectable="…">` per permitted target:
 *
 *   <afmfieldlookuplist idrectable="wvCas" idrectableancestorfilter="wvWellHeader" />
 *
 * 188 fields declare theirs, 15 of them polymorphic, and
 * `wvJobIntervalProblem.IDRecFailedItem` names fourteen tables. No suffix map
 * was ever going to get that.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Fastify, { type FastifyInstance } from "fastify";
import { registerWellviewDbRoutes } from "../routes/wellviewDb.js";
import { issueToken } from "../entry/auth.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..", "..", "..");
const SAMPLE = join(REPO, "sqlite_DB", "wellview", "wv9.0_Sample.sqlite");
const MODEL = join(REPO, "apps", "web", "public", "wellview-templates", "datamodel.json");
const DB = "wv9.0_Sample";
const d = describe.skipIf(!existsSync(SAMPLE) || !existsSync(MODEL));

let app: FastifyInstance;
let auth: { Authorization: string };
let wells: { idwell: string; WellName: string }[];

beforeAll(async () => {
  app = Fastify();
  await registerWellviewDbRoutes(app);
  await app.ready();
  const { token } = issueToken({ id: "test", username: "vitest", role: "admin" });
  auth = { Authorization: `Bearer ${token}` };
  const w = await app.inject({ url: `/entry/wellview/dbs/${DB}/wells`, headers: auth });
  wells = (w.json() as { wells: typeof wells }).wells;
});
afterAll(async () => { await app?.close(); });

/** The link columns a record's payload declares, with their targets. */
const columns = async (table: string) => {
  const res = await app.inject({
    url: `/entry/wellview/dbs/${DB}/records/${table}?idwell=${wells[0].idwell}`, headers: auth,
  });
  expect(res.statusCode).toBe(200);
  return (res.json() as { columns: { column: string; link?: { targets?: string[] } }[] }).columns;
};

d("a record link knows its target tables", () => {
  it("keeps what the model declares", () => {
    const dm = JSON.parse(readFileSync(MODEL, "utf8"));
    let withTargets = 0;
    let poly = 0;
    for (const T of Object.values<any>(dm.tables)) {
      for (const f of Object.values<any>(T.fields)) {
        if (!f.linkTargets?.length) continue;
        withTargets++;
        if (f.linkTargets.length > 1) poly++;
        for (const t of f.linkTargets) expect(t).toMatch(/^wv/i);
      }
    }
    expect(withTargets).toBe(188);
    expect(poly).toBe(15);

    // The one that made the point: fourteen tables on a single column.
    const failed = dm.tables["wvjobintervalproblem"].fields["idrecfaileditem"];
    expect(failed.linkTargets.length).toBe(14);
    expect(failed.linkTargets).toContain("wvJobDrillBit");
    expect(failed.linkTargets).toContain("wvCasComp");
  });

  it("resolves the columns the suffix map could not", async () => {
    // `idrecfaileditem` — the suffix map has no "faileditem" key, and there is
    // no table called wvfaileditem, so this resolved to nothing at all.
    const cols = await columns("wvJobIntervalProblem");
    const failed = cols.find((c) => c.column.toLowerCase() === "idrecfaileditem")!;
    expect(failed, "wvJobIntervalProblem.IDRecFailedItem").toBeTruthy();
    expect(failed.link?.targets?.length ?? 0).toBeGreaterThan(5);
  });

  it("offers real candidates on a well that has them", async () => {
    // The empty state claimed the folders were empty. They are not: this asks
    // the same endpoint the picker does and expects records back.
    const cols = await columns("wvJobIntervalProblem");
    const failed = cols.find((c) => c.column.toLowerCase() === "idrecfaileditem")!;
    const targets = failed.link!.targets!;

    let found = 0;
    for (const w of wells.slice(0, 12)) {
      for (const t of targets) {
        const res = await app.inject({
          url: `/entry/wellview/dbs/${DB}/link-candidates?table=${t}&idwell=${w.idwell}`,
          headers: auth,
        });
        if (res.statusCode !== 200) continue;
        found += (res.json() as { candidates: unknown[] }).candidates.length;
      }
      if (found > 20) break;
    }
    expect(found, "candidates the picker used to deny").toBeGreaterThan(20);
  }, 120_000);

  it("still resolves the ordinary single-target links", async () => {
    // The change must not narrow what already worked. IDRecWellBore has always
    // resolved through the suffix map and must still resolve.
    const cols = await columns("wvPerforation");
    const bore = cols.find((c) => c.column.toLowerCase() === "idrecwellbore");
    if (bore) expect(bore.link?.targets).toContain("wvWellbore");
    const zone = cols.find((c) => c.column.toLowerCase() === "idreczone");
    if (zone) expect(zone.link?.targets).toContain("wvZone");
  });
});
