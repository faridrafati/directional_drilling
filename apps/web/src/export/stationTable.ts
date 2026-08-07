/**
 * The "calculated stations" table, shared by every PDF export.
 *
 * The column set is the Pascal Unit10.pas one (COMMENT, MD, INCL, AZM, TVD,
 * VSEC, NS, EW, DLS, TF, BR, TR, DMD) and the number formatting matches the
 * on-screen Calculated Stations table.
 *
 * Both `pdf.ts` (the stations report) and `directionalPlot.ts` (page 2 of the
 * Directional Plot report) build their table from THIS module — the row
 * builder is not duplicated, so the two exports can never disagree about a
 * column, a unit suffix or a rounding rule.
 */
import type { Content } from "pdfmake/interfaces";
import { rad2deg, dlsToDisplay, type LengthUnit, type DLSUnit } from "@dd/shared";
import type { StationRow } from "../api/client.js";

/** Normalize a compass-style degree value into [0, 360°). 360° → 0°. */
export function normDeg(deg: number): number {
  if (!Number.isFinite(deg)) return deg;
  const x = deg - 360 * Math.floor(deg / 360);
  return x >= 360 ? 0 : x;
}

/**
 * Column widths in pt, sized for a landscape-A4 body (842 pt page − 2 × 30 pt
 * margins = 782 pt). pdfmake subtracts cell padding and borders before it
 * distributes the star width, so the elastic Comment column gets appreciably
 * less than the naive remainder. These are the widths the stations PDF shipped
 * with — widening the fixed columns squeezed Comment by ~44%, which is where
 * the operator's own notes live.
 */
export const STATION_COLUMN_WIDTHS: Array<number | string> = [
  "*", 40, 40, 40, 46, 48, 46, 46, 52, 40, 52, 52, 44,
];

/**
 * Header labels. `lengthUnit` is the PROJECT's length unit — never hardcode
 * ft. Omit it and the headers come back bare (the pre-unit column names),
 * which keeps this usable for a caller that has no project context.
 *
 * DLS / BR / TR carry the project's DECLARED dls unit ("deg/100ft" | "deg/30m"),
 * not one derived from the length unit. Deriving it printed "°/100m" for a
 * metric project whose severity is actually stated per 30 m — a different
 * number by a factor of 3.3, presented as if it were the project's own.
 */
export function stationTableHeaders(lengthUnit?: string, dlsUnit?: string): string[] {
  const u = lengthUnit?.trim() ?? "";
  const len = (name: string) => (u ? `${name} (${u})` : name);
  // "deg/30m" -> "°/30m"; fall back to the bare symbol when the project did not
  // declare one, rather than inventing a per-length suffix.
  const per100 = dlsUnit ? `°/${dlsUnit.replace(/^deg\//, "")}` : (u ? `°/100${u}` : "°/100");
  return [
    "Comment",
    len("MD"),
    "Incl (°)",
    "Azm (°)",
    len("TVD"),
    len("VSEC"),
    len("NS"),
    len("EW"),
    `DLS (${per100})`,
    "TF (°)",
    `BR (${per100})`,
    `TR (${per100})`,
    len("DMD"),
  ];
}

/**
 * One station → its 13 formatted cells. Angles arrive from the solver in
 * radians; DLS / BR / TR are per-unit-length rates scaled to "per 100".
 */
/**
 * DLS / BR / TR in the project's DECLARED severity window.
 *
 * Falls back to the historical per-100-length-units behaviour when the project
 * declares no dls unit, so an unconfigured project keeps the numbers it had.
 */
function toSeverity(radPerUnit: number, lengthUnit?: string, dlsUnit?: string): number {
  if (dlsUnit === "deg/100ft" || dlsUnit === "deg/30m") {
    return dlsToDisplay(radPerUnit, (lengthUnit || "ft") as LengthUnit, dlsUnit as DLSUnit);
  }
  return rad2deg(radPerUnit) * 100;
}

export function stationTableRow(s: StationRow, lengthUnit?: string, dlsUnit?: string): string[] {
  return [
    s.comment ?? "",
    s.md.toFixed(1),
    rad2deg(s.inc).toFixed(2),
    normDeg(rad2deg(s.azm)).toFixed(2),
    s.tvd.toFixed(1),
    s.vsec.toFixed(1),
    s.ns.toFixed(1),
    s.ew.toFixed(1),
    // DLS / BR / TR are severities: radians per unit length in storage. They must
    // be converted with the SAME window the header names, or the label and the
    // number disagree — a metric project reading "°/30m" over a per-100-m value
    // is 3.3x wrong and looks entirely plausible.
    Math.abs(toSeverity(s.dls, lengthUnit, dlsUnit)).toFixed(3),
    normDeg(rad2deg(s.tf)).toFixed(2),
    toSeverity(s.br, lengthUnit, dlsUnit).toFixed(3),
    toSeverity(s.tr, lengthUnit, dlsUnit).toFixed(3),
    s.dmd.toFixed(1),
  ];
}

/**
 * The complete pdfmake node: banded, header-repeating stations table.
 * `headerRows: 1` makes pdfmake repeat the header on every page it spills to.
 */
export function stationTableContent(
  stations: readonly StationRow[],
  lengthUnit?: string,
  dlsUnit?: string,
): Content {
  return {
    table: {
      headerRows: 1,
      widths: STATION_COLUMN_WIDTHS,
      body: [
        stationTableHeaders(lengthUnit, dlsUnit).map((h) => ({ text: h, style: "tableHeader" })),
        ...stations.map((s) => stationTableRow(s, lengthUnit, dlsUnit)),
      ],
    },
    layout: {
      fillColor: (rowIndex: number): string | null =>
        rowIndex === 0 ? "#e0e7ff" : rowIndex % 2 === 0 ? "#f8fafc" : null,
      hLineColor: () => "#e5e7eb",
      vLineColor: () => "#e5e7eb",
    },
    fontSize: 8,
  };
}

/**
 * The pdfmake `styles` entry `stationTableContent` depends on. Spread it into
 * any document definition that renders the table so the header row picks up
 * its colour and weight.
 */
export const STATION_TABLE_STYLES = {
  tableHeader: { bold: true, color: "#1e3a8a", fontSize: 8 },
} as const;
