/**
 * Unit system and conversion.
 * Conversion factors ported from old_delphi_code/Unit23.pas:conversion.
 *
 * The Delphi `conversion(a,b,c)` procedure builds a chain of multipliers
 * keyed by an integer unit index 1..8. We re-encode that as a 1-to-meters
 * factor table; conversion is then `factorFrom / factorTo`.
 */

export type LengthUnit = "cm" | "m" | "km" | "ft" | "yd" | "mi" | "nmi";
export type AngleUnit = "deg" | "rad";
export type DLSUnit = "deg/100ft" | "deg/30m";

export interface UnitSystem {
  length: LengthUnit;
  angle: AngleUnit;
  dls: DLSUnit;
}

/** Meters per 1 unit. Verified against Unit23.pas:extra[1..8]. */
const METERS_PER_UNIT: Record<LengthUnit, number> = {
  cm: 0.01,
  m: 1,
  km: 1000,
  ft: 0.3048,                  // 1 m = 3.2808398950 ft
  yd: 0.9144,                  // 1 m = 1.0936132983 yd
  mi: 1609.344,                // 1 m = 6.213712e-4 mi
  nmi: 1852,                   // 1 m = 5.399568e-4 nmi
};

/** Convert a length value between any two LengthUnits. */
export function convertLength(value: number, from: LengthUnit, to: LengthUnit): number {
  if (from === to) return value;
  return (value * METERS_PER_UNIT[from]) / METERS_PER_UNIT[to];
}

/** Degrees → radians. */
export function deg2rad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Radians → degrees. */
export function rad2deg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/** Convert an angle between deg and rad. */
export function convertAngle(value: number, from: AngleUnit, to: AngleUnit): number {
  if (from === to) return value;
  return from === "deg" ? deg2rad(value) : rad2deg(value);
}

/**
 * Convert DLS (dogleg severity).
 * Storage is radians per unit-length-of-the-project. UI displays as deg/100ft or deg/30m.
 * `lengthUnit` is the project's storage length unit.
 */
export function dlsToDisplay(
  dlsRadPerUnit: number,
  lengthUnit: LengthUnit,
  display: DLSUnit
): number {
  const window = display === "deg/100ft" ? convertLength(100, "ft", lengthUnit)
                                         : convertLength(30, "m", lengthUnit);
  return rad2deg(dlsRadPerUnit * window);
}

export function dlsFromDisplay(
  displayValue: number,
  lengthUnit: LengthUnit,
  display: DLSUnit
): number {
  const window = display === "deg/100ft" ? convertLength(100, "ft", lengthUnit)
                                         : convertLength(30, "m", lengthUnit);
  return deg2rad(displayValue) / window;
}

/** 4 preset profiles matching Form42 + a custom option. */
export const UNIT_PRESETS: Record<string, UnitSystem> = {
  API:      { length: "ft", angle: "deg", dls: "deg/100ft" },
  Metric:   { length: "m",  angle: "deg", dls: "deg/30m"   },
  US:       { length: "ft", angle: "deg", dls: "deg/100ft" },
  Imperial: { length: "yd", angle: "deg", dls: "deg/100ft" },
};
