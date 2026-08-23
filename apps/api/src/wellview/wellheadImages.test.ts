/**
 * The images attached to a wellhead, on the Wellhead tab.
 *
 * The tab drew the vendor clip-art WellView records against an assembly — a
 * drawing of the TYPE of head, the same picture for every well that chose it —
 * and nothing else. Meanwhile eight images of these assemblies sat in
 * wvAttachment across five wells: "Wellhead_01" at 227 KB, a 692 KB bitmap,
 * three GIFs on one well.
 *
 * The audit called them photographs; they are engineering diagrams, and the
 * screen says "images" for that reason. Sample 15's wellhead carries the
 * comment "refer to attached diagram" — the diagram it refers to is one of
 * these, and this screen had no way to show it.
 *
 * They were never lost — Edit Data > Attachments reached them all along. This
 * is simply the one screen where someone looking at a wellhead expects to find
 * a picture of it, and the route never read the table.
 *
 * One of the eight names a wvWellhead record that is not in this export, so it
 * belongs to no card and appears on no tab. That is pinned below rather than
 * papered over: seven is the honest number the tab can show.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Fastify, { type FastifyInstance } from "fastify";
import { DatabaseSync } from "node:sqlite";
import { registerWellviewDbRoutes } from "../routes/wellviewDb.js";
import { issueToken } from "../entry/auth.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const SAMPLE = join(HERE, "..", "..", "..", "..", "sqlite_DB", "wellview", "wv9.0_Sample.sqlite");
const DB = "wv9.0_Sample";
const d = describe.skipIf(!existsSync(SAMPLE));

interface Att {
  idrec: string; des: string | null; extension: string | null;
  bytes: number; mime: string | null; kind: string; inline: boolean;
}
interface Head { idrec: string; icon: string | null; attachments?: Att[] }

let app: FastifyInstance;
let auth: { Authorization: string };

beforeAll(async () => {
  app = Fastify();
  await registerWellviewDbRoutes(app);
  await app.ready();
  const { token } = issueToken({ id: "test", username: "vitest", role: "admin" });
  auth = { Authorization: `Bearer ${token}` };
});
afterAll(async () => { await app?.close(); });

const wellheads = async (idwell: string) => {
  const res = await app.inject({
    url: `/entry/wellview/dbs/${DB}/wellheads?idwell=${idwell}`, headers: auth,
  });
  expect(res.statusCode).toBe(200);
  return (res.json() as { wellheads: Head[] }).wellheads;
};

/** What the database holds, asked directly — the standard the route is held to. */
function truth() {
  const raw = new DatabaseSync(SAMPLE, { readOnly: true });
  const all = raw.prepare(`
    SELECT a.IDRec idrec, a.idwell, a.IDRecParent parent, a.Des des,
           length(a.AttachBlob) bytes,
           (SELECT COUNT(*) FROM wvWellhead h WHERE h.IDRec = a.IDRecParent) live
      FROM wvAttachment a WHERE lower(a.TblKeyParent) = 'wvwellhead'`)
    .all() as { idrec: string; idwell: string; parent: string; des: string; bytes: number; live: number }[];
  raw.close();
  return all;
}

