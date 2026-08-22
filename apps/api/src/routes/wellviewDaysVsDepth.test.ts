/**
 * The days-vs-depth route, against the REAL converted sample database.
 *
 * The series arithmetic is covered in `wellview/daysVsDepth.test.ts`; what is
 * checked here is the part a user notices: that the chart opens on a job that
 * HAS a curve rather than on whichever job is newest, that WellView's own three
 * templates are offered and switching between them changes the series, that
 * every axis carries the model's unit so the client can convert, and that a
 * series the template asks for but the job cannot fill is reported as missing
 * rather than silently dropped.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Fastify, { type FastifyInstance } from "fastify";
import { registerWellviewDbRoutes } from "./wellviewDb.js";
import { issueToken } from "../entry/auth.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const SAMPLE = join(HERE, "..", "..", "..", "..", "sqlite_DB", "wellview", "wv9.0_Sample.sqlite");
const DB = "wv9.0_Sample";
/** "Sample 11 - Full Data" — two jobs, one of which carries the drilling curve. */
const IDWELL = "946E6358693E482097B8099D7F84F532";

const hasDb = existsSync(SAMPLE);
const d = describe.skipIf(!hasDb);

interface Axis { field: string; label: string; unit?: string; units?: Record<string, unknown>; applyDatum?: boolean }
interface Series { caption: string; kind: "plan" | "actual"; x: Axis; y: Axis; points: { x: number; y: number }[] }
interface Body {
  supported: boolean;
  jobs: { idrec: string; label: string; phases: number; reports: number }[];
  job: { idrec: string; label: string } | null;
  templates: { id: string; name: string }[];
  template: { id: string; name: string } | null;
  series: Series[];
  unavailable: string[];
}

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

const get = (qs: string) =>
  app.inject({ url: `/entry/wellview/dbs/${DB}/days-vs-depth?${qs}`, headers: auth });

d("WellView days-vs-depth route", () => {
  it("requires a well and a token", async () => {
    expect((await get("")).statusCode).toBe(400);
    const anon = await app.inject({ url: `/entry/wellview/dbs/${DB}/days-vs-depth?idwell=${IDWELL}` });
    expect(anon.statusCode).toBe(401);
  });

  it("offers WellView's own three shipped templates", async () => {
    const b = (await get(`idwell=${IDWELL}`)).json() as Body;
    expect(b.supported).toBe(true);
    expect(b.templates.map((t) => t.name).sort())
      .toEqual(["Phases_Plan", "Phases_Plan vs Actual", "Phases_Problem Time"]);
  });

  it("opens on a job that has a curve, not merely the newest one", async () => {
    const b = (await get(`idwell=${IDWELL}`)).json() as Body;
    expect(b.jobs.length).toBeGreaterThan(1);
    expect(b.job).toBeTruthy();
    const chosen = b.jobs.find((j) => j.idrec === b.job!.idrec)!;
    const points = b.series.reduce((a, s) => a + s.points.length, 0);
    expect(points).toBeGreaterThan(20);
    // Every other job must yield no more than the one that was picked.
    for (const other of b.jobs.filter((j) => j.idrec !== chosen.idrec)) {
      const ob = (await get(`idwell=${IDWELL}&job=${other.idrec}`)).json() as Body;
      expect(ob.series.reduce((a, s) => a + s.points.length, 0)).toBeLessThanOrEqual(points);
    }
  });

  it("draws both a plan and an actual line on the plan-vs-actual template", async () => {
    const b = (await get(`idwell=${IDWELL}`)).json() as Body;
    expect(b.series.some((s) => s.kind === "plan")).toBe(true);
    expect(b.series.some((s) => s.kind === "actual")).toBe(true);
    // The plan comes from the phase program, the actual from the daily reports;
    // they must not be the same numbers under two names.
    const plan = b.series.find((s) => s.kind === "plan")!;
    const act = b.series.find((s) => s.kind === "actual")!;
    expect(plan.points.length).not.toBe(act.points.length);
  });

  it("changes the series when the template changes", async () => {
    const pva = (await get(`idwell=${IDWELL}&template=${encodeURIComponent("Shared Templates/Phases_Plan vs Actual")}`)).json() as Body;
    const prob = (await get(`idwell=${IDWELL}&template=${encodeURIComponent("Shared Templates/Phases_Problem Time")}`)).json() as Body;
    expect(prob.template!.name).toBe("Phases_Problem Time");
    expect(prob.series.map((s) => s.caption)).not.toEqual(pva.series.map((s) => s.caption));
    // The problem-time template's whole point is the no-problem curve.
    expect([...prob.series, ...prob.unavailable.map((c) => ({ caption: c }))]
      .some((s) => /Problem/i.test(s.caption))).toBe(true);
  });

  it("carries the model's unit on every axis so the client can convert", async () => {
    const b = (await get(`idwell=${IDWELL}`)).json() as Body;
    for (const s of b.series) {
      expect(s.x.unit, `${s.caption} x has no unit`).toBeTruthy();
      expect(s.y.unit, `${s.caption} y has no unit`).toBeTruthy();
      expect(s.x.label).not.toBe(s.x.field);   // the model's caption, not the column
    }
    expect(b.series.some((s) => s.y.unit === "m")).toBe(true);
    expect(b.series.every((s) => s.x.unit === "days")).toBe(true);
  });

  /**
   * Without this the drilling curve is the one place in the app where switching
   * Tools > Reference Datum to Ground leaves the depths where they were, quietly
   * disagreeing with the Schematic and the Survey tab by the height of the rig
   * floor — hundreds of metres on some of these wells.
   */
  it("marks the depth axes as datum-bearing, and the time and cost axes as not", async () => {
    const b = (await get(`idwell=${IDWELL}`)).json() as Body;
    const depth = b.series.filter((s) => s.y.unit === "m");
    expect(depth.length).toBeGreaterThan(0);
    for (const s of depth) {
      expect(s.y.applyDatum, `${s.caption} y is a depth but is not datum-bearing`).toBe(true);
    }
    // Days and money do not move with the reference datum.
    for (const s of b.series) {
      expect(s.x.applyDatum ?? false, `${s.caption} x is days but claims a datum`).toBe(false);
      if (s.y.unit === "Cost") expect(s.y.applyDatum ?? false).toBe(false);
    }
  });

  it("names the series it could not fill instead of quietly dropping them", async () => {
    // The template asks for eight; a job without a cost estimate cannot draw
    // them all, and the difference has to be visible.
    const b = (await get(`idwell=${IDWELL}`)).json() as Body;
    const tplSeries = b.series.length + b.unavailable.length;
    expect(tplSeries).toBe(8);
    for (const c of b.unavailable) expect(typeof c).toBe("string");
  });

  it("returns an empty, supported result for a well with no job", async () => {
    const b = (await get("idwell=00000000000000000000000000000000")).json() as Body;
    expect(b.supported).toBe(true);
    expect(b.jobs).toEqual([]);
    expect(b.series).toEqual([]);
  });
});
