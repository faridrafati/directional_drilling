import { describe, expect, it } from "vitest";
import {
  surPress, btmTemp, ff, eave, tfa, anp0, dpp0, blp0, jtp0,
  anuPartFinder, strPartFinder, calculate,
  DRYGAS_PRESET, AERATED_MUD_PRESET,
} from "./index.js";
import type { AirMudRow } from "./index.js";

// ───────────────────────── kernel sanity (closed forms) ─────────────────────────

describe("physics primitives", () => {
  it("surPress falls off with elevation and equals 14.696 at sea level", () => {
    expect(surPress(0)).toBeCloseTo(14.696, 3);
    // 4000 ft: 14.696·(1 - 4000·2.25577/3.281/1e5)^5.25588
    const expected = 14.696 * Math.pow(1 - (4000 * 2.25577) / 3.281 / 100000, 5.25588);
    expect(surPress(4000)).toBeCloseTo(expected, 6);
    expect(surPress(4000)).toBeLessThan(surPress(0));
  });

  it("btmTemp is linear in depth", () => {
    expect(btmTemp(504, 0, 0.01)).toBe(504);
    expect(btmTemp(504, 10000, 0.01)).toBeCloseTo(604, 6);
  });

  it("eave reduces to a single roughness when one diameter is zero", () => {
    expect(eave(0.01, 8, 0.0002, 0)).toBeCloseTo(0.01, 9);
  });

  it("ff matches the Nikuradse closed form", () => {
    const d1 = 8.01 / 12, d2 = 4.5 / 12, e = 0.00015;
    const expected = (1 / (2 * Math.log10((d1 - d2) / e) + 1.14)) ** 2;
    expect(ff(d1, d2, e)).toBeCloseTo(expected, 12);
  });

  it("tfa sums π·(d/64)²/144 over the jets (1/32-inch)", () => {
    // three 22.4/32" jets
    const expected = (3 * Math.PI * (22.4 / 64) ** 2) / 144;
    expect(tfa([22.4, 22.4, 22.4])).toBeCloseTo(expected, 12);
    expect(tfa([22.4, 22.4, 22.4])).toBeCloseTo(tfa([22.4, 22.4, 22.4, 0, 0]), 12);
  });
});

// ───────────────────────── single-kernel round trips ─────────────────────────

describe("gas kernels produce physical (finite, positive) pressures", () => {
  it("anp0 raises pressure going down the annulus", () => {
    const inP = surPress(4000);
    const o = anp0(8737, inP, 504, 1, 2.7, 28.97, 4000, 7.875, 6.75, 0.01, 0.00015, 60, 0.01, 9550, 10050);
    expect(Number.isFinite(o.p)).toBe(true);
    expect(o.p).toBeGreaterThan(inP); // deeper ⇒ higher pressure
    expect(o.q).toBeGreaterThan(0);
    expect(o.v).toBeGreaterThan(0);
  });

  it("blp0 returns a pressure ≥ atmospheric", () => {
    const o = blp0(8737, 504, 1, 28.97, 4000, 100, 5.625, 30, 0.2, 2, 0.00015);
    expect(o.p).toBeGreaterThan(surPress(4000));
  });

  it("dpp0 drops pressure going up the string interior", () => {
    const o = dpp0(8737, 2000, 504, 1, 28.97, 4000, 3.82, 0.00015, 0.01, 0, 6699);
    expect(Number.isFinite(o.p)).toBe(true);
    expect(o.p).toBeGreaterThan(0);
  });

  it("jtp0 adds a finite nozzle pressure", () => {
    const o = jtp0(8737, 504, 1, 28.97, 4000, 1.4, 2000, 0.01, 10050, [22.4, 22.4, 22.4]);
    expect(Number.isFinite(o.p)).toBe(true);
    expect(o.p).toBeGreaterThan(0);
  });
});

// ───────────────────────── part-finders ─────────────────────────

