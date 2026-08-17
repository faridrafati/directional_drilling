/**
 * The saved Query Templates (§8.1), decoded from `custom/queries/*.afq`.
 *
 * Two things are worth pinning. The date resolver, because a template's value
 * can be a relative token (`<today>-1.5`), WellView's legacy display format
 * (`01-Jan-00 12:00:00 AM`) or ISO — and a date column silently compared against
 * an unparsed string returns a plausible, wrong set of wells. And the runner,
 * because every one of the 29 templates should execute against a real database
 * rather than throw or quietly match nothing through a broken join.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Fastify, { type FastifyInstance } from "fastify";
import { registerWellviewDbRoutes, resolveDateValue } from "./wellviewDb.js";
import { issueToken } from "../entry/auth.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..", "..", "..");
const SAMPLE = join(REPO, "sqlite_DB", "wellview", "wv9.0_Sample.sqlite");
const QUERIES = join(REPO, "apps", "web", "public", "wellview-templates", "queries.json");
const DB = "wv9.0_Sample";

const ready = existsSync(SAMPLE) && existsSync(QUERIES);
const d = describe.skipIf(!ready);

let app: FastifyInstance;
let auth: { Authorization: string };

beforeAll(async () => {
  app = Fastify();
  await registerWellviewDbRoutes(app);
  await app.ready();
  auth = { Authorization: `Bearer ${issueToken({ id: "t", username: "vitest", role: "admin" }).token}` };
});
afterAll(async () => { await app?.close(); });

describe("query template date values", () => {
  const now = new Date("2026-08-18T14:30:00Z");

  it("reads WellView's relative tokens, offset in days", () => {
    expect(resolveDateValue("<now>", now)).toBe("2026-08-18T14:30:00Z");
    expect(resolveDateValue("<today>", now)).toBe("2026-08-18T00:00:00Z");
    // "Drilling Report Today" is <now>-1; "Completions Report Today" is <today>-1.5.
    expect(resolveDateValue("<now>-1", now)).toBe("2026-08-17T14:30:00Z");
    expect(resolveDateValue("<today>-1.5", now)).toBe("2026-08-16T12:00:00Z");
  });

  it("reads the legacy display format the templates store", () => {
    // Both bounds of "Failures by Date Range".
    expect(resolveDateValue("01-Jan-00 12:00:00 AM")).toBe("2000-01-01T00:00:00Z");
    expect(resolveDateValue("01-Jan-01 12:00:00 AM")).toBe("2001-01-01T00:00:00Z");
    // Noon must not collapse to midnight — the AM/PM rule runs both ways.
    expect(resolveDateValue("05-Mar-99 12:00:00 PM")).toBe("1999-03-05T12:00:00Z");
    expect(resolveDateValue("05-Mar-99 1:30:00 PM")).toBe("1999-03-05T13:30:00Z");
  });

  it("reads ISO, and refuses anything it cannot read", () => {
    expect(resolveDateValue("2019-04-02")).toBe("2019-04-02T00:00:00Z");
    expect(resolveDateValue("2019-04-02T06:15:00Z")).toBe("2019-04-02T06:15:00Z");
    // A value it cannot parse must be null so the caller skips the criterion,
    // rather than comparing a date column against a word.
    expect(resolveDateValue("last Tuesday")).toBeNull();
    expect(resolveDateValue("")).toBeNull();
    expect(resolveDateValue("31-Xxx-99")).toBeNull();
  });
});

d("running the templates", () => {
  it("serves all 29 with captions for prompting", async () => {
    const body = (await app.inject({ url: `/entry/wellview/dbs/${DB}/queries`, headers: auth })).json() as
      { queries: { id: string; category: string; criteria: { fieldLabel: string; prompts: boolean }[] }[] };
    expect(body.queries.length).toBe(29);
    expect(new Set(body.queries.map((q) => q.category)).size).toBe(5);
    // Captions come from the data model, not the raw column name.
    const bits = body.queries.find((q) => q.id.endsWith("/Bits"))!;
    expect(bits.criteria[0].fieldLabel).toBe("Make");
    expect(bits.criteria[0].prompts).toBe(true);
  });

  it("runs every template without error, supplying prompts", async () => {
    const { queries } = (await app.inject({ url: `/entry/wellview/dbs/${DB}/queries`, headers: auth })).json() as
      { queries: { id: string; criteria: { prompts: boolean; isDate: boolean }[] }[] };

    const failures: string[] = [];
    for (const q of queries) {
      // Fill every prompt: a date gets a wide-open range, text gets a letter.
      const values: Record<string, string> = {};
      q.criteria.forEach((c, i) => {
        if (!c.prompts) return;
        values[String(i)] = c.isDate ? "1900-01-01" : "a";
      });
      const res = await app.inject({
        method: "POST",
        url: `/entry/wellview/dbs/${DB}/queries/run`,
        headers: auth,
        payload: { id: q.id, values },
      });
      if (res.statusCode !== 200) { failures.push(`${q.id}: ${res.statusCode} ${res.body.slice(0, 120)}`); continue; }
      const body = res.json() as { wells: unknown[]; skipped: { reason: string }[]; ran: number };
      // Something must have been applied — a query that silently applied nothing
      // would return every well and look like a working search.
      if (body.ran === 0) failures.push(`${q.id}: no criterion applied (${body.skipped.map((s) => s.reason).join("; ")})`);
    }
    expect(failures, failures.join("\n")).toEqual([]);
  }, 120_000);

  it("actually filters — and narrows further as criteria are added", async () => {
    const total = ((await app.inject({ url: `/entry/wellview/dbs/${DB}/wells`, headers: auth })).json() as
      { wells: unknown[] }).wells.length;

    // "Wellbore Profile" prompts for a profile type; a real one matches some
    // wells, and a nonsense one matches none.
    const run = async (v: string) => ((await app.inject({
      method: "POST", url: `/entry/wellview/dbs/${DB}/queries/run`, headers: auth,
      payload: { id: "General/Wellbore Profile", values: { "0": v } },
    })).json() as { wells: unknown[] }).wells.length;

    const vertical = await run("vertical");
    expect(vertical).toBeGreaterThan(0);
    expect(vertical).toBeLessThan(total);
    expect(await run("zzzz-no-such-profile")).toBe(0);
  });

  it("reports a criterion it cannot apply instead of dropping it", async () => {
    // A prompt left empty is not silently ignored — it is reported, because a
    // query that quietly drops half its criteria returns too many wells.
    const res = (await app.inject({
      method: "POST", url: `/entry/wellview/dbs/${DB}/queries/run`, headers: auth,
      payload: { id: "Drilling/Bits", values: {} },
    })).json() as { skipped: { criterion: string; reason: string }[]; ran: number };
    expect(res.skipped.length).toBeGreaterThan(0);
    expect(res.skipped[0].reason).toMatch(/no value/i);
    expect(res.ran).toBe(0);
  });
});
