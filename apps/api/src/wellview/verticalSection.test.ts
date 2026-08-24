/**
 * Vertical section on the wellbores that never had one.
 *
 * `computeSurvey` returned null for VS whenever the wellbore carried no
 * vertical-section direction, and only 3 of the sample's 41 surveyed wellbores
 * carry one. Peloton's own help says what to do instead, and says it precisely:
 * "If you do not enter the Vertical Section Direction, WellView calculates a
 * Closure Direction… the azimuth that describes a straight line between the
 * starting point of the wellbore and the end point of the wellbore."
 *
 * The rules and refusals are unit-tested in packages/shared. What is tested
 * here is the only thing a synthetic case cannot show: how the reconstruction
 * behaves on the real surveys, and how close it lands on the three wellbores
 * where a human wrote the answer down.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { computeSurvey, closureOf, type SurveyStation } from "@dd/shared";

const HERE = dirname(fileURLToPath(import.meta.url));
const SAMPLE = join(HERE, "..", "..", "..", "..", "sqlite_DB", "wellview", "wv9.0_Sample.sqlite");
const d = describe.skipIf(!existsSync(SAMPLE));

let db: DatabaseSync;
beforeAll(() => { db = new DatabaseSync(SAMPLE, { readOnly: true }); });
afterAll(() => { db?.close(); });

const stationsOf = (survey: string): SurveyStation[] =>
  (db.prepare(`SELECT MD, Inclination, Azimuth, DontUse FROM wvWellboreDirSurveyData
     WHERE IDRecParent = ? ORDER BY MD`).all(survey) as
    { MD: number; Inclination: number; Azimuth: number | null; DontUse: number | null }[])
    .map((r) => ({
      md: r.MD,
      inclination: r.Inclination,
      azimuth: r.Azimuth as number,
      dontUse: !!r.DontUse,
    }));

const bores = () => db.prepare(`SELECT IDRec, VSDir, VSOriginNS, VSOriginEW, IDRecDirSrvyActual
  FROM wvWellbore WHERE IDRecDirSrvyActual IS NOT NULL AND IDRecDirSrvyActual <> ''`)
  .all() as { IDRec: string; VSDir: number | null; VSOriginNS: number | null;
    VSOriginEW: number | null; IDRecDirSrvyActual: string }[];

d("a wellbore with no vertical-section direction of its own", () => {
  it("is the normal case, not the exception", () => {
    const all = bores();
    expect(all.length, "wellbores with an actual survey").toBe(41);
    expect(all.filter((b) => b.VSDir != null).length, "…that state a VS direction").toBe(3);
  });

  it("lands close to the direction a human entered, where there is one", () => {
    /*
     * THE ONLY CALIBRATION AVAILABLE. Three wellbores carry both an entered
     * direction and a survey, so closure can be compared against an answer
     * somebody wrote down. It is good, not exact — and that is precisely why
     * the page says the direction was derived rather than presenting it as the
     * wellbore's own.
     */
    const gaps: number[] = [];
    for (const b of bores()) {
      if (b.VSDir == null) continue;
      const st = stationsOf(b.IDRecDirSrvyActual);
      if (st.length < 2) continue;
      const c = closureOf(computeSurvey(st, {}));
      if (!c) continue;
      const diff = Math.abs(((c.direction - b.VSDir + 540) % 360) - 180);
      gaps.push(diff);
    }
    expect(gaps.length, "wellbores with both an entered direction and a closure").toBe(3);
    gaps.sort((a, b) => a - b);
    // 0.21°, 1.27° and 29.79°. Pinned to the tenth so the claim made on the
    // page cannot drift away from what the data actually supports.
    expect(gaps[0]).toBeCloseTo(0.21, 1);
    expect(gaps[1]).toBeCloseTo(1.27, 1);
    expect(gaps[2]).toBeCloseTo(29.79, 1);
  });

  it("fills the column on the wellbores that can support it, and no others", () => {
    let gained = 0, refused = 0, entered = 0;
    for (const b of bores()) {
      const st = stationsOf(b.IDRecDirSrvyActual);
      if (!st.length) continue;
      const r = computeSurvey(st, {
        vsDirection: b.VSDir, vsOriginNs: b.VSOriginNS, vsOriginEw: b.VSOriginEW,
      });
      if (b.VSDir != null) { entered++; continue; }
      if (r.some((s) => s.vsDirectionDerived)) gained++; else refused++;
    }
    expect(entered).toBe(3);
    // A derived direction is available for most of the rest — and refused on
    // the surveys with no recorded bearing or no departure from vertical,
    // which is where an invented number would be least visible.
    expect(gained, "wellbores that gain a vertical section").toBeGreaterThan(10);
    expect(refused, "wellbores where none could be derived").toBeGreaterThan(0);
    expect(gained + refused + entered).toBeGreaterThan(25);
  }, 120_000);

  it("refuses the twenty-seven-zero-azimuth survey in this very database", () => {
    // The case that motivated the third guard: azimuth stored as 0 on every
    // station, maximum inclination 2 degrees. Real data, not a construction.
    const survey = db.prepare(`SELECT s.IDRec FROM wvWellboreDirSurvey s
      WHERE (SELECT COUNT(*) FROM wvWellboreDirSurveyData x WHERE x.IDRecParent = s.IDRec) > 20
        AND (SELECT COUNT(*) FROM wvWellboreDirSurveyData x
              WHERE x.IDRecParent = s.IDRec AND x.Azimuth <> 0) = 0
        AND (SELECT COUNT(*) FROM wvWellboreDirSurveyData x
              WHERE x.IDRecParent = s.IDRec AND x.Azimuth IS NULL) = 0
      LIMIT 1`).get() as { IDRec: string } | undefined;
    expect(survey, "the sample contains one").toBeTruthy();

    const st = stationsOf(survey!.IDRec);
    expect(st.length).toBeGreaterThan(20);
    expect(st.every((s) => s.azimuth === 0), "every azimuth stored as zero").toBe(true);
    expect(Math.max(...st.map((s) => s.inclination)), "and it barely leaves vertical")
      .toBeLessThan(5);

    const r = computeSurvey(st, {});
    expect(r.some((s) => s.azimuthAssumed), "the values are present, so nothing is flagged")
      .toBe(false);
    expect(closureOf(r), "…and yet there is no direction here").toBeNull();
    for (const s of r) expect(s.vs).toBeNull();
  });

  it("leaves an entered direction alone", () => {
    const b = bores().find((x) => x.VSDir != null)!;
    const st = stationsOf(b.IDRecDirSrvyActual);
    const r = computeSurvey(st, {
      vsDirection: b.VSDir, vsOriginNs: b.VSOriginNS, vsOriginEw: b.VSOriginEW,
    });
    expect(r.some((s) => s.vsDirectionDerived), "nothing was derived").toBe(false);
    expect(r.some((s) => s.vs != null), "and the VS is computed from what was entered").toBe(true);
  });
});