d("the Wellhead tab shows the images recorded against a head", () => {
  it("finds them all, and knows which one has no card to sit on", () => {
    const all = truth();
    expect(all.length, "wellhead images in the sample").toBe(8);
    expect(new Set(all.map((a) => a.idwell)).size, "wells carrying them").toBe(5);
    expect(all.filter((a) => a.live).length, "with a wvWellhead parent that exists").toBe(7);

    // The odd one out is named, so a later change to the export is noticed.
    const orphan = all.filter((a) => !a.live);
    expect(orphan.map((a) => a.des)).toEqual(["Cameron S Wellhead"]);
  });

  it("attaches each image to the head it names", async () => {
    const all = truth();
    const live = all.filter((a) => a.live);
    const byWell = new Map<string, typeof live>();
    for (const a of live) byWell.set(a.idwell, [...(byWell.get(a.idwell) ?? []), a]);
    expect(byWell.size, "wells whose heads can show an image").toBe(4);

    let shown = 0;
    for (const [idwell, expected] of byWell) {
      const heads = await wellheads(idwell);
      const got = heads.flatMap((h) => (h.attachments ?? []).map((a) => ({ head: h.idrec, ...a })));
      expect(got.length, `images returned for ${idwell.slice(0, 8)}`).toBe(expected.length);

      for (const e of expected) {
        const mine = got.find((g) => g.idrec === e.idrec);
        expect(mine, `${e.des} came back`).toBeTruthy();
        // On the RIGHT head — not merely somewhere on the well.
        expect(mine!.head).toBe(e.parent);
        expect(mine!.bytes).toBe(e.bytes);
        expect(mine!.des).toBe(e.des);
      }
      shown += got.length;
    }
    expect(shown, "images the tab can now show").toBe(7);
  }, 60_000);

  it("sends metadata only — the 692 KB bitmap is not in the listing", async () => {
    // A listing that inlined the blobs would move 1.7 MB to draw one tab. The
    // bytes come from the attachment content route, on demand, per thumbnail.
    const big = truth().find((a) => a.des === "Wellhead image")!;
    expect(big.bytes).toBeGreaterThan(600_000);

    const res = await app.inject({
      url: `/entry/wellview/dbs/${DB}/wellheads?idwell=${big.idwell}`, headers: auth,
    });
    expect(res.statusCode).toBe(200);
    // The whole response for this well is far smaller than the one file on it.
    expect(res.body.length).toBeLessThan(big.bytes / 4);
    expect(res.body).not.toContain("AttachBlob");

    const head = (res.json() as { wellheads: Head[] }).wellheads
      .find((h) => (h.attachments ?? []).some((a) => a.des === "Wellhead image"))!;
    const a = head.attachments!.find((x) => x.des === "Wellhead image")!;
    expect(a.bytes).toBe(big.bytes);
    // Sniffed from the magic number, not trusted from the file extension.
    expect(a.mime).toBe("image/bmp");
    expect(a.inline).toBe(true);
  });

  it("every image it marks inline really is one a browser can draw", async () => {
    // `inline` is what makes the tab render an <img>. If it were guessed from
    // the extension, a mislabelled file would show as a broken image AND hide
    // the fact that a picture exists. All seven are sniffed.
    const live = truth().filter((a) => a.live);
    const wells = [...new Set(live.map((a) => a.idwell))];
    const mimes = new Set<string>();
    for (const idwell of wells) {
      for (const h of await wellheads(idwell)) {
        for (const a of h.attachments ?? []) {
          expect(a.inline, `${a.des} is drawable`).toBe(true);
          mimes.add(a.mime ?? "");
        }
      }
    }
    expect([...mimes].sort()).toEqual(["image/bmp", "image/gif", "image/jpeg"]);
  }, 60_000);

  it("serves the actual bytes when a thumbnail asks for them", async () => {
    const one = truth().find((a) => a.live && a.des === "Wellhead_01")!;
    const res = await app.inject({
      url: `/entry/wellview/dbs/${DB}/attachments/${one.idrec}/content`, headers: auth,
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("image/jpeg");
    expect(res.rawPayload.length).toBe(one.bytes);
    // A real JPEG, start to finish.
    expect([...res.rawPayload.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
  });

  it("says nothing rather than something wrong on a head with no images", async () => {
    const raw = new DatabaseSync(SAMPLE, { readOnly: true });
    const bare = raw.prepare(`
      SELECT h.idwell FROM wvWellhead h
       WHERE h.idwell NOT IN (
         SELECT idwell FROM wvAttachment WHERE lower(TblKeyParent) = 'wvwellhead')
       LIMIT 1`).get() as { idwell: string } | undefined;
    raw.close();
    expect(bare, "a well with heads and no images exists").toBeTruthy();

    for (const h of await wellheads(bare!.idwell)) {
      expect(h.attachments).toEqual([]);
    }
  });
});
