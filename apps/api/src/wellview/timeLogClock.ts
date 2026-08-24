/**
 * The clock times of a daily Time Log.
 *
 * wvJobReportTimeLog has no start or end column. WellView derives them when a
 * report prints, and states the rule in the field's own help:
 *
 *   DtTmStartCalc — "<wvjobreport.dttmstart> + <wvjobreporttimelog.
 *                    sumofdurationcalc> from previous record."
 *   SumOfDurationCalc — "Cum of <…duration> for all records up to and
 *                    including the current one."
 *   DtTmEndCalc   — "<…dttmstartcalc> + <…duration>."
 *
 * So the whole thing is an anchor plus an ordered running total. Eight shipped
 * daily templates print at least one of the three, and all eight printed a
 * duration column with no clock beside it.
 *
 * IS IT A RECONSTRUCTION OR A FABRICATION? A reconstruction, and the database
 * says so without being asked. wvJobIntervalProblem carries REAL start and end
 * timestamps that nothing here derives; 45 of its 49 start times land within a
 * minute of a boundary this computation produces. The rate you would expect by
 * chance, given the number of distinct boundaries and 15-minute slots, is 13%.
 * Shuffling the durations within each report collapses the agreement to 4-9 of
 * 49. The order and the anchor are doing the work, not luck.
 *
 * WHAT IT REFUSES, and the reason each refusal exists:
 *
 *   - A report whose entries do not carry a unique sequence. One report in the
 *     sample has three rows all at sysSeq 0; there is no first among them, so
 *     there is no clock. Breaking the tie by row order would invent one.
 *   - Every row from the first blank Duration onward. SQL's SUM would skip the
 *     blank and carry on, which is worse than stopping: on one report a single
 *     missing duration at position 2 drags the following fifteen rows 4.5 hours
 *     early, and every one of them still looks like a time.
 *   - A row whose computed start falls outside the report's own period. 47 rows
 *     on 19 reports do, some by hundreds of days, because three entries carry
 *     durations of 365 and 584 DAYS inside a 24-hour report.
 *   - Nothing else. In particular, INACTIVE entries are included: this field's
 *     help states no exclusion, unlike wvJobReport.DurationTimeLogTotalCalc
 *     whose help does, and where daysVsDepth.ts correctly applies one. Mixing
 *     the two rules would move the clock by up to the 53 inactive rows.
 *
 * ROUNDED TO THE MINUTE, which is not cosmetic. Duration is stored as a 32-bit
 * float, so fifteen minutes is 0.0104166670 on one row and 0.0104166698 on the
 * next. Accumulating those drifts by milliseconds, and 3,509 of 4,054 computed
 * boundaries land off a whole minute. Truncated to the app's second-precision
 * stamp they print 09:44 where WellView prints 09:45 — one minute low, on a
 * plausible quarter-hour grid, on a report that still reconciles. Nothing on
 * the page would show it.
 */

/** What this needs of a database handle: one prepared query. */
export interface ClockQuery {
  prepare(sql: string): { all(...args: unknown[]): unknown[]; get(...args: unknown[]): unknown };
}

export interface TimeLogClockRow {
  /** Start of this entry, as an ISO-Z stamp in the shape the app stores. */
  dttmstartcalc: string | null;
  dttmendcalc: string | null;
  /** Cumulative duration to the END of this entry, in DAYS — the stored unit. */
  sumofdurationcalc: number | null;
}

const MS_PER_DAY = 86_400_000;
const MINUTE = 60_000;

/** The app's stamp shape: "YYYY-MM-DDTHH:MM:SSZ". */
function stamp(ms: number): string {
  return `${new Date(ms).toISOString().slice(0, 19)}Z`;
}

function parse(v: unknown): number | null {
  if (v == null || v === "") return null;
  const t = Date.parse(String(v));
  return Number.isFinite(t) ? t : null;
}

