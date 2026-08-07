/**
 * The chrome every WellView report PDF shares: title band, identity line,
 * well-header block, section bars, tables and the page footer.
 *
 * Same contract as `stationTable.ts` — every export RETURNS a pdfmake `Content`
 * and never calls `pdfMake.createPdf`, so one report can compose several and the
 * geometry constants stay available to callers that budget a fixed page height.
 *
 * WHAT THE SAMPLES DO, AND WHAT WE DO
 * -----------------------------------
 * The 30 samples are laid out on a 612 × 792 pt letter page at 5.76 pt labels
 * over 7.68 pt values, with a 0.72 pt near-black frame, grey (#DEDEDE) section
 * bars, and a three-item footer (vendor URL · Page n/m · Report Printed).
 * We reproduce the STRUCTURE and the type scale, and:
 *
 *   • print no vendor logo and no vendor URL — this is not their report;
 *   • print the date in Jalali, because that is what this app stores;
 *   • carry our own unit tokens (mKB, m) in the labels the server sends.
 *
 * Numbers follow the samples exactly: comma thousands, two decimals for money,
 * a leading hyphen for negatives (never parentheses), and a BLANK cell for a
 * missing value — never "0.00", which would assert a number nobody entered.
 */
import type { Content, TableCell } from "pdfmake/interfaces";

// ── geometry, taken from the samples ────────────────────────────────────────
/** Portrait letter, matching the sample page box. */
export const LETTER_PORTRAIT: [number, number] = [612, 792];
/**
 * Body inset. The samples frame the page at 18 pt and start text at ~22 pt.
 *
 * The top margin holds the title band — one 11.5 pt line plus its 6 pt gap — and
 * nothing else, so it is kept tight: the samples fit a whole day on one page,
 * and generous margins are what push a report onto a second.
 */
export const PAGE_MARGINS: [number, number, number, number] = [22, 38, 22, 26];
/** Live width the body has to work with. */
export const BODY_WIDTH = LETTER_PORTRAIT[0] - PAGE_MARGINS[0] - PAGE_MARGINS[2];

/** One printed header cell: a label with its value beneath. */
export interface HeaderCell {
  label: string;
  value: string | number | null;
  /** How the assembler wants the number printed — see the API's `chrome.ts`. */
  kind?: "money" | "decimal" | "int" | "text";
  span?: number;
}
export type HeaderRow = HeaderCell[];

// ── value formatting ────────────────────────────────────────────────────────

/**
 * A money cell. Blank stays blank — the samples leave an unknown amount empty
 * rather than printing 0.00, and so must we: a printed zero is a claim.
 */
export function money(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "";
  return v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** A plain numeric cell, at `dp` decimals. Blank stays blank. */
export function decimal(v: number | null | undefined, dp = 2): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "";
  return v.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

/**
 * Any header value, as printed.
 *
 * A number's format comes from the cell's declared `kind`, never from the value:
 * deciding by `Number.isInteger` printed the sample's "10,218,000.00" as
 * "10,218,000" purely because that total happened to be round.
 */
export function headerValue(
  v: string | number | null | undefined,
  kind?: HeaderCell["kind"],
): string {
  if (v === null || v === undefined || v === "") return "";
  if (typeof v !== "number") return String(v);
  if (kind === "int") return v.toLocaleString("en-US", { maximumFractionDigits: 0 });
  return money(v);   // "money" and "decimal" print identically today
}

// ── building blocks ─────────────────────────────────────────────────────────

/** The centred report title. Reports that print no title simply omit this. */
export function titleBand(title: string): Content {
  return { text: title, style: "reportTitle", alignment: "center", margin: [0, 8, 0, 4] };
}

/**
 * The bold identity line above the header block — "Well Name:  <name>" on the
 * left, and on some reports a right-hand identity (report 02's "BHA#: 10, …").
 */
export function identityLine(wellName: string, right?: string | null): Content {
  const left: Content = {
    text: [{ text: "Well Name:   ", style: "identity" }, { text: wellName, style: "identity" }],
  };
  if (!right) return { ...left, margin: [0, 0, 0, 3] } as Content;
  return {
    columns: [left, { text: right, style: "identity", alignment: "right" }],
    margin: [0, 0, 0, 3],
  };
}

/**
 * A label-over-value grid — the shape of every WellView header, job and totals
 * block. Each row is drawn as a two-row table so the label sits directly above
 * its value and the column edges line up down the page.
 *
 * Empty cells are KEPT. A header that quietly shrinks when a well is only
 * half-filled is no longer the same document, and the samples print labelled
 * blanks throughout.
 */
export function labelValueGrid(rows: HeaderRow[], opts?: { align?: "left" | "right" }): Content {
  const stack: Content[] = [];
  for (const row of rows) {
    if (row.length === 0) continue;
    const widths = row.map((c) => (c.span && c.span > 1 ? `${c.span}*` : "*"));
    stack.push({
      table: {
        widths,
        body: [
          row.map((c): TableCell => ({ text: c.label, style: "cellLabel" })),
          row.map((c): TableCell => ({
            text: headerValue(c.value, c.kind),
            style: "cellValue",
            alignment: opts?.align ?? (typeof c.value === "number" ? "right" : "left"),
          })),
        ],
      },
      layout: GRID_LAYOUT,
    });
  }
  return { stack, margin: [0, 0, 0, 3] };
}

/** Thin rules on every edge, in the samples' hairline grey. */
const GRID_LAYOUT = {
  hLineWidth: () => 0.5,
  vLineWidth: () => 0.5,
  hLineColor: () => "#9ca3af",
  vLineColor: () => "#9ca3af",
  paddingTop: () => 1,
  paddingBottom: () => 1,
  paddingLeft: () => 3,
  paddingRight: () => 3,
};

/** A full-width grey section bar, the samples' #DEDEDE band with its caption. */
export function sectionBar(caption: string): Content {
  return {
    table: { widths: ["*"], body: [[{ text: caption, style: "sectionCaption" }]] },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => "#9ca3af",
      vLineColor: () => "#9ca3af",
      fillColor: () => "#dedede",
      paddingTop: () => 2,
      paddingBottom: () => 2,
      paddingLeft: () => 3,
      paddingRight: () => 3,
    },
    margin: [0, 2, 0, 0],
  };
}

