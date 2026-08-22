/**
 * WellView's units of measure.
 *
 * Every value in a converted database is stored in the model's BASE unit — m,
 * kPa, m³, kg/m³, N, days, °C, Proportion, °/m — and WellView renders it in the
 * unit the user's set names. `Peloton.WellView.mdl.xml` states the target unit
 * and decimal places per field per set (US, Metric, EU, Mixed); what it does not
 * state is the arithmetic, which is here.
 *
 * FAMILIES, not pairs. Conversion is permitted only within a family, so a
 * dimensionally meaningless pair is refused by construction rather than by a
 * blacklist. That matters because the model's `baseunit` attribute is stale on
 * some fields and yields nonsense pairs — "rpm → psi", "days → lb/gal",
 * "V → ft". Those simply do not convert, and the caller shows the base unit.
 *
 * The mapping is  canonical = value × scale + offset,  so ft → m is 0.3048 and
 * NOT 3.28084. Only temperature has a non-zero offset; a temperature DIFFERENCE
 * would have to use the scale alone, which is why no difference field is
 * converted here.
 *
 * Constants were derived and then independently re-derived and checked, each
 * against a stated exact definition: the international foot is 0.3048 m exactly,
 * the petroleum barrel is 42 US gallons, MCF is a THOUSAND cubic feet, psi comes
 * from lbf over in², and a knot is one nautical mile (1852 m) per hour.
 */

export interface UnitDef {
  /** canonical = value × scale + offset */
  scale: number;
  offset?: number;
  /** The exact definition relied on. */
  note?: string;
}
import { UNIT_ROWS, type UnitRow } from "./wellview-table.js";

export interface UnitFamily {
  family: string;
  canonical: string;
  units: Record<string, UnitDef>;
}

