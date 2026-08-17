/**
 * Extract WellView's saved Query Templates (§8.1) into JSON.
 *
 * `WellView_files/custom/queries/<category>/<name>.afq` holds the queries
 * Chevron ships — "Drilling Report Today", "Bits", "Failures by Date Range" —
 * as Peloton's binary: length-prefixed latin1 strings with fixed fields between.
 *
 * Each criterion appears twice: a field DECLARATION (table, field) and then the
 * CONDITION (table, field, operator, and a value unless the query prompts for
 * one). Strings are read in ORDER rather than at fixed offsets, because the
 * fixed fields between them vary in width — the same approach that decodes the
 * .dvdc chart templates.
 *
 *   node scripts/wellview-db/build_queries.mjs
 *     → apps/web/public/wellview-templates/queries.json
 */
import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..");
const ROOT = process.env.WELLVIEW_QUERIES ?? join(REPO, "WellView_files", "custom", "queries");
const OUT = join(REPO, "apps", "web", "public", "wellview-templates", "queries.json");

/** The operators WellView writes. Anything else in that slot is a value. */
const OPS = new Set([
  "=", "<>", "!=", ">", "<", ">=", "<=", "LIKE", "NOT LIKE",
  "IS NULL", "IS NOT NULL", "IN", "NOT IN", "BETWEEN",
]);
/** Operators that take no value at all. */
const NULLARY = new Set(["IS NULL", "IS NOT NULL"]);

function strings(buf) {
  const out = [];
  let i = 0;
  while (i < buf.length) {
    const n = buf[i];
    if (n >= 1 && n <= 100 && i + 1 + n <= buf.length) {
      const s = buf.toString("latin1", i + 1, i + 1 + n);
      if (/^[\x20-\x7e]+$/.test(s)) { out.push(s); i += 1 + n; continue; }
    }
    i++;
  }
  return out;
}

function parse(buf) {
  const st = strings(buf);
  const criteria = [];
  let i = 0;
  while (i < st.length) {
    if (!/^wv/i.test(st[i])) { i++; continue; }
    const table = st[i];
    const field = st[i + 1];
    if (!field) break;
    let j = i + 2;
    // The pair repeats before the condition; skip the echo when present.
    if (st[j] === table && st[j + 1] === field) j += 2;
    let op = null;
    let value = null;
    if (j < st.length && OPS.has(st[j].toUpperCase())) {
      op = st[j].toUpperCase();
      j++;
      if (!NULLARY.has(op) && j < st.length
        && !/^wv/i.test(st[j]) && !OPS.has(st[j].toUpperCase())) {
        value = st[j];
        j++;
      }
    }
    // A criterion with no operator is not usable; keep it visible rather than
    // dropping it silently, so a parse miss shows up instead of shrinking a query.
    criteria.push({
      table: table.toLowerCase(),
      field: field.toLowerCase(),
      op,
      value,
      /** §8.1 "Select Prompt for Value" — the user supplies it at run time. */
      prompts: op !== null && !NULLARY.has(op) && value === null,
    });
    i = j;
  }
  return criteria;
}

const queries = [];
for (const cat of readdirSync(ROOT).filter((d) => statSync(join(ROOT, d)).isDirectory()).sort()) {
  for (const f of readdirSync(join(ROOT, cat)).filter((x) => x.toLowerCase().endsWith(".afq")).sort()) {
    const name = f.replace(/\.afq$/i, "");
    const criteria = parse(readFileSync(join(ROOT, cat, f)));
    queries.push({ id: `${cat}/${name}`, category: cat, name, criteria });
  }
}

const payload = {
  generated_from: "WellView_files/custom/queries/**/*.afq",
  query_count: queries.length,
  queries,
};
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(payload, null, 1));

const prompts = queries.filter((q) => q.criteria.some((c) => c.prompts)).length;
const noOp = queries.flatMap((q) => q.criteria).filter((c) => !c.op).length;
console.log(`queries → ${OUT}`);
console.log(`  ${queries.length} templates in ${new Set(queries.map((q) => q.category)).size} categories`);
console.log(`  ${queries.flatMap((q) => q.criteria).length} criteria, ${prompts} templates prompt for a value`);
if (noOp) console.log(`  NOTE: ${noOp} criteria parsed with no operator — check the decoder`);
