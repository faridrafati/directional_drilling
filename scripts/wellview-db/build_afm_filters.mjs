/**
 * The FILTERS a multi-well report template carries — read out of the `.afm`
 * files, which nothing else in this app reads.
 *
 * `reports-multi.json` was built without them, so every multi-well report ran
 * as `SELECT … WHERE idwell IN (…)` and returned the whole table. Three of the
 * shipped templates are byte-identical in their output as a result: "Drilling
 * Rigs with query", "Completion Rigs with query" and "Rigs with query" all
 * return the same 33 rows, on a database holding 22 drilling jobs, 10
 * completion/workover and 1 abandonment.
 *
 * THE FORMAT, worked out from the 57 shipped files rather than documented
 * anywhere. Each filter section begins with the nine bytes
 *
 *     cd cc 4c 40 00 00 00 00 01
 *
 * followed by an int32 count and that many records of
 *
 *     <len>table  <len>field  <len>value  int32 op  int32 flag
 *
 * with each string length-prefixed in a single byte. Twenty of the 57 files
 * carry at least one record; all twenty decode cleanly.
 *
 * WHAT IS KNOWN AND WHAT IS GUESSED — this matters, and the guesses are marked
 * in the output so the resolver can refuse rather than invent:
 *
 *   op 0  LIKE      21 records, always with a real value ("drill", "packer")
 *   op 1  NOT LIKE   2 records, both `wvjob.wvtyp = "drill"` on COMPLETION
 *                    reports, where "not a drilling job" is the only reading
 *                    that makes the report its own name
 *   op 8  IS NULL    6 records, every one `dttmpull = ""` — "still in the
 *                    hole", which is what a downhole-equipment report means
 *   op 9  IS NOT NULL 1 record, `wvperforation.shotdensity = ""`
 *   op 4  UNKNOWN    1 record, and its value is the string "NaN", so it is
 *                    junk either way. Emitted as unsupported, never applied.
 *
 * The second int32 takes 0 and 2 and its meaning is NOT established: 2 appears
 * both on valueless records (which look like sort columns) and on two records
 * carrying real values. It is carried through untouched and named `flag` rather
 * than given a meaning it has not earned.
 *
 * Usage:  node scripts/wellview-db/build_afm_filters.mjs [--write]
 * Without --write it prints what it found and changes nothing.
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..");
const SRC = process.env.WELLVIEW_MULTI_AFM ?? join(REPO, "WellView_files", "custom", "reports multi");
const OUT = join(REPO, "apps", "web", "public", "wellview-templates", "reports-multi.json");

const MARKER = Buffer.from([0xcd, 0xcc, 0x4c, 0x40]);

/** op → what it means in SQL. Anything absent is unsupported, not guessed. */
export const OPS = {
  0: "LIKE",
  1: "NOT LIKE",
  8: "IS NULL",
  9: "IS NOT NULL",
};

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (e.toLowerCase().endsWith(".afm")) out.push(p);
  }
  return out.sort();
}

/** A single-byte-length latin1 string, or undefined when it is not one. */
function readString(b, p) {
  if (p >= b.length) return [undefined, p];
  const n = b[p];
  if (n === 0) return ["", p + 1];
  if (n > 60 || p + 1 + n > b.length) return [undefined, p];
  const s = b.toString("latin1", p + 1, p + 1 + n);
  return [/^[\x20-\x7e]+$/.test(s) ? s : undefined, p + 1 + n];
}

/**
 * Every filter section in one file, in order.
 *
 * A section that does not decode cleanly is returned with `ok: false` and no
 * records. Refusing beats guessing: a filter attributed to the wrong block
 * empties a report that works today.
 */
export function readFilterSections(buf) {
  const out = [];
  let i = 0;
  while ((i = buf.indexOf(MARKER, i)) !== -1) {
    const at = i;
    i += 4;
    if (at + 13 > buf.length) { out.push({ at, ok: false, why: "truncated" }); continue; }
    if (buf.readInt32LE(at + 4) !== 0 || buf[at + 8] !== 0x01) {
      out.push({ at, ok: false, why: "not a filter header" });
      continue;
    }
    let p = at + 9;
    const count = buf.readInt32LE(p);
    p += 4;
    if (count < 0 || count > 40) { out.push({ at, ok: false, why: `count ${count}` }); continue; }

    const records = [];
    let ok = true;
    for (let k = 0; k < count; k++) {
      const [table, p1] = readString(buf, p);
      const [field, p2] = readString(buf, p1);
      const [value, p3] = readString(buf, p2);
      if (table === undefined || field === undefined || value === undefined || p3 + 8 > buf.length) {
        ok = false;
        break;
      }
      records.push({
        table, field, value,
        op: buf.readInt32LE(p3),
        flag: buf.readInt32LE(p3 + 4),
      });
      p = p3 + 8;
    }
    out.push(ok ? { at, ok: true, count, records, end: p } : { at, ok: false, why: "record did not decode" });
  }
  return out;
}

