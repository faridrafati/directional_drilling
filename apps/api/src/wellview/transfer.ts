/**
 * Exporting a well out of one database and importing it into another.
 *
 * WellView's own workflow is a rig sending its well to the office; here it is
 * moving a well between the converted .sqlite files. A well is not one row — it
 * is every row in every table that carries its `idwell`, which for a real well
 * is thousands of rows across dozens of tables (Sample 12: 3,435 rows in 69
 * tables).
 *
 * IDRec IS PRESERVED, NOT REMAPPED. Every association in this schema is a GUID
 * — IDRec, IDRecParent, and the dozens of IDRec* link columns — and those GUIDs
 * are globally unique. Copying them verbatim keeps every link intact for free.
 * Remapping would mean rewriting every link column consistently, and one missed
 * column produces a well whose casing points at nothing. So an import into a
 * database that already holds the well is REFUSED rather than merged: the same
 * well arriving twice is a decision for the user, not a silent upsert.
 *
 * BLOBS TRAVEL AS BASE64. Four tables hold binary — attachments, external data
 * and two curve tables. JSON cannot carry bytes, so they are encoded on the way
 * out and decoded on the way in, and the payload records which columns were
 * encoded so an import never has to guess.
 *
 * A COLUMN THE TARGET DOES NOT HAVE IS REPORTED, NOT DROPPED SILENTLY. The two
 * sample databases happen to share all 264 tables, but that is not guaranteed,
 * and a well that arrives missing a column its source had is something the user
 * needs to be told.
 */
import type { DatabaseSync } from "node:sqlite";

/** The wire format. Deliberately plain, so it can be read and diffed. */
export interface WellExport {
  format: "wellview-well/1";
  exportedAt: string;
  source: { database: string; idwell: string; wellName: string | null };
  /** table name → the rows carrying this idwell. */
  tables: Record<string, Record<string, unknown>[]>;
  /** table → columns whose values are base64 in `tables`. */
  binaryColumns: Record<string, string[]>;
  counts: { tables: number; rows: number };
}

export interface ImportResult {
  idwell: string;
  wellName: string | null;
  inserted: { tables: number; rows: number };
  /** Tables in the payload the target database does not have. */
  missingTables: string[];
  /** "table.column" the target lacks; their values were not imported. */
  missingColumns: string[];
  /** Tables present but empty in the payload — recorded, not an error. */
  emptyTables: number;
}

const IDWELL = "idwell";

/** Every table in this database that is scoped by idwell, with its columns. */
function wellTables(d: DatabaseSync): Map<string, { name: string; cols: Map<string, string>; types: Map<string, string> }> {
  const out = new Map<string, { name: string; cols: Map<string, string>; types: Map<string, string> }>();
  for (const { name } of d.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[]) {
    const cols = new Map<string, string>();
    const types = new Map<string, string>();
    for (const c of d.prepare(`PRAGMA table_info("${name}")`).all() as { name: string; type: string }[]) {
      cols.set(c.name.toLowerCase(), c.name);
      types.set(c.name.toLowerCase(), (c.type || "").toUpperCase());
    }
    if (cols.has(IDWELL)) out.set(name.toLowerCase(), { name, cols, types });
  }
  return out;
}

const isBinary = (v: unknown): v is Uint8Array =>
  v instanceof Uint8Array || (typeof v === "object" && v !== null && ArrayBuffer.isView(v as ArrayBufferView));

export function exportWell(d: DatabaseSync, dbId: string, idwell: string): WellExport | null {
  const tables = wellTables(d);
  const header = tables.get("wvwellheader");
  if (!header) return null;
  const wellRow = d.prepare(
    `SELECT * FROM "${header.name}" WHERE "${header.cols.get(IDWELL)}" = ?`).get(idwell) as Record<string, unknown> | undefined;
  if (!wellRow) return null;

  const out: WellExport["tables"] = {};
  const binaryColumns: Record<string, string[]> = {};
  let rows = 0;
  for (const t of tables.values()) {
    const got = d.prepare(
      `SELECT * FROM "${t.name}" WHERE "${t.cols.get(IDWELL)}" = ?`).all(idwell) as Record<string, unknown>[];
    if (!got.length) continue;
    const bin = new Set<string>();
    for (const r of got) {
      for (const [k, v] of Object.entries(r)) {
        if (isBinary(v)) {
          bin.add(k);
          // JSON has no bytes. Base64 keeps the payload one readable document
          // rather than a multipart archive.
          r[k] = Buffer.from(v as Uint8Array).toString("base64");
        }
      }
    }
    out[t.name] = got;
    if (bin.size) binaryColumns[t.name] = [...bin];
    rows += got.length;
  }

  return {
    format: "wellview-well/1",
    exportedAt: new Date().toISOString(),
    source: {
      database: dbId,
      idwell,
      wellName: (wellRow[header.cols.get("wellname") ?? "WellName"] as string) ?? null,
    },
    tables: out,
    binaryColumns,
    counts: { tables: Object.keys(out).length, rows },
  };
}