export const UNIT_FAMILIES: UnitFamily[] = [
  {
    family: "time",
    canonical: "days",
    units: {
      "days": { scale: 1, note: "canonical base unit; exact" },
      "hr": { scale: 0.041666666666666664, note: "1 hr = 1/24 day exactly (24 hr/day)" },
      "min": { scale: 0.0006944444444444445, note: "1 min = 1/1440 day exactly (1440 min/day)" },
      "s": { scale: 0.000011574074074074073, note: "1 s = 1/86400 day exactly (86400 s/day)" },
    },
  },
  {
    family: "volume rate",
    canonical: "m³/day",
    units: {
      "m³/day": { scale: 1, note: "canonical base unit; exact" },
      "m³/hr": { scale: 24, note: "24 hr/day exactly" },
      "m³/min": { scale: 1440, note: "1440 min/day exactly" },
      "1000m³/day": { scale: 1000, note: "decimal prefix, 1000 m³ = 1 E3m³; exact" },
      "bbl/day": { scale: 0.158987294928, note: "1 bbl = 42 US gal = 42 × 231 in³ = 0.158987294928 m³ exactly (in = 0.0254 m)" },
      "bbl/hr": { scale: 3.815695078272, note: "0.158987294928 × 24, exact" },
      "bbl/min": { scale: 228.94170469632, note: "0.158987294928 × 1440, exact" },
      "gpm": { scale: 5.45099296896, note: "US gallon = 231 in³ = 0.003785411784 m³ exactly; × 1440 min/day" },
      "ft³/min": { scale: 40.77625909248, note: "ft = 0.3048 m exactly → ft³ = 0.028316846592 m³; × 1440 min/day" },
      "MCF/day": { scale: 28.316846592, note: "MCF = 1000 ft³ (thousand cubic feet, NOT million) = 28.316846592 m³ exactly; volumetric only — no pressure/temperature correction is applied by this s" },
      "mL/30min": { scale: 0.000048, note: "1 mL = 1e-6 m³; per 30 min = per 1/48 day → 1e-6 × 48. Dimensionally a volume rate and exactly linear, but it is the API fixed-protocol filtrate/fluid" },
    },
  },
  {
    family: "speed",
    canonical: "m/day",
    units: {
      "m/day": { scale: 1, note: "canonical base unit; exact. Family covers all length-per-time quantities in the model — ROP (m/day, ft/hr), annular/fluid velocity (m/s, ft/min, ft/s)" },
      "m/hr": { scale: 24, note: "24 hr/day exactly" },
      "m/min": { scale: 1440, note: "1440 min/day exactly" },
      "m/s": { scale: 86400, note: "86400 s/day exactly" },
      "ft/hr": { scale: 7.3152, note: "ft = 0.3048 m exactly; 0.3048 × 24" },
      "ft/min": { scale: 438.912, note: "0.3048 × 1440, exact" },
      "ft/s": { scale: 26334.72, note: "0.3048 × 86400, exact" },
      "km/hr": { scale: 24000, note: "1 km = 1000 m exactly; 1000 × 24" },
      "knots": { scale: 44448, note: "1 knot = 1 international nautical mile per hour, nmi = 1852 m exactly; 1852 × 24" },
    },
  },
  {
    family: "pressure",
    canonical: "kPa",
    units: {
      "kPa": { scale: 1, note: "canonical; WellView base unit for pressure" },
      "Pa": { scale: 0.001, note: "1 kPa = 1000 Pa exactly" },
      "psi": { scale: 6.894757293168361, note: "1 lbf = 4.4482216152605 N exactly (0.45359237 kg x 9.80665 m/s^2); 1 in = 0.0254 m exactly; psi = 4.4482216152605 / 0.00064516 = 6894.757293168361 Pa" },
      "bars": { scale: 100, note: "1 bar = 100000 Pa exactly (definition)" },
      "lbf/100ft²": { scale: 0.00047880258980335846, note: "mud yield-point unit; 1 lbf/ft2 = 4.4482216152605 / 0.09290304 = 47.88025898033584 Pa, divided by 100 = 0.4788025898033584 Pa = 4.7880258980335843e-4 " },
    },
  },
  {
    family: "pressure gradient",
    canonical: "kPa/m",
    units: {
      "kPa/m": { scale: 1, note: "canonical; pressure per unit length - dimensionally distinct from pressure, so kept as its own family (kPa/m must never convert to kPa)" },
      "psi/ft": { scale: 22.620594793859453, note: "6.894757293168361 kPa per psi / 0.3048 m per ft = 22.620594793859453 kPa/m" },
    },
  },
  {
    family: "force",
    canonical: "N",
    units: {
      "N": { scale: 1, note: "canonical; WellView base unit for force" },
      "daN": { scale: 10, note: "deca- prefix = 10 exactly" },
      "lbf": { scale: 4.4482216152605, note: "1 lbf = 0.45359237 kg x 9.80665 m/s^2 = 4.4482216152605 N exactly" },
      "100lbf": { scale: 444.82216152605, note: "hook-load style unit: one display unit = 100 lbf = 100 x 4.4482216152605 N" },
      "1000lbf": { scale: 4448.2216152605, note: "one display unit = 1000 lbf = 1000 x 4.4482216152605 N; identical to kips" },
      "kips": { scale: 4448.2216152605, note: "1 kip = 1000 lbf = 4448.2216152605 N; exact synonym of 1000lbf" },
    },
  },
  {
    family: "torque",
    canonical: "N•m",
    units: {
      "N•m": { scale: 1, note: "canonical; WellView base unit for torque/moment" },
      "daN•m": { scale: 10, note: "deca- prefix = 10 exactly" },
      "ft•lb": { scale: 1.3558179483314003, note: "foot-pound-force: 4.4482216152605 N x 0.3048 m = 1.3558179483314004 N.m exactly" },
      "1000in•lb": { scale: 112.9848290276167, note: "1 in.lbf = 4.4482216152605 x 0.0254 = 0.1129848290276167 N.m; one display unit = 1000 in.lbf = 112.9848290276167 N.m" },
    },
  },
  {
    family: "length",
    canonical: "m",
    units: {
      "m": { scale: 1, note: "canonical base unit" },
      "ft": { scale: 0.3048, note: "international foot = 0.3048 m exactly (matches METERS_PER_UNIT in packages/shared/src/units/index.ts)" },
      "in": { scale: 0.0254, note: "international inch = 0.0254 m exactly (= 0.3048/12)" },
      "mm": { scale: 0.001, note: "SI prefix milli = 1e-3, exact" },
      "km": { scale: 1000, note: "SI prefix kilo = 1e3, exact" },
      "miles": { scale: 1609.344, note: "statute (international) mile = 5280 ft x 0.3048 = 1609.344 m exactly; NOT the nautical mile (1852 m)" },
      "µm": { scale: 0.000001, note: "SI prefix micro = 1e-6, exact" },
    },
  },
  {
    family: "area",
    canonical: "m²",
    units: {
      "m²": { scale: 1, note: "canonical base unit" },
      "ft²": { scale: 0.09290304, note: "0.3048^2 = 0.09290304 m² exactly" },
      "in²": { scale: 0.00064516, note: "0.0254^2 = 0.00064516 m² exactly" },
      "mm²": { scale: 0.000001, note: "(1e-3)^2 = 1e-6 m² exactly" },
      "µm²": { scale: 1e-12, note: "(1e-6)^2 = 1e-12 m² exactly; the SI permeability unit, 1 µm² = 1.013250 darcy" },
      "darcy": { scale: 9.869233e-13, note: "permeability carries the dimension of area: 1 D = (1 cP x 1 cm/s)/(1 atm/cm) = (1e-3 Pa·s x 1e-2 m/s)/(101325 Pa / 1e-2 m) = 9.869233e-13 m² = 0.98692" },
    },
  },
  {
    family: "volume",
    canonical: "m³",
    units: {
      "m³": { scale: 1, note: "canonical base unit" },
      "bbl": { scale: 0.158987294928, note: "US petroleum barrel = 42 US liquid gallons = 42 x 0.003785411784 = 0.158987294928 m³ exactly (not the 31.5-gal or 55-gal drum)" },
      "gal": { scale: 0.003785411784, note: "US liquid gallon = 231 in³ = 231 x 0.0254^3 = 0.003785411784 m³ exactly (not the imperial gallon, 0.00454609 m³)" },
      "L": { scale: 0.001, note: "litre = 1e-3 m³ exactly (= 1 dm³)" },
      "MCF": { scale: 28.316846592, note: "M is the Roman thousand: MCF = 1000 ft³ = 1000 x 0.3048^3 = 1000 x 0.028316846592 = 28.316846592 m³ exactly. Not a million; volumetric at the report's" },
      "E3m³": { scale: 1000, note: "metric gas 'E3' notation = 10^3 m³ = 1000 m³ exactly; the metric twin of MCF (1 E3m³ = 1000/28.316846592 = 35.3146667 MCF)" },
    },
  },
  {
    family: "density",
    canonical: "kg/m³",
    units: {
      "kg/m³": { scale: 1, note: "canonical base unit" },
      "g/L": { scale: 1, note: "1 g/L = 1e-3 kg / 1e-3 m³ = 1 kg/m³ exactly" },
      "mg/L": { scale: 0.001, note: "1 mg/L = 1e-6 kg / 1e-3 m³ = 1e-3 kg/m³ exactly" },
      "sg(h2o)": { scale: 1000, note: "specific gravity relative to water taken as exactly 1000 kg/m³ (4 °C reference); NOT °API, which is reciprocal" },
      "lb/gal": { scale: 119.826427317, note: "0.45359237 kg / 0.003785411784 m³ (US gallon = 231 in³); ppg, not imperial gallon" },
      "lb/ft³": { scale: 16.018463374, note: "0.45359237 kg / 0.028316846592 m³ (ft = 0.3048 m exactly)" },
      "lb/bbl": { scale: 2.85301017421, note: "0.45359237 kg / 0.158987294928 m³ (42-US-gal petroleum barrel) = lb/gal ÷ 42" },
      "kg/1000m³": { scale: 0.001, note: "1 kg per 1000 m³ = 1e-3 kg/m³ exactly" },
      "lb/1000ft³": { scale: 0.016018463374, note: "lb/ft³ ÷ 1000 = 0.45359237 kg / 28.316846592 m³" },
    },
  },
  {
    family: "mass",
    canonical: "kg",
    units: {
      "kg": { scale: 1, note: "canonical base unit" },
      "lb": { scale: 0.45359237, note: "international avoirdupois pound = 0.45359237 kg exactly" },
    },
  },
  {
    family: "linear mass",
    canonical: "kg/m",
    units: {
      "kg/m": { scale: 1, note: "canonical base unit" },
      "lb/ft": { scale: 1.48816394357, note: "0.45359237 kg / 0.3048 m, both exact (tubular weight per length)" },
    },
  },
  {
    family: "power",
    canonical: "W",
    units: {
      "W": { scale: 1, note: "canonical base unit" },
      "kW": { scale: 1000, note: "SI prefix, exact" },
      "hp": { scale: 745.699871582, note: "mechanical/imperial horsepower = 550 ft·lbf/s = 550 × 0.3048 × 4.4482216152605 W exactly; NOT metric PS (735.5 W) and NOT boiler hp" },
    },
  },
  {
    family: "power per area",
    canonical: "W/m²",
    units: {
      "W/m²": { scale: 1, note: "canonical for this family — power flux; deliberately kept OUT of the power family so hp → W/m² and kW/mm² → kW cannot be requested (dimensionally dist" },
      "kW/mm²": { scale: 1000000000, note: "1000 W / 1e-6 m² = 1e9 W/m² exactly" },
      "hp/in²": { scale: 1155837.113, note: "745.699871582 W / 0.00064516 m² (in = 0.0254 m exactly); mechanical hp, same hp as the power family" },
    },
  },
  {
    family: "dynamic viscosity",
    canonical: "Pa•s",
    units: {
      "Pa•s": { scale: 1, note: "canonical base unit" },
      "cp": { scale: 0.001, note: "centipoise; poise = 0.1 Pa·s exactly, so cp = 1e-3 Pa·s exactly" },
      "mPa•s": { scale: 0.001, note: "SI prefix, exact — numerically identical to cp (1 cp = 1 mPa·s)" },
    },
  },
  {
    family: "energy density",
    canonical: "J/m³",
    units: {
      "J/m³": { scale: 1, note: "canonical base unit" },
      "MJ/m³": { scale: 1000000, note: "SI prefix, exact" },
    },
  },
  {
    family: "angle per length",
    canonical: "°/m",
    units: {
      "°/m": { scale: 1, note: "canonical base unit (dogleg severity / build-turn rate)" },
      "°/30m": { scale: 0.0333333333333333, note: "1/30 exactly — the 30 m course length is a definition, not a measured constant" },
      "°/100ft": { scale: 0.0328083989501312, note: "1 / (100 × 0.3048) = 1/30.48 exactly; note °/30m and °/100ft are NOT equal (30 m vs 30.48 m)" },
    },
  },
  {
    family: "ratio",
    canonical: "Proportion",
    units: {
      "Proportion": { scale: 1, note: "canonical base unit — dimensionless fraction, 1.0 = 100%" },
      "%": { scale: 0.01, note: "1/100 exactly (Proportion → % is ×100, the inverse direction)" },
      "ppm": { scale: 0.000001, note: "1e-6 exactly (Proportion → ppm is ×1e6); parts per million by the same basis as the stored proportion" },
      "v/v": { scale: 1, note: "volume/volume fraction, 1:1 with Proportion" },
      "% v/v": { scale: 0.01, note: "1/100 exactly — volume-percent, same scale as %" },
      "mL/mL": { scale: 1, note: "1:1 with Proportion (same unit on both sides)" },
      "m³/m³": { scale: 1, note: "1:1 with Proportion (same unit on both sides)" },
    },
  },
  {
    family: "temperature",
    canonical: "°C",
    units: {
      "°C": { scale: 1, note: "canonical base unit" },
      "°F": { scale: 0.555555555555556, offset: -17.7777777777778, note: "°C = °F × 5/9 − 160/9 exactly; the only family in this group with a non-zero offset — a temperature DIFFERENCE must use scale only, never the offset" },
    },
  },
  {
    family: "specific volume",
    canonical: "m³/kg",
    units: {
      "m³/kg": { scale: 1, note: "canonical base unit" },
      "m³/tonne": { scale: 0.001, note: "metric tonne = 1000 kg exactly; NOT the short ton (907.18474 kg)" },
      "gal/sack": { scale: 0.00008345404452019332, note: "0.003785411784 m³ (US gal) / 45.359237 kg. THE SACK IS 100 lb, not the 94 lb Portland-cement sack this entry first assumed: Peloton's own table labels every /sack unit \"100 pound sack\" and ships sacks = 45.359237 kg = 100 × 0.45359237 exactly, and its gal/sack, ft³/sack and L/sack factors are the exact 100 lb values to 16 digits. The 94 lb assumption made every cement volume 6.383% too large" },
    },
  },
  {
    family: "diffusivity",
    canonical: "m²/day",
    units: {
      "m²/day": { scale: 1, note: "canonical (area per time — hydraulic diffusivity / kinematic viscosity share this dimension)" },
      "mm²/s": { scale: 0.0864, note: "1e-6 m² × 86400 s/day = 0.0864 exactly; mm²/s = centistokes" },
      "in²/s": { scale: 55.741824, note: "0.00064516 m² × 86400 s/day = 55.741824 exactly (in = 0.0254 m)" },
    },
  },
];

