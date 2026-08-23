/**
 * The approved lists that name a TABLE, not a value.
 *
 * 22 fields carry a list stated in Peloton's own data model rather than in an
 * encrypted library. Most entries are one string doing two jobs — the value
 * stored and the caption shown. The `mdllistwithtables` ones are not:
 *
 *   <afmfieldlookuplist listitem="Packer" idrectable="wvTubCompPacker" />
 *
 * WellView stores `wvTubCompPacker` in the column and shows "Packer". The
 * builder used to keep only `listitem`, which lost the stored value for exactly
 * the entries that have one — so the app printed a raw table name where the
 * desktop shows a caption, and writing the caption back produced a row the
 * desktop cannot map to its detail table.
 *
 * The data is what settles it. wvTubComp.CompSubTyp is decisive on its own —
 * 123 rows hold table names (`wvtubcomppacker` x27, `wvtubcompmandrel` x18) and
 * not one holds the matching caption, while entries with no table ("Tubing",
 * "Nipple") appear only as captions. It is not uniformly tidy across every
 * column, and the tests below say exactly where it is and is not.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..", "..", "..");
const MODEL = join(REPO, "apps", "web", "public", "wellview-templates", "datamodel.json");
const SAMPLE = join(REPO, "sqlite_DB", "wellview", "wv9.0_Sample.sqlite");

type Item = string | { value: string; label: string };
const d = describe.skipIf(!existsSync(MODEL));

function lists(): { table: string; field: string; items: Item[] }[] {
  const dm = JSON.parse(readFileSync(MODEL, "utf8"));
  const out: { table: string; field: string; items: Item[] }[] = [];
  for (const [table, T] of Object.entries<any>(dm.tables)) {
    for (const [field, f] of Object.entries<any>(T.fields)) {
      if (f.modelList?.length) out.push({ table, field, items: f.modelList });
    }
  }
  return out;
}

d("the model's own approved lists", () => {
  it("keeps the table name where an entry has one", () => {
    const all = lists();
    expect(all.length).toBe(22);
    const pairs = all.flatMap((l) => l.items).filter((i) => typeof i !== "string");
    // 58 of the 119 entries name a detail table. Dropping them was the bug.
    expect(pairs.length).toBe(58);
    for (const p of pairs as { value: string; label: string }[]) {
      expect(p.value, p.label).toMatch(/^wv/i);
      expect(p.label).not.toBe(p.value);
    }

    const tub = all.find((l) => l.table === "wvtubcomp" && l.field === "compsubtyp")!;
    expect(tub.items).toContainEqual({ value: "wvTubCompPacker", label: "Packer" });
    // …and an entry with no detail table stays a plain string.
    expect(tub.items).toContain("Tubing");
  });

  it.skipIf(!existsSync(SAMPLE))("matches how the database actually stores them", () => {
    // The claim under test: a table-backed entry is stored as its TABLE name.
    // Checked against real rows rather than assumed, because getting this
    // backwards would corrupt every row written.
    //
    // The vendor's own data is not perfectly tidy about it. wvTubComp.CompSubTyp
    // is clean — 123 rows hold table names and not one holds the matching
    // caption — but wvJobDrillStringComp.CompSubTyp holds
    // `wvjobdrillstringcompvgs` AND `Stabilizer`, the table name and the caption
    // for the same entry, alongside import junk like "0, BS, BS". So the test
    // asserts what is true across the data — the table-name form is the one in
    // use — and pins the clean case exactly, rather than pretending the messy
    // one is clean.
    const db = new DatabaseSync(SAMPLE, { readOnly: true });
    try {
      const real = new Map(
        (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[])
          .map((r) => [r.name.toLowerCase(), r.name]));

      const storedFor = (table: string, field: string): string[] | null => {
        const t = real.get(table);
        if (!t) return null;
        const cols = (db.prepare("SELECT name FROM pragma_table_info(?)").all(t) as { name: string }[])
          .map((c) => c.name);
        const col = cols.find((c) => c.toLowerCase() === field);
        if (!col) return null;
        return (db.prepare(
          `SELECT DISTINCT lower("${col}") v FROM "${t}" WHERE "${col}" IS NOT NULL AND "${col}" <> ''`,
        ).all() as { v: string }[]).map((r) => r.v);
      };

      let asTableName = 0;
      let asCaption = 0;
      for (const l of lists()) {
        const stored = storedFor(l.table, l.field);
        if (!stored) continue;
        for (const i of l.items) {
          if (typeof i === "string") {
            if (stored.includes(i.toLowerCase())) asCaption++;
          } else if (stored.includes(i.value.toLowerCase())) {
            asTableName++;
          }
        }
      }
      // Both forms are genuinely present, so both halves of the mapping are
      // proven by data rather than merely un-contradicted.
      expect(asTableName).toBeGreaterThan(5);
      expect(asCaption).toBeGreaterThan(5);

      // The clean case, pinned exactly: every table-backed entry of
      // wvTubComp.CompSubTyp is stored as its table name and NEVER as its
      // caption. This is the column the fix was found on.
      const tub = storedFor("wvtubcomp", "compsubtyp")!;
      const tubItems = lists().find((l) => l.table === "wvtubcomp" && l.field === "compsubtyp")!.items;
      const backed = tubItems.filter((i) => typeof i !== "string") as { value: string; label: string }[];
      const present = backed.filter((i) => tub.includes(i.value.toLowerCase()));
      expect(present.length).toBeGreaterThan(5);
      for (const i of present) {
        expect(tub, `wvTubComp.CompSubTyp "${i.label}"`).not.toContain(i.label.toLowerCase());
      }
    } finally { db.close(); }
  });
});