/** What an import would do, without doing it. */
export function importPreflight(d: DatabaseSync, payload: WellExport): {
  ok: boolean; reason?: string; missingTables: string[]; missingColumns: string[];
} {
  const missingTables: string[] = [];
  const missingColumns: string[] = [];
  if (payload?.format !== "wellview-well/1") {
    return { ok: false, reason: "not a WellView well export", missingTables, missingColumns };
  }
  const tables = wellTables(d);
  const header = tables.get("wvwellheader");
  if (!header) return { ok: false, reason: "the target has no well header table", missingTables, missingColumns };

  const exists = d.prepare(
    `SELECT COUNT(*) c FROM "${header.name}" WHERE "${header.cols.get(IDWELL)}" = ?`)
    .get(payload.source.idwell) as { c: number };
  if (exists.c > 0) {
    return {
      ok: false,
      // Refused, not merged: IDRecs are preserved, so a second copy would
      // duplicate every record under the same keys.
      reason: `this database already holds well ${payload.source.idwell}`,
      missingTables, missingColumns,
    };
  }

  for (const [name, rows] of Object.entries(payload.tables)) {
    const t = tables.get(name.toLowerCase());
    if (!t) { missingTables.push(name); continue; }
    const seen = new Set<string>();
    for (const r of rows) for (const k of Object.keys(r)) seen.add(k);
    for (const k of seen) if (!t.cols.has(k.toLowerCase())) missingColumns.push(`${name}.${k}`);
  }
  return { ok: true, missingTables, missingColumns };
}

export function importWell(d: DatabaseSync, payload: WellExport): ImportResult {
  const pre = importPreflight(d, payload);
  if (!pre.ok) throw new Error(pre.reason ?? "import refused");

  const tables = wellTables(d);
  let insertedTables = 0;
  let insertedRows = 0;
  let emptyTables = 0;

  // One transaction: a half-imported well is worse than none, because the
  // preflight's "already holds this well" guard would then refuse the retry.
  d.exec("BEGIN");
  try {
    for (const [name, rows] of Object.entries(payload.tables)) {
      const t = tables.get(name.toLowerCase());
      if (!t) continue;
      if (!rows.length) { emptyTables++; continue; }
      const binary = new Set((payload.binaryColumns?.[name] ?? []).map((c) => c.toLowerCase()));

      for (const r of rows) {
        const cols: string[] = [];
        const vals: unknown[] = [];
        for (const [k, v] of Object.entries(r)) {
          const actual = t.cols.get(k.toLowerCase());
          if (!actual) continue;                       // reported by the preflight
          cols.push(actual);
          vals.push(binary.has(k.toLowerCase()) && typeof v === "string"
            ? Buffer.from(v, "base64")
            : v);
        }
        if (!cols.length) continue;
        d.prepare(
          `INSERT INTO "${t.name}" (${cols.map((c) => `"${c}"`).join(", ")})
           VALUES (${cols.map(() => "?").join(", ")})`,
        ).run(...(vals as never[]));
        insertedRows++;
      }
      insertedTables++;
    }
    d.exec("COMMIT");
  } catch (e) {
    d.exec("ROLLBACK");
    throw e;
  }

  return {
    idwell: payload.source.idwell,
    wellName: payload.source.wellName,
    inserted: { tables: insertedTables, rows: insertedRows },
    missingTables: pre.missingTables,
    missingColumns: pre.missingColumns,
    emptyTables,
  };
}
