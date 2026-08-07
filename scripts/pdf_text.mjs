/**
 * Minimal layout-preserving PDF text extractor.
 *
 * This box has no poppler / pymupdf / pdfjs, and the WellView sample reports are
 * the AUTHORITY on layout for the report suite — so the pages have to be
 * readable as text with their geometry intact, not just as a bag of words.
 *
 * What it does: walk the page tree, inflate each page's content stream(s), run a
 * tiny interpreter over the text operators (BT/ET, Tf, Td/TD/Tm/T*, TJ/Tj/'/"),
 * and emit every show-text run with its device-space x/y. Runs are then bucketed
 * into lines by y and spaced by x, which reproduces the printed column layout
 * closely enough to read a report off.
 *
 * Glyph decoding follows the font's /Encoding /Differences when present and
 * falls back to WinAnsi; a /ToUnicode CMap wins over both when the font has one
 * (WellView subsets its fonts). Anything still unmapped prints as '?', which is
 * visible rather than silently wrong.
 *
 *   node scripts/pdf_text.mjs <file.pdf> [firstPage] [lastPage]
 */
import { readFileSync } from "node:fs";
import { inflateSync, inflateRawSync } from "node:zlib";
import { createHash, createDecipheriv } from "node:crypto";

const [, , file, fromArg, toArg] = process.argv;
if (!file) {
  console.error("usage: node scripts/pdf_text.mjs <file.pdf> [firstPage] [lastPage]");
  process.exit(2);
}

const buf = readFileSync(file);
const raw = buf.toString("latin1");

// ── object table ────────────────────────────────────────────────────────────
// Scan for "N G obj" everywhere rather than trusting the xref: these files are
// linearized and some carry incremental updates, where a stale xref points at a
// superseded object. Last definition of an object number wins, which is what an
// incremental update means.
const objects = new Map();
{
  const re = /(\d+)\s+(\d+)\s+obj\b/g;
  let m;
  while ((m = re.exec(raw))) {
    objects.set(Number(m[1]), { start: m.index + m[0].length, headerAt: m.index, gen: Number(m[2]) });
  }
}

/** Body of object `num`: its raw slice from after "obj" to before "endobj". */
function objectSlice(num) {
  const rec = objects.get(num);
  if (!rec) return null;
  // Objects unpacked from an /ObjStm carry their body directly (they have no
  // "N G obj … endobj" wrapper anywhere in the file).
  if (rec.text !== undefined) return rec.text;
  const end = raw.indexOf("endobj", rec.start);
  return raw.slice(rec.start, end === -1 ? raw.length : end);
}

// ── value parsing (dictionaries, arrays, refs, names, numbers, strings) ──────
class Ref {
  constructor(num) { this.num = num; }
}

/** Parse one PDF object starting at `i` in `s`; returns [value, nextIndex]. */
function parseValue(s, i) {
  i = skipWs(s, i);
  const c = s[i];
  if (c === undefined) return [null, i];
  if (c === "<" && s[i + 1] === "<") return parseDict(s, i);
  if (c === "<") return parseHexString(s, i);
  if (c === "[") return parseArray(s, i);
  if (c === "(") return parseLiteralString(s, i);
  if (c === "/") return parseName(s, i);
  // "12 0 R" — a reference — must be tried before a bare number.
  const refM = /^(\d+)\s+(\d+)\s+R\b/.exec(s.slice(i, i + 32));
  if (refM) return [new Ref(Number(refM[1])), i + refM[0].length];
  const numM = /^[+-]?(\d+\.?\d*|\.\d+)/.exec(s.slice(i, i + 40));
  if (numM) return [Number(numM[0]), i + numM[0].length];
  if (s.startsWith("true", i)) return [true, i + 4];
  if (s.startsWith("false", i)) return [false, i + 5];
  if (s.startsWith("null", i)) return [null, i + 4];
  return [null, i + 1];
}

