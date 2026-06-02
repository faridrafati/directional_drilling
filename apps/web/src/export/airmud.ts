/**
 * Export helpers for the Air & Gas Drilling view:
 *   - CSV   : the section report + densified detail profile (one download)
 *   - PDF   : a run report — input parameters + derived header + section table
 *             + detail profile (pdfmake, portrait A4)
 *   - Excel : a workbook with Parameters / Section report / Detail sheets
 *
 * Heavy libraries (pdfmake / xlsx / file-saver) are imported lazily so they
 * only load when the user actually exports, keeping the page chunk small.
 * Everything is emitted in the caller's selected unit system (`sel`); the
 * stored values are USA base units and converted here via airmudUnits.
 */
import type { TDocumentDefinitions, Content } from "pdfmake/interfaces";
import type { AirMudInput, AirMudResult, AirMudRow } from "@dd/shared/air-mud";
import {
  type UnitSel, systemLabel, unitName, disp, dispCol, colUnit,
  dispGeotherm, geothermUnit, sig, GAS_FLOW_BASE,
} from "../units/airmudUnits.js";

const COLS: { key: keyof AirMudRow; label: string; dp: number }[] = [
  { key: "part", label: "Section", dp: -1 },
  { key: "depth", label: "Depth", dp: 1 },
  { key: "press", label: "Press", dp: 2 },
  { key: "delP", label: "ΔP", dp: 2 },
  { key: "gfrate", label: "Gas rate", dp: 0 },
  { key: "velo", label: "Velocity", dp: 2 },
  { key: "gasDen", label: "Density", dp: 3 },
  { key: "keDen", label: "KE term", dp: 4 },
];

const num = (v: number, dp: number): string =>
  Number.isFinite(v) ? v.toFixed(dp) : "—";

/** Column header including the active unit, e.g. "Press (psi)". */
function colLabel(c: { key: keyof AirMudRow; label: string }, sel: UnitSel): string {
  const u = colUnit(c.key, sel);
  return u ? `${c.label} (${u})` : c.label;
}

/** A row as display strings in the selected units (Section stays text). */
function cells(r: AirMudRow, sel: UnitSel): string[] {
  return COLS.map((c) =>
    c.dp < 0 ? String(r[c.key]) : num(dispCol(c.key, sel, Number(r[c.key])), c.dp),
  );
}

/** Ordered [label, value] parameter pairs (converted to `sel`) shared by PDF + Excel + CSV. */
function paramPairs(input: AirMudInput, res: AirMudResult, sel: UnitSel): [string, string][] {
  const L = unitName("length", sel);
  const P = unitName("pressure", sel);
  const F = unitName("flow", sel);
  return [
    ["Unit system", systemLabel(sel)],
    ["Fluid model", input.calcType === "gas" ? "Dry gas" : "Aerated mud (mist)"],
    [`Surface gas rate (${F})`, num(disp("flow", sel, input.surfFlow, GAS_FLOW_BASE), 3)],
    [`Surface temp (${unitName("temp", sel)})`, num(disp("temp", sel, input.surfTemp), 3)],
    ["Gas sp. gravity", String(input.gasSg)],
    ["Gas mol. weight", String(input.moleWt)],
    ["Ratio sp. heats K", String(input.heatC)],
    ["Cuttings sp. gravity", String(input.solidSg)],
    [`ROP (${L}/hr)`, num(disp("length", sel, input.rop), 3)],
    [`Drilling depth (${L})`, num(disp("length", sel, input.tvdOut), 3)],
    [`Surface elevation (${L})`, num(disp("length", sel, input.elevation), 3)],
    [`Geothermal grad. (${geothermUnit(sel)})`, num(dispGeotherm(sel, input.geotherm), 5)],
    [`Bit diameter (${unitName("diameter", sel)})`, num(disp("diameter", sel, input.bitSize), 4)],
    [`Open-hole roughness (${L})`, num(disp("length", sel, input.ohRough), 6)],
    [`Pipe/casing roughness (${L})`, num(disp("length", sel, input.dpRough), 6)],
    [`Mud rate (${F})`, num(disp("flow", sel, input.mudFlow), 3)],
    [`Mud weight (${unitName("density", sel)})`, num(disp("density", sel, input.mudWt), 3)],
    ["Plastic viscosity (PV)", String(input.mudVis)],
    [`Nozzles (${unitName("nozzle", sel)})`, input.nozzles.map((n) => String(sig(disp("nozzle", sel, n)))).join(", ")],
    ["— derived —", ""],
    [`Surface pressure P1 (${P})`, num(disp("pressure", sel, res.p1), 3)],
    [`Injection pressure P2 (${P})`, num(disp("pressure", sel, res.p2), 3)],
    [`Surface gas Q1 (${F})`, num(disp("flow", sel, res.q1, GAS_FLOW_BASE), 1)],
    ["K (echoed)", num(res.k, 3)],
    ["Compressor shaft power (HP)", res.shaftPowerHp == null ? "n/a (gas only)" : num(res.shaftPowerHp, 2)],
  ];
}

