/**
 * WellView pick-lists, DERIVED FROM THE SAMPLE DATABASE, bound with the MODEL.
 *
 * WHY THIS IS A DERIVATION, NOT A CONVERSION
 * ------------------------------------------
 * WellView's real pick-list libraries live in custom/library/*.lib — 754 files,
 * each a ZipCrypto-encrypted ZIP sealed with Peloton's private password. They
 * cannot be opened here, and the app must never pretend otherwise. What CAN be
 * recovered is the set of values that actually OCCUR in the converted sample
 * database: `libCasDes` is bound (by the model) to wvCas.Des, so the distinct
 * casing descriptions in that column are a real, usable subset of that library.
 *
 * This script writes that subset and labels it as exactly that: a sample-data
 * derivation, not the curated library. A field the sample never populated comes
 * out empty here even though its true library is full — that gap is reported,
 * not hidden.
 *
 * NAME RESOLUTION — MODEL FIRST, HEURISTIC FALLBACK
 * -------------------------------------------------
 * The authoritative binding of a library to a table.column is in WellView's own
 * data model, `system/Peloton.WellView.mdl.xml`. Every field that draws from a
 * library carries `lookuptyp="library" libtablename="libCasDes" libfieldname="Des"`
 * inside its owning `<afmtable keytbl="wvCas">`. So `libCasDes` binds, exactly,
 * to wvCas.Des — no guessing — and the model also gives the field's caption.
 *
 * For the handful of .lib files the model does not mention (deprecated or add-in
 * libraries), we fall back to the old structural heuristic: strip `lib`, take the
 * LONGEST prefix that is a real `wv<table>` whose remainder is a real column.
 *
 * A library that neither the model nor the heuristic can bind, or whose column is
 * empty in the sample, is left out and counted; its values exist only inside the
 * encrypted file. Values are ordered most-common-first with occurrence counts.
 *
 * Output: apps/web/public/wellview-picklists.json
 * Usage:  node scripts/wellview-db/build_picklists.mjs
 */
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..");

const LIB_DIR = process.env.WELLVIEW_LIB_DIR
  ?? join(REPO, "WellView_files", "custom", "library");
const SAMPLE_DB = process.env.WELLVIEW_SAMPLE_DB
  ?? join(REPO, "sqlite_DB", "wellview", "wv9.0_Sample.sqlite");
const MODEL_XML = process.env.WELLVIEW_MODEL_XML
  ?? join(REPO, "WellView_files", "system", "Peloton.WellView.mdl.xml");
const OUT = join(REPO, "apps", "web", "public", "wellview-picklists.json");

/** A library counts as a usable dropdown at this many distinct values. */
const USABLE_MIN = 3;
/** Defensive ceiling on values per list (real pick lists are far smaller). */
const VALUE_CAP = 1000;

if (!existsSync(LIB_DIR)) {
  console.error(`library folder not found: ${LIB_DIR}`);
  process.exit(2);
}
if (!existsSync(SAMPLE_DB)) {
  console.error(
    `sample database not found: ${SAMPLE_DB}\n`
    + `convert it first: node scripts/wellview-db/mdb_to_sqlite.mjs "WellView_files/db" sqlite_DB/wellview`,
  );
  process.exit(2);
}

const db = new DatabaseSync(SAMPLE_DB, { readOnly: true });

// Schema map: lowercased table -> { name, cols: lowercased -> actual }.
const schema = new Map();
for (const { name } of db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()) {
  const cols = new Map();
  for (const c of db.prepare(`PRAGMA table_info("${name}")`).all()) {
    cols.set(c.name.toLowerCase(), c.name);
  }
  schema.set(name.toLowerCase(), { name, cols });
}

/**
 * Authoritative bindings from the data model: lowercased libtablename ->
 * { table, field, caption }. Walk afmtable/afmfield tags in document order so
 * each library field is attributed to its owning table's `keytbl`.
 */
function loadModelBindings(xmlPath) {
  const map = new Map();
  if (!existsSync(xmlPath)) {
    console.warn(`model not found (${xmlPath}); using the structural heuristic only.\n`);
    return map;
  }
  const xml = readFileSync(xmlPath, "utf8");
  const attr = (tag, name) => {
    const m = tag.match(new RegExp(`${name}="([^"]*)"`));
    return m ? m[1] : null;
  };
  let table = null;
  for (const [tag] of xml.matchAll(/<afmtable\b[^>]*>|<afmfield\b[^>]*\/>/g)) {
    if (tag.startsWith("<afmtable")) {
      table = attr(tag, "keytbl");
    } else if (tag.includes('lookuptyp="library"')) {
      const lib = attr(tag, "libtablename");
      const field = attr(tag, "libfieldname") ?? attr(tag, "keyfld");
      if (lib && table && field && !map.has(lib.toLowerCase())) {
        map.set(lib.toLowerCase(), { table, field, caption: attr(tag, "captionlong") ?? "" });
      }
    }
  }
  return map;
}
const model = loadModelBindings(MODEL_XML);