const WS = new Set([" ", "\n", "\r", "\t", "\f", "\0"]);
function skipWs(s, i) {
  for (;;) {
    while (i < s.length && WS.has(s[i])) i++;
    if (s[i] === "%") { while (i < s.length && s[i] !== "\n" && s[i] !== "\r") i++; continue; }
    return i;
  }
}
function parseName(s, i) {
  let j = i + 1, out = "";
  while (j < s.length && !WS.has(s[j]) && !"/[]<>(){}%".includes(s[j])) {
    if (s[j] === "#" && /[0-9a-fA-F]{2}/.test(s.slice(j + 1, j + 3))) {
      out += String.fromCharCode(parseInt(s.slice(j + 1, j + 3), 16));
      j += 3;
    } else out += s[j++];
  }
  return [{ name: out }, j];
}
function parseDict(s, i) {
  const dict = {};
  let j = i + 2;
  for (;;) {
    j = skipWs(s, j);
    if (s.startsWith(">>", j)) { j += 2; break; }
    if (j >= s.length) break;
    if (s[j] !== "/") { const [, nj] = parseValue(s, j); if (nj <= j) { j++; } else j = nj; continue; }
    const [key, kj] = parseName(s, j);
    const [val, vj] = parseValue(s, kj);
    dict[key.name] = val;
    j = vj;
  }
  return [dict, j];
}
function parseArray(s, i) {
  const arr = [];
  let j = i + 1;
  for (;;) {
    j = skipWs(s, j);
    if (s[j] === "]") { j++; break; }
    if (j >= s.length) break;
    const [val, nj] = parseValue(s, j);
    if (nj <= j) { j++; continue; }
    arr.push(val);
    j = nj;
  }
  return [arr, j];
}
function parseLiteralString(s, i) {
  let j = i + 1, depth = 1, out = "";
  while (j < s.length) {
    const c = s[j];
    if (c === "\\") {
      const n = s[j + 1];
      const simple = { n: "\n", r: "\r", t: "\t", b: "\b", f: "\f", "(": "(", ")": ")", "\\": "\\" };
      if (n in simple) { out += simple[n]; j += 2; continue; }
      const oct = /^[0-7]{1,3}/.exec(s.slice(j + 1, j + 4));
      if (oct) { out += String.fromCharCode(parseInt(oct[0], 8)); j += 1 + oct[0].length; continue; }
      if (n === "\n") { j += 2; continue; }
      j += 2; continue;
    }
    if (c === "(") depth++;
    if (c === ")") { depth--; if (depth === 0) { j++; break; } }
    out += c;
    j++;
  }
  return [{ str: out }, j];
}
function parseHexString(s, i) {
  const end = s.indexOf(">", i);
  const hex = s.slice(i + 1, end === -1 ? s.length : end).replace(/[^0-9a-fA-F]/g, "");
  let out = "";
  for (let k = 0; k + 1 < hex.length; k += 2) out += String.fromCharCode(parseInt(hex.slice(k, k + 2), 16));
  if (hex.length % 2) out += String.fromCharCode(parseInt(hex[hex.length - 1] + "0", 16));
  return [{ str: out }, (end === -1 ? s.length : end) + 1];
}

/** Resolve a Ref (possibly chained) to its value. */
function deref(v) {
  let guard = 0;
  while (v instanceof Ref && guard++ < 32) {
    const body = objectSlice(v.num);
    if (body == null) return null;
    const [val] = parseValue(body, 0);
    v = val;
  }
  return v;
}

/** The dictionary of object `num`, plus its raw stream bytes if it has one. */
function objectDict(num) {
  const rec = objects.get(num);
  if (!rec) return null;
  const body = objectSlice(num);
  if (body == null) return null;
  const [dict] = parseValue(body, 0);
  return dict && typeof dict === "object" && !Array.isArray(dict) && !(dict instanceof Ref) ? dict : null;
}

/** Inflate (or pass through) the stream of object `num`. */
function streamBytes(num) {
  const rec = objects.get(num);
  if (!rec) return null;
  const body = objectSlice(num);
  const sIdx = body.indexOf("stream");
  if (sIdx === -1) return null;
  const [dict] = parseValue(body, 0);
  let start = rec.start + sIdx + "stream".length;
  if (raw[start] === "\r") start++;
  if (raw[start] === "\n") start++;
  let len = deref(dict?.Length);
  let end;
  if (typeof len === "number" && len > 0 && start + len <= raw.length) {
    end = start + len;
    // Trust /Length only if "endstream" really follows it.
    if (!/^\s*endstream/.test(raw.slice(end, end + 20))) {
      const es = raw.indexOf("endstream", start);
      end = es === -1 ? raw.length : es;
    }
  } else {
    const es = raw.indexOf("endstream", start);
    end = es === -1 ? raw.length : es;
  }
  let bytes = buf.subarray(start, end);
  // Decryption comes BEFORE the filter chain: the file stores filter(plaintext)
  // encrypted, so inflating first would just inflate ciphertext. The /Encrypt
  // dictionary itself is never encrypted.
  if (crypt && num !== crypt.encryptObj) bytes = crypt.decrypt(num, rec.gen ?? 0, bytes);
  const filters = [].concat(deref(dict?.Filter) ?? []).map((f) => deref(f)?.name).filter(Boolean);
  for (const f of filters) {
    if (f === "FlateDecode") {
      try { bytes = inflateSync(bytes); }
      catch { try { bytes = inflateRawSync(bytes.subarray(1)); } catch { return null; } }
    } else if (f === "ASCIIHexDecode") {
      const hex = bytes.toString("latin1").replace(/[^0-9a-fA-F]/g, "");
      const out = Buffer.alloc(hex.length >> 1);
      for (let k = 0; k < out.length; k++) out[k] = parseInt(hex.slice(k * 2, k * 2 + 2), 16);
      bytes = out;
    } else {
      // DCTDecode / JPXDecode / CCITTFax — image data, no text in it.
      return null;
    }
  }
  return bytes;
}

