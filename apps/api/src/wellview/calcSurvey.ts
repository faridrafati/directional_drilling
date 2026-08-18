/**
 * wvWDSVSDataCalc — "Survey Data for VS Plot", projected from the survey engine.
 *
 * The model's help: "Directional survey data points with vertical section
 * calculated using the directional and offsets of the parent wellbore. Includes
 * the tie in point and excludes unused survey points."
 *
 * That is precisely what `computeSurvey` already does, so this reads the
 * stations and re-presents the result under the calc table's field names. It is
 * deliberately NOT a SQL derivation: a second implementation of minimum
 * curvature would be a second thing to keep correct, and the first attempt at
 * one discarded inclination-only stations — legal data, per the Azimuth field's
 * own help — which blanked four wells outright.
 *
 * One well can hold several wellbores, each naming its own actual survey, so
 * the rows of every wellbore are concatenated in wellbore order.
 */
import type { DatabaseSync } from "node:sqlite";
import { computeSurvey, type SurveyStation } from "@dd/shared";
import type { CalcAnchor } from "./calc.js";

const numOf = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Case-insensitive column lookup, since the converted schemas vary in casing. */
function columns(d: DatabaseSync, table: string): Map<string, string> {
  const m = new Map<string, string>();
  for (const c of d.prepare(`PRAGMA table_info("${table}")`).all() as { name: string }[]) {
    m.set(c.name.toLowerCase(), c.name);
  }
  return m;
}

export function surveyVsRows(d: DatabaseSync, anchor: CalcAnchor): Record<string, unknown>[] {
  const bore = columns(d, "wvWellbore");
  const head = columns(d, "wvWellboreDirSurvey");
  const data = columns(d, "wvWellboreDirSurveyData");
  if (!bore.size || !head.size || !data.size) return [];

  const c = (m: Map<string, string>, k: string) => m.get(k) ?? k;
  const bores = d.prepare(
    `SELECT "${c(bore, "idrec")}" AS idrec, "${c(bore, "idrecdirsrvyactual")}" AS actual,
            "${c(bore, "vsdir")}" AS vsdir, "${c(bore, "vsoriginns")}" AS vsns,
            "${c(bore, "vsoriginew")}" AS vsew
       FROM "wvWellbore" WHERE "${c(bore, "idwell")}" = ?`,
  ).all(anchor.idwell) as Record<string, unknown>[];

  const out: Record<string, unknown>[] = [];
  for (const b of bores) {
    const survey = b.actual == null ? null : String(b.actual);
    if (!survey) continue;

    const hRow = d.prepare(`SELECT * FROM "wvWellboreDirSurvey" WHERE "${c(head, "idrec")}" = ?`)
      .get(survey) as Record<string, unknown> | undefined;
    if (!hRow) continue;

    const raw = d.prepare(`SELECT * FROM "wvWellboreDirSurveyData" WHERE "${c(data, "idrecparent")}" = ?`)
      .all(survey) as Record<string, unknown>[];
    if (!raw.length) continue;

    // Keep each row's Note and Survey Method beside its station: they are the
    // calc table's own columns and are not produced by the integration.
    const keyed = raw.map((r) => ({
      station: {
        md: numOf(r[c(data, "md")]) ?? NaN,
        inclination: numOf(r[c(data, "inclination")]) ?? NaN,
        azimuth: numOf(r[c(data, "azimuth")]) ?? NaN,
        dontUse: String(r[c(data, "dontuse")] ?? "") === "1",
        tvdOverride: numOf(r[c(data, "tvdoverride")]),
        nsOverride: numOf(r[c(data, "nsoverride")]),
        ewOverride: numOf(r[c(data, "ewoverride")]),
        dlsOverride: numOf(r[c(data, "dlsoverride")]),
        vsOverride: numOf(r[c(data, "vsoverride")]),
      } as SurveyStation,
      note: r[c(data, "note")] ?? null,
      method: r[c(data, "surveymethod")] ?? null,
    }));

    const tieIn = {
      md: numOf(hRow[c(head, "mdtiein")]),
      tvd: numOf(hRow[c(head, "tvdtiein")]),
      ns: numOf(hRow[c(head, "nstiein")]),
      ew: numOf(hRow[c(head, "ewtiein")]),
      inclination: numOf(hRow[c(head, "inclinationtiein")]),
      azimuth: numOf(hRow[c(head, "azimuthtiein")]),
    };
    const vsDirection = numOf(b.vsdir);
    const vsOriginNs = numOf(b.vsns);
    const vsOriginEw = numOf(b.vsew);

    // "Includes the tie in point": it is a row of the plot, not just the seed.
    if (tieIn.md != null) {
      const dn = (tieIn.ns ?? 0) - (vsOriginNs ?? 0);
      const de = (tieIn.ew ?? 0) - (vsOriginEw ?? 0);
      const rad = Math.PI / 180;
      out.push({
        MD: tieIn.md,
        Inclination: tieIn.inclination,
        Azimuth: tieIn.azimuth,
        TVD: tieIn.tvd ?? tieIn.md,
        NS: tieIn.ns ?? 0,
        EW: tieIn.ew ?? 0,
        VS: vsDirection == null ? null
          : dn * Math.cos(vsDirection * rad) + de * Math.sin(vsDirection * rad),
        DLS: null,
        Note: "Tie-in",
        SurveyMethod: null,
        AzimuthAssumed: tieIn.azimuth == null ? 1 : 0,
      });
    }

    const results = computeSurvey(keyed.map((k) => k.station), { tieIn, vsDirection, vsOriginNs, vsOriginEw });
    // computeSurvey drops unusable stations and sorts by depth, so match each
    // result back to its row by measured depth rather than by position.
    const byMd = new Map<number, { note: unknown; method: unknown }>();
    for (const k of keyed) byMd.set(k.station.md, { note: k.note, method: k.method });
    for (const r of results) {
      const extra = byMd.get(r.md);
      out.push({
        MD: r.md,
        Inclination: r.inclination,
        Azimuth: r.azimuth,
        TVD: r.tvd,
        NS: r.ns,
        EW: r.ew,
        VS: r.vs,
        DLS: r.dls,
        // A station with no recorded bearing gets one carried forward, so its
        // NS/EW are a direction nobody surveyed. Note is this table's own
        // column and is where a reader of the plot would look, so it says so —
        // but only where the station has no note of its own to overwrite.
        Note: extra?.note ?? (r.azimuthAssumed ? "Azimuth assumed" : null),
        SurveyMethod: extra?.method ?? null,
        AzimuthAssumed: r.azimuthAssumed ? 1 : 0,
      });
    }
  }
  return out;
}
