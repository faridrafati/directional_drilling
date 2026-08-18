/**
 * Rendering a stored WellView value in the user's unit set.
 *
 * ONE conversion path, used by every surface that shows a number. The rule is:
 * stored values are always in the model's base unit and are never rewritten;
 * conversion happens at the render boundary and is inverted on the way back in.
 * Anything else produces a database whose units depend on who last edited it.
 *
 * The model supplies the target unit and the .NET format string per field per
 * set; `wellview.ts` supplies the arithmetic. When the two cannot be reconciled —
 * an unknown unit, a stale `baseunit` that puts the pair in different families —
 * the value stays in its base unit and `converted` is false, so the caller can
 * label it honestly instead of printing a mis-scaled number.
 */
import { convertUnit } from "./wellview.js";
import { applyDatumShift, type DatumShift, type DatumMode } from "./datum.js";

/** How one unit set shows one field: the unit, and the model's format for it. */
export interface UnitFormat {
  unit: string;
  /** Decimal places always shown. */
  decimals?: number;
  /** Upper bound when the format ends in optional '#' digits. */
  maxDecimals?: number;
  /** The format asked for thousands separators. */
  grouped?: boolean;
  /** An imperial size: print 9 5/8, not 9.63. */
  fraction?: boolean;
}

/** What the data model says about a field's units, per unit set. */
export interface FieldUnitSpec {
  /** The model's base unit — what the database stores. */
  unit?: string;
  /** Per unit-set: the unit to show and how to format it. */
  units?: Record<string, UnitFormat>;
  /** Measured from the reference datum (Tools > Reference Datum). */
  applyDatum?: boolean;
  /** How it responds: "up" and "invariant" are not a plain subtraction. */
  datumMode?: DatumMode;
}

export interface DisplayedValue extends Omit<UnitFormat, "unit"> {
  /** The number to show, converted when that was possible. */
  value: number;
  /** The unit it is now in. */
  unit: string;
  /** False when the value is still in its base unit because it could not convert. */
  converted: boolean;
}

/** The unit a field is shown in for a set, or its base unit. */
export function displayUnitFor(spec: FieldUnitSpec, unitSet: string): UnitFormat | null {
  const base = spec.unit;
  if (!base) return null;
  const target = spec.units?.[unitSet];
  if (!target?.unit) return { unit: base };
  return target;
}

/**
 * Stored (base) → displayed, in the user's set and from the chosen datum.
 *
 * ORDER MATTERS. The datum offset is a number of metres in the model's base
 * unit, so it is applied to the stored value FIRST and the unit conversion runs
 * on the result. Converting first and then subtracting a metre offset from a
 * value now in feet would be wrong by the conversion factor.
 */
export function toDisplay(
  value: number,
  spec: FieldUnitSpec,
  unitSet: string,
  datum?: DatumShift | null,
): DisplayedValue | null {
  const base = spec.unit;
  if (base == null || !Number.isFinite(value)) return null;
  if (datum && spec.applyDatum) {
    value = applyDatumShift(value, datum, spec.datumMode ?? "depth");
  }
  const target = displayUnitFor(spec, unitSet);
  if (!target || target.unit === base) {
    return { ...target, value, unit: base, converted: true };
  }
  const converted = convertUnit(value, base, target.unit);
  if (converted === null) {
    // Different families or an unknown unit — keep the honest base value, and
    // drop the format with it: it described the unit we did not reach.
    return { value, unit: base, converted: false };
  }
  return { ...target, value: converted, converted: true };
}

/**
 * Displayed → stored (base), for a value the user typed.
 *
 * Returns null when the text is not a number, and returns the number UNCHANGED
 * when the field could not be converted for display — because in that case what
 * the user saw, and therefore typed, was already the base unit.
 */
