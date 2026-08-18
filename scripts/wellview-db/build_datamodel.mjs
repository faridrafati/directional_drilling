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
/**
 * Read a .NET format string from <afmfieldunitformat format="...">.
 *
 *   {0:#,##0.00}   two decimals, thousands separators
 *   {0:0.0}        one decimal, NO separators
 *   {0:#,##0.0##}  one required decimal, up to three ('0' required, '#' optional)
 *   fraction       an imperial size, printed as 9 5/8 — not 9.63
 *
 * The last is not a number format at all: 148 fields, all of them pipe, bit and
 * hole sizes in inches, which the industry reads and writes as fractions. Taking
 * the old `\.([0#]+)` route made those zero-decimal, so a 9 5/8" casing printed
 * as "10". Anything unrecognised returns undefined so the value keeps its own
 * precision rather than being rounded by a guess.
 */
function formatOf(format) {
  if (!format) return undefined;
  if (format.trim() === "fraction") return { fraction: true };
  const m = format.match(/\{0:([^}]*)\}/);
  const pattern = m ? m[1] : format;
  if (!/[0#]/.test(pattern)) return undefined;
  const [intPart, decPart = ""] = pattern.split(".");
  const out = {};
  // '0' is a digit that must be shown, '#' one that is dropped when zero.
  const required = (decPart.match(/0/g) || []).length;
  if (decPart) {
    out.decimals = required;
    if (decPart.length !== required) out.maxDecimals = decPart.length;
  } else out.decimals = 0;
  // `grouped`, not `group`: the field object already uses `group` for its form section.
  if (intPart.includes(",")) out.grouped = true;
  return out;
}

/**
 * HOW a datum-referenced field moves, which is not the same for all of them.
 *
 * The flag `applydatum` says a field is measured from the reference elevation.
 * It does NOT say in which direction, and for six of the 355 fields a plain
 * subtraction is wrong:
 *
 *  • "Stick Up" is `EQN: <lengthcalc> - <depthbtm>` — the length a string
 *    stands ABOVE the reference. Lower the reference by Δ and the stickup grows
 *    by Δ, so it moves the opposite way to a depth. Subtracting would be out
 *    by 2Δ.
 *  • Two fields are a DIFFERENCE of two depths ("Difference between Prog TVD
 *    and Actual TVD"). Both operands shift together, so the difference does not
 *    move at all; shifting it invents a discrepancy that is not there.
 *
 * Both are read off the model's own help text rather than kept as a hand list,
 * so a future model revision reclassifies itself.
 */
function datumModeOf(a) {
  const help = (a.help || "").replace(/\s+/g, " ");
  const type = (a.physicaltype || "").toLowerCase();
  // A flagged field that is not a number cannot be shifted at all. Three are
  // strings; arithmetic on them would be a type error, not a datum change.
  if (type && type !== "double" && type !== "integer") return "invariant";
  // A DIFFERENCE of two datum-referenced depths does not move: both operands
  // shift together. Two say so in prose ("Difference between Prog TVD and
  // Actual TVD"); two more only reveal it in the equation —
  // `EQN: <wvZone.DepthBtm>-<wvZone.DepthTop>` is an interval THICKNESS, and
  // shifting it shortens a perforation that never changed.
  if (/^\s*difference between/i.test(help)) return "invariant";
  if (/sticks?\s+up\s+above/i.test(help) || /stickup/i.test(a.keyfld || "")) return "up";
  return undefined;                       // the default: a depth, shifts down
}

/**
 * A second pass over the finished model, for the differences only prose hides.
 *
 * `EQN: <wvZone.DepthBtm>-<wvZone.DepthTop>` is an interval THICKNESS: both
 * operands are datum-referenced, they move together, and the thickness does
 * not move at all. Shifting it shortens a perforation that never changed.
 *
 * BOTH operands must be datum-referenced for that to hold, which is why this
 * runs after every field is known rather than inline. `wvJob.TDtoMudCalc` is
 * `<wvJob.TotalDepthCalc>-<wvWellHeader.ElvMudLine>` — a depth minus a fixed
 * ELEVATION. Only the depth moves, so that difference genuinely does shift, and
 * a rule that just saw two depth-ish names would have frozen it wrongly.
 */
function markInvariantDifferences(tables) {
  const flagged = (ref) => {
    const [t, f] = String(ref).split(".");
    if (!t || !f) return false;
    return tables[t.toLowerCase()]?.fields?.[f.toLowerCase()]?.applyDatum === true;
  };
  let n = 0;
  for (const t of Object.values(tables)) {
    for (const f of Object.values(t.fields)) {
      if (!f.applyDatum || f.datumMode) continue;
      const m = (f.help || "").replace(/\s+/g, " ").match(/EQN:\s*<([^>]+)>\s*-\s*<([^>]+)>/i);
      if (m && flagged(m[1]) && flagged(m[2])) { f.datumMode = "invariant"; n++; }
    }
  }
  return n;
}

/** Collapse the model's help text to one clean line. */
const clean = (s) => (s ? s.replace(/\s*[\r\n]+\s*/g, " ").replace(/\s{2,}/g, " ").trim() : undefined);

/**
 * Chevron's own field rules, shipped beside the application as INI:
 *   [wvcas.des]
 *   required=True
 * These are what the desktop paints YELLOW ("Well information fields in yellow
 * are required", §4.3) and what the Data Entry Audit add-in enforces. There is
 * no equivalent file for the guide's CYAN "required global metric" cue, so that
 * one is deliberately not guessed at.
 */
const RULE_INIS = [
  join(REPO, "WellView_files", "custom", "add-ins", "Data Entry Audit",
    "Peloton.Addin.SimpleFieldDataEntryAuditRules.ini"),
  join(REPO, "WellView_files", "custom", "add-ins", "Audit",
    "Peloton.Addin.SimpleFieldAuditRules.ini"),
];

function fieldRules() {
  const out = new Map();               // "table.field" -> { required, minValue, maxValue, warnOnly }
  for (const path of RULE_INIS) {
    let text;
    try { text = readFileSync(path, "utf-8"); } catch { continue; }
    let section = null;
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith(";")) continue;
      const head = line.match(/^\[(.+)\]$/);
      if (head) { section = head[1].toLowerCase(); continue; }
      if (!section) continue;
      const eq = line.indexOf("=");
      if (eq < 0) continue;
      const key = line.slice(0, eq).trim().toLowerCase();
      const value = line.slice(eq + 1).trim();
      if (!value) continue;
      const entry = out.get(section) ?? {};
      if (key === "required") entry.required = /^true$/i.test(value) || undefined;
      else if (key === "minvalue") entry.minValue = value;
      else if (key === "maxvalue") entry.maxValue = value;
      else if (key === "warning") entry.warnOnly = /^true$/i.test(value) || undefined;
      out.set(section, entry);
    }
  }
  return out;
}

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
/** The field-group being read — the form SECTIONS the guide's exercises use
 *  ("Well Identifiers", "Well License", "Location", "Elevations"…). */