// ── standard security handler ───────────────────────────────────────────────
// The WellView samples ship encrypted (/Filter /Standard, RC4 40-bit, empty user
// password, permissions -60 — i.e. "no printing/copying", not "no reading").
// Every stream and string in the file is RC4'd under a per-object key, so
// decryption is not an optional extra here: without it nothing inflates.
//
// PDF 1.7 Algorithm 3.2 derives the file key from the padded password, /O, /P
// and the first /ID element; Algorithm 3.1 mixes the object + generation number
// into a per-object key. AES (/V 4 or 5) is handled too, since a later sample
// could use it.

const PAD = Buffer.from([
  0x28, 0xBF, 0x4E, 0x5E, 0x4E, 0x75, 0x8A, 0x41, 0x64, 0x00, 0x4E, 0x56,
  0xFF, 0xFA, 0x01, 0x08, 0x2E, 0x2E, 0x00, 0xB6, 0xD0, 0x68, 0x3E, 0x80,
  0x2F, 0x0C, 0xA9, 0xFE, 0x64, 0x53, 0x69, 0x7A,
]);

/** RC4 — OpenSSL 3 dropped it from the default provider, so it lives here. */
function rc4(key, data) {
  const s = new Uint8Array(256);
  for (let i = 0; i < 256; i++) s[i] = i;
  for (let i = 0, j = 0; i < 256; i++) {
    j = (j + s[i] + key[i % key.length]) & 0xff;
    [s[i], s[j]] = [s[j], s[i]];
  }
  const out = Buffer.alloc(data.length);
  for (let k = 0, i = 0, j = 0; k < data.length; k++) {
    i = (i + 1) & 0xff;
    j = (j + s[i]) & 0xff;
    [s[i], s[j]] = [s[j], s[i]];
    out[k] = data[k] ^ s[(s[i] + s[j]) & 0xff];
  }
  return out;
}

