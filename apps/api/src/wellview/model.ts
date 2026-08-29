/**
 * WellView's own data model, as the application's source of captions and types.
 *
 * `Peloton.WellView.mdl.xml` ships with WellView and defines every table and
 * field: the caption the desktop prints, its help text, its physical type,
 * whether it is CALCULATED (the green, non-editable fields), whether it is
 * hidden until "Show All Fields", and its library binding. It is extracted to
 * JSON by scripts/wellview-db/build_datamodel.mjs.
 *
 * Everything here used to be guessed from column names, which is how report
 * headers ended up reading "Idrecparent" and "Profiletyp". Reading the model
 * instead is the same move the pick-lists already made: bind to the data
 * model, not to a name heuristic.
 *
 * Lives in its own module because both the record routes and the template
 * resolver need it, and importing one from the other would be a cycle.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { UnitFormat } from "@dd/shared";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..", "..", "..");
const DATAMODEL_JSON = join(REPO, "apps", "web", "public", "wellview-templates", "datamodel.json");

export type PhysicalType = "string" | "stringlong" | "double" | "datetime" | "boolean" | "integer" | "blob";

export interface ModelField {
  label: string;
  labelShort?: string;
  help?: string;
  type?: PhysicalType;
  /**
   * The declared length of a text field, which 9.0 makes a user-visible rule
   * out of: "Text fields that are 100 characters or more can now function as a
   * comments field that opens to a larger edit window."
   */
  size?: number;
  calculated?: boolean;
  hidden?: boolean;
  carryForward?: boolean;
  carryForwardWithParent?: boolean;
  /** A carried value that steps: run numbers +1, a daily report's end date +1 DAY. */
  carryForwardIncrement?: number;
  /** The field it is carried FROM, "wvTable.Field", when not this field itself. */
  carryForwardFrom?: string;
  lookupTyp?: string;
  /**
   * The APPROVED values, when the model states them outright.
   *
   * 1,110 fields are `lookuptyp="library"` and their lists ship as encrypted
   * .lib archives this app cannot read; for those it can only offer the values
   * already in the database, and says so. But 22 fields are `mdllist` or
   * `mdllistwithtables` and their 119 values are in the model itself — those
   * ARE the sanctioned list, and must not be presented as merely "in use".
   */
  /**
   * The tables a record link may point at, as the model declares them.
   *
   * 188 link fields carry theirs; 15 are polymorphic, and one
   * (wvJobIntervalProblem.IDRecFailedItem) names fourteen tables.
   */
  linkTargets?: string[];
  /** Approved values; a pair when the stored value differs from the caption. */
  modelList?: (string | { value: string; label: string })[];
  libTable?: string;
  libField?: string;
  baseUnit?: string;
  /** Per unit set (US/Metric/EU/Mixed): display unit and decimals. */
  units?: Record<string, UnitFormat>;
  /** Tools > Reference Datum: this value is measured from the reference. */
  applyDatum?: boolean;
  /** How it responds — "up" and "invariant" are NOT a plain subtraction. */
  datumMode?: "up" | "invariant";
  /** The form SECTION this field belongs to ("Well Identifiers", "Elevations"…),
   *  as the model groups them — the headings the guide's exercises use. */
  group?: string;
  /** Chevron's own field rules: required is what the desktop paints yellow. */
  required?: boolean;
  /** A required GLOBAL METRIC — the desktop's cyan fields (§4.3). Recovered
   *  from the training guide's own screenshots; see the curated source file. */
  globalMetric?: boolean;
  minValue?: string;
  maxValue?: string;
  warnOnly?: boolean;
}

export interface ModelTable {
  table: string;
  label: string;
  labelPlural?: string;
  labelShort?: string;
  help?: string;
  /** The order the vendor says this folder reads in — "md", "DtTmStart, DtTmEnd".
   *  Declared on 264 of the 357 tables, and authoritative over any heuristic. */
  sqlOrderBy?: string;
  /** Record caption template of field names, e.g. "<Des>" or "<DtTmStart>". */
  recordDes?: string;
  calculated?: boolean;
  hidden?: boolean;
  sequenced?: boolean;
  allowInsertTop?: boolean;
  allowSeqInvert?: boolean;
  carryForward?: boolean;
  /** Section order for the entry form. */
  fieldGroups?: string[];
  fields: Record<string, ModelField>;
}

let _model: Record<string, ModelTable> | null = null;
function model(): Record<string, ModelTable> {
  if (_model) return _model;
  try {
    _model = (JSON.parse(readFileSync(DATAMODEL_JSON, "utf-8")) as { tables: Record<string, ModelTable> }).tables;
  } catch {
    // Not generated on this machine — captions fall back to the heuristic.
    _model = {};
  }
  return _model;
}

