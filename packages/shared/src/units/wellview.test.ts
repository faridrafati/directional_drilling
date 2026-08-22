/**
 * WellView unit conversion.
 *
 * A wrong factor here is the worst kind of bug this app can have: every depth,
 * pressure and volume on every screen would be plausible and wrong, and nobody
 * re-derives a displayed number by hand. So these check the constants against
 * values that are exact by definition or independently memorable, and they check
 * the REFUSALS just as hard — a conversion that silently returns the number
 * unchanged under a different unit's label is the same lie as a wrong factor.
 */
import { describe, it, expect } from "vitest";
import {
  UNIT_FAMILIES, NOT_LINEARLY_SCALABLE, canConvert, convertUnit,
} from "./wellview.js";
import { formatUnitValue, formatFraction, parseNumber } from "./wellview-display.js";

describe("WellView units", () => {
  it("converts length against exact definitions", () => {
    // The international foot is 0.3048 m EXACTLY, and the inch a twelfth of it.
    expect(convertUnit(1, "ft", "m")).toBeCloseTo(0.3048, 12);
    expect(convertUnit(1, "m", "ft")).toBeCloseTo(3.280839895013123, 9);
    expect(convertUnit(1, "in", "mm")).toBeCloseTo(25.4, 9);
    expect(convertUnit(1, "km", "m")).toBe(1000);
    // A statute mile is 5280 ft — not the nautical mile.
    expect(convertUnit(1, "miles", "m")).toBeCloseTo(1609.344, 9);
    // A round trip must return the original.
    expect(convertUnit(convertUnit(1234.5, "m", "ft")!, "ft", "m")).toBeCloseTo(1234.5, 9);
  });

  it("converts the oilfield units by their real definitions", () => {
    // 1 barrel = 42 US gallons.
    expect(convertUnit(1, "bbl", "gal")).toBeCloseTo(42, 9);
    expect(convertUnit(1, "bbl", "m³")).toBeCloseTo(0.158987294928, 12);
    // MCF is a THOUSAND cubic feet — the classic off-by-1000 in this domain.
    expect(convertUnit(1, "MCF", "m³")!).toBeGreaterThan(28);
    expect(convertUnit(1, "MCF", "m³")!).toBeLessThan(29);
    // 1 bar is 100 kPa exactly.
    expect(convertUnit(1, "bars", "kPa")).toBe(100);
    // 1 atm ≈ 14.696 psi — a number every engineer knows.
    expect(convertUnit(101.325, "kPa", "psi")).toBeCloseTo(14.6959, 3);
  });

  it("carries Peloton's rounding, and holds it to seven significant figures", () => {
    // The conversions come from `system/Peloton.Common.Units`, and Peloton
    // stores its factors to about seven significant figures rather than to the
    // exact definition — psi as 6.894757, not 6.894757293168361; MCF as
    // 28.31685, not 28.316846592. Less precise, never wrong, and 1.2 parts per
    // million at worst across the whole table, which is orders of magnitude
    // below anything a rig measures.
    //
    // This is asserted as an explicit BOUND rather than by loosening the
    // decimal places on each assertion above, so that the day a factor drifts
    // further than the vendor's own rounding, a test fails instead of a report
    // quietly changing. Peloton's number wins over the exact definition because
    // a self-consistent table beats a mixed one, and because it is the number
    // the desktop showed the people who typed the data in.
    const EXACT: Array<[string, string, number]> = [
      ["psi", "kPa", 6.894757293168361],
      ["MCF", "m³", 28.316846592],
      ["ft", "m", 0.3048],
      ["bbl", "m³", 0.158987294928],
      ["in", "mm", 25.4],
      ["miles", "m", 1609.344],
    ];
    for (const [from, to, exact] of EXACT) {
      const got = convertUnit(1, from, to);
      expect(got, `${from} -> ${to}`).not.toBeNull();
      const rel = Math.abs(got! - exact) / exact;
      expect(rel, `${from} -> ${to} is ${got}, exact is ${exact}`).toBeLessThan(2e-6);
    }
  });

  it("converts dogleg to the units a driller actually reads", () => {
    // The whole reason this exists: the model stores °/m and shows °/30m or
    // °/100ft. 2°/30m is a normal dogleg; in base units it is 0.0667 °/m.
    expect(convertUnit(2, "°/30m", "°/m")).toBeCloseTo(2 / 30, 9);
    expect(convertUnit(2 / 30, "°/m", "°/30m")).toBeCloseTo(2, 9);
    // 30 m and 100 ft are near enough that the two readings are close.
    const per100ft = convertUnit(2 / 30, "°/m", "°/100ft")!;
    expect(per100ft).toBeCloseTo(2.032, 3);
  });

  it("handles temperature's offset in both directions", () => {
    expect(convertUnit(0, "°C", "°F")).toBeCloseTo(32, 9);
    expect(convertUnit(100, "°C", "°F")).toBeCloseTo(212, 9);
    expect(convertUnit(-40, "°C", "°F")).toBeCloseTo(-40, 9);      // the crossing point
    expect(convertUnit(98.6, "°F", "°C")).toBeCloseTo(37, 6);
  });

  it("scales ratios", () => {
    expect(convertUnit(1, "Proportion", "%")).toBeCloseTo(100, 9);
    expect(convertUnit(1, "Proportion", "ppm")).toBeCloseTo(1e6, 6);
    expect(convertUnit(50, "%", "Proportion")).toBeCloseTo(0.5, 9);
  });

  it("converts time and rate consistently", () => {
    expect(convertUnit(1, "days", "hr")).toBeCloseTo(24, 9);
    expect(convertUnit(1, "days", "min")).toBeCloseTo(1440, 9);
    expect(convertUnit(1, "hr", "s")).toBeCloseTo(3600, 6);
    // A rate and its time base must agree: 24 m³/day is 1 m³/hr.
    expect(convertUnit(24, "m³/day", "m³/hr")).toBeCloseTo(1, 9);
    // 1 knot is one nautical mile (1852 m) per hour.
    expect(convertUnit(1, "knots", "m/s")).toBeCloseTo(1852 / 3600, 9);
  });

  it("REFUSES a conversion across families, rather than returning the number", () => {
    // These pairs exist in the model only because some baseunit attributes are
    // stale. Converting them would print a plausible, meaningless number.
    for (const [a, b] of [["rpm", "psi"], ["days", "lb/gal"], ["V", "ft"], ["m", "kPa"], ["°", "knots"]]) {
      expect(canConvert(a, b), `${a}->${b}`).toBe(false);
      expect(convertUnit(1, a, b), `${a}->${b}`).toBeNull();
    }
    // An unknown unit is refused, not guessed at.
    expect(convertUnit(1, "m", "furlong")).toBeNull();
    expect(convertUnit(1, "smoot", "m")).toBeNull();
  });

  it("converts the reciprocal units, which only the vendor table can express", () => {
    // These were refused outright until Peloton's own table was read. Its rows
    // carry an EXPONENT as well as a factor, so a hyperbola is expressible.
    // Each number below is checked against the definition, not against the app.

    // API gravity: API = 141.5/SG - 131.5. Water is 1000 kg/m³ and 10 °API.
    expect(convertUnit(1000, "kg/m³", "°API")).toBeCloseTo(10, 6);
    expect(convertUnit(10, "°API", "kg/m³")).toBeCloseTo(1000, 4);
    // A 0.8 SG crude: 141.5/0.8 - 131.5 = 45.375 °API.
    expect(convertUnit(800, "kg/m³", "°API")).toBeCloseTo(45.375, 5);
    // Heavier than water is negative API, and that is correct, not an error.
    expect(convertUnit(1100, "kg/m³", "°API")!).toBeLessThan(0);

    // Drilling rate as time-per-length: m/day = 1440 / (min/m).
    expect(convertUnit(10, "min/m", "m/day")).toBeCloseTo(144, 6);
    expect(convertUnit(144, "m/day", "min/m")).toBeCloseTo(10, 6);
    // …and per foot: 1440 min/day / 10 = 144 ft/day = 43.8912 m/day.
    expect(convertUnit(10, "min/ft", "m/day")).toBeCloseTo(43.8912, 6);

    // The reason the reason still matters: the list explaining why a scale
    // factor is the wrong tool for these is kept, and still says so.
    expect(NOT_LINEARLY_SCALABLE["°API"]).toMatch(/reciprocal/i);
    expect(NOT_LINEARLY_SCALABLE["min/m"]).toMatch(/hyperbola/i);
  });

  it("refuses an input the pair's own arithmetic cannot take", () => {
    // The pair converts; this VALUE does not. 0 min/m is a division by zero,
    // and an Infinity labelled as a drilling rate is worse than no answer.
    expect(canConvert("min/m", "m/day")).toBe(true);
    expect(convertUnit(0, "min/m", "m/day")).toBeNull();
    expect(convertUnit(0, "m/day", "min/m")).toBeNull();
    // -131.5 °API is the pole of the API curve.
    expect(convertUnit(-131.5, "°API", "kg/m³")).toBeNull();
  });

  it("still refuses what has no conversion at all", () => {
    // Currency per length and currency itself do not share a base, in this
    // app or in Peloton's table.
    expect(convertUnit(1, "Cost", "Cost/m")).toBeNull();
    // …and a same-unit request still works, since nothing has to be computed.
    expect(convertUnit(42, "Cost", "Cost")).toBe(42);
    // What Cost DOES convert to is its own scale prefixes — a count of units,
    // not an exchange rate. No cross-currency row exists anywhere in the table.
    expect(convertUnit(5000, "Cost", "1k")).toBeCloseTo(5, 9);
    expect(convertUnit(1, "Cost/hr", "Cost/day")).toBeCloseTo(24, 9);
    expect(convertUnit(1, "Cost/m", "Cost/ft")).toBeCloseTo(0.3048, 9);
  });

  it("takes WellView's 100 lb sack, not the 94 lb cement sack", () => {
    // This file first assumed the North-American Portland-cement sack of 94 lb.
    // WellView's is 100 lb: every /sack unit in Peloton's table is labelled
    // "100 pound sack" and `sacks` ships as 45.359237 kg = 100 x 0.45359237
    // exactly. The difference is 6.383%, straight through every cement volume.
    expect(convertUnit(1, "sacks", "kg")).toBeCloseTo(45.359237, 6);
    expect(convertUnit(1, "sacks", "lb")).toBeCloseTo(100, 6);
    // 1 US gal per 100 lb sack = 0.003785411784 / 45.359237 m³/kg.
    expect(convertUnit(1, "gal/sack", "m³/kg")).toBeCloseTo(0.003785411784 / 45.359237, 12);
    // Both tables now agree, so the fallback cannot reintroduce the 94 lb sack.
    const fam = UNIT_FAMILIES.find((f) => f.units["gal/sack"])!;
    expect(fam.units["gal/sack"].scale).toBeCloseTo(0.003785411784 / 45.359237, 15);
  });

  it("keeps every family internally consistent", () => {
    for (const f of UNIT_FAMILIES) {
      // The canonical unit must be a member, and must be the identity.
      const c = f.units[f.canonical];
      expect(c, `${f.family} canonical ${f.canonical}`).toBeTruthy();
      expect(c.scale, `${f.family} canonical scale`).toBe(1);
      expect(c.offset ?? 0, `${f.family} canonical offset`).toBe(0);
      for (const [name, u] of Object.entries(f.units)) {
        expect(Number.isFinite(u.scale), `${f.family}.${name}`).toBe(true);
        expect(u.scale, `${f.family}.${name} scale must be non-zero`).not.toBe(0);
        // Every member round-trips through the canonical unit.
        const back = convertUnit(convertUnit(7.5, name, f.canonical)!, f.canonical, name);
        expect(back, `${f.family}.${name} round trip`).toBeCloseTo(7.5, 6);
      }
    }
  });

  it("declares no unit in two families, which would make conversion ambiguous", () => {
    const seen = new Map<string, string>();
    for (const f of UNIT_FAMILIES) {
      for (const u of Object.keys(f.units)) {
        expect(seen.has(u), `${u} appears in both ${seen.get(u)} and ${f.family}`).toBe(false);
        seen.set(u, f.family);
      }
    }
    expect(seen.size).toBeGreaterThan(90);
  });

  it("formats to the decimals the model's format string asked for", () => {
    expect(formatUnitValue(1234.5678, 2)).toBe("1,234.57");
    expect(formatUnitValue(1234.5678, 0)).toBe("1,235");
    expect(formatUnitValue(0.5, 3)).toBe("0.500");
    // "{0:0.0}" — one decimal and NO separators; "{0:#,##0.0##}" — one required
    // decimal and up to three, so a round number does not grow a tail.
    expect(formatUnitValue(1234.56, { unit: "m", decimals: 1, grouped: false })).toBe("1234.6");
    expect(formatUnitValue(1234.5678, { unit: "m", decimals: 1, maxDecimals: 3, grouped: true })).toBe("1,234.568");
    expect(formatUnitValue(1234.5, { unit: "m", decimals: 1, maxDecimals: 3, grouped: true })).toBe("1,234.5");
  });

  it("prints the sizes a driller reads, as fractions", () => {
    // 148 fields carry format="fraction"; all are pipe/bit/hole sizes in inches.
    // These are the exact strings the training guide uses.
    expect(formatFraction(9.625)).toBe("9 5/8");
    expect(formatFraction(13.375)).toBe("13 3/8");
    expect(formatFraction(12.25)).toBe("12 1/4");
    expect(formatFraction(2.875)).toBe("2 7/8");
    expect(formatFraction(5.5)).toBe("5 1/2");
    expect(formatFraction(0.5)).toBe("1/2");
    expect(formatFraction(-9.625)).toBe("-9 5/8");
    // A whole number carries no fraction, and 63.5/64 rounds up to the next inch
    // rather than printing "8 64/64".
    expect(formatFraction(26)).toBe("26");
    expect(formatFraction(8.999)).toBe("9");
    // The size as it really arrives: 244.5 mm converted to inches.
    expect(formatFraction(convertUnit(0.2445, "m", "in")!)).toBe("9 5/8");
    // Rounding is to 1/64, so it is never worse than 1/128 in out.
    expect(formatFraction(9.6)).toBe("9 19/32");
  });

  it("reads back every form it prints", () => {
    expect(parseNumber("9 5/8")).toBeCloseTo(9.625, 12);
    expect(parseNumber("9-5/8")).toBeCloseTo(9.625, 12);
    expect(parseNumber("5/8")).toBeCloseTo(0.625, 12);
    expect(parseNumber("-9 5/8")).toBeCloseTo(-9.625, 12);
    expect(parseNumber("1,234.57")).toBeCloseTo(1234.57, 9);
    expect(parseNumber("12.25")).toBe(12.25);
    // Refuse what it cannot read IN FULL, rather than the leading number: a
    // half-parsed size would silently store 9 for "9 5/x".
    expect(parseNumber("9 5/x")).toBeNull();
    expect(parseNumber("9 5/0")).toBeNull();
    expect(parseNumber("")).toBeNull();
    expect(parseNumber("N/A")).toBeNull();
    // Every fraction this prints must survive the round trip back to a number.
    for (const v of [9.625, 12.25, 2.875, 0.5, 17.5, 6.125, 4.5]) {
      expect(parseNumber(formatFraction(v)), `round trip ${v}`).toBeCloseTo(v, 9);
    }
  });
});