/** null when the file is not encrypted. */
const crypt = (() => {
  const encM = /\/Encrypt\s+(\d+)\s+\d+\s+R/.exec(raw);
  if (!encM) return null;
  const enc = objectDict(Number(encM[1]));
  if (!enc) return null;
  const bytesOf = (v) => Buffer.from(deref(v)?.str ?? "", "latin1");
  const R = deref(enc.R) ?? 2;
  const V = deref(enc.V) ?? 1;
  const P = deref(enc.P) ?? 0;
  const lengthBits = deref(enc.Length) ?? 40;
  const O = bytesOf(enc.O);

  // First /ID element, straight out of the trailer (it is not an indirect ref).
  let id = Buffer.alloc(0);
  const idM = /\/ID\s*\[\s*<([0-9A-Fa-f\s]*)>/.exec(raw);
  if (idM) id = Buffer.from(idM[1].replace(/\s/g, ""), "hex");

  // /V 4 and 5 name their algorithm in a crypt filter.
  let cfm = "V2";
  if (V >= 4) {
    const cf = deref(enc.CF);
    const stmF = deref(enc.StmF)?.name ?? "StdCF";
    const filter = deref(cf?.[stmF]);
    cfm = deref(filter?.CFM)?.name ?? "AESV2";
  }

  let keyLen = V === 1 ? 5 : Math.max(5, Math.floor(lengthBits / 8));
  let key;
  if (R >= 5) {
    // AES-256: the key comes from /U's validation+key salts, empty password.
    const U = bytesOf(enc.U);
    const ue = bytesOf(enc.UE);
    const keySalt = U.subarray(40, 48);
    const ikey = createHash("sha256").update(Buffer.concat([Buffer.alloc(0), keySalt])).digest();
    try {
      const d = createDecipheriv("aes-256-cbc", ikey, Buffer.alloc(16));
      d.setAutoPadding(false);
      key = Buffer.concat([d.update(ue), d.final()]);
    } catch { key = ikey; }
    cfm = "AESV3";
    keyLen = 32;
  } else {
    const pbuf = Buffer.alloc(4);
    pbuf.writeInt32LE(P | 0, 0);
    let h = createHash("md5").update(PAD).update(O.subarray(0, 32)).update(pbuf).update(id);
    if (R >= 4 && deref(enc.EncryptMetadata) === false) h = h.update(Buffer.from([0xff, 0xff, 0xff, 0xff]));
    let digest = h.digest();
    if (R >= 3) {
      for (let i = 0; i < 50; i++) digest = createHash("md5").update(digest.subarray(0, keyLen)).digest();
    }
    key = digest.subarray(0, keyLen);
  }

  /** Algorithm 3.1 — per-object key, then RC4 or AES-CBC. */
  const decrypt = (num, gen, data) => {
    if (cfm === "None") return data;
    if (cfm === "AESV3") {
      try {
        const d = createDecipheriv("aes-256-cbc", key, data.subarray(0, 16));
        d.setAutoPadding(false);
        const out = Buffer.concat([d.update(data.subarray(16)), d.final()]);
        const pad = out[out.length - 1];
        return pad >= 1 && pad <= 16 ? out.subarray(0, out.length - pad) : out;
      } catch { return data; }
    }
    const ext = Buffer.from([num & 0xff, (num >> 8) & 0xff, (num >> 16) & 0xff, gen & 0xff, (gen >> 8) & 0xff]);
    const parts = [key, ext];
    if (cfm === "AESV2") parts.push(Buffer.from([0x73, 0x41, 0x6c, 0x54]));   // "sAlT"
    const objKey = createHash("md5").update(Buffer.concat(parts)).digest()
      .subarray(0, Math.min(key.length + 5, 16));
    if (cfm === "AESV2") {
      try {
        const d = createDecipheriv("aes-128-cbc", objKey, data.subarray(0, 16));
        d.setAutoPadding(false);
        const out = Buffer.concat([d.update(data.subarray(16)), d.final()]);
        const pad = out[out.length - 1];
        return pad >= 1 && pad <= 16 ? out.subarray(0, out.length - pad) : out;
      } catch { return data; }
    }
    return rc4(objKey, data);
  };
  return { decrypt, encryptObj: Number(encM[1]) };
})();

// ── object streams (PDF 1.5+) ───────────────────────────────────────────────
// A cross-reference-stream file keeps most of its objects — including the
// catalog and the page dictionaries — packed inside /Type /ObjStm streams, so a
// plain "N G obj" scan finds nothing to walk. Unpack them once, up front. Objects
// inside an ObjStm are never separately encrypted (the container already was).
for (const num of [...objects.keys()]) {
  const dict = objectDict(num);
  if (dict?.Type?.name !== "ObjStm") continue;
  const bytes = streamBytes(num);
  if (!bytes) continue;
  const text = bytes.toString("latin1");
  const n = deref(dict.N) ?? 0;
  const first = deref(dict.First) ?? 0;
  const headerNums = text.slice(0, first).trim().split(/\s+/).map(Number);
  for (let k = 0; k < n; k++) {
    const objNum = headerNums[k * 2];
    const offset = headerNums[k * 2 + 1];
    if (!Number.isFinite(objNum) || !Number.isFinite(offset)) continue;
    // Already defined at top level? A top-level definition is a later
    // incremental update and wins.
    if (objects.has(objNum) && objects.get(objNum).text === undefined) continue;
    const end = k + 1 < n && Number.isFinite(headerNums[(k + 1) * 2 + 1])
      ? first + headerNums[(k + 1) * 2 + 1]
      : text.length;
    objects.set(objNum, { text: text.slice(first + offset, end), gen: 0, start: 0 });
  }
}

// ── page tree ───────────────────────────────────────────────────────────────
function findCatalogPages() {
  // Trailer /Root, else the first object with /Type /Pages and no /Parent.
  const rootM = /\/Root\s+(\d+)\s+\d+\s+R/.exec(raw);
  if (rootM) {
    const cat = objectDict(Number(rootM[1]));
    const pages = deref(cat?.Pages);
    if (pages) return pages;
  }
  for (const num of objects.keys()) {
    const d = objectDict(num);
    if (d?.Type?.name === "Pages" && !d.Parent) return d;
  }
  return null;
}

/** Depth-first walk of the page tree → [{dict, inherited}] in printed order. */
function collectPages(node, inherited = {}, out = []) {
  if (!node) return out;
  const merged = { ...inherited };
  for (const k of ["Resources", "MediaBox", "CropBox", "Rotate"]) {
    if (node[k] !== undefined) merged[k] = node[k];
  }
  const type = node.Type?.name;
  if (type === "Page") { out.push({ dict: node, inherited: merged }); return out; }
  const kids = deref(node.Kids) ?? [];
  for (const kidRef of kids) {
    const kid = deref(kidRef);
    if (kid) collectPages(kid, merged, out);
  }
  return out;
}

// ── font decoding ───────────────────────────────────────────────────────────
const WINANSI_EXTRA = {
  128: "€", 130: "‚", 131: "ƒ", 132: "„", 133: "…", 134: "†",
  135: "‡", 136: "ˆ", 137: "‰", 138: "Š", 139: "‹", 140: "Œ",
  142: "Ž", 145: "‘", 146: "’", 147: "“", 148: "”", 149: "•",
  150: "–", 151: "—", 152: "˜", 153: "™", 154: "š", 155: "›",
  156: "œ", 158: "ž", 159: "Ÿ",
};
/** Glyph names we actually meet in these reports (degree, quotes, dashes…). */
const GLYPH_NAMES = {
  space: " ", exclam: "!", quotedbl: '"', numbersign: "#", dollar: "$", percent: "%",
  ampersand: "&", quotesingle: "'", parenleft: "(", parenright: ")", asterisk: "*", plus: "+",
  comma: ",", hyphen: "-", period: ".", slash: "/", zero: "0", one: "1", two: "2", three: "3",
  four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9", colon: ":", semicolon: ";",
  less: "<", equal: "=", greater: ">", question: "?", at: "@", bracketleft: "[",
  backslash: "\\", bracketright: "]", asciicircum: "^", underscore: "_", grave: "`",
  braceleft: "{", bar: "|", braceright: "}", asciitilde: "~", degree: "°",
  endash: "–", emdash: "—", quoteleft: "‘", quoteright: "’",
  quotedblleft: "“", quotedblright: "”", bullet: "•", ellipsis: "…",
  twosuperior: "²", threesuperior: "³", onesuperior: "¹", middot: "·",
  minus: "−", divide: "÷", multiply: "×", plusminus: "±",
};
function glyphToChar(name) {
  if (GLYPH_NAMES[name]) return GLYPH_NAMES[name];
  let m = /^uni([0-9A-Fa-f]{4})$/.exec(name);
  if (m) return String.fromCharCode(parseInt(m[1], 16));
  m = /^u([0-9A-Fa-f]{4,6})$/.exec(name);
  if (m) return String.fromCodePoint(parseInt(m[1], 16));
  m = /^([A-Za-z])$/.exec(name);
  if (m) return m[1];
  m = /^g?(\d+)$/.exec(name);
  if (m) return null;
  return null;
}

/** Parse a /ToUnicode CMap into code → string. */
function parseToUnicode(bytes) {
  const map = new Map();
  const text = bytes.toString("latin1");
  const hex = (h) => {
    let out = "";
    for (let k = 0; k + 3 < h.length; k += 4) out += String.fromCharCode(parseInt(h.slice(k, k + 4), 16));
    if (h.length === 2) out = String.fromCharCode(parseInt(h, 16));
    return out;
  };
  for (const block of text.match(/beginbfchar([\s\S]*?)endbfchar/g) ?? []) {
    for (const m of block.matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
      map.set(parseInt(m[1], 16), hex(m[2]));
    }
  }
  for (const block of text.match(/beginbfrange([\s\S]*?)endbfrange/g) ?? []) {
    for (const m of block.matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
      const lo = parseInt(m[1], 16), hi = parseInt(m[2], 16), dst = parseInt(m[3], 16);
      for (let c = lo; c <= hi && c - lo < 65536; c++) map.set(c, String.fromCodePoint(dst + (c - lo)));
    }
    for (const m of block.matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*\[([\s\S]*?)\]/g)) {
      const lo = parseInt(m[1], 16);
      const items = [...m[3].matchAll(/<([0-9A-Fa-f]+)>/g)].map((x) => hex(x[1]));
      items.forEach((s, k) => map.set(lo + k, s));
    }
  }
  return map;
}