/**
 * Clock every entry of ONE daily report.
 *
 * Returns a map keyed by the entry's IDRec. A row that cannot be clocked is
 * ABSENT rather than present with nulls, so a caller that merges this into a
 * row leaves the cell blank rather than writing an empty string into it.
 */
export function timeLogClock(
  db: ClockQuery,
  idwell: string,
  idreport: string,
): Map<string, TimeLogClockRow> {
  const out = new Map<string, TimeLogClockRow>();
  let report: { s?: unknown; e?: unknown } | undefined;
  let rows: { IDRec: unknown; sysSeq: unknown; Duration: unknown }[];
  try {
    report = db.prepare(
      'SELECT "DtTmStart" AS s, "DtTmEnd" AS e FROM "wvJobReport" WHERE "IDRec" = ? AND idwell = ?',
    ).get(idreport, idwell) as { s?: unknown; e?: unknown } | undefined;
    rows = db.prepare(
      `SELECT "IDRec", "sysSeq", "Duration" FROM "wvJobReportTimeLog"
        WHERE idwell = ? AND "IDRecParent" = ? ORDER BY "sysSeq", "IDRec"`,
    ).all(idwell, idreport) as { IDRec: unknown; sysSeq: unknown; Duration: unknown }[];
  } catch {
    return out;                       // a database without these tables
  }

  const anchor = parse(report?.s);
  if (anchor == null || !rows.length) return out;
  const reportEnd = parse(report?.e);

  // No first among equals: a tied sequence gives no order, and an order is the
  // whole computation.
  const seqs = new Set(rows.map((r) => String(r.sysSeq ?? "")));
  if (seqs.size !== rows.length) return out;

  let cumDays = 0;
  for (const r of rows) {
    const startMs = Math.round((anchor + cumDays * MS_PER_DAY) / MINUTE) * MINUTE;

    // Outside the report it belongs to: stop, and take the rest with it — every
    // later entry is built on this one.
    if (reportEnd != null && (startMs < anchor - MINUTE || startMs > reportEnd + MINUTE)) break;

    const dur = r.Duration == null ? null : Number(r.Duration);
    if (dur == null || !Number.isFinite(dur)) break;   // the chain ends here

    const endDays = cumDays + dur;
    const endMs = Math.round((anchor + endDays * MS_PER_DAY) / MINUTE) * MINUTE;

    out.set(String(r.IDRec ?? ""), {
      dttmstartcalc: stamp(startMs),
      // An entry that ends before it starts is not an interval. Five rows in
      // the sample carry a negative duration.
      dttmendcalc: dur < 0 ? null : stamp(endMs),
      sumofdurationcalc: endDays,
    });
    cumDays = endDays;
  }
  return out;
}

/**
 * True when the entries account for the report period they sit in.
 *
 * Not used to gate anything — a log that does not add up is still the log that
 * was kept — but it is the honest measure of how far this reconstruction can be
 * trusted on a given report, and 621 of the sample's 736 pass it.
 */
export function timeLogReconciles(
  db: ClockQuery,
  idwell: string,
  idreport: string,
  toleranceMs = MINUTE,
): boolean {
  let report: { s?: unknown; e?: unknown } | undefined;
  let total: { d?: unknown } | undefined;
  try {
    report = db.prepare(
      'SELECT "DtTmStart" AS s, "DtTmEnd" AS e FROM "wvJobReport" WHERE "IDRec" = ? AND idwell = ?',
    ).get(idreport, idwell) as { s?: unknown; e?: unknown } | undefined;
    total = db.prepare(
      `SELECT SUM("Duration") AS d FROM "wvJobReportTimeLog"
        WHERE idwell = ? AND "IDRecParent" = ?`,
    ).get(idwell, idreport) as { d?: unknown } | undefined;
  } catch {
    return false;
  }
  const a = parse(report?.s);
  const b = parse(report?.e);
  if (a == null || b == null || total?.d == null) return false;
  return Math.abs(a + Number(total.d) * MS_PER_DAY - b) <= toleranceMs;
}
