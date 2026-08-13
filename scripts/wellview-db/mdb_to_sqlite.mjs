/**
 * WellView user databases: Access (.mdb, Jet 4) -> SQLite.
 *
 * READ-ONLY on the WellView tree — the .mdb files are opened as plain buffers
 * and never written. Output goes to sqlite_DB/wellview/ next to the other
 * Access-to-SQLite conversions (the legacy DDR archive followed the same
 * route), which .gitignore already excludes: these are the user's field data,
 * not repository content.
 *
 * WHY mdb-reader
 * --------------
 * No MDB tool exists on this machine (no mdbtools, no ODBC), and Jet 4 is a
 * paged binary format with usage maps, LVAL (memo) pages and compressed
 * unicode — a hand-rolled parser is a project, not a script. mdb-reader is a
 * pure-JS reader (dev dependency only; the app runtime gains nothing), and
 * node:sqlite writes the output, so nothing new ships with the app.
 *
 * FIDELITY RULES
 * --------------
 *  - Table and column names are preserved verbatim (quoted identifiers).
 *  - Access system tables (MSys*) are skipped — Jet bookkeeping, not data.
 *  - Types: integers -> INTEGER, floats/currency -> REAL, booleans -> INTEGER
 *    0/1, text/memo -> TEXT, datetime -> TEXT ISO-8601 (SQLite's own idiom),
 *    binary/OLE -> BLOB. Nulls stay null; nothing is defaulted.
 *  - Every table is verified after copy: SELECT COUNT(*) must equal the row
 *    count mdb-reader produced, or the run fails loudly.
 *
 * Usage:
 *   node scripts/wellview-db/mdb_to_sqlite.mjs "WellView_files/user/database" sqlite_DB/wellview
 */
import { readFileSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join, basename } from "node:path";
import { DatabaseSync } from "node:sqlite";
import MDBReader from "mdb-reader";

const [srcDir, outDir] = process.argv.slice(2);
if (!srcDir || !outDir) {
  console.error("usage: node mdb_to_sqlite.mjs <dir with .mdb> <output dir>");
  process.exit(2);
}
mkdirSync(outDir, { recursive: true });

/** Map an mdb-reader column type to a SQLite affinity. */
function sqlType(t) {
  switch (t) {
    case "byte": case "integer": case "long": case "boolean": case "complex":
      return "INTEGER";
    case "float": case "double": case "currency": case "numeric": case "bigint":
      return "REAL";
    case "binary": case "ole":
      return "BLOB";
    default: // text, memo, datetime, datetimextended, repid (GUID), …
      return "TEXT";
  }
}

/** A JS value from mdb-reader into what node:sqlite accepts. */
function sqlValue(v) {
  if (v == null) return null;
  if (v instanceof Date) {
    // Access epoch quirk: a "no date" often lands on 1899-12-30. Keep it —
    // faithful copy, not interpretation. ISO-8601 so SQLite date() works.
    return v.toISOString().replace(".000Z", "Z");
  }
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "bigint") return Number(v);
  if (v instanceof Uint8Array || Buffer.isBuffer(v)) return v;
  if (typeof v === "object") return JSON.stringify(v); // complex/attachment cols
  return v;
}

const quote = (name) => `"${String(name).replaceAll('"', '""')}"`;

let exit = 0;
for (const file of readdirSync(srcDir).filter((f) => f.toLowerCase().endsWith(".mdb"))) {
  const src = join(srcDir, file);
  const outPath = join(outDir, basename(file, ".mdb").trim().replaceAll(" ", "_") + ".sqlite");
  rmSync(outPath, { force: true });
  rmSync(outPath + "-journal", { force: true });

  console.log(`\n=== ${file} -> ${outPath}`);
  const reader = new MDBReader(readFileSync(src));
  const db = new DatabaseSync(outPath);
  db.exec("PRAGMA journal_mode = OFF; PRAGMA synchronous = OFF;");

  const tables = reader.getTableNames({ systemTables: false, linkedTables: false });
  let totalRows = 0, copied = 0, empty = 0;
  const failures = [];

  for (const name of tables) {
    let table, columns, rows;
    try {
      table = reader.getTable(name);
      columns = table.getColumns();
      rows = table.getData();
    } catch (e) {
      failures.push({ table: name, error: `read: ${e.message}` });
      continue;
    }
    const colDefs = columns.map((c) => `${quote(c.name)} ${sqlType(c.type)}`).join(", ");
    db.exec(`CREATE TABLE ${quote(name)} (${colDefs});`);

    if (rows.length) {
      const insert = db.prepare(
        `INSERT INTO ${quote(name)} VALUES (${columns.map(() => "?").join(",")})`,
      );
      db.exec("BEGIN");
      try {
        for (const row of rows) insert.run(...columns.map((c) => sqlValue(row[c.name])));
        db.exec("COMMIT");
      } catch (e) {
        db.exec("ROLLBACK");
        failures.push({ table: name, error: `insert: ${e.message}` });
        continue;
      }
    }

    // Verify, don't trust: the copy is only a copy if SQLite agrees on the count.
    const got = db.prepare(`SELECT COUNT(*) c FROM ${quote(name)}`).get().c;
    if (got !== rows.length) {
      failures.push({ table: name, error: `count mismatch: mdb ${rows.length}, sqlite ${got}` });
      continue;
    }
    totalRows += rows.length;
    copied += 1;
    if (!rows.length) empty += 1;
  }

  db.close();
  console.log(`tables: ${copied}/${tables.length} copied (${empty} empty) · rows: ${totalRows}`);
  if (failures.length) {
    exit = 1;
    console.log(`FAILURES (${failures.length}):`);
    for (const f of failures) console.log(`  ${f.table}: ${f.error}`);
  }
}
process.exit(exit);
