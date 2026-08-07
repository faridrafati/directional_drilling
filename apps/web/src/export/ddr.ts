/**
 * Export a DDR daily report to PDF or Excel.
 *
 * Mirrors the report view: a well-info header (resolved A01 metadata) + the L04
 * report header + the operations narrative + every populated section table.
 * Heavy libraries (pdfmake / xlsx / file-saver) are lazy-imported so they only
 * load on demand, keeping the page chunk small. Jalali dates are kept verbatim.
 */
import type { TDocumentDefinitions, Content } from "pdfmake/interfaces";

type Row = Record<string, unknown>;
export interface DdrWellInfo extends Row { wellCode: string }
export interface SolidControlRow {
  unit: string; hrs: unknown; uf: unknown; of: unknown; feed: unknown; cons: unknown; fprs: unknown;
}
export interface SolidControl { rows: SolidControlRow[]; shakerScreen: string | null }
export interface DdrReportDetail {
  header: Row;
  bit: Row[]; mud: Row[]; directional: Row[]; casing: Row[];
  formationTops: Row[]; operations: Row[]; bha: Row[]; timeAnalysis: Row[];
  chemicals?: Row[]; solidControl?: SolidControl | null;
  drillString?: { size: unknown; grade: unknown }[];
  equipment?: { jar: EquipmentItem | null; mwd: EquipmentItem | null; dhMotor: EquipmentItem | null };
}
export interface EquipmentItem { type: unknown; size: unknown; sn: unknown; hrs: unknown }

const fmt = (v: unknown): string => {
  if (v == null || v === "") return "";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(2);
  return String(v);
};
const humanize = (k: string) => k.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/_/g, " ").trim();

type SectionKey = Exclude<keyof DdrReportDetail, "header" | "chemicals" | "solidControl" | "drillString" | "equipment">;
const SECTIONS: { key: SectionKey; title: string }[] = [
  { key: "bit", title: "Bit records" },
  { key: "mud", title: "Mud properties" },
  { key: "directional", title: "Directional surveys" },
  { key: "bha", title: "BHA" },
  { key: "casing", title: "Casing" },
  { key: "formationTops", title: "Formation tops" },
  { key: "operations", title: "Operations log" },
  { key: "timeAnalysis", title: "Time analysis" },
];

const WELL_FIELDS: [string, string][] = [
  ["field", "Field"], ["rig", "Rig"], ["contractor", "Contractor"], ["wellType", "Well type"],
  ["profile", "Profile"], ["zone", "Zone"], ["company", "Company"], ["reservoir", "Reservoir"],
  ["structure", "Structure"], ["location", "Location"], ["spudDate", "Spud date"],
  ["tdReachedDate", "TD reached"], ["rigReleasedDate", "Rig released"], ["totalDepth", "Total depth (m)"],
  ["tvd", "TVD (m)"], ["finalForecastDepth", "Final forecast (m)"], ["rtElevation", "RT elevation"],
  ["groundLevel", "Ground level"], ["waterDepth", "Water depth"], ["rigDays", "Rig days"],
];
const HEADER_FIELDS: [string, string][] = [
  ["DrillingDate", "Date (Jalali)"], ["SerialNo", "Report #"], ["FromPoint", "From (m)"],
  ["ToPoint", "To (m)"], ["MorningDepth", "Morning depth (m)"], ["TotalMeter", "Total (m)"],
  ["TotalDRHour", "Total DR hours"], ["DrillingTime", "Drilling time"], ["EngName", "Engineer"],
  ["WellSiteSupt", "Wellsite supt"], ["OPNSupt", "Opn supt"], ["ProgEng", "Program eng"],
  ["Geologist", "Geologist"], ["HoleSizeCode", "Hole size"], ["FWater", "Fresh water"], ["Fuel", "Fuel"],
];

const pairs = (obj: Row, fields: [string, string][]): [string, string][] =>
  fields.map(([k, l]) => [l, fmt(obj[k])] as [string, string]).filter(([, v]) => v !== "");
const colsOf = (rows: Row[]): string[] => (rows[0] ? Object.keys(rows[0]) : []);

