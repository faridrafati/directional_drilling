/**
 * Peloton.Dictionary.dct — decoded, measured, and deliberately not shipped.
 *
 * WellView ships a spell-check word list, and its guide describes a field-level
 * on-demand check: "Select the field… Click the Spelling button… Click Ignore
 * to leave the selected word as it is." A browser already does exactly that,
 * from a dictionary the user can extend, so the only question worth asking is
 * whether Peloton's list is BETTER than the browser's for this data.
 *
 * It is not, on two independent grounds, and this test pins both so the
 * decision does not get quietly revisited:
 *
 * 1. LICENCE. The archive's own copyright.txt grants distribution only "with
 *    any applications that use the C1SpellChecker component". This is a browser
 *    application and uses no such component, so shipping the word list is
 *    outside the stated grant.
 *
 * 2. IT WOULD HARM. Expanded, the list is 118,062 words of general English —
 *    and against this database's own free text it flags 12.9% of words, almost
 *    all of them correct: tbg, rih, csg, jts, bha, toh, mkb, kPa, and the
 *    proper nouns Schlumberger and Cardium. A red line under the most common
 *    words a driller types is worse than no spell-check at all.
 *
 * What the app does instead: browser spellcheck, switched on where prose lives
 * and off on the 2,031 coded fields where it is noise. Until this landed the
 * app named the attribute nowhere, so the browser ran it on every cell —
 * including the ones holding "S", "6" and "100/04-14-018-25W4/00".
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateRawSync } from "node:zlib";
import { DatabaseSync } from "node:sqlite";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..", "..");
const DCT = join(ROOT, "WellView_files", "system", "Peloton.Dictionary.dct");
const SAMPLE = join(ROOT, "sqlite_DB", "wellview", "wv9.0_Sample.sqlite");
const d = describe.skipIf(!existsSync(DCT) || !existsSync(SAMPLE));

/** The archive's entries, unpacked without shelling out to unzip. */
function entries(): Map<string, Buffer> {
  const b = readFileSync(DCT);
  const out = new Map<string, Buffer>();
  let i = 0;
  while (i < b.length - 4) {
    if (b.readUInt32LE(i) !== 0x04034b50) { i++; continue; }
    const method = b.readUInt16LE(i + 8);
    const csize = b.readUInt32LE(i + 18);
    const nlen = b.readUInt16LE(i + 26);
    const elen = b.readUInt16LE(i + 28);
    const name = b.subarray(i + 30, i + 30 + nlen).toString("latin1");
    const at = i + 30 + nlen + elen;
    const raw = b.subarray(at, at + csize);
    out.set(name, method === 8 ? inflateRawSync(raw) : raw);
    i = at + csize;
  }
  return out;
}

let words: Set<string>;
let db: DatabaseSync;

beforeAll(() => {
  const e = entries();
  const list = e.get("en-US.words")!.toString("latin1").split(/\r?\n/).filter(Boolean);
  /*
   * The format is "base suffix1 suffix2 …" and each suffix is APPENDED, not
   * substituted — "drill able down ed er ing" yields drilling, "petrol atum
   * eum" yields petroleum. Irregular forms get their own line, which is why
   * plain appending is the whole rule.
   */
  words = new Set();
  for (const l of list) {
    const [base, ...sfx] = l.split(/\s+/);
    words.add(base.toLowerCase());
    for (const s of sfx) words.add((base + s).toLowerCase());
  }
  db = new DatabaseSync(SAMPLE, { readOnly: true });
});
afterAll(() => { db?.close(); });

d("the vendor spelling dictionary", () => {
  it("holds a general-English list, larger than its line count suggests", () => {
    const e = entries();
    expect([...e.keys()].sort()).toEqual(["copyright.txt", "en-US.words"]);
    const lines = e.get("en-US.words")!.toString("latin1").split(/\r?\n/).filter(Boolean).length;
    expect(lines).toBe(63400);
    // Expanded through the suffixes it is nearly twice that. The line count is
    // not the vocabulary, which is the mistake an earlier note made.
    expect(words.size).toBe(118062);
    for (const w of ["drilling", "petroleum", "wellheads", "abbesses"]) {
      expect(words.has(w), `${w} is reachable through a suffix`).toBe(true);
    }
  });

  it("is licensed only for use with the component this app does not use", () => {
    const c = entries().get("copyright.txt")!.toString("latin1");
    expect(c).toContain("C1SpellChecker");
    expect(c).toContain("may be distributed with any applications that use");
    // The grant is conditional on that component. A browser app satisfies no
    // part of it, which settles the question before the measurement does.
  });

  it("does carry oil-field vocabulary — the earlier note said it carried none", () => {
    const present = ["casing", "tubing", "packer", "annulus", "derrick", "dogleg", "azimuth",
      "wellhead", "sidetrack", "porosity", "permeability", "reservoir", "viscosity", "perforation"];
    for (const w of present) expect(words.has(w), `${w} IS in the dictionary`).toBe(true);
  });

  it("does not contain the word the whole application is about", () => {
    // "wellbore" appears 248 times across the model's labels, Peloton's own
    // field help and the sample's free text — 187 of those in the help Peloton
    // wrote — and their dictionary has no entry for it. A checker built on this
    // list would underline it every time.
    expect(words.has("wellbore")).toBe(false);
    expect(words.has("downhole")).toBe(false);
    expect(words.has("workover")).toBe(false);
  });

  it("would nonetheless flag one word in eight, almost all of them correct", () => {
    // The measurement that decides it. Real free text from this database.
    const SRC: [string, string][] = [
      ["wvJobReportTimeLog", "Com"], ["wvJob", "Summary"], ["wvJobReport", "SummaryOps"],
      ["wvJobReportMudChk", "Com"], ["wvPerforation", "Com"], ["wvStimTreat", "Com"], ["wvLog", "Com"],
    ];
    const freq = new Map<string, number>();
    let total = 0;
    for (const [t, c] of SRC) {
      let rows: { v: string }[] = [];
      try {
        rows = db.prepare(`SELECT "${c}" v FROM "${t}" WHERE "${c}" IS NOT NULL AND "${c}" <> ''`)
          .all() as { v: string }[];
      } catch { continue; }
      for (const r of rows) {
        for (const w of String(r.v).split(/[^A-Za-z']+/)) {
          if (w.length < 3 || /^\d/.test(w)) continue;
          total++;
          const lw = w.toLowerCase();
          if (!words.has(lw)) freq.set(lw, (freq.get(lw) ?? 0) + 1);
        }
      }
    }
    const flagged = [...freq.values()].reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThan(50_000);
    // Above roughly one in ten, a spell-checker costs more attention than it
    // saves. This lands at about one in eight.
    expect(flagged / total).toBeGreaterThan(0.12);

    // …and the worst offenders are the vocabulary itself, not typos.
    const top = [...freq].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([w]) => w);
    for (const w of ["tbg", "rih", "csg", "jts", "bha"]) {
      expect(top, `${w} is among the most-flagged words`).toContain(w);
    }
  }, 120_000);
});