let currentGroup = null;
/** The afmfield whose <afmfieldunitformat> children are being read. */
let currentField = null;
/** Tools > Units: the sets a user can switch between. */
const unitSets = [];
const fieldGroup = new Map();          // "table.field" -> group name
const groupOrder = new Map();          // table -> ordered group names

for (const m of xml.matchAll(/<(afmtable|afmfieldunitformat|afmunitset|afmfield|afmtablegroupfield|afmtablegroupfieldlink)\s([^>]*?)\/?>/g)) {
  const a = attrs(m[2]);
  if (m[1] === "afmunitset") {
    if (a.des) unitSets.push({ name: a.des, comment: a.comment || undefined });
    continue;
  }
  if (m[1] === "afmfieldunitformat") {
    // Belongs to the field last opened: the unit that set displays it in, and
    // the .NET format string, which says how many decimals to show.
    if (currentField && a.idrecunitset && a.keyunit) {
      (currentField.units ??= {})[a.idrecunitset] = { unit: a.keyunit, ...formatOf(a.format) };
    }
    continue;
  }
  if (m[1] === "afmtablegroupfield") {
    currentGroup = a.groupname || null;
    if (current && currentGroup) {
      const list = groupOrder.get(current.table) ?? [];
      if (!list.includes(currentGroup)) list.push(currentGroup);
      groupOrder.set(current.table, list);
    }
    continue;
  }
  if (m[1] === "afmtablegroupfieldlink") {
    // idrecfield is "wvWellHeader.WellName"
    if (currentGroup && a.idrecfield) fieldGroup.set(a.idrecfield.toLowerCase(), currentGroup);
    continue;
  }
  if (m[1] === "afmtable") {
    currentGroup = null;
    currentField = null;
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
    /** Carries with the parent record rather than from the previous sibling. */
    carryForwardWithParent: bool(a.carryfwdwithparent) || undefined,
    /** A carried value that STEPS: run numbers +1, and a daily report's end
     *  date +1 DAY — which is exactly the manual's "set up day two". */
    carryForwardIncrement: a.carryfwdincrement != null && Number(a.carryfwdincrement) !== 0
      ? Number(a.carryfwdincrement) : undefined,
    /**
     * The field the value is carried FROM, when it is not this one. The pattern
     * is "continue where the last record stopped": a daily report's start date
     * comes from the previous report's END date, a new interval's top from the
     * previous interval's bottom. Stored as "wvTable.Field", as the model writes it.
     */
    carryForwardFrom: a.idrecfieldcarryfwdfrom || undefined,
    lookupTyp: a.lookuptyp || undefined,
    libTable: a.libtablename || undefined,
    libField: a.libfieldname || undefined,
    baseUnit: a.baseunit || undefined,
    // Tools > Reference Datum: the depths that move when the user re-references
    // the well to ground, mudline or the casing flange instead of the KB.
    // 363 fields across 93 tables carry it; everything else stays put.
    applyDatum: bool(a.applydatum) || undefined,
    datumMode: bool(a.applydatum) ? datumModeOf(a) : undefined,
  };
  for (const k of Object.keys(f)) if (f[k] === undefined) delete f[k];
  current.fields[a.keyfld.toLowerCase()] = f;
  currentField = f;
  fieldCount++;
}