/**
 * Units the linear families above cannot express, with the reason.
 *
 * Each one is a reciprocal, a currency, or a display format. The families are
 * linear — `value × scale + offset` — and none of these is linear against its
 * base, so converting them with a scale would print a plausible, wrong number.
 *
 * They are no longer refused outright, and the reason is worth recording:
 * Peloton's own table carries an EXPONENT as well as a factor and an offset,
 * and every one of these twelve is in it. `min/m` is stored against `m/day`
 * with exponent −1 and factor 1/1440 — which is exactly the hyperbola
 * `m/day = 1440 / (min/m)` this list was written to avoid. `°API` is stored
 * with exponent −1 and offset −131.5, which is `141.5/SG − 131.5` exactly.
 * `1/32"` turns out to be a plain length against `m` with factor 0.0254/32; it
 * is only the RENDERING as thirty-seconds that is a format, and that lives in
 * `wellview-display.ts`.
 *
 * So this list now guards the linear fallback beneath Peloton's table, not the
 * table itself. None of the twelve is a member of any family above, so it is
 * belt-and-braces rather than load-bearing — kept because the reasons are the
 * record of why a scale factor is the wrong tool for them.
 *
 * What stays genuinely unconvertible is what Peloton does not attempt either:
 * there is no cross-currency row anywhere in its table. `Cost` is one
 * dimensionless currency with scale prefixes (1k, 10k, 100k, 1M), so `Cost → 1k`
 * is arithmetic on a count of units and not an exchange rate.
 */