/** Resolve to an actual { table, column, caption, binding } or null. */
function resolve(base) {
  const bind = model.get(base.toLowerCase());
  if (bind) {
    const t = schema.get(bind.table.toLowerCase());
    const col = t?.cols.get(bind.field.toLowerCase());
    if (col) return { table: t.name, column: col, caption: bind.caption, binding: "model" };
  }
  // Fallback: structural heuristic, longest real wv<table> prefix wins.
  const body = base.startsWith("lib") ? base.slice(3) : base;
  for (let i = body.length; i > 0; i -= 1) {
    const t = schema.get("wv" + body.slice(0, i));
    if (!t) continue;
    const col = t.cols.get(body.slice(i));
    if (col) return { table: t.name, column: col, caption: "", binding: "heuristic" };
  }
  return null;
}

const libs = readdirSync(LIB_DIR)
  .filter((f) => f.toLowerCase().endsWith(".lib"))
  .map((f) => basename(f, ".lib"))
  .sort();

const picklists = {};
const encryptedOnly = [];   // resolved to nothing, or the column was empty in the sample
let usable = 0, sparse = 0, resolvedEmpty = 0, unresolved = 0;
let boundByModel = 0, boundByHeuristic = 0;

console.log(`Resolving ${libs.length} WellView libraries (model bindings + sample data)…\n`);
let done = 0;
for (const lib of libs) {
  done += 1;
  const hit = resolve(lib);
  if (!hit) {
    unresolved += 1;
    encryptedOnly.push({ library: lib, reason: "no matching table.column" });
    if (done % 100 === 0) console.log(`  [${done}/${libs.length}] …`);
    continue;
  }
  if (hit.binding === "model") boundByModel += 1; else boundByHeuristic += 1;
  const rows = db.prepare(
    `SELECT "${hit.column}" AS v, COUNT(*) AS c FROM "${hit.table}"
     WHERE "${hit.column}" IS NOT NULL AND TRIM(CAST("${hit.column}" AS TEXT)) <> ''
     GROUP BY "${hit.column}" ORDER BY c DESC, v LIMIT ${VALUE_CAP}`,
  ).all();

  if (rows.length === 0) {
    resolvedEmpty += 1;
    encryptedOnly.push({ library: lib, reason: `${hit.table}.${hit.column} empty in sample data` });
  } else {
    const isUsable = rows.length >= USABLE_MIN;
    if (isUsable) usable += 1; else sparse += 1;
    picklists[lib] = {
      source: `${hit.table}.${hit.column}`,
      caption: hit.caption,
      binding: hit.binding,
      usable: isUsable,
      count: rows.length,
      values: rows.map((r) => ({ value: String(r.v), count: Number(r.c) })),
    };
    const tag = isUsable ? "" : "  (sparse)";
    const via = hit.binding === "heuristic" ? "  (heuristic)" : "";
    console.log(`  [${done}/${libs.length}] ${lib} → ${hit.table}.${hit.column}  ${rows.length} values${tag}${via}`);
  }
}

const catalog = {
  generated_from: "sqlite_DB/wellview/wv9.0_Sample.sqlite",
  bound_with: "WellView_files/system/Peloton.WellView.mdl.xml",
  derivation: "sample-data",
  note:
    "DERIVED from the sample database, NOT decrypted from the WellView .lib files. "
    + "Each library is BOUND to its table.column by WellView's own data model (mdl.xml); "
    + "the values are then the distinct entries that occur in that column, so a field the "
    + "sample never populated is absent here even though its true (encrypted) library would "
    + "carry a full list. Values are ordered most-common-first with occurrence counts.",
  library_count: libs.length,
  bound_by_model: boundByModel,
  bound_by_heuristic: boundByHeuristic,
  usable, sparse,
  resolved_but_empty: resolvedEmpty,
  unresolved,
  encrypted_only: encryptedOnly,
  picklists,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(catalog, null, 1));

console.log(`\n──────────────────────────────────────────────`);
console.log(`libraries scanned      : ${libs.length}`);
console.log(`bound by model / heur. : ${boundByModel} / ${boundByHeuristic}`);
console.log(`usable dropdowns (${USABLE_MIN}+) : ${usable}`);
console.log(`sparse (1-2 values)    : ${sparse}`);
console.log(`resolved but empty     : ${resolvedEmpty}`);
console.log(`unresolved             : ${unresolved}`);
console.log(`\nwrote ${OUT}`);
console.log(`(the ${resolvedEmpty + unresolved} not covered live only inside the encrypted .lib files)`);
db.close();
