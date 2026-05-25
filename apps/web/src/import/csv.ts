/**
 * Parse the legacy MIXED.exe table dumps as CSVs and convert them into the
 * shape accepted by `POST /projects/:id/import`.
 *
 * Expected files (column names match the Pascal CREATE TABLE statements in
 * old_delphi_code/Unit01.pas:ADDTABLE):
 *
 *   countries.csv     Country, Area
 *   fields.csv        Country, Field, NS, EW, MSL
 *   wells.csv         Country, Field, Well, NS, EW, MSL, WellType, TVD, MD, Comment
 *   calculations.csv  Country, Field, Well, Calc, Type           (Type = WD or SE)
 *   segments.csv      Country, Field, Well, Calc, Order, ProfileType, Comment,
 *                     MD, INCL, AZM, TVD, VSEC, NS, EW, DLS, TF, BR, TR, DMD
 *
 * The MIXED tables stored angles in degrees and DLS in deg/100ft. We convert
 * to radians-per-unit on the way in, matching the storage convention used
 * everywhere else in this codebase.
 */
import Papa from "papaparse";
import { deg2rad } from "@dd/shared";

export interface ImportPayload {
  countries: Array<{
    name: string;
    area?: string | null;
    fields?: Array<{
      name: string;
      ns?: number | null; ew?: number | null; msl?: number | null;
      wells?: Array<{
        name: string;
        ns?: number | null; ew?: number | null; msl?: number | null;
        wellType?: string | null; tvd?: number | null; md?: number | null;
        comment?: string | null;
        calculations?: Array<{
          name: string;
          type: "WellDesign" | "SurveyEditor";
          segments?: Array<{
            order: number; profileType: number; comment?: string | null;
            md: number; inc: number; azm: number; tvd: number; vsec: number;
            ns: number; ew: number; dls: number; tf: number; br: number; tr: number; dmd: number;
            surveyTools?: string | null;
          }>;
        }>;
      }>;
    }>;
  }>;
}

interface CsvBundle {
  countries: File;
  fields?: File;
  wells?: File;
  calculations?: File;
  segments?: File;
}

export async function parseCsvBundle(b: CsvBundle): Promise<ImportPayload> {
  const countries = await readCsv(b.countries);
  const fields = b.fields ? await readCsv(b.fields) : [];
  const wells = b.wells ? await readCsv(b.wells) : [];
  const calcs = b.calculations ? await readCsv(b.calculations) : [];
  const segments = b.segments ? await readCsv(b.segments) : [];

  // Group by the lookup keys the Pascal app uses.
  const fieldsByCountry = groupBy(fields, (r) => keyOf(r.Country));
  const wellsByField = groupBy(wells, (r) => keyOf(r.Country, r.Field));
  const calcsByWell = groupBy(calcs, (r) => keyOf(r.Country, r.Field, r.Well));
  const segmentsByCalc = groupBy(segments, (r) =>
    keyOf(r.Country, r.Field, r.Well, r.Calc)
  );

  return {
    countries: countries.map((cr) => ({
      name: String(cr.Country),
      area: cr.Area ?? null,
      fields: (fieldsByCountry.get(keyOf(cr.Country)) ?? []).map((fr) => ({
        name: String(fr.Field),
        ns: num(fr.NS), ew: num(fr.EW), msl: num(fr.MSL),
        wells: (wellsByField.get(keyOf(cr.Country, fr.Field)) ?? []).map((wr) => ({
          name: String(wr.Well),
          ns: num(wr.NS), ew: num(wr.EW), msl: num(wr.MSL),
          wellType: wr.WellType ?? null,
          tvd: num(wr.TVD), md: num(wr.MD),
          comment: wr.Comment ?? null,
          calculations: (calcsByWell.get(keyOf(cr.Country, fr.Field, wr.Well)) ?? []).map((cc) => ({
            name: String(cc.Calc),
            type: normalizeCalcType(cc.Type),
            segments: (segmentsByCalc.get(keyOf(cr.Country, fr.Field, wr.Well, cc.Calc)) ?? []).map((sr, i) => ({
              order: numOrDefault(sr.Order, i),
              profileType: numOrDefault(sr.ProfileType, 0),
              comment: sr.Comment ?? null,
              md: numOrZero(sr.MD),
              inc: deg2rad(numOrZero(sr.INCL)),
              azm: deg2rad(numOrZero(sr.AZM)),
              tvd: numOrZero(sr.TVD),
              vsec: numOrZero(sr.VSEC),
              ns: numOrZero(sr.NS),
              ew: numOrZero(sr.EW),
              // DLS in MIXED.exe: deg / 100 (length-unit). Convert to rad / unit.
              dls: deg2rad(numOrZero(sr.DLS)) / 100,
              tf: deg2rad(numOrZero(sr.TF)),
              br: deg2rad(numOrZero(sr.BR)) / 100,
              tr: deg2rad(numOrZero(sr.TR)) / 100,
              dmd: numOrZero(sr.DMD),
              surveyTools: sr.SurveyTools ?? null,
            })),
          })),
        })),
      })),
    })),
  };
}

function readCsv(file: File): Promise<Record<string, string>[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      complete: (r) => resolve(r.data),
      error: reject,
    });
  });
}

function keyOf(...parts: unknown[]): string {
  return parts.map((p) => String(p ?? "").trim().toUpperCase()).join("|");
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const it of items) {
    const k = key(it);
    const arr = m.get(k);
    if (arr) arr.push(it);
    else m.set(k, [it]);
  }
  return m;
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}
function numOrZero(v: unknown): number {
  return num(v) ?? 0;
}
function numOrDefault(v: unknown, def: number): number {
  return num(v) ?? def;
}

function normalizeCalcType(t: unknown): "WellDesign" | "SurveyEditor" {
  const s = String(t ?? "").trim().toUpperCase();
  if (s === "SE" || s === "SURVEY" || s.includes("SURVEY")) return "SurveyEditor";
  return "WellDesign";
}