export const NOT_LINEARLY_SCALABLE: Record<string, string> = {
  "min/m": "Reciprocal rate (drilling time per metre): m/day = 1440 / (min/m), a hyperbola, so no scale exists. Peloton stores it as exponent −1 against m/day.",
  "min/ft": "Reciprocal rate, as min/m: m/day = 438.912 / (min/ft). Peloton stores it as exponent −1 against m/day.",
  "Cost/day": "Currency per unit time. Convertible to Cost/hr (factor 24, same currency); not to any dimensional unit.",
  "Cost/hr": "Currency per unit time; see Cost/day.",
  "1/32\"": "A DISPLAY FORMAT as much as a unit: a length (jet/nozzle size, gauge wear) rendered as thirty-seconds of an inch. The arithmetic is linear (0.0254/32 m); the rendering is not this file's job.",
  "°API": "API gravity is the reciprocal of specific gravity (API = 141.5/SG − 131.5), not a linear scale of kg/m³. Peloton stores it as exponent −1, offset −131.5.",
  "s/qt": "Time per volume. Peloton's base for it is days/m³, against which it IS linear — the reciprocal is in the base, not the unit.",
  "s/L": "Time per volume; see s/qt.",
  "Cost": "Currency. Converts only to its own scale prefixes (1k, 10k, 100k, 1M); no cross-currency rate exists.",
  "Cost/m": "Currency per length. The length converts (Cost/ft = 1/0.3048); the currency does not.",
  "Cost/ft": "Currency per length; see Cost/m.",
  "Cost/unit": "Currency per unit. Nothing else in the table shares its base, so no pair exists to convert.",
};

