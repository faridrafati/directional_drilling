/**
 * wvWellboreSummaryCalc — "Wellbore Section Summary".
 *
 * The model states the rule outright: "This table is populated from
 * <wvJobDrillStringDrillParam> if there are no <wvWellboreSize> records, else
 * the source is <wvWellboreSize> table." That choice is made PER WELLBORE.
 *
 * Two things this gets right that a first attempt did not.
 *
 * OWNERSHIP. A drill-param row carries IDRecWellbore, and in the sample
 * database ten of them name a wellbore belonging to a DIFFERENT well. Deciding
 * the fallback by "does the queried well have size rows for that wellbore"
 * rather than "does that wellbore belong to the queried well" let those rows
 * through, and they were the only rows the fallback ever emitted. Here the
 * wellbore is resolved from wvWellbore scoped to the well, so a foreign
 * IDRecWellbore simply does not match.
 *
 * EXTRAPOLATION IS NOT INTERPOLATION. The TVD columns come from the wellbore's
 * actual survey. A section top or bottom that lies outside the surveyed
 * interval cannot be interpolated, and guessing it — TVD := MD above the first
 * station, or a held-attitude tangent below the last — produces a number that
 * looks measured. Those are left null instead.
 */
import type { DatabaseSync } from "node:sqlite";
import { computeSurvey, type SurveyStation } from "@dd/shared";
import type { CalcAnchor } from "./calc.js";

const numOf = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

function has(d: DatabaseSync, table: string): boolean {
  return (d.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE type='table' AND lower(name)=?")
    .get(table.toLowerCase()) as { n: number }).n > 0;
}

/** MD → TVD along a survey, by linear interpolation between stations only. */
function tvdAt(path: { md: number; tvd: number }[], md: number | null): number | null {
  if (md == null || path.length < 2) return null;
  if (md < path[0].md || md > path[path.length - 1].md) return null;   // outside: not knowable
  for (let i = 1; i < path.length; i++) {
    if (md <= path[i].md) {
      const a = path[i - 1], b = path[i];
      const span = b.md - a.md;
      if (span <= 0) return b.tvd;
      return a.tvd + ((md - a.md) / span) * (b.tvd - a.tvd);
    }
  }
  return null;
}

export function wellboreSummaryRows(d: DatabaseSync, anchor: CalcAnchor): Record<string, unknown>[] {
  if (!has(d, "wvWellbore") || !has(d, "wvWellboreSize")) return [];
  const hasParam = has(d, "wvJobDrillStringDrillParam");
  const hasMud = has(d, "wvJobReportMudChk");

  const bores = d.prepare(
    `SELECT IDRec, IDRecDirSrvyActual FROM wvWellbore WHERE idwell = ?`,
  ).all(anchor.idwell) as { IDRec: string; IDRecDirSrvyActual: string | null }[];

  const out: Record<string, unknown>[] = [];
  for (const b of bores) {
    // The wellbore's surveyed path, for the TVD columns.
    let path: { md: number; tvd: number }[] = [];
    if (b.IDRecDirSrvyActual) {
      const raw = d.prepare(
        `SELECT MD, Inclination, Azimuth, DontUse, TVDOverride, NSOverride, EWOverride,
                DLSOverride, VSOverride
           FROM wvWellboreDirSurveyData WHERE IDRecParent = ?`).all(b.IDRecDirSrvyActual) as Record<string, unknown>[];
      const stations: SurveyStation[] = raw.map((r) => ({
        md: numOf(r.MD) ?? NaN,
        inclination: numOf(r.Inclination) ?? NaN,
        azimuth: numOf(r.Azimuth) ?? NaN,
        dontUse: String(r.DontUse ?? "") === "1",
        tvdOverride: numOf(r.TVDOverride),
        nsOverride: numOf(r.NSOverride),
        ewOverride: numOf(r.EWOverride),
        dlsOverride: numOf(r.DLSOverride),
        vsOverride: numOf(r.VSOverride),
      }));
      path = computeSurvey(stations, {}).map((s) => ({ md: s.md, tvd: s.tvd }));
    }

    const sizes = d.prepare(
      `SELECT Des, Sz, DepthTopActual, DepthBtmActual, DtTmStart, DtTmEnd
         FROM wvWellboreSize WHERE IDRecParent = ? ORDER BY DepthTopActual`).all(b.IDRec) as Record<string, unknown>[];

    type Section = {
      Des: unknown; Sz: unknown; top: number | null; btm: number | null;
      start: unknown; end: unknown; drillString: unknown;
    };
    let sections: Section[];
    if (sizes.length) {
      sections = sizes.map((r) => ({
        Des: r.Des ?? null, Sz: r.Sz ?? null,
        top: numOf(r.DepthTopActual), btm: numOf(r.DepthBtmActual),
        start: r.DtTmStart ?? null, end: r.DtTmEnd ?? null, drillString: null,
      }));
    } else if (hasParam) {
      // The model's fallback. Scoped through wvWellbore, so a drill-param row
      // naming another well's wellbore cannot appear here.
      const params = d.prepare(
        `SELECT DepthStart, DepthEnd, DtTmStart, DtTmEnd, IDRecParent
           FROM wvJobDrillStringDrillParam
          WHERE IDRecWellbore = ? AND idwell = ? ORDER BY DepthStart`).all(b.IDRec, anchor.idwell) as Record<string, unknown>[];
      sections = params.map((r) => ({
        Des: null, Sz: null,
        top: numOf(r.DepthStart), btm: numOf(r.DepthEnd),
        start: r.DtTmStart ?? null, end: r.DtTmEnd ?? null, drillString: r.IDRecParent ?? null,
      }));
    } else sections = [];

    for (const s of sections) {
      let mud: number | null = null;
      if (hasMud && s.top != null && s.btm != null) {
        const m = d.prepare(
          `SELECT MAX(Density) AS m FROM wvJobReportMudChk
            WHERE IDRecWellbore = ? AND idwell = ? AND COALESCE(DontUse,0) <> 1
              AND Depth >= ? AND Depth <= ?`).get(b.IDRec, anchor.idwell, s.top, s.btm) as { m: unknown };
        mud = numOf(m?.m);
      }
      out.push({
        Des: s.Des,
        Sz: s.Sz,
        DepthTopActual: s.top,
        DepthBtmActual: s.btm,
        DepthTVDTopActual: tvdAt(path, s.top),
        DepthTVDBtmActual: tvdAt(path, s.btm),
        DtTmStart: s.start,
        DtTmEnd: s.end,
        IDRecJobDrillString: s.drillString,
        MudDensityMax: mud,
      });
    }
  }
  return out;
}