/**
 * The guide's CYAN cue — "required global metrics".
 *
 * Unlike required (an INI) and calculated (the model), nothing shipped states
 * this one: the flag lives in Chevron's own customisation, which is not in
 * these files. What IS available is the guide itself — its screenshots show the
 * colouring, and §4.3 states what the colours mean. So the list is a curated
 * file with the figure each entry was read from, rather than a heuristic over
 * field names. Entries whose column does not exist are reported, not ignored.
 */
const GLOBAL_METRIC_JSON = join(HERE, "global-metric-fields.json");
function globalMetricFields() {
  try {
    const raw = JSON.parse(readFileSync(GLOBAL_METRIC_JSON, "utf-8"));
    return new Map((raw.fields ?? []).map((f) => [`${f.table}.${f.column}`.toLowerCase(), f]));
  } catch {
    return new Map();
  }
}

// Merge in the form sections and Chevron's required-field rules.
const rules = fieldRules();
const globalMetrics = globalMetricFields();
let grouped = 0;
let requiredCount = 0;
let globalMetricCount = 0;
for (const t of Object.values(tables)) {
  const order = groupOrder.get(t.table);
  if (order?.length) t.fieldGroups = order;
  for (const [colLc, f] of Object.entries(t.fields)) {
    const key = `${t.table.toLowerCase()}.${colLc}`;
    const g = fieldGroup.get(key);
    if (g) { f.group = g; grouped++; }
    const r = rules.get(key);
    if (r?.required) { f.required = true; requiredCount++; }
    if (r?.minValue) f.minValue = r.minValue;
    if (r?.maxValue) f.maxValue = r.maxValue;
    if (r?.warnOnly) f.warnOnly = true;
    if (globalMetrics.has(key)) { f.globalMetric = true; globalMetricCount++; }
  }
}

// Drop the empty-table noise and report honestly on what was found.
const kept = Object.fromEntries(Object.entries(tables).filter(([, t]) => Object.keys(t.fields).length > 0));

const payload = {
  generated_from: "WellView_files/system/Peloton.WellView.mdl.xml",
  unitSets,
  table_count: Object.keys(kept).length,
  field_count: fieldCount,
  tables: kept,
};

mkdirSync(dirname(OUT), { recursive: true });
const frozenDiffs = markInvariantDifferences(tables);

writeFileSync(OUT, JSON.stringify(payload));
const bytes = JSON.stringify(payload).length;
console.log(`data model → ${OUT}`);
console.log(`  ${payload.table_count} tables, ${payload.field_count} fields, ${(bytes / 1048576).toFixed(2)} MB`);
const withHelp = Object.values(kept).reduce(
  (n, t) => n + Object.values(t.fields).filter((f) => f.help).length, 0);
const calc = Object.values(kept).reduce(
  (n, t) => n + Object.values(t.fields).filter((f) => f.calculated).length, 0);
console.log(`  ${withHelp} fields with help text, ${calc} calculated fields`);
console.log(`  ${grouped} fields placed in form sections, ${requiredCount} marked required`);
console.log(`  ${globalMetricCount} marked required global metric`);
const gmMissing = [...globalMetrics.keys()].filter((k) => {
  const [t, c] = k.split(".");
  return !kept[t]?.fields[c];
});
if (gmMissing.length) console.log(`  NOTE: ${gmMissing.length} global-metric entr(ies) name a field the model lacks: ${gmMissing.join(", ")}`);
const unmatched = [...rules.keys()].filter((k) => {
  const [t, c] = k.split(".");
  return !kept[t]?.fields[c];
});
if (unmatched.length) console.log(`  NOTE: ${unmatched.length} rule(s) name a field the model lacks: ${unmatched.join(", ")}`);
