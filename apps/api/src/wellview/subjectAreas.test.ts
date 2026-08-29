/**
 * Subject areas in the folder tree (§3.9 Selecting Folders).
 *
 * "Well information in the Edit Data window is grouped into subject areas. Each
 * subject area (such as General, Operations, and Geological Evaluation)
 * contains a group of folders… When entering your data, start with the first
 * subject area, and work your way down the list."
 *
 * The app showed 66 top-level folders flat, ordered by hidden table names, so
 * wvTestEquip / wvTestLeakOff / wvTestSSSV sat with wvTimeCurve between them:
 * three tests split by a folder of real-time curves, because "TestL" < "TimeC"
 * < "TestS" is not how anybody thinks about a well.
 *
 * The grouping is the vendor's own, read out of the shipped help (topic 1.174
 * and the eleven area pages beneath it).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Fastify, { type FastifyInstance } from "fastify";
import { registerWellviewDbRoutes } from "../routes/wellviewDb.js";
import { SUBJECT_AREAS, groupBySubject, subjectAreaOf, subjectRankOf } from "./subjects.js";
import { issueToken } from "../entry/auth.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const SAMPLE = join(HERE, "..", "..", "..", "..", "sqlite_DB", "wellview", "wv9.0_Sample.sqlite");
const DB = "wv9.0_Sample";
const hasDb = existsSync(SAMPLE);
const d = describe.skipIf(!hasDb);

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

const tree = async () => {
  const res = await app.inject({ url: `/entry/wellview/dbs/${DB}/tree`, headers: auth });
  expect(res.statusCode).toBe(200);
  return res.json() as {
    tree: { table: string; count: number | null }[];
    subjects: { name: string; tables: string[]; listed: boolean }[];
  };
};

describe("the guide's subject areas", () => {
  it("are the eleven the help names, in its order", () => {
    expect(SUBJECT_AREAS.map((a) => a.name)).toEqual([
      "General",
      "Operations",
      "Wellbores, Surveys, and Formations",
      "Geological Evaluation",
      "Casing, Cement, and Wellheads",
      "Tubing, Rods, and Other Equipment",
      "Surface Equipment",
      "Zones, Perfs, Stims, and Swabs",
      "Reservoir and Equipment Tests",
      "Production Operations and Failures",
      "Other",
    ]);
  });

  it("names each folder once and only once", () => {
    const seen = new Set<string>();
    for (const a of SUBJECT_AREAS) {
      for (const t of a.tables) {
        expect(seen.has(t.toLowerCase()), `${t} appears twice`).toBe(false);
        seen.add(t.toLowerCase());
      }
    }
  });

  it("keeps the guide's order inside an area, not the alphabet", () => {
    // "Risers, Casing Strings, Cement" is the order the work happens in.
    expect(subjectRankOf("wvRiser")).toBeLessThan(subjectRankOf("wvCas"));
    expect(subjectRankOf("wvCas")).toBeLessThan(subjectRankOf("wvCement"));
  });

  it("sorts the areas themselves, not only the folders inside them", () => {
    /*
     * Ranking within an area alone makes every area's first folder equal, and
     * a flat list then falls back to the alphabet ACROSS areas — Geological
     * Evaluation ahead of the Well Header. §3.9: "start with the first subject
     * area, and work your way down the list."
     */
    expect(subjectRankOf("wvWellHeader")).toBeLessThan(subjectRankOf("wvGeoEval"));
    expect(subjectRankOf("wvJob")).toBeLessThan(subjectRankOf("wvCas"));
    expect(subjectRankOf("wvCas")).toBeLessThan(subjectRankOf("wvNote"));
  });

  it("puts the three equipment tests together, which the flat list did not", () => {
    for (const t of ["wvTestEquip", "wvTestSSSV", "wvWellTestProd"]) {
      expect(subjectAreaOf(t)).toBe("Reservoir and Equipment Tests");
    }
    // …and the folder that used to sit between them is somewhere else entirely.
    expect(subjectAreaOf("wvTimeCurve")).toBe("Other");
  });

  it("collects anything it does not name rather than dropping it", () => {
    const g = groupBySubject(["wvJob", "wvNotAThing"]);
    const rest = g.find((x) => !x.listed);
    expect(rest?.tables).toEqual(["wvNotAThing"]);
    expect(g[0].name).toBe("Operations");
  });
});

d("the tree route", () => {
  it("groups every top-level folder it returns", async () => {
    const { tree: nodes, subjects } = await tree();
    const grouped = new Set(subjects.flatMap((a) => a.tables.map((t) => t.toLowerCase())));
    for (const n of nodes) {
      expect(grouped.has(n.table.toLowerCase()), `${n.table} is in a subject area`).toBe(true);
    }
    // Every table named in a group is really in the tree — a heading over
    // nothing is worse than no heading.
    const have = new Set(nodes.map((n) => n.table.toLowerCase()));
    for (const a of subjects) {
      for (const t of a.tables) expect(have.has(t.toLowerCase()), `${t} exists`).toBe(true);
    }
  });

  it("leaves nothing in the unlisted catch-all for this database", async () => {
    // If this ever fails, the schema has a folder the shipped help does not
    // name, and it should be looked at rather than quietly filed.
    const { subjects } = await tree();
    const rest = subjects.find((a) => !a.listed);
    expect(rest?.tables ?? []).toEqual([]);
  });

  it("orders the tree by the guide, not by table name", async () => {
    const { tree: nodes } = await tree();
    const at = (t: string) => nodes.findIndex((n) => n.table.toLowerCase() === t.toLowerCase());
    // wvRiser sorts after wvCement alphabetically and before it in the guide.
    expect(at("wvRiser")).toBeGreaterThanOrEqual(0);
    expect(at("wvRiser")).toBeLessThan(at("wvCement"));
  });
});
