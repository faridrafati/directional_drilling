/**
 * WellView attachments — the files stored inside the database itself.
 *
 * `wvAttachment` holds each file as a BLOB alongside its description, type and
 * the record it hangs off. The sample database carries 17 of them: wellhead
 * diagrams, a vendor drawing, a completion programme, a survey workbook. Until
 * now every one of them rendered as the string "(binary · 227285 bytes)".
 *
 * TWO STORED COLUMNS ABOUT THE FILE ARE NOT TRUSTWORTHY. `AttachBlobSz` is NULL
 * on 9 of the sample's 17 rows whose blob is real and up to 840 KB — NULL, not
 * zero, which is why the guard tests the blob's own length rather than the
 * column. `AttachExtension` is absent on one row and, in this database, agrees
 * with the bytes everywhere else; it is still not used to decide the type,
 * because on UPLOAD it is written from the client's filename and is therefore
 * attacker-controlled by construction. The type always comes from the bytes.
 *
 * SERVING SOMEONE ELSE'S FILE BACK FROM YOUR OWN ORIGIN IS THE DANGEROUS PART.
 * A file is rendered inline only when its magic number says it is one of a
 * short list of raster image formats. Everything else — including anything
 * unrecognised, and specifically SVG, which is an image and a script host at
 * the same time — is served as an octet-stream download. `nosniff` is always
 * set so the browser cannot second-guess that decision. This is an allow-list:
 * a new format is not renderable until it is added deliberately.
 */

/** Formats safe to hand a browser <img>. Raster only, by magic number. */
const INLINE: { mime: string; label: string; test: (b: Uint8Array) => boolean }[] = [
  { mime: "image/jpeg", label: "JPEG image", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: "image/png", label: "PNG image", test: (b) => hex(b, 0, 8) === "89504e470d0a1a0a" },
  { mime: "image/gif", label: "GIF image", test: (b) => str(b, 0, 3) === "GIF" },
  { mime: "image/bmp", label: "Bitmap image", test: (b) => b[0] === 0x42 && b[1] === 0x4d },
  { mime: "image/webp", label: "WebP image", test: (b) => str(b, 0, 4) === "RIFF" && str(b, 8, 4) === "WEBP" },
];

/** Recognised but NEVER inline — named so the UI can describe the file. */
const KNOWN: { mime: string; label: string; test: (b: Uint8Array) => boolean }[] = [
  // Recognised, and deliberately NOT inline: neither Chromium nor Firefox has a
  // TIFF decoder, so `inline` would render a broken image AND suppress the
  // download — the user would see nothing and have no way to get the bytes.
  { mime: "image/tiff", label: "TIFF image (not shown inline)", test: (b) => hex(b, 0, 4) === "49492a00" || hex(b, 0, 4) === "4d4d002a" },
  { mime: "application/pdf", label: "PDF document", test: (b) => str(b, 0, 4) === "%PDF" },
  { mime: "application/x-ole-storage", label: "Office document (legacy)", test: (b) => hex(b, 0, 4) === "d0cf11e0" },
  { mime: "application/zip", label: "Zip or Office document", test: (b) => hex(b, 0, 4) === "504b0304" },
  // Deliberately listed so it is RECOGNISED and still refused inline: an SVG
  // can carry <script>, and serving one from this origin would be stored XSS.
  { mime: "image/svg+xml", label: "SVG image (not shown inline)", test: (b) => /^\s*(<\?xml|<svg)/i.test(str(b, 0, 64)) },
];

const hex = (b: Uint8Array, at: number, n: number) =>
  Buffer.from(b.slice(at, at + n)).toString("hex");
const str = (b: Uint8Array, at: number, n: number) =>
  Buffer.from(b.slice(at, at + n)).toString("latin1");

export interface SniffResult {
  /** What to send as Content-Type. */
  mime: string;
  /** Human description for the UI. */
  label: string;
  /** True only for the raster formats a browser may render in place. */
  inline: boolean;
}

/**
 * What a file actually is, from its first bytes.
 *
 * Anything unrecognised is `application/octet-stream`, never guessed at from
 * the stored extension: an attacker controls that column on upload, and a
 * mis-declared type is exactly how a download becomes an execution.
 */
export function sniff(blob: Uint8Array | null | undefined): SniffResult {
  if (!blob || blob.length === 0) {
    return { mime: "application/octet-stream", label: "Empty file", inline: false };
  }
  for (const c of INLINE) {
    if (c.test(blob)) return { mime: c.mime, label: c.label, inline: true };
  }
  for (const c of KNOWN) {
    if (c.test(blob)) return { mime: c.mime, label: c.label, inline: false };
  }
  return { mime: "application/octet-stream", label: "File", inline: false };
}

/** A filename safe to put in a Content-Disposition header. */
export function safeFilename(des: string | null, ext: string | null, mime: string): string {
  const base = (des ?? "attachment")
    // Strip anything that could break out of the quoted header value or of a
    // directory when the browser saves it.
    .replace(/[\r\n"\\/\x00-\x1f]+/g, " ")
    .replace(/\.+/g, ".")
    .trim()
    .slice(0, 80) || "attachment";
  const known = ext && /^[A-Za-z0-9]{1,8}$/.test(ext) ? ext.toLowerCase() : null;
  const fromMime = mime.startsWith("image/") ? mime.slice(6).replace("+xml", "") : null;
  const suffix = known ?? fromMime;
  return suffix && !base.toLowerCase().endsWith(`.${suffix}`) ? `${base}.${suffix}` : base;
}

/** A header-legal rendering of a name that may hold anything. */
const asciiFallback = (name: string) =>
  name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_") || "attachment";

/** The headers an attachment response must carry, given what it turned out to be. */
export function attachmentHeaders(s: SniffResult, filename: string, bytes: number): Record<string, string> {
  return {
    "Content-Type": s.mime,
    "Content-Length": String(bytes),
    // The browser must not re-interpret the type we chose. Without this an
    // octet-stream download can still be sniffed into HTML and executed.
    "X-Content-Type-Options": "nosniff",
    // Inline only for the raster allow-list; everything else downloads.
    // RFC 6266. Node rejects a header value outside latin1 with
    // ERR_INVALID_CHAR, so a description like "café.jpg" — which the upload
    // route takes straight from the client's filename — would 500 this route
    // permanently and make those bytes unreachable. The ASCII form keeps the
    // response legal; filename* carries the real name for anything modern.
    "Content-Disposition":
      `${s.inline ? "inline" : "attachment"}; filename="${asciiFallback(filename)}"`
      + `; filename*=UTF-8''${encodeURIComponent(filename)}`,
    // Belt and braces for the inline case: even a served image is denied any
    // scripting context of its own.
    "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; sandbox",
    "Cache-Control": "private, max-age=300",
  };
}

/** Upload ceiling. The server's own bodyLimit is 50 MB; stay well inside it. */
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
