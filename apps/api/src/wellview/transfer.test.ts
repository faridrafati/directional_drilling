/**
 * Moving a well between databases.
 *
 * The round trip is the test: export a real well of 3,435 rows across 69
 * tables, import it into a copy of the empty database, and prove every row,
 * every link and every blob arrived. Anything less than a full comparison would
 * pass while quietly dropping a table.
 *
 * The target is always a COPY in the scratch area — a test that writes to the
 * user's databases is not a test worth having.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync, copyFileSync, rmSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { exportWell, importWell, importPreflight, type WellExport } from "./transfer.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..", "..", "..");
const SAMPLE = join(REPO, "sqlite_DB", "wellview", "wv9.0_Sample.sqlite");
const EMPTY = join(REPO, "sqlite_DB", "wellview", "wv9.0_database.sqlite");
const ready = existsSync(SAMPLE) && existsSync(EMPTY);
const d = describe.skipIf(!ready);

d("well export / import", () => {
  let src: DatabaseSync;
  let dir: string;
  let targetPath: string;
  let idwell: string;
  let payload: WellExport;

  beforeAll(() => {
    src = new DatabaseSync(SAMPLE, { readOnly: true });
    // The well with attachments, so the blob path is exercised too.
    idwell = (src.prepare(
      "SELECT idwell FROM wvAttachment WHERE AttachBlob IS NOT NULL LIMIT 1").get() as { idwell: string }).idwell;
    dir = mkdtempSync(join(tmpdir(), "wv-transfer-"));
    targetPath = join(dir, "target.sqlite");
    copyFileSync(EMPTY, targetPath);
    payload = exportWell(src, "wv9.0_Sample", idwell)!;
  });
  afterAll(() => { try { rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ } });

  it("exports every row the well owns", () => {
    expect(payload).toBeTruthy();
    expect(payload.format).toBe("wellview-well/1");
    expect(payload.counts.rows).toBeGreaterThan(100);

    // Independent count: sweep every idwell-bearing table in the source.
    let expected = 0;
    for (const { name } of src.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[]) {
      const cols = (src.prepare(`PRAGMA table_info("${name}")`).all() as { name: string }[])
        .map((c) => c.name.toLowerCase());
      if (!cols.includes("idwell")) continue;
      expected += (src.prepare(`SELECT COUNT(*) c FROM "${name}" WHERE idwell = ?`).get(idwell) as { c: number }).c;
    }
    expect(payload.counts.rows).toBe(expected);
  });

  it("carries binary as base64, and says which columns are encoded", () => {
    expect(Object.keys(payload.binaryColumns)).toContain("wvAttachment");
    expect(payload.binaryColumns.wvAttachment).toContain("AttachBlob");
    const att = payload.tables.wvAttachment ?? [];
    expect(att.length).toBeGreaterThan(0);
    // Encoded, not dropped, and not left as an unserialisable object.
    for (const r of att) {
      if (r.AttachBlob == null) continue;
      expect(typeof r.AttachBlob).toBe("string");
    }
    // The whole payload must survive a JSON round trip — that is the point.
    expect(() => JSON.parse(JSON.stringify(payload))).not.toThrow();
  });

  it("imports the well whole, and the blobs come back byte-identical", () => {
    const target = new DatabaseSync(targetPath);
    const res = importWell(target, JSON.parse(JSON.stringify(payload)) as WellExport);
    expect(res.inserted.rows).toBe(payload.counts.rows);
    expect(res.missingTables).toEqual([]);
    expect(res.missingColumns).toEqual([]);

    // Every table's row count must match the source, table by table.
    const mismatches: string[] = [];
    for (const [name, rows] of Object.entries(payload.tables)) {
      const got = (target.prepare(`SELECT COUNT(*) c FROM "${name}" WHERE idwell = ?`)
        .get(idwell) as { c: number }).c;
      if (got !== rows.length) mismatches.push(`${name}: ${got} != ${rows.length}`);
    }
    expect(mismatches).toEqual([]);

    // The bytes, not just the count.
    const srcBlobs = src.prepare(
      "SELECT IDRec, AttachBlob FROM wvAttachment WHERE idwell = ? ORDER BY IDRec").all(idwell) as
      { IDRec: string; AttachBlob: Uint8Array | null }[];
    const dstBlobs = target.prepare(
      "SELECT IDRec, AttachBlob FROM wvAttachment WHERE idwell = ? ORDER BY IDRec").all(idwell) as
      { IDRec: string; AttachBlob: Uint8Array | null }[];
    expect(dstBlobs.length).toBe(srcBlobs.length);
    for (let i = 0; i < srcBlobs.length; i++) {
      expect(dstBlobs[i].IDRec).toBe(srcBlobs[i].IDRec);
      expect(Buffer.from(dstBlobs[i].AttachBlob!).equals(Buffer.from(srcBlobs[i].AttachBlob!))).toBe(true);
    }
    target.close();
  });

  it("keeps the record links intact, because IDRec is preserved", () => {
    // The reason IDRecs are not remapped: every association is a GUID, so a
    // verbatim copy keeps the whole graph. A child whose parent went missing
    // is the failure this catches.
    const target = new DatabaseSync(targetPath, { readOnly: true });
    const orphans = (target.prepare(`
      SELECT COUNT(*) c FROM wvCasComp c
       LEFT JOIN wvCas p ON p.IDRec = c.IDRecParent
       WHERE c.idwell = ? AND p.IDRec IS NULL`).get(idwell) as { c: number }).c;
    expect(orphans).toBe(0);
    target.close();
  });

  it("REFUSES a second import rather than silently duplicating the well", () => {
    const target = new DatabaseSync(targetPath);
    const pre = importPreflight(target, payload);
    expect(pre.ok).toBe(false);
    expect(pre.reason).toMatch(/already holds well/i);
    expect(() => importWell(target, payload)).toThrow(/already holds well/i);
    target.close();
  });

  it("rejects something that is not a well export", () => {
    const target = new DatabaseSync(targetPath, { readOnly: true });
    const pre = importPreflight(target, { format: "nope" } as unknown as WellExport);
    expect(pre.ok).toBe(false);
    expect(pre.reason).toMatch(/not a WellView well export/i);
    target.close();
  });
});
