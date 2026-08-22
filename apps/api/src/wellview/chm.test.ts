/**
 * `Peloton.WellView.help.chm` — WellView's own user guide, and whether the
 * decode of it can be trusted.
 *
 * This matters more than a normal format test. A broken LZX decode does not
 * produce garbage; it produces fluent English from the wrong topic. An earlier
 * version of this decoder recovered 92 of 330 topics correctly and the other
 * 238 read as plausible prose — `ReferenceDatum.html` contained "Working with
 * Well Files", and nothing about the text looked wrong. Anything quoted from a
 * decode like that is fabrication wearing Peloton's voice.
 *
 * So the bar is: not "does it decode", but "can every byte be proven". Three
 * independent proofs, all of which must pass:
 *
 *   - the encoder's own reset table says where it restarted, and every interval
 *     must finish exactly there;
 *   - every HTML topic must be well-formed at the offset the directory gives;
 *   - every embedded image must carry its format's magic bytes.
 *
 * Skips cleanly when the vendor tree is absent, which a clean checkout is.
 */
import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..", "..", "..");
const CHM = join(REPO, "WellView_files", "system", "Peloton.WellView.help.chm");
const SCRIPT = join(REPO, "scripts", "wellview-db", "extract_chm.mjs");

const d = describe.skipIf(!existsSync(CHM));

d("the help CHM decodes provably, not just plausibly", () => {
  it("recovers every topic and can show its work", async () => {
    const { readChm, decompress, verify } = await import(SCRIPT);
    const chm = readChm(CHM);

    // The container, as the file itself states it.
    expect(chm.windowBits).toBe(16);
    expect(chm.resetInterval).toBe(2);
    expect(chm.entries).toBe(411);
    expect(chm.blockSize).toBe(32768);
    expect(chm.uncompressedLen).toBe(13441869);

    const { out, intervals } = decompress(chm);
    const v = verify(chm, out, intervals);

    expect(v.errors.map((e: { i: number; err: string }) => `${e.i}: ${e.err}`)).toEqual([]);

    // 1. Every interval lands on the offset the encoder recorded. The last one
    //    is followed by the end of the stream rather than a reset entry, so it
    //    is not checkable and is excluded rather than fudged.
    expect(v.checkable).toBe(205);
    expect(v.landed).toBe(205);

    // 2. Every topic is well-formed where the directory says it starts.
    expect(v.html).toBe(330);
    expect(v.badHtml).toEqual([]);

    // 3. …and every screenshot too. Images are the check that costs nothing and
    //    catches what prose does not: a wrong byte in a PNG header is not a
    //    typo, it is proof the stream desynchronised.
    expect(v.images).toBe(801);
    expect(v.badImages).toEqual([]);

    expect(v.ok).toBe(true);
  }, 120_000);

  it("puts each topic's own text in it", async () => {
    // The specific failure the old decoder had: a topic holding a DIFFERENT
    // topic's content. Both of these were wrong before, and read perfectly.
    const { readChm, decompress } = await import(SCRIPT);
    const chm = readChm(CHM);
    const { out } = decompress(chm);
    const read = (name: string) => {
      const f = chm.files.find((x: { name: string }) => x.name === name)!;
      return out.toString("latin1", f.offset, f.offset + f.length);
    };
    expect(read("/ReferenceDatum.html")).toContain("<title>Selecting Reference Datum</title>");
    expect(read("/sync.html")).toContain("<title>Synchronizing Data</title>");
    // …and the body belongs to the title, not to the topic next door.
    expect(read("/ReferenceDatum.html")).toContain("relative to Original KB");
    expect(read("/sync.html")).toContain("exchanging data and matching well file information");
  }, 120_000);
});
