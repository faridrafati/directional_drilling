/**
 * Attachments: what a file IS, and what the server is willing to say it is.
 *
 * The dangerous move in this feature is serving a file somebody else uploaded
 * back from this application's own origin. So these test the refusals hardest:
 * that the type comes from the bytes and never from the stored extension, that
 * nothing outside a small raster allow-list is ever marked renderable, and that
 * an SVG — an image and a script host at once — is recognised precisely so it
 * can be refused rather than falling through as "probably fine".
 */
import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { sniff, safeFilename, attachmentHeaders, MAX_ATTACHMENT_BYTES } from "./attachments.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const SAMPLE = join(HERE, "..", "..", "..", "..", "sqlite_DB", "wellview", "wv9.0_Sample.sqlite");

const bytes = (...b: number[]) => new Uint8Array(b);
const ascii = (s: string) => new Uint8Array(Buffer.from(s, "latin1"));

describe("attachment type detection", () => {
  it("reads the format from the magic number", () => {
    expect(sniff(bytes(0xff, 0xd8, 0xff, 0xe0)).mime).toBe("image/jpeg");
    expect(sniff(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)).mime).toBe("image/png");
    expect(sniff(ascii("GIF89a")).mime).toBe("image/gif");
    expect(sniff(bytes(0x42, 0x4d, 0x00)).mime).toBe("image/bmp");
    expect(sniff(ascii("%PDF-1.4")).mime).toBe("application/pdf");
    expect(sniff(bytes(0xd0, 0xcf, 0x11, 0xe0)).mime).toBe("application/x-ole-storage");
  });

  it("marks ONLY raster images renderable in place", () => {
    for (const b of [bytes(0xff, 0xd8, 0xff), ascii("GIF89a"), bytes(0x42, 0x4d)]) {
      expect(sniff(b).inline).toBe(true);
    }
    // A PDF, an Office file and a zip are recognised but never inline.
    for (const b of [ascii("%PDF-1.4"), bytes(0xd0, 0xcf, 0x11, 0xe0), bytes(0x50, 0x4b, 0x03, 0x04)]) {
      expect(sniff(b).inline).toBe(false);
    }
  });

  it("REFUSES to render an SVG in place, because it can carry script", () => {
    // The whole reason SVG is in the recognised list at all: so it is named
    // and refused, rather than reaching the octet-stream default by accident
    // and looking like a decision nobody made.
    const svg = ascii('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    expect(sniff(svg).mime).toBe("image/svg+xml");
    expect(sniff(svg).inline).toBe(false);
    expect(sniff(ascii('<?xml version="1.0"?><svg/>')).inline).toBe(false);
  });

  it("treats anything unrecognised as an opaque download, never a guess", () => {
    expect(sniff(ascii("<html><script>alert(1)</script>")).mime).toBe("application/octet-stream");
    expect(sniff(ascii("#!/bin/sh\nrm -rf /")).mime).toBe("application/octet-stream");
    expect(sniff(bytes(0, 1, 2, 3)).inline).toBe(false);
    expect(sniff(null).mime).toBe("application/octet-stream");
    expect(sniff(new Uint8Array(0)).inline).toBe(false);
  });

  it("never lets a filename break out of the header or the folder", () => {
    // Des is user-controlled on upload and would otherwise land verbatim in
    // Content-Disposition.
    expect(safeFilename('evil"; filename="x.html', "jpg", "image/jpeg")).not.toContain('"');
    expect(safeFilename("../../etc/passwd", null, "application/octet-stream")).not.toContain("/");
    expect(safeFilename("a\r\nSet-Cookie: x=1", "jpg", "image/jpeg")).not.toMatch(/[\r\n]/);
    expect(safeFilename(null, null, "application/octet-stream")).toBe("attachment");
    // A sensible name survives intact.
    expect(safeFilename("Wellhead_01", "jpg", "image/jpeg")).toBe("Wellhead_01.jpg");
  });

  it("sends headers that stop the browser second-guessing the type", () => {
    const h = attachmentHeaders(sniff(ascii("%PDF-1.4")), "doc.pdf", 10);
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(h["Content-Disposition"]).toMatch(/^attachment;/);
    const img = attachmentHeaders(sniff(bytes(0xff, 0xd8, 0xff)), "a.jpg", 10);
    expect(img["Content-Disposition"]).toMatch(/^inline;/);
    // Even a served image gets no scripting context of its own.
    expect(img["Content-Security-Policy"]).toContain("default-src 'none'");
  });

  it("REFUSES to show a TIFF inline, because no mainstream browser decodes one", () => {
    // Marking it inline is the worst of both branches: the <img> is broken AND
    // the disposition suppresses the download, so the bytes become unreachable.
    const tiffLE = new Uint8Array([0x49, 0x49, 0x2a, 0x00, 0, 0, 0, 0]);
    const tiffBE = new Uint8Array([0x4d, 0x4d, 0x00, 0x2a, 0, 0, 0, 0]);
    for (const t of [tiffLE, tiffBE]) {
      expect(sniff(t).mime).toBe("image/tiff");
      expect(sniff(t).inline).toBe(false);
    }
    expect(attachmentHeaders(sniff(tiffLE), "scan.tiff", 9)["Content-Disposition"]).toMatch(/^attachment;/);
  });

  it("survives a non-ASCII description instead of 500-ing forever", () => {
    // The upload route defaults Des to the client's filename, so "café.jpg" is
    // one upload away. Node rejects a header value outside latin1 with
    // ERR_INVALID_CHAR, which made those bytes permanently unreachable.
    const h = attachmentHeaders(sniff(bytes(0xff, 0xd8, 0xff)), "wellhead café ☃.jpg", 10);
    const cd = h["Content-Disposition"];
    // Every byte of the header must be header-legal…
    expect(() => Buffer.from(cd, "latin1").toString("latin1")).not.toThrow();
    expect(/^[\x20-\x7e]*$/.test(cd), cd).toBe(true);
    // …and the real name still travels, per RFC 6266.
    expect(cd).toContain("filename*=UTF-8''");
    expect(decodeURIComponent(cd.split("filename*=UTF-8''")[1])).toBe("wellhead café ☃.jpg");
  });

  it("caps uploads well inside the server's own body limit", () => {
    expect(MAX_ATTACHMENT_BYTES).toBeLessThan(50 * 1024 * 1024);
  });
});

describe.skipIf(!existsSync(SAMPLE))("against the real attachments", () => {
  it("types all 17, and disagrees with the stored size on 9 of them", () => {
    const db = new DatabaseSync(SAMPLE, { readOnly: true });
    const rows = db.prepare("SELECT Des, AttachExtension, AttachBlobSz, AttachBlob FROM wvAttachment").all() as
      { Des: string | null; AttachExtension: string | null; AttachBlobSz: number | null; AttachBlob: Uint8Array | null }[];
    expect(rows).toHaveLength(17);

    let images = 0;
    let sizeWrong = 0;
    for (const r of rows) {
      const s = sniff(r.AttachBlob);
      expect(r.AttachBlob!.length, String(r.Des)).toBeGreaterThan(0);
      if (s.inline) images++;
      if ((r.AttachBlobSz ?? 0) !== r.AttachBlob!.length) sizeWrong++;
      // Nothing in the real data may be typed as something renderable unless
      // it really is a raster image.
      if (s.inline) expect(s.mime.startsWith("image/")).toBe(true);
    }
    // 13 images, 4 documents; and the stored size lies on 9 rows, which is why
    // the byte length is used instead.
    expect(images).toBe(13);
    expect(sizeWrong).toBe(9);
  });
});
