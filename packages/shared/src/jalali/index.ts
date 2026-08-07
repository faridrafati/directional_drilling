/**
 * Jalali (Shamsi) date handling for the report suite.
 *
 * Every date this application stores is a Jalali STRING, "YYYY/MM/DD", because
 * that is exactly what the legacy DDR archive holds and what the printed reports
 * show. Strings sort like dates — but only when the month and day are
 * zero-padded, and the entry API's own regex (`/^\d{3,4}\/\d{1,2}\/\d{1,2}$/`)
 * accepts "1404/5/9". Lexicographically "1404/5/9" sorts AFTER "1404/12/01",
 * which is wrong by seven months, and a date-only day never compares correctly
 * against a "YYYY/MM/DD HH:mm" phase boundary.
 *
 * So: never compare these strings directly. Every range test, sort and window
 * stamp in the report assemblers goes through `jalaliKey`.
 *
 * `jalaliDayNumber` is the Birashk conversion the DDR viewer already used for
 * elapsed-day arithmetic; it is lifted here so the multi-well reports and the
 * DDR page share one implementation.
 */

/** A Jalali date, optionally with a time: "1404/05/09" or "1404/05/09 21:45". */
const JALALI = /^(\d{3,4})\/(\d{1,2})\/(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?$/;

export interface JalaliParts {
  year: number;
  month: number;
  day: number;
  /** Null when the string carried no time. */
  hour: number | null;
  minute: number | null;
}

/** Split a stored Jalali string, or null when it is not one. */
export function parseJalali(value: string | null | undefined): JalaliParts | null {
  const m = JALALI.exec((value ?? "").trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const hour = m[4] === undefined ? null : Number(m[4]);
  const minute = m[5] === undefined ? null : Number(m[5]);
  if (hour !== null && (hour > 23 || (minute ?? 0) > 59)) return null;
  return { year, month, day, hour, minute };
}

/**
 * A sortable, comparable key: "YYYYMMDDHHmm", zero-padded throughout.
 *
 * A date with no time keys to 0000, so a day compares as its own midnight —
 * which is what "is this day inside [phase start, phase end)" means. Anything
 * unparseable returns null so a caller cannot accidentally sort garbage to the
 * top: filter first, then compare.
 */
export function jalaliKey(value: string | null | undefined): string | null {
  const p = parseJalali(value);
  if (!p) return null;
  const pad = (n: number, w: number) => String(n).padStart(w, "0");
  return `${pad(p.year, 4)}${pad(p.month, 2)}${pad(p.day, 2)}${pad(p.hour ?? 0, 2)}${pad(p.minute ?? 0, 2)}`;
}

/**
 * Is `value` inside [start, end)? Half-open, so back-to-back phases cannot both
 * claim the same instant. A missing bound is treated as open in that direction;
 * an unparseable `value` is never inside anything.
 */
export function jalaliInRange(
  value: string | null | undefined,
  start: string | null | undefined,
  end: string | null | undefined,
): boolean {
  const k = jalaliKey(value);
  if (k === null) return false;
  const from = jalaliKey(start);
  const to = jalaliKey(end);
  if (from !== null && k < from) return false;
  if (to !== null && k >= to) return false;
  return true;
}

/**
 * Compare two Jalali strings for `Array.prototype.sort`. Unparseable values
 * sort last, in their original relative order.
 */
export function compareJalali(a: string | null | undefined, b: string | null | undefined): number {
  const ka = jalaliKey(a);
  const kb = jalaliKey(b);
  if (ka === null && kb === null) return 0;
  if (ka === null) return 1;
  if (kb === null) return -1;
  return ka < kb ? -1 : ka > kb ? 1 : 0;
}

const idiv = (a: number, b: number): number => Math.floor(a / b);

/**
 * Jalali date → a serial day number (Birashk).
 *
 * Used for elapsed-day differences: "days from spud" on report 06, the day axis
 * of reports 10/11/14, and the DDR viewer's "Day N from start". Exact over the
 * span of a well (months to a couple of years), which is all it is asked for.
 * Any time component is ignored — this counts days, not instants.
 */
export function jalaliDayNumber(value: string | null | undefined): number | null {
  const p = parseJalali(value);
  if (!p) return null;
  const jy = p.year + 1595;
  return -355668 + 365 * jy + idiv(jy, 33) * 8 + idiv((jy % 33) + 3, 4)
    + p.day + (p.month < 7 ? (p.month - 1) * 31 : (p.month - 7) * 30 + 186);
}

/**
 * Elapsed days between two Jalali dates, `to − from`. Null if either is
 * unparseable. Report 06's DFS ("days from spud") is this plus one, because the
 * spud day is day 1 — the caller applies that, not this function.
 */
export function jalaliDaysBetween(
  from: string | null | undefined,
  to: string | null | undefined,
): number | null {
  const a = jalaliDayNumber(from);
  const b = jalaliDayNumber(to);
  return a === null || b === null ? null : b - a;
}

/**
 * Gregorian → Jalali "YYYY/MM/DD".
 *
 * The ONLY conversion in this module, and it exists for one job: stamping
 * "Report Printed" on a generated report. Stored dates are already Jalali and
 * are printed exactly as stored — nothing here converts them.
 *
 * The algorithm is the standard 33-year-cycle arithmetic (Birashk); it agrees
 * with the `jalaliDayNumber` above by construction, which the tests check.
 */
export function toJalali(date: Date): string {
  const G_DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const J_DAYS_IN_MONTH = [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 29];

  const gYear = date.getFullYear();
  const gy = gYear - 1600;
  const gm = date.getMonth();          // 0-based
  const gd = date.getDate() - 1;

  let gDayNo = 365 * gy + idiv(gy + 3, 4) - idiv(gy + 99, 100) + idiv(gy + 399, 400);
  for (let i = 0; i < gm; i++) gDayNo += G_DAYS_IN_MONTH[i];
  // The leap day belongs to the year only once February is behind us.
  const gLeap = (gYear % 4 === 0 && gYear % 100 !== 0) || gYear % 400 === 0;
  if (gm > 1 && gLeap) gDayNo++;
  gDayNo += gd;

  let jDayNo = gDayNo - 79;
  const cycles = idiv(jDayNo, 12053);   // whole 33-year cycles
  jDayNo %= 12053;
  let jy = 979 + 33 * cycles + 4 * idiv(jDayNo, 1461);
  jDayNo %= 1461;
  // The guard matters: within a 4-year block the FIRST year is the 366-day one,
  // so subtracting a year unconditionally throws the result a year out at every
  // leap boundary.
  if (jDayNo >= 366) {
    jy += idiv(jDayNo - 1, 365);
    jDayNo = (jDayNo - 1) % 365;
  }
  let jm = 0;
  while (jm < 11 && jDayNo >= J_DAYS_IN_MONTH[jm]) jDayNo -= J_DAYS_IN_MONTH[jm++];
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${jy}/${pad(jm + 1)}/${pad(jDayNo + 1)}`;
}

/**
 * Fractional days between two Jalali date-times, `to − from`.
 *
 * Report 10's phase durations are printed to 2 dp (1.53, 1.38, 7.71 days) and
 * come from boundaries at 09:00 / 21:45 — whole days cannot reproduce them.
 * A bound with no time counts as midnight.
 */
export function jalaliHoursBetween(
  from: string | null | undefined,
  to: string | null | undefined,
): number | null {
  const a = parseJalali(from);
  const b = parseJalali(to);
  if (!a || !b) return null;
  const days = jalaliDaysBetween(from, to);
  if (days === null) return null;
  const minutesOf = (p: JalaliParts) => (p.hour ?? 0) * 60 + (p.minute ?? 0);
  return days * 24 + (minutesOf(b) - minutesOf(a)) / 60;
}