/**
 * Glyph advance table for one font, in 1/1000 em.
 *
 * Without real widths the interpreter has to guess an advance, and every guess
 * compounds across a TJ array — which is what turned "Well Name" into
 * "Well N a me" on the first run of this script. Simple fonts carry
 * /FirstChar + /Widths; composite (Type0) fonts carry /W ranges over the
 * descendant font, defaulting to /DW (1000).
 */
function makeWidths(fontDict) {
  const sub = deref(fontDict?.Subtype)?.name;
  const map = new Map();
  let missing = 0;
  if (sub === "Type0") {
    const desc = deref(deref(fontDict.DescendantFonts)?.[0]);
    missing = deref(desc?.DW) ?? 1000;
    const w = deref(desc?.W) ?? [];
    for (let i = 0; i < w.length;) {
      const first = deref(w[i]);
      const next = deref(w[i + 1]);
      if (Array.isArray(next)) {
        next.forEach((val, k) => map.set(first + k, deref(val)));
        i += 2;
      } else {
        const width = deref(w[i + 2]);
        for (let c = first; c <= next && c - first < 65536; c++) map.set(c, width);
        i += 3;
      }
    }
  } else {
    const firstChar = deref(fontDict?.FirstChar) ?? 0;
    const widths = deref(fontDict?.Widths) ?? [];
    widths.forEach((val, k) => map.set(firstChar + k, deref(val)));
    missing = deref(deref(fontDict?.FontDescriptor)?.MissingWidth) ?? 0;
    // A standard-14 font has no /Widths at all; 500 is a fair mean for Helvetica
    // and is only ever used for fonts the file did not describe.
    if (widths.length === 0) missing = 500;
  }
  return { map, missing };
}

