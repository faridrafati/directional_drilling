/**
 * WHY a column a template prints came back blank.
 *
 * The list of dropped columns was always computed and always returned. What was
 * never returned is the reason — and without it the only label in the app said
 * "Not in this database", which is wrong for 258 of the 346 columns the 182
 * shipped templates drop, and right for none of them. Not one is a stored
 * column this database lacks.
 *
 * Measured against the sample: 114 of 182 templates print at least one dropped
 * column, 273 of 738 blocks, 346 distinct table.column pairs. "Daily Drilling",
 * the most-used sheet in the product, drops 29. These counts fall as fields
 * become computable — they were 116 / 276 / 350 when this was written.
 *
 * The model settles what they are:
 *
 *   258  `calculated: true` — WellView works the value out when the report
 *        prints, from the equation in the field's own help text, and stores it
 *        nowhere. This app has not been taught that equation.
 *     0  a stored column the database is missing.
 *    88  a field the model does not put on that table at all — usually a
 *        template naming a PARENT's field on a child block (wvJob.platform,
 *        wvJobReport.afenumbercalc). How WellView resolves those is not
 *        established here, so this reports what is known — no such column —
 *        and does not invent a cause.
 *
 * Derived from the missing list and nothing else, so a column can never be
 * dropped from the page and left out of the explanation.
 */
import { modelField } from "./model.js";

export interface OmittedColumn {
  column: string;
  /** The model's caption, so the note names what the reader sees on the page. */
  label: string;
  /** The model declares it calculated — WellView fills it, this app does not. */
  calculated: boolean;
  /** The model's own description, which for a calculated field is its equation. */
  note?: string;
}

/**
 * @param entries each dropped column with the table it is a field OF — which
 * is not always the block's table: a block prints columns from linked records,
 * and asking the wrong table would report a real calculated field as unknown.
 */
export function classifyOmitted(
  entries: { column: string; table: string }[],
): OmittedColumn[] {
  return entries.map(({ column, table }) => {
    const f = modelField(table, column);
    return {
      column,
      label: f?.label ?? column,
      calculated: f?.calculated === true,
      note: f?.help,
    };
  });
}

/**
 * The one-line summary a report page puts under a block.
 *
 * @param rendersRows whether the block actually draws a table with rows below
 * this line. "They are blank below" is simply false on a block that prints
 * "No rows." or that lost every column it had — there is nothing below to be
 * blank — so in that case the line names the columns and stops.
 */
export function omittedSummary(
  omitted: OmittedColumn[],
  rendersRows = true,
): string | undefined {
  if (!omitted.length) return undefined;
  const calc = omitted.filter((o) => o.calculated);
  const other = omitted.filter((o) => !o.calculated);
  const parts: string[] = [];
  if (calc.length) {
    parts.push(
      `${calc.length} column${calc.length === 1 ? "" : "s"} WellView calculates when the `
      + `report prints and stores nowhere — ${calc.map((o) => o.label).join(", ")}`,
    );
  }
  if (other.length) {
    parts.push(
      `${other.length} column${other.length === 1 ? " is" : "s are"} not a field of this `
      + `table in this database — ${other.map((o) => o.column).join(", ")}`,
    );
  }
  const ending = rendersRows
    ? ` ${omitted.length === 1 ? "It is" : "They are"} blank below.`
    : "";
  return `${parts.join("; ")}.${ending}`;
}
