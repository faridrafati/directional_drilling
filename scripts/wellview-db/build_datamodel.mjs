/**
 * Extract WellView's OWN data model into JSON the application can bind to.
 *
 * `WellView_files/system/Peloton.WellView.mdl.xml` is Peloton's shipped model
 * definition — 376 tables and 5,761 fields, each carrying the caption WellView
 * itself prints, its help text, its physical type, whether it is CALCULATED
 * (the desktop's green read-only fields), whether it is hidden by default
 * ("Show All Fields"), and its library binding for lookup lists.
 *
 * Everything the app used to guess — column captions from a name heuristic
 * ("Idrecparent", "Profiletyp"), which fields are computed, which are yes/no —
 * is stated here authoritatively. Binding to this file is the same move the
 * pick-lists already made: use the data model, not a name heuristic.
 *
 *   node scripts/wellview-db/build_datamodel.mjs
 *     → apps/web/public/wellview-templates/datamodel.json
 *
 * The XML is attribute-only (no text content), so a tag scanner is enough and
 * avoids adding an XML dependency for one build step.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..");
const SRC = process.env.WELLVIEW_MDL
  ?? join(REPO, "WellView_files", "system", "Peloton.WellView.mdl.xml");
const OUT = join(REPO, "apps", "web", "public", "wellview-templates", "datamodel.json");

const ENTITIES = { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" };
const unescapeXml = (s) =>
  s.replace(/&(?:#(\d+)|#x([0-9a-fA-F]+)|([a-z]+));/g, (m, dec, hex, name) => {
    if (dec) return String.fromCharCode(Number(dec));
    if (hex) return String.fromCharCode(parseInt(hex, 16));
    return ENTITIES[name] ?? m;
  });

/** Attributes of one opening tag body (`name="value"` pairs, values escaped). */
function attrs(body) {
  const out = {};
  for (const m of body.matchAll(/([a-zA-Z_][\w:.-]*)\s*=\s*"([^"]*)"/g)) {
    out[m[1].toLowerCase()] = unescapeXml(m[2]);
  }
  return out;
}

const bool = (v) => v === "True" || v === "true" || v === "1";
/** Collapse the model's help text to one clean line. */
const clean = (s) => (s ? s.replace(/\s*[\r\n]+\s*/g, " ").replace(/\s{2,}/g, " ").trim() : undefined);

const xml = readFileSync(SRC, "utf-8");

/**
 * Walk every opening tag once. `<afmtable …>` starts a table; the `<afmfield …>`
 * tags that follow belong to it until the next `<afmtable`. Self-closing and
 * container forms both appear, so nesting is tracked by the table boundary
 * rather than by matching end tags.
 */
const tables = {};
let current = null;
let fieldCount = 0;

for (const m of xml.matchAll(/<(afmtable|afmfield)\s([^>]*?)\/?>/g)) {
  const a = attrs(m[2]);
  if (m[1] === "afmtable") {
    const name = a.keytbl;
    if (!name) { current = null; continue; }
    current = {
      table: name,
      /** Singular caption — the folder name WellView shows ("Well Header"). */
      label: a.captionlongs || name,
      labelPlural: a.captionlongp || undefined,
      labelShort: a.captionshorts || undefined,
      help: clean(a.help),
      /** Record caption template, e.g. "<WellName>" or "<DtTmStart> <Des>". */
      recordDes: a.recorddes || undefined,
      calculated: bool(a.calculated) || undefined,
      hidden: bool(a.hidden) || undefined,
      /** Ordered folders offer Move up/down; the manual's sequencing commands. */
      sequenced: bool(a.sequenced) || undefined,
      allowInsertTop: bool(a.allowinserttop) || undefined,
      allowSeqInvert: bool(a.allowseqinvert) || undefined,
      carryForward: bool(a.carryfwdfromprevparent) || undefined,
      sqlOrderBy: a.sqlorderby || undefined,
      fields: {},
    };
    tables[name.toLowerCase()] = current;
    continue;
  }
  if (!current || !a.keyfld) continue;
  const f = {
    label: a.captionlong || a.keyfld,
    labelShort: a.captionshort || undefined,
    help: clean(a.help),
    type: a.physicaltype || undefined,
    calculated: bool(a.calculated) || undefined,
    hidden: bool(a.hidden) || undefined,
    carryForward: bool(a.carryfwd) || undefined,
    lookupTyp: a.lookuptyp || undefined,
    libTable: a.libtablename || undefined,
    libField: a.libfieldname || undefined,
    baseUnit: a.baseunit || undefined,
  };
  for (const k of Object.keys(f)) if (f[k] === undefined) delete f[k];
  current.fields[a.keyfld.toLowerCase()] = f;
  fieldCount++;
}

// Drop the empty-table noise and report honestly on what was found.
const kept = Object.fromEntries(Object.entries(tables).filter(([, t]) => Object.keys(t.fields).length > 0));

const payload = {
  generated_from: "WellView_files/system/Peloton.WellView.mdl.xml",
  table_count: Object.keys(kept).length,
  field_count: fieldCount,
  tables: kept,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(payload));
const bytes = JSON.stringify(payload).length;
console.log(`data model → ${OUT}`);
console.log(`  ${payload.table_count} tables, ${payload.field_count} fields, ${(bytes / 1048576).toFixed(2)} MB`);
const withHelp = Object.values(kept).reduce(
  (n, t) => n + Object.values(t.fields).filter((f) => f.help).length, 0);
const calc = Object.values(kept).reduce(
  (n, t) => n + Object.values(t.fields).filter((f) => f.calculated).length, 0);
console.log(`  ${withHelp} fields with help text, ${calc} calculated fields`);