describe("part-finders densify the geometry", () => {
  it("annulus splits at casing + BHA boundaries and fills DH/ODP", () => {
    const segs = anuPartFinder(DRYGAS_PRESET);
    expect(segs.length).toBeGreaterThanOrEqual(6);
    // every segment is ordered & non-empty, with positive diameters
    let prev = -1;
    for (const s of segs) {
      expect(s.dept2).toBeGreaterThan(s.dept1);
      expect(s.dept1).toBeGreaterThanOrEqual(prev - 1e-6);
      prev = s.dept1;
      expect(s.dh).toBeGreaterThan(0);
      expect(s.odp).toBeGreaterThan(0);
      expect(s.dh).toBeGreaterThan(s.odp); // hole bigger than pipe
    }
    // spans the whole well
    expect(segs[0].dept1).toBeCloseTo(0, 6);
    expect(segs[segs.length - 1].dept2).toBeCloseTo(10050, 6);
    // below the 7000-ft shoe the hole is the bit size (7.875")
    const deep = segs.find((s) => (s.dept1 + s.dept2) / 2 > 7000)!;
    expect(deep.dh).toBeCloseTo(7.875, 6);
    // shallow is cased (8.01")
    const shallow = segs.find((s) => (s.dept1 + s.dept2) / 2 < 6000)!;
    expect(shallow.dh).toBeCloseTo(8.01, 6);
  });

  it("string segments stack to the full depth, collar at the bit", () => {
    const segs = strPartFinder(DRYGAS_PRESET);
    expect(segs.length).toBe(5);
    expect(segs[0].dept2).toBeCloseTo(10050, 6); // deepest first
    expect(segs[0].dp).toBeCloseTo(2.81, 6); // drill-collar bore at the bottom
    const shallow = segs[segs.length - 1];
    expect(shallow.dept1).toBeCloseTo(0, 6);
  });
});

// ───────────────────────── full march ─────────────────────────

function checkProfile(rows: AirMudRow[]) {
  expect(rows.length).toBeGreaterThan(3);
  for (const r of rows) {
    expect(Number.isFinite(r.press)).toBe(true);
    expect(r.press).toBeGreaterThan(0);
  }
  expect(rows[0].part).toBe("SURFACE");
  expect(rows[1].part).toBe("BLOOEY");
  expect(rows.some((r) => r.part.startsWith("ANLS"))).toBe(true);
  expect(rows.some((r) => r.part === "BIT NZL")).toBe(true);
  expect(rows.some((r) => r.part.startsWith("STRG"))).toBe(true);
}

describe("calculate — DRYGAS (dry gas)", () => {
  const res = calculate(DRYGAS_PRESET);
  it("produces a sane section report", () => checkProfile(res.report));
  it("produces a densified detail profile", () => {
    expect(res.detail.length).toBeGreaterThan(res.report.length);
    for (const r of res.detail) expect(r.press).toBeGreaterThan(0);
  });
  it("pressure rises from surface to bottom-hole through the annulus", () => {
    const surf = res.report[0].press;
    const bottomHole = Math.max(...res.report.filter((r) => r.part.startsWith("ANLS")).map((r) => r.press));
    expect(bottomHole).toBeGreaterThan(surf);
  });
  it("reports a positive compressor shaft power for gas", () => {
    expect(res.shaftPowerHp).not.toBeNull();
    expect(res.shaftPowerHp!).toBeGreaterThan(0);
  });
  it("echoes K = 1.4 and a positive surface flow Q1", () => {
    expect(res.k).toBeCloseTo(1.4, 6);
    expect(res.q1).toBeGreaterThan(0);
  });
});

describe("calculate — AERATED MUD (mist)", () => {
  const res = calculate(AERATED_MUD_PRESET);
  it("produces a sane section report", () => checkProfile(res.report));
  it("converges the bisection integrals to finite pressures", () => {
    for (const r of res.report) expect(Number.isFinite(r.press)).toBe(true);
    for (const r of res.detail) expect(Number.isFinite(r.press)).toBe(true);
  });
  it("does not report shaft power (gas-only)", () => {
    expect(res.shaftPowerHp).toBeNull();
  });
  it("aerated bottom-hole pressure exceeds the dry-gas case (added mud column)", () => {
    const dry = calculate(DRYGAS_PRESET);
    const bhpMist = Math.max(...res.report.filter((r) => r.part.startsWith("ANLS")).map((r) => r.press));
    const bhpDry = Math.max(...dry.report.filter((r) => r.part.startsWith("ANLS")).map((r) => r.press));
    expect(bhpMist).toBeGreaterThan(bhpDry);
  });
});

describe("calculate — arbitrary point lookup", () => {
  it("returns an interpolated annulus point at a requested depth", () => {
    const res = calculate(DRYGAS_PRESET, { part: "ANLS", depth: 5000 }) as ReturnType<typeof calculate> & {
      arbitrary?: AirMudRow;
    };
    expect(res.arbitrary).toBeTruthy();
    expect(res.arbitrary!.depth).toBe(5000);
    expect(res.arbitrary!.press).toBeGreaterThan(0);
  });
});
