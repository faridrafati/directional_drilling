/**
 * Quick Query, and the date tags it accepts.
 *
 * Two small divergences from the guide, both of which produced a confident
 * wrong answer rather than an error.
 *
 * SPACES. §"What's New in WellView 9.0": "You can now search applicable fields
 * for multiple criteria in quick queries. Enter the words separated by a space.
 * Each well, site, or rig meeting each search criteria appears in the results."
 * The app matched the whole string, so the guide's own worked example — Well
 * Name containing "1 sample" — returned nothing at all.
 *
 * DATE TAGS. The guide documents `<utcnow>` and `<utctoday>` alongside `<now>`
 * and `<today>`, with worked examples. Only two spellings were matched, and an
 * unmatched criterion was dropped WHILE THE REST OF THE QUERY STILL RAN — so a
 * user asking for the last ten days got a list scoped by everything except the
 * date.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Fastify, { type FastifyInstance } from "fastify";
import { registerWellviewDbRoutes } from "../routes/wellviewDb.js";
import { resolveDateValue } from "../routes/wellviewDb.js";
import { issueToken } from "../entry/auth.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const SAMPLE = join(HERE, "..", "..", "..", "..", "sqlite_DB", "wellview", "wv9.0_Sample.sqlite");
const DB = "wv9.0_Sample";
const d = describe.skipIf(!existsSync(SAMPLE));

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

const search = async (lookin: string, lookfor: string) => {
  const res = await app.inject({
    url: `/entry/wellview/dbs/${DB}/wells?lookin=${lookin}&lookfor=${encodeURIComponent(lookfor)}`,
    headers: auth,
  });
  expect(res.statusCode).toBe(200);
  return (res.json() as { wells: { WellName: string }[] }).wells;
};

d("Quick Query treats spaces as separate criteria", () => {
  it("finds the wells the guide's own example prints", async () => {
    // The guide searches Well Name for "1 sample" and lists thirteen wells,
    // beginning "Sample 01 - Rod pump well with good history & pics".
    const hits = await search("WellName", "1 sample");
    const names = hits.map((w) => w.WellName);
    expect(names.length).toBeGreaterThanOrEqual(13);
    for (const n of names) {
      expect(n.toLowerCase(), n).toContain("1");
      expect(n.toLowerCase(), n).toContain("sample");
    }
    expect(names).toContain("Sample 01 - Rod pump well with good history & pics");
    expect(names).toContain("Sample 31 - Public Data Import");
    // …and the well that has "sample" but no "1" is correctly absent.
    expect(names.some((n) => /^Sample 2[02356789]/.test(n))).toBe(false);
  });

  it("still matches a single word exactly as before", async () => {
    const one = await search("WellName", "Plunger");
    expect(one.length).toBeGreaterThan(0);
    for (const w of one) expect(w.WellName.toLowerCase()).toContain("plunger");
  });

  it("treats an all-whitespace search as no search", async () => {
    const blank = await search("WellName", "   ");
    const all = await search("WellName", "");
    expect(blank.length).toBe(all.length);
    expect(blank.length).toBeGreaterThan(30);
  });
});

describe("the guide's four date tags", () => {
  const at = new Date("2026-08-23T14:30:00Z");

  it("reads the UTC spellings as well as the plain ones", () => {
    // The function already computes in UTC throughout — setUTCHours for the day
    // boundary, toISOString for the result — so these are true aliases. The
    // only bug was refusing to read two of the four spellings.
    expect(resolveDateValue("<utcnow>", at)).toBe(resolveDateValue("<now>", at));
    expect(resolveDateValue("<utctoday>", at)).toBe(resolveDateValue("<today>", at));
    expect(resolveDateValue("<now>", at)).toBe("2026-08-23T14:30:00Z");
    expect(resolveDateValue("<today>", at)).toBe("2026-08-23T00:00:00Z");
  });

  it("carries the offset the guide's examples use", () => {
    // The guide's own worked examples are <utcnow>-10 and <utctoday>-5.
    expect(resolveDateValue("<utcnow>-10", at)).toBe("2026-08-13T14:30:00Z");
    expect(resolveDateValue("<utctoday>-5", at)).toBe("2026-08-18T00:00:00Z");
    expect(resolveDateValue("<utctoday> + 1.5", at)).toBe("2026-08-24T12:00:00Z");
  });

  it("still refuses a tag it does not know", () => {
    // Refusing is right; the danger was refusing one of the FOUR documented
    // spellings and then running the rest of the query anyway.
    expect(resolveDateValue("<yesterday>", at)).toBeNull();
    expect(resolveDateValue("<utc>", at)).toBeNull();
    expect(resolveDateValue("not a date", at)).toBeNull();
  });
});
