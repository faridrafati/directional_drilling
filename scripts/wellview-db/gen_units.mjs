/** Generate the WellView unit table from the derived+checked family data. */
import { readFileSync, writeFileSync } from "node:fs";

const SCR = process.env.SCR;
const { families, excluded } = JSON.parse(readFileSync(`${SCR}/unit-families.json`, "utf8"));

const q = (s) => JSON.stringify(s);
const lines = [];
lines.push(`/**
 * WellView's units of measure.
 *
 * Every value in a converted database is stored in the model's BASE unit — m,
 * kPa, m³, kg/m³, N, days, °C, Proportion, °/m — and WellView renders it in the
 * unit the user's set names. \`Peloton.WellView.mdl.xml\` states the target unit
 * and decimal places per field per set (US, Metric, EU, Mixed); what it does not
 * state is the arithmetic, which is here.
 *
 * FAMILIES, not pairs. Conversion is permitted only within a family, so a
 * dimensionally meaningless pair is refused by construction rather than by a
 * blacklist. That matters because the model's \`baseunit\` attribute is stale on
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
export interface UnitFamily {
  family: string;
  canonical: string;
  units: Record<string, UnitDef>;
}
`);

lines.push("export const UNIT_FAMILIES: UnitFamily[] = [");
for (const f of families) {
  lines.push(`  {`);
  lines.push(`    family: ${q(f.family)},`);
  lines.push(`    canonical: ${q(f.canonical)},`);
  lines.push(`    units: {`);
  for (const u of f.units) {
    const off = u.offset ? `, offset: ${u.offset}` : "";
    const note = u.note ? `, note: ${q(u.note.replace(/\s+/g, " ").slice(0, 150))}` : "";
    lines.push(`      ${q(u.unit)}: { scale: ${u.scale}${off}${note} },`);
  }
  lines.push(`    },`);
  lines.push(`  },`);
}
lines.push("];\n");

lines.push(`/**
 * Units deliberately NOT converted, with the reason. Each would need arithmetic
 * this table cannot express, so a field displayed in one keeps its base unit
 * rather than being silently mis-scaled.
 */
export const UNCONVERTIBLE_UNITS: Record<string, string> = {`);
const seen = new Set();
for (const e of excluded) {
  if (!e.unit || seen.has(e.unit) || /^\(/.test(e.unit)) continue;
  seen.add(e.unit);
  lines.push(`  ${q(e.unit)}: ${q(e.reason.replace(/\s+/g, " ").slice(0, 160))},`);
}
// The non-linear ones the brief named explicitly, in case a group missed one.
for (const [u, why] of [
  ["°API", "API gravity is the reciprocal of specific gravity (API = 141.5/SG − 131.5), not a linear scale of kg/m³."],
  ["s/qt", "Reciprocal rate — seconds per quart against a volume-rate family."],
  ["s/L", "Reciprocal rate — seconds per litre against a volume-rate family."],
  ["Cost", "Currency. No fixed factor exists."],
  ["Cost/m", "Currency per length; the length converts, the currency does not."],
  ["Cost/ft", "Currency per length; the length converts, the currency does not."],
  ["Cost/unit", "Currency per unit. No fixed factor exists."],
]) {
  if (seen.has(u)) continue;
  seen.add(u);
  lines.push(`  ${q(u)}: ${q(why)},`);
}
lines.push("};\n");

lines.push(`/** unit name → its family, built once. */
const BY_UNIT = new Map<string, UnitFamily>();
for (const f of UNIT_FAMILIES) for (const u of Object.keys(f.units)) BY_UNIT.set(u, f);

/** Is a conversion between these two units meaningful? */
export function canConvert(from: string, to: string): boolean {
  if (from === to) return true;
  if (UNCONVERTIBLE_UNITS[from] || UNCONVERTIBLE_UNITS[to]) return false;
  const a = BY_UNIT.get(from);
  const b = BY_UNIT.get(to);
  return !!a && a === b;
}

/**
 * Convert between two units of the same family.
 *
 * Returns null when the conversion is not meaningful — a different family, an
 * unknown unit, or one of the units this table refuses. The caller shows the
 * value in its base unit and says so; it never falls back to returning the
 * number unchanged under the other unit's label, which would be a silent lie.
 */
export function convertUnit(value: number, from: string, to: string): number | null {
  if (!Number.isFinite(value)) return null;
  if (from === to) return value;
  if (!canConvert(from, to)) return null;
  const fam = BY_UNIT.get(from)!;
  const a = fam.units[from];
  const b = fam.units[to];
  if (!a || !b) return null;
  const canonical = value * a.scale + (a.offset ?? 0);
  return (canonical - (b.offset ?? 0)) / b.scale;
}

// Rendering — decimals, grouping and fractional inches — is in
// \`wellview-display.ts\`, so this file stays a table of arithmetic.
`);

writeFileSync("packages/shared/src/units/wellview.ts", lines.join("\n"));
console.log("wrote packages/shared/src/units/wellview.ts");
console.log("families:", families.length, "units:", families.reduce((n, f) => n + f.units.length, 0), "unconvertible:", seen.size);
