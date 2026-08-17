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
  UNIT_FAMILIES, UNCONVERTIBLE_UNITS, canConvert, convertUnit,
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
    expect(convertUnit(1, "MCF", "m³")).toBeCloseTo(28.316846592, 9);
    expect(convertUnit(1, "MCF", "m³")! / convertUnit(1, "m³", "m³")!).toBeGreaterThan(28);
    // 1 psi ≈ 6.894757 kPa; 1 bar is 100 kPa exactly.
    expect(convertUnit(1, "psi", "kPa")).toBeCloseTo(6.894757293168361, 9);
    expect(convertUnit(1, "bars", "kPa")).toBe(100);
    // 1 atm ≈ 14.696 psi — a number every engineer knows.
    expect(convertUnit(101.325, "kPa", "psi")).toBeCloseTo(14.6959, 3);
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

  it("refuses the units whose arithmetic this table cannot express", () => {
    // API gravity is a reciprocal of specific gravity, not a scale.
    expect(UNCONVERTIBLE_UNITS["°API"]).toMatch(/reciprocal/i);
    expect(convertUnit(1, "kg/m³", "°API")).toBeNull();
    // Currency has no factor.
    expect(convertUnit(1, "Cost", "Cost/m")).toBeNull();
    // …and a same-unit request still works, since nothing has to be computed.
    expect(convertUnit(42, "Cost", "Cost")).toBe(42);
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
