import { describe, expect, it } from "vitest";
import {
  compareJalali, jalaliDayNumber, jalaliDaysBetween, jalaliHoursBetween,
  jalaliInRange, jalaliKey, parseJalali, toJalali,
} from "./index.js";

describe("parseJalali", () => {
  it("reads a padded and an unpadded date the same way", () => {
    expect(parseJalali("1404/05/09")).toEqual({ year: 1404, month: 5, day: 9, hour: null, minute: null });
    expect(parseJalali("1404/5/9")).toEqual({ year: 1404, month: 5, day: 9, hour: null, minute: null });
  });

  it("reads an optional time", () => {
    expect(parseJalali("1404/05/09 21:45")).toEqual({ year: 1404, month: 5, day: 9, hour: 21, minute: 45 });
  });

  it("rejects what is not a Jalali date", () => {
    for (const bad of ["", "  ", "2000-02-21", "1404/13/01", "1404/05/32", "1404/05/09 25:00", null, undefined]) {
      expect(parseJalali(bad)).toBeNull();
    }
  });
});

describe("jalaliKey", () => {
  // The whole reason this module exists: raw string comparison gets these two
  // the wrong way round, because "5" > "1".
  it("makes an unpadded date sort correctly against a padded one", () => {
    expect("1404/5/9" > "1404/12/01").toBe(true);           // the bug
    expect(jalaliKey("1404/5/9")! < jalaliKey("1404/12/01")!).toBe(true);
  });

  it("keys a date to its own midnight so it compares against a date-time", () => {
    expect(jalaliKey("1404/05/09")).toBe("140405090000");
    expect(jalaliKey("1404/05/09 21:45")).toBe("140405092145");
  });

  it("is null for an unparseable value rather than sorting it first", () => {
    expect(jalaliKey("not a date")).toBeNull();
  });
});

describe("jalaliInRange", () => {
  const start = "1404/05/09 09:00";
  const end = "1404/05/12 21:45";

  it("is half-open, so back-to-back phases never both claim an instant", () => {
    expect(jalaliInRange(start, start, end)).toBe(true);
    expect(jalaliInRange(end, start, end)).toBe(false);
  });

  it("treats a day with no time as its midnight", () => {
    expect(jalaliInRange("1404/05/09", start, end)).toBe(false);   // 00:00 < 09:00
    expect(jalaliInRange("1404/05/10", start, end)).toBe(true);
  });

  it("treats a missing bound as open in that direction", () => {
    expect(jalaliInRange("1300/01/01", null, end)).toBe(true);
    expect(jalaliInRange("1500/01/01", start, null)).toBe(true);
  });

  it("never places an unparseable value inside a range", () => {
    expect(jalaliInRange("nonsense", null, null)).toBe(false);
  });
});

describe("compareJalali", () => {
  it("sorts by date and pushes unparseable values last", () => {
    const sorted = ["1404/12/01", null, "1404/5/9", "junk", "1403/01/01"].sort(compareJalali);
    expect(sorted.slice(0, 3)).toEqual(["1403/01/01", "1404/5/9", "1404/12/01"]);
    expect(sorted.slice(3)).toHaveLength(2);
  });
});

describe("day arithmetic", () => {
  it("advances one day at a month boundary", () => {
    // Month 6 has 31 days in the Jalali calendar; month 7 starts the 30-day half.
    expect(jalaliDaysBetween("1404/06/31", "1404/07/01")).toBe(1);
    expect(jalaliDaysBetween("1404/12/29", "1405/01/01")).toBe(1);
  });

  it("counts a whole year", () => {
    expect(jalaliDaysBetween("1404/01/01", "1405/01/01")).toBe(365);
  });

  it("ignores any time component — it counts days, not instants", () => {
    expect(jalaliDaysBetween("1404/05/09 23:00", "1404/05/10 01:00")).toBe(1);
  });

  it("is null when either side is unparseable", () => {
    expect(jalaliDaysBetween("1404/05/09", "oops")).toBeNull();
    expect(jalaliDayNumber("oops")).toBeNull();
  });
});

describe("jalaliHoursBetween", () => {
  // Report 10 prints phase durations to 2 dp off boundaries like 09:00 → 21:45;
  // whole days cannot reproduce 1.53 days.
  it("spans a part-day boundary", () => {
    expect(jalaliHoursBetween("1404/05/09 09:00", "1404/05/10 21:45")).toBeCloseTo(36.75, 6);
    expect(jalaliHoursBetween("1404/05/09 09:00", "1404/05/10 21:45")! / 24).toBeCloseTo(1.53, 2);
  });

  it("counts a bound with no time as midnight", () => {
    expect(jalaliHoursBetween("1404/05/09", "1404/05/09 06:00")).toBeCloseTo(6, 6);
  });

  it("goes negative when the bounds are reversed rather than silently absolute", () => {
    expect(jalaliHoursBetween("1404/05/10", "1404/05/09")).toBeCloseTo(-24, 6);
  });
});

describe("toJalali", () => {
  // Nowruz is the anchor: 21 March is 1 Farvardin in each of these years.
  it("puts Nowruz on 01/01", () => {
    expect(toJalali(new Date(2026, 2, 21))).toBe("1405/01/01");
    expect(toJalali(new Date(2025, 2, 21))).toBe("1404/01/01");
    expect(toJalali(new Date(2024, 2, 20))).toBe("1403/01/01");
  });

  it("converts a mid-year date", () => {
    expect(toJalali(new Date(2026, 7, 7))).toBe("1405/05/16");
  });

  it("lands on the last day of the year", () => {
    expect(toJalali(new Date(2026, 2, 20))).toBe("1404/12/29");
  });

  it("agrees with jalaliDayNumber — one Gregorian day is one Jalali day", () => {
    let prev = jalaliDayNumber(toJalali(new Date(2026, 0, 1)))!;
    for (let i = 1; i < 800; i++) {
      const d = new Date(2026, 0, 1 + i);
      const n = jalaliDayNumber(toJalali(d))!;
      expect(n - prev).toBe(1);
      prev = n;
    }
  });
});