function baseName(well: DdrWellInfo, detail: DdrReportDetail): string {
  const date = String(detail.header.DrillingDate ?? "").replace(/\//g, "-");
  return `DDR_${well.wellCode}_${date || detail.header.SerialNo}`;
}

// ── PDF ─────────────────────────────────────────────────────────────────────
export async function exportDdrPdf(well: DdrWellInfo, detail: DdrReportDetail): Promise<void> {
  const [{ default: pdfMake }, fonts] = await Promise.all([
    import("pdfmake/build/pdfmake.js"),
    import("pdfmake/build/vfs_fonts.js"),
  ]);
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const f = fonts as any;
  (pdfMake as any).vfs = f.vfs ?? f.default?.vfs ?? f.default?.pdfMake?.vfs ?? f.pdfMake?.vfs ?? f.default ?? f;
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const layout = {
    fillColor: (i: number) => (i === 0 ? "#dbeafe" : i % 2 === 0 ? "#f8fafc" : null),
    hLineColor: () => "#e5e7eb", vLineColor: () => "#e5e7eb",
  };
  const kvTable = (rows: [string, string][]): Content => ({
    table: { widths: ["auto", "*", "auto", "*"], body: twoCol(rows) },
    layout: "noBorders", fontSize: 9, margin: [0, 0, 0, 10],
  });
  const sectionTable = (rows: Row[]): Content => {
    const cols = colsOf(rows);
    return {
      table: {
        headerRows: 1,
        widths: cols.map((_c, i) => (i === cols.length - 1 ? "*" : "auto")),
        body: [
          cols.map((c) => ({ text: humanize(c), style: "th" })),
          ...rows.map((r) => cols.map((c) => fmt(r[c]))),
        ],
      },
      layout, fontSize: 7, margin: [0, 0, 0, 12],
    };
  };

  const content: Content[] = [
    { text: String(well.name ?? well.wellCode), style: "title" },
    { text: `Daily Drilling Report · #${fmt(detail.header.SerialNo)} · ${fmt(detail.header.DrillingDate)}`, style: "sub", margin: [0, 0, 0, 8] },
    { text: "Well", style: "h2" }, kvTable(pairs(well, WELL_FIELDS)),
    { text: "Report", style: "h2" }, kvTable(pairs(detail.header, HEADER_FIELDS)),
  ];
  if (detail.header.Description) {
    content.push({ text: "Operations narrative", style: "h2" },
      { text: String(detail.header.Description), fontSize: 9, margin: [0, 0, 0, 10] });
  }
  for (const { key, title } of SECTIONS) {
    const rows = detail[key];
    if (rows && rows.length) {
      content.push({ text: `${title} (${rows.length})`, style: "h2" }, sectionTable(rows));
    }
  }

  const doc: TDocumentDefinitions = {
    pageOrientation: "landscape", pageSize: "A4", pageMargins: [24, 40, 24, 30],
    footer: (cur: number, count: number) => ({
      columns: [
        { text: `Generated ${new Date().toLocaleString()}`, alignment: "left", margin: [24, 6, 0, 0], fontSize: 7, color: "#94a3b8" },
        { text: `Page ${cur} of ${count}`, alignment: "right", margin: [0, 6, 24, 0], fontSize: 7, color: "#94a3b8" },
      ],
    }),
    content,
    styles: {
      title: { fontSize: 15, bold: true, color: "#1e3a8a" },
      sub: { fontSize: 10, color: "#475569" },
      h2: { fontSize: 11, bold: true, color: "#1f2937", margin: [0, 4, 0, 4] },
      th: { bold: true, color: "#1e3a8a", fontSize: 7 },
    },
    defaultStyle: { font: "Roboto" },
  };
  pdfMake.createPdf(doc).download(`${baseName(well, detail)}.pdf`);
}

function twoCol(rows: [string, string][]): Content[][] {
  const body: Content[][] = [];
  for (let i = 0; i < rows.length; i += 2) {
    const a = rows[i], b = rows[i + 1];
    body.push([
      { text: a[0], bold: true, color: "#475569" }, { text: a[1] },
      b ? { text: b[0], bold: true, color: "#475569" } : { text: "" }, b ? { text: b[1] } : { text: "" },
    ]);
  }
  return body;
}

// ── Excel ─────────────────────────────────────────────────────────────────--
export async function exportDdrXlsx(well: DdrWellInfo, detail: DdrReportDetail): Promise<void> {
  const [xlsxMod, fsMod] = await Promise.all([import("xlsx"), import("file-saver")]);
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const XLSX: typeof import("xlsx") = (xlsxMod as any).utils ? xlsxMod : (xlsxMod as any).default;
  const saveAs: (data: Blob, filename: string) => void =
    (fsMod as any).saveAs ?? (fsMod as any).default?.saveAs ?? (fsMod as any).default;
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const wb = XLSX.utils.book_new();
  const summary = [
    ["WELL"], ...pairs(well, WELL_FIELDS),
    [""], ["REPORT"], ...pairs(detail.header, HEADER_FIELDS),
    ...(detail.header.Description ? [[""], ["Operations narrative", String(detail.header.Description)]] : []),
  ];
  const sumSheet = XLSX.utils.aoa_to_sheet(summary);
  sumSheet["!cols"] = [{ wch: 22 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, sumSheet, "Report");

  for (const { key, title } of SECTIONS) {
    const rows = detail[key];
    if (!rows || !rows.length) continue;
    const cols = colsOf(rows);
    const aoa = [cols.map(humanize), ...rows.map((r) => cols.map((c) => (typeof r[c] === "number" ? (r[c] as number) : fmt(r[c]))))];
    const sheet = XLSX.utils.aoa_to_sheet(aoa);
    sheet["!cols"] = cols.map(() => ({ wch: 14 }));
    XLSX.utils.book_append_sheet(wb, sheet, title.slice(0, 31));
  }

  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  saveAs(new Blob([out], { type: "application/octet-stream" }), `${baseName(well, detail)}.xlsx`);
}

/**
 * Archive mud weight → a.json's `density_ppg`, as a RANGE.
 *
 * Lives here because the Form view, the Tables view and the exports all need the
 * same answer — two independent conversions were showing two different numbers
 * for one field, and one of them silently dropped the day's minimum.
 *
 * The archive stores the weight per DR.xls: a MIN/MAX pair, mostly in pcf
 * (≈60–140), occasionally already ppg (≈8–20) or SG (≈1.0–2.5). The unit is not
 * recorded, so it is inferred from magnitude — the same rule the API's hydraulics
 * use. Returns null rather than guessing when the value is outside every band.
 */
export function mudWeightPpg(x: unknown): number | null {
  const n = typeof x === "number" ? x : Number(String(x ?? "").trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  const r = (v: number) => Number(v.toFixed(2));
  if (n >= 30) return r(n / 7.4805);   // pcf
  if (n >= 5) return r(n);             // already ppg
  if (n >= 0.8) return r(n * 8.345);   // SG
  return null;
}

/** "min–max" in ppg (collapsed when the two ends agree), or null. */
export function mudWeightRangePpg(min: unknown, max: unknown): string | null {
  const lo = mudWeightPpg(min), hi = mudWeightPpg(max);
  if (lo == null && hi == null) return null;
  if (lo == null || hi == null) return String(lo ?? hi);
  return lo === hi ? String(lo) : `${lo}–${hi}`;
}