export function fromDisplay(
  text: string,
  spec: FieldUnitSpec,
  unitSet: string,
  datum?: DatumShift | null,
): number | null {
  const n = parseNumber(text);
  if (n === null) return null;
  const base = spec.unit;
  if (!base) return n;
  const target = displayUnitFor(spec, unitSet);
  let v = n;
  if (target && target.unit !== base) {
    const back = convertUnit(n, target.unit, base);
    if (back !== null) v = back;
  }
  // Undo the datum offset the user was shown, in the base unit, so what lands
  // in the database stays referenced to the original KB.
  if (datum && spec.applyDatum) {
    const mode = spec.datumMode ?? "depth";
    v = applyDatumShift(v, datum, mode === "up" ? "depth" : mode === "invariant" ? "invariant" : "up");
  }
  return v;
}

/** The whole render in one call: "1,234.57" plus the unit it is in. */
export function formatForDisplay(
  value: number,
  spec: FieldUnitSpec,
  unitSet: string,
): { text: string; unit: string; converted: boolean } | null {
  const d = toDisplay(value, spec, unitSet);
  if (!d) return null;
  return { text: formatUnitValue(d.value, d), unit: d.unit, converted: d.converted };
}

/**
 * Round and punctuate a number the way the model's format string asks.
 *
 * Takes either a plain decimal count (the old, simple case) or the format the
 * model gave for that field and set. With neither, it falls back to a readable
 * default rather than dumping full float precision on screen.
 */
export function formatUnitValue(value: number, format?: number | UnitFormat): string {
  const f: UnitFormat | undefined = typeof format === "number" ? ({ unit: "", decimals: format }) : format;
  if (f?.fraction) return formatFraction(value);
  const dp = f?.decimals ?? (Math.abs(value) >= 100 ? 1 : 3);
  return value.toLocaleString(undefined, {
    minimumFractionDigits: dp,
    maximumFractionDigits: Math.max(dp, f?.maxDecimals ?? dp),
    useGrouping: f?.grouped ?? true,
  });
}

/**
 * An imperial size as the industry writes it: 9 5/8, 12 1/4, 2 7/8.
 *
 * 148 fields in the model carry `format="fraction"` and every one is a pipe,
 * bit or hole size in inches. A driller does not read "9.63 in", and a decimal
 * there is a data-entry hazard as much as a display one — so the grid both
 * prints and accepts the fraction.
 *
 * Rounded to the nearest 1/64 and reduced, which lands the standard sizes
 * exactly (9.625 → 9 5/8) and is at worst 1/128 in off for anything else — a
 * display rounding of the same kind as showing two decimals.
 */
export function formatFraction(value: number, denominator = 64): string {
  if (!Number.isFinite(value)) return "";
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  let whole = Math.floor(abs);
  let num = Math.round((abs - whole) * denominator);
  let den = denominator;
  if (num >= den) { whole += 1; num = 0; }
  if (num === 0) return `${sign}${whole}`;
  const g = gcd(num, den);
  num /= g; den /= g;
  return whole === 0 ? `${sign}${num}/${den}` : `${sign}${whole} ${num}/${den}`;
}

function gcd(a: number, b: number): number {
  while (b) { [a, b] = [b, a % b]; }
  return a;
}

/**
 * Read a number the user typed, in any of the forms this app prints.
 *
 * Plain decimals, thousands separators, and the fractions above — "9 5/8",
 * "9-5/8" and a bare "5/8" — because a field that displays a fraction has to
 * accept one back. Returns null for anything it cannot read in full, rather
 * than the leading number it could: "9 5/x" is a typo, not 9.
 */
export function parseNumber(text: string): number | null {
  const s = String(text).replace(/,/g, "").trim();
  if (!s) return null;
  const frac = s.match(/^([+-])?(?:(\d+)\s*[\s-]\s*)?(\d+)\s*\/\s*(\d+)$/);
  if (frac) {
    const [, sign, whole, num, den] = frac;
    const d = Number(den);
    if (!d) return null;
    const v = (whole ? Number(whole) : 0) + Number(num) / d;
    return sign === "-" ? -v : v;
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