/** Build a decoder for one /Font dictionary. */
function makeFont(fontDict) {
  const sub = deref(fontDict?.Subtype)?.name;
  const twoByte = sub === "Type0";
  const widths = makeWidths(fontDict);
  let toUnicode = null;
  const tuRef = fontDict?.ToUnicode;
  if (tuRef instanceof Ref) {
    const b = streamBytes(tuRef.num);
    if (b) toUnicode = parseToUnicode(b);
  }
  const diff = new Map();
  const enc = deref(fontDict?.Encoding);
  if (enc && typeof enc === "object" && enc.Differences) {
    const arr = deref(enc.Differences) ?? [];
    let code = 0;
    for (const item of arr) {
      const val = deref(item);
      if (typeof val === "number") code = val;
      else if (val?.name !== undefined) { diff.set(code, val.name); code++; }
    }
  }
  return {
    twoByte,
    /** [text, widthIn1000thsOfEm, spaceCount] for one show-text string. */
    decode(sBytes) {
      let out = "";
      let width = 0;
      let spaces = 0;
      const step = twoByte ? 2 : 1;
      for (let k = 0; k + step - 1 < sBytes.length; k += step) {
        const code = twoByte ? (sBytes[k] << 8) | sBytes[k + 1] : sBytes[k];
        width += widths.map.get(code) ?? widths.missing;
        if (code === 32 && !twoByte) spaces++;
        if (toUnicode?.has(code)) { out += toUnicode.get(code); continue; }
        if (diff.has(code)) {
          const ch = glyphToChar(diff.get(code));
          out += ch ?? "?";
          continue;
        }
        if (code >= 32 && code <= 126) out += String.fromCharCode(code);
        else if (WINANSI_EXTRA[code]) out += WINANSI_EXTRA[code];
        else if (code >= 160) out += String.fromCharCode(code);
        else if (code === 9) out += " ";
        else out += "";
      }
      return [out, width, spaces];
    },
  };
}

// ── content-stream text interpreter ─────────────────────────────────────────
/** Tokenize a content stream into operands + operators. */
function* tokens(s) {
  let i = 0;
  while (i < s.length) {
    i = skipWs(s, i);
    if (i >= s.length) break;
    const c = s[i];
    if (c === "(" || c === "<" || c === "[" || c === "/" || /[-+.\d]/.test(c)) {
      if (c === "<" && s[i + 1] === "<") { const [v, j] = parseDict(s, i); yield { operand: v }; i = j; continue; }
      const [v, j] = parseValue(s, i);
      if (j <= i) { i++; continue; }
      yield { operand: v };
      i = j;
      continue;
    }
    const m = /^[A-Za-z'"*][A-Za-z0-9*'"]*/.exec(s.slice(i, i + 16));
    if (m) { yield { op: m[0] }; i += m[0].length; continue; }
    i++;
  }
}

const mul = (a, b) => [
  a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3],
  a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3],
  a[4] * b[0] + a[5] * b[2] + b[4], a[4] * b[1] + a[5] * b[3] + b[5],
];

