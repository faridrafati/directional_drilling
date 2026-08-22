/**
 * Decode WellView's Days vs Depth / Cost chart templates (.dvdc) to JSON.
 *
 * Same shape of format as .afq and .afr: length-prefixed latin1 strings read in
 * ORDER, never at fixed offsets, because the fixed fields between them vary in
 * width. A template is a list of SERIES, each written as four consecutive
 * strings:
 *
 *   x field   e.g. "dayjobmlplancalc"
 *   table     e.g. "wvjobprogramphase"      ← the table BOTH fields belong to
 *   y field   e.g. "depthendplan"
 *   caption   e.g. "Planned Likely Cum Days vs Planned End Depth (Phase)"
 *
 * followed by the absolute path the template was saved from and its own name.
 * The trailing path is how the run of series ends: it is the first string that
 * is not part of a quadruple, and in the sample it is sometimes truncated by
 * the 120-byte string cap, which is why the terminator is recognised by shape
 * (a drive letter or a backslash) rather than by length.
 *
 *   node scripts/wellview-db/build_dvdc.mjs
 *     → apps/web/public/wellview-templates/days-vs-depth.json
 */
import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..");
const ROOT = process.env.WELLVIEW_DVDC
  ?? join(REPO, "WellView_files", "custom", "daysvdepthcost");
const OUT = join(REPO, "apps", "web", "public", "wellview-templates", "days-vs-depth.json");

/** Every printable length-prefixed string in the file, in order. */
function strings(buf) {
  const out = [];
  let i = 0;
  while (i < buf.length) {
    const n = buf[i];
    if (n >= 1 && n <= 120 && i + 1 + n <= buf.length) {
      const s = buf.toString("latin1", i + 1, i + 1 + n);
      if (/^[\x20-\x7e]+$/.test(s)) { out.push(s); i += 1 + n; continue; }
    }
    i++;
  }
  return out;
}

/** A saved-from path, which is where the series list stops. */
const isPath = (s) => /^[A-Za-z]?:\\/.test(s) || s.includes("\\");

function parse(buf) {
  const st = strings(buf);
  const series = [];
  let i = 0;
  while (i + 3 < st.length) {
    const [x, table, y, caption] = st.slice(i, i + 4);
    if (isPath(x) || !/^wv/i.test(table)) break;
    series.push({
      x: x.toLowerCase(),
      table: table.toLowerCase(),
      y: y.toLowerCase(),
      caption,
    });
    i += 4;
  }
  return series;
}

const templates = [];
const walk = (dir, rel) => {
  for (const e of readdirSync(dir).sort()) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) { walk(p, rel ? `${rel}/${e}` : e); continue; }
    if (!/\.dvdc$/i.test(e)) continue;
    const name = e.replace(/\.dvdc$/i, "");
    templates.push({
      id: rel ? `${rel}/${name}` : name,
      folder: rel,
      name,
      series: parse(readFileSync(p)),
    });
  }
};
walk(ROOT, "");

const payload = {
  generated_from: "WellView_files/custom/daysvdepthcost/**/*.dvdc",
  template_count: templates.length,
  templates,
};
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(payload, null, 1));

const all = templates.flatMap((t) => t.series);
console.log(`days-vs-depth → ${OUT}`);
console.log(`  ${templates.length} templates, ${all.length} series`);
console.log(`  x fields: ${[...new Set(all.map((s) => s.x))].join(", ")}`);
console.log(`  y fields: ${[...new Set(all.map((s) => s.y))].join(", ")}`);
const empty = templates.filter((t) => !t.series.length);
if (empty.length) console.log(`  NOTE: ${empty.length} template(s) decoded to no series — check the decoder`);
