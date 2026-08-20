/**
 * Who may reach the WellView databases.
 *
 * `requireUser` authenticates and does not authorise, and this module has no
 * per-well scoping to fall back on — a WellView well is an idwell GUID inside
 * an imported .sqlite, with no column joining it to the EntryWell records that
 * assignments are made against. So the whole module is admin-only by default,
 * and these prove it: a company man is refused, an admin is not, and the
 * escape hatch is a deliberate opt-in rather than the default.
 *
 * The route that matters most is export — one request, an entire well.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { registerWellviewDbRoutes } from "./wellviewDb.js";
import { issueToken } from "../entry/auth.js";

let app: FastifyInstance;
let adminAuth: { Authorization: string };
let manAuth: { Authorization: string };

beforeAll(async () => {
  app = Fastify();
  await registerWellviewDbRoutes(app);
  await app.ready();
  adminAuth = { Authorization: `Bearer ${issueToken({ id: "a", username: "admin", role: "admin" }).token}` };
  manAuth = { Authorization: `Bearer ${issueToken({ id: "c", username: "man", role: "companyman" }).token}` };
});
afterAll(async () => { await app?.close(); });

/** Every shape of access this module offers, including the dangerous ones. */
const ROUTES = [
  { method: "GET" as const, url: "/entry/wellview/dbs" },
  { method: "GET" as const, url: "/entry/wellview/dbs/wv9.0_Sample/wells" },
  { method: "GET" as const, url: "/entry/wellview/dbs/wv9.0_Sample/export?idwell=x" },
  { method: "GET" as const, url: "/entry/wellview/dbs/wv9.0_Sample/attachments?idwell=x" },
  { method: "POST" as const, url: "/entry/wellview/dbs/wv9.0_Sample/import", payload: {} },
];

describe("WellView database access", () => {
  it("refuses a company man on every route, including export", async () => {
    for (const r of ROUTES) {
      const res = await app.inject({ ...r, headers: manAuth });
      expect(res.statusCode, `${r.method} ${r.url}`).toBe(403);
      expect(res.json(), r.url).toMatchObject({ error: "admin only" });
    }
  });

  it("still refuses an unauthenticated caller, and says so differently", async () => {
    // 401 and 403 are different facts; conflating them hides which is wrong.
    const res = await app.inject({ method: "GET", url: "/entry/wellview/dbs" });
    expect(res.statusCode).toBe(401);
  });

  it("lets an admin through", async () => {
    const res = await app.inject({ method: "GET", url: "/entry/wellview/dbs", headers: adminAuth });
    expect(res.statusCode).toBe(200);
    // …and the ones that need real data may 404, but never 403.
    for (const r of ROUTES) {
      const got = await app.inject({ ...r, headers: adminAuth });
      expect(got.statusCode, `${r.method} ${r.url}`).not.toBe(403);
    }
  });
});