/** Run the text operators of one page's content, collecting positioned runs. */
function extractRuns(content, fonts) {
  const runs = [];
  let ctm = [1, 0, 0, 1, 0, 0];
  const stack = [];
  let tm = [1, 0, 0, 1, 0, 0], tlm = tm;
  let font = null, fontSize = 0, leading = 0, charSp = 0, wordSp = 0, hscale = 1, rise = 0;
  let operands = [];

  const show = (bytes) => {
    if (!font) return;
    const [text, width1000, spaces] = font.decode(bytes);
    const glyphs = font.twoByte ? bytes.length / 2 : bytes.length;
    // Advance from the font's own /Widths, plus the char/word spacing the state
    // carries — this is what keeps a TJ array's runs landing on their real x.
    const adv = ((width1000 / 1000) * fontSize + glyphs * charSp + spaces * wordSp) * hscale;
    const before = tm;
    tm = mul([1, 0, 0, 1, adv, 0], tm);
    if (text) {
      const trm = mul([fontSize * hscale, 0, 0, fontSize, 0, rise], mul(before, ctm));
      const endTrm = mul([fontSize * hscale, 0, 0, fontSize, 0, rise], mul(tm, ctm));
      runs.push({
        x: trm[4], y: trm[5], endX: endTrm[4], endY: endTrm[5],
        size: Math.abs(fontSize * Math.hypot(before[0], before[1]) || fontSize), text,
      });
    }
  };

  for (const t of tokens(content)) {
    if (t.operand !== undefined) { operands.push(t.operand); continue; }
    const op = t.op;
    const n = (k) => {
      const v = operands[operands.length - k];
      return typeof v === "number" ? v : 0;
    };
    switch (op) {
      case "q": stack.push(ctm.slice()); break;
      case "Q": ctm = stack.pop() ?? ctm; break;
      case "cm": ctm = mul([n(6), n(5), n(4), n(3), n(2), n(1)], ctm); break;
      case "BT": tm = tlm = [1, 0, 0, 1, 0, 0]; break;
      case "ET": break;
      case "Tf": {
        const nameOp = operands[operands.length - 2];
        fontSize = n(1);
        font = fonts.get(nameOp?.name) ?? font;
        break;
      }
      case "Td": tlm = mul([1, 0, 0, 1, n(2), n(1)], tlm); tm = tlm.slice(); break;
      case "TD": leading = -n(1); tlm = mul([1, 0, 0, 1, n(2), n(1)], tlm); tm = tlm.slice(); break;
      case "Tm": tlm = [n(6), n(5), n(4), n(3), n(2), n(1)]; tm = tlm.slice(); break;
      case "T*": tlm = mul([1, 0, 0, 1, 0, -leading], tlm); tm = tlm.slice(); break;
      case "TL": leading = n(1); break;
      case "Tc": charSp = n(1); break;
      case "Tw": wordSp = n(1); break;
      case "Tz": hscale = n(1) / 100; break;
      case "Ts": rise = n(1); break;
      case "Tj": case "'": case '"': {
        if (op !== "Tj") { tlm = mul([1, 0, 0, 1, 0, -leading], tlm); tm = tlm.slice(); }
        const s = operands[operands.length - 1];
        if (s?.str !== undefined) show(Buffer.from(s.str, "latin1"));
        break;
      }
      case "TJ": {
        const arr = operands[operands.length - 1];
        if (Array.isArray(arr)) {
          for (const item of arr) {
            if (typeof item === "number") {
              tm = mul([1, 0, 0, 1, (-item / 1000) * fontSize * hscale, 0], tm);
            } else if (item?.str !== undefined) {
              show(Buffer.from(item.str, "latin1"));
            }
          }
        }
        break;
      }
      default: break;
    }
    operands = [];
  }
  return runs;
}

/**
 * Apply the page's /Rotate to every run, so lines come out in READING order.
 *
 * A landscape WellView report (03 Bit Summary, 14 Drilling Offsets) is a
 * portrait MediaBox with /Rotate 90 and a rotated text matrix: in user space its
 * text runs vertically, and bucketing that by y transposes the whole report into
 * gibberish. Rotating the coordinates first is what makes those pages readable.
 */
