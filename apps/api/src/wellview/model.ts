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
  calculated?: boolean;
  hidden?: boolean;
  carryForward?: boolean;
  carryForwardWithParent?: boolean;
  /** A carried value that steps: run numbers +1, a daily report's end date +1 DAY. */
  carryForwardIncrement?: number;
  /** The field it is carried FROM, "wvTable.Field", when not this field itself. */
  carryForwardFrom?: string;
  lookupTyp?: string;
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
