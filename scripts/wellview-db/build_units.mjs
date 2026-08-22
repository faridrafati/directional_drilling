/**
 * Peloton's OWN unit conversion table → the app's conversion data.
 *
 * `WellView_files/system/Peloton.Common.Units` is an Access (Jet 4) database
 * holding one table, `UnitConversion`, with 277 rows of
 * `BaseUnit, UserUnit, Des, Factor, Exponent, Offset`. It is the authority: it
 * is what the desktop converts with.
 *
 * THE FORMULA, derived from the data and checked against physics rather than
 * assumed:
 *
 *     base = ((user − Offset) × Factor) ^ Exponent
 *
 * Confirmed on eleven independent cases including the two awkward ones —
 * °F (Offset 32, Factor 5/9) and °API (Offset −131.5, Exponent −1, so that
 * water at 1000 kg/m³ reads 10 °API and 0.8 SG oil reads 45.375).
 *
 * WHY THIS REPLACES A HAND-DERIVED TABLE. The app's arithmetic used to be
 * worked out by hand: 22 families, 102 units. Against these 277 rows it agreed
 * on 75, REFUSED 152, and disagreed on 3. The refusals were the real cost —
 * every one is a field that quietly rendered in metres to a user working in
 * feet, because the pair simply was not known.
 *
 * WHY IT IS NOT IMPORTED BLINDLY. One of the three disagreements is Peloton's
 * mistake, not ours, and importing it would have introduced an error the app
 * did not have. Their `ft` is 0.3048 and their `ft³` is 0.3048³ and their `in²`
 * is 0.0254² — all exact — but their `ft²` is 0.0929053, which is neither
 * 0.3048² (0.09290304) nor the US survey foot squared (0.09290341). It is
 * internally inconsistent with the rest of their own table: a transposed digit.
 *
 * So every derived unit is CHECKED against its own base unit here, and the
 * handful that fail are corrected through `OVERRIDES` with the reason written
 * down. A vendor file is evidence, not scripture.
 *
 *   node scripts/wellview-db/build_units.mjs
 *     → apps/web/public/wellview-templates/units.json
 */
import MDBReader from "mdb-reader";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..");
const SRC = process.env.WELLVIEW_UNITS
  ?? join(REPO, "WellView_files", "system", "Peloton.Common.Units");
const OUT = join(REPO, "apps", "web", "public", "wellview-templates", "units.json");

/**
 * Corrections to the shipped table, each with the evidence for it.
 *
 * Keyed "base|user". Only ever for a row demonstrably inconsistent with
 * Peloton's own other rows — never to impose a preference.
 */
const OVERRIDES = {
  "m²|ft²": {
    factor: 0.3048 ** 2,
    why: "shipped 0.0929053 is neither 0.3048² (0.09290304, which their own ft "
      + "and ft³ use) nor the US survey foot squared (0.09290341); a transposed digit",
  },
  "m²|dm²": {
    factor: 0.1 ** 2,
    why: "shipped 100 is the RECIPROCAL, four orders of magnitude out: their own dm "
      + "is 0.1 and their cm²/mm² are 0.01²/0.001², so a square decimetre is 0.01 m². "
      + "100 is exactly the factor on their 1/dm² row, which is correct there — copied "
      + "into the wrong row",
  },
};
/** Units whose relationship to a base cannot be a single factor at all. */
const NOTES = {
  "kg/m³|°API": "reciprocal with an offset: API = 141.5/SG − 131.5",
  "m/day|min/ft": "reciprocal: time per distance against distance per time",
  "m/day|min/m": "reciprocal: time per distance against distance per time",
};

const rows = new MDBReader(readFileSync(SRC)).getTable("UnitConversion").getData();

/** base = ((user − Offset) × Factor) ^ Exponent */
const toBase = (u, r) => Math.pow((u - (r.offset ?? 0)) * r.factor, r.exponent ?? 1);

const units = rows.map((r) => {
  const key = `${r.BaseUnit}|${r.UserUnit}`;
  const o = OVERRIDES[key];
  return {
    base: r.BaseUnit,
    unit: r.UserUnit,
    label: r.Des ?? r.UserUnit,
    factor: o ? o.factor : r.Factor,
    exponent: r.Exponent ?? 1,
    offset: r.Offset ?? 0,
    ...(o ? { corrected: o.why, shippedFactor: r.Factor } : {}),
    ...(NOTES[key] ? { note: NOTES[key] } : {}),
  };
});

/*
 * Consistency check: a squared or cubed unit should be its own base unit raised
 * to that power. Reported, not silently fixed — a new inconsistency in a future
 * WellView release should be looked at by a person, not absorbed.
 */
const byPair = new Map(units.map((u) => [`${u.base}|${u.unit}`, u]));
const suspect = [];
for (const u of units) {
  // Powers of a LINEAR unit only. A compound like lb/ft² or bbl/ft³ is not its
  // own base raised to a power, and treating it as one reports nonsense.
  if (u.unit.includes("/") || u.base.includes("/")) continue;
  const m = u.unit.match(/^(.+?)([²³])$/);
  if (!m || u.exponent !== 1 || u.offset !== 0) continue;
  const [, stem, power] = m;
  const baseStem = u.base.match(/^(.+?)[²³]$/)?.[1];
  if (!baseStem) continue;
  const linear = byPair.get(`${baseStem}|${stem}`);
  if (!linear || linear.exponent !== 1 || linear.offset !== 0) continue;
  const expect = linear.factor ** (power === "²" ? 2 : 3);
  const rel = Math.abs(u.factor - expect) / expect;
  if (rel > 1e-9) {
    suspect.push({ pair: `${u.base}|${u.unit}`, factor: u.factor, expect, rel, corrected: !!u.corrected });
  }
}

