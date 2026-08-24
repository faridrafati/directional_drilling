/**
 * Which of a mud check's readings fell outside the mud PROGRAM.
 *
 * wvJobReportMudChk.OutOfRangeCalc — "Concatenation of all fields that are out
 * of range from the planned mud check <wvJobProgramMud>." Prose, no equation,
 * and nothing in this app referenced wvJobProgramMud at all: 13 program rows
 * sat against 492 mud checks and the folder could not do the job its own help
 * says it is for.
 *
 * THE ALGORITHM IS RECOVERED, NOT INVENTED. It is not in the model, the CHM or
 * any template — but it is in Peloton's own calculation engine.
 * `Peloton.CalcEngine.WellView90.dll` carries the method's literal set as one
 * contiguous run in its string heap, in UTF-16:
 *
 *     Below | " (" | Above | outofrangecalc | max | min | kmax | kmin | nmax | nmin
 *
 * That gives the output shape ("Below (" … ")", "Above (" … ")"), the column
 * suffixes the limits are found by, and the k/n special case, all from the
 * vendor. An earlier pass reported no DLL contained the string; it had searched
 * ASCII only, and .NET stores its literals as UTF-16.
 *
 * SCOPE. A check is compared against every program row of the same JOB whose
 * depth interval contains the check's depth — no wellbore predicate and no mud
 * type predicate, which is what the vendor does and what the sample supports:
 * 76 of 492 checks match a program row at all, 92 (check, program) pairs in
 * total because some checks sit in two overlapping intervals.
 *
 * BOUNDS ARE INCLUSIVE: a reading exactly on a limit is IN range. This is the
 * vendor's own comparison, and it is not a detail — 18 density readings, 16 pH
 * and 8 filtrate sit exactly on a bound, and flipping the convention moves the
 * flagged count from 49 checks to far more.
 *
 * ONE DELIBERATE DIVERGENCE, because it is the difference between a redundant
 * string and a false one. When a program row states only ONE side of a limit,
 * the vendor initialises the missing side to double.MaxValue, so `value <
 * minLimit` is true for every reading and the field is reported as "Below" even
 * when it is comfortably in spec. Here a missing limit simply means that side
 * is not constrained. It is inert on this sample — the only single-sided stems
 * are Iron and NTU, and neither has a single recorded reading — but it would
 * mis-flag every row on a database that filled them in.
 *
 * A quirk that IS kept, because it misinforms nobody: a check inside two
 * overlapping program intervals is compared against both, so a field can appear
 * twice — "Above (density, density)" is what WellView prints there too.
 */
import { modelField } from "./model.js";

export interface RangeQuery {
  prepare(sql: string): { all(...args: unknown[]): unknown[] };
}

/** One comparable quantity: a check column and the program's two limits. */
export interface MudLimit {
  /** Lowercased stem, which is also what the output prints. */
  stem: string;
  /** The column on wvJobReportMudChk, as the database spells it. */
  checkCol: string;
  /** The program's lower limit column, when it has one. */
  minCol: string | null;
  maxCol: string | null;
}

const CHECK_TABLE = "wvJobReportMudChk";
const PROGRAM_TABLE = "wvJobProgramMud";

/**
 * The quantities that can honestly be compared, given both tables' columns.
 *
 * A pair is admitted only when the check column and the limit column are
 * measured in the SAME base unit. Nothing else stands between this and a
 * permanently wrong flag: the model gives wvJobProgramMud two dozen limit pairs
 * whose names match a check column, and a mismatch there would compare a
 * pressure against a density and report it out of range on every row, forever.
 */
export function mudLimits(
  checkCols: Map<string, string>,
  programCols: Map<string, string>,
): MudLimit[] {
  const out: MudLimit[] = [];
  const seen = new Set<string>();
  for (const [lc, actual] of programCols) {
    const m = lc.match(/^(.*?)(min|max)$/);
    if (!m) continue;
    const stem = m[1];
    if (!stem || seen.has(stem)) continue;

    const checkCol = checkCols.get(stem);
    if (!checkCol) continue;

    const minCol = programCols.get(`${stem}min`) ?? null;
    const maxCol = programCols.get(`${stem}max`) ?? null;
    if (!minCol && !maxCol) continue;

    // Same quantity on both sides, or the comparison is meaningless.
    const cu = modelField(CHECK_TABLE, stem)?.baseUnit ?? null;
    const pu = modelField(PROGRAM_TABLE, `${stem}min`)?.baseUnit
      ?? modelField(PROGRAM_TABLE, `${stem}max`)?.baseUnit ?? null;
    if (cu !== pu) continue;

    seen.add(stem);
    out.push({ stem, checkCol, minCol, maxCol });
    void actual;
  }
  return out.sort((a, b) => a.stem.localeCompare(b.stem));
}

