/**
 * WellView pick-lists, DERIVED FROM THE SAMPLE DATABASE.
 *
 * WHY THIS IS A DERIVATION, NOT A CONVERSION
 * ------------------------------------------
 * WellView's real pick-list libraries live in custom/library/*.lib — 754 files,
 * each a ZipCrypto-encrypted ZIP sealed with Peloton's private password. They
 * cannot be opened here, and the app must never pretend otherwise. What CAN be
 * recovered is the set of values that actually OCCUR in the converted sample
 * database: `libcasdes` names wvCas.Des, so the distinct casing descriptions in
 * that column are a real, usable subset of what that library would offer.
 *
 * This script writes that subset and labels it as exactly that: a sample-data
 * derivation, not the curated library. A field the sample never populated comes
 * out empty here even though its true library is full — that gap is reported,
 * not hidden.
 *
 * NAME RESOLUTION
 * ---------------
 * A library is named lib<table><column>: strip `lib`, then take the LONGEST
 * prefix that is a real `wv<table>` whose remainder is a real column of that
 * table. Longest-first matters — `libcascomp…` must bind to wvCasComp before
 * wvCas. A name that resolves to no such table.column is left out and counted;
 * its values exist only inside the encrypted file.
 *
 * Values are ordered most-common-first (the practical order for a dropdown) and
 * carry their occurrence count, so a consumer can re-sort alphabetically if it
 * prefers.
 *
 * Output: apps/web/public/wellview-picklists.json
 * Usage:  node scripts/wellview-db/build_picklists.mjs
 */
import { existsSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..");

const LIB_DIR = process.env.WELLVIEW_LIB_DIR
  ?? join(REPO, "WellView_files", "custom", "library");
const SAMPLE_DB = process.env.WELLVIEW_SAMPLE_DB
  ?? join(REPO, "sqlite_DB", "wellview", "wv9.0_Sample.sqlite");
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

/** lib<table><column> -> { table, column } or null. Longest table prefix wins. */
function resolve(base) {
  const body = base.startsWith("lib") ? base.slice(3) : base;
  for (let i = body.length; i > 0; i -= 1) {
    const t = schema.get("wv" + body.slice(0, i));
    if (!t) continue;
    const col = t.cols.get(body.slice(i));
    if (col) return { table: t.name, column: col };
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

console.log(`Resolving ${libs.length} WellView libraries against the sample database…\n`);
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
      usable: isUsable,
      count: rows.length,
      values: rows.map((r) => ({ value: String(r.v), count: Number(r.c) })),
    };
    const tag = isUsable ? "" : "  (sparse)";
    console.log(`  [${done}/${libs.length}] ${lib} → ${hit.table}.${hit.column}  ${rows.length} values${tag}`);
  }
}

const catalog = {
  generated_from: "sqlite_DB/wellview/wv9.0_Sample.sqlite",
  derivation: "sample-data",
  note:
    "DERIVED from the sample database, NOT decrypted from the WellView .lib files. "
    + "Each list is the distinct values that occur in the mapped table.column; a field "
    + "the sample never populated is absent here even though its true (encrypted) library "
    + "would carry a full list. Values are ordered most-common-first with occurrence counts.",
  library_count: libs.length,
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
console.log(`usable dropdowns (${USABLE_MIN}+) : ${usable}`);
console.log(`sparse (1-2 values)    : ${sparse}`);
console.log(`resolved but empty     : ${resolvedEmpty}`);
console.log(`unresolved             : ${unresolved}`);
console.log(`\nwrote ${OUT}`);
console.log(`(the ${resolvedEmpty + unresolved} not covered live only inside the encrypted .lib files)`);
db.close();