const payload = {
  generated_from: "WellView_files/system/Peloton.Common.Units (Jet 4, table UnitConversion)",
  formula: "base = ((user - Offset) * Factor) ^ Exponent",
  unit_count: units.length,
  base_units: [...new Set(units.map((u) => u.base))].sort(),
  units,
};
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(payload, null, 1));

console.log(`units → ${OUT}`);
console.log(`  ${units.length} conversions over ${payload.base_units.length} base units`);
console.log(`  ${units.filter((u) => u.exponent !== 1).length} reciprocal, `
  + `${units.filter((u) => u.offset !== 0).length} with an offset`);
console.log(`  ${units.filter((u) => u.corrected).length} corrected against the shipped file:`);
for (const u of units.filter((x) => x.corrected)) {
  console.log(`      ${u.base} ← ${u.unit}: ${u.shippedFactor} → ${u.factor}`);
  console.log(`         ${u.corrected}`);
}
if (suspect.filter((s) => !s.corrected).length) {
  console.log(`  NOTE: ${suspect.filter((s) => !s.corrected).length} squared/cubed units still `
    + `disagree with their own linear unit — look at these:`);
  for (const s of suspect.filter((x) => !x.corrected)) {
    console.log(`      ${s.pair}: ${s.factor} vs ${s.expect} (${(s.rel * 100).toPrecision(3)}%)`);
  }
}

/* ── the generated TypeScript table ─────────────────────────────────────── */

const TS_OUT = join(REPO, "packages", "shared", "src", "units", "wellview-table.ts");
const q = (s) => JSON.stringify(s);
const ts = [
  "/**",
  " * WellView's unit conversions — GENERATED, do not edit by hand.",
  " *",
  " * Source: WellView_files/system/Peloton.Common.Units, the Access database the",
  " * desktop itself converts with; regenerate with",
  " * `node scripts/wellview-db/build_units.mjs`.",
  " *",
  " * Each row says how one USER unit relates to its BASE unit:",
  " *",
  " *     base = ((user - offset) * factor) ^ exponent",
  " *",
  " * A unit name determines its base uniquely — no name appears under two bases —",
  " * which is what makes refusing a cross-family conversion automatic rather than",
  " * a rule someone has to maintain.",
  " *",
  " * Two rows are CORRECTED against the shipped file, each because it contradicts",
  " * Peloton's own other rows; `corrected` carries the reason and `shippedFactor`",
  " * the value that was replaced.",
  " */",
  "export interface UnitRow {",
  "  /** The unit the database stores. */",
  "  base: string;",
  "  /** The unit a user sees. */",
  "  unit: string;",
  "  /** Peloton's own description. */",
  "  label: string;",
  "  factor: number;",
  "  exponent: number;",
  "  offset: number;",
  "  /** Set when this app overrode the shipped factor, with the reason. */",
  "  corrected?: string;",
  "  shippedFactor?: number;",
  "  /** Set when the relationship is not a plain scale. */",
  "  note?: string;",
  "}",
  "",
  "export const UNIT_ROWS: readonly UnitRow[] = [",
  ...units.map((u) => "  " + JSON.stringify({
    base: u.base, unit: u.unit, label: u.label,
    factor: u.factor, exponent: u.exponent, offset: u.offset,
    ...(u.corrected ? { corrected: u.corrected, shippedFactor: u.shippedFactor } : {}),
    ...(u.note ? { note: u.note } : {}),
  }) + ","),
  "];",
  "",
].join("\n");
writeFileSync(TS_OUT, ts);
console.log(`  table  → ${TS_OUT}`);
void q;

// A last sanity pass against physics, so a bad regeneration fails loudly.
const CHECKS = [
  ["°C", "°F", 212, 100], ["°C", "°F", 32, 0], ["°C", "K", 0, -273.15],
  ["kg/m³", "°API", 10, 1000], ["m", "ft", 1, 0.3048], ["m", "in", 1, 0.0254],
  ["kPa", "psi", 1, 6.89475729], ["m³", "bbl", 1, 0.158987294928],
  ["m²", "ft²", 1, 0.09290304], ["Proportion", "%", 50, 0.5],
];
let bad = 0;
for (const [b, u, user, expect] of CHECKS) {
  const r = byPair.get(`${b}|${u}`);
  const got = r ? toBase(user, r) : NaN;
  if (!(Math.abs(got - expect) < Math.abs(expect || 1) * 1e-6)) {
    console.error(`  CHECK FAILED ${user} ${u} → ${got} ${b}, expected ${expect}`);
    bad++;
  }
}
if (bad) { console.error(`\n${bad} physical check(s) failed — not trusting this output`); process.exit(1); }
console.log(`  ${CHECKS.length} physical checks pass`);