/** A labelled free-text block, e.g. report 01's job Summary. */
export function narrativeBlock(label: string, text: string | null): Content {
  return {
    table: {
      widths: ["*"],
      body: [
        [{ text: label, style: "cellLabel" }],
        [{ text: text ?? "", style: "cellValue" }],
      ],
    },
    layout: GRID_LAYOUT,
    margin: [0, 0, 0, 3],
  };
}

/** One column of a report table. */
export interface ReportColumn<T> {
  header: string;
  width: number | string;
  align?: "left" | "right" | "center";
  cell: (row: T) => string;
}

/**
 * A banded report table with a repeating header row.
 *
 * `headerRows: 1` is what makes a table that spills carry its header onto the
 * next page — the samples do, and a headerless continuation is unreadable.
 */
export function reportTable<T>(columns: ReportColumn<T>[], rows: readonly T[]): Content {
  return {
    table: {
      headerRows: 1,
      widths: columns.map((c) => c.width),
      body: [
        columns.map((c): TableCell => ({
          text: c.header, style: "tableHeader", alignment: c.align ?? "left",
        })),
        ...rows.map((r) => columns.map((c): TableCell => ({
          text: c.cell(r), style: "tableCell", alignment: c.align ?? "left",
        }))),
      ],
    },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => "#9ca3af",
      vLineColor: () => "#9ca3af",
      fillColor: (rowIndex: number): string | null => (rowIndex === 0 ? "#dedede" : null),
      paddingTop: () => 1.5,
      paddingBottom: () => 1.5,
      paddingLeft: () => 3,
      paddingRight: () => 3,
    },
  };
}

/**
 * The page footer: "Page n/m" centred, the print date right.
 *
 * The samples put the vendor's URL on the left. We leave that side to the
 * caller (usually blank) — printing someone else's domain on our report would
 * be a small lie repeated on every page.
 */
export function reportFooter(printedOn: string, left = "") {
  return (currentPage: number, pageCount: number): Content => ({
    columns: [
      { text: left, alignment: "left", margin: [PAGE_MARGINS[0], 8, 0, 0], style: "footer" },
      { text: `Page ${currentPage}/${pageCount}`, alignment: "center", margin: [0, 8, 0, 0], style: "footer" },
      { text: `Report Printed:   ${printedOn}`, alignment: "right", margin: [0, 8, PAGE_MARGINS[2], 0], style: "footer" },
    ],
  });
}

/**
 * The styles every builder above depends on. Spread into a document
 * definition's `styles`; the sizes are the samples' own type scale.
 */
export const REPORT_STYLES = {
  reportTitle: { fontSize: 11.5, bold: true, color: "#111827" },
  identity: { fontSize: 9.6, bold: true, color: "#111827" },
  sectionCaption: { fontSize: 7.7, bold: true, color: "#111827" },
  cellLabel: { fontSize: 5.8, color: "#374151" },
  cellValue: { fontSize: 7.7, color: "#111827" },
  tableHeader: { fontSize: 5.8, bold: true, color: "#111827" },
  tableCell: { fontSize: 7.7, color: "#111827" },
  footer: { fontSize: 7.7, color: "#374151" },
} as const;

/**
 * The page frame the samples draw — a 0.72 pt near-black rectangle, 18 pt in
 * from every edge. Takes the page size because report 07 is legal, not letter.
 */
export function pageFrame(size: readonly [number, number] = LETTER_PORTRAIT): Content {
  return {
    canvas: [{
      type: "rect", x: 0, y: 0,
      w: size[0] - 36, h: size[1] - 36,
      lineWidth: 0.72, lineColor: "#030303",
    }],
    absolutePosition: { x: 18, y: 18 },
  };
}