/** Base filename stem for downloads. */
function baseName(input: AirMudInput): string {
  return `air-gas_${input.calcType}_${Math.round(input.tvdOut)}ft`;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ── CSV ───────────────────────────────────────────────────────────────────--

const csvCell = (s: string): string => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

/** Section report + detail profile, parameters header, as a single CSV file. */
export function exportAirMudCsv(input: AirMudInput, res: AirMudResult, sel: UnitSel): void {
  const lines: string[] = [];
  lines.push("Air & Gas Drilling report");
  lines.push("");
  lines.push("Parameter,Value");
  for (const [k, v] of paramPairs(input, res, sel)) lines.push(`${csvCell(k)},${csvCell(v)}`);
  const header = COLS.map((c) => csvCell(colLabel(c, sel))).join(",");
  for (const [title, rows] of [["Section report", res.report], ["Detail profile", res.detail]] as const) {
    lines.push("");
    lines.push(title);
    lines.push(header);
    for (const r of rows) lines.push(cells(r, sel).map(csvCell).join(","));
  }
  downloadBlob(new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8" }), `${baseName(input)}.csv`);
}

// ── PDF ───────────────────────────────────────────────────────────────────--

/** Build a portrait-A4 run report and download it. */
export async function exportAirMudPdf(input: AirMudInput, res: AirMudResult, sel: UnitSel): Promise<void> {
  const [{ default: pdfMake }, fonts] = await Promise.all([
    import("pdfmake/build/pdfmake.js"),
    import("pdfmake/build/vfs_fonts.js"),
  ]);
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const f = fonts as any;
  (pdfMake as any).vfs =
    f.vfs ?? f.default?.vfs ?? f.default?.pdfMake?.vfs ?? f.pdfMake?.vfs ?? f.default ?? f;
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const tableHeader = COLS.map((c) => ({ text: colLabel(c, sel), style: "tableHeader" }));
  const toBody = (rows: AirMudRow[]) => [tableHeader, ...rows.map((r) => cells(r, sel))];
  const tableLayout = {
    fillColor: (rowIndex: number) => (rowIndex === 0 ? "#dbeafe" : rowIndex % 2 === 0 ? "#f8fafc" : null),
    hLineColor: () => "#e5e7eb",
    vLineColor: () => "#e5e7eb",
  };
  const widths = ["auto", "auto", "auto", "auto", "auto", "auto", "auto", "*"];

  const doc: TDocumentDefinitions = {
    pageOrientation: "portrait",
    pageSize: "A4",
    pageMargins: [28, 54, 28, 36],
    header: () => ({
      text: "Air & Gas Drilling — underbalanced hydraulics",
      style: "title", alignment: "center", margin: [0, 18, 0, 0],
    }),
    footer: (cur: number, count: number) => ({
      columns: [
        { text: `Generated ${new Date().toLocaleString()}`, alignment: "left", margin: [28, 8, 0, 0], fontSize: 8, color: "#94a3b8" },
        { text: `Page ${cur} of ${count}`, alignment: "right", margin: [0, 8, 28, 0], fontSize: 8, color: "#94a3b8" },
      ],
    }),
    content: [
      { text: "Run parameters", style: "subheader", margin: [0, 0, 0, 4] },
      {
        table: { widths: ["auto", "*", "auto", "*"], body: paramTwoColumn(paramPairs(input, res, sel)) },
        layout: "noBorders", fontSize: 9, margin: [0, 0, 0, 12],
      },
      { text: "Section report", style: "subheader", margin: [0, 0, 0, 4] },
      { table: { headerRows: 1, widths, body: toBody(res.report) }, layout: tableLayout, fontSize: 8, margin: [0, 0, 0, 12] },
      { text: "Detail profile", style: "subheader", margin: [0, 0, 0, 4], pageBreak: "before" },
      { table: { headerRows: 1, widths, body: toBody(res.detail) }, layout: tableLayout, fontSize: 7 },
    ],
    styles: {
      title: { fontSize: 14, bold: true, color: "#1e3a8a" },
      subheader: { fontSize: 12, bold: true, color: "#1f2937" },
      tableHeader: { bold: true, color: "#1e3a8a", fontSize: 8 },
    },
    defaultStyle: { font: "Roboto" },
  };

  pdfMake.createPdf(doc).download(`${baseName(input)}.pdf`);
}

function paramTwoColumn(pairs: [string, string][]): Content[][] {
  const body: Content[][] = [];
  for (let i = 0; i < pairs.length; i += 2) {
    const [k1, v1] = pairs[i];
    const second = pairs[i + 1];
    body.push([
      { text: k1, bold: true, color: "#475569" }, { text: v1 },
      second ? { text: second[0], bold: true, color: "#475569" } : { text: "" },
      second ? { text: second[1] } : { text: "" },
    ]);
  }
  return body;
}

// ── Excel ───────────────────────────────────────────────────────────────---

/** Workbook: Parameters + Section report + Detail profile sheets. */
export async function exportAirMudXlsx(input: AirMudInput, res: AirMudResult, sel: UnitSel): Promise<void> {
  const [xlsxMod, fsMod] = await Promise.all([import("xlsx"), import("file-saver")]);
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const XLSX: typeof import("xlsx") = (xlsxMod as any).utils ? xlsxMod : (xlsxMod as any).default;
  const saveAs: (data: Blob, filename: string) => void =
    (fsMod as any).saveAs ?? (fsMod as any).default?.saveAs ?? (fsMod as any).default;
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const wb = XLSX.utils.book_new();

  const paramSheet = XLSX.utils.aoa_to_sheet([["Parameter", "Value"], ...paramPairs(input, res, sel)]);
  paramSheet["!cols"] = [{ wch: 30 }, { wch: 24 }];
  XLSX.utils.book_append_sheet(wb, paramSheet, "Parameters");

  const header = COLS.map((c) => colLabel(c, sel));
  const aoa = (rows: AirMudRow[]) => [
    header,
    ...rows.map((r) => COLS.map((c) => (c.dp < 0 ? String(r[c.key]) : dispCol(c.key, sel, Number(r[c.key]))))),
  ];
  for (const [name, rows] of [["Section report", res.report], ["Detail profile", res.detail]] as const) {
    const sheet = XLSX.utils.aoa_to_sheet(aoa(rows));
    sheet["!cols"] = header.map((_h, i) => ({ wch: i === 0 ? 12 : 13 }));
    XLSX.utils.book_append_sheet(wb, sheet, name);
  }

  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  saveAs(new Blob([out], { type: "application/octet-stream" }), `${baseName(input)}.xlsx`);
}