export const modelTable = (name: string): ModelTable | undefined => model()[name.toLowerCase()];
export const modelField = (table: string, col: string): ModelField | undefined =>
  modelTable(table)?.fields[col.toLowerCase()];
export const modelLoaded = (): boolean => Object.keys(model()).length > 0;
/** Every table in the model, keyed by lowercase name. Read-only. */
export const allModelTables = (): Readonly<Record<string, ModelTable>> => model();

/**
 * The plumbing columns the model does not describe, because they are not user
 * fields — they are the record identity WellView keeps to itself.
 */
const KEY_LABELS: Record<string, string> = {
  idwell: "Well ID",
  idrec: "Record ID",
  idrecparent: "Parent Record",
  tblkeyparent: "Parent Table",
};

const isTk = (c: string) => /^idrec.+tk$/i.test(c);

/** DtTmSpud → "Date/Time Spud", ElvOrigKB → "Elevation Orig KB", SzODNom → "Size OD Nom" … */
export function humanise(raw: string): string {
  let s = raw
    .replace(/^DtTm/, "DateTime ")
    .replace(/^Elv/, "Elevation ")
    .replace(/^Sz/, "Size ")
    .replace(/^Pres/, "Pressure ")
    .replace(/^Wt/, "Weight ");
  s = s.replace(/([a-z\d])([A-Z])/g, "$1 $2").replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Column caption.
 *
 * A model caption may carry the placeholder `<capl>` — "the caption of the
 * table this field links to" — so the linked-table names are passed in for
 * link columns; unresolved it degrades to a plain word rather than leaking the
 * placeholder into a table header.
 */
export function columnLabel(tableName: string, col: string, linkedTables?: string[]): string {
  const f = modelField(tableName, col);
  if (f?.label) {
    if (!f.label.includes("<capl>")) return f.label;
    const linked = (linkedTables ?? [])
      .map((t) => modelTable(t)?.label ?? t.replace(/^wv/i, ""))
      .filter(Boolean);
    // A self-referencing parent (a sidetrack's parent wellbore) names its own
    // table, so it reads correctly even where the link targets are not known.
    const fallback = col.toLowerCase() === "idrecparent"
      ? modelTable(tableName)?.label ?? "Record"
      : "Record";
    const target = linked.length ? [...new Set(linked)].join(" / ") : fallback;
    return f.label.replace(/<capl>/g, target).replace(/\s{2,}/g, " ").trim();
  }
  const key = KEY_LABELS[col.toLowerCase()];
  if (key) return key;
  // *TK companions name the table a link points at.
  if (isTk(col)) return `${columnLabel(tableName, col.replace(/tk$/i, ""))} — table`;
  return humanise(col);
}

/**
 * Folder name. The model's singular caption is what WellView prints; a few
 * folders keep the training guide's wording where it differs, because that is
 * the word the user was taught (the guide says "Daily Operations", the model
 * says "Daily Report").
 */
const MANUAL_FOLDER_LABELS: Record<string, string> = {
  wvwellheader: "Well Header (General)",
  wvjobreport: "Daily Operations",
  wvjobreportcostgen: "Daily Costs",
  wvjobdrillstring: "Drill Strings / BHA",
  wvjobdrillstringcomp: "BHA Components",
  wvjobreportproblem: "Unscheduled Events",
  wvjobafe: "AFE / WBS",
};

/**
 * A FOLDER holds many records, so it takes the model's plural caption —
 * "Wellbores", "Casing Components", "Pressure Survey Tests". (The singular
 * `label` names one record, and is what `<capl>` substitutes.)
 */
export function folderLabel(tableName: string, parent: string | null): string {
  const manual = MANUAL_FOLDER_LABELS[tableName.toLowerCase()];
  if (manual) return manual;
  const m = modelTable(tableName);
  if (m) return m.labelPlural || m.label;
  const key = tableName.replace(/^wv/i, "");
  const suffix = parent ? tableName.slice(parent.length) : key;
  return humanise(suffix || key);
}

/**
 * Render a table's record-caption template — WellView's own `recorddes`, the
 * string the desktop puts on the record selector. The grammar is closed:
 * `<Column>` and `<Column.unit>` tokens only. Tokens with no value drop out
 * along with the separator they leave stranded, so a half-filled record reads
 * "Casing 9 5/8" rather than "Casing 9 5/8, , ".
 */
export function renderRecordDes(
  tableName: string,
  value: (column: string) => string | null,
): string | null {
  const des = modelTable(tableName)?.recordDes;
  if (!des) return null;
  let any = false;
  const filled = des.replace(/<([^>]+)>/g, (_, token: string) => {
    const [col, part] = token.split(".");
    if (part?.toLowerCase() === "unit") {
      // Only print the unit when its field actually has a value.
      const v = value(col);
      return v == null || v === "" ? "" : (modelField(tableName, col)?.baseUnit ?? "");
    }
    const v = value(col);
    if (v == null || v === "") return "";
    any = true;
    return v;
  });
  if (!any) return null;
  return filled
    .replace(/\s*,\s*(?=,|$)/g, "")     // stranded separators
    .replace(/^[\s,–-]+|[\s,–-]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim() || null;
}

/**
 * The field that can carry §3.11's "*COPY*" mark, for this table.
 *
 * "Each new record has the word *COPY* in its name" — and the model says what a
 * record's name is: `recordDes`, a template of field tokens like
 * "BHA #<StringNo>, <Des>". The mark goes on the first field that template
 * names which can actually hold a word:
 *
 *   - free text (`string` or `stringlong`) — a date or a depth cannot hold it,
 *   - not calculated — the desktop would overwrite it at print time,
 *   - not a closed list — writing "Packer *COPY*" into a `mdllistwithtables`
 *     field would leave a value the desktop cannot map back to its table, and
 *     into a `foreignidrec` a GUID that points nowhere.
 *
 * A `library` lookup IS allowed: it suggests values, it does not restrict them.
 *
 * 151 of the 229 tables that declare a name have such a field. The other 78 are
 * named by a date, a depth or a link (`wvNote` is "<DtTm>"), and null is the
 * honest answer for them — the caller says the copy is unmarked rather than
 * pretending otherwise.
 */
export function markableNameColumn(t: { name: string } | string): string | null {
  const name = typeof t === "string" ? t : t.name;
  const mt = modelTable(name);
  if (!mt?.recordDes) return null;
  for (const m of mt.recordDes.matchAll(/<([A-Za-z0-9_]+)(\.[A-Za-z]+)?>/g)) {
    if (m[2]) continue;                       // "<Sz.unit>" names a unit, not a field
    const f = mt.fields[m[1].toLowerCase()];
    if (!f || f.calculated) continue;
    if (f.type !== "string" && f.type !== "stringlong") continue;
    if (f.lookupTyp && f.lookupTyp !== "library") continue;
    return m[1];
  }
  return null;
}

/**
 * The order a folder's rows are read in — ONE rule, for every screen.
 *
 * There were two. Edit Data consulted the model; the report path had its own
 * shorter list of likely column names and consulted nothing. So a folder and
 * the report printed from it could disagree, and 89 of the sample's populated
 * tables were affected — 80 of them ordered by nothing at all on a report,
 * which means whatever the scan returned. The daily Time Log, 6,942 rows across
 * 736 reports, printed in storage order on all eight templates that carry it.
 *
 * The precedence, in the order WellView's own metadata states it:
 *
 *   1. A SEQUENCED folder is arranged by the user, and that arrangement is the
 *      point — a casing string reads shoe-up or shoe-down because someone put
 *      it that way. Its stored sequence beats anything a date could say.
 *   2. The model's own `sqlOrderBy`, which is Peloton's answer for the rest.
 *      wvWellboreDirSurveyData declares `md`, and a survey read by date rather
 *      than by depth is not a survey.
 *   3. Failing both, a likely column: a date, a sequence number, a depth.
 *
 * Returns the body of an ORDER BY, already quoted, or null when the table gives
 * no basis for one — in which case the caller must not invent an order either.
 */
export function orderByFor(
  tableName: string,
  cols: Map<string, string>,
  /** Table alias to qualify with, for a query that joins. */
  alias?: string,
): string | null {
  const t = modelTable(tableName);
  const q = (c: string) => (alias ? `${alias}."${c}"` : `"${c}"`);

  if (t?.sequenced) {
    const seq = cols.get("sysseq");
    if (seq) return q(seq);
  }

  const declared = t?.sqlOrderBy;
  if (declared) {
    const parts: string[] = [];
    for (const raw of declared.split(",")) {
      const m = raw.trim().match(/^([A-Za-z0-9_]+)(?:\s+(asc|desc))?$/i);
      if (!m) continue;
      const col = cols.get(m[1].toLowerCase());
      if (!col) continue;
      parts.push(`${q(col)}${m[2] ? ` ${m[2].toUpperCase()}` : ""}`);
    }
    if (parts.length) return parts.join(", ");
  }

  for (const k of ["dttm", "dttmstart", "dttmspud", "dttmrun", "sysseq", "seqno", "depthtop", "depth", "md"]) {
    const c = cols.get(k);
    if (c) return q(c);
  }
  return null;
}