/**
 * The filters a template can actually be run with.
 *
 * A record is usable when its operator is known AND it has what that operator
 * needs — a value for LIKE, nothing for IS NULL. Everything else is returned as
 * `unsupported` so the report can say it did not apply them, which is the whole
 * point: a report that quietly drops its filters is indistinguishable from one
 * that has none.
 */
export function usableFilters(sections) {
  const filters = [];
  const unsupported = [];
  for (const s of sections) {
    if (!s.ok) { unsupported.push({ reason: s.why }); continue; }
    for (const r of s.records) {
      const sql = OPS[r.op];
      const needsValue = sql === "LIKE" || sql === "NOT LIKE";
      if (!sql) { unsupported.push({ ...r, reason: `operator ${r.op} is not understood` }); continue; }
      if (needsValue && !r.value) { unsupported.push({ ...r, reason: "no value" }); continue; }
      if (needsValue && r.value === "NaN") { unsupported.push({ ...r, reason: "value is NaN" }); continue; }
      filters.push({ table: r.table, field: r.field, op: sql, value: needsValue ? r.value : null });
    }
  }
  return { filters, unsupported };
}

// ── driver ───────────────────────────────────────────────────────────────────
if (process.argv[1] && process.argv[1].endsWith("build_afm_filters.mjs")) {
  if (!existsSync(SRC)) {
    console.error(`no multi-well templates at ${SRC}`);
    process.exit(1);
  }
  const files = walk(SRC);
  const byHtml = new Map();
  let withFilters = 0;
  let totalFilters = 0;
  let totalUnsupported = 0;

  for (const f of files) {
    const rel = f.slice(SRC.length + 1);
    const sections = readFilterSections(readFileSync(f));
    const { filters, unsupported } = usableFilters(sections);
    if (!filters.length && !unsupported.length) continue;
    if (filters.length) withFilters++;
    totalFilters += filters.length;
    totalUnsupported += unsupported.length;
    byHtml.set(rel, { filters, unsupported });
    console.log(`${rel}`);
    for (const x of filters) {
      console.log(`   APPLY   ${x.table}.${x.field} ${x.op}${x.value == null ? "" : ` "${x.value}"`}`);
    }
    for (const x of unsupported) {
      console.log(`   SKIP    ${x.table ?? "?"}.${x.field ?? "?"} — ${x.reason}`);
    }
  }

  console.log(`\n${files.length} templates; ${withFilters} carry a usable filter`);
  console.log(`filters ${totalFilters}, skipped ${totalUnsupported}`);

  if (!process.argv.includes("--write")) {
    console.log("\n(dry run — pass --write to merge into reports-multi.json)");
    process.exit(0);
  }

  /*
   * MERGED, never regenerated. `reports-multi.json` is a committed asset built
   * by a different path, and its 57 templates and their blocks are pinned by
   * tests. This adds a field; it must not rewrite the file.
   */
  const doc = JSON.parse(readFileSync(OUT, "utf8"));
  const list = doc.reports ?? doc;
  let matched = 0;
  for (const t of list) {
    // `html` is the .afm path with the extension swapped, which is the only
    // key that is unique: two folders both hold a "Downhole Equipment".
    const key = String(t.html ?? "").replace(/\.html?$/i, ".afm");
    const hit = byHtml.get(key);
    if (!hit) continue;
    matched++;
    if (hit.filters.length) t.filters = hit.filters;
    if (hit.unsupported.length) {
      t.filtersSkipped = hit.unsupported.map((u) =>
        `${u.table ?? "?"}.${u.field ?? "?"} — ${u.reason}`);
    }
  }
  writeFileSync(OUT, `${JSON.stringify(doc, null, 1)}\n`);
  console.log(`\nmerged into ${OUT} — ${matched} of ${byHtml.size} matched a template`);
}
