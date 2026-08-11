/**
 * Rasterises the converted SVGs to PNG using a real browser.
 *
 * WHY RASTERISE AT ALL
 * --------------------
 * WellView's icons are shaded 3-D renders exported as vector: roughly 500 tiny
 * gradient polygons each, 1,441 files, which comes to 56 MB of SVG after
 * minifying. At the size an icon is actually displayed none of that polygon
 * detail is visible, so PNG says the same thing in a fraction of the space.
 *
 * WHY A BROWSER
 * -------------
 * No image library is installed on this machine, and a hand-rolled rasteriser
 * would be a scanline fill with its own bugs. Chromium already renders SVG
 * correctly; this hands it the file and takes the pixels back.
 *
 * Reads a JSON work list on stdin: [{ svg, png, name }, …]. Writes each PNG and
 * prints one JSON summary line. Batched so one page render covers many icons.
 */
import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const SIZE = Number(process.env.SIZE ?? 128);
const BATCH = Number(process.env.BATCH ?? 40);

const work = JSON.parse(readFileSync(process.env.WORKLIST, "utf-8"));

/** A file becomes a data URL the browser can decode: SVG as text, others raw. */
function dataUrl(entry) {
  const buf = readFileSync(entry.src);
  if (entry.mime === "image/svg+xml") {
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(buf.toString("utf-8"));
  }
  return `data:${entry.mime};base64,${buf.toString("base64")}`;
}
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 400, height: 400 } });

let written = 0;
const failures = [];
const blank = [];

for (let start = 0; start < work.length; start += BATCH) {
  const slice = work.slice(start, start + BATCH);
  const svgs = slice.map((w) => {
    try {
      return dataUrl(w);
    } catch {
      failures.push({ name: w.name, error: "source unreadable" });
      return null;
    }
  });

  // One page evaluation per batch: each SVG becomes an <img>, drawn onto a
  // canvas of SIZE×SIZE preserving aspect, then read back as a PNG data URL.
  const dataUrls = await page.evaluate(
    async ({ svgs, size }) => {
      const out = [];
      for (const url of svgs) {
        if (url === null) { out.push(null); continue; }
        try {
          const img = new Image();
          await new Promise((res, rej) => {
            img.onload = res;
            img.onerror = () => rej(new Error("decode"));
            img.src = url;
          });
          const w = img.naturalWidth || size;
          const h = img.naturalHeight || size;
          const scale = Math.min(size / w, size / h);
          const cw = Math.max(1, Math.round(w * scale));
          const ch = Math.max(1, Math.round(h * scale));
          const canvas = document.createElement("canvas");
          canvas.width = cw;
          canvas.height = ch;
          const ctx = canvas.getContext("2d");
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, 0, 0, cw, ch);
          // How much of the canvas actually got painted. A render that comes
          // back all-transparent or all-white is reported rather than shipped
          // as if it were the icon.
          const px = ctx.getImageData(0, 0, cw, ch).data;
          let ink = 0;
          for (let q = 0; q < px.length; q += 4) {
            if (px[q + 3] > 8 && !(px[q] > 247 && px[q + 1] > 247 && px[q + 2] > 247)) ink += 1;
          }
          out.push({ url: canvas.toDataURL("image/png"), inkRatio: ink / (cw * ch) });
        } catch {
          out.push(null);
        }
      }
      return out;
    },
    { svgs, size: SIZE },
  );

  dataUrls.forEach((res, k) => {
    const w = slice[k];
    if (!res) {
      failures.push({ name: w.name, error: "render failed" });
      return;
    }
    mkdirSync(dirname(w.png), { recursive: true });
    writeFileSync(w.png, Buffer.from(res.url.split(",")[1], "base64"));
    written += 1;
    if (res.inkRatio < 0.005) blank.push({ name: w.name, inkRatio: Number(res.inkRatio.toFixed(4)) });
  });

  if (process.env.VERBOSE) {
    process.stderr.write(`  ${Math.min(start + BATCH, work.length)}/${work.length}\n`);
  }
}

await browser.close();
console.log(JSON.stringify({ written, failures, blank }));
