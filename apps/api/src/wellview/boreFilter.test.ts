/**
 * The schematic's wellbore selector, and the two layers it never reached.
 *
 * Choosing a wellbore is meant to draw that wellbore. Two of the layers were
 * never filtered by it, so on the three sample wells that carry a second bore
 * the sidetrack's hole profile was drawn over the original's — and the other
 * way round — whatever the selector said.
 *
 * The cause is a column-name mismatch, which is why it was invisible: the
 * filter reads `IDRecWellBore`, and wvWellboreSize does not have one. A hole
 * section hangs off its bore by `IDRecParent`. The filter's own "no link, so it
 * belongs to every bore" rule then passed EVERY size row through. Zones were a
 * plainer omission — they carry `IDRecWellBore` and were simply never asked.
 *
 * This test pins the DATA: which column each table links by, and how many rows
 * were being drawn on the wrong bore. The drawing itself is checked in the
 * browser, where selecting each bore now yields a different picture.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const HERE = dirname(fileURLToPath(import.meta.url));
const SAMPLE = join(HERE, "..", "..", "..", "..", "sqlite_DB", "wellview", "wv9.0_Sample.sqlite");
const d = describe.skipIf(!existsSync(SAMPLE));

let db: DatabaseSync;
beforeAll(() => { db = new DatabaseSync(SAMPLE, { readOnly: true }); });
afterAll(() => { db?.close(); });

const cols = (t: string) => {
  const st = db.prepare(`SELECT * FROM "${t}" LIMIT 1`) as unknown as
    { columns(): { name: string }[] };
  return st.columns().map((c) => c.name);
};

d("the schematic's wellbore filter", () => {
  it("must key hole sections on IDRecParent, because they have no IDRecWellBore", () => {
    // The mismatch that made the filter a no-op on this layer.
    const size = cols("wvWellboreSize").map((c) => c.toLowerCase());
    expect(size).toContain("idrecparent");
    expect(size).not.toContain("idrecwellbore");

    // …while zones do carry the ordinary column and were simply never filtered.
    const zone = cols("wvZone").map((c) => c.toLowerCase());
    expect(zone).toContain("idrecwellbore");
  });

  it("changes what is drawn on every well that has a second wellbore", () => {
    const wells = db.prepare(
      "SELECT idwell, COUNT(*) n FROM wvWellbore GROUP BY idwell HAVING n > 1").all() as
      { idwell: string; n: number }[];
    expect(wells.length, "wells with more than one wellbore").toBe(3);

    let sections = 0, zones = 0;
    for (const w of wells) {
      const bores = db.prepare("SELECT IDRec FROM wvWellbore WHERE idwell = ?")
        .all(w.idwell) as { IDRec: string }[];
      for (const b of bores) {
        sections += (db.prepare(
          "SELECT COUNT(*) c FROM wvWellboreSize WHERE idwell = ? AND IDRecParent <> ?")
          .get(w.idwell, b.IDRec) as { c: number }).c;
        zones += (db.prepare(`SELECT COUNT(*) c FROM wvZone
          WHERE idwell = ? AND IDRecWellBore IS NOT NULL AND IDRecWellBore <> ?`)
          .get(w.idwell, b.IDRec) as { c: number }).c;
      }
    }
    // Summed over each bore the user could select: what used to be drawn on a
    // bore it does not belong to.
    expect(sections, "hole sections drawn on the wrong bore").toBe(10);
    expect(zones, "zones drawn on the wrong bore").toBe(6);
  });

  it("leaves single-bore wells untouched, which is most of them", () => {
    const single = db.prepare(`SELECT COUNT(*) c FROM (
      SELECT idwell FROM wvWellbore GROUP BY idwell HAVING COUNT(*) = 1)`).get() as { c: number };
    expect(single.c).toBeGreaterThan(30);
    // With one bore the filter's chain contains it, so every row passes either
    // way — the fix can only change the three wells above.
  });
});