/** What one check was found to be outside, in the order the vendor prints it. */
export interface OutOfRange {
  below: string[];
  above: string[];
  /** The rendered value of OutOfRangeCalc, or null when nothing was out. */
  text: string | null;
}

/**
 * Compare a page of mud checks against the mud program.
 *
 * ONE query for the whole page, joined through the report to the job — the same
 * discipline as every other resolver here.
 *
 * A check that matches NO program row is absent from the result: there was
 * nothing to be out of range OF, which is not the same as being in range. A
 * check that matches and passes gets an entry with `text: null`, because that
 * IS an answer — the reading was checked against a limit and met it.
 */
export function mudOutOfRange(
  db: RangeQuery,
  idwell: string,
  checkIds: string[],
  limits: MudLimit[],
): Map<string, OutOfRange> {
  const out = new Map<string, OutOfRange>();
  if (!limits.length || !checkIds.length) return out;
  const ids = [...new Set(checkIds.filter(Boolean))];
  if (!ids.length) return out;
  const holes = ids.map(() => "?").join(", ");

  const cols = limits.flatMap((l) => [
    `k."${l.checkCol}" AS "v_${l.stem}"`,
    l.minCol ? `p."${l.minCol}" AS "lo_${l.stem}"` : `NULL AS "lo_${l.stem}"`,
    l.maxCol ? `p."${l.maxCol}" AS "hi_${l.stem}"` : `NULL AS "hi_${l.stem}"`,
  ]);

  let rows: Record<string, unknown>[];
  try {
    rows = db.prepare(
      `SELECT k."IDRec" AS __id, ${cols.join(", ")}
         FROM "${CHECK_TABLE}" k
         JOIN "wvJobReport" r ON r."IDRec" = k."IDRecParent"
         JOIN "${PROGRAM_TABLE}" p ON p."IDRecParent" = r."IDRecParent"
          AND k."Depth" >= p."DepthStart" AND k."Depth" <= p."DepthEnd"
        WHERE k.idwell = ? AND k."IDRec" IN (${holes})
        ORDER BY p."DepthStart", p."IDRec"`,
    ).all(idwell, ...ids) as Record<string, unknown>[];
  } catch {
    return out;                       // a database without these tables
  }

  for (const r of rows) {
    const key = String(r.__id ?? "");
    const rec = out.get(key) ?? { below: [], above: [], text: null };
    for (const l of limits) {
      const v = r[`v_${l.stem}`];
      if (v == null || v === "") continue;
      const value = Number(v);
      if (!Number.isFinite(value)) continue;

      const lo = r[`lo_${l.stem}`];
      const hi = r[`hi_${l.stem}`];
      // Inclusive: exactly on a limit is in range. A missing limit does not
      // constrain that side — see the divergence note above.
      if (lo != null && Number.isFinite(Number(lo)) && value < Number(lo)) rec.below.push(l.stem);
      if (hi != null && Number.isFinite(Number(hi)) && value > Number(hi)) rec.above.push(l.stem);
    }
    out.set(key, rec);
  }

  for (const rec of out.values()) rec.text = renderOutOfRange(rec);
  return out;
}

/**
 * The string WellView prints: "Below (a, b)", "Above (c)", newline between.
 *
 * Both the wrappers and the separator are the vendor's, read out of its own
 * calculation engine. The two halves are kept apart rather than flattened into
 * one list because they call for opposite responses — 28 of the sample's 49
 * flagged checks are under-weight and 21 are over.
 */
export function renderOutOfRange(r: Pick<OutOfRange, "below" | "above">): string | null {
  const parts: string[] = [];
  if (r.below.length) parts.push(`Below (${r.below.join(", ")})`);
  if (r.above.length) parts.push(`Above (${r.above.join(", ")})`);
  return parts.length ? parts.join("\n") : null;
}
