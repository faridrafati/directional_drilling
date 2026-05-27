/**
 * Excel export for a calculation.
 *
 * Port of old_delphi_code/Unit10.pas SaveAsExcelFile — one sheet of stations
 * with the same 13 columns as the original (COMMENT, MD, INCL, AZM, TVD,
 * VSEC, NS, EW, DLS, TF, BR, TR, DMD).
 *
 * Uses SheetJS (xlsx) instead of OLE Automation; produces .xlsx, not .xls.
 */
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { rad2deg } from "@dd/shared";
import type { CalculationDetail } from "../api/client.js";

/** Normalize compass-style degree value into [0, 360°). 360° → 0°. */
function normDeg(deg: number): number {
  if (!Number.isFinite(deg)) return deg;
  const x = deg - 360 * Math.floor(deg / 360);
  return x >= 360 ? 0 : x;
}

export function exportCalculationXlsx(calc: CalculationDetail, wellName: string): void {
  const header = ["COMMENT", "MD", "INCL", "AZM", "TVD", "VSEC", "NS", "EW", "DLS", "TF", "BR", "TR", "DMD"];
  const rows = calc.stations.map((s) => [
    s.comment ?? "",
    s.md,
    rad2deg(s.inc),
    normDeg(rad2deg(s.azm)),
    s.tvd,
    s.vsec,
    s.ns,
    s.ew,
    Math.abs(rad2deg(s.dls)) * 100,
    normDeg(rad2deg(s.tf)),
    rad2deg(s.br) * 100,
    rad2deg(s.tr) * 100,
    s.dmd,
  ]);

  const aoa = [header, ...rows];
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  // Set column widths roughly matching the Pascal output (~13 chars each).
  sheet["!cols"] = header.map((_h, i) => ({ wch: i === 0 ? 24 : 12 }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, calc.name.slice(0, 31));

  const wbout = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbout], { type: "application/octet-stream" });
  const filename = `${wellName.replace(/\W+/g, "_")}_${calc.name.replace(/\W+/g, "_")}.xlsx`;
  saveAs(blob, filename);
}
