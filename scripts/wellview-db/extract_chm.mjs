/**
 * `Peloton.WellView.help.chm` → the 330 help topics, as files.
 *
 * The CHM is WellView's own user guide and per-table field help: 209 user-guide
 * pages, 112 per-table topics, 9 feature topics, plus 801 screenshots. It is a
 * second specification for this app alongside the data model, which is why it
 * was worth writing a decoder for.
 *
 * There is no CHM tool on this machine and no Python, so this reads the
 * container itself — ITSF v3 header, ITSP/PMGL directory, the LZXC transform's
 * ControlData and ResetTable — and decodes the content with `./lzx.mjs`.
 *
 * IT VERIFIES ITSELF, and refuses to be trusted otherwise. Three independent
 * checks, because a broken LZX decode does not produce garbage — it produces
 * fluent English from the wrong topic, which no eye will catch:
 *
 *   1. Every reset interval must finish EXACTLY on the next reset-table offset.
 *      The table is the encoder's own record of where it restarted.
 *   2. Every HTML topic must begin with the shared DOCTYPE and end with
 *      `</html>` at the offset and length the directory gives.
 *   3. Every embedded image must carry its format's magic bytes.
 *
 * Usage:
 *   node scripts/wellview-db/extract_chm.mjs [out-dir] [chm-path]
 *   node scripts/wellview-db/extract_chm.mjs --check      (verify only)
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { lzxDecompress } from "./lzx.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..");
const DEFAULT_CHM = process.env.WELLVIEW_HELP_CHM
  ?? join(REPO, "WellView_files", "system", "Peloton.WellView.help.chm");

/** The ITSF container: the directory of files and where the content lives. */
export function readChm(path) {
  const b = readFileSync(path);
  if (b.toString("latin1", 0, 4) !== "ITSF") throw new Error(`${path} is not a CHM`);

  const dir = b.indexOf(Buffer.from("ITSP"));
  // Offsets that are easy to get wrong: ITSP+4 is the VERSION, the directory
  // header length is at +8, the chunk size at +16 and the chunk count at +44.
  const hdrLen = b.readUInt32LE(dir + 8);
  const chunkSize = b.readUInt32LE(dir + 16);
  const chunks = b.readUInt32LE(dir + 44);

  /** CHM's variable-length integer: 7 bits a byte, high bit means "more". */
  const enc = (bb, p) => {
    let v = 0;
    for (;;) { const x = bb[p++]; v = (v << 7) | (x & 0x7f); if (!(x & 0x80)) return [v >>> 0, p]; }
  };

  const files = [];
  for (let c = 0; c < chunks; c++) {
    const base = dir + hdrLen + c * chunkSize;
    if (b.toString("latin1", base, base + 4) !== "PMGL") continue;
    // The tail of a PMGL chunk holds the quickref table, growing backwards.
    const end = base + chunkSize - b.readUInt32LE(base + 4);
    let p = base + 20;
    while (p < end) {
      let n, nm, s, o, l;
      [n, p] = enc(b, p);
      if (n <= 0 || p + n > end) break;
      nm = b.toString("utf8", p, p + n); p += n;
      [s, p] = enc(b, p); [o, p] = enc(b, p); [l, p] = enc(b, p);
      files.push({ name: nm, section: s, offset: o, length: l });
    }
  }

  const hdrEnd = b.readUInt32LE(8);
  const contentStart = Number(b.readBigUInt64LE(hdrEnd - 8));
  const grab = (n) => {
    const f = files.find((x) => x.name === n);
    return f ? b.subarray(contentStart + f.offset, contentStart + f.offset + f.length) : null;
  };

  const cd = grab("::DataSpace/Storage/MSCompressed/ControlData");
  if (!cd || cd.toString("latin1", 4, 8) !== "LZXC") throw new Error("not an LZX-compressed CHM");
  // For LZXC version 2 both counts are in units of one 32,768-byte frame.
  const windowBits = Math.log2(cd.readUInt32LE(16) * 32768);
  const resetInterval = cd.readUInt32LE(12);

  const rt = grab("::DataSpace/Storage/MSCompressed/Transform/"
    + "{7FC28940-9D31-11D0-9B27-00A0C91E9C7C}/InstanceData/ResetTable");
  const entries = rt.readUInt32LE(4);
  const tableOffset = rt.readUInt32LE(12);
  const uncompressedLen = Number(rt.readBigUInt64LE(16));
  const blockSize = Number(rt.readBigUInt64LE(32));
  const resets = [];
  for (let i = 0; i < entries; i++) resets.push(Number(rt.readBigUInt64LE(tableOffset + i * 8)));

  const cf = files.find((f) => f.name === "::DataSpace/Storage/MSCompressed/Content");
  const content = b.subarray(contentStart + cf.offset, contentStart + cf.offset + cf.length);

  return { files, content, resets, entries, windowBits, resetInterval, blockSize, uncompressedLen };
}