/** unit name → its family, built once. */
const BY_UNIT = new Map<string, UnitFamily>();
for (const f of UNIT_FAMILIES) for (const u of Object.keys(f.units)) BY_UNIT.set(u, f);

/*
 * PELOTON'S OWN CONVERSION TABLE, and why it comes first.
 *
 * `system/Peloton.Common.Units` is what the desktop converts with: 277 rows of
 * (base, unit, factor, exponent, offset) over 61 base units, which is 2,550
 * ordered pairs. The families above were worked out by hand before that file
 * had been read, and cover 518.
 *
 * The 2,076 pairs only Peloton has were the cost of not reading it: each is a
 * field that stayed in its stored unit for someone working in another, because
 * `canConvert` did not know the pair existed. Refusing is safe, but it is not
 * right.
 *
 * The hand families are KEPT beneath it rather than deleted: 44 pairs are only
 * theirs — the 1000m³/day gas-rate group and the dimensionless ratios
 * (Proportion, %, ppm, v/v, % v/v, mL/mL, m³/m³) — and adopting the vendor file
 * alone would trade one silent gap for another.
 *
 * The two tables overlap on 474 pairs. 332 are bit-identical; 142 differ, and
 * the worst of those is 1.2 parts per million (lb/bbl to lb/1000ft³). Every one
 * is Peloton storing a factor to about seven significant figures where this
 * file had used the exact definition — psi as 6.894757 rather than
 * 6.894757293168361, MCF as 28.31685 rather than 28.316846592. Less precise,
 * never wrong, and far below the precision of anything a rig measures.
 * Peloton's value wins because a self-consistent table beats a mixed one, and
 * because its number is what the desktop showed the people who typed the data.
 *
 * One overlap was NOT rounding, and it is the reason this was worth doing: this
 * file had `gal/sack` on the 94 lb Portland-cement sack, and WellView's sack is
 * 100 lb — every /sack row is labelled "100 pound sack" and `sacks` ships as
 * 45.359237 kg exactly. Every cement volume converted through that unit was
 * 6.383% out. The hand entry has been corrected to agree.
 */
