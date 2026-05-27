/**
 * Fixture-based regression suite: load every `*.input.json` in
 * `fixtures/`, run `dispatch()` over the segments, and verify the produced
 * stations match the matching `*.expected.json` within ±1e-6.
 *
 * Starts empty by design — see fixtures/README.md for how to capture pairs
 * from the original MIXED.exe.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { dispatch } from "../src/math/index.js";
import type { Segment, Station } from "../src/types.js";

interface FixtureInput {
  name?: string;
  /** Per-segment azimuth-branch picks (segmentOrder → 1 | 2). */
  azimuthChoices?: Record<number, 1 | 2>;
  segments: Segment[];
}

interface FixtureExpected {
  stations: Partial<Station>[];
}

const FIXTURES_DIR = resolve(__dirname, "fixtures");
const TOLERANCE = 1e-6;

const inputs: Array<{ name: string; input: FixtureInput; expected: FixtureExpected }> = (() => {
  if (!existsSync(FIXTURES_DIR)) return [];
  const out: Array<{ name: string; input: FixtureInput; expected: FixtureExpected }> = [];
  for (const f of readdirSync(FIXTURES_DIR)) {
    if (!f.endsWith(".input.json")) continue;
    const base = f.slice(0, -".input.json".length);
    const expectedPath = join(FIXTURES_DIR, `${base}.expected.json`);
    if (!existsSync(expectedPath)) {
      // eslint-disable-next-line no-console
      console.warn(`Fixture ${base}: missing ${base}.expected.json — skipping`);
      continue;
    }
    out.push({
      name: base,
      input: JSON.parse(readFileSync(join(FIXTURES_DIR, f), "utf-8")),
      expected: JSON.parse(readFileSync(expectedPath, "utf-8")),
    });
  }
  return out;
})();

describe("MIXED.exe fixture regression", () => {
  if (inputs.length === 0) {
    it.skip("(no fixtures yet — see test/fixtures/README.md)", () => {});
    return;
  }
  for (const { name, input, expected } of inputs) {
    it(`matches ${name}`, () => {
      const result = dispatch(input.segments, {
        azimuthChoices: input.azimuthChoices ?? {},
      });
      expect(result.ok).toBe(true);
      expect(result.stations.length).toBe(expected.stations.length);
      for (let i = 0; i < expected.stations.length; i++) {
        const got = result.stations[i];
        const want = expected.stations[i];
        // Only compare keys present in the expected fixture; that lets a
        // fixture be terse (e.g. just check md/tvd/inc).
        for (const k of Object.keys(want) as Array<keyof Station>) {
          const w = want[k];
          if (typeof w !== "number") continue;
          const g = got[k];
          expect(
            typeof g === "number" && Math.abs(g - w) <= TOLERANCE,
            `station[${i}].${k}: expected ${w}, got ${g}`
          ).toBe(true);
        }
      }
    });
  }
});