/** Decompress the whole content stream, interval by interval. */
export function decompress(chm) {
  const { content, resets, entries, windowBits, resetInterval, blockSize, uncompressedLen } = chm;
  const span = resetInterval * blockSize;
  const out = Buffer.alloc(uncompressedLen);
  const intervals = [];
  for (let i = 0; i < entries; i += resetInterval) {
    const at = resets[i];
    const start = i * blockSize;
    const want = Math.min(span, uncompressedLen - start);
    if (want <= 0) break;
    const last = i + resetInterval >= entries;
    try {
      const end = lzxDecompress(content, at, want, windowBits, out, start);
      // Only a real reset entry is a target. The final interval is followed by
      // the end of the stream, which carries slack, so it is not checkable.
      intervals.push({ i, at, end, expected: last ? null : resets[i + resetInterval], last });
    } catch (e) {
      intervals.push({ i, at, err: e.message, last });
    }
  }
  return { out, intervals };
}

const HTML_HEAD = "<!DOCTYPE html PUBLIC";
const isImage = (n) => /\.(png|jpe?g|gif)$/i.test(n);
const isHtml = (n) => /\.html?$/i.test(n);

/** The three checks. Returns a report; `ok` is true only if all of them pass. */
export function verify(chm, out, intervals) {
  const landed = intervals.filter((iv) => !iv.last && !iv.err && iv.end === iv.expected).length;
  const checkable = intervals.filter((iv) => !iv.last).length;

  const sec1 = chm.files.filter((f) => f.section === 1 && f.length > 0);
  const html = sec1.filter((f) => isHtml(f.name));
  const images = sec1.filter((f) => isImage(f.name));

  const badHtml = [];
  for (const f of html) {
    const s = out.toString("latin1", f.offset, f.offset + f.length);
    if (!s.startsWith(HTML_HEAD)) badHtml.push(`${f.name}: starts ${JSON.stringify(s.slice(0, 32))}`);
    else if (!/<\/html>\s*$/i.test(s)) badHtml.push(`${f.name}: ends ${JSON.stringify(s.slice(-32))}`);
    else if (/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(s)) badHtml.push(`${f.name}: control bytes inside`);
  }

  const badImages = [];
  for (const f of images) {
    const h = out.subarray(f.offset, f.offset + 8);
    const ok = (h[0] === 0x89 && h[1] === 0x50)            // PNG
      || (h[0] === 0xff && h[1] === 0xd8)                   // JPEG
      || h.toString("latin1", 0, 3) === "GIF";
    if (!ok) badImages.push(`${f.name}: ${[...h].map((x) => x.toString(16).padStart(2, "0")).join(" ")}`);
  }

  return {
    ok: landed === checkable && badHtml.length === 0 && badImages.length === 0,
    landed, checkable,
    html: html.length, badHtml,
    images: images.length, badImages,
    errors: intervals.filter((iv) => iv.err),
  };
}

if (process.argv[1] && process.argv[1].endsWith("extract_chm.mjs")) {
  const checkOnly = process.argv.includes("--check");
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const outDir = args[0] ?? join(REPO, "WellView_files", "help-extracted");
  const chmPath = args[1] ?? DEFAULT_CHM;

  const chm = readChm(chmPath);
  console.error(`window ${1 << chm.windowBits}, resetInterval ${chm.resetInterval}, `
    + `${chm.entries} reset entries, ${chm.uncompressedLen} bytes to recover`);

  const { out, intervals } = decompress(chm);
  const v = verify(chm, out, intervals);
  console.error(`intervals landing exactly on the next reset: ${v.landed}/${v.checkable}`);
  console.error(`html topics well-formed: ${v.html - v.badHtml.length}/${v.html}`);
  console.error(`images with a correct magic: ${v.images - v.badImages.length}/${v.images}`);
  v.errors.forEach((e) => console.error(`  interval ${e.i}: ${e.err}`));
  v.badHtml.slice(0, 10).forEach((x) => console.error(`  BAD HTML ${x}`));
  v.badImages.slice(0, 10).forEach((x) => console.error(`  BAD IMAGE ${x}`));

  if (!v.ok) {
    console.error("\nDECODE IS NOT CLEAN — refusing to write files that would read as "
      + "Peloton's words while being partly invented.");
    process.exit(1);
  }
  if (checkOnly) { console.error("\nverified."); process.exit(0); }

  let written = 0;
  for (const f of chm.files) {
    if (f.section !== 1 || f.length === 0) continue;
    if (f.name.startsWith("::") || f.name.startsWith("/#") || f.name.startsWith("/$")) continue;
    const rel = f.name.replace(/^\//, "").replace(/[^A-Za-z0-9._/-]/g, "_");
    const target = join(outDir, rel);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, out.subarray(f.offset, f.offset + f.length));
    written++;
  }
  console.error(`\nwrote ${written} files to ${outDir}`);
}