const PELOTON_BY_UNIT = new Map<string, UnitRow>();
for (const r of UNIT_ROWS) PELOTON_BY_UNIT.set(r.unit, r);
/*
 * A base unit is its own identity, and 14 of the 61 ship no row for themselves.
 * Without one, `kg/m³ → lb/gal` finds no shared base and is refused — even
 * though every lb/gal row names kg/m³ as the thing it converts to. No unit name
 * in the table is also some other base's name, so these 14 cannot collide.
 */
for (const base of new Set(UNIT_ROWS.map((r) => r.base))) {
  if (!PELOTON_BY_UNIT.has(base)) {
    PELOTON_BY_UNIT.set(base, { base, unit: base, label: base, factor: 1, exponent: 1, offset: 0 });
  }
}

/** user → base, by Peloton's formula: base = ((user − offset) × factor) ^ exponent. */
const toBaseUnit = (v: number, r: UnitRow): number => Math.pow((v - r.offset) * r.factor, r.exponent);
/** …and its inverse, base → user. */
const fromBaseUnit = (v: number, r: UnitRow): number => Math.pow(v, 1 / r.exponent) / r.factor + r.offset;

/** The two rows for `from` and `to`, when Peloton files them under one base. */
function pelotonPair(from: string, to: string): [UnitRow, UnitRow] | null {
  const a = PELOTON_BY_UNIT.get(from);
  const b = PELOTON_BY_UNIT.get(to);
  return a && b && a.base === b.base ? [a, b] : null;
}

/** Is a conversion between these two units meaningful? */
export function canConvert(from: string, to: string): boolean {
  if (from === to) return true;
  // Peloton's table first: it is what the desktop computes with, and its
  // exponent expresses the reciprocals the linear families cannot.
  if (pelotonPair(from, to)) return true;
  // Beneath it, the linear families — which must never be handed a unit whose
  // arithmetic is not linear.
  if (NOT_LINEARLY_SCALABLE[from] || NOT_LINEARLY_SCALABLE[to]) return false;
  const a = BY_UNIT.get(from);
  const b = BY_UNIT.get(to);
  return !!a && a === b;
}

/**
 * Convert between two units of the same base.
 *
 * Returns null when the conversion is not meaningful — a different base, an
 * unknown unit, or an input the pair's own arithmetic cannot take. The caller
 * shows the value in its stored unit and says so; it never falls back to
 * returning the number unchanged under the other unit's label, which would be a
 * silent lie.
 */
export function convertUnit(value: number, from: string, to: string): number | null {
  if (!Number.isFinite(value)) return null;
  if (from === to) return value;

  const pair = pelotonPair(from, to);
  if (pair) {
    const [ra, rb] = pair;
    const out = fromBaseUnit(toBaseUnit(value, ra), rb);
    // The pair being convertible does not make every INPUT convertible: 0 min/m
    // is a division by zero, and an Infinity dressed as a drilling rate is worse
    // than no answer at all.
    return Number.isFinite(out) ? out : null;
  }

  if (NOT_LINEARLY_SCALABLE[from] || NOT_LINEARLY_SCALABLE[to]) return null;
  const fam = BY_UNIT.get(from);
  if (!fam || fam !== BY_UNIT.get(to)) return null;
  const a = fam.units[from];
  const b = fam.units[to];
  if (!a || !b) return null;
  const canonical = value * a.scale + (a.offset ?? 0);
  return (canonical - (b.offset ?? 0)) / b.scale;
}

// Rendering — decimals, grouping and fractional inches — is in
// `wellview-display.ts`, so this file stays a table of arithmetic.
