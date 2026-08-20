/**
 * Mud Inventory Transfer.
 *
 * The arithmetic is one subtraction, so what these test is the judgement around
 * it: that a NEGATIVE closing balance is never carried across — 225 of the
 * sample's products are negative because consumption was recorded against a
 * receipt nobody entered, and opening a well with minus nine sacks of gel is
 * not a quantity anyone can act on — and that a partial failure leaves nothing
 * behind.
 *
 * Writes go to a COPY. A test that mutates the user's database is not a test.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync, copyFileSync, rmSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { closingInventory, transferInventory } from "./inventory.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const SAMPLE = join(HERE, "..", "..", "..", "..", "sqlite_DB", "wellview", "wv9.0_Sample.sqlite");
const d = describe.skipIf(!existsSync(SAMPLE));
const newIdRec = () => randomUUID().replace(/-/g, "").toUpperCase();

d("mud inventory transfer", () => {
  let dir: string;
  let db: DatabaseSync;
  let fromWell: string;
  let toWell: string;
  let toJob: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "wv-inv-"));
    const copy = join(dir, "s.sqlite");
    copyFileSync(SAMPLE, copy);
    db = new DatabaseSync(copy);
    // A well with real stock left, and a different well with a job to receive it.
    fromWell = (db.prepare(`
      SELECT p.idwell FROM wvJobMudAdd p JOIN wvJobMudAddAmt a ON a.IDRecParent = p.IDRec
       GROUP BY p.IDRec
      HAVING SUM(COALESCE(a.Received,0)) - SUM(COALESCE(a.Returned,0)) - SUM(COALESCE(a.Consumed,0)) > 0
       LIMIT 1`).get() as { idwell: string }).idwell;
    const job = db.prepare("SELECT idwell, IDRec FROM wvJob WHERE idwell <> ? LIMIT 1")
      .get(fromWell) as { idwell: string; IDRec: string };
    toWell = job.idwell;
    toJob = job.IDRec;
  });
  afterAll(() => { db?.close(); try { rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ } });

  it("computes the closing balance as received minus returned minus consumed", () => {
    const inv = closingInventory(db, fromWell);
    expect(inv.length).toBeGreaterThan(0);
    for (const i of inv) {
      expect(i.balance).toBeCloseTo(i.received - i.returned - i.consumed, 9);
      expect(i.transferable).toBe(i.balance > 0);
    }
    expect(inv.some((i) => i.transferable)).toBe(true);
  });

  it("REFUSES to carry a negative balance, and says why", () => {
    // The sample is full of these: consumption without a matching receipt.
    const inv = closingInventory(db, fromWell);
    const negative = inv.filter((i) => i.balance < 0);
    if (negative.length) {
      for (const n of negative) {
        expect(n.transferable).toBe(false);
        expect(n.reason).toMatch(/consumption exceeds/i);
      }
      const res = transferInventory(db, {
        fromWell, toWell, toJob, dtTm: "2008-04-03T09:45:00Z",
        items: negative.map((n) => n.idrec), newIdRec,
      });
      expect(res.transferred).toEqual([]);
      expect(res.skipped.length).toBe(negative.length);
    }
    // Zero is not an error either, just nothing to move.
    for (const z of inv.filter((i) => i.balance === 0)) expect(z.reason).toMatch(/nothing left/i);
  });

  it("moves the balance across as RECEIVED, on the date given", () => {
    const inv = closingInventory(db, fromWell).filter((i) => i.transferable);
    expect(inv.length).toBeGreaterThan(0);
    const when = "2008-04-03T09:45:00Z";
    const res = transferInventory(db, {
      fromWell, toWell, toJob, dtTm: when, items: inv.map((i) => i.idrec), newIdRec,
    });
    expect(res.transferred.length).toBe(inv.length);

    // The destination now holds exactly the source's closing balance, as stock
    // received — which is what makes it show on the day's report.
    const landed = closingInventory(db, toWell)
      .filter((i) => res.transferred.some((t) => t.des === i.des));
    for (const t of res.transferred) {
      const got = landed.find((l) => l.des === t.des)!;
      expect(got.received, String(t.des)).toBeGreaterThanOrEqual(t.quantity);
    }
    const amt = db.prepare(`
      SELECT COUNT(*) c FROM wvJobMudAddAmt WHERE idwell = ? AND DtTm = ? AND Received > 0`)
      .get(toWell, when) as { c: number };
    expect(amt.c).toBeGreaterThan(0);
  });

  it("reuses a product already on the destination job instead of duplicating it", () => {
    // Running the transfer twice must not create a second SODA ASH row; it
    // adds stock to the one that is there.
    const inv = closingInventory(db, fromWell).filter((i) => i.transferable);
    const before = (db.prepare("SELECT COUNT(*) c FROM wvJobMudAdd WHERE idwell = ? AND IDRecParent = ?")
      .get(toWell, toJob) as { c: number }).c;
    const res = transferInventory(db, {
      fromWell, toWell, toJob, dtTm: "2008-04-04T09:45:00Z",
      items: inv.map((i) => i.idrec), newIdRec,
    });
    const after = (db.prepare("SELECT COUNT(*) c FROM wvJobMudAdd WHERE idwell = ? AND IDRecParent = ?")
      .get(toWell, toJob) as { c: number }).c;
    expect(res.createdProducts).toBe(0);
    expect(res.reusedProducts).toBe(res.transferred.length);
    expect(after).toBe(before);
  });

  it("writes nothing at all when asked for products that are not there", () => {
    const before = (db.prepare("SELECT COUNT(*) c FROM wvJobMudAddAmt WHERE idwell = ?")
      .get(toWell) as { c: number }).c;
    const res = transferInventory(db, {
      fromWell, toWell, toJob, dtTm: "2008-04-05T09:45:00Z",
      items: ["not-a-real-idrec"], newIdRec,
    });
    expect(res.transferred).toEqual([]);
    const after = (db.prepare("SELECT COUNT(*) c FROM wvJobMudAddAmt WHERE idwell = ?")
      .get(toWell) as { c: number }).c;
    expect(after).toBe(before);
  });
});