function unrotate(runs, rotate, w, h) {
  const r = ((Math.round((rotate ?? 0) / 90) * 90) % 360 + 360) % 360;
  if (r === 0) return runs;
  const map = (x, y) =>
    r === 90 ? [y, w - x] :
    r === 180 ? [w - x, h - y] :
    [h - y, x];                       // 270
  return runs.map((run) => {
    const [x, y] = map(run.x, run.y);
    const [ex, ey] = map(run.endX ?? run.x, run.endY ?? run.y);
    return { ...run, x, y, endX: ex, endY: ey };
  });
}

/** Positioned runs → printed lines, columns preserved by x-gap padding. */
function layout(runs) {
  if (runs.length === 0) return "";
  const sizes = runs.map((r) => r.size).filter((s) => s > 0).sort((a, b) => a - b);
  const median = sizes[Math.floor(sizes.length / 2)] || 8;
  const rowTol = Math.max(1.5, median * 0.45);
  // Bucket by y (PDF y grows upward → sort descending for reading order).
  const rows = [];
  for (const r of [...runs].sort((a, b) => b.y - a.y || a.x - b.x)) {
    const row = rows.find((x) => Math.abs(x.y - r.y) <= rowTol);
    if (row) { row.items.push(r); row.y = (row.y * row.items.length + r.y) / (row.items.length + 1); }
    else rows.push({ y: r.y, items: [r] });
  }
  const charW = median * 0.5;
  const out = [];
  for (const row of rows) {
    row.items.sort((a, b) => a.x - b.x);
    let line = "";
    let prevEnd = null;
    for (const it of row.items) {
      // Column position of this run, and the real page gap since the previous
      // run ended. Reports like these kern inside a word with TJ offsets, so a
      // sub-character gap must NOT become a space — that is what turned
      // "Well Name" into "Well N a me". Only a gap of ~a character or more is
      // treated as layout whitespace.
      const col = Math.max(0, Math.round(it.x / charW));
      const gap = prevEnd == null ? it.x : it.x - prevEnd;
      if (prevEnd == null) {
        line += " ".repeat(Math.max(0, col - line.length));
      } else if (gap >= charW * 0.6) {
        line += " ".repeat(Math.max(1, col - line.length));
      }
      line += it.text;
      prevEnd = it.endX ?? it.x;
    }
    out.push(line.replace(/\s+$/, ""));
  }
  return out.join("\n");
}

// ── main ────────────────────────────────────────────────────────────────────
const pages = collectPages(findCatalogPages());
const first = Math.max(1, Number(fromArg ?? 1) || 1);
const last = Math.min(pages.length, Number(toArg ?? pages.length) || pages.length);

console.log(`# ${file} — ${pages.length} page(s), showing ${first}..${last}`);
for (let p = first; p <= last; p++) {
  const page = pages[p - 1];
  if (!page) continue;
  const box = (deref(page.dict.MediaBox) ?? deref(page.inherited.MediaBox) ?? []).map((v) => deref(v));
  const rotate = deref(page.dict.Rotate) ?? deref(page.inherited.Rotate) ?? 0;
  const res = deref(page.dict.Resources) ?? deref(page.inherited.Resources) ?? {};
  const fontRes = deref(res.Font) ?? {};
  const fonts = new Map();
  for (const [name, ref] of Object.entries(fontRes)) {
    const fd = deref(ref);
    if (fd) fonts.set(name, makeFont(fd));
  }
  const contentsRef = page.dict.Contents;
  const parts = [].concat(contentsRef ?? []);
  let content = "";
  for (const part of parts) {
    if (part instanceof Ref) {
      const b = streamBytes(part.num);
      if (b) content += b.toString("latin1") + "\n";
      else {
        // An array of stream refs behind one indirect object.
        const arr = deref(part);
        if (Array.isArray(arr)) {
          for (const sub of arr) {
            if (sub instanceof Ref) {
              const sb = streamBytes(sub.num);
              if (sb) content += sb.toString("latin1") + "\n";
            }
          }
        }
      }
    }
  }
  const w = box.length === 4 ? (box[2] - box[0]).toFixed(0) : "?";
  const h = box.length === 4 ? (box[3] - box[1]).toFixed(0) : "?";
  console.log(`\n${"=".repeat(90)}\n## PAGE ${p}/${pages.length}  —  ${w} x ${h} pt${rotate ? `, /Rotate ${rotate}` : ""}\n${"=".repeat(90)}`);
  console.log(layout(unrotate(extractRuns(content, fonts), rotate, Number(w) || 0, Number(h) || 0)));
}
